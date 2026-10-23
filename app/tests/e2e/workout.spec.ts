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

test('modifier un poids puis valider : 2 touchers et la saisie (§F9, 3 au plus)', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);
  const row = setRow(page, BENCH.name, 0);
  const weight = row.getByRole('textbox', { name: 'Poids' });

  await weight.tap(); // 1er toucher : le champ s'ouvre sur le pavé numérique, valeur sélectionnée
  await expect(weight).toHaveAttribute('inputmode', 'decimal');
  await page.keyboard.type('62,5');
  await row.getByRole('button', { name: 'Valider la série' }).tap(); // 2e toucher
  await expect(row).toHaveClass(/\bdone\b/);
  await expect(weight).toHaveValue('62,5');
  await expect(row.getByRole('textbox', { name: 'Répétitions' })).toHaveAttribute('inputmode', 'numeric');
});

test("note d'exercice : la zone s'étend sans défiler, bornée à 280 caractères (issue #30)", async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);
  const note = page.locator('.ex', { hasText: BENCH.name }).locator('.ex-note textarea');
  const before = await note.evaluate((el) => el.clientHeight);

  await note.fill('Coudes serrés, descente lente, pause marquée sur la poitrine. '.repeat(6));
  await note.dispatchEvent('input');
  const box = await note.evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight, len: el.value.length }));
  expect(box.h).toBeGreaterThan(before);
  expect(box.sh).toBeLessThanOrEqual(box.h + 1); // tout le texte visible, pas de défilement interne
  expect(box.len).toBe(280);
  await expect(page.locator('.ex', { hasText: BENCH.name }).locator('.note-count')).toHaveText('280/280');
});
