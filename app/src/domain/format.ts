// Formatage des valeurs pour l'affichage, dans les unités de l'utilisateur (§F7.4, §F7.8, §F7.10).
import type { CriterionUnit, RecordCriterion } from './records';
import type {
  Distance,
  MeasurementType,
  SetTarget,
  Settings,
  TargetReason,
  Weight,
  WorkoutSet,
} from './types';
import { displayDistanceNumber, displayWeightNumber, formatNumber, kgTo, kmTo } from './units';

type Units = Settings['units'];

// Cette méthode permet d'afficher une charge saisie dans l'unité de l'utilisateur (« 82,5 kg », « 220,5 lb »).
export function formatWeight(w: Weight, unit: Units['weight']): string {
  return `${displayWeightNumber(w, unit)} ${unit}`;
}

// Cette méthode permet d'afficher une valeur canonique en kg (volume, 1RM) dans l'unité de l'utilisateur, arrondie au dixième.
export function formatKg(kg: number, unit: Units['weight'], digits = 1): string {
  return `${formatNumber(kgTo(kg, unit), digits)} ${unit}`;
}

// Cette méthode permet d'afficher une distance saisie dans l'unité de l'utilisateur.
export function formatDistance(d: Distance, unit: Units['distance']): string {
  return `${displayDistanceNumber(d, unit)} ${unit}`;
}

// Cette méthode permet d'afficher une valeur canonique en km dans l'unité de l'utilisateur.
export function formatKm(km: number, unit: Units['distance']): string {
  return `${formatNumber(kmTo(km, unit), 2)} ${unit}`;
}

