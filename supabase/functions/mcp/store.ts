// Accès aux données du connecteur Claude (docs/spec-mcp.md §7.1, §7.2) : lectures PostgREST avec le jeton de l'utilisateur
// (RLS), écritures par sync_push comme un appareil (appareil virtuel de la connexion) et journal mcp_audit.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { mcpDeviceId } from '../_shared/domain/ids.ts';
import { stamp } from '../_shared/domain/mcp/writes.ts';
import {
  type BodyMeasurementRow,
  DEFAULT_SETTINGS,
  type ExercisePrefsRow,
  type ExerciseRow,
  type FolderRow,
  type ProfileRow,
  type RoutineRow,
  type Settings,
  type SyncTable,
  type WorkoutRow,
} from '../_shared/domain/types.ts';
import type { McpAuth } from './auth.ts';

const PAGE = 1000;
const TS_COLUMNS = ['started_at', 'deleted_at', 'archived_at'] as const;
const EXERCISE_COLUMNS =
  'id, user_id, name, name_search, equipment, primary_muscle, secondary_muscles, measurement_type, source_id, archived_at, client_updated_at, client_device_id, deleted_at';

// Erreur d'outil lisible par l'utilisateur (message français actionnable, jamais de trace technique).
export class ToolError extends Error {}

// Cette méthode permet de convertir une ligne PostgREST (timestamptz en ISO) au format d'échange (millisecondes).
export function rowIn<T>(r: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...r };
  for (const k of TS_COLUMNS) if (typeof out[k] === 'string') out[k] = Date.parse(out[k] as string);
  return out as T;
}

// Cette méthode permet de lever une erreur technique (journalisée, message générique côté Claude) si PostgREST échoue.
function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(what, res.error.message);
    throw new Error(`lecture ${what}`);
  }
  return res.data as T;
}

type Query = {
  range: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

// Cette méthode permet de lire toutes les pages d'une requête PostgREST (1000 lignes par page au plus).
async function all<T>(make: () => Query, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = check(await make().range(from, from + PAGE - 1), what) ?? [];
    out.push(...page.map((r) => rowIn<T>(r as Record<string, unknown>)));
    if (page.length < PAGE) return out;
  }
}

export type WorkoutFilter = {
  exerciseIds?: string[];
  anyOf?: boolean;
  from?: number;
  to?: number;
  light?: boolean;
};

// Cette méthode permet de lire les données d'un compte pour une requête MCP, avec un cache par requête.
export class Store {
  private cache = new Map<string, Promise<unknown>>();
  readonly deviceId: string;

  constructor(
    readonly auth: McpAuth,
    readonly now = Date.now(),
  ) {
    this.deviceId = mcpDeviceId(auth.userId, auth.clientId);
  }

