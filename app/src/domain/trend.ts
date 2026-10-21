// Tendance projetée du 1RM estimé et objectif à long terme (§F7.10, §10.8).
import { addMonths, localDiff, MONTH_MS, WEEK_MS, weekStart } from './dates';
import { isWorkingKind } from './measurement';
import {
  GOAL_HORIZON_WEEKS,
  TREND_HORIZON_WEEKS,
  TREND_MAX_MONTHLY,
  TREND_MIN_POINTS,
  TREND_MIN_SPAN_WEEKS,
} from './progressionConfig';
import { e1rm, sortWorkouts } from './records';
import type { ExercisePrefsDoc, Settings, TrainingAgeBucket, WorkoutRow } from './types';
import { toKg } from './units';

export type TrendPoint = { weekStart: number; e1rmKg: number };
export type Trend = { a: number; b: number; origin: number; status: 'up' | 'flat' };

// Durée forfaitaire retenue pour chaque tranche d'ancienneté, en mois.
export const TRAINING_AGE_MONTHS: Record<TrainingAgeBucket, number> = {
  none: 0,
  lt6m: 3,
  '6to12m': 9,
  '1to2y': 18,
  '2to5y': 42,
  gt5y: 72,
};

// Cette méthode permet de calculer le meilleur 1RM estimé (Epley) de chaque semaine sur les séries de travail de 12 reps au plus.
// Les échauffements, séries dégressives, séances en cours et supprimées sont exclus.
export function weeklyE1rmPoints(exerciseId: string, workouts: WorkoutRow[]): TrendPoint[] {
  const byWeek = new Map<number, number>();
  for (const w of workouts) {
    if (w.status !== 'completed' || w.deleted_at !== null) continue;
    for (const we of w.doc.exercises) {
      if (we.exerciseId !== exerciseId || we.measurementType !== 'weight_reps') continue;
      for (const s of we.sets) {
        if (!s.done || !isWorkingKind(s.kind) || !s.weight || s.reps === undefined) continue;
        const v = e1rm(toKg(s.weight), s.reps);
        if (v === undefined) continue;
        const ws = weekStart(w.started_at);
        byWeek.set(ws, Math.max(byWeek.get(ws) ?? 0, v));
      }
    }
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekStart, e1rmKg]) => ({ weekStart, e1rmKg }));
}

// Cette méthode permet de trouver la première séance terminée contenant un exercice (début de l'historique).
export function firstSessionAt(exerciseId: string, workouts: WorkoutRow[]): number | undefined {
  const sorted = sortWorkouts(
    workouts.filter(
      (w) => w.status === 'completed' && w.doc.exercises.some((e) => e.exerciseId === exerciseId),
    ),
  );
  return sorted[0]?.started_at;
}

// Cette méthode permet de calculer le début de l'entraînement : date de déclaration moins la durée de la tranche,
// au plus tard la première séance de l'exercice ; sans ancienneté, la première séance.
export function trainingOrigin(settings: Pick<Settings, 'trainingAge'>, firstSession: number): number {
  const ta = settings.trainingAge;
  if (!ta) return firstSession;
  return Math.min(addMonths(ta.declaredAt, -TRAINING_AGE_MONTHS[ta.bucket]), firstSession);
}

// Cette méthode permet de convertir un instant en temps du modèle : semaines depuis l'origine, plus 1 (au moins 1).
export function modelT(at: number, origin: number): number {
  return Math.max(1, localDiff(origin, at) / WEEK_MS + 1);
}

