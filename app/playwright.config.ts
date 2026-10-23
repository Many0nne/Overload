import { fileURLToPath, URL } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';
import { readSupabaseConfig } from './tests/supabaseEnv';

// E2E (§17) : build de production servi par `vite preview` (service worker actif), contre Supabase local.
// La configuration Supabase est lue une fois ici et transmise aux workers par l'environnement.
const supabase = readSupabaseConfig();
process.env.SUPABASE_URL = supabase.url;
process.env.SUPABASE_ANON_KEY = supabase.anonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = supabase.serviceKey;

// Port de la preview : 4173, ou E2E_PORT de app/.env.local (fixé par scripts/overload-worktree.ps1 dans un worktree).
const { E2E_PORT } = loadEnv('production', fileURLToPath(new URL('.', import.meta.url)), 'E2E_');
const PORT = Number(process.env.E2E_PORT ?? E2E_PORT ?? 4173);
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/globalSetup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects: [
    // WebKit (moteur de Safari iOS) est nettement plus lent, surtout sous Windows : peu d'instances à la fois.
    { name: 'webkit', use: { ...devices['iPhone 15'] }, workers: 2 },
    { name: 'chromium', use: { ...devices['iPhone 15'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: supabase.url,
      VITE_SUPABASE_ANON_KEY: supabase.anonKey,
      VITE_VAPID_PUBLIC_KEY: '',
    },
  },
});
