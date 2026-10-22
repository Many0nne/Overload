import { describe, expect, it } from 'vitest';
import { estimateClockSkew, formatClockSkew, isClockSkewed } from './clock';

describe('décalage d’horloge', () => {
  it('place l’heure serveur au milieu de l’aller-retour', () => {
    expect(estimateClockSkew(1000, 1400, 1200)).toBe(0);
    expect(estimateClockSkew(1000, 1400, 1200 - 420_000)).toBe(420_000);
  });

  it('ne signale qu’au-delà de 5 min, dans les deux sens', () => {
    expect(isClockSkewed(null)).toBe(false);
    expect(isClockSkewed(300_000)).toBe(false);
    expect(isClockSkewed(300_001)).toBe(true);
    expect(isClockSkewed(-360_000)).toBe(true);
  });

  it('formule l’écart en minutes ou en heures', () => {
    expect(formatClockSkew(420_000)).toBe('en avance de 7 min');
    expect(formatClockSkew(-(2 * 3600 + 5 * 60) * 1000)).toBe('en retard de 2 h 05');
  });
});
