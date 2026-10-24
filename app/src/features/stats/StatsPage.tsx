import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCompletedWorkouts, useExerciseMap, useSettings } from '@/data/queries';
import { DAY_MS, dayKey, monthGrid } from '@/domain/dates';
import {
  criterionLabel,
  criterionShortLabel,
  formatGain,
  formatMetric,
  formatSetValues,
  recordDayLabel,
  repMilestonesLabel,
} from '@/domain/format';
import { MUSCLE_LABELS } from '@/domain/labels';
import {
  criterionDef,
  mergeRepMilestones,
  type RecordLineItem,
  recentRecords,
  recordDays,
  recordLines,
  recordSet,
} from '@/domain/records';
import { muscleDistribution, trainingDays, weekStreak } from '@/domain/stats';
import type { Muscle } from '@/domain/types';
import { formatNumber } from '@/domain/units';
import { SubHead } from '@/ui/components';

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dayLetters = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

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
  const { days, streak, muscles, records, byId } = useMemo(() => {
    const all = workouts ?? [];
    const dist = muscleDistribution(all, (id) => exercises.get(id), now - 30 * DAY_MS, now + 1);
    const list = (Object.entries(dist) as [Muscle, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    return {
      days: trainingDays(all),
      streak: weekStreak(all, now),
      muscles: list,
      records: recordDays(
        recordLines(
          recentRecords(all, Number.POSITIVE_INFINITY),
          (id) => exercises.get(id)?.measurement_type ?? 'weight_reps',
        ).slice(0, 10),
      ),
      byId: new Map(all.map((w) => [w.id, w])),
    };
  }, [workouts, exercises, Math.floor(now / 60_000)]);

  const grid = monthGrid(month.y, month.m);
  const today = dayKey(now);
  const current = new Date();
  const isCurrent = month.y === current.getFullYear() && month.m === current.getMonth();
  const label = monthFmt.format(new Date(month.y, month.m, 1));
  const maxMuscle = muscles[0]?.[1] ?? 1;

  // Cette méthode permet d'afficher la valeur d'un record : la série (« 100 kg × 5 ») pour la meilleure série en volume,
  // sinon la valeur du critère dans les unités de l'utilisateur.
  const recordValue = (r: RecordLineItem, exerciseId: string) => {
    const type = exercises.get(exerciseId)?.measurement_type ?? 'weight_reps';
    const set = r.criterion === 'best_set_volume' ? recordSet(byId.get(r.workoutId), r) : undefined;
    if (set) return formatSetValues(set, type, settings.units);
    return formatMetric(r.value, criterionDef(r.criterion).unit, type, settings.units);
  };

  // Cette méthode permet de passer au mois précédent ou suivant du calendrier (pas au-delà du mois en cours).
  const shift = (delta: -1 | 1) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <>
      <SubHead title="Statistiques" />
      <div className="section mt-4">
        <div className="card">
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <button className="icon-btn" aria-label="Mois précédent" onClick={() => shift(-1)}>
                ‹
              </button>
              <b className="capitalize">{label}</b>
              <button
                className="icon-btn"
                aria-label="Mois suivant"
                disabled={isCurrent}
                onClick={() => shift(1)}
              >
                {isCurrent ? '' : '›'}
              </button>
            </div>
            <span className="pr-pill c-text">
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
        <p className="muted fs-12 mt-6">Muscle principal = 1 série, secondaire = 0,5.</p>
      </div>
      <div className="section">
        <div className="section-title">Records récents</div>
        <div className="card">
          {records.length === 0 && <p className="muted">Pas encore de record battu.</p>}
          {records.map((day) => (
            <div key={day.key}>
              <div className="rec-day">{recordDayLabel(day.startedAt, now)}</div>
              <ul className="rec-list">
                {day.lines.map((line) => {
                  const ex = exercises.get(line.exerciseId);
                  const type = ex?.measurement_type ?? 'weight_reps';
                  const [main, ...others] = line.records;
                  if (!main) return null;
                  const gain =
                    main.gain === undefined
                      ? undefined
                      : formatGain(
                          main.gain,
                          criterionDef(main.criterion).unit,
                          main.criterion,
                          settings.units,
                        );
                  return (
                    <li key={`${line.workoutId}-${line.exerciseId}`}>
                      <button className="rec-line" onClick={() => navigate(`/exercise/${line.exerciseId}`)}>
                        <span className="rec-main">
                          <span className="rec-name">{ex?.name ?? 'Exercice'}</span>
                          <span className="rec-crit">{criterionLabel(main.criterion, type)}</span>
                          {others.length > 0 && (
                            <span className="rec-pills">
                              {mergeRepMilestones(others).map(({ item, reps }) => (
                                <span key={item.criterion} className="rec-pill">
                                  {reps.length > 1
                                    ? repMilestonesLabel(reps)
                                    : criterionShortLabel(item.criterion, type)}{' '}
                                  <b>{recordValue(item, line.exerciseId)}</b>
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        <span className="rec-val">
                          <b>{recordValue(main, line.exerciseId)}</b>
                          {main.gain === undefined && <span className="rec-gain new">🏆 nouveau</span>}
                          {gain && <span className="rec-gain">{gain}</span>}
                        </span>
                        <span className="rec-chev" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
