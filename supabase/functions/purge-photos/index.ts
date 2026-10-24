// Purge des photos orphelines du bucket photos (#61) : objets qu'aucune séance non supprimée ne référence depuis 7 jours.
// Appelée chaque nuit par dispatch_photo_purge() via pg_net, authentifiée par l'en-tête x-push-secret.
import { json, serviceClient } from '../_shared/http.ts';

const BUCKET = 'photos';
const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return json({ error: 'forbidden' }, 403);

  const admin = serviceClient();
  let removed = 0;
  // Les orphelins sont lus par pages de 1000 : une page supprimée ne revient pas dans la suivante.
  for (;;) {
    const { data, error } = await admin.rpc('orphan_photos', { p_limit: PAGE });
    if (error) return json({ error: 'server_error' }, 500);
    const names = ((data ?? []) as { name: string }[]).map((o) => o.name);
    if (names.length === 0) break;
    const { error: removeError } = await admin.storage.from(BUCKET).remove(names);
    if (removeError) return json({ error: 'storage_error', removed }, 500);
    removed += names.length;
    if (names.length < PAGE) break;
  }
  return json({ removed });
});
