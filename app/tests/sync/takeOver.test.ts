import { v7 as uuidv7 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { saveRow } from '@/data/repositories/base';
import { NIL_DEVICE, pull, push, takeOverWorkout } from '@/data/sync/engine';
import type { WorkoutRow } from '@/domain/types';
import {
  type Account,
  DEVICE_A,
  DEVICE_HIGH,
  outboxCount,
  remoteDevice,
  resetLocalDevice,
  setupAccount,
  workoutDraft,
} from './harness';

let account: Account;

beforeAll(async () => {
  account = await setupAccount();
});
beforeEach(resetLocalDevice);

// Cette méthode permet de démarrer sur l'appareil A une séance en cours et de la pousser au serveur.
async function startWorkoutOnA(): Promise<string> {
  const id = uuidv7();
  await saveRow('workouts', workoutDraft(account, id, DEVICE_A));
  await push();
  expect(await outboxCount()).toBe(0);
  return id;
}

// Cette méthode permet de modifier localement la note de la séance, comme le ferait l'écran de séance.
async function editNote(id: string, note: string): Promise<void> {
  const w = (await db.workouts.get(id))!;
  await saveRow('workouts', { ...w, doc: { ...w.doc, note } });
}

describe('Séance reprise sur un autre appareil (take_over_workout)', () => {
  it('une écriture de l’appareil dépossédé est rejetée et la séance passe en lecture seule', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = await startWorkoutOnA();
    expect((await b.takeOver(id)).owner_device_id).toBe(DEVICE_HIGH);

    await editNote(id, 'après la reprise');
    const { rejected } = await push();
    expect(rejected).toEqual([id]);
    expect(await outboxCount()).toBe(0);
    expect((await db.workouts.get(id))?.owner_device_id).toBe(NIL_DEVICE);

    const server = await b.row<WorkoutRow>('workouts', id);
    expect(server.owner_device_id).toBe(DEVICE_HIGH);
    expect(server.doc.note).toBeUndefined();

    await pull();
    const local = (await db.workouts.get(id))!;
    expect(local.owner_device_id).toBe(DEVICE_HIGH);
    expect(local.doc.note).toBeUndefined(); // modifications non poussées jetées (§6.4)
  });

  it('un pull applique la reprise même si une modification locale plus récente est en attente', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = await startWorkoutOnA();
    const taken = await b.takeOver(id);

    await editNote(id, 'en attente');
    expect((await db.workouts.get(id))!.client_updated_at).toBeGreaterThanOrEqual(taken.client_updated_at);
    await pull();
    const local = (await db.workouts.get(id))!;
    expect(local.owner_device_id).toBe(DEVICE_HIGH);
    expect(local.doc.note).toBeUndefined();
    expect(await outboxCount()).toBe(0);
  });

  it('après « Reprendre ici » sur A, A écrit et l’ancien propriétaire est rejeté', async () => {
    const b = remoteDevice(account, DEVICE_HIGH);
    const id = uuidv7();
    const draft = {
      ...workoutDraft(account, id, DEVICE_HIGH),
      client_updated_at: Date.now(),
      client_device_id: DEVICE_HIGH,
    };
    expect(await b.push([{ table: 'workouts', row: draft }])).toEqual(['accepted']);
    await pull();

    await takeOverWorkout(id);
    expect((await db.workouts.get(id))?.owner_device_id).toBe(DEVICE_A);
    await editNote(id, 'reprise sur A');
    expect(await push()).toEqual({ rejected: [] });
    expect((await b.row<WorkoutRow>('workouts', id)).doc.note).toBe('reprise sur A');

    const late = {
      ...draft,
      doc: { ...draft.doc, note: 'B dépossédé' },
      client_updated_at: Date.now() + 60_000,
    };
    expect(await b.push([{ table: 'workouts', row: late }])).toEqual(['rejected_not_owner']);
  });
});
