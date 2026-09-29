import { describe, it, expect } from 'vitest';
import {
  SoundManager,
  DEFAULT_SOUND_SETTINGS,
  LOW_PRIORITY_VOICE_LIMIT,
  MAX_VOICES,
  SPEED_OF_SOUND,
  clamp01,
  clampPan,
  distanceCutoff,
  distanceGain,
  propagationDelay,
  sanitizeSettings,
  type ImpactKind,
} from '../src/audio/Sound';

// ─────────────────────────────────────────────────────────────────────────────
// A minimal WebAudio mock. It is strict where browsers are strict (non-finite values,
// exponential ramps to 0, start() twice, negative times) so bad scheduling shows up here.
// ─────────────────────────────────────────────────────────────────────────────

function finite(...xs: number[]): void {
  for (const x of xs) if (typeof x !== 'number' || !Number.isFinite(x)) throw new TypeError(`non-finite value ${x}`);
}

interface ParamEvent {
  kind: 'set' | 'linear' | 'exp' | 'target' | 'cancel';
  value: number;
  time: number;
}

class MockParam {
  readonly events: ParamEvent[] = [];
  private v: number;
  constructor(v: number) {
    this.v = v;
  }
  get value(): number {
    return this.v;
  }
  set value(x: number) {
    finite(x);
    this.v = x;
  }
  private push(kind: ParamEvent['kind'], value: number, time: number): this {
    finite(value, time);
    if (time < 0) throw new RangeError('negative time');
    this.events.push({ kind, value, time });
    return this;
  }
  setValueAtTime(x: number, t: number) {
    return this.push('set', x, t);
  }
  linearRampToValueAtTime(x: number, t: number) {
    return this.push('linear', x, t);
  }
  exponentialRampToValueAtTime(x: number, t: number) {
    if (x === 0) throw new RangeError('exponential ramp to 0');
    return this.push('exp', x, t);
  }
  setTargetAtTime(x: number, t: number, tc: number) {
    finite(tc);
    if (tc < 0) throw new RangeError('negative time constant');
    return this.push('target', x, t);
  }
  cancelScheduledValues(t: number) {
    return this.push('cancel', 0, t);
  }
  /** Value the param is last scheduled to reach (or its static value). */
  get last(): number {
    for (let i = this.events.length - 1; i >= 0; i--) if (this.events[i].kind !== 'cancel') return this.events[i].value;
    return this.v;
  }
}

interface MockBuffer {
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
  getChannelData(c: number): Float32Array;
}

class MockNode {
  readonly outputs: unknown[] = [];
  disconnected = false;
  type = '';
  gain = new MockParam(1);
  frequency = new MockParam(350);
  detune = new MockParam(0);
  Q = new MockParam(1);
  pan = new MockParam(0);
  playbackRate = new MockParam(1);
  threshold = new MockParam(-24);
  knee = new MockParam(30);
  ratio = new MockParam(12);
  attack = new MockParam(0.003);
  release = new MockParam(0.25);
  constructor(
    readonly ctx: MockContext,
    readonly kind: string,
  ) {
    ctx.nodes.push(this);
  }
  connect<T>(dest: T): T {
    if (dest == null) throw new TypeError('connect() without destination');
    this.outputs.push(dest);
    this.disconnected = false;
    return dest;
  }
  disconnect(): void {
    this.outputs.length = 0;
    this.disconnected = true;
  }
}

class MockSource extends MockNode {
  startTime: number | null = null;
  stopTime: number | null = null;
  offset = 0;
  ended = false;
  loop = false;
  buffer: MockBuffer | null = null;
  onended: ((ev?: unknown) => void) | null = null;
  start(when = 0, offset = 0): void {
    finite(when, offset);
    if (when < 0 || offset < 0) throw new RangeError('negative start');
    if (this.startTime !== null) throw new Error('InvalidStateError: start() called twice');
    this.startTime = when;
    this.offset = offset;
    this.ctx.sources.push(this);
  }
  stop(when = 0): void {
    finite(when);
    if (this.startTime === null) throw new Error('InvalidStateError: stop() before start()');
    this.stopTime = when;
  }
  endTime(): number {
    if (this.stopTime !== null) return this.stopTime;
    if (this.buffer && !this.loop) return this.startTime! + this.buffer.duration / this.playbackRate.value;
    return Infinity;
  }
}

