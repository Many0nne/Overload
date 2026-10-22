import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyMeasurementRow,
  ExercisePrefsRow,
  ExerciseRow,
  FolderRow,
  ProfileRow,
  RoutineRow,
  SyncTable,
  WorkoutRow,
} from '@/domain/types';

// Une entrée par élément modifié localement et pas encore accepté par le serveur (§6.1).
export type OutboxEntry = {
  seq?: number;
  table: SyncTable;
  row_id: string;
  client_updated_at: number;
};

export type BlobEntry = { path: string; blob: Blob; kind: 'photo' | 'avatar'; uploaded: boolean };
export type MetaEntry = { key: string; value: unknown };

export class OverloadDb extends Dexie {
  profiles!: EntityTable<ProfileRow, 'id'>;
  exercises!: EntityTable<ExerciseRow, 'id'>;
  folders!: EntityTable<FolderRow, 'id'>;
  routines!: EntityTable<RoutineRow, 'id'>;
  workouts!: EntityTable<WorkoutRow, 'id'>;
  body_measurements!: EntityTable<BodyMeasurementRow, 'id'>;
  exercise_prefs!: EntityTable<ExercisePrefsRow, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;
  blobs!: EntityTable<BlobEntry, 'path'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name = 'overload') {
    super(name);
    this.version(1).stores({
      profiles: 'id',
      exercises: 'id, user_id, name_search, primary_muscle, equipment',
      folders: 'id, position',
      routines: 'id, folder_id, position',
      workouts: 'id, started_at, status, *exercise_ids, [routine_id+started_at]',
      body_measurements: 'id, measured_on',
      exercise_prefs: 'id, &exercise_id',
      outbox: '++seq, &[table+row_id]',
      blobs: 'path',
      meta: 'key',
    });
  }
}

export const db = new OverloadDb();

export const SYNC_TABLES: SyncTable[] = [
  'profiles',
  'exercises',
  'folders',
  'routines',
  'workouts',
  'body_measurements',
  'exercise_prefs',
];

// Cette méthode permet de lire une valeur de la table meta lorsqu'on a besoin d'un état local non synchronisé.
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

// Cette méthode permet d'écrire une valeur dans la table meta.
export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

// Cette méthode permet de vider toutes les données locales lorsqu'un autre compte se connecte ou que le compte est supprimé.
export async function wipeLocalData(): Promise<void> {
  const deviceId = await getMeta<string>('device_id');
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  if (deviceId) await setMeta('device_id', deviceId);
}
