// Energy: battery, solar income and drive cost. Pure, no physics.
import type { Tuning } from './types';
import type { NightTuning } from './marsTypes';

const DEG = Math.PI / 180;

/**
 * Energy to drive `distanceM` game meters. energyPerMeter already includes the mass penalty
 * (drive.ts); climbing adds slopeEnergyFactor per degree of uphill grade. Downhill costs the flat rate.
 */
export function driveEnergy(distanceM: number, uphillDeg: number, energyPerMeter: number, energy: Tuning['energy']): number {
  return Math.max(0, distanceM) * energyPerMeter * (1 + energy.slopeEnergyFactor * Math.max(0, uphillDeg));
}

/** Solar income over dt seconds: the power source's full-sun income times the share of the Sun's disc visible. */
export function solarIncome(energyIncome: number, sunlight: number, dt: number): number {
  return energyIncome * Math.min(Math.max(sunlight, 0), 1) * dt;
}

/** How far the battery alone drives on flat ground (game meters). Shown on the design screen. */
export function flatRangeM(batteryCapacity: number, energyPerMeter: number): number {
  return energyPerMeter > 0 ? batteryCapacity / energyPerMeter : Infinity;
}

// ---------------------------------------------------------------------------------------------------
// Mars: day and night (data/mars/tuning.json `night`).

/**
 * Share of a panel's full-sun rate at this Sun elevation: sin(el) / sin(fullSunElevationDeg), capped at 1,
 * 0 with the Sun down. Low Sun means slow charging in the morning and evening.
 */
export function lowSunFactor(elevationDeg: number, night: NightTuning): number {
  if (elevationDeg <= 0) return 0;
  if (night.fullSunElevationDeg <= 0) return 1;
  return Math.min(1, Math.sin(elevationDeg * DEG) / Math.sin(night.fullSunElevationDeg * DEG));
}

/**
 * Battery drain per second at night, apart from driving: asleep (P) the slow sleep drain; awake with lights
 * the lights-on drain; awake without lights the electronics drain. No drain by day.
 */
export function nightDrainPerSecond(isNight: boolean, poweredDown: boolean, hasLights: boolean, night: NightTuning): number {
  if (!isNight) return 0;
  if (poweredDown) return night.sleepDrainPerSecond;
  return hasLights ? night.lightsDrainPerSecond : night.awakeDrainPerSecond;
}

/** Whether the rover may drive on Mars: never asleep, and at night only with lights (unless the night allows it). */
export function canDriveMars(isNight: boolean, poweredDown: boolean, hasLights: boolean, night: NightTuning): boolean {
  if (poweredDown) return false;
  return !isNight || hasLights || night.driveWithoutLights;
}
