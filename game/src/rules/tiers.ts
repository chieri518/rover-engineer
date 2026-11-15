import type { Tier } from './types';

/**
 * The smallest tier that fits both mass and size, or null if the rover is over the top tier
 * (it cannot launch). Tiers must be ordered smallest to largest.
 */
export function ticketTier(mass: number, size: number, tiers: Tier[]): Tier | null {
  return tiers.find((t) => mass <= t.massLimit && size <= t.sizeLimit) ?? null;
}
