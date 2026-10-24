import { BENCH, expect, login, startRoutine, test } from './fixtures';

// Sans service worker, page.route voit toutes les requêtes (le précache les servirait sinon sans passer par le réseau).
test.use({ serviceWorkers: 'block' });

test('doc de séance inattendu : écran de secours au lieu d’un écran blanc, erreur journalisée', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);
  const workoutId = page.url().split('/').pop() ?? '';

  // Donnée venue d'ailleurs (autre appareil, connecteur, import) qui ne respecte pas le format attendu.
  await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('overload');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workouts', 'readwrite');
      const store = tx.objectStore('workouts');
      const get = store.get(id);
      get.onsuccess = () => store.put({ ...get.result, doc: { ...get.result.doc, exercises: {} } });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, workoutId);
  await page.reload();

  const crash = page.getByRole('alert');
  await expect(crash).toContainText('Cet écran a rencontré un problème');
  await expect(crash).toContainText("Ta séance n'est pas perdue");

  // Retour à l'accueil : la page s'affiche, le bandeau fautif est simplement masqué.
  await crash.getByRole('button', { name: "Retour à l'accueil" }).click();
  await expect(page.getByRole('link', { name: 'Accueil' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.banner')).toHaveCount(0);

  await page.goto('/profile/settings/errors');
  await expect(page.locator('.page')).toContainText('TypeError');
});

test('chunk lazy introuvable : un seul rechargement automatique, puis l’écran de secours', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await page.route(/\/assets\/ExercisePage-[^/]+\.js$/, (route) => route.abort());
  let documentLoads = 0;
  page.on('request', (req) => {
    if (req.resourceType() === 'document') documentLoads++;
  });

  await page.goto(`/exercise/${BENCH.id}`);
  await expect(page.getByRole('alert')).toContainText('Cet écran a rencontré un problème');
  expect(documentLoads).toBe(2);
  // Les onglets restent utilisables : seule la page est remplacée.
  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
