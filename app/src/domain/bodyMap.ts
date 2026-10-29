// Correspondance entre les muscles de l'app et les zones de la carte musculaire (tracés MuscleMap).
import type { Muscle } from './types';

export type Highlight = 'primary' | 'secondary';
export type HeatLevel = 'h1' | 'h2' | 'h3' | 'h4';
export type BodySide = 'front' | 'back';

// Zones dessinées pour chaque muscle de l'app. Le cardio n'en a aucune (silhouette neutre).
export const MUSCLE_ZONES: Record<Muscle, readonly string[]> = {
  chest: ['chest'],
  back: ['upperBack', 'rhomboids', 'rotatorCuff'],
  shoulders: ['deltoids', 'rotatorCuff'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  abs: ['abs', 'obliques', 'serratus'],
  quads: ['quadriceps', 'adductors'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves', 'tibialis'],
  traps: ['trapezius'],
  lower_back: ['lowerBack'],
  cardio: [],
};

// Zones visibles uniquement quand elles sont colorées (posées par-dessus une autre zone).
export const OVERLAY_ZONES: ReadonlySet<string> = new Set(['rhomboids']);

// Muscles mieux visibles de dos : la miniature montre alors le dos plutôt que la face.
const BACK_MUSCLES: ReadonlySet<Muscle> = new Set([
  'back',
  'triceps',
  'hamstrings',
  'glutes',
  'calves',
  'traps',
  'lower_back',
]);

// Cette méthode permet de calculer la couleur de chaque zone lorsqu'on affiche les muscles d'un exercice.
// Le muscle principal l'emporte sur un muscle secondaire qui partage la même zone.
export function bodyHighlights(primary: Muscle, secondary: readonly Muscle[]): Map<string, Highlight> {
  const map = new Map<string, Highlight>();
  for (const m of secondary) for (const z of MUSCLE_ZONES[m]) map.set(z, 'secondary');
  for (const z of MUSCLE_ZONES[primary]) map.set(z, 'primary');
  return map;
}

// Cette méthode permet de choisir la vue (face ou dos) de la miniature selon le muscle principal.
export function thumbnailSide(primary: Muscle): BodySide {
  return BACK_MUSCLES.has(primary) ? 'back' : 'front';
}

// Cette méthode permet de colorer la carte musculaire des statistiques selon une répartition par muscle : 4 niveaux
// proportionnels au muscle le plus sollicité (h4) ; une zone partagée par deux muscles prend le niveau le plus haut.
export function heatHighlights(dist: Partial<Record<Muscle, number>>): Map<string, HeatLevel> {
  const max = Math.max(0, ...Object.values(dist));
  const map = new Map<string, HeatLevel>();
  if (max <= 0) return map;
  for (const [m, v] of Object.entries(dist) as [Muscle, number][]) {
    if (v <= 0) continue;
    const level = Math.min(4, Math.max(1, Math.ceil((4 * v) / max)));
    for (const z of MUSCLE_ZONES[m]) {
      const prev = Number(map.get(z)?.slice(1) ?? 0);
      if (level > prev) map.set(z, `h${level}` as HeatLevel);
    }
  }
  return map;
}
