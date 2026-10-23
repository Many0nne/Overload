// Sorties des outils de lecture du connecteur Claude (docs/spec-mcp.md §6.2) : mêmes calculs que l'app (domaine),
// JSON structuré (charges saisies gardées en { v, u }) et résumé texte en français dans les unités de l'utilisateur.
import { dayKey, WEEK_MS, weekStart, weeksBetween } from '../dates';
import {
  criterionLabel,
  formatCanonical,
  formatDurationHuman,
  formatKg,
  formatRpe,
  formatSetValues,
  formatWeight,
} from '../format';
import { MUSCLE_LABELS, SET_KIND_LABELS, TRAINING_AGE_LABELS } from '../labels';
import { isWorkingKind } from '../measurement';
import { TREND_MIN_POINTS, TREND_MIN_SPAN_WEEKS } from '../progressionConfig';
import {
  bestRecords,
  criteriaFor,
  e1rm,
  type RecordCriterion,
  type RecordEvent,
  recentRecords,
  sortWorkouts,
  type WorkoutBadges,
} from '../records';
import { muscleDistribution, trainingDays, weeklyAggregates, weekStreak } from '../stats';
import { doneSetCount, workoutSummary } from '../summary';
import {
  currentRate,
  firstSessionAt,
  fitTrend,
  goalAchievedSet,
  goalDate,
  modelValue,
  project,
  trainingOrigin,
  weeklyE1rmPoints,
} from '../trend';
import type {
  BodyMeasurementKey,
  BodyMeasurementRow,
  ExercisePrefsDoc,
  ExerciseRow,
  FolderRow,
  Muscle,
  ProfileRow,
  RoutineRow,
  Settings,
  Weight,
  WorkoutRow,
  WorkoutSet,
} from '../types';
import { clean, kgTo, toKg } from '../units';
import { exerciseVolumeKg } from '../volume';
import { formatInstant, fromLocalFrame, toLocalFrame, zonedDayKey } from './tz';

type Units = Settings['units'];

export type ViewCtx = {
  units: Units;
  tz: string;
  now: number;
  exercises: Map<string, ExerciseRow>;
};

export type Rendered<T> = { data: T; text: string };

const r1 = (n: number) => clean(Math.round(n * 10) / 10);

// Cette méthode permet d'exprimer une valeur en kg dans l'unité de poids de l'utilisateur, arrondie au dixième.
export function kgOut(kg: number, unit: Units['weight']): Weight {
  return { v: r1(kgTo(kg, unit)), u: unit };
}

// Cette méthode permet de lire le nom d'un exercice pour l'affichage (« Exercice supprimé » s'il est introuvable).
export function exerciseName(ctx: ViewCtx, id: string): string {
  return ctx.exercises.get(id)?.name ?? 'Exercice supprimé';
}

// Cette méthode permet de projeter les séances dans le « temps local » du moteur aligné sur le fuseau demandé, pour
// appliquer les règles de jour et de semaine du domaine (lundi-dimanche) dans ce fuseau.
function framed(workouts: WorkoutRow[], tz: string): WorkoutRow[] {
  return workouts.map((w) => ({ ...w, started_at: toLocalFrame(w.started_at, tz) }));
}

// ---------- Profil ----------

export type ProfileView = {
  name: string;
  units: Units;
  defaultRestS: number | null;
  trainingAge?: string;
  progressionTargetsEnabled: boolean;
  workoutCount: number;
  firstWorkoutAt?: string;
  lastWorkoutAt?: string;
  weekStreak: number;
  longTermGoals: number;
};

