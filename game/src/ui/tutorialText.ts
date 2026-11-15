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
  opts: { mission: CampaignStep; instrument: Instrument | null; balance?: number },
): TutorialPageText[] {
  const { text, tuning, tiers } = data;
  const t = text.tutorial;
  const list = tiers.tiers;
  const vars: Record<string, string | number> = {
    ...missionVars(data),
    balance: money(opts.balance ?? 0, text),
    tiers: list
      .map((tier) => fill(t.tierItem, { name: tier.name, mass: tier.massLimit, size: tier.sizeLimit, price: money(tier.price, text) }))
      .join(t.tierJoin),
    top: list[list.length - 1]?.name ?? '',
    nextMinimum: money(tuning.budget.minimumBudget[nextMission(opts.mission) ?? opts.mission], text),
  };
  return t[id].map((page) => {
    const instrumentLine = opts.instrument ? page.instrument?.[opts.instrument] : undefined;
    return {
      title: fill(page.title, vars),
      paragraphs: [...(instrumentLine ? [instrumentLine] : []), ...page.body].map((p) => fill(p, vars)),
    };
  });
}

/**
 * The mission's numbers for {placeholders} in tutorial and briefing text: the Moon's, and on Mars the
 * sol clock, the night and the dust storm (the Mars keys are 0 on the Moon, whose text does not use them).
 */
export function missionVars(data: GameData): Record<string, string | number> {
  const { text, tuning, events } = data;
  const sol = tuning.sol;
  const perSol = sol?.secondsPerSol || 1;
  const storm = events.duststorm;
  return {
    minutes: +(tuning.mission.lengthSeconds / 60).toFixed(1),
    days: tuning.mission.gameDays,
    maxSlope: tuning.ground.maxSlopeDegrees,
    warningSeconds: events.flare?.warningSeconds ?? 0,
    earthMinDistance: tuning.milestones.earthPhotoMinDistanceM,
    sampleSpacing: tuning.milestones.sampleSpacingM,
    sunlit: text.hud.sunlit,
    shadow: text.hud.shadow,
    revealRadius: tuning.explore.revealRadiusM,
    sols: sol?.sols ?? 0,
    secondsPerSol: sol?.secondsPerSol ?? 0,
    daySeconds: sol?.daySeconds ?? 0,
    nightSeconds: sol?.nightSeconds ?? 0,
    stormLeadSols: storm ? +(storm.warningSeconds / perSol).toFixed(1) : 0,
    stormSols: storm ? +(storm.durationSeconds / perSol).toFixed(1) : 0,
    stormSolarPercent: storm ? Math.round(storm.solarFactor * 100) : 0,
    sunsetNotice: text.night?.sunset ?? '',
  };
}
