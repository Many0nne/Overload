import { describe, expect, it } from 'vitest';
import { photoPath } from './photo';

describe('photoPath', () => {
  it('range la photo dans le dossier de l’utilisateur, préfixée par la séance', () => {
    expect(photoPath('u1', 'w1', 'abc')).toBe('u1/w1-abc.jpg');
  });

  it('donne un chemin neuf à chaque photo de la même séance', () => {
    expect(photoPath('u1', 'w1')).not.toBe(photoPath('u1', 'w1'));
  });
});
