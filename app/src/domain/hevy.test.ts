import { describe, expect, it } from 'vitest';
import {
  buildWorkoutDoc,
  detectHevyFile,
  guessExerciseTraits,
  inferMeasurementType,
  MATCH_THRESHOLD,
  type MatchCandidate,
  mergeMeasurementValues,
  parseCsv,
  parseHevyDate,
  parseHevyMeasurements,
  parseHevyWorkouts,
  suggestMatch,
  summarizeExercises,
} from './hevy';
import { hevyWorkoutId } from './ids';

const HEADER =
  '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"';

const WORKOUTS = [
  HEADER,
  '"Push","22 oct. 2026, 16:50","22 oct. 2026, 17:38","Bonne séance","Échauffement",,"",0,"normal",,,,90,',
  '"Push","22 oct. 2026, 16:50","22 oct. 2026, 17:38","Bonne séance","Butterfly Poulie Un Bras",,"Lent, ""contrôlé""",0,"warmup",10,20,,,5',
  '"Push","22 oct. 2026, 16:50","22 oct. 2026, 17:38","Bonne séance","Butterfly Poulie Un Bras",,"Lent, ""contrôlé""",1,"dropset",7.5,20,,,8',
  '"Push","22 oct. 2026, 16:50","22 oct. 2026, 17:38","Bonne séance","Tractions",,"",0,"failure",,12,,,',
  '"Push","22 oct. 2026, 16:50","22 oct. 2026, 17:38","Bonne séance","Butterfly Poulie Un Bras",,"",0,"normal",12.5,16,,,',
  '"Jambes","14 avr. 2026, 17:25","14 avr. 2026, 18:29","","Tapis Roulant",,"15% d’inclinaison",0,"normal",,,1,900,',
].join('\n');

const CANDIDATES: MatchCandidate[] = [
  { id: 'a', name: 'Développé incliné (haltères)', measurementType: 'weight_reps' },
  { id: 'b', name: 'Tirage horizontal assis (poulie)', measurementType: 'weight_reps' },
  { id: 'c', name: 'Tractions', measurementType: 'weighted_bw' },
  { id: 'd', name: 'Marche du fermier', measurementType: 'weight_reps' },
  { id: 'e', name: 'Marche sur tapis', measurementType: 'distance_duration' },
  { id: 'f', name: 'Leg curl couché (machine)', measurementType: 'weight_reps' },
  { id: 'g', name: 'Leg curl assis (machine)', measurementType: 'weight_reps' },
];

describe('CSV HEVY', () => {
  it('lit les cellules entre guillemets, guillemets doublés, virgules et retours à la ligne', () => {
    expect(parseCsv('﻿a,b\r\n"x, ""y""","l1\nl2"\n\n')).toEqual([
      ['a', 'b'],
      ['x, "y"', 'l1\nl2'],
    ]);
  });
  it('reconnaît les deux fichiers de l’export', () => {
    expect(detectHevyFile(WORKOUTS)).toBe('workouts');
    expect(detectHevyFile('"date","weight_kg","fat_percent"\n')).toBe('measurements');
    expect(detectHevyFile('date;poids\n')).toBe('unknown');
  });
});

describe('dates HEVY', () => {
  it('lit les formats français, anglais et ISO en heure locale', () => {
    expect(parseHevyDate('22 oct. 2026, 16:50')).toEqual({ y: 2026, mo: 9, d: 22, h: 16, mi: 50 });
    expect(parseHevyDate('3 févr. 2026, 08:05')).toEqual({ y: 2026, mo: 1, d: 3, h: 8, mi: 5 });
    expect(parseHevyDate('12 août 2025, 00:00')).toMatchObject({ mo: 7, d: 12 });
    expect(parseHevyDate('1 juil. 2025, 10:00')).toMatchObject({ mo: 6 });
    expect(parseHevyDate('22 Oct 2026, 4:50 PM')).toMatchObject({ mo: 9, h: 16, mi: 50 });
    expect(parseHevyDate('Oct 22, 2026, 12:10 am')).toMatchObject({ d: 22, h: 0 });
    expect(parseHevyDate('2026-10-22 16:50:00')).toEqual({ y: 2026, mo: 9, d: 22, h: 16, mi: 50 });
    expect(parseHevyDate('22 brumaire 2026')).toBeNull();
  });
});

