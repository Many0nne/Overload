import { v7 as uuidv7 } from 'uuid';
import { getMeta, setMeta } from './db';

let cached: string | undefined;

// Cette méthode permet d'obtenir l'identifiant stable de cet appareil, créé au premier lancement.
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await getMeta<string>('device_id');
  if (!id) {
    id = uuidv7();
    await setMeta('device_id', id);
  }
  cached = id;
  return id;
}

// Cette méthode permet de lire l'identifiant d'appareil déjà chargé (après initDevice) sans attendre.
export function deviceIdSync(): string {
  if (!cached) throw new Error('device_id non initialisé');
  return cached;
}
