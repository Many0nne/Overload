// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Objectifs de la prochaine séance (§F7.10, §10.7). Calculés une fois au démarrage, puis figés dans la séance.
import { WEEK_MS } from './dates.ts';
import { hasReps, hasTargets, isWorkingKind } from './measurement.ts';
import {
  BODYWEIGHT_COMEBACK_DROP,
  COMEBACK_MIN_WEEKS,
  COMEBACK_STEPS,
  DEFAULT_INCREMENTS,
  DEFAULT_REP_RANGE,
  DURATION_MIN_GAIN_S,
  DURATION_ROUND_S,
  DURATION_STEP,
  MARZAGAO_MAX_REPS,
  PLATEAU_DROP,
  PLATEAU_FAIL_SESSIONS,
  PLATEAU_STALL_SESSIONS,
} from './progressionConfig.ts';
import type {
  ExercisePrefsDoc,
  ExerciseRow,
  MeasurementType,
  RepRange,
  RoutineRow,
  SetKind,
  SetTarget,
  Settings,
  TargetReason,
  Weight,
  WeightUnit,
  WorkoutDoc,
  WorkoutExercise,
  WorkoutRow,
  WorkoutSet,
} from './types.ts';
import { ceilTo, clean, floorTo, toKg, weightIn } from './units.ts';

export type ExerciseLike = Pick<ExerciseRow, 'id' | 'equipment' | 'measurement_type'>;

// Cette méthode permet d'obtenir le coefficient de conversion de Marzagao pour une charge en kg.
export function marzagaoK(wKg: number): number {
  return Math.max(0.5, -2.55 + 4.58 * Math.log(wKg));
}

// Cette méthode permet de calculer le nombre de reps à la charge w2 équivalent à w1 × r1, lorsque la charge monte d'un incrément.
// Les charges sont converties en kg avant le calcul ; le résultat est arrondi à l'inférieur (borné ensuite par l'appelant).
export function equivalentReps(w1: Weight, r1: number, w2: Weight): number {
  const a = toKg(w1);
  const b = toKg(w2);
  const m = a * (1 + (r1 - 1) ** 0.85 / marzagaoK(a));
  const x = marzagaoK(b) * (m / b - 1);
  return x <= 0 ? 1 : Math.floor(clean(1 + x ** (1 / 0.85), 9));
}

// Cette méthode permet d'obtenir l'incrément de charge d'un exercice dans l'unité de l'utilisateur.
// Le réglage de l'exercice prime s'il est dans cette unité ; sinon le défaut selon l'équipement s'applique.
export function incrementFor(
  exercise: Pick<ExerciseRow, 'equipment'>,
  prefs: ExercisePrefsDoc | undefined,
  unit: WeightUnit,
): Weight {
  if (prefs?.increment && prefs.increment.u === unit && prefs.increment.v > 0) return prefs.increment;
  return { v: DEFAULT_INCREMENTS[exercise.equipment][unit], u: unit };
}

// Cette méthode permet de trouver la fourchette de la routine la plus récemment modifiée qui contient l'exercice.
export function lastRoutineRepRange(exerciseId: string, routines: RoutineRow[]): RepRange | undefined {
  let best: { at: number; range: RepRange } | undefined;
  for (const r of routines) {
    if (r.deleted_at !== null) continue;
    const ex = r.doc.exercises.find((e) => e.exerciseId === exerciseId && e.repRange);
    if (ex?.repRange && (!best || r.client_updated_at > best.at))
      best = { at: r.client_updated_at, range: ex.repRange };
  }
  return best?.range;
}

// Cette méthode permet de résoudre la fourchette d'un exercice : routine, puis réglage, puis dernière routine, puis 8–12.
// Sans reps, pas de fourchette. En poids du corps, pas de 8–12 implicite (le plafond ne s'applique que si une fourchette est définie).
export function resolveRepRange(input: {
  measurementType: MeasurementType;
  routineRange?: RepRange;
  prefs?: ExercisePrefsDoc;
  lastRoutineRange?: RepRange;
}): RepRange | undefined {
  if (!hasReps(input.measurementType)) return undefined;
  const explicit = input.routineRange ?? input.prefs?.defaultRepRange ?? input.lastRoutineRange;
  if (explicit) return explicit;
  return input.measurementType === 'bodyweight' ? undefined : { ...DEFAULT_REP_RANGE };
}

