import { BENCH, checkSet, expect, login, newDevice, setRow, skipRest, startRoutine, test } from './fixtures';

test('deux appareils : séance visible sur le second, reprise, lecture seule sur le premier', async ({
  page,
  browser,
  seeded,
}) => {
  // Appareil A : démarre la séance et valide une série (poussée après l'anti-rebond de 2 s).
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);
  await checkSet(page, BENCH.name, 0);
  await skipRest(page);
  await page.waitForTimeout(3000);

  // Appareil B : la séance de A apparaît dans le bandeau, en lecture seule.
  const b = await newDevice(browser);
  await login(b, seeded.account);
  const banner = b.locator('.banner');
  await expect(banner).toContainText('Séance en cours sur un autre appareil');
  await banner.click();
  await expect(b.getByText('Séance en cours sur un autre appareil').first()).toBeVisible();
  await expect(setRow(b, BENCH.name, 0)).toHaveClass(/\bdone\b/);
  await expect(setRow(b, BENCH.name, 1).getByRole('button', { name: 'Valider la série' })).toBeDisabled();

  // B reprend la séance et continue.
  await b.getByRole('button', { name: 'Reprendre ici' }).click();
  await b.locator('.sheet').getByRole('button', { name: 'Reprendre ici' }).click();
  await expect(b.getByText('Séance reprise sur cet appareil')).toBeVisible();
  await checkSet(b, BENCH.name, 1);

  // A revient au premier plan (synchro) : la séance passe en lecture seule et reçoit la série de B.
  await b.waitForTimeout(3000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('button', { name: 'Reprendre ici' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Terminer' })).toHaveCount(0);
  await expect(setRow(page, BENCH.name, 1)).toHaveClass(/\bdone\b/);
  await expect(setRow(page, BENCH.name, 2).getByRole('button', { name: 'Valider la série' })).toBeDisabled();

  await b.context().close();
});
