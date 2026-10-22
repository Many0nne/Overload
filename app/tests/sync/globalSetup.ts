import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import type { TestProject } from 'vitest/node';

export type SupabaseTestConfig = { url: string; anonKey: string; serviceKey: string };

declare module 'vitest' {
  export interface ProvidedContext {
    supabase: SupabaseTestConfig;
  }
}

// Cette méthode permet de lire l'URL et les clés de Supabase local, depuis l'environnement ou `supabase status`.
function readConfig(): SupabaseTestConfig {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY)
    return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceKey: SUPABASE_SERVICE_ROLE_KEY };
  const cli = process.env.SUPABASE_CLI ?? 'npx supabase';
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  let out: string;
  try {
    out = execSync(`${cli} status -o env`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('Supabase local injoignable : lancer `npx supabase start` à la racine du dépôt.');
  }
  const env = Object.fromEntries(
    [...out.matchAll(/^([A-Z_]+)="?([^"\r\n]*)"?$/gm)].map((m) => [m[1], m[2]] as const),
  );
  if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY)
    throw new Error('`supabase status -o env` ne donne pas API_URL, ANON_KEY et SERVICE_ROLE_KEY.');
  return { url: env.API_URL, anonKey: env.ANON_KEY, serviceKey: env.SERVICE_ROLE_KEY };
}

// Cette méthode permet de vérifier que Supabase local répond, puis de transmettre sa configuration aux tests.
export default async function setup(project: TestProject): Promise<void> {
  const config = readConfig();
  const res = await fetch(`${config.url}/rest/v1/rpc/health`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => null);
  if (!res?.ok) throw new Error(`Supabase local ne répond pas sur ${config.url} (npx supabase start).`);
  project.provide('supabase', config);
}
