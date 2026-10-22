// Volume : seule la charge externe compte (§F7.6, §10.2).
import type { MeasurementType, WorkoutDoc, WorkoutExercise, WorkoutSet } from './types';
import { toKg } from './units';

// Cette méthode permet de calculer le volume brut d'une série en kg (kg × reps pour poids et reps ou lesté, 0 sinon).
export function setVolumeKg(set: WorkoutSet, type: MeasurementType): number {
  if (type !== 'weight_reps' && type !== 'weighted_bw') return 0;
  if (!set.weight || set.reps === undefined) return 0;
  return toKg(set.weight) * set.reps;
}

// Cette méthode permet de savoir si une série validée compte pour le volume (validée et hors échauffement).
export function countsForVolume(set: WorkoutSet): boolean {
  return set.done && set.kind !== 'warmup';
}

// Cette méthode permet de calculer le volume d'un exercice de séance en kg (séries validées hors échauffement).
export function exerciseVolumeKg(we: WorkoutExercise): number {
  let total = 0;
  for (const s of we.sets) if (countsForVolume(s)) total += setVolumeKg(s, we.measurementType);
  return total;
}

// Cette méthode permet de calculer le volume total d'une séance en kg.
export function workoutVolumeKg(doc: WorkoutDoc): number {
  return doc.exercises.reduce((sum, we) => sum + exerciseVolumeKg(we), 0);
}
