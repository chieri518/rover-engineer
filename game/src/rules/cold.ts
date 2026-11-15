// Cold: the freeze meter rises inside cold zones (permanent shadow), slowed by the heater, and
// recovers outside. Pure.
import type { Tuning } from './types';

/** Freeze meter change per second: positive inside a cold zone, negative (recovery) outside. */
export function freezeRate(inColdZone: boolean, heat: number, cold: Tuning['cold']): number {
  if (!inColdZone) return -cold.warmRecoveryPerSecond;
  return Math.max(0, cold.freezeRatePerSecond - cold.heaterReductionPerHeat * heat);
}

export function stepFreeze(freeze: number, inColdZone: boolean, heat: number, dt: number, cold: Tuning['cold']): number {
  return Math.min(cold.freezeMax, Math.max(0, freeze + freezeRate(inColdZone, heat, cold) * dt));
}

/** Seconds a rover can stay in a cold zone from a warm start before it freezes (Infinity if it never does). */
export function secondsToFreeze(heat: number, cold: Tuning['cold']): number {
  const rate = freezeRate(true, heat, cold);
  return rate > 0 ? cold.freezeMax / rate : Infinity;
}

/**
 * Without lights the rover cannot drive into permanent shadow: it stops at the edge. The point it
 * checks lies ahead by its braking distance plus a margin, so it can stop in time.
 */
export function noLightsLookaheadM(speedMps: number, brakeDecelMps2: number, cold: Tuning['cold']): number {
  const v = Math.abs(speedMps);
  return cold.noLightsMarginM + (v * v) / (2 * Math.max(brakeDecelMps2, 0.1));
}
