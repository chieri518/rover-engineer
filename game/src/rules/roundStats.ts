// Round stats: what each mission round measured, kept in the campaign save for the campaign dashboard
// (game-design.md, "Titan goal and the campaign dashboard"). The mission screen steps a MissionTally
// next to the mission state (lowest battery, peak cold, energy used, how each night was spent) without
// changing play; finishMission turns the tally into a RoundStats record. Pure: no rendering, no physics.
import type { Build, BusSlot, GameData, HistoryKey, MilestoneCategory, MissionId } from './types';
import type { MissionState } from './mission';
import type { MissionResult, Payout } from './payout';
import { quoteBuild } from './quote';

/** How a night was spent: mostly asleep, mostly awake with the lights on, or mostly awake in the dark (no lights). */
export type NightSpent = 'asleep' | 'lights' | 'dark';

/** The day-and-night conditions after a step (Mars and Titan; null on the Moon). */
export interface DayNow {
  night: boolean;
  lightsOn: boolean;
}

/** Stepped by the mission screen next to the mission state. */
export interface MissionTally {
  lowestEnergy: number;
  peakFreeze: number;
  energyUsed: number; // the battery's total discharge: every drop in charge added up (net of solar income in that step)
  samples: number; // drill uses finished
  nights: NightSpent[]; // nights the rover lived through to dawn, in order
  night: { asleep: number; lights: number; dark: number } | null; // seconds of the night in progress
}

export function startTally(state: MissionState): MissionTally {
  return { lowestEnergy: state.energy, peakFreeze: state.freeze, energyUsed: 0, samples: 0, nights: [], night: null };
}

function nightSpent(n: { asleep: number; lights: number; dark: number }): NightSpent {
  if (n.asleep >= n.lights && n.asleep >= n.dark) return 'asleep';
  return n.lights >= n.dark ? 'lights' : 'dark';
}

/**
 * One mission step: prev and next are the mission state before and after stepMission, day the
 * conditions after it (null on the Moon), drilled true when a drill use finished this step.
 */
export function stepTally(tally: MissionTally, prev: MissionState, next: MissionState, day: DayNow | null, drilled = false): MissionTally {
  const dt = Math.max(0, next.seconds - prev.seconds);
  const out: MissionTally = {
    ...tally,
    lowestEnergy: Math.min(tally.lowestEnergy, next.energy),
    peakFreeze: Math.max(tally.peakFreeze, next.freeze),
    energyUsed: tally.energyUsed + Math.max(0, prev.energy - next.energy),
    samples: tally.samples + (drilled ? 1 : 0),
  };
  if (day?.night) {
    const n = out.night ?? { asleep: 0, lights: 0, dark: 0 };
    const key = next.poweredDown ? 'asleep' : day.lightsOn ? 'lights' : 'dark';
    out.night = { ...n, [key]: n[key] + dt };
  } else if (out.night) {
    // Dawn: the night is over and the rover lived through it.
    if (!next.end || next.end.survived) out.nights = [...out.nights, nightSpent(out.night)];
    out.night = null;
  }
  return out;
}

/** What the mission screen hands finishMission with the result. */
export interface RoundMeasure {
  distanceM: number;
  batteryCapacity: number;
  energyUsed: number;
  lowestEnergy: number;
  peakFreeze: number;
  samples: number;
  photos: number;
  nights: NightSpent[] | null; // null on the Moon (no nights)
}

/** The measure at mission end. A night still in progress when the rover survives to the end counts as lived through. */
export function tallyMeasure(tally: MissionTally, state: MissionState, batteryCapacity: number, photos: number, hasNights: boolean): RoundMeasure {
  const nights = tally.night && state.end?.survived ? [...tally.nights, nightSpent(tally.night)] : tally.nights;
  return {
    distanceM: state.distanceM,
    batteryCapacity,
    energyUsed: tally.energyUsed,
    lowestEnergy: tally.lowestEnergy,
    peakFreeze: tally.peakFreeze,
    samples: tally.samples,
    photos,
    nights: hasNights ? nights : null,
  };
}

export interface CategoryCount {
  category: MilestoneCategory;
  earned: number;
  available: number;
}

