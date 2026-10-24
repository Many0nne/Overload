import { estimateClockSkew } from '@/domain/clock';
import { logError } from '../errors';
import { useSession } from '../session';
import { refreshStorageUsage } from '../storageUsage';
import { supabase, supabaseConfigured } from '../supabase';
import { pull, push, SyncAuthError } from './engine';
import { useSyncStatus } from './status';

const DEBOUNCE_MS = 2000;
const PULL_INTERVAL_MS = 30_000;
const CLOCK_CHECK_INTERVAL_MS = 10 * 60_000;
const PHOTO_PURGE_INTERVAL_MS = 10 * 60_000;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;
let again = false;
let started = false;
let lastClockCheckAt = 0;
let lastPhotoPurgeAt = 0;

// Cette méthode permet de lancer un cycle push puis pull, sans jamais en exécuter deux en même temps.
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

// Cette méthode permet d'exécuter un cycle de synchronisation et de mettre à jour l'indicateur (§6.5).
// Une erreur de session tente un rafraîchissement du jeton, puis demande une reconnexion sans purge (§6.6).
async function runOnce(): Promise<void> {
  const session = useSession.getState();
  const status = useSyncStatus.getState();
  if (!supabaseConfigured || session.status !== 'signed_in' || session.needsReauth) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    status.set({ online: false });
    return;
  }
  status.set({ syncing: true, online: true });
  try {
    await push();
    await pull();
    // Après le pull : une séance reprise ailleurs ou terminée entre-temps ne replanifie pas de notification (#66).
    // Chargé à la demande pour rester hors du JS initial (budget §15).
    await (await import('../restPush')).flushRestNotification();
    status.set({ lastCallFailed: false, lastSyncAt: Date.now() });
    void checkClockSkew();
    void refreshStorageUsage();
    void purgePhotos();
  } catch (e) {
    status.set({ lastCallFailed: true });
    if (e instanceof SyncAuthError) {
      const { error } = await supabase.auth.refreshSession();
      if (error) useSession.getState().set({ needsReauth: true });
    }
    void logError('sync', e);
  } finally {
    status.set({ syncing: false });
  }
}

// Cette méthode permet de mesurer l'écart entre l'horloge de l'appareil et celle du serveur, au plus toutes les 10 min.
// L'en-tête Date n'est pas lisible en CORS : on passe par la RPC server_now_ms (docs/contrat-serveur.md).
async function checkClockSkew(): Promise<void> {
  if (Date.now() - lastClockCheckAt < CLOCK_CHECK_INTERVAL_MS) return;
  lastClockCheckAt = Date.now();
  const t0 = Date.now();
  const { data, error } = await supabase.rpc('server_now_ms');
  const t1 = Date.now();
  const serverMs = Number(data);
  if (error || !Number.isFinite(serverMs)) return;
  useSyncStatus.getState().set({ clockSkewMs: estimateClockSkew(t0, t1, serverMs) });
}

// Cette méthode permet de libérer l'espace local des photos après une synchro réussie, au plus toutes les 10 min (#61).
// Chargé à la demande pour rester hors du JS initial (budget §15).
async function purgePhotos(): Promise<void> {
  if (Date.now() - lastPhotoPurgeAt < PHOTO_PURGE_INTERVAL_MS) return;
  lastPhotoPurgeAt = Date.now();
  try {
    await (await import('../photos')).purgeLocalPhotos();
  } catch (e) {
    void logError('photos', e);
  }
}

// Cette méthode permet de déclencher un push 2 s après la dernière écriture locale (anti-rebond).
export function notifyLocalWrite(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
}

// Cette méthode permet d'installer les déclencheurs de synchro : réseau, premier plan et intervalle de 30 s (§6.2, §6.3).
export function startSyncScheduler(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => {
    useSyncStatus.getState().set({ online: true });
    void syncNow();
  });
  window.addEventListener('offline', () => useSyncStatus.getState().set({ online: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, PULL_INTERVAL_MS);
  void syncNow();
}
