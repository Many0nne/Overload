// Connecteur Claude : serveur MCP distant d'Overload (docs/spec-mcp.md). Transport Streamable HTTP sans session
// (un serveur par requête), authentification OAuth 2.1 par Supabase Auth, données lues et écrites avec le jeton de
// l'utilisateur (RLS). Routes : /.well-known/oauth-protected-resource (public) et / (MCP, jeton requis).
import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/webStandardStreamableHttp.js';
import { authenticate, MCP_CORS, resourceMetadata } from './auth.ts';
import { Store } from './store.ts';
import { registerReadTools } from './tools/read.ts';
import { registerWriteTools } from './tools/write.ts';

const INSTRUCTIONS = `Overload est le carnet de musculation de l'utilisateur. Ces outils lisent et modifient SES données.
- Ne jamais inventer un exercice : chercher d'abord avec search_exercises, puis passer l'id ou le nom exact.
- Les charges sont stockées dans l'unité de saisie ({ v, u }) ; un nombre seul est dans l'unité de l'utilisateur (get_profile).
- Séries : normal et failure sont des séries de travail ; warmup (échauffement) ne compte ni pour le volume ni pour les records ; drop = dégressive.
- 1RM estimé = Epley (charge × (1 + reps/30)), calculé sur les séries de 12 reps au plus. Les records sont recalculés depuis l'historique.
- Les objectifs de séance sont figés au démarrage d'une séance dans l'app ; une séance saisie après coup n'en a pas.
- Une séance en cours appartient à l'appareil qui l'a démarrée : elle n'est pas modifiable ici tant qu'elle n'est pas terminée.
- Dates en ISO 8601 ; sans décalage, elles sont lues dans le fuseau tz (défaut Europe/Paris).
- Avant d'écrire, résumer le changement à l'utilisateur. Les modifications arrivent sur ses appareils à leur prochaine synchronisation.`;

const RATE_LIMIT = 120;
const calls = new Map<string, { start: number; count: number }>();

// Cette méthode permet de limiter les appels d'outil d'un compte à 120 par minute (compteur approximatif de l'instance).
function overLimit(userId: string, toolCalls: number): boolean {
  if (!toolCalls) return false;
  const now = Date.now();
  const entry = calls.get(userId);
  if (!entry || now - entry.start > 60_000) {
    calls.set(userId, { start: now, count: toolCalls });
    return false;
  }
  entry.count += toolCalls;
  return entry.count > RATE_LIMIT;
}

// Cette méthode permet de compter les appels d'outil d'un message JSON-RPC (requête seule ou lot).
async function countToolCalls(req: Request): Promise<number> {
  const body = await req
    .clone()
    .json()
    .catch(() => null);
  const list = Array.isArray(body) ? body : [body];
  return list.filter((m) => m && typeof m === 'object' && (m as { method?: string }).method === 'tools/call').length;
}

// Cette méthode permet de construire la réponse JSON avec les en-têtes CORS du connecteur.
function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...MCP_CORS, 'Content-Type': 'application/json', ...headers },
  });
}

// Cette méthode permet de construire le serveur MCP d'une requête authentifiée (outils de lecture et d'écriture).
function buildServer(store: Store): McpServer {
  const server = new McpServer({ name: 'overload', title: 'Overload', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  registerReadTools(server, store);
  registerWriteTools(server, store);
  return server;
}

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: MCP_CORS });

  if (path.endsWith('/.well-known/oauth-protected-resource')) {
    if (req.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
    return jsonResponse(resourceMetadata(req), 200, { 'Cache-Control': 'public, max-age=3600' });
  }
  if (!/\/mcp$/.test(path)) return jsonResponse({ error: 'not_found' }, 404);

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (req.method !== 'POST')
    return jsonResponse({ error: 'method_not_allowed', error_description: 'Serveur sans session : POST uniquement.' }, 405, {
      Allow: 'POST',
    });
  if (overLimit(auth.userId, await countToolCalls(req)))
    return jsonResponse({ error: 'rate_limited', error_description: '120 appels d’outil par minute au plus.' }, 429, {
      'Retry-After': '60',
    });

  const server = buildServer(new Store(auth));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const res = await transport.handleRequest(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(MCP_CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
});
