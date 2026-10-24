import { v7 as uuidv7 } from 'uuid';
import type { WorkoutDoc } from '@/domain/types';
import { admin, BENCH, expect, login, type Seeded, test } from './fixtures';

const SEED_DEVICE = '22222222-2222-7222-8222-222222222222';

// Cette méthode permet d'ajouter une séance terminée d'il y a une minute au développé couché (62,5 kg × 8 puis 65 kg × 5),
// qui bat la séance seedée (3 × 60 kg × 8) sur la charge max, le 1RM estimé, la meilleure série et les poids à N reps.
async function seedRecordWorkout(seeded: Seeded): Promise<void> {
  const now = Date.now();
  const startedAt = now - 60_000;
  const doc: WorkoutDoc = {
    schemaVersion: 1,
    title: 'Push – records',
    durationS: 1800,
    exercises: [
      {
        id: uuidv7(),
        exerciseId: BENCH.id,
        measurementType: 'weight_reps',
        restS: 90,
        sets: [
          [62.5, 8],
          [65, 5],
        ].map(([kg, reps], i) => ({
          id: uuidv7(),
          kind: 'normal' as const,
          weight: { v: kg!, u: 'kg' as const },
          reps: reps!,
          done: true,
          doneAt: startedAt + (i + 1) * 120_000,
        })),
      },
    ],
  };
  const res = await admin()
    .from('workouts')
    .insert({
      id: uuidv7(),
      user_id: seeded.account.userId,
      status: 'completed',
      owner_device_id: SEED_DEVICE,
      routine_id: null,
      started_at: new Date(startedAt).toISOString(),
      exercise_ids: [BENCH.id],
      doc,
      client_updated_at: now,
      client_device_id: SEED_DEVICE,
    });
  if (res.error) throw new Error(`insert workout : ${res.error.message}`);
}

// Cette méthode permet de vérifier la section « Records récents » (#102) : en-tête de jour, critère principal, valeur et
// gain sur l'ancien record, autres critères nommés, cible tactile d'au moins 44 px et ouverture de la fiche exercice.
test('statistiques : records récents datés, détaillés et cliquables', async ({ page, seeded }) => {
  await seedRecordWorkout(seeded);
  await login(page, seeded.account);
  await page.goto('/profile/stats');

  const line = page.locator('.rec-line', { hasText: BENCH.name });
  await expect(line).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.rec-day').first()).toHaveText(/^(Aujourd'hui|Hier) · /); // « Hier » si le test tourne juste après minuit
  await expect(line.locator('.rec-crit')).toHaveText('Charge max');
  await expect(line.locator('.rec-val b')).toHaveText('65 kg');
  await expect(line.locator('.rec-gain')).toHaveText('+5 kg');
  await expect(line.locator('.rec-pill', { hasText: '1RM estimé' })).toContainText('79,2 kg');
  await expect(line.locator('.rec-pill', { hasText: 'Meilleure série' })).toContainText('62,5 kg × 8');
  await expect(line.locator('.rec-pill', { hasText: 'à 8 reps' })).toContainText('62,5 kg');
  await expect(line.locator('.rec-pill', { hasText: 'à 1, 3 et 5 reps' })).toContainText('65 kg');
  await expect(page.getByText(/autres?\)/)).toHaveCount(0);

  const box = await line.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await line.click();
  await expect(page).toHaveURL(new RegExp(`/exercise/${BENCH.id}$`));
});
