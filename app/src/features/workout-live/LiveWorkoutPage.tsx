import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '@/data/db';
import { deviceIdSync } from '@/data/device';
import { useCompletedWorkouts, useExerciseMap, useSettings, useWorkout } from '@/data/queries';
import { deleteWorkout, updateWorkout } from '@/data/repositories';
import { takeOverWorkout } from '@/data/sync/engine';
import { formatClock, formatKg } from '@/domain/format';
import type { SetField } from '@/domain/measurement';
import { checkSet, exerciseInWorkout, lastTime, previousSets } from '@/domain/previous';
import { workoutBadges } from '@/domain/records';
import { doneSetCount, unvalidatedCount } from '@/domain/summary';
import { goalAchievedSet } from '@/domain/trend';
import type { ExercisePrefsDoc, ExerciseRow, WorkoutDoc, WorkoutRow } from '@/domain/types';
import { workoutVolumeKg } from '@/domain/volume';
import { ExerciseList } from '@/features/library/ExerciseList';
import { Sheet, toast } from '@/ui/components';
import { ChevronDownIcon, TimerIcon } from '@/ui/icons';
import { useNow } from '@/ui/useNow';
import { useWakeLock } from '@/ui/wakeLock';
import { type ExerciseActions, ExerciseBlock } from './ExerciseBlock';
import {
  addSet,
  insertExercise,
  mapExercise,
  mapSet,
  moveExercise,
  removeExercise,
  removeSet,
  setKind,
} from './editor';
import { RestPanel } from './RestPanel';
import { listenAudioUnlock, useRestTimer } from './restTimer';
import { buildWorkoutExercise, loadBuildContext } from './start';

// Cette méthode permet d'afficher le chronomètre de durée totale, isolé pour ne pas re-rendre la liste (§11).
function Elapsed(props: { startedAt: number }) {
  const now = useNow(1000);
  return <>{formatClock(Math.max(0, now - props.startedAt) / 1000)}</>;
}