class MockContext {
  currentTime = 0;
  readonly sampleRate = 48000;
  state: 'running' | 'suspended' | 'closed' = 'running';
  readonly nodes: MockNode[] = [];
  readonly sources: MockSource[] = [];
  readonly destination: MockNode;
  resumeCalls = 0;
  constructor(private readonly resumable = true) {
    this.destination = new MockNode(this, 'destination');
  }
  createGain() {
    return new MockNode(this, 'gain');
  }
  createBiquadFilter() {
    const n = new MockNode(this, 'biquad');
    n.type = 'lowpass';
    return n;
  }
  createStereoPanner() {
    return new MockNode(this, 'panner');
  }
  createDynamicsCompressor() {
    return new MockNode(this, 'compressor');
  }
  createOscillator() {
    const n = new MockSource(this, 'osc');
    n.frequency.value = 440;
    n.type = 'sine';
    return n;
  }
  createBufferSource() {
    return new MockSource(this, 'buffer');
  }
  createBuffer(channels: number, length: number, sampleRate: number): MockBuffer {
    if (!(length > 0) || !(channels > 0)) throw new RangeError('bad buffer size');
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, sampleRate, numberOfChannels: channels, duration: length / sampleRate, getChannelData: (c) => data[c] };
  }
  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.resumable && this.state === 'suspended') this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
  /** Advances time and fires `ended` on every source whose end time has passed. */
  advance(dt: number): void {
    this.currentTime += dt;
    for (const s of [...this.sources]) {
      if (!s.ended && s.endTime() <= this.currentTime) {
        s.ended = true;
        s.onended?.call(s, {});
      }
    }
  }
  /** master gain, effects bus, engine bus (identified by wiring, not creation order) */
  buses() {
    const limiter = this.nodes.find((n) => n.kind === 'compressor')!;
    const master = this.nodes.find((n) => n.kind === 'gain' && n.outputs.includes(limiter))!;
    const [effects, engine] = this.nodes.filter((n) => n.kind === 'gain' && n.outputs.includes(master));
    return { limiter, master, effects, engine };
  }
}

function setup(opts: { state?: MockContext['state']; resumable?: boolean; settings?: typeof DEFAULT_SOUND_SETTINGS } = {}) {
  const ctx = new MockContext(opts.resumable ?? true);
  if (opts.state) ctx.state = opts.state;
  const sm = new SoundManager(opts.settings ?? DEFAULT_SOUND_SETTINGS, {
    createContext: () => ctx as unknown as BaseAudioContext,
  });
  return { ctx, sm };
}

/** Runs fn with console.warn captured (the manager logs the first internal error it swallows). */
function captureWarnings(fn: () => void): unknown[][] {
  const calls: unknown[][] = [];
  const orig = console.warn;
  console.warn = (...args: unknown[]) => void calls.push(args);
  try {
    fn();
  } finally {
    console.warn = orig;
  }
  return calls;
}

const IMPACTS: ImpactKind[] = ['penetration', 'nonpen', 'ricochet', 'ground', 'tree'];

