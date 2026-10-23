// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Records par exercice (§F7.6, §10.3). Les badges ne sont jamais stockés : ils sont dérivés de l'historique trié.
import type { MeasurementType, WorkoutExercise, WorkoutRow, WorkoutSet } from './types.ts';
import { toKg, toKm } from './units.ts';

export type RecordCriterion =
  | 'max_weight'
  | 'best_e1rm'
  | 'best_set_volume'
  | 'weight_at_1'
  | 'weight_at_3'
  | 'weight_at_5'
  | 'weight_at_8'
  | 'weight_at_10'
  | 'weight_at_12'
  | 'max_reps'
  | 'session_reps'
  | 'min_assistance'
  | 'max_duration'
  | 'max_distance'
  | 'best_pace';

// Unité canonique de la valeur d'un critère : kg, reps, secondes, km ou secondes par km.
export type CriterionUnit = 'kg' | 'reps' | 's' | 'km' | 's_per_km';

export type CriterionDef = {
  id: RecordCriterion;
  scope: 'set' | 'session';
  dir: 'max' | 'min';
  unit: CriterionUnit;
  value: (sets: WorkoutSet[]) => number | undefined; // scope set : une seule série ; scope session : séries de l'exercice
};

export const REP_MILESTONES = [1, 3, 5, 8, 10, 12] as const;

// Cette méthode permet d'estimer le 1RM d'une série (Epley) ; undefined au-delà de 12 reps ou sans rep.
export function e1rm(kg: number, reps: number): number | undefined {
  if (!Number.isFinite(kg) || !Number.isInteger(reps) || reps < 1 || reps > 12) return undefined;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30);
}

const one = (fn: (s: WorkoutSet) => number | undefined) => (sets: WorkoutSet[]) =>
  sets[0] ? fn(sets[0]) : undefined;
const kg = (s: WorkoutSet) => (s.weight ? toKg(s.weight) : undefined);
const reps = (s: WorkoutSet) => (s.reps !== undefined && s.reps > 0 ? s.reps : undefined);

const maxWeight: CriterionDef = { id: 'max_weight', scope: 'set', dir: 'max', unit: 'kg', value: one(kg) };
const maxWeightWithReps: CriterionDef = {
  ...maxWeight,
  value: one((s) => (reps(s) !== undefined ? kg(s) : undefined)),
};
const bestE1rm: CriterionDef = {
  id: 'best_e1rm',
  scope: 'set',
  dir: 'max',
  unit: 'kg',
  value: one((s) => {
    const w = kg(s);
    return w !== undefined && s.reps !== undefined ? e1rm(w, s.reps) : undefined;
  }),
};
const bestSetVolume: CriterionDef = {
  id: 'best_set_volume',
  scope: 'set',
  dir: 'max',
  unit: 'kg',
  value: one((s) => {
    const w = kg(s);
    const r = reps(s);
    return w !== undefined && r !== undefined ? w * r : undefined;
  }),
};
const weightAt = (n: (typeof REP_MILESTONES)[number]): CriterionDef => ({
  id: `weight_at_${n}`,
  scope: 'set',
  dir: 'max',
  unit: 'kg',
  value: one((s) => (s.reps !== undefined && s.reps >= n ? kg(s) : undefined)),
});
const maxReps: CriterionDef = { id: 'max_reps', scope: 'set', dir: 'max', unit: 'reps', value: one(reps) };
const sessionReps: CriterionDef = {
  id: 'session_reps',
  scope: 'session',
  dir: 'max',
  unit: 'reps',
  value: (sets) => {
    const total = sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
    return total > 0 ? total : undefined;
  },
};
const minAssistance: CriterionDef = {
  id: 'min_assistance',
  scope: 'set',
  dir: 'min',
  unit: 'kg',
  value: one((s) => (s.reps !== undefined && s.reps >= 1 ? kg(s) : undefined)),
};
const maxDuration: CriterionDef = {
  id: 'max_duration',
  scope: 'set',
  dir: 'max',
  unit: 's',
  value: one((s) => (s.durationS !== undefined && s.durationS > 0 ? s.durationS : undefined)),
};
const maxDistance: CriterionDef = {
  id: 'max_distance',
  scope: 'set',
  dir: 'max',
  unit: 'km',
  value: one((s) => (s.distance && s.distance.v > 0 ? toKm(s.distance) : undefined)),
};
const bestPace: CriterionDef = {
  id: 'best_pace',
  scope: 'set',
  dir: 'min',
  unit: 's_per_km',
  value: one((s) => {
    if (!s.distance || !s.durationS) return undefined;
    const km = toKm(s.distance);
    return km > 0 && s.durationS > 0 ? s.durationS / km : undefined;
  }),
};

