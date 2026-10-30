import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '@/data/db';
import { useHistoryWithBadges } from '@/data/derived';
import { useExercise, useProfile, useSettings } from '@/data/queries';
import {
  isExerciseUsed,
  removeExercise,
  restoreExercise,
  saveExercisePrefs,
  updateExercise,
} from '@/data/repositories';
import {
  CHART_METRIC_LABELS,
  CHART_METRIC_UNITS,
  type ChartMetric,
  chartMetricsFor,
  exerciseSeries,
} from '@/domain/charts';
import type { Period } from '@/domain/dates';
import {
  criterionLabel,
  formatCanonical,
  formatKg,
  formatMetric,
  formatReason,
  formatSetValues,
  formatTargets,
  formatWeight,
} from '@/domain/format';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, setLabels } from '@/domain/labels';
import { fieldsFor, hasReps, hasTargets, isWorkingKind, weightUnitLabel } from '@/domain/measurement';
import { barToRemember, barWeights, exercisePlateSet } from '@/domain/plates';
import { incrementFor, parseRepRange, targetsMet } from '@/domain/progression';
import {
  bestRecords,
  criteriaFor,
  e1rm,
  REP_MILESTONES,
  type RecordCriterion,
  recordSet,
} from '@/domain/records';
import {
  currentRate,
  firstSessionAt,
  fitTrend,
  goalAchievedSet,
  goalDate,
  projectionPoints,
  trainingOrigin,
  weeklyE1rmPoints,
} from '@/domain/trend';
import type {
  CompletedWorkout,
  ExercisePrefsDoc,
  ExerciseRow,
  MeasurementType,
  Settings,
  WorkoutExercise,
} from '@/domain/types';
import { formatNumber, kgTo, parseDecimal, parseInteger, toKg, weightIn } from '@/domain/units';
import { formatWorkoutDate } from '@/features/history/HistoryCard';
import { ExerciseForm } from '@/features/library/ExerciseForm';
import { PlateSheet } from '@/features/plates/PlateSheet';
import { buildWorkoutExercise, loadBuildContext } from '@/features/workout-live/start';
import { BodyMap } from '@/ui/BodyMap';
import { Chips, Seg, Sheet, SubHead, toast } from '@/ui/components';
import { DotsIcon } from '@/ui/icons';
import { LineChart } from '@/ui/LineChart';
import { RpeTag } from '@/ui/RpeTag';
import { KIND_CLASS } from '@/ui/setKind';

type Units = Settings['units'];
type Tab = 'resume' | 'histo' | 'consignes';
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const WEIGHTED: MeasurementType[] = ['weight_reps', 'weighted_bw', 'assisted_bw'];

