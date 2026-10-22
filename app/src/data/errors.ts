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
