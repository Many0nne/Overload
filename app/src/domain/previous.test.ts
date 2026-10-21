import { describe, expect, it } from 'vitest';
import { dayKey, weekStart } from './dates';
import { checkSet, equivalentSet, lastTime, prefillValues } from './previous';
import { diffRoutine, workoutToRoutine } from './routineDiff';
import { currentWeekDays, muscleDistribution, trainingDays, weeklyAggregates, weekStreak } from './stats';
import { DAY, entry, set, sets, T0, workout } from './testFixtures';
import type { RoutineDoc } from './types';

describe('« Précédent »', () => {
  it('dernière fois : même routine d’abord, sinon toute séance', () => {
    const a = workout(T0, [entry('bench', sets(80, [8]))], { routine_id: 'r1' });
    const b = workout(T0 + DAY, [entry('bench', sets(70, [8]))], { routine_id: 'r2' });
    expect(lastTime('bench', 'r1', T0 + 2 * DAY, [a, b])?.id).toBe(a.id);
    expect(lastTime('bench', null, T0 + 2 * DAY, [a, b])?.id).toBe(b.id);
    expect(lastTime('bench', 'r3', T0 + 2 * DAY, [a, b])?.id).toBe(b.id);
    expect(lastTime('bench', null, T0, [a, b])).toBeUndefined();
  });

  it('série équivalente par type : un échauffement ajouté ne décale pas les lignes', () => {
    const prev = [set({ kg: 80, reps: 8 }), set({ kg: 80, reps: 7 })];
    const today = ['warmup', 'normal', 'normal', 'normal'] as const;
    expect(equivalentSet([...today], 0, prev)).toBeUndefined();
    expect(equivalentSet([...today], 1, prev)?.reps).toBe(8);
    expect(equivalentSet([...today], 2, prev)?.reps).toBe(7);
    expect(equivalentSet([...today], 3, prev)).toBeUndefined();
  });

  it('pré-remplissage : objectif, puis routine, puis précédent', () => {
    const prev = set({ kg: 80, reps: 8 });
    expect(prefillValues('weight_reps', { previous: prev })).toEqual({ weight: { v: 80, u: 'kg' }, reps: 8 });
    expect(
      prefillValues('weight_reps', {
        target: { weight: { v: 82.5, u: 'kg' }, reps: 10 },
        routineSet: { id: 'x', kind: 'normal', weight: { v: 70, u: 'kg' } },
        previous: prev,
      }),
    ).toEqual({ weight: { v: 82.5, u: 'kg' }, reps: 10 });
    expect(
      prefillValues('weight_reps', {
        routineSet: { id: 'x', kind: 'normal', weight: { v: 70, u: 'kg' } },
        previous: prev,
      }),
    ).toEqual({ weight: { v: 70, u: 'kg' }, reps: 8 });
  });

  it('cocher remplit le champ vide depuis Précédent, sinon refuse', () => {
    const s = set({ kg: 80, done: false });
    const ok = checkSet(s, 'weight_reps', set({ kg: 80, reps: 6 }), 1);
    expect(ok.ok && ok.set.reps === 6 && ok.set.done).toBe(true);
    const ko = checkSet(s, 'weight_reps', undefined, 1);
    expect(ko).toEqual({ ok: false, missing: ['reps'] });
  });
});

describe('différence avec la routine', () => {
  const routine: RoutineDoc = {
    schemaVersion: 1,
    name: 'Push',
    exercises: [
      {
        id: 'a',
        exerciseId: 'bench',
        restS: 90,
        repRange: { min: 8, max: 12 },
        sets: [
          { id: '1', kind: 'normal' },
          { id: '2', kind: 'normal' },
        ],
      },
    ],
  };
  const names = (id: string) => ({ bench: 'Développé couché', dips: 'Dips' })[id] ?? id;

  it('poids modifié : pas de différence', () => {
    const doc = { schemaVersion: 1 as const, title: 't', exercises: [entry('bench', sets(100, [3, 3]))] };
    expect(diffRoutine(doc, routine, names).changed).toBe(false);
  });

  it('séries non validées ignorées, exercice ajouté et repos modifié résumés', () => {
    const bench = {
      ...entry('bench', [...sets(80, [8, 8]), set({ kg: 80, reps: 8, done: false })]),
      restS: 120,
    };
    const doc = {
      schemaVersion: 1 as const,
      title: 't',
      exercises: [bench, entry('dips', [set({ reps: 10 })], 'bodyweight')],
    };
    const d = diffRoutine(doc, routine, names);
    expect(d.changed).toBe(true);
    expect(d.summary).toContain('+1 exercice : Dips');
    expect(d.summary).toContain('Repos développé couché : 90 s → 120 s');
  });

  it('mise à jour : conserve la fourchette, poids réalisés en cibles, séries non validées ignorées', () => {
    let n = 0;
    const doc = {
      schemaVersion: 1 as const,
      title: 't',
      exercises: [entry('bench', [...sets(85, [8, 8, 8]), set({ kg: 85, reps: 8, done: false })])],
    };
    const r = workoutToRoutine(doc, { name: 'Push', existing: routine, newId: () => `n${++n}` });
    expect(r.exercises[0]?.repRange).toEqual({ min: 8, max: 12 });
    expect(r.exercises[0]?.sets).toHaveLength(3);
    expect(r.exercises[0]?.sets[0]?.weight).toEqual({ v: 85, u: 'kg' });
  });
});

describe('dates et statistiques', () => {
  it('une séance à cheval sur minuit appartient au jour de son début', () => {
    const start = new Date(2026, 2, 10, 23, 30).getTime();
    const w = workout(start, [entry('bench', sets(80, [8]))], {
      doc: { schemaVersion: 1, title: 't', durationS: 5400, exercises: [] },
    });
    expect([...trainingDays([w])]).toEqual(['2026-03-10']);
    expect(dayKey(start)).toBe('2026-03-10');
  });

  it('semaine du lundi au dimanche', () => {
    const sunday = new Date(2026, 0, 11, 20).getTime();
    expect(weekStart(sunday)).toBe(new Date(2026, 0, 5).getTime());
  });

  it('série de semaines : la semaine en cours ne casse pas la série', () => {
    const now = new Date(2026, 0, 21, 12).getTime(); // mercredi
    const lastWeek = workout(new Date(2026, 0, 14).getTime(), []);
    const twoWeeks = workout(new Date(2026, 0, 7).getTime(), []);
    expect(weekStreak([lastWeek, twoWeeks], now)).toBe(2);
    expect(weekStreak([lastWeek, twoWeeks, workout(new Date(2026, 0, 20).getTime(), [])], now)).toBe(3);
    expect(weekStreak([twoWeeks], now)).toBe(0);
  });

  it('agrégats hebdomadaires et répartition musculaire', () => {
    const w = workout(T0, [
      entry('bench', [set({ kg: 40, reps: 10, kind: 'warmup' }), ...sets(80, [10, 10])]),
    ]);
    const agg = weeklyAggregates([w], T0 + DAY, 2);
    expect(agg).toHaveLength(2);
    expect(agg[1]).toMatchObject({ count: 1, volumeKg: 1600 });
    const dist = muscleDistribution(
      [w],
      () => ({ primary_muscle: 'chest', secondary_muscles: ['triceps'] }),
      0,
      T0 + DAY,
    );
    expect(dist).toEqual({ chest: 2, triceps: 1 });
    expect(currentWeekDays([w], T0).filter((d) => d.trained)).toHaveLength(1);
  });
});
