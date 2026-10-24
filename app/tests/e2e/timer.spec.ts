import type { Page } from '@playwright/test';
import { BENCH, checkSet, expect, login, startRoutine, test } from './fixtures';

// Cette méthode permet de lire le temps restant affiché par le minuteur (« 1:30 » → 90 s).
function seconds(text: string): number {
  const [m, s] = text.trim().split(':').map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
}

// Cette méthode permet de faire sauter l'horloge de la page sans exécuter les minuteries (onglet gelé, veille),
// puis de laisser passer un court instant réel pour que l'affichage se rafraîchisse.
async function jumpClock(page: Page, ms: number): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(now + ms);
  await page.clock.runFor(300);
}

test('minuteur de repos juste après un saut d’horloge (veille, appareil en poche)', async ({
  page,
  seeded,
}) => {
  await page.clock.install();
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);

  await checkSet(page, BENCH.name, 0);
  const time = page.locator('.rest-panel .time');
  await expect(time).toHaveText(/^1:(30|29|28)$/);

  // Saut de 60 s : l'affichage se recale sur l'heure réelle.
  await jumpClock(page, 60_000);
  await expect.poll(async () => seconds((await time.textContent()) ?? '')).toBeLessThanOrEqual(30);
  expect(seconds((await time.textContent()) ?? '')).toBeGreaterThanOrEqual(25);

  // Saut au-delà de la fin : « Terminé » tout de suite, puis le panneau se ferme.
  await jumpClock(page, 60_000);
  await expect(time).toHaveText('Terminé');
  await page.clock.runFor(3500);
  await expect(page.locator('.rest-panel')).toHaveCount(0);
});

// Cette méthode permet de simuler le passage de l'app en arrière-plan ou au premier plan (visibilitychange).
async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

test('minuteur écoulé pendant l’absence : ne réapparaît pas au retour dans l’app', async ({
  page,
  seeded,
}) => {
  await page.clock.install();
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);

  await checkSet(page, BENCH.name, 0);
  await expect(page.locator('.rest-panel .time')).toHaveText(/^1:(30|29|28)$/);

  // L'app passe en arrière-plan, le repos s'écoule, puis l'utilisateur revient : pas de décompte ni de « Terminé ».
  await setVisibility(page, 'hidden');
  await jumpClock(page, 120_000);
  await setVisibility(page, 'visible');
  await page.clock.runFor(300);
  await expect(page.locator('.rest-panel')).toHaveCount(0);
});

test('minuteur écoulé app fermée : pas restauré au relancement', async ({ page, seeded }) => {
  await page.clock.install();
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);

  await checkSet(page, BENCH.name, 0);
  await expect(page.locator('.rest-panel .time')).toHaveText(/^1:(30|29|28)$/);

  // L'app est suspendue puis relancée par le système après l'échéance.
  await setVisibility(page, 'hidden');
  await jumpClock(page, 120_000);
  await page.reload();
  await expect(page.locator('.ex')).toHaveCount(2);
  await page.clock.runFor(300);
  await expect(page.locator('.rest-panel')).toHaveCount(0);
});

test('minuteur de repos : −15 s / +15 s, puis « Terminé » à l’écran fermé par « OK »', async ({
  page,
  seeded,
}) => {
  await page.clock.install();
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);

  await checkSet(page, BENCH.name, 0);
  const panel = page.locator('.rest-panel');
  const time = panel.locator('.time');
  await expect(time).toHaveText(/^1:(30|29|28)$/);

  await panel.getByRole('button', { name: 'Ajouter 15 secondes' }).click();
  await expect(time).toHaveText(/^1:(45|44|43)$/);
  await panel.getByRole('button', { name: 'Retirer 15 secondes' }).click();
  await panel.getByRole('button', { name: 'Retirer 15 secondes' }).click();
  await expect(time).toHaveText(/^1:(15|14|13)$/);

  // Fin vécue à l'écran : état « Terminé » (vert), « Passer » devient « OK » et ferme tout de suite.
  await jumpClock(page, 80_000);
  await expect(time).toHaveText('Terminé');
  await expect(panel).toHaveClass(/\bend\b/);
  await expect(panel.getByRole('button', { name: 'Ajouter 15 secondes' })).toBeDisabled();
  await panel.getByRole('button', { name: 'OK' }).click();
  await expect(panel).toHaveCount(0);
});

test('minuteur de repos : la pilule ne masque pas le bas de la séance', async ({ page, seeded }) => {
  await login(page, seeded.account);
  await startRoutine(page, seeded.routineName);

  await checkSet(page, BENCH.name, 0);
  const panel = page.locator('.rest-panel');
  await expect(panel).toBeVisible();

  // Défilement tout en bas : le dernier bouton de la page reste entièrement au-dessus de la pilule.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = page.getByRole('button', { name: 'Abandonner' });
  await expect(last).toBeInViewport();
  const lastBox = await last.boundingBox();
  const panelBox = await panel.boundingBox();
  if (!lastBox || !panelBox) throw new Error('boîtes introuvables');
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(panelBox.y);
  expect(panelBox.height).toBeLessThanOrEqual(70);
});
