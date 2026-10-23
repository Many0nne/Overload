import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatReason,
  formatSetValues,
  formatTargets,
  formatWeight,
  parseDuration,
} from './format';
import { prefsId, uuidv7 } from './ids';
import { matchesSearch, normalizeSearch } from './search';
import { DEFAULT_SETTINGS } from './types';
import { displayWeightNumber, floorTo, parseDecimal, toKg } from './units';

const units = DEFAULT_SETTINGS.units;

describe('unités', () => {
  it('convertit et arrondit au dixième sans zéro inutile', () => {
    expect(formatWeight({ v: 100, u: 'kg' }, 'lb')).toBe('220,5 lb');
    expect(formatWeight({ v: 225, u: 'lb' }, 'kg')).toBe('102,1 kg');
    expect(formatWeight({ v: 100, u: 'kg' }, 'kg')).toBe('100 kg');
  });
  it('affiche une valeur exactement comme saisie dans son unité', () => {
    expect(displayWeightNumber({ v: 82.5, u: 'kg' }, 'kg')).toBe('82,5');
    expect(displayWeightNumber({ v: 1.25, u: 'kg' }, 'kg')).toBe('1,25');
  });
  it('convertit les lb en kg sans arrondi', () => {
    expect(toKg({ v: 1, u: 'lb' })).toBe(0.45359237);
  });
  it('lit les décimales avec virgule ou point', () => {
    expect(parseDecimal('82,5')).toBe(82.5);
    expect(parseDecimal('82.5')).toBe(82.5);
    expect(parseDecimal(' 80 ')).toBe(80);
    expect(parseDecimal('abc')).toBeUndefined();
    expect(parseDecimal('')).toBeUndefined();
  });
  it('arrondit au multiple inférieur sans bruit flottant', () => {
    expect(floorTo(72, 2.5)).toBe(70);
    expect(floorTo(82.5, 2.5)).toBe(82.5);
    expect(floorTo(0.3 / 0.1, 1)).toBe(3);
  });
});

describe('durées', () => {
  it('formate en m:ss et h:mm:ss', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(3723)).toBe('1:02:03');
  });
  it('lit m:ss, h:mm:ss et les secondes seules', () => {
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('130')).toBe(90);
    expect(parseDuration('2000')).toBe(1200);
    expect(parseDuration('13000')).toBe(5400);
    expect(parseDuration('1:75')).toBeUndefined();
  });
});

describe('formatage', () => {
  it('formate les séries selon le type de mesure', () => {
    expect(formatSetValues({ weight: { v: 80, u: 'kg' }, reps: 8 }, 'weight_reps', units)).toBe('80 kg × 8');
    expect(formatSetValues({ weight: { v: 10, u: 'kg' }, reps: 8 }, 'weighted_bw', units)).toBe('+10 kg × 8');
    expect(formatSetValues({ durationS: 65 }, 'duration', units)).toBe('1:05');
  });
  it('résume les objectifs', () => {
    const t = (kg: number, reps: number) => ({ weight: { v: kg, u: 'kg' as const }, reps });
    expect(formatTargets([t(82.5, 10), t(82.5, 10)], 'weight_reps', units)).toBe('82,5 kg × 10');
    expect(formatTargets([t(80, 12), t(80, 12), t(80, 10)], 'weight_reps', units)).toBe(
      '80 kg × 12 / 12 / 10',
    );
  });
  it('formule les raisons', () => {
    expect(formatReason({ kind: 'load_up', reachedReps: 12 }, 'weight_reps', units).full).toBe(
      '↑ 12 reps atteintes sur toutes les séries',
    );
    expect(formatReason({ kind: 'comeback', weeksOff: 6 }, 'weight_reps', units).full).toBe(
      '↓ Reprise après 6 semaines',
    );
    expect(formatReason({ kind: 'consolidate' }, 'weight_reps', units).full).toBe('= On consolide');
    expect(formatReason({ kind: 'mixed' }, 'weight_reps', units).full).toBe(
      '↑ Objectif ajusté série par série',
    );
    expect(
      formatReason(
        { kind: 'load_up', reachedReps: 12, assistanceDrop: { v: 2.5, u: 'kg' } },
        'assisted_bw',
        units,
      ).full,
    ).toBe('↑ Assistance −2,5 kg');
  });
});

describe('recherche et identifiants', () => {
  it('ignore accents et casse', () => {
    expect(normalizeSearch('Développé Couché')).toBe('developpe couche');
    expect(matchesSearch(normalizeSearch('Développé couché (barre)'), 'devel couch')).toBe(true);
    expect(matchesSearch(normalizeSearch('Squat'), 'dev')).toBe(false);
  });
  it('génère des UUID v7 et des id de réglages stables', () => {
    expect(uuidv7()).toMatch(/^[0-9a-f-]{36}$/);
    expect(prefsId('u', 'e')).toBe(prefsId('u', 'e'));
    expect(prefsId('u', 'e')).not.toBe(prefsId('u', 'f'));
  });
});
