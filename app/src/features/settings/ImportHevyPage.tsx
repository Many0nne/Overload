import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { logError } from '@/data/errors';
import { useExerciseMap } from '@/data/queries';
import { HevyFormatError } from '@/domain/hevy';
import { EQUIPMENT_LABELS, EQUIPMENTS, MEASUREMENT_LABELS, MUSCLE_LABELS, MUSCLES } from '@/domain/labels';
import type { ExerciseRow } from '@/domain/types';
import { ExerciseList } from '@/features/library/ExerciseList';
import { Sheet, type SheetAction, SubHead, toast } from '@/ui/components';
import {
  defaultChoice,
  type ExerciseChoice,
  type HevyImportPlan,
  type HevyImportResult,
  type ImportExercise,
  prepareHevyImport,
  runHevyImport,
} from './importHevy';

// Cette méthode permet de formater un nombre avec son nom au singulier ou au pluriel (« 1 séance », « 3 séances »).
function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

// Cette méthode permet d'importer un export HEVY : choix des fichiers CSV, correspondance des exercices avec
// la bibliothèque (suggestion, exercice perso ou ignoré), puis écriture des séances et mesures.
export default function ImportHevyPage() {
  const navigate = useNavigate();
  const exercises = useExerciseMap();
  const input = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<HevyImportPlan | null>(null);
  const [choices, setChoices] = useState<Map<string, ExerciseChoice>>(new Map());
  const [editing, setEditing] = useState<ImportExercise | null>(null);
  const [picking, setPicking] = useState<ImportExercise | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HevyImportResult | null>(null);

  // Cette méthode permet de lire les fichiers choisis et de préremplir les correspondances par défaut.
  const onFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const p = await prepareHevyImport(files);
      setChoices(new Map(p.exercises.map((e) => [e.title, defaultChoice(e)])));
      setPlan(p);
    } catch (e) {
      if (!(e instanceof HevyFormatError)) void logError('import-hevy', e);
      toast(e instanceof Error ? e.message : 'Lecture impossible');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  // Cette méthode permet de changer la correspondance d'un exercice HEVY.
  const choose = (title: string, choice: ExerciseChoice) => setChoices((m) => new Map(m).set(title, choice));

  // Cette méthode permet de lancer l'écriture de l'import et d'afficher le bilan.
  const run = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      setResult(await runHevyImport(plan, choices));
    } catch (e) {
      void logError('import-hevy', e);
      toast(e instanceof Error ? e.message : 'Import impossible');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <>
        <SubHead title="Import HEVY" onBack={() => navigate('/profile/settings')} />
        <div className="section">
          <div className="card">
            <p style={{ fontWeight: 600 }}>Import terminé</p>
            <p className="t2" style={{ marginTop: 6 }}>
              {plural(result.workouts, 'séance importée', 'séances importées')}
              {result.exercisesCreated > 0 &&
                ` · ${plural(result.exercisesCreated, 'exercice perso créé', 'exercices perso créés')}`}
              {result.measurements > 0 &&
                ` · ${plural(result.measurements, 'mesure enregistrée', 'mesures enregistrées')}`}
            </p>
          </div>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
            onClick={() => navigate('/')}
          >
            Voir l'historique
          </button>
        </div>
      </>
    );
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".csv,text/csv"
      multiple
      hidden
      data-testid="hevy-files"
      onChange={(e) => void onFiles([...(e.target.files ?? [])])}
    />
  );

  if (!plan) {
    return (
      <>
        <SubHead title="Import HEVY" />
        <div className="section">
          <p className="t2">
            Dans HEVY, exporte tes séances en CSV depuis les paramètres (et tes mesures si tu veux les
            garder), puis choisis le ou les fichiers : <b>workout_data.csv</b>, <b>measurement_data.csv</b>.
          </p>
          <p className="t2" style={{ marginTop: 10 }}>
            Les séances déjà importées sont ignorées : tu peux réimporter un export plus récent sans créer de
            doublons.
          </p>
          {fileInput}
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 18 }}
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? 'Lecture…' : 'Choisir les fichiers'}
          </button>
        </div>
      </>
    );
  }

  const willImport = plan.workouts.filter((w) =>
    w.exercises.some((ex) => choices.get(ex.title)?.kind !== 'skip'),
  ).length;
  const nothing = willImport === 0 && plan.measurements.length === 0;

  // Cette méthode permet d'afficher la cible choisie d'un exercice HEVY (exercice existant, perso ou ignoré).
  const target = (ex: ImportExercise) => {
    const c = choices.get(ex.title);
    if (!c || c.kind === 'skip') return <span className="muted">Ignoré</span>;
    if (c.kind === 'create') return <span className="tag">Nouvel exercice perso</span>;
    const row = exercises.get(c.exerciseId);
    return (
      <span style={{ color: 'var(--accent)' }}>
        {row?.name ?? '—'}
        {row && row.measurement_type !== ex.measurementType && (
          <span className="tag" style={{ marginLeft: 6, color: 'var(--warm)' }}>
            {MEASUREMENT_LABELS[row.measurement_type]}
          </span>
        )}
      </span>
    );
  };

  const current = editing ? choices.get(editing.title) : undefined;
  const sheetActions: SheetAction[] = [];
  if (editing) {
    const s = editing.suggestion;
    if (s && !(current?.kind === 'existing' && current.exerciseId === s.candidate.id))
      sheetActions.push({
        label: `Utiliser « ${s.candidate.name} »`,
        onClick: () => {
          choose(editing.title, { kind: 'existing', exerciseId: s.candidate.id });
          setEditing(null);
        },
      });
    sheetActions.push({
      label: 'Choisir dans la bibliothèque…',
      onClick: () => {
        setPicking(editing);
        setEditing(null);
      },
    });
    if (current?.kind !== 'create')
      sheetActions.push({
        label: 'Créer un exercice perso',
        onClick: () => choose(editing.title, defaultChoice({ ...editing, suggestion: null })),
      });
    if (current?.kind !== 'skip')
      sheetActions.push({
        label: 'Ignorer cet exercice',
        kind: 'danger',
        onClick: () => {
          choose(editing.title, { kind: 'skip' });
          setEditing(null);
        },
      });
    if (current?.kind === 'create')
      sheetActions.push({ label: 'Valider', kind: 'primary', onClick: () => setEditing(null) });
  }

  return (
    <>
      <SubHead title="Import HEVY" onBack={() => setPlan(null)} />
      <div className="section">
        <div className="card">
          <p style={{ fontWeight: 600 }}>
            {plural(plan.workouts.length, 'nouvelle séance', 'nouvelles séances')}
          </p>
          <p className="t2" style={{ marginTop: 4, fontSize: '.875rem' }}>
            {plan.alreadyImported > 0 &&
              `${plural(plan.alreadyImported, 'déjà importée', 'déjà importées')} · `}
            {plural(plan.measurements.length, 'mesure à enregistrer', 'mesures à enregistrer')}
            {plan.measurementsUnchanged > 0 && ` · ${plan.measurementsUnchanged} déjà à jour`}
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 12 }}
            disabled={busy || nothing}
            onClick={() => void run()}
          >
            {busy
              ? 'Import en cours…'
              : nothing
                ? 'Rien à importer'
                : `Importer ${plural(willImport, 'séance', 'séances')}`}
          </button>
        </div>
      </div>

      {plan.exercises.length > 0 && (
        <div className="section">
          <div className="section-title">
            Exercices <span>{plan.exercises.length}</span>
          </div>
          <p className="t2" style={{ fontSize: '.8125rem', marginBottom: 6 }}>
            Vérifie la correspondance de chaque exercice HEVY. Touche une ligne pour la changer.
          </p>
        </div>
      )}
      <div>
        {plan.exercises.map((ex) => (
          <button key={ex.title} className="lib-item" onClick={() => setEditing(ex)}>
            <span style={{ minWidth: 0 }}>
              <div className="n">{ex.title}</div>
              <div className="m">
                {plural(ex.setCount, 'série', 'séries')} · {MEASUREMENT_LABELS[ex.measurementType]}
              </div>
              <div className="m" style={{ marginTop: 4 }}>
                → {target(ex)}
              </div>
            </span>
          </button>
        ))}
      </div>

      <Sheet
        open={editing !== null}
        title={editing?.title}
        onClose={() => setEditing(null)}
        actions={sheetActions}
      >
        {editing && current?.kind === 'create' && (
          <>
            <p className="t2" style={{ fontSize: '.875rem' }}>
              Nouvel exercice perso · {MEASUREMENT_LABELS[current.measurement_type]}
            </p>
            <div className="field">
              <span>Muscle principal</span>
              <div className="chips wrap">
                {MUSCLES.map((m) => (
                  <button
                    key={m}
                    className={`chip${current.primary_muscle === m ? ' on' : ''}`}
                    onClick={() => choose(editing.title, { ...current, primary_muscle: m })}
                  >
                    {MUSCLE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Équipement</span>
              <div className="chips wrap">
                {EQUIPMENTS.map((eq) => (
                  <button
                    key={eq}
                    className={`chip${current.equipment === eq ? ' on' : ''}`}
                    onClick={() => choose(editing.title, { ...current, equipment: eq })}
                  >
                    {EQUIPMENT_LABELS[eq]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </Sheet>

      {picking && (
        <div className="scrim show" style={{ alignItems: 'stretch' }}>
          <div className="sheet" style={{ height: '100%', overflowY: 'auto', borderRadius: 0 }}>
            <div
              className="head"
              style={{ padding: '8px 0 12px', paddingTop: 'calc(var(--safe-top) + 8px)', top: 0 }}
            >
              <button className="btn-ghost" onClick={() => setPicking(null)}>
                Annuler
              </button>
              <span className="title-sm">{picking.title}</span>
              <span style={{ width: 60 }} />
            </div>
            <div style={{ margin: '0 -18px' }}>
              <ExerciseList
                onPick={(e: ExerciseRow) => {
                  choose(picking.title, { kind: 'existing', exerciseId: e.id });
                  setPicking(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
