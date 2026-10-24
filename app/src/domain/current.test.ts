import { describe, expect, it } from 'vitest';
import { currentExerciseId } from './current';
import type { WorkoutDoc, WorkoutExercise } from './types';

// Cette méthode permet de fabriquer un exercice de séance dont les séries sont validées ou non.
const ex = (exerciseId: string, done: boolean[]): WorkoutExercise => ({
  id: `we-${exerciseId}`,
  exerciseId,
  measurementType: 'weight_reps',
  restS: null,
  sets: done.map((d, i) => ({ id: `${exerciseId}-${i}`, kind: 'normal', done: d })),
});

// Cette méthode permet de fabriquer une séance à partir de ses exercices.
const doc = (exercises: WorkoutExercise[]): WorkoutDoc => ({ schemaVersion: 1, title: 'Séance', exercises });

describe('currentExerciseId', () => {
  it('donne le premier exercice ayant une série non validée', () => {
    expect(currentExerciseId(doc([ex('a', [true, true]), ex('b', [true, false]), ex('c', [false])]))).toBe(
      'b',
    );
  });

  it('donne le dernier exercice quand tout est validé', () => {
    expect(currentExerciseId(doc([ex('a', [true]), ex('b', [true])]))).toBe('b');
  });

  it('ignore un exercice sans série et donne undefined pour une séance vide', () => {
    expect(currentExerciseId(doc([ex('a', []), ex('b', [false])]))).toBe('b');
    expect(currentExerciseId(doc([]))).toBeUndefined();
  });
});
