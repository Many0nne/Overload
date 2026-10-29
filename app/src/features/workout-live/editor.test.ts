import { describe, expect, it } from 'vitest';
import { activeTarget } from '@/domain/progression';
import type { WorkoutDoc } from '@/domain/types';
import { setKind } from './editor';

// Cette méthode permet de construire une séance minimale à une série de travail pré-remplie par son objectif.
function docWith(set: Record<string, unknown>): WorkoutDoc {
  return {
    exercises: [{ id: 'e1', exerciseId: 'x', measurementType: 'weight_reps', sets: [set] }],
  } as unknown as WorkoutDoc;
}

const base = {
  id: 's1',
  kind: 'normal',
  done: false,
  weight: { v: 60, u: 'kg' },
  reps: 8,
  target: { weight: { v: 60, u: 'kg' }, reps: 8 },
};

describe('setKind vers échauffement', () => {
  it("retire l'objectif actif et les valeurs pré-remplies par l'objectif", () => {
    const out = setKind(docWith(base), 'e1', 's1', 'warmup').exercises[0]!.sets[0]!;
    expect(activeTarget(out)).toBeUndefined();
    expect(out.weight).toBeUndefined();
    expect(out.reps).toBeUndefined();
  });

  it('garde les valeurs saisies différentes de l’objectif', () => {
    const out = setKind(docWith({ ...base, weight: { v: 40, u: 'kg' }, reps: 10 }), 'e1', 's1', 'warmup')
      .exercises[0]!.sets[0]!;
    expect(out.weight).toEqual({ v: 40, u: 'kg' });
    expect(out.reps).toBe(10);
  });

  it('efface le RPE', () => {
    const out = setKind(docWith({ ...base, done: true, rpe: 8 }), 'e1', 's1', 'warmup').exercises[0]!
      .sets[0]!;
    expect(out.rpe).toBeUndefined();
    expect(out.reps).toBe(8);
  });

  it('ne touche pas une série qui reste de travail', () => {
    const out = setKind(docWith({ ...base, rpe: 8 }), 'e1', 's1', 'failure').exercises[0]!.sets[0]!;
    expect(out.rpe).toBe(8);
    expect(out.reps).toBe(8);
  });
});
