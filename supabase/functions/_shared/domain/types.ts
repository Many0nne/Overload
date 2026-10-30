// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Types partagés du domaine (spec technique §5.3) et lignes synchronisées (§5.1, §5.2).
// Les lignes locales (Dexie) ont exactement les colonnes serveur, en snake_case ; les documents JSON sont en camelCase.
// Format d'échange : les timestamptz (started_at, deleted_at, archived_at) circulent en millisecondes epoch (number).

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';
export type LengthUnit = 'cm' | 'in';

export type Weight = { v: number; u: WeightUnit };
export type Distance = { v: number; u: DistanceUnit };
export type Length = { v: number; u: LengthUnit };

export type SetKind = 'normal' | 'warmup' | 'drop' | 'failure';

export type MeasurementType =
  | 'weight_reps'
  | 'bodyweight'
  | 'weighted_bw'
  | 'assisted_bw'
  | 'duration'
  | 'weight_duration'
  | 'distance_duration';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'traps'
  | 'lower_back'
  | 'cardio';

export type RepRange = { min: number; max: number };

export type SetTarget = { weight?: Weight; reps?: number; durationS?: number };

export type TargetReason =
  | { kind: 'comeback'; weeksOff: number }
  | { kind: 'plateau' }
  // assistanceDrop : type assisté uniquement ; rpe : effort facile (≤ 7) ayant doublé l'incrément
  | { kind: 'load_up'; reachedReps: number; assistanceDrop?: Weight; rpe?: number }
  | { kind: 'consolidate'; rpe?: number } // rpe : maximum atteint à l'effort maximal (10)
  | { kind: 'reps_up'; step?: number; rpe?: number } // step : reps ajoutées (1 par défaut, 2 si effort facile)
  | { kind: 'mixed'; rpe?: number } // cas différents selon les séries (montée, +1 rep, consolidation)
  | { kind: 'duration_up' };

export type WorkoutSet = {
  id: string;
  kind: SetKind;
  weight?: Weight;
  reps?: number;
  durationS?: number;
  distance?: Distance;
  done: boolean;
  doneAt?: number;
  target?: SetTarget;
  rpe?: number; // effort ressenti, 6 à 10 par demi-point (facultatif)
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  measurementType: MeasurementType;
  note?: string;
  restS: number | null;
  repRange?: RepRange;
  targetReason?: TargetReason;
  targetCount?: number; // nombre de séries ayant reçu un objectif au démarrage (une série supprimée compte comme non atteinte)
  sets: WorkoutSet[];
};

export type WorkoutDoc = {
  schemaVersion: 1;
  title: string;
  note?: string;
  photoPath?: string;
  durationS?: number;
  exercises: WorkoutExercise[];
};

export type RoutineSet = Omit<WorkoutSet, 'done' | 'doneAt' | 'target' | 'reps' | 'rpe'>;

export type RoutineExercise = {
  id: string;
  exerciseId: string;
  restS: number | null;
  note?: string;
  repRange?: RepRange;
  sets: RoutineSet[];
};

export type RoutineDoc = {
  schemaVersion: 1;
  name: string;
  note?: string;
  exercises: RoutineExercise[];
};

/** Type de barre du calculateur de disques (issue #100). */
export type BarType = 'olympic' | 'women' | 'ez' | 'trap';

export type ExercisePrefsDoc = {
  schemaVersion: 1;
  bar?: BarType; // barre choisie à la main pour le calculateur ; absent = détection auto ou barre par défaut
  increment?: Weight;
  defaultRepRange?: RepRange;
  longTermGoal?: { weight: Weight; reps: number; setAt: number };
  rpe?: boolean; // noter l'effort (RPE) ; absent = défaut de l'exercice (exerciseOptions.ts, issue #124)
  progression?: boolean; // objectif de progression ; absent = défaut de l'exercice
};

export type TrainingAgeBucket = 'none' | 'lt6m' | '6to12m' | '1to2y' | '2to5y' | 'gt5y';