// Cette méthode permet de résumer le compte : unités, ancienneté, objectifs, nombre de séances et série de semaines.
export function profileView(
  profile: Pick<ProfileRow, 'display_name' | 'settings'>,
  workouts: WorkoutRow[],
  prefs: ExercisePrefsDoc[],
  ctx: ViewCtx,
): Rendered<ProfileView> {
  const s = profile.settings;
  const done = sortWorkouts(workouts.filter((w) => w.status === 'completed'));
  const data: ProfileView = {
    name: profile.display_name,
    units: ctx.units,
    defaultRestS: s.defaultRestS ?? null,
    ...(s.trainingAge ? { trainingAge: TRAINING_AGE_LABELS[s.trainingAge.bucket] } : {}),
    progressionTargetsEnabled: s.progressionEnabled !== false,
    workoutCount: done.length,
    ...(done[0] ? { firstWorkoutAt: formatInstant(done[0].started_at, ctx.tz) } : {}),
    ...(done.length ? { lastWorkoutAt: formatInstant(done[done.length - 1]!.started_at, ctx.tz) } : {}),
    weekStreak: weekStreak(framed(done, ctx.tz), toLocalFrame(ctx.now, ctx.tz)),
    longTermGoals: prefs.filter((p) => p.longTermGoal).length,
  };
  const text = [
    `${data.name} : ${data.workoutCount} séance${data.workoutCount > 1 ? 's' : ''} enregistrée${data.workoutCount > 1 ? 's' : ''}` +
      (data.lastWorkoutAt ? `, la dernière le ${data.lastWorkoutAt.slice(0, 10)}` : '') +
      '.',
    `Série en cours : ${data.weekStreak} semaine${data.weekStreak > 1 ? 's' : ''} d'affilée avec au moins une séance.`,
    `Unités : ${ctx.units.weight}, ${ctx.units.length}, ${ctx.units.distance}. Repos par défaut : ${data.defaultRestS ?? 'aucun'} s.`,
    `Objectifs de séance ${data.progressionTargetsEnabled ? 'activés' : 'désactivés'} ; ${data.longTermGoals} objectif(s) à long terme.`,
    ...(data.trainingAge ? [`Ancienneté déclarée : ${data.trainingAge}.`] : []),
  ].join('\n');
  return { data, text };
}

// ---------- Séances ----------

export type WorkoutListItem = {
  id: string;
  startedAt: string;
  title: string;
  durationS: number;
  volume: Weight;
  setCount: number;
  recordCount: number;
  targets: { met: number; total: number };
  routineId: string | null;
  exercises: { name: string; sets: number }[];
};

// Cette méthode permet de résumer une séance terminée pour une liste (date, durée, volume, records, objectifs atteints).
export function workoutListItem(
  w: WorkoutRow,
  badges: WorkoutBadges | undefined,
  ctx: ViewCtx,
): WorkoutListItem {
  const sum = workoutSummary(w, badges, ctx.now);
  return {
    id: w.id,
    startedAt: formatInstant(w.started_at, ctx.tz),
    title: w.doc.title || 'Séance',
    durationS: sum.durationS,
    volume: kgOut(sum.volumeKg, ctx.units.weight),
    setCount: sum.setCount,
    recordCount: sum.recordCount,
    targets: sum.targets,
    routineId: w.routine_id,
    exercises: w.doc.exercises.map((e) => ({
      name: exerciseName(ctx, e.exerciseId),
      sets: e.sets.filter((s) => s.done).length,
    })),
  };
}

// Cette méthode permet d'écrire une ligne de liste de séances (« 2026-10-21 · Push · 1 h 05 · 8 450 kg · 2 🏆 »).
export function workoutListLine(item: WorkoutListItem, units: Units): string {
  const parts = [
    item.startedAt.slice(0, 10),
    item.title,
    formatDurationHuman(item.durationS),
    formatWeight(item.volume, units.weight),
    `${item.setCount} séries`,
  ];
  if (item.recordCount) parts.push(`${item.recordCount} record${item.recordCount > 1 ? 's' : ''}`);
  if (item.targets.total) parts.push(`objectifs ${item.targets.met}/${item.targets.total}`);
  return `${parts.join(' · ')} [${item.id}]\n  ${item.exercises.map((e) => `${e.name} ×${e.sets}`).join(', ')}`;
}

