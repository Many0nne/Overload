import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RPE_VALUES } from '@/domain/measurement';
import { rpeColor } from './rpeColor';

const css = readFileSync(new URL('./styles/tokens.css', import.meta.url), 'utf8');
const key = (v: number) => String(v).replace('.', '-');

// Cette méthode permet de lire le bloc d'un thème dans tokens.css.
function block(theme: 'dark' | 'light'): string {
  return css.split(`[data-theme="${theme}"] {`)[1]!.split('}')[0]!;
}
const token = (blk: string, name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(blk);
  if (!m) throw new Error(`token --${name} absent`);
  return m[1]!;
};
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const luminance = (c: number[]) => {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
// Fond teinté : 18 % de la couleur pleine sur le fond (cf. .rpe-tint).
const tint = (fill: number[], bg: number[]) => fill.map((x, i) => Math.round(x * 0.18 + bg[i]! * 0.82));

describe('rpeColor', () => {
  it('associe chaque valeur de RPE à ses variables de couleur', () => {
    for (const v of RPE_VALUES) {
      expect(rpeColor(v)).toEqual({
        '--rpe-fill': `var(--rpe-${key(v)})`,
        '--rpe-ink': `var(--rpe-${key(v)}-ink)`,
        '--rpe-on': `var(--rpe-${key(v)}-on)`,
      });
    }
  });

  it('arrondit au demi-point comme le domaine', () => {
    expect(rpeColor(7.3)).toEqual(rpeColor(7.5));
  });

  it('ne colore ni une valeur absente ni une valeur hors 6–10', () => {
    expect(rpeColor(undefined)).toBeUndefined();
    expect(rpeColor(5.5)).toBeUndefined();
    expect(rpeColor(10.5)).toBeUndefined();
  });

  for (const theme of ['dark', 'light'] as const) {
    it(`définit les tokens de chaque valeur avec un contraste WCAG AA (thème ${theme})`, () => {
      const blk = block(theme);
      const bgs = ['bg', 'surface', 'surface-2'].map((n) => rgb(token(blk, n)));
      for (const v of RPE_VALUES) {
        const fill = rgb(token(blk, `rpe-${key(v)}`));
        const ink = rgb(token(blk, `rpe-${key(v)}-ink`));
        const on = rgb(token(blk, `rpe-${key(v)}-on`));
        expect(contrast(on, fill), `texte sur fond plein, RPE ${v}`).toBeGreaterThanOrEqual(4.5);
        for (const bg of bgs)
          expect(contrast(ink, tint(fill, bg)), `chiffre sur fond teinté, RPE ${v}`).toBeGreaterThanOrEqual(
            4.5,
          );
      }
    });
  }
});