// Cette méthode permet d'ajuster la tendance linéaire-log du 1RM estimé lorsque l'historique d'un exercice est suffisant.
// Elle renvoie undefined si les conditions d'affichage du §F7.10 ne sont pas réunies.
export function fitTrend(points: TrendPoint[], origin: number, _now?: number): Trend | undefined {
  if (points.length < TREND_MIN_POINTS) return undefined;
  const first = points[0]!.weekStart;
  const last = points[points.length - 1]!.weekStart;
  if (Math.round((last - first) / WEEK_MS) + 1 < TREND_MIN_SPAN_WEEKS) return undefined;
  const xs = points.map((p) => Math.log(modelT(p.weekStart, origin)));
  const ys = points.map((p) => p.e1rmKg);
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  if (sxx === 0) return undefined;
  const b = sxy / sxx;
  const a = my - b * mx;
  return { a, b, origin, status: b > 0 ? 'up' : 'flat' };
}

// Cette méthode permet d'évaluer le modèle sans plafond à un instant.
export function modelValue(trend: Trend, at: number): number {
  return trend.a + trend.b * Math.log(modelT(at, trend.origin));
}

// Cette méthode permet de projeter le 1RM estimé à un instant futur, gain plafonné à 4 % du 1RM actuel par mois.
export function project(trend: Trend, at: number, now: number): number {
  const yNow = modelValue(trend, now);
  const months = Math.max(0, (at - now) / MONTH_MS);
  return Math.min(modelValue(trend, at), yNow * (1 + TREND_MAX_MONTHLY * months));
}

// Cette méthode permet d'obtenir les points de la courbe projetée en pointillés, de maintenant à +12 semaines.
export function projectionPoints(trend: Trend, now: number, stepWeeks = 1): { t: number; v: number }[] {
  if (trend.status !== 'up') return [];
  const out: { t: number; v: number }[] = [];
  for (let w = 0; w <= TREND_HORIZON_WEEKS; w += stepWeeks) {
    const t = now + w * WEEK_MS;
    out.push({ t, v: project(trend, t, now) });
  }
  return out;
}

// Cette méthode permet d'obtenir le rythme actuel en kg de 1RM estimé par mois (dérivée du modèle aujourd'hui, plafonnée).
export function currentRate(trend: Trend, now: number): number {
  if (trend.status !== 'up') return 0;
  const perMonth = (trend.b / modelT(now, trend.origin)) * (30.44 / 7);
  return Math.min(perMonth, modelValue(trend, now) * TREND_MAX_MONTHLY);
}

// Cette méthode permet d'estimer la date d'atteinte d'un objectif à long terme ; undefined au-delà d'un an ou sans tendance positive.
export function goalDate(
  trend: Trend,
  goal: NonNullable<ExercisePrefsDoc['longTermGoal']>,
  now: number,
): number | undefined {
  if (trend.status !== 'up') return undefined;
  const target = e1rm(toKg(goal.weight), goal.reps);
  if (target === undefined) return undefined;
  const yNow = modelValue(trend, now);
  if (target <= yNow) return now;
  const tStar = Math.exp((target - trend.a) / trend.b);
  const uncapped = trend.origin + (tStar - 1) * WEEK_MS;
  const capped = now + ((target / yNow - 1) / TREND_MAX_MONTHLY) * MONTH_MS;
  const at = Math.max(uncapped, capped);
  if (at - now > GOAL_HORIZON_WEEKS * WEEK_MS) return undefined;
  return at;
}

// Cette méthode permet de trouver la première série de travail qui réalise l'objectif à long terme après sa fixation (badge 🎯).
export function goalAchievedSet(
  exerciseId: string,
  workouts: WorkoutRow[],
  goal: NonNullable<ExercisePrefsDoc['longTermGoal']>,
): { workoutId: string; setId: string } | undefined {
  const goalKg = toKg(goal.weight);
  for (const w of sortWorkouts(workouts)) {
    for (const we of w.doc.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done || !isWorkingKind(s.kind) || !s.weight || s.reps === undefined) continue;
        if ((s.doneAt ?? w.started_at) < goal.setAt) continue;
        if (toKg(s.weight) >= goalKg - 1e-9 && s.reps >= goal.reps) return { workoutId: w.id, setId: s.id };
      }
    }
  }
  return undefined;
}
