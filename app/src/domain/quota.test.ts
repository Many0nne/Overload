import { describe, expect, it } from 'vitest';
import { formatStorageUsage, isStorageNearQuota } from './quota';

const GO = 1_073_741_824;

describe('quota de Storage', () => {
  it('alerte à partir de 80 % du quota', () => {
    expect(isStorageNearQuota(null, GO)).toBe(false);
    expect(isStorageNearQuota(0.79 * GO, GO)).toBe(false);
    expect(isStorageNearQuota(0.8 * GO, GO)).toBe(true);
  });

  it('formule l’occupation en Mo et en pourcentage', () => {
    expect(formatStorageUsage(412 * 1_048_576, GO)).toBe('412 Mo / 1 Go · 40 %');
  });
});
