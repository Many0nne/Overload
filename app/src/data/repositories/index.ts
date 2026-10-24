import { prefsId, uuidv7 } from '@/domain/ids';
import { normalizeSearch } from '@/domain/search';
import type {
  BodyMeasurementRow,
  BodyMeasurementValues,
  Equipment,
  ExercisePrefsDoc,
  ExerciseRow,
  FolderRow,
  MeasurementType,
  Muscle,
  ProfileRow,
  RoutineDoc,
  RoutineRow,
  Settings,
  WorkoutDoc,
  WorkoutRow,
} from '@/domain/types';
import { db } from '../db';
import { deviceIdSync } from '../device';
import { currentUserId } from '../session';
import { saveRow, softDelete } from './base';

// ---------- Profil ----------

// Cette méthode permet de modifier le nom affiché, l'avatar ou les paramètres du profil connecté.
export async function updateProfile(patch: Partial<Pick<ProfileRow, 'display_name' | 'avatar_path'>>) {
  const prev = await db.profiles.get(currentUserId());
  if (!prev) throw new Error('Profil absent');
  return saveRow('profiles', { ...prev, ...patch });
}

// Cette méthode permet de modifier une partie des paramètres de l'utilisateur.
export async function updateSettings(patch: Partial<Settings>) {
  const prev = await db.profiles.get(currentUserId());
  if (!prev) throw new Error('Profil absent');
  return saveRow('profiles', { ...prev, settings: { ...prev.settings, ...patch } });
}

// ---------- Exercices ----------

export type ExerciseInput = {
  name: string;
  equipment: Equipment;
  primary_muscle: Muscle;
  secondary_muscles: Muscle[];
  measurement_type: MeasurementType;
  instructions: string | null;
};

// Cette méthode permet de créer un exercice personnalisé (ou du catalogue si catalog = true, réservé à l'admin).
export async function createExercise(input: ExerciseInput, catalog = false) {
  return saveRow('exercises', {
    id: uuidv7(),
    user_id: catalog ? null : currentUserId(),
    ...input,
    name_search: normalizeSearch(input.name),
    source_id: null,
    archived_at: null,
    deleted_at: null,
  });
}

// Cette méthode permet de modifier un exercice ; le type de mesure n'est changé que s'il n'est pas figé (§F7.2).
export async function updateExercise(id: string, patch: Partial<ExerciseInput>) {
  const prev = await db.exercises.get(id);
  if (!prev) throw new Error('Exercice absent');
  const frozen = prev.user_id === null || (await isExerciseUsed(id));
  const next: ExerciseRow = { ...prev, ...patch };
  if (frozen) next.measurement_type = prev.measurement_type;
  if (patch.name) next.name_search = normalizeSearch(patch.name);
  return saveRow('exercises', next);
}

// Cette méthode permet de savoir si un exercice apparaît dans au moins une séance non supprimée.
export async function isExerciseUsed(id: string): Promise<boolean> {
  const n = await db.workouts
    .where('exercise_ids')
    .equals(id)
    .filter((w) => w.deleted_at == null)
    .count();
  return n > 0;
}

// Cette méthode permet de supprimer un exercice : archivé s'il a déjà servi, supprimé sinon (§F7.2).
export async function removeExercise(id: string) {
  const prev = await db.exercises.get(id);
  if (!prev) return;
  if (prev.user_id === null || (await isExerciseUsed(id))) {
    await saveRow('exercises', { ...prev, archived_at: Date.now() });
  } else {
    await softDelete('exercises', id);
  }
}

// Cette méthode permet de restaurer un exercice personnel archivé (remet archived_at à null) lorsqu'il l'est.
export async function restoreExercise(id: string) {
  const prev = await db.exercises.get(id);
  if (!prev || prev.user_id === null || prev.archived_at == null) return;
  await saveRow('exercises', { ...prev, archived_at: null });
}

// ---------- Dossiers ----------

// Cette méthode permet de créer un dossier de routines, placé en dernier.
export async function createFolder(name: string) {
  const last = await db.folders.orderBy('position').last();
  return saveRow('folders', {
    id: uuidv7(),
    user_id: currentUserId(),
    name,
    position: (last?.position ?? 0) + 1,
    collapsed: false,
    deleted_at: null,
  });
}

// Cette méthode permet de renommer, replier ou déplacer un dossier.
export async function updateFolder(
  id: string,
  patch: Partial<Pick<FolderRow, 'name' | 'collapsed' | 'position'>>,
) {
  const prev = await db.folders.get(id);
  if (!prev) return;
  return saveRow('folders', { ...prev, ...patch });
}