export type SetView = {
  kind: WorkoutSet['kind'];
  weight?: Weight;
  reps?: number;
  durationS?: number;
  distance?: WorkoutSet['distance'];
  done: boolean;
  rpe?: number;
  target?: WorkoutSet['target'];
  records?: string[];
};

export type WorkoutDetail = Omit<WorkoutListItem, 'exercises'> & {
  status: WorkoutRow['status'];
  note?: string;
  exercises: {
    exerciseId: string;
    name: string;
    measurementType: ExerciseRow['measurement_type'];
    note?: string;
    restS: number | null;
    repRange?: { min: number; max: number };
    sets: SetView[];
    records?: string[];
  }[];
};

// Cette méthode permet de détailler une séance : exercices, séries (type, valeurs, validée, objectif) et badges de record.
export function workoutDetail(
  w: WorkoutRow,
  badges: WorkoutBadges | undefined,
  ctx: ViewCtx,
): Rendered<WorkoutDetail> {
  const item = workoutListItem(w, badges, ctx);
  const labels = (list: RecordCriterion[] | undefined, type: ExerciseRow['measurement_type']) =>
    list?.length ? list.map((c) => criterionLabel(c, type)) : undefined;
  const data: WorkoutDetail = {
    ...item,
    status: w.status,
    ...(w.doc.note ? { note: w.doc.note } : {}),
    exercises: w.doc.exercises.map((e) => {
      const entryRecords = labels(badges?.entries[e.id], e.measurementType);
      return {
        exerciseId: e.exerciseId,
        name: exerciseName(ctx, e.exerciseId),
        measurementType: e.measurementType,
        ...(e.note ? { note: e.note } : {}),
        restS: e.restS,
        ...(e.repRange ? { repRange: e.repRange } : {}),
        sets: e.sets.map((s) => {
          const rec = labels(badges?.sets[s.id], e.measurementType);
          return {
            kind: s.kind,
            ...(s.weight ? { weight: s.weight } : {}),
            ...(s.reps !== undefined ? { reps: s.reps } : {}),
            ...(s.durationS !== undefined ? { durationS: s.durationS } : {}),
            ...(s.distance ? { distance: s.distance } : {}),
            done: s.done,
            ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
            ...(s.target ? { target: s.target } : {}),
            ...(rec ? { records: rec } : {}),
          };
        }),
        ...(entryRecords ? { records: entryRecords } : {}),
      };
    }),
  };
  const lines = [workoutListLine(item, ctx.units).split('\n')[0]!];
  if (w.status === 'in_progress') lines.push('Séance en cours sur un appareil.');
  if (data.note) lines.push(`Note : ${data.note}`);
  for (const [i, e] of w.doc.exercises.entries()) {
    const ex = data.exercises[i]!;
    lines.push(`\n${ex.name}${ex.repRange ? ` (fourchette ${ex.repRange.min}–${ex.repRange.max})` : ''}`);
    if (ex.note) lines.push(`  Note : ${ex.note}`);
    for (const [j, s] of e.sets.entries()) {
      const sv = ex.sets[j]!;
      const kind = s.kind === 'normal' ? '' : ` (${SET_KIND_LABELS[s.kind].toLowerCase()})`;
      const target = s.target ? ` — objectif ${formatSetValues(s.target, e.measurementType, ctx.units)}` : '';
      const rec = sv.records ? ` 🏆 ${sv.records.join(', ')}` : '';
      const rpe = s.rpe !== undefined ? ` @ RPE ${formatRpe(s.rpe)}` : '';
      lines.push(
        `  ${j + 1}. ${formatSetValues(s, e.measurementType, ctx.units)}${rpe}${kind}${s.done ? '' : ' (non validée)'}${target}${rec}`,
      );
    }
    if (ex.records) lines.push(`  🏆 ${ex.records.join(', ')}`);
  }
  return { data, text: lines.join('\n') };
}

