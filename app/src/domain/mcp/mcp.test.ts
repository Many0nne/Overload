import { describe, expect, it } from 'vitest';
import { mcpDeviceId } from '../ids';
import { DAY, entry, set, sets, settings, T0, workout } from '../testFixtures';
import type { ExerciseRow, RoutineExercise } from '../types';
import { resolveExercise, searchExercises } from './exercises';
import {
  buildRoutineExercise,
  buildWorkoutExercise,
  checkRepRange,
  matchPrevious,
  mergeMeasurement,
  toMeasurementValues,
} from './inputs';
import { formatInstant, fromLocalFrame, parseInstant, toLocalFrame, zonedDayKey } from './tz';
import { exerciseHistory, progressionView, statsView, type ViewCtx, workoutDetail } from './views';
import { defaultTitleTz, nextPosition, stamp } from './writes';

// Cette méthode permet de fabriquer un exercice de test (catalogue par défaut).
function ex(id: string, name: string, over: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id,
    user_id: null,
    name,
    name_search: '',
    equipment: 'barbell',
    primary_muscle: 'quads',
    secondary_muscles: ['glutes'],
    measurement_type: 'weight_reps',
    instructions: null,
    source_id: null,
    archived_at: null,
    client_updated_at: 0,
    client_device_id: 'd',
    deleted_at: null,
    ...over,
  };
}

const SQUAT = ex('00000000-0000-4000-8000-000000000001', 'Squat (barre)');
const FRONT = ex('00000000-0000-4000-8000-000000000002', 'Squat avant (barre)');
const BENCH = ex('00000000-0000-4000-8000-000000000003', 'Développé couché (barre)', {
  primary_muscle: 'chest',
  secondary_muscles: ['triceps', 'shoulders'],
});
const PLANK = ex('00000000-0000-4000-8000-000000000004', 'Planche', {
  equipment: 'bodyweight',
  primary_muscle: 'abs',
  secondary_muscles: [],
  measurement_type: 'duration',
});
const OLD = ex('00000000-0000-4000-8000-000000000005', 'Hack squat', { archived_at: 1 });
const ALL = [SQUAT, FRONT, BENCH, PLANK, OLD];
const UNITS = settings().units;

let n = 0;
const newId = () => `id-${++n}`;

describe('fuseau horaire', () => {
  it('lit une date sans décalage comme heure murale du fuseau, avec décalage tel quel', () => {
    expect(parseInstant('2026-10-22T18:00', 'Europe/Paris')).toBe(Date.UTC(2026, 9, 22, 16, 0));
    expect(parseInstant('2026-12-22', 'Europe/Paris')).toBe(Date.UTC(2026, 11, 21, 23, 0));
    expect(parseInstant('2026-10-22T18:00:00Z', 'Europe/Paris')).toBe(Date.UTC(2026, 9, 22, 18, 0));
    expect(parseInstant('2026-02-30', 'Europe/Paris')).toBeUndefined();
    expect(parseInstant('hier', 'Europe/Paris')).toBeUndefined();
  });

  it('affiche un instant avec le décalage du fuseau et donne son jour', () => {
    const ms = Date.UTC(2026, 9, 22, 22, 30);
    expect(formatInstant(ms, 'Europe/Paris')).toBe('2026-10-23T00:30:00+02:00');
    expect(zonedDayKey(ms, 'Europe/Paris')).toBe('2026-10-23');
    expect(zonedDayKey(ms, 'America/New_York')).toBe('2026-10-22');
  });

  it('projette dans le temps local du moteur et revient sans perte', () => {
    const ms = Date.UTC(2026, 2, 29, 0, 30);
    const local = toLocalFrame(ms, 'Europe/Paris');
    expect(new Date(local).getHours()).toBe(1);
    expect(fromLocalFrame(local, 'Europe/Paris')).toBe(ms);
  });
});

