import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ExerciseRow } from '@/domain/types';
import { db } from '../db';
import { getDeviceId } from '../device';
import { restoreExercise } from './index';

// Cette méthode permet de construire un exercice minimal, personnel ou du catalogue, archivé ou non.
function exercise(id: string, userId: string | null, archivedAt: number | null): ExerciseRow {
  return {
    id,
    user_id: userId,
    name: id,
    name_search: id,
    equipment: 'barbell',
    primary_muscle: 'chest',
    secondary_muscles: [],
    measurement_type: 'weight_reps',
    instructions: null,
    source_id: null,
    archived_at: archivedAt,
    deleted_at: null,
    client_updated_at: 1,
    client_device_id: 'd',
  } as unknown as ExerciseRow;
}

describe('restauration d’un exercice archivé (#69)', () => {
  beforeEach(async () => {
    await getDeviceId();
    await db.exercises.clear();
    await db.outbox.clear();
    await db.exercises.bulkPut([
      exercise('perso', 'u', 5),
      exercise('actif', 'u', null),
      exercise('catalogue', null, 5),
    ]);
  });

  it('remet archived_at à null et met la modification en file de synchro', async () => {
    await restoreExercise('perso');
    expect((await db.exercises.get('perso'))?.archived_at).toBeNull();
    expect(await db.outbox.where('[table+row_id]').equals(['exercises', 'perso']).count()).toBe(1);
  });

  it('ne touche ni un exercice actif ni un exercice du catalogue', async () => {
    await restoreExercise('actif');
    await restoreExercise('catalogue');
    expect(await db.outbox.count()).toBe(0);
    expect((await db.exercises.get('catalogue'))?.archived_at).toBe(5);
  });
});
