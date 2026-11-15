// Tutorial pages with their {name} placeholders filled from the game data (no DOM, so it is testable).
import { nextMission } from '../rules/campaign';
import type { GameData, Instrument, MissionId } from '../rules/types';
import type { TutorialId } from '../save/tutorialSeen';
import { fill, money } from './dom';

export interface TutorialPageText {
  title: string;
  paragraphs: string[];
}

export function tutorialPages(
  id: TutorialId,
  data: GameData,
  opts: { mission: MissionId; instruments: Instrument[] }, // instruments: the payload bay, in bay order
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
    warningSeconds: events.flare.warningSeconds,
    earthMinDistance: tuning.milestones.earthPhotoMinDistanceM,
    sampleSpacing: tuning.milestones.sampleSpacingM,
    bayMax: Math.max(0, ...data.parts.parts.map((p) => p.effects.mountingPoints ?? 0)),
    bayMin: Math.min(...data.parts.parts.flatMap((p) => (p.effects.mountingPoints === undefined ? [] : [p.effects.mountingPoints]))),
    sunlit: text.hud.sunlit,
    shadow: text.hud.shadow,
  };
  return t[id].map((page) => {
    // One line per carried instrument, with its mission key (bay order).
    const instrumentLines = opts.instruments.flatMap((inst, i) => {
      const line = page.instrument?.[inst];
      return line ? [fill(line, { ...vars, key: i + 1 })] : [];
    });
    return {
      title: fill(page.title, vars),
      paragraphs: [...instrumentLines, ...page.body.map((p) => fill(p, vars))],
    };
  });
}
