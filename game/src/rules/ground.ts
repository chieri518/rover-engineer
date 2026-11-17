// Soft ground, sinkage, wheel slip and getting stuck. Based on the Apollo 15 Lunar Roving Vehicle
// (NASA TR R-401): wheels sank 1 to 2 cm on normal ground and 5 to 7 cm on the soft rims of fresh
// craters; drivers did not notice slip below about 20%, and above it the wheels dig in. Pure.
import type { SoftGroundRating, Tuning } from './types';

export interface SoftArea {
  x: number;
  z: number;
  radiusM: number;
}

/** Ground softness at (x, z), 0 (normal) to 1 (soft fresh crater rim), from the rocky areas (fresh craters). */
export function softnessAt(x: number, z: number, areas: readonly SoftArea[], ground: Tuning['ground']): number {
  let soft = 0;
  for (const a of areas) {
    const d = Math.hypot(x - a.x, z - a.z);
    const inner = a.radiusM * ground.softRadiusFactor;
    const outer = a.radiusM * ground.softFadeFactor;
    const s = d <= inner ? 1 : d >= outer ? 0 : (outer - d) / (outer - inner);
    soft = Math.max(soft, s);
  }
  return soft;
}

const mid = ([a, b]: [number, number]) => (a + b) / 2;

/** Wheel sinkage in cm: soil softness sets the base, a heavier rover and weaker wheels sink deeper. */
export function sinkageCm(softness: number, massKg: number, grip: number, t: Tuning): number {
  const g = t.ground;
  const base = mid(g.normalSinkageCm) + (mid(g.softRimSinkageCm) - mid(g.normalSinkageCm)) * softness;
  const pressure = (massKg / t.mass.referenceMass) * (g.referenceGrip / Math.max(grip, 0.05));
  return base * pressure;
}

/**
 * The desk's Soft ground rating of a build: its sinkage at the reference softness (the softest ground, the same
 * on every world), Good below fairFromCm, Fair below poorFromCm, Poor from it (tuning.ground.softGroundRating).
 */
export function softGroundRating(massKg: number, grip: number, t: Tuning): { rating: SoftGroundRating; sinkageCm: number } {
  const r = t.ground.softGroundRating;
  const sinkage = sinkageCm(r.referenceSoftness, massKg, grip, t);
  return { rating: sinkage >= r.poorFromCm ? 'poor' : sinkage >= r.fairFromCm ? 'fair' : 'good', sinkageCm: sinkage };
}

/** Wheel slip (0..1) while driving: from sinkage, plus uphill grades steeper than slopeSlipFreeDeg. */
export function wheelSlip(softness: number, massKg: number, grip: number, uphillDeg: number, t: Tuning): number {
  const g = t.ground;
  const slip = sinkageCm(softness, massKg, grip, t) * g.slipPerSinkageCm + g.slipPerUphillDeg * Math.max(0, uphillDeg - g.slopeSlipFreeDeg);
  return Math.min(1, Math.max(0, slip));
}

/**
 * The dig-in meter (0..1): it fills over stuckSeconds while the driver pushes the throttle with slip
 * above the limit, and drains otherwise. Full means stuck for good.
 */
export function stepDig(dig: number, slip: number, throttling: boolean, dt: number, ground: Tuning['ground']): number {
  const digging = throttling && slip > ground.slipLimit;
  const next = digging ? dig + dt / ground.stuckSeconds : dig - ground.digRecoveryPerSecond * dt;
  return Math.min(1, Math.max(0, next));
}
