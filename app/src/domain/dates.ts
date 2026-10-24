// Règles de date communes (§F7.6, §10.6) : jour d'appartenance et semaine lundi-dimanche, dans le fuseau courant.

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;
export const MONTH_MS = 30.44 * DAY_MS;

// Cette méthode permet d'obtenir minuit local du jour contenant l'instant donné.
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Cette méthode permet d'obtenir la clé « AAAA-MM-JJ » du jour local d'un instant (jour de début d'une séance).
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Cette méthode permet de convertir une clé « AAAA-MM-JJ » en minuit local.
export function parseDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
}

// Cette méthode permet d'obtenir le lundi 00:00 local de la semaine contenant l'instant donné.
export function weekStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

// Cette méthode permet de décaler un début de semaine de n semaines en restant à minuit local (heure d'été comprise).
export function addWeeks(weekStartMs: number, n: number): number {
  const d = new Date(weekStartMs);
  d.setDate(d.getDate() + 7 * n);
  return d.getTime();
}

// Cette méthode permet de décaler un instant de n jours calendaires locaux.
export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

// Cette méthode permet de décaler un instant de n mois calendaires locaux (n peut être négatif).
export function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

// Cette méthode permet de calculer l'écart en ms entre deux instants en heure locale (neutralise le changement d'heure).
export function localDiff(a: number, b: number): number {
  const off = (ms: number) => new Date(ms).getTimezoneOffset() * 60_000;
  return b - off(b) - (a - off(a));
}

// Cette méthode permet de compter les jours calendaires locaux entre deux instants (0 = même jour, 1 = la veille de b).
export function calendarDaysBetween(a: number, b: number): number {
  return Math.round(localDiff(startOfDay(a), startOfDay(b)) / DAY_MS);
}

// Cette méthode permet de compter les semaines calendaires entre deux débuts de semaine (b − a), sans dérive d'heure d'été.
export function weeksBetween(a: number, b: number): number {
  return Math.round((b - a) / WEEK_MS);
}

export type Period = '1m' | '3m' | '1y' | 'all';

// Cette méthode permet d'obtenir le début d'une période de graphique (1 mois, 3 mois, 1 an, tout) à partir de maintenant.
export function periodStart(period: Period, now: number): number {
  switch (period) {
    case '1m':
      return addMonths(now, -1);
    case '3m':
      return addMonths(now, -3);
    case '1y':
      return addMonths(now, -12);
    case 'all':
      return Number.NEGATIVE_INFINITY;
  }
}

// Cette méthode permet de construire la grille d'un mois (lignes lundi-dimanche) pour le calendrier ; null = case hors du mois.
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(year, month, d).getTime()));
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