describe('résolution des exercices', () => {
  it('trouve par id, par nom exact (sans accents) ou par mots uniques', () => {
    expect(resolveExercise(SQUAT.id, ALL)).toMatchObject({ ok: true, exercise: SQUAT });
    expect(resolveExercise('developpe couche (BARRE)', ALL)).toMatchObject({ ok: true, exercise: BENCH });
    expect(resolveExercise('couché', ALL)).toMatchObject({ ok: true, exercise: BENCH });
  });

  it('préfère le nom exact à une correspondance partielle', () => {
    expect(resolveExercise('Squat (barre)', ALL)).toMatchObject({ ok: true, exercise: SQUAT });
  });

  it("liste les candidats d'un nom ambigu et ne propose pas les archivés", () => {
    const r = resolveExercise('squat', ALL);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.candidates.map((c) => c.id).sort()).toEqual([SQUAT.id, FRONT.id].sort());
    expect(r.message).toContain('Précise');
  });

  it('propose les noms proches pour un exercice inconnu', () => {
    const r = resolveExercise('développé incliné barre', ALL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.candidates[0]?.id).toBe(BENCH.id);
  });

  it('préfère un exercice perso au catalogue du même nom', () => {
    const mine = ex('00000000-0000-4000-8000-000000000009', 'Squat (barre)', { user_id: 'u1' });
    expect(resolveExercise('Squat (barre)', [...ALL, mine])).toMatchObject({ ok: true, exercise: mine });
  });

  it('filtre la recherche par muscle et matériel', () => {
    expect(searchExercises(ALL, { muscle: 'triceps' }).map((e) => e.id)).toEqual([BENCH.id]);
    expect(searchExercises(ALL, { query: 'squat', equipment: 'barbell' }).map((e) => e.id)).toEqual([
      SQUAT.id,
      FRONT.id,
    ]);
  });
});

