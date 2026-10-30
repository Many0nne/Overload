import { describe, expect, it } from 'vitest';
import { heatHighlights } from './bodyMap';
import { addDays, addMonths } from './dates';
import { formatVolume } from './format';
import {
  averageRpe,
  goalsProgress,
  muscleBalance,
  muscleVolume,
  periodRange,
  recordsByMonth,
  recordsIn,
  repZones,
  routineUsage,
  setKindSplit,
  targetRate,
  totals,
} from './insights';
import type { RecordEvent } from './records';
import type { MuscleInfo } from './stats';
import { DAY, entry, set, sets, settings, T0, workout } from './testFixtures';
import type { WorkoutExercise } from './types';

const ALL = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY] as const;

describe('periodRange', () => {
  it('30 jours : fenêtre et fenêtre précédente de même durée', () => {
    const r = periodRange('30d', T0);
    expect(r.from).toBe(addDays(T0, -30));
    expect(r.prevFrom).toBe(addDays(T0, -60));
    expect(r.to).toBe(T0 + 1);
  });
  it('mois calendaires pour 3 mois et 1 an', () => {
    expect(periodRange('3m', T0).from).toBe(addMonths(T0, -3));
    expect(periodRange('1y', T0).prevFrom).toBe(addMonths(T0, -24));
  });
  it('« tout » sans fenêtre précédente', () => {
    const r = periodRange('all', T0);
    expect(r.from).toBe(Number.NEGATIVE_INFINITY);
    expect(r.prevFrom).toBeUndefined();
  });
});

describe('totals', () => {
  const ex1 = [
    entry('bench', [set({ kind: 'warmup', kg: 40, reps: 10 }), ...sets(60, [8, 8])]),
    entry('pullup', [set({ reps: 10 })], 'bodyweight'),
  ];
  const w1 = workout(T0, ex1, { doc: { schemaVersion: 1, title: 'A', durationS: 3600, exercises: ex1 } });
  const ex2 = [entry('bench', sets(62.5, [5]))];
  const w2 = workout(T0 + 2 * DAY, ex2, {
    doc: { schemaVersion: 1, title: 'B', durationS: 1800, exercises: ex2 },
  });
  const deleted = workout(T0 + DAY, [entry('bench', sets(100, [5]))], { deleted_at: T0 + DAY });
  const inProgress = workout(T0 + DAY, [entry('bench', sets(100, [5]))], { status: 'in_progress' });

  it('cumule séances, durée, volume, séries et reps hors échauffement, exercices distincts', () => {
    const t = totals([w1, w2, deleted, inProgress]);
    expect(t.count).toBe(2);
    expect(t.durationS).toBe(5400);
    expect(t.volumeKg).toBe(60 * 16 + 62.5 * 5);
    expect(t.sets).toBe(4);
    expect(t.reps).toBe(8 + 8 + 10 + 5);
    expect(t.exercises).toBe(2);
    expect(t.firstAt).toBe(T0);
  });
  it('filtre sur le jour de début (fin exclue)', () => {
    const t = totals([w1, w2], T0 + 1, T0 + 2 * DAY);
    expect(t.count).toBe(0);
    expect(totals([w1, w2], T0 + 1, T0 + 2 * DAY + 1).count).toBe(1);
  });
});

describe('records sur une fenêtre', () => {
  const ev = (
    workoutId: string,
    exerciseId: string,
    criterion: RecordEvent['criterion'],
    startedAt: number,
  ) => ({ workoutId, exerciseId, criterion, startedAt, value: 1, entryId: 'e' }) as RecordEvent;
  const events = [
    ev('w1', 'bench', 'max_weight', T0),
    ev('w1', 'bench', 'max_weight', T0), // battu deux fois dans la séance : compte une fois
    ev('w1', 'bench', 'best_e1rm', T0),
    ev('w2', 'squat', 'max_weight', addMonths(T0, -1)),
  ];
  it('compte au plus un record par séance, exercice et critère', () => {
    expect(recordsIn(events, ...ALL)).toBe(3);
  });
  it('répartit par mois civil, mois vides compris, du plus ancien au plus récent', () => {
    const months = recordsByMonth(events, T0, 3);
    expect(months.map((m) => m.count)).toEqual([0, 1, 2]);
    expect(months[2]!.monthStart).toBe(new Date(2026, 0, 1).getTime());
    expect(months[0]!.monthStart).toBe(new Date(2025, 10, 1).getTime());
  });
});