// ---------- Historique d'un exercice ----------

export type ExerciseHistory = {
  exercise: { id: string; name: string; measurementType: ExerciseRow['measurement_type'] };
  sessions: {
    workoutId: string;
    startedAt: string;
    title: string;
    sets: SetView[];
    bestE1rm?: Weight;
    volume: Weight;
  }[];
  lastTime?: string;
};

// Cette méthode permet de lister, séance par séance (récentes d'abord), les séries d'un exercice hors échauffement,
// avec le meilleur 1RM estimé (Epley, 12 reps au plus, séries de travail) et le volume.
export function exerciseHistory(
  exercise: ExerciseRow,
  workouts: WorkoutRow[],
  range: { from: number; to: number },
  ctx: ViewCtx,
): Rendered<ExerciseHistory> {
  const type = exercise.measurement_type;
  const list = sortWorkouts(workouts.filter((w) => w.status === 'completed'))
    .filter((w) => w.started_at >= range.from && w.started_at < range.to)
    .reverse();
  const sessions: ExerciseHistory['sessions'] = [];
  const lines: string[] = [];
  for (const w of list) {
    const entries = w.doc.exercises.filter((e) => e.exerciseId === exercise.id);
    if (!entries.length) continue;
    const sets = entries.flatMap((e) => e.sets.filter((s) => s.done && s.kind !== 'warmup'));
    let best: number | undefined;
    if (type === 'weight_reps')
      for (const s of sets)
        if (isWorkingKind(s.kind) && s.weight && s.reps !== undefined) {
          const v = e1rm(toKg(s.weight), s.reps);
          if (v !== undefined && (best === undefined || v > best)) best = v;
        }
    const volKg = entries.reduce((sum, e) => sum + exerciseVolumeKg(e), 0);
    const session = {
      workoutId: w.id,
      startedAt: formatInstant(w.started_at, ctx.tz),
      title: w.doc.title || 'Séance',
      sets: sets.map((s) => ({
        kind: s.kind,
        ...(s.weight ? { weight: s.weight } : {}),
        ...(s.reps !== undefined ? { reps: s.reps } : {}),
        ...(s.durationS !== undefined ? { durationS: s.durationS } : {}),
        ...(s.distance ? { distance: s.distance } : {}),
        done: true,
        ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
      })),
      ...(best !== undefined ? { bestE1rm: kgOut(best, ctx.units.weight) } : {}),
      volume: kgOut(volKg, ctx.units.weight),
    };
    sessions.push(session);
    const setsText = sets
      .map(
        (s) =>
          formatSetValues(s, type, ctx.units) +
          (s.rpe !== undefined ? ` @ RPE ${formatRpe(s.rpe)}` : '') +
          (s.kind === 'normal' ? '' : ` (${SET_KIND_LABELS[s.kind]})`),
      )
      .join(' ; ');
    lines.push(
      `${session.startedAt.slice(0, 10)} · ${session.title} : ${setsText || 'aucune série validée'}` +
        (best !== undefined ? ` · 1RM est. ${formatKg(best, ctx.units.weight)}` : '') +
        (volKg > 0 ? ` · volume ${formatKg(volKg, ctx.units.weight, 0)}` : ''),
    );
  }
  const data: ExerciseHistory = {
    exercise: { id: exercise.id, name: exercise.name, measurementType: type },
    sessions,
    ...(sessions[0] ? { lastTime: sessions[0].startedAt } : {}),
  };
  const head = sessions.length
    ? `${exercise.name} : ${sessions.length} séance${sessions.length > 1 ? 's' : ''} sur la période (récentes d'abord).`
    : `${exercise.name} : aucune séance sur la période.`;
  return { data, text: [head, ...lines].join('\n') };
}

