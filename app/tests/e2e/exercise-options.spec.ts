import {
  admin,
  BENCH,
  checkSet,
  DB_BENCH,
  expect,
  localWorkoutDoc,
  login,
  setRow,
  skipRest,
  startRoutine,
  test,
} from './fixtures';

test('Réglages de l’exercice : RPE et objectif désactivés sur la fiche, absents en séance (#124)', async ({
  page,
  seeded,
}) => {
  const { error } = await admin()
    .from('profiles')
    .update({ settings: { rpeEnabled: true } })
    .eq('id', seeded.account.userId);
  expect(error).toBeNull();
  await login(page, seeded.account);

  await page.goto(`/exercise/${BENCH.id}`);
  await expect(page.getByText('Objectif de la prochaine séance')).toBeVisible();
  const rpe = page.getByRole('switch', { name: "Noter l'effort (RPE)" });
  const goal = page.getByRole('switch', { name: 'Objectif de progression' });
  await expect(rpe).toHaveAttribute('aria-checked', 'true');
  await expect(goal).toHaveAttribute('aria-checked', 'true');
  await rpe.click();
  await goal.click();
  await expect(rpe).toHaveAttribute('aria-checked', 'false');
  await expect(goal).toHaveAttribute('aria-checked', 'false');
  // Sans objectif : ni prochain objectif ni réglages qui n'ont de sens qu'avec lui.
  await expect(page.getByText('Objectif de la prochaine séance')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Objectif à long terme/ })).toHaveCount(0);

  await page.goto('/');
  await startRoutine(page, seeded.routineName);
  const workoutId = page.url().split('/').pop()!;
  const bench = page.locator('.ex', { hasText: BENCH.name });
  const other = page.locator('.ex', { hasText: DB_BENCH.name });

  // Témoin : l'autre exercice garde sa colonne RPE et son objectif.
  await expect(other.locator('th', { hasText: 'RPE' })).toBeVisible();
  await expect(other.locator('.goal-line')).toBeVisible();

  await expect(bench.locator('th', { hasText: 'RPE' })).toHaveCount(0);
  await expect(bench.locator('.goal-line')).toHaveCount(0);
  await expect(bench.locator('input.val.tgt')).toHaveCount(0);
  await checkSet(page, BENCH.name, 0);
  await skipRest(page);
  await expect(setRow(page, BENCH.name, 0).locator('.rpe-btn')).toHaveCount(0);

  const doc = await localWorkoutDoc(page, workoutId);
  const entry = doc?.exercises.find((e) => e.exerciseId === BENCH.id);
  expect(entry?.targetReason).toBeUndefined();
  expect(entry?.sets.every((s) => s.target === undefined)).toBe(true);
});
