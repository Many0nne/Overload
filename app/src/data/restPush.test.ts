import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '55555555-5555-7555-8555-555555555555';
const meta = new Map<string, unknown>();
const workouts = new Map<string, Record<string, unknown>>();
const rpc = vi.fn();

vi.mock('./db', () => ({
  db: {
    meta: {},
    workouts: { get: async (id: string) => workouts.get(id) },
    transaction: async (_mode: string, _table: unknown, fn: () => Promise<void>) => fn(),
  },
  getMeta: async (key: string) => meta.get(key),
  setMeta: async (key: string, value: unknown) => void meta.set(key, value),
}));
vi.mock('./device', () => ({ deviceIdSync: () => ME }));
vi.mock('./errors', () => ({ logError: vi.fn() }));
vi.mock('./supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
  supabaseConfigured: true,
}));

const net = { onLine: false, serviceWorker: {} };
vi.stubGlobal('navigator', net);
vi.stubGlobal('window', { PushManager: {}, Notification: {} });
vi.stubGlobal('Notification', { permission: 'granted' });
vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'cle');
const push = await import('./restPush');

const INTENT = 'rest_push_intent';
const later = () => Date.now() + 60_000;

describe('notification de repos hors ligne (#66)', () => {
  beforeEach(() => {
    meta.clear();
    workouts.clear();
    rpc.mockReset().mockResolvedValue({ error: null });
    net.onLine = false;
  });

  it('garde la planification hors ligne et la rejoue au retour du réseau', async () => {
    const endsAt = later();
    await push.scheduleRestNotification(endsAt, 'Repos terminé', 'Squat, série 1');
    expect(rpc).not.toHaveBeenCalled();
    net.onLine = true;
    await push.flushRestNotification();
    expect(rpc).toHaveBeenCalledWith(
      'schedule_rest_timer',
      expect.objectContaining({ p_ends_at_ms: endsAt }),
    );
    expect(meta.get(INTENT)).toBeNull();
  });

  it('seule la dernière intention compte : « Passer » hors ligne annule au retour du réseau', async () => {
    await push.scheduleRestNotification(later(), 'Repos terminé', 'Squat');
    await push.cancelRestNotification();
    net.onLine = true;
    await push.flushRestNotification();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('cancel_rest_timer', { p_device_id: ME });
  });

  it('une planification échue devient une annulation', async () => {
    await push.scheduleRestNotification(Date.now() - 1, 'Repos terminé', 'Squat');
    net.onLine = true;
    await push.flushRestNotification();
    expect(rpc).toHaveBeenCalledWith('cancel_rest_timer', { p_device_id: ME });
  });

  it('une séance reprise ailleurs ne replanifie pas de notification', async () => {
    workouts.set('w1', { status: 'in_progress', deleted_at: null, owner_device_id: 'autre' });
    await push.scheduleRestNotification(later(), 'Repos terminé', 'Squat', 'w1');
    net.onLine = true;
    await push.flushRestNotification();
    expect(rpc).toHaveBeenCalledWith('cancel_rest_timer', { p_device_id: ME });
  });

  it("garde l'intention si l'appel échoue (Wi-Fi sans accès Internet)", async () => {
    net.onLine = true;
    rpc.mockResolvedValueOnce({ error: { message: 'Failed to fetch' } });
    await push.cancelRestNotification();
    expect(meta.get(INTENT)).toMatchObject({ kind: 'cancel' });
    await push.flushRestNotification();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(meta.get(INTENT)).toBeNull();
  });
});