const CRITERIA: Record<MeasurementType, CriterionDef[]> = {
  weight_reps: [maxWeightWithReps, bestE1rm, bestSetVolume, ...REP_MILESTONES.map(weightAt)],
  bodyweight: [maxReps, sessionReps],
  weighted_bw: [maxWeightWithReps, bestSetVolume, maxReps],
  assisted_bw: [minAssistance, maxReps],
  duration: [maxDuration],
  weight_duration: [maxWeight, maxDuration],
  distance_duration: [maxDistance, maxDuration, bestPace],
};

// Cette méthode permet d'obtenir les critères de record suivis pour un type de mesure (table §F7.6).
export function criteriaFor(type: MeasurementType): CriterionDef[] {
  return CRITERIA[type];
}

// Cette méthode permet de savoir si une valeur bat strictement un meilleur courant (absent = battu).
export function isBetter(dir: 'max' | 'min', value: number, best: number | undefined): boolean {
  if (best === undefined) return true;
  return dir === 'max' ? value > best : value < best;
}

// Cette méthode permet de trier des séances par (started_at, id) croissants en écartant les supprimées.
export function sortWorkouts<T extends WorkoutRow>(workouts: T[]): T[] {
  return workouts
    .filter((w) => w.deleted_at === null)
    .sort((a, b) => a.started_at - b.started_at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Cette méthode permet de savoir si une séance contient un exercice.
export function containsExercise(w: WorkoutRow, exerciseId: string): boolean {
  return w.doc.exercises.some((e) => e.exerciseId === exerciseId);
}

// Cette méthode permet de lister les séries comptant pour les records (validées, hors échauffement) d'un exercice de séance.
export function recordSets(we: WorkoutExercise): WorkoutSet[] {
  return we.sets.filter((s) => s.done && s.kind !== 'warmup');
}

export type RecordValue = {
  value: number;
  workoutId: string;
  startedAt: number;
  entryId: string; // id du WorkoutExercise
  setId?: string; // absent pour un critère de séance
};

export type RecordEvent = RecordValue & { exerciseId: string; criterion: RecordCriterion };

export type WorkoutExerciseBadges = {
  sets: Record<string, RecordCriterion[]>; // id de série → critères battus
  entries: Record<string, RecordCriterion[]>; // id de WorkoutExercise → critères de séance battus
};

export type ExerciseScan = {
  badges: Record<string, WorkoutExerciseBadges>; // par id de séance
  bests: Partial<Record<RecordCriterion, RecordValue>>; // meilleurs finaux (fiche exercice)
  events: RecordEvent[]; // records battus, dans l'ordre chronologique
};

function pushBadge(map: Record<string, RecordCriterion[]>, key: string, c: RecordCriterion) {
  const list = map[key] ?? [];
  if (!list.includes(c)) list.push(c);
  map[key] = list;
}

// Cette méthode permet de calculer badges, meilleurs résultats et records battus d'un exercice sur un ensemble de séances.
// Les séances sont parcourues par (started_at, id) ; aucun badge tant qu'aucune séance antérieure ne contient l'exercice.
export function scanExercise(exerciseId: string, workouts: WorkoutRow[]): ExerciseScan {
  const sorted = sortWorkouts(workouts.filter((w) => containsExercise(w, exerciseId)));
  const bests: Partial<Record<RecordCriterion, RecordValue>> = {};
  const badges: Record<string, WorkoutExerciseBadges> = {};
  const events: RecordEvent[] = [];
  let seenBefore = false;

  for (const w of sorted) {
    const entries = w.doc.exercises.filter((e) => e.exerciseId === exerciseId);
    const wb: WorkoutExerciseBadges = { sets: {}, entries: {} };
    const award = (criterion: RecordCriterion, rv: RecordValue) => {
      if (!seenBefore) return;
      if (rv.setId) pushBadge(wb.sets, rv.setId, criterion);
      else pushBadge(wb.entries, rv.entryId, criterion);
      events.push({ ...rv, exerciseId, criterion });
    };

    for (const we of entries) {
      for (const set of recordSets(we)) {
        for (const c of criteriaFor(we.measurementType)) {
          if (c.scope !== 'set') continue;
          const v = c.value([set]);
          if (v === undefined) continue;
          if (isBetter(c.dir, v, bests[c.id]?.value)) {
            const rv: RecordValue = {
              value: v,
              workoutId: w.id,
              startedAt: w.started_at,
              entryId: we.id,
              setId: set.id,
            };
            award(c.id, rv);
            bests[c.id] = rv;
          }
        }
      }
    }

    const first = entries[0];
    if (first) {
      for (const c of criteriaFor(first.measurementType)) {
        if (c.scope !== 'session') continue;
        const v = c.value(entries.flatMap(recordSets));
        if (v === undefined) continue;
        if (isBetter(c.dir, v, bests[c.id]?.value)) {
          const rv: RecordValue = { value: v, workoutId: w.id, startedAt: w.started_at, entryId: first.id };
          award(c.id, rv);
          bests[c.id] = rv;
        }
      }
    }

    badges[w.id] = wb;
    seenBefore = true;
  }
  return { badges, bests, events };
}

export type WorkoutBadges = {
  sets: Record<string, RecordCriterion[]>;
  entries: Record<string, RecordCriterion[]>;
  pairs: { exerciseId: string; criterion: RecordCriterion }[]; // couples distincts (exercice, critère) battus
};

// Cette méthode permet d'obtenir les badges 🏆 d'une séance (en cours ou passée) par rapport à l'historique.
// `history` peut contenir la séance elle-même : la version passée en premier argument fait foi.
export function workoutBadges(workout: WorkoutRow, history: WorkoutRow[]): WorkoutBadges {
  const all = [...history.filter((h) => h.id !== workout.id), workout];
  const out: WorkoutBadges = { sets: {}, entries: {}, pairs: [] };
  const exerciseIds = [...new Set(workout.doc.exercises.map((e) => e.exerciseId))];
  for (const exId of exerciseIds) {
    const wb = scanExercise(exId, all).badges[workout.id];
    if (!wb) continue;
    mergeBadges(out, exId, wb);
  }
  return out;
}

function mergeBadges(out: WorkoutBadges, exerciseId: string, wb: WorkoutExerciseBadges) {
  const seen = new Set<RecordCriterion>();
  for (const [setId, list] of Object.entries(wb.sets)) {
    out.sets[setId] = [...(out.sets[setId] ?? []), ...list];
    for (const c of list) seen.add(c);
  }
  for (const [entryId, list] of Object.entries(wb.entries)) {
    out.entries[entryId] = [...(out.entries[entryId] ?? []), ...list];
    for (const c of list) seen.add(c);
  }
  for (const criterion of seen) out.pairs.push({ exerciseId, criterion });
}

// Cette méthode permet de calculer les badges de toutes les séances d'un coup (liste d'historique, statistiques).
export function allWorkoutBadges(workouts: WorkoutRow[]): Record<string, WorkoutBadges> {
  const out: Record<string, WorkoutBadges> = {};
  const byExercise = new Map<string, WorkoutRow[]>();
  for (const w of workouts) {
    if (w.deleted_at !== null) continue;
    out[w.id] = { sets: {}, entries: {}, pairs: [] };
    for (const exId of new Set(w.doc.exercises.map((e) => e.exerciseId))) {
      const list = byExercise.get(exId) ?? [];
      list.push(w);
      byExercise.set(exId, list);
    }
  }
  for (const [exId, list] of byExercise) {
    const { badges } = scanExercise(exId, list);
    for (const [wid, wb] of Object.entries(badges)) {
      const target = out[wid];
      if (target) mergeBadges(target, exId, wb);
    }
  }
  return out;
}

// Cette méthode permet de compter les records d'une séance (au plus un par exercice et par critère).
export function recordCount(badges: WorkoutBadges): number {
  return badges.pairs.length;
}

// Cette méthode permet d'obtenir les meilleurs résultats d'un exercice pour sa fiche (valeurs canoniques kg, s, km, s/km).
export function bestRecords(
  exerciseId: string,
  workouts: WorkoutRow[],
): Partial<Record<RecordCriterion, RecordValue>> {
  return scanExercise(exerciseId, workouts).bests;
}

// Cette méthode permet de lister les records battus récemment, tous exercices confondus, du plus récent au plus ancien.
export function recentRecords(workouts: WorkoutRow[], limit = 20): RecordEvent[] {
  const ids = new Set<string>();
  for (const w of workouts) if (w.deleted_at === null) for (const e of w.doc.exercises) ids.add(e.exerciseId);
  const events: RecordEvent[] = [];
  for (const id of ids) events.push(...scanExercise(id, workouts).events);
  return events.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
}