// ---------- Records ----------

export type RecordView = {
  exercise: string;
  exerciseId: string;
  criterion: RecordCriterion;
  label: string;
  value: string;
  canonical: { value: number; unit: string };
  workoutId: string;
  at: string;
};

// Cette méthode permet de décrire un record (critère, valeur dans les unités de l'utilisateur, séance et date).
function recordView(
  exercise: ExerciseRow | undefined,
  exerciseId: string,
  criterion: RecordCriterion,
  rv: { value: number; workoutId: string; startedAt: number },
  ctx: ViewCtx,
): RecordView {
  const type = exercise?.measurement_type ?? 'weight_reps';
  const unit = criteriaFor(type).find((c) => c.id === criterion)?.unit ?? 'kg';
  return {
    exercise: exercise?.name ?? 'Exercice supprimé',
    exerciseId,
    criterion,
    label: criterionLabel(criterion, type),
    value: formatCanonical(rv.value, unit, ctx.units),
    canonical: { value: r1(rv.value * 100) / 100, unit },
    workoutId: rv.workoutId,
    at: formatInstant(rv.startedAt, ctx.tz),
  };
}

// Cette méthode permet de lister les meilleurs résultats d'un exercice, par critère suivi pour son type de mesure (§F7.6).
export function exerciseRecords(
  exercise: ExerciseRow,
  workouts: WorkoutRow[],
  ctx: ViewCtx,
): Rendered<RecordView[]> {
  const done = workouts.filter((w) => w.status === 'completed');
  const bests = bestRecords(exercise.id, done);
  const data = criteriaFor(exercise.measurement_type)
    .filter((c) => bests[c.id])
    .map((c) => recordView(exercise, exercise.id, c.id, bests[c.id]!, ctx));
  const text = data.length
    ? [
        `Records de ${exercise.name} :`,
        ...data.map((r) => `- ${r.label} : ${r.value} (${r.at.slice(0, 10)})`),
      ].join('\n')
    : `${exercise.name} : aucun record (aucune série validée).`;
  return { data, text };
}

// Cette méthode permet de lister les records battus récemment, tous exercices confondus.
export function latestRecords(workouts: WorkoutRow[], ctx: ViewCtx, limit = 20): Rendered<RecordView[]> {
  const events: RecordEvent[] = recentRecords(
    workouts.filter((w) => w.status === 'completed'),
    limit,
  );
  const data = events.map((e) =>
    recordView(ctx.exercises.get(e.exerciseId), e.exerciseId, e.criterion, e, ctx),
  );
  const text = data.length
    ? [
        'Records récents :',
        ...data.map((r) => `- ${r.at.slice(0, 10)} · ${r.exercise} · ${r.label} : ${r.value}`),
      ].join('\n')
    : 'Aucun record battu pour le moment.';
  return { data, text };
}

// ---------- Progression ----------

export type ProgressionView =
  | { available: false; reason: string; weeksWithData: number }
  | {
      available: true;
      status: 'up' | 'flat';
      currentE1rm: Weight;
      ratePerMonth: Weight;
      projection4w: Weight;
      projection12w: Weight;
      weeksWithData: number;
      recentWeeks: { weekStart: string; bestE1rm: Weight }[];
      goal?: {
        weight: Weight;
        reps: number;
        setAt: string;
        targetE1rm?: Weight;
        estimatedDate: string | null;
        achievedIn?: string;
      };
    };

