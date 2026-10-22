import {
  BENCH,
  checkAllSets,
  DB_BENCH,
  doneSets,
  expect,
  login,
  serverWorkouts,
  setRow,
  startRoutine,
  test,
} from './fixtures';

test('P2 complet depuis une routine : objectifs pré-remplis validés en 1 toucher, compteur 2/2', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);

  // Objectif du jour pré-rempli (style « tgt ») d'après la séance d'il y a 3 jours (60 kg et 24 kg × 8).
  for (const ex of [BENCH, DB_BENCH]) {
    const first = setRow(page, ex.name, 0);
    await expect(first.locator('input.val.tgt')).toHaveCount(2);
    await expect(first.getByRole('button', { name: 'Valider la série' })).toBeEnabled();
  }

  await checkAllSets(page);
  await expect(page.locator('.stats-row .stat', { hasText: 'Séries' })).toContainText('6');

  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(page.locator('.recap-grid .card', { hasText: 'Objectifs' })).toContainText('2/2');
  await expect(page.locator('.rec-list li', { hasText: '✓ atteint' })).toHaveCount(2);

  await page.getByRole('button', { name: 'Enregistrer' }).click();
  const keep = page.getByRole('button', { name: 'Garder la routine telle quelle' });
  await expect(page.getByRole('link', { name: 'Accueil' }).or(keep).first()).toBeVisible();
  if (await keep.isVisible()) await keep.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Objectifs atteints : 2 / 2 exercices').first()).toBeVisible();

  await expect
    .poll(async () => (await serverWorkouts(seeded)).map((w) => [w.status, doneSets(w)]))
    .toEqual([['completed', 6]]);
});
