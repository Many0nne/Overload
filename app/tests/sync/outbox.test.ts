import { v7 as uuidv7 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { supabase } from '@/data/supabase';
import { pull, push } from '@/data/sync/engine';
import type { FolderRow } from '@/domain/types';
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
beforeEach(resetLocalDevice);

describe('Outbox non écrasée par un pull', () => {
  it('une modification locale en attente survit à une version distante plus ancienne', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = uuidv7();
    await b.push([
      { table: 'folders', row: folderRow(account, id, 'v1', Date.now() - 120_000, DEVICE_HIGH) },
    ]);
    await pull();

    await saveFolderLocally(account, id, 'local');
    await b.push([
      { table: 'folders', row: folderRow(account, id, 'distant', Date.now() - 60_000, DEVICE_HIGH) },
    ]);
    await pull();
    expect((await db.folders.get(id))?.name).toBe('local');
    expect(await db.outbox.where('[table+row_id]').equals(['folders', id]).count()).toBe(1);

    await push();
    expect(await outboxCount()).toBe(0);
    expect((await b.row<FolderRow>('folders', id)).name).toBe('local');
  });

  it('un élément créé hors ligne reste en attente après un pull qui apporte d’autres lignes', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const mine = uuidv7();
    const theirs = uuidv7();
    await saveFolderLocally(account, mine, 'créé hors ligne');
    await b.push([{ table: 'folders', row: folderRow(account, theirs, 'distant', Date.now(), DEVICE_HIGH) }]);

    await pull();
    expect((await db.folders.get(theirs))?.name).toBe('distant');
    expect((await db.folders.get(mine))?.name).toBe('créé hors ligne');
    expect((await db.outbox.toArray()).map((e) => e.row_id)).toEqual([mine]);
  });

  it('une version distante plus récente remplace la modification en attente et la retire de l’outbox', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = uuidv7();
    await saveFolderLocally(account, id, 'local');
    await b.push([
      { table: 'folders', row: folderRow(account, id, 'distant', Date.now() + 60_000, DEVICE_HIGH) },
    ]);

    await pull();
    expect((await db.folders.get(id))?.name).toBe('distant');
    expect(await outboxCount()).toBe(0);
  });

  it('une modification faite pendant l’envoi reste en attente pour le push suivant', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = uuidv7();
    await saveFolderLocally(account, id, 'v1');
    const original = supabase.rpc.bind(supabase);
    const spy = vi.spyOn(supabase, 'rpc').mockImplementationOnce((async (name: string, args: unknown) => {
      await saveFolderLocally(account, id, 'v2'); // l'utilisateur modifie pendant que le lot part
      return original(name, args as never);
    }) as never);

    await push();
    spy.mockRestore();
    expect((await b.row<FolderRow>('folders', id)).name).toBe('v1');
    expect(await outboxCount()).toBe(1);

    await pull(); // la version serveur (v1, plus ancienne) ne doit pas écraser v2
    expect((await db.folders.get(id))?.name).toBe('v2');
    await push();
    expect(await outboxCount()).toBe(0);
    expect((await b.row<FolderRow>('folders', id)).name).toBe('v2');
  });
});
