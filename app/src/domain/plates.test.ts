import { describe, expect, it } from 'vitest';
import {
  barCaption,
  barToRemember,
  barTypeFor,
  barWeights,
  DEFAULT_PLATES,
  detectBarType,
  exercisePlateSet,
  groupPlates,
  loadBar,
  plateSetFor,
  plateStep,
  usesBar,
} from './plates';
import type { ExerciseRow } from './types';

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
    expect(plateSetFor({}, 'lb')).toEqual({ ...DEFAULT_PLATES.lb, barType: 'olympic' });
    expect(plateSetFor({ plates: { kg: { bar: 15, plates: [5, 20, 10] } } }, 'kg')).toEqual({
      bar: 15,
      plates: [20, 10, 5],
      barType: 'olympic',
    });
  });

  it('donne le poids du type de barre demandé', () => {
    expect(plateSetFor({}, 'kg', 'ez')).toMatchObject({ bar: 10, barType: 'ez' });
    expect(plateSetFor({}, 'lb', 'trap')).toMatchObject({ bar: 55, barType: 'trap' });
    const settings = {
      plates: { kg: { bar: 15, plates: [20], bars: { ez: 8 }, defaultBar: 'women' as const } },
    };
    expect(plateSetFor(settings, 'kg')).toMatchObject({ bar: 15, barType: 'women' });
    expect(plateSetFor(settings, 'kg', 'ez')).toMatchObject({ bar: 8, plates: [20] });
  });
});

describe('barWeights', () => {
  it('reprend l’ancien poids unique comme barre olympique', () => {
    expect(barWeights({ plates: { kg: { bar: 15, plates: [20] } } }, 'kg')).toEqual({
      olympic: 15,
      women: 15,
      ez: 10,
      trap: 25,
    });
  });

  it('préfère les poids réglés par type', () => {
    expect(
      barWeights({ plates: { lb: { bar: 45, plates: [45], bars: { olympic: 45, trap: 65 } } } }, 'lb'),
    ).toEqual({ olympic: 45, women: 35, ez: 25, trap: 65 });
  });
});

const ex = (name: string, equipment: ExerciseRow['equipment'], source_id: string | null = null) => ({
  name,
  equipment,
  source_id,
});

describe('détection de la barre', () => {
  it('reconnaît la barre EZ et la trap bar', () => {
    expect(detectBarType(ex('Curl biceps (barre EZ)', 'barbell', 'EZ-Bar_Curl'))).toBe('ez');
    expect(detectBarType(ex('Mon curl ez', 'barbell'))).toBe('ez');
    expect(detectBarType(ex('Soulevé de terre trap bar', 'other'))).toBe('trap');
    expect(detectBarType(ex('Shrug barre hexagonale', 'other'))).toBe('trap');
    expect(detectBarType(ex('Développé couché (barre)', 'barbell'))).toBeUndefined();
    expect(detectBarType(ex('Squat trapèzes', 'barbell'))).toBeUndefined();
  });

  it('ouvre le calculateur à la barre et à la trap bar seulement', () => {
    expect(usesBar(ex('Développé couché (barre)', 'barbell'))).toBe(true);
    expect(usesBar(ex('Soulevé de terre trap bar', 'other'))).toBe(true);
    expect(usesBar(ex('Squat (Smith)', 'machine'))).toBe(false);
    expect(usesBar(undefined)).toBe(false);
    expect(exercisePlateSet(ex('Curl haltères', 'dumbbell'), undefined, {}, 'kg')).toBeNull();
  });

  it('prend le choix mémorisé, sinon la détection, sinon la barre par défaut', () => {
    const curl = ex('Curl biceps (barre EZ)', 'barbell');
    const bench = ex('Développé couché (barre)', 'barbell');
    const women = { plates: { kg: { bar: 15, plates: [20], defaultBar: 'women' as const } } };
    expect(barTypeFor(curl, undefined, {}, 'kg')).toBe('ez');
    expect(barTypeFor(curl, { bar: 'olympic' }, {}, 'kg')).toBe('olympic');
    expect(barTypeFor(bench, undefined, women, 'kg')).toBe('women');
    expect(exercisePlateSet(curl, undefined, {}, 'kg')).toMatchObject({ bar: 10, barType: 'ez' });
    // Curl EZ à 30 kg : 10 kg par côté, pas 5 (issue #100).
    expect(loadBar(30, exercisePlateSet(curl, undefined, {}, 'kg')!).perSide).toEqual([10]);
  });

  it('ne mémorise pas la barre qu’aurait eue l’exercice d’office', () => {
    const curl = ex('Curl biceps (barre EZ)', 'barbell');
    expect(barToRemember(curl, {}, 'kg', 'ez')).toBeUndefined();
    expect(barToRemember(curl, {}, 'kg', 'olympic')).toBe('olympic');
  });

  it('nomme la barre dans les textes courts', () => {
    expect(barCaption('olympic', '20 kg')).toBe('barre 20 kg');
    expect(barCaption('ez', '10 kg')).toBe('barre EZ 10 kg');
    expect(barCaption('trap', '25 kg')).toBe('trap bar 25 kg');
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
