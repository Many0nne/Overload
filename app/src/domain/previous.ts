// « Précédent » : dernière fois et série équivalente (§F7.4, §10.4).
import { missingFields, pickValues, type SetField } from './measurement';
import type {
  MeasurementType,
  RoutineSet,
  SetKind,
  SetTarget,
  WorkoutExercise,
  WorkoutRow,
  WorkoutSet,
} from './types';

// Cette méthode permet de trouver « la dernière fois » d'un exercice avant une date : même routine d'abord, sinon toute séance.
// Seules les séances terminées et non supprimées comptent ; `workouts` peut contenir n'importe quelles séances.
export function lastTime(
  exerciseId: string,
  routineId: string | null,
  before: number,
  workouts: WorkoutRow[],
  excludeId?: string,
): WorkoutRow | undefined {
  let sameRoutine: WorkoutRow | undefined;
  let any: WorkoutRow | undefined;
  for (const w of workouts) {
    if (w.status !== 'completed' || w.deleted_at !== null || w.id === excludeId) continue;
    if (w.started_at >= before) continue;
    if (!w.doc.exercises.some((e) => e.exerciseId === exerciseId)) continue;
    const newer = (cur: WorkoutRow | undefined) =>
      !cur || w.started_at > cur.started_at || (w.started_at === cur.started_at && w.id > cur.id);
    if (newer(any)) any = w;
    if (routineId !== null && w.routine_id === routineId && newer(sameRoutine)) sameRoutine = w;
  }
  return sameRoutine ?? any;
}

// Cette méthode permet de fusionner les entrées d'un exercice dans une séance (cas d'un exercice ajouté deux fois).
export function exerciseInWorkout(workout: WorkoutRow, exerciseId: string): WorkoutExercise | undefined {
  const entries = workout.doc.exercises.filter((e) => e.exerciseId === exerciseId);
  const first = entries[0];
  if (!first) return undefined;
  if (entries.length === 1) return first;
  return { ...first, sets: entries.flatMap((e) => e.sets) };
}

// Cette méthode permet d'obtenir le rang d'une série parmi celles de même type (0 pour la 1ʳᵉ série normale, etc.).
export function rankOfKind(kinds: SetKind[], index: number): number {
  const kind = kinds[index];
  let rank = 0;
  for (let i = 0; i < index; i++) if (kinds[i] === kind) rank++;
  return rank;
}

// Cette méthode permet de trouver la série équivalente de la dernière fois : même type et même rang, sinon undefined (« — »).
export function equivalentSet(
  todayKinds: SetKind[],
  index: number,
  previousSets: WorkoutSet[],
): WorkoutSet | undefined {
  const kind = todayKinds[index];
  if (kind === undefined) return undefined;
  const rank = rankOfKind(todayKinds, index);
  const sameKind = previousSets.filter((s) => s.done && s.kind === kind);
  return sameKind[rank];
}

// Cette méthode permet de calculer la série « Précédent » de chaque ligne d'un exercice de séance.
export function previousSets(
  todayKinds: SetKind[],
  previous: WorkoutExercise | undefined,
): (WorkoutSet | undefined)[] {
  return todayKinds.map((_, i) => (previous ? equivalentSet(todayKinds, i, previous.sets) : undefined));
}

export type SetValues = Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance'>;

// Cette méthode permet de pré-remplir une série : objectif, sinon valeurs de la routine, sinon valeurs précédentes.
// Les reps de la routine viennent de la fourchette (min) puisque les séries de routine n'en portent pas.
export function prefillValues(
  type: MeasurementType,
  sources: { target?: SetTarget; routineSet?: RoutineSet; routineReps?: number; previous?: WorkoutSet },
): SetValues {
  const { target, routineSet, routineReps, previous } = sources;
  const fromTarget: SetValues = target
    ? { weight: target.weight, reps: target.reps, durationS: target.durationS }
    : {};
  const fromRoutine: SetValues = routineSet
    ? {
        weight: routineSet.weight,
        reps: routineReps,
        durationS: routineSet.durationS,
        distance: routineSet.distance,
      }
    : {};
  const fromPrev: SetValues = previous ? pickValues(previous, type) : {};
  const merged: SetValues = {
    weight: fromTarget.weight ?? fromRoutine.weight ?? fromPrev.weight,
    reps: fromTarget.reps ?? fromRoutine.reps ?? fromPrev.reps,
    durationS: fromTarget.durationS ?? fromRoutine.durationS ?? fromPrev.durationS,
    distance: fromRoutine.distance ?? fromPrev.distance,
  };
  return pickValues(merged, type);
}

export type CheckResult = { ok: true; set: WorkoutSet } | { ok: false; missing: SetField[] };

// Cette méthode permet de valider une série : les champs vides sont remplis depuis « Précédent », sinon la coche est refusée.
export function checkSet(
  set: WorkoutSet,
  type: MeasurementType,
  previous: WorkoutSet | undefined,
  now: number,
): CheckResult {
  let filled: WorkoutSet = { ...set };
  const missing = missingFields(filled, type);
  if (missing.length && previous) {
    const prev = pickValues(previous, type);
    for (const f of missing) {
      if (f === 'weight' && prev.weight) filled = { ...filled, weight: prev.weight };
      if (f === 'reps' && prev.reps !== undefined) filled = { ...filled, reps: prev.reps };
      if (f === 'duration' && prev.durationS !== undefined) filled = { ...filled, durationS: prev.durationS };
      if (f === 'distance' && prev.distance) filled = { ...filled, distance: prev.distance };
    }
  }
  const still = missingFields(filled, type);
  if (still.length) return { ok: false, missing: still };
  return { ok: true, set: { ...filled, done: true, doneAt: now } };
}