// Cette méthode permet de lire une saisie de fourchette (« 8–12 », « 8-12 » ou « 8 ») ; undefined si invalide.
export function parseRepRange(input: string): RepRange | undefined {
  const m = input.trim().match(/^(\d+)\s*(?:[-–—à]\s*(\d+))?$/);
  if (!m) return undefined;
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  if (min < 1 || max < min) return undefined;
  return { min, max };
}

export type TargetsInput = {
  exercise: ExerciseLike;
  prefs?: ExercisePrefsDoc;
  settings: Settings;
  repRange: RepRange | undefined;
  plannedSets: { kind: SetKind }[];
  history: WorkoutRow[]; // séances terminées contenant l'exercice (doit inclure la séance de référence)
  reference: { exercise: WorkoutExercise; startedAt: number } | undefined;
  now: number;
};

export type TargetsResult = { sets: (SetTarget | undefined)[]; reason?: TargetReason };

// Cette méthode permet de lister les séries de travail validées d'un exercice de séance.
export function workingSets(we: Pick<WorkoutExercise, 'sets'>): WorkoutSet[] {
  return we.sets.filter((s) => s.done && isWorkingKind(s.kind));
}

function loadsKey(sets: WorkoutSet[]): string {
  const loads = new Set(sets.map((s) => (s.weight ? clean(toKg(s.weight), 6) : 0)));
  return [...loads].sort((a, b) => a - b).join('|');
}

// Cette méthode permet de retrouver les dernières séances consécutives faites aux mêmes charges que la référence (incluse).
function sessionsAtSameLoad(input: TargetsInput, refWork: WorkoutSet[]): WorkoutSet[][] {
  const ref = input.reference!;
  const key = loadsKey(refWork);
  const upto = input.history
    .filter((w) => w.deleted_at === null && w.status === 'completed' && w.started_at <= ref.startedAt)
    .sort((a, b) => a.started_at - b.started_at || (a.id < b.id ? -1 : 1));
  const run: WorkoutSet[][] = [];
  for (let i = upto.length - 1; i >= 0; i--) {
    const w = upto[i]!;
    const sets = w.doc.exercises.filter((e) => e.exerciseId === input.exercise.id).flatMap(workingSets);
    if (!sets.length || loadsKey(sets) !== key) break;
    run.unshift(sets);
  }
  return run;
}

// Cette méthode permet de détecter un plateau : 2 séances avec une série sous min, ou 3 séances sans hausse du total de reps.
function isPlateau(run: WorkoutSet[][], range: RepRange | undefined): boolean {
  if (range && run.length >= PLATEAU_FAIL_SESSIONS) {
    const last = run.slice(-PLATEAU_FAIL_SESSIONS);
    if (last.every((sets) => sets.some((s) => (s.reps ?? 0) < range.min))) return true;
  }
  if (run.length >= PLATEAU_STALL_SESSIONS) {
    const [first, ...rest] = run
      .slice(-PLATEAU_STALL_SESSIONS)
      .map((sets) => sets.reduce((t, s) => t + (s.reps ?? 0), 0));
    if (rest.every((t) => t <= first!)) return true;
  }
  return false;
}

// Cette méthode permet d'obtenir la baisse de charge de reprise selon le nombre de semaines d'arrêt (dernière tranche franchie).
export function comebackDrop(weeksOff: number): number {
  let drop = 0;
  for (const [weeks, d] of COMEBACK_STEPS) if (weeksOff > weeks) drop = d;
  return drop;
}

