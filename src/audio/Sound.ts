/**
 * Synthesized game audio — WebAudio only, no audio asset files.
 *
 * Graph:
 *   one-shot voice ─ [distance low-pass] ─ [stereo pan] ─→ effects bus ──┐
 *   fire crackle loop ───────────────────────────────────→ effects bus ──┤
 *   engine loop ─────────────────────────────────────────→ engine bus ───┼─→ master ─→ limiter ─→ trim ─→ destination
 *   UI click ────────────────────────────────────────────────────────────┘
 *
 * Every public method is safe to call at any time: without WebAudio (Node, tests, old
 * browsers), before resume() has created the context, while muted and after dispose().
 * Errors inside the audio graph are swallowed (the first one is logged): sound must never
 * crash the game.
 *
 * Self-contained on purpose: no imports.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public types & constants
// ─────────────────────────────────────────────────────────────────────────────

export interface SoundSettings {
  /** 0..1 */ master: number;
  /** 0..1, weapons / impacts / explosions */ effects: number;
  /** 0..1, own-vehicle engine */ engine: number;
  muted: boolean;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { master: 0.8, effects: 0.9, engine: 0.6, muted: false };

/** Where a sound comes from, relative to the listener */
export interface SoundSource {
  /** metres from the listener; used for volume falloff, low-pass (distant sounds lose highs) and a propagation delay of distance / 343 s */
  distance: number;
  /** -1 (left) .. 1 (right) stereo pan; default 0 */
  pan?: number;
}

export type ImpactKind = 'penetration' | 'nonpen' | 'ricochet' | 'ground' | 'tree';

export interface EngineSoundState {
  /** 0..1, idle..max */ rpm: number;
  /** 0..1, throttle */ load: number;
  /** false fades the engine out */ running: boolean;
}

export interface SoundManagerOptions {
  /**
   * Audio context factory (tests / offline rendering). Default: `new AudioContext()` (or
   * `webkitAudioContext`) when available. The manager owns the context and closes it in dispose().
   */
  createContext?: () => BaseAudioContext | null | undefined;
}

/** m/s */
export const SPEED_OF_SOUND = 343;
/** Low-priority one-shots (MG rounds, ground / tree hits) are dropped once this many voices are active. */
export const LOW_PRIORITY_VOICE_LIMIT = 24;
/** Medium priority (non-pen, ricochet, UI click). */
export const MID_PRIORITY_VOICE_LIMIT = 32;
/** Hard cap on simultaneous one-shot voices; even cannon shots / explosions are dropped beyond it. */
export const MAX_VOICES = 40;

/** Distance at which the falloff gain is 1/2. */
const GAIN_REF_DISTANCE = 60;
const NEAR_CUTOFF_HZ = 12000;
const FAR_CUTOFF_HZ = 1500;
const FAR_CUTOFF_DISTANCE = 2000;
/** One-shots quieter than this after distance attenuation are not scheduled at all. */
const MIN_AUDIBLE_GAIN = 0.004;
/** The distance low-pass is left out (one node less) while its cutoff would be above this. */
const LOWPASS_BYPASS_HZ = 11000;
/** Scheduling lookahead so attacks are never clipped by a late render quantum. */
const LOOKAHEAD = 0.01;
/** Time constant of settings changes (s) — short ramp, no clicks. */
const SETTINGS_TC = 0.02;
/** Time constant of loop (engine / fire) fade-outs, and how long until the faded loop is torn down. */
const LOOP_FADE_TC = 0.15;
const LOOP_STOP_MS = 1000;
const FIRE_LEVEL = 0.45;
/** Post-limiter gain (cancels the compressor's automatic makeup gain). */
const LIMITER_TRIM = 0.85;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for tests)
// ─────────────────────────────────────────────────────────────────────────────

/** Clamps to 0..1; NaN / non-numbers become 0. */
export function clamp01(v: number): number {
  return v >= 1 ? 1 : v > 0 ? v : 0;
}

/** Merges `s` over `base` and clamps every volume to 0..1. */
export function sanitizeSettings(
  s: Partial<SoundSettings> | null | undefined,
  base: SoundSettings = DEFAULT_SOUND_SETTINGS,
): SoundSettings {
  const src: Partial<SoundSettings> = s ?? {};
  const vol = (k: 'master' | 'effects' | 'engine'): number => clamp01(src[k] === undefined ? base[k] : (src[k] as number));
  return {
    master: vol('master'),
    effects: vol('effects'),
    engine: vol('engine'),
    muted: src.muted === undefined ? !!base.muted : !!src.muted,
  };
}

/** Falloff gain in (0, 1]: 1 / (1 + d / 60). Negative / NaN distances count as 0. */
export function distanceGain(distance: number): number {
  const d = distance > 0 ? distance : 0;
  return 1 / (1 + d / GAIN_REF_DISTANCE);
}

/** Air-absorption low-pass cutoff: 12 kHz at 0 m falling exponentially to 1.5 kHz at 2 km (held beyond). */
export function distanceCutoff(distance: number): number {
  const d = distance > 0 ? Math.min(distance, FAR_CUTOFF_DISTANCE) : 0;
  return NEAR_CUTOFF_HZ * Math.pow(FAR_CUTOFF_HZ / NEAR_CUTOFF_HZ, d / FAR_CUTOFF_DISTANCE);
}

/** Seconds until the sound reaches the listener. */
export function propagationDelay(distance: number): number {
  return distance > 0 ? distance / SPEED_OF_SOUND : 0;
}

/** -1..1; NaN → 0; tiny values snap to 0 so no panner node is needed. */
export function clampPan(pan: number | undefined): number {
  if (pan === undefined || !Number.isFinite(pan)) return 0;
  if (Math.abs(pan) < 0.01) return 0;
  return pan > 1 ? 1 : pan < -1 ? -1 : pan;
}

