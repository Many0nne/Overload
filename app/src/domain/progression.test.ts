import { describe, expect, it } from 'vitest';
import {
  applyTargets,
  comebackDrop,
  computeTargets,
  type ExerciseLike,
  equivalentReps,
  parseRepRange,
  resolveRepRange,
  targetsMet,
  workoutTargetsMet,
} from './progression';
import { DAY, entry, set, sets, settings, T0, workout } from './testFixtures';
import type { MeasurementType, RepRange, Settings, WorkoutRow, WorkoutSet } from './types';

const WEEK = 7 * DAY;

// Cette méthode permet de calculer les objectifs à partir d'une suite de séances (la dernière sert de référence).
function targetsFrom(
  history: WorkoutSet[][],
  opts: {
    type?: MeasurementType;
    equipment?: ExerciseLike['equipment'];
    range?: RepRange;
    increment?: number;
    plannedCount?: number;
    gapAfterLast?: number;
    settings?: Settings;
  } = {},
) {
  const type = opts.type ?? 'weight_reps';
  const ex: ExerciseLike = { id: 'ex', equipment: opts.equipment ?? 'barbell', measurement_type: type };
  const workouts: WorkoutRow[] = history.map((s, i) => workout(T0 + i * 3 * DAY, [entry('ex', s, type)]));
  const last = workouts[workouts.length - 1]!;
  const refEx = last.doc.exercises[0]!;
  const planned = opts.plannedCount ?? refEx.sets.filter((s) => s.kind !== 'warmup').length;
  return computeTargets({
    exercise: ex,
    prefs: opts.increment ? { schemaVersion: 1, increment: { v: opts.increment, u: 'kg' } } : undefined,
    settings: opts.settings ?? settings(),
    repRange: opts.range ?? { min: 8, max: 12 },
    plannedSets: Array.from({ length: planned }, () => ({ kind: 'normal' as const })),
    history: workouts,
    reference: { exercise: refEx, startedAt: last.started_at },
    now: last.started_at + (opts.gapAfterLast ?? 3 * DAY),
  });
}

const summary = (r: ReturnType<typeof targetsFrom>) =>
  r?.sets.map((t) => `${t?.weight?.v ?? ''}x${t?.reps ?? t?.durationS ?? ''}`);

describe('équivalence de Marzagao', () => {
  it('donne les exemples de la spec', () => {
    expect(equivalentReps({ v: 80, u: 'kg' }, 12, { v: 82.5, u: 'kg' })).toBe(10);
    expect(equivalentReps({ v: 100, u: 'kg' }, 6, { v: 102.5, u: 'kg' })).toBe(5);
    expect(equivalentReps({ v: 10, u: 'kg' }, 12, { v: 12, u: 'kg' })).toBe(8);
  });
  it('en lb, donne le même résultat qu’en kg', () => {
    const lb = (kg: number) => ({ v: kg / 0.45359237, u: 'lb' as const });
    expect(equivalentReps(lb(80), 12, lb(82.5))).toBe(10);
    expect(equivalentReps(lb(10), 12, lb(12))).toBe(8);
  });
});

