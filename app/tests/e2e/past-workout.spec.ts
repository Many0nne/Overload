import { expect, login, test } from './fixtures';

// Cette méthode permet de vérifier que les champs Date, Début et Durée de la séance passée tiennent dans l'écran
// sans se chevaucher : Date sur sa ligne, Début et Durée côte à côte en dessous (#24).
test('séance passée : les champs Date / Début / Durée ne se superposent pas', async ({ page, seeded }) => {
  await login(page, seeded.account);
  await page.goto('/seance/past');
  await expect(page.locator('input[type="date"]')).toBeVisible();

  const boxes = await page.evaluate(() => {
    const rect = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    return {
      date: rect('input[type="date"]'),
      time: rect('input[type="time"]'),
      duration: rect('input[inputmode="numeric"]'),
      viewport: document.documentElement.clientWidth,
    };
  });

  for (const box of [boxes.date, boxes.time, boxes.duration]) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(boxes.viewport);
  }
  expect(boxes.time.top).toBeGreaterThanOrEqual(boxes.date.bottom);
  expect(boxes.time.right).toBeLessThanOrEqual(boxes.duration.left);
  expect(Math.round(boxes.time.top)).toBe(Math.round(boxes.duration.top));
});
