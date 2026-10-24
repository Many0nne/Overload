// Exercice en cours d'une séance, pour le bandeau « Séance en cours » (§F7.9). Module léger : il est dans le JS initial.
import type { WorkoutDoc } from './types';

// Cette méthode permet de trouver l'exercice en cours d'une séance : le premier ayant une série non validée,
// sinon le dernier de la séance (tout est validé), ou undefined si la séance est vide.
export function currentExerciseId(doc: WorkoutDoc): string | undefined {
  const pending = doc.exercises.find((e) => e.sets.some((s) => !s.done));
  return (pending ?? doc.exercises.at(-1))?.exerciseId;
}
