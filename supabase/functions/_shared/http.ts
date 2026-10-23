// Outils HTTP communs aux Edge Functions (CORS, réponses JSON, client service).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Cette méthode permet de renvoyer une réponse JSON avec les en-têtes CORS lorsqu'une fonction répond au client.
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Cette méthode permet de lire une clé API nommée « default » lorsque le projet a les nouvelles clés (sb_…).
// Elle se rabat sur la clé legacy (JWT) si la variable JSON est absente, comme avec la pile locale.
function apiKey(newVar: 'SUPABASE_SECRET_KEYS' | 'SUPABASE_PUBLISHABLE_KEYS', legacyVar: string): string {
  const raw = Deno.env.get(newVar);
  if (raw) {
    try {
      const key = (JSON.parse(raw) as Record<string, string>).default;
      if (key) return key;
    } catch {
      // Variable mal formée : on garde la clé legacy.
    }
  }
  return Deno.env.get(legacyVar)!;
}

// Cette méthode permet de lire la clé publique (publishable, sinon anon) lorsqu'une fonction agit au nom de l'appelant.
export function publishableKey(): string {
  return apiKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
}

// Cette méthode permet de créer un client Supabase avec la clé secrète lorsqu'une fonction doit contourner la RLS.
export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, apiKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
