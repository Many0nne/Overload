// Envoi Web Push (VAPID) de la notification de fin de repos à un appareil (spec technique §8.2).
// Appelée par dispatch_due_timers() via pg_net, authentifiée par l'en-tête x-push-secret.
import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import { json, serviceClient } from '../_shared/http.ts';

let appServerPromise: Promise<webpush.ApplicationServer> | undefined;

// Cette méthode permet de décoder une chaîne base64url en octets lorsqu'on reconstruit les clés VAPID.
function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Cette méthode permet d'encoder des octets en base64url lorsqu'on construit les JWK VAPID.
function toB64Url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Cette méthode permet de construire le serveur d'application Web Push une seule fois lorsque la première notification part.
// Les clés sont fournies en base64url : publique brute (65 octets, celle du client) et privée (scalaire d, 32 octets).
function appServer(): Promise<webpush.ApplicationServer> {
  appServerPromise ??= (async () => {
    const pub = fromB64Url(Deno.env.get('VAPID_PUBLIC_KEY')!);
    const x = toB64Url(pub.slice(1, 33));
    const y = toB64Url(pub.slice(33, 65));
    const d = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidKeys = await webpush.importVapidKeys({
      publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true },
      privateKey: { kty: 'EC', crv: 'P-256', x, y, d, ext: true },
    });
    return webpush.ApplicationServer.new({
      contactInformation: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
      vapidKeys,
    });
  })();
  return appServerPromise;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return json({ error: 'forbidden' }, 403);

  let body: { device_id?: string; title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_input' }, 400);
  }
  if (!body.device_id) return json({ error: 'invalid_input' }, 400);

  const admin = serviceClient();
  const { data: sub, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('device_id', body.device_id)
    .maybeSingle();
  if (error) return json({ error: 'server_error' }, 500);
  if (!sub) return json({ sent: false, reason: 'no_subscription' });

  try {
    const server = await appServer();
    const subscriber = server.subscribe({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    });
    await subscriber.pushTextMessage(JSON.stringify({ title: body.title ?? 'Overload', body: body.body ?? '' }), {
      ttl: 120,
      urgency: webpush.Urgency.High,
      topic: 'rest',
    });
    return json({ sent: true });
  } catch (err) {
    if (err instanceof webpush.PushMessageError) {
      const status = err.response.status;
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('device_id', body.device_id);
        return json({ sent: false, reason: 'gone' });
      }
      return json({ sent: false, reason: `push_${status}` }, 502);
    }
    console.error(err);
    return json({ sent: false, reason: 'error' }, 500);
  }
});
