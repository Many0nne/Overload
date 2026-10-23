// Authentification du connecteur Claude (docs/spec-mcp.md §5.2, §5.3) : jeton OAuth de Supabase Auth, vérifié dans le code
// pour répondre le 401 + WWW-Authenticate attendu par Claude, puis connexion contrôlée dans mcp_connections.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, publishableKey } from '../_shared/http.ts';

export type McpAuth = {
  userId: string;
  clientId: string;
  canWrite: boolean;
  db: SupabaseClient;
};

export const MCP_CORS = {
  ...corsHeaders,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, mcp-session-id',
};

// Cette méthode permet d'obtenir l'URL publique du projet : MCP_PUBLIC_URL si fournie (tunnel de test), sinon SUPABASE_URL.
// En pile locale, SUPABASE_URL est l'adresse interne de Kong : on reprend alors l'hôte publié transmis par Kong.
export function publicBase(req?: Request): string {
  const override = Deno.env.get('MCP_PUBLIC_URL');
  if (override) return override.replace(/\/+$/, '');
  const url = Deno.env.get('SUPABASE_URL')!.replace(/\/+$/, '');
  const h = req?.headers;
  if (h && /^http:\/\/kong(:\d+)?$/.test(url) && h.get('x-forwarded-host'))
    return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host')}:${h.get('x-forwarded-port') ?? '80'}`;
  return url;
}

// Cette méthode permet d'obtenir l'URL du connecteur, exactement celle que l'utilisateur colle dans Claude.
export function resourceUrl(req?: Request): string {
  return `${publicBase(req)}/functions/v1/mcp`;
}

// Cette méthode permet de construire les métadonnées de ressource protégée (RFC 9728) qui désignent Supabase Auth.
export function resourceMetadata(req: Request) {
  return {
    resource: resourceUrl(req),
    authorization_servers: [`${publicBase(req)}/auth/v1`],
    bearer_methods_supported: ['header'],
    scopes_supported: ['email'],
    resource_name: 'Overload',
  };
}

// Cette méthode permet de répondre 401 avec le pointeur resource_metadata que Claude suit pour lancer l'autorisation.
export function unauthorized(req: Request, description: string): Response {
  const meta = `${resourceUrl(req)}/.well-known/oauth-protected-resource`;
  return new Response(JSON.stringify({ error: 'invalid_token', error_description: description }), {
    status: 401,
    headers: {
      ...MCP_CORS,
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${meta}", error="invalid_token"`,
    },
  });
}

// Cette méthode permet de vérifier le jeton d'une requête MCP et la connexion associée ; renvoie le contexte de l'appelant,
// ou la réponse 401 à renvoyer telle quelle (jeton absent, invalide, sans client_id, ou connexion déconnectée).
export async function authenticate(req: Request): Promise<McpAuth | Response> {
  const header = req.headers.get('Authorization') ?? '';
  const m = header.match(/^Bearer\s+(\S+)$/i);
  if (!m) return unauthorized(req, 'Jeton manquant');
  const token = m[1]!;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getClaims(token);
  const claims = data?.claims as { sub?: string; client_id?: string } | undefined;
  if (error || !claims?.sub) return unauthorized(req, 'Jeton invalide ou expiré');
  if (!claims.client_id) return unauthorized(req, 'Jeton OAuth requis (connecteur Claude)');
  const touch = await db.rpc('mcp_touch', {});
  if (touch.error) {
    console.error('mcp_touch', touch.error.message);
    return unauthorized(req, 'Connexion refusée');
  }
  const state = touch.data as { can_write: boolean; revoked: boolean };
  if (state.revoked) return unauthorized(req, 'Connexion déconnectée dans Overload');
  return { userId: claims.sub, clientId: claims.client_id, canWrite: state.can_write, db };
}