  // Cette méthode permet de mémoriser une lecture pendant la requête (plusieurs outils ou étapes la réutilisent).
  private once<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) this.cache.set(key, load());
    return this.cache.get(key) as Promise<T>;
  }

  get db(): SupabaseClient {
    return this.auth.db;
  }

  // Cette méthode permet de lire le profil (sans code d'invitation ni droit admin) et ses paramètres complétés par défaut.
  profile(): Promise<Pick<ProfileRow, 'id' | 'display_name' | 'settings'>> {
    return this.once('profile', async () => {
      const row = check(
        await this.db.from('profiles').select('id, display_name, settings').eq('id', this.auth.userId).maybeSingle(),
        'profil',
      ) as { id: string; display_name: string; settings: Partial<Settings> } | null;
      const s = row?.settings ?? {};
      const settings: Settings = { ...DEFAULT_SETTINGS, ...s, units: { ...DEFAULT_SETTINGS.units, ...(s.units ?? {}) } };
      return { id: this.auth.userId, display_name: row?.display_name ?? '', settings };
    });
  }

  // Cette méthode permet de lire les exercices visibles (catalogue et perso), supprimés exclus.
  exercises(): Promise<ExerciseRow[]> {
    return this.once('exercises', () =>
      all<ExerciseRow>(
        () => this.db.from('exercises').select(EXERCISE_COLUMNS).is('deleted_at', null).order('id'),
        'exercices',
      ),
    );
  }

  // Cette méthode permet d'indexer les exercices par id (noms et muscles des vues).
  async exerciseMap(): Promise<Map<string, ExerciseRow>> {
    return new Map((await this.exercises()).map((e) => [e.id, e]));
  }

  // Cette méthode permet de lire les séances non supprimées, filtrées par exercice(s) et par période de début.
  // En mode léger, seul l'en-tête est lu (comptes, série de semaines) et le document est vide.
  workouts(filter: WorkoutFilter = {}): Promise<WorkoutRow[]> {
    return this.once(`workouts:${JSON.stringify(filter)}`, async () => {
      const cols = filter.light
        ? 'id, user_id, status, owner_device_id, routine_id, started_at, client_updated_at, client_device_id, deleted_at'
        : '*';
      const rows = await all<WorkoutRow>(() => {
        let q = this.db.from('workouts').select(cols).is('deleted_at', null);
        if (filter.exerciseIds?.length)
          q = filter.anyOf ? q.overlaps('exercise_ids', filter.exerciseIds) : q.contains('exercise_ids', filter.exerciseIds);
        if (filter.from !== undefined) q = q.gte('started_at', new Date(filter.from).toISOString());
        if (filter.to !== undefined) q = q.lt('started_at', new Date(filter.to).toISOString());
        return q.order('started_at').order('id');
      }, 'séances');
      if (filter.light)
        for (const w of rows) {
          w.exercise_ids = [];
          w.doc = { schemaVersion: 2, title: '', exercises: [] };
        }
      return rows;
    });
  }

  // Cette méthode permet de lire les dossiers non supprimés, dans l'ordre de l'app.
  folders(): Promise<FolderRow[]> {
    return this.once('folders', () =>
      all<FolderRow>(() => this.db.from('folders').select('*').is('deleted_at', null).order('position'), 'dossiers'),
    );
  }

  // Cette méthode permet de lire les routines non supprimées, dans l'ordre de l'app.
  routines(): Promise<RoutineRow[]> {
    return this.once('routines', () =>
      all<RoutineRow>(() => this.db.from('routines').select('*').is('deleted_at', null).order('position'), 'routines'),
    );
  }

  // Cette méthode permet de lire les mesures corporelles non supprimées.
  measurements(): Promise<BodyMeasurementRow[]> {
    return this.once('measurements', () =>
      all<BodyMeasurementRow>(
        () => this.db.from('body_measurements').select('*').is('deleted_at', null).order('measured_on'),
        'mesures',
      ),
    );
  }

  // Cette méthode permet de lire les réglages de progression non supprimés.
  prefs(): Promise<ExercisePrefsRow[]> {
    return this.once('prefs', () =>
      all<ExercisePrefsRow>(
        () => this.db.from('exercise_prefs').select('*').is('deleted_at', null).order('id'),
        'réglages',
      ),
    );
  }

  // Cette méthode permet de relire une ligne à jour (suppressions comprises) juste avant de la modifier.
  async row<T>(table: SyncTable, id: string): Promise<T | null> {
    const data = check(await this.db.from(table).select('*').eq('id', id).maybeSingle(), table);
    return data ? rowIn<T>(data as Record<string, unknown>) : null;
  }

  // Cette méthode permet d'écrire une ligne par sync_push comme l'appareil virtuel, en journalisant avant/après.
  // Une ligne modifiée entre-temps (stale) est relue et la modification réappliquée une fois.
  async write<T extends { id: string }>(
    tool: string,
    table: Exclude<SyncTable, 'profiles' | 'exercises'>,
    id: string,
    build: (previous: T | null) => T,
  ): Promise<T> {
    if (!this.auth.canWrite)
      throw new ToolError('Les modifications sont désactivées pour cette connexion (Overload › Paramètres › Claude).');
    for (let attempt = 0; attempt < 2; attempt++) {
      const previous = await this.row<T & { client_updated_at: number }>(table, id);
      const next = stamp(build(previous), previous ?? undefined, this.deviceId, Date.now());
      const res = await this.db.rpc('sync_push', { p_device_id: this.deviceId, p_changes: [{ table, row: next }] });
      if (res.error) {
        console.error('sync_push', res.error.message);
        throw new Error('sync_push');
      }
      const status = (res.data as { status: string }[])[0]?.status;
      if (status === 'accepted') {
        const log = await this.db.rpc('mcp_log', {
          p_tool: tool,
          p_table: table,
          p_row_id: id,
          p_before: previous,
          p_after: next,
        });
        if (log.error) console.error('mcp_log', log.error.message);
        this.cache.clear();
        return next;
      }
      if (status === 'stale') continue;
      if (status === 'rejected_not_owner')
        throw new ToolError("Séance en cours sur un appareil : elle ne peut pas être modifiée tant qu'elle n'est pas terminée.");
      console.error('sync_push status', status, table);
      throw new ToolError("L'écriture a été refusée par le serveur. Vérifie les valeurs et réessaie.");
    }
    throw new ToolError('Élément modifié sur un autre appareil pendant l’écriture : réessaie.');
  }
}
