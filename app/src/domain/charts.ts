// Séries de points des graphiques par exercice (§F7.6). Valeurs canoniques : kg, reps, s, km, s/km.
import { type Period, periodStart } from './dates';
import { criteriaFor, e1rm, type RecordCriterion, recordSets, sortWorkouts } from './records';
import type { MeasurementType, WorkoutRow, WorkoutSet } from './types';
import { toKg, toKm } from './units';
import { setVolumeKg } from './volume';

export type ChartMetric =
  | 'e1rm'
  | 'max_weight'
  | 'session_volume'
  | 'best_set_volume'
  | 'total_reps'
  | 'max_reps'
  | 'min_assistance'
  | 'max_duration'
  | 'total_duration'
  | 'max_distance'
  | 'total_distance'
  | 'best_pace';

export type ChartUnit = 'kg' | 'reps' | 's' | 'km' | 's_per_km';

export const CHART_METRIC_LABELS: Record<ChartMetric, string> = {
  e1rm: '1RM estimé',
  max_weight: 'Charge max',
  session_volume: 'Volume de séance',
  best_set_volume: 'Meilleure série',
  total_reps: 'Total de reps',
  max_reps: 'Reps max',
  min_assistance: 'Assistance min',
  max_duration: 'Durée max',
  total_duration: 'Durée totale',
  max_distance: 'Distance max',
  total_distance: 'Distance totale',
  best_pace: 'Meilleure allure',
};

export const CHART_METRIC_UNITS: Record<ChartMetric, ChartUnit> = {
  e1rm: 'kg',
  max_weight: 'kg',
  session_volume: 'kg',
  best_set_volume: 'kg',
  total_reps: 'reps',
  max_reps: 'reps',
  min_assistance: 'kg',
  max_duration: 's',
  total_duration: 's',
  max_distance: 'km',
  total_distance: 'km',
  best_pace: 's_per_km',
};

const METRICS: Record<MeasurementType, ChartMetric[]> = {
  weight_reps: ['e1rm', 'max_weight', 'session_volume', 'best_set_volume', 'total_reps'],
  bodyweight: ['max_reps', 'total_reps'],
  weighted_bw: ['max_weight', 'best_set_volume', 'max_reps', 'total_reps'],
  assisted_bw: ['min_assistance', 'max_reps', 'total_reps'],
  duration: ['max_duration', 'total_duration'],
  weight_duration: ['max_weight', 'max_duration', 'total_duration'],
  distance_duration: ['max_distance', 'max_duration', 'best_pace', 'total_distance', 'total_duration'],
};

// Cette méthode permet d'obtenir les courbes proposées pour un type de mesure (la première est celle par défaut).
export function chartMetricsFor(type: MeasurementType): ChartMetric[] {
  return METRICS[type];
}

const maxOf = (vals: (number | undefined)[]) => {
  const v = vals.filter((x): x is number => x !== undefined);
  return v.length ? Math.max(...v) : undefined;
};
const minOf = (vals: (number | undefined)[]) => {
  const v = vals.filter((x): x is number => x !== undefined);
  return v.length ? Math.min(...v) : undefined;
};
const sumOf = (vals: (number | undefined)[]) => {
  const v = vals.filter((x): x is number => x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) : undefined;
};

function metricValue(metric: ChartMetric, sets: WorkoutSet[], type: MeasurementType): number | undefined {
  const kgOf = (s: WorkoutSet) =>
    s.weight && (s.reps === undefined || s.reps > 0) ? toKg(s.weight) : undefined;
  switch (metric) {
    case 'e1rm':
      return maxOf(
        sets.map((s) => (s.weight && s.reps !== undefined ? e1rm(toKg(s.weight), s.reps) : undefined)),
      );
    case 'max_weight':
      return maxOf(sets.map(kgOf));
    case 'min_assistance':
      return minOf(sets.map(kgOf));
    case 'session_volume':
      return sumOf(sets.map((s) => setVolumeKg(s, type)));
    case 'best_set_volume':
      return maxOf(sets.map((s) => setVolumeKg(s, type) || undefined));
    case 'total_reps':
      return sumOf(sets.map((s) => s.reps));
    case 'max_reps':
      return maxOf(sets.map((s) => s.reps));
    case 'max_duration':
      return maxOf(sets.map((s) => s.durationS));
    case 'total_duration':
      return sumOf(sets.map((s) => s.durationS));
    case 'max_distance':
      return maxOf(sets.map((s) => (s.distance ? toKm(s.distance) : undefined)));
    case 'total_distance':
      return sumOf(sets.map((s) => (s.distance ? toKm(s.distance) : undefined)));
    case 'best_pace':
      return minOf(
        sets.map((s) =>
          s.distance && s.durationS && toKm(s.distance) > 0 ? s.durationS / toKm(s.distance) : undefined,
        ),
      );
  }
}

// Cette méthode permet de calculer la courbe d'un exercice : un point par séance terminée sur la période choisie.
export function exerciseSeries(
  exerciseId: string,
  workouts: WorkoutRow[],
  metric: ChartMetric,
  period: Period,
  now: number,
): { t: number; v: number; workoutId: string }[] {
  const from = periodStart(period, now);
  const out: { t: number; v: number; workoutId: string }[] = [];
  for (const w of sortWorkouts(workouts)) {
    if (w.status !== 'completed' || w.started_at < from) continue;
    const entries = w.doc.exercises.filter((e) => e.exerciseId === exerciseId);
    const first = entries[0];
    if (!first) continue;
    const v = metricValue(metric, entries.flatMap(recordSets), first.measurementType);
    if (v !== undefined) out.push({ t: w.started_at, v, workoutId: w.id });
  }
  return out;
}

// Cette méthode permet de savoir quel critère de record correspond à une courbe (pour signaler le record sur le graphique).
export function criterionForMetric(metric: ChartMetric, type: MeasurementType): RecordCriterion | undefined {
  const map: Partial<Record<ChartMetric, RecordCriterion>> = {
    e1rm: 'best_e1rm',
    max_weight: 'max_weight',
    best_set_volume: 'best_set_volume',
    max_reps: 'max_reps',
    min_assistance: 'min_assistance',
    max_duration: 'max_duration',
    max_distance: 'max_distance',
    best_pace: 'best_pace',
  };
  const c = map[metric];
  return c && criteriaFor(type).some((d) => d.id === c) ? c : undefined;
}
