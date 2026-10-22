import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Le client de l'app pointe sur Supabase local, sans stockage de session (Node n'a pas de localStorage).
vi.mock('@/data/supabase', async () => {
  const { inject } = await import('vitest');
  const { createClient } = await import('@supabase/supabase-js');
  const { url, anonKey } = inject('supabase');
  return {
    supabaseConfigured: true,
    supabase: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
});

// Les tests pilotent push() et pull() eux-mêmes : pas de synchro déclenchée par l'anti-rebond.
vi.mock('@/data/sync/scheduler', () => ({
  notifyLocalWrite: () => {},
  syncNow: async () => {},
  startSyncScheduler: () => {},
}));
