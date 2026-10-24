import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { deviceIdSync } from '@/data/device';
import { logError } from '@/data/errors';
import { ensureSubscription } from '@/data/push';
import { useInProgressWorkouts, useProfile } from '@/data/queries';
import { useSession } from '@/data/session';
import { DEFAULT_SETTINGS } from '@/domain/types';

// Cette méthode permet d'enregistrer le service worker et de proposer une nouvelle version, jamais pendant une séance (§9).
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, reg) => {
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  const workouts = useInProgressWorkouts();
  const inWorkout = Boolean(workouts?.some((w) => w.owner_device_id === deviceIdSync()));

  // Abonnement réenregistré à chaque connexion (ou changement de compte), une fois le profil chargé pour respecter le réglage.
  const userId = useSession((s) => (s.status === 'signed_in' && !s.needsReauth ? s.userId : null));
  const profile = useProfile();
  const notify = profile ? (profile.settings?.restNotification ?? DEFAULT_SETTINGS.restNotification) : null;
  useEffect(() => {
    if (userId && notify) void ensureSubscription().catch((e) => logError('push', e));
  }, [userId, notify]);

  if (!needRefresh || inWorkout) return null;
  return (
    <div className="card update-prompt">
      <span>Nouvelle version disponible</span>
      <button className="btn btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>
        Plus tard
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => void updateServiceWorker(true)}>
        Mettre à jour
      </button>
    </div>
  );
}
