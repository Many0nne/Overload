import { v7 as uuidv7 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { readErrors } from '@/data/errors';
import { saveRow } from '@/data/repositories/base';
import { pull, push } from '@/data/sync/engine';
import { readRejects } from '@/data/sync/rejects';
import {
  type Account,
  DEVICE_HIGH,
  folderRow,
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

describe('Lignes refusées par le serveur (#58)', () => {
  it('une ligne invalide inconnue du serveur est signalée puis retirée de la base locale', async () => {
    const id = uuidv7();
    await saveRow('body_measurements', {
      id,
      user_id: account.userId,
      measured_on: 'pas-une-date',
      values: {},
      deleted_at: null,
    });

    await push();

    expect(await outboxCount()).toBe(0);
    expect(await db.body_measurements.get(id)).toBeUndefined();
    expect(await readRejects()).toMatchObject([{ table: 'body_measurements', id, status: 'invalid' }]);
    expect((await readErrors()).some((e) => e.scope === 'sync' && e.message.includes(id))).toBe(true);
  });

  it('une modification interdite est signalée et la ligne locale reprend la version serveur', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = uuidv7();
    await b.push([
      { table: 'folders', row: folderRow(account, id, 'serveur', Date.now() - 60_000, DEVICE_HIGH) },
    ]);
    await pull();

    // Ligne locale corrompue : rattachée à un autre compte, le serveur la refuse.
    await saveFolderLocally(account, id, 'locale');
    await saveRow('folders', { ...(await db.folders.get(id))!, user_id: uuidv7() });

    await push();

    expect(await outboxCount()).toBe(0);
    const local = await db.folders.get(id);
    expect(local).toMatchObject({ name: 'serveur', user_id: account.userId });
    expect(await readRejects()).toMatchObject([{ table: 'folders', id, status: 'forbidden' }]);
  });

  it('une ligne acceptée ne laisse aucun refus', async () => {
    await saveFolderLocally(account, uuidv7(), 'ok');
    await push();
    expect(await readRejects()).toEqual([]);
  });
});
