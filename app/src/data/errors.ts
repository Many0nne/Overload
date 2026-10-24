import { getMeta, setMeta } from './db';

export type LoggedError = { at: number; scope: string; message: string };

// Cette méthode permet de journaliser localement une erreur client (100 dernières), sans traqueur tiers (§16).
export async function logError(scope: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[${scope}]`, error);
  try {
    const list = (await getMeta<LoggedError[]>('errors')) ?? [];
    list.push({ at: Date.now(), scope, message });
    await setMeta('errors', list.slice(-100));
  } catch {
    // base indisponible : rien de plus à faire
  }
}

// Cette méthode permet de lire le journal d'erreurs pour l'écran Paramètres › À propos.
export async function readErrors(): Promise<LoggedError[]> {
  return (await getMeta<LoggedError[]>('errors')) ?? [];
}

// Message bénin de Chromium (boucle de ResizeObserver) : il remplirait le journal sans rien signaler d'utile.
const IGNORED = /ResizeObserver loop/;

// Cette méthode permet de journaliser les erreurs non capturées (exceptions globales et promesses rejetées sans catch),
// et de recharger une fois la page lorsqu'un module préchargé par Vite a disparu après une mise à jour.
export function installGlobalErrorHandlers(onPreloadError: () => boolean): void {
  window.addEventListener('error', (e) => {
    const error = e.error ?? e.message;
    if (!IGNORED.test(String(e.message))) void logError('window', error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    void logError('promise', e.reason);
  });
  window.addEventListener('vite:preloadError', (e) => {
    if (onPreloadError()) e.preventDefault();
  });
}
