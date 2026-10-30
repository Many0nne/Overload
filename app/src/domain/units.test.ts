import { describe, expect, it } from 'vitest';
import {
  criterionShortLabel,
  formatDuration,
  formatGain,
  formatMetric,
  formatReason,
  formatSetValues,
  formatTargets,
  formatWeight,
  maskDuration,
  parseDuration,
  recordDayLabel,
  repMilestonesLabel,
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
  it('met en forme la saisie façon minuteur', () => {
    expect(maskDuration('1')).toBe('0:01');
    expect(maskDuration('13')).toBe('0:13');
    expect(maskDuration('130')).toBe('1:30');
    expect(maskDuration('1030')).toBe('10:30');
    expect(maskDuration('10000')).toBe('1:00:00');
    expect(maskDuration('0:013')).toBe('0:13');
    expect(maskDuration('1:3')).toBe('0:13');
    expect(maskDuration('1:30')).toBe('1:30');
    expect(maskDuration('1:')).toBe('0:01');
    expect(maskDuration('0:0')).toBe('');
    expect(maskDuration('')).toBe('');
    expect(maskDuration('9999999')).toBe('99:59:59');
    expect(maskDuration('99')).toBe('0:59');
    expect(parseDuration(maskDuration('9999999'))).toBe(99 * 3600 + 59 * 60 + 59);
    for (const s of ['1', '45', '130', '1030', '10000', '123456']) {
      expect(parseDuration(maskDuration(s))).toBe(parseDuration(s));
    }
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

describe('records récents : gain, libellés et dates (§F7.6)', () => {
  it('affiche le gain dans les unités de l’utilisateur, signé', () => {
    expect(formatGain(2.5, 'kg', 'max_weight', units)).toBe('+2,5 kg');
    expect(formatGain(2.5, 'kg', 'max_weight', { ...units, weight: 'lb' })).toBe('+5,5 lb');
    expect(formatGain(-8, 's_per_km', 'best_pace', units)).toBe('−0:08 /km');
    expect(formatGain(1, 'reps', 'max_reps', units)).toBe('+1 rep');
    expect(formatGain(4, 'reps', 'session_reps', units)).toBe('+4 reps');
    expect(formatGain(-5, 'kg', 'min_assistance', units)).toBe('−5 kg');
    expect(formatGain(60, 'kg', 'best_set_volume', units)).toBe('+60 kg vol.');
    expect(formatGain(0.7, 'km', 'max_distance', units)).toBe('+0,7 km');
    // Gain réel mais arrondi à zéro : pas affiché.
    expect(formatGain(0.01, 'kg', 'best_e1rm', units)).toBeUndefined();
    expect(formatGain(-0.4, 's_per_km', 'best_pace', units)).toBeUndefined();
  });

  it('signe la charge des records lestés et assistés', () => {
    expect(formatMetric(25, 'kg', 'weighted_bw', units)).toBe('+25 kg');
    expect(formatMetric(20, 'kg', 'assisted_bw', units)).toBe('−20 kg');
    expect(formatMetric(100, 'kg', 'weight_reps', units)).toBe('100 kg');
  });

  it('libellés courts des pastilles', () => {
    expect(criterionShortLabel('best_e1rm', 'weight_reps')).toBe('1RM estimé');
    expect(criterionShortLabel('weight_at_1', 'weight_reps')).toBe('à 1 rep');
    expect(criterionShortLabel('weight_at_5', 'weight_reps')).toBe('à 5 reps');
    expect(criterionShortLabel('max_weight', 'weighted_bw')).toBe('Charge ajoutée max');
    expect(repMilestonesLabel([1])).toBe('à 1 rep');
    expect(repMilestonesLabel([8])).toBe('à 8 reps');
    expect(repMilestonesLabel([1, 3, 5])).toBe('à 1, 3 et 5 reps');
  });

  it('en-tête de jour relatif puis date seule au-delà de 6 jours', () => {
    const now = new Date(2026, 9, 25, 18).getTime();
    const at = (m: number, d: number, y = 2026) => new Date(y, m, d, 9).getTime();
    expect(recordDayLabel(at(9, 25), now)).toBe("Aujourd'hui · dim. 25 oct.");
    expect(recordDayLabel(at(9, 24), now)).toBe('Hier · sam. 24 oct.');
    expect(recordDayLabel(at(9, 19), now)).toBe('Il y a 6 j · lun. 19 oct.');
    expect(recordDayLabel(at(9, 18), now)).toBe('dim. 18 oct.');
    expect(recordDayLabel(at(11, 30, 2025), now)).toBe('mar. 30 déc. 2025');
  });
});
