import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useRef } from 'react';
import { deviceIdSync } from '@/data/device';
import { logError } from '@/data/errors';
import { ensureSubscription } from '@/data/push';
import { useInProgressWorkouts, useProfile } from '@/data/queries';
import { useSession } from '@/data/session';
import { useSyncStatus } from '@/data/sync/status';
import { DEFAULT_SETTINGS } from '@/domain/types';

// Cette méthode permet d'enregistrer le service worker et de proposer une nouvelle version, jamais pendant une séance (§9).
// Si le serveur porte des documents d'un format plus récent (#71), la mise à jour devient obligatoire (sans « Plus tard »).
export function UpdatePrompt() {
  const regRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, reg) => {
      regRef.current = reg;
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  const workouts = useInProgressWorkouts();
  const inWorkout = Boolean(workouts?.some((w) => w.owner_device_id === deviceIdSync()));
  const appOutdated = useSyncStatus((s) => s.appOutdated);

  // Mise à jour obligatoire : on cherche tout de suite la nouvelle version sans attendre la vérification horaire.
  useEffect(() => {
    if (appOutdated) void regRef.current?.update().catch((e) => logError('pwa', e));
  }, [appOutdated]);

  // Abonnement réenregistré à chaque connexion (ou changement de compte), une fois le profil chargé pour respecter le réglage.
  const userId = useSession((s) => (s.status === 'signed_in' && !s.needsReauth ? s.userId : null));
  const profile = useProfile();
  const notify = profile ? (profile.settings?.restNotification ?? DEFAULT_SETTINGS.restNotification) : null;
  useEffect(() => {
    if (userId && notify) void ensureSubscription().catch((e) => logError('push', e));
  }, [userId, notify]);

  // Cette méthode permet d'installer la nouvelle version, ou à défaut de la chercher puis de recharger l'app.
  const update = async () => {
    if (needRefresh) return updateServiceWorker(true);
    await regRef.current?.update().catch((e) => logError('pwa', e));
    window.location.reload();
  };

  if (inWorkout || !(needRefresh || appOutdated)) return null;
  return (
    <div className="card update-prompt">
      {appOutdated ? (
        <span data-testid="update-required">
          Mise à jour requise : tes données viennent d'une version plus récente d'Overload. La synchro
          reprendra après.
        </span>
      ) : (
        <>
          <span>Nouvelle version disponible</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>
            Plus tard
          </button>
        </>
      )}
      <button className="btn btn-primary btn-sm" onClick={() => void update()}>
        Mettre à jour
      </button>
    </div>
  );
}
