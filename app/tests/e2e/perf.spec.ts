import type { CDPSession, Page } from '@playwright/test';
import { v7 as uuidv7 } from 'uuid';
import type { RoutineDoc, WorkoutDoc } from '@/domain/types';
import { admin, createAccount, expect, login, skipRest, test } from './fixtures';

// Budgets de performance (§15 spec technique, exigences §F9) : séance de 6 exercices ouverte en moins d'1 s,
// historique et statistiques en moins de 2 s, avec un historique réaliste (40 séances de 6 exercices).
// Après un gros import HEVY (500 séances), valider une série reste instantané (#65).

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

// Cette méthode permet de créer la routine de 6 exercices × 3 séries et `count` séances terminées, une tous les 2 jours.
async function seedHeavyHistory(userId: string, count = 40): Promise<void> {
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

  const workouts = Array.from({ length: count }, (_, k) => {
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
          weight: { v: 40 + i * 5 + (count - k) * 0.05, u: 'kg' as const },
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
  for (let k = 0; k < workouts.length; k += 100) {
    const w = await admin()
      .from('workouts')
      .insert(workouts.slice(k, k + 100));
    if (w.error) throw new Error(w.error.message);
  }
}

// Cette méthode permet de compter les séances terminées présentes dans la base locale (synchro initiale finie).
async function localCompletedCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('overload');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise<number>((resolve) => {
        const req = db.transaction('workouts').objectStore('workouts').index('status').count('completed');
        req.onsuccess = () => resolve(req.result);
      });
    } finally {
      db.close();
    }
  });
}

// Cette méthode permet de lire le temps CPU cumulé du thread principal (ms) via le protocole Chromium.
async function taskDuration(cdp: CDPSession | undefined): Promise<number> {
  if (!cdp) return 0;
  const { metrics } = await cdp.send('Performance.getMetrics');
  return (metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0) * 1000;
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

test("budget : validation d'une série < 500 ms avec 500 séances importées", async ({ page, browserName }) => {
  test.setTimeout(120_000);
  const account = await createAccount();
  await seedHeavyHistory(account.userId, 500);
  await login(page, account);
  await expect.poll(() => localCompletedCount(page), { timeout: 60_000 }).toBe(500);

  await page.getByRole('link', { name: 'Séance' }).click();
  await page.locator('.card.routine', { hasText: ROUTINE }).getByRole('button', { name: 'Démarrer' }).click();
  await expect(page.locator('.ex')).toHaveCount(6);

  // Chromium : temps CPU du thread principal, qui compte aussi les relectures et recalculs après l'affichage
  // (indicatif, dépend de la machine ; la non-relecture de l'historique est vérifiée par src/data/queries.test.ts).
  const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : undefined;
  await cdp?.send('Performance.enable');
  const cpu0 = await taskDuration(cdp);

  // Trois séries du premier exercice validées d'affilée : le budget porte sur la plus lente.
  const rows = page.locator('.ex').first().locator('tr.set');
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const row = rows.nth(i);
    times.push(
      await timed(
        () => row.getByRole('button', { name: 'Valider la série' }).click(),
        () => expect(row).toHaveClass(/\bdone\b/),
      ),
    );
    await skipRest(page);
  }

  await page.waitForTimeout(1000); // laisse finir les écritures Dexie et les requêtes en direct qu'elles relancent
  const cpu = cdp ? Math.round((await taskDuration(cdp)) - cpu0) : undefined;

  const measured = `${times.map(Math.round).join(' · ')}${cpu === undefined ? '' : ` · CPU ${cpu}`}`;
  test.info().annotations.push({ type: 'validation 500 séances (ms)', description: measured });
  console.log(`[budgets] ${browserName} validation (500 séances) ${measured}`);
  test.skip(browserName === 'webkit' && process.platform === 'win32', 'WebKit Windows : budgets indicatifs');
  expect(Math.max(...times), "validation d'une série (500 séances)").toBeLessThan(500);
});
