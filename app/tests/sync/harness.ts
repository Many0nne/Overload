import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { v7 as uuidv7 } from 'uuid';
import { inject, vi } from 'vitest';
import { db, setMeta, wipeLocalData } from '@/data/db';
import { getDeviceId } from '@/data/device';
import { saveRow } from '@/data/repositories/base';
import { supabase } from '@/data/supabase';
import type { FolderRow, SyncTable, WorkoutRow } from '@/domain/types';

// L'appareil testé (moteur réel) ; les autres appareils sont simulés par des appels RPC directs.
export const DEVICE_A = '55555555-5555-7555-8555-555555555555';
export const DEVICE_LOW = '11111111-1111-7111-8111-111111111111';
export const DEVICE_HIGH = '99999999-9999-7999-8999-999999999999';

export type Account = { userId: string; accessToken: string };
type PushStatus = 'accepted' | 'stale' | 'rejected_not_owner' | 'forbidden' | 'invalid';
type Change = { table: SyncTable; row: Record<string, unknown> };

// Cette méthode permet de créer un compte confirmé avec son profil, puis d'y connecter le client de l'app.
export async function setupAccount(): Promise<Account> {
  const { url, serviceKey } = inject('supabase');
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `sync-${uuidv7()}@overload.test`;
  const password = 'motdepasse-sync-1';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser : ${error?.message}`);
  const profile = await admin.rpc('admin_create_profile', {
    p_user_id: data.user.id,
    p_display_name: 'Sync',
    p_settings: {},
    p_is_admin: false,
  });
  if (profile.error) throw new Error(`admin_create_profile : ${profile.error.message}`);
  const session = await supabase.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`signIn : ${session.error?.message}`);
  return { userId: data.user.id, accessToken: session.data.session.access_token };
}

// Cette méthode permet de repartir d'un appareil A vierge (base locale, outbox et curseurs vidés) avant chaque test.
export async function resetLocalDevice(): Promise<void> {
  vi.restoreAllMocks();
  await wipeLocalData();
  await setMeta('device_id', DEVICE_A);
  await getDeviceId();
}

// Cette méthode permet de simuler un autre appareil du même compte, qui parle directement aux RPC du serveur.
export function remoteDevice(account: Account, deviceId: string) {
  const { url, anonKey } = inject('supabase');
  const client: SupabaseClient = createClient(url, anonKey, {
    accessToken: async () => account.accessToken,
  });

  // Cette méthode permet de lever une erreur lisible lorsqu'un appel du faux appareil échoue.
  const unwrap = <T>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  return {
    deviceId,
    // Cette méthode permet de pousser des lignes comme le ferait cet appareil, et de renvoyer les statuts.
    async push(changes: Change[]): Promise<PushStatus[]> {
      const res = unwrap(await client.rpc('sync_push', { p_device_id: deviceId, p_changes: changes }));
      return (res as { status: PushStatus }[]).map((r) => r.status);
    },
    // Cette méthode permet de reprendre une séance en cours sur cet appareil (§6.4).
    async takeOver(id: string): Promise<WorkoutRow> {
      return unwrap(await client.rpc('take_over_workout', { p_id: id, p_device_id: deviceId })) as WorkoutRow;
    },
    // Cette méthode permet de lire la version serveur d'une ligne lorsqu'un test vérifie qui a gagné.
    async row<T = Record<string, unknown>>(table: SyncTable, id: string): Promise<T> {
      return unwrap(await client.from(table).select('*').eq('id', id).single()) as T;
    },
    // Cette méthode permet de compter les dossiers du compte côté serveur (tous, ou ceux dont le nom a ce préfixe).
    async countFolders(prefix?: string): Promise<number> {
      let q = client.from('folders').select('id', { count: 'exact', head: true });
      if (prefix) q = q.like('name', `${prefix}%`);
      const res = await q;
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    },
  };
}

export type RemoteDevice = ReturnType<typeof remoteDevice>;

// Cette méthode permet de construire un dossier complet tel qu'un appareil l'enverrait au serveur.
export function folderRow(
  account: Account,
  id: string,
  name: string,
  client_updated_at: number,
  client_device_id: string,
): FolderRow {
  return {
    id,
    user_id: account.userId,
    name,
    position: 0,
    collapsed: false,
    deleted_at: null,
    client_updated_at,
    client_device_id,
  };
}

// Cette méthode permet d'enregistrer un dossier sur l'appareil A par le repository réel (ligne + outbox).
export async function saveFolderLocally(account: Account, id: string, name: string): Promise<FolderRow> {
  return saveRow('folders', {
    id,
    user_id: account.userId,
    name,
    position: 0,
    collapsed: false,
    deleted_at: null,
  });
}

// Cette méthode permet de construire une séance en cours appartenant à l'appareil indiqué.
export function workoutDraft(account: Account, id: string, owner: string, note?: string) {
  return {
    id,
    user_id: account.userId,
    status: 'in_progress' as const,
    owner_device_id: owner,
    routine_id: null,
    started_at: Date.now() - 600_000,
    exercise_ids: [],
    doc: { schemaVersion: 1 as const, title: 'Push', exercises: [], ...(note ? { note } : {}) },
    deleted_at: null,
  };
}

// Cette méthode permet de simuler une coupure réseau sur le n-ième appel d'une RPC, avant l'envoi ou après la réponse.
// « after » reproduit une réponse perdue : le serveur a validé, mais le client ne le sait pas.
export function cutNetworkOn(fn: 'sync_push' | 'sync_pull', onCall: number, when: 'before' | 'after') {
  const original = supabase.rpc.bind(supabase);
  let n = 0;
  return vi.spyOn(supabase, 'rpc').mockImplementation(((name: string, args: unknown) => {
    if (name !== fn || ++n !== onCall) return original(name, args as never);
    if (when === 'before') return Promise.reject(new TypeError('fetch failed'));
    return Promise.resolve(original(name, args as never)).then(() => {
      throw new TypeError('fetch failed');
    });
  }) as never);
}

// Cette méthode permet de compter les éléments en attente dans l'outbox de l'appareil A.
export function outboxCount(): Promise<number> {
  return db.outbox.count();
}
