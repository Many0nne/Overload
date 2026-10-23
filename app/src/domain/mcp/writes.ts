// Écritures du connecteur Claude (docs/spec-mcp.md §7.2) : horodatage « dernier gagne » de l'appareil virtuel,
// comme saveRow() côté app, et petites règles de construction des lignes synchronisées.
import type { SyncMeta } from '../types';

// Cette méthode permet d'horodater une ligne écrite par l'appareil virtuel : client_updated_at = max(maintenant,
// existant + 1), pour que la dernière modification gagne toujours.
export function stamp<T extends object>(
  row: T,
  previous: Pick<SyncMeta, 'client_updated_at'> | undefined,
  deviceId: string,
  now: number,
): T & SyncMeta {
  const { rev: _rev, ...rest } = row as T & { rev?: number };
  return {
    ...(rest as T),
    client_updated_at: Math.max(now, (previous?.client_updated_at ?? 0) + 1),
    client_device_id: deviceId,
  };
}

// Cette méthode permet d'obtenir la position de fin de liste (dossiers, routines) : la plus grande position + 1.
export function nextPosition(rows: { position: number; deleted_at: number | null }[]): number {
  return rows.filter((r) => r.deleted_at === null).reduce((max, r) => Math.max(max, r.position), 0) + 1;
}

// Cette méthode permet de proposer le titre par défaut d'une séance dans un fuseau (« Push – mardi », « Séance – mardi »).
export function defaultTitleTz(routineName: string | undefined, startedAt: number, tz: string): string {
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: tz }).format(new Date(startedAt));
  return `${routineName?.trim() || 'Séance'} – ${day}`;
}
