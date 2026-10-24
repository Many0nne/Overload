import { v7 as uuidv7 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, getMeta } from '@/data/db';
import { saveRow } from '@/data/repositories/base';
import { pull, push } from '@/data/sync/engine';
import { readRejects } from '@/data/sync/rejects';
import { useSyncStatus } from '@/data/sync/status';
import { DOC_VERSIONS } from '@/domain/schema';
import {
  type Account,
  DEVICE_HIGH,
  folderRow,
  outboxCount,
  remoteDevice,
  resetLocalDevice,
  setupAccount,
} from './harness';

let account: Account;
const NEXT = DOC_VERSIONS.routines + 1;

// Cette méthode permet de construire une routine telle qu'un appareil l'enverrait, au format de document indiqué.
function routineRow(id: string, name: string, schemaVersion: number, ts: number) {
  return {
    id,
    user_id: account.userId,
    folder_id: null,
    position: 0,
    doc: { schemaVersion, name, exercises: [] },
    deleted_at: null,
    client_updated_at: ts,
    client_device_id: DEVICE_HIGH,
  };
}

// Un compte par test : un document d'un format plus récent resté sur le serveur bloquerait le pull des tests suivants.
beforeEach(async () => {
  account = await setupAccount();
  await resetLocalDevice();
  useSyncStatus.getState().set({ appOutdated: false });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Versions des documents (#71)', () => {
  it('un document d’un format plus récent bloque le pull sans avancer les curseurs', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    await pull();
    const cursors = await getMeta('cursors');

    const folderId = uuidv7();
    const routineId = uuidv7();
    await b.push([
      { table: 'folders', row: folderRow(account, folderId, 'dossier', Date.now(), DEVICE_HIGH) },
      { table: 'routines', row: routineRow(routineId, 'future', NEXT, Date.now()) },
    ]);

    expect(await pull()).toBe(0);
    expect(useSyncStatus.getState().appOutdated).toBe(true);
    expect(await getMeta('cursors')).toEqual(cursors);
    expect(await db.routines.get(routineId)).toBeUndefined();
    expect(await db.folders.get(folderId)).toBeUndefined();
  });

  it('un document sans version est mis au format de l’app au pull', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = uuidv7();
    const row = routineRow(id, 'ancienne', 1, Date.now());
    await b.push([{ table: 'routines', row: { ...row, doc: { name: 'ancienne', exercises: [] } } }]);

    await pull();

    expect((await db.routines.get(id))?.doc).toEqual({
      schemaVersion: DOC_VERSIONS.routines,
      name: 'ancienne',
      exercises: [],
    });
    expect(useSyncStatus.getState().appOutdated).toBe(false);
  });

  it('le serveur refuse d’écraser un format plus récent : la ligne locale est gardée et la mise à jour demandée', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = uuidv7();
    await b.push([
      { table: 'routines', row: routineRow(id, 'v1', DOC_VERSIONS.routines, Date.now() - 60_000) },
    ]);
    await pull();
    // Un appareil à jour réécrit la routine au format suivant ; l'appareil A ne l'a pas encore reçue.
    expect(
      await b.push([{ table: 'routines', row: routineRow(id, 'future', NEXT, Date.now() - 30_000) }]),
    ).toEqual(['accepted']);

    await saveRow('routines', {
      ...(await db.routines.get(id))!,
      doc: { schemaVersion: 1, name: 'locale', exercises: [] },
    });
    await push();

    expect(await outboxCount()).toBe(0);
    expect(await readRejects()).toMatchObject([{ table: 'routines', id, status: 'outdated' }]);
    expect(useSyncStatus.getState().appOutdated).toBe(true);
    expect((await db.routines.get(id))?.doc.name).toBe('locale');
    expect((await b.row<{ doc: { name: string } }>('routines', id)).doc.name).toBe('future');
  });
});
