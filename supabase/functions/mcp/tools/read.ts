// Outils de lecture du connecteur Claude (docs/spec-mcp.md §6.2) : toujours permis, mêmes chiffres que l'app.
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.32.1/server/mcp.js';
import { z } from 'npm:zod@4.6.7';
import { exerciseLine, exerciseView, searchExercises } from '../../_shared/domain/mcp/exercises.ts';
import { MEASUREMENT_KEYS } from '../../_shared/domain/mcp/inputs.ts';
import {
  exerciseHistory,
  exerciseRecords,
  latestRecords,
  measurementsView,
  profileView,
  progressionView,
  routineText,
  routineView,
  statsView,
  type ViewCtx,
  workoutDetail,
  workoutListItem,
  workoutListLine,
} from '../../_shared/domain/mcp/views.ts';
import { EQUIPMENTS, MUSCLES } from '../../_shared/domain/labels.ts';
import { allWorkoutBadges, workoutBadges } from '../../_shared/domain/records.ts';
import type { Equipment, Muscle, WorkoutRow } from '../../_shared/domain/types.ts';
import { type Store, ToolError } from '../store.ts';
import { dayOf, exerciseOf, exerciseRefSchema, instantOf, ok, routineOf, run, tzOf, tzSchema } from './common.ts';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const YEAR_MS = 365.25 * 86_400_000;

// Cette méthode permet de préparer le contexte des vues (unités, fuseau, exercices, préférences) pour un appel d'outil.
export async function viewCtx(store: Store, tz: string): Promise<ViewCtx> {
  const [profile, exercises, prefs] = await Promise.all([store.profile(), store.exerciseMap(), store.prefs()]);
  const prefsMap = new Map(prefs.map((p) => [p.exercise_id, p.doc]));
  return { units: profile.settings.units, tz, now: store.now, exercises, prefs: prefsMap };
}

// Cette méthode permet de coder un curseur de pagination (dernier élément renvoyé : début et id).
function encodeCursor(w: WorkoutRow): string {
  return btoa(`${w.started_at}|${w.id}`);
}

// Cette méthode permet de lire un curseur de pagination ; erreur explicite s'il est invalide.
function decodeCursor(cursor: string): { at: number; id: string } {
  try {
    const [at, id] = atob(cursor).split('|');
    if (!at || !id || !Number.isFinite(Number(at))) throw new Error();
    return { at: Number(at), id };
  } catch {
    throw new ToolError('Curseur invalide : reprendre la valeur nextCursor de la réponse précédente.');
  }
}

