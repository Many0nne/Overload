import { deviceIdSync } from './device';
import { logError } from './errors';
import { supabase, supabaseConfigured } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// Cette méthode permet de savoir si les notifications push sont utilisables ici (iOS : uniquement en app installée, ≥ 16.4).
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

// Cette méthode permet de convertir la clé publique VAPID (base64url) au format attendu par PushManager.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Cette méthode permet de demander la permission et d'abonner cet appareil, depuis un geste utilisateur (§8.3).
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    await ensureSubscription();
    return 'granted';
  } catch (e) {
    void logError('push', e);
    return 'error';
  }
}

// Cette méthode permet de (ré)enregistrer l'abonnement push de cet appareil côté serveur, au démarrage si l'endpoint a changé.
export async function ensureSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted' || !supabaseConfigured) return;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    });
  }
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (localStorage.getItem('push-endpoint') === json.endpoint) return;
  const { error } = await supabase.rpc('register_push_subscription', {
    p_device_id: deviceIdSync(),
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });
  if (error) throw new Error(error.message);
  localStorage.setItem('push-endpoint', json.endpoint);
}

// Cette méthode permet de planifier la notification de fin de repos côté serveur (remplace la précédente, §8.2).
export async function scheduleRestNotification(endsAt: number, title: string, body: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted' || !navigator.onLine) return;
  const { error } = await supabase.rpc('schedule_rest_timer', {
    p_device_id: deviceIdSync(),
    p_ends_at_ms: Math.round(endsAt),
    p_title: title,
    p_body: body,
  });
  if (error) void logError('push', error.message);
}

// Cette méthode permet d'annuler la notification de repos planifiée (« Passer » ou fin de séance).
export async function cancelRestNotification(): Promise<void> {
  if (!supabaseConfigured || !navigator.onLine) return;
  const { error } = await supabase.rpc('cancel_rest_timer', { p_device_id: deviceIdSync() });
  if (error) void logError('push', error.message);
}

// Cette méthode permet de tester toute la chaîne Web Push : notification dans 10 s (Paramètres › À propos, lot L0).
export async function sendTestNotification(): Promise<string> {
  const state = await enablePush();
  if (state !== 'granted')
    return state === 'unsupported' ? 'Notifications non disponibles ici.' : 'Permission refusée.';
  await scheduleRestNotification(
    Date.now() + 10_000,
    'Test Overload',
    'La chaîne de notification fonctionne.',
  );
  return 'Notification programmée dans 10 s. Verrouille ton téléphone.';
}
