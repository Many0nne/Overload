// Entrées des outils d'écriture du connecteur Claude (docs/spec-mcp.md §6.3) : conversion dans les unités de l'utilisateur
// et validation selon le type de mesure, avant de construire les documents synchronisés.
import { MEASUREMENT_LABELS } from '../labels';
import { FIELDS, hasReps, normalizeRpe, type SetField } from '../measurement';
import type {
  BodyMeasurementKey,
  BodyMeasurementValues,
  Distance,
  DistanceUnit,
  ExerciseRow,
  Length,
  LengthUnit,
  RepRange,
  RoutineDoc,
  RoutineExercise,
  RoutineSet,
  SetKind,
  Settings,
  Weight,
  WeightUnit,
  WorkoutDoc,
  WorkoutExercise,
  WorkoutSet,
} from '../types';

type Units = Settings['units'];

export type WeightIn = number | { v: number; u: WeightUnit };
export type DistanceIn = number | { v: number; u: DistanceUnit };
export type LengthIn = number | { v: number; u: LengthUnit };

export type SetIn = {
  kind?: SetKind;
  weight?: WeightIn;
  reps?: number;
  durationS?: number;
  distance?: DistanceIn;
  rpe?: number;
};

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(message: string): Result<T> => ({ ok: false, message });

const FIELD_LABELS: Record<SetField, string> = {
  weight: 'weight (charge)',
  reps: 'reps',
  duration: 'durationS (durée en secondes)',
  distance: 'distance',
};

// Cette méthode permet de convertir une charge saisie (nombre = unité de l'utilisateur) en charge stockée { v, u }.
export function toWeight(w: WeightIn, unit: WeightUnit): Weight {
  return typeof w === 'number' ? { v: w, u: unit } : { v: w.v, u: w.u };
}

// Cette méthode permet de convertir une distance saisie (nombre = unité de l'utilisateur) en distance stockée { v, u }.
export function toDistance(d: DistanceIn, unit: DistanceUnit): Distance {
  return typeof d === 'number' ? { v: d, u: unit } : { v: d.v, u: d.u };
}

// Cette méthode permet de convertir une longueur saisie (nombre = unité de l'utilisateur) en longueur stockée { v, u }.
export function toLength(l: LengthIn, unit: LengthUnit): Length {
  return typeof l === 'number' ? { v: l, u: unit } : { v: l.v, u: l.u };
}

const finite = (n: number) => Number.isFinite(n);

// Cette méthode permet de construire les valeurs d'une série pour un type de mesure, en ignorant les champs hors sujet ;
// renvoie la liste des champs obligatoires manquants ou une erreur de valeur.
function setValues(
  input: SetIn,
  fields: SetField[],
  units: Units,
): Result<Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance'>> & { missing?: SetField[] } {
  const out: Pick<WorkoutSet, 'weight' | 'reps' | 'durationS' | 'distance'> = {};
  const missing: SetField[] = [];
  for (const f of fields) {
    if (f === 'weight') {
      if (input.weight === undefined) missing.push(f);
      else {
        const w = toWeight(input.weight, units.weight);
        if (!finite(w.v) || w.v < 0 || w.v > 2000) return fail(`charge invalide (${w.v})`);
        out.weight = w;
      }
    } else if (f === 'reps') {
      if (input.reps === undefined) missing.push(f);
      else {
        if (!Number.isInteger(input.reps) || input.reps < 0 || input.reps > 1000)
          return fail(`reps invalides (${input.reps})`);
        out.reps = input.reps;
      }
    } else if (f === 'duration') {
      if (input.durationS === undefined) missing.push(f);
      else {
        if (!Number.isInteger(input.durationS) || input.durationS <= 0 || input.durationS > 86_400)
          return fail(`durée invalide (${input.durationS} s)`);
        out.durationS = input.durationS;
      }
    } else if (input.distance === undefined) missing.push(f);
    else {
      const d = toDistance(input.distance, units.distance);
      if (!finite(d.v) || d.v <= 0 || d.v > 1000) return fail(`distance invalide (${d.v})`);
      out.distance = d;
    }
  }
  return { ok: true, value: out, missing };
}

// Cette méthode permet de vérifier une fourchette de répétitions pour un exercice (refusée pour les types sans reps).
export function checkRepRange(
  exercise: ExerciseRow,
  range: RepRange | undefined,
): Result<RepRange | undefined> {
  if (range === undefined) return ok(undefined);
  if (!hasReps(exercise.measurement_type))
    return fail(
      `${exercise.name} se mesure en « ${MEASUREMENT_LABELS[exercise.measurement_type]} » : pas de fourchette de reps.`,
    );
  if (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min < 1 || range.max < range.min)
    return fail(`Fourchette invalide pour ${exercise.name} : ${range.min}–${range.max}.`);
  if (range.max > 100) return fail(`Fourchette trop haute pour ${exercise.name} (100 reps au plus).`);
  return ok({ min: range.min, max: range.max });
}