// Cette méthode permet de supprimer un dossier ; ses routines passent dans « Mes routines ».
export async function deleteFolder(id: string) {
  const routines = await db.routines.where('folder_id').equals(id).toArray();
  for (const r of routines) await saveRow('routines', { ...r, folder_id: null });
  await softDelete('folders', id);
}

// ---------- Routines ----------

// Cette méthode permet de créer une routine dans un dossier (ou sans dossier).
export async function createRoutine(doc: RoutineDoc, folderId: string | null) {
  const last = await db.routines.orderBy('position').last();
  return saveRow('routines', {
    id: uuidv7(),
    user_id: currentUserId(),
    folder_id: folderId,
    position: (last?.position ?? 0) + 1,
    doc,
    deleted_at: null,
  });
}

// Cette méthode permet de modifier le contenu, le dossier ou la position d'une routine.
export async function updateRoutine(
  id: string,
  patch: Partial<Pick<RoutineRow, 'doc' | 'folder_id' | 'position'>>,
) {
  const prev = await db.routines.get(id);
  if (!prev) return;
  return saveRow('routines', { ...prev, ...patch });
}

// Cette méthode permet de dupliquer une routine (« Copie de … »).
export async function duplicateRoutine(id: string) {
  const prev = await db.routines.get(id);
  if (!prev) return;
  const doc: RoutineDoc = structuredClone(prev.doc);
  doc.name = `${doc.name} (copie)`;
  for (const ex of doc.exercises) {
    ex.id = uuidv7();
    for (const s of ex.sets) s.id = uuidv7();
  }
  return createRoutine(doc, prev.folder_id);
}

export const deleteRoutine = (id: string) => softDelete('routines', id);

// ---------- Séances ----------

// Cette méthode permet de créer une séance (en cours, ou terminée pour la saisie a posteriori).
export async function createWorkout(input: {
  doc: WorkoutDoc;
  routineId: string | null;
  startedAt: number;
  status: WorkoutRow['status'];
}) {
  return saveRow('workouts', {
    id: uuidv7(),
    user_id: currentUserId(),
    status: input.status,
    owner_device_id: deviceIdSync(),
    routine_id: input.routineId,
    started_at: input.startedAt,
    exercise_ids: [...new Set(input.doc.exercises.map((e) => e.exerciseId))],
    doc: input.doc,
    deleted_at: null,
  });
}

// Cette méthode permet d'enregistrer une modification de séance (appelée à chaque saisie, aucune perte si l'app est tuée).
export async function updateWorkout(
  id: string,
  patch: Partial<Pick<WorkoutRow, 'doc' | 'status' | 'started_at' | 'routine_id'>>,
) {
  const prev = await db.workouts.get(id);
  if (!prev) return;
  const next = { ...prev, ...patch };
  next.exercise_ids = [...new Set(next.doc.exercises.map((e) => e.exerciseId))];
  return saveRow('workouts', next);
}

export const deleteWorkout = (id: string) => softDelete('workouts', id);

// ---------- Mesures corporelles ----------

// Cette méthode permet d'enregistrer une mesure datée (création ou modification).
export async function saveMeasurement(input: {
  id?: string;
  measured_on: string;
  values: BodyMeasurementValues;
}) {
  const prev: Partial<BodyMeasurementRow> = input.id
    ? ((await db.body_measurements.get(input.id)) ?? {})
    : {};
  return saveRow('body_measurements', {
    ...prev,
    id: input.id ?? uuidv7(),
    user_id: currentUserId(),
    measured_on: input.measured_on,
    values: input.values,
    deleted_at: null,
  });
}

export const deleteMeasurement = (id: string) => softDelete('body_measurements', id);

// ---------- Réglages de progression ----------

// Cette méthode permet de modifier les réglages de progression d'un exercice (incrément, fourchette, objectif long terme).
export async function saveExercisePrefs(
  exerciseId: string,
  patch: Partial<Omit<ExercisePrefsDoc, 'schemaVersion'>>,
) {
  const userId = currentUserId();
  const id = prefsId(userId, exerciseId);
  const prev = await db.exercise_prefs.get(id);
  const doc: ExercisePrefsDoc = { schemaVersion: 1, ...(prev?.doc ?? {}), ...patch };
  for (const k of Object.keys(doc) as (keyof ExercisePrefsDoc)[]) if (doc[k] === undefined) delete doc[k];
  return saveRow('exercise_prefs', { id, user_id: userId, exercise_id: exerciseId, doc, deleted_at: null });
}
