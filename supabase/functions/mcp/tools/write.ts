// Outils d'écriture du connecteur Claude (docs/spec-mcp.md §6.3) : passent par sync_push (appareil virtuel), exigent le
// droit d'écriture de la connexion et sont journalisés (mcp_audit). Suppressions logiques uniquement.
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/mcp.js';
import { z } from 'npm:zod@4.6.7';
import { prefsId, uuidv7 } from '../../_shared/domain/ids.ts';
import {
  buildRoutineExercise,
  buildWorkoutExercise,
  checkRepRange,
  MEASUREMENT_KEYS,
  type MeasurementIn,
  matchPrevious,
  mergeMeasurement,
  type RoutineSetIn,
  routineDoc,
  type SetIn,
  toMeasurementValues,
  toWeight,
  type WeightIn,
  workoutDoc,
} from '../../_shared/domain/mcp/inputs.ts';
import { routineText, routineView, workoutDetail } from '../../_shared/domain/mcp/views.ts';
import { defaultTitleTz, nextPosition } from '../../_shared/domain/mcp/writes.ts';
import { workoutBadges } from '../../_shared/domain/records.ts';
import { exerciseIdsOf } from '../../_shared/domain/summary.ts';
import type {
  BodyMeasurementRow,
  ExercisePrefsDoc,
  ExercisePrefsRow,
  ExerciseRow,
  RepRange,
  RoutineExercise,
  RoutineRow,
  WorkoutExercise,
  WorkoutRow,
} from '../../_shared/domain/types.ts';
import { type Store, ToolError } from '../store.ts';
import {
  dayOf,
  distanceSchema,
  exerciseOf,
  exerciseRefSchema,
  folderOf,
  instantOf,
  ok,
  repRangeSchema,
  routineOf,
  run,
  setKindSchema,
  tzOf,
  tzSchema,
  weightSchema,
} from './common.ts';
import { viewCtx } from './read.ts';

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const DESTRUCTIVE = { ...WRITE, destructiveHint: true };
const DEFAULT_DURATION_S = 3600;

const routineSetSchema = z.object({
  kind: setKindSchema,
  weight: weightSchema.optional(),
  durationS: z.number().int().optional().describe('Durée prévue en secondes (types à durée).'),
  distance: distanceSchema.optional(),
});

const routineExerciseSchema = z.object({
  exercise: exerciseRefSchema,
  sets: z
    .union([z.number().int().min(1).max(30), z.array(routineSetSchema).min(1).max(30)])
    .describe('Nombre de séries normales, ou liste détaillée des séries prévues.'),
  repRange: repRangeSchema.optional().describe('Fourchette de reps (refusée pour les types sans reps).'),
  restS: z
    .number()
    .int()
    .min(0)
    .max(3600)
    .nullable()
    .optional()
    .describe('Repos en secondes ; absent = repos par défaut de l’utilisateur ; null = sans minuteur.'),
  note: z.string().max(500).optional(),
});

const workoutSetSchema = z.object({
  kind: setKindSchema,
  weight: weightSchema.optional(),
  reps: z.number().int().optional(),
  durationS: z.number().int().optional().describe('Durée en secondes.'),
  distance: distanceSchema.optional(),
  rpe: z.number().min(6).max(10).multipleOf(0.5).optional().describe('Effort ressenti (RPE 6 à 10 par demi-point), facultatif.'),
});

const workoutExerciseSchema = z.object({
  exercise: exerciseRefSchema,
  sets: z
    .array(workoutSetSchema)
    .min(1)
    .max(50)
    .describe(
      'Séries réalisées. Champs requis selon le type de mesure : poids et reps (weight, reps), poids du corps (reps), ' +
        'lesté/assisté (weight = charge ajoutée/assistance, reps), durée (durationS), poids et durée (weight, durationS), ' +
        'distance et durée (distance, durationS).',
    ),
  note: z.string().max(500).optional(),
});

type RoutineExIn = z.infer<typeof routineExerciseSchema>;
type WorkoutExIn = z.infer<typeof workoutExerciseSchema>;

// Cette méthode permet de résoudre les exercices de la saisie en une seule passe, en rassemblant toutes les erreurs.
async function resolveAll(store: Store, refs: string[]): Promise<ExerciseRow[]> {
  const out: ExerciseRow[] = [];
  const errors: string[] = [];
  for (const ref of refs) {
    try {
      out.push(await exerciseOf(store, ref));
    } catch (e) {
      if (e instanceof ToolError) errors.push(e.message);
      else throw e;
    }
  }
  if (errors.length) throw new ToolError(errors.join('\n'));
  return out;
}

