// Cold: the freeze meter rises inside cold zones (permanent shadow), slowed by the heater, and
// recovers outside. Pure.
import type { Tuning } from './types';
import type { NightTuning } from './marsTypes';

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

// ---------------------------------------------------------------------------------------------------
// Mars: the night cold is map-wide (data/mars/tuning.json `night`). The heater's reduction per heat unit
// is the Moon's (tuning.cold). A dust storm keeps nights milder (stormFactor < 1, rules/storm.ts).

/** Freeze meter change per second on Mars: rising everywhere at night, recovering by day. */
export function marsFreezeRate(isNight: boolean, heat: number, stormFactor: number, cold: Tuning['cold'], night: NightTuning): number {
  if (!isNight) return -night.warmRecoveryPerSecond;
  return Math.max(0, night.freezeRatePerSecond - cold.heaterReductionPerHeat * heat) * stormFactor;
}

/**
 * Mars: the heat that counts now. An electric heater's heat (PartPower.electricHeat) counts only while its
 * draw is paid, that is while the battery is above zero; other heat (radioisotope units, an RTG's waste heat)
 * always counts. An empty battery also ends the mission, so this matters within the step that empties it.
 */
export function heatNow(totalHeat: number, electricHeat: number, batteryEnergy: number): number {
  return batteryEnergy > 0 ? totalHeat : Math.max(0, totalHeat - electricHeat);
}

/** Seconds of clear-sky night a rover lasts from a warm start before it freezes (Infinity if it never does). */
export function marsSecondsToFreeze(heat: number, cold: Tuning['cold'], night: NightTuning): number {
  const rate = marsFreezeRate(true, heat, 1, cold, night);
  return rate > 0 ? cold.freezeMax / rate : Infinity;
}