// Cette méthode permet de calculer la tendance du 1RM estimé d'un exercice, sa projection à 4 et 12 semaines et la date
// estimée d'atteinte de l'objectif à long terme, avec les mêmes règles que la fiche exercice (§F7.10).
export function progressionView(
  exercise: ExerciseRow,
  workouts: WorkoutRow[],
  prefs: ExercisePrefsDoc | undefined,
  settings: Pick<Settings, 'trainingAge'>,
  ctx: ViewCtx,
): Rendered<ProgressionView> {
  const { tz, units } = ctx;
  if (exercise.measurement_type !== 'weight_reps') {
    const data = {
      available: false as const,
      reason: "La tendance du 1RM estimé n'existe que pour les exercices en poids et répétitions.",
      weeksWithData: 0,
    };
    return { data, text: `${exercise.name} : ${data.reason}` };
  }
  const local = framed(workouts, tz);
  const now = toLocalFrame(ctx.now, tz);
  const points = weeklyE1rmPoints(exercise.id, local);
  const first = firstSessionAt(exercise.id, local);
  const localSettings = settings.trainingAge
    ? {
        trainingAge: {
          ...settings.trainingAge,
          declaredAt: toLocalFrame(settings.trainingAge.declaredAt, tz),
        },
      }
    : {};
  const trend = first !== undefined ? fitTrend(points, trainingOrigin(localSettings, first), now) : undefined;
  if (!trend) {
    const span = points.length
      ? Math.round((points.at(-1)!.weekStart - points[0]!.weekStart) / WEEK_MS) + 1
      : 0;
    const reason =
      `Pas assez de données : il faut au moins ${TREND_MIN_POINTS} semaines avec une série de travail validée ` +
      `(12 reps au plus), étalées sur ${TREND_MIN_SPAN_WEEKS} semaines ou plus ` +
      `(actuellement ${points.length} semaine(s) sur ${span}).`;
    return {
      data: { available: false, reason, weeksWithData: points.length },
      text: `${exercise.name} : ${reason}`,
    };
  }
  const goal = prefs?.longTermGoal;
  const goalAt = goal ? goalDate(trend, { ...goal, setAt: toLocalFrame(goal.setAt, tz) }, now) : undefined;
  const achieved = goal ? goalAchievedSet(exercise.id, workouts, goal) : undefined;
  const targetKg = goal ? e1rm(toKg(goal.weight), goal.reps) : undefined;
  const current = modelValue(trend, now);
  const data: ProgressionView = {
    available: true,
    status: trend.status,
    currentE1rm: kgOut(current, units.weight),
    ratePerMonth: kgOut(currentRate(trend, now), units.weight),
    projection4w: kgOut(
      trend.status === 'up' ? project(trend, now + 4 * WEEK_MS, now) : current,
      units.weight,
    ),
    projection12w: kgOut(
      trend.status === 'up' ? project(trend, now + 12 * WEEK_MS, now) : current,
      units.weight,
    ),
    weeksWithData: points.length,
    recentWeeks: points.slice(-8).map((p) => ({
      weekStart: dayKey(p.weekStart),
      bestE1rm: kgOut(p.e1rmKg, units.weight),
    })),
    ...(goal
      ? {
          goal: {
            weight: goal.weight,
            reps: goal.reps,
            setAt: formatInstant(goal.setAt, tz),
            ...(targetKg !== undefined ? { targetE1rm: kgOut(targetKg, units.weight) } : {}),
            estimatedDate: goalAt !== undefined ? zonedDayKey(fromLocalFrame(goalAt, tz), tz) : null,
            ...(achieved ? { achievedIn: achieved.workoutId } : {}),
          },
        }
      : {}),
  };
  const w = (x: Weight) => formatWeight(x, units.weight);
  const lines = [
    `${exercise.name} : 1RM estimé actuel ${w(data.currentE1rm)} (tendance sur ${points.length} semaines).`,
    trend.status === 'up'
      ? `Rythme actuel : +${w(data.ratePerMonth)} par mois. Projection : ${w(data.projection4w)} dans 4 semaines, ${w(data.projection12w)} dans 12 semaines.`
      : 'Tendance plate : pas de progression mesurable en ce moment.',
  ];
  if (data.goal) {
    const g = data.goal;
    lines.push(
      `Objectif : ${formatWeight(g.weight, units.weight)} × ${g.reps}` +
        (g.achievedIn
          ? ' — atteint.'
          : g.estimatedDate
            ? ` — atteinte estimée vers le ${g.estimatedDate}.`
            : " — pas d'atteinte prévisible sous un an au rythme actuel."),
    );
  }
  return { data, text: lines.join('\n') };
}

