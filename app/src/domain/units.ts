// Conversions et affichage des unités (§F7.8, §10.1). Les valeurs sont stockées dans l'unité de saisie.
import type { Distance, DistanceUnit, Length, LengthUnit, Weight, WeightUnit } from './types';

export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;
export const CM_PER_IN = 2.54;

// Cette méthode permet de convertir une charge en kg, sans arrondi.
export function toKg(w: Weight): number {
  return w.u === 'kg' ? w.v : w.v * KG_PER_LB;
}

// Cette méthode permet de convertir une distance en km, sans arrondi.
export function toKm(d: Distance): number {
  return d.u === 'km' ? d.v : d.v * KM_PER_MI;
}

// Cette méthode permet de convertir une longueur en cm, sans arrondi.
export function toCm(l: Length): number {
  return l.u === 'cm' ? l.v : l.v * CM_PER_IN;
}

// Cette méthode permet d'exprimer une charge dans l'unité voulue, sans arrondi.
export function weightIn(w: Weight, unit: WeightUnit): number {
  if (w.u === unit) return w.v;
  return unit === 'kg' ? w.v * KG_PER_LB : w.v / KG_PER_LB;
}

// Cette méthode permet d'exprimer une valeur en kg dans l'unité de poids voulue, sans arrondi.
export function kgTo(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

// Cette méthode permet d'exprimer une distance dans l'unité voulue, sans arrondi.
export function distanceIn(d: Distance, unit: DistanceUnit): number {
  if (d.u === unit) return d.v;
  return unit === 'km' ? d.v * KM_PER_MI : d.v / KM_PER_MI;
}

// Cette méthode permet d'exprimer une valeur en km dans l'unité de distance voulue, sans arrondi.
export function kmTo(km: number, unit: DistanceUnit): number {
  return unit === 'km' ? km : km / KM_PER_MI;
}

// Cette méthode permet d'exprimer une longueur dans l'unité voulue, sans arrondi.
export function lengthIn(l: Length, unit: LengthUnit): number {
  if (l.u === unit) return l.v;
  return unit === 'cm' ? l.v * CM_PER_IN : l.v / CM_PER_IN;
}

const fmt1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const fmtExact = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

// Cette méthode permet de formater un nombre à la française, arrondi au dixième par défaut, sans zéro inutile.
export function formatNumber(n: number, maxFractionDigits = 1): string {
  if (maxFractionDigits === 1) return fmt1.format(n);
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: maxFractionDigits }).format(n);
}

// Cette méthode permet d'afficher une valeur saisie : telle quelle dans son unité, sinon convertie et arrondie au dixième.
export function displayValue(
  value: number,
  unitIn: string,
  unitOut: string,
  convert: (v: number) => number,
): string {
  if (unitIn === unitOut) return fmtExact.format(value);
  return fmt1.format(convert(value));
}

// Cette méthode permet d'afficher le nombre d'une charge dans l'unité de l'utilisateur (« 220,5 » pour 100 kg en lb).
export function displayWeightNumber(w: Weight, unit: WeightUnit): string {
  return displayValue(w.v, w.u, unit, () => weightIn(w, unit));
}

// Cette méthode permet d'afficher le nombre d'une distance dans l'unité de l'utilisateur.
export function displayDistanceNumber(d: Distance, unit: DistanceUnit): string {
  return displayValue(d.v, d.u, unit, () => distanceIn(d, unit));
}

// Cette méthode permet d'afficher le nombre d'une longueur dans l'unité de l'utilisateur.
export function displayLengthNumber(l: Length, unit: LengthUnit): string {
  return displayValue(l.v, l.u, unit, () => lengthIn(l, unit));
}

// Cette méthode permet de lire un nombre décimal saisi avec une virgule ou un point ; undefined si la saisie est invalide.
export function parseDecimal(input: string): number | undefined {
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// Cette méthode permet de lire un nombre entier positif saisi (reps) ; undefined si la saisie est invalide.
export function parseInteger(input: string): number | undefined {
  const s = input.trim();
  if (!/^\d+$/.test(s)) return undefined;
  return Number(s);
}

// Cette méthode permet de supprimer le bruit flottant d'un calcul (ex. 82,49999999 → 82,5).
export function clean(n: number, digits = 6): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// Cette méthode permet d'arrondir une valeur au multiple inférieur d'un pas (baisses de charge des objectifs).
export function floorTo(value: number, step: number): number {
  if (step <= 0) return value;
  return clean(Math.floor(clean(value / step, 9)) * step);
}

// Cette méthode permet d'arrondir une valeur au multiple supérieur d'un pas.
export function ceilTo(value: number, step: number): number {
  if (step <= 0) return value;
  return clean(Math.ceil(clean(value / step, 9)) * step);
}
