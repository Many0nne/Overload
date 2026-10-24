import { db, getMeta, setMeta } from './db';
import { deviceIdSync } from './device';
import { logError } from './errors';
import { pushSupported } from './push';
import { supabase, supabaseConfigured } from './supabase';

// Dernière intention envoyée ou à envoyer au serveur pour le minuteur de cet appareil, gardée dans meta (#66) :
// hors ligne ou en cas d'échec, elle est rejouée au cycle de synchro suivant.
type RestIntent =
  | { id: string; kind: 'schedule'; endsAt: number; title: string; body: string; workoutId?: string }
  | { id: string; kind: 'cancel' };

const INTENT_KEY = 'rest_push_intent';
let flushing: Promise<void> | null = null;
let flushAgain = false;

// Cette méthode permet de planifier la notification de fin de repos côté serveur (remplace la précédente, §8.2).
// La séance liée, si elle est donnée, doit encore appartenir à cet appareil au moment de l'envoi.
export async function scheduleRestNotification(
  endsAt: number,
  title: string,
  body: string,
  workoutId?: string,
): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted' || !supabaseConfigured) return;
  await rememberIntent({ id: crypto.randomUUID(), kind: 'schedule', endsAt, title, body, workoutId });
}

// Cette méthode permet d'annuler la notification de repos planifiée (« Passer » ou fin de séance).
export async function cancelRestNotification(): Promise<void> {
  if (!supabaseConfigured) return;
  await rememberIntent({ id: crypto.randomUUID(), kind: 'cancel' });
}

// Cette méthode permet de garder la nouvelle intention (elle remplace la précédente) puis de tenter de l'envoyer.
async function rememberIntent(intent: RestIntent): Promise<void> {
  await setMeta(INTENT_KEY, intent);
  await flushRestNotification();
}

// Cette méthode permet d'envoyer au serveur l'intention en attente lorsque le réseau est là (écriture, cycle de synchro),
// sans jamais faire deux envois en même temps ; elle reste en attente si l'appel échoue.
export function flushRestNotification(): Promise<void> {
  if (flushing) {
    flushAgain = true;
    return flushing;
  }
  flushing = (async () => {
    do {
      flushAgain = false;
      await flushOnce();
    } while (flushAgain);
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

// Cette méthode permet d'envoyer une fois l'intention en attente : une planification échue, ou liée à une séance
// terminée ou reprise ailleurs, devient une annulation. L'intention n'est effacée que si elle n'a pas changé entre-temps.
async function flushOnce(): Promise<void> {
  if (!supabaseConfigured || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const intent = await getMeta<RestIntent | null>(INTENT_KEY);
  if (!intent) return;
  const { error } =
    intent.kind === 'schedule' && (await scheduleStillValid(intent))
      ? await supabase.rpc('schedule_rest_timer', {
          p_device_id: deviceIdSync(),
          p_ends_at_ms: Math.round(intent.endsAt),
          p_title: intent.title,
          p_body: intent.body,
        })
      : await supabase.rpc('cancel_rest_timer', { p_device_id: deviceIdSync() });
  if (error) {
    void logError('push', error.message);
    return;
  }
  await db.transaction('rw', db.meta, async () => {
    const current = await getMeta<RestIntent | null>(INTENT_KEY);
    if (current?.id === intent.id) await setMeta(INTENT_KEY, null);
  });
}

// Cette méthode permet de vérifier qu'une planification en attente a encore lieu d'être lorsqu'elle va être envoyée :
// repos non écoulé, et séance liée toujours en cours sur cet appareil.
async function scheduleStillValid(intent: Extract<RestIntent, { kind: 'schedule' }>): Promise<boolean> {
  if (intent.endsAt <= Date.now()) return false;
  if (!intent.workoutId) return true;
  const w = await db.workouts.get(intent.workoutId);
  return Boolean(
    w && w.status === 'in_progress' && w.deleted_at == null && w.owner_device_id === deviceIdSync(),
  );
}
