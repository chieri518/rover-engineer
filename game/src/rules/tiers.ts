import type { Tier } from './types';

/**
 * The smallest tier that fits both mass and size, or null if the rover is over the top tier
 * (it cannot launch). Tiers must be ordered smallest to largest.
 */
export function ticketTier(mass: number, size: number, tiers: Tier[]): Tier | null {
  return tiers.find((t) => mass <= t.massLimit && size <= t.sizeLimit) ?? null;
}

/** How a rover compares with one tier's limits. */
export interface TierFit {
  tier: Tier;
  massOver: number; // kg above the mass limit, 0 if within
  sizeOver: number; // size units above the size limit, 0 if within
  fits: boolean;
}

/** Why the rover got its tier: how it compares with every tier, and what it would take to drop one. */
export interface TierExplanation {
  tier: Tier | null; // the rover's tier, null if over the top tier
  fits: TierFit[]; // one per tier, smallest to largest
  /**
   * The largest tier the rover does not fit (the one just below its tier, or the top tier if it
   * cannot launch): the limits that pushed it up. Null when the rover fits the smallest tier.
   */
  exceeded: TierFit | null;
  /** Ticket price saved by trimming down to the exceeded tier; 0 if there is none or the rover cannot launch. */
  saving: number;
}

export function tierFit(mass: number, size: number, tier: Tier): TierFit {
  const massOver = Math.max(0, mass - tier.massLimit);
  const sizeOver = Math.max(0, size - tier.sizeLimit);
  return { tier, massOver, sizeOver, fits: massOver === 0 && sizeOver === 0 };
}

export function explainTier(mass: number, size: number, tiers: Tier[]): TierExplanation {
  const fits = tiers.map((t) => tierFit(mass, size, t));
  const index = fits.findIndex((f) => f.fits);
  const tier = index === -1 ? null : tiers[index]!;
  const exceeded = index === -1 ? (fits[fits.length - 1] ?? null) : index > 0 ? fits[index - 1]! : null;
  const saving = tier && exceeded ? tier.price - exceeded.tier.price : 0;
  return { tier, fits, exceeded, saving };
}