// Cette méthode permet d'enregistrer les outils de lecture sur le serveur MCP de la requête.
export function registerReadTools(server: McpServer, store: Store) {
  server.registerTool(
    'get_profile',
    {
      title: 'Profil',
      description:
        "Profil de l'utilisateur : nom, unités (poids, longueur, distance), repos par défaut, ancienneté, objectifs activés, " +
        'nombre de séances, première et dernière séance, série de semaines consécutives avec au moins une séance.',
      inputSchema: { tz: tzSchema },
      annotations: READ,
    },
    run('get_profile', async ({ tz }: { tz?: string }) => {
      const zone = tzOf(tz);
      const [profile, workouts, prefs, ctx] = await Promise.all([
        store.profile(),
        store.workouts({ light: true }),
        store.prefs(),
        viewCtx(store, zone),
      ]);
      const v = profileView(profile, workouts, prefs, ctx);
      return ok(v.text, v.data);
    }),
  );

  server.registerTool(
    'search_exercises',
    {
      title: 'Chercher des exercices',
      description:
        'Cherche dans les exercices (catalogue et exercices perso) par mots du nom (sans accents ni casse), muscle et matériel. ' +
        "À utiliser avant tout outil qui prend un exercice : ne jamais inventer un nom. Noms d'exercices en français.",
      inputSchema: {
        query: z.string().optional().describe('Mots du nom, ex. « squat », « développé incliné ».'),
        muscle: z.enum(MUSCLES as [Muscle, ...Muscle[]]).optional().describe('Muscle principal ou secondaire.'),
        equipment: z.enum(EQUIPMENTS as [Equipment, ...Equipment[]]).optional(),
        includeArchived: z.boolean().optional().describe('Inclure les exercices perso archivés (défaut non).'),
        limit: z.number().int().min(1).max(50).optional().describe('20 par défaut, 50 au plus.'),
      },
      annotations: READ,
    },
    run('search_exercises', async (args: {
      query?: string;
      muscle?: Muscle;
      equipment?: Equipment;
      includeArchived?: boolean;
      limit?: number;
    }) => {
      const list = searchExercises(await store.exercises(), args);
      const text = list.length
        ? `${list.length} exercice(s) :\n${list.map((e) => `- ${exerciseLine(e)}`).join('\n')}`
        : "Aucun exercice trouvé. Essayer d'autres mots, ou créer l'exercice dans l'app (Bibliothèque).";
      return ok(text, list.map(exerciseView));
    }),
  );

  server.registerTool(
    'list_workouts',
    {
      title: 'Lister les séances',
      description:
        'Séances terminées, récentes d’abord : date, titre, durée, volume, séries, nombre de records, objectifs atteints n/m. ' +
        'Filtrer par période, exercice ou routine ; paginer avec cursor (nextCursor de la réponse précédente).',
      inputSchema: {
        from: z.string().optional().describe('Début de période (ISO 8601, inclus).'),
        to: z.string().optional().describe('Fin de période (ISO 8601, exclue).'),
        exercise: exerciseRefSchema.optional(),
        routine: z.string().optional().describe('Routine : id ou nom exact.'),
        limit: z.number().int().min(1).max(50).optional().describe('20 par défaut, 50 au plus.'),
        cursor: z.string().optional(),
        tz: tzSchema,
      },
      annotations: READ,
    },
    run('list_workouts', async (args: {
      from?: string;
      to?: string;
      exercise?: string;
      routine?: string;
      limit?: number;
      cursor?: string;
      tz?: string;
    }) => {
      const tz = tzOf(args.tz);
      const from = args.from ? instantOf(args.from, tz, 'from') : undefined;
      const to = args.to ? instantOf(args.to, tz, 'to') : undefined;
      const exercise = args.exercise ? await exerciseOf(store, args.exercise) : undefined;
      const routine = args.routine ? await routineOf(store, args.routine) : undefined;
      const [history, ctx] = await Promise.all([store.workouts(), viewCtx(store, tz)]);
      const done = history.filter((w) => w.status === 'completed');
      let list = done
        .filter(
          (w) =>
            (from === undefined || w.started_at >= from) &&
            (to === undefined || w.started_at < to) &&
            (!exercise || w.doc.exercises.some((e) => e.exerciseId === exercise.id)) &&
            (!routine || w.routine_id === routine.id),
        )
        .sort((a, b) => b.started_at - a.started_at || (a.id < b.id ? 1 : -1));
      if (args.cursor) {
        const c = decodeCursor(args.cursor);
        list = list.filter((w) => w.started_at < c.at || (w.started_at === c.at && w.id < c.id));
      }
      const limit = args.limit ?? 20;
      const page = list.slice(0, limit);
      const badges = allWorkoutBadges(done);
      const items = page.map((w) => workoutListItem(w, badges[w.id], ctx));
      const nextCursor = list.length > limit ? encodeCursor(page[page.length - 1]!) : undefined;
      const text = items.length
        ? `${items.length} séance(s)${nextCursor ? ' (suite avec cursor)' : ''} :\n${items.map((i) => workoutListLine(i, ctx.units)).join('\n')}`
        : 'Aucune séance terminée ne correspond.';
      return ok(text, { workouts: items, ...(nextCursor ? { nextCursor } : {}) });
    }),
  );

  server.registerTool(
    'get_workout',
    {
      title: 'Détail d’une séance',
      description:
        'Séance complète : exercices, séries (type, charge, reps, durée, distance, validée, objectif), notes et records battus.',
      inputSchema: { id: z.string().describe('Id de la séance (list_workouts).'), tz: tzSchema },
      annotations: READ,
    },
    run('get_workout', async ({ id, tz }: { id: string; tz?: string }) => {
      const zone = tzOf(tz);
      const w = (await store.row<WorkoutRow>('workouts', id.trim()).catch(() => null)) as WorkoutRow | null;
      if (!w || w.deleted_at !== null) throw new ToolError(`Séance ${id} introuvable.`);
      const [history, ctx] = await Promise.all([
        store.workouts({ exerciseIds: w.exercise_ids, anyOf: true }),
        viewCtx(store, zone),
      ]);
      const v = workoutDetail(w, workoutBadges(w, history.filter((h) => h.status === 'completed')), ctx);
      return ok(v.text, v.data);
    }),
  );

  server.registerTool(
    'get_exercise_history',
    {
      title: 'Historique d’un exercice',
      description:
        "Séance par séance (récentes d'abord) : séries validées hors échauffement, meilleur 1RM estimé (Epley, séries de " +
        'travail de 12 reps au plus) et volume. Deux ans par défaut. lastTime = date de la dernière séance.',
      inputSchema: {
        exercise: exerciseRefSchema,
        from: z.string().optional().describe('Début (ISO 8601) ; défaut : il y a 2 ans.'),
        to: z.string().optional().describe('Fin exclue (ISO 8601) ; défaut : maintenant.'),
        tz: tzSchema,
      },
      annotations: READ,
    },
    run('get_exercise_history', async (args: { exercise: string; from?: string; to?: string; tz?: string }) => {
      const tz = tzOf(args.tz);
      const exercise = await exerciseOf(store, args.exercise);
      const from = args.from ? instantOf(args.from, tz, 'from') : store.now - 2 * YEAR_MS;
      const to = args.to ? instantOf(args.to, tz, 'to') : store.now + 1;
      const [workouts, ctx] = await Promise.all([store.workouts({ exerciseIds: [exercise.id] }), viewCtx(store, tz)]);
      const v = exerciseHistory(exercise, workouts, { from, to }, ctx);
      return ok(v.text, v.data);
    }),
  );

  server.registerTool(
    'get_records',
    {
      title: 'Records',
      description:
        "Avec exercise : meilleurs résultats par critère suivi (charge max, 1RM estimé, meilleure série, charge à 1/3/5/8/10/12 " +
        'reps, reps max, durée, distance, allure…) avec date et séance. Sans exercise : records battus récemment, tous exercices.',
      inputSchema: {
        exercise: exerciseRefSchema.optional(),
        limit: z.number().int().min(1).max(50).optional().describe('Records récents : 20 par défaut.'),
        tz: tzSchema,
      },
      annotations: READ,
    },
    run('get_records', async (args: { exercise?: string; limit?: number; tz?: string }) => {
      const tz = tzOf(args.tz);
      const ctx = await viewCtx(store, tz);
      if (args.exercise) {
        const exercise = await exerciseOf(store, args.exercise);
        const v = exerciseRecords(exercise, await store.workouts({ exerciseIds: [exercise.id] }), ctx);
        return ok(v.text, v.data);
      }
      const v = latestRecords(await store.workouts(), ctx, args.limit ?? 20);
      return ok(v.text, v.data);
    }),
  );

  server.registerTool(
    'get_progression',
    {
      title: 'Progression d’un exercice',
      description:
        'Tendance du 1RM estimé (exercices en poids et répétitions) : valeur actuelle, rythme par mois, projection à 4 et ' +
        "12 semaines, objectif à long terme et date d'atteinte estimée. Renvoie « pas assez de données » sous 6 semaines.",
      inputSchema: { exercise: exerciseRefSchema, tz: tzSchema },
      annotations: READ,
    },
    run('get_progression', async (args: { exercise: string; tz?: string }) => {
      const tz = tzOf(args.tz);
      const exercise = await exerciseOf(store, args.exercise);
      const [workouts, prefs, profile, ctx] = await Promise.all([
        store.workouts({ exerciseIds: [exercise.id] }),
        store.prefs(),
        store.profile(),
        viewCtx(store, tz),
      ]);
      const pref = prefs.find((p) => p.exercise_id === exercise.id)?.doc;
      const v = progressionView(exercise, workouts, pref, profile.settings, ctx);
      return ok(v.text, v.data);
    }),
  );

  server.registerTool(
    'get_stats',
    {
      title: 'Statistiques',
      description:
        'Sur une période : séances, durée, volume et séries par semaine (lundi-dimanche), répartition des séries par muscle ' +
        '(1 pour le principal, 0,5 par secondaire, hors échauffement), jours d’entraînement. Deux ans au plus.',
      inputSchema: {
        from: z.string().describe('Début (ISO 8601, inclus), ex. 2026-09-01.'),
        to: z.string().describe('Fin (ISO 8601, exclue), ex. 2026-10-01.'),
        tz: tzSchema,
      },
      annotations: READ,
    },
    run('get_stats', async (args: { from: string; to: string; tz?: string }) => {
      const tz = tzOf(args.tz);
      const from = instantOf(args.from, tz, 'from');
      const to = instantOf(args.to, tz, 'to');
      if (to <= from) throw new ToolError('to doit être après from.');
      if (to - from > 2 * YEAR_MS) throw new ToolError('Période de deux ans au plus.');
      const [workouts, ctx] = await Promise.all([store.workouts({ from, to }), viewCtx(store, tz)]);
      const v = statsView(workouts, { from, to }, ctx);
      return ok(v.text, v.data);
    }),
  );

  server.registerTool(
    'list_routines',
    {
      title: 'Lister les routines',
      description: 'Dossiers et routines : nom, exercices, séries prévues, fourchettes de reps, repos.',
      inputSchema: {},
      annotations: READ,
    },
    run('list_routines', async () => {
      const [routines, folders, ctx] = await Promise.all([store.routines(), store.folders(), viewCtx(store, tzOf(undefined))]);
      const order = new Map(folders.map((f, i) => [f.id, i]));
      const sorted = [...routines].sort(
        (a, b) =>
          (order.get(a.folder_id ?? '') ?? -1) - (order.get(b.folder_id ?? '') ?? -1) || a.position - b.position,
      );
      const views = sorted.map((r) => routineView(r, folders, ctx));
      const text = views.length ? views.map((v) => routineText(v, ctx)).join('\n') : 'Aucune routine.';
      return ok(text, { folders: folders.map((f) => ({ id: f.id, name: f.name })), routines: views });
    }),
  );

  server.registerTool(
    'get_routine',
    {
      title: 'Détail d’une routine',
      description: 'Routine complète : exercices, séries prévues (type, charge), fourchette de reps, repos, notes.',
      inputSchema: { id: z.string().describe('Id de la routine, ou son nom exact.') },
      annotations: READ,
    },
    run('get_routine', async ({ id }: { id: string }) => {
      const [routine, folders, ctx] = await Promise.all([routineOf(store, id), store.folders(), viewCtx(store, tzOf(undefined))]);
      const v = routineView(routine, folders, ctx);
      return ok(routineText(v, ctx), v);
    }),
  );

  server.registerTool(
    'list_body_measurements',
    {
      title: 'Mesures corporelles',
      description:
        'Mesures par date (récentes d’abord) : poids, masse grasse (%), tours (cou, épaules, poitrine, bras, taille, hanches, ' +
        'cuisses, mollets), dans leur unité de saisie.',
      inputSchema: {
        from: z.string().optional().describe('Date de début AAAA-MM-JJ (incluse).'),
        to: z.string().optional().describe('Date de fin AAAA-MM-JJ (incluse).'),
        keys: z
          .array(z.enum(MEASUREMENT_KEYS as [string, ...string[]]))
          .optional()
          .describe('Limiter à certaines mesures.'),
      },
      annotations: READ,
    },
    run('list_body_measurements', async (args: { from?: string; to?: string; keys?: string[] }) => {
      const [rows, profile] = await Promise.all([store.measurements(), store.profile()]);
      const v = measurementsView(
        rows,
        {
          from: args.from ? dayOf(args.from, 'from') : undefined,
          to: args.to ? dayOf(args.to, 'to') : undefined,
          keys: args.keys as never,
        },
        profile.settings.units,
      );
      return ok(v.text, v.data);
    }),
  );
}