// ---------- Statistiques ----------

export type StatsView = {
  from: string;
  to: string;
  totals: { workouts: number; durationS: number; volume: Weight; sets: number };
  weeks: { weekStart: string; workouts: number; durationS: number; volume: Weight }[];
  muscles: { muscle: Muscle; label: string; sets: number }[];
  trainingDays: string[];
};

// Cette méthode permet de calculer les statistiques d'une période dans un fuseau : séances, durée, volume et séries par
// semaine (lundi-dimanche), répartition des séries par muscle (1 principal, 0,5 secondaire) et jours d'entraînement.
export function statsView(
  workouts: WorkoutRow[],
  range: { from: number; to: number },
  ctx: ViewCtx,
): Rendered<StatsView> {
  const { tz, units } = ctx;
  const inRange = workouts.filter(
    (w) =>
      w.status === 'completed' &&
      w.deleted_at === null &&
      w.started_at >= range.from &&
      w.started_at < range.to,
  );
  const local = framed(inRange, tz);
  const fromL = toLocalFrame(range.from, tz);
  const toL = toLocalFrame(range.to - 1, tz);
  const nWeeks = Math.min(104, weeksBetween(weekStart(fromL), weekStart(toL)) + 1);
  const weeks = weeklyAggregates(local, toL, nWeeks).map((a) => ({
    weekStart: dayKey(a.weekStart),
    workouts: a.count,
    durationS: a.durationS,
    volume: kgOut(a.volumeKg, units.weight),
  }));
  const info = (id: string) => ctx.exercises.get(id);
  const dist = muscleDistribution(local, info, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
  const muscles = (Object.entries(dist) as [Muscle, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, sets]) => ({ muscle, label: MUSCLE_LABELS[muscle], sets: r1(sets) }));
  const totalsKg = inRange.reduce((s, w) => s + workoutSummary(w, undefined, ctx.now).volumeKg, 0);
  const data: StatsView = {
    from: formatInstant(range.from, tz),
    to: formatInstant(range.to, tz),
    totals: {
      workouts: inRange.length,
      durationS: inRange.reduce((s, w) => s + workoutSummary(w, undefined, w.started_at).durationS, 0),
      volume: kgOut(totalsKg, units.weight),
      sets: inRange.reduce(
        (n, w) =>
          n +
          doneSetCount(w.doc) -
          w.doc.exercises.reduce((k, e) => k + e.sets.filter((s) => s.done && s.kind === 'warmup').length, 0),
        0,
      ),
    },
    weeks,
    muscles,
    trainingDays: [...trainingDays(local)].sort(),
  };
  const t = data.totals;
  const lines = [
    `Du ${data.from.slice(0, 10)} au ${zonedDayKey(range.to - 1, tz)} : ${t.workouts} séance(s), ${formatDurationHuman(t.durationS)}, ` +
      `${formatWeight(t.volume, units.weight)} de volume, ${t.sets} séries (hors échauffement).`,
    'Par semaine :',
    ...weeks.map(
      (w) =>
        `- ${w.weekStart} : ${w.workouts} séance(s), ${formatDurationHuman(w.durationS)}, ${formatWeight(w.volume, units.weight)}`,
    ),
    'Séries par muscle :',
    ...(muscles.length ? muscles.map((m) => `- ${m.label} : ${m.sets}`) : ['- aucune']),
  ];
  return { data, text: lines.join('\n') };
}

// ---------- Routines ----------

