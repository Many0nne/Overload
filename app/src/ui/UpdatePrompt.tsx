import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { deviceIdSync } from '@/data/device';
import { ensureSubscription } from '@/data/push';
import { useInProgressWorkouts } from '@/data/queries';

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

  useEffect(() => {
    void ensureSubscription().catch(() => {});
  }, []);

  if (!needRefresh || inWorkout) return null;
  return (
    <div
      className="card"
      style={{
        position: 'fixed',
        left: 10,
        right: 10,
        top: 'calc(10px + env(safe-area-inset-top))',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        border: '1px solid var(--line)',
      }}
    >
      <span style={{ flex: 1, fontSize: '.9375rem' }}>Nouvelle version disponible</span>
      <button className="btn btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>
        Plus tard
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => void updateServiceWorker(true)}>
        Mettre à jour
      </button>
    </div>
  );
}