/** One finished round, as the campaign dashboard shows it. */
export interface RoundStats {
  mission: MissionId;
  passed: boolean; // the round passed (Moon, Mars: the pass mark; Titan: the rover still running at the end)
  outcome: HistoryKey; // 'survived', or how the rover was lost ('rollover' for a roll over)
  secondsLasted: number; // mission time when it ended
  missionSeconds: number; // the mission length
  distanceM: number;
  milestones: CategoryCount[]; // by category, in the order capability, scientific, record, picture
  moneyEarned: number; // survival payout + milestone money
  penalty: number; // death penalty
  net: number; // net change to the balance from the mission (moneyEarned - penalty)
  spentRover: number; // parts
  spentTicket: number; // launch ticket
  balanceAfter: number; // the balance after the round
  rp: number;
  batteryCapacity: number;
  energyUsed: number;
  lowestBattery: number; // share of the battery, 0..1
  peakCold: number; // highest cold reading, share of the freeze maximum, 0..1
  samples: number; // samples drilled
  photos: number; // photos taken
  build: { parts: string[]; payload: string[] }; // bus part ids in slot order, payload part ids in bay order
  nights: { survived: number; asleep: number; lights: number; dark: number } | null; // Mars and Titan
}

const BUS_ORDER: readonly BusSlot[] = ['chassis', 'wheels', 'power', 'battery', 'lights', 'heater'];

export const CATEGORY_ORDER: readonly MilestoneCategory[] = ['capability', 'scientific', 'record', 'picture'];

export interface RoundStatsInput {
  mission: MissionId;
  passed: boolean;
  result: MissionResult;
  payout: Payout;
  measure: RoundMeasure;
  build: Build | null; // the rover flown (campaign lastBuild)
  balanceAfter: number;
  data: GameData; // the mission's world data
}

const share = (v: number, max: number) => (max > 0 ? Math.min(1, Math.max(0, v / max)) : 0);

export function buildRoundStats(i: RoundStatsInput): RoundStats {
  const { result, payout, measure, data } = i;
  const catalog = data.milestones.milestones;
  const earnedIds = new Set(result.earned.filter((e) => (e.stages ?? 1) > 0).map((e) => e.id));
  const milestones = CATEGORY_ORDER.map((category) => {
    const inCategory = catalog.filter((m) => m.category === category);
    return { category, earned: inCategory.filter((m) => earnedIds.has(m.id)).length, available: inCategory.length };
  }).filter((c) => c.available > 0);
  const quote = i.build ? quoteBuild(i.build, data, 0) : null;
  const parts = i.build ? BUS_ORDER.map((slot) => i.build![slot]).filter((id): id is string => typeof id === 'string' && id !== '') : [];
  const nights = measure.nights && {
    survived: measure.nights.length,
    asleep: measure.nights.filter((n) => n === 'asleep').length,
    lights: measure.nights.filter((n) => n === 'lights').length,
    dark: measure.nights.filter((n) => n === 'dark').length,
  };
  return {
    mission: i.mission,
    passed: i.passed,
    outcome: result.survived ? 'survived' : result.detail === 'rollover' ? 'rollover' : (result.cause ?? 'energy'),
    secondsLasted: result.secondsLasted,
    missionSeconds: data.tuning.mission.lengthSeconds,
    distanceM: measure.distanceM,
    milestones,
    moneyEarned: payout.survivalPayout + payout.milestoneMoney,
    penalty: payout.penalty,
    net: payout.money,
    spentRover: quote ? quote.cost : 0,
    spentTicket: quote ? quote.ticketPrice : 0,
    balanceAfter: i.balanceAfter,
    rp: payout.rp,
    batteryCapacity: measure.batteryCapacity,
    energyUsed: measure.energyUsed,
    lowestBattery: share(measure.lowestEnergy, measure.batteryCapacity),
    peakCold: share(measure.peakFreeze, data.tuning.cold.freezeMax),
    samples: measure.samples,
    photos: measure.photos,
    build: { parts, payload: [...(i.build?.payload ?? [])] },
    nights,
  };
}

/** A saved stats entry that has the fields the dashboard reads (older or damaged entries are dropped). */
export function isRoundStats(v: unknown): v is RoundStats {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.mission === 'string' && typeof r.passed === 'boolean' && typeof r.outcome === 'string' &&
    typeof r.secondsLasted === 'number' && typeof r.distanceM === 'number' && Array.isArray(r.milestones) &&
    typeof r.balanceAfter === 'number' && typeof r.build === 'object' && r.build !== null
  );
}