describe('muscles', () => {
  const info: Record<string, MuscleInfo> = {
    bench: { primary_muscle: 'chest', secondary_muscles: ['triceps', 'shoulders'] },
    row: { primary_muscle: 'back', secondary_muscles: ['biceps'] },
    squat: { primary_muscle: 'quads', secondary_muscles: ['glutes'] },
  };
  const w = workout(T0, [
    entry('bench', [set({ kind: 'warmup', kg: 40, reps: 10 }), ...sets(100, [5])]),
    entry('row', sets(50, [10])),
  ]);

  it('répartit le volume comme les séries : principal 100 %, secondaire 50 %', () => {
    const v = muscleVolume([w], (id) => info[id], ...ALL);
    expect(v.chest).toBe(500);
    expect(v.triceps).toBe(250);
    expect(v.back).toBe(500);
    expect(v.biceps).toBe(250);
  });
  it('calcule pousser/tirer et haut/bas, sans abdos ni lombaires', () => {
    const b = muscleBalance({ chest: 6, triceps: 2, back: 4, quads: 3, abs: 10 });
    expect(b.push).toBeCloseTo(8 / 12);
    expect(b.upper).toBeCloseTo(12 / 15);
    expect(muscleBalance({ abs: 3 })).toEqual({ push: undefined, upper: undefined });
  });
  it('colore la carte en 4 niveaux proportionnels au muscle le plus sollicité', () => {
    const h = heatHighlights({ chest: 40, back: 10, triceps: 0, shoulders: 21 });
    expect(h.get('chest')).toBe('h4');
    expect(h.get('upperBack')).toBe('h1');
    expect(h.get('deltoids')).toBe('h3');
    expect(h.get('rotatorCuff')).toBe('h3'); // partagée dos / épaules : le plus haut niveau
    expect(h.has('triceps')).toBe(false);
    expect(heatHighlights({}).size).toBe(0);
  });
});

describe('objectifs de séance', () => {
  // Cette méthode permet de fabriquer un exercice avec objectif (reps visées) et une raison.
  const target = (reps: number[], goal: number, kind: 'load_up' | 'reps_up'): WorkoutExercise => ({
    ...entry(
      'bench',
      reps.map((r) => ({ ...set({ kg: 60, reps: r }), target: { weight: { v: 60, u: 'kg' }, reps: goal } })),
    ),
    targetCount: reps.length,
    targetReason: kind === 'load_up' ? { kind, reachedReps: goal } : { kind },
  });
  it('compte les exercices atteints, au global et par raison', () => {
    const w = workout(T0, [
      target([8, 8], 8, 'load_up'),
      target([8, 7], 8, 'reps_up'),
      entry('row', sets(50, [10])),
    ]);
    const r = targetRate([w], ...ALL);
    expect(r).toMatchObject({ met: 1, total: 2 });
    expect(r.byReason.load_up).toEqual({ met: 1, total: 1 });
    expect(r.byReason.reps_up).toEqual({ met: 0, total: 1 });
  });
});

