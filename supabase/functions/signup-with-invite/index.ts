// Inscription sur invitation (spec technique §7.1) : vérifie le code, crée l'utilisateur confirmé et son profil.
import { corsHeaders, json, serviceClient } from '../_shared/http.ts';

type Body = { code?: string; email?: string; password?: string; display_name?: string; settings?: unknown };

// Cette méthode permet de ramener un code saisi ou collé à sa forme stockée (majuscules, sans tirets ni espaces).
function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '');
}

// Cette méthode permet de lire l'IP de l'appelant lorsqu'on applique la limite de tentatives.
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'invalid_input' }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_input' }, 400);
  }
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  const displayName = body.display_name?.trim();
  const code = normalizeCode(body.code ?? '');
  const settings = body.settings && typeof body.settings === 'object' ? body.settings : {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !displayName || displayName.length > 60 || !code) {
    return json({ error: 'invalid_input' }, 400);
  }

  const admin = serviceClient();
  const { data: allowed, error: rateError } = await admin.rpc('signup_rate_check', { p_ip: clientIp(req) });
  if (rateError) return json({ error: 'server_error' }, 500);
  if (!allowed) return json({ error: 'rate_limited' }, 429);

  const { data: inviter, error: inviteError } = await admin
    .from('profiles')
    .select('id')
    .eq('invite_code', code)
    .maybeSingle();
  if (inviteError) return json({ error: 'server_error' }, 500);
  if (!inviter) return json({ error: 'invalid_code' }, 400);

  if (password.length < 8) return json({ error: 'weak_password' }, 400);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const msg = `${createError?.code ?? ''} ${createError?.message ?? ''}`.toLowerCase();
    if (msg.includes('already') || msg.includes('exists') || msg.includes('email_exists')) {
      return json({ error: 'email_taken' }, 400);
    }
    if (msg.includes('password')) return json({ error: 'weak_password' }, 400);
    return json({ error: 'server_error' }, 500);
  }

  const { error: profileError } = await admin.rpc('admin_create_profile', {
    p_user_id: created.user.id,
    p_display_name: displayName,
    p_settings: settings,
    p_is_admin: false,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: 'server_error' }, 500);
  }
  return json({ ok: true });
});
