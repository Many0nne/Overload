// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Chiffres d'une séance pour le récapitulatif et l'historique (§F7.4, §F7.5).
import { workoutTargetsMet } from './progression.ts';
import type { WorkoutBadges } from './records.ts';
import type { WorkoutDoc, WorkoutRow } from './types.ts';
import { workoutVolumeKg } from './volume.ts';

// Seuil de « séance oubliée » (§F7.4).
export const FORGOTTEN_WORKOUT_S = 4 * 3600;

// Cette méthode permet d'obtenir la durée d'une séance en secondes : durée enregistrée, sinon temps écoulé depuis le début.
export function workoutDurationS(w: Pick<WorkoutRow, 'started_at' | 'doc'>, now: number): number {
  if (w.doc.durationS !== undefined) return w.doc.durationS;
  return Math.max(0, Math.floor((now - w.started_at) / 1000));
}

// Cette méthode permet de compter les séries validées d'une séance (échauffements compris).
export function doneSetCount(doc: WorkoutDoc): number {
  return doc.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

export type WorkoutSummary = {
  durationS: number;
  volumeKg: number;
  setCount: number;
  recordCount: number;
  targets: { met: number; total: number };
};

// Cette méthode permet de calculer les chiffres d'une séance (durée, volume, séries, records, objectifs atteints).
export function workoutSummary(
  w: Pick<WorkoutRow, 'started_at' | 'doc'>,
  badges: WorkoutBadges | undefined,
  now: number,
): WorkoutSummary {
  return {
    durationS: workoutDurationS(w, now),
    volumeKg: workoutVolumeKg(w.doc),
    setCount: doneSetCount(w.doc),
    recordCount: badges?.pairs.length ?? 0,
    targets: workoutTargetsMet(w.doc),
  };
}

// Cette méthode permet d'obtenir les premiers exercices d'une séance avec leur nombre de séries validées (carte d'historique).
export function firstExercises(doc: WorkoutDoc, n = 3): { exerciseId: string; setCount: number }[] {
  return doc.exercises
    .map((e) => ({ exerciseId: e.exerciseId, setCount: e.sets.filter((s) => s.done).length }))
    .filter((e) => e.setCount > 0)
    .slice(0, n);
}

// Cette méthode permet de compter les séries non validées d'une séance (question « Ignorer les séries non validées ? »).
export function unvalidatedCount(doc: WorkoutDoc): number {
  return doc.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
}

// Cette méthode permet de savoir si une séance peut être enregistrée (au moins une série validée).
export function canSave(doc: WorkoutDoc): boolean {
  return doneSetCount(doc) > 0;
}

// Cette méthode permet de retirer les séries non validées et les exercices devenus vides avant l'enregistrement.
export function pruneUnvalidated(doc: WorkoutDoc): WorkoutDoc {
  return {
    ...doc,
    exercises: doc.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length > 0),
  };
}

// Cette méthode permet de savoir si une durée correspond à une séance oubliée (plus de 4 h).
export function isForgotten(durationS: number): boolean {
  return durationS > FORGOTTEN_WORKOUT_S;
}

const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });

// Cette méthode permet de proposer un titre par défaut (« Push – mardi », ou « Séance – mardi » sans routine).
export function defaultTitle(routineName: string | undefined, startedAt: number): string {
  return `${routineName?.trim() || 'Séance'} – ${weekday.format(new Date(startedAt))}`;
}

// Cette méthode permet de lister les exercices distincts d'une séance (colonne dénormalisée exercise_ids).
export function exerciseIdsOf(doc: WorkoutDoc): string[] {
  return [...new Set(doc.exercises.map((e) => e.exerciseId))];
}
