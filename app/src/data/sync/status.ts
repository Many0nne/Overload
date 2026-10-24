import { create } from 'zustand';

type SyncStatus = {
  online: boolean;
  lastCallFailed: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  /** Avance (> 0) ou retard (< 0) de l'horloge de l'appareil sur le serveur, null si jamais mesuré. */
  clockSkewMs: number | null;
  /** Le serveur porte des documents d'un format plus récent que cette version de l'app : pull bloqué jusqu'à la mise à jour (#71). */
  appOutdated: boolean;
  set: (patch: Partial<Omit<SyncStatus, 'set'>>) => void;
};

export const useSyncStatus = create<SyncStatus>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastCallFailed: false,
  syncing: false,
  lastSyncAt: null,
  clockSkewMs: null,
  appOutdated: false,
  set: (patch) => set(patch),
}));
