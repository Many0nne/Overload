import { db } from '@/data/db';
import { deviceIdSync } from '@/data/device';
import { loadCompletedWorkouts } from '@/data/queries';
import { createWorkout } from '@/data/repositories';
import { useSession } from '@/data/session';
import { uuidv7 } from '@/domain/ids';
import { exerciseInWorkout, lastTime, prefillValues, previousSets } from '@/domain/previous';
import { applyTargets, computeTargets, lastRoutineRepRange, resolveRepRange } from '@/domain/progression';
import { normalizeGroups } from '@/domain/superset';
import {
  DEFAULT_SETTINGS,
  type ExercisePrefsDoc,
  type ExerciseRow,
  type RoutineExercise,
  type RoutineRow,
  type SetKind,
  type Settings,
  type WorkoutDoc,
  type WorkoutExercise,
  type WorkoutRow,
} from '@/domain/types';

export class WorkoutAlreadyRunning extends Error {
  constructor(public workoutId: string) {
    super('Une séance est déjà en cours');
  }
}

export type BuildContext = {
  settings: Settings;
  history: WorkoutRow[]; // séances terminées, started_at croissant
  routines: RoutineRow[];
  prefs: Map<string, ExercisePrefsDoc>;
  routineId: string | null;
  now: number;
  computeGoals: boolean; // faux en saisie a posteriori
};

// Cette méthode permet de charger tout ce qu'il faut pour pré-remplir des exercices (historique, routines, réglages, paramètres).
export async function loadBuildContext(routineId: string | null, computeGoals = true): Promise<BuildContext> {
  const userId = useSession.getState().userId;
  const [history, routines, prefsRows, profile] = await Promise.all([
    loadCompletedWorkouts(),
    db.routines.filter((r) => r.deleted_at == null).toArray(),
    db.exercise_prefs.filter((p) => p.deleted_at == null).toArray(),
    userId ? db.profiles.get(userId) : undefined,
  ]);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(profile?.settings ?? {}) },
    history,
    routines,
    prefs: new Map(prefsRows.map((p) => [p.exercise_id, p.doc])),
    routineId,
    now: Date.now(),
    computeGoals,
  };
}

// Cette méthode permet de construire un exercice de séance pré-rempli : objectif figé, sinon routine, sinon « Précédent » (§10.4, §10.7).
// Sans routine, les séries prévues reprennent la structure de la dernière fois, ou une seule série normale.
export function buildWorkoutExercise(
  exercise: ExerciseRow,
  ctx: BuildContext,
  routineEx?: RoutineExercise,
): WorkoutExercise {
  const type = exercise.measurement_type;
  const refWorkout = lastTime(exercise.id, ctx.routineId, ctx.now, ctx.history);
  const reference = refWorkout ? exerciseInWorkout(refWorkout, exercise.id) : undefined;
  const kinds: SetKind[] = routineEx?.sets.length
    ? routineEx.sets.map((s) => s.kind)
    : reference?.sets.length
      ? reference.sets.filter((s) => s.done).map((s) => s.kind)
      : ['normal'];
  if (kinds.length === 0) kinds.push('normal');
  const prefs = ctx.prefs.get(exercise.id);
  const repRange = resolveRepRange({
    measurementType: type,
    routineRange: routineEx?.repRange,
    prefs,
    lastRoutineRange: lastRoutineRepRange(exercise.id, ctx.routines),
  });
  const result = ctx.computeGoals
    ? computeTargets({
        exercise,
        prefs,
        settings: ctx.settings,
        repRange,
        plannedSets: kinds.map((kind) => ({ kind })),
        history: ctx.history.filter((w) => w.exercise_ids.includes(exercise.id)),
        reference:
          reference && refWorkout ? { exercise: reference, startedAt: refWorkout.started_at } : undefined,
        now: ctx.now,
      })
    : undefined;
  const prev = previousSets(kinds, reference);
  const we: WorkoutExercise = {
    id: uuidv7(),
    exerciseId: exercise.id,
    measurementType: type,
    restS: routineEx ? routineEx.restS : (reference?.restS ?? ctx.settings.defaultRestS),
    ...(routineEx?.note ? { note: routineEx.note } : {}),
    ...(repRange ? { repRange } : {}),
    sets: kinds.map((kind, i) => ({
      id: uuidv7(),
      kind,
      done: false,
      ...prefillValues(type, {
        routineSet: routineEx?.sets[i],
        routineReps: repRange && kind !== 'warmup' ? repRange.min : undefined,
        previous: prev[i],
      }),
    })),
  };
  return applyTargets(we, result);
}

// Cette méthode permet de vérifier qu'aucune séance n'est déjà en cours sur le compte (vérification locale, §6.4).
async function assertNoRunningWorkout(): Promise<void> {
  const running = await db.workouts
    .where('status')
    .equals('in_progress')
    .filter((w) => w.deleted_at == null)
    .first();
  if (running) throw new WorkoutAlreadyRunning(running.id);
}

// Cette méthode permet de démarrer une séance vide.
export async function startEmptyWorkout(): Promise<string> {
  await assertNoRunningWorkout();
  const doc: WorkoutDoc = { schemaVersion: 2, title: '', exercises: [] };
  const row = await createWorkout({ doc, routineId: null, startedAt: Date.now(), status: 'in_progress' });
  return row.id;
}

// Cette méthode permet de démarrer une séance pré-remplie depuis une routine (P2), avec les objectifs du jour.
export async function startFromRoutine(routineId: string): Promise<string> {
  await assertNoRunningWorkout();
  const routine = await db.routines.get(routineId);
  if (!routine) throw new Error('Routine introuvable');
  const ctx = await loadBuildContext(routineId);
  const exercises: WorkoutExercise[] = [];
  for (const re of routine.doc.exercises) {
    const ex = await db.exercises.get(re.exerciseId);
    if (!ex || ex.deleted_at != null) continue;
    exercises.push({ ...buildWorkoutExercise(ex, ctx, re), ...(re.groupId ? { groupId: re.groupId } : {}) });
  }
  const doc: WorkoutDoc = { schemaVersion: 2, title: '', exercises: normalizeGroups(exercises) };
  const row = await createWorkout({ doc, routineId, startedAt: ctx.now, status: 'in_progress' });
  return row.id;
}

// Cette méthode permet de créer une séance passée (saisie a posteriori), sans minuteur ni objectif (§F7.4).
export async function createPastWorkout(startedAt: number, durationS: number): Promise<string> {
  const doc: WorkoutDoc = { schemaVersion: 2, title: '', durationS, exercises: [] };
  const row = await createWorkout({ doc, routineId: null, startedAt, status: 'completed' });
  return row.id;
}

// Cette méthode permet de savoir si cet appareil peut modifier la séance (propriétaire tant qu'elle est en cours, §F7.9).
export function canEdit(w: WorkoutRow): boolean {
  return w.status === 'completed' || w.owner_device_id === deviceIdSync();
}
