import { describe, expect, it } from 'vitest';
import { canLinkNext, normalizeGroups, skipsRest, supersetRole, toggleSuperset } from './superset';

const ex = (id: string, sets = 3, groupId?: string) => ({
  id,
  sets: Array.from({ length: sets }, (_, i) => i),
  ...(groupId ? { groupId } : {}),
});
let n = 0;
const newId = () => `g${++n}`;

describe('supersets (#77)', () => {
  it('relie un exercice au suivant puis défait le superset', () => {
    const linked = toggleSuperset([ex('a'), ex('b'), ex('c')], 'a', newId);
    expect(linked.map((e) => e.groupId)).toEqual([linked[0]!.groupId, linked[0]!.groupId, undefined]);
    expect(supersetRole(linked, 0)).toBe('first');
    expect(supersetRole(linked, 1)).toBe('second');
    expect(supersetRole(linked, 2)).toBeUndefined();
    const unlinked = toggleSuperset(linked, 'b', newId);
    expect(unlinked.every((e) => !e.groupId)).toBe(true);
  });

  it('refuse de relier le dernier exercice ou un exercice déjà groupé', () => {
    const list = [ex('a', 3, 'g'), ex('b', 3, 'g'), ex('c')];
    expect(canLinkNext(list, 1)).toBe(false);
    expect(canLinkNext(list, 2)).toBe(false);
    expect(toggleSuperset([ex('a')], 'a', newId)).toHaveLength(1);
  });

  it('retire les groupes qui ne forment plus une paire consécutive', () => {
    const split = normalizeGroups([ex('a', 3, 'g'), ex('x'), ex('b', 3, 'g')]);
    expect(split.every((e) => !e.groupId)).toBe(true);
    const alone = normalizeGroups([ex('a', 3, 'g'), ex('x')]);
    expect(alone[0]!.groupId).toBeUndefined();
    const triple = normalizeGroups([ex('a', 3, 'g'), ex('b', 3, 'g'), ex('c', 3, 'g')]);
    expect(triple.every((e) => !e.groupId)).toBe(true);
    const ok = [ex('a', 3, 'g'), ex('b', 3, 'g')];
    expect(normalizeGroups(ok)).toBe(ok);
  });

  it('ne déclenche le repos qu’à la fin du tour', () => {
    const list = [ex('a', 3, 'g'), ex('b', 2, 'g'), ex('c')];
    expect(skipsRest(list, 'a', 0)).toBe(true);
    expect(skipsRest(list, 'a', 1)).toBe(true);
    expect(skipsRest(list, 'a', 2)).toBe(false); // le partenaire n'a plus de 3e série
    expect(skipsRest(list, 'b', 0)).toBe(false);
    expect(skipsRest(list, 'c', 0)).toBe(false);
  });
});
