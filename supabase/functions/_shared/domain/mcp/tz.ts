// Généré par app/scripts/build-edge-domain.mjs depuis app/src/domain : ne pas modifier.
// Fuseau horaire des outils du connecteur Claude (docs/spec-mcp.md §6.1) : le serveur ignore le fuseau de l'appareil,
// les outils reçoivent un fuseau IANA (défaut Europe/Paris) pour les dates saisies et les regroupements par jour ou semaine.

export const DEFAULT_TZ = 'Europe/Paris';

type Parts = { y: number; mo: number; d: number; h: number; mi: number; s: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

// Cette méthode permet de savoir si un fuseau IANA est reconnu par le moteur.
export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Cette méthode permet de lire la date et l'heure murales d'un instant dans un fuseau.
function zonedParts(ms: number, tz: string): Parts {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(ms)))
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p.year!, mo: p.month!, d: p.day!, h: p.hour! % 24, mi: p.minute!, s: p.second! };
}

// Cette méthode permet de calculer le décalage (ms) d'un fuseau par rapport à UTC à un instant donné.
export function tzOffsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  const floor = Math.floor(ms / 1000) * 1000;
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - floor;
}

// Cette méthode permet de convertir une heure murale d'un fuseau (exprimée comme si elle était UTC) en instant réel.
export function wallToInstant(wallAsUtc: number, tz: string): number {
  let guess = wallAsUtc;
  for (let i = 0; i < 3; i++) guess = wallAsUtc - tzOffsetMs(guess, tz);
  return guess;
}

// Cette méthode permet de projeter un instant dans le « temps local » du moteur de sorte que son heure murale locale
// soit celle du fuseau voulu : les fonctions du domaine (jour, semaine lundi-dimanche) s'appliquent alors telles quelles.
export function toLocalFrame(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  return new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s, ((ms % 1000) + 1000) % 1000).getTime();
}

// Cette méthode permet de revenir d'un instant du « temps local » du moteur à l'instant réel du fuseau voulu.
export function fromLocalFrame(local: number, tz: string): number {
  const d = new Date(local);
  const wall = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
  return wallToInstant(wall, tz);
}

// Cette méthode permet d'obtenir la clé « AAAA-MM-JJ » du jour d'un instant dans un fuseau.
export function zonedDayKey(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

// Cette méthode permet d'afficher un instant en ISO 8601 avec le décalage du fuseau (« 2026-10-22T18:00:00+02:00 »).
export function formatInstant(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  const off = Math.round(tzOffsetMs(ms, tz) / 60_000);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

// Cette méthode permet de lire une date ISO 8601 saisie par Claude : avec décalage ou « Z », l'instant exact ;
// sans décalage (« 2026-10-22 » ou « 2026-10-22T18:00 »), l'heure murale du fuseau. undefined si invalide.
export function parseInstant(input: string, tz: string): number | undefined {
  const s = input.trim();
  const m = s.match(LOCAL_RE);
  if (m) {
    const [y, mo, d, h, mi, sec] = m.slice(1).map((v) => (v === undefined ? 0 : Number(v)));
    if (mo! < 1 || mo! > 12 || d! < 1 || d! > 31 || h! > 23 || mi! > 59 || sec! > 59) return undefined;
    const wall = Date.UTC(y!, mo! - 1, d!, h, mi, sec);
    if (new Date(wall).getUTCDate() !== d) return undefined;
    return wallToInstant(wall, tz);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return undefined;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : undefined;
}

// Cette méthode permet de lire une date seule (« AAAA-MM-JJ ») ; undefined si invalide.
export function parseDayKeyStrict(input: string): string | undefined {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
