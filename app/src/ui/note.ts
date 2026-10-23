// Limites de longueur des notes (issue #30) : courte pour un exercice, plus large pour la séance.
export const EXERCISE_NOTE_MAX = 280;
export const WORKOUT_NOTE_MAX = 1000;

// Cette méthode permet d'obtenir le compteur « n/max » d'une note lorsque sa longueur atteint 80 % de la limite (null sinon).
export function noteCounter(length: number, max: number): string | null {
  return length >= max * 0.8 ? `${length}/${max}` : null;
}
