// Client Supabase allégé (budget §15) : auth-js et postgrest-js assemblés comme le fait supabase-js, sans realtime
// (inutilisé). Storage et Edge Functions, ponctuels, sont chargés à la demande, hors du JS initial.
import { AuthClient } from '@supabase/auth-js';
import type { FunctionInvokeOptions } from '@supabase/functions-js';
import { PostgrestClient } from '@supabase/postgrest-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

const key = anonKey ?? 'missing-anon-key';
const base = new URL((url ?? 'http://127.0.0.1:54321').replace(/\/?$/, '/'));
const endpoint = (path: string) => new URL(path, base).href;

const auth = new AuthClient({
  url: endpoint('auth/v1'),
  headers: { Authorization: `Bearer ${key}`, apikey: key },
  storageKey: 'overload-auth',
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'implicit',
});

// Les nouvelles clés publiques (sb_publishable_…) ne sont pas des JWT : supabase-js ne les envoie pas en Bearer aux Edge Functions.
const newApiKey = key.startsWith('sb_publishable_') || key.startsWith('sb_secret_');

// Cette méthode permet de construire un fetch qui ajoute la clé d'API et le jeton de la session courante à chaque requête,
// comme fetchWithAuth de supabase-js ; sans session, la clé sert de Bearer sauf si keyAsBearer est faux.
function fetchWithAuth(keyAsBearer: boolean): typeof fetch {
  return async (input, init) => {
    const { data } = await auth.getSession();
    const headers = new Headers(init?.headers);
    if (!headers.has('apikey')) headers.set('apikey', key);
    const bearer = data.session?.access_token ?? (keyAsBearer ? key : null);
    if (bearer && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${bearer}`);
    return fetch(input, { ...init, headers });
  };
}

const authedFetch = fetchWithAuth(true);
const rest = new PostgrestClient(endpoint('rest/v1'), { schema: 'public', fetch: authedFetch });

export const supabase = {
  auth,
  from: rest.from.bind(rest) as typeof rest.from,
  rpc: rest.rpc.bind(rest) as typeof rest.rpc,
};

// Cette méthode permet d'accéder au bucket des photos lorsqu'une photo doit être envoyée ou affichée (storage-js chargé à la demande).
export async function photosBucket() {
  const { StorageClient } = await import('@supabase/storage-js');
  return new StorageClient(endpoint('storage/v1'), {}, authedFetch).from('photos');
}

// Cette méthode permet d'appeler une Edge Function (inscription, suppression du compte) en chargeant functions-js à la demande.
export async function invokeFunction<T = unknown>(name: string, options?: FunctionInvokeOptions) {
  const { FunctionsClient } = await import('@supabase/functions-js');
  return new FunctionsClient(endpoint('functions/v1'), { customFetch: fetchWithAuth(!newApiKey) }).invoke<T>(
    name,
    options,
  );
}