// Cette méthode permet de calculer l'objectif d'un exercice lorsqu'une séance démarre ou qu'un exercice y est ajouté.
// Elle choisit le cas du §F7.10 (reprise, plateau, montée, consolidation, +1 rep) à partir des séances antérieures triées.
export function computeTargets(input: TargetsInput): TargetsResult | undefined {
  const type = input.exercise.measurement_type;
  if (!input.settings.progressionEnabled || !hasTargets(type) || !input.reference) return undefined;
  const refWork = workingSets(input.reference.exercise);
  if (!refWork.length) return undefined;

  // Série de référence de chaque série prévue (rang parmi les séries de travail ; au-delà, la dernière).
  let rank = 0;
  const refFor = input.plannedSets.map((p) => {
    if (!isWorkingKind(p.kind)) return undefined;
    const r = refWork[Math.min(rank, refWork.length - 1)];
    rank++;
    return r;
  });
  if (!refFor.some(Boolean)) return undefined;

  const unit = input.settings.units.weight;
  const inc = incrementFor(input.exercise, input.prefs, unit).v;
  const range = input.repRange;
  const weeksOff = (input.now - input.reference.startedAt) / WEEK_MS;
  const toUser = (w: Weight | undefined): number => {
    if (!w) return 0;
    return w.u === unit ? w.v : clean(Math.round(weightIn(w, unit) * 10) / 10);
  };
  const asWeight = (v: number): Weight => ({ v: clean(Math.max(0, v)), u: unit });
  const map = (fn: (s: WorkoutSet) => SetTarget): (SetTarget | undefined)[] =>
    refFor.map((s) => (s ? fn(s) : undefined));
  const reps = (s: WorkoutSet) => s.reps ?? 0;

  if (type === 'duration') {
    return {
      sets: map((s) => {
        const d = s.durationS ?? 0;
        return {
          durationS: Math.max(ceilTo(d * (1 + DURATION_STEP), DURATION_ROUND_S), d + DURATION_MIN_GAIN_S),
        };
      }),
      reason: { kind: 'duration_up' },
    };
  }

  const comeback = weeksOff > COMEBACK_MIN_WEEKS;
  const run = sessionsAtSameLoad(input, refWork);
  const plateau = isPlateau(run, range);

  if (type === 'bodyweight') {
    if (comeback) {
      return {
        sets: map((s) => ({ reps: Math.max(1, Math.floor(reps(s) * (1 - BODYWEIGHT_COMEBACK_DROP))) })),
        reason: { kind: 'comeback', weeksOff: Math.floor(weeksOff) },
      };
    }
    if (plateau) return { sets: map((s) => ({ reps: reps(s) })), reason: { kind: 'consolidate' } };
    return {
      sets: map((s) => ({ reps: range ? Math.min(range.max, reps(s) + 1) : reps(s) + 1 })),
      reason: { kind: 'reps_up' },
    };
  }

  // Types avec charge et fourchette : poids et reps, lesté, assisté.
  const rr = range ?? DEFAULT_REP_RANGE;
  const assisted = type === 'assisted_bw';
  const allMax = refWork.every((s) => reps(s) >= rr.max);
  const anyBelow = refWork.some((s) => reps(s) < rr.min);

  if (comeback) {
    const drop = comebackDrop(weeksOff);
    return {
      sets: map((s) => ({
        weight: assisted
          ? asWeight(toUser(s.weight) + inc)
          : asWeight(floorTo(toUser(s.weight) * (1 - drop), inc)),
        reps: reps(s),
      })),
      reason: { kind: 'comeback', weeksOff: Math.floor(weeksOff) },
    };
  }
  if (plateau) {
    return {
      sets: map((s) => ({
        weight: assisted
          ? asWeight(toUser(s.weight) + inc)
          : asWeight(floorTo(toUser(s.weight) * (1 - PLATEAU_DROP), inc)),
        reps: rr.min,
      })),
      reason: { kind: 'plateau' },
    };
  }
  if (allMax) {
    if (assisted) {
      return {
        sets: map((s) => ({ weight: asWeight(toUser(s.weight) - inc), reps: rr.min })),
        reason: { kind: 'load_up', reachedReps: rr.max, assistanceDrop: { v: inc, u: unit } },
      };
    }
    return {
      sets: map((s) => {
        const w = toUser(s.weight);
        const next = asWeight(w + inc);
        let r = rr.min;
        if (type === 'weight_reps' && rr.max <= MARZAGAO_MAX_REPS && w > 0) {
          r = Math.min(rr.max, Math.max(rr.min, equivalentReps({ v: w, u: unit }, rr.max, next)));
        }
        return { weight: next, reps: r };
      }),
      reason: { kind: 'load_up', reachedReps: rr.max },
    };
  }
  if (anyBelow) {
    return {
      sets: map((s) => {
        const t = s.target;
        if (t && (t.weight || t.reps !== undefined))
          return { weight: asWeight(toUser(t.weight ?? s.weight)), reps: t.reps ?? reps(s) };
        return { weight: asWeight(toUser(s.weight)), reps: reps(s) };
      }),
      reason: { kind: 'consolidate' },
    };
  }
  return {
    sets: map((s) => ({
      weight: asWeight(toUser(s.weight)),
      reps: Math.max(rr.min, Math.min(rr.max, reps(s) + 1)),
    })),
    reason: { kind: 'reps_up' },
  };
}