function clamp(v: number, lo: number, hi: number): number {
  return v >= hi ? hi : v > lo ? v : lo;
}

function finiteOr(v: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

// ─────────────────────────────────────────────────────────────────────────────
// Procedural buffers (generated once per context)
// ─────────────────────────────────────────────────────────────────────────────

interface SynthBuffers {
  white: AudioBuffer;
  brown: AudioBuffer;
  /** a few pre-rendered MG shot variants */
  shots: AudioBuffer[];
  /** fire crackle loop, generated lazily */
  fire: AudioBuffer | null;
}

/** One-pole low-pass coefficient. */
function onePole(fc: number, sr: number): number {
  return 1 - Math.exp((-2 * Math.PI * fc) / sr);
}

function whiteNoise(n: number): Float32Array {
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return d;
}

/** White noise through a one-pole low-pass at 120 Hz: flat below, −6 dB/oct above ("brown"). */
function brownNoise(n: number, sr: number): Float32Array {
  const a = onePole(120, sr);
  const d = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    y += a * (Math.random() * 2 - 1 - y);
    d[i] = y;
  }
  return d;
}

/** Scales to `peak` (optionally removing DC first — only for loops, a one-shot must end at 0). */
function normalize(d: Float32Array, peak: number, removeDc: boolean): Float32Array {
  if (removeDc) {
    let mean = 0;
    for (let i = 0; i < d.length; i++) mean += d[i];
    mean /= d.length || 1;
    for (let i = 0; i < d.length; i++) d[i] -= mean;
  }
  let max = 0;
  for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
  const k = max > 0 ? peak / max : 0;
  for (let i = 0; i < d.length; i++) d[i] *= k;
  return d;
}

/** `raw` holds len + fade samples; the extra tail is equal-power crossfaded into the head so the result loops seamlessly. */
function makeLoop(raw: Float32Array, len: number): Float32Array {
  const fade = raw.length - len;
  const out = raw.slice(0, len);
  for (let i = 0; i < fade; i++) {
    const x = i / fade;
    out[i] = raw[i] * Math.sqrt(x) + raw[len + i] * Math.sqrt(1 - x);
  }
  return out;
}

/** One machine-gun round: band-passed noise crack + low-passed noise body + short pitched thump. */
function gunshot(sr: number): Float32Array {
  const n = Math.floor(sr * 0.14);
  const d = new Float32Array(n);
  const aHi = onePole(6500, sr);
  const aLo = onePole(900, sr);
  const aBody = onePole(450, sr);
  const f0 = rand(95, 130);
  const fadeStart = n - Math.floor(sr * 0.01);
  let hi = 0;
  let lo = 0;
  let body = 0;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const w = Math.random() * 2 - 1;
    hi += aHi * (w - hi);
    lo += aLo * (hi - lo);
    body += aBody * (w - body);
    phase += (2 * Math.PI * f0 * (0.6 + 0.4 * Math.exp(-t / 0.02))) / sr;
    const crack = (hi - lo) * Math.exp(-t / 0.007);
    const boom = body * 3 * Math.exp(-t / 0.03);
    const thump = Math.sin(phase) * 0.35 * Math.exp(-t / 0.025);
    let s = (crack + boom + thump) * Math.min(1, t / 0.0004);
    if (i > fadeStart) s *= (n - i) / (n - fadeStart);
    d[i] = s;
  }
  return normalize(d, 0.9, false);
}

/** Burning-vehicle loop: wandering low roar + sparse random crackles and pops, baked into a seamless loop. */
function fireLoop(sr: number, seconds = 4): Float32Array {
  const len = Math.floor(sr * seconds);
  const n = len + Math.floor(sr * 0.1);
  const raw = new Float32Array(n);
  const aRoar = onePole(350, sr);
  const aHp = onePole(1800, sr);
  const aMod = onePole(3, sr);
  let r1 = 0;
  let r2 = 0;
  let lp = 0;
  let mod = 0.7;
  let modTarget = 0.7;
  let crackle = 0;
  let crackleDecay = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    r1 += aRoar * (w - r1);
    r2 += aRoar * (r1 - r2);
    if (Math.random() < 6 / sr) modTarget = rand(0.45, 1);
    mod += aMod * (modTarget - mod);
    if (Math.random() < 22 / sr) {
      const big = Math.random() < 0.12;
      const amp = big ? rand(0.7, 1) : 0.1 + 0.5 * Math.random() ** 2;
      crackle = Math.max(crackle, amp);
      const tau = big ? rand(0.004, 0.008) : rand(0.0006, 0.0031);
      crackleDecay = Math.exp(-1 / (tau * sr));
    }
    lp += aHp * (w - lp);
    raw[i] = r2 * 5 * mod + (w - lp) * crackle;
    crackle *= crackleDecay;
  }
  return normalize(makeLoop(raw, len), 0.9, true);
}

function toBuffer(ctx: BaseAudioContext, data: Float32Array): AudioBuffer {
  const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}