// Cette méthode permet de construire un exercice de séance terminée (séries validées, sans objectif) à partir de la saisie.
// Les champs requis dépendent du type de mesure ; `previous` réutilise les ids d'une entrée existante (modification).
export function buildWorkoutExercise(
  exercise: ExerciseRow,
  input: { sets: SetIn[]; note?: string },
  ctx: { units: Units; defaultRestS: number | null; newId: () => string; previous?: WorkoutExercise },
): Result<WorkoutExercise> {
  if (!input.sets.length) return fail(`${exercise.name} : au moins une série.`);
  const type = exercise.measurement_type;
  const sets: WorkoutSet[] = [];
  for (const [i, s] of input.sets.entries()) {
    const v = setValues(s, FIELDS[type], ctx.units);
    if (!v.ok) return fail(`${exercise.name}, série ${i + 1} : ${v.message}.`);
    if (v.missing?.length)
      return fail(
        `${exercise.name}, série ${i + 1} : champ(s) requis manquant(s) ${v.missing.map((f) => FIELD_LABELS[f]).join(', ')} ` +
          `(type « ${MEASUREMENT_LABELS[type]} » : ${FIELDS[type].map((f) => FIELD_LABELS[f]).join(', ')}).`,
      );
    const prevSet = ctx.previous?.sets[i];
    const rpe = normalizeRpe(s.rpe);
    sets.push({
      id: prevSet?.id ?? ctx.newId(),
      kind: s.kind ?? 'normal',
      ...v.value,
      done: true,
      ...(rpe !== undefined ? { rpe } : {}),
      ...(prevSet?.doneAt !== undefined ? { doneAt: prevSet.doneAt } : {}),
      ...(prevSet?.target ? { target: prevSet.target } : {}),
    });
  }
  const prev = ctx.previous;
  const note = input.note ?? prev?.note;
  return ok({
    id: prev?.id ?? ctx.newId(),
    exerciseId: exercise.id,
    measurementType: type,
    ...(note ? { note } : {}),
    restS: prev ? prev.restS : ctx.defaultRestS,
    ...(prev?.repRange ? { repRange: prev.repRange } : {}),
    ...(prev?.targetReason ? { targetReason: prev.targetReason } : {}),
    ...(prev?.targetCount !== undefined ? { targetCount: prev.targetCount } : {}),
    sets,
  });
}

export type RoutineSetIn = Omit<SetIn, 'reps' | 'rpe'>;

// Cette méthode permet de construire un exercice de routine (séries prévues, fourchette, repos) à partir de la saisie.
// `sets` est une liste de séries ou un nombre de séries normales ; un repos absent prend le repos par défaut.
export function buildRoutineExercise(
  exercise: ExerciseRow,
  input: { sets: RoutineSetIn[] | number; repRange?: RepRange; restS?: number | null; note?: string },
  ctx: { units: Units; defaultRestS: number | null; newId: () => string; previous?: RoutineExercise },
): Result<RoutineExercise> {
  const list: RoutineSetIn[] =
    typeof input.sets === 'number'
      ? Array.from({ length: input.sets }, () => ({ kind: 'normal' }))
      : input.sets;
  if (!list.length || list.length > 30) return fail(`${exercise.name} : entre 1 et 30 séries.`);
  const range = checkRepRange(exercise, input.repRange ?? ctx.previous?.repRange);
  if (!range.ok) return range;
  if (
    input.restS !== undefined &&
    input.restS !== null &&
    (!Number.isInteger(input.restS) || input.restS < 0 || input.restS > 3600)
  )
    return fail(`${exercise.name} : repos invalide (${input.restS} s, entre 0 et 3600).`);
  const optional = FIELDS[exercise.measurement_type].filter((f) => f !== 'reps');
  const sets: RoutineSet[] = [];
  for (const [i, s] of list.entries()) {
    const v = setValues(s, optional, ctx.units);
    if (!v.ok) return fail(`${exercise.name}, série ${i + 1} : ${v.message}.`);
    sets.push({ id: ctx.previous?.sets[i]?.id ?? ctx.newId(), kind: s.kind ?? 'normal', ...v.value });
  }
  const note = input.note ?? ctx.previous?.note;
  return ok({
    id: ctx.previous?.id ?? ctx.newId(),
    exerciseId: exercise.id,
    restS: input.restS !== undefined ? input.restS : (ctx.previous?.restS ?? ctx.defaultRestS),
    ...(note ? { note } : {}),
    ...(range.value ? { repRange: range.value } : {}),
    sets,
  });
}

