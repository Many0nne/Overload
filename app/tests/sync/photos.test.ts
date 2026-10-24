import { v7 as uuidv7 } from 'uuid';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { PENDING_GRACE_MS, purgeLocalPhotos } from '@/data/photos';
import { saveRow } from '@/data/repositories/base';
import { photosBucket } from '@/data/supabase';
import { push } from '@/data/sync/engine';
import { PHOTO_CACHE, photoCacheKey } from '@/sw/photoCache';
import { photoPath } from '@/ui/photo';
import { type Account, DEVICE_A, resetLocalDevice, setupAccount, workoutDraft } from './harness';

const ORIGIN = 'http://app.test';
let account: Account;
let cache: Map<string, Response>;

// Cette méthode permet de remplacer l'API Cache du navigateur (absente de Node) par un cache en mémoire.
function stubCaches(): void {
  cache = new Map();
  const key = (k: RequestInfo | URL) => (typeof k === 'string' ? k : k instanceof URL ? k.href : k.url);
  const fake = {
    match: async (k: RequestInfo) => cache.get(key(k))?.clone(),
    put: async (k: RequestInfo, r: Response) => void cache.set(key(k), r),
    keys: async () => [...cache.keys()].map((u) => new Request(u)),
    delete: async (k: RequestInfo) => cache.delete(key(k)),
  };
  vi.stubGlobal('caches', { open: async (name: string) => (name === PHOTO_CACHE ? fake : undefined) });
  vi.stubGlobal('location', { origin: ORIGIN });
}

// Cette méthode permet d'enregistrer localement une séance terminée qui référence (ou non) une photo.
async function saveWorkout(id: string, photo?: string): Promise<void> {
  const w = workoutDraft(account, id, DEVICE_A);
  await saveRow('workouts', { ...w, status: 'completed', doc: { ...w.doc, photoPath: photo } });
}

// Cette méthode permet de ranger une photo dans les blobs locaux, envoyée ou non.
async function putBlob(path: string, uploaded = false): Promise<void> {
  await db.blobs.put({ path, blob: new Blob(['jpeg'], { type: 'image/jpeg' }), kind: 'photo', uploaded });
}

// Cette méthode permet de lister les photos du compte présentes dans Storage.
async function storedPhotos(): Promise<string[]> {
  const { data, error } = await (await photosBucket()).list(account.userId, { limit: 100 });
  if (error) throw new Error(error.message);
  return (data ?? []).map((o) => `${account.userId}/${o.name}`);
}

beforeAll(async () => {
  account = await setupAccount();
});
beforeEach(async () => {
  await resetLocalDevice();
  stubCaches();
});
afterEach(() => vi.unstubAllGlobals());

describe('Envoi des photos (#61)', () => {
  it('n’envoie que les photos référencées par leur séance', async () => {
    const w = uuidv7();
    const kept = photoPath(account.userId, w);
    const replaced = photoPath(account.userId, w);
    await putBlob(replaced);
    await putBlob(kept);
    await saveWorkout(w, kept);

    await push();

    const stored = await storedPhotos();
    expect(stored).toContain(kept);
    expect(stored).not.toContain(replaced);
    expect((await db.blobs.get(kept))?.uploaded).toBe(true);
    expect((await db.blobs.get(replaced))?.uploaded).toBe(false);
  });
});

describe('Purge locale des photos (#61)', () => {
  it('passe une photo envoyée et synchronisée dans le cache du SW', async () => {
    const w = uuidv7();
    const path = photoPath(account.userId, w);
    await putBlob(path);
    await saveWorkout(w, path);
    await push();

    await purgeLocalPhotos();

    expect(await db.blobs.get(path)).toBeUndefined();
    expect(cache.has(photoCacheKey(ORIGIN, path))).toBe(true);
  });

  it('garde le blob tant que la séance n’est pas acceptée par le serveur', async () => {
    const w = uuidv7();
    const path = photoPath(account.userId, w);
    await saveWorkout(w, path);
    await putBlob(path, true);

    await purgeLocalPhotos();

    expect(await db.blobs.get(path)).toBeDefined();
  });

  it('supprime les blobs orphelins, avec un délai de grâce pour une photo jamais envoyée', async () => {
    const w = uuidv7();
    const old = Date.now() - PENDING_GRACE_MS - 60_000;
    const sentOrphan = photoPath(account.userId, w);
    const freshPending = photoPath(account.userId, w);
    const oldPending = photoPath(account.userId, w, uuidv7({ msecs: old }));
    await saveWorkout(w);
    await putBlob(sentOrphan, true);
    await putBlob(freshPending);
    await putBlob(oldPending);

    await purgeLocalPhotos();

    expect(await db.blobs.get(sentOrphan)).toBeUndefined();
    expect(await db.blobs.get(freshPending)).toBeDefined();
    expect(await db.blobs.get(oldPending)).toBeUndefined();
  });

  it('retire du cache les photos qu’aucune séance non supprimée ne référence', async () => {
    const w = uuidv7();
    const current = photoPath(account.userId, w);
    const former = photoPath(account.userId, w);
    await saveWorkout(w, current);
    cache.set(photoCacheKey(ORIGIN, current), new Response('a'));
    cache.set(photoCacheKey(ORIGIN, former), new Response('b'));

    await purgeLocalPhotos();

    expect(cache.has(photoCacheKey(ORIGIN, current))).toBe(true);
    expect(cache.has(photoCacheKey(ORIGIN, former))).toBe(false);
  });
});
