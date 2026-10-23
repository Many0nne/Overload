// Identifiants générés côté client (§2, §5.2).
import { v5, v7 } from 'uuid';

// Espace de noms des UUID v5 d'Overload (réglages de progression, catalogue).
export const OVERLOAD_NAMESPACE = '6f1c2a9e-4b7d-4e33-9d0a-2f5b8c7e1a40';

// Cette méthode permet de générer un UUID v7 (création hors ligne sans collision, tri chronologique).
export function uuidv7(): string {
  return v7();
}

// Cette méthode permet d'obtenir l'id stable des réglages de progression d'un exercice pour un compte (UUID v5).
export function prefsId(userId: string, exerciseId: string): string {
  return v5(`exercise_prefs:${userId}:${exerciseId}`, OVERLOAD_NAMESPACE);
}

// Cette méthode permet d'obtenir l'id stable d'une séance importée de HEVY pour un compte (UUID v5) : réimporter
// le même export retrouve la séance au lieu de la dupliquer.
export function hevyWorkoutId(userId: string, hevyKey: string): string {
  return v5(`hevy:${userId}:${hevyKey}`, OVERLOAD_NAMESPACE);
}
