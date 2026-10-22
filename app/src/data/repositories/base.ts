import type Dexie from 'dexie';
import type { SyncMeta, SyncTable } from '@/domain/types';
import { db } from '../db';
import { deviceIdSync } from '../device';
import { notifyLocalWrite } from '../sync/scheduler';

export type RowOf<T extends SyncTable> = (typeof db)[T] extends Dexie.Table<infer R, string> ? R : never;
export type Draft<T extends SyncTable> = Omit<RowOf<T>, keyof SyncMeta> & Partial<SyncMeta>;

// Cette méthode permet d'enregistrer un élément complet et sa trace dans l'outbox, dans une même transaction (§6.1).
// L'horodatage est rendu strictement croissant par élément pour que la dernière modification gagne toujours.
export async function saveRow<T extends SyncTable>(
  table: T,
  row: Draft<T>,
): Promise<RowOf<T> & { id: string }> {
  const t = db[table] as unknown as Dexie.Table<SyncMeta & { id: string }, string>;
  let saved!: SyncMeta & { id: string };
  await db.transaction('rw', t, db.outbox, async () => {
    const id = (row as unknown as { id: string }).id;
    const prev = await t.get(id);
    const now = Math.max(Date.now(), (prev?.client_updated_at ?? 0) + 1);
    saved = {
      ...(prev ?? {}),
      ...(row as object),
      id,
      client_updated_at: now,
      client_device_id: deviceIdSync(),
    };
    await t.put(saved);
    const existing = await db.outbox.where('[table+row_id]').equals([table, id]).first();
    if (existing) await db.outbox.update(existing.seq!, { client_updated_at: now });
    else await db.outbox.add({ table, row_id: id, client_updated_at: now });
  });
  notifyLocalWrite();
  return saved as unknown as RowOf<T> & { id: string };
}

// Cette méthode permet de supprimer logiquement un élément (tombstone propagé par la synchro).
export async function softDelete(table: Exclude<SyncTable, 'profiles'>, id: string): Promise<void> {
  const t = db[table] as unknown as Dexie.Table<{ id: string }, string>;
  const prev = await t.get(id);
  if (!prev) return;
  await saveRow(table, { ...prev, deleted_at: Date.now() } as never);
}
