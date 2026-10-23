import { db } from '@/data/db';
import { deviceIdSync } from '@/data/device';
import { createExercise } from '@/data/repositories';
import { saveRow } from '@/data/repositories/base';
import { currentUserId } from '@/data/session';
import {
  buildWorkoutDoc,
  detectHevyFile,
  guessExerciseTraits,
  type HevyExerciseSummary,
  HevyFormatError,
  type HevyMeasurement,
  type HevyWorkout,
  MATCH_THRESHOLD,
  type MatchSuggestion,
  mergeMeasurementValues,
  parseHevyMeasurements,
  parseHevyWorkouts,
  type ResolvedExercise,
  suggestMatch,
  summarizeExercises,
} from '@/domain/hevy';
import { hevyWorkoutId, uuidv7 } from '@/domain/ids';
import type { BodyMeasurementValues, Equipment, MeasurementType, Muscle } from '@/domain/types';

export type ExerciseChoice =
  | { kind: 'existing'; exerciseId: string }
  | { kind: 'create'; equipment: Equipment; primary_muscle: Muscle; measurement_type: MeasurementType }
  | { kind: 'skip' };

export type ImportExercise = HevyExerciseSummary & { suggestion: MatchSuggestion | null };

export type MeasurementPatch = { id?: string; measuredOn: string; values: BodyMeasurementValues };

export type HevyImportPlan = {
  workouts: HevyWorkout[]; // séances absentes d'Overload uniquement
  alreadyImported: number;
  exercises: ImportExercise[];
  measurements: MeasurementPatch[]; // mesures à créer ou à compléter
  measurementsUnchanged: number;
};

export type HevyImportResult = { workouts: number; exercisesCreated: number; measurements: number };

// Cette méthode permet de lire les fichiers choisis (séances et/ou mesures, reconnus par leur en-tête) et de préparer
// l'import : séances pas encore importées, exercices à faire correspondre avec leur suggestion, mesures à compléter.
export async function prepareHevyImport(files: File[]): Promise<HevyImportPlan> {
  let parsed: HevyWorkout[] = [];
  let measures: HevyMeasurement[] = [];
  for (const f of files) {
    const text = await f.text();
    const kind = detectHevyFile(text);
    if (kind === 'workouts') parsed = [...parsed, ...parseHevyWorkouts(text)];
    else if (kind === 'measurements') measures = [...measures, ...parseHevyMeasurements(text)];
    else
      throw new HevyFormatError(
        `« ${f.name} » n'est pas un export HEVY (workout_data.csv ou measurement_data.csv)`,
      );
  }

  const userId = currentUserId();
  const existing = await db.workouts.bulkGet(parsed.map((w) => hevyWorkoutId(userId, w.key)));
  const workouts = parsed.filter((_, i) => !existing[i]);

  const candidates = (await db.exercises.toArray())
    .filter((e) => e.deleted_at == null && e.archived_at == null)
    .map((e) => ({ id: e.id, name: e.name, measurementType: e.measurement_type }));
  const exercises = summarizeExercises(workouts).map((s) => ({
    ...s,
    suggestion: suggestMatch(s.title, s.measurementType, candidates),
  }));

  const measurements: MeasurementPatch[] = [];
  for (const m of measures) {
    const prev = (await db.body_measurements.where('measured_on').equals(m.measuredOn).toArray()).find(
      (r) => r.deleted_at == null,
    );
    if (!prev) measurements.push({ measuredOn: m.measuredOn, values: m.values });
    else {
      const merged = mergeMeasurementValues(prev.values, m.values);
      if (merged) measurements.push({ id: prev.id, measuredOn: m.measuredOn, values: merged });
    }
  }

  return {
    workouts,
    alreadyImported: parsed.length - workouts.length,
    exercises,
    measurements,
    measurementsUnchanged: measures.length - measurements.length,
  };
}

// Cette méthode permet d'écrire l'import en une seule transaction (tout ou rien) : exercices perso à créer, séances
// terminées à id stable, mesures ; une séance dont tous les exercices sont ignorés n'est pas créée.
export async function runHevyImport(
  plan: HevyImportPlan,
  choices: Map<string, ExerciseChoice>,
): Promise<HevyImportResult> {
  const userId = currentUserId();
  const result: HevyImportResult = { workouts: 0, exercisesCreated: 0, measurements: 0 };
  await db.transaction('rw', [db.exercises, db.workouts, db.body_measurements, db.outbox], async () => {
    const resolved = new Map<string, ResolvedExercise | null>();
    for (const ex of plan.exercises) {
      const choice = choices.get(ex.title) ?? { kind: 'skip' };
      if (choice.kind === 'skip') resolved.set(ex.title, null);
      else if (choice.kind === 'existing') {
        const row = await db.exercises.get(choice.exerciseId);
        resolved.set(ex.title, row ? { exerciseId: row.id, measurementType: row.measurement_type } : null);
      } else {
        const row = await createExercise({
          name: ex.title,
          equipment: choice.equipment,
          primary_muscle: choice.primary_muscle,
          secondary_muscles: [],
          measurement_type: choice.measurement_type,
          instructions: null,
        });
        resolved.set(ex.title, { exerciseId: row.id, measurementType: row.measurement_type });
        result.exercisesCreated++;
      }
    }

    for (const w of plan.workouts) {
      const doc = buildWorkoutDoc(w, (t) => resolved.get(t) ?? null, uuidv7);
      if (doc.exercises.length === 0) continue;
      await saveRow('workouts', {
        id: hevyWorkoutId(userId, w.key),
        user_id: userId,
        status: 'completed',
        owner_device_id: deviceIdSync(),
        routine_id: null,
        started_at: w.startedAt,
        exercise_ids: [...new Set(doc.exercises.map((e) => e.exerciseId))],
        doc,
        deleted_at: null,
      });
      result.workouts++;
    }

    for (const m of plan.measurements) {
      await saveRow('body_measurements', {
        id: m.id ?? uuidv7(),
        user_id: userId,
        measured_on: m.measuredOn,
        values: m.values,
        deleted_at: null,
      });
      result.measurements++;
    }
  });
  return result;
}

// Cette méthode permet de proposer le choix par défaut d'un exercice HEVY : la suggestion si elle est fiable (dont
// l'exercice perso créé au même nom par un import précédent), sinon un exercice perso aux traits devinés.
export function defaultChoice(ex: ImportExercise): ExerciseChoice {
  if (ex.suggestion && ex.suggestion.score >= MATCH_THRESHOLD)
    return { kind: 'existing', exerciseId: ex.suggestion.candidate.id };
  return {
    kind: 'create',
    ...guessExerciseTraits(ex.title, ex.measurementType),
    measurement_type: ex.measurementType,
  };
}
