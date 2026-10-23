import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '@/data/db';
import { useCompletedWorkouts, useExerciseMap, useProfile, useSettings, useWorkout } from '@/data/queries';
import { createRoutine, deleteWorkout, updateRoutine, updateWorkout } from '@/data/repositories';
import { useSession } from '@/data/session';
import { syncNow } from '@/data/sync/scheduler';
import {
  criterionLabel,
  formatDuration,
  formatDurationHuman,
  formatKg,
  formatTargets,
  parseDuration,
} from '@/domain/format';
import { uuidv7 } from '@/domain/ids';
import { targetsMet } from '@/domain/progression';
import { workoutBadges } from '@/domain/records';
import { diffRoutine, workoutToRoutine } from '@/domain/routineDiff';
import { defaultTitle, isForgotten, pruneUnvalidated, workoutSummary } from '@/domain/summary';
import type { RoutineRow, WorkoutDoc, WorkoutRow } from '@/domain/types';
import { PhotoView } from '@/features/history/PhotoView';
import { useRestTimer } from '@/features/workout-live/restTimer';
import { NoteField, Sheet, SubHead, toast } from '@/ui/components';
import { WORKOUT_NOTE_MAX } from '@/ui/note';
import { compressImage } from '@/ui/photo';

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// Cette méthode permet de formater une date locale pour un champ <input type="date">.
function dateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Cette méthode permet de formater une heure locale pour un champ <input type="time">.
function timeInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Cette méthode permet d'afficher le récapitulatif de fin de séance (ou de modification) et d'enregistrer (§F7.4, P2.6-8).
// Elle propose ensuite de mettre à jour la routine si la structure a changé, ou d'enregistrer la séance comme routine.
export default function SummaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const row = useWorkout(id);
  const history = useCompletedWorkouts();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const profile = useProfile();
  const userId = useSession((s) => s.userId);
  const [routine, setRoutine] = useState<RoutineRow | undefined>();
  const [title, setTitle] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [after, setAfter] = useState<{
    kind: 'update' | 'saveAs';
    summary: string[];
    doc: WorkoutDoc;
  } | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const live = row?.status === 'in_progress';

  useEffect(() => {
    if (!row || title !== null) return;
    void (async () => {
      const r = row.routine_id ? await db.routines.get(row.routine_id) : undefined;
      setRoutine(r && r.deleted_at == null ? r : undefined);
      setTitle(row.doc.title || defaultTitle(r?.doc.name, row.started_at));
      setNote(row.doc.note ?? '');
      setDate(dateInput(row.started_at));
      setTime(timeInput(row.started_at));
      const d = row.doc.durationS ?? Math.floor((Date.now() - row.started_at) / 1000);
      setDuration(formatDuration(d));
      setPhoto(row.doc.photoPath);
    })();
  }, [row, title]);

  const pruned = useMemo(() => (row ? pruneUnvalidated(row.doc) : undefined), [row]);
  const badges = useMemo(
    () =>
      row && pruned && history ? workoutBadges({ ...row, doc: pruned } as WorkoutRow, history) : undefined,
    [row, pruned, history],
  );

  if (!row || !pruned || title === null) return <div className="page no-tab" />;

  const durationS = parseDuration(duration) ?? 0;
  const summary = workoutSummary(
    { started_at: row.started_at, doc: { ...pruned, durationS } },
    badges,
    Date.now(),
  );
  const forgotten = live && isForgotten(Math.floor((Date.now() - row.started_at) / 1000));
  const goalRows = pruned.exercises
    .map((e) => ({ e, met: targetsMet(e) }))
    .filter((x) => x.met !== undefined);

  // Cette méthode permet de choisir une photo, de la compresser et de la garder localement jusqu'à l'envoi (§12).
  const pickPhoto = async (file: File | undefined) => {
    if (!file || !userId) return;
    try {
      const blob = await compressImage(file);
      const path = `${userId}/${row.id}.jpg`;
      await db.blobs.put({ path, blob, kind: 'photo', uploaded: false });
      setPhoto(path);
    } catch {
      toast('Photo illisible');
    }
  };

  // Cette méthode permet d'enregistrer la séance terminée avec les champs du récapitulatif.
  const save = async () => {
    if (!parseDuration(duration)) return toast('Durée invalide (h:mm:ss ou m:ss)');
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const startedAt = new Date(y!, (m ?? 1) - 1, d, hh, mm).getTime();
    const doc: WorkoutDoc = {
      ...pruned,
      title: title.trim() || defaultTitle(routine?.doc.name, startedAt),
      note: note.trim() || undefined,
      photoPath: photo,
      durationS,
    };
    if (doc.exercises.length === 0) return toast('Aucune série validée à enregistrer');
    await updateWorkout(row.id, {
      doc,
      status: 'completed',
      started_at: Number.isNaN(startedAt) ? row.started_at : startedAt,
    });
    if (live) await useRestTimer.getState().skip();
    void syncNow();
    if (!live) return navigate(`/history/${row.id}`, { replace: true });
    if (routine) {
      const diff = diffRoutine(doc, routine.doc, (exId) => exercises.get(exId)?.name ?? 'Exercice');
      if (diff.changed) return setAfter({ kind: 'update', summary: diff.summary, doc });
    } else {
      setRoutineName(doc.title.replace(/ – .*$/, ''));
      return setAfter({ kind: 'saveAs', summary: [], doc });
    }
    navigate('/', { replace: true });
  };

  // Cette méthode permet de reprendre la séance telle qu'elle a été faite dans la routine (mise à jour d'un bloc, P2.8).
  const applyRoutineUpdate = async () => {
    if (!after || !routine) return;
    const next = workoutToRoutine(after.doc, {
      name: routine.doc.name,
      note: routine.doc.note,
      existing: routine.doc,
      newId: uuidv7,
    });
    await updateRoutine(routine.id, { doc: next });
    toast('Routine mise à jour');
    navigate('/', { replace: true });
  };

  // Cette méthode permet de créer une nouvelle routine à partir de la séance improvisée (P3).
  const saveAsRoutine = async () => {
    if (!after) return;
    const doc = workoutToRoutine(after.doc, {
      name: routineName.trim() || 'Nouvelle routine',
      newId: uuidv7,
    });
    await createRoutine(doc, null);
    toast('Routine enregistrée');
    navigate('/', { replace: true });
  };

  return (
    <div className="page no-tab center-page">
      <SubHead title={live ? 'Enregistrer la séance' : 'Modifier la séance'} />
      {live && (
        <div className="recap-hero">
          <div className="big">🎉</div>
          <h2>Belle séance{profile ? `, ${profile.display_name}` : ''} !</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {longDate.format(row.started_at)}
          </p>
        </div>
      )}
      {forgotten && (
        <div className="section">
          <div className="card" style={{ border: '1px solid var(--warm)' }}>
            <b>Séance oubliée ?</b>
            <p className="t2" style={{ fontSize: '.875rem', marginTop: 6 }}>
              Elle dure plus de 4 h. Corrige la durée avant d'enregistrer.
            </p>
            <label className="field">
              <span>Durée (h:mm:ss)</span>
              <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" />
            </label>
          </div>
        </div>
      )}
      <div className="recap-grid">
        <div className="card">
          <div className="v">{formatDurationHuman(durationS)}</div>
          <div className="k">Durée</div>
        </div>
        <div className="card">
          <div className="v">{formatKg(summary.volumeKg, settings.units.weight, 0)}</div>
          <div className="k">Volume</div>
        </div>
        <div className="card">
          <div className="v">{summary.setCount}</div>
          <div className="k">Séries</div>
        </div>
        <div className="card">
          <div className="v" style={{ color: 'var(--gold)' }}>
            {summary.recordCount}
          </div>
          <div className="k">Records</div>
        </div>
        <div className="card">
          <div className="v" style={{ color: 'var(--done)' }}>
            {summary.targets.met}/{summary.targets.total}
          </div>
          <div className="k">Objectifs</div>
        </div>
      </div>
      {goalRows.length > 0 && (
        <div className="section">
          <div className="section-title">Objectifs du jour</div>
          <div className="card">
            <ul className="rec-list">
              {goalRows.map(({ e, met }) => (
                <li key={e.id}>
                  <span>
                    {exercises.get(e.exerciseId)?.name ?? 'Exercice'}
                    <small className="muted" style={{ display: 'block', fontSize: '.75rem' }}>
                      {formatTargets(
                        e.sets.map((s) => s.target),
                        e.measurementType,
                        settings.units,
                      )}
                    </small>
                  </span>
                  <b className={met ? 'ok' : 'ko'}>{met ? '✓ atteint' : '✗'}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {badges && badges.pairs.length > 0 && (
        <div className="section">
          <div className="section-title">Records battus</div>
          <div className="card">
            <ul className="rec-list">
              {badges.pairs.map((p) => {
                const ex = exercises.get(p.exerciseId);
                return (
                  <li key={p.exerciseId + p.criterion}>
                    <span>{ex?.name ?? 'Exercice'}</span>
                    <b className="pr-pill">🏆 {ex ? criterionLabel(p.criterion, ex.measurement_type) : ''}</b>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <div className="section">
        <label className="field">
          <span>Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Note</span>
          <NoteField
            rows={2}
            maxLength={WORKOUT_NOTE_MAX}
            placeholder="Comment s'est passée la séance ?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {photo ? (
          <div style={{ position: 'relative' }}>
            <PhotoView path={photo} height={180} />
            <button
              className="tag"
              style={{ position: 'absolute', top: 18, right: 8 }}
              onClick={() => setPhoto(undefined)}
            >
              Retirer
            </button>
          </div>
        ) : (
          <label className="photo-add" style={{ cursor: 'pointer' }}>
            + Ajouter une photo
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
          </label>
        )}
        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Début</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="field">
            <span>Durée</span>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
        </div>
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 20, height: 52 }}
          onClick={() => void save()}
        >
          Enregistrer
        </button>
        {live && (
          <button
            className="btn btn-danger btn-block"
            style={{ marginTop: 6 }}
            onClick={() => setConfirmDiscard(true)}
          >
            Abandonner la séance
          </button>
        )}
      </div>

      <Sheet
        open={after?.kind === 'update'}
        title="Mettre à jour la routine ?"
        onClose={() => navigate('/', { replace: true })}
        actions={[
          { label: 'Mettre à jour la routine', kind: 'primary', onClick: applyRoutineUpdate },
          { label: 'Garder la routine telle quelle', onClick: () => navigate('/', { replace: true }) },
        ]}
      >
        <p>La séance diffère de « {routine?.doc.name} » :</p>
        <ul>
          {after?.summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Sheet>
      <Sheet
        open={after?.kind === 'saveAs'}
        title="Enregistrer comme routine ?"
        onClose={() => navigate('/', { replace: true })}
        actions={[
          { label: 'Créer la routine', kind: 'primary', onClick: saveAsRoutine },
          { label: 'Non merci', onClick: () => navigate('/', { replace: true }) },
        ]}
      >
        <p>Réutilise cette séance comme modèle (exercices, séries, charges).</p>
        <label className="field">
          <span>Nom de la routine</span>
          <input value={routineName} onChange={(e) => setRoutineName(e.target.value)} />
        </label>
      </Sheet>
      <Sheet
        open={confirmDiscard}
        title="Abandonner la séance ?"
        onClose={() => setConfirmDiscard(false)}
        actions={[
          {
            label: 'Abandonner',
            kind: 'danger',
            onClick: async () => {
              await useRestTimer.getState().skip();
              await deleteWorkout(row.id);
              navigate('/seance', { replace: true });
            },
          },
          { label: 'Annuler', onClick: () => setConfirmDiscard(false) },
        ]}
      >
        <p>Rien ne sera conservé.</p>
      </Sheet>
    </div>
  );
}
