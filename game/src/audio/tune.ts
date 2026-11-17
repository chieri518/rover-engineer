// Pure helpers for the sound: no Web Audio here, so they run (and are tested) in Node.
import type { ScreenId } from '../flow/flow';
import type { WorldId } from '../worlds';
import type { MoodId } from './mix';

/** A volume slider (0..1) to a bus gain: squared, so the low half of the slider stays usable. */
export function volumeGain(slider: number, max: number): number {
  const v = Number.isFinite(slider) ? Math.min(1, Math.max(0, slider)) : 0;
  return v * v * max;
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Which music mood plays: the world's own mood during a mission, none during the intro film (it has its
 * own score), the calm theme everywhere else.
 */
export function moodFor(screen: ScreenId, world: WorldId): MoodId | null {
  if (screen === 'film') return null;
  return screen === 'mission' ? world : 'calm';
}

/**
 * The intro film's volume (an HTML video's 0..1): silent when muted, `FILM.volume` at the reference Effects
 * slider, and scaled from there by the slider's squared curve, capped at full volume.
 */
export function filmVolume(s: { effectsVolume: number; muted: boolean }, film: { volume: number; referenceSlider: number }): number {
  if (s.muted) return 0;
  const ref = volumeGain(film.referenceSlider, 1);
  return ref > 0 ? Math.min(1, (film.volume * volumeGain(s.effectsVolume, 1)) / ref) : 0;
}

/**
 * A random scale degree that is not the last one picked (no note repeats back to back). `rng` returns
 * 0..1. Returns an index into `scale`.
 */
export function pickDegree(scale: readonly number[], rng: () => number, previous: number | null): number {
  if (scale.length <= 1) return 0;
  let i = Math.min(scale.length - 1, Math.floor(rng() * scale.length));
  if (i === previous) i = (i + 1 + Math.floor(rng() * (scale.length - 1))) % scale.length;
  return i;
}

/** `count` distinct scale degrees for a chord, starting from a random one and stacking every other degree. */
export function pickChord(scale: readonly number[], count: number, rng: () => number, previousRoot: number | null): number[] {
  const n = scale.length;
  if (n === 0) return [];
  const root = pickDegree(scale, rng, previousRoot);
  const out: number[] = [];
  for (let k = 0; k < Math.min(count, n); k++) out.push((root + k * 2) % n);
  return out;
}

/** A random time in [min, max]. */
export function between([min, max]: readonly [number, number], rng: () => number): number {
  return min + (max - min) * rng();
}

export interface MotorInput {
  speedMps: number; // absolute
  topSpeedMps: number;
  throttle: number; // -1..1
  wheelsOnGround: number; // 0..4
  awake: boolean; // powered up and the mission running (not paused, not ended)
  thinAir: boolean;
}

export interface MotorTone {
  hz: number;
  gain: number;
  cutoffHz: number;
  crunchGain: number;
  crunchGrainHz: number;
}

export interface MotorMix {
  idleHz: number;
  topHz: number;
  effortHz: number;
  idleGain: number;
  speedGain: number;
  effortGain: number;
  cutoffHz: [number, number];
  thinAirCutoffHz: [number, number];
  thinAirGain: number;
  crunchGain: number;
  crunchGrainHz: [number, number];
}

/** The motor hum and wheel crunch for the rover's speed: silent when asleep, idling when still, rising with speed. */
export function motorTone(m: MotorInput, mix: MotorMix): MotorTone {
  const s = m.topSpeedMps > 0 ? Math.min(1, Math.max(0, m.speedMps / m.topSpeedMps)) : 0;
  const effort = m.awake ? Math.min(1, Math.abs(m.throttle)) : 0;
  const cut = m.thinAir ? mix.thinAirCutoffHz : mix.cutoffHz;
  const ground = Math.min(1, Math.max(0, m.wheelsOnGround / 4));
  const loud = m.thinAir ? mix.thinAirGain : 1;
  return {
    hz: mix.idleHz + (mix.topHz - mix.idleHz) * s + mix.effortHz * effort,
    gain: m.awake ? (mix.idleGain + mix.speedGain * s + mix.effortGain * effort) * loud : 0,
    cutoffHz: cut[0] + (cut[1] - cut[0]) * s,
    crunchGain: m.awake ? mix.crunchGain * ground * Math.min(1, s * 2.5) * loud : 0,
    crunchGrainHz: mix.crunchGrainHz[0] + (mix.crunchGrainHz[1] - mix.crunchGrainHz[0]) * s,
  };
}

/**
 * Warnings sound on their rising edge only, and the same warning not again within the cooldown: a
 * warning that flickers on and off (a slope at the limit) does not spam.
 */
export class WarningGate<Id extends string = string> {
  private active = new Set<Id>();
  private readonly last = new Map<Id, number>();

  constructor(private readonly cooldownSeconds: number) {}

  /** The warnings active now; returns those that just started and may sound. */
  update(ids: readonly Id[], nowSeconds: number): Id[] {
    const next = new Set(ids);
    const fire: Id[] = [];
    for (const id of next) {
      if (this.active.has(id)) continue;
      const at = this.last.get(id);
      if (at !== undefined && nowSeconds - at < this.cooldownSeconds) continue;
      this.last.set(id, nowSeconds);
      fire.push(id);
    }
    this.active = next;
    return fire;
  }
}

/** At most one event per cooldown (soft bumps, repeated refusals). */
export class Cooldown {
  private last = -Infinity;
  constructor(private readonly seconds: number) {}
  ready(nowSeconds: number): boolean {
    if (nowSeconds - this.last < this.seconds) return false;
    this.last = nowSeconds;
    return true;
  }
}

/** Peak and RMS of rendered samples, in dBFS (for checking the mix). */
export function levels(channels: readonly Float32Array[]): { peakDb: number; rmsDb: number } {
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]!);
      if (v > peak) peak = v;
      sum += v * v;
    }
    n += ch.length;
  }
  const db = (x: number) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -Infinity);
  return { peakDb: db(peak), rmsDb: db(n ? Math.sqrt(sum / n) : 0) };
}
