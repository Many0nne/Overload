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
