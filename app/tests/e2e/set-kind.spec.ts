import { BENCH, expect, localWorkoutDoc, login, setRow, startRoutine, test } from './fixtures';

test('Nature de série : le numéro ouvre un sélecteur, un choix enregistre et referme', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);
  const workoutId = page.url().split('/').pop()!;

  const kindButton = setRow(page, BENCH.name, 1).getByRole('button', {
    name: 'Changer la nature de la série',
  });
  await expect(kindButton).toHaveText('2');
  await kindButton.click();
  const sheet = page.locator('.kind-sheet');
  await expect(sheet.locator('.kind-opt')).toHaveCount(4);
  await expect(sheet.getByRole('button', { name: /Normale/ })).toHaveAttribute('aria-pressed', 'true');

  await sheet.getByRole('button', { name: /Échauffement/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(kindButton).toHaveText('É');
  await expect
    .poll(async () => (await localWorkoutDoc(page, workoutId))?.exercises[0]?.sets[1]?.kind)
    .toBe('warmup');

  // Le badge « Normale » montre le numéro que reprendrait la série ; Échap referme sans rien changer.
  await kindButton.click();
  await expect(sheet.getByRole('button', { name: /Normale/ })).toContainText('2');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(kindButton).toHaveText('É');
});
