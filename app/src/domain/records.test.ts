import { describe, expect, it } from 'vitest';
import { allWorkoutBadges, bestRecords, e1rm, recentRecords, scanExercise, workoutBadges } from './records';
import { DAY, entry, set, sets, T0, workout } from './testFixtures';
import { exerciseVolumeKg } from './volume';

const BENCH = 'bench';

describe('1RM estimé (Epley)', () => {
  it('vaut la charge à 1 rep, Epley jusqu’à 12, rien au-delà', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 12)).toBeCloseTo(140, 9);
    expect(e1rm(100, 13)).toBeUndefined();
  });
});

describe('volume', () => {
  it('ne compte que la charge externe des séries validées hors échauffement', () => {
    const we = entry(BENCH, [
      set({ kg: 40, reps: 10, kind: 'warmup' }),
      set({ kg: 80, reps: 8 }),
      set({ kg: 80, reps: 8, done: false }),
    ]);
    expect(exerciseVolumeKg(we)).toBe(640);
    expect(exerciseVolumeKg(entry('pushup', [set({ reps: 20 })], 'bodyweight'))).toBe(0);
    expect(exerciseVolumeKg(entry('dips', [set({ kg: 10, reps: 8 })], 'weighted_bw'))).toBe(80);
  });
});

describe('records', () => {
  it('premier essai : aucun badge', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8, 9]))]);
    expect(Object.keys(workoutBadges(w1, []).sets)).toHaveLength(0);
  });

  it('« à au moins N reps » : 100 × 6 compte pour 1, 3 et 5 reps', () => {
    const w1 = workout(T0, [entry(BENCH, sets(50, [12]))]);
    const s = set({ kg: 100, reps: 6 });
    const w2 = workout(T0 + DAY, [entry(BENCH, [s])]);
    const b = workoutBadges(w2, [w1]);
    expect(b.sets[s.id]).toEqual(
      expect.arrayContaining(['weight_at_1', 'weight_at_3', 'weight_at_5', 'max_weight', 'best_e1rm']),
    );
    expect(b.sets[s.id]).not.toContain('weight_at_8');
  });

  it('égaler son record ne compte pas', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    const s = set({ kg: 80, reps: 8 });
    const w2 = workout(T0 + DAY, [entry(BENCH, [s])]);
    expect(workoutBadges(w2, [w1]).sets[s.id]).toBeUndefined();
  });

  it('plusieurs records dans une séance : badge sur chaque série, compteur unique par critère', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    const a = set({ kg: 85, reps: 8 });
    const b = set({ kg: 90, reps: 8 });
    const w2 = workout(T0 + DAY, [entry(BENCH, [a, b])]);
    const badges = workoutBadges(w2, [w1]);
    expect(badges.sets[a.id]).toContain('max_weight');
    expect(badges.sets[b.id]).toContain('max_weight');
    expect(badges.pairs.filter((p) => p.criterion === 'max_weight')).toHaveLength(1);
  });

  it('les échauffements ne comptent jamais', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    const s = set({ kg: 120, reps: 1, kind: 'warmup' });
    const w2 = workout(T0 + DAY, [entry(BENCH, [s])]);
    expect(workoutBadges(w2, [w1]).sets[s.id]).toBeUndefined();
  });

  it('recalcul après modification d’une séance antérieure', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    const w2 = workout(T0 + DAY, [entry(BENCH, sets(85, [8]))]);
    const s3 = set({ kg: 90, reps: 8 });
    const w3 = workout(T0 + 2 * DAY, [entry(BENCH, [s3])]);
    expect(allWorkoutBadges([w1, w2, w3])[w3.id]!.sets[s3.id]).toContain('max_weight');
    // On corrige la séance 2 : 95 kg. La séance 3 n'est plus un record de charge.
    const w2b = { ...w2, doc: { ...w2.doc, exercises: [entry(BENCH, sets(95, [8]))] } };
    expect(allWorkoutBadges([w1, w2b, w3])[w3.id]!.sets[s3.id] ?? []).not.toContain('max_weight');
    // Suppression de la séance 2 : le record revient.
    const w2c = { ...w2, deleted_at: T0 };
    expect(allWorkoutBadges([w1, w2c, w3])[w3.id]!.sets[s3.id]).toContain('max_weight');
  });

  it('record « plus de reps sur une séance » porté par l’exercice', () => {
    const w1 = workout(T0, [entry('pushup', [set({ reps: 20 }), set({ reps: 20 })], 'bodyweight')]);
    const e2 = entry('pushup', [set({ reps: 15 }), set({ reps: 15 }), set({ reps: 15 })], 'bodyweight');
    const w2 = workout(T0 + DAY, [e2]);
    const b = workoutBadges(w2, [w1]);
    expect(b.entries[e2.id]).toEqual(['session_reps']);
  });

  it('assistance : la plus faible gagne', () => {
    const w1 = workout(T0, [entry('pullup', [set({ kg: 30, reps: 8 })], 'assisted_bw')]);
    const s = set({ kg: 25, reps: 6 });
    const w2 = workout(T0 + DAY, [entry('pullup', [s], 'assisted_bw')]);
    expect(workoutBadges(w2, [w1]).sets[s.id]).toEqual(['min_assistance']);
  });

  it('comparaison sur valeurs exactes : un arrondi de conversion ne crée pas de record', () => {
    // 100 kg = 220,46 lb ; 220,5 lb s'afficherait pareil mais est plus lourd, 220,4 lb ne l'est pas.
    const w1 = workout(T0, [entry(BENCH, sets(100, [5]))]);
    const s = set({ lb: 220.4, reps: 5 });
    const w2 = workout(T0 + DAY, [entry(BENCH, [s])]);
    expect(workoutBadges(w2, [w1]).sets[s.id]).toBeUndefined();
  });

  it('meilleurs résultats et records récents', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    const w2 = workout(T0 + DAY, [entry(BENCH, sets(90, [5]))]);
    const best = bestRecords(BENCH, [w1, w2]);
    expect(best.max_weight?.value).toBe(90);
    expect(best.weight_at_8?.value).toBe(80);
    expect(recentRecords([w1, w2])[0]?.workoutId).toBe(w2.id);
    expect(scanExercise(BENCH, [w1, w2]).events.every((e) => e.workoutId === w2.id)).toBe(true);
  });
});
