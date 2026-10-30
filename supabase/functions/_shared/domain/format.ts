// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Formatage des valeurs pour l'affichage, dans les unités de l'utilisateur (§F7.4, §F7.8, §F7.10).
import { calendarDaysBetween } from './dates.ts';
import type { CriterionUnit, RecordCriterion } from './records.ts';
import type {
  Distance,
  MeasurementType,
  SetTarget,
  Settings,
  TargetReason,
  Weight,
  WorkoutSet,
} from './types.ts';
import { displayDistanceNumber, displayWeightNumber, formatNumber, kgTo, kmTo } from './units.ts';

type Units = Settings['units'];

// Cette méthode permet d'afficher une charge saisie dans l'unité de l'utilisateur (« 82,5 kg », « 220,5 lb »).
export function formatWeight(w: Weight, unit: Units['weight']): string {
  return `${displayWeightNumber(w, unit)} ${unit}`;
}

// Cette méthode permet d'afficher une valeur canonique en kg (volume, 1RM) dans l'unité de l'utilisateur, arrondie au dixième.
export function formatKg(kg: number, unit: Units['weight'], digits = 1): string {
  return `${formatNumber(kgTo(kg, unit), digits)} ${unit}`;
}

// Cette méthode permet d'afficher un volume cumulé (statistiques) : en tonnes ou milliers de lb à partir de 10 000,
// sinon en kg ou lb entiers (« 8 450 kg », « 94,6 t », « 208,6 k lb »).
export function formatVolume(kg: number, unit: Units['weight']): string {
  const v = kgTo(kg, unit);
  if (v < 10_000) return `${formatNumber(v, 0)} ${unit}`;
  return `${formatNumber(v / 1000)} ${unit === 'kg' ? 't' : 'k lb'}`;
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

// Cette méthode permet de mettre en forme une durée en cours de saisie façon minuteur : seuls les chiffres comptent (un « : »
// tapé à la main ou collé est absorbé), ils entrent par la droite : « 130 » → « 1:30 », « 10000 » → « 1:00:00 », vide si aucun.
// Le résultat est toujours relisible par parseDuration (c'est lui qui est enregistré). Minutes et secondes plafonnées à 59 ; six chiffres au plus (99:59:59) ; les suivants sont ignorés.
export function maskDuration(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6);
  if (!digits) return '';
  const n = Number(digits);
  const p = (v: number) => String(v).padStart(2, '0');
  const h = Math.floor(n / 10000);
  const m = Math.min(59, Math.floor((n % 10000) / 100));
  const sec = Math.min(59, n % 100);
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
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
    case 'load_up': {
      const easy = reason.rpe !== undefined ? `, effort facile (RPE ${formatRpe(reason.rpe)})` : '';
      if (type === 'assisted_bw' && reason.assistanceDrop)
        return make('up', `Assistance −${formatWeight(reason.assistanceDrop, units.weight)}${easy}`);
      return make('up', `${reason.reachedReps} reps atteintes sur toutes les séries${easy}`);
    }
    case 'consolidate':
      return make(
        'eq',
        reason.rpe !== undefined
          ? `Maximum atteint à RPE ${formatRpe(reason.rpe)} : on le confirme`
          : 'On consolide',
      );
    case 'reps_up': {
      const step = reason.step ?? 1;
      const easy = reason.rpe !== undefined ? `, effort facile (RPE ${formatRpe(reason.rpe)})` : '';
      return make('up', `+${step} rep${step > 1 ? 's' : ''} par série${easy}`);
    }
    case 'mixed': {
      const rpe = reason.rpe !== undefined ? ` (RPE ${formatRpe(reason.rpe)})` : '';
      return make('up', `Objectif ajusté série par série${rpe}`);
    }
    case 'duration_up':
      return make('up', '+5 % de durée');
  }
}

// Cette méthode permet d'afficher un RPE à la française (« 7,5 »).
export function formatRpe(rpe: number): string {
  return String(rpe).replace('.', ',');
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

// Cette méthode permet d'obtenir le libellé court d'un critère, pour une pastille (« 1RM estimé », « à 5 reps »).
export function criterionShortLabel(c: RecordCriterion, type: MeasurementType): string {
  switch (c) {
    case 'best_e1rm':
      return '1RM estimé';
    case 'best_set_volume':
      return 'Meilleure série';
    case 'max_reps':
      return 'Reps en une série';
    case 'session_reps':
      return 'Reps sur la séance';
    case 'min_assistance':
      return 'Assistance min';
    case 'max_duration':
      return 'Durée';
    case 'max_distance':
      return 'Distance';
    case 'best_pace':
      return 'Allure';
    case 'max_weight':
      return criterionLabel(c, type);
    default:
      return `à ${c.slice('weight_at_'.length)} rep${c === 'weight_at_1' ? '' : 's'}`;
  }
}

// Cette méthode permet de nommer plusieurs paliers « meilleur poids à N reps » battus avec la même charge (« à 1, 3 et 5 reps »).
export function repMilestonesLabel(ns: number[]): string {
  const list = ns.length > 1 ? `${ns.slice(0, -1).join(', ')} et ${ns.at(-1)}` : String(ns[0] ?? '');
  return `à ${list} rep${ns.length === 1 && ns[0] === 1 ? '' : 's'}`;
}

// Cette méthode permet d'afficher la valeur d'un record avec son signe de charge : « + » pour le lest, « − » pour l'assistance.
export function formatMetric(v: number, unit: CriterionUnit, type: MeasurementType, units: Units): string {
  const prefix =
    unit === 'kg' && type === 'weighted_bw' ? '+' : unit === 'kg' && type === 'assisted_bw' ? '−' : '';
  return `${prefix}${formatCanonical(v, unit, units)}`;
}

// Cette méthode permet d'afficher le gain d'un record sur l'ancien (« +2,5 kg », « −0:08 /km », « +1 rep ») ;
// le volume d'une série est suffixé « vol. ». undefined si le gain arrondi est nul (« +0 kg » se lirait comme un non-record).
export function formatGain(
  gain: number,
  unit: CriterionUnit,
  criterion: RecordCriterion,
  units: Units,
): string | undefined {
  const sign = gain < 0 ? '−' : '+';
  const abs = Math.abs(gain);
  const text =
    unit === 'reps' ? `${formatNumber(abs, 0)} rep${abs > 1 ? 's' : ''}` : formatCanonical(abs, unit, units);
  if (!/[1-9]/.test(text)) return undefined;
  return `${sign}${text}${criterion === 'best_set_volume' ? ' vol.' : ''}`;
}

const recordDayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const recordDayYearFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

// Cette méthode permet d'obtenir l'en-tête de jour des records récents, dans le fuseau de l'appareil : « Aujourd'hui · dim.
// 25 oct. », « Hier · … », « Il y a 3 j · … » jusqu'à 6 jours, puis la date seule (avec l'année si ce n'est pas l'année en cours).
export function recordDayLabel(ms: number, now: number): string {
  const days = calendarDaysBetween(ms, now);
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  const date = (sameYear ? recordDayFmt : recordDayYearFmt).format(ms);
  if (days === 0) return `Aujourd'hui · ${date}`;
  if (days === 1) return `Hier · ${date}`;
  if (days > 1 && days < 7) return `Il y a ${days} j · ${date}`;
  return date;
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
