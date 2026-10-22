import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/data/db';
import { useAllExercises } from '@/data/queries';
import { EQUIPMENT_LABELS, EQUIPMENTS, MUSCLE_LABELS, MUSCLES } from '@/domain/labels';
import { matchesSearch, normalizeSearch } from '@/domain/search';
import type { Equipment, ExerciseRow, Muscle } from '@/domain/types';
import { Chips } from '@/ui/components';
import { SearchIcon } from '@/ui/icons';

// Cette méthode permet d'afficher les initiales d'un exercice dans sa vignette (pas d'illustration en V1).
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Cette méthode permet de calculer la date de dernière utilisation de chaque exercice, pour trier les récents en premier.
function useLastUsed(): Map<string, number> {
  const rows = useLiveQuery(
    () =>
      db.workouts
        .orderBy('started_at')
        .reverse()
        .limit(60)
        .filter((w) => w.deleted_at == null)
        .toArray(),
    [],
  );
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const w of rows ?? []) for (const id of w.exercise_ids) if (!m.has(id)) m.set(id, w.started_at);
    return m;
  }, [rows]);
}

// Cette méthode permet de lister, rechercher (sans accents) et filtrer les exercices, récents d'abord (§F7.2).
// En mode sélection, toucher un exercice le choisit ; sinon il ouvre sa fiche.
export function ExerciseList(props: { onPick: (e: ExerciseRow) => void; exclude?: Set<string> }) {
  const all = useAllExercises();
  const lastUsed = useLastUsed();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);

  const { recent, groups } = useMemo(() => {
    const q = normalizeSearch(query);
    const list = (all ?? []).filter(
      (e) =>
        e.archived_at == null &&
        !props.exclude?.has(e.id) &&
        (!q || matchesSearch(e.name_search, q)) &&
        (!muscle || e.primary_muscle === muscle || e.secondary_muscles.includes(muscle)) &&
        (!equipment || e.equipment === equipment),
    );
    list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const recent = q
      ? []
      : list
          .filter((e) => lastUsed.has(e.id))
          .sort((a, b) => lastUsed.get(b.id)! - lastUsed.get(a.id)!)
          .slice(0, 8);
    const groups = new Map<string, ExerciseRow[]>();
    for (const e of list) {
      const letter = normalizeSearch(e.name).charAt(0).toUpperCase() || '#';
      groups.set(letter, [...(groups.get(letter) ?? []), e]);
    }
    return { recent, groups };
  }, [all, query, muscle, equipment, lastUsed, props.exclude]);

  const item = (e: ExerciseRow) => (
    <button key={e.id} className="lib-item" onClick={() => props.onPick(e)}>
      <span className="ex-av">{initials(e.name)}</span>
      <span>
        <div className="n">{e.name}</div>
        <div className="m">
          {MUSCLE_LABELS[e.primary_muscle]} · {EQUIPMENT_LABELS[e.equipment]}
          {e.user_id && ' · perso'}
        </div>
      </span>
    </button>
  );

  return (
    <>
      <div className="search">
        <SearchIcon />
        <input
          placeholder="Rechercher (ex. developpe)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          enterKeyHint="search"
        />
      </div>
      <Chips
        value={muscle}
        onChange={setMuscle}
        allLabel="Tous muscles"
        options={MUSCLES.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))}
      />
      <div style={{ marginTop: 8 }}>
        <Chips
          value={equipment}
          onChange={setEquipment}
          allLabel="Tout équipement"
          options={EQUIPMENTS.map((m) => ({ value: m, label: EQUIPMENT_LABELS[m] }))}
        />
      </div>
      <div style={{ marginTop: 6 }}>
        {recent.length > 0 && (
          <>
            <div className="lib-letter">Récents</div>
            {recent.map(item)}
          </>
        )}
        {[...groups.entries()].map(([letter, list]) => (
          <div key={letter}>
            <div className="lib-letter">{letter}</div>
            {list.map(item)}
          </div>
        ))}
        {groups.size === 0 && <p className="empty">Aucun exercice ne correspond.</p>}
      </div>
    </>
  );
}
