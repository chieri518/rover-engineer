import type { DeathCause, Milestone, Tuning } from './types';
import type { RelationshipEvent } from './relationships';
import type { RoundMeasure } from './roundStats';

export interface EarnedMilestone {
  id: string;
  stages?: number; // for staged milestones (Odometer): how many thresholds were reached. Default 1.
}

export interface MissionResult {
  survived: boolean;
  cause?: DeathCause; // set when survived is false
  detail?: 'rollover'; // destroyed by rolling over rather than by the damage meter
  secondsLasted: number;
  earned: EarnedMilestone[];
  relationships?: RelationshipEvent[]; // relationships met, once each, in the order met; missing: none
  measure?: RoundMeasure; // what the mission measured, for the round stats; missing: no stats recorded
  groundDown?: boolean; // the X-ray's readings were ground down by a fitted robotic arm (MissionSetup.groundDown); missing: no
}

export interface PaidMilestone {
  milestone: Milestone;
  stages: number;
  money: number;
  rp: number;
  factor?: number; // the reward was multiplied by this (ground-down X-ray readings); missing: 1
}

/** One stage's reward of a milestone, and the factor applied to it (1, or the arm's groundDownFactor). */
export interface MilestoneReward {
  money: number;
  rp: number;
  factor: number;
}

/** True for a milestone an X-ray reading earns (its trigger is an X-ray `reading`: Rock collection, Rare rock). */
export function isXrayReading(m: Milestone): boolean {
  return m.trigger.type === 'reading' && m.trigger.instrument === 'xray';
}

/**
 * One stage's reward: the milestone's money and RP, times tuning.instruments.arm.groundDownFactor (rounded)
 * for an X-ray reading milestone when the X-ray's readings were ground down by a fitted arm (game-design.md,
 * The X-ray spectrometer and the robotic arm). Everything else pays as listed.
 */
export function milestoneReward(m: Milestone, groundDown: boolean, tuning: Tuning): MilestoneReward {
  const f = tuning.instruments.arm?.groundDownFactor;
  const factor = groundDown && f !== undefined && isXrayReading(m) ? f : 1;
  return factor === 1 ? { money: m.money, rp: m.rp, factor } : { money: Math.round(m.money * factor), rp: Math.round(m.rp * factor), factor };
}

export interface Payout {
  survivalPayout: number;
  milestones: PaidMilestone[];
  milestoneMoney: number;
  milestoneRp: number;
  penalty: number;
  money: number; // net change to the balance
  rp: number;
  newRecords: string[];
}

/**
 * How many stages a milestone has: one per Odometer (or Night drive) distance, one per sample site or
 * surveyed zone instance (sites), one per rock-type count (a reading's rocks), otherwise 1.
 */
export function milestoneStages(m: Milestone): number {
  const tr = m.trigger;
  if (tr.type === 'distance' || tr.type === 'night-distance') return tr.meters.length;
  if (tr.type === 'drill' || tr.type === 'transect') return tr.sites ?? 1;
  if (tr.type === 'reading') return tr.rocks?.length ?? tr.sites ?? 1;
  return 1;
}

/**
 * Death penalty: a base amount by cause (energy < stuck < froze < destroyed), shrinking linearly
 * with how long the rover lasted, down to penaltyMinFraction of the base at the full mission length.
 */
export function deathPenalty(cause: DeathCause, secondsLasted: number, tuning: Tuning): number {
  const base = tuning.payout.deathPenalty[cause];
  const lasted = Math.min(Math.max(secondsLasted / tuning.mission.lengthSeconds, 0), 1);
  const factor = 1 - (1 - tuning.payout.penaltyMinFraction) * lasted;
  return Math.round(base * factor);
}

/** A milestone earned this mission, as the payout counts it; a record already held is listed but pays nothing. */
export interface EarnedLine extends PaidMilestone {
  stagesTotal: number; // milestoneStages: how many stages it has (1 for most)
  recordHeld: boolean; // a record already earned this campaign: money and RP are 0
}

/**
 * The milestones earned, one line each in the order given (repeats dropped), with what each pays: its
 * reward times the stages reached (clamped to its stages; none reached: left out), ground-down X-ray
 * readings raised (milestoneReward), records already earned this campaign at 0. The HUD's milestone
 * list during the mission and the debrief's payout (missionPayout) both read it.
 */
export function earnedLines(
  earned: readonly EarnedMilestone[],
  catalog: readonly Milestone[],
  tuning: Tuning,
  recordsEarned: readonly string[],
  groundDown: boolean,
): EarnedLine[] {
  const lines: EarnedLine[] = [];
  const seen = new Set<string>();
  for (const e of earned) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const milestone = catalog.find((m) => m.id === e.id);
    if (!milestone) throw new Error(`unknown milestone ${e.id}`);
    const stagesTotal = milestoneStages(milestone);
    const stages = Math.min(Math.max(e.stages ?? 1, 0), stagesTotal);
    if (stages === 0) continue;
    const recordHeld = milestone.record === true && recordsEarned.includes(milestone.id);
    const reward = milestoneReward(milestone, groundDown, tuning);
    lines.push({
      milestone,
      stages,
      stagesTotal,
      recordHeld,
      money: recordHeld ? 0 : reward.money * stages,
      rp: recordHeld ? 0 : reward.rp * stages,
      ...(reward.factor !== 1 && !recordHeld ? { factor: reward.factor } : {}),
    });
  }
  return lines;
}

/**
 * Money = survival payout (if survived) + milestone money − death penalty (if died).
 * RP = milestone RP. Records already earned this campaign pay nothing. Ground-down X-ray readings raise
 * their milestones' rewards (milestoneReward).
 */
export function missionPayout(
  result: MissionResult,
  catalog: Milestone[],
  tuning: Tuning,
  recordsEarned: readonly string[],
): Payout {
  const paid: PaidMilestone[] = earnedLines(result.earned, catalog, tuning, recordsEarned, result.groundDown === true)
    .filter((l) => !l.recordHeld)
    .map(({ recordHeld: _held, stagesTotal: _total, ...p }) => p);
  const newRecords = paid.filter((p) => p.milestone.record).map((p) => p.milestone.id);
  const milestoneMoney = paid.reduce((s, p) => s + p.money, 0);
  const milestoneRp = paid.reduce((s, p) => s + p.rp, 0);
  const survivalPayout = result.survived ? tuning.payout.survivalPayout : 0;
  let penalty = 0;
  if (!result.survived) {
    if (!result.cause) throw new Error('a mission that did not survive needs a cause of death');
    penalty = deathPenalty(result.cause, result.secondsLasted, tuning);
  }
  return {
    survivalPayout,
    milestones: paid,
    milestoneMoney,
    milestoneRp,
    penalty,
    money: survivalPayout + milestoneMoney - penalty,
    rp: milestoneRp,
    newRecords,
  };
}
