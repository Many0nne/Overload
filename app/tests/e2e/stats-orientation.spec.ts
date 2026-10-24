import { expect, login, test } from './fixtures';

// Cette méthode permet de mesurer le calendrier des statistiques : largeur de la grille et de son conteneur,
// nombre de colonnes réellement affichées, taille de la première pastille et débordement horizontal.
async function measureCalendar(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const cal = document.querySelector('.cal') as HTMLElement;
    const card = cal.closest('.card') as HTMLElement;
    const cells = [...cal.querySelectorAll<HTMLElement>('.c')];
    const calRect = cal.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const cols = new Set(
      [...cal.querySelectorAll<HTMLElement>('.h')].map((h) => Math.round(h.getBoundingClientRect().left)),
    );
    const first = cells[0]!.getBoundingClientRect();
    const last = [...cal.querySelectorAll<HTMLElement>('.h')].at(-1)!.getBoundingClientRect();
    return {
      calWidth: Math.round(calRect.width),
      cardWidth: Math.round(cardRect.width),
      columns: cols.size,
      cell: Math.round(first.width),
      // la dernière colonne (D) doit finir dans le conteneur
      lastRight: Math.round(last.right),
      cardRight: Math.round(cardRect.right),
    };
  });
}

// Cette méthode permet de vérifier que le calendrier suit la largeur disponible après un passage paysage → portrait (#23).
test('statistiques : le calendrier revient à son rendu après paysage puis portrait', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await page.goto('/profile/stats');
  await expect(page.locator('.cal .c').first()).toBeVisible();

  const portrait = page.viewportSize()!;
  const initial = await measureCalendar(page);
  expect(initial.columns).toBe(7);
  expect(initial.calWidth).toBeLessThanOrEqual(initial.cardWidth);
  expect(initial.lastRight).toBeLessThanOrEqual(initial.cardRight);

  await page.setViewportSize({ width: portrait.height, height: portrait.width });
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(portrait.height);
  const landscape = await measureCalendar(page);
  expect(landscape.columns).toBe(7);
  expect(landscape.lastRight).toBeLessThanOrEqual(landscape.cardRight);
  // la pastille suit la largeur de la grille (7 colonnes, 6 gouttières de 6 px)
  expect(Math.abs(landscape.cell - (landscape.calWidth - 36) / 7)).toBeLessThanOrEqual(1);

  await page.setViewportSize(portrait);
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(portrait.width);
  await expect.poll(() => measureCalendar(page)).toEqual(initial);
});
