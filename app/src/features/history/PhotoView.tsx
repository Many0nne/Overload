import { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { photosBucket } from '@/data/supabase';
import { PHOTO_CACHE, photoCacheKey } from '@/sw/photoCache';

const urlCache = new Map<string, string>();

// Cette méthode permet de lire une photo dans le cache du service worker lorsqu'elle n'est plus dans les blobs locaux.
async function cachedPhoto(path: string): Promise<Blob | undefined> {
  if (typeof caches === 'undefined') return undefined;
  try {
    const res = await caches.match(photoCacheKey(location.origin, path), { cacheName: PHOTO_CACHE });
    return res ? await res.blob() : undefined;
  } catch {
    return undefined;
  }
}

// Cette méthode permet d'obtenir une URL affichable pour une photo : blob local, sinon copie du cache du service worker
// (lisible hors ligne, sans URL signée), sinon URL signée (1 h) que le SW met en cache par chemin de stockage (§12, #61).
export async function photoUrl(path: string): Promise<string | undefined> {
  const known = urlCache.get(path);
  if (known) return known;
  const blob = (await db.blobs.get(path))?.blob ?? (await cachedPhoto(path));
  if (blob) {
    const url = URL.createObjectURL(blob);
    urlCache.set(path, url);
    return url;
  }
  const { data } = await (await photosBucket()).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return undefined;
  const url = `${data.signedUrl}&p=${encodeURIComponent(path)}`;
  urlCache.set(path, url);
  return url;
}

// Cette méthode permet d'afficher la photo d'une séance (ou un emplacement si elle n'est pas encore disponible).
export function PhotoView(props: { path: string; height?: number }) {
  const [url, setUrl] = useState<string | undefined>(urlCache.get(props.path));
  useEffect(() => {
    let alive = true;
    void photoUrl(props.path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [props.path]);
  return url ? (
    <img
      src={url}
      alt="Séance"
      crossOrigin="anonymous"
      style={{
        width: '100%',
        height: props.height ?? 160,
        objectFit: 'cover',
        borderRadius: 12,
        marginTop: 10,
        display: 'block',
      }}
    />
  ) : (
    <div className="photo" style={{ height: props.height ?? 160 }}>
      photo de séance
    </div>
  );
}
