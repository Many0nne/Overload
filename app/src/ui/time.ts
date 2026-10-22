// Cette méthode permet d'afficher un temps de repos lisible (1 min 30, 45 s, Off).
export function formatRest(s: number | null): string {
  if (s === null) return 'Off';
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60}` : ''}`;
}