describe('séances HEVY', () => {
  const workouts = parseHevyWorkouts(WORKOUTS);
  const push = workouts[1]!;

  it('regroupe les séries en séances triées et blocs d’exercice consécutifs', () => {
    expect(workouts.map((w) => w.title)).toEqual(['Jambes', 'Push']);
    expect(push.key).toBe('2026-10-22T16:50|Push');
    expect(push.endedAt! - push.startedAt).toBe(48 * 60_000);
    expect(push.exercises.map((e) => e.title)).toEqual([
      'Échauffement',
      'Butterfly Poulie Un Bras',
      'Tractions',
      'Butterfly Poulie Un Bras',
    ]);
    expect(push.exercises[1]).toEqual({
      title: 'Butterfly Poulie Un Bras',
      note: 'Lent, "contrôlé"',
      sets: [
        { kind: 'warmup', weightKg: 10, reps: 20 }, // RPE 5 hors échelle : ignoré
        { kind: 'drop', weightKg: 7.5, reps: 20, rpe: 8 },
      ],
    });
    expect(push.exercises[2]!.sets[0]).toEqual({ kind: 'failure', reps: 12 });
  });

  it('déduit le type de mesure des colonnes remplies', () => {
    expect(
      inferMeasurementType([
        { kind: 'normal', weightKg: 10, reps: 5 },
        { kind: 'normal', reps: 5 },
      ]),
    ).toBe('weight_reps');
    expect(inferMeasurementType([{ kind: 'normal', reps: 5 }])).toBe('bodyweight');
    expect(inferMeasurementType([{ kind: 'normal', durationS: 60 }])).toBe('duration');
    expect(inferMeasurementType([{ kind: 'normal', weightKg: 20, durationS: 60 }])).toBe('weight_duration');
    expect(inferMeasurementType([{ kind: 'normal', distanceKm: 1, durationS: 60 }])).toBe(
      'distance_duration',
    );
  });

  it('résume les exercices distincts, les plus pratiqués d’abord', () => {
    expect(summarizeExercises(workouts)).toEqual([
      { title: 'Butterfly Poulie Un Bras', setCount: 3, measurementType: 'weight_reps' },
      { title: 'Échauffement', setCount: 1, measurementType: 'duration' },
      { title: 'Tapis Roulant', setCount: 1, measurementType: 'distance_duration' },
      { title: 'Tractions', setCount: 1, measurementType: 'bodyweight' },
    ]);
  });

  it('construit une séance terminée sans les exercices ignorés ni repos', () => {
    let n = 0;
    const doc = buildWorkoutDoc(
      push,
      (t) => (t === 'Échauffement' ? null : { exerciseId: `id-${t}`, measurementType: 'weight_reps' }),
      () => `x${n++}`,
    );
    expect(doc.title).toBe('Push');
    expect(doc.note).toBe('Bonne séance');
    expect(doc.durationS).toBe(48 * 60);
    expect(doc.exercises).toHaveLength(3);
    expect(doc.exercises[0]).toMatchObject({
      exerciseId: 'id-Butterfly Poulie Un Bras',
      note: 'Lent, "contrôlé"',
      restS: null,
    });
    expect(doc.exercises[0]!.sets[1]).toEqual({
      id: expect.any(String),
      kind: 'drop',
      weight: { v: 7.5, u: 'kg' },
      reps: 20,
      done: true,
      rpe: 8,
    });
    const tapis = buildWorkoutDoc(
      workouts[0]!,
      () => ({ exerciseId: 't', measurementType: 'distance_duration' }),
      () => 'i',
    );
    expect(tapis.exercises[0]!.sets[0]).toMatchObject({ distance: { v: 1, u: 'km' }, durationS: 900 });
  });

  it('donne un id stable par compte et par séance', () => {
    expect(hevyWorkoutId('u1', push.key)).toBe(hevyWorkoutId('u1', push.key));
    expect(hevyWorkoutId('u1', push.key)).not.toBe(hevyWorkoutId('u2', push.key));
  });

  it('refuse une date illisible', () => {
    expect(() => parseHevyWorkouts(`${HEADER}\n"A","hier","","","B",,"",0,"normal",1,1,,,`)).toThrow(/hier/);
  });
});

