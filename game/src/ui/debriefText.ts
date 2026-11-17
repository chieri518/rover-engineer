// The debrief's model (game-design.md, "Debrief tabs"): which tabs show and their labels, the round badge,
// the Overview tiles and payout rows, and the instrument log grouped by instrument. No DOM: screens.ts
// renders it.
import { earnedWith, rockTypeTally, type MilestoneGroupKey } from '../rules/milestoneLists';
import type { EarnedMilestone, MissionResult, Payout } from '../rules/payout';
import type { InstrumentLog } from '../rules/instruments';
import type { GameData, Instrument, TextFile } from '../rules/types';
import { causeText } from './milestoneText';
import { fill, money } from './dom';

type DebriefText = TextFile['debrief'];
export type Tone = 'good' | 'bad' | null;

// --- Tabs and badge ---

export type DebriefTabId = 'overview' | 'milestones' | 'lessons' | 'log' | 'photos';

export interface DebriefTab {
  id: DebriefTabId;
  label: string;
}

/** What each tab holds: milestones reached (one per milestone, staged ones once), lessons met (and how many are new), instrument log groups, photos. */
export interface DebriefCounts {
  milestones: number;
  lessons: number;
  newLessons: number;
  logGroups: number;
  photos: number;
  camera: boolean; // the launched bay carried a camera
}

/**
 * The tabs in order, with their counts in the labels. Overview and Milestones always show (Milestones has
 * its own empty line); Lessons and Instrument log only when they hold something; Photos when there are photos, or a camera was carried (its panel then says none were taken). Lessons counts the
 * new ones when there are any ("Lessons · 2 new"), else all of them ("Lessons · 1").
 */
export function debriefTabs(c: DebriefCounts, t: DebriefText): DebriefTab[] {
  const tabs: DebriefTab[] = [
    { id: 'overview', label: t.tabOverview },
    { id: 'milestones', label: fill(t.tabMilestones, { count: c.milestones }) },
  ];
  if (c.lessons > 0) {
    tabs.push({ id: 'lessons', label: c.newLessons > 0 ? fill(t.tabLessonsNew, { count: c.newLessons }) : fill(t.tabLessons, { count: c.lessons }) });
  }
  if (c.logGroups > 0) tabs.push({ id: 'log', label: t.tabLog });
  if (c.photos > 0 || c.camera) tabs.push({ id: 'photos', label: fill(t.tabPhotos, { count: c.photos }) });
  return tabs;
}

/** The short round result by the heading: "Passed · Mars unlocked", "Failed · restart the round" (Titan: survived or lost). */
export function debriefBadge(failed: boolean, t: DebriefText): { text: string; tone: Tone } {
  return failed ? { text: t.badgeFailed, tone: 'bad' } : { text: t.badgePassed, tone: 'good' };
}

/**
 * A lesson is new when it was not in the notebook at launch. Unknown (null, no launch notebook recorded):
 * none is marked new.
 */
export function lessonIsNew(id: string, notebookAtLaunch: readonly string[] | null): boolean {
  return notebookAtLaunch !== null && !notebookAtLaunch.includes(id);
}

// --- Overview ---

export interface StatTile {
  id: 'net' | 'balance' | 'rp' | 'milestones';
  label: string;
  value: string;
  sub: string | null;
  tone: Tone;
}

export interface OverviewInput {
  payout: Payout;
  balance: number; // after this mission
  failed: boolean;
  last: boolean; // the last mission (Titan): it passes on survival, not on the balance
  milestones: number; // milestones reached
  notReached: number; // the "Not reached" list's length
}

/** The four Overview tiles (in the Payout section): net change, balance, research points, milestones. */
export function overviewTiles(o: OverviewInput, data: GameData): StatTile[] {
  const { text } = data;
  const t = text.debrief;
  const net = o.payout.money;
  return [
    { id: 'net', label: t.net, value: money(net, text), sub: null, tone: net > 0 ? 'good' : net < 0 ? 'bad' : null },
    { id: 'balance', label: t.balance, value: money(o.balance, text), sub: null, tone: o.last ? null : o.failed ? 'bad' : 'good' },
    { id: 'rp', label: t.rpEarned, value: String(o.payout.rp), sub: null, tone: null },
    {
      id: 'milestones', label: t.tileMilestones, value: String(o.milestones),
      sub: o.notReached > 0 ? fill(t.tileNotReached, { count: o.notReached }) : null, tone: null,
    },
  ];
}

export interface PayoutRow {
  label: string;
  value: string;
  tone: Tone;
}

/** The payout breakdown above the tiles: survival payout, milestone rewards, loss penalty (with its cause when lost). */
export function payoutRows(payout: Payout, result: Pick<MissionResult, 'survived' | 'cause' | 'detail'>, data: GameData): PayoutRow[] {
  const { text } = data;
  const t = text.debrief;
  return [
    { label: t.survivalPayout, value: money(payout.survivalPayout, text), tone: null },
    { label: t.milestoneMoney, value: money(payout.milestoneMoney, text), tone: null },
    {
      label: result.survived ? t.penalty : `${t.penalty} (${causeText(result, text)})`,
      value: money(-payout.penalty, text),
      tone: payout.penalty > 0 ? 'bad' : null,
    },
  ];
}

// --- Milestone groups ---

