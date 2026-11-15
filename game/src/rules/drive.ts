// What the parts mean for driving: the inputs the rover vehicle takes. Pure, no physics.
import type { Part, Tuning } from './types';
import { roverTotals } from './rover';

/** The rover vehicle's per-build inputs. Handling shared by all builds is in tuning.rover. */
export interface RoverParams {
  massKg: number; // total rover mass
  topSpeed: number; // m/s on flat ground, after the mass penalty
  grip: number; // 0..1 from the wheels; higher = more traction
}

/** A heavier rover drives slower: base speed minus a share per kg above the reference mass. */
export function driveSpeed(baseSpeed: number, massKg: number, mass: Tuning['mass']): number {
  const factor = 1 - mass.speedLossPerKg * (massKg - mass.referenceMass);
  return baseSpeed * Math.min(1, Math.max(mass.minSpeedFactor, factor));
}

export function roverParams(parts: Part[], tuning: Tuning): RoverParams {
  const { mass } = roverTotals(parts);
  const wheels = parts.find((p) => p.slot === 'wheels');
  const baseSpeed = wheels?.effects.baseSpeed ?? 0;
  return {
    massKg: mass,
    topSpeed: driveSpeed(baseSpeed, mass, tuning.mass),
    grip: wheels?.effects.grip ?? 0.5,
  };
}
