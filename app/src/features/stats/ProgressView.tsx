import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { db } from '@/data/db';
import {
  criterionLabel,
  criterionShortLabel,
  formatGain,
  formatMetric,
  formatSetValues,
  formatWeight,
  recordDayLabel,
  repMilestonesLabel,
} from '@/domain/format';
import {
  goalsProgress,
  periodRange,
  recordsByMonth,
  recordsIn,
  type StatsPeriod,
  targetRate,
} from '@/domain/insights';
import {
  criterionDef,
  mergeRepMilestones,
  type RecordLineItem,
  recentRecords,
  recordDays,
  recordLines,
  recordSet,
} from '@/domain/records';
import type { TargetReason } from '@/domain/types';
import { BarChart } from '@/ui/BarChart';
import { SettingsHint, useStatsData } from './parts';

const monthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

const REASON_LABELS: Record<TargetReason['kind'], string> = {
  load_up: 'Charge +',
  reps_up: 'Reps +',
  duration_up: 'Durée +',
  consolidate: 'Consolider',
  mixed: 'Mixte',
  plateau: 'Plateau',
  comeback: 'Reprise',
};

// Cette méthode permet de choisir le nombre de mois de l'histogramme des records selon la période (6, 12, ou depuis le
// premier record, 24 au plus).
function monthsFor(period: StatsPeriod, firstAt: number | undefined, now: number): number {
  if (period === '1y') return 12;
  if (period !== 'all' || firstAt === undefined) return 6;
  const a = new Date(firstAt);
  const b = new Date(now);
  const span = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
  return Math.min(24, Math.max(6, span));
}

