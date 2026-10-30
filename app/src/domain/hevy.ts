// Import des exports CSV de HEVY (workout_data.csv, measurement_data.csv) : lecture, regroupement et correspondance
// avec les exercices d'Overload. Module pur : les écritures en base sont dans features/settings/importHevy.ts.
import { normalizeRpe } from './measurement';
import { normalizeSearch } from './search';
import type {
  BodyMeasurementKey,
  BodyMeasurementValues,
  Equipment,
  MeasurementType,
  Muscle,
  SetKind,
  WorkoutDoc,
  WorkoutSet,
} from './types';

export type HevySet = {
  kind: SetKind;
  weightKg?: number;
  reps?: number;
  distanceKm?: number;
  durationS?: number;
  rpe?: number;
};

export type HevyExercise = { title: string; note?: string; sets: HevySet[] };

export type HevyWorkout = {
  key: string; // « AAAA-MM-JJTHH:mm|titre » : identifiant stable, indépendant de la langue et du fuseau
  title: string;
  description?: string;
  startedAt: number;
  endedAt?: number;
  exercises: HevyExercise[];
};

export type HevyMeasurement = { measuredOn: string; values: BodyMeasurementValues };

export class HevyFormatError extends Error {}

// ---------- CSV ----------

// Cette méthode permet de découper un texte CSV (séparateur virgule, guillemets doublés, retours à la ligne dans
// les cellules) en lignes de cellules ; le BOM éventuel et les lignes vides sont ignorés.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

// Cette méthode permet de lire un CSV avec en-tête en objets « colonne → valeur ».
function readTable(text: string): { header: string[]; records: Record<string, string>[] } {
  const [header = [], ...rows] = parseCsv(text);
  const cols = header.map((h) => h.trim());
  return {
    header: cols,
    records: rows.map((r) => Object.fromEntries(cols.map((h, i) => [h, (r[i] ?? '').trim()]))),
  };
}

export type HevyFileKind = 'workouts' | 'measurements' | 'unknown';

// Cette méthode permet de reconnaître un export HEVY d'après sa ligne d'en-tête (séances ou mesures).
export function detectHevyFile(text: string): HevyFileKind {
  const header = parseCsv(text.slice(0, 2000))[0]?.map((h) => h.trim()) ?? [];
  if (['title', 'start_time', 'exercise_title', 'set_type'].every((c) => header.includes(c)))
    return 'workouts';
  if (header.includes('date') && header.includes('weight_kg')) return 'measurements';
  return 'unknown';
}

// ---------- Dates ----------

const MONTHS: Record<string, number> = {
  janv: 0,
  jan: 0,
  janvier: 0,
  january: 0,
  fevr: 1,
  fev: 1,
  fevrier: 1,
  feb: 1,
  february: 1,
  mars: 2,
  mar: 2,
  march: 2,
  avr: 3,
  avril: 3,
  apr: 3,
  april: 3,
  mai: 4,
  may: 4,
  juin: 5,
  jun: 5,
  june: 5,
  juil: 6,
  juillet: 6,
  jul: 6,
  july: 6,
  aout: 7,
  aug: 7,
  august: 7,
  sept: 8,
  sep: 8,
  septembre: 8,
  september: 8,
  oct: 9,
  octobre: 9,
  october: 9,
  nov: 10,
  novembre: 10,
  november: 10,
  dec: 11,
  decembre: 11,
  december: 11,
};

export type LocalDateTime = { y: number; mo: number; d: number; h: number; mi: number };

