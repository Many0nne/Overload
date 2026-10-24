import 'fake-indexeddb/auto';
import { liveQuery } from 'dexie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutRow } from '@/domain/types';
import { db } from './db';
import { loadCompletedWorkouts } from './queries';

// Cette méthode permet de construire une séance minimale avec le statut et le titre voulus.
function workout(id: string, status: WorkoutRow['status'], title: string, startedAt: number): WorkoutRow {
  return {
    id,
    user_id: 'u',
    status,
    owner_device_id: 'd',
    routine_id: null,
    started_at: startedAt,
    exercise_ids: [],
    doc: { schemaVersion: 1, title, exercises: [] },
    client_updated_at: startedAt,
    client_device_id: 'd',
  } as unknown as WorkoutRow;
}

// Cette méthode permet de laisser Dexie propager les écritures aux requêtes en direct.
const settle = () => new Promise((r) => setTimeout(r, 100));

describe('séances terminées en direct (#65)', () => {
  const emissions: string[][] = [];
  let unsubscribe = () => {};

  beforeAll(async () => {
    await db.workouts.bulkPut([workout('a', 'completed', 'A', 2), workout('b', 'completed', 'B', 1)]);
    await db.workouts.put(workout('live', 'in_progress', 'En cours', 3));
    const sub = liveQuery(loadCompletedWorkouts).subscribe((rows) => emissions.push(rows.map((w) => w.id)));
    unsubscribe = () => sub.unsubscribe();
    await settle();
  });

  afterAll(() => unsubscribe());

  it('trie par début croissant et ignore la séance en cours', () => {
    expect(emissions).toEqual([['b', 'a']]);
  });

  it("n'est pas relue quand la séance en cours est modifiée", async () => {
    await db.workouts.put(workout('live', 'in_progress', 'Série validée', 3));
    await db.workouts.update('live', { client_updated_at: 10 });
    await settle();
    expect(emissions).toHaveLength(1);
  });

  it('est relue quand la séance en cours est terminée', async () => {
    await db.workouts.update('live', { status: 'completed' });
    await settle();
    expect(emissions.at(-1)).toEqual(['b', 'a', 'live']);
  });
});
