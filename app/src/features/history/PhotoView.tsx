import { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { supabase } from '@/data/supabase';

const urlCache = new Map<string, string>();

// Cette méthode permet d'obtenir une URL affichable pour une photo : blob local en attente d'envoi, sinon URL signée (1 h).
// Le service worker met l'image en cache par chemin de stockage, l'URL signée changeant à chaque demande (§12).
export async function photoUrl(path: string): Promise<string | undefined> {
  const cached = urlCache.get(path);
  if (cached) return cached;
  const local = await db.blobs.get(path);
  if (local) {
    const url = URL.createObjectURL(local.blob);
    urlCache.set(path, url);
    return url;
  }
  const { data } = await supabase.storage.from('photos').createSignedUrl(path, 3600);
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
      alt="Photo de la séance"
      style={{ width: '100%', height: props.height ?? 160, objectFit: 'cover', borderRadius: 12, marginTop: 10, display: 'block' }}
    />
  ) : (
    <div className="photo" style={{ height: props.height ?? 160 }}>
      photo de séance
    </div>
  );
}
