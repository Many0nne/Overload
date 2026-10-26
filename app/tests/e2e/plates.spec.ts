import { BENCH, expect, login, setRow, startRoutine, test } from './fixtures';

test('Disques : bandeau qui suit la saisie du poids, puis calculateur depuis le menu de l’exercice', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);

  const block = page.locator('.ex', { hasText: BENCH.name });
  const weight = setRow(page, BENCH.name, 0).getByLabel('Poids');
  const strip = block.locator('tr.plate-strip');
  await expect(strip).toHaveCount(0);

  await weight.click();
  await weight.fill('82,5');
  await expect(strip).toContainText('Par côté : 25 + 5 + 1,25');
  await expect(strip).toContainText('barre 20 kg');

  // Charge inatteignable : le reste est signalé.
  await weight.fill('82');
  await expect(strip).toContainText('2 kg impossibles');

  // Le bandeau disparaît à la sortie du champ.
  await weight.blur();
  await expect(strip).toHaveCount(0);

  await block.getByRole('button', { name: "Actions de l'exercice" }).click();
  await page.getByRole('button', { name: 'Calculer les disques' }).click();
  const sheet = page.locator('.plate-sheet');
  await sheet.getByLabel('Charge totale').fill('142,5');
  await expect(sheet).toContainText('Par côté : 2 × 25 + 10 + 1,25');
  await sheet.getByRole('button', { name: 'Ajouter une paire de disques' }).click();
  await expect(sheet.getByLabel('Charge totale')).toHaveValue('145');
  await expect(sheet).toContainText('Par côté : 2 × 25 + 10 + 2,5');
});

const EZ_CURL = { id: '1f9fad84-4617-52f9-be85-ca9df81108dc', name: 'Curl biceps (barre EZ)' };

test('Disques : barre EZ détectée sur le curl, autre barre choisie et mémorisée pour l’exercice', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await page.goto(`/exercise/${EZ_CURL.id}`);
  await page.getByRole('button', { name: 'Calculer les disques' }).click();
  const sheet = page.locator('.plate-sheet');
  await expect(sheet.getByRole('button', { name: 'EZ · 10' })).toHaveAttribute('aria-pressed', 'true');
  await sheet.getByLabel('Charge totale').fill('30');
  await expect(sheet).toContainText('Par côté : 10');
  await expect(sheet).toContainText('barre EZ 10 kg');

  // Barre olympique choisie à la main : 5 kg par côté, choix gardé après rechargement.
  await sheet.getByRole('button', { name: 'Olympique · 20' }).click();
  await expect(sheet).toContainText('Par côté : 5');
  await expect(sheet).toContainText('barre 20 kg');
  await page.reload();
  await page.getByRole('button', { name: 'Calculer les disques' }).click();
  await expect(sheet.getByRole('button', { name: 'Olympique · 20' })).toHaveAttribute('aria-pressed', 'true');
});
