// What the parts mean for driving: the inputs the rover vehicle takes. Pure, no physics.
import type { Part, Tuning } from './types';
import { roverTotals } from './rover';

/** The rover vehicle's per-build inputs. Handling shared by all builds is in tuning.rover. */
export interface RoverParams {
  massKg: number; // total rover mass
  topSpeed: number; // game m/s on flat ground, after the mass penalty and speed compression
  grip: number; // 0..1 from the wheels; higher = more traction
}

/** What the design screen shows about how a build drives. */
export interface DriveStats extends RoverParams {
  realTopSpeed: number; // m/s before speed compression: the real-world speed the parts are modeled on
  energyPerMeter: number; // drive energy per meter on flat ground, after the mass penalty
  batteryCapacity: number;
  energyIncome: number; // energy per second in full sun
  constantPower: number; // energy per second regardless of the Sun (PartEffects.constantPower)
}

/** Share of the base speed left after the mass penalty: 1 at or below the reference mass, never below the floor. */
export function massSpeedFactor(massKg: number, mass: Tuning['mass']): number {
  const factor = 1 - mass.speedLossPerKg * (massKg - mass.referenceMass);
  return Math.min(1, Math.max(mass.minSpeedFactor, factor));
}

/** A heavier rover drives slower: base speed minus a share per kg above the reference mass (real m/s). */
export function driveSpeed(baseSpeed: number, massKg: number, mass: Tuning['mass']): number {
  return baseSpeed * massSpeedFactor(massKg, mass);
}

/** Time is compressed (about one Earth day per minute of play), so driving is too: game speed = real speed × compression. */
export function gameSpeed(realSpeed: number, speed: Tuning['speed']): number {
  return realSpeed * speed.compression;
}

/** A heavier rover uses more energy per meter: +energyGainPerKg per kg above the reference mass. */
export function massEnergyFactor(massKg: number, mass: Tuning['mass']): number {
  return 1 + mass.energyGainPerKg * Math.max(0, massKg - mass.referenceMass);
}

export function roverParams(parts: Part[], tuning: Tuning): RoverParams {
  const { mass } = roverTotals(parts);
  const wheels = parts.find((p) => p.slot === 'wheels');
  const realTop = driveSpeed(wheels?.effects.baseSpeed ?? 0, mass, tuning.mass);
  return {
    massKg: mass,
    topSpeed: gameSpeed(realTop, tuning.speed),
    grip: wheels?.effects.grip ?? 0.5,
  };
}

export function driveStats(parts: Part[], tuning: Tuning): DriveStats {
  const params = roverParams(parts, tuning);
  const effect = (key: 'energyPerMeter' | 'batteryCapacity' | 'energyIncome' | 'constantPower') =>
    parts.reduce((sum, p) => sum + (p.effects[key] ?? 0), 0);
  return {
    ...params,
    realTopSpeed: params.topSpeed / tuning.speed.compression,
    energyPerMeter: effect('energyPerMeter') * massEnergyFactor(params.massKg, tuning.mass),
    batteryCapacity: effect('batteryCapacity'),
    energyIncome: effect('energyIncome'),
    constantPower: effect('constantPower'),
  };
}
