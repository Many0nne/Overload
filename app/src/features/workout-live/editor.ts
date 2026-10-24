// Modifications pures d'un WorkoutDoc (séance en direct, saisie a posteriori et modification d'une séance passée).
import { uuidv7 } from '@/domain/ids';
import { pickValues } from '@/domain/measurement';
import type { SetKind, WorkoutDoc, WorkoutExercise, WorkoutSet } from '@/domain/types';

// Cette méthode permet de remplacer un exercice de la séance par sa version modifiée.
export function mapExercise(
  doc: WorkoutDoc,
  entryId: string,
  fn: (e: WorkoutExercise) => WorkoutExercise,
): WorkoutDoc {
  return { ...doc, exercises: doc.exercises.map((e) => (e.id === entryId ? fn(e) : e)) };
}

// Cette méthode permet de modifier une série d'un exercice.
export function mapSet(
  doc: WorkoutDoc,
  entryId: string,
  setId: string,
  fn: (s: WorkoutSet) => WorkoutSet,
): WorkoutDoc {
  return mapExercise(doc, entryId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? fn(s) : s)) }));
}

// Cette méthode permet d'ajouter une série qui recopie les valeurs de la précédente (§F7.4).
export function addSet(doc: WorkoutDoc, entryId: string): WorkoutDoc {
  return mapExercise(doc, entryId, (e) => {
    const last = e.sets[e.sets.length - 1];
    const kind: SetKind = last && last.kind !== 'warmup' ? last.kind : 'normal';
    const values = last ? pickValues(last, e.measurementType) : {};
    return { ...e, sets: [...e.sets, { id: uuidv7(), kind, done: false, ...values }] };
  });
}

// Cette méthode permet de supprimer une série (glissement vers la gauche).
export function removeSet(doc: WorkoutDoc, entryId: string, setId: string): WorkoutDoc {
  return mapExercise(doc, entryId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }));
}

// Cette méthode permet de changer la nature d'une série (choisie dans la feuille ouverte depuis son numéro).
export function setKind(doc: WorkoutDoc, entryId: string, setId: string, kind: SetKind): WorkoutDoc {
  return mapSet(doc, entryId, setId, (s) => (s.kind === kind ? s : { ...s, kind }));
}

// Cette méthode permet de déplacer un exercice d'un cran vers le haut (-1) ou le bas (+1).
export function moveExercise(doc: WorkoutDoc, entryId: string, delta: -1 | 1): WorkoutDoc {
  const i = doc.exercises.findIndex((e) => e.id === entryId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= doc.exercises.length) return doc;
  const list = [...doc.exercises];
  [list[i], list[j]] = [list[j]!, list[i]!];
  return { ...doc, exercises: list };
}

// Cette méthode permet de réordonner les exercices selon une liste d'ids (glisser-déposer).
export function reorderExercises(doc: WorkoutDoc, ids: string[]): WorkoutDoc {
  const byId = new Map(doc.exercises.map((e) => [e.id, e]));
  return { ...doc, exercises: ids.map((id) => byId.get(id)!).filter(Boolean) };
}

// Cette méthode permet de retirer un exercice de la séance.
export function removeExercise(doc: WorkoutDoc, entryId: string): WorkoutDoc {
  return { ...doc, exercises: doc.exercises.filter((e) => e.id !== entryId) };
}

// Cette méthode permet d'insérer un exercice déjà construit, à la fin ou à la place d'un autre (remplacement).
export function insertExercise(doc: WorkoutDoc, we: WorkoutExercise, replaceEntryId?: string): WorkoutDoc {
  if (!replaceEntryId) return { ...doc, exercises: [...doc.exercises, we] };
  return { ...doc, exercises: doc.exercises.map((e) => (e.id === replaceEntryId ? we : e)) };
}
