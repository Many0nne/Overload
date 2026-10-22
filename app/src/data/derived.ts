import { useMemo } from 'react';
import { allWorkoutBadges, type WorkoutBadges } from '@/domain/records';
import type { CompletedWorkout } from '@/domain/types';
import { useCompletedWorkouts } from './queries';

// Cette méthode permet d'obtenir les séances terminées et leurs badges 🏆, recalculés quand une séance change (§10.3).
// Les badges ne sont jamais stockés : modifier une séance passée corrige automatiquement toutes les suivantes.
export function useHistoryWithBadges(): {
  workouts: CompletedWorkout[] | undefined;
  badges: Record<string, WorkoutBadges>;
} {
  const workouts = useCompletedWorkouts();
  const badges = useMemo(() => (workouts ? allWorkoutBadges(workouts) : {}), [workouts]);
  return { workouts, badges };
}
