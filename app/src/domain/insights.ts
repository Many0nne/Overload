// Agrégats des vues de Profil › Statistiques (§F7.6, issue #103). Module à part de stats.ts (importé par l'Accueil) :
// seul l'écran Statistiques, chargé en lazy, le charge. Règles de date §F7.6 : jour de début, fuseau de l'appareil.
import { addDays, addMonths } from './dates';
import { isWorkingKind } from './measurement';
import { targetsMet } from './progression';
import { e1rm, type RecordEvent } from './records';
import type { MuscleInfo } from './stats';
import { workoutDurationS } from './summary';
import {
  firstSessionAt,
  fitTrend,
  goalAchievedSet,
  goalDate,
  trainingOrigin,
  weeklyE1rmPoints,
} from './trend';
import type { ExercisePrefsDoc, Muscle, SetKind, Settings, TargetReason, WorkoutRow } from './types';
import { toKg } from './units';
import { countsForVolume, exerciseVolumeKg } from './volume';

export type StatsPeriod = '30d' | '3m' | '1y' | 'all';

// Nombre de séances sur la période à partir duquel la répartition par zones de reps s'affiche.
export const MIN_SESSIONS_FOR_ZONES = 3;

const active = (w: WorkoutRow) => w.deleted_at === null && w.status === 'completed';
const inRange = (w: WorkoutRow, from: number, to: number) =>
  active(w) && w.started_at >= from && w.started_at < to;

export type PeriodRange = { from: number; to: number; prevFrom?: number };

// Cette méthode permet d'obtenir la fenêtre d'une période (début, fin exclue) et le début de la fenêtre précédente de même
// durée, pour les écarts ; « tout » n'a pas de fenêtre précédente.
export function periodRange(period: StatsPeriod, now: number): PeriodRange {
  const to = now + 1;
  switch (period) {
    case '30d':
      return { from: addDays(now, -30), to, prevFrom: addDays(now, -60) };
    case '3m':
      return { from: addMonths(now, -3), to, prevFrom: addMonths(now, -6) };
    case '1y':
      return { from: addMonths(now, -12), to, prevFrom: addMonths(now, -24) };
    case 'all':
      return { from: Number.NEGATIVE_INFINITY, to };
  }
}

export type Totals = {
  count: number;
  durationS: number;
  volumeKg: number;
  sets: number; // séries validées hors échauffement
  reps: number;
  exercises: number; // exercices distincts avec au moins une série comptée
  firstAt?: number; // début de la première séance
};

// Cette méthode permet de calculer les totaux des séances d'une fenêtre : nombre, durée, volume, séries et reps
// (validées hors échauffement), exercices distincts ; sans bornes, depuis le début.
export function totals(
  workouts: WorkoutRow[],
  from = Number.NEGATIVE_INFINITY,
  to = Number.POSITIVE_INFINITY,
): Totals {
  const out: Totals = { count: 0, durationS: 0, volumeKg: 0, sets: 0, reps: 0, exercises: 0 };
  const exercises = new Set<string>();
  for (const w of workouts) {
    if (!inRange(w, from, to)) continue;
    out.count++;
    out.durationS += workoutDurationS(w, w.started_at);
    if (out.firstAt === undefined || w.started_at < out.firstAt) out.firstAt = w.started_at;
    for (const we of w.doc.exercises) {
      out.volumeKg += exerciseVolumeKg(we);
      for (const s of we.sets) {
        if (!countsForVolume(s)) continue;
        out.sets++;
        out.reps += s.reps ?? 0;
        exercises.add(we.exerciseId);
      }
    }
  }
  out.exercises = exercises.size;
  return out;
}

const recordKey = (e: RecordEvent) => `${e.workoutId}|${e.exerciseId}|${e.criterion}`;

// Cette méthode permet de compter les records battus dans une fenêtre, au plus un par séance, exercice et critère
// (comme le compteur du récapitulatif).
export function recordsIn(events: RecordEvent[], from: number, to: number): number {
  const keys = new Set<string>();
  for (const e of events) if (e.startedAt >= from && e.startedAt < to) keys.add(recordKey(e));
  return keys.size;
}

// Cette méthode permet de compter les records battus par mois civil sur les n derniers mois (mois en cours compris),
// du plus ancien au plus récent, mois vides compris.
export function recordsByMonth(
  events: RecordEvent[],
  now: number,
  months = 6,
): { monthStart: number; count: number }[] {
  const d = new Date(now);
  const out = Array.from({ length: months }, (_, i) => {
    const monthStart = new Date(d.getFullYear(), d.getMonth() - (months - 1 - i), 1).getTime();
    const next = new Date(d.getFullYear(), d.getMonth() - (months - 2 - i), 1).getTime();
    return { monthStart, count: recordsIn(events, monthStart, next) };
  });
  return out;
}

