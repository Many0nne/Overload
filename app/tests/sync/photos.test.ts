import { v7 as uuidv7 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { readErrors } from '@/data/errors';
import { push } from '@/data/sync/engine';
import { MAX_PHOTO_ATTEMPTS, readAbandonedPhotos, retryAbandonedPhotos } from '@/data/sync/photos';
import {
  type Account,
  DEVICE_HIGH,
  outboxCount,
  remoteDevice,
  resetLocalDevice,
  saveFolderLocally,
  setupAccount,
} from './harness';

let account: Account;

beforeAll(async () => {
  account = await setupAccount();
});
beforeEach(async () => {
  await resetLocalDevice();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Cette méthode permet de déposer une photo locale en attente d'envoi, comme le récapitulatif de séance.
async function savePhotoLocally(path: string): Promise<void> {
  await db.blobs.put({
    path,
    blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
    kind: 'photo',
    uploaded: false,
  });
}

describe("Photos en échec d'envoi (#59)", () => {
  it('une photo envoyée est marquée comme telle', async () => {
    const path = `${account.userId}/${uuidv7()}.jpg`;
    await savePhotoLocally(path);
    await push();
    expect(await db.blobs.get(path)).toMatchObject({ uploaded: true });
  });

  it("une photo refusée par le serveur n'empêche pas le push des documents", async () => {
    // Hors du dossier du compte : la RLS du bucket refuse l'envoi.
    const path = `${uuidv7()}/${uuidv7()}.jpg`;
    await savePhotoLocally(path);
    const folderId = uuidv7();
    await saveFolderLocally(account, folderId, 'malgré la photo');

    await push();

    expect(await outboxCount()).toBe(0);
    expect(await remoteDevice(account, DEVICE_HIGH).row('folders', folderId)).toMatchObject({
      name: 'malgré la photo',
    });
    expect(await db.blobs.get(path)).toMatchObject({ uploaded: false, attempts: 1, abandoned: false });
    expect((await readErrors()).some((e) => e.scope === 'sync' && e.message.includes(path))).toBe(true);
  });

  it('une photo refusée trop souvent est abandonnée, puis relancée à la demande', async () => {
    const path = `${uuidv7()}/${uuidv7()}.jpg`;
    await savePhotoLocally(path);

    for (let i = 0; i < MAX_PHOTO_ATTEMPTS + 2; i++) await push();

    expect(await db.blobs.get(path)).toMatchObject({ attempts: MAX_PHOTO_ATTEMPTS, abandoned: true });
    expect((await readAbandonedPhotos()).map((b) => b.path)).toEqual([path]);

    await retryAbandonedPhotos();
    expect(await readAbandonedPhotos()).toEqual([]);
    await push();
    expect(await db.blobs.get(path)).toMatchObject({ attempts: 1, abandoned: false });
  });

  it("une coupure réseau pendant l'envoi ne compte pas de tentative et laisse partir les documents", async () => {
    const path = `${account.userId}/${uuidv7()}.jpg`;
    await savePhotoLocally(path);
    await saveFolderLocally(account, uuidv7(), 'hors photo');
    const original = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('/storage/v1/')) return Promise.reject(new TypeError('fetch failed'));
      return original(input, init);
    });

    await push();

    expect(await outboxCount()).toBe(0);
    const blob = await db.blobs.get(path);
    expect(blob).toMatchObject({ uploaded: false });
    expect(blob?.attempts ?? 0).toBe(0);
  });
});
