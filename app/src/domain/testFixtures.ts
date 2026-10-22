// Fabriques de données pour les tests du domaine (non importées par l'app).
import {
  DEFAULT_SETTINGS,
  type MeasurementType,
  type SetKind,
  type Settings,
  type WorkoutExercise,
  type WorkoutRow,
  type WorkoutSet,
} from './types';

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

type SetSpec = {
  kind?: SetKind;
  kg?: number;
  lb?: number;
  reps?: number;
  s?: number;
  km?: number;
  done?: boolean;
};

// Cette méthode permet de fabriquer une série de test.
export function set(spec: SetSpec): WorkoutSet {
  const s: WorkoutSet = { id: nextId('set'), kind: spec.kind ?? 'normal', done: spec.done ?? true };
  if (spec.kg !== undefined) s.weight = { v: spec.kg, u: 'kg' };
  if (spec.lb !== undefined) s.weight = { v: spec.lb, u: 'lb' };
  if (spec.reps !== undefined) s.reps = spec.reps;
  if (spec.s !== undefined) s.durationS = spec.s;
  if (spec.km !== undefined) s.distance = { v: spec.km, u: 'km' };
  return s;
}

// Cette méthode permet de fabriquer des séries « charge × reps » à partir d'une liste de reps.
export function sets(kg: number, reps: number[], kind: SetKind = 'normal'): WorkoutSet[] {
  return reps.map((r) => set({ kg, reps: r, kind }));
}

// Cette méthode permet de fabriquer un exercice de séance de test.
export function entry(
  exerciseId: string,
  s: WorkoutSet[],
  type: MeasurementType = 'weight_reps',
): WorkoutExercise {
  return { id: nextId('we'), exerciseId, measurementType: type, restS: 90, sets: s };
}

// Cette méthode permet de fabriquer une séance terminée de test.
export function workout(
  startedAt: number,
  exercises: WorkoutExercise[],
  extra: Partial<WorkoutRow> = {},
): WorkoutRow {
  return {
    id: nextId('w'),
    user_id: 'u1',
    status: 'completed',
    owner_device_id: 'd1',
    routine_id: null,
    started_at: startedAt,
    exercise_ids: [...new Set(exercises.map((e) => e.exerciseId))],
    doc: { schemaVersion: 1, title: 'Test', exercises },
    client_updated_at: startedAt,
    client_device_id: 'd1',
    deleted_at: null,
    ...extra,
  };
}

// Cette méthode permet d'obtenir un jeu de paramètres de test.
export function settings(over: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...over };
}

export const DAY = 86_400_000;
export const T0 = new Date(2026, 0, 5, 18, 0).getTime(); // lundi 5 janvier 2026, 18 h