// Cette méthode permet de répartir le volume (kg) par muscle sur une fenêtre, comme les séries : 100 % au muscle principal,
// 50 % à chaque muscle secondaire (échauffements exclus).
export function muscleVolume(
  workouts: WorkoutRow[],
  muscles: (exerciseId: string) => MuscleInfo | undefined,
  from: number,
  to: number,
): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const w of workouts) {
    if (!inRange(w, from, to)) continue;
    for (const we of w.doc.exercises) {
      const info = muscles(we.exerciseId);
      const v = info ? exerciseVolumeKg(we) : 0;
      if (!info || !v) continue;
      out[info.primary_muscle] = (out[info.primary_muscle] ?? 0) + v;
      for (const m of info.secondary_muscles) out[m] = (out[m] ?? 0) + v * 0.5;
    }
  }
  return out;
}

// Groupes des équilibres : les épaules comptent pour « pousser » (le catalogue ne distingue pas le deltoïde postérieur).
export const PUSH_MUSCLES: ReadonlySet<Muscle> = new Set(['chest', 'shoulders', 'triceps']);
export const PULL_MUSCLES: ReadonlySet<Muscle> = new Set(['back', 'biceps', 'traps', 'forearms']);
export const UPPER_MUSCLES: ReadonlySet<Muscle> = new Set([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'traps',
]);
export const LOWER_MUSCLES: ReadonlySet<Muscle> = new Set(['quads', 'hamstrings', 'glutes', 'calves']);

// Cette méthode permet de calculer la part du premier groupe dans la somme de deux groupes (undefined si les deux sont vides).
function share(
  dist: Partial<Record<Muscle, number>>,
  a: ReadonlySet<Muscle>,
  b: ReadonlySet<Muscle>,
): number | undefined {
  let sa = 0;
  let sb = 0;
  for (const [m, v] of Object.entries(dist) as [Muscle, number][]) {
    if (a.has(m)) sa += v;
    if (b.has(m)) sb += v;
  }
  return sa + sb > 0 ? sa / (sa + sb) : undefined;
}

// Cette méthode permet de calculer les équilibres pousser/tirer et haut/bas du corps (part de « pousser » et de « haut »,
// entre 0 et 1) à partir d'une répartition par muscle ; abdos, lombaires et cardio n'y entrent pas.
export function muscleBalance(dist: Partial<Record<Muscle, number>>): { push?: number; upper?: number } {
  return { push: share(dist, PUSH_MUSCLES, PULL_MUSCLES), upper: share(dist, UPPER_MUSCLES, LOWER_MUSCLES) };
}

export type TargetStat = { met: number; total: number };

// Cette méthode permet de calculer le taux d'objectifs de séance atteints sur une fenêtre (§F7.10, #92), au global et par
// raison de l'objectif ; un exercice sans objectif n'est pas compté.
export function targetRate(
  workouts: WorkoutRow[],
  from: number,
  to: number,
): TargetStat & { byReason: Partial<Record<TargetReason['kind'], TargetStat>> } {
  const out = { met: 0, total: 0, byReason: {} as Partial<Record<TargetReason['kind'], TargetStat>> };
  for (const w of workouts) {
    if (!inRange(w, from, to)) continue;
    for (const we of w.doc.exercises) {
      const r = targetsMet(we);
      if (r === undefined) continue;
      out.total++;
      if (r) out.met++;
      const kind = we.targetReason?.kind;
      if (!kind) continue;
      const k = out.byReason[kind] ?? { met: 0, total: 0 };
      k.total++;
      if (r) k.met++;
      out.byReason[kind] = k;
    }
  }
  return out;
}

// Cette méthode permet de compter les séries validées par type (normale, échauffement, dégressive, échec) sur une fenêtre.
export function setKindSplit(workouts: WorkoutRow[], from: number, to: number): Record<SetKind, number> {
  const out: Record<SetKind, number> = { normal: 0, warmup: 0, drop: 0, failure: 0 };
  for (const w of workouts) {
    if (!inRange(w, from, to)) continue;
    for (const we of w.doc.exercises) for (const s of we.sets) if (s.done) out[s.kind]++;
  }
  return out;
}

export type RepZones = { strength: number; hypertrophy: number; endurance: number };

