// Tutorial pages with their {name} placeholders filled from the game data (no DOM, so it is testable).
import { nextMission } from '../rules/campaign';
import type { GameData, Instrument, CampaignStep } from '../rules/types';
import type { TutorialId } from '../save/tutorialSeen';
import { fill, money } from './dom';

export interface TutorialPageText {
  title: string;
  paragraphs: string[];
}

export function tutorialPages(
  id: TutorialId,
  data: GameData,
  opts: { mission: CampaignStep; instrument: Instrument | null },
): TutorialPageText[] {
  const { text, tuning, tiers, events } = data;
  const t = text.tutorial;
  const list = tiers.tiers;
  const vars: Record<string, string | number> = {
    tiers: list
      .map((tier) => fill(t.tierItem, { name: tier.name, mass: tier.massLimit, size: tier.sizeLimit, price: money(tier.price, text) }))
      .join(t.tierJoin),
    top: list[list.length - 1]?.name ?? '',
    nextMinimum: money(tuning.budget.minimumBudget[nextMission(opts.mission) ?? opts.mission], text),
    minutes: +(tuning.mission.lengthSeconds / 60).toFixed(1),
    days: tuning.mission.gameDays,
    maxSlope: tuning.ground.maxSlopeDegrees,
    warningSeconds: events.flare?.warningSeconds ?? 0,
    earthMinDistance: tuning.milestones.earthPhotoMinDistanceM,
    sampleSpacing: tuning.milestones.sampleSpacingM,
    sunlit: text.hud.sunlit,
    shadow: text.hud.shadow,
    revealRadius: tuning.explore.revealRadiusM,
  };
  return t[id].map((page) => {
    const instrumentLine = opts.instrument ? page.instrument?.[opts.instrument] : undefined;
    return {
      title: fill(page.title, vars),
      paragraphs: [...(instrumentLine ? [instrumentLine] : []), ...page.body].map((p) => fill(p, vars)),
    };
  });
}
