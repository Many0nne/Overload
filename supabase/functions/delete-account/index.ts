// Suppression complète du compte appelant (spec technique §14) : photos puis utilisateur (le reste part en cascade).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json, publishableKey, serviceClient } from '../_shared/http.ts';

const BUCKET = 'photos';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const uid = userData.user.id;

  const admin = serviceClient();
  // Les objets sont listés par pages de 1000 sous le dossier <uid>/.
  for (;;) {
    const { data: objects, error } = await admin.storage.from(BUCKET).list(uid, { limit: 1000 });
    if (error) return json({ error: 'storage_error' }, 500);
    if (!objects || objects.length === 0) break;
    const { error: removeError } = await admin.storage.from(BUCKET).remove(objects.map((o) => `${uid}/${o.name}`));
    if (removeError) return json({ error: 'storage_error' }, 500);
    if (objects.length < 1000) break;
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) return json({ error: 'server_error' }, 500);
  return json({ ok: true });
});
