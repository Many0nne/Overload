import {
  checkAllSets,
  doneSets,
  expect,
  login,
  serverWorkouts,
  skipRest,
  startRoutine,
  test,
  waitForOfflineReady,
} from './fixtures';

test('P2 hors ligne de bout en bout, puis synchro au retour du réseau', async ({ page, context, seeded }) => {
  await login(page, seeded.account);
  await waitForOfflineReady(page);
  await context.setOffline(true);

  await startRoutine(page, seeded.routineName);
  await checkAllSets(page);
  await skipRest(page);
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('.recap-grid .card', { hasText: 'Objectifs' })).toContainText('2/2');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  const keep = page.getByRole('button', { name: 'Garder la routine telle quelle' });
  await expect(page.getByRole('link', { name: 'Accueil' }).or(keep).first()).toBeVisible();
  if (await keep.isVisible()) await keep.click();
  await expect(page.getByText('Objectifs atteints : 2 / 2 exercices').first()).toBeVisible();

  // Rien n'est parti tant que le réseau est coupé.
  await page.waitForTimeout(3000);
  expect(await serverWorkouts(seeded)).toEqual([]);

  await context.setOffline(false);
  await expect
    .poll(async () => (await serverWorkouts(seeded)).map((w) => [w.status, doneSets(w)]), { timeout: 20_000 })
    .toEqual([['completed', 6]]);
});
