// Outils partagés des outils MCP : schémas d'entrée communs, réponses (texte + JSON) et résolution des références.
import { z } from 'npm:zod@4.6.7';
import { resolveExercise } from '../../_shared/domain/mcp/exercises.ts';
import { DEFAULT_TZ, isValidTz, parseDayKeyStrict, parseInstant } from '../../_shared/domain/mcp/tz.ts';
import { normalizeSearch } from '../../_shared/domain/search.ts';
import type { ExerciseRow, FolderRow, RoutineRow } from '../../_shared/domain/types.ts';
import { type Store, ToolError } from '../store.ts';

export type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

// ---------- Schémas communs ----------

export const tzSchema = z
  .string()
  .optional()
  .describe('Fuseau horaire IANA pour les dates sans décalage et les regroupements par jour/semaine (défaut Europe/Paris).');

export const weightSchema = z
  .union([z.number(), z.object({ v: z.number(), u: z.enum(['kg', 'lb']) })])
  .describe("Charge : nombre dans l'unité de poids de l'utilisateur (voir get_profile), ou { v, u } avec u = kg | lb.");

export const distanceSchema = z
  .union([z.number(), z.object({ v: z.number(), u: z.enum(['km', 'mi']) })])
  .describe("Distance : nombre dans l'unité de l'utilisateur, ou { v, u } avec u = km | mi.");

export const setKindSchema = z
  .enum(['normal', 'warmup', 'drop', 'failure'])
  .optional()
  .describe('Type de série : normal (défaut), warmup (échauffement), drop (dégressive), failure (à l’échec).');

export const repRangeSchema = z
  .object({ min: z.number().int().min(1), max: z.number().int().min(1) })
  .describe('Fourchette de répétitions visée, ex. { min: 8, max: 12 }.');

export const exerciseRefSchema = z
  .string()
  .min(1)
  .describe("Exercice : id (UUID) ou nom exact tel que renvoyé par search_exercises. Ne jamais inventer un nom.");

// ---------- Réponses ----------

// Cette méthode permet de construire une réponse d'outil : résumé texte en français et JSON structuré.
export function ok(text: string, data: unknown): ToolResult {
  const structuredContent = (Array.isArray(data) ? { items: data } : data) as Record<string, unknown>;
  return { content: [{ type: 'text', text }], structuredContent };
}

// Cette méthode permet de construire une erreur d'outil lisible (isError), sans trace technique.
export function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// Cette méthode permet d'exécuter un outil en transformant les erreurs : message métier tel quel, erreur technique
// journalisée et remplacée par un message générique.
export function run<A>(name: string, fn: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await fn(args);
    } catch (e) {
      if (e instanceof ToolError) return fail(e.message);
      console.error(`outil ${name}`, e instanceof Error ? e.message : String(e));
      return fail('Erreur du serveur Overload pendant cet appel. Réessaie dans un instant.');
    }
  };
}

// ---------- Références ----------

// Cette méthode permet de valider le fuseau demandé (défaut Europe/Paris).
export function tzOf(tz: string | undefined): string {
  const v = tz?.trim() || DEFAULT_TZ;
  if (!isValidTz(v)) throw new ToolError(`Fuseau horaire inconnu : ${v} (attendu : nom IANA, ex. Europe/Paris).`);
  return v;
}

// Cette méthode permet de lire une date ISO 8601 d'entrée, ou de lever une erreur explicite.
export function instantOf(input: string, tz: string, field: string): number {
  const ms = parseInstant(input, tz);
  if (ms === undefined)
    throw new ToolError(`${field} : date invalide « ${input} » (attendu : ISO 8601, ex. 2026-10-22 ou 2026-10-22T18:00).`);
  return ms;
}

// Cette méthode permet de lire une date seule « AAAA-MM-JJ », ou de lever une erreur explicite.
export function dayOf(input: string, field: string): string {
  const d = parseDayKeyStrict(input);
  if (!d) throw new ToolError(`${field} : date invalide « ${input} » (attendu : AAAA-MM-JJ).`);
  return d;
}

// Cette méthode permet de retrouver un exercice par id ou par nom, ou de lever l'erreur listant les candidats.
export async function exerciseOf(store: Store, ref: string): Promise<ExerciseRow> {
  const r = resolveExercise(ref, await store.exercises());
  if (!r.ok) throw new ToolError(r.message);
  return r.exercise;
}

// Cette méthode permet de retrouver une routine par id ou par nom exact (sans accents ni casse).
export async function routineOf(store: Store, ref: string): Promise<RoutineRow> {
  const routines = await store.routines();
  const q = normalizeSearch(ref);
  const found =
    routines.find((r) => r.id === ref.trim()) ?? routines.filter((r) => normalizeSearch(r.doc.name) === q);
  if (!Array.isArray(found)) return found;
  if (found.length === 1) return found[0]!;
  const names = routines.map((r) => `${r.doc.name} [${r.id}]`).join(' ; ');
  throw new ToolError(
    found.length > 1
      ? `Plusieurs routines s'appellent « ${ref} » : passe l'id (${found.map((r) => r.id).join(', ')}).`
      : `Routine « ${ref} » introuvable. Routines existantes : ${names || 'aucune'}.`,
  );
}

// Cette méthode permet de retrouver un dossier existant par nom (sans accents ni casse) ; les dossiers ne se créent
// que dans l'app.
export async function folderOf(store: Store, name: string): Promise<FolderRow> {
  const folders = await store.folders();
  const q = normalizeSearch(name);
  const found = folders.find((f) => f.id === name.trim() || normalizeSearch(f.name) === q);
  if (found) return found;
  throw new ToolError(
    `Dossier « ${name} » introuvable. Dossiers existants : ${folders.map((f) => f.name).join(', ') || 'aucun'}. ` +
      "Omettre folder, ou créer le dossier dans l'app.",
  );
}
