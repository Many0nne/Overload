import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCompletedWorkouts, useExerciseMap, useSettings } from '@/data/queries';
import { DAY_MS, dayKey, monthGrid } from '@/domain/dates';
import { criterionLabel, formatCanonical } from '@/domain/format';
import { MUSCLE_LABELS } from '@/domain/labels';
import { criteriaFor, type RecordCriterion, type RecordEvent, recentRecords } from '@/domain/records';
import { muscleDistribution, trainingDays, weekStreak } from '@/domain/stats';
import type { MeasurementType, Muscle } from '@/domain/types';
import { formatNumber } from '@/domain/units';
import { SubHead } from '@/ui/components';

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dayLetters = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Cette méthode permet de passer la première lettre d'un libellé en minuscule (« Meilleur 1RM » → « meilleur 1RM »).
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

type RecordLine = { event: RecordEvent; others: number };

// Cette méthode permet de regrouper les records par séance et exercice : une ligne avec le critère principal (ordre du §F7.6)
// et le nombre d'autres critères battus. Pour un même critère, le dernier événement de la séance est le meilleur.
function recordLines(events: RecordEvent[], typeOf: (exerciseId: string) => MeasurementType): RecordLine[] {
  const groups = new Map<string, Map<RecordCriterion, RecordEvent>>();
  for (const e of events) {
    const key = `${e.workoutId}|${e.exerciseId}`;
    const g = groups.get(key) ?? new Map<RecordCriterion, RecordEvent>();
    g.set(e.criterion, e);
    groups.set(key, g);
  }
  const lines: RecordLine[] = [];
  for (const g of groups.values()) {
    const any = [...g.values()][0]!;
    const main = criteriaFor(typeOf(any.exerciseId))
      .map((c) => g.get(c.id))
      .find((e) => e !== undefined);
    lines.push({ event: main ?? any, others: g.size - 1 });
  }
  return lines.sort((a, b) => b.event.startedAt - a.event.startedAt);
}

// Cette méthode permet d'afficher les statistiques globales : calendrier et série de semaines, séries par muscle, records récents (§F7.6).
export default function StatsPage() {
  const navigate = useNavigate();
  const workouts = useCompletedWorkouts();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const now = Date.now();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: recalcul à la minute, pas à chaque rendu
  const { days, streak, muscles, records } = useMemo(() => {
    const all = workouts ?? [];
    const dist = muscleDistribution(all, (id) => exercises.get(id), now - 30 * DAY_MS, now + 1);
    const list = (Object.entries(dist) as [Muscle, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    return {
      days: trainingDays(all),
      streak: weekStreak(all, now),
      muscles: list,
      records: recordLines(
        recentRecords(all, 200),
        (id) => exercises.get(id)?.measurement_type ?? 'weight_reps',
      ).slice(0, 10),
    };
  }, [workouts, exercises, Math.floor(now / 60_000)]);

  const grid = monthGrid(month.y, month.m);
  const today = dayKey(now);
  const current = new Date();
  const isCurrent = month.y === current.getFullYear() && month.m === current.getMonth();
  const label = monthFmt.format(new Date(month.y, month.m, 1));
  const maxMuscle = muscles[0]?.[1] ?? 1;

  // Cette méthode permet de passer au mois précédent ou suivant du calendrier (pas au-delà du mois en cours).
  const shift = (delta: -1 | 1) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <>
      <SubHead title="Statistiques" />
      <div className="section" style={{ marginTop: 4 }}>
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="icon-btn" aria-label="Mois précédent" onClick={() => shift(-1)}>
                ‹
              </button>
              <b style={{ textTransform: 'capitalize' }}>{label}</b>
              <button
                className="icon-btn"
                aria-label="Mois suivant"
                disabled={isCurrent}
                onClick={() => shift(1)}
              >
                {isCurrent ? '' : '›'}
              </button>
            </div>
            <span className="pr-pill" style={{ color: 'var(--text)' }}>
              🔥 {streak} semaine{streak > 1 ? 's' : ''}
            </span>
          </div>
          <div className="cal">
            {dayLetters.map((d, i) => (
              <div key={`h${i}`} className="h">
                {d}
              </div>
            ))}
            {grid.flat().map((key, i) =>
              key ? (
                <div
                  key={key}
                  className={`c${days.has(key) ? ' on' : ''}${key === today ? ' today' : ''}${key > today ? ' fut' : ''}`}
                >
                  {Number(key.slice(8))}
                </div>
              ) : (
                <div key={`e${i}`} />
              ),
            )}
          </div>
        </div>
      </div>
      <div className="section">
        <div className="section-title">Séries par muscle · 30 jours</div>
        <div className="card">
          {muscles.length === 0 && <p className="muted">Aucune série ces 30 derniers jours.</p>}
          {muscles.map(([m, v]) => (
            <div key={m} className="hbar">
              <span>{MUSCLE_LABELS[m]}</span>
              <div className="track">
                <div className="fill" style={{ width: `${(v / maxMuscle) * 100}%` }} />
              </div>
              <span className="n">{formatNumber(v)}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '.75rem', marginTop: 6 }}>
          Muscle principal = 1 série, secondaire = 0,5.
        </p>
      </div>
      <div className="section">
        <div className="section-title">Records récents</div>
        <div className="card">
          {records.length === 0 && <p className="muted">Pas encore de record battu.</p>}
          <ul className="rec-list">
            {records.map(({ event: r, others }) => {
              const ex = exercises.get(r.exerciseId);
              const type = ex?.measurement_type ?? 'weight_reps';
              const unit = criteriaFor(type).find((c) => c.id === r.criterion)?.unit ?? 'kg';
              const prefix = type === 'weighted_bw' && unit === 'kg' ? '+' : '';
              return (
                <li
                  key={`${r.workoutId}-${r.exerciseId}-${r.criterion}-${r.setId ?? r.entryId}`}
                  onClick={() => navigate(`/exercise/${r.exerciseId}`)}
                  style={{ cursor: 'pointer', gap: 12 }}
                >
                  <span>
                    {ex?.name ?? 'Exercice'} · {lowerFirst(criterionLabel(r.criterion, type))}
                    {others > 0 && (
                      <span className="muted">
                        {' '}
                        (+{others} autre{others > 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                  <b style={{ whiteSpace: 'nowrap' }}>
                    {prefix}
                    {formatCanonical(r.value, unit, settings.units)}
                  </b>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
