import { memo } from 'react';
import { useNavigate } from 'react-router';
import { formatDurationHuman, formatKg } from '@/domain/format';
import type { WorkoutBadges } from '@/domain/records';
import { firstExercises, workoutSummary } from '@/domain/summary';
import type { ExerciseRow, Settings, WorkoutRow } from '@/domain/types';
import { PhotoView } from './PhotoView';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Cette méthode permet d'afficher la date et l'heure de début d'une séance (« mar. 20 oct. · 18:32 »).
export function formatWorkoutDate(ms: number): string {
  return `${dateFmt.format(ms)} · ${timeFmt.format(ms)}`;
}

// Cette méthode permet d'afficher une séance de l'historique : chiffres, objectifs, note, photo et 3 premiers exercices (§F7.5).
export const HistoryCard = memo(function HistoryCard(props: {
  workout: WorkoutRow;
  badges: WorkoutBadges | undefined;
  exercises: Map<string, ExerciseRow>;
  units: Settings['units'];
  initial: string;
}) {
  const navigate = useNavigate();
  const w = props.workout;
  const s = workoutSummary(w, props.badges, Date.now());
  const first = firstExercises(w.doc, 3);
  const others = new Set(w.doc.exercises.map((e) => e.exerciseId)).size - first.length;
  return (
    <button
      className="card hist"
      style={{ width: '100%', textAlign: 'left' }}
      onClick={() => navigate(`/history/${w.id}`)}
    >
      <div className="top">
        <div className="avatar">{props.initial}</div>
        <div>
          <h3>{w.doc.title || 'Séance'}</h3>
          <div className="date">{formatWorkoutDate(w.started_at)}</div>
        </div>
      </div>
      {w.doc.note && <p className="note">{w.doc.note}</p>}
      <div className="mini">
        <div className="stat">
          <div className="k">Durée</div>
          <div className="v">{formatDurationHuman(s.durationS)}</div>
        </div>
        <div className="stat">
          <div className="k">Volume</div>
          <div className="v">{formatKg(s.volumeKg, props.units.weight, 0)}</div>
        </div>
        <div className="stat">
          <div className="k">Séries</div>
          <div className="v">{s.setCount}</div>
        </div>
        <div className="stat">
          <div className="k">Records</div>
          <div className="v">
            {s.recordCount > 0 ? (
              <span className="pr-pill">🏆 {s.recordCount}</span>
            ) : (
              <span className="muted">0</span>
            )}
          </div>
        </div>
      </div>
      {s.targets.total > 0 && (
        <div className="goal-sum">
          🎯 Objectifs atteints : {s.targets.met} / {s.targets.total} exercices
        </div>
      )}
      {w.doc.photoPath && <PhotoView path={w.doc.photoPath} />}
      <ul style={w.doc.photoPath ? { marginTop: 12 } : undefined}>
        {first.map((e) => (
          <li key={e.exerciseId}>
            <b>{e.setCount} ×</b>
            {props.exercises.get(e.exerciseId)?.name ?? 'Exercice'}
          </li>
        ))}
      </ul>
      {others > 0 && (
        <div className="more">
          + {others} autre{others > 1 ? 's' : ''} exercice{others > 1 ? 's' : ''}
        </div>
      )}
    </button>
  );
});