// Cette méthode permet de construire les exercices d'une routine, en réutilisant les entrées existantes du même exercice.
async function routineExercises(store: Store, input: RoutineExIn[], previous: RoutineExercise[]): Promise<RoutineExercise[]> {
  const [exercises, profile] = await Promise.all([resolveAll(store, input.map((e) => e.exercise)), store.profile()]);
  const prev = matchPrevious(previous, exercises.map((e) => e.id));
  return input.map((e, i) => {
    const r = buildRoutineExercise(
      exercises[i]!,
      { sets: e.sets as RoutineSetIn[] | number, repRange: e.repRange, restS: e.restS, note: e.note },
      { units: profile.settings.units, defaultRestS: profile.settings.defaultRestS, newId: uuidv7, previous: prev[i] },
    );
    if (!r.ok) throw new ToolError(r.message);
    return r.value;
  });
}

// Cette méthode permet de construire les exercices d'une séance terminée, en réutilisant les entrées existantes.
async function workoutExercises(store: Store, input: WorkoutExIn[], previous: WorkoutExercise[]): Promise<WorkoutExercise[]> {
  const [exercises, profile] = await Promise.all([resolveAll(store, input.map((e) => e.exercise)), store.profile()]);
  const prev = matchPrevious(previous, exercises.map((e) => e.id));
  return input.map((e, i) => {
    const r = buildWorkoutExercise(
      exercises[i]!,
      { sets: e.sets as SetIn[], note: e.note },
      { units: profile.settings.units, defaultRestS: profile.settings.defaultRestS, newId: uuidv7, previous: prev[i] },
    );
    if (!r.ok) throw new ToolError(r.message);
    return r.value;
  });
}

// Cette méthode permet de renvoyer une routine écrite (texte et JSON relus après écriture).
async function routineResult(store: Store, row: RoutineRow, verb: string) {
  const [folders, ctx] = await Promise.all([store.folders(), viewCtx(store, tzOf(undefined))]);
  const v = routineView(row, folders, ctx);
  return ok(`Routine ${verb}. Elle apparaîtra sur les appareils à leur prochaine synchronisation.\n${routineText(v, ctx)}`, v);
}

// Cette méthode permet de renvoyer une séance écrite, avec les records qu'elle bat par rapport à l'historique.
async function workoutResult(store: Store, row: WorkoutRow, verb: string, tz: string) {
  const [history, ctx] = await Promise.all([
    store.workouts({ exerciseIds: row.exercise_ids, anyOf: true }),
    viewCtx(store, tz),
  ]);
  const v = workoutDetail(row, workoutBadges(row, history.filter((h) => h.status === 'completed')), ctx);
  return ok(`Séance ${verb}.\n${v.text}`, v.data);
}

// Cette méthode permet de relire une séance terminée modifiable, ou de lever l'erreur adaptée.
async function completedWorkout(store: Store, id: string): Promise<WorkoutRow> {
  const w = await store.row<WorkoutRow>('workouts', id.trim()).catch(() => null);
  if (!w || w.deleted_at !== null) throw new ToolError(`Séance ${id} introuvable.`);
  if (w.status !== 'completed')
    throw new ToolError("Séance en cours sur un appareil : elle ne peut pas être modifiée tant qu'elle n'est pas terminée.");
  return w;
}

