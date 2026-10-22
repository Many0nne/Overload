import type { ExerciseRow } from '@/domain/types';
import { db } from './db';

// Cette méthode permet de pré-remplir le catalogue local au premier lancement, pour une bibliothèque utilisable hors ligne
// avant la première synchronisation. Les lignes serveur (avec rev) les remplacent ensuite au premier pull.
export async function seedCatalogIfEmpty(): Promise<void> {
  const count = await db.exercises.count();
  if (count > 0) return;
  const { default: rows } = (await import('./catalog.generated.json')) as { default: Omit<ExerciseRow, 'rev'>[] };
  const existing = await db.exercises.count();
  if (existing > 0) return;
  await db.exercises.bulkPut(rows as ExerciseRow[]);
}
