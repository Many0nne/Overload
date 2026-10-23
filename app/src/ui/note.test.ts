import { describe, expect, it } from 'vitest';
import { noteCounter } from './note';

describe('noteCounter', () => {
  it('reste masqué sous 80 % de la limite', () => {
    expect(noteCounter(0, 280)).toBeNull();
    expect(noteCounter(223, 280)).toBeNull();
  });

  it("s'affiche à partir de 80 % de la limite", () => {
    expect(noteCounter(224, 280)).toBe('224/280');
    expect(noteCounter(280, 280)).toBe('280/280');
  });
});
