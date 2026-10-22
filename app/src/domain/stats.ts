// Statistiques globales (§F7.6, §10.6) : agrégats hebdomadaires, muscles, calendrier, série de semaines, mesures.
import { addWeeks, dayKey, parseDayKey, weekStart } from './dates';
import { workoutDurationS } from './summary';
import type { BodyMeasurementKey, BodyMeasurementRow, Muscle, WorkoutRow } from './types';
import { toCm, toKg } from './units';
import { workoutVolumeKg } from './volume';

const active = (w: WorkoutRow) => w.deleted_at === null && w.status === 'completed';

export type WeekAggregate = { weekStart: number; count: number; durationS: number; volumeKg: number };

// Cette méthode permet de calculer séances, durée et volume par semaine sur les n dernières semaines (semaines vides comprises).
export function weeklyAggregates(workouts: WorkoutRow[], now: number, weeks = 12): WeekAggregate[] {
  const current = weekStart(now);
  const out: WeekAggregate[] = [];
  const index = new Map<number, WeekAggregate>();
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addWeeks(current, -i);
    const agg = { weekStart: ws, count: 0, durationS: 0, volumeKg: 0 };
    out.push(agg);
    index.set(ws, agg);
  }
  for (const w of workouts) {
    if (!active(w)) continue;
    const agg = index.get(weekStart(w.started_at));
    if (!agg) continue;
    agg.count++;
    agg.durationS += workoutDurationS(w, w.started_at);
    agg.volumeKg += workoutVolumeKg(w.doc);
  }
  return out;
}

export type MuscleInfo = { primary_muscle: Muscle; secondary_muscles: Muscle[] };

// Cette méthode permet de répartir les séries validées (hors échauffement) par muscle : 1 pour le principal, 0,5 par secondaire.
export function muscleDistribution(
  workouts: WorkoutRow[],
  muscles: (exerciseId: string) => MuscleInfo | undefined,
  from: number,
  to: number,
): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const w of workouts) {
    if (!active(w) || w.started_at < from || w.started_at >= to) continue;
    for (const we of w.doc.exercises) {
      const info = muscles(we.exerciseId);
      if (!info) continue;
      const n = we.sets.filter((s) => s.done && s.kind !== 'warmup').length;
      if (!n) continue;
      out[info.primary_muscle] = (out[info.primary_muscle] ?? 0) + n;
      for (const m of info.secondary_muscles) out[m] = (out[m] ?? 0) + n * 0.5;
    }
  }
  return out;
}

// Cette méthode permet d'obtenir les jours d'entraînement (« AAAA-MM-JJ » du jour de début de chaque séance).
export function trainingDays(workouts: WorkoutRow[]): Set<string> {
  const out = new Set<string>();
  for (const w of workouts) if (active(w)) out.add(dayKey(w.started_at));
  return out;
}

// Cette méthode permet de compter les semaines consécutives avec au moins une séance, en partant de la semaine précédente.
// La semaine en cours s'ajoute si elle contient une séance, et ne casse pas la série sinon.
export function weekStreak(workouts: WorkoutRow[], now: number): number {
  const weeks = new Set<number>();
  for (const w of workouts) if (active(w)) weeks.add(weekStart(w.started_at));
  const current = weekStart(now);
  let streak = weeks.has(current) ? 1 : 0;
  let ws = addWeeks(current, -1);
  while (weeks.has(ws)) {
    streak++;
    ws = addWeeks(ws, -1);
  }
  return streak;
}

// Cette méthode permet d'obtenir les jours de la semaine en cours (lundi → dimanche) avec ou sans séance (résumé de l'accueil).
export function currentWeekDays(
  workouts: WorkoutRow[],
  now: number,
): { day: string; trained: boolean; today: boolean }[] {
  const days = trainingDays(workouts);
  const start = weekStart(now);
  const today = dayKey(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = dayKey(d.getTime());
    return { day: key, trained: days.has(key), today: key === today };
  });
}

// Cette méthode permet d'obtenir la série d'une mesure corporelle (valeurs canoniques : kg, %, cm), par date croissante.
export function measurementSeries(
  rows: BodyMeasurementRow[],
  key: BodyMeasurementKey,
): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  for (const r of rows) {
    if (r.deleted_at !== null) continue;
    const raw = r.values[key];
    if (raw === undefined) continue;
    let v: number;
    if (typeof raw === 'number') v = raw;
    else if (key === 'weight') v = toKg(raw as { v: number; u: 'kg' | 'lb' });
    else v = toCm(raw as { v: number; u: 'cm' | 'in' });
    out.push({ t: parseDayKey(r.measured_on), v });
  }
  return out.sort((a, b) => a.t - b.t);
}
