import { create } from 'zustand';

type SyncStatus = {
  online: boolean;
  lastCallFailed: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  /** Avance (> 0) ou retard (< 0) de l'horloge de l'appareil sur le serveur, null si jamais mesuré. */
  clockSkewMs: number | null;
  set: (patch: Partial<Omit<SyncStatus, 'set'>>) => void;
};

export const useSyncStatus = create<SyncStatus>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastCallFailed: false,
  syncing: false,
  lastSyncAt: null,
  clockSkewMs: null,
  set: (patch) => set(patch),
}));