// Cette méthode permet d'afficher une durée en m:ss, ou h:mm:ss au-delà d'une heure.
export function formatDuration(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// Cette méthode permet d'afficher un chronomètre de séance en hh:mm:ss (« 00:42:13 »).
export function formatClock(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// Cette méthode permet d'afficher une durée de séance lisible (« 1 h 12 min », « 48 min »).
export function formatDurationHuman(totalS: number): string {
  const min = Math.round(totalS / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// Cette méthode permet de lire une durée saisie (« 1:30 », « 1:02:03 ») ; undefined si invalide. Des chiffres seuls se
// lisent comme sur un minuteur, pour le pavé numérique (§F9) : « 45 » = 0:45, « 130 » = 1:30, « 10000 » = 1:00:00.
export function parseDuration(input: string): number | undefined {
  const s = input.trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Math.floor(n / 10000) * 3600 + Math.floor((n % 10000) / 100) * 60 + (n % 100);
  }
  const m = s.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (!m) return undefined;
  if (m[3] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[1]) * 60 + Number(m[2]);
}

// Cette méthode permet d'afficher une allure (secondes par km) en min/km ou min/mi.
export function formatPace(sPerKm: number, unit: Units['distance']): string {
  const perUnit = unit === 'km' ? sPerKm : sPerKm * 1.609344;
  return `${formatDuration(perUnit)} /${unit}`;
}

// Cette méthode permet d'afficher les valeurs d'une série dans le format des colonnes (« 80 kg × 8 », « +10 kg × 8 », « 1:30 »).
export function formatSetValues(
  set: Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance'>,
  type: MeasurementType,
  units: Units,
): string {
  const w = set.weight ? formatWeight(set.weight, units.weight) : '—';
  const r = set.reps !== undefined ? String(set.reps) : '—';
  const d = set.durationS !== undefined ? formatDuration(set.durationS) : '—';
  switch (type) {
    case 'weight_reps':
      return `${w} × ${r}`;
    case 'bodyweight':
      return `${r} reps`;
    case 'weighted_bw':
      return `+${w} × ${r}`;
    case 'assisted_bw':
      return `−${w} × ${r}`;
    case 'duration':
      return d;
    case 'weight_duration':
      return `${w} × ${d}`;
    case 'distance_duration':
      return `${set.distance ? formatDistance(set.distance, units.distance) : '—'} · ${d}`;
  }
}

// Cette méthode permet d'afficher l'objectif d'une série (« 82,5 kg × 10 »).
export function formatTarget(target: SetTarget, type: MeasurementType, units: Units): string {
  return formatSetValues(target, type, units);
}

// Cette méthode permet de résumer les objectifs d'un exercice : « 82,5 kg × 10 » si identiques, « 80 kg × 12 / 12 / 10 »
// si seule la charge est commune, sinon la liste complète.
export function formatTargets(
  targets: (SetTarget | undefined)[],
  type: MeasurementType,
  units: Units,
): string {
  const list = targets.filter((t): t is SetTarget => t !== undefined);
  if (!list.length) return '';
  const all = list.map((t) => formatTarget(t, type, units));
  if (all.every((s) => s === all[0])) return all[0]!;
  const weights = list.map((t) => (t.weight ? formatWeight(t.weight, units.weight) : ''));
  const withReps = type === 'weight_reps' || type === 'weighted_bw' || type === 'assisted_bw';
  if (withReps && weights.every((w) => w === weights[0])) {
    const prefix = type === 'weighted_bw' ? '+' : type === 'assisted_bw' ? '−' : '';
    return `${prefix}${weights[0]} × ${list.map((t) => t.reps ?? '—').join(' / ')}`;
  }
  if (type === 'bodyweight') return `${list.map((t) => t.reps ?? '—').join(' / ')} reps`;
  return all.join(' / ');
}

export type ReasonDisplay = {
  direction: 'up' | 'down' | 'eq';
  arrow: '↑' | '↓' | '=';
  text: string;
  full: string;
};

// Cette méthode permet de formuler la raison d'un objectif en une ligne (« ↑ 12 reps atteintes sur toutes les séries »).
export function formatReason(reason: TargetReason, type: MeasurementType, units: Units): ReasonDisplay {
  const make = (direction: ReasonDisplay['direction'], text: string): ReasonDisplay => {
    const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '=';
    return { direction, arrow, text, full: `${arrow} ${text}` };
  };
  switch (reason.kind) {
    case 'comeback':
      return make('down', `Reprise après ${reason.weeksOff} semaine${reason.weeksOff > 1 ? 's' : ''}`);
    case 'plateau':
      return make(
        'down',
        type === 'assisted_bw'
          ? "Plateau : un peu plus d'assistance"
          : 'Plateau : on repart un peu plus léger',
      );
    case 'load_up':
      if (type === 'assisted_bw' && reason.assistanceDrop)
        return make('up', `Assistance −${formatWeight(reason.assistanceDrop, units.weight)}`);
      return make('up', `${reason.reachedReps} reps atteintes sur toutes les séries`);
    case 'consolidate':
      return make('eq', 'On consolide');
    case 'reps_up':
      return make('up', '+1 rep par série');
    case 'duration_up':
      return make('up', '+5 % de durée');
  }
}

// Cette méthode permet d'obtenir le libellé d'un critère de record selon le type de mesure.
export function criterionLabel(c: RecordCriterion, type: MeasurementType): string {
  switch (c) {
    case 'max_weight':
      return type === 'weighted_bw' ? 'Charge ajoutée max' : 'Charge max';
    case 'best_e1rm':
      return 'Meilleur 1RM estimé';
    case 'best_set_volume':
      return 'Meilleure série (volume)';
    case 'max_reps':
      return 'Plus de reps en une série';
    case 'session_reps':
      return 'Plus de reps sur une séance';
    case 'min_assistance':
      return 'Plus faible assistance';
    case 'max_duration':
      return 'Plus longue durée';
    case 'max_distance':
      return 'Plus grande distance';
    case 'best_pace':
      return 'Meilleure allure';
    default:
      return `Meilleur poids à ${c.slice('weight_at_'.length)} rep${c === 'weight_at_1' ? '' : 's'}`;
  }
}

// Cette méthode permet d'afficher la valeur canonique d'un critère ou d'une courbe dans les unités de l'utilisateur.
export function formatCanonical(value: number, unit: CriterionUnit, units: Units): string {
  switch (unit) {
    case 'kg':
      return formatKg(value, units.weight);
    case 'reps':
      return `${formatNumber(value, 0)} reps`;
    case 's':
      return formatDuration(value);
    case 'km':
      return formatKm(value, units.distance);
    case 's_per_km':
      return formatPace(value, units.distance);
  }
}
