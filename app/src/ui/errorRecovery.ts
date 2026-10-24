// Récupération après une erreur imprévue : détection des chunks lazy disparus et rechargement unique (issue #64).

const RELOAD_KEY = 'chunk-reload-at';
// En deçà de ce délai depuis le dernier rechargement automatique, on n'insiste pas : l'écran d'erreur s'affiche.
export const CHUNK_RELOAD_GUARD_MS = 30_000;

// Messages des navigateurs quand un import() dynamique échoue (Chromium, Firefox, WebKit) ou qu'un CSS lazy manque.
const CHUNK_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
];

// Cette méthode permet de reconnaître l'échec de chargement d'un chunk lazy (fichier disparu après une mise à jour).
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_PATTERNS.some((p) => p.test(message));
}

// Cette méthode permet de décider s'il faut recharger la page, lorsqu'aucun rechargement automatique n'a eu lieu récemment.
export function shouldReloadForChunk(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || now - lastReloadAt > CHUNK_RELOAD_GUARD_MS;
}

// Cette méthode permet de recharger la page une seule fois après un chunk introuvable ; renvoie false si c'est déjà fait.
export function reloadOnceForChunk(): boolean {
  let last: number | null = null;
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    last = raw ? Number(raw) : null;
    if (!shouldReloadForChunk(last, Date.now())) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false; // sessionStorage indisponible : sans garde, on risquerait une boucle de rechargements
  }
  location.reload();
  return true;
}
