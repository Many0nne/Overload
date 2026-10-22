import { useEffect } from 'react';

// Cette méthode permet de garder l'écran allumé tant que le composant est monté et l'option active (§9).
// Le verrou est redemandé au retour au premier plan, car il est perdu à chaque mise en arrière-plan.
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        lock = null;
      }
    };
    void acquire();
    const onVis = () => void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}
