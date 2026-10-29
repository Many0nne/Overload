import { expect, login, test } from './fixtures';

// Cette méthode permet de vérifier les 4 vues des statistiques (#103) sur l'historique seedé (une séance « Push E2E » il y a
// 3 jours, 6 séries) : Aperçu par défaut, vue et période communes gardées dans l'URL, états vides des seuils et du RPE désactivé.
test('statistiques : quatre vues, période commune gardée dans l’URL, états vides', async ({
  page,
  seeded,
}) => {
  await login(page, seeded.account);
  await page.goto('/profile/stats');

  // Aperçu : totaux depuis le début, 30 derniers jours, histogramme et calendrier ; pas de sélecteur de période.
  const totals = page.locator('.st-totals');
  await expect(totals).toBeVisible({ timeout: 15_000 });
  await expect(totals).toContainText('1séance');
  await expect(totals).toContainText(/2\s?016 kg/);
  await expect(page.locator('.st-kpi', { hasText: 'Séances' })).toContainText('pas de période précédente');
  await expect(page.getByRole('img', { name: 'Séances par semaine' })).toBeVisible();
  await expect(page.locator('.cal .c.on')).toHaveCount(1);
  await expect(page.locator('.chip')).toHaveCount(0);

  // Muscles : carte colorée et séries par muscle ; la période choisie passe dans l'URL.
  await page.getByRole('button', { name: 'Muscles', exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/stats\?vue=muscles$/);
  await expect(page.getByRole('img', { name: /Carte des muscles/ })).toBeVisible();
  await expect(page.locator('.hbar', { hasText: 'Pectoraux' })).toBeVisible();
  await page.getByRole('button', { name: '3 mois' }).click();
  await expect(page).toHaveURL(/vue=muscles&periode=3m$/);

  // Progrès : la période reste celle choisie ; records et objectifs.
  await page.getByRole('button', { name: 'Progrès' }).click();
  await expect(page).toHaveURL(/vue=progres&periode=3m$/);
  await expect(page.getByRole('button', { name: '3 mois' })).toHaveClass(/\bon\b/);
  await expect(page.getByText('Objectifs à long terme')).toBeVisible();

  // Séances : 1 séance sur 3 → zones de reps en attente ; RPE désactivé par défaut → renvoi vers les paramètres.
  await page.getByRole('button', { name: 'Séances', exact: true }).first().click();
  await expect(page).toHaveURL(/vue=seances&periode=3m$/);
  await expect(page.locator('.st-kpi', { hasText: 'Durée moyenne' })).toContainText('1 h');
  await expect(page.getByText('Encore 2 séances')).toBeVisible();
  await expect(page.locator('.st-row', { hasText: seeded.routineName })).toContainText('1 séance');
  await expect(page.getByText(/RPE désactivé/)).toBeVisible();

  // Le retour sur la page restaure la vue et la période depuis l'URL.
  await page.reload();
  await expect(page.getByText('Encore 2 séances')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '3 mois' })).toHaveClass(/\bon\b/);
});
