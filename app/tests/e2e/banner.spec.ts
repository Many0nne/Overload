import { BENCH, checkSet, DB_BENCH, expect, login, serverWorkouts, startRoutine, test } from './fixtures';

test('bandeau de séance : exercice en cours, reprise, et abandon sans revenir dans la séance', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);
  for (let i = 0; i < 3; i++) await checkSet(page, BENCH.name, i);
  await expect.poll(async () => (await serverWorkouts(seeded)).length).toBe(1);

  await page.goto('/');
  const banner = page.locator('.banner');
  await expect(banner).toContainText('Séance en cours');
  await expect(banner.locator('.banner-sub')).toHaveText(DB_BENCH.name);

  // Toucher la carte reprend la séance.
  await banner.locator('.banner-main').click();
  await expect(page).toHaveURL(/\/workout\/[0-9a-f-]+$/);

  await page.goto('/');
  await banner.getByRole('button', { name: 'Abandonner la séance' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Continuer la séance' }).click();
  await expect(banner).toBeVisible();

  await banner.getByRole('button', { name: 'Abandonner la séance' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Abandonner', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(async () => (await serverWorkouts(seeded)).length).toBe(0);
});
