// Damage by cause. Amounts come from tuning.json (damage, ground) and events.json. Pure.
import type { Tuning } from './types';

export type DamageCause = 'impact' | 'slope' | 'overload' | 'flare' | 'quake';

/** A hard impact (a rock or a bad landing), measured as a sudden change in the rover's velocity. */
export function impactDamage(deltaVMps: number, damage: Tuning['damage']): number {
  if (deltaVMps < damage.impactMinMps) return 0;
  return damage.rockHit + damage.impactPerMps * (deltaVMps - damage.impactMinMps);
}

/** Driving on ground steeper than the slope limit (Apollo 15 design limit about 20°). */
export function steepSlopeDamage(slopeDeg: number, driving: boolean, dt: number, t: Tuning): number {
  return driving && slopeDeg > t.ground.maxSlopeDegrees ? t.damage.steepSlopePerSecond * dt : 0;
}

/** A frame carrying more than its maximum load strains while the rover drives: per kg over, per second. */
export function overloadDamage(overloadKg: number, driving: boolean, dt: number, damage: Tuning['damage']): number {
  return driving && overloadKg > 0 ? damage.overloadPerKgSecond * overloadKg * dt : 0;
}

/** Tilt of the rover from upright, in degrees, from the y component of its up vector. */
export function tiltDeg(upY: number): number {
  return (Math.acos(Math.min(1, Math.max(-1, upY))) * 180) / Math.PI;
}
