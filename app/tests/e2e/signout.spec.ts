import {
  BENCH,
  checkSet,
  expect,
  login,
  serverWorkouts,
  startRoutine,
  test,
  waitForOfflineReady,
} from './fixtures';

test('déconnexion hors ligne : avertit des données non synchronisées, puis se déconnecte après la synchro', async ({
  page,
  context,
  seeded,
}) => {
  await login(page, seeded.account);
  await waitForOfflineReady(page);
  await context.setOffline(true);

  await startRoutine(page, seeded.routineName);
  await checkSet(page, BENCH.name, 0);

  await page.goto('/profile/settings');
  await page.locator('.set-row', { hasText: 'Se déconnecter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Se déconnecter', exact: true }).click();

  const warning = page.getByRole('dialog').filter({ hasText: 'Données non synchronisées' });
  await expect(warning).toContainText(/\d+ modifications? (n'est|ne sont) pas encore sur ton compte/);
  await expect(warning.getByRole('button', { name: 'Exporter puis se déconnecter' })).toBeVisible();
  await expect(warning.getByRole('button', { name: 'Se déconnecter quand même' })).toBeVisible();
  expect(await serverWorkouts(seeded)).toEqual([]);

  // Retour du réseau : la nouvelle tentative envoie la séance, puis la déconnexion se fait.
  await context.setOffline(false);
  await warning.getByRole('button', { name: 'Réessayer la synchro' }).click();
  await expect(page.getByLabel('E-mail')).toBeVisible({ timeout: 20_000 });
  expect((await serverWorkouts(seeded)).map((w) => w.status)).toEqual(['in_progress']);
});
