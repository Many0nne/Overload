import { create } from 'zustand';

type SyncStatus = {
  online: boolean;
  lastCallFailed: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  set: (patch: Partial<Omit<SyncStatus, 'set'>>) => void;
};

export const useSyncStatus = create<SyncStatus>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastCallFailed: false,
  syncing: false,
  lastSyncAt: null,
  set: (patch) => set(patch),
}));