// Cette méthode permet de lire une date HEVY en heure locale (« 22 oct. 2026, 16:50 », « 22 Oct 2026, 4:50 PM »,
// « Oct 22, 2026, 16:50 » ou ISO) ; renvoie null si le format n'est pas reconnu.
export function parseHevyDate(raw: string): LocalDateTime | null {
  const s = normalizeSearch(raw).replace(/\./g, '');
  const iso = /^(\d{4})-(\d{2})-(\d{2})[t ](\d{1,2}):(\d{2})/.exec(s);
  if (iso) return { y: +iso[1]!, mo: +iso[2]! - 1, d: +iso[3]!, h: +iso[4]!, mi: +iso[5]! };
  const time = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/.exec(s);
  const dayFirst = /(\d{1,2})\s+([a-z]+)\s+(\d{4})/.exec(s);
  const monthFirst = /([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  let d: number, mon: string, y: number;
  if (dayFirst) [d, mon, y] = [+dayFirst[1]!, dayFirst[2]!, +dayFirst[3]!];
  else if (monthFirst) [mon, d, y] = [monthFirst[1]!, +monthFirst[2]!, +monthFirst[3]!];
  else return null;
  const mo = MONTHS[mon];
  if (mo === undefined) return null;
  let h = time ? +time[1]! : 0;
  const mi = time ? +time[2]! : 0;
  if (time?.[3] === 'pm' && h < 12) h += 12;
  if (time?.[3] === 'am' && h === 12) h = 0;
  return { y, mo, d, h, mi };
}

// Cette méthode permet de convertir une date locale lue en millisecondes epoch dans le fuseau de l'appareil.
export function localToMs(t: LocalDateTime): number {
  return new Date(t.y, t.mo, t.d, t.h, t.mi).getTime();
}

const pad = (n: number) => String(n).padStart(2, '0');

// Cette méthode permet d'obtenir la clé « AAAA-MM-JJTHH:mm » d'une date locale (indépendante de la langue d'export).
function localKey(t: LocalDateTime): string {
  return `${t.y}-${pad(t.mo + 1)}-${pad(t.d)}T${pad(t.h)}:${pad(t.mi)}`;
}

// ---------- Séances ----------

const SET_KINDS: Record<string, SetKind> = {
  normal: 'normal',
  warmup: 'warmup',
  dropset: 'drop',
  failure: 'failure',
};

// Cette méthode permet de lire un nombre HEVY (point ou virgule décimale) ; renvoie undefined si la cellule est vide.
function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

// Cette méthode permet de regrouper les lignes de workout_data.csv (une par série) en séances et blocs d'exercice,
// dans l'ordre du fichier ; un exercice répété plus loin dans la séance forme un nouveau bloc.
export function parseHevyWorkouts(text: string): HevyWorkout[] {
  const { records } = readTable(text);
  const byKey = new Map<string, HevyWorkout>();
  for (const r of records) {
    const start = parseHevyDate(r.start_time ?? '');
    if (!start) throw new HevyFormatError(`Date de séance non reconnue : « ${r.start_time ?? ''} »`);
    const title = r.title || 'Séance';
    const key = `${localKey(start)}|${title}`;
    let w = byKey.get(key);
    if (!w) {
      const end = parseHevyDate(r.end_time ?? '');
      const startedAt = localToMs(start);
      const endedAt = end ? localToMs(end) : undefined;
      w = {
        key,
        title,
        description: r.description || undefined,
        startedAt,
        endedAt: endedAt !== undefined && endedAt > startedAt ? endedAt : undefined,
        exercises: [],
      };
      byKey.set(key, w);
    }
    const exTitle = r.exercise_title || 'Exercice';
    let ex = w.exercises.at(-1);
    if (!ex || ex.title !== exTitle) {
      ex = { title: exTitle, note: r.exercise_notes || undefined, sets: [] };
      w.exercises.push(ex);
    }
    const set: HevySet = { kind: SET_KINDS[r.set_type ?? ''] ?? 'normal' };
    const weightKg = num(r.weight_kg);
    const reps = num(r.reps);
    const distanceKm = num(r.distance_km);
    const durationS = num(r.duration_seconds);
    if (weightKg !== undefined) set.weightKg = weightKg;
    if (reps !== undefined) set.reps = Math.round(reps);
    if (distanceKm !== undefined) set.distanceKm = distanceKm;
    if (durationS !== undefined) set.durationS = Math.round(durationS);
    const rpe = normalizeRpe(num(r.rpe));
    if (rpe !== undefined) set.rpe = rpe;
    ex.sets.push(set);
  }
  return [...byKey.values()].sort((a, b) => a.startedAt - b.startedAt);
}

// Cette méthode permet de déduire le type de mesure d'un exercice HEVY d'après les colonnes remplies de ses séries.
export function inferMeasurementType(sets: HevySet[]): MeasurementType {
  const has = (f: keyof HevySet) => sets.some((s) => s[f] !== undefined);
  if (has('distanceKm')) return 'distance_duration';
  if (has('reps')) return has('weightKg') ? 'weight_reps' : 'bodyweight';
  if (has('weightKg') && has('durationS')) return 'weight_duration';
  if (has('durationS')) return 'duration';
  return 'weight_reps';
}

export type HevyExerciseSummary = { title: string; setCount: number; measurementType: MeasurementType };

// Cette méthode permet de lister les exercices distincts des séances (nom exact HEVY), avec leur nombre de séries
// et leur type de mesure déduit, les plus pratiqués d'abord.
export function summarizeExercises(workouts: HevyWorkout[]): HevyExerciseSummary[] {
  const sets = new Map<string, HevySet[]>();
  for (const w of workouts)
    for (const ex of w.exercises) sets.set(ex.title, [...(sets.get(ex.title) ?? []), ...ex.sets]);
  return [...sets.entries()]
    .map(([title, s]) => ({ title, setCount: s.length, measurementType: inferMeasurementType(s) }))
    .sort((a, b) => b.setCount - a.setCount || a.title.localeCompare(b.title, 'fr'));
}

export type ResolvedExercise = { exerciseId: string; measurementType: MeasurementType };

// Cette méthode permet de construire le document d'une séance terminée à partir d'une séance HEVY ; les exercices
// sans correspondance (ignorés) sont retirés. Le repos reste vide : HEVY ne l'exporte pas.
export function buildWorkoutDoc(
  w: HevyWorkout,
  resolve: (title: string) => ResolvedExercise | null,
  newId: () => string,
): WorkoutDoc {
  const exercises: WorkoutDoc['exercises'] = [];
  for (const ex of w.exercises) {
    const target = resolve(ex.title);
    if (!target) continue;
    exercises.push({
      id: newId(),
      exerciseId: target.exerciseId,
      measurementType: target.measurementType,
      ...(ex.note ? { note: ex.note } : {}),
      restS: null,
      sets: ex.sets.map((s) => {
        const set: WorkoutSet = { id: newId(), kind: s.kind, done: true };
        if (s.weightKg !== undefined) set.weight = { v: s.weightKg, u: 'kg' };
        if (s.reps !== undefined) set.reps = s.reps;
        if (s.durationS !== undefined) set.durationS = s.durationS;
        if (s.distanceKm !== undefined) set.distance = { v: s.distanceKm, u: 'km' };
        if (s.rpe !== undefined) set.rpe = s.rpe;
        return set;
      }),
    });
  }
  const doc: WorkoutDoc = { schemaVersion: 1, title: w.title, exercises };
  if (w.description) doc.note = w.description;
  if (w.endedAt !== undefined) doc.durationS = Math.round((w.endedAt - w.startedAt) / 1000);
  return doc;
}

// ---------- Correspondance des exercices ----------

// Expressions HEVY réécrites dans le vocabulaire du catalogue avant comparaison (texte déjà normalisé).
const PHRASES: [RegExp, string][] = [
  [/\bcable\b|\bcables\b|\bpoulies?\b/g, 'poulie'],
  [/\bmachine smith\b|\bsmith machine\b/g, 'smith'],
  [/\bdumbbells?\b/g, 'haltere'],
  [/\bbarbell\b/g, 'barre'],
  [/\bsingle arm\b|\bone arm\b|\ba un bras\b/g, 'un bras'],
  [/\ballonge\b/g, 'couche'],
  [/\bcouche incline\b/g, 'incline'],
  [/\bcouche decline\b/g, 'decline'],
  [/\bextension jambes?\b|\bleg extensions?\b/g, 'leg extension'],
  [/\bbutterfly\b|\bpec deck\b/g, 'pec deck'],
  [/\btirage poitrine\b|\blat pull ?down\b/g, 'tirage vertical'],
  [/\browing poulie\b|\bseated cable row\b/g, 'tirage horizontal poulie'],
  [/\bchest press\b/g, 'developpe'],
  [/\bpresse epaules\b|\bshoulder press\b/g, 'developpe epaules'],
  [/\bpoussee de hanches?\b|\bhip thrusts?\b/g, 'hip thrust'],
  [/\bextension mollets\b|\bcalf raises?\b/g, 'mollets'],
  [/\boverhead\b/g, 'au-dessus tete'],
  [/\bpushdown\b/g, 'extension'],
  [/\bshrug\b/g, 'shrugs'],
  [/\bwarm ?ups?\b/g, 'echauffement'],
];

const STOPWORDS = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'a',
  'au',
  'aux',
  'en',
  'sur',
  'et',
  'the',
  'l',
  'd',
]);
const EQUIPMENT_WORDS = new Set([
  'barre',
  'haltere',
  'poulie',
  'machine',
  'smith',
  'kettlebell',
  'elastique',
  'corde',
]);

