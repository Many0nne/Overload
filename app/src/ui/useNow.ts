import { useEffect, useState } from 'react';

// Cette méthode permet de re-rendre un composant à intervalle régulier avec l'heure réelle (chronomètres, minuteurs).
// Elle se recale aussi au retour au premier plan, pour rester juste après une mise en arrière-plan (§8.1).
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
  return now;
}
