// Cache des photos de séance, partagé par le service worker (lecture) et l'app (purge des blobs locaux, #61).
export const PHOTO_CACHE = 'photos-v1';
const PREFIX = '/__photo/';

// Cette méthode permet de construire la clé de cache d'une photo à partir de son chemin de stockage.
export function photoCacheKey(origin: string, path: string): string {
  return `${origin}${PREFIX}${encodeURIComponent(path)}`;
}

// Cette méthode permet de retrouver le chemin de stockage d'une clé de cache (undefined si ce n'est pas une photo).
export function photoPathFromCacheKey(key: string): string | undefined {
  const { pathname } = new URL(key);
  return pathname.startsWith(PREFIX) ? decodeURIComponent(pathname.slice(PREFIX.length)) : undefined;
}