/** An instrument's part name in this world ("X-ray spectrometer"), or its id when the world has no such part. */
export function instrumentName(instrument: Instrument, data: GameData): string {
  return data.parts.parts.find((p) => p.slot === 'instrument' && p.effects.instrument === instrument)?.name ?? instrument;
}

/** A debrief group's heading: "The rover", the instrument's part name, or "Instruments together". */
export function groupHeading(key: MilestoneGroupKey, data: GameData): string {
  const t = data.text.debrief;
  if (key.kind === 'rover') return t.groupRover;
  if (key.kind === 'combo') return t.groupCombo;
  return instrumentName(key.instrument, data);
}

// --- Instrument log ---

/** One carried instrument's part of the log: its readings, an optional summary (the rock collection), and the milestones it earned. */
export interface LogGroup {
  instrument: Instrument;
  heading: string; // the part name
  lines: string[];
  summary: string | null; // the X-ray's "Rock collection: n of 5 rock types."
  earned: string | null; // "Earned: Rock collection, Rare rock."
}

/**
 * A log line under its instrument's heading: the line's own "X-ray spectrometer: " prefix is dropped (and
 * the rest starts with a capital), since the heading already says it. A line with another prefix ("Laser
 * reading: ...") is kept as it is.
 */
export function withoutPrefix(line: string, heading: string): string {
  const prefix = `${heading}: `;
  if (!line.startsWith(prefix)) return line;
  const rest = line.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * The debrief's instrument log, one group per carried new instrument in the log's own order (none for
 * instruments not carried), with plain wording when unused. The X-ray lists one line per rock read and adds the rock
 * types read out of all the suites' types (when the world has a rock-collection milestone and a rock was
 * read); each group names the milestones earned that need its instrument ("Earned: ...").
 */
export function instrumentLogGroups(log: InstrumentLog | null, data: GameData, earned: readonly EarnedMilestone[]): LogGroup[] {
  if (!log) return [];
  const { text } = data;
  const t = text.debrief;
  const has = (i: Instrument) => log.carried.includes(i);
  const groups: LogGroup[] = [];
  const add = (instrument: Instrument, own: string[], summary: string | null = null) => {
    const heading = instrumentName(instrument, data);
    const names = earnedWith(instrument, data.milestones.milestones, earned).map((m) => m.name);
    groups.push({
      instrument,
      heading,
      lines: own.map((l) => withoutPrefix(l, heading)),
      summary,
      earned: names.length > 0 ? fill(t.logEarned, { names: names.join(t.logEarnedJoin) }) : null,
    });
  };
  if (has('neutron')) {
    add('neutron', [log.hydrogenPeak === null ? t.logHydrogenNone : fill(t.logHydrogen, { percent: Math.round(log.hydrogenPeak * 100) })]);
  }
  if (has('xray')) {
    const own = log.rocks.length === 0 ? [t.logNoRocks] : log.rocks.map((r) => {
      const rock = text.rocks[r.rock];
      return fill(t.logRock, { rock: rock?.name ?? r.rock, elements: rock?.elements ?? '' });
    });
    const tally = rockTypeTally(log.rocks, data.tuning.instruments.xray);
    const collection = data.milestones.milestones.some((m) => m.trigger.type === 'reading' && m.trigger.rocks);
    add('xray', own, collection && tally.count > 0 && tally.total > 0 ? fill(t.logRockTypes, tally) : null);
  }
  if (has('seismometer')) {
    add('seismometer', [!log.stationPlaced ? t.logStationNone : log.quake === 'clean' ? t.logQuakeClean : log.quake === 'noisy' ? t.logQuakeNoisy : log.quake === 'missed' ? t.logQuakeMissed : t.logQuakeNone]);
  }
  if (has('reflector')) add('reflector', [log.reflectorPlaced ? t.logReflector : t.logReflectorNone]);
  // Mars (step 4a): the weather mast, the radar, the laser and the organics spectrometer, in their own words.
  const it = text.instrumentText;
  if (has('weather') && it.weather?.log && it.weather.logNone) {
    const seconds = Math.round(log.weatherSeconds ?? 0);
    const line = seconds > 0 ? fill(it.weather.log, { seconds }) : it.weather.logNone;
    add('weather', [log.stormForecastByMast && it.weather.logStorm ? `${line} ${it.weather.logStorm}` : line]);
  }
  if (has('radar') && it.radar?.log && it.radar.logNone) {
    const names = (log.radarLayers ?? []).map((k) => it.radar.layers?.[k] ?? k);
    const longest = log.radarLongestM ?? null;
    add('radar', [longest === null ? it.radar.logNone : fill(it.radar.log, { meters: Math.round(longest), layers: names.join(text.ticket.and) || '—' })]);
  }
  if (has('laser') && it.laser?.logNone) {
    const own = (log.laser ?? []).map((r) => {
      if (r.target === 'cliff') return it.laser.resultCliff ?? '';
      const rock = r.rock ? text.rocks[r.rock] : undefined;
      return fill(it.laser.result ?? t.logRock, { rock: rock?.name ?? r.rock ?? '', elements: rock?.elements ?? '' });
    }).filter(Boolean);
    add('laser', own.length ? own : [it.laser.logNone]);
  }
  if (has('organics') && it.organics?.log && it.organics.logNone) {
    const count = log.organics ?? 0;
    add('organics', [count > 0 ? fill(it.organics.log, { count }) : it.organics.logNone]);
  }
  return groups;
}
