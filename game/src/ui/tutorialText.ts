// Tutorial pages with their {name} placeholders filled from the game data (no DOM, so it is testable).
import { isPlayable, nextMission } from '../rules/campaign';
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
  opts: { mission: CampaignStep; instruments: Instrument[]; balance?: number }, // instruments: the payload bay, in bay order
): TutorialPageText[] {
  const { text, tiers } = data;
  const t = text.tutorial;
  const list = tiers.tiers;
  const vars: Record<string, string | number> = {
    ...missionVars(data),
    balance: money(opts.balance ?? 0, text),
    tiers: list
      .map((tier) => fill(t.tierItem, { name: tier.name, mass: tier.massLimit, size: tier.sizeLimit, price: money(tier.price, text) }))
      .join(t.tierJoin),
    top: list[list.length - 1]?.name ?? '',
    nextMinimum: nextMinimum(opts.mission, data),
  };
  return t[id].map((page) => {
    // One line per carried instrument, with its mission key (bay order).
    const instrumentLines = opts.instruments.flatMap((inst, i) => {
      const line = page.instrument?.[inst];
      return line ? [fill(line, { ...vars, key: i + 1 })] : [];
    });
    return {
      title: fill(page.title, vars),
      // In the drive tutorial, a body line that mentions the bay's number keys ({bayMax}) is left out for an empty bay.
      paragraphs: [...instrumentLines, ...page.body.filter((p) => id !== 'drive' || opts.instruments.length > 0 || !p.includes('{bayMax}')).map((p) => fill(p, vars))],
    };
  });
}

/** The Welcome to REL intro pages (text.intro), filled from the Moon's data: {budget}, {nextMinimum}. */
export function introPages(data: GameData): TutorialPageText[] {
  const vars = { ...missionVars(data), nextMinimum: nextMinimum('moon', data) };
  return data.text.intro.pages.map((page) => ({ title: fill(page.title, vars), paragraphs: page.body.map((p) => fill(p, vars)) }));
}

/** The next mission's minimum budget (the pass mark); empty after the last mission, which passes on survival. */
function nextMinimum(mission: CampaignStep, data: GameData): string {
  const next = nextMission(mission);
  return next && isPlayable(next) ? money(data.tuning.budget.minimumBudget[next], data.text) : '';
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
  const rain = events.rainstorm;
  const minutes = (seconds: number) => +(Math.max(0, seconds) / 60).toFixed(1);
  return {
    budget: money(tuning.budget.startingBudget, text), // the campaign's starting budget
    minutes: +(tuning.mission.lengthSeconds / 60).toFixed(1),
    days: tuning.mission.gameDays,
    maxSlope: tuning.ground.maxSlopeDegrees,
    warningSeconds: events.flare?.warningSeconds ?? 0,
    earthMinDistance: tuning.milestones.earthPhotoMinDistanceM,
    sampleSpacing: tuning.milestones.sampleSpacingM,
    stationMinDistance: tuning.milestones.sampleMinDistanceM, // stations count outside the near-lander zone (game-design.md, M9)
    bayMax: Math.max(0, ...data.parts.parts.map((p) => p.effects.mountingPoints ?? 0)),
    bayMin: Math.min(...data.parts.parts.flatMap((p) => (p.effects.mountingPoints === undefined ? [] : [p.effects.mountingPoints]))),
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
    // Titan: one day with the mission starting after sunrise, the sleep fast-forward and the rainstorm.
    dayLeftMinutes: sol ? minutes(sol.daySeconds - (sol.startSecondsIntoDay ?? 0)) : 0,
    nightMinutes: sol ? minutes(sol.nightSeconds) : 0,
    dawnMinutes: sol ? minutes(tuning.mission.lengthSeconds - sol.daySeconds - sol.nightSeconds + (sol.startSecondsIntoDay ?? 0)) : 0,
    nightClockRate: tuning.sleep?.nightClockRate ?? 1,
    rainWarningSeconds: rain?.warningSeconds ?? 0,
    rainSeconds: rain?.durationSeconds ?? 0,
  };
}
