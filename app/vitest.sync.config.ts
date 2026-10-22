import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests de synchro (§17) : moteur réel + fake-indexeddb + Supabase local (`npx supabase start`).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/sync/**/*.test.ts'],
    globalSetup: ['tests/sync/globalSetup.ts'],
    setupFiles: ['tests/sync/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
