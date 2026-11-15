import type { Build, GameData, Tier } from './types';
import { isChassisOverloaded, roverTotals, selectedParts, type RoverTotals } from './rover';
import { ticketTier } from './tiers';

/** Everything the design screen needs to show about a build. */
export interface BuildQuote extends RoverTotals {
  tier: Tier | null; // null: over the top tier, cannot launch
  ticketPrice: number;
  totalCost: number; // parts + ticket
  canLaunch: boolean;
  canAfford: boolean;
  overloaded: boolean;
}

export function quoteBuild(build: Build, data: GameData, balance: number): BuildQuote {
  const parts = selectedParts(build, data.parts);
  const totals = roverTotals(parts);
  const tier = ticketTier(totals.mass, totals.size, data.tiers.tiers);
  const ticketPrice = tier?.price ?? 0;
  const totalCost = totals.cost + ticketPrice;
  return {
    ...totals,
    tier,
    ticketPrice,
    totalCost,
    canLaunch: tier !== null,
    canAfford: totalCost <= balance,
    overloaded: isChassisOverloaded(parts),
  };
}
