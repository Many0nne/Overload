import crypto from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { readSupabaseConfig } from '../supabaseEnv';
import { type Account, admin, createAccount } from './fixtures';

// Page de consentement du connecteur Claude (docs/spec-mcp.md §5.4) : connexion, approbation, refus, avertissement
// boucle locale. La demande d'autorisation est créée par Supabase local (DCR puis /oauth/authorize).

const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';

// Cette méthode permet d'enregistrer un client OAuth et d'ouvrir une demande d'autorisation ; renvoie son id.
async function authorization(redirect = CLAUDE, name = 'Claude'): Promise<{ id: string; clientId: string }> {
  const { url } = readSupabaseConfig();
  const reg = (await (
    await fetch(`${url}/auth/v1/oauth/clients/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: name,
        redirect_uris: [redirect],
        token_endpoint_auth_method: 'none',
      }),
    })
  ).json()) as { client_id: string };
  const challenge = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('base64url');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: reg.client_id,
    redirect_uri: redirect,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'etat',
    scope: 'email',
  });
  const res = await fetch(`${url}/auth/v1/oauth/authorize?${params}`, { redirect: 'manual' });
  const id = new URL(res.headers.get('location')!).searchParams.get('authorization_id')!;
  return { id, clientId: reg.client_id };
}

// Cette méthode permet d'ouvrir la page de consentement et de s'y connecter.
async function openAndLogin(page: Page, account: Account, id: string) {
  await page.route('https://claude.ai/**', (r) => r.fulfill({ status: 200, body: 'Claude' }));
  await page.goto(`/oauth/consent?authorization_id=${id}`);
  await page.getByLabel('E-mail').fill(account.email);
  await page.getByLabel('Mot de passe').fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('connexion puis approbation en lecture seule : retour vers Claude avec un code', async ({ page }) => {
  const account = await createAccount();
  const { id, clientId } = await authorization();
  await openAndLogin(page, account, id);
  await expect(page.getByText("demande l'accès à ton compte Overload")).toBeVisible();
  await expect(page.getByTestId('consent-host')).toHaveText('claude.ai');
  const box = page.getByRole('checkbox', { name: 'Autoriser Claude à modifier mes données' });
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.getByRole('button', { name: 'Autoriser' }).click();
  await page.waitForURL(/claude\.ai\/api\/mcp\/auth_callback\?code=/);
  const { data } = await admin()
    .from('mcp_connections')
    .select('can_write, client_name')
    .eq('user_id', account.userId)
    .eq('client_id', clientId)
    .single();
  expect(data).toEqual({ can_write: false, client_name: 'Claude' });
});

test('refus : retour vers Claude avec access_denied', async ({ page }) => {
  const account = await createAccount();
  const { id } = await authorization();
  await openAndLogin(page, account, id);
  await page.getByRole('button', { name: 'Refuser' }).click();
  await page.waitForURL(/claude\.ai\/api\/mcp\/auth_callback\?.*error=access_denied/);
});

test('boucle locale (Claude Code) : avertissement affiché', async ({ page }) => {
  const account = await createAccount();
  const { id } = await authorization('http://localhost:33418/callback', 'Claude Code');
  await openAndLogin(page, account, id);
  await expect(page.getByTestId('consent-host')).toHaveText('localhost');
  await expect(
    page.getByText('Ne continue que si tu viens de lancer Claude Code sur cet ordinateur.'),
  ).toBeVisible();
});

test('lien invalide : message explicite, sans page d’installation', async ({ page }) => {
  await page.goto('/oauth/consent');
  await expect(page.getByText("Lien d'autorisation incomplet")).toBeVisible();
});
