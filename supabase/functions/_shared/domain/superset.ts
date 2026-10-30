// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Supersets (#77) : deux exercices consécutifs de même groupId s'enchaînent sans repos entre eux, le repos tombe à la fin du tour.
// Fonctions génériques sur les exercices de séance et de routine (liste plate, le groupe est porté par `groupId`).
type Grouped = { id: string; groupId?: string; sets: readonly unknown[] };

export type SupersetRole = 'first' | 'second';

// Cette méthode permet de retirer les groupId qui ne forment plus exactement une paire d'exercices consécutifs
// (après une suppression, un déplacement ou un remplacement).
export function normalizeGroups<T extends { groupId?: string }>(list: T[]): T[] {
  const count = new Map<string, number>();
  for (const e of list) if (e.groupId) count.set(e.groupId, (count.get(e.groupId) ?? 0) + 1);
  let changed = false;
  const out = list.map((e, i) => {
    if (!e.groupId) return e;
    const paired =
      count.get(e.groupId) === 2 &&
      (list[i + 1]?.groupId === e.groupId || list[i - 1]?.groupId === e.groupId);
    if (paired) return e;
    changed = true;
    const { groupId: _drop, ...rest } = e;
    return rest as T;
  });
  return changed ? out : list;
}

// Cette méthode permet de savoir si un exercice ouvre (first) ou clôt (second) un superset, undefined s'il est seul.
export function supersetRole(list: readonly { groupId?: string }[], index: number): SupersetRole | undefined {
  const g = list[index]?.groupId;
  if (!g) return undefined;
  if (list[index + 1]?.groupId === g) return 'first';
  if (list[index - 1]?.groupId === g) return 'second';
  return undefined;
}

// Cette méthode permet de savoir si l'exercice peut être relié au suivant (ni lui ni le suivant ne sont déjà dans un superset).
export function canLinkNext(list: readonly { groupId?: string }[], index: number): boolean {
  const a = list[index];
  const b = list[index + 1];
  return Boolean(a && b && !a.groupId && !b.groupId);
}

// Cette méthode permet de relier l'exercice au suivant en superset, ou de défaire le superset auquel il appartient.
export function toggleSuperset<T extends Grouped>(list: T[], id: string, newId: () => string): T[] {
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return list;
  const role = supersetRole(list, i);
  if (role) {
    const g = list[i]!.groupId;
    return list.map((e) => {
      if (e.groupId !== g) return e;
      const { groupId: _drop, ...rest } = e;
      return rest as T;
    });
  }
  if (!canLinkNext(list, i)) return list;
  const groupId = newId();
  return list.map((e, j) => (j === i || j === i + 1 ? { ...e, groupId } : e));
}

// Cette méthode permet de savoir si valider la série n° `setIndex` (0 = première) de l'exercice `entryId` ne déclenche pas
// de repos : premier exercice d'un superset dont le partenaire a encore une série à faire dans ce tour.
export function skipsRest(list: readonly Grouped[], entryId: string, setIndex: number): boolean {
  const i = list.findIndex((e) => e.id === entryId);
  if (i < 0 || supersetRole(list, i) !== 'first') return false;
  return list[i + 1]!.sets.length > setIndex;
}
