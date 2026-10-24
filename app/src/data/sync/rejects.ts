import { useLiveQuery } from 'dexie-react-hooks';
import type { SyncTable } from '@/domain/types';
import { db, getMeta, setMeta } from '../db';

/** Modification refusée par le serveur (#58) : la ligne locale a été réalignée sur la version serveur. */
export type SyncReject = {
  at: number;
  table: SyncTable;
  id: string;
  status: 'invalid' | 'forbidden' | 'outdated';
};

const KEY = 'sync_rejects';

// Cette méthode permet de mémoriser des refus du serveur (100 derniers) pour la pastille et le journal.
export async function recordRejects(rejects: SyncReject[]): Promise<void> {
  if (rejects.length === 0) return;
  const list = (await getMeta<SyncReject[]>(KEY)) ?? [];
  await setMeta(KEY, [...list, ...rejects].slice(-100));
}

// Cette méthode permet de lire les refus mémorisés lorsqu'on ouvre le journal.
export async function readRejects(): Promise<SyncReject[]> {
  return (await getMeta<SyncReject[]>(KEY)) ?? [];
}

// Cette méthode permet d'effacer les refus une fois que l'utilisateur en a pris connaissance (remet la pastille à zéro).
export async function clearRejects(): Promise<void> {
  await db.meta.delete(KEY);
}

// Cette méthode permet de suivre en direct le nombre de refus mémorisés pour la pastille de synchro.
export function useRejectCount(): number {
  return useLiveQuery(async () => ((await getMeta<SyncReject[]>(KEY)) ?? []).length, []) ?? 0;
}
