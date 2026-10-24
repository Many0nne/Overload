import { describe, expect, it } from 'vitest';
import {
  allWorkoutBadges,
  bestRecords,
  e1rm,
  mergeRepMilestones,
  recentRecords,
  recordDays,
  recordLines,
  recordSet,
  scanExercise,
  workoutBadges,
} from './records';
import { DAY, entry, set, sets, T0, workout } from './testFixtures';
import type { MeasurementType } from './types';
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

describe('records récents regroupés (§F7.6)', () => {
  const typeOf = (id: string): MeasurementType => (id === 'run' ? 'distance_duration' : 'weight_reps');

  it('chaque record garde le meilleur résultat d’avant sa séance', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    const w2 = workout(T0 + DAY, [entry(BENCH, [set({ kg: 85, reps: 8 }), set({ kg: 90, reps: 8 })])]);
    const evs = scanExercise(BENCH, [w1, w2]).events.filter((e) => e.criterion === 'max_weight');
    expect(evs.map((e) => [e.value, e.previous])).toEqual([
      [85, 80],
      [90, 80],
    ]);
  });

  it('une ligne par séance et exercice, critère principal en premier, gain contre l’avant-séance', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    // Deux records de charge dans la même séance : 85 puis 90. Le gain se mesure contre 80 (avant la séance).
    const w2 = workout(T0 + DAY, [entry(BENCH, [set({ kg: 85, reps: 8 }), set({ kg: 90, reps: 8 })])]);
    const lines = recordLines(recentRecords([w1, w2], 200), typeOf);
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(line?.workoutId).toBe(w2.id);
    expect(line?.records.map((r) => r.criterion)).toEqual([
      'max_weight',
      'best_e1rm',
      'best_set_volume',
      'weight_at_1',
      'weight_at_3',
      'weight_at_5',
      'weight_at_8',
    ]);
    const main = line!.records[0]!;
    expect(main.value).toBe(90);
    expect(main.previous).toBe(80);
    expect(main.gain).toBe(10);
    expect(main.setId).toBe(w2.doc.exercises[0]!.sets[1]!.id);
  });

  it('le gain reste celui d’avant la séance même si la liste d’événements est tronquée', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    const w2 = workout(T0 + DAY, [entry(BENCH, [set({ kg: 85, reps: 8 }), set({ kg: 90, reps: 8 })])]);
    // On ne garde que le dernier record de charge (90 kg) : l'ancien record reste 80 kg.
    const last = recentRecords([w1, w2], 200).filter((e) => e.criterion === 'max_weight' && e.value === 90);
    expect(recordLines(last, typeOf)[0]?.records[0]?.gain).toBe(10);
  });

  it('pas de gain sans ancien résultat sur le critère (premier passage à 12 reps)', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8]))]);
    const w2 = workout(T0 + DAY, [entry(BENCH, sets(60, [12]))]);
    const at12 = recordLines(recentRecords([w1, w2], 200), typeOf)[0]?.records.find(
      (r) => r.criterion === 'weight_at_12',
    );
    expect(at12?.value).toBe(60);
    expect(at12?.previous).toBeUndefined();
    expect(at12?.gain).toBeUndefined();
  });

  it('critère « plus petit = mieux » : gain négatif (allure)', () => {
    const w1 = workout(T0, [entry('run', [set({ km: 5, s: 1600 })], 'distance_duration')]);
    const w2 = workout(T0 + DAY, [entry('run', [set({ km: 5, s: 1560 })], 'distance_duration')]);
    const pace = recordLines(recentRecords([w1, w2], 200), typeOf)[0]?.records.find(
      (r) => r.criterion === 'best_pace',
    );
    expect(pace?.gain).toBe(-8);
  });

  it('fusionne les paliers « à N reps » consécutifs de même charge', () => {
    const w1 = workout(T0, [entry(BENCH, sets(60, [8]))]);
    const w2 = workout(T0 + DAY, [entry(BENCH, [set({ kg: 62.5, reps: 8 }), set({ kg: 65, reps: 5 })])]);
    const [, ...others] = recordLines(recentRecords([w1, w2], 200), typeOf)[0]!.records;
    const merged = mergeRepMilestones(others).map((m) => [m.item.criterion, m.reps, m.item.value]);
    expect(merged).toEqual([
      ['best_e1rm', [], expect.any(Number)],
      ['best_set_volume', [], 500],
      ['weight_at_1', [1, 3, 5], 65],
      ['weight_at_8', [8], 62.5],
    ]);
  });

  it('regroupe les lignes par jour local de début de séance', () => {
    const late = new Date(2026, 0, 5, 23, 30).getTime();
    const w1 = workout(late - 2 * DAY, [entry(BENCH, sets(80, [8])), entry('row', sets(60, [8]))]);
    const w2 = workout(late - 60 * 60_000, [entry(BENCH, sets(85, [8]))]); // même soir, 22 h 30
    const w3 = workout(late, [entry('row', sets(65, [8]))]); // 23 h 30, même jour
    const w4 = workout(late + 60 * 60_000, [entry(BENCH, sets(90, [8]))]); // 0 h 30 : jour suivant
    const days = recordDays(recordLines(recentRecords([w1, w2, w3, w4], 200), typeOf));
    expect(days.map((d) => d.lines.map((l) => l.workoutId))).toEqual([[w4.id], [w3.id, w2.id]]);
    expect(days[1]?.key).toBe('2026-01-05');
  });

  it('retrouve la série d’un record de volume', () => {
    const s = set({ kg: 90, reps: 8 });
    const we = entry(BENCH, [s]);
    const w = workout(T0, [we]);
    expect(recordSet(w, { entryId: we.id, setId: s.id })).toBe(s);
    expect(recordSet(w, { entryId: we.id })).toBeUndefined();
  });

  it('trie les lignes de la plus récente à la plus ancienne', () => {
    const w1 = workout(T0, [entry(BENCH, sets(80, [8])), entry('row', sets(60, [8]))]);
    const w2 = workout(T0 + DAY, [entry('row', sets(65, [8]))]);
    const w3 = workout(T0 + 2 * DAY, [entry(BENCH, sets(85, [8]))]);
    const lines = recordLines(recentRecords([w1, w2, w3], 200), typeOf);
    expect(lines.map((l) => l.workoutId)).toEqual([w3.id, w2.id]);
  });
});
