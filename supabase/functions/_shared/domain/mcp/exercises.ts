// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Exercices vus par les outils du connecteur Claude (docs/spec-mcp.md §6.1) : recherche et résolution par nom ou par id.
import { nameSimilarity, nameTokens } from '../hevy.ts';
import { EQUIPMENT_LABELS, MEASUREMENT_LABELS, MUSCLE_LABELS } from '../labels.ts';
import { matchesSearch, normalizeSearch } from '../search.ts';
import type { Equipment, ExerciseRow, Muscle } from '../types.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cette méthode permet de savoir si une chaîne est un UUID (identifiant d'élément).
export function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export type ExerciseView = {
  id: string;
  name: string;
  custom: boolean;
  equipment: Equipment;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  measurementType: ExerciseRow['measurement_type'];
  archived?: true;
};

// Cette méthode permet de décrire un exercice pour Claude (identifiant, nom, matériel, muscles, type de mesure).
export function exerciseView(e: ExerciseRow): ExerciseView {
  return {
    id: e.id,
    name: e.name,
    custom: e.user_id !== null,
    equipment: e.equipment,
    primaryMuscle: e.primary_muscle,
    secondaryMuscles: e.secondary_muscles,
    measurementType: e.measurement_type,
    ...(e.archived_at !== null ? { archived: true as const } : {}),
  };
}

// Cette méthode permet de résumer un exercice en une ligne (« Squat (barre) · Barre · Quadriceps · Poids et répétitions »).
export function exerciseLine(e: ExerciseRow): string {
  return `${e.name} · ${EQUIPMENT_LABELS[e.equipment]} · ${MUSCLE_LABELS[e.primary_muscle]} · ${MEASUREMENT_LABELS[e.measurement_type]} [${e.id}]`;
}

// Cette méthode permet de ne garder que les exercices utilisables (ni supprimés ni archivés, sauf demande explicite).
export function usableExercises(rows: ExerciseRow[], includeArchived = false): ExerciseRow[] {
  return rows.filter((e) => e.deleted_at === null && (includeArchived || e.archived_at === null));
}

// Cette méthode permet de chercher des exercices (catalogue et perso) par mots, muscle et matériel, du plus pertinent
// au moins pertinent : nom exact, puis nom commençant par la requête, puis ordre alphabétique.
export function searchExercises(
  rows: ExerciseRow[],
  filter: {
    query?: string;
    muscle?: Muscle;
    equipment?: Equipment;
    limit?: number;
    includeArchived?: boolean;
  },
): ExerciseRow[] {
  const q = normalizeSearch(filter.query ?? '');
  const list = usableExercises(rows, filter.includeArchived).filter(
    (e) =>
      matchesSearch(normalizeSearch(e.name), q) &&
      (!filter.muscle || e.primary_muscle === filter.muscle || e.secondary_muscles.includes(filter.muscle)) &&
      (!filter.equipment || e.equipment === filter.equipment),
  );
  const rank = (e: ExerciseRow) => {
    const n = normalizeSearch(e.name);
    if (n === q) return 0;
    if (q && n.startsWith(q)) return 1;
    return filter.muscle && e.primary_muscle === filter.muscle ? 2 : 3;
  };
  return list
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, filter.limit ?? 20);
}

export type Resolution =
  | { ok: true; exercise: ExerciseRow }
  | { ok: false; message: string; candidates: { id: string; name: string }[] };

// Cette méthode permet de proposer les exercices aux noms les plus proches lorsqu'un nom ne correspond à rien.
function closest(rows: ExerciseRow[], ref: string, n = 5): ExerciseRow[] {
  const tokens = nameTokens(ref);
  return rows
    .map((e) => ({ e, score: nameSimilarity(tokens, nameTokens(e.name)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.e);
}

// Cette méthode permet de retrouver un exercice à partir de son id ou de son nom (recherche sans accents ni casse) ;
// un nom ambigu ou inconnu renvoie une erreur listant les candidats, pour que Claude choisisse sans inventer.
export function resolveExercise(ref: string, rows: ExerciseRow[]): Resolution {
  const r = ref.trim();
  const candidatesOf = (list: ExerciseRow[]) => list.map((e) => ({ id: e.id, name: e.name }));
  if (isUuid(r)) {
    const found = rows.find((e) => e.id.toLowerCase() === r.toLowerCase() && e.deleted_at === null);
    if (found) return { ok: true, exercise: found };
    return { ok: false, message: `Aucun exercice n'a l'id ${r}.`, candidates: [] };
  }
  const usable = usableExercises(rows);
  const q = normalizeSearch(r);
  const exact = usable.filter((e) => normalizeSearch(e.name) === q);
  if (exact.length === 1) return { ok: true, exercise: exact[0]! };
  if (exact.length > 1) {
    // Même nom au catalogue et en perso : l'exercice perso de l'utilisateur l'emporte.
    const custom = exact.filter((e) => e.user_id !== null);
    if (custom.length === 1) return { ok: true, exercise: custom[0]! };
  }
  const matches = exact.length > 1 ? exact : usable.filter((e) => matchesSearch(normalizeSearch(e.name), q));
  if (matches.length === 1) return { ok: true, exercise: matches[0]! };
  if (matches.length > 1) {
    const shown = searchExercises(matches, { query: r, limit: 8 });
    return {
      ok: false,
      message:
        `« ${r} » correspond à ${matches.length} exercices : ${shown.map((e) => `${e.name} [${e.id}]`).join(' ; ')}. ` +
        "Précise le nom exact ou passe l'id.",
      candidates: candidatesOf(shown),
    };
  }
  const near = closest(usable, r);
  return {
    ok: false,
    message:
      `Aucun exercice ne s'appelle « ${r} ».` +
      (near.length ? ` Les plus proches : ${near.map((e) => `${e.name} [${e.id}]`).join(' ; ')}.` : '') +
      " Utilise search_exercises ; un exercice absent se crée dans l'app (Bibliothèque).",
    candidates: candidatesOf(near),
  };
}
