import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/domain/format';
import { useNow } from '@/ui/useNow';
import { playRestEndSound, useRestTimer } from './restTimer';

// Cette méthode permet d'afficher le minuteur de repos (−15 s, +15 s, Passer), recalculé sur l'heure réelle (§8.1).
// À la fin, un son est joué si l'app est ouverte et l'option active ; la notification est gérée par le serveur.
// Un repos écoulé hors écran (app en arrière-plan, autre page) est clos sans « Terminé » ni son au retour.
export function RestPanel(props: { sound: boolean; notify: boolean }) {
  const { timer, adjust, skip } = useRestTimer();
  const now = useNow(250, Boolean(timer));
  const visibleSince = useVisibleSince();
  const rang = useRef<string | null>(null);
  const left = timer ? Math.max(0, (timer.endsAt - now) / 1000) : 0;
  const endedOffscreen = timer !== null && left <= 0 && timer.endsAt <= visibleSince;

  useEffect(() => {
    if (!timer || left > 0) return;
    if (endedOffscreen) {
      void useRestTimer.getState().skip();
      return;
    }
    if (rang.current !== timer.setId + timer.endsAt) {
      rang.current = timer.setId + timer.endsAt;
      if (props.sound) playRestEndSound();
    }
    const t = setTimeout(() => void useRestTimer.getState().skip(), 3000);
    return () => clearTimeout(t);
  }, [timer, left, endedOffscreen, props.sound]);

  if (!timer || endedOffscreen) return null;
  const pct = Math.max(0, Math.min(100, (left / timer.totalS) * 100));
  return (
    <div className="rest-panel show" role="timer" aria-live="off">
      <div className="lbl">Repos · {timer.label}</div>
      <div className="time">{left > 0 ? formatDuration(Math.ceil(left)) : 'Terminé'}</div>
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

// Cette méthode permet de connaître l'instant où le panneau est devenu visible (montage, retour au premier plan),
// Infinity tant que la page est cachée, pour distinguer une fin de repos vécue à l'écran d'une fin survenue en absence.
function useVisibleSince(): number {
  const [since, setSince] = useState(visibleNowOrNever);
  useEffect(() => {
    const onChange = () => setSince(visibleNowOrNever());
    document.addEventListener('visibilitychange', onChange);
    window.addEventListener('pageshow', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
      window.removeEventListener('pageshow', onChange);
    };
  }, []);
  return since;
}

// Cette méthode permet de renvoyer l'heure courante si la page est visible, Infinity sinon.
function visibleNowOrNever(): number {
  return document.visibilityState === 'visible' ? Date.now() : Infinity;
}
