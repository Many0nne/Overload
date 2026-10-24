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

test('feuille modale : nommée par son titre, prend le focus, isole la page et le rend à la fermeture', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);
  await page.goto('/');
  const trigger = page.locator('.banner').getByRole('button', { name: 'Abandonner la séance' });
  await trigger.focus();
  await trigger.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Abandonner la séance ?' });
  await expect(dialog).toBeFocused();
  // Le reste de l'app est inerte (hors d'atteinte du lecteur d'écran), sauf le toast qui doit rester annoncé.
  await expect(page.locator('.banner')).toHaveJSProperty('inert', true);
  await expect(page.locator('main')).toHaveJSProperty('inert', true);
  await expect(page.locator('.toast')).toHaveJSProperty('inert', false);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('.banner')).toHaveJSProperty('inert', false);
});
