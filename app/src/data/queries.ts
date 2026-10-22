import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import {
  type CompletedWorkout,
  DEFAULT_SETTINGS,
  type ExerciseRow,
  type FolderRow,
  type ProfileRow,
  type RoutineRow,
  type Settings,
  type WorkoutRow,
} from '@/domain/types';
import { db } from './db';
import { useSession } from './session';

// Cette méthode permet de lire en direct le profil de l'utilisateur connecté.
export function useProfile(): ProfileRow | undefined {
  const userId = useSession((s) => s.userId);
  return useLiveQuery(() => (userId ? db.profiles.get(userId) : undefined), [userId]);
}

// Cette méthode permet de lire les paramètres de l'utilisateur, avec les valeurs par défaut tant que le profil n'est pas chargé.
export function useSettings(): Settings {
  const profile = useProfile();
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...(profile?.settings ?? {}) }), [profile?.settings]);
}

// Cette méthode permet de lire tous les exercices visibles (catalogue + personnels), archivés compris.
export function useAllExercises(): ExerciseRow[] | undefined {
  return useLiveQuery(() => db.exercises.filter((e) => e.deleted_at == null).toArray(), []);
}

// Cette méthode permet d'obtenir un index id → exercice pour afficher les noms dans les séances et routines.
export function useExerciseMap(): Map<string, ExerciseRow> {
  const all = useAllExercises();
  return useMemo(() => new Map((all ?? []).map((e) => [e.id, e])), [all]);
}

// Cette méthode permet de lire un exercice par son id.
export function useExercise(id: string | undefined): ExerciseRow | undefined {
  return useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id]);
}

// Cette méthode permet de lire les dossiers non supprimés, triés par position.
export function useFolders(): FolderRow[] | undefined {
  return useLiveQuery(
    () =>
      db.folders
        .orderBy('position')
        .filter((f) => f.deleted_at == null)
        .toArray(),
    [],
  );
}

// Cette méthode permet de lire les routines non supprimées, triées par position.
export function useRoutines(): RoutineRow[] | undefined {
  return useLiveQuery(
    () =>
      db.routines
        .orderBy('position')
        .filter((r) => r.deleted_at == null)
        .toArray(),
    [],
  );
}

// Cette méthode permet de lire une routine par son id.
export function useRoutine(id: string | undefined): RoutineRow | undefined {
  return useLiveQuery(() => (id ? db.routines.get(id) : undefined), [id]);
}

// Cette méthode permet de lire les séances en cours du compte (normalement une seule, deux après un conflit hors ligne).
export function useInProgressWorkouts(): WorkoutRow[] | undefined {
  return useLiveQuery(
    () =>
      db.workouts
        .where('status')
        .equals('in_progress')
        .filter((w) => w.deleted_at == null)
        .toArray(),
    [],
  );
}

// Cette méthode permet de lire une séance par son id.
export function useWorkout(id: string | undefined): WorkoutRow | undefined {
  return useLiveQuery(() => (id ? db.workouts.get(id) : undefined), [id]);
}

// Cette méthode permet de charger toutes les séances terminées, triées par début croissant (base des calculs du domaine).
export async function loadCompletedWorkouts(): Promise<CompletedWorkout[]> {
  const rows = await db.workouts
    .orderBy('started_at')
    .filter((w) => w.status === 'completed' && w.deleted_at == null)
    .toArray();
  return rows.sort((a, b) => a.started_at - b.started_at || a.id.localeCompare(b.id)) as CompletedWorkout[];
}

// Cette méthode permet de lire en direct les séances terminées, triées par début croissant.
export function useCompletedWorkouts(): CompletedWorkout[] | undefined {
  return useLiveQuery(loadCompletedWorkouts, []);
}

// Cette méthode permet de compter les éléments en attente d'envoi (indicateur de synchro).
export function useOutboxCount(): number {
  return useLiveQuery(() => db.outbox.count(), []) ?? 0;
}
