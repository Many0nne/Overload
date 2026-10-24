import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Le client de l'app pointe sur Supabase local, sans stockage de session (Node n'a pas de localStorage).
vi.mock('@/data/supabase', async () => {
  const { inject } = await import('vitest');
  const { createClient } = await import('@supabase/supabase-js');
  const { url, anonKey } = inject('supabase');
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    supabaseConfigured: true,
    supabase,
    photosBucket: async () => supabase.storage.from('photos'),
    invokeFunction: (name: string, options?: object) => supabase.functions.invoke(name, options),
  };
});

// Les tests pilotent push() et pull() eux-mêmes : pas de synchro déclenchée par l'anti-rebond.
vi.mock('@/data/sync/scheduler', () => ({
  notifyLocalWrite: () => {},
  syncNow: async () => {},
  startSyncScheduler: () => {},
}));
