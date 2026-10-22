import { v7 as uuidv7 } from 'uuid';
import type { RoutineDoc, WorkoutDoc } from '@/domain/types';
import { admin, createAccount, expect, login, test } from './fixtures';

// Budgets de performance (§15 spec technique, exigences §F9) : séance de 6 exercices ouverte en moins d'1 s,
// historique et statistiques en moins de 2 s, avec un historique réaliste (40 séances de 6 exercices).

const SIX = [
  'eee64d46-7f94-5743-ad72-c90d587e50a0',
  '732382f1-d017-596c-9e61-07b16e05d9d6',
  'b4232493-faf3-5cce-b400-7465f0249a81',
  'd12e347c-0f92-57c1-951d-87deb8633042',
  '5db01295-b057-56a3-af7a-02b52d296148',
  '36a8e69b-4e25-50d7-bba4-213e41e0f9b9',
];
const DEVICE = '33333333-3333-7333-8333-333333333333';
const DAY_MS = 86_400_000;
const ROUTINE = 'Budget 6 exos';

// Cette méthode permet de créer la routine de 6 exercices × 3 séries et 40 séances terminées sur 80 jours.
async function seedHeavyHistory(userId: string): Promise<void> {
  const now = Date.now();
  const routine: RoutineDoc = {
    schemaVersion: 1,
    name: ROUTINE,
    exercises: SIX.map((exerciseId) => ({
      id: uuidv7(),
      exerciseId,
      restS: 90,
      repRange: { min: 6, max: 10 },
      sets: [0, 1, 2].map(() => ({ id: uuidv7(), kind: 'normal' as const })),
    })),
  };
  const routineId = uuidv7();
  const r = await admin().from('routines').insert({
    id: routineId,
    user_id: userId,
    folder_id: null,
    position: 0,
    doc: routine,
    client_updated_at: now,
    client_device_id: DEVICE,
  });
  if (r.error) throw new Error(r.error.message);

  const workouts = Array.from({ length: 40 }, (_, k) => {
    const startedAt = now - (k * 2 + 1) * DAY_MS;
    const doc: WorkoutDoc = {
      schemaVersion: 1,
      title: `Séance ${k + 1}`,
      durationS: 3600,
      exercises: SIX.map((exerciseId, i) => ({
        id: uuidv7(),
        exerciseId,
        measurementType: 'weight_reps' as const,
        restS: 90,
        repRange: { min: 6, max: 10 },
        sets: [0, 1, 2].map((j) => ({
          id: uuidv7(),
          kind: 'normal' as const,
          weight: { v: 40 + i * 5 + (40 - k) * 0.5, u: 'kg' as const },
          reps: 8,
          done: true,
          doneAt: startedAt + (i * 3 + j + 1) * 180_000,
        })),
      })),
    };
    return {
      id: uuidv7(),
      user_id: userId,
      status: 'completed',
      owner_device_id: DEVICE,
      routine_id: routineId,
      started_at: new Date(startedAt).toISOString(),
      exercise_ids: SIX,
      doc,
      client_updated_at: now,
      client_device_id: DEVICE,
    };
  });
  const w = await admin().from('workouts').insert(workouts);
  if (w.error) throw new Error(w.error.message);
}

// Cette méthode permet de chronométrer une action jusqu'à ce que l'écran attendu soit affiché.
async function timed(action: () => Promise<void>, shown: () => Promise<void>): Promise<number> {
  const t0 = performance.now();
  await action();
  await shown();
  return performance.now() - t0;
}

test('budgets : séance de 6 exercices < 1 s, historique et statistiques < 2 s', async ({
  page,
  browserName,
}) => {
  const account = await createAccount();
  await seedHeavyHistory(account.userId);
  await login(page, account);
  await expect(page.locator('.card.hist').first()).toBeVisible();

  const stats = await timed(
    async () => {
      await page.getByRole('link', { name: 'Profil' }).click();
      await page.getByRole('button', { name: /Statistiques/ }).click();
    },
    () => expect(page.locator('.hbar').first()).toBeVisible(),
  );

  const history = await timed(
    () => page.getByRole('link', { name: 'Accueil' }).click(),
    () => expect(page.locator('.card.hist').first()).toBeVisible(),
  );

  await page.getByRole('link', { name: 'Séance' }).click();
  const start = page.locator('.card.routine', { hasText: ROUTINE }).getByRole('button', { name: 'Démarrer' });
  await expect(start).toBeVisible();
  const workout = await timed(
    () => start.click(),
    () => expect(page.locator('.ex')).toHaveCount(6),
  );

  const measured = `séance ${Math.round(workout)} · historique ${Math.round(history)} · stats ${Math.round(stats)}`;
  test.info().annotations.push({ type: 'budgets (ms)', description: measured });
  console.log(`[budgets] ${browserName} ${measured}`);
  // Le WebKit de Playwright sous Windows tourne sans JIT (10 à 20 fois plus lent que Safari) : mesure affichée
  // mais non bloquante sur ce seul couple ; la CI (Linux) applique les budgets aux deux moteurs.
  test.skip(browserName === 'webkit' && process.platform === 'win32', 'WebKit Windows : budgets indicatifs');
  expect(workout, 'ouverture de la séance (6 exercices)').toBeLessThan(1000);
  expect(history, 'historique').toBeLessThan(2000);
  expect(stats, 'statistiques').toBeLessThan(2000);
});
