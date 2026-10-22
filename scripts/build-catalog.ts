// Génère le catalogue d'exercices (spec technique §13) : supabase/seed.sql et app/src/data/catalog.generated.json.
// Usage : npx tsx scripts/build-catalog.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v5 as uuidv5 } from 'uuid';
import type { Equipment, ExerciseRow, MeasurementType, Muscle } from '../app/src/domain/types';

// Version figée de free-exercise-db (dernier commit connu au moment de la rédaction).
const SOURCE_SHA = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const SOURCE_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${SOURCE_SHA}/dist/exercises.json`;

// Namespace UUID v5 fixe : ne jamais le modifier (les ids du catalogue en dépendent).
const NAMESPACE = '6f1b3c0e-5a7d-4f2e-9b8a-0c4d1e2f3a4b';
const CLIENT_DEVICE_ID = '00000000-0000-0000-0000-000000000000';
const CLIENT_UPDATED_AT = Date.UTC(2026, 0, 1); // ms epoch, figé pour un seed idempotent

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type SourceExercise = {
  id: string;
  name: string;
  equipment: string | null;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

type FrEntry = {
  name: string;
  instructions: string[];
  measurement_type?: MeasurementType;
  equipment?: Equipment;
  primary_muscle?: Muscle;
  secondary_muscles?: Muscle[];
};

const MUSCLES: readonly Muscle[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs',
  'quads', 'hamstrings', 'glutes', 'calves', 'traps', 'lower_back', 'cardio',
];
const EQUIPMENTS: readonly Equipment[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other',
];
const MEASUREMENTS: readonly MeasurementType[] = [
  'weight_reps', 'bodyweight', 'weighted_bw', 'assisted_bw', 'duration', 'weight_duration', 'distance_duration',
];

// Muscles source -> muscles de l'app. Adducteurs -> quadriceps, abducteurs -> fessiers, cou -> trapèzes.
const MUSCLE_MAP: Record<string, Muscle> = {
  abdominals: 'abs',
  abductors: 'glutes',
  adductors: 'quads',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'back',
  'lower back': 'lower_back',
  'middle back': 'back',
  neck: 'traps',
  quadriceps: 'quads',
  shoulders: 'shoulders',
  traps: 'traps',
  triceps: 'triceps',
};

// Équipements source -> équipements de l'app (surchargeables par exercice dans catalog-fr.json).
const EQUIPMENT_MAP: Record<string, Equipment> = {
  barbell: 'barbell',
  'e-z curl bar': 'barbell',
  dumbbell: 'dumbbell',
  machine: 'machine',
  cable: 'cable',
  'body only': 'bodyweight',
  kettlebells: 'kettlebell',
  bands: 'band',
  other: 'other',
  'foam roll': 'other',
  'medicine ball': 'other',
  'exercise ball': 'other',
};

// Cette méthode permet de convertir un muscle source en code de l'app lorsque la table de correspondance le connaît.
function mapMuscle(src: string): Muscle {
  const m = MUSCLE_MAP[src];
  if (!m) throw new Error(`Muscle source inconnu : ${src}`);
  return m;
}

// Cette méthode permet de déduire l'équipement de l'app lorsque la source n'est pas surchargée.
function mapEquipment(src: string | null): Equipment {
  if (src === null) return 'bodyweight'; // la source laisse null pour le poids du corps
  const e = EQUIPMENT_MAP[src];
  if (!e) throw new Error(`Équipement source inconnu : ${src}`);
  return e;
}

// Cette méthode permet de déduire le type de mesure par règles lorsqu'aucune surcharge n'est fournie.
function deduceMeasurement(src: SourceExercise, equipment: Equipment): MeasurementType {
  if (src.category === 'cardio') return 'distance_duration';
  if (equipment === 'bodyweight' || equipment === 'band') return 'bodyweight';
  return 'weight_reps';
}

// Cette méthode permet de calculer le nom de recherche lorsqu'on indexe un exercice (minuscules, sans accents).
function toSearchName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Cette méthode permet d'échapper un littéral SQL lorsqu'on l'insère dans le seed (apostrophes doublées).
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// Cette méthode permet de formater un tableau de muscles en littéral SQL text[].
function sqlTextArray(values: string[]): string {
  return values.length === 0 ? `'{}'::text[]` : `array[${values.map(sqlString).join(', ')}]::text[]`;
}

// Cette méthode permet de construire le catalogue complet lorsque la source, la liste blanche et le fichier FR sont chargés.
function buildRows(source: SourceExercise[], allowlist: string[], fr: Record<string, FrEntry>): ExerciseRow[] {
  const byId = new Map(source.map((e) => [e.id, e]));
  const names = new Set<string>();
  const rows: ExerciseRow[] = [];

  if (new Set(allowlist).size !== allowlist.length) throw new Error('Doublons dans catalog-allowlist.json');
  for (const id of Object.keys(fr)) {
    if (!allowlist.includes(id)) throw new Error(`catalog-fr.json : id absent de la liste blanche : ${id}`);
  }

  for (const id of allowlist) {
    const src = byId.get(id);
    if (!src) throw new Error(`Id de la liste blanche absent de la source : ${id}`);
    const f = fr[id];
    if (!f) throw new Error(`Traduction manquante dans catalog-fr.json : ${id}`);
    if (!f.instructions?.length || f.instructions.length > 5) throw new Error(`Consignes : 1 à 5 étapes attendues : ${id}`);

    const equipment = f.equipment ?? mapEquipment(src.equipment);
    const primary = f.primary_muscle ?? (src.category === 'cardio' ? 'cardio' : mapMuscle(src.primaryMuscles[0]));
    const secondary =
      f.secondary_muscles ??
      [...new Set(src.secondaryMuscles.map(mapMuscle))].filter((m) => m !== primary).slice(0, 4);
    // Les muscles principaux additionnels de la source (rare) passent en secondaires.
    if (!f.secondary_muscles) {
      for (const extra of src.primaryMuscles.slice(1).map(mapMuscle)) {
        if (extra !== primary && !secondary.includes(extra) && secondary.length < 4) secondary.push(extra);
      }
    }
    const measurement = f.measurement_type ?? deduceMeasurement(src, equipment);

    if (!EQUIPMENTS.includes(equipment)) throw new Error(`Équipement invalide (${id}) : ${equipment}`);
    if (!MUSCLES.includes(primary) || secondary.some((m) => !MUSCLES.includes(m))) throw new Error(`Muscle invalide : ${id}`);
    if (!MEASUREMENTS.includes(measurement)) throw new Error(`Type de mesure invalide : ${id}`);

    const key = toSearchName(f.name);
    if (names.has(key)) throw new Error(`Nom en double : ${f.name}`);
    names.add(key);

    rows.push({
      id: uuidv5(id, NAMESPACE),
      user_id: null,
      name: f.name,
      name_search: key,
      equipment,
      primary_muscle: primary,
      secondary_muscles: secondary,
      measurement_type: measurement,
      instructions: f.instructions.join('\n'),
      source_id: id,
      archived_at: null,
      client_updated_at: CLIENT_UPDATED_AT,
      client_device_id: CLIENT_DEVICE_ID,
      deleted_at: null,
    });
  }
  return rows;
}

// Cette méthode permet de générer le fichier seed.sql lorsque les lignes du catalogue sont prêtes.
function buildSeed(rows: ExerciseRow[]): string {
  const ts = String(CLIENT_UPDATED_AT);
  const values = rows.map(
    (r) =>
      `  (${sqlString(r.id)}, null, ${sqlString(r.name)}, ${sqlString(r.name_search)}, ${sqlString(r.equipment)}, ` +
      `${sqlString(r.primary_muscle)}, ${sqlTextArray(r.secondary_muscles)}, ${sqlString(r.measurement_type)}, ` +
      `${sqlString(r.instructions ?? '')}, ${sqlString(r.source_id ?? '')}, ${ts}, ${sqlString(CLIENT_DEVICE_ID)})`,
  );
  return [
    '-- Fichier généré par scripts/build-catalog.ts : ne pas modifier à la main.',
    `-- Source : free-exercise-db @ ${SOURCE_SHA} (${rows.length} exercices).`,
    'insert into public.exercises',
    '  (id, user_id, name, name_search, equipment, primary_muscle, secondary_muscles, measurement_type, instructions, source_id, client_updated_at, client_device_id)',
    'values',
    values.join(',\n'),
    'on conflict (id) do update set',
    '  name = excluded.name,',
    '  name_search = excluded.name_search,',
    '  equipment = excluded.equipment,',
    '  primary_muscle = excluded.primary_muscle,',
    '  secondary_muscles = excluded.secondary_muscles,',
    '  measurement_type = excluded.measurement_type,',
    '  instructions = excluded.instructions,',
    '  source_id = excluded.source_id,',
    '  client_updated_at = excluded.client_updated_at,',
    '  client_device_id = excluded.client_device_id;',
    '',
  ].join('\n');
}

// Cette méthode permet d'afficher la répartition du catalogue lorsque la génération est terminée.
function printStats(rows: ExerciseRow[]): void {
  const count = (pick: (r: ExerciseRow) => string): string =>
    JSON.stringify(
      rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [pick(r)]: (acc[pick(r)] ?? 0) + 1 }), {}),
    );
  console.log(`${rows.length} exercices`);
  console.log('muscles    ', count((r) => r.primary_muscle));
  console.log('équipements', count((r) => r.equipment));
  console.log('mesures    ', count((r) => r.measurement_type));
}

// Cette méthode permet de lancer la génération complète lorsque le script est exécuté.
async function main(): Promise<void> {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}) : ${SOURCE_URL}`);
  const source = (await res.json()) as SourceExercise[];
  const allowlist = JSON.parse(readFileSync(resolve(root, 'scripts/catalog-allowlist.json'), 'utf8')) as string[];
  const fr = JSON.parse(readFileSync(resolve(root, 'scripts/catalog-fr.json'), 'utf8')) as Record<string, FrEntry>;

  const rows = buildRows(source, allowlist, fr);
  writeFileSync(resolve(root, 'supabase/seed.sql'), buildSeed(rows));
  writeFileSync(resolve(root, 'app/src/data/catalog.generated.json'), `${JSON.stringify(rows, null, 2)}\n`);
  printStats(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