function callEverything(sm: SoundManager): void {
  sm.cannon(120, { distance: 0 });
  sm.cannon(20, { distance: 300, pan: -0.7 });
  sm.machineGun({ distance: 50, pan: 0.3 });
  for (const k of IMPACTS) sm.impact(k, { distance: 120, pan: 0.2 });
  sm.explosion(1, { distance: 400 });
  sm.explosion(12, { distance: 20, pan: -1 });
  sm.uiClick();
  sm.reloadDone();
  sm.engine({ rpm: 0.5, load: 0.7, running: true });
  sm.engine({ rpm: 0.5, load: 0.7, running: false });
  sm.fire(true);
  sm.fire(false);
  sm.applySettings({ ...DEFAULT_SOUND_SETTINGS, muted: true });
  sm.applySettings(DEFAULT_SOUND_SETTINGS);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SoundManager without WebAudio', () => {
  it('this environment really has no AudioContext', () => {
    expect(typeof (globalThis as { AudioContext?: unknown }).AudioContext).toBe('undefined');
  });

  it('constructing and calling every method (before and after resume, after dispose) does not throw', () => {
    expect(() => {
      const a = new SoundManager();
      callEverything(a);
      a.resume();
      callEverything(a);
      a.dispose();
      a.dispose();
      callEverything(a);
      a.resume();

      const b = new SoundManager({ master: 1, effects: 1, engine: 1, muted: false });
      b.resume();
      b.cannon(NaN, { distance: NaN, pan: NaN });
      b.explosion(-5, { distance: -1 });
      b.impact('bogus' as ImpactKind, { distance: 10 });
      b.engine({ rpm: Infinity, load: -1, running: true });
      b.dispose();
    }).not.toThrow();
  });

  it('a context factory that returns null or throws is harmless', () => {
    let factoryCalls = 0;
    const a = new SoundManager(undefined, { createContext: () => null });
    const b = new SoundManager(undefined, {
      createContext: () => {
        factoryCalls++;
        throw new Error('no audio device');
      },
    });
    let warnings: unknown[][] = [];
    expect(() => {
      a.resume();
      callEverything(a);
      warnings = captureWarnings(() => {
        b.resume();
        b.resume();
        callEverything(b);
      });
      b.dispose();
    }).not.toThrow();
    expect(warnings).toHaveLength(1); // logged once, then suppressed
    expect(factoryCalls).toBe(1); // a failed init is not retried on every click
  });
});

