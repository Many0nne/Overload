import Dexie, { type EntityTable } from 'dexie';
import { DOC_VERSIONS, type DocTable, upgradeRow } from '@/domain/schema';
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

/** Fichier local à envoyer vers Storage ; attempts compte les refus du serveur, abandoned arrête les envois (#59). */
export type BlobEntry = {
  path: string;
  blob: Blob;
  kind: 'photo' | 'avatar';
  uploaded: boolean;
  attempts?: number;
  abandoned?: boolean;
  lastError?: string;
  failedAt?: number;
};
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
    this.on('ready', (vip) => upgradeLocalDocs(vip as OverloadDb), true);
  }
}

const DOC_VERSIONS_KEY = 'doc_versions';

// Cette méthode permet de mettre à la version de l'app les documents stockés localement, à l'ouverture de la base (#71).
// Ne parcourt les tables que si les versions ont changé depuis le dernier passage ; aucune lecture ne voit l'ancien format.
export async function upgradeLocalDocs(vip: OverloadDb): Promise<void> {
  const done = (await vip.meta.get(DOC_VERSIONS_KEY))?.value as Partial<Record<DocTable, number>> | undefined;
  const tables = (Object.keys(DOC_VERSIONS) as DocTable[]).filter((t) => done?.[t] !== DOC_VERSIONS[t]);
  if (tables.length === 0) return;
  await vip.transaction('rw', [vip.meta, ...tables.map((t) => vip.table(t))], async () => {
    for (const t of tables)
      await vip
        .table(t)
        .toCollection()
        .modify((row: Record<string, unknown>) => {
          const res = upgradeRow(t, row);
          if (res.ok && res.changed) row.doc = res.row.doc;
        });
    await vip.meta.put({ key: DOC_VERSIONS_KEY, value: DOC_VERSIONS });
  });
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
