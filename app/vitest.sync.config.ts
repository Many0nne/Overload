import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests de synchro (§17) et du connecteur Claude (docs/spec-mcp.md §10) : moteur réel + fake-indexeddb + Supabase local.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/sync/**/*.test.ts', 'tests/mcp/**/*.test.ts'],
    globalSetup: ['tests/sync/globalSetup.ts'],
    setupFiles: ['tests/sync/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
