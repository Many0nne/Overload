// Briques communes des vues de Profil › Statistiques (§F7.6, issue #103) : données, chiffres clés, écarts, répartitions.
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useCompletedWorkouts, useExerciseMap, useSettings } from '@/data/queries';
import { useNow } from '@/ui/useNow';

const MINUS = '−';

// Cette méthode permet de lire les données communes des vues (séances terminées, exercices, paramètres) et l'heure,
// rafraîchie à la minute pour ne pas recalculer les agrégats à chaque rendu.
export function useStatsData() {
  return {
    workouts: useCompletedWorkouts(),
    exercises: useExerciseMap(),
    settings: useSettings(),
    now: useNow(60_000),
  };
}

export type Delta = { text: string; dir: 'up' | 'down' | 'eq' };

const NO_PREVIOUS: Delta = { text: 'pas de période précédente', dir: 'eq' };

// Cette méthode permet d'écrire l'écart entre deux valeurs avec son signe (« +2 », « −4 min »), coloré si une hausse est
// une bonne nouvelle (séances, volume, records) et neutre sinon (durée, RPE) ; sans période précédente, le dit.
export function delta(
  cur: number,
  prev: number | undefined,
  format: (abs: number) => string,
  colored = true,
): Delta {
  if (prev === undefined) return NO_PREVIOUS;
  const d = cur - prev;
  const text = `${d > 0 ? '+' : d < 0 ? MINUS : ''}${format(Math.abs(d))}`;
  if (!colored || d === 0) return { text: d === 0 ? 'stable' : text, dir: 'eq' };
  return { text, dir: d > 0 ? 'up' : 'down' };
}

// Cette méthode permet d'écrire l'écart relatif en pourcentage (« +8 % ») ; aucun écart si la valeur précédente est nulle.
export function percentDelta(cur: number, prev: number | undefined, hasPrevious: boolean): Delta | undefined {
  if (!hasPrevious) return NO_PREVIOUS;
  if (!prev) return undefined;
  return delta(Math.round(((cur - prev) / prev) * 100), 0, (n) => `${n} %`);
}

// Cette méthode permet d'afficher une tuile de chiffre clé, avec son écart à la période précédente s'il y en a un.
export function Kpi(props: { label: string; value: ReactNode; delta?: Delta }) {
  return (
    <div className="st-kpi">
      <div className="k">{props.label}</div>
      <div className="v">{props.value}</div>
      {props.delta && <div className={`st-delta ${props.delta.dir}`}>{props.delta.text}</div>}
    </div>
  );
}

export type StackPart = { key: string; label: string; n: number; cls: string };

// Cette méthode permet d'afficher une répartition en barre empilée (parts non nulles) avec sa légende en pourcentages.
export function Stack(props: { parts: StackPart[]; label: string }) {
  const total = props.parts.reduce((s, p) => s + p.n, 0);
  const parts = props.parts.filter((p) => p.n > 0);
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <>
      <div className="st-stack" role="img" aria-label={props.label}>
        {parts.map((p) => (
          <span key={p.key} className={p.cls} style={{ width: `${(p.n / total) * 100}%` }} />
        ))}
      </div>
      <div className="st-legend">
        {parts.map((p) => (
          <span key={p.key}>
            <i className={p.cls} />
            {p.label} <b>{pct(p.n)} %</b>
          </span>
        ))}
      </div>
    </>
  );
}

// Cette méthode permet d'afficher un état vide en attente d'un seuil (« Encore 1 séance »), avec une jauge d'avancement.
export function Waiting(props: { have: number; need: number; what: string }) {
  const left = props.need - props.have;
  return (
    <div className="empty compact st-wait">
      <b className="c-text">
        Encore {left} séance{left > 1 ? 's' : ''}
      </b>
      <div className="fs-13">{props.what}</div>
      <div className="st-track">
        <span style={{ width: `${(props.have / props.need) * 100}%` }} />
      </div>
    </div>
  );
}

// Cette méthode permet d'afficher une ligne discrète qui renvoie aux paramètres quand une fonction désactivée masque un bloc.
export function SettingsHint(props: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <p className="st-hint">
      {props.children}{' '}
      <button className="bare c-accent fw-600" onClick={() => navigate('/profile/settings')}>
        Paramètres › Progression
      </button>
    </p>
  );
}
