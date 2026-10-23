import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

// La copie du domaine embarquée par l'Edge Function `mcp` doit suivre src/domain (npm run edge:domain).
describe("copie du domaine pour l'Edge Function", () => {
  it('est à jour', () => {
    const script = fileURLToPath(new URL('../../scripts/build-edge-domain.mjs', import.meta.url));
    expect(() => execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});
