import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/data/db', () => ({ getMeta: vi.fn(), setMeta: vi.fn() }));
vi.mock('@/data/restPush', () => ({ cancelRestNotification: vi.fn(), scheduleRestNotification: vi.fn() }));

// Faux AudioContext : compte les oscillateurs démarrés et simule la suspension d'iOS (veille, arrière-plan).
class FakeAudioContext {
  static last: FakeAudioContext;
  state = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  oscillators = 0;
  silentBuffers = 0;
  constructor() {
    FakeAudioContext.last = this;
  }
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return { buffer: null, connect: () => undefined, start: () => this.silentBuffers++ };
  }
  createOscillator() {
    const node = {
      frequency: { value: 0 },
      connect: (n: unknown) => n,
      start: () => this.oscillators++,
      stop: () => {},
    };
    return node;
  }
  createGain() {
    const node = {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: (n: unknown) => n,
    };
    return node;
  }
}

let audio: typeof import('./restTimer');

beforeAll(async () => {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  audio = await import('./restTimer');
});

describe('son de fin de repos', () => {
  it("ne joue rien tant qu'aucun toucher n'a débloqué le son", () => {
    audio.playRestEndSound();
    expect(FakeAudioContext.last).toBeUndefined();
  });

  it('débloque au toucher avec un échantillon muet, puis bippe', () => {
    audio.unlockAudio();
    const ctx = FakeAudioContext.last;
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.silentBuffers).toBe(1);
    audio.playRestEndSound();
    expect(ctx.oscillators).toBe(3);
  });

  it('relance un contexte suspendu (veille iOS) avant de bipper', async () => {
    const ctx = FakeAudioContext.last;
    ctx.state = 'interrupted';
    ctx.oscillators = 0;
    audio.playRestEndSound();
    expect(ctx.oscillators).toBe(0);
    await vi.waitFor(() => expect(ctx.oscillators).toBe(3));
    expect(ctx.resume).toHaveBeenCalled();
  });
});
