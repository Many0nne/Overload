import { describe, expect, it } from 'vitest';
import { BODY_BACK, BODY_FRONT } from '@/data/bodyMap.generated';
import { bodyHighlights, MUSCLE_ZONES, thumbnailSide } from './bodyMap';
import { MUSCLES } from './labels';

describe('bodyHighlights', () => {
  it('colore le principal et les secondaires', () => {
    const h = bodyHighlights('chest', ['triceps', 'shoulders']);
    expect(h.get('chest')).toBe('primary');
    expect(h.get('triceps')).toBe('secondary');
    expect(h.get('deltoids')).toBe('secondary');
    expect(h.has('biceps')).toBe(false);
  });

  it('donne la priorité au principal sur une zone partagée', () => {
    const h = bodyHighlights('shoulders', ['back']);
    expect(h.get('rotatorCuff')).toBe('primary');
    expect(h.get('upperBack')).toBe('secondary');
  });

  it('ne colore rien pour le cardio', () => {
    expect(bodyHighlights('cardio', []).size).toBe(0);
  });
});

describe('thumbnailSide', () => {
  it('montre le dos pour les muscles postérieurs', () => {
    expect(thumbnailSide('hamstrings')).toBe('back');
    expect(thumbnailSide('chest')).toBe('front');
  });
});

describe('MUSCLE_ZONES', () => {
  it('ne référence que des zones dessinées', () => {
    const drawn = new Set([...BODY_FRONT.parts, ...BODY_BACK.parts].map((p) => p.slug));
    for (const m of MUSCLES) for (const z of MUSCLE_ZONES[m]) expect(drawn).toContain(z);
  });

  it('dessine chaque muscle (hors cardio) sur la vue de sa miniature', () => {
    for (const m of MUSCLES) {
      if (m === 'cardio') continue;
      const view = thumbnailSide(m) === 'back' ? BODY_BACK : BODY_FRONT;
      const slugs = new Set(view.parts.map((p) => p.slug));
      expect(MUSCLE_ZONES[m].some((z) => slugs.has(z))).toBe(true);
    }
  });
});