describe('entrées des outils', () => {
  it('construit des séries validées dans l’unité de l’utilisateur', () => {
    const r = buildWorkoutExercise(
      SQUAT,
      {
        sets: [
          { weight: 100, reps: 5 },
          { kind: 'warmup', weight: { v: 135, u: 'lb' }, reps: 8 },
        ],
      },
      { units: UNITS, defaultRestS: 90, newId },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sets[0]).toMatchObject({
      weight: { v: 100, u: 'kg' },
      reps: 5,
      done: true,
      kind: 'normal',
    });
    expect(r.value.sets[1]).toMatchObject({ weight: { v: 135, u: 'lb' }, kind: 'warmup' });
    expect(r.value.restS).toBe(90);
  });

  it('garde un RPE valide (arrondi au demi-point) et ignore un RPE hors échelle', () => {
    const r = buildWorkoutExercise(
      SQUAT,
      {
        sets: [
          { weight: 100, reps: 5, rpe: 8.4 },
          { weight: 100, reps: 5, rpe: 4 },
        ],
      },
      { units: UNITS, defaultRestS: 90, newId },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sets[0]!.rpe).toBe(8.5);
    expect(r.value.sets[1]).not.toHaveProperty('rpe');
  });

  it('refuse une série incomplète pour le type de mesure et ignore les champs hors sujet', () => {
    const missing = buildWorkoutExercise(
      SQUAT,
      { sets: [{ weight: 100 }] },
      { units: UNITS, defaultRestS: 90, newId },
    );
    expect(missing).toMatchObject({ ok: false });
    if (!missing.ok) expect(missing.message).toContain('reps');
    const plank = buildWorkoutExercise(
      PLANK,
      { sets: [{ durationS: 60, reps: 3 }] },
      { units: UNITS, defaultRestS: 90, newId },
    );
    expect(plank.ok && plank.value.sets[0]).toMatchObject({ durationS: 60 });
    expect(plank.ok && plank.value.sets[0]?.reps).toBeUndefined();
  });

  it('garde les ids et objectifs d’une entrée existante', () => {
    const prev = entry(SQUAT.id, sets(100, [5]));
    prev.sets[0]!.target = { weight: { v: 100, u: 'kg' }, reps: 5 };
    const r = buildWorkoutExercise(
      SQUAT,
      { sets: [{ weight: 102.5, reps: 5 }] },
      { units: UNITS, defaultRestS: 90, newId, previous: prev },
    );
    expect(r.ok && r.value.id).toBe(prev.id);
    expect(r.ok && r.value.sets[0]).toMatchObject({ id: prev.sets[0]!.id, target: { reps: 5 } });
  });

  it('construit un exercice de routine : nombre de séries, fourchette, repos par défaut', () => {
    const r = buildRoutineExercise(
      SQUAT,
      { sets: 3, repRange: { min: 8, max: 12 } },
      { units: UNITS, defaultRestS: 120, newId },
    );
    expect(r.ok && r.value).toMatchObject({ restS: 120, repRange: { min: 8, max: 12 } });
    expect(r.ok && r.value.sets).toHaveLength(3);
    expect(checkRepRange(PLANK, { min: 8, max: 12 })).toMatchObject({ ok: false });
    expect(checkRepRange(SQUAT, { min: 12, max: 8 })).toMatchObject({ ok: false });
  });

  it('réutilise chaque entrée existante une seule fois, dans l’ordre', () => {
    const prev = [
      { exerciseId: 'a', id: '1' },
      { exerciseId: 'b', id: '2' },
      { exerciseId: 'a', id: '3' },
    ];
    expect(matchPrevious(prev, ['a', 'a', 'c']).map((p) => p?.id)).toEqual(['1', '3', undefined]);
    const r: RoutineExercise[] = [];
    expect(matchPrevious(r, ['a'])).toEqual([undefined]);
  });

  it('convertit et complète les mesures sans écraser, sauf demande', () => {
    const v = toMeasurementValues({ weight: 81.4, waist: 84, body_fat: 15 }, UNITS);
    expect(v).toMatchObject({
      ok: true,
      value: { weight: { v: 81.4, u: 'kg' }, waist: { v: 84, u: 'cm' }, body_fat: 15 },
    });
    expect(toMeasurementValues({ body_fat: 120 }, UNITS)).toMatchObject({ ok: false });
    const existing = { weight: { v: 80, u: 'kg' as const } };
    const incoming = { weight: { v: 81, u: 'kg' as const }, body_fat: 14 };
    expect(mergeMeasurement(existing, incoming, false)).toEqual({
      values: { weight: { v: 80, u: 'kg' }, body_fat: 14 },
      ignored: ['weight'],
    });
    expect(mergeMeasurement(existing, incoming, true).values.weight).toEqual({ v: 81, u: 'kg' });
  });
});

describe('écritures', () => {
  it('horodate en dernier gagne et retire rev', () => {
    const row = stamp({ id: 'x', rev: 7 }, { client_updated_at: 5000 }, 'dev', 1000);
    expect(row).toEqual({ id: 'x', client_updated_at: 5001, client_device_id: 'dev' });
    expect(stamp({ id: 'x' }, undefined, 'dev', 1000).client_updated_at).toBe(1000);
  });

  it('place en fin de liste et donne un appareil virtuel stable par connexion', () => {
    expect(
      nextPosition([
        { position: 3, deleted_at: null },
        { position: 9, deleted_at: 1 },
      ]),
    ).toBe(4);
    expect(mcpDeviceId('u1', 'c1')).toBe(mcpDeviceId('u1', 'c1'));
    expect(mcpDeviceId('u1', 'c1')).not.toBe(mcpDeviceId('u1', 'c2'));
    expect(defaultTitleTz('Push', Date.UTC(2026, 9, 20, 23, 30), 'Europe/Paris')).toBe('Push – mercredi');
  });
});