// Cette méthode permet d'afficher la séance en direct ou la modification d'une séance passée (même éditeur, §11).
// Chaque modification est écrite dans Dexie immédiatement ; l'état local donne un retour visuel instantané.
export default function LiveWorkoutPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const row = useWorkout(id);
  const history = useCompletedWorkouts();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const prefsRows = useLiveQuery(() => db.exercise_prefs.toArray(), []);
  const [doc, setDoc] = useState<WorkoutDoc | null>(null);
  const [errors, setErrors] = useState<Record<string, SetField[]>>({});
  const [picker, setPicker] = useState<{ replace?: string } | null>(null);
  const [dialog, setDialog] = useState<'finish' | 'discard' | 'empty' | 'takeover' | null>(null);
  const docRef = useRef<WorkoutDoc | null>(null);
  const timer = useRestTimer();

  const me = deviceIdSync();
  const live = row?.status === 'in_progress';
  const readOnly = Boolean(row && live && row.owner_device_id !== me);

  useEffect(() => {
    void timer.load();
  }, [timer.load]);

  // Chaque toucher pendant la séance garde le son débloqué pour le bip de fin de repos (iOS, §F7.4).
  useEffect(() => listenAudioUnlock(), []);

  // L'état local suit la base tant qu'on ne modifie pas, ou quand la séance appartient à un autre appareil.
  useEffect(() => {
    if (!row) return;
    if (!docRef.current || readOnly || row.client_device_id !== me) {
      docRef.current = row.doc;
      setDoc(row.doc);
    }
  }, [row, readOnly, me]);

  useWakeLock(Boolean(live && !readOnly && settings.keepAwake));

  // Cette méthode permet d'appliquer une modification : état local immédiat, puis écriture Dexie + outbox.
  const commit = useCallback(
    (fn: (d: WorkoutDoc) => WorkoutDoc) => {
      if (!docRef.current || !id) return;
      const next = fn(docRef.current);
      docRef.current = next;
      setDoc(next);
      void updateWorkout(id, { doc: next });
    },
    [id],
  );

  const prefs = useMemo(
    () => new Map<string, ExercisePrefsDoc>((prefsRows ?? []).map((p) => [p.exercise_id, p.doc])),
    [prefsRows],
  );

  // « La dernière fois » de chaque exercice, pour la colonne Précédent (§10.4).
  // biome-ignore lint/correctness/useExhaustiveDependencies: ne dépend que du début de la séance, pas de chaque saisie
  const previousByEntry = useMemo(() => {
    const m = new Map<string, ReturnType<typeof exerciseInWorkout>>();
    if (!row || !doc || !history) return m;
    for (const e of doc.exercises) {
      const w = lastTime(e.exerciseId, row.routine_id, row.started_at, history, row.id);
      m.set(e.id, w ? exerciseInWorkout(w, e.exerciseId) : undefined);
    }
    return m;
  }, [row?.id, row?.routine_id, row?.started_at, doc, history]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: dépendances choisies pour ne pas recalculer à chaque saisie
  const badges = useMemo(() => {
    if (!row || !doc || !history) return undefined;
    return workoutBadges({ ...row, doc } as WorkoutRow, history);
  }, [row?.id, row?.started_at, doc, history]);

  // Badge 🎯 : première série qui réalise l'objectif à long terme après sa fixation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dépendances choisies pour ne pas recalculer à chaque saisie
  const goalSets = useMemo(() => {
    const m = new Map<string, string>();
    if (!row || !doc || !history) return m;
    const all = [...history.filter((h) => h.id !== row.id), { ...row, doc } as WorkoutRow];
    for (const e of doc.exercises) {
      const goal = prefs.get(e.exerciseId)?.longTermGoal;
      if (!goal) continue;
      const hit = goalAchievedSet(e.exerciseId, all, goal);
      if (hit?.workoutId === row.id) m.set(e.id, hit.setId);
    }
    return m;
  }, [row?.id, doc, history, prefs]);

  const actions: ExerciseActions = useMemo(
    () => ({
      onPatchSet: (entryId, setId, patch) => {
        commit((d) => mapSet(d, entryId, setId, (s) => ({ ...s, ...patch })));
        setErrors((e) => (e[setId] ? { ...e, [setId]: [] } : e));
      },
      onCheck: (entryId, setId) => {
        const d = docRef.current;
        const entry = d?.exercises.find((e) => e.id === entryId);
        const set = entry?.sets.find((s) => s.id === setId);
        if (!d || !entry || !set) return;
        if (set.done) {
          commit((x) =>
            mapSet(x, entryId, setId, (s) => ({ ...s, done: false, doneAt: undefined, rpe: undefined })),
          );
          return;
        }
        const idx = entry.sets.findIndex((s) => s.id === setId);
        const prev = previousSets(
          entry.sets.map((s) => s.kind),
          previousByEntry.get(entryId),
        )[idx];
        const res = checkSet(set, entry.measurementType, prev, Date.now());
        if (!res.ok) {
          setErrors((e) => ({ ...e, [setId]: res.missing }));
          return;
        }
        commit((x) => mapSet(x, entryId, setId, () => res.set));
        if (live && entry.restS) {
          const name = exercises.get(entry.exerciseId)?.name ?? 'Exercice';
          void timer.start(
            {
              workoutId: row!.id,
              exerciseEntryId: entryId,
              setId,
              endsAt: Date.now() + entry.restS * 1000,
              totalS: entry.restS,
              label: `${name}, série ${idx + 1}`,
            },
            settings.restNotification,
          );
        }
      },
      onSetKind: (entryId, setId, kind) => commit((d) => setKind(d, entryId, setId, kind)),
      onCopyPrevious: (entryId, setId) => {
        const entry = docRef.current?.exercises.find((e) => e.id === entryId);
        if (!entry) return;
        const idx = entry.sets.findIndex((s) => s.id === setId);
        const prev = previousSets(
          entry.sets.map((s) => s.kind),
          previousByEntry.get(entryId),
        )[idx];
        if (!prev) return;
        commit((d) =>
          mapSet(d, entryId, setId, (s) => ({
            ...s,
            weight: prev.weight,
            reps: prev.reps,
            durationS: prev.durationS,
            distance: prev.distance,
          })),
        );
      },
      onDeleteSet: (entryId, setId) => commit((d) => removeSet(d, entryId, setId)),
      onAddSet: (entryId) => commit((d) => addSet(d, entryId)),
      onNote: (entryId, note) =>
        commit((d) => mapExercise(d, entryId, (e) => ({ ...e, note: note || undefined }))),
      onRest: (entryId, restS) => commit((d) => mapExercise(d, entryId, (e) => ({ ...e, restS }))),
      onMove: (entryId, delta) => commit((d) => moveExercise(d, entryId, delta)),
      onReplace: (entryId) => setPicker({ replace: entryId }),
      onRemove: (entryId) => commit((d) => removeExercise(d, entryId)),
    }),
    [commit, previousByEntry, exercises, live, row, settings.restNotification, timer.start],
  );

  // Cette méthode permet d'ajouter (ou de remplacer par) un exercice choisi, avec son objectif calculé à l'ajout (§10.7).
  const pick = async (ex: ExerciseRow) => {
    if (!row) return;
    const replace = picker?.replace;
    setPicker(null);
    const ctx = await loadBuildContext(row.routine_id, live);
    ctx.now = row.started_at;
    ctx.history = ctx.history.filter((w) => w.id !== row.id);
    const we = buildWorkoutExercise(ex, ctx);
    commit((d) => insertExercise(d, we, replace));
  };

  // Cette méthode permet de lancer la fin de séance : contrôle des séries non validées, puis récapitulatif (§F7.4).
  const finish = () => {
    if (!doc) return;
    if (doneSetCount(doc) === 0) return setDialog('empty');
    if (unvalidatedCount(doc) > 0) return setDialog('finish');
    navigate(`/workout/${id}/summary`);
  };

  // Cette méthode permet d'abandonner la séance sans rien conserver (après confirmation).
  const discard = async () => {
    if (!id) return;
    await timer.skip();
    await deleteWorkout(id);
    navigate(live ? '/seance' : '/', { replace: true });
  };

  if (row === undefined || !doc) return <div className="page no-tab" />;
  if (row === null || row.deleted_at != null) {
    return (
      <div className="page no-tab">
        <p className="empty">Cette séance n'existe plus.</p>
        <button className="link-c" onClick={() => navigate('/')}>
          Retour à l'accueil
        </button>
      </div>
    );
  }

  const volume = workoutVolumeKg(doc);
  const sets = doneSetCount(doc);
  const excluded = new Set<string>();

  return (
    <div className="page no-tab live-wrap" style={{ paddingBottom: 200 }}>
      <div className="live-head">
        <div className="head" style={{ position: 'static', paddingBottom: 6 }}>
          <button
            className="icon-btn"
            aria-label="Réduire"
            onClick={() => navigate(live ? '/' : `/history/${row.id}`)}
          >
            <ChevronDownIcon />
          </button>
          <span style={{ fontSize: '1.0625rem', fontWeight: 700 }}>
            {doc.title || (live ? 'Séance' : 'Modifier la séance')}
          </span>
          <div className="right">
            {live && settings.keepAwake && (
              <span className="icon-btn" title="Écran maintenu allumé">
                <TimerIcon />
              </span>
            )}
            {!readOnly && (
              <button
                className="btn btn-primary btn-sm"
                onClick={live ? finish : () => navigate(`/workout/${id}/summary`)}
              >
                {live ? 'Terminer' : 'Suivant'}
              </button>
            )}
          </div>
        </div>
        <div className="stats-row">
          {live && (
            <div className="stat">
              <div className="k">Durée</div>
              <div className="v acc">
                <Elapsed startedAt={row.started_at} />
              </div>
            </div>
          )}
          <div className="stat">
            <div className="k">Volume</div>
            <div className="v">{formatKg(volume, settings.units.weight, 0)}</div>
          </div>
          <div className="stat">
            <div className="k">Séries</div>
            <div className="v">{sets}</div>
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="section">
          <div className="card" style={{ border: '1px solid var(--line)' }}>
            <b>Séance en cours sur un autre appareil</b>
            <p className="t2" style={{ fontSize: '.875rem', marginTop: 6, lineHeight: 1.5 }}>
              Tu peux la reprendre ici. Les saisies pas encore synchronisées sur l'autre appareil seront
              perdues.
            </p>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 12 }}
              onClick={() => setDialog('takeover')}
            >
              Reprendre ici
            </button>
          </div>
        </div>
      )}

      {doc.exercises.map((e, i) => (
        <ExerciseBlock
          key={e.id}
          entry={e}
          exercise={exercises.get(e.exerciseId)}
          previous={previousByEntry.get(e.id)}
          units={settings.units}
          setBadges={badges?.sets ?? {}}
          entryRecord={Boolean(badges?.entries[e.id]?.length)}
          goalSetId={goalSets.get(e.id)}
          errors={errors}
          readOnly={readOnly}
          showRest={live}
          rpeEnabled={settings.rpeEnabled}
          isFirst={i === 0}
          isLast={i === doc.exercises.length - 1}
          actions={actions}
        />
      ))}
      {doc.exercises.length === 0 && (
        <div className="section" style={{ textAlign: 'center', padding: '40px 18px' }}>
          <div style={{ fontSize: '2.5rem' }}>🏋️</div>
          <p className="t2" style={{ marginTop: 8 }}>
            Séance vide. Ajoute ton premier exercice.
          </p>
        </div>
      )}

      {!readOnly && (
        <div className="section" style={{ marginTop: 16 }}>
          <button
            className="btn btn-soft btn-block"
            style={{ color: 'var(--accent)' }}
            onClick={() => setPicker({})}
          >
            + Ajouter un exercice
          </button>
          <button
            className="btn btn-soft btn-danger btn-block"
            style={{ marginTop: 8 }}
            onClick={() => setDialog('discard')}
          >
            {live ? 'Abandonner' : 'Supprimer la séance'}
          </button>
        </div>
      )}

      {live && !readOnly && <RestPanel sound={settings.timerSound} notify={settings.restNotification} />}

      {picker && (
        <div className="scrim show" style={{ alignItems: 'stretch' }}>
          <div
            className="sheet"
            style={{
              height: '100%',
              overflowY: 'auto',
              borderRadius: 0,
            }}
          >
            <div
              className="head"
              style={{ padding: '8px 0 12px', paddingTop: 'calc(var(--safe-top) + 8px)', top: 0 }}
            >
              <button className="btn-ghost" onClick={() => setPicker(null)}>
                Annuler
              </button>
              <span className="title-sm">{picker.replace ? 'Remplacer par…' : 'Ajouter un exercice'}</span>
              <span style={{ width: 60 }} />
            </div>
            <div style={{ margin: '0 -18px' }}>
              <ExerciseList onPick={(ex) => void pick(ex)} exclude={excluded} />
            </div>
          </div>
        </div>
      )}

      <Sheet
        open={dialog === 'finish'}
        title="Ignorer les séries non validées ?"
        onClose={() => setDialog(null)}
        actions={[
          {
            label: 'Ignorer et terminer',
            kind: 'primary',
            onClick: () => navigate(`/workout/${id}/summary`),
          },
          { label: 'Continuer la séance', onClick: () => setDialog(null) },
        ]}
      >
        <p>{unvalidatedCount(doc)} série(s) non cochée(s) ne seront pas enregistrées.</p>
      </Sheet>
      <Sheet
        open={dialog === 'empty'}
        title="Aucune série validée"
        onClose={() => setDialog(null)}
        actions={[
          { label: 'Abandonner la séance', kind: 'danger', onClick: discard },
          { label: 'Continuer la séance', onClick: () => setDialog(null) },
        ]}
      >
        <p>Une séance sans série validée ne peut pas être enregistrée.</p>
      </Sheet>
      <Sheet
        open={dialog === 'discard'}
        title={live ? 'Abandonner la séance ?' : 'Supprimer la séance ?'}
        onClose={() => setDialog(null)}
        actions={[
          { label: live ? 'Abandonner' : 'Supprimer', kind: 'danger', onClick: discard },
          { label: 'Continuer la séance', onClick: () => setDialog(null) },
        ]}
      >
        <p>{live ? 'Rien ne sera conservé.' : 'Les records et statistiques seront recalculés.'}</p>
      </Sheet>
      <Sheet
        open={dialog === 'takeover'}
        title="Reprendre la séance ici ?"
        onClose={() => setDialog(null)}
        actions={[
          {
            label: 'Reprendre ici',
            kind: 'primary',
            onClick: async () => {
              setDialog(null);
              try {
                await takeOverWorkout(row.id);
                docRef.current = null;
                toast('Séance reprise sur cet appareil');
              } catch {
                toast('Impossible hors ligne');
              }
            },
          },
          { label: 'Annuler', onClick: () => setDialog(null) },
        ]}
      >
        <p>L'autre appareil passera en lecture seule. Ses saisies non synchronisées seront perdues.</p>
      </Sheet>
    </div>
  );
}
