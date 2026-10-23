// Constantes heuristiques des objectifs (§F7.10), centralisées pour le recalibrage prévu par la Q8.
import type { Equipment, RepRange, WeightUnit } from './types';

// Reprise : [semaines d'arrêt franchies, baisse de charge]. La dernière tranche franchie s'applique.
export const COMEBACK_STEPS: readonly (readonly [number, number])[] = [
  [4, 0.05],
  [8, 0.1],
  [12, 0.15],
  [16, 0.2],
];

// Au-delà de ce nombre de semaines sans l'exercice, on est en reprise.
export const COMEBACK_MIN_WEEKS = 4;

// Reprise en poids du corps : baisse des reps.
export const BODYWEIGHT_COMEBACK_DROP = 0.1;

// Plateau : baisse de charge.
export const PLATEAU_DROP = 0.1;

// Plateau : nombre de séances consécutives sous min, et fenêtre de comparaison des totaux de reps.
export const PLATEAU_FAIL_SESSIONS = 2;
export const PLATEAU_STALL_SESSIONS = 3;

// Effort ressenti (RPE 6–10 de la dernière série de travail) : à 7 ou moins, l'effort est facile
// (double incrément en montée de charge, +2 reps sinon) ; à 10, le maximum atteint est consolidé une fois avant de monter.
export const RPE_EASY_MAX = 7;
export const RPE_MAX = 10;
export const RPE_EASY_LOAD_STEPS = 2;
export const RPE_EASY_REPS_STEP = 2;

// Durée : hausse relative, pas d'arrondi et hausse minimale (secondes).
export const DURATION_STEP = 0.05;
export const DURATION_ROUND_S = 5;
export const DURATION_MIN_GAIN_S = 5;

// Tendance projetée : gain maximal par mois, en fraction du 1RM estimé actuel.
export const TREND_MAX_MONTHLY = 0.04;
export const TREND_MIN_POINTS = 6;
export const TREND_MIN_SPAN_WEEKS = 8;
export const TREND_HORIZON_WEEKS = 12;
export const GOAL_HORIZON_WEEKS = 52;

// Fourchette par défaut (ACSM, débutants).
export const DEFAULT_REP_RANGE: RepRange = { min: 8, max: 12 };

// Domaine d'ajustement de la formule de Marzagao.
export const MARZAGAO_MAX_REPS = 30;

// Incréments par défaut selon l'équipement et l'unité (§F7.10).
export const DEFAULT_INCREMENTS: Record<Equipment, Record<WeightUnit, number>> = {
  barbell: { kg: 2.5, lb: 5 },
  dumbbell: { kg: 2, lb: 5 },
  kettlebell: { kg: 2, lb: 5 },
  machine: { kg: 5, lb: 10 },
  cable: { kg: 5, lb: 10 },
  bodyweight: { kg: 2.5, lb: 5 },
  band: { kg: 2.5, lb: 5 },
  other: { kg: 2.5, lb: 5 },
};
