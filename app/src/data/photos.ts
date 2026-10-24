// Photos de séance stockées sur l'appareil (§12, #61) : blobs en attente d'envoi et purge de ce qui ne sert plus.
import { PHOTO_CACHE, photoCacheKey, photoPathFromCacheKey } from '@/sw/photoCache';
import { parsePhotoPath } from '@/ui/photo';
import { type BlobEntry, db } from './db';

// Une photo choisie mais pas encore enregistrée dans la séance (récapitulatif ouvert) n'est pas supprimée avant ce délai.
export const PENDING_GRACE_MS = 24 * 3600_000;

// Cette méthode permet de savoir si une séance non supprimée référence encore une photo lorsqu'on décide de l'envoyer ou de la purger.
// Un chemin d'une autre forme (sans id de séance) est cherché dans toutes les séances.
export async function isPhotoReferenced(path: string): Promise<boolean> {
  const parsed = parsePhotoPath(path);
  if (!parsed)
    return (await db.workouts.filter((w) => w.deleted_at == null && w.doc.photoPath === path).count()) > 0;
  const w = await db.workouts.get(parsed.workoutId);
  return !!w && w.deleted_at == null && w.doc.photoPath === path;
}

// Cette méthode permet de lister les photos à envoyer vers Storage : en attente et référencées par leur séance.
// Une photo retirée, remplacée ou abandonnée avant l'enregistrement n'est jamais envoyée.
export async function photosToUpload(): Promise<BlobEntry[]> {
  const pending = await db.blobs.filter((b) => b.kind === 'photo' && !b.uploaded).toArray();
  const keep: BlobEntry[] = [];
  for (const b of pending) if (await isPhotoReferenced(b.path)) keep.push(b);
  return keep;
}

// Cette méthode permet de garder une photo envoyée dans le cache du service worker avant de retirer son blob local,
// pour qu'elle reste affichable hors ligne. Renvoie false si le cache n'est pas disponible (le blob est alors gardé).
async function moveToPhotoCache(b: BlobEntry, cache: Cache | undefined): Promise<boolean> {
  if (!cache) return false;
  const key = photoCacheKey(location.origin, b.path);
  if (!(await cache.match(key)))
    await cache.put(key, new Response(b.blob, { headers: { 'Content-Type': b.blob.type || 'image/jpeg' } }));
  return true;
}

// Cette méthode permet de libérer l'espace local des photos après une synchro (#61) : une photo envoyée dont la séance
// est acceptée par le serveur passe dans le cache du SW, les blobs et entrées de cache que plus rien ne référence partent.
export async function purgeLocalPhotos(now = Date.now()): Promise<void> {
  const cache = typeof caches === 'undefined' ? undefined : await caches.open(PHOTO_CACHE);
  const unsynced = new Set(
    (await db.outbox.filter((e) => e.table === 'workouts').toArray()).map((e) => e.row_id),
  );
  for (const b of await db.blobs.filter((x) => x.kind === 'photo').toArray()) {
    const parsed = parsePhotoPath(b.path);
    if (await isPhotoReferenced(b.path)) {
      // Séance pas encore acceptée par le serveur : le blob reste la seule copie sûre.
      if (!b.uploaded || !parsed || unsynced.has(parsed.workoutId)) continue;
      if (await moveToPhotoCache(b, cache)) await db.blobs.delete(b.path);
    } else if (b.uploaded || now - (parsed?.createdAt ?? 0) > PENDING_GRACE_MS) {
      await db.blobs.delete(b.path);
    }
  }
  if (!cache) return;
  for (const req of await cache.keys()) {
    const path = photoPathFromCacheKey(req.url);
    if (path && !(await isPhotoReferenced(path))) await cache.delete(req);
  }
}
