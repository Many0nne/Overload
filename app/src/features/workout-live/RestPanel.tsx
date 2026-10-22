import { useEffect, useRef } from 'react';
import { useNow } from '@/ui/useNow';
import { formatClock } from '@/ui/time';
import { playRestEndSound, useRestTimer } from './restTimer';

// Cette méthode permet d'afficher le minuteur de repos (−15 s, +15 s, Passer), recalculé sur l'heure réelle (§8.1).
// À la fin, un son est joué si l'app est ouverte et l'option active ; la notification est gérée par le serveur.
export function RestPanel(props: { sound: boolean; notify: boolean }) {
  const { timer, adjust, skip } = useRestTimer();
  const now = useNow(250, Boolean(timer));
  const rang = useRef<string | null>(null);
  const left = timer ? Math.max(0, (timer.endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (!timer || left > 0 || rang.current === timer.setId + timer.endsAt) return;
    rang.current = timer.setId + timer.endsAt;
    if (props.sound && document.visibilityState === 'visible') playRestEndSound();
    const t = setTimeout(() => void useRestTimer.getState().skip(), 3000);
    return () => clearTimeout(t);
  }, [timer, left, props.sound]);

  if (!timer) return null;
  const pct = Math.max(0, Math.min(100, (left / timer.totalS) * 100));
  return (
    <div className="rest-panel show" role="timer" aria-live="off">
      <div className="lbl">Repos · {timer.label}</div>
      <div className="time">{left > 0 ? formatClock(Math.ceil(left)) : 'Terminé'}</div>
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="ctrls">
        <button className="btn btn-soft" onClick={() => void adjust(-15, props.notify)}>
          −15 s
        </button>
        <button className="btn btn-soft" onClick={() => void adjust(15, props.notify)}>
          +15 s
        </button>
        <button className="btn btn-primary" onClick={() => void skip()}>
          Passer
        </button>
      </div>
    </div>
  );
}
