import { describe, expect, it } from 'vitest';
import { parsePhotoPath, photoPath } from './photo';

describe('photoPath', () => {
  it('range la photo dans le dossier de l’utilisateur, préfixée par la séance', () => {
    expect(photoPath('u1', 'w1', 'abc')).toBe('u1/w1-abc.jpg');
  });

  it('donne un chemin neuf à chaque photo de la même séance', () => {
    expect(photoPath('u1', 'w1')).not.toBe(photoPath('u1', 'w1'));
  });
});

describe('parsePhotoPath', () => {
  const W = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';

  it('retrouve la séance et l’heure de création (UUID v7) d’un chemin généré', () => {
    const before = Date.now();
    const parsed = parsePhotoPath(photoPath('u1', W));
    expect(parsed?.workoutId).toBe(W);
    expect(parsed!.createdAt).toBeGreaterThanOrEqual(before);
    expect(parsed!.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('ignore un chemin d’une autre forme', () => {
    expect(parsePhotoPath('u1/w1-abc.jpg')).toBeUndefined();
  });
});
