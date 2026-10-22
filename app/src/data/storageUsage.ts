import { create } from 'zustand';
import { db } from './db';
import { useSession } from './session';
import { supabase } from './supabase';

const REFRESH_INTERVAL_MS = 60 * 60_000;

type StorageUsage = { usedBytes: number | null; quotaBytes: number; checkedAt: number };

export const useStorageUsage = create<StorageUsage>(() => ({
  usedBytes: null,
  quotaBytes: 1_073_741_824,
  checkedAt: 0,
}));

// Cette méthode permet à l'admin de relire l'occupation de Storage (RPC admin_storage_usage), au plus une fois par heure
// sauf si force est vrai ; elle ne fait rien pour un compte non admin.
export async function refreshStorageUsage(force = false): Promise<void> {
  const userId = useSession.getState().userId;
  if (!userId || (!force && Date.now() - useStorageUsage.getState().checkedAt < REFRESH_INTERVAL_MS)) return;
  const profile = await db.profiles.get(userId);
  if (!profile?.is_admin) return;
  useStorageUsage.setState({ checkedAt: Date.now() });
  const { data, error } = await supabase.rpc('admin_storage_usage');
  if (error || !data) return;
  const usage = data as { used_bytes: number | string; quota_bytes: number | string };
  useStorageUsage.setState({ usedBytes: Number(usage.used_bytes), quotaBytes: Number(usage.quota_bytes) });
}