describe('double progression (poids et reps)', () => {
  it('80 × 12/12/12 en 8–12 → 82,5 × 10', () => {
    const r = targetsFrom([sets(80, [12, 12, 12])]);
    expect(summary(r)).toEqual(['82.5x10', '82.5x10', '82.5x10']);
    expect(r?.reason).toEqual({ kind: 'load_up', reachedReps: 12 });
  });
  it('80 × 12/11/9 → 80 × 12/12/10', () => {
    const r = targetsFrom([sets(80, [12, 11, 9])]);
    expect(summary(r)).toEqual(['80x12', '80x12', '80x10']);
    expect(r?.reason?.kind).toBe('reps_up');
  });
  it('100 × 6/6/6 en 4–6 → 102,5 × 5', () => {
    expect(summary(targetsFrom([sets(100, [6, 6, 6])], { range: { min: 4, max: 6 } }))).toEqual([
      '102.5x5',
      '102.5x5',
      '102.5x5',
    ]);
  });
  it('élévations latérales 10 × 12/12/12, incrément 2 → 12 × 8', () => {
    expect(summary(targetsFrom([sets(10, [12, 12, 12])], { equipment: 'dumbbell' }))).toEqual([
      '12x8',
      '12x8',
      '12x8',
    ]);
  });
  it('une référence à 81 kg donne 83,5 kg (pas d’arrondi à la hausse)', () => {
    expect(targetsFrom([sets(81, [12, 12])])?.sets[0]?.weight?.v).toBe(83.5);
  });
  it('échec isolé → consolidation (mêmes cibles que la dernière fois)', () => {
    const ref = sets(80, [10, 7, 6]).map((s) => ({
      ...s,
      target: { weight: { v: 80, u: 'kg' as const }, reps: 10 },
    }));
    const r = targetsFrom([ref]);
    expect(r?.reason).toEqual({ kind: 'consolidate' });
    expect(summary(r)).toEqual(['80x10', '80x10', '80x10']);
  });
  it('deux échecs consécutifs à la même charge → −10 % arrondi à l’incrément inférieur', () => {
    const r = targetsFrom([sets(82.5, [10, 7, 6]), sets(82.5, [9, 7, 7])]);
    expect(r?.reason).toEqual({ kind: 'plateau' });
    expect(summary(r)).toEqual(['72.5x8', '72.5x8', '72.5x8']);
  });
  it('plateau sur 3 séances sans hausse du total de reps', () => {
    const r = targetsFrom([sets(80, [10, 10, 9]), sets(80, [10, 9, 9]), sets(80, [10, 10, 9])]);
    expect(r?.reason).toEqual({ kind: 'plateau' });
    expect(summary(r)?.[0]).toBe('70x8'); // 80 × 0,9 = 72 → 70 (incrément 2,5)
  });
  it('pas de plateau si le total progresse', () => {
    expect(
      targetsFrom([sets(80, [10, 9, 9]), sets(80, [10, 10, 9]), sets(80, [11, 10, 10])])?.reason?.kind,
    ).toBe('reps_up');
  });
  it('reprise après 3, 5, 9 et 20 semaines', () => {
    expect(targetsFrom([sets(100, [8, 8])], { gapAfterLast: 3 * WEEK })?.reason?.kind).toBe('reps_up');
    const r5 = targetsFrom([sets(100, [8, 8])], { gapAfterLast: 5 * WEEK });
    expect(r5?.reason).toEqual({ kind: 'comeback', weeksOff: 5 });
    expect(summary(r5)).toEqual(['95x8', '95x8']);
    expect(summary(targetsFrom([sets(100, [8, 8])], { gapAfterLast: 9 * WEEK }))?.[0]).toBe('90x8');
    expect(summary(targetsFrom([sets(100, [8, 8])], { gapAfterLast: 20 * WEEK }))?.[0]).toBe('80x8');
    expect(comebackDrop(13)).toBe(0.15);
  });
  it('max > 30 : reps = min sans équivalence', () => {
    expect(summary(targetsFrom([sets(20, [40, 40])], { range: { min: 20, max: 40 } }))).toEqual([
      '22.5x20',
      '22.5x20',
    ]);
  });
  it('séries prévues en plus : reprennent la dernière série de référence', () => {
    expect(summary(targetsFrom([sets(80, [12, 11])], { plannedCount: 3 }))).toEqual([
      '80x12',
      '80x12',
      '80x12',
    ]);
  });
  it('les échauffements prévus n’ont pas d’objectif', () => {
    const w = workout(T0, [entry('ex', sets(80, [10, 10]))]);
    const r = computeTargets({
      exercise: { id: 'ex', equipment: 'barbell', measurement_type: 'weight_reps' },
      settings: settings(),
      repRange: { min: 8, max: 12 },
      plannedSets: [{ kind: 'warmup' }, { kind: 'normal' }, { kind: 'drop' }],
      history: [w],
      reference: { exercise: w.doc.exercises[0]!, startedAt: w.started_at },
      now: T0 + DAY,
    });
    expect(r?.sets[0]).toBeUndefined();
    expect(r?.sets[1]).toEqual({ weight: { v: 80, u: 'kg' }, reps: 11 });
    expect(r?.sets[2]).toBeUndefined();
  });
  it('objectif exprimé dans l’unité actuelle de l’utilisateur', () => {
    const r = targetsFrom([sets(100, [8])], {
      settings: settings({ units: { weight: 'lb', length: 'cm', distance: 'km' } }),
    });
    expect(r?.sets[0]?.weight).toEqual({ v: 220.5, u: 'lb' });
  });
});

describe('cas sans objectif', () => {
  it('premier essai', () => {
    const r = computeTargets({
      exercise: { id: 'ex', equipment: 'barbell', measurement_type: 'weight_reps' },
      settings: settings(),
      repRange: { min: 8, max: 12 },
      plannedSets: [{ kind: 'normal' }],
      history: [],
      reference: undefined,
      now: T0,
    });
    expect(r).toBeUndefined();
  });
  it('objectifs désactivés', () => {
    expect(
      targetsFrom([sets(80, [12])], { settings: settings({ progressionEnabled: false }) }),
    ).toBeUndefined();
  });
  it('poids et durée, distance et durée', () => {
    expect(targetsFrom([[set({ kg: 20, s: 60 })]], { type: 'weight_duration' })).toBeUndefined();
    expect(targetsFrom([[set({ km: 5, s: 1500 })]], { type: 'distance_duration' })).toBeUndefined();
  });
});

