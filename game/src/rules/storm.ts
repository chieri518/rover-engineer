// One storm per mission: the Mars dust storm and the Titan methane rainstorm share this schedule.
// Mars: forecast a sol ahead by an orbital weather report, about 2 sols long; while it blows, solar
// income falls to about a third and nights are milder (airborne dust absorbs heat). Titan: forecast 60 s
// ahead by the lander's weather station, about 60 s long; the cold rises faster and photos do not count
// (rules/titan.ts). Each builds up and dies down over rampSeconds. Pure.
import type { DustStormSpec } from './marsTypes';
import type { EventsFile } from './types';
import type { Rng } from './events';

/** What the schedule and the intensity ramp need from a storm spec (DustStormSpec, RainstormSpec). */
export interface StormTiming {
  windowsSeconds: [number, number][];
  warningSeconds: number;
  durationSeconds: number;
  rampSeconds: number;
}

/** A scheduled storm (dust on Mars, methane rain on Titan). */
export interface DustStorm {
  forecastAt: number;
  startAt: number;
  endAt: number;
}

export type StormPhase = 'none' | 'forecast' | 'active' | 'cleared';

/** A storm drawn from a spec: a random start inside the first window. Null without a spec or window. */
export function scheduleStorm(spec: StormTiming | undefined, rng: Rng): DustStorm | null {
  const window = spec?.windowsSeconds[0];
  if (!spec || !window) return null;
  const [a, b] = window;
  const startAt = a + (b - a) * rng();
  return { forecastAt: Math.max(0, startAt - spec.warningSeconds), startAt, endAt: startAt + spec.durationSeconds };
}

/** The mission's dust storm (Mars). Null when the world has no dust storm. */
export function scheduleDustStorm(events: EventsFile, rng: Rng): DustStorm | null {
  return scheduleStorm(events.duststorm, rng);
}

/** The mission's methane rainstorm (Titan). Null when the world has no rainstorm. */
export function scheduleRainstorm(events: EventsFile, rng: Rng): DustStorm | null {
  return scheduleStorm(events.rainstorm, rng);
}

export function stormPhase(seconds: number, storm: DustStorm | null): StormPhase {
  if (!storm || seconds < storm.forecastAt) return 'none';
  if (seconds < storm.startAt) return 'forecast';
  if (seconds < storm.endAt) return 'active';
  return 'cleared';
}

/** 0 = clear, 1 = full storm; ramps linearly in after the start and out before the end. For the renderer and the rules. */
export function stormIntensity(seconds: number, storm: DustStorm | null, spec: Pick<StormTiming, 'rampSeconds'> | undefined): number {
  if (!storm || !spec || seconds < storm.startAt || seconds >= storm.endAt) return 0;
  const ramp = Math.min(Math.max(spec.rampSeconds, 0), (storm.endAt - storm.startAt) / 2);
  if (ramp <= 0) return 1;
  return Math.min(1, (seconds - storm.startAt) / ramp, (storm.endAt - seconds) / ramp);
}

/** Solar income multiplier: 1 when clear, spec.solarFactor at full storm. */
export function stormSolarFactor(intensity: number, spec: DustStormSpec | undefined): number {
  return spec ? 1 - (1 - spec.solarFactor) * intensity : 1;
}

/** Freezing multiplier: 1 when clear, spec.freezeFactor at full storm (Mars < 1, milder nights; Titan > 1, colder). */
export function stormFreezeFactor(intensity: number, spec: { freezeFactor: number } | undefined): number {
  return spec ? 1 - (1 - spec.freezeFactor) * intensity : 1;
}

export type StormEdge = 'forecast' | 'started' | 'cleared';

/** The storm edge crossed between two times (prev < edge ≤ now), or null. */
export function stormEdge(prevSeconds: number, seconds: number, storm: DustStorm | null): StormEdge | null {
  if (!storm) return null;
  const crossed = (x: number) => prevSeconds < x && x <= seconds;
  if (crossed(storm.endAt)) return 'cleared';
  if (crossed(storm.startAt)) return 'started';
  if (crossed(storm.forecastAt)) return 'forecast';
  return null;
}
