import { describe, expect, it } from 'vitest';
import { exerciseSeries } from './charts';
import { addWeeks, MONTH_MS, WEEK_MS, weekStart } from './dates';
import { DAY, entry, set, sets, settings, T0, workout } from './testFixtures';
import {
  currentRate,
  fitTrend,
  goalAchievedSet,
  goalDate,
  project,
  type TrendPoint,
  trainingOrigin,
  weeklyE1rmPoints,
} from './trend';

const ORIGIN = weekStart(T0);

// Cette méthode permet de fabriquer des points synthétiques a + b ln(t) sur des semaines données.
function synth(a: number, b: number, weeks: number[]): TrendPoint[] {
  return weeks.map((w) => ({ weekStart: addWeeks(ORIGIN, w), e1rmKg: a + b * Math.log(w + 1) }));
}

describe('tendance linéaire-log', () => {
  it('moins de 6 points → undefined', () => {
    expect(fitTrend(synth(80, 5, [0, 2, 4, 6, 8]), ORIGIN)).toBeUndefined();
  });
  it('étendue inférieure à 8 semaines → undefined', () => {
    expect(fitTrend(synth(80, 5, [0, 1, 2, 3, 4, 5]), ORIGIN)).toBeUndefined();
  });
  it('retrouve a + b ln t à 1e-6 près', () => {
    const t = fitTrend(synth(80, 5, [0, 1, 3, 5, 8, 12, 20]), ORIGIN)!;
    expect(t.a).toBeCloseTo(80, 6);
    expect(t.b).toBeCloseTo(5, 6);
    expect(t.status).toBe('up');
  });
  it('pente nulle → flat', () => {
    const pts = [0, 1, 3, 5, 8, 12].map((w) => ({ weekStart: addWeeks(ORIGIN, w), e1rmKg: 100 }));
    expect(fitTrend(pts, ORIGIN)?.status).toBe('flat');
  });
  it('plafond de 4 % par mois actif', () => {
    const t = fitTrend(synth(60, 40, [0, 1, 2, 3, 5, 8]), ORIGIN)!;
    const now = addWeeks(ORIGIN, 8);
    const yNow = 60 + 40 * Math.log(9);
    const at = now + 12 * WEEK_MS;
    const capped = yNow * (1 + 0.04 * ((12 * WEEK_MS) / MONTH_MS));
    expect(project(t, at, now)).toBeCloseTo(capped, 6);
    expect(currentRate(t, now)).toBeLessThanOrEqual(yNow * 0.04 + 1e-9);
  });
  it('origine bornée à la première séance', () => {
    const first = T0;
    expect(trainingOrigin(settings(), first)).toBe(first);
    expect(
      trainingOrigin(settings({ trainingAge: { bucket: 'none', declaredAt: first + 10 * DAY } }), first),
    ).toBe(first);
    const declared = first + 30 * DAY;
    const origin = trainingOrigin(
      settings({ trainingAge: { bucket: '1to2y', declaredAt: declared } }),
      first,
    );
    expect(origin).toBeLessThan(first);
    expect(new Date(origin).getMonth()).toBe((new Date(declared).getMonth() + 12 - 6) % 12);
  });
  it('date d’atteinte : au-delà de 52 semaines → undefined', () => {
    const t = fitTrend(synth(80, 5, [0, 1, 3, 5, 8, 12, 20]), ORIGIN)!;
    const now = addWeeks(ORIGIN, 20);
    expect(goalDate(t, { weight: { v: 200, u: 'kg' }, reps: 1, setAt: 0 }, now)).toBeUndefined();
    const near = goalDate(t, { weight: { v: 97, u: 'kg' }, reps: 1, setAt: 0 }, now);
    expect(near).toBeGreaterThan(now);
    expect(near! - now).toBeLessThan(52 * WEEK_MS);
  });
});

describe('points hebdomadaires et objectif à long terme', () => {
  it('meilleur 1RM par semaine, séries de travail de 12 reps au plus', () => {
    const w1 = workout(T0, [
      entry('bench', [set({ kg: 100, reps: 15 }), set({ kg: 80, reps: 10, kind: 'drop' }), ...sets(80, [6])]),
    ]);
    const w2 = workout(T0 + DAY, [entry('bench', sets(90, [3]))]);
    const pts = weeklyE1rmPoints('bench', [w1, w2]);
    expect(pts).toHaveLength(1);
    expect(pts[0]?.e1rmKg).toBeCloseTo(99, 9);
  });
  it('badge 🎯 seulement sur la première série après setAt', () => {
    const goal = { weight: { v: 100, u: 'kg' as const }, reps: 5, setAt: T0 + DAY / 2 };
    const before = workout(T0, [entry('bench', sets(100, [5]))]);
    const s1 = set({ kg: 100, reps: 6 });
    const after = workout(T0 + DAY, [
      entry('bench', [set({ kg: 100, reps: 4 }), s1, set({ kg: 105, reps: 5 })]),
    ]);
    expect(goalAchievedSet('bench', [before, after], goal)).toEqual({ workoutId: after.id, setId: s1.id });
  });
  it('courbes par période', () => {
    const now = T0 + 400 * DAY;
    const old = workout(T0, [entry('bench', sets(80, [8]))]);
    const recent = workout(now - 10 * DAY, [entry('bench', sets(90, [8]))]);
    expect(exerciseSeries('bench', [old, recent], 'max_weight', '1m', now).map((p) => p.v)).toEqual([90]);
    expect(exerciseSeries('bench', [old, recent], 'session_volume', 'all', now).map((p) => p.v)).toEqual([
      640, 720,
    ]);
  });
});
