import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { v7 as uuidv7 } from 'uuid';
import { inject } from 'vitest';

// Outils des tests de l'Edge Function `mcp` (docs/spec-mcp.md §10) contre Supabase local : compte, parcours OAuth complet
// (DCR, autorisation PKCE, consentement, jeton) et appels JSON-RPC du protocole MCP.

export const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

export type McpAccount = {
  userId: string;
  email: string;
  password: string;
  app: SupabaseClient; // session de l'app (jeton sans client_id)
  appToken: string;
};

// Cette méthode permet de lire la configuration de Supabase local fournie par le globalSetup.
export function config() {
  return inject('supabase');
}

// Cette méthode permet d'obtenir l'URL du connecteur MCP de la pile locale.
export function mcpUrl(): string {
  return `${config().url}/functions/v1/mcp`;
}

// Cette méthode permet de créer un compte confirmé avec son profil et une session de l'app.
export async function createAccount(settings: Record<string, unknown> = {}): Promise<McpAccount> {
  const { url, anonKey, serviceKey } = config();
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `mcp-${uuidv7()}@overload.test`;
  const password = 'motdepasse-mcp-1';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser : ${error?.message}`);
  const profile = await admin.rpc('admin_create_profile', {
    p_user_id: data.user.id,
    p_display_name: 'Testeur',
    p_settings: settings,
    p_is_admin: false,
  });
  if (profile.error) throw new Error(`admin_create_profile : ${profile.error.message}`);
  const app = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await app.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw new Error(`signIn : ${session.error?.message}`);
  return { userId: data.user.id, email, password, app, appToken: session.data.session.access_token };
}

// Cette méthode permet d'enregistrer un client OAuth comme le fait Claude (DCR, client public).
export async function registerClient(name = 'Claude', redirect = REDIRECT): Promise<string> {
  const res = await fetch(`${config().url}/auth/v1/oauth/clients/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: name,
      redirect_uris: [redirect],
      token_endpoint_auth_method: 'none',
    }),
  });
  const body = (await res.json()) as { client_id?: string };
  if (!body.client_id) throw new Error(`DCR : ${JSON.stringify(body)}`);
  return body.client_id;
}

// Cette méthode permet de démarrer une autorisation PKCE et de renvoyer l'authorization_id de la page de consentement.
export async function startAuthorization(clientId: string, redirect = REDIRECT) {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirect,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'etat',
    scope: 'email',
    resource: mcpUrl(),
  });
  const res = await fetch(`${config().url}/auth/v1/oauth/authorize?${params}`, { redirect: 'manual' });
  const location = res.headers.get('location');
  if (!location) throw new Error(`authorize : ${res.status}`);
  const authorizationId = new URL(location).searchParams.get('authorization_id');
  if (!authorizationId) throw new Error(`authorize sans authorization_id : ${location}`);
  return { authorizationId, verifier, consentUrl: location };
}

// Cette méthode permet de mener le parcours OAuth complet (consentement compris) et de renvoyer le jeton d'accès MCP.
export async function oauthToken(account: McpAccount, opts: { canWrite?: boolean; clientId?: string } = {}) {
  const clientId = opts.clientId ?? (await registerClient());
  const { authorizationId, verifier } = await startAuthorization(clientId);
  const details = await account.app.auth.oauth.getAuthorizationDetails(authorizationId);
  if (details.error) throw new Error(`details : ${details.error.message}`);
  const up = await account.app.rpc('upsert_mcp_connection', {
    p_client_id: clientId,
    p_client_name: 'Claude',
    p_can_write: opts.canWrite ?? true,
  });
  if (up.error) throw new Error(`upsert_mcp_connection : ${up.error.message}`);
  const approved = await account.app.auth.oauth.approveAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });
  if (approved.error) throw new Error(`approve : ${approved.error.message}`);
  const code = new URL((approved.data as { redirect_url: string }).redirect_url).searchParams.get('code')!;
  const res = await fetch(`${config().url}/auth/v1/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: clientId,
      code_verifier: verifier,
      resource: mcpUrl(),
    }),
  });
  const tok = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!tok.access_token) throw new Error(`token : ${JSON.stringify(tok)}`);
  return { clientId, accessToken: tok.access_token, refreshToken: tok.refresh_token! };
}

let rpcId = 0;

// Cette méthode permet d'envoyer un message JSON-RPC au connecteur et de renvoyer la réponse HTTP brute.
export function rpc(token: string | undefined, method: string, params: Record<string, unknown> = {}) {
  return fetch(mcpUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
}

export type ToolCall = {
  isError?: boolean;
  text: string;
  data: Record<string, unknown> & { items?: unknown[] };
};

// Cette méthode permet d'appeler un outil MCP et de renvoyer son texte et son JSON structuré.
export async function callTool(
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolCall> {
  const res = await rpc(token, 'tools/call', { name, arguments: args });
  if (res.status !== 200) throw new Error(`tools/call ${name} : HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as {
    result?: { isError?: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> };
    error?: { message: string };
  };
  if (!body.result) throw new Error(`tools/call ${name} : ${body.error?.message}`);
  return {
    isError: body.result.isError,
    text: body.result.content.map((c) => c.text).join('\n'),
    data: body.result.structuredContent ?? {},
  };
}

// Cette méthode permet de trouver l'id d'un exercice du catalogue par son nom exact.
export async function catalogId(app: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await app
    .from('exercises')
    .select('id')
    .eq('name', name)
    .is('user_id', null)
    .single();
  if (error) throw new Error(`exercice ${name} : ${error.message}`);
  return data.id as string;
}
