// Types de mesure : champs saisis, colonnes et séries de travail (§F7.2, §F7.4).
import type { Equipment, MeasurementType, SetKind, Settings, WorkoutSet } from './types';

export type SetField = 'weight' | 'reps' | 'duration' | 'distance';

export const FIELDS: Record<MeasurementType, SetField[]> = {
  weight_reps: ['weight', 'reps'],
  bodyweight: ['reps'],
  weighted_bw: ['weight', 'reps'],
  assisted_bw: ['weight', 'reps'],
  duration: ['duration'],
  weight_duration: ['weight', 'duration'],
  distance_duration: ['distance', 'duration'],
};

// Cette méthode permet d'obtenir les champs saisis (et obligatoires) pour un type de mesure.
export function fieldsFor(type: MeasurementType): SetField[] {
  return FIELDS[type];
}

// Cette méthode permet de savoir si un type de mesure se saisit en répétitions (et a donc une fourchette de reps).
export function hasReps(type: MeasurementType): boolean {
  return FIELDS[type].includes('reps');
}

// Cette méthode permet de savoir si un type de mesure a des objectifs de progression en V1 (§F7.10).
export function hasTargets(type: MeasurementType): boolean {
  return type !== 'weight_duration' && type !== 'distance_duration';
}

// Cette méthode permet de savoir si une série est une série de travail (normale ou à l'échec).
export function isWorkingKind(kind: SetKind): boolean {
  return kind === 'normal' || kind === 'failure';
}

// Cette méthode permet de savoir si une série compte pour les records et le volume (tout sauf l'échauffement).
export function countsForRecords(kind: SetKind): boolean {
  return kind !== 'warmup';
}

// Cette méthode permet de lister les champs obligatoires encore vides d'une série.
export function missingFields(set: WorkoutSet, type: MeasurementType): SetField[] {
  const value: Record<SetField, number | undefined> = {
    weight: set.weight?.v,
    reps: set.reps,
    duration: set.durationS,
    distance: set.distance?.v,
  };
  return FIELDS[type].filter((f) => {
    const v = value[f];
    return v === undefined || !Number.isFinite(v);
  });
}

// Cette méthode permet d'obtenir l'intitulé de colonne d'un champ selon le type de mesure et les unités (« +kg », « Reps »…).
export function columnLabel(field: SetField, type: MeasurementType, units: Settings['units']): string {
  switch (field) {
    case 'weight':
      if (type === 'weighted_bw') return `+${units.weight}`;
      if (type === 'assisted_bw') return `−${units.weight}`;
      return units.weight;
    case 'reps':
      return 'Reps';
    case 'duration':
      return 'Temps';
    case 'distance':
      return units.distance;
  }
}

// Convention de saisie (issue #99) : aux haltères et aux kettlebells, on saisit le poids d'une seule pièce.
const PER_PIECE: Partial<Record<Equipment, string>> = { dumbbell: 'haltère', kettlebell: 'kettlebell' };

// Cette méthode permet d'obtenir la pièce dont on saisit le poids (« haltère », « kettlebell ») lorsque la charge
// est une charge libre en plusieurs pièces et que le type de mesure se saisit en poids total ; undefined sinon.
export function weightPerPiece(equipment: Equipment | undefined, type: MeasurementType): string | undefined {
  if (!equipment || (type !== 'weight_reps' && type !== 'weight_duration')) return undefined;
  return PER_PIECE[equipment];
}

// Cette méthode permet d'obtenir l'unité de charge suivie de la convention de saisie (« kg / haltère », sinon « kg »).
export function weightUnitLabel(
  equipment: Equipment | undefined,
  type: MeasurementType,
  unit: Settings['units']['weight'],
): string {
  const piece = weightPerPiece(equipment, type);
  return piece ? `${unit} / ${piece}` : unit;
}

// Cette méthode permet d'obtenir les intitulés de toutes les colonnes de saisie d'un type de mesure.
export function columnLabels(type: MeasurementType, units: Settings['units']): string[] {
  return FIELDS[type].map((f) => columnLabel(f, type, units));
}

// Cette méthode permet de ne garder que les valeurs pertinentes d'une série pour un type de mesure (copie de « Précédent »).
export function pickValues(
  set: Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance'>,
  type: MeasurementType,
): Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance'> {
  const out: Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance'> = {};
  for (const f of FIELDS[type]) {
    if (f === 'weight' && set.weight) out.weight = { ...set.weight };
    if (f === 'reps' && set.reps !== undefined) out.reps = set.reps;
    if (f === 'duration' && set.durationS !== undefined) out.durationS = set.durationS;
    if (f === 'distance' && set.distance) out.distance = { ...set.distance };
  }
  return out;
}

// Valeurs de RPE proposées à la saisie (effort ressenti, 6 à 10 par demi-point).
export const RPE_VALUES: readonly number[] = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

// Cette méthode permet de valider un RPE saisi ou importé : arrondi au demi-point, undefined hors de 6–10.
export function normalizeRpe(v: number | undefined): number | undefined {
  if (v === undefined || !Number.isFinite(v)) return undefined;
  const r = Math.round(v * 2) / 2;
  return r >= 6 && r <= 10 ? r : undefined;
}