describe('correspondance des exercices', () => {
  it('trouve le nom exact sans accents ni casse', () => {
    expect(suggestMatch('TRACTIONS', 'bodyweight', CANDIDATES)).toEqual({
      candidate: CANDIDATES[2],
      score: 1,
    });
  });
  it('rapproche les formulations HEVY du vocabulaire du catalogue', () => {
    const inc = suggestMatch('Développé Couché Incliné (Haltère)', 'weight_reps', CANDIDATES)!;
    expect(inc.candidate.id).toBe('a');
    expect(inc.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    expect(suggestMatch('Rowing Poulie Assis', 'weight_reps', CANDIDATES)!.candidate.id).toBe('b');
    expect(suggestMatch('Leg Curl Allongé (Machine)', 'weight_reps', CANDIDATES)!.candidate.id).toBe('f');
  });
  it('relie « Warm Up » à l’Échauffement du catalogue (issue #124)', () => {
    const list: MatchCandidate[] = [
      ...CANDIDATES,
      { id: 'w', name: 'Échauffement', measurementType: 'duration' },
    ];
    expect(suggestMatch('Warm Up', 'duration', list)).toEqual({ candidate: list.at(-1), score: 1 });
    expect(suggestMatch('Warm-up', 'duration', list)?.candidate.id).toBe('w');
    expect(suggestMatch('Échauffement', 'duration', list)?.candidate.id).toBe('w');
  });
  it('préfère un type de mesure compatible', () => {
    expect(suggestMatch('Marche', 'distance_duration', CANDIDATES)!.candidate.id).toBe('e');
  });
  it('ne propose rien sans mot de mouvement commun', () => {
    expect(suggestMatch('Shopping', 'duration', CANDIDATES)).toBeNull();
    expect(suggestMatch('Assis (Machine)', 'weight_reps', CANDIDATES)).toBeNull();
  });
  it('devine matériel et muscle d’un exercice perso', () => {
    expect(guessExerciseTraits('Butterfly Poulie Un Bras', 'weight_reps')).toEqual({
      equipment: 'cable',
      primary_muscle: 'chest',
    });
    expect(guessExerciseTraits('Tirage Poitrine (Machine)', 'weight_reps')).toEqual({
      equipment: 'machine',
      primary_muscle: 'back',
    });
    expect(guessExerciseTraits('Développé Épaules (Haltère)', 'weight_reps').primary_muscle).toBe(
      'shoulders',
    );
    expect(guessExerciseTraits('Crunch (Machine)', 'weight_reps').primary_muscle).toBe('abs');
    expect(guessExerciseTraits('Échauffement', 'duration')).toEqual({
      equipment: 'bodyweight',
      primary_muscle: 'cardio',
    });
  });
});

describe('mesures HEVY', () => {
  it('lit les mesures par jour et ignore les colonnes sans équivalent', () => {
    const csv = [
      '"date","weight_kg","fat_percent","neck_cm","left_forearm_cm","abdomen_cm","waist_cm","left_bicep_cm"',
      '"24 nov. 2025, 00:00",65,,,30,80,,',
      '"24 nov. 2025, 19:00",,12.5,,,,78,33',
      '"1 déc. 2025, 00:00",,,,,,,',
    ].join('\n');
    expect(parseHevyMeasurements(csv)).toEqual([
      {
        measuredOn: '2025-11-24',
        values: {
          weight: { v: 65, u: 'kg' },
          body_fat: 12.5,
          waist: { v: 78, u: 'cm' },
          arm_left: { v: 33, u: 'cm' },
        },
      },
    ]);
  });
  it('ne complète que les champs vides d’une mesure existante', () => {
    const existing = { weight: { v: 70, u: 'kg' as const } };
    expect(mergeMeasurementValues(existing, { weight: { v: 65, u: 'kg' }, body_fat: 12 })).toEqual({
      weight: { v: 70, u: 'kg' },
      body_fat: 12,
    });
    expect(mergeMeasurementValues(existing, { weight: { v: 65, u: 'kg' } })).toBeNull();
  });
});

describe('supersets HEVY (#77)', () => {
  const rows = [
    HEADER,
    '"S","22 oct. 2026, 16:50","22 oct. 2026, 17:38","","Tractions",7,"",0,"normal",,10,,,',
    '"S","22 oct. 2026, 16:50","22 oct. 2026, 17:38","","Dips",7,"",0,"normal",,12,,,',
    '"S","22 oct. 2026, 16:50","22 oct. 2026, 17:38","","Curl",,"",0,"normal",10,8,,,',
  ].join('\n');

  it('lit superset_id et relie les deux exercices consécutifs', () => {
    const w = parseHevyWorkouts(rows)[0]!;
    expect(w.exercises.map((e) => e.supersetId)).toEqual(['7', '7', undefined]);
    let n = 0;
    const doc = buildWorkoutDoc(
      w,
      () => ({ exerciseId: 'x', measurementType: 'weight_reps' }),
      () => `id${++n}`,
    );
    expect(doc.schemaVersion).toBe(2);
    expect(doc.exercises[0]!.groupId).toBeDefined();
    expect(doc.exercises[0]!.groupId).toBe(doc.exercises[1]!.groupId);
    expect(doc.exercises[2]!.groupId).toBeUndefined();
  });

  it('aplatit un superset dont un exercice est ignoré', () => {
    const w = parseHevyWorkouts(rows)[0]!;
    const doc = buildWorkoutDoc(
      w,
      (t) => (t === 'Dips' ? null : { exerciseId: 'x', measurementType: 'weight_reps' }),
      () => 'i',
    );
    expect(doc.exercises.every((e) => !e.groupId)).toBe(true);
  });
});