// Cette méthode permet de répartir les séries de travail chargées (poids et reps, lesté) par zone de répétitions :
// force 1-5, hypertrophie 6-12, endurance 13 et plus.
export function repZones(workouts: WorkoutRow[], from: number, to: number): RepZones {
  const out: RepZones = { strength: 0, hypertrophy: 0, endurance: 0 };
  for (const w of workouts) {
    if (!inRange(w, from, to)) continue;
    for (const we of w.doc.exercises) {
      if (we.measurementType !== 'weight_reps' && we.measurementType !== 'weighted_bw') continue;
      for (const s of we.sets) {
        if (!s.done || !isWorkingKind(s.kind) || !s.reps) continue;
        if (s.reps <= 5) out.strength++;
        else if (s.reps <= 12) out.hypertrophy++;
        else out.endurance++;
      }
    }
  }
  return out;
}

// Cette méthode permet de calculer le RPE moyen des séries validées (hors échauffement) qui en ont un, sur une fenêtre ;
// undefined si aucune série n'est notée. Les exercices au RPE désactivé (rpeHidden, issue #124) sont ignorés.
export function averageRpe(
  workouts: WorkoutRow[],
  from: number,
  to: number,
  rpeHidden: ReadonlySet<string> = new Set(),
): { avg: number; count: number } | undefined {
  let sum = 0;
  let count = 0;
  for (const w of workouts) {
    if (!inRange(w, from, to)) continue;
    for (const we of w.doc.exercises) {
      if (rpeHidden.has(we.exerciseId)) continue;
      for (const s of we.sets) {
        if (!countsForVolume(s) || s.rpe === undefined) continue;
        sum += s.rpe;
        count++;
      }
    }
  }
  return count ? { avg: sum / count, count } : undefined;
}

export type RoutineUsage = { routineId: string | null; count: number; lastTitle: string };

// Cette méthode permet de classer les routines par nombre de séances sur une fenêtre (séances libres regroupées sous null),
// avec le titre de la dernière séance pour nommer une routine supprimée ; à égalité, la plus récente d'abord.
export function routineUsage(workouts: WorkoutRow[], from: number, to: number): RoutineUsage[] {
  const map = new Map<string | null, RoutineUsage & { last: number }>();
  for (const w of workouts) {
    if (!inRange(w, from, to)) continue;
    const u = map.get(w.routine_id) ?? { routineId: w.routine_id, count: 0, lastTitle: w.doc.title, last: 0 };
    u.count++;
    if (w.started_at >= u.last) {
      u.last = w.started_at;
      u.lastTitle = w.doc.title;
    }
    map.set(w.routine_id, u);
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .map(({ routineId, count, lastTitle }) => ({ routineId, count, lastTitle }));
}

export type GoalProgress = {
  exerciseId: string;
  goal: NonNullable<ExercisePrefsDoc['longTermGoal']>;
  goalKg: number; // 1RM estimé visé
  currentKg?: number; // meilleur 1RM estimé de la dernière semaine entraînée
  progress: number; // currentKg / goalKg, entre 0 et 1
  achieved: boolean;
  goalAt?: number; // date estimée (tendance), absente au-delà d'un an ou sans tendance positive
};

// Cette méthode permet de calculer l'avancement des objectifs à long terme (exercices « poids et reps ») : 1RM estimé de la
// dernière semaine entraînée rapporté au 1RM estimé visé, objectif atteint (badge 🎯) et date estimée (§F7.10).
export function goalsProgress(
  goals: { exerciseId: string; goal: NonNullable<ExercisePrefsDoc['longTermGoal']> }[],
  workouts: WorkoutRow[],
  settings: Pick<Settings, 'trainingAge'>,
  now: number,
): GoalProgress[] {
  const out: GoalProgress[] = [];
  for (const { exerciseId, goal } of goals) {
    const goalKg = e1rm(toKg(goal.weight), goal.reps);
    if (goalKg === undefined) continue;
    const points = weeklyE1rmPoints(exerciseId, workouts);
    const currentKg = points.at(-1)?.e1rmKg;
    const achieved = goalAchievedSet(exerciseId, workouts, goal) !== undefined;
    const first = firstSessionAt(exerciseId, workouts);
    const trend = first === undefined ? undefined : fitTrend(points, trainingOrigin(settings, first), now);
    out.push({
      exerciseId,
      goal,
      goalKg,
      currentKg,
      progress: achieved ? 1 : Math.min(1, (currentKg ?? 0) / goalKg),
      achieved,
      goalAt: trend && !achieved ? goalDate(trend, goal, now) : undefined,
    });
  }
  return out.sort((a, b) => b.progress - a.progress);
}
