import { describe, expect, it } from 'vitest';
import { DEFAULT_PLATES, groupPlates, loadBar, plateSetFor, plateStep } from './plates';

const KG = DEFAULT_PLATES.kg;

describe('loadBar', () => {
  it('charge une barre de 20 kg du plus lourd au plus léger', () => {
    expect(loadBar(82.5, KG)).toEqual({ perSide: [25, 5, 1.25], loaded: 82.5, rest: 0, belowBar: false });
    expect(loadBar(142.5, KG).perSide).toEqual([25, 25, 10, 1.25]);
    expect(loadBar(100, KG).perSide).toEqual([25, 15]);
  });

  it('renvoie une barre vide à son poids exact', () => {
    expect(loadBar(20, KG)).toEqual({ perSide: [], loaded: 20, rest: 0, belowBar: false });
  });

  it('signale une charge sous le poids de la barre', () => {
    expect(loadBar(15, KG)).toMatchObject({ perSide: [], loaded: 20, belowBar: true });
  });

  it('affiche le reste quand la charge est inatteignable', () => {
    expect(loadBar(82, KG)).toEqual({ perSide: [25, 5], loaded: 80, rest: 2, belowBar: false });
  });

  it('trouve la décomposition exacte quand le glouton échouerait', () => {
    // Sans disque de 5 : 20 par côté = 10 + 10, pas 15 + reste.
    expect(loadBar(60, { bar: 20, plates: [15, 10] })).toMatchObject({ perSide: [10, 10], rest: 0 });
  });

  it('utilise le moins de disques possible', () => {
    expect(loadBar(60, { bar: 20, plates: [20, 10, 5] }).perSide).toEqual([20]);
  });

  it('gère le jeu en lb', () => {
    expect(loadBar(225, DEFAULT_PLATES.lb).perSide).toEqual([45, 45]);
    expect(loadBar(185, DEFAULT_PLATES.lb).perSide).toEqual([45, 25]);
  });

  it('ne charge rien sans disque disponible', () => {
    expect(loadBar(60, { bar: 20, plates: [] })).toMatchObject({ perSide: [], loaded: 20, rest: 40 });
  });
});

describe('plateSetFor', () => {
  it('prend les valeurs par défaut de l’unité, sinon les réglages triés', () => {
    expect(plateSetFor({}, 'lb')).toEqual(DEFAULT_PLATES.lb);
    expect(plateSetFor({ plates: { kg: { bar: 15, plates: [5, 20, 10] } } }, 'kg')).toEqual({
      bar: 15,
      plates: [20, 10, 5],
    });
  });
});

describe('groupPlates et plateStep', () => {
  it('regroupe les disques identiques', () => {
    expect(groupPlates([25, 25, 10, 1.25])).toEqual([
      { plate: 25, count: 2 },
      { plate: 10, count: 1 },
      { plate: 1.25, count: 1 },
    ]);
  });

  it('avance de deux fois le plus petit disque', () => {
    expect(plateStep(KG)).toBe(2.5);
    expect(plateStep({ bar: 20, plates: [] })).toBe(1);
  });
});