describe('vues', () => {
  const ctx = (now: number): ViewCtx => ({
    units: UNITS,
    tz: 'Europe/Paris',
    now,
    exercises: new Map(ALL.map((e) => [e.id, e])),
  });

  it('détaille une séance avec ses records', () => {
    const w1 = workout(T0, [entry(SQUAT.id, sets(100, [5]))]);
    const w2 = workout(T0 + 7 * DAY, [
      entry(SQUAT.id, [set({ kg: 105, reps: 5 }), set({ kg: 60, reps: 10, kind: 'warmup' })]),
    ]);
    const { data, text } = workoutDetail(
      w2,
      {
        sets: { [w2.doc.exercises[0]!.sets[0]!.id]: ['max_weight'] },
        entries: {},
        pairs: [{ exerciseId: SQUAT.id, criterion: 'max_weight' }],
      },
      ctx(T0 + 8 * DAY),
    );
    expect(data.recordCount).toBe(1);
    expect(data.volume).toEqual({ v: 525, u: 'kg' });
    expect(data.exercises[0]?.sets[0]?.records).toEqual(['Charge max']);
    expect(text).toContain('Squat (barre)');
    expect(text).toContain('(échauffement)');
    expect(w1.id).not.toBe(w2.id);
  });

  it("donne l'historique d'un exercice, récent d'abord, avec le 1RM estimé", () => {
    const ws = [
      workout(T0, [entry(SQUAT.id, sets(100, [5]))]),
      workout(T0 + 7 * DAY, [entry(SQUAT.id, sets(110, [3]))]),
    ];
    const { data } = exerciseHistory(SQUAT, ws, { from: 0, to: T0 + 30 * DAY }, ctx(T0 + 30 * DAY));
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0]?.bestE1rm?.v).toBeCloseTo(121, 1);
    expect(data.lastTime).toBe(data.sessions[0]?.startedAt);
  });

  it('dit « pas assez de données » avant 6 semaines, puis calcule la tendance', () => {
    const few = [workout(T0, [entry(SQUAT.id, sets(100, [5]))])];
    const p = progressionView(SQUAT, few, undefined, settings(), ctx(T0 + DAY));
    expect(p.data.available).toBe(false);
    const many = Array.from({ length: 10 }, (_, i) =>
      workout(T0 + i * 7 * DAY, [entry(SQUAT.id, sets(100 + i * 2.5, [5]))]),
    );
    const goal = { weight: { v: 160, u: 'kg' as const }, reps: 1, setAt: T0 };
    const q = progressionView(
      SQUAT,
      many,
      { schemaVersion: 1, longTermGoal: goal },
      settings(),
      ctx(T0 + 70 * DAY),
    );
    expect(q.data.available).toBe(true);
    if (!q.data.available) return;
    expect(q.data.status).toBe('up');
    expect(q.data.projection12w.v).toBeGreaterThan(q.data.currentE1rm.v);
    expect(q.data.goal?.targetE1rm).toEqual({ v: 160, u: 'kg' });
    expect(q.text).toContain('Objectif');
  });

  it('agrège les statistiques par semaine et par muscle', () => {
    const ws = [
      workout(T0, [entry(SQUAT.id, sets(100, [5, 5]))], {
        doc: {
          schemaVersion: 1,
          title: 'A',
          durationS: 3600,
          exercises: [entry(SQUAT.id, sets(100, [5, 5]))],
        },
      }),
      workout(T0 + 7 * DAY, [entry(BENCH.id, sets(80, [8]))]),
    ];
    const { data } = statsView(ws, { from: T0 - DAY, to: T0 + 14 * DAY }, ctx(T0 + 14 * DAY));
    expect(data.totals.workouts).toBe(2);
    expect(data.totals.sets).toBe(3);
    expect(data.weeks.map((w) => w.workouts)).toEqual([0, 1, 1, 0]);
    expect(data.muscles[0]).toMatchObject({ muscle: 'quads', sets: 2 });
    expect(data.muscles.find((m) => m.muscle === 'glutes')?.sets).toBe(1);
    expect(data.trainingDays).toHaveLength(2);
  });
});
