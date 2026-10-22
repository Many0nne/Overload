import { type Browser, type BrowserContext, test as base, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { v7 as uuidv7 } from 'uuid';
import type { RoutineDoc, WorkoutDoc, WorkoutRow } from '@/domain/types';
import { readSupabaseConfig } from '../supabaseEnv';

// Exercices du catalogue (seed.sql) utilisés par les scénarios, tous en « poids et reps ».
export const BENCH = { id: 'eee64d46-7f94-5743-ad72-c90d587e50a0', name: 'Développé couché (barre)' };
export const DB_BENCH = { id: '36a8e69b-4e25-50d7-bba4-213e41e0f9b9', name: 'Développé couché (haltères)' };

const SEED_DEVICE = '22222222-2222-7222-8222-222222222222';
const DAY_MS = 86_400_000;

export type Account = { userId: string; email: string; password: string };
export type Seeded = { account: Account; routineId: string; routineName: string };
type ServerWorkout = Pick<WorkoutRow, 'id' | 'status' | 'doc' | 'owner_device_id'>;

let adminClient: SupabaseClient | undefined;

// Cette méthode permet d'obtenir un client service_role (RLS contournée) pour préparer et vérifier les données.
export function admin(): SupabaseClient {
  const { url, serviceKey } = readSupabaseConfig();
  adminClient ??= createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return adminClient;
}

// Cette méthode permet de lever une erreur lisible lorsqu'un appel de préparation échoue.
function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what} : ${res.error.message}`);
  return res.data;
}

// Cette méthode permet de créer un compte confirmé avec son profil, sans passer par l'écran d'inscription.
export async function createAccount(): Promise<Account> {
  const email = `e2e-${uuidv7()}@overload.test`;
  const password = 'motdepasse-e2e-1';
  const created = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error(`createUser : ${created.error.message}`);
  const { user } = created.data;
  must(
    await admin().rpc('admin_create_profile', {
      p_user_id: user.id,
      p_display_name: 'Paul',
      p_settings: {},
      p_is_admin: false,
    }),
    'admin_create_profile',
  );
  return { userId: user.id, email, password };
}

// Cette méthode permet de créer la routine « Push E2E » (2 exercices × 3 séries, 90 s de repos, 6 à 10 reps)
// et une séance terminée il y a 3 jours, qui sert de « dernière fois » pour calculer les objectifs du jour.
export async function seedRoutineWithHistory(account: Account): Promise<Seeded> {
  const routineId = uuidv7();
  const routineName = 'Push E2E';
  const now = Date.now();
  const routineDoc: RoutineDoc = {
    schemaVersion: 1,
    name: routineName,
    exercises: [BENCH, DB_BENCH].map((ex) => ({
      id: uuidv7(),
      exerciseId: ex.id,
      restS: 90,
      repRange: { min: 6, max: 10 },
      sets: [0, 1, 2].map(() => ({ id: uuidv7(), kind: 'normal' as const })),
    })),
  };
  must(
    await admin().from('routines').insert({
      id: routineId,
      user_id: account.userId,
      folder_id: null,
      position: 0,
      doc: routineDoc,
      client_updated_at: now,
      client_device_id: SEED_DEVICE,
    }),
    'insert routine',
  );

  const startedAt = now - 3 * DAY_MS;
  const workoutDoc: WorkoutDoc = {
    schemaVersion: 1,
    title: `${routineName} – ancienne`,
    durationS: 3600,
    exercises: [
      { ex: BENCH, kg: 60 },
      { ex: DB_BENCH, kg: 24 },
    ].map(({ ex, kg }, i) => ({
      id: uuidv7(),
      exerciseId: ex.id,
      measurementType: 'weight_reps' as const,
      restS: 90,
      repRange: { min: 6, max: 10 },
      sets: [0, 1, 2].map((j) => ({
        id: uuidv7(),
        kind: 'normal' as const,
        weight: { v: kg, u: 'kg' as const },
        reps: 8,
        done: true,
        doneAt: startedAt + (i * 3 + j + 1) * 180_000,
      })),
    })),
  };
  must(
    await admin()
      .from('workouts')
      .insert({
        id: uuidv7(),
        user_id: account.userId,
        status: 'completed',
        owner_device_id: SEED_DEVICE,
        routine_id: routineId,
        started_at: new Date(startedAt).toISOString(),
        exercise_ids: [BENCH.id, DB_BENCH.id],
        doc: workoutDoc,
        client_updated_at: now,
        client_device_id: SEED_DEVICE,
      }),
    'insert workout',
  );
  return { account, routineId, routineName };
}

// Cette méthode permet de lire côté serveur les séances du compte, hors séance de départ (vérification de la synchro).
export async function serverWorkouts(seeded: Seeded): Promise<ServerWorkout[]> {
  const rows = must(
    await admin()
      .from('workouts')
      .select('id, status, doc, owner_device_id')
      .eq('user_id', seeded.account.userId)
      .is('deleted_at', null),
    'select workouts',
  ) as ServerWorkout[];
  return rows.filter((w) => !w.doc.title.endsWith('– ancienne'));
}

// Cette méthode permet de compter les séries validées d'une séance (toutes séries confondues).
export function doneSets(w: Pick<WorkoutRow, 'doc'>): number {
  return w.doc.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

// Cette méthode permet de préparer un contexte comme un iPhone dans Safari déjà « accepté » (pas de page d'installation).
export async function prepareContext(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => sessionStorage.setItem('browser-ok', '1'));
}

// Cette méthode permet d'ouvrir un second appareil : nouveau contexte, donc base locale et device_id distincts.
export async function newDevice(browser: Browser): Promise<Page> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId, baseURL } =
    base.info().project.use;
  const context = await browser.newContext({
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    locale,
    timezoneId,
    baseURL,
  });
  await prepareContext(context);
  return context.newPage();
}

// Cette méthode permet de se connecter par l'écran de connexion et d'attendre l'accueil (première synchro faite).
// Le premier lancement remplit le catalogue local avant tout rendu : plusieurs secondes sous WebKit, d'où le délai large.
export async function login(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await expect(page.getByLabel('E-mail')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('E-mail').fill(account.email);
  await page.getByLabel('Mot de passe').fill(account.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('link', { name: 'Accueil' })).toBeVisible({ timeout: 30_000 });
}

// Cette méthode permet d'attendre que l'app soit disponible hors ligne, comme une PWA déjà installée :
// service worker actif (précache terminé), puis rechargement pour que la page passe sous son contrôle.
export async function waitForOfflineReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByRole('link', { name: 'Accueil' })).toBeVisible();
}

// Cette méthode permet de démarrer la routine depuis l'onglet Séance et d'attendre l'écran de séance.
export async function startRoutine(page: Page, routineName: string): Promise<void> {
  await page.getByRole('link', { name: 'Séance' }).click();
  await page
    .locator('.card.routine', { hasText: routineName })
    .getByRole('button', { name: 'Démarrer' })
    .click();
  await expect(page).toHaveURL(/\/workout\/[0-9a-f-]+$/);
  await expect(page.locator('.ex')).toHaveCount(2);
}

// Cette méthode permet de cibler la ligne d'une série (0 = première) d'un exercice de la séance.
export function setRow(page: Page, exerciseName: string, index: number) {
  return page.locator('.ex', { hasText: exerciseName }).locator('tr.set').nth(index);
}

// Cette méthode permet de valider une série d'un seul toucher et de vérifier qu'elle passe en « faite ».
export async function checkSet(page: Page, exerciseName: string, index: number): Promise<void> {
  const row = setRow(page, exerciseName, index);
  await row.getByRole('button', { name: 'Valider la série' }).click();
  await expect(row).toHaveClass(/\bdone\b/);
}

// Cette méthode permet de fermer le minuteur de repos lorsqu'il est affiché, pour libérer le bas de l'écran.
export async function skipRest(page: Page): Promise<void> {
  const skip = page.locator('.rest-panel').getByRole('button', { name: 'Passer' });
  if (await skip.isVisible()) await skip.click();
}

// Cette méthode permet de valider toutes les séries de la routine seedée, un toucher par série.
export async function checkAllSets(page: Page): Promise<void> {
  for (const ex of [BENCH, DB_BENCH]) {
    for (let i = 0; i < 3; i++) {
      await checkSet(page, ex.name, i);
      await skipRest(page);
    }
  }
}

// Chaque test a son propre compte (isolation, exécution parallèle) et un contexte iPhone prêt.
export const test = base.extend<{ seeded: Seeded }>({
  context: async ({ context }, use) => {
    await prepareContext(context);
    await use(context);
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright exige la déstructuration des fixtures
  seeded: async ({}, use) => {
    await use(await seedRoutineWithHistory(await createAccount()));
  },
});

export { expect };
