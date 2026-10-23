import { create } from 'zustand';
import { getMeta, setMeta } from '@/data/db';
import { cancelRestNotification, scheduleRestNotification } from '@/data/push';

// État du minuteur de repos, stocké dans meta (local, non synchronisé, §8.1). L'affichage vaut endsAt − Date.now().
export type RestTimerState = {
  workoutId: string;
  exerciseEntryId: string;
  setId: string;
  endsAt: number;
  totalS: number;
  label: string; // « Développé couché, série 3 »
};

type Store = {
  timer: RestTimerState | null;
  loaded: boolean;
  load: () => Promise<void>;
  start: (t: RestTimerState, notify: boolean) => Promise<void>;
  adjust: (deltaS: number, notify: boolean) => Promise<void>;
  skip: () => Promise<void>;
};

const KEY = 'rest_timer';

export const useRestTimer = create<Store>((set, get) => ({
  timer: null,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const t = (await getMeta<RestTimerState | null>(KEY)) ?? null;
    // Un repos déjà écoulé (app fermée ou rechargée entre-temps) est terminé : il ne se réaffiche pas.
    const live = t && t.endsAt > Date.now() ? t : null;
    set({ timer: live, loaded: true });
    if (t && !live) await setMeta(KEY, null);
  },
  start: async (t, notify) => {
    set({ timer: t });
    await setMeta(KEY, t);
    if (notify) void scheduleRestNotification(t.endsAt, 'Repos terminé', t.label);
  },
  adjust: async (deltaS, notify) => {
    const t = get().timer;
    if (!t) return;
    const endsAt = Math.max(Date.now(), t.endsAt + deltaS * 1000);
    const next = { ...t, endsAt, totalS: Math.max(1, t.totalS + deltaS) };
    set({ timer: next });
    await setMeta(KEY, next);
    if (notify) void scheduleRestNotification(next.endsAt, 'Repos terminé', next.label);
  },
  skip: async () => {
    set({ timer: null });
    await setMeta(KEY, null);
    void cancelRestNotification();
  },
}));

let audioCtx: AudioContext | null = null;

// Cette méthode permet de débloquer le son lors d'un toucher (iOS n'autorise Web Audio qu'après un geste).
export function unlockAudio(): void {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

// Cette méthode permet de jouer le bip de fin de repos lorsque l'app est ouverte.
export function playRestEndSound(): void {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  for (const [i, freq] of [880, 880, 1320].entries()) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0 + i * 0.22);
    osc.stop(t0 + i * 0.22 + 0.2);
  }
}
