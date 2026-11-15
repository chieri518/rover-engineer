// The Mars dust storm: one regional storm per mission, forecast a sol ahead by an orbital weather
// report, about 2 sols long. While it blows, solar income falls to about a third and nights are milder
// (airborne dust absorbs heat). It builds up and dies down over rampSeconds. Pure.
import type { DustStormSpec } from './marsTypes';
import type { EventsFile } from './types';
import type { Rng } from './events';

export interface DustStorm {
  forecastAt: number;
  startAt: number;
  endAt: number;
}

export type StormPhase = 'none' | 'forecast' | 'active' | 'cleared';

/** The mission's storm: a random start inside the first window. Null when the world has no storm. */
export function scheduleDustStorm(events: EventsFile, rng: Rng): DustStorm | null {
  const spec = events.duststorm;
  const window = spec?.windowsSeconds[0];
  if (!spec || !window) return null;
  const [a, b] = window;
  const startAt = a + (b - a) * rng();
  return { forecastAt: Math.max(0, startAt - spec.warningSeconds), startAt, endAt: startAt + spec.durationSeconds };
}

export function stormPhase(seconds: number, storm: DustStorm | null): StormPhase {
  if (!storm || seconds < storm.forecastAt) return 'none';
  if (seconds < storm.startAt) return 'forecast';
  if (seconds < storm.endAt) return 'active';
  return 'cleared';
}

/** 0 = clear, 1 = full storm; ramps linearly in after the start and out before the end. For the renderer and the rules. */
export function stormIntensity(seconds: number, storm: DustStorm | null, spec: DustStormSpec | undefined): number {
  if (!storm || !spec || seconds < storm.startAt || seconds >= storm.endAt) return 0;
  const ramp = Math.min(Math.max(spec.rampSeconds, 0), (storm.endAt - storm.startAt) / 2);
  if (ramp <= 0) return 1;
  return Math.min(1, (seconds - storm.startAt) / ramp, (storm.endAt - seconds) / ramp);
}

/** Solar income multiplier: 1 when clear, spec.solarFactor at full storm. */
export function stormSolarFactor(intensity: number, spec: DustStormSpec | undefined): number {
  return spec ? 1 - (1 - spec.solarFactor) * intensity : 1;
}

/** Night freezing multiplier: 1 when clear, spec.freezeFactor at full storm. */
export function stormFreezeFactor(intensity: number, spec: DustStormSpec | undefined): number {
  return spec ? 1 - (1 - spec.freezeFactor) * intensity : 1;
}

export type StormEdge = 'forecast' | 'started' | 'cleared';

/** The storm milestone crossed between two times (prev < edge ≤ now), or null. */
export function stormEdge(prevSeconds: number, seconds: number, storm: DustStorm | null): StormEdge | null {
  if (!storm) return null;
  const crossed = (x: number) => prevSeconds < x && x <= seconds;
  if (crossed(storm.endAt)) return 'cleared';
  if (crossed(storm.startAt)) return 'started';
  if (crossed(storm.forecastAt)) return 'forecast';
  return null;
}