// Cette méthode permet d'écrire le résultat de computeTargets dans un exercice de séance (objectifs figés et pré-remplissage).
export function applyTargets(we: WorkoutExercise, result: TargetsResult | undefined): WorkoutExercise {
  if (!result) return we;
  let count = 0;
  const sets = we.sets.map((s, i) => {
    const t = result.sets[i];
    if (!t) return s;
    count++;
    const next: WorkoutSet = { ...s, target: t };
    if (t.weight) next.weight = { ...t.weight };
    if (t.reps !== undefined) next.reps = t.reps;
    if (t.durationS !== undefined) next.durationS = t.durationS;
    return next;
  });
  const out: WorkoutExercise = { ...we, sets, targetCount: count };
  if (result.reason) out.targetReason = result.reason;
  return out;
}

const EPS = 1e-9;

// Cette méthode permet d'obtenir l'objectif d'une série lorsqu'elle est une série de travail (undefined pour un échauffement ou une dégressive).
// Une série passée en échauffement après le calcul garde son objectif figé, mais il est ignoré tant qu'elle n'est pas de travail.
export function activeTarget(set: Pick<WorkoutSet, 'kind' | 'target'>): SetTarget | undefined {
  return isWorkingKind(set.kind) ? set.target : undefined;
}

// Cette méthode permet de savoir si une série validée atteint son objectif (charge ≥, assistance ≤, reps et durée ≥).
export function setMeetsTarget(set: WorkoutSet, type: MeasurementType): boolean {
  const t = activeTarget(set);
  if (!t || !set.done) return false;
  if (t.weight) {
    if (!set.weight) return false;
    const a = toKg(set.weight);
    const b = toKg(t.weight);
    if (type === 'assisted_bw' ? a > b + EPS : a < b - EPS) return false;
  }
  if (t.reps !== undefined && (set.reps ?? 0) < t.reps) return false;
  if (t.durationS !== undefined && (set.durationS ?? 0) < t.durationS) return false;
  return true;
}

// Cette méthode permet d'obtenir l'objectif manqué d'une série validée (reps réalisées et objectif restent distincts, §F7.10).
// undefined si la série n'avait pas d'objectif actif, n'est pas validée ou l'a atteint.
export function missedTarget(set: WorkoutSet, type: MeasurementType): SetTarget | undefined {
  const t = activeTarget(set);
  return t && set.done && !setMeetsTarget(set, type) ? t : undefined;
}

// Cette méthode permet de savoir si un exercice a atteint son objectif ; undefined s'il n'en avait pas.
// Une série avec objectif supprimée (targetCount) ou non validée compte comme non atteinte.
export function targetsMet(we: WorkoutExercise): boolean | undefined {
  const withTarget = we.sets.filter((s) => activeTarget(s));
  const expected = we.targetCount ?? withTarget.length;
  if (expected === 0) return undefined;
  if (withTarget.length < expected) return false;
  return withTarget.every((s) => setMeetsTarget(s, we.measurementType));
}

// Cette méthode permet de compter les objectifs atteints d'une séance (« n / m exercices »).
export function workoutTargetsMet(doc: WorkoutDoc): { met: number; total: number } {
  let met = 0;
  let total = 0;
  for (const we of doc.exercises) {
    const r = targetsMet(we);
    if (r === undefined) continue;
    total++;
    if (r) met++;
  }
  return { met, total };
}
