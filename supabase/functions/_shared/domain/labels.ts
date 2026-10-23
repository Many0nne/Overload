// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Libellés français des énumérations du domaine (§F7.2, §F7.4, §F7.8).
import type { Equipment, MeasurementType, Muscle, SetKind, TrainingAgeBucket } from './types.ts';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Avant-bras',
  abs: 'Abdos',
  quads: 'Quadriceps',
  hamstrings: 'Ischios',
  glutes: 'Fessiers',
  calves: 'Mollets',
  traps: 'Trapèzes',
  lower_back: 'Lombaires',
  cardio: 'Cardio',
};

export const MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  machine: 'Machine',
  cable: 'Poulie',
  bodyweight: 'Poids du corps',
  kettlebell: 'Kettlebell',
  band: 'Bande élastique',
  other: 'Autre',
};

export const EQUIPMENTS = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  weight_reps: 'Poids et répétitions',
  bodyweight: 'Poids du corps',
  weighted_bw: 'Poids du corps lesté',
  assisted_bw: 'Poids du corps assisté',
  duration: 'Durée',
  weight_duration: 'Poids et durée',
  distance_duration: 'Distance et durée',
};

export const MEASUREMENT_TYPES = Object.keys(MEASUREMENT_LABELS) as MeasurementType[];

// Lettre affichée à la place du numéro de série ('' pour une série normale).
export const SET_KIND_SHORT: Record<SetKind, string> = { normal: '', warmup: 'É', drop: 'D', failure: 'X' };

export const SET_KIND_LABELS: Record<SetKind, string> = {
  normal: 'Normale',
  warmup: 'Échauffement',
  drop: 'Dégressive',
  failure: 'Échec',
};

export const TRAINING_AGE_LABELS: Record<TrainingAgeBucket, string> = {
  none: 'Je débute',
  lt6m: 'Moins de 6 mois',
  '6to12m': '6 mois à 1 an',
  '1to2y': '1 à 2 ans',
  '2to5y': '2 à 5 ans',
  gt5y: 'Plus de 5 ans',
};

export const TRAINING_AGE_BUCKETS = Object.keys(TRAINING_AGE_LABELS) as TrainingAgeBucket[];

// Cette méthode permet d'obtenir le libellé affiché d'une série (« 3 » pour la 3ᵉ série normale, « É » pour un échauffement).
export function setLabel(kind: SetKind, normalIndex: number): string {
  return kind === 'normal' ? String(normalIndex) : SET_KIND_SHORT[kind];
}

// Cette méthode permet de numéroter les séries d'un exercice comme à l'écran : seules les séries non-échauffement sont numérotées.
export function setLabels(kinds: SetKind[]): string[] {
  let n = 0;
  return kinds.map((k) => {
    if (k === 'warmup') return SET_KIND_SHORT.warmup;
    n += 1;
    return k === 'normal' ? String(n) : SET_KIND_SHORT[k];
  });
}