describe('autres types de mesure', () => {
  it('lesté : montée de charge sans équivalence (reps = min)', () => {
    const r = targetsFrom([sets(10, [12, 12])], { type: 'weighted_bw', equipment: 'bodyweight' });
    expect(summary(r)).toEqual(['12.5x8', '12.5x8']);
  });
  it('assisté : assistance −1 incrément quand max atteint, +1 en plateau', () => {
    const r = targetsFrom([sets(30, [12, 12])], { type: 'assisted_bw', equipment: 'machine' });
    expect(summary(r)).toEqual(['25x8', '25x8']);
    expect(r?.reason).toEqual({ kind: 'load_up', reachedReps: 12, assistanceDrop: { v: 5, u: 'kg' } });
    const p = targetsFrom([sets(30, [6, 6]), sets(30, [7, 6])], {
      type: 'assisted_bw',
      equipment: 'machine',
    });
    expect(p?.reason?.kind).toBe('plateau');
    expect(summary(p)).toEqual(['35x8', '35x8']);
  });
  it('poids du corps : +1 rep, plafonné à max si fourchette', () => {
    const ref = [set({ reps: 15 }), set({ reps: 12 })];
    expect(summary(targetsFrom([ref], { type: 'bodyweight', equipment: 'bodyweight' }))).toEqual([
      'x12',
      'x12',
    ]);
    const ex: ExerciseLike = { id: 'ex', equipment: 'bodyweight', measurement_type: 'bodyweight' };
    const w = workout(T0, [entry('ex', [set({ reps: 15 }), set({ reps: 12 })], 'bodyweight')]);
    const r = computeTargets({
      exercise: ex,
      settings: settings(),
      repRange: undefined,
      plannedSets: [{ kind: 'normal' }, { kind: 'normal' }],
      history: [w],
      reference: { exercise: w.doc.exercises[0]!, startedAt: w.started_at },
      now: T0 + DAY,
    });
    expect(r?.sets.map((t) => t?.reps)).toEqual([16, 13]);
  });
  it('durée : +5 % arrondi à 5 s, au moins +5 s', () => {
    expect(summary(targetsFrom([[set({ s: 60 })]], { type: 'duration', equipment: 'bodyweight' }))).toEqual([
      'x65',
    ]);
    expect(summary(targetsFrom([[set({ s: 200 })]], { type: 'duration', equipment: 'bodyweight' }))).toEqual([
      'x210',
    ]);
  });
});

describe('objectifs figés et objectifs atteints', () => {
  it('objectif figé : non recalculé après modification d’une séance antérieure', () => {
    const r = targetsFrom([sets(80, [12, 12, 12])]);
    const live = applyTargets(
      entry(
        'ex',
        sets(0, [0, 0, 0]).map((s) => ({ ...s, done: false })),
      ),
      r,
    );
    const frozen = structuredClone(live);
    // Une séance antérieure modifiée change les objectifs futurs, pas ceux déjà écrits dans la séance.
    const r2 = targetsFrom([sets(80, [10, 10, 10])]);
    expect(r2?.sets[0]?.reps).toBe(11);
    expect(live).toEqual(frozen);
    expect(live.sets[0]?.target).toEqual({ weight: { v: 82.5, u: 'kg' }, reps: 10 });
    expect(live.sets[0]?.weight).toEqual({ v: 82.5, u: 'kg' });
    expect(live.targetCount).toBe(3);
  });

  it('targetsMet : atteint, non atteint, série supprimée, sans objectif', () => {
    const r = targetsFrom([sets(80, [12, 12])]);
    const we = applyTargets(entry('ex', sets(0, [0, 0])), r);
    const done = { ...we, sets: we.sets.map((s) => ({ ...s, done: true })) };
    expect(targetsMet(done)).toBe(true);
    const short = { ...done, sets: done.sets.map((s, i) => (i === 1 ? { ...s, reps: 9 } : s)) };
    expect(targetsMet(short)).toBe(false);
    const removed = { ...done, sets: done.sets.slice(0, 1) };
    expect(targetsMet(removed)).toBe(false);
    expect(targetsMet(entry('ex', sets(80, [8])))).toBeUndefined();
    expect(
      workoutTargetsMet({ schemaVersion: 1, title: '', exercises: [done, short, entry('x', sets(1, [1]))] }),
    ).toEqual({
      met: 1,
      total: 2,
    });
  });
});

describe('fourchettes', () => {
  it('résolution : routine, réglage, dernière routine, 8–12', () => {
    expect(resolveRepRange({ measurementType: 'weight_reps', routineRange: { min: 5, max: 5 } })).toEqual({
      min: 5,
      max: 5,
    });
    expect(
      resolveRepRange({
        measurementType: 'weight_reps',
        prefs: { schemaVersion: 1, defaultRepRange: { min: 6, max: 8 } },
      }),
    ).toEqual({ min: 6, max: 8 });
    expect(resolveRepRange({ measurementType: 'weight_reps', lastRoutineRange: { min: 3, max: 5 } })).toEqual(
      { min: 3, max: 5 },
    );
    expect(resolveRepRange({ measurementType: 'weight_reps' })).toEqual({ min: 8, max: 12 });
    expect(resolveRepRange({ measurementType: 'duration' })).toBeUndefined();
  });
  it('saisie « 8–12 » ou « 8 »', () => {
    expect(parseRepRange('8–12')).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('8')).toEqual({ min: 8, max: 8 });
    expect(parseRepRange('12-8')).toBeUndefined();
  });
});
