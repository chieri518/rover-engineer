import type { DraftBuild, GameData, Slot, Tier } from './types';
import { chosenParts, isChassisOverloaded, missingSlots, roverTotals, type RoverTotals } from './rover';
import { explainTier, type TierExplanation } from './tiers';
import { driveStats, type DriveStats } from './drive';

/** Everything the design and ticket screens need to show about a build. */
export interface BuildQuote extends RoverTotals {
  tier: Tier | null; // null: over the top tier, cannot launch
  tierWhy: TierExplanation;
  ticketPrice: number;
  totalCost: number; // parts + ticket
  remaining: number; // balance left after buying parts and ticket (negative if unaffordable)
  canLaunch: boolean;
  canAfford: boolean;
  overloaded: boolean;
  maxLoad: number | null; // the chassis maximum load in kg
  drive: DriveStats;
  missing: Slot[]; // slots with no part chosen yet: totals cover the chosen parts only
  complete: boolean;
}

/** Works on a draft build too: the totals then cover the parts chosen so far. */
export function quoteBuild(build: DraftBuild, data: GameData, balance: number): BuildQuote {
  const parts = chosenParts(build, data.parts);
  const missing = missingSlots(build, data.parts);
  const totals = roverTotals(parts);
  const tierWhy = explainTier(totals.mass, totals.size, data.tiers.tiers);
  const tier = tierWhy.tier;
  const ticketPrice = tier?.price ?? 0;
  const totalCost = totals.cost + ticketPrice;
  return {
    ...totals,
    tier,
    tierWhy,
    ticketPrice,
    totalCost,
    remaining: balance - totalCost,
    canLaunch: tier !== null,
    canAfford: totalCost <= balance,
    overloaded: isChassisOverloaded(parts),
    maxLoad: parts.find((p) => p.slot === 'chassis')?.effects.maxLoad ?? null,
    drive: driveStats(parts, data.tuning),
    missing,
    complete: missing.length === 0,
  };
}