// Cette méthode permet d'afficher la vue Progrès : records par mois, objectifs de séance atteints sur la période (#92),
// avancement des objectifs à long terme et records récents (#102).
export default function ProgressView(props: { period: StatsPeriod }) {
  const navigate = useNavigate();
  const { workouts, exercises, settings, now } = useStatsData();
  const prefs = useLiveQuery(() => db.exercise_prefs.filter((p) => p.deleted_at == null).toArray(), []);

  const data = useMemo(() => {
    const all = workouts ?? [];
    const r = periodRange(props.period, now);
    const events = recentRecords(all, Number.POSITIVE_INFINITY);
    const firstAt = events.at(-1)?.startedAt;
    return {
      inPeriod: recordsIn(events, r.from, r.to),
      months: recordsByMonth(events, now, monthsFor(props.period, firstAt, now)),
      hasRecords: events.length > 0,
      targets: targetRate(all, r.from, r.to),
      recent: recordDays(
        recordLines(events, (id) => exercises.get(id)?.measurement_type ?? 'weight_reps').slice(0, 10),
      ),
      byId: new Map(all.map((w) => [w.id, w])),
    };
  }, [workouts, exercises, props.period, now]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: now volontairement exclu ; recalcul quand les données changent
  const goals = useMemo(() => {
    const list = (prefs ?? []).flatMap((p) => {
      const goal = p.doc.longTermGoal;
      const ex = exercises.get(p.exercise_id);
      return goal && ex?.measurement_type === 'weight_reps' ? [{ exerciseId: p.exercise_id, goal }] : [];
    });
    return goalsProgress(list, workouts ?? [], settings, now);
  }, [prefs, exercises, workouts, settings]);

  if (!workouts) return null;
  const units = settings.units;
  const { targets } = data;
  const reasons = (
    Object.entries(targets.byReason) as [TargetReason['kind'], { met: number; total: number }][]
  ).sort((a, b) => b[1].total - a[1].total);

  // Cette méthode permet d'afficher la valeur d'un record : la série (« 100 kg × 5 ») pour la meilleure série en volume,
  // sinon la valeur du critère dans les unités de l'utilisateur.
  const recordValue = (r: RecordLineItem, exerciseId: string) => {
    const type = exercises.get(exerciseId)?.measurement_type ?? 'weight_reps';
    const set = r.criterion === 'best_set_volume' ? recordSet(data.byId.get(r.workoutId), r) : undefined;
    if (set) return formatSetValues(set, type, units);
    return formatMetric(r.value, criterionDef(r.criterion).unit, type, units);
  };

  // Cette méthode permet de décrire l'échéance d'un objectif à long terme (atteint, date estimée ou non estimée).
  const goalStatus = (g: (typeof goals)[number]) => {
    if (g.achieved) return 'atteint 🎯';
    if (g.currentKg === undefined) return 'pas encore de séance';
    if (g.goalAt === undefined) return 'date non estimée';
    if (g.goalAt <= now) return 'à ta portée dès maintenant';
    return `atteint vers ${monthLong.format(g.goalAt)}`;
  };

  return (
    <>
      <div className="section">
        <div className="section-title">
          Records par mois
          <span className="normal-case fw-600 muted fs-12">{data.inPeriod} sur la période</span>
        </div>
        <div className="card">
          {data.hasRecords ? (
            <BarChart
              values={data.months.map((m) => m.count)}
              labels={data.months.map((m) => monthLong.format(m.monthStart))}
              format={(v) => `${v} record${v > 1 ? 's' : ''}`}
              firstLabel={data.months[0] ? monthShort.format(data.months[0].monthStart) : ''}
              lastLabel="ce mois"
              ariaLabel="Records battus par mois"
            />
          ) : (
            <p className="muted">Pas encore de record battu.</p>
          )}
        </div>
      </div>

      {(targets.total > 0 || settings.progressionEnabled) && (
        <div className="section">
          <div className="section-title">Objectifs de séance atteints</div>
          <div className="card">
            {targets.total === 0 ? (
              <p className="muted">
                Pas encore d'objectif sur la période : ils sont proposés à partir de la 2ᵉ séance d'un
                exercice.
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-10">
                  <div className="hero compact">{Math.round((targets.met / targets.total) * 100)} %</div>
                  <span className="muted fs-13">
                    {targets.met} / {targets.total} exercice{targets.total > 1 ? 's' : ''} avec objectif
                  </span>
                </div>
                <div className="mt-10">
                  {reasons.map(([kind, s]) => (
                    <div key={kind} className="hbar wide">
                      <span>{REASON_LABELS[kind]}</span>
                      <div className="track">
                        <div className="fill" style={{ width: `${(s.met / s.total) * 100}%` }} />
                      </div>
                      <span className="n">{Math.round((s.met / s.total) * 100)} %</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title">Objectifs à long terme</div>
        <div className="card">
          {goals.length === 0 && (
            <p className="muted">
              Aucun objectif à long terme. Tu peux en fixer un depuis la fiche d'un exercice.
            </p>
          )}
          {goals.map((g) => (
            <button
              key={g.exerciseId}
              className="st-goal"
              onClick={() => navigate(`/exercise/${g.exerciseId}`)}
            >
              <div className="top">
                <span>{exercises.get(g.exerciseId)?.name ?? 'Exercice'}</span>
                <b>
                  {formatWeight(g.goal.weight, units.weight)} × {g.goal.reps}
                </b>
              </div>
              <div className={`st-track${g.achieved ? ' done' : ''}`}>
                <span style={{ width: `${g.progress * 100}%` }} />
              </div>
              <div className="sub">
                {Math.round(g.progress * 100)} % du 1RM estimé visé · {goalStatus(g)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Records récents</div>
        <div className="card">
          {data.recent.length === 0 && <p className="muted">Pas encore de record battu.</p>}
          {data.recent.map((day) => (
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
                      : formatGain(main.gain, criterionDef(main.criterion).unit, main.criterion, units);
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
      {targets.total === 0 && !settings.progressionEnabled && (
        <div className="section">
          <SettingsHint>
            Objectifs de progression désactivés : le taux d'objectifs atteints apparaîtra ici si tu les
            actives dans
          </SettingsHint>
        </div>
      )}
    </>
  );
}
