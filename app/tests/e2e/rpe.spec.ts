import {
  admin,
  BENCH,
  checkSet,
  expect,
  localWorkoutDoc,
  login,
  setRow,
  skipRest,
  startRoutine,
  test,
} from './fixtures';

test('RPE : colonne dédiée, feuille de saisie, valeur enregistrée puis effacée, ligne à hauteur fixe', async ({
  page,
  seeded,
}) => {
  const { error } = await admin()
    .from('profiles')
    .update({ settings: { rpeEnabled: true } })
    .eq('id', seeded.account.userId);
  expect(error).toBeNull();
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);
  const workoutId = page.url().split('/').pop()!;

  const row = setRow(page, BENCH.name, 0);
  const rpe = row.getByRole('button', { name: 'Saisir le RPE' });
  await expect(page.locator('.ex', { hasText: BENCH.name }).locator('th', { hasText: 'RPE' })).toBeVisible();
  // Série non validée : la case RPE est inactive.
  await expect(rpe).toBeDisabled();
  const height = (await row.boundingBox())!.height;

  await checkSet(page, BENCH.name, 0);
  await skipRest(page);
  // Valider ne doit pas ouvrir la feuille ni changer la hauteur de la ligne (pastilles en surimpression).
  await expect(page.locator('.rpe-sheet')).toHaveCount(0);
  expect((await row.boundingBox())!.height).toBe(height);

  await rpe.click();
  const sheet = page.locator('.rpe-sheet');
  await expect(sheet).toContainText(/Série 1 : 60\s?kg × \d+/);
  await sheet.getByRole('button', { name: '8,5', exact: true }).click();
  await expect(sheet.locator('.rpe-big')).toHaveText('8,5');
  await expect(sheet).toContainText("J'aurais pu faire 1 à 2 reps de plus");
  await sheet.getByRole('button', { name: 'Terminé' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'RPE 8,5, modifier' })).toHaveText('8,5');
  await expect
    .poll(async () => (await localWorkoutDoc(page, workoutId))?.exercises[0]?.sets[0]?.rpe)
    .toBe(8.5);

  await row.getByRole('button', { name: 'RPE 8,5, modifier' }).click();
  await sheet.getByRole('button', { name: 'Effacer le RPE' }).click();
  await expect(sheet.locator('.rpe-big')).toHaveText('–');
  await sheet.getByRole('button', { name: 'Terminé' }).click();
  await expect(rpe).toBeEnabled();
});