// Cette méthode permet d'enregistrer les outils d'écriture sur le serveur MCP de la requête.
export function registerWriteTools(server: McpServer, store: Store) {
  const { userId } = store.auth;

  server.registerTool(
    'create_routine',
    {
      title: 'Créer une routine',
      description:
        "Crée une routine (placée en fin de liste, dans un dossier existant si folder est fourni). Chercher d'abord les " +
        'exercices avec search_exercises. Repos absent = repos par défaut de l’utilisateur.',
      inputSchema: {
        name: z.string().min(1).max(100),
        folder: z.string().optional().describe('Nom d’un dossier existant (les dossiers se créent dans l’app).'),
        note: z.string().max(1000).optional(),
        exercises: z.array(routineExerciseSchema).min(1).max(30),
      },
      annotations: WRITE,
    },
    run('create_routine', async (args: { name: string; folder?: string; note?: string; exercises: RoutineExIn[] }) => {
      const folder = args.folder ? await folderOf(store, args.folder) : null;
      const exercises = await routineExercises(store, args.exercises, []);
      const position = nextPosition(await store.routines());
      const id = uuidv7();
      const row = await store.write<RoutineRow>('create_routine', 'routines', id, () => ({
        id,
        user_id: userId,
        folder_id: folder?.id ?? null,
        position,
        doc: routineDoc(args.name, args.note, exercises),
        deleted_at: null,
        client_updated_at: 0,
        client_device_id: store.deviceId,
      }));
      return routineResult(store, row, 'créée');
    }),
  );

  server.registerTool(
    'update_routine',
    {
      title: 'Modifier une routine',
      description:
        'Modifie une routine : seuls les champs fournis changent. exercises remplace la liste entière (les exercices ' +
        'conservés gardent leurs réglages non fournis). folder = null sort la routine de son dossier ; note = "" l’efface.',
      inputSchema: {
        id: z.string().describe('Id de la routine, ou son nom exact.'),
        name: z.string().min(1).max(100).optional(),
        folder: z.string().nullable().optional(),
        note: z.string().max(1000).optional(),
        exercises: z.array(routineExerciseSchema).min(1).max(30).optional(),
      },
      annotations: DESTRUCTIVE,
    },
    run('update_routine', async (args: {
      id: string;
      name?: string;
      folder?: string | null;
      note?: string;
      exercises?: RoutineExIn[];
    }) => {
      const current = await routineOf(store, args.id);
      const folderId =
        args.folder === undefined ? current.folder_id : args.folder === null ? null : (await folderOf(store, args.folder)).id;
      const exercises = args.exercises
        ? await routineExercises(store, args.exercises, current.doc.exercises)
        : current.doc.exercises;
      const row = await store.write<RoutineRow>('update_routine', 'routines', current.id, (prev) => {
        if (!prev || prev.deleted_at !== null) throw new ToolError('Routine supprimée entre-temps.');
        const note = args.note === undefined ? prev.doc.note : args.note || undefined;
        return { ...prev, folder_id: folderId, doc: routineDoc(args.name ?? prev.doc.name, note, exercises) };
      });
      return routineResult(store, row, 'modifiée');
    }),
  );

  server.registerTool(
    'log_workout',
    {
      title: 'Enregistrer une séance passée',
      description:
        'Saisie a posteriori d’une séance terminée : toutes les séries sont validées, sans objectif. Unité absente = unité ' +
        "de l'utilisateur. Durée absente = 1 h. Renvoie la séance et les records battus.",
      inputSchema: {
        startedAt: z.string().describe('Début de la séance (ISO 8601, ex. 2026-10-22T18:00 = heure du fuseau tz).'),
        title: z.string().max(100).optional().describe('Défaut : « <routine ou Séance> – <jour> ».'),
        durationS: z.number().int().min(60).max(86_400).optional().describe('Durée en secondes (défaut 3600).'),
        note: z.string().max(2000).optional(),
        routine: z.string().optional().describe('Routine suivie : id ou nom exact.'),
        exercises: z.array(workoutExerciseSchema).min(1).max(30),
        tz: tzSchema,
      },
      annotations: WRITE,
    },
    run('log_workout', async (args: {
      startedAt: string;
      title?: string;
      durationS?: number;
      note?: string;
      routine?: string;
      exercises: WorkoutExIn[];
      tz?: string;
    }) => {
      const tz = tzOf(args.tz);
      const startedAt = instantOf(args.startedAt, tz, 'startedAt');
      if (startedAt > store.now + 5 * 60_000) throw new ToolError('startedAt est dans le futur : une séance se saisit après coup.');
      const routine = args.routine ? await routineOf(store, args.routine) : undefined;
      const exercises = await workoutExercises(store, args.exercises, []);
      const doc = workoutDoc({
        title: args.title?.trim() || defaultTitleTz(routine?.doc.name, startedAt, tz),
        note: args.note,
        durationS: args.durationS ?? DEFAULT_DURATION_S,
        exercises,
      });
      const id = uuidv7();
      const row = await store.write<WorkoutRow>('log_workout', 'workouts', id, () => ({
        id,
        user_id: userId,
        status: 'completed',
        owner_device_id: store.deviceId,
        routine_id: routine?.id ?? null,
        started_at: startedAt,
        exercise_ids: exerciseIdsOf(doc),
        doc,
        deleted_at: null,
        client_updated_at: 0,
        client_device_id: store.deviceId,
      }));
      return workoutResult(store, row, 'enregistrée', tz);
    }),
  );

  server.registerTool(
    'update_workout',
    {
      title: 'Modifier une séance terminée',
      description:
        'Modifie une séance terminée (jamais une séance en cours) : seuls les champs fournis changent. exercises remplace ' +
        'la liste entière ; les exercices conservés gardent leurs ids et objectifs. note = "" efface la note.',
      inputSchema: {
        id: z.string(),
        startedAt: z.string().optional().describe('Nouveau début (ISO 8601).'),
        title: z.string().min(1).max(100).optional(),
        durationS: z.number().int().min(60).max(86_400).optional(),
        note: z.string().max(2000).optional(),
        exercises: z.array(workoutExerciseSchema).min(1).max(30).optional(),
        tz: tzSchema,
      },
      annotations: DESTRUCTIVE,
    },
    run('update_workout', async (args: {
      id: string;
      startedAt?: string;
      title?: string;
      durationS?: number;
      note?: string;
      exercises?: WorkoutExIn[];
      tz?: string;
    }) => {
      const tz = tzOf(args.tz);
      const current = await completedWorkout(store, args.id);
      const startedAt = args.startedAt ? instantOf(args.startedAt, tz, 'startedAt') : current.started_at;
      const exercises = args.exercises
        ? await workoutExercises(store, args.exercises, current.doc.exercises)
        : current.doc.exercises;
      const row = await store.write<WorkoutRow>('update_workout', 'workouts', current.id, (prev) => {
        if (!prev || prev.deleted_at !== null) throw new ToolError('Séance supprimée entre-temps.');
        if (prev.status !== 'completed') throw new ToolError('Séance en cours sur un appareil.');
        const doc = workoutDoc({
          title: args.title ?? prev.doc.title,
          note: args.note === undefined ? prev.doc.note : args.note || undefined,
          durationS: args.durationS ?? prev.doc.durationS,
          photoPath: prev.doc.photoPath,
          exercises,
        });
        return { ...prev, started_at: startedAt, doc, exercise_ids: exerciseIdsOf(doc) };
      });
      return workoutResult(store, row, 'modifiée', tz);
    }),
  );

  server.registerTool(
    'delete_workout',
    {
      title: 'Supprimer une séance terminée',
      description: 'Supprime une séance terminée (suppression logique, journalisée). Jamais une séance en cours.',
      inputSchema: { id: z.string() },
      annotations: { ...DESTRUCTIVE, idempotentHint: true },
    },
    run('delete_workout', async ({ id }: { id: string }) => {
      const current = await completedWorkout(store, id);
      await store.write<WorkoutRow>('delete_workout', 'workouts', current.id, (prev) => {
        if (!prev || prev.status !== 'completed') throw new ToolError('Séance en cours sur un appareil.');
        return { ...prev, deleted_at: Date.now() };
      });
      return ok(`Séance « ${current.doc.title || 'Séance'} » supprimée.`, { id: current.id, deleted: true });
    }),
  );

  server.registerTool(
    'add_body_measurement',
    {
      title: 'Ajouter une mesure corporelle',
      description:
        'Enregistre des mesures pour un jour (une mesure par jour) : complète la mesure existante du jour sans écraser les ' +
        "valeurs déjà remplies, sauf overwrite: true. Poids dans l'unité de poids, tours dans l'unité de longueur, " +
        'masse grasse en %.',
      inputSchema: {
        date: z.string().describe('Jour de la mesure, AAAA-MM-JJ.'),
        values: z
          .object(
            Object.fromEntries(
              MEASUREMENT_KEYS.map((k) => [
                k,
                z.union([z.number(), z.object({ v: z.number(), u: z.string() })]).optional(),
              ]),
            ),
          )
          .describe(`Clés : ${MEASUREMENT_KEYS.join(', ')}.`),
        overwrite: z.boolean().optional().describe('Remplacer les valeurs déjà saisies ce jour-là.'),
      },
      annotations: WRITE,
    },
    run('add_body_measurement', async (args: { date: string; values: MeasurementIn; overwrite?: boolean }) => {
      const date = dayOf(args.date, 'date');
      const profile = await store.profile();
      const values = toMeasurementValues(args.values, profile.settings.units);
      if (!values.ok) throw new ToolError(values.message);
      const existing = (await store.measurements()).find((m) => m.measured_on === date);
      const id = existing?.id ?? uuidv7();
      let ignored: string[] = [];
      const row = await store.write<BodyMeasurementRow>('add_body_measurement', 'body_measurements', id, (prev) => {
        const live = prev && prev.deleted_at === null ? prev : null;
        const merged = mergeMeasurement(live?.values ?? {}, values.value, args.overwrite === true);
        ignored = merged.ignored;
        return {
          id,
          user_id: userId,
          measured_on: date,
          values: merged.values,
          deleted_at: null,
          client_updated_at: live?.client_updated_at ?? 0,
          client_device_id: store.deviceId,
        };
      });
      const note = ignored.length
        ? ` Déjà saisi(s), non modifié(s) : ${ignored.join(', ')} (overwrite: true pour remplacer).`
        : '';
      return ok(`Mesure du ${date} enregistrée.${note}`, { id: row.id, date, values: row.values, ignored });
    }),
  );

  // Cette méthode permet d'écrire les réglages de progression d'un exercice en fusionnant un changement partiel.
  const savePrefs = async (tool: string, exercise: ExerciseRow, patch: Partial<ExercisePrefsDoc>) => {
    const id = prefsId(userId, exercise.id);
    return store.write<ExercisePrefsRow>(tool, 'exercise_prefs', id, (prev) => {
      const base = prev && prev.deleted_at === null ? prev.doc : { schemaVersion: 1 as const };
      const doc: ExercisePrefsDoc = { ...base, ...patch, schemaVersion: 1 };
      return {
        id,
        user_id: userId,
        exercise_id: exercise.id,
        doc,
        deleted_at: null,
        client_updated_at: prev?.client_updated_at ?? 0,
        client_device_id: store.deviceId,
      };
    });
  };

  server.registerTool(
    'set_exercise_goal',
    {
      title: 'Fixer un objectif à long terme',
      description:
        'Fixe l’objectif à long terme d’un exercice en poids et répétitions (ex. 140 kg × 1) : il remplace l’objectif ' +
        'précédent, sa date de fixation est maintenant. get_progression estime ensuite sa date d’atteinte.',
      inputSchema: { exercise: exerciseRefSchema, weight: weightSchema, reps: z.number().int().min(1).max(12) },
      annotations: WRITE,
    },
    run('set_exercise_goal', async (args: { exercise: string; weight: WeightIn; reps: number }) => {
      const exercise = await exerciseOf(store, args.exercise);
      if (exercise.measurement_type !== 'weight_reps')
        throw new ToolError(`${exercise.name} : objectif à long terme réservé aux exercices en poids et répétitions.`);
      const profile = await store.profile();
      const weight = toWeight(args.weight, profile.settings.units.weight);
      if (!(weight.v > 0 && weight.v <= 2000)) throw new ToolError(`Charge invalide (${weight.v}).`);
      const row = await savePrefs('set_exercise_goal', exercise, {
        longTermGoal: { weight, reps: args.reps, setAt: Date.now() },
      });
      return ok(`Objectif de ${exercise.name} : ${weight.v} ${weight.u} × ${args.reps}.`, {
        exerciseId: exercise.id,
        longTermGoal: row.doc.longTermGoal,
      });
    }),
  );

  server.registerTool(
    'set_exercise_prefs',
    {
      title: 'Régler la progression d’un exercice',
      description:
        "Règle l'incrément de charge (pas de progression proposé) et la fourchette de reps par défaut d'un exercice.",
      inputSchema: {
        exercise: exerciseRefSchema,
        increment: weightSchema.optional().describe('Incrément de charge, ex. 2.5.'),
        defaultRepRange: repRangeSchema.optional(),
      },
      annotations: WRITE,
    },
    run('set_exercise_prefs', async (args: { exercise: string; increment?: WeightIn; defaultRepRange?: RepRange }) => {
      if (args.increment === undefined && args.defaultRepRange === undefined)
        throw new ToolError('Fournir increment et/ou defaultRepRange.');
      const exercise = await exerciseOf(store, args.exercise);
      const profile = await store.profile();
      const patch: Partial<ExercisePrefsDoc> = {};
      if (args.increment !== undefined) {
        const inc = toWeight(args.increment, profile.settings.units.weight);
        if (!(inc.v > 0 && inc.v <= 50)) throw new ToolError(`Incrément invalide (${inc.v}).`);
        patch.increment = inc;
      }
      if (args.defaultRepRange !== undefined) {
        const range = checkRepRange(exercise, args.defaultRepRange);
        if (!range.ok) throw new ToolError(range.message);
        patch.defaultRepRange = range.value;
      }
      const row = await savePrefs('set_exercise_prefs', exercise, patch);
      return ok(`Réglages de ${exercise.name} enregistrés.`, { exerciseId: exercise.id, prefs: row.doc });
    }),
  );
}
