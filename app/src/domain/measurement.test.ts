import { describe, expect, it } from 'vitest';
import { weightPerPiece, weightUnitLabel } from './measurement';

describe('convention de saisie des charges libres (issue #99)', () => {
  it('rappelle le poids d’une pièce pour les haltères et les kettlebells', () => {
    expect(weightPerPiece('dumbbell', 'weight_reps')).toBe('haltère');
    expect(weightPerPiece('kettlebell', 'weight_duration')).toBe('kettlebell');
    expect(weightUnitLabel('dumbbell', 'weight_reps', 'kg')).toBe('kg / haltère');
    expect(weightUnitLabel('kettlebell', 'weight_reps', 'lb')).toBe('lb / kettlebell');
  });

  it('garde l’unité seule pour les autres équipements et types de mesure', () => {
    expect(weightPerPiece('barbell', 'weight_reps')).toBeUndefined();
    expect(weightPerPiece(undefined, 'weight_reps')).toBeUndefined();
    expect(weightPerPiece('dumbbell', 'weighted_bw')).toBeUndefined();
    expect(weightUnitLabel('machine', 'weight_reps', 'kg')).toBe('kg');
  });
});
