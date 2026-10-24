import { uuidv7 } from '@/domain/ids';

// Cette méthode permet de construire un chemin de stockage neuf pour chaque photo choisie : remplacer la photo d'une séance
// change son chemin, ce qui garde vraie l'hypothèse des caches par chemin (service worker, PhotoView) (§12).
export function photoPath(userId: string, workoutId: string, id: string = uuidv7()): string {
  return `${userId}/${workoutId}-${id}.jpg`;
}

const PHOTO_PATH =
  /^[^/]+\/([0-9a-f-]{36})-([0-9a-f]{8})-([0-9a-f]{4})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;

// Cette méthode permet de retrouver la séance et l'heure de création d'une photo à partir de son chemin (#61).
// L'heure vient des 48 premiers bits de l'UUID v7 du chemin ; undefined si le chemin n'a pas cette forme.
export function parsePhotoPath(path: string): { workoutId: string; createdAt: number } | undefined {
  const m = PHOTO_PATH.exec(path);
  if (!m) return undefined;
  return { workoutId: m[1]!, createdAt: Number.parseInt(m[2]! + m[3]!, 16) };
}

// Cette méthode permet de compresser une photo avant stockage : côté long limité, JPEG 0,8, métadonnées EXIF supprimées (§12).
// Redessiner l'image sur un canevas retire l'EXIF ; createImageBitmap applique l'orientation de l'appareil photo.
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression impossible'))),
      'image/jpeg',
      quality,
    ),
  );
}
