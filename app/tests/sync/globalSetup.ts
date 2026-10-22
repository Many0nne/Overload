import type { TestProject } from 'vitest/node';
import { assertSupabaseUp, readSupabaseConfig, type SupabaseTestConfig } from '../supabaseEnv';

declare module 'vitest' {
  export interface ProvidedContext {
    supabase: SupabaseTestConfig;
  }
}

// Cette méthode permet de vérifier que Supabase local répond, puis de transmettre sa configuration aux tests.
export default async function setup(project: TestProject): Promise<void> {
  const config = readSupabaseConfig();
  await assertSupabaseUp(config);
  project.provide('supabase', config);
}
