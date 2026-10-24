// Versions des documents synchronisés (#71) : montée de version à la lecture et refus d'un document plus récent que l'app.
// Faire évoluer un format : incrémenter DOC_VERSIONS[table] (et le type `schemaVersion` dans types.ts),
// puis ajouter en fin de MIGRATIONS[table] la fonction qui passe de l'ancienne version à la nouvelle.
import type { ExercisePrefsDoc, RoutineDoc, WorkoutDoc } from './types';

export const DOC_VERSIONS = { workouts: 1, routines: 1, exercise_prefs: 1 } as const;

export type DocTable = keyof typeof DOC_VERSIONS;
type AnyDoc = Record<string, unknown>;
export type Migration = (doc: AnyDoc) => AnyDoc;

/** MIGRATIONS[table][i] fait passer un document de la version i + 1 à la version i + 2. */
const MIGRATIONS: Record<DocTable, Migration[]> = {
  workouts: [],
  routines: [],
  exercise_prefs: [],
};

export type Upgrade<T> = { ok: true; doc: T; changed: boolean } | { ok: false; version: number };

// Cette méthode permet de savoir si une table synchronisée porte un document versionné.
export function isDocTable(table: string): table is DocTable {
  return Object.hasOwn(DOC_VERSIONS, table);
}

// Cette méthode permet de lire la version d'un document (absente ou illisible : version 1, celle d'origine).
export function docVersion(doc: unknown): number {
  const v = (doc as { schemaVersion?: unknown } | null)?.schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1;
}

// Cette méthode permet de faire passer un document à la version cible en enchaînant les migrations fournies.
// Un document plus récent que la cible est refusé (ok: false) : l'appareil doit se mettre à jour avant de le lire.
export function migrateDoc<T>(doc: unknown, target: number, migrations: readonly Migration[]): Upgrade<T> {
  const from = docVersion(doc);
  if (from > target) return { ok: false, version: from };
  if (from === target && (doc as AnyDoc | null)?.schemaVersion === target)
    return { ok: true, doc: doc as T, changed: false };
  let out = { ...((doc ?? {}) as AnyDoc) };
  for (let v = from; v < target; v++) out = migrations[v - 1]!(out);
  return { ok: true, doc: { ...out, schemaVersion: target } as T, changed: true };
}

// Cette méthode permet de mettre un document d'une table à la version de l'app (voir migrateDoc).
export function upgradeDoc<T>(table: DocTable, doc: unknown): Upgrade<T> {
  return migrateDoc<T>(doc, DOC_VERSIONS[table], MIGRATIONS[table]);
}

// Cette méthode permet de mettre une séance à la version de l'app (voir upgradeDoc).
export const upgradeWorkoutDoc = (doc: unknown) => upgradeDoc<WorkoutDoc>('workouts', doc);
// Cette méthode permet de mettre une routine à la version de l'app (voir upgradeDoc).
export const upgradeRoutineDoc = (doc: unknown) => upgradeDoc<RoutineDoc>('routines', doc);
// Cette méthode permet de mettre des réglages de progression à la version de l'app (voir upgradeDoc).
export const upgradeExercisePrefsDoc = (doc: unknown) => upgradeDoc<ExercisePrefsDoc>('exercise_prefs', doc);

export type RowUpgrade<R> = { ok: true; row: R; changed: boolean } | { ok: false; version: number };

// Cette méthode permet de mettre à niveau le document d'une ligne synchronisée quelconque (lignes sans document : inchangées).
export function upgradeRow<R extends Record<string, unknown>>(table: string, row: R): RowUpgrade<R> {
  if (!isDocTable(table) || row.doc == null) return { ok: true, row, changed: false };
  const res = upgradeDoc<unknown>(table, row.doc);
  if (!res.ok) return res;
  return res.changed
    ? { ok: true, row: { ...row, doc: res.doc }, changed: true }
    : { ok: true, row, changed: false };
}
