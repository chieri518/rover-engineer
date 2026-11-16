// The Titan rules (T3): the one-day clock and the real Sun, the sleep fast-forward, power, the always-on
// cold, the methane rain's effects and the graded soft-ground mask. Pure: the mission loop
// (rules/mission.ts titanStatus) and the mission screen call these. Numbers are in data/titan/.
//
// Clock: the Mars sol clock (rules/sol.ts) with one "sol" of 900 s (450 s day, 450 s night), starting
// 150 s after sunrise, and Titan's obliquity for the season. The Sun follows real local solar time at the
// site (5.2°N in the Shangri-La dunes) with the subsolar point about 20°S (late 2034, Ls about 309).
import type { NightTuning, SolTuning } from './marsTypes';
import type { RainstormSpec, TitanColdTuning, TitanPowerTuning, TitanSleepTuning } from './titanTypes';
import type { Tuning } from './types';
import { solClock, solClockSeconds, TITAN_OBLIQUITY_DEG, type SolState } from './sol';
import { sunAzEl } from './marsSun';
import { skyDirection, type SkyDirection } from './sun';
import type { StormPhase } from './storm';

export interface TitanSite {
  latitudeDeg: number; // terrain.json sunAndEarth.siteLatitude_deg
  longitudeDeg: number;
}

// ---------------------------------------------------------------------------------------------------
// Clock and Sun

/** The Titan day clock after `seconds` of mission time (sol is always 1; isNight, local solar time, declination). */
export function titanClock(seconds: number, sol: SolTuning, latitudeDeg: number): SolState {
  return solClock(seconds, sol, latitudeDeg, TITAN_OBLIQUITY_DEG);
}

/** The Sun at the Titan site after `seconds` of mission time, as a SkyDirection (elevation < 0 at night). For startMoonScene({ sunAt }). */
export function titanSunAt(seconds: number, sol: SolTuning, site: TitanSite): SkyDirection {
  const clock = titanClock(seconds, sol, site.latitudeDeg);
  const { azimuthDeg, elevationDeg } = sunAzEl(site.latitudeDeg, clock.declinationDeg, clock.hourAngleDeg);
  return skyDirection(azimuthDeg, elevationDeg);
}

/** Whether mission time `seconds` falls in a night (dusk to dawn). Needs no latitude. */
export function isNightAt(seconds: number, sol: SolTuning): boolean {
  const t = solClockSeconds(seconds, sol);
  return t - Math.floor(t / sol.secondsPerSol) * sol.secondsPerSol >= sol.daySeconds;
}

/** Mission time of the next dawn after `seconds` (the end of the current night, or of the next one by day). */
export function nextDawnAt(seconds: number, sol: SolTuning): number {
  const t = solClockSeconds(seconds, sol);
  return (Math.floor(t / sol.secondsPerSol) + 1) * sol.secondsPerSol - solClockSeconds(0, sol);
}

// ---------------------------------------------------------------------------------------------------
// Sleep fast-forward

/** Mission clock rate: sleep.nightClockRate while asleep at night, otherwise 1. */
export function titanClockRate(isNight: boolean, poweredDown: boolean, sleep: TitanSleepTuning | undefined): number {
  return isNight && poweredDown ? Math.max(1, sleep?.nightClockRate ?? 1) : 1;
}

/**
 * Mission seconds that pass in `wallDt` real seconds. Asleep at night the clock runs nightClockRate times
 * faster, up to dawn; any wall time left after dawn runs at 1 (the rover wakes at dawn). Pass the result
 * as MissionSample.dt: drains, cooling and events all follow mission time.
 */
export function titanMissionDelta(
  wallDt: number,
  missionSeconds: number,
  poweredDown: boolean,
  sol: SolTuning,
  sleep: TitanSleepTuning | undefined,
): number {
  const dt = Math.max(0, wallDt);
  const rate = titanClockRate(isNightAt(missionSeconds, sol), poweredDown, sleep);
  if (rate === 1) return dt;
  const toDawn = nextDawnAt(missionSeconds, sol) - missionSeconds;
  return dt * rate <= toDawn ? dt * rate : toDawn + (dt - toDawn / rate);
}

// ---------------------------------------------------------------------------------------------------
// Power. The drains are the Mars night drains (tuning.night), but the awake drain applies by day too.