// Cette méthode permet d'afficher la fiche d'un exercice : onglets Résumé, Historique et Consignes (§F7.2, §F7.6, §F7.10).
// Elle donne aussi accès à la modification et à l'archivage (exercice personnel, ou catalogue pour l'administrateur).
export default function ExercisePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const exercise = useExercise(id);
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>('resume');
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [typeLocked, setTypeLocked] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: seuls l'id et le propriétaire changent le verrouillage du type
  useEffect(() => {
    if (!exercise) return;
    if (exercise.user_id === null) setTypeLocked(true);
    else void isExerciseUsed(exercise.id).then(setTypeLocked);
  }, [exercise?.id, exercise?.user_id]);

  if (exercise === undefined) return <div className="page" />;
  if (!exercise || exercise.deleted_at != null) {
    return (
      <>
        <SubHead title="Exercice" />
        <p className="empty">Cet exercice n'existe plus.</p>
      </>
    );
  }

  const editable = exercise.user_id !== null || profile?.is_admin === true;
  if (editing) {
    return (
      <>
        <SubHead title="Modifier l'exercice" onBack={() => setEditing(false)} />
        <ExerciseForm
          initial={exercise}
          typeLocked={typeLocked}
          submitLabel="Enregistrer"
          onSubmit={async (input) => {
            await updateExercise(exercise.id, input);
            toast('Exercice modifié');
            setEditing(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <SubHead
        title={exercise.name}
        right={
          editable && (
            <button className="icon-btn" aria-label="Actions" onClick={() => setMenu(true)}>
              <DotsIcon />
            </button>
          )
        }
      />
      <h1 className="ex-title">{exercise.name}</h1>
      <div className="ex-tags">
        <span className="tag acc">{MUSCLE_LABELS[exercise.primary_muscle]}</span>
        {exercise.secondary_muscles.map((m) => (
          <span key={m} className="tag">
            {MUSCLE_LABELS[m]}
          </span>
        ))}
        <span className="tag">{EQUIPMENT_LABELS[exercise.equipment]}</span>
        {exercise.archived_at != null && <span className="tag">Archivé</span>}
      </div>
      <BodyMap primary={exercise.primary_muscle} secondary={exercise.secondary_muscles} />
      <div className="subtabs">
        {(
          [
            ['resume', 'Résumé'],
            ['histo', 'Historique'],
            ['consignes', 'Consignes'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'resume' && <SummaryTab exercise={exercise} />}
      {tab === 'histo' && <HistoryTab exercise={exercise} />}
      {tab === 'consignes' && <InstructionsTab exercise={exercise} />}

      <Sheet
        open={menu}
        title={exercise.name}
        onClose={() => setMenu(false)}
        actions={[
          {
            label: exercise.user_id === null ? "Modifier l'exercice du catalogue" : "Modifier l'exercice",
            kind: 'primary',
            onClick: () => {
              setMenu(false);
              setEditing(true);
            },
          },
          ...(exercise.archived_at != null && exercise.user_id !== null
            ? [
                {
                  label: 'Restaurer',
                  onClick: async () => {
                    setMenu(false);
                    await restoreExercise(exercise.id);
                    toast('Exercice restauré');
                  },
                },
              ]
            : []),
          ...(exercise.archived_at == null
            ? [
                {
                  label: 'Supprimer',
                  kind: 'danger' as const,
                  onClick: () => {
                    setMenu(false);
                    setConfirmRemove(true);
                  },
                },
              ]
            : []),
        ]}
      />
      <Sheet
        open={confirmRemove}
        title="Supprimer cet exercice ?"
        onClose={() => setConfirmRemove(false)}
        actions={[
          {
            label: 'Supprimer',
            kind: 'danger',
            onClick: async () => {
              await removeExercise(exercise.id);
              toast(exercise.user_id === null || typeLocked ? 'Exercice archivé' : 'Exercice supprimé');
              navigate(-1);
            },
          },
          { label: 'Annuler', onClick: () => setConfirmRemove(false) },
        ]}
      >
        <p>
          {exercise.user_id === null
            ? 'Il disparaîtra du catalogue de tous les comptes. Les séances passées restent lisibles.'
            : typeLocked
              ? 'Il a déjà servi : il sera archivé. Les séances passées, records et graphiques restent visibles.'
              : "Il n'a jamais servi : il sera supprimé."}
        </p>
      </Sheet>
    </>
  );
}

// Cette méthode permet de lire en direct les réglages de progression de l'utilisateur pour un exercice.
function usePrefs(exerciseId: string): ExercisePrefsDoc | undefined {
  return useLiveQuery(async () => {
    const row = await db.exercise_prefs.where('exercise_id').equals(exerciseId).first();
    return row && row.deleted_at == null ? row.doc : undefined;
  }, [exerciseId]);
}

// Cette méthode permet d'afficher le Résumé : objectif de la prochaine séance, courbe, records et réglages de progression.
function SummaryTab(props: { exercise: ExerciseRow }) {
  const ex = props.exercise;
  const type = ex.measurement_type;
  const settings = useSettings();
  const units = settings.units;
  const prefs = usePrefs(ex.id);
  const { workouts } = useHistoryWithBadges();
  const all = workouts ?? [];
  const metrics = chartMetricsFor(type);
  const [metric, setMetric] = useState<ChartMetric>(metrics[0]!);
  const [period, setPeriod] = useState<Period>('3m');
  const [next, setNext] = useState<WorkoutExercise | undefined>();
  const [plateSheet, setPlateSheet] = useState(false);
  const now = Date.now();
  // Calculateur de disques : exercices à la barre avec un poids saisi, barre choisie ou détectée (issues #76, #100).
  const plateSet = fieldsFor(type).includes('weight')
    ? exercisePlateSet(ex, prefs, settings, units.weight)
    : null;
  // Charge proposée au calculateur : celle de la prochaine série de travail visée, sinon la barre seule.
  const nextWeight = next?.sets.find((s) => isWorkingKind(s.kind) && s.weight)?.weight;

  // Objectif de la prochaine séance, calculé comme au démarrage d'une séance vide (§F7.10).
  // biome-ignore lint/correctness/useExhaustiveDependencies: workouts et prefs déclenchent le recalcul (le contexte est relu dans Dexie)
  useEffect(() => {
    if (!hasTargets(type) || !settings.progressionEnabled) return setNext(undefined);
    let alive = true;
    void loadBuildContext(null).then((ctx) => alive && setNext(buildWorkoutExercise(ex, ctx)));
    return () => {
      alive = false;
    };
  }, [ex, type, workouts, prefs, settings.progressionEnabled]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: now volontairement exclu pour ne pas recalculer à chaque rendu
  const points = useMemo(() => exerciseSeries(ex.id, all, metric, period, now), [ex.id, all, metric, period]);
  const bests = useMemo(() => bestRecords(ex.id, all), [ex.id, all]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: now volontairement exclu ; seule l'ancienneté des paramètres compte
  const trendData = useMemo(() => {
    if (type !== 'weight_reps') return undefined;
    const first = firstSessionAt(ex.id, all);
    if (first === undefined) return undefined;
    const trend = fitTrend(weeklyE1rmPoints(ex.id, all), trainingOrigin(settings, first), now);
    const goal = prefs?.longTermGoal;
    return {
      trend,
      projection: trend ? projectionPoints(trend, now) : [],
      goal,
      goalKg: goal ? e1rm(toKg(goal.weight), goal.reps) : undefined,
      goalAt: trend && goal ? goalDate(trend, goal, now) : undefined,
      achieved: goal ? goalAchievedSet(ex.id, all, goal) : undefined,
    };
  }, [ex.id, type, all, prefs, settings.trainingAge]);

  const unit = CHART_METRIC_UNITS[metric];
  const fmt = (v: number) => formatMetric(v, unit, type, units);
  const axisFmt = (v: number) =>
    unit === 'kg'
      ? formatNumber(kgTo(v, units.weight), 0)
      : unit === 'reps'
        ? formatNumber(v, 0)
        : formatCanonical(v, unit, units);
  const last = points.at(-1);
  const first = points[0];
  const delta = last && first && points.length > 1 ? last.v - first.v : undefined;
  const lowerIsBetter = metric === 'min_assistance' || metric === 'best_pace';
  const showTrend = metric === 'e1rm' && trendData !== undefined;

  return (
    <div className="pane on">
      {next && <NextGoalCard next={next} units={units} />}
      {plateSet && (
        <div className="section">
          <button className="btn btn-soft btn-block btn-sm" onClick={() => setPlateSheet(true)}>
            Calculer les disques
          </button>
          <PlateSheet
            open={plateSheet}
            subtitle={ex.name}
            initial={nextWeight && weightIn(nextWeight, units.weight)}
            unit={units.weight}
            plateSet={plateSet}
            bars={barWeights(settings, units.weight)}
            onBar={(t) =>
              void saveExercisePrefs(ex.id, { bar: barToRemember(ex, settings, units.weight, t) })
            }
            onClose={() => setPlateSheet(false)}
          />
        </div>
      )}
      <div className="section">
        <div className="muted fs-13">{CHART_METRIC_LABELS[metric]} · dernière séance</div>
        <div className="flex items-baseline gap-10">
          <div className="hero">{last ? fmt(last.v) : '—'}</div>
          {delta !== undefined && (
            <span
              className={`delta${delta === 0 ? ' c-text-2' : delta > 0 !== lowerIsBetter ? '' : ' c-fail'}`}
            >
              {delta >= 0 ? '▲ +' : '▼ −'}
              {fmt(Math.abs(delta)).replace(/^[+−]/, '')} sur la période
            </span>
          )}
        </div>
      </div>
      {metrics.length > 1 && (
        <div className="mt-12">
          <Chips
            value={metric}
            options={metrics.map((m) => ({ value: m, label: CHART_METRIC_LABELS[m] }))}
            onChange={(m) => m && setMetric(m)}
          />
        </div>
      )}
      <div className="section mt-6">
        {points.length > 0 ? (
          <LineChart
            points={points}
            trend={showTrend ? trendData.projection : undefined}
            goal={showTrend ? trendData.goalKg : undefined}
            format={fmt}
            axis={axisFmt}
            ariaLabel={CHART_METRIC_LABELS[metric]}
          />
        ) : (
          <p className="empty">Aucune séance sur la période.</p>
        )}
        {showTrend && <TrendInfo data={trendData} units={units} hasAge={!!settings.trainingAge} now={now} />}
        <div className="mt-10">
          <Seg
            stretch
            value={period}
            onChange={setPeriod}
            options={[
              { value: '1m', label: '1 mois' },
              { value: '3m', label: '3 mois' },
              { value: '1y', label: '1 an' },
              { value: 'all', label: 'Tout' },
            ]}
          />
        </div>
      </div>
      <RecordsSection exercise={ex} bests={bests} workouts={all} units={units} />
      <ProgressionSettings exercise={ex} prefs={prefs} units={units} />
    </div>
  );
}

// Cette méthode permet d'afficher l'objectif proposé pour la prochaine séance, avec sa raison et la fourchette.
function NextGoalCard(props: { next: WorkoutExercise; units: Units }) {
  const { next, units } = props;
  const working = next.sets.filter((s) => isWorkingKind(s.kind) && s.target);
  return (
    <div className="section">
      <div className="card goal-card">
        <div className="muted fs-13 flex justify-between">
          Objectif de la prochaine séance
          {next.repRange && (
            <span className="tag sm">
              Fourchette {next.repRange.min}–{next.repRange.max}
            </span>
          )}
        </div>
        {working.length > 0 && next.targetReason ? (
          <>
            <div className="big">
              {formatReason(next.targetReason, next.measurementType, units).arrow}{' '}
              {formatTargets(
                working.map((s) => s.target),
                next.measurementType,
                units,
              )}{' '}
              <small className="muted fs-14 fw-600">
                · {working.length} série{working.length > 1 ? 's' : ''}
              </small>
            </div>
            <div className="why">{formatReason(next.targetReason, next.measurementType, units).text}</div>
          </>
        ) : (
          <div className="why">Premier essai : l'objectif apparaîtra après une première séance.</div>
        )}
      </div>
    </div>
  );
}

type TrendData = {
  trend: ReturnType<typeof fitTrend>;
  projection: { t: number; v: number }[];
  goal: ExercisePrefsDoc['longTermGoal'];
  goalKg: number | undefined;
  goalAt: number | undefined;
  achieved: { workoutId: string; setId: string } | undefined;
};

// Cette méthode permet d'afficher la légende et les textes de la tendance projetée et de l'objectif à long terme (§F7.10).
function TrendInfo(props: { data: TrendData; units: Units; hasAge: boolean; now: number }) {
  const { trend, goal, goalKg, goalAt, achieved } = props.data;
  const units = props.units;
  return (
    <div className="trend-info">
      {trend?.status === 'up' && (
        <div className="flex gap-14 flex-wrap">
          <span className="legend">
            <i />
            Tendance projetée (12 sem.)
          </span>
          {goal && (
            <span className="legend">
              <i className="gold" />
              Objectif à long terme
            </span>
          )}
        </div>
      )}
      {!trend && (
        <div>Tendance disponible après 6 semaines d'entraînement réparties sur au moins 8 semaines.</div>
      )}
      {trend?.status === 'flat' && <div>Stable sur la période.</div>}
      {trend?.status === 'up' && (
        <div>
          Rythme actuel : <b>+{formatKg(currentRate(trend, props.now), units.weight)}</b> de 1RM estimé par
          mois
        </div>
      )}
      {goal && (
        <div>
          🎯{' '}
          <b>
            {formatWeight(goal.weight, units.weight)} × {goal.reps}
          </b>
          {goalKg !== undefined && <> ({formatKg(goalKg, units.weight)} de 1RM estimé)</>} ·{' '}
          {achieved ? (
            <b>atteint</b>
          ) : goalAt !== undefined && goalAt <= props.now ? (
            <b>à ta portée dès maintenant</b>
          ) : goalAt !== undefined ? (
            <>
              atteint <b>vers {monthFmt.format(goalAt)}</b>
            </>
          ) : (
            "plus d'un an au rythme actuel"
          )}
        </div>
      )}
      {trend && !props.hasAge && (
        <div>Renseigne ton ancienneté (Paramètres) pour une projection plus juste.</div>
      )}
    </div>
  );
}

// Cette méthode permet d'afficher les meilleurs résultats de l'exercice, et la grille « meilleur poids à N reps ».
function RecordsSection(props: {
  exercise: ExerciseRow;
  bests: ReturnType<typeof bestRecords>;
  workouts: CompletedWorkout[];
  units: Units;
}) {
  const { exercise, bests, units } = props;
  const type = exercise.measurement_type;
  const criteria = criteriaFor(type).filter((c) => !c.id.startsWith('weight_at_'));

  // Cette méthode permet d'afficher la série d'un record de volume (« 80 kg × 8 ») plutôt que son produit.
  const setText = (c: RecordCriterion): string | undefined => {
    const rv = bests[c];
    const set =
      rv &&
      recordSet(
        props.workouts.find((x) => x.id === rv.workoutId),
        rv,
      );
    return set ? formatSetValues(set, type, units) : undefined;
  };

  return (
    <div className="section">
      <div className="section-title">Records</div>
      <div className="card">
        <ul className="rec-list">
          {criteria.map((c) => {
            const rv = bests[c.id];
            return (
              <li key={c.id}>
                <span>{criterionLabel(c.id, type)}</span>
                <b>
                  {rv
                    ? (c.id === 'best_set_volume' && setText(c.id)) ||
                      formatMetric(rv.value, c.unit, type, units)
                    : '—'}
                </b>
              </li>
            );
          })}
        </ul>
      </div>
      {type === 'weight_reps' && (
        <>
          <div className="section-title mt-16">Meilleur poids à N reps (au moins)</div>
          <div className="reps-grid">
            {REP_MILESTONES.map((n) => {
              const rv = bests[`weight_at_${n}`];
              return (
                <div key={n}>
                  <div className="k">
                    {n} rep{n > 1 ? 's' : ''}
                  </div>
                  <div className="v">{rv ? formatKg(rv.value, units.weight) : '—'}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Cette méthode permet de modifier les réglages de progression de l'exercice : incrément, fourchette par défaut, objectif à long terme.
function ProgressionSettings(props: {
  exercise: ExerciseRow;
  prefs: ExercisePrefsDoc | undefined;
  units: Units;
}) {
  const { exercise, prefs, units } = props;
  const type = exercise.measurement_type;
  const [sheet, setSheet] = useState<'increment' | 'range' | 'goal' | null>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const showIncrement = WEIGHTED.includes(type);
  const showRange = hasReps(type) && hasTargets(type);
  const showGoal = type === 'weight_reps';
  if (!showIncrement && !showRange && !showGoal) return null;

  const increment = incrementFor(exercise, prefs, units.weight);
  const range = prefs?.defaultRepRange;
  const goal = prefs?.longTermGoal;

  // Cette méthode permet d'ouvrir une feuille de réglage pré-remplie avec la valeur actuelle.
  const open = (s: 'increment' | 'range' | 'goal') => {
    if (s === 'increment') setA(formatNumber(increment.v, 3));
    if (s === 'range') setA(range ? `${range.min}–${range.max}` : '');
    if (s === 'goal') {
      setA(goal ? formatNumber(kgTo(toKg(goal.weight), units.weight), 3) : '');
      setB(goal ? String(goal.reps) : '');
    }
    setSheet(s);
  };

  // Cette méthode permet d'enregistrer le réglage saisi après validation ; une saisie vide revient au défaut.
  const save = async () => {
    if (sheet === 'increment') {
      if (!a.trim()) await saveExercisePrefs(exercise.id, { increment: undefined });
      else {
        const v = parseDecimal(a);
        if (v === undefined || v <= 0) return toast('Incrément invalide');
        await saveExercisePrefs(exercise.id, { increment: { v, u: units.weight } });
      }
    } else if (sheet === 'range') {
      if (!a.trim()) await saveExercisePrefs(exercise.id, { defaultRepRange: undefined });
      else {
        const r = parseRepRange(a);
        if (!r) return toast('Fourchette invalide (ex. 8–12)');
        await saveExercisePrefs(exercise.id, { defaultRepRange: r });
      }
    } else if (sheet === 'goal') {
      if (!a.trim() && !b.trim()) await saveExercisePrefs(exercise.id, { longTermGoal: undefined });
      else {
        const v = parseDecimal(a);
        const r = parseInteger(b);
        if (v === undefined || v <= 0) return toast('Charge invalide');
        if (r === undefined || r < 1 || r > 12) return toast('Reps entre 1 et 12');
        await saveExercisePrefs(exercise.id, {
          longTermGoal: { weight: { v, u: units.weight }, reps: r, setAt: Date.now() },
        });
      }
    }
    toast('Réglage enregistré');
    setSheet(null);
  };

  return (
    <div className="section">
      <div className="section-title">Réglages de progression</div>
      {showIncrement && (
        <button className="set-row" onClick={() => open('increment')}>
          Incrément<span className="t2">{formatWeight(increment, units.weight)} ›</span>
        </button>
      )}
      {showRange && (
        <button className="set-row" onClick={() => open('range')}>
          <span className="ta-left">
            Fourchette par défaut
            <small className="muted d-block fs-12">hors routine (séance vide)</small>
          </span>
          <span className="t2">{range ? `${range.min}–${range.max}` : 'Auto'} ›</span>
        </button>
      )}
      {showGoal && (
        <button className="set-row" onClick={() => open('goal')}>
          Objectif à long terme
          <span className="t2">
            {goal ? `${formatWeight(goal.weight, units.weight)} × ${goal.reps}` : 'Aucun'} ›
          </span>
        </button>
      )}
      <Sheet
        open={sheet !== null}
        title={
          sheet === 'increment'
            ? 'Incrément'
            : sheet === 'range'
              ? 'Fourchette par défaut'
              : 'Objectif à long terme'
        }
        onClose={() => setSheet(null)}
        actions={[
          { label: 'Enregistrer', kind: 'primary', onClick: save },
          { label: 'Annuler', kind: 'ghost', onClick: () => setSheet(null) },
        ]}
      >
        {sheet === 'increment' && (
          <label className="field mt-0">
            <span>Incrément ({units.weight}) · vide = défaut selon l'équipement</span>
            <input inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} />
          </label>
        )}
        {sheet === 'range' && (
          <label className="field mt-0">
            <span>Fourchette de reps (ex. 8–12, ou 8) · vide = automatique</span>
            <input value={a} onChange={(e) => setA(e.target.value)} placeholder="8–12" />
          </label>
        )}
        {sheet === 'goal' && (
          <>
            <div className="grid-2">
              <label className="field mt-0">
                <span>Charge ({weightUnitLabel(exercise.equipment, type, units.weight)})</span>
                <input inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} />
              </label>
              <label className="field mt-0">
                <span>Reps (1 à 12)</span>
                <input inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} />
              </label>
            </div>
            <p className="muted fs-12 mt-8">Laisse vide pour retirer l'objectif.</p>
          </>
        )}
      </Sheet>
    </div>
  );
}

// Cette méthode permet de lister toutes les séances où l'exercice a été fait, de la plus récente à la plus ancienne.
function HistoryTab(props: { exercise: ExerciseRow }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const prefs = usePrefs(props.exercise.id);
  const { workouts, badges } = useHistoryWithBadges();
  const list = useMemo(
    () =>
      [...(workouts ?? [])]
        .reverse()
        .filter((w) => w.doc.exercises.some((e) => e.exerciseId === props.exercise.id)),
    [workouts, props.exercise.id],
  );
  const goalSet = useMemo(
    () =>
      prefs?.longTermGoal
        ? goalAchievedSet(props.exercise.id, workouts ?? [], prefs.longTermGoal)?.setId
        : undefined,
    [prefs, workouts, props.exercise.id],
  );

  if (workouts && list.length === 0) return <p className="empty">Pas encore de séance avec cet exercice.</p>;
  return (
    <div className="pane on">
      <div className="section">
        {list.map((w) => {
          const wb = badges[w.id];
          return (
            <button key={w.id} className="card hist" onClick={() => navigate(`/history/${w.id}`)}>
              <h3 className="sm">{w.doc.title || 'Séance'}</h3>
              {w.doc.exercises
                .filter((e) => e.exerciseId === props.exercise.id)
                .map((e) => {
                  const met = targetsMet(e);
                  const labels = setLabels(e.sets.map((s) => s.kind));
                  return (
                    <div key={e.id}>
                      <div className="date">
                        {formatWorkoutDate(w.started_at)}
                        {met && <span className="ok"> · 🎯 objectif atteint</span>}
                        {wb?.entries[e.id]?.length ? <span className="pr-pill"> 🏆</span> : null}
                      </div>
                      <ul className="mt-10">
                        {e.sets.map((s, i) => (
                          <li key={s.id}>
                            <b className={KIND_CLASS[s.kind] || undefined}>{labels[i]}</b>
                            {formatSetValues(s, e.measurementType, settings.units)}
                            {s.rpe !== undefined && <RpeTag rpe={s.rpe} />}
                            {wb?.sets[s.id]?.length ? <span className="pr-pill">🏆</span> : null}
                            {s.id === goalSet ? <span className="pr-pill">🎯</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Cette méthode permet d'afficher les consignes d'exécution, une étape par ligne.
function InstructionsTab(props: { exercise: ExerciseRow }) {
  const steps = (props.exercise.instructions ?? '')
    .split(/\n+/)
    .map((s) => s.replace(/^\s*(\d+[.)]|[-•])\s*/, '').trim())
    .filter(Boolean);
  return (
    <div className="pane on">
      <div className="section">
        {steps.length > 0 ? (
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : (
          <p className="empty">Pas de consignes pour cet exercice.</p>
        )}
      </div>
    </div>
  );
}
