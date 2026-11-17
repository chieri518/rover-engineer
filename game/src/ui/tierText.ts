// Turns the rules' tier explanation into a sentence for the launch ticket screen (the desk shows the tier alone).
import type { TierExplanation, TierFit } from '../rules/tiers';
import type { TextFile } from '../rules/types';
import { fill } from './dom';

function overReasons(fit: TierFit, text: TextFile): string {
  const t = text.ticket;
  const reasons: string[] = [];
  if (fit.massOver > 0) reasons.push(fill(t.massOver, { n: fit.massOver }));
  if (fit.sizeOver > 0) reasons.push(fill(t.sizeOver, { n: fit.sizeOver }));
  return reasons.join(t.and);
}

/** "The rover exceeds the Small tier's mass limit by 9 kg, so Medium is the smallest tier that fits." */
export function tierWhyText(why: TierExplanation, text: TextFile): string {
  const t = text.ticket;
  if (!why.tier) {
    return why.exceeded ? fill(t.whyNone, { tier: why.exceeded.tier.name, reasons: overReasons(why.exceeded, text) }) : '';
  }
  if (!why.exceeded) return fill(t.whySmallest, { tier: why.tier.name });
  return fill(t.whyPushed, { lower: why.exceeded.tier.name, reasons: overReasons(why.exceeded, text), tier: why.tier.name });
}
