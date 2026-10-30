// Réglages propres à un exercice (issue #124) : noter l'effort (RPE) et objectif de progression, actifs par défaut.
// Stockés dans les préférences de l'utilisateur (ExercisePrefsDoc), qui surchargent la valeur par défaut de l'exercice.
import type { ExercisePrefsDoc, ExerciseRow } from './types';

export type ExerciseOptions = { rpe: boolean; progression: boolean };

const ALL_ON: ExerciseOptions = { rpe: true, progression: true };

/** Exercices du catalogue (par source_id) dont un réglage est désactivé par défaut. */
export const CATALOG_OPTION_DEFAULTS: Readonly<Record<string, Partial<ExerciseOptions>>> = {
  'overload:Warm_Up': { rpe: false, progression: false },
};

type ExerciseRef = Partial<Pick<ExerciseRow, 'user_id' | 'source_id'>> | undefined;

// Cette méthode permet d'obtenir les réglages par défaut d'un exercice : ceux du catalogue s'il en prévoit, sinon tout actif.
export function defaultExerciseOptions(exercise: ExerciseRef): ExerciseOptions {
  const own =
    exercise?.user_id === null && exercise.source_id
      ? CATALOG_OPTION_DEFAULTS[exercise.source_id]
      : undefined;
  return { ...ALL_ON, ...own };
}

// Cette méthode permet de résoudre les réglages d'un exercice lorsque l'utilisateur a pu les changer (préférence, sinon défaut).
export function exerciseOptions(exercise: ExerciseRef, prefs: ExercisePrefsDoc | undefined): ExerciseOptions {
  const d = defaultExerciseOptions(exercise);
  return { rpe: prefs?.rpe ?? d.rpe, progression: prefs?.progression ?? d.progression };
}

// Cette méthode permet de préparer la modification d'un réglage : la valeur par défaut de l'exercice n'est pas stockée.
export function optionPatch(
  exercise: ExerciseRef,
  key: keyof ExerciseOptions,
  value: boolean,
): Partial<Pick<ExercisePrefsDoc, keyof ExerciseOptions>> {
  return { [key]: value === defaultExerciseOptions(exercise)[key] ? undefined : value };
}

// Cette méthode permet de lister les exercices dont le RPE est masqué, pour l'écarter des affichages et des statistiques.
export function rpeHiddenIds(
  exercises: Iterable<ExerciseRow>,
  prefs: ReadonlyMap<string, ExercisePrefsDoc>,
): Set<string> {
  const out = new Set<string>();
  for (const e of exercises) if (!exerciseOptions(e, prefs.get(e.id)).rpe) out.add(e.id);
  return out;
}
