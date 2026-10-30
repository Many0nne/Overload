import { describe, expect, it } from 'vitest';
import catalog from '../data/catalog.generated.json';
import {
  CATALOG_OPTION_DEFAULTS,
  defaultExerciseOptions,
  exerciseOptions,
  optionPatch,
  rpeHiddenIds,
} from './exerciseOptions';
import type { ExercisePrefsDoc, ExerciseRow } from './types';

const WARM = { user_id: null, source_id: 'overload:Warm_Up' };
const BENCH = { user_id: null, source_id: 'Barbell_Bench_Press_-_Medium_Grip' };
const MINE = { user_id: 'u1', source_id: 'overload:Warm_Up' };

describe('réglages par exercice (issue #124)', () => {
  it('actifs par défaut, sauf pour les exercices du catalogue qui en décident autrement', () => {
    expect(defaultExerciseOptions(BENCH)).toEqual({ rpe: true, progression: true });
    expect(defaultExerciseOptions(undefined)).toEqual({ rpe: true, progression: true });
    expect(defaultExerciseOptions(WARM)).toEqual({ rpe: false, progression: false });
    // Un exercice perso ne reprend pas le défaut du catalogue, même avec le même source_id.
    expect(defaultExerciseOptions(MINE)).toEqual({ rpe: true, progression: true });
  });
  it('la préférence de l’utilisateur prime sur le défaut', () => {
    const prefs: ExercisePrefsDoc = { schemaVersion: 1, rpe: false };
    expect(exerciseOptions(BENCH, prefs)).toEqual({ rpe: false, progression: true });
    expect(exerciseOptions(WARM, { schemaVersion: 1, progression: true })).toEqual({
      rpe: false,
      progression: true,
    });
  });
  it('ne stocke pas la valeur par défaut de l’exercice', () => {
    expect(optionPatch(BENCH, 'rpe', false)).toEqual({ rpe: false });
    expect(optionPatch(BENCH, 'rpe', true)).toEqual({ rpe: undefined });
    expect(optionPatch(WARM, 'progression', true)).toEqual({ progression: true });
    expect(optionPatch(WARM, 'progression', false)).toEqual({ progression: undefined });
  });
  it('liste les exercices au RPE masqué', () => {
    const rows = [
      { id: 'w', ...WARM },
      { id: 'b', ...BENCH },
      { id: 'm', ...MINE },
    ] as ExerciseRow[];
    const prefs = new Map<string, ExercisePrefsDoc>([['m', { schemaVersion: 1, rpe: false }]]);
    expect(rpeHiddenIds(rows, prefs)).toEqual(new Set(['w', 'm']));
  });
  it('chaque défaut vise un exercice du catalogue', () => {
    const sources = new Set((catalog as ExerciseRow[]).map((e) => e.source_id));
    for (const id of Object.keys(CATALOG_OPTION_DEFAULTS)) expect(sources.has(id)).toBe(true);
  });
});
