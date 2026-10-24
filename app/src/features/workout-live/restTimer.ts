import { create } from 'zustand';
import { getMeta, setMeta } from '@/data/db';
import { cancelRestNotification, scheduleRestNotification } from '@/data/restPush';

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
    if (notify) void scheduleRestNotification(t.endsAt, 'Repos terminé', t.label, t.workoutId);
  },
  adjust: async (deltaS, notify) => {
    const t = get().timer;
    if (!t) return;
    const endsAt = Math.max(Date.now(), t.endsAt + deltaS * 1000);
    const next = { ...t, endsAt, totalS: Math.max(1, t.totalS + deltaS) };
    set({ timer: next });
    await setMeta(KEY, next);
    if (notify) void scheduleRestNotification(next.endsAt, 'Repos terminé', next.label, next.workoutId);
  },
  skip: async () => {
    set({ timer: null });
    await setMeta(KEY, null);
    void cancelRestNotification();
  },
}));

let audioCtx: AudioContext | null = null;
let unlockListeners = 0;

// Cette méthode permet de débloquer le son lors d'un toucher (iOS n'autorise Web Audio qu'après un geste) :
// reprise du contexte et lecture d'un échantillon muet, à refaire après une interruption (veille, appel, arrière-plan).
export function unlockAudio(): void {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'running') return;
    void audioCtx.resume().catch(() => undefined);
    const src = audioCtx.createBufferSource();
    src.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    src.connect(audioCtx.destination);
    src.start(0);
  } catch {
    audioCtx = null;
  }
}

// Cette méthode permet de débloquer le son à chaque toucher tant qu'un écran de séance est affiché ;
// elle renvoie la fonction qui retire l'écoute (compteur, pour supporter plusieurs abonnés).
export function listenAudioUnlock(): () => void {
  if (unlockListeners++ === 0) {
    document.addEventListener('touchend', unlockAudio, true);
    document.addEventListener('click', unlockAudio, true);
  }
  return () => {
    if (--unlockListeners > 0) return;
    document.removeEventListener('touchend', unlockAudio, true);
    document.removeEventListener('click', unlockAudio, true);
  };
}

// Cette méthode permet de jouer le bip de fin de repos lorsque l'app est ouverte,
// en relançant d'abord le contexte s'il a été suspendu depuis le dernier toucher.
export function playRestEndSound(): void {
  const ctx = audioCtx;
  if (!ctx) return;
  if (ctx.state === 'running') beep(ctx);
  else
    void ctx
      .resume()
      .then(() => beep(ctx))
      .catch(() => undefined);
}

// Cette méthode permet de programmer les trois tonalités du bip sur un contexte audio actif.
function beep(ctx: AudioContext): void {
  const t0 = ctx.currentTime;
  for (const [i, freq] of [880, 880, 1320].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + i * 0.22);
    osc.stop(t0 + i * 0.22 + 0.2);
  }
}
