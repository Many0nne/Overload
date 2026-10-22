// Différence de structure séance ↔ routine et conversion séance → routine (§F P2.8, §F7.5, §10.5).
import { hasReps } from './measurement';
import type { RepRange, RoutineDoc, RoutineExercise, SetKind, WorkoutDoc, WorkoutExercise } from './types';

type Signature = { exerciseId: string; restS: number | null; kinds: SetKind[] }[];

// Cette méthode permet d'obtenir la signature de structure d'une séance (séries validées uniquement).
export function workoutSignature(doc: WorkoutDoc): Signature {
  return doc.exercises
    .map((e) => ({
      exerciseId: e.exerciseId,
      restS: e.restS,
      kinds: e.sets.filter((s) => s.done).map((s) => s.kind),
    }))
    .filter((e) => e.kinds.length > 0);
}

// Cette méthode permet d'obtenir la signature de structure d'une routine (séries cibles).
export function routineSignature(doc: RoutineDoc): Signature {
  return doc.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    restS: e.restS,
    kinds: e.sets.map((s) => s.kind),
  }));
}

const fmtRest = (s: number | null) => (s === null ? 'Off' : `${s} s`);

// Cette méthode permet de comparer une séance à sa routine et de résumer les changements de structure en français.
// Les poids, répétitions et fourchettes sont ignorés ; `nameOf` donne le nom d'un exercice.
export function diffRoutine(
  workout: WorkoutDoc,
  routine: RoutineDoc,
  nameOf: (exerciseId: string) => string,
): { changed: boolean; summary: string[] } {
  const a = routineSignature(routine);
  const b = workoutSignature(workout);
  const same =
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i]!;
      return (
        x.exerciseId === y.exerciseId &&
        x.restS === y.restS &&
        x.kinds.length === y.kinds.length &&
        x.kinds.every((k, j) => k === y.kinds[j])
      );
    });
  if (same) return { changed: false, summary: [] };

  const summary: string[] = [];
  const aIds = a.map((x) => x.exerciseId);
  const bIds = b.map((x) => x.exerciseId);
  const added = bIds.filter((id) => !aIds.includes(id));
  const removed = aIds.filter((id) => !bIds.includes(id));
  if (added.length)
    summary.push(`+${added.length} exercice${added.length > 1 ? 's' : ''} : ${added.map(nameOf).join(', ')}`);
  if (removed.length)
    summary.push(
      `−${removed.length} exercice${removed.length > 1 ? 's' : ''} : ${removed.map(nameOf).join(', ')}`,
    );
  const commonA = aIds.filter((id) => bIds.includes(id));
  const commonB = bIds.filter((id) => aIds.includes(id));
  if (commonA.some((id, i) => id !== commonB[i])) summary.push('Ordre des exercices modifié');
  for (const x of a) {
    const y = b.find((e) => e.exerciseId === x.exerciseId);
    if (!y) continue;
    const name = nameOf(x.exerciseId);
    if (x.kinds.length !== y.kinds.length)
      summary.push(`${name} : ${x.kinds.length} → ${y.kinds.length} séries`);
    else if (x.kinds.some((k, j) => k !== y.kinds[j])) summary.push(`${name} : types de séries modifiés`);
    if (x.restS !== y.restS)
      summary.push(`Repos ${name.toLowerCase()} : ${fmtRest(x.restS)} → ${fmtRest(y.restS)}`);
  }
  if (!summary.length) summary.push('Structure modifiée');
  return { changed: true, summary };
}

// Cette méthode permet de construire une routine à partir d'une séance (mise à jour de routine ou « enregistrer comme routine »).
// Seules les séries validées sont reprises ; fourchette : celle de la routine existante, sinon celle de la séance, sinon le défaut.
export function workoutToRoutine(
  workout: WorkoutDoc,
  options: {
    name: string;
    note?: string;
    existing?: RoutineDoc;
    defaultRange?: (exerciseId: string) => RepRange | undefined;
    newId: () => string;
  },
): RoutineDoc {
  const exercises: RoutineExercise[] = [];
  for (const we of workout.exercises) {
    const done = we.sets.filter((s) => s.done);
    if (!done.length) continue;
    const kept = options.existing?.exercises.find((e) => e.exerciseId === we.exerciseId);
    const repRange = hasReps(we.measurementType)
      ? (kept?.repRange ?? we.repRange ?? options.defaultRange?.(we.exerciseId) ?? rangeFromSets(we))
      : undefined;
    const ex: RoutineExercise = {
      id: kept?.id ?? options.newId(),
      exerciseId: we.exerciseId,
      restS: we.restS,
      sets: done.map((s) => {
        const set: RoutineExercise['sets'][number] = { id: options.newId(), kind: s.kind };
        if (s.weight) set.weight = { ...s.weight };
        if (s.durationS !== undefined) set.durationS = s.durationS;
        if (s.distance) set.distance = { ...s.distance };
        return set;
      }),
    };
    const note = we.note ?? kept?.note;
    if (note) ex.note = note;
    if (repRange) ex.repRange = repRange;
    exercises.push(ex);
  }
  const doc: RoutineDoc = { schemaVersion: 1, name: options.name, exercises };
  const note = options.note ?? options.existing?.note;
  if (note) doc.note = note;
  return doc;
}

// Cette méthode permet de déduire une fourchette des reps réalisées sur les séries de travail (dernier recours).
function rangeFromSets(we: WorkoutExercise): RepRange | undefined {
  const reps = we.sets
    .filter((s) => s.done && (s.kind === 'normal' || s.kind === 'failure') && s.reps !== undefined)
    .map((s) => s.reps!);
  if (!reps.length) return undefined;
  return { min: Math.min(...reps), max: Math.max(...reps) };
}
