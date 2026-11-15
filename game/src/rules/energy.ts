// Energy: battery, solar income and drive cost. Pure, no physics.
import type { Tuning } from './types';

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