// Cette méthode permet de relier en superset (#77) les exercices dont l'indicateur `superset` est vrai avec le suivant.
// Un superset relie exactement deux exercices : le dernier exercice et deux indicateurs consécutifs sont refusés.
export function applySupersets<T extends { id: string; groupId?: string }>(
  list: T[],
  flags: (boolean | undefined)[],
  names: string[],
  newId: () => string,
): Result<T[]> {
  const out = list.map((e) => {
    const { groupId: _drop, ...rest } = e;
    return rest as T;
  });
  for (const [i, f] of flags.entries()) {
    if (!f) continue;
    if (i === list.length - 1)
      return fail(`${names[i]} : « superset » relie à l'exercice suivant, il n'y en a pas.`);
    if (flags[i - 1])
      return fail(
        `${names[i]} : un superset relie deux exercices, pas plus (les circuits ne sont pas gérés).`,
      );
    const groupId = list[i]!.groupId ?? newId();
    out[i] = { ...out[i]!, groupId };
    out[i + 1] = { ...out[i + 1]!, groupId };
  }
  return ok(out);
}

// Cette méthode permet de retrouver, pour chaque nouvel exercice, l'entrée existante du même exercice à réutiliser
// (dans l'ordre, chaque entrée une seule fois) : les ids des exercices conservés sont gardés.
export function matchPrevious<T extends { exerciseId: string }>(
  previous: T[],
  exerciseIds: string[],
): (T | undefined)[] {
  const used = new Set<number>();
  return exerciseIds.map((id) => {
    const idx = previous.findIndex((p, i) => !used.has(i) && p.exerciseId === id);
    if (idx < 0) return undefined;
    used.add(idx);
    return previous[idx];
  });
}

// Cette méthode permet de construire un document de routine complet (schemaVersion 2).
export function routineDoc(name: string, note: string | undefined, exercises: RoutineExercise[]): RoutineDoc {
  return { schemaVersion: 2, name: name.trim(), ...(note ? { note } : {}), exercises };
}

// Cette méthode permet de construire un document de séance terminée (saisie a posteriori, §F7.5).
export function workoutDoc(input: {
  title: string;
  note?: string;
  durationS?: number;
  photoPath?: string;
  exercises: WorkoutExercise[];
}): WorkoutDoc {
  return {
    schemaVersion: 2,
    title: input.title,
    ...(input.note ? { note: input.note } : {}),
    ...(input.photoPath ? { photoPath: input.photoPath } : {}),
    ...(input.durationS !== undefined ? { durationS: input.durationS } : {}),
    exercises: input.exercises,
  };
}

export const MEASUREMENT_KEYS: BodyMeasurementKey[] = [
  'weight',
  'body_fat',
  'neck',
  'shoulders',
  'chest',
  'arm_left',
  'arm_right',
  'waist',
  'hips',
  'thigh_left',
  'thigh_right',
  'calf_left',
  'calf_right',
];

export type MeasurementIn = Partial<Record<BodyMeasurementKey, number | { v: number; u: string }>>;

// Cette méthode permet de convertir des mesures saisies (poids en unité de poids, tour en unité de longueur, % de masse
// grasse) en valeurs stockées, en refusant les valeurs hors bornes.
export function toMeasurementValues(input: MeasurementIn, units: Units): Result<BodyMeasurementValues> {
  const out: BodyMeasurementValues = {};
  const entries = Object.entries(input).filter(([, v]) => v !== undefined) as [
    BodyMeasurementKey,
    LengthIn,
  ][];
  if (!entries.length) return fail('Aucune mesure fournie.');
  for (const [k, raw] of entries) {
    if (!MEASUREMENT_KEYS.includes(k)) return fail(`Mesure inconnue : ${k}.`);
    if (k === 'body_fat') {
      const v = typeof raw === 'number' ? raw : raw.v;
      if (!finite(v) || v <= 0 || v >= 100) return fail(`Masse grasse invalide (${v} %).`);
      out.body_fat = v;
    } else if (k === 'weight') {
      const w = toWeight(raw as WeightIn, units.weight);
      if (!finite(w.v) || w.v <= 0 || w.v > 1000 || (w.u !== 'kg' && w.u !== 'lb'))
        return fail(`Poids invalide (${w.v}).`);
      out.weight = w;
    } else {
      const l = toLength(raw, units.length);
      if (!finite(l.v) || l.v <= 0 || l.v > 500 || (l.u !== 'cm' && l.u !== 'in'))
        return fail(`Mesure ${k} invalide (${l.v}).`);
      out[k] = l;
    }
  }
  return ok(out);
}

// Cette méthode permet de compléter la mesure du jour : sans écrasement, seules les valeurs absentes sont ajoutées ;
// renvoie les valeurs fusionnées et les clés ignorées car déjà remplies.
export function mergeMeasurement(
  existing: BodyMeasurementValues,
  incoming: BodyMeasurementValues,
  overwrite: boolean,
): { values: BodyMeasurementValues; ignored: BodyMeasurementKey[] } {
  if (overwrite) return { values: { ...existing, ...incoming }, ignored: [] };
  const values: BodyMeasurementValues = { ...existing };
  const ignored: BodyMeasurementKey[] = [];
  for (const [k, v] of Object.entries(incoming) as [BodyMeasurementKey, never][]) {
    if (values[k] !== undefined) ignored.push(k);
    else values[k] = v;
  }
  return { values, ignored };
}