describe('Sound settings', () => {
  it('defaults are in range and unmuted', () => {
    for (const k of ['master', 'effects', 'engine'] as const) {
      expect(DEFAULT_SOUND_SETTINGS[k]).toBeGreaterThan(0);
      expect(DEFAULT_SOUND_SETTINGS[k]).toBeLessThanOrEqual(1);
    }
    expect(DEFAULT_SOUND_SETTINGS.muted).toBe(false);
    expect(new SoundManager().getSettings()).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('applySettings clamps volumes to 0..1', () => {
    const sm = new SoundManager();
    sm.applySettings({ master: 1.5, effects: -0.2, engine: NaN, muted: true });
    expect(sm.getSettings()).toEqual({ master: 1, effects: 0, engine: 0, muted: true });
    sm.applySettings({ master: 0.25, effects: 0.5, engine: Infinity, muted: false });
    expect(sm.getSettings()).toEqual({ master: 0.25, effects: 0.5, engine: 1, muted: false });
  });

  it('the constructor clamps too, and partial updates keep the other fields', () => {
    const sm = new SoundManager({ master: 7, effects: -1, engine: 0.3, muted: false });
    expect(sm.getSettings()).toEqual({ master: 1, effects: 0, engine: 0.3, muted: false });
    sm.applySettings({ effects: 0.4 });
    expect(sm.getSettings()).toEqual({ master: 1, effects: 0.4, engine: 0.3, muted: false });
  });

  it('never mutates the defaults or the caller object', () => {
    const before = { ...DEFAULT_SOUND_SETTINGS };
    const mine = { master: 3, effects: 0.5, engine: 0.5, muted: false };
    const sm = new SoundManager(mine);
    sm.applySettings({ master: 0 });
    expect(DEFAULT_SOUND_SETTINGS).toEqual(before);
    expect(mine.master).toBe(3);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('clamp01 / clampPan', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
    expect(clampPan(undefined)).toBe(0);
    expect(clampPan(NaN)).toBe(0);
    expect(clampPan(-3)).toBe(-1);
    expect(clampPan(0.5)).toBe(0.5);
    expect(clampPan(0.001)).toBe(0);
  });
});

describe('distance helpers', () => {
  const ds = [0, 1, 10, 60, 100, 250, 500, 1000, 1500, 2000];

  it('distanceGain: 1 at 0 m, 1/2 at 60 m, strictly decreasing, within (0, 1]', () => {
    expect(distanceGain(0)).toBe(1);
    expect(distanceGain(60)).toBeCloseTo(0.5, 6);
    expect(distanceGain(600)).toBeCloseTo(1 / 11, 6);
    for (let i = 1; i < ds.length; i++) expect(distanceGain(ds[i])).toBeLessThan(distanceGain(ds[i - 1]));
    for (const d of ds) {
      expect(distanceGain(d)).toBeGreaterThan(0);
      expect(distanceGain(d)).toBeLessThanOrEqual(1);
    }
    expect(distanceGain(-50)).toBe(1);
    expect(distanceGain(NaN)).toBe(1);
    expect(distanceGain(Infinity)).toBe(0);
  });

  it('distanceCutoff: ~12 kHz at 0 m falling to ~1.5 kHz at 2 km, then held', () => {
    expect(distanceCutoff(0)).toBeCloseTo(12000, 3);
    expect(distanceCutoff(2000)).toBeCloseTo(1500, 3);
    expect(distanceCutoff(1000)).toBeCloseTo(Math.sqrt(12000 * 1500), 3); // exponential in distance
    for (let i = 1; i < ds.length; i++) expect(distanceCutoff(ds[i])).toBeLessThan(distanceCutoff(ds[i - 1]));
    expect(distanceCutoff(5000)).toBeCloseTo(1500, 3);
    expect(distanceCutoff(-10)).toBeCloseTo(12000, 3);
    expect(distanceCutoff(NaN)).toBeCloseTo(12000, 3);
  });

  it('propagationDelay = distance / 343 s', () => {
    expect(SPEED_OF_SOUND).toBe(343);
    expect(propagationDelay(0)).toBe(0);
    expect(propagationDelay(343)).toBeCloseTo(1, 9);
    expect(propagationDelay(1029)).toBeCloseTo(3, 9);
    for (let i = 1; i < ds.length; i++) expect(propagationDelay(ds[i])).toBeGreaterThan(propagationDelay(ds[i - 1]));
    expect(propagationDelay(-100)).toBe(0);
    expect(propagationDelay(NaN)).toBe(0);
  });
});

describe('SoundManager with a mock AudioContext', () => {
  it('creates nothing before resume(); resume wires master → limiter → trim → destination and the buses', () => {
    const { ctx, sm } = setup();
    sm.cannon(100, { distance: 0 });
    sm.engine({ rpm: 0.2, load: 0.2, running: true });
    expect(ctx.nodes).toHaveLength(1); // just the destination
    sm.resume();
    const { limiter, master, effects, engine } = ctx.buses();
    const trim = ctx.nodes.find((n) => n.kind === 'gain' && n.outputs.includes(ctx.destination))!;
    expect(limiter.outputs).toContain(trim);
    expect(trim.gain.value).toBeLessThan(1);
    expect(master.gain.value).toBeCloseTo(0.8, 6);
    expect(effects.gain.value).toBeCloseTo(0.9, 6);
    expect(engine.gain.value).toBeCloseTo(0.6, 6);
    // resume() is idempotent: no second graph
    const n = ctx.nodes.length;
    sm.resume();
    expect(ctx.buses().master).toBe(master);
    // (the engine requested before resume starts now, so compare only bus count)
    expect(ctx.nodes.filter((x) => x.kind === 'compressor')).toHaveLength(1);
    expect(ctx.nodes.length).toBeGreaterThanOrEqual(n);
  });

  it('every one-shot starts sources, and all its nodes are released when it ends', () => {
    const { ctx, sm } = setup();
    sm.resume();
    const base = ctx.nodes.length;
    const warnings = captureWarnings(() => {
      const plays: Array<[string, () => void]> = [
        ['cannon', () => sm.cannon(88, { distance: 150, pan: 0.4 })],
        ['mg', () => sm.machineGun({ distance: 30 })],
        ...IMPACTS.map((k): [string, () => void] => [k, () => sm.impact(k, { distance: 80, pan: -0.3 })]),
        ['explosion small', () => sm.explosion(1, { distance: 200 })],
        ['explosion big', () => sm.explosion(15, { distance: 10 })],
        ['ui', () => sm.uiClick()],
        ['reload', () => sm.reloadDone()],
      ];
      for (const [, play] of plays) {
        const before = ctx.sources.length;
        const voices = sm.activeVoices;
        play();
        expect(ctx.sources.length).toBeGreaterThan(before);
        expect(sm.activeVoices).toBe(voices + 1);
      }
    });
    expect(warnings).toHaveLength(0);
    expect(sm.activeVoices).toBe(11);
    ctx.advance(10);
    expect(sm.activeVoices).toBe(0);
    const created = ctx.nodes.slice(base);
    expect(created.length).toBeGreaterThan(30);
    expect(created.filter((n) => !n.disconnected)).toHaveLength(0);
    // the buses stay connected
    expect(ctx.buses().effects.disconnected).toBe(false);
  });

  it('distance → propagation delay, low-pass cutoff, gain; pan → StereoPanner', () => {
    const { ctx, sm } = setup();
    sm.resume();
    ctx.advance(5);
    const base = ctx.sources.length;
    sm.cannon(120, { distance: 686, pan: 0.5 });
    const started = ctx.sources.slice(base);
    expect(started.length).toBeGreaterThan(2);
    for (const s of started) expect(s.startTime!).toBeCloseTo(5 + 0.01 + 686 / 343, 6);
    const panner = ctx.nodes.find((n) => n.kind === 'panner')!;
    expect(panner.pan.value).toBe(0.5);
    const lp = ctx.nodes.find((n) => n.kind === 'biquad' && n.outputs.includes(panner))!;
    expect(lp.type).toBe('lowpass');
    expect(lp.frequency.value).toBeCloseTo(distanceCutoff(686), 3);
    // a close, centred shot needs neither a panner nor the distance low-pass
    const nodes = ctx.nodes.length;
    sm.reloadDone();
    const added = ctx.nodes.slice(nodes);
    expect(added.filter((n) => n.kind === 'panner')).toHaveLength(0);
    expect(added.filter((n) => n.kind === 'biquad' && n.outputs.includes(ctx.buses().effects))).toHaveLength(0);
    for (const s of ctx.sources.slice(base + started.length)) expect(s.startTime!).toBeGreaterThanOrEqual(5.01 - 1e-9);
  });

  it('far quieter sounds get smaller envelopes; inaudibly far sounds are not scheduled', () => {
    const { ctx, sm } = setup();
    sm.resume();
    const peakOf = (distance: number) => {
      const base = ctx.nodes.length;
      sm.impact('nonpen', { distance });
      const envs = ctx.nodes.slice(base).filter((n) => n.kind === 'gain' && n.gain.events.some((e) => e.kind === 'linear'));
      return Math.max(...envs.map((n) => Math.max(...n.gain.events.map((e) => e.value))));
    };
    const near = peakOf(0);
    const far = peakOf(600);
    expect(far / near).toBeCloseTo(distanceGain(600), 3);
    const voices = sm.activeVoices;
    sm.machineGun({ distance: 1e6 });
    sm.explosion(50, { distance: Infinity });
    expect(sm.activeVoices).toBe(voices);
  });

  it('rapid machine-gun fire is capped; high-priority sounds still get through up to the hard cap', () => {
    const { ctx, sm } = setup();
    sm.resume();
    for (let i = 0; i < 200; i++) sm.machineGun({ distance: 800 }); // ~2.3 s in flight, none end yet
    expect(sm.activeVoices).toBe(LOW_PRIORITY_VOICE_LIMIT);
    sm.impact('ground', { distance: 800 });
    expect(sm.activeVoices).toBe(LOW_PRIORITY_VOICE_LIMIT);
    sm.cannon(100, { distance: 100 });
    expect(sm.activeVoices).toBe(LOW_PRIORITY_VOICE_LIMIT + 1);
    for (let i = 0; i < 100; i++) sm.explosion(2, { distance: 100 });
    expect(sm.activeVoices).toBe(MAX_VOICES);
    ctx.advance(30);
    expect(sm.activeVoices).toBe(0);
    sm.machineGun({ distance: 0 });
    expect(sm.activeVoices).toBe(1);
  });

  it('muted, zero effects volume or a suspended context → one-shots are no-ops', () => {
    const { ctx, sm } = setup();
    sm.resume();
    const count = () => ctx.sources.length;
    const n0 = count();
    sm.applySettings({ muted: true });
    sm.cannon(100, { distance: 0 });
    sm.uiClick();
    expect(count()).toBe(n0);
    sm.applySettings({ muted: false, effects: 0 });
    sm.cannon(100, { distance: 0 });
    sm.explosion(10, { distance: 0 });
    expect(count()).toBe(n0);
    sm.uiClick(); // UI click only needs master
    expect(count()).toBe(n0 + 1);
    sm.applySettings({ effects: 1, master: 0 });
    sm.impact('penetration', { distance: 0 });
    expect(count()).toBe(n0 + 1);

    const blocked = setup({ state: 'suspended', resumable: false });
    blocked.sm.resume();
    expect(blocked.ctx.resumeCalls).toBe(1);
    blocked.sm.cannon(100, { distance: 0 });
    expect(blocked.ctx.sources).toHaveLength(0);
    blocked.ctx.state = 'running';
    blocked.sm.cannon(100, { distance: 0 });
    expect(blocked.ctx.sources.length).toBeGreaterThan(0);
  });

  it('applySettings ramps the bus gains (no jumps) and skips unchanged values', () => {
    const { ctx, sm } = setup();
    sm.resume();
    const { master, effects, engine } = ctx.buses();
    sm.applySettings({ muted: true, effects: 0.3, engine: 1.7 });
    expect(master.gain.events.some((e) => e.kind === 'target' && e.value === 0)).toBe(true);
    expect(effects.gain.last).toBeCloseTo(0.3, 6);
    expect(engine.gain.last).toBe(1);
    const n = master.gain.events.length;
    sm.applySettings({ muted: true, effects: 0.3, engine: 1 });
    expect(master.gain.events).toHaveLength(n);
    sm.applySettings({ muted: false });
    expect(master.gain.last).toBeCloseTo(0.8, 6);
  });

  it('bad inputs never reach the audio graph as NaN / Infinity', () => {
    const { ctx, sm } = setup();
    sm.resume();
    const warnings = captureWarnings(() => {
      sm.cannon(NaN, { distance: NaN, pan: NaN });
      sm.cannon(1e9, { distance: -5, pan: 40 });
      sm.explosion(NaN, { distance: 0 });
      sm.explosion(1e12, { distance: 3 });
      sm.explosion(-1, { distance: 3 });
      sm.impact('bogus' as ImpactKind, { distance: 3 });
      sm.engine({ rpm: NaN, load: Infinity, running: true });
      sm.engine({ rpm: -2, load: NaN, running: true });
      sm.applySettings({ master: NaN, effects: Infinity });
    });
    expect(warnings).toHaveLength(0);
    expect(sm.activeVoices).toBe(5);
    expect(ctx.nodes.find((n) => n.kind === 'panner')!.pan.value).toBe(1);
  });

  it('engine: follows rpm (30–120 Hz) and load, fades out, revives without new oscillators', () => {
    const { ctx, sm } = setup();
    sm.resume();
    const warnings = captureWarnings(() => sm.engine({ rpm: 0, load: 0, running: true }));
    expect(warnings).toHaveLength(0);
    const oscs = ctx.sources.filter((s) => s.kind === 'osc');
    const saw = oscs.find((s) => s.type === 'sawtooth')!;
    const square = oscs.find((s) => s.type === 'square')!;
    expect(saw.detune.value).not.toBe(square.detune.value); // detuned pair
    expect(saw.frequency.last).toBeCloseTo(30, 6);
    const busIn = ctx.buses().engine;
    const out = ctx.nodes.find((n) => n.kind === 'gain' && n.outputs.includes(busIn))!;
    const lp = ctx.nodes.find((n) => n.kind === 'biquad' && n.outputs.includes(out))!;
    const idleLevel = out.gain.last;
    const idleCutoff = lp.frequency.last;

    sm.engine({ rpm: 1, load: 1, running: true });
    expect(saw.frequency.last).toBeCloseTo(120, 6);
    expect(square.frequency.last).toBeCloseTo(120, 6);
    expect(out.gain.last).toBeGreaterThan(idleLevel);
    expect(lp.frequency.last).toBeGreaterThan(idleCutoff);
    // per-frame calls with the same state don't pile up automation events
    const events = saw.frequency.events.length;
    for (let i = 0; i < 60; i++) sm.engine({ rpm: 1, load: 1, running: true });
    expect(saw.frequency.events).toHaveLength(events);

    const sources = ctx.sources.length;
    sm.engine({ rpm: 1, load: 1, running: false });
    expect(out.gain.last).toBe(0);
    sm.engine({ rpm: 0.5, load: 0.5, running: true });
    expect(ctx.sources).toHaveLength(sources); // revived, not recreated
    expect(out.gain.last).toBeGreaterThan(0);
    expect(saw.stopTime).toBeNull();
    // engine volume 0 → fades out as well
    sm.applySettings({ engine: 0 });
    expect(out.gain.last).toBe(0);
    sm.dispose();
  });

  it('engine volume 0 or muted → engine() creates nothing', () => {
    const { ctx, sm } = setup({ settings: { ...DEFAULT_SOUND_SETTINGS, engine: 0 } });
    sm.resume();
    sm.engine({ rpm: 1, load: 1, running: true });
    expect(ctx.sources).toHaveLength(0);
    sm.applySettings({ engine: 0.5, muted: true });
    sm.engine({ rpm: 1, load: 1, running: true });
    expect(ctx.sources).toHaveLength(0);
    sm.applySettings({ muted: false });
    sm.engine({ rpm: 1, load: 1, running: true });
    expect(ctx.sources.length).toBeGreaterThan(0);
  });

  it('fire: one looping crackle source while burning, requested before resume works too', () => {
    const { ctx, sm } = setup();
    sm.fire(true);
    sm.resume();
    const loops = () => ctx.sources.filter((s) => s.kind === 'buffer' && s.loop && s.buffer!.duration > 3.5);
    expect(loops()).toHaveLength(1);
    sm.fire(true);
    sm.fire(true);
    expect(loops()).toHaveLength(1);
    const out = ctx.nodes.find((n) => n.kind === 'gain' && n.outputs.includes(ctx.buses().effects))!;
    expect(out.gain.last).toBeGreaterThan(0);
    sm.fire(false);
    expect(out.gain.last).toBe(0);
    sm.fire(true);
    expect(loops()).toHaveLength(1);
    sm.dispose();
  });

  it('faded loops are torn down after ~1 s', async () => {
    const { ctx, sm } = setup();
    sm.resume();
    const base = ctx.nodes.length; // destination + master bus chain + effects / engine buses
    sm.engine({ rpm: 0.3, load: 0.3, running: true });
    sm.fire(true);
    expect(ctx.nodes.length).toBeGreaterThan(base);
    sm.engine({ rpm: 0.3, load: 0.3, running: false });
    sm.fire(false);
    await new Promise((r) => setTimeout(r, 1150));
    expect(ctx.sources.filter((s) => s.stopTime === null)).toHaveLength(0);
    expect(ctx.nodes.slice(base).filter((n) => !n.disconnected)).toHaveLength(0);
    // and they start fresh afterwards
    sm.engine({ rpm: 0.3, load: 0.3, running: true });
    expect(ctx.sources.filter((s) => s.stopTime === null).length).toBeGreaterThan(0);
    sm.dispose();
  });

  it('dispose stops everything, closes the context, and later calls are no-ops', () => {
    const { ctx, sm } = setup();
    sm.resume();
    sm.engine({ rpm: 0.5, load: 0.5, running: true });
    sm.fire(true);
    sm.cannon(100, { distance: 1000 });
    sm.machineGun({ distance: 10 });
    sm.dispose();
    expect(ctx.state).toBe('closed');
    expect(sm.activeVoices).toBe(0);
    expect(ctx.sources.filter((s) => s.stopTime === null)).toHaveLength(0);
    expect(ctx.nodes.slice(1).filter((n) => !n.disconnected)).toHaveLength(0);
    const n = ctx.nodes.length;
    expect(() => {
      callEverything(sm);
      sm.resume();
    }).not.toThrow();
    expect(ctx.nodes).toHaveLength(n);
  });
});