export type Settings = {
  units: { weight: WeightUnit; length: LengthUnit; distance: DistanceUnit };
  defaultRestS: number | null;
  timerSound: boolean;
  keepAwake: boolean;
  theme: 'dark' | 'light' | 'auto';
  restNotification: boolean;
  profileChart: 'duration' | 'volume' | 'count';
  progressionEnabled: boolean;
  rpeEnabled: boolean;
  trainingAge?: { bucket: TrainingAgeBucket; declaredAt: number };
  /** Barres et disques disponibles par unité (calculateur de disques) ; absent = valeurs par défaut. */
  plates?: Partial<Record<WeightUnit, PlateSettingsDoc>>;
};

export type PlateSettingsDoc = {
  /** Poids de la barre par défaut (seul champ barre avant #100, toujours écrit pour les anciennes versions). */
  bar: number;
  plates: number[];
  /** Poids réglé de chaque type de barre ; absent = valeur par défaut. */
  bars?: Partial<Record<BarType, number>>;
  /** Barre des exercices sans barre détectée ni choisie ; absent = olympique. */
  defaultBar?: BarType;
};

export const DEFAULT_SETTINGS: Settings = {
  units: { weight: 'kg', length: 'cm', distance: 'km' },
  defaultRestS: 90,
  timerSound: true,
  keepAwake: true,
  theme: 'dark',
  restNotification: true,
  profileChart: 'count',
  progressionEnabled: true,
  rpeEnabled: false,
};

// ---------- Lignes synchronisées ----------

export type SyncMeta = {
  client_updated_at: number;
  client_device_id: string;
  rev?: number; // attribué par le serveur ; absent tant que jamais synchronisé
};

export type Deletable = { deleted_at: number | null };

export type ProfileRow = SyncMeta & {
  id: string;
  display_name: string;
  avatar_path: string | null;
  is_admin: boolean;
  invite_code: string;
  settings: Settings;
};

export type ExerciseRow = SyncMeta &
  Deletable & {
    id: string;
    user_id: string | null; // null = catalogue
    name: string;
    name_search: string;
    equipment: Equipment;
    primary_muscle: Muscle;
    secondary_muscles: Muscle[];
    measurement_type: MeasurementType;
    instructions: string | null;
    source_id: string | null;
    archived_at: number | null;
  };

export type FolderRow = SyncMeta &
  Deletable & {
    id: string;
    user_id: string;
    name: string;
    position: number;
    collapsed: boolean;
  };

export type RoutineRow = SyncMeta &
  Deletable & {
    id: string;
    user_id: string;
    folder_id: string | null;
    position: number;
    doc: RoutineDoc;
  };

export type WorkoutStatus = 'in_progress' | 'completed';

export type WorkoutRow = SyncMeta &
  Deletable & {
    id: string;
    user_id: string;
    status: WorkoutStatus;
    owner_device_id: string;
    routine_id: string | null;
    started_at: number;
    exercise_ids: string[];
    doc: WorkoutDoc;
  };

export type BodyMeasurementKey =
  | 'weight'
  | 'body_fat'
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'arm_left'
  | 'arm_right'
  | 'waist'
  | 'hips'
  | 'thigh_left'
  | 'thigh_right'
  | 'calf_left'
  | 'calf_right';

export type BodyMeasurementValues = {
  weight?: Weight;
  body_fat?: number;
} & Partial<Record<Exclude<BodyMeasurementKey, 'weight' | 'body_fat'>, Length>>;

export type BodyMeasurementRow = SyncMeta &
  Deletable & {
    id: string;
    user_id: string;
    measured_on: string; // AAAA-MM-JJ
    values: BodyMeasurementValues;
  };

export type ExercisePrefsRow = SyncMeta &
  Deletable & {
    id: string; // UUID v5 de (user_id, exercise_id)
    user_id: string;
    exercise_id: string;
    doc: ExercisePrefsDoc;
  };

export type SyncTable =
  | 'profiles'
  | 'exercises'
  | 'folders'
  | 'routines'
  | 'workouts'
  | 'body_measurements'
  | 'exercise_prefs';

export type CompletedWorkout = WorkoutRow & { status: 'completed' };
