import { assertSupabaseUp, readSupabaseConfig } from '../supabaseEnv';

// Cette méthode permet d'arrêter la suite E2E tout de suite si Supabase local ne répond pas.
export default async function globalSetup(): Promise<void> {
  await assertSupabaseUp(readSupabaseConfig());
}
