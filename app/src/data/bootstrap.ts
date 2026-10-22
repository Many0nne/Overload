import type { ExerciseRow } from '@/domain/types';
import { db } from './db';

// Cette méthode permet de pré-remplir le catalogue local au premier lancement, pour une bibliothèque utilisable hors ligne
// avant la première synchronisation. Appelée sans attendre : l'écran s'affiche avant la fin de l'écriture (§15).
export async function seedCatalogIfEmpty(): Promise<void> {
  if ((await db.exercises.count()) > 0) return;
  const { default: rows } = (await import('./catalog.generated.json')) as {
    default: Omit<ExerciseRow, 'rev'>[];
  };
  // Comptage et écriture dans la même transaction : un premier pull arrivé entre-temps (lignes avec rev) n'est
  // jamais écrasé par les lignes embarquées.
  await db.transaction('rw', db.exercises, async () => {
    if ((await db.exercises.count()) > 0) return;
    await db.exercises.bulkAdd(rows as ExerciseRow[]);
  });
}
