import { v7 as uuidv7 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { pull, push } from '@/data/sync/engine';
import type { FolderRow } from '@/domain/types';
import {
  type Account,
  DEVICE_A,
  DEVICE_HIGH,
  DEVICE_LOW,
  folderRow,
  outboxCount,
  type RemoteDevice,
  remoteDevice,
  resetLocalDevice,
  saveFolderLocally,
  setupAccount,
} from './harness';

let account: Account;

beforeAll(async () => {
  account = await setupAccount();
});
beforeEach(resetLocalDevice);

describe('Dernier gagne sur client_updated_at (horloge appareil)', () => {
  it('une modification poussée plus tard mais horodatée plus tôt perd', async () => {
    const b = remoteDevice(account, DEVICE_LOW);
    const id = uuidv7();
    await saveFolderLocally(account, id, 'A');
    expect(
      await b.push([{ table: 'folders', row: folderRow(account, id, 'B', Date.now() + 60_000, DEVICE_LOW) }]),
    ).toEqual(['accepted']);

    await push();
    expect(await outboxCount()).toBe(0); // « stale » sort de l'outbox
    expect((await b.row<FolderRow>('folders', id)).name).toBe('B');

    await pull();
    expect((await db.folders.get(id))?.name).toBe('B');
  });

  it('la modification la plus récente gagne même si l’autre appareil a poussé avant', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = uuidv7();
    expect(
      await b.push([
        { table: 'folders', row: folderRow(account, id, 'B', Date.now() - 60_000, DEVICE_HIGH) },
      ]),
    ).toEqual(['accepted']);
    await pull();
    expect((await db.folders.get(id))?.name).toBe('B');

    await saveFolderLocally(account, id, 'A');
    await push();
    await pull();
    expect(await outboxCount()).toBe(0);
    expect((await b.row<FolderRow>('folders', id)).name).toBe('A');
    expect((await db.folders.get(id))?.name).toBe('A');
  });
});

describe('Égalité d’horodatage départagée par l’identifiant d’appareil', () => {
  const cases: [string, string, 'A' | 'B'][] = [
    ['appareil distant plus petit : la version locale gagne', DEVICE_LOW, 'A'],
    ['appareil distant plus grand : la version distante gagne', DEVICE_HIGH, 'B'],
  ];

  // Cette méthode permet de placer sur le serveur une version « B » de même horodatage qu'une modification locale « A ».
  async function tie(b: RemoteDevice): Promise<string> {
    const id = uuidv7();
    const local = await saveFolderLocally(account, id, 'A');
    const statuses = await b.push([
      { table: 'folders', row: folderRow(account, id, 'B', local.client_updated_at, b.deviceId) },
    ]);
    expect(statuses).toEqual(['accepted']);
    return id;
  }

  it.each(cases)('au push, %s', async (_label, remote, winner) => {
    const b = remoteDevice(account, remote);
    const id = await tie(b);
    await push();
    await pull();
    expect(await outboxCount()).toBe(0);
    expect((await b.row<FolderRow>('folders', id)).name).toBe(winner);
    expect((await db.folders.get(id))?.name).toBe(winner);
  });

  it.each(cases)('au pull avant le push, %s', async (_label, remote, winner) => {
    expect(DEVICE_LOW < DEVICE_A && DEVICE_A < DEVICE_HIGH).toBe(true);
    const b = remoteDevice(account, remote);
    const id = await tie(b);
    await pull();
    expect((await db.folders.get(id))?.name).toBe(winner);
    expect(await outboxCount()).toBe(winner === 'A' ? 1 : 0);

    await push();
    expect(await outboxCount()).toBe(0);
    expect((await b.row<FolderRow>('folders', id)).name).toBe(winner);
  });
});
