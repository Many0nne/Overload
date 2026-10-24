import { useLiveQuery } from 'dexie-react-hooks';
import { type BlobEntry, db } from '../db';

/** Refus du serveur au-delà desquels une photo n'est plus envoyée automatiquement (#59). */
export const MAX_PHOTO_ATTEMPTS = 5;

// Cette méthode permet de lister les photos abandonnées après trop de refus, pour le journal.
export async function readAbandonedPhotos(): Promise<BlobEntry[]> {
  return db.blobs.filter((b) => !b.uploaded && Boolean(b.abandoned)).toArray();
}

// Cette méthode permet de relancer l'envoi des photos abandonnées lorsque l'utilisateur le demande depuis le journal.
export async function retryAbandonedPhotos(): Promise<void> {
  const paths = (await readAbandonedPhotos()).map((b) => b.path);
  await db.blobs.bulkUpdate(paths.map((key) => ({ key, changes: { abandoned: false, attempts: 0 } })));
}

// Cette méthode permet de suivre en direct le nombre de photos abandonnées pour la pastille de synchro.
export function useAbandonedPhotoCount(): number {
  return useLiveQuery(() => db.blobs.filter((b) => !b.uploaded && Boolean(b.abandoned)).count(), []) ?? 0;
}
