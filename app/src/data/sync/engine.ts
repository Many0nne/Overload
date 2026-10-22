import type Dexie from 'dexie';
import type { SyncTable, WorkoutRow } from '@/domain/types';
import { db, getMeta, type OutboxEntry, setMeta } from '../db';
import { deviceIdSync } from '../device';
import { supabase } from '../supabase';

export const PUSH_BATCH = 100;
export const NIL_DEVICE = '00000000-0000-0000-0000-000000000000';

type PushStatus = 'accepted' | 'stale' | 'rejected_not_owner' | 'forbidden';
type PushResult = { table: SyncTable; id: string; status: PushStatus };
type PullKey = SyncTable | 'catalog';
type PullResponse = {
  changes: Partial<Record<PullKey, Record<string, unknown>[]>>;
  cursors: Partial<Record<PullKey, number>>;
  has_more: boolean;
};

export class SyncAuthError extends Error {}

// Cette méthode permet de transformer une erreur Supabase en exception, en distinguant les erreurs de session.
function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const msg = res.error.message ?? '';
    if (/jwt|token|not authenticated|401/i.test(msg) || res.error.code === 'PGRST301')
      throw new SyncAuthError(msg);
    throw new Error(msg);
  }
  return res.data;
}

// Cette méthode permet d'envoyer les photos en attente vers Storage avant le push des documents qui les référencent (§12).
async function uploadPendingBlobs(): Promise<void> {
  const pending = await db.blobs.filter((b) => !b.uploaded).toArray();
  for (const b of pending) {
    const { error } = await supabase.storage.from('photos').upload(b.path, b.blob, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    if (error) throw new Error(error.message);
    await db.blobs.update(b.path, { uploaded: true });
  }
}

// Cette méthode permet de pousser l'outbox par lots de 100 et de traiter le statut renvoyé pour chaque élément (§6.2).
// Une entrée modifiée pendant l'envoi reste dans l'outbox pour le push suivant.
export async function push(): Promise<{ rejected: string[] }> {
  await uploadPendingBlobs();
  const rejected: string[] = [];
  let afterSeq = 0;
  for (;;) {
    const entries = await db.outbox.where('seq').above(afterSeq).limit(PUSH_BATCH).toArray();
    if (entries.length === 0) break;
    afterSeq = entries[entries.length - 1]!.seq!;
    const sent: { entry: OutboxEntry; ts: number }[] = [];
    const changes: { table: SyncTable; row: unknown }[] = [];
    for (const entry of entries) {
      const row = await (
        db[entry.table] as unknown as Dexie.Table<{ client_updated_at: number }, string>
      ).get(entry.row_id);
      if (!row) {
        await db.outbox.delete(entry.seq!);
        continue;
      }
      const { rev: _rev, ...rest } = row as typeof row & { rev?: number };
      changes.push({ table: entry.table, row: rest });
      sent.push({ entry, ts: row.client_updated_at });
    }
    if (changes.length > 0) {
      const results = check(
        await supabase.rpc('sync_push', { p_device_id: deviceIdSync(), p_changes: changes }),
      ) as PushResult[];
      const byKey = new Map(results.map((r) => [`${r.table}:${r.id}`, r.status]));
      await db.transaction('rw', db.outbox, db.workouts, async () => {
        for (const { entry, ts } of sent) {
          const status = byKey.get(`${entry.table}:${entry.row_id}`);
          if (!status) continue;
          const current = await db.outbox.get(entry.seq!);
          if (current && current.client_updated_at > ts) continue;
          await db.outbox.delete(entry.seq!);
          if (status === 'rejected_not_owner') {
            rejected.push(entry.row_id);
            // Appareil dépossédé : la séance passe en lecture seule jusqu'à la réception de la version serveur.
            await db.workouts.update(entry.row_id, { owner_device_id: NIL_DEVICE });
          }
        }
      });
    }
    if (entries.length < PUSH_BATCH) break;
  }
  return { rejected };
}

// Cette méthode permet de décider si une ligne reçue remplace la ligne locale (outbox plus récente = on garde le local, §6.3).
// Exception : une séance en cours reprise par un autre appareil s'applique toujours (§6.4).
export function shouldApply(
  table: SyncTable,
  incoming: Record<string, unknown>,
  pending: OutboxEntry | undefined,
  me: string,
): boolean {
  if (!pending) return true;
  if (table === 'workouts') {
    const w = incoming as unknown as WorkoutRow;
    if (w.status === 'in_progress' && w.owner_device_id !== me && w.deleted_at == null) return true;
  }
  return (incoming.client_updated_at as number) >= pending.client_updated_at;
}

// Cette méthode permet de récupérer les lignes modifiées depuis les curseurs et de les appliquer localement, page par page.
export async function pull(): Promise<number> {
  const me = deviceIdSync();
  let applied = 0;
  for (;;) {
    const cursors = (await getMeta<Partial<Record<PullKey, number>>>('cursors')) ?? {};
    const res = check(await supabase.rpc('sync_pull', { p_cursors: cursors })) as PullResponse;
    const keys = Object.keys(res.changes) as PullKey[];
    const tables = [...new Set(keys.map((k) => (k === 'catalog' ? 'exercises' : k)))];
    await db.transaction('rw', [db.outbox, db.meta, ...tables.map((t) => db.table(t))], async () => {
      for (const key of keys) {
        const table: SyncTable = key === 'catalog' ? 'exercises' : key;
        for (const row of res.changes[key] ?? []) {
          const pending = await db.outbox
            .where('[table+row_id]')
            .equals([table, row.id as string])
            .first();
          if (!shouldApply(table, row, pending, me)) continue;
          await db.table(table).put(row);
          if (pending) await db.outbox.delete(pending.seq!);
          applied++;
        }
      }
      await setMeta('cursors', { ...cursors, ...res.cursors });
    });
    if (!res.has_more) break;
  }
  return applied;
}

// Cette méthode permet de faire reprendre ici une séance démarrée sur un autre appareil (§6.4).
export async function takeOverWorkout(id: string): Promise<void> {
  const row = check(
    await supabase.rpc('take_over_workout', { p_id: id, p_device_id: deviceIdSync() }),
  ) as WorkoutRow;
  await db.transaction('rw', db.workouts, db.outbox, async () => {
    await db.workouts.put(row);
    const pending = await db.outbox.where('[table+row_id]').equals(['workouts', id]).first();
    if (pending) await db.outbox.delete(pending.seq!);
  });
}
