import { v7 as uuidv7 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { PUSH_BATCH, pull, push } from '@/data/sync/engine';
import {
  type Account,
  cutNetworkOn,
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

// Cette méthode permet de créer n dossiers sur l'appareil A, chacun avec son entrée d'outbox.
async function createLocalFolders(n: number, prefix: string): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = uuidv7();
    await saveFolderLocally(account, id, `${prefix}-${i}`);
    ids.push(id);
  }
  return ids;
}

describe('Reprise après coupure au milieu d’un lot', () => {
  it('coupure avant l’envoi du 2e lot : les lots suivants repartent, rien n’est perdu', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const prefix = `avant-${uuidv7()}`;
    await createLocalFolders(250, prefix);

    const cut = cutNetworkOn('sync_push', 2, 'before');
    await expect(push()).rejects.toThrow('fetch failed');
    cut.mockRestore();
    expect(await outboxCount()).toBe(250 - PUSH_BATCH);
    expect(await b.countFolders(prefix)).toBe(PUSH_BATCH);

    await push();
    expect(await outboxCount()).toBe(0);
    expect(await b.countFolders(prefix)).toBe(250);
  });

  it('réponse perdue après validation serveur : le renvoi est ignoré, sans doublon', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const prefix = `apres-${uuidv7()}`;
    const ids = await createLocalFolders(250, prefix);

    const cut = cutNetworkOn('sync_push', 2, 'after');
    await expect(push()).rejects.toThrow('fetch failed');
    cut.mockRestore();
    expect(await outboxCount()).toBe(250 - PUSH_BATCH); // le 2e lot est sur le serveur mais encore en attente
    expect(await b.countFolders(prefix)).toBe(2 * PUSH_BATCH);

    await push();
    expect(await outboxCount()).toBe(0);
    expect(await b.countFolders(prefix)).toBe(250);
    const sample = ids[PUSH_BATCH + 10]!;
    expect((await b.row('folders', sample)).client_updated_at).toBe(
      (await db.folders.get(sample))?.client_updated_at,
    );
  });

  it('coupure au milieu d’un pull paginé : reprise au dernier curseur validé, sans re-téléchargement', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const prefix = `pull-${uuidv7()}`;
    for (let lot = 0; lot < 6; lot++) {
      const rows = Array.from({ length: 100 }, (_, i) => ({
        table: 'folders' as const,
        row: folderRow(account, uuidv7(), `${prefix}-${lot * 100 + i}`, Date.now(), DEVICE_HIGH),
      }));
      expect(new Set(await b.push(rows))).toEqual(new Set(['accepted']));
    }
    const total = await b.countFolders();
    expect(total).toBeGreaterThan(500);

    const cut = cutNetworkOn('sync_pull', 2, 'before');
    await expect(pull()).rejects.toThrow('fetch failed');
    cut.mockRestore();
    expect(await db.folders.count()).toBe(500); // première page appliquée, curseurs enregistrés

    expect(await pull()).toBe(total - 500);
    expect(await db.folders.count()).toBe(total);
    expect(await db.folders.filter((f) => f.name.startsWith(prefix)).count()).toBe(600);
  });
});
