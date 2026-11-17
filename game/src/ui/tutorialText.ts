// Tutorial pages with their {name} placeholders filled from the game data (no DOM, so it is testable).
import { isPlayable, nextMission } from '../rules/campaign';
import type { GameData, Instrument, CampaignStep } from '../rules/types';
import type { TutorialId } from '../save/tutorialSeen';
import { fill, money } from './dom';

export interface TutorialPageText {
  title: string;
  paragraphs: string[];
  /** The drive help's Controls section, shown above the paragraphs: its heading and key caps. */
  controls?: { heading: string; keys: TutorialKeyText[] };
  /** The drive help's Instruments page: one row per instrument carried, in bay order, shown after the paragraphs. */
  instruments?: TutorialInstrumentText[];
}

/** One Controls entry: groups of key caps, joined by `join` ("or" between alternatives, "to" in the bay's "1 to n"). */
export interface TutorialKeyText {
  caps: string[][];
  join: string;
  label: string;
}

/** One instrument row: its mission key, name, step chips and where it counts, all filled. */
export interface TutorialInstrumentText {
  key: number;
  name: string;
  steps: string[];
  counts?: string;
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
  const bay = opts.instruments;
  return t[id].map((page) => {
    const out: TutorialPageText = { title: fill(page.title, vars), paragraphs: page.body.map((p) => fill(p, vars)) };
    if (page.keys) {
      // The bay's entry reads "1 to n" (just "1" for one instrument) and is left out for an empty bay.
      const keys = page.keys.flatMap((k): TutorialKeyText[] => {
        if (!k.bay) return [{ caps: (k.caps ?? []).map((g) => g.map((c) => fill(c, vars))), join: t.keysOr, label: fill(k.label, vars) }];
        if (bay.length === 0) return [];
        return [{ caps: bay.length === 1 ? [['1']] : [['1'], [String(bay.length)]], join: t.keysTo, label: fill(k.label, vars) }];
      });
      out.controls = { heading: t.controlsHeading, keys };
    }
    if (page.instruments) {
      // An empty bay: the page's only line says so. A carried instrument this world's help does not
      // cover still gets its row (key and part name), so the rows match the HUD buttons.
      if (bay.length === 0) return { ...out, paragraphs: page.emptyBay ? [fill(page.emptyBay, vars)] : [] };
      out.instruments = bay.map((inst, i) => {
        const key = i + 1;
        const row = page.instruments![inst];
        const part = data.allParts.parts.find((p) => p.effects.instrument === inst);
        if (!row) return { key, name: part?.name ?? inst, steps: [] };
        // {energy} and {standby}: the part's own costs, the numbers the mission charges (see payload.ts).
        const v = { ...vars, key, energy: part?.effects.energyPerUse ?? 0, standby: part?.effects.standbyEnergy ?? 0 };
        return { key, name: fill(row.name, v), steps: row.steps.map((s) => fill(s, v)), ...(row.counts ? { counts: fill(row.counts, v) } : {}) };
      });
    }
    return out;
  });
}

/** Every string a page shows, in reading order (for search and tests): an instrument row reads "Name: step · step. Counts". */
export function pageStrings(page: TutorialPageText): string[] {
  return [
    page.title,
    ...(page.controls ? [page.controls.heading, ...page.controls.keys.map((k) => `${k.caps.map((g) => g.join(' ')).join(` ${k.join} `)}: ${k.label}`)] : []),
    ...page.paragraphs,
    ...(page.instruments ?? []).map(instrumentLine),
  ];
}

/** An instrument row as one line: "Drill: Stop · Press 2 · Drills a sample. Counts at …". */
export function instrumentLine(row: TutorialInstrumentText): string {
  return `${row.name}: ${row.steps.join(' · ')}${row.steps.length ? '.' : ''}${row.counts ? ` ${row.counts}` : ''}`;
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
