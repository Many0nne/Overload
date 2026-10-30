import type { CSSProperties } from 'react';
import { normalizeRpe } from '@/domain/measurement';

// Cette méthode permet d'obtenir les variables de couleur d'un RPE (fond plein, chiffre, texte sur fond plein) lorsqu'on
// l'affiche : à poser en `style` sur l'élément, les classes `.rpe-tint` / `.rpe-solid` les consomment. undefined hors 6–10.
export function rpeColor(rpe: number | undefined): CSSProperties | undefined {
  const v = normalizeRpe(rpe);
  if (v === undefined) return undefined;
  const key = String(v).replace('.', '-');
  return {
    '--rpe-fill': `var(--rpe-${key})`,
    '--rpe-ink': `var(--rpe-${key}-ink)`,
    '--rpe-on': `var(--rpe-${key}-on)`,
  } as CSSProperties;
}
