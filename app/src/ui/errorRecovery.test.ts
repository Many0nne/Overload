import { describe, expect, it } from 'vitest';
import { CHUNK_RELOAD_GUARD_MS, isChunkLoadError, shouldReloadForChunk } from './errorRecovery';

describe('isChunkLoadError', () => {
  it('reconnaît les messages des trois moteurs', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/Home-abc.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError('Unable to preload CSS for /assets/x.css')).toBe(true);
  });

  it('ignore les autres erreurs', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'sets')"))).toBe(
      false,
    );
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('shouldReloadForChunk', () => {
  it('recharge la première fois, puis plus pendant le délai de garde', () => {
    expect(shouldReloadForChunk(null, 1_000)).toBe(true);
    expect(shouldReloadForChunk(1_000, 1_000 + CHUNK_RELOAD_GUARD_MS)).toBe(false);
    expect(shouldReloadForChunk(1_000, 1_001 + CHUNK_RELOAD_GUARD_MS)).toBe(true);
  });
});