function makeBuffers(ctx: BaseAudioContext): SynthBuffers {
  const sr = ctx.sampleRate;
  const brownLen = Math.floor(sr * 3);
  return {
    white: toBuffer(ctx, normalize(whiteNoise(Math.floor(sr * 2)), 0.9, true)),
    brown: toBuffer(ctx, normalize(makeLoop(brownNoise(brownLen + Math.floor(sr * 0.2), sr), brownLen), 0.95, true)),
    shots: [0, 1, 2].map(() => toBuffer(ctx, gunshot(sr))),
    fire: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph helpers
// ─────────────────────────────────────────────────────────────────────────────

function chain(...nodes: AudioNode[]): void {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
}

/** Exponential parameter sweep (both ends forced positive). */
function sweep(p: AudioParam, from: number, to: number, at: number, dur: number): void {
  p.setValueAtTime(Math.max(from, 1e-4), at);
  p.exponentialRampToValueAtTime(Math.max(to, 1e-4), at + Math.max(dur, 0.001));
}

/** Smoothly moves a param to `v` unless it is already (within 0.3 %) heading there. Returns the new target. */
function glide(p: AudioParam, last: number, v: number, now: number, tc: number): number {
  if (Math.abs(last - v) <= Math.abs(v) * 0.003) return last; // also false for NaN `last` → update
  p.setTargetAtTime(v, now, tc);
  return v;
}

function audioContextCtor(): (new (opts?: AudioContextOptions) => AudioContext) | undefined {
  const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return g.AudioContext ?? g.webkitAudioContext;
}

function isOfflineContext(ctx: BaseAudioContext): boolean {
  return typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
}

/**
 * One scheduled one-shot sound: owns its nodes and releases them (disconnect + voice slot)
 * once every source it started has ended.
 */
class Voice {
  /** Where this voice's layers connect: the distance low-pass / panner chain, or the bus. */
  out: AudioNode;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private pending = 0;
  private done = false;

  constructor(
    readonly ctx: BaseAudioContext,
    /** start time, including propagation delay */
    readonly t0: number,
    /** distance gain, folded into every envelope */
    readonly g: number,
    dest: AudioNode,
    private readonly onDone: (v: Voice) => void,
  ) {
    this.out = dest;
  }

  add<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  /** Envelope: linear attack to peak·g, optional hold, then exponential decay by 60 dB. */
  env(peak: number, attack: number, decay: number, hold = 0, at = this.t0): GainNode {
    const node = this.add(this.ctx.createGain());
    const p = node.gain;
    const top = Math.max(peak * this.g, 1e-5);
    const a = Math.max(attack, 0.0005);
    p.value = 0;
    p.setValueAtTime(0, at);
    p.linearRampToValueAtTime(top, at + a);
    if (hold > 0) p.setValueAtTime(top, at + a + hold);
    p.exponentialRampToValueAtTime(top * 1e-3, at + a + hold + Math.max(decay, 0.001));
    return node;
  }

  /** Static gain, scaled by the distance gain. */
  level(value: number): GainNode {
    const node = this.add(this.ctx.createGain());
    node.gain.value = value * this.g;
    return node;
  }

  filter(type: BiquadFilterType, freq: number, q = Math.SQRT1_2): BiquadFilterNode {
    const f = this.add(this.ctx.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /** Looping noise from a random offset, playing [at, at + dur]. */
  noise(buf: AudioBuffer, at: number, dur: number, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    this.play(s, at, at + dur, Math.random() * buf.duration * 0.9);
    return s;
  }

  /** A one-shot buffer played to its end. */
  sample(buf: AudioBuffer, at: number, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    this.play(s, at);
    return s;
  }

  osc(type: OscillatorType, freq: number, at: number, dur: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    this.play(o, at, at + dur);
    return o;
  }

  private play(src: AudioScheduledSourceNode, start: number, stop?: number, offset?: number): void {
    this.add(src);
    this.sources.push(src);
    this.pending++;
    src.onended = () => {
      if (--this.pending <= 0) this.finish();
    };
    if (offset !== undefined) (src as AudioBufferSourceNode).start(start, offset);
    else src.start(start);
    if (stop !== undefined) src.stop(stop);
  }

  /** Call after building: a voice that started nothing is released immediately. */
  seal(): void {
    if (this.pending === 0) this.finish();
  }

  /** Hard stop (dispose / build error). */
  kill(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* never started or already stopped */
      }
    }
    this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    for (const s of this.sources) s.onended = null;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.nodes.length = 0;
    this.sources.length = 0;
    this.onDone(this);
  }
}

/** A continuous sound (engine / fire) that fades out and is torn down a little later. */
interface LoopVoice {
  out: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  fading: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

interface EngineVoice extends LoopVoice {
  oscs: OscillatorNode[];
  sub: OscillatorNode;
  subGain: GainNode;
  lp: BiquadFilterNode;
  rumble: GainNode;
  rumbleSrc: AudioBufferSourceNode;
  /** last targets sent to the params (NaN = force an update) */
  last: { f: number; fc: number; level: number; rumble: number; rate: number; sub: number };
}

type Bus = 'effects' | 'ui';

// ─────────────────────────────────────────────────────────────────────────────
// SoundManager
// ─────────────────────────────────────────────────────────────────────────────

export class SoundManager {
  private settings: SoundSettings;
  private readonly createCtx: SoundManagerOptions['createContext'];
  private ctx: BaseAudioContext | null = null;
  private offline = false;
  private disposed = false;
  private initFailed = false;
  private warned = false;

  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private trim: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private engineBus: GainNode | null = null;
  /** last gain targets applied to master / effects / engine buses */
  private busTargets = [NaN, NaN, NaN];
  private buffers: SynthBuffers | null = null;

  private readonly voices = new Set<Voice>();
  private engineState: EngineSoundState = { rpm: 0, load: 0, running: false };
  private engineVoice: EngineVoice | null = null;
  private fireWanted = false;
  private fireVoice: LoopVoice | null = null;
  private lastClick = -Infinity;

  constructor(settings?: SoundSettings, options?: SoundManagerOptions) {
    this.settings = sanitizeSettings(settings);
    this.createCtx = options?.createContext;
  }

  /** Current (sanitized) settings — a copy. */
  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  /** Number of one-shot voices currently scheduled or playing (loops not included). */
  get activeVoices(): number {
    return this.voices.size;
  }

  /** Must be safe to call anywhere; creates/resumes the AudioContext (browsers require a user gesture — the game calls this from click/keydown handlers). */
  resume(): void {
    this.safe(() => {
      if (this.disposed) return;
      if (!this.ctx && !this.initFailed) this.init();
      const ctx = this.ctx;
      if (!ctx) return;
      if (!this.offline && ctx.state !== 'running' && ctx.state !== 'closed') {
        const p = (ctx as AudioContext).resume?.();
        if (p && typeof p.then === 'function') {
          p.then(
            () => this.safe(() => this.syncLoops()),
            () => undefined,
          );
        }
      }
      this.syncLoops();
    });
  }

  /** Accepts a full or partial settings object; volumes are clamped to 0..1 and applied with a short ramp. */
  applySettings(s: Partial<SoundSettings>): void {
    this.safe(() => {
      this.settings = sanitizeSettings(s, this.settings);
      if (this.disposed) return;
      this.applyGains(true);
      this.syncLoops();
    });
  }

  /** Main gun shot: deep boom + sharp crack, scaled by calibre (mm) */
  cannon(caliber: number, src: SoundSource): void {
    const cal = clamp(finiteOr(caliber, 75), 5, 250);
    // 0 = 20 mm autocannon … 1 = 155 mm; a bit beyond for super-heavies
    const k = clamp((cal - 20) / 135, 0, 1.2);
    const kk = Math.min(k, 1);
    this.oneShot(src, MAX_VOICES, (v, b) => {
      const t = v.t0;
      const L = 0.55 + 0.4 * kk;
      // 1) supersonic crack / muzzle-blast transient
      const crackDecay = 0.07 + 0.08 * k;
      chain(
        v.noise(b.white, t, crackDecay + 0.05, rand(0.9, 1.1)),
        v.filter('highpass', 1100 - 300 * kk, 0.7),
        v.env(0.5 * L, 0.0008, crackDecay),
        v.out,
      );
      // 2) blast — low-passed noise whose cutoff collapses quickly
      const blastDecay = 0.25 + 0.2 * k;
      const blp = v.filter('lowpass', 3000, 0.8);
      sweep(blp.frequency, 3200 - 1000 * kk, 350 - 150 * kk, t, 0.2 + 0.1 * k);
      chain(v.noise(b.white, t, blastDecay + 0.05), blp, v.env(0.55 * L, 0.002, blastDecay), v.out);
      // 3) boom body — deep noise with a 0.6–1.2 s decay
      const bodyDecay = 0.6 + 0.6 * kk;
      const lp = v.filter('lowpass', 900, 0.9);
      sweep(lp.frequency, 1200 - 500 * kk, 160 - 70 * kk, t, 0.35);
      chain(v.noise(b.brown, t, bodyDecay + 0.05, rand(0.85, 1.05)), lp, v.env(0.75 * L, 0.003, bodyDecay), v.out);
      // 4) thump pitched by calibre
      const f0 = 110 - 55 * k;
      const thumpDecay = 0.35 + 0.35 * kk;
      const o = v.osc('sine', f0, t, thumpDecay + 0.05);
      sweep(o.frequency, f0, 45 - 18 * k, t, 0.2 + 0.1 * k);
      chain(o, v.env(0.7 * L, 0.002, thumpDecay), v.out);
    });
  }

  /** One machine-gun round; cheap: one pre-rendered shot buffer + one gain (+ distance filter / panner). */
  machineGun(src: SoundSource): void {
    this.oneShot(src, LOW_PRIORITY_VOICE_LIMIT, (v, b) => {
      const buf = b.shots[Math.floor(Math.random() * b.shots.length) % b.shots.length];
      chain(v.sample(buf, v.t0, rand(0.93, 1.07)), v.level(0.45 * rand(0.85, 1)), v.out);
    });
  }

  /** Shell impact on a vehicle: 'penetration' (heavy metallic thud), 'nonpen' (clang), 'ricochet' (whine / ping); on terrain: 'ground'; on vegetation: 'tree' */
  impact(kind: ImpactKind, src: SoundSource): void {
    switch (kind) {
      case 'penetration':
        return this.oneShot(src, MAX_VOICES, (v, b) => this.penetration(v, b));
      case 'nonpen':
        return this.oneShot(src, MID_PRIORITY_VOICE_LIMIT, (v, b) => this.nonpen(v, b));
      case 'ricochet':
        return this.oneShot(src, MID_PRIORITY_VOICE_LIMIT, (v, b) => this.ricochet(v, b));
      case 'ground':
        return this.oneShot(src, LOW_PRIORITY_VOICE_LIMIT, (v, b) => this.groundHit(v, b));
      case 'tree':
        return this.oneShot(src, LOW_PRIORITY_VOICE_LIMIT, (v, b) => this.treeHit(v, b));
      default:
        return; // unknown kind: silently ignored
    }
  }

  /** Explosion; size = TNT-equivalent kg (a tank ammo detonation is ~10+ kg, an HE shell ~1 kg) */
  explosion(size: number, src: SoundSource): void {
    const kg = clamp(finiteOr(size, 1), 0.01, 1000);
    // 1 kg ≈ 0.23, 10 kg ≈ 0.79, 20 kg = 1
    const k = Math.min(Math.log2(1 + kg) / Math.log2(21), 1.6);
    const kk = Math.min(k, 1.2);
    this.oneShot(src, MAX_VOICES, (v, b) => {
      const t = v.t0;
      const L = 0.5 + 0.4 * kk;
      const tail = 1.0 + 2.0 * k;
      // crack of the detonation
      chain(v.noise(b.white, t, 0.35), v.filter('highpass', 700, 0.7), v.env(0.5 * L, 0.0008, 0.1 + 0.12 * kk), v.out);
      // blast: bright noise whose low-pass collapses
      const blastDecay = 0.6 + 0.5 * kk;
      const blp = v.filter('lowpass', 3000, 0.8);
      sweep(blp.frequency, 3500 - 1200 * kk, 220, t, 0.3 + 0.3 * kk);
      chain(v.noise(b.white, t, blastDecay + 0.05), blp, v.env(0.6 * L, 0.002, blastDecay), v.out);
      // sub thump
      const f0 = 75 - 30 * kk;
      const thumpDecay = 0.5 + 0.5 * kk;
      const o = v.osc('sine', f0, t, thumpDecay + 0.05);
      sweep(o.frequency, f0, 26, t, 0.35 + 0.15 * kk);
      chain(o, v.env(0.8 * L, 0.003, thumpDecay), v.out);
      // long rolling rumble (slower attack, decay scales with size)
      const hold = 0.1 * kk;
      const rAttack = 0.05 + 0.1 * kk;
      chain(
        v.noise(b.brown, t, rAttack + hold + tail + 0.05, 0.8 - 0.15 * kk),
        v.filter('lowpass', 280 - 90 * kk, 0.7),
        v.env(0.8 * L, rAttack, tail, hold),
        v.out,
      );
      // big blasts: debris / secondary cook-off crackles — one source + one gain with several spikes
      if (kg >= 3) {
        const count = Math.round(3 + 4 * kk);
        const g = v.add(v.ctx.createGain());
        g.gain.value = 0;
        let tt = t + 0.12;
        for (let i = 0; i < count; i++) {
          tt += rand(0.04, 0.22) * (0.6 + kk);
          const a = rand(0.08, 0.3) * L * v.g;
          const d = rand(0.03, 0.08);
          g.gain.setValueAtTime(0, tt);
          g.gain.linearRampToValueAtTime(a, tt + 0.002);
          g.gain.exponentialRampToValueAtTime(a * 0.01, tt + 0.002 + d);
          tt += 0.002 + d + 0.01;
        }
        g.gain.setValueAtTime(0, tt);
        chain(v.noise(b.white, t, tt - t + 0.02), v.filter('bandpass', rand(1600, 2600), 0.9), g, v.out);
      }
    });
  }

  /** Short UI click for menus (not affected by the effects volume; rate-limited to one per 30 ms). */
  uiClick(): void {
    this.oneShot(
      null,
      MID_PRIORITY_VOICE_LIMIT,
      (v) => {
        const t = v.t0;
        if (t - this.lastClick < 0.03) return;
        this.lastClick = t;
        const o = v.osc('triangle', 1800, t, 0.06);
        sweep(o.frequency, 1800, 900, t, 0.03);
        chain(o, v.env(0.18, 0.001, 0.04), v.out);
      },
      'ui',
    );
  }

  /** Reload-complete "clank" for the player's gun (played at distance 0) */
  reloadDone(): void {
    this.oneShot(null, MAX_VOICES, (v, b) => {
      const t = v.t0;
      // breech block "chunk"
      chain(v.noise(b.white, t, 0.1), v.filter('bandpass', 1200, 1.5), v.env(0.35, 0.001, 0.07), v.out);
      const o = v.osc('square', 170, t, 0.1);
      sweep(o.frequency, 170, 120, t, 0.06);
      chain(o, v.filter('lowpass', 900, 1), v.env(0.14, 0.001, 0.07), v.out);
      // latch "clack" with a short metallic ring
      const t2 = t + 0.085;
      chain(v.noise(b.white, t2, 0.08), v.filter('bandpass', 3200, 2), v.env(0.3, 0.0008, 0.045, 0, t2), v.out);
      chain(v.osc('sine', 1250, t2, 0.16), v.env(0.12, 0.001, 0.14, 0, t2), v.out);
      chain(v.osc('sine', 2950, t2, 0.11), v.env(0.06, 0.001, 0.09, 0, t2), v.out);
    });
  }

  /** Continuous own-engine sound; call every frame. rpm 0..1 (idle..max), load 0..1 (throttle), running=false fades it out */
  engine(state: { rpm: number; load: number; running: boolean }): void {
    this.safe(() => {
      this.engineState = {
        rpm: clamp01(state?.rpm),
        load: clamp01(state?.load),
        running: !!state?.running,
      };
      this.syncEngine();
    });
  }

  /** Continuous fire crackle while the player's vehicle is burning (on/off) */
  fire(burning: boolean): void {
    this.safe(() => {
      this.fireWanted = !!burning;
      this.syncFire();
    });
  }

  /** Stops everything and closes the context. Terminal: every later call is a no-op. */
  dispose(): void {
    this.safe(() => {
      if (this.disposed) return;
      this.disposed = true;
      for (const v of [...this.voices]) v.kill();
      this.voices.clear();
      if (this.engineVoice) this.stopLoop(this.engineVoice);
      if (this.fireVoice) this.stopLoop(this.fireVoice);
      this.engineVoice = null;
      this.fireVoice = null;
      for (const n of [this.effectsBus, this.engineBus, this.master, this.limiter, this.trim]) {
        try {
          n?.disconnect();
        } catch {
          /* ignore */
        }
      }
      const ctx = this.ctx;
      this.ctx = null;
      this.buffers = null;
      this.master = this.effectsBus = this.engineBus = this.trim = null;
      this.limiter = null;
      if (ctx && !this.offline) {
        const p = (ctx as AudioContext).close?.();
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
      }
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      if (!this.warned) {
        this.warned = true;
        try {
          console.warn('[SoundManager] audio error (further errors are suppressed):', e);
        } catch {
          /* no console */
        }
      }
    }
  }

  private init(): void {
    let ctx: BaseAudioContext | null | undefined = null;
    try {
      if (this.createCtx) ctx = this.createCtx();
      else {
        const Ctor = audioContextCtor();
        if (Ctor) ctx = new Ctor({ latencyHint: 'interactive' });
      }
      if (!ctx) return;
      const master = ctx.createGain();
      let limiter: DynamicsCompressorNode | null = null;
      let trim: GainNode | null = null;
      if (typeof ctx.createDynamicsCompressor === 'function') {
        // Safety limiter so stacked explosions don't hard-clip. The compressor applies automatic
        // makeup gain (~+1.5 dB with these settings); the trim cancels it and lowers the ceiling.
        limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -4;
        limiter.knee.value = 2;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.002;
        limiter.release.value = 0.25;
        trim = ctx.createGain();
        trim.gain.value = LIMITER_TRIM;
        chain(master, limiter, trim, ctx.destination);
      } else {
        master.connect(ctx.destination);
      }
      const effectsBus = ctx.createGain();
      const engineBus = ctx.createGain();
      effectsBus.connect(master);
      engineBus.connect(master);
      this.buffers = makeBuffers(ctx);
      this.master = master;
      this.limiter = limiter;
      this.trim = trim;
      this.effectsBus = effectsBus;
      this.engineBus = engineBus;
      this.offline = isOfflineContext(ctx);
      this.ctx = ctx;
      this.busTargets = [NaN, NaN, NaN];
      this.applyGains(false);
    } catch (e) {
      // don't keep creating contexts on every click if construction fails
      this.initFailed = true;
      this.ctx = null;
      this.buffers = null;
      try {
        if (ctx) void (ctx as AudioContext).close?.()?.catch?.(() => undefined);
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  private applyGains(ramp: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.effectsBus || !this.engineBus) return;
    const s = this.settings;
    const targets = [s.muted ? 0 : s.master, s.effects, s.engine];
    const params = [this.master.gain, this.effectsBus.gain, this.engineBus.gain];
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      if (this.busTargets[i] === targets[i]) continue;
      this.busTargets[i] = targets[i];
      const p = params[i];
      if (ramp) {
        p.cancelScheduledValues(now);
        p.setValueAtTime(p.value, now);
        p.setTargetAtTime(targets[i], now, SETTINGS_TC);
      } else {
        p.value = targets[i];
      }
    }
  }

  private canPlay(bus: Bus): boolean {
    const ctx = this.ctx;
    const s = this.settings;
    if (!ctx || this.disposed || !this.buffers || s.muted || s.master <= 0) return false;
    if (bus === 'effects' && s.effects <= 0) return false;
    // A suspended real-time context doesn't advance time: anything scheduled now would play
    // in one burst on resume, so drop it instead. Offline contexts are rendered as a whole.
    return this.offline || ctx.state === 'running';
  }

  /** Creates a voice with its distance chain (low-pass, panner) and runs `build`; never leaks a voice slot. */
  private oneShot(src: SoundSource | null, limit: number, build: (v: Voice, b: SynthBuffers) => void, bus: Bus = 'effects'): void {
    this.safe(() => {
      if (!this.canPlay(bus) || this.voices.size >= limit) return;
      const ctx = this.ctx!;
      const dist = src && src.distance > 0 ? src.distance : 0;
      const g = distanceGain(dist);
      if (!(g >= MIN_AUDIBLE_GAIN)) return;
      const dest = bus === 'ui' ? this.master! : this.effectsBus!;
      const v = new Voice(ctx, ctx.currentTime + LOOKAHEAD + propagationDelay(dist), g, dest, (x) => this.voices.delete(x));
      this.voices.add(v);
      try {
        const pan = clampPan(src?.pan);
        if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
          const p = v.add(ctx.createStereoPanner());
          p.pan.value = pan;
          p.connect(v.out);
          v.out = p;
        }
        const fc = distanceCutoff(dist);
        if (fc < LOWPASS_BYPASS_HZ) {
          const lp = v.filter('lowpass', fc, 0.5);
          lp.connect(v.out);
          v.out = lp;
        }
        build(v, this.buffers!);
      } catch (e) {
        v.kill();
        throw e;
      }
      v.seal();
    });
  }

  private penetration(v: Voice, b: SynthBuffers): void {
    const t = v.t0;
    // crack of the hit
    chain(v.noise(b.white, t, 0.08), v.filter('bandpass', 2600, 0.9), v.env(0.45, 0.0008, 0.05), v.out);
    // heavy thud
    const lp = v.filter('lowpass', 700, 1.2);
    sweep(lp.frequency, 900, 250, t, 0.25);
    chain(v.noise(b.brown, t, 0.45, rand(0.85, 1)), lp, v.env(0.9, 0.003, 0.4), v.out);
    // detuned square blip = hull resonance
    const f0 = rand(95, 120);
    const blp = v.filter('lowpass', 1100, 0.8);
    for (const detune of [-12, 14]) {
      const o = v.osc('square', f0, t, 0.26, detune);
      sweep(o.frequency, f0, f0 * 0.55, t, 0.16);
      o.connect(blp);
    }
    chain(blp, v.env(0.25, 0.002, 0.22), v.out);
    // short ring of the armour plate
    chain(v.osc('triangle', rand(340, 420), t, 0.34), v.env(0.08, 0.002, 0.3), v.out);
  }

  private nonpen(v: Voice, b: SynthBuffers): void {
    const t = v.t0;
    const f = rand(540, 760);
    // band-passed impact transient
    chain(v.noise(b.white, t, 0.08, rand(0.9, 1.1)), v.filter('bandpass', rand(2800, 3600), 1.4), v.env(0.5, 0.0008, 0.06), v.out);
    // FM clang: inharmonic modulator whose index decays → bright attack settling into a ring,
    // with a slight downward pitch sweep
    const car = v.osc('sine', f, t, 0.72);
    sweep(car.frequency, f * 1.04, f, t, 0.5);
    const mod = v.osc('sine', f * 1.41, t, 0.72);
    const idx = v.add(v.ctx.createGain());
    sweep(idx.gain, f * 2.2, f * 0.05, t, 0.35);
    chain(mod, idx);
    idx.connect(car.frequency);
    chain(car, v.env(0.3, 0.001, 0.6), v.out);
    // higher plate mode
    const f2 = f * 2.76;
    const p2 = v.osc('sine', f2, t, 0.3);
    sweep(p2.frequency, f2 * 1.03, f2, t, 0.25);
    chain(p2, v.env(0.1, 0.001, 0.25), v.out);
  }

  private ricochet(v: Voice, b: SynthBuffers): void {
    const t = v.t0;
    const f0 = rand(2300, 3300);
    const f1 = f0 * rand(0.3, 0.42);
    const dur = rand(0.55, 0.85);
    // ping of the glancing hit
    chain(v.noise(b.white, t, 0.06), v.filter('bandpass', 3800, 2), v.env(0.3, 0.0008, 0.04), v.out);
    // falling whine with a tumbling vibrato
    const o = v.osc('triangle', f0, t, dur + 0.1);
    sweep(o.frequency, f0, f1, t, dur);
    const lfo = v.osc('sine', rand(16, 30), t, dur + 0.1);
    const depth = v.add(v.ctx.createGain());
    sweep(depth.gain, f0 * 0.03, f1 * 0.03, t, dur);
    chain(lfo, depth);
    depth.connect(o.frequency);
    chain(o, v.env(0.2, 0.012, dur * 0.75, dur * 0.15), v.out);
    // airy whistle following the same sweep
    const bp = v.filter('bandpass', f0, 9);
    sweep(bp.frequency, f0, f1, t, dur);
    chain(v.noise(b.white, t, dur + 0.1), bp, v.env(0.5, 0.01, dur * 0.8, dur * 0.1), v.out);
  }

  private groundHit(v: Voice, b: SynthBuffers): void {
    const t = v.t0;
    // dull thud
    const lp = v.filter('lowpass', 1000, 0.8);
    sweep(lp.frequency, 1400, 220, t, 0.25);
    chain(v.noise(b.brown, t, 0.45, rand(0.8, 1.1)), lp, v.env(0.7, 0.003, 0.4), v.out);
    // dirt spray / debris
    const t2 = t + 0.02;
    chain(v.noise(b.white, t2, 0.5), v.filter('bandpass', rand(1400, 2200), 0.7), v.env(0.16, 0.03, 0.4, 0, t2), v.out);
  }

  private treeHit(v: Voice, b: SynthBuffers): void {
    const t = v.t0;
    // splintering crack
    chain(v.noise(b.white, t, 0.16), v.filter('bandpass', rand(900, 1500), 2.2), v.env(0.5, 0.0008, 0.13), v.out);
    // woody "thock"
    const f = rand(190, 240);
    const o = v.osc('triangle', f, t, 0.16);
    sweep(o.frequency, f, f * 0.65, t, 0.1);
    chain(o, v.env(0.28, 0.002, 0.13), v.out);
    // rustling leaves
    const t2 = t + 0.01;
    chain(v.noise(b.white, t2, 0.55), v.filter('highpass', 2600, 0.7), v.env(0.1, 0.04, 0.45, 0, t2), v.out);
  }

  // ── loops ──────────────────────────────────────────────────────────────────

  private syncLoops(): void {
    this.syncEngine();
    this.syncFire();
  }

  private loopAllowed(volume: number): boolean {
    const s = this.settings;
    return !!this.ctx && !!this.buffers && !this.disposed && !s.muted && s.master > 0 && volume > 0;
  }

  private syncEngine(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const want = this.engineState.running && this.loopAllowed(this.settings.engine);
    const e = this.engineVoice;
    if (!want) {
      if (e && !e.fading) {
        this.fadeLoop(e, () => {
          if (this.engineVoice === e) this.engineVoice = null;
        });
      }
      return;
    }
    if (!e) this.engineVoice = this.createEngine(ctx);
    else if (e.fading) {
      this.reviveLoop(e);
      e.last = { f: NaN, fc: NaN, level: NaN, rumble: NaN, rate: NaN, sub: NaN };
    }
    this.updateEngine(this.engineVoice!, ctx.currentTime);
  }

  /**
   * Two detuned oscillators (saw + square) at the firing frequency and a sine half-order
   * (fades in with rpm, so idle doesn't waste headroom on ~15 Hz) through a resonant low-pass,
   * plus low band-passed noise for mechanical / track rumble.
   */
  private createEngine(ctx: BaseAudioContext): EngineVoice {
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const add = <T extends AudioNode>(n: T): T => (nodes.push(n), n);
    const now = ctx.currentTime;
    const out = add(ctx.createGain());
    out.gain.value = 0;
    out.connect(this.engineBus!);
    const lp = add(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.value = 300;
    lp.connect(out);
    const oscs: OscillatorNode[] = [];
    const voice = (type: OscillatorType, gain: number, detune: number): [OscillatorNode, GainNode] => {
      const o = add(ctx.createOscillator());
      o.type = type;
      o.frequency.value = 30;
      o.detune.value = detune;
      const g = add(ctx.createGain());
      g.gain.value = gain;
      chain(o, g, lp);
      sources.push(o);
      return [o, g];
    };
    oscs.push(voice('sawtooth', 0.3, -10)[0], voice('square', 0.14, 14)[0]);
    const [sub, subGain] = voice('sine', 0, 0);
    sub.frequency.value = 15;
    // mechanical rumble
    const rumbleSrc = add(ctx.createBufferSource());
    rumbleSrc.buffer = this.buffers!.brown;
    rumbleSrc.loop = true;
    const bp = add(ctx.createBiquadFilter());
    bp.type = 'bandpass';
    bp.frequency.value = 140;
    bp.Q.value = 0.8;
    const rumble = add(ctx.createGain());
    rumble.gain.value = 0;
    chain(rumbleSrc, bp, rumble, out);
    sources.push(rumbleSrc);
    for (const s of sources) {
      if (s === rumbleSrc) rumbleSrc.start(now, Math.random() * this.buffers!.brown.duration * 0.9);
      else s.start(now);
    }
    return {
      out,
      nodes,
      sources,
      fading: false,
      timer: null,
      oscs,
      sub,
      subGain,
      lp,
      rumble,
      rumbleSrc,
      last: { f: NaN, fc: NaN, level: NaN, rumble: NaN, rate: NaN, sub: NaN },
    };
  }

  private updateEngine(e: EngineVoice, now: number): void {
    const { rpm, load } = this.engineState;
    const f = 30 + 90 * rpm; // firing frequency, 30 Hz idle … 120 Hz max
    const fc = 200 + 500 * rpm + 1100 * load;
    const level = 0.17 + 0.1 * rpm + 0.17 * load; // keeps full-throttle engine well under a cannon shot
    const rumble = 0.15 + 0.45 * load;
    const rate = 0.8 + 0.6 * rpm;
    const sub = 0.05 + 0.3 * rpm;
    const L = e.last;
    const nf = glide(e.oscs[0].frequency, L.f, f, now, 0.12);
    if (nf !== L.f) {
      for (let i = 1; i < e.oscs.length; i++) e.oscs[i].frequency.setTargetAtTime(f, now, 0.12);
      e.sub.frequency.setTargetAtTime(f * 0.5, now, 0.12);
      L.f = nf;
    }
    L.fc = glide(e.lp.frequency, L.fc, fc, now, 0.08);
    L.level = glide(e.out.gain, L.level, level, now, 0.1);
    L.rumble = glide(e.rumble.gain, L.rumble, rumble, now, 0.1);
    L.rate = glide(e.rumbleSrc.playbackRate, L.rate, rate, now, 0.15);
    L.sub = glide(e.subGain.gain, L.sub, sub, now, 0.15);
  }

  private syncFire(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const want = this.fireWanted && this.loopAllowed(this.settings.effects);
    const f = this.fireVoice;
    if (!want) {
      if (f && !f.fading) {
        this.fadeLoop(f, () => {
          if (this.fireVoice === f) this.fireVoice = null;
        });
      }
      return;
    }
    if (!f) this.fireVoice = this.createFire(ctx);
    else if (f.fading) {
      this.reviveLoop(f);
      f.out.gain.setTargetAtTime(FIRE_LEVEL, ctx.currentTime, 0.3);
    }
  }

  /** Baked crackle loop through a low-pass whose cutoff drifts slowly (flare-ups). */
  private createFire(ctx: BaseAudioContext): LoopVoice {
    const b = this.buffers!;
    if (!b.fire) b.fire = toBuffer(ctx, fireLoop(ctx.sampleRate));
    const nodes: AudioNode[] = [];
    const add = <T extends AudioNode>(n: T): T => (nodes.push(n), n);
    const now = ctx.currentTime;
    const out = add(ctx.createGain());
    out.gain.value = 0;
    out.connect(this.effectsBus!);
    const lp = add(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    lp.Q.value = 0.5;
    lp.connect(out);
    const src = add(ctx.createBufferSource());
    src.buffer = b.fire;
    src.loop = true;
    src.connect(lp);
    const lfo = add(ctx.createOscillator());
    lfo.frequency.value = rand(0.15, 0.3);
    const depth = add(ctx.createGain());
    depth.gain.value = 1800;
    chain(lfo, depth);
    depth.connect(lp.frequency);
    src.start(now, Math.random() * b.fire.duration * 0.9);
    lfo.start(now);
    out.gain.setTargetAtTime(FIRE_LEVEL, now, 0.35);
    return { out, nodes, sources: [src, lfo], fading: false, timer: null };
  }

  private fadeLoop(l: LoopVoice, onStopped: () => void): void {
    const ctx = this.ctx;
    l.fading = true;
    if (!ctx || typeof setTimeout !== 'function') {
      this.stopLoop(l);
      onStopped();
      return;
    }
    l.out.gain.setTargetAtTime(0, ctx.currentTime, LOOP_FADE_TC);
    l.timer = setTimeout(() => {
      l.timer = null;
      if (!l.fading) return;
      this.safe(() => this.stopLoop(l));
      onStopped();
    }, LOOP_STOP_MS);
  }

  private reviveLoop(l: LoopVoice): void {
    l.fading = false;
    if (l.timer !== null) clearTimeout(l.timer);
    l.timer = null;
  }

  private stopLoop(l: LoopVoice): void {
    if (l.timer !== null) clearTimeout(l.timer);
    l.timer = null;
    l.fading = true;
    for (const s of l.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const n of l.nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    l.nodes.length = 0;
    l.sources.length = 0;
  }
}