// Cette méthode permet de réduire un nom d'exercice à ses mots significatifs (sans accents, pluriels ni mots vides)
// pour la comparaison approximative.
export function nameTokens(name: string): Set<string> {
  let s = normalizeSearch(name)
    .replace(/[()/,'’\-–]/g, ' ')
    .replace(/\s+/g, ' ');
  for (const [re, by] of PHRASES) s = s.replace(re, by);
  const tokens = s
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
  return new Set(tokens);
}

// Mots qui précisent une variante sans désigner le mouvement : ils comptent moins dans la ressemblance.
const MODIFIER_WORDS = new Set([
  'un',
  'bras',
  'jambe',
  'assi',
  'debout',
  'prise',
  'large',
  'serree',
  'neutre',
  'tendu',
]);

// Cette méthode permet de donner son poids à un mot dans la comparaison (mouvement 1, matériel 0,5, variante 0,4).
function tokenWeight(t: string): number {
  if (EQUIPMENT_WORDS.has(t)) return 0.5;
  return MODIFIER_WORDS.has(t) ? 0.4 : 1;
}

// Cette méthode permet de noter la ressemblance de deux noms d'exercice entre 0 et 1 : coefficient de Dice pondéré
// sur les mots significatifs, nul sans mot de mouvement commun, pénalisé si le matériel indiqué diffère.
export function nameSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const total = (s: Set<string>) => [...s].reduce((sum, t) => sum + tokenWeight(t), 0);
  let common = 0;
  let core = false;
  for (const t of a)
    if (b.has(t)) {
      common += tokenWeight(t);
      if (tokenWeight(t) === 1) core = true;
    }
  if (!core) return 0;
  let score = (2 * common) / (total(a) + total(b));
  const eqA = [...a].filter((t) => EQUIPMENT_WORDS.has(t));
  const eqB = [...b].filter((t) => EQUIPMENT_WORDS.has(t));
  if (eqA.length && eqB.length && !eqA.some((t) => eqB.includes(t))) score *= 0.6;
  return score;
}

const REPS_TYPES = new Set<MeasurementType>(['weight_reps', 'bodyweight', 'weighted_bw', 'assisted_bw']);

// Cette méthode permet de pénaliser une correspondance dont le type de mesure ne recevrait pas les valeurs HEVY
// (1 si identique, 0,85 entre types à répétitions, 0,5 sinon).
export function typeCompatibility(from: MeasurementType, to: MeasurementType): number {
  if (from === to) return 1;
  return REPS_TYPES.has(from) && REPS_TYPES.has(to) ? 0.85 : 0.5;
}

export type MatchCandidate = { id: string; name: string; measurementType: MeasurementType };
export type MatchSuggestion = { candidate: MatchCandidate; score: number };

// Seuil au-delà duquel la suggestion est présélectionnée (sinon : exercice perso par défaut).
export const MATCH_THRESHOLD = 0.6;

// Cette méthode permet de proposer l'exercice d'Overload le plus proche d'un nom HEVY : correspondance exacte
// (sans accents ni casse) d'abord, sinon meilleure ressemblance pondérée par la compatibilité du type de mesure ;
// renvoie null si aucun mot de mouvement n'est commun.
export function suggestMatch(
  title: string,
  type: MeasurementType,
  candidates: MatchCandidate[],
): MatchSuggestion | null {
  const exact = candidates.find((c) => normalizeSearch(c.name) === normalizeSearch(title));
  if (exact) return { candidate: exact, score: 1 };
  const tokens = nameTokens(title);
  let best: MatchSuggestion | null = null;
  for (const c of candidates) {
    const score = nameSimilarity(tokens, nameTokens(c.name)) * typeCompatibility(type, c.measurementType);
    if (score > 0 && (!best || score > best.score)) best = { candidate: c, score };
  }
  return best;
}

// Mots-clés (texte normalisé) → matériel, dans l'ordre de priorité (« butterfly poulie » est à la poulie).
const EQUIPMENT_GUESS: [RegExp, Equipment][] = [
  [/poulie|cable|corde/, 'cable'],
  [/smith|machine|pec deck|butterfly|presse|chest press|convergent|hack/, 'machine'],
  [/haltere|dumbbell/, 'dumbbell'],
  [/barre|barbell/, 'barbell'],
  [/kettlebell/, 'kettlebell'],
  [/elastique|band/, 'band'],
];

// Mots-clés (texte normalisé) → muscle principal ; les plus spécifiques d'abord (« leg curl » avant « curl »,
// « tirage poitrine » avant « poitrine »).
const MUSCLE_GUESS: [RegExp, Muscle][] = [
  [/^(echauffement|marche|shopping|cardio)\b|\b(tapis|course|velo|rameur|elliptique|walk|run)\b/, 'cardio'],
  [/leg curl|roumain|jambes tendues|good morning|ischio|hamstring/, 'hamstrings'],
  [/mollet|calf/, 'calves'],
  [/abduction|fessier|hip thrust|poussee de hanche|glute|kickbacks? fess/, 'glutes'],
  [
    /adduction|squat|presse a cuisses|presse verticale|leg press|extension jambe|leg extension|fente|lunge/,
    'quads',
  ],
  [/crunch|abdo|releve de (jambe|genou)|gainage|planche|ciseaux|\babs?\b/, 'abs'],
  [/triceps|dips sur banc|barre au front|pushdown/, 'triceps'],
  [/curl|biceps/, 'biceps'],
  [/shrug|trapeze/, 'traps'],
  [/lombaire|soulev/, 'lower_back'],
  [/tirage|rowing|\brow\b|traction|pull ?down|pull-?up|\bchin/, 'back'],
  [/epaule|lateral|oiseau|militaire|shoulder|frontale|face pull/, 'shoulders'],
  [/pec|couche|chest|ecart|butterfly|pompe|dips|developpe|push/, 'chest'],
];

// Cette méthode permet de deviner le matériel et le muscle principal d'un exercice perso créé à l'import,
// d'après son nom et son type de mesure (valeurs modifiables ensuite dans la bibliothèque).
export function guessExerciseTraits(
  title: string,
  type: MeasurementType,
): { equipment: Equipment; primary_muscle: Muscle } {
  const s = normalizeSearch(title);
  const equipment =
    EQUIPMENT_GUESS.find(([re]) => re.test(s))?.[1] ??
    (type === 'bodyweight' || type === 'duration' ? 'bodyweight' : 'other');
  const muscle =
    MUSCLE_GUESS.find(([re]) => re.test(s))?.[1] ??
    (type === 'duration' || type === 'distance_duration' ? 'cardio' : 'chest');
  return { equipment, primary_muscle: muscle };
}

// ---------- Mesures corporelles ----------

const MEASUREMENT_COLUMNS: [string, BodyMeasurementKey][] = [
  ['weight_kg', 'weight'],
  ['fat_percent', 'body_fat'],
  ['neck_cm', 'neck'],
  ['shoulder_cm', 'shoulders'],
  ['chest_cm', 'chest'],
  ['left_bicep_cm', 'arm_left'],
  ['right_bicep_cm', 'arm_right'],
  ['waist_cm', 'waist'],
  ['hips_cm', 'hips'],
  ['left_thigh_cm', 'thigh_left'],
  ['right_thigh_cm', 'thigh_right'],
  ['left_calf_cm', 'calf_left'],
  ['right_calf_cm', 'calf_right'],
];

// Cette méthode permet de lire measurement_data.csv en mesures datées (une par jour, la dernière ligne l'emporte) ;
// les colonnes sans équivalent (avant-bras, abdomen) sont ignorées.
export function parseHevyMeasurements(text: string): HevyMeasurement[] {
  const { records } = readTable(text);
  const byDay = new Map<string, BodyMeasurementValues>();
  for (const r of records) {
    const t = parseHevyDate(r.date ?? '');
    if (!t) throw new HevyFormatError(`Date de mesure non reconnue : « ${r.date ?? ''} »`);
    const day = `${t.y}-${pad(t.mo + 1)}-${pad(t.d)}`;
    const values: BodyMeasurementValues = { ...(byDay.get(day) ?? {}) };
    for (const [col, key] of MEASUREMENT_COLUMNS) {
      const v = num(r[col]);
      if (v === undefined || v <= 0) continue;
      if (key === 'weight') values.weight = { v, u: 'kg' };
      else if (key === 'body_fat') values.body_fat = v;
      else values[key] = { v, u: 'cm' };
    }
    byDay.set(day, values);
  }
  return [...byDay.entries()]
    .filter(([, values]) => Object.keys(values).length > 0)
    .map(([measuredOn, values]) => ({ measuredOn, values }))
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
}

// Cette méthode permet de compléter une mesure existante avec les seules valeurs importées qu'elle n'a pas encore ;
// renvoie null si rien n'est à ajouter.
export function mergeMeasurementValues(
  existing: BodyMeasurementValues,
  incoming: BodyMeasurementValues,
): BodyMeasurementValues | null {
  const merged: BodyMeasurementValues = { ...existing };
  let changed = false;
  for (const [k, v] of Object.entries(incoming) as [keyof BodyMeasurementValues, never][]) {
    if (merged[k] !== undefined) continue;
    merged[k] = v;
    changed = true;
  }
  return changed ? merged : null;
}
