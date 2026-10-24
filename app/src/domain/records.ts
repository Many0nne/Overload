// Records par exercice (§F7.6, §10.3). Les badges ne sont jamais stockés : ils sont dérivés de l'historique trié.
import { dayKey } from './dates';
import type { MeasurementType, WorkoutExercise, WorkoutRow, WorkoutSet } from './types';
import { toKg, toKm } from './units';

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

const CRITERION_DEFS = new Map(
  Object.values(CRITERIA)
    .flat()
    .map((c) => [c.id, c] as const),
);

// Cette méthode permet d'obtenir les critères de record suivis pour un type de mesure (table §F7.6).
export function criteriaFor(type: MeasurementType): CriterionDef[] {
  return CRITERIA[type];
}

// Cette méthode permet de retrouver la définition d'un critère, quel que soit le type de mesure qui le suit.
export function criterionDef(id: RecordCriterion): CriterionDef {
  return CRITERION_DEFS.get(id)!;
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

// `previous` : meilleur résultat avant la séance du record (absent si le critère n'avait encore aucune valeur). Il est le même
// pour tous les records d'un critère battus dans une séance : le gain se mesure contre l'avant-séance.
export type RecordEvent = RecordValue & { exerciseId: string; criterion: RecordCriterion; previous?: number };

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
    const before = { ...bests }; // meilleurs résultats au début de la séance
    const entries = w.doc.exercises.filter((e) => e.exerciseId === exerciseId);
    const wb: WorkoutExerciseBadges = { sets: {}, entries: {} };
    const award = (criterion: RecordCriterion, rv: RecordValue) => {
      if (!seenBefore) return;
      if (rv.setId) pushBadge(wb.sets, rv.setId, criterion);
      else pushBadge(wb.entries, rv.entryId, criterion);
      const previous = before[criterion]?.value;
      events.push({ ...rv, exerciseId, criterion, ...(previous !== undefined && { previous }) });
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

export type RecordLineItem = {
  criterion: RecordCriterion;
  value: number; // meilleure valeur de la séance
  previous?: number; // meilleur résultat avant la séance (absent : premier résultat sur ce critère)
  gain?: number; // value − previous : positif pour un critère « max », négatif pour un critère « min » (assistance, allure)
  workoutId: string;
  entryId: string;
  setId?: string;
};

export type RecordLine = {
  workoutId: string;
  exerciseId: string;
  startedAt: number;
  records: RecordLineItem[]; // critères battus dans l'ordre de la table §F7.6 : le premier est le critère principal
};

// Cette méthode permet de regrouper des records battus par séance et exercice, du plus récent au plus ancien : pour chaque
// critère, la meilleure valeur de la séance et le gain par rapport au meilleur résultat d'avant la séance.
export function recordLines(
  events: RecordEvent[],
  typeOf: (exerciseId: string) => MeasurementType,
): RecordLine[] {
  const groups = new Map<string, RecordEvent[]>();
  for (const e of events) {
    const key = `${e.workoutId}|${e.exerciseId}`;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }
  const lines: RecordLine[] = [];
  for (const list of groups.values()) {
    const first = list[0]!;
    const records: RecordLineItem[] = [];
    // Ordre du type de mesure actuel, puis les critères restants (type d'exercice modifié depuis la séance).
    const defs = [...criteriaFor(typeOf(first.exerciseId))];
    for (const e of list) if (!defs.some((d) => d.id === e.criterion)) defs.push(criterionDef(e.criterion));
    for (const c of defs) {
      const same = list.filter((e) => e.criterion === c.id);
      if (same.length === 0) continue;
      // Le meilleur événement de la séance porte la valeur finale ; tous partagent l'ancien record d'avant la séance.
      const best = same.reduce((a, b) => (isBetter(c.dir, b.value, a.value) ? b : a));
      const previous = best.previous;
      records.push({
        criterion: c.id,
        value: best.value,
        workoutId: best.workoutId,
        entryId: best.entryId,
        ...(best.setId !== undefined && { setId: best.setId }),
        ...(previous !== undefined && { previous, gain: best.value - previous }),
      });
    }
    if (records.length > 0)
      lines.push({
        workoutId: first.workoutId,
        exerciseId: first.exerciseId,
        startedAt: first.startedAt,
        records,
      });
  }
  return lines.sort(
    (a, b) =>
      b.startedAt - a.startedAt || (a.workoutId < b.workoutId ? -1 : a.workoutId > b.workoutId ? 1 : 0),
  );
}

// Cette méthode permet de fusionner les paliers « meilleur poids à N reps » consécutifs battus avec la même charge, pour
// n'afficher qu'une pastille (« à 1, 3 et 5 reps 65 kg ») ; `reps` est vide pour les autres critères.
export function mergeRepMilestones(items: RecordLineItem[]): { item: RecordLineItem; reps: number[] }[] {
  const out: { item: RecordLineItem; reps: number[] }[] = [];
  for (const item of items) {
    const n = item.criterion.startsWith('weight_at_') ? Number(item.criterion.slice('weight_at_'.length)) : 0;
    const last = out.at(-1);
    if (n && last && last.reps.length > 0 && last.item.value === item.value) last.reps.push(n);
    else out.push({ item, reps: n ? [n] : [] });
  }
  return out;
}

// Cette méthode permet de retrouver la série d'un record (meilleure série en volume affichée « 80 kg × 8 ») dans sa séance.
export function recordSet(
  workout: WorkoutRow | undefined,
  rv: { entryId: string; setId?: string },
): WorkoutSet | undefined {
  if (!rv.setId) return undefined;
  return workout?.doc.exercises.find((e) => e.id === rv.entryId)?.sets.find((s) => s.id === rv.setId);
}

export type RecordDay = { key: string; startedAt: number; lines: RecordLine[] };

// Cette méthode permet de regrouper des lignes de records (triées du plus récent au plus ancien) par jour de début de
// séance, dans le fuseau de l'appareil (§F7.6).
export function recordDays(lines: RecordLine[]): RecordDay[] {
  const days: RecordDay[] = [];
  for (const line of lines) {
    const key = dayKey(line.startedAt);
    const last = days.at(-1);
    if (last?.key === key) last.lines.push(line);
    else days.push({ key, startedAt: line.startedAt, lines: [line] });
  }
  return days;
}
