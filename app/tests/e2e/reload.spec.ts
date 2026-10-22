import { BENCH, checkSet, expect, login, setRow, startRoutine, test, waitForOfflineReady } from './fixtures';

test('rechargement en pleine séance sans perte (séries validées, saisie en cours, minuteur)', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await waitForOfflineReady(page);
  await startRoutine(page, seeded.routineName);
  const url = page.url();

  await checkSet(page, BENCH.name, 0);
  await expect(page.locator('.rest-panel')).toBeVisible();
  const weight = setRow(page, BENCH.name, 1).getByRole('textbox', { name: 'weight' });
  await weight.fill('62,5');
  await weight.blur();

  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(setRow(page, BENCH.name, 0)).toHaveClass(/\bdone\b/);
  await expect(setRow(page, BENCH.name, 1).getByRole('textbox', { name: 'weight' })).toHaveValue('62,5');
  await expect(setRow(page, BENCH.name, 1)).not.toHaveClass(/\bdone\b/);
  await expect(page.locator('.rest-panel .lbl')).toContainText(`${BENCH.name}, série 1`);

  // Même chose hors ligne : l'app se recharge depuis le service worker et la base locale.
  await page.context().setOffline(true);
  await page.reload();
  await expect(setRow(page, BENCH.name, 0)).toHaveClass(/\bdone\b/);
  await expect(setRow(page, BENCH.name, 1).getByRole('textbox', { name: 'weight' })).toHaveValue('62,5');
});