describe('séances', () => {
  const w = workout(T0, [
    entry('bench', [
      set({ kind: 'warmup', kg: 40, reps: 10 }),
      { ...set({ kg: 100, reps: 3 }), rpe: 9 },
      { ...set({ kg: 80, reps: 8 }), rpe: 8 },
      set({ kind: 'drop', kg: 60, reps: 15 }),
      set({ kind: 'failure', kg: 60, reps: 14 }),
      set({ kg: 80, reps: 8, done: false }),
    ]),
    entry('plank', [set({ s: 60 })], 'duration'),
  ]);

  it('compte les séries validées par type', () => {
    expect(setKindSplit([w], ...ALL)).toEqual({ normal: 3, warmup: 1, drop: 1, failure: 1 });
  });
  it('répartit les séries de travail chargées par zone de reps (dégressives et échauffements exclus)', () => {
    expect(repZones([w], ...ALL)).toEqual({ strength: 1, hypertrophy: 1, endurance: 1 });
  });
  it('fait la moyenne du RPE des séries notées ; undefined sans RPE', () => {
    expect(averageRpe([w], ...ALL)).toEqual({ avg: 8.5, count: 2 });
    expect(averageRpe([workout(T0, [entry('bench', sets(60, [8]))])], ...ALL)).toBeUndefined();
  });
  it('ignore le RPE des exercices où il est désactivé (issue #124)', () => {
    expect(averageRpe([w], ...ALL, new Set(['bench']))).toBeUndefined();
    expect(averageRpe([w], ...ALL, new Set(['plank']))).toEqual({ avg: 8.5, count: 2 });
  });
  it('classe les routines par nombre de séances, séances libres regroupées', () => {
    const ws = [
      workout(T0, [], {
        routine_id: 'push',
        doc: { schemaVersion: 1, title: 'Push – lundi', exercises: [] },
      }),
      workout(T0 + DAY, [], { routine_id: null, doc: { schemaVersion: 1, title: 'Libre', exercises: [] } }),
      workout(T0 + 2 * DAY, [], {
        routine_id: 'push',
        doc: { schemaVersion: 1, title: 'Push – mercredi', exercises: [] },
      }),
      workout(T0 + 3 * DAY, [], {
        routine_id: 'legs',
        doc: { schemaVersion: 1, title: 'Legs', exercises: [] },
      }),
    ];
    expect(routineUsage(ws, ...ALL)).toEqual([
      { routineId: 'push', count: 2, lastTitle: 'Push – mercredi' },
      { routineId: 'legs', count: 1, lastTitle: 'Legs' },
      { routineId: null, count: 1, lastTitle: 'Libre' },
    ]);
  });
});

describe('objectifs à long terme', () => {
  const goal = { weight: { v: 100, u: 'kg' as const }, reps: 5, setAt: T0 };
  it('rapporte le 1RM estimé de la dernière semaine au 1RM visé', () => {
    const ws = [workout(T0 + DAY, [entry('bench', sets(80, [5]))])];
    const [g] = goalsProgress([{ exerciseId: 'bench', goal }], ws, settings(), T0 + 2 * DAY);
    expect(g!.goalKg).toBeCloseTo(100 * (1 + 5 / 30));
    expect(g!.progress).toBeCloseTo(0.8);
    expect(g!.achieved).toBe(false);
    expect(g!.goalAt).toBeUndefined(); // pas assez de semaines pour une tendance
  });
  it('objectif atteint après sa fixation → 100 %', () => {
    const ws = [workout(T0 + DAY, [entry('bench', sets(100, [5]))])];
    const [g] = goalsProgress([{ exerciseId: 'bench', goal }], ws, settings(), T0 + 2 * DAY);
    expect(g).toMatchObject({ achieved: true, progress: 1 });
  });
  it('sans séance : 0 %', () => {
    const [g] = goalsProgress([{ exerciseId: 'bench', goal }], [], settings(), T0);
    expect(g).toMatchObject({ progress: 0, currentKg: undefined });
  });
});

describe('formatVolume', () => {
  it('en kg ou lb entiers sous 10 000', () => {
    expect(formatVolume(8450.4, 'kg')).toBe('8 450 kg');
  });
  it('en tonnes ou milliers de lb au-delà', () => {
    expect(formatVolume(94_600, 'kg')).toBe('94,6 t');
    expect(formatVolume(94_600, 'lb')).toBe('208,6 k lb');
  });
});