export type RoutineView = {
  id: string;
  name: string;
  folder: string | null;
  note?: string;
  exercises: {
    exerciseId: string;
    name: string;
    sets: {
      kind: WorkoutSet['kind'];
      weight?: Weight;
      durationS?: number;
      distance?: WorkoutSet['distance'];
    }[];
    repRange?: { min: number; max: number };
    restS: number | null;
    note?: string;
  }[];
};

// Cette méthode permet de décrire une routine : exercices, séries prévues, fourchettes et repos.
export function routineView(r: RoutineRow, folders: FolderRow[], ctx: ViewCtx): RoutineView {
  return {
    id: r.id,
    name: r.doc.name,
    folder: folders.find((f) => f.id === r.folder_id && f.deleted_at === null)?.name ?? null,
    ...(r.doc.note ? { note: r.doc.note } : {}),
    exercises: r.doc.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: exerciseName(ctx, e.exerciseId),
      sets: e.sets.map((s) => ({
        kind: s.kind,
        ...(s.weight ? { weight: s.weight } : {}),
        ...(s.durationS !== undefined ? { durationS: s.durationS } : {}),
        ...(s.distance ? { distance: s.distance } : {}),
      })),
      ...(e.repRange ? { repRange: e.repRange } : {}),
      restS: e.restS,
      ...(e.note ? { note: e.note } : {}),
    })),
  };
}

// Cette méthode permet d'écrire une routine en quelques lignes (« Squat (barre) : 3 séries, 8–12, repos 120 s »).
export function routineText(v: RoutineView, ctx: ViewCtx): string {
  const lines = [`${v.name}${v.folder ? ` (dossier ${v.folder})` : ''} [${v.id}]`];
  if (v.note) lines.push(`  Note : ${v.note}`);
  for (const e of v.exercises) {
    const loads = e.sets.filter((s) => s.weight).map((s) => formatWeight(s.weight!, ctx.units.weight));
    lines.push(
      `  - ${e.name} : ${e.sets.length} série${e.sets.length > 1 ? 's' : ''}` +
        (e.repRange ? `, ${e.repRange.min}–${e.repRange.max} reps` : '') +
        (loads.length ? `, ${loads.join(' / ')}` : '') +
        `, repos ${e.restS === null ? 'aucun' : `${e.restS} s`}`,
    );
  }
  return lines.join('\n');
}

// ---------- Mesures ----------

export type MeasurementView = { id: string; date: string; values: BodyMeasurementRow['values'] };

// Cette méthode permet de lister les mesures corporelles d'une période (récentes d'abord), éventuellement limitées à
// certaines clés.
export function measurementsView(
  rows: BodyMeasurementRow[],
  filter: { from?: string; to?: string; keys?: BodyMeasurementKey[] },
  units: Units,
): Rendered<MeasurementView[]> {
  const data = rows
    .filter(
      (r) =>
        r.deleted_at === null &&
        (!filter.from || r.measured_on >= filter.from) &&
        (!filter.to || r.measured_on <= filter.to),
    )
    .map((r) => {
      const values: BodyMeasurementRow['values'] = {};
      for (const [k, v] of Object.entries(r.values) as [BodyMeasurementKey, never][])
        if (!filter.keys || filter.keys.includes(k)) values[k] = v;
      return { id: r.id, date: r.measured_on, values };
    })
    .filter((m) => Object.keys(m.values).length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const fmt = (k: string, v: unknown) => {
    if (k === 'body_fat') return `masse grasse ${v} %`;
    const x = v as { v: number; u: string };
    if (k === 'weight') return `poids ${formatWeight(x as Weight, units.weight)}`;
    return `${k} ${x.v} ${x.u}`;
  };
  const text = data.length
    ? data
        .map(
          (m) =>
            `${m.date} : ${Object.entries(m.values)
              .map(([k, v]) => fmt(k, v))
              .join(', ')}`,
        )
        .join('\n')
    : 'Aucune mesure sur la période.';
  return { data, text };
}
