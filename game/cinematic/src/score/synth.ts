// The score's instruments, built from the same parts as the game's music (src/audio/music.ts, sfx.ts): detuned
// oscillators through a lowpass, two-partial sine bells, filtered noise, all into the game's buses and hall reverb.
// Every envelope starts and ends at zero (no clicks), and all randomness comes from the score's seeded rng.
import type { Buses } from '../../../src/audio/graph';
import { midiToHz } from '../../../src/audio/tune';

export interface Score {
  ac: OfflineAudioContext;
  b: Buses;
  rng: () => number;
}

export const hz = midiToHz;

/** Note names to MIDI ("D2", "F#4", "Bb0"). */
export function m(name: string): number {
  const r = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!r) throw new Error(`bad note ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[r[1] as 'C'];
  return 12 * (Number(r[3]) + 1) + base + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0);
}

/**
 * A group of sounds with its own level (for swells, ducks and cuts), feeding a bus and that bus's reverb send.
 * Level changes must be scheduled in time order.
 */
export class Layer {
  readonly in: GainNode;
  private level: number;

  constructor(s: Score, bus: 'music' | 'effects', gain: number, wet = 1) {
    this.in = new GainNode(s.ac, { gain });
    this.level = gain;
    this.in.connect(bus === 'music' ? s.b.music : s.b.effects);
    if (wet > 0) this.in.connect(new GainNode(s.ac, { gain: wet })).connect(bus === 'music' ? s.b.musicReverb : s.b.effectsReverb);
  }

  /** Glide (linear) from the current level to `to`, starting at `t`, over `glide` seconds. */
  to(t: number, to: number, glide = 0.02): this {
    const g = this.in.gain;
    g.setValueAtTime(this.level, t);
    g.linearRampToValueAtTime(to, t + Math.max(0.003, glide));
    this.level = to;
    return this;
  }
}

/** Sustained (attack, hold, release; linear) or plucked (attack, then an exponential decay). */
export type Shape = { a: number; h: number; r: number } | { a: number; decay: number };

export function envelope(p: AudioParam, t: number, peak: number, sh: Shape): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + sh.a);
  if ('decay' in sh) {
    const end = t + sh.a + sh.decay;
    p.exponentialRampToValueAtTime(Math.max(1e-6, peak * 1e-3), end);
    p.linearRampToValueAtTime(0, end + 0.02);
    return end + 0.02;
  }
  p.setValueAtTime(peak, t + sh.a + sh.h);
  p.linearRampToValueAtTime(0, t + sh.a + sh.h + sh.r);
  return t + sh.a + sh.h + sh.r;
}

export interface ToneOpts {
  type?: OscillatorType;
  /** One oscillator per entry, detuned by this many cents (the game's pads use a pair). */
  detune?: number[];
  pan?: number;
  /** Lowpass cutoff (Hz); with `cutoffTo`, an exponential sweep to it over `sweep` seconds from the start. */
  cutoff?: number;
  cutoffTo?: number;
  sweep?: number;
  q?: number;
  /** Pitch glide to this frequency over `glide` seconds (exponential). */
  glideTo?: number;
  glide?: number;
  /** Vibrato: depth in cents, at 5 Hz, fading in after the attack. */
  vibrato?: number;
}

/** One pitched note: oscillators, a lowpass, an envelope, a panner. Returns the time it is silent. */
export function tone(s: Score, dest: AudioNode, t: number, f: number, gain: number, sh: Shape, o: ToneOpts = {}): number {
  const { ac } = s;
  const lp = new BiquadFilterNode(ac, { type: 'lowpass', frequency: o.cutoff ?? 20000, Q: o.q ?? 0.5 });
  if (o.cutoff && o.cutoffTo) {
    lp.frequency.setValueAtTime(o.cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(o.cutoffTo, t + (o.sweep ?? 1));
  }
  const env = new GainNode(ac, { gain: 0 });
  const pan = new StereoPannerNode(ac, { pan: o.pan ?? 0 });
  lp.connect(env).connect(pan).connect(dest);
  const end = envelope(env.gain, t, gain, sh);
  const detunes = o.detune ?? [0];
  const each = 1 / Math.sqrt(detunes.length);
  let vib: GainNode | null = null;
  if (o.vibrato) {
    const lfo = new OscillatorNode(ac, { frequency: 5 + s.rng() * 0.6 });
    vib = new GainNode(ac, { gain: 0 });
    vib.gain.setValueAtTime(0, t + sh.a);
    vib.gain.linearRampToValueAtTime(o.vibrato, t + sh.a + 0.6);
    lfo.connect(vib);
    lfo.start(t);
    lfo.stop(end + 0.05);
  }
  for (const cents of detunes) {
    const osc = new OscillatorNode(ac, { type: o.type ?? 'sine', frequency: f, detune: cents });
    if (o.glideTo) {
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(o.glideTo, t + (o.glide ?? 1));
    }
    if (vib) vib.connect(osc.detune);
    const g = new GainNode(ac, { gain: each });
    osc.connect(g).connect(lp);
    osc.start(t);
    osc.stop(end + 0.05);
  }
  return end;
}

/** A chord: one tone per note, spread across the stereo field. */
export function chord(s: Score, dest: AudioNode, t: number, notes: number[], gain: number, sh: Shape, o: ToneOpts = {}, spread = 0.6): void {
  notes.forEach((n, i) => {
    const pan = notes.length > 1 ? (i / (notes.length - 1) - 0.5) * 2 * spread : 0;
    tone(s, dest, t, hz(n), gain, sh, { ...o, pan: (o.pan ?? 0) + pan });
  });
}

/** A bell like the game's: a sine and one inharmonic partial that dies sooner. */
export function bell(s: Score, dest: AudioNode, t: number, f: number, gain: number, decay: number, partial: number, pan = 0): void {
  tone(s, dest, t, f, gain, { a: 0.006, decay }, { pan });
  tone(s, dest, t, f * partial, gain * 0.25, { a: 0.004, decay: decay * 0.4 }, { pan });
}

/** A low boom or kick: a sine whose pitch drops fast, with a plucked envelope (and a soft overtone to carry it). */
export function boom(s: Score, dest: AudioNode, t: number, from: number, to: number, gain: number, decay: number, pitchTime = 0.08): void {
  tone(s, dest, t, from, gain, { a: 0.003, decay }, { glideTo: to, glide: pitchTime });
  tone(s, dest, t, from * 2, gain * 0.18, { a: 0.003, decay: decay * 0.3 }, { type: 'triangle', glideTo: to * 2, glide: pitchTime, cutoff: 600 });
}

export interface NoiseBed {
  gain: GainNode;
  filters: BiquadFilterNode[];
}

/**
 * A looping noise through a chain of filters, from `t0` to `t1`. The level starts at zero: the caller shapes
 * `gain.gain` (and may sweep the filters). Two decorrelated copies panned apart when `width` > 0.
 */
export function noiseBed(
  s: Score,
  dest: AudioNode,
  buffer: AudioBuffer,
  t0: number,
  t1: number,
  filters: Array<{ type: BiquadFilterType; hz: number; q?: number }>,
  width = 0.6,
): NoiseBed {
  const { ac } = s;
  const gain = new GainNode(ac, { gain: 0 });
  const chain = filters.map((f) => new BiquadFilterNode(ac, { type: f.type, frequency: f.hz, Q: f.q ?? 0.7 }));
  chain.reduce<AudioNode>((a, f) => a.connect(f), gain);
  (chain[chain.length - 1] ?? gain).connect(dest);
  const copies = width > 0 ? [-width, width] : [0];
  for (const p of copies) {
    const src = new AudioBufferSourceNode(ac, { buffer, loop: true });
    const pan = new StereoPannerNode(ac, { pan: p });
    const g = new GainNode(ac, { gain: 1 / Math.sqrt(copies.length) });
    src.connect(g).connect(pan).connect(gain);
    src.start(t0, s.rng() * buffer.duration * 0.9);
    src.stop(t1 + 0.05);
  }
  return { gain, filters: chain };
}

/**
 * Sparse impulses (crackle, sparks, raindrops): short bursts of noise at random times (`rate` per second), most
 * quiet and a few loud. `decayMs` is how long each burst rings.
 */
export function impulses(s: Score, seconds: number, rate: number, decayMs: number): AudioBuffer {
  const { ac, rng } = s;
  const sr = ac.sampleRate;
  const buf = ac.createBuffer(1, Math.round(seconds * sr), sr);
  const d = buf.getChannelData(0);
  const len = Math.round((decayMs / 1000) * sr * 5);
  const k = 1000 / (decayMs * sr);
  let i = Math.round(sr * (-Math.log(1 - rng() * 0.999) / rate));
  while (i + len < d.length) {
    const amp = rng() ** 2.5 * (rng() < 0.5 ? -1 : 1);
    for (let j = 0; j < len; j++) d[i + j] = d[i + j]! + amp * (rng() * 2 - 1) * Math.exp(-j * k);
    i += Math.max(1, Math.round(sr * (-Math.log(1 - rng() * 0.999) / rate)));
  }
  return buf;
}
