import { admin, expect, login, serverWorkouts, test } from './fixtures';

const WORKOUTS = [
  '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"',
  '"Push HEVY","22 oct. 2025, 16:50","22 oct. 2025, 17:38","","Échauffement",,"",0,"normal",,,,90,',
  '"Push HEVY","22 oct. 2025, 16:50","22 oct. 2025, 17:38","","Développé Couché (Barre)",,"",0,"normal",60,8,,,',
  '"Push HEVY","22 oct. 2025, 16:50","22 oct. 2025, 17:38","","Développé Couché (Barre)",,"",1,"dropset",40,10,,,',
  '"Push HEVY","22 oct. 2025, 16:50","22 oct. 2025, 17:38","","Butterfly Poulie Un Bras",,"",0,"normal",12.5,16,,,',
  '"Pull HEVY","20 oct. 2025, 18:00","20 oct. 2025, 19:00","Long","Tractions",,"",0,"normal",,10,,,',
].join('\n');

const MEASUREMENTS = '"date","weight_kg","fat_percent"\n"24 oct. 2025, 00:00",65,14\n';

// Cette méthode permet de choisir les deux fichiers d'export HEVY dans l'écran d'import.
async function chooseFiles(page: import('@playwright/test').Page) {
  await page.getByTestId('hevy-files').setInputFiles([
    { name: 'workout_data.csv', mimeType: 'text/csv', buffer: Buffer.from(WORKOUTS) },
    { name: 'measurement_data.csv', mimeType: 'text/csv', buffer: Buffer.from(MEASUREMENTS) },
  ]);
}

test('import HEVY : correspondance des exercices, séances et mesures synchronisées, réimport sans doublon', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await page.goto('/profile/settings');
  await page.getByRole('button', { name: /Importer depuis HEVY/ }).click();
  await chooseFiles(page);

  await expect(page.getByText('2 nouvelles séances')).toBeVisible();
  await expect(page.getByText('1 mesure à enregistrer')).toBeVisible();
  // Nom exact du catalogue retrouvé ; exercice inconnu proposé en exercice perso.
  await expect(page.locator('.lib-item', { hasText: 'Développé Couché (Barre)' })).toContainText(
    'Développé couché (barre)',
  );
  await expect(page.locator('.lib-item', { hasText: 'Butterfly Poulie Un Bras' })).toContainText(
    'Nouvel exercice perso',
  );

  // L'échauffement est ignoré.
  await page.locator('.lib-item', { hasText: 'Échauffement' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Ignorer cet exercice' }).click();
  await expect(page.locator('.lib-item', { hasText: 'Échauffement' })).toContainText('Ignoré');

  await page.getByRole('button', { name: 'Importer 2 séances' }).click();
  await expect(page.getByText('Import terminé')).toBeVisible();
  await expect(
    page.getByText(/2 séances importées · 1 exercice perso créé · 1 mesure enregistrée/),
  ).toBeVisible();

  // La synchro pousse les séances terminées, l'exercice perso et la mesure.
  await expect
    .poll(async () => (await serverWorkouts(seeded)).map((w) => w.doc.title).sort(), { timeout: 20_000 })
    .toEqual(['Pull HEVY', 'Push HEVY']);
  const push = (await serverWorkouts(seeded)).find((w) => w.doc.title === 'Push HEVY')!;
  expect(push.status).toBe('completed');
  expect(push.doc.exercises).toHaveLength(2);
  expect(push.doc.exercises[0]!.sets.map((s) => s.kind)).toEqual(['normal', 'drop']);
  const { data: measures } = await admin()
    .from('body_measurements')
    .select('measured_on, values')
    .eq('user_id', seeded.account.userId);
  expect(measures).toEqual([
    { measured_on: '2025-10-24', values: { weight: { v: 65, u: 'kg' }, body_fat: 14 } },
  ]);

  // Réimport du même export : rien de nouveau.
  await page.goto('/profile/settings/import-hevy');
  await chooseFiles(page);
  await expect(page.getByText('0 nouvelle séance')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rien à importer' })).toBeDisabled();
});
