// Décalage d'horloge de l'appareil (§19 spec technique) : « dernier gagne » repose sur l'horloge locale,
// un écart de plus de 5 min avec le serveur est signalé à l'utilisateur.

export const CLOCK_SKEW_LIMIT_MS = 5 * 60_000;

// Cette méthode permet d'estimer l'avance (positive) ou le retard (négatif) de l'appareil sur le serveur,
// en plaçant l'heure serveur au milieu de l'aller-retour réseau (t0 = envoi, t1 = réponse, horloge locale).
export function estimateClockSkew(t0: number, t1: number, serverMs: number): number {
  return Math.round((t0 + t1) / 2 - serverMs);
}

// Cette méthode permet de savoir si l'écart mesuré dépasse la tolérance de 5 min.
export function isClockSkewed(skewMs: number | null): boolean {
  return skewMs !== null && Math.abs(skewMs) > CLOCK_SKEW_LIMIT_MS;
}

// Cette méthode permet de formuler l'écart pour l'utilisateur (« en avance de 7 min », « en retard de 2 h 05 »).
export function formatClockSkew(skewMs: number): string {
  const minutes = Math.round(Math.abs(skewMs) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const span = h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
  return `${skewMs > 0 ? 'en avance' : 'en retard'} de ${span}`;
}
