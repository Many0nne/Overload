import type { Settings, WeightUnit } from './types';

// ---------- Calculateur de disques (issue #76) ----------

/** Barre et disques disponibles pour une unité (poids dans cette unité ; disques triés du plus lourd au plus léger). */
export type PlateSet = { bar: number; plates: number[] };
export type PlateSettings = Record<WeightUnit, PlateSet>;

/** Disques proposés dans les paramètres ; ceux de DEFAULT_PLATES sont activés par défaut. */
export const PLATE_CHOICES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5],
  lb: [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25],
};

/** Poids de barre proposés dans les paramètres. */
export const BAR_CHOICES: Record<WeightUnit, number[]> = {
  kg: [5, 7, 10, 12, 15, 20, 25],
  lb: [15, 20, 25, 35, 45, 55],
};

export const DEFAULT_PLATES: PlateSettings = {
  kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
};

/** Au-delà, on ne calcule plus (saisie aberrante) : la barre reste vide et tout part en reste. */
const MAX_TOTAL = 2000;

// Cette méthode permet de lire la barre et les disques de l'utilisateur pour une unité, avec les valeurs par défaut.
export function plateSetFor(settings: Pick<Settings, 'plates'>, unit: WeightUnit): PlateSet {
  const s = settings.plates?.[unit];
  if (!s) return DEFAULT_PLATES[unit];
  return { bar: s.bar, plates: [...s.plates].sort((a, b) => b - a) };
}

export type BarLoad = {
  /** Disques d'un côté, du plus lourd (contre la butée) au plus léger. */
  perSide: number[];
  /** Charge réellement chargée (barre + 2 × disques). */
  loaded: number;
  /** Charge demandée impossible à atteindre avec ces disques (0 si exacte). */
  rest: number;
  /** Charge demandée inférieure au poids de la barre. */
  belowBar: boolean;
};

// Cette méthode permet de calculer le PGCD de deux entiers positifs (pas commun des disques).
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// Cette méthode permet de trouver les disques à mettre de chaque côté pour une charge totale : la plus grande charge
// atteignable sans dépasser la demande, avec le moins de disques possible (programmation dynamique, exacte même sans 5 kg).
export function loadBar(total: number, set: PlateSet): BarLoad {
  const bar = set.bar;
  if (!(total >= bar) || total > MAX_TOTAL) {
    return { perSide: [], loaded: bar, rest: 0, belowBar: total < bar };
  }
  // Calcul en centièmes, réduit au PGCD des disques pour garder des tableaux courts.
  const raw = set.plates.map((p) => Math.round(p * 100)).filter((p) => p > 0);
  const side = Math.round(((total - bar) / 2) * 100);
  if (raw.length === 0 || side === 0) return finish([], total, bar);
  const step = raw.reduce(gcd);
  const units = [...new Set(raw.map((p) => p / step))].sort((a, b) => b - a);
  const target = Math.floor(side / step);
  const count = new Array<number>(target + 1).fill(Number.POSITIVE_INFINITY);
  count[0] = 0;
  for (let v = 1; v <= target; v++) {
    for (const p of units) {
      if (p <= v && count[v - p]! + 1 < count[v]!) count[v] = count[v - p]! + 1;
    }
  }
  let v = target;
  while (count[v] === Number.POSITIVE_INFINITY) v--;
  const perSide: number[] = [];
  while (v > 0) {
    // Disque le plus lourd qui garde une décomposition optimale.
    const p = units.find((u) => u <= v && count[v - u]! + 1 === count[v])!;
    perSide.push((p * step) / 100);
    v -= p;
  }
  return finish(perSide, total, bar);
}

// Cette méthode permet de compléter le résultat du calcul : charge chargée et reste, arrondis au centième.
function finish(perSide: number[], total: number, bar: number): BarLoad {
  const loaded = Math.round((bar + 2 * perSide.reduce((s, p) => s + p, 0)) * 100) / 100;
  return { perSide, loaded, rest: Math.round((total - loaded) * 100) / 100, belowBar: false };
}

// Cette méthode permet de regrouper les disques d'un côté pour l'affichage (« 2 × 20 + 2,5 » → [{20, 2}, {2,5, 1}]).
export function groupPlates(perSide: number[]): { plate: number; count: number }[] {
  const out: { plate: number; count: number }[] = [];
  for (const p of perSide) {
    const last = out.at(-1);
    if (last && last.plate === p) last.count++;
    else out.push({ plate: p, count: 1 });
  }
  return out;
}

// Cette méthode permet de calculer le pas du réglage − / + du calculateur : deux fois le plus petit disque disponible.
export function plateStep(set: PlateSet): number {
  const min = Math.min(...set.plates);
  return Number.isFinite(min) ? Math.round(min * 2 * 100) / 100 : 1;
}