/** Solar income multiplier on Titan: the tiny Titan factor by day, nothing at night. */
export function titanSolarFactor(isNight: boolean, power: TitanPowerTuning | undefined): number {
  return isNight ? 0 : power?.solarFactor ?? 0;
}

/**
 * Battery drain per second on Titan apart from driving and constant power: asleep (P) the sleep drain,
 * awake at night with lights the lights drain, otherwise the electronics (awake) drain, day and night.
 */
export function titanDrainPerSecond(isNight: boolean, poweredDown: boolean, hasLights: boolean, night: NightTuning): number {
  if (poweredDown) return night.sleepDrainPerSecond;
  return isNight && hasLights ? night.lightsDrainPerSecond : night.awakeDrainPerSecond;
}

// ---------------------------------------------------------------------------------------------------
// Cold: always on, map-wide

/** Heat units on Titan: the parts' heat (heater, waste heat), plus the electronics while awake, plus more while driving. */
export function titanHeat(partsHeat: number, poweredDown: boolean, driving: boolean, titanCold: TitanColdTuning): number {
  if (poweredDown) return partsHeat;
  return partsHeat + titanCold.awakeHeat + (driving ? titanCold.drivingHeat : 0);
}

/**
 * Freeze meter change per second on Titan: the base rate (times the rain's freeze factor) minus the
 * reduction per heat unit. Negative = recovering. Asleep, only the parts' heat counts.
 */
export function titanFreezeRate(
  partsHeat: number,
  poweredDown: boolean,
  driving: boolean,
  rainFactor: number,
  titanCold: TitanColdTuning,
  cold: Tuning['cold'],
): number {
  const perHeat = titanCold.heaterReductionPerHeat ?? cold.heaterReductionPerHeat;
  return titanCold.freezeRatePerSecond * rainFactor - perHeat * titanHeat(partsHeat, poweredDown, driving, titanCold);
}

/** Seconds from a warm start until the rover freezes in clear weather (Infinity if it never does). */
export function titanSecondsToFreeze(partsHeat: number, poweredDown: boolean, driving: boolean, titanCold: TitanColdTuning, cold: Tuning['cold']): number {
  const rate = titanFreezeRate(partsHeat, poweredDown, driving, 1, titanCold, cold);
  return rate > 0 ? cold.freezeMax / rate : Infinity;
}

// ---------------------------------------------------------------------------------------------------
// Methane rain (scheduled with rules/storm.ts scheduleRainstorm; intensity with stormIntensity)

/** Photos do not count while the rain falls (start to end, ramps included), if the spec says so. */
export function rainBlocksPhotos(phase: StormPhase, spec: RainstormSpec | undefined): boolean {
  return !!spec?.blocksPhotos && phase === 'active';
}

// ---------------------------------------------------------------------------------------------------
// Soft ground: soft-ground.png is graded and authoritative on Titan (softness = value / 255).

/** A square 8-bit mask on the vertex-centered play-area grid: x = (col − (n − 1) / 2) × pixelM, z likewise by row. */
export interface GridMask {
  data: ArrayLike<number>;
  n: number;
  pixelM: number;
}

/** Bilinear mask value (0..255) at local (x, z), clamped to the grid. */
export function sampleMask(mask: GridMask, x: number, z: number): number {
  const { data, n, pixelM } = mask;
  const half = (n - 1) / 2;
  const c = Math.min(n - 1, Math.max(0, x / pixelM + half));
  const r = Math.min(n - 1, Math.max(0, z / pixelM + half));
  const c0 = Math.min(n - 2, Math.floor(c));
  const r0 = Math.min(n - 2, Math.floor(r));
  const fc = c - c0;
  const fr = r - r0;
  const at = (rr: number, cc: number) => data[rr * n + cc] ?? 0;
  const top = at(r0, c0) * (1 - fc) + at(r0, c0 + 1) * fc;
  const bottom = at(r0 + 1, c0) * (1 - fc) + at(r0 + 1, c0 + 1) * fc;
  return top * (1 - fr) + bottom * fr;
}

/** Ground softness 0..1 at (x, z) from soft-ground.png (value / 255), for MissionSample.softness on Titan. */
export function maskSoftness(mask: GridMask, x: number, z: number): number {
  return Math.min(1, Math.max(0, sampleMask(mask, x, z) / 255));
}
