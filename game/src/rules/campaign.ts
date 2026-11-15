import type { Build, CampaignStep, GameData, HistoryKey, MissionId, Tuning } from './types';
import { missionPayout, type MissionResult, type Payout } from './payout';

/** What a restart restores: balance, RP, and records, as they were at the start of the round. */
export interface CampaignSnapshot {
  balance: number;
  rp: number;
  records: string[];
}

export interface CampaignState {
  mission: CampaignStep; // the mission this round is for ('complete': the campaign is over)
  balance: number;
  rp: number;
  records: string[]; // record milestone ids, earned once per campaign
  completed: CampaignStep[];
  snapshot: CampaignSnapshot | null; // taken at the start of the current round
  lastBuild: Build | null; // convenience: the design screen starts from the last build
  /** One entry per passed mission, for the campaign summary at the end. Optional: older saves have none. */
  log?: MissionLogEntry[];
}

/** How a passed mission went, kept for the campaign summary. */
export interface MissionLogEntry {
  mission: MissionId;
  outcome: HistoryKey; // 'survived', or how the rover was lost
  secondsLasted: number;
  money: number; // net change to the balance
  rp: number;
  milestones: number; // milestones reached (records already held included)
}

/** Campaign order. 'complete' is the end marker after the last mission (the campaign is over). */
export const MISSION_ORDER: readonly CampaignStep[] = ['moon', 'mars', 'titan', 'complete'];

export function isCampaignStep(v: unknown): v is CampaignStep {
  return typeof v === 'string' && (MISSION_ORDER as string[]).includes(v);
}

export function nextMission(mission: CampaignStep): CampaignStep | null {
  return MISSION_ORDER[MISSION_ORDER.indexOf(mission) + 1] ?? null;
}

/** A step that can be played ('complete' is the end marker). */
export function isPlayable(step: CampaignStep): step is MissionId {
  return step !== 'complete';
}

/**
 * Saves from before the campaign advanced on its own kept mission 'moon' after the Moon was completed:
 * move such a campaign on to the first mission it has not completed, with a fresh round snapshot.
 * Saves from before Titan was playable ended at the old 'titan' end marker: that is now the Titan round
 * (the Titan design screen); a playable round without a snapshot gets one.
 */
export function normalizeCampaign(state: CampaignState): CampaignState {
  let mission = state.mission;
  for (let next = nextMission(mission); state.completed.includes(mission) && next; next = nextMission(mission)) mission = next;
  if (mission !== state.mission || (isPlayable(mission) && !state.snapshot)) return startRound({ ...state, mission });
  return state;
}

export function newCampaign(tuning: Tuning): CampaignState {
  return {
    mission: 'moon',
    balance: tuning.budget.startingBudget,
    rp: 0,
    records: [],
    completed: [],
    snapshot: null,
    lastBuild: null,
    log: [],
  };
}

/** A player below the mission's minimum budget cannot start it. */
export function canStartMission(state: CampaignState, tuning: Tuning): boolean {
  return state.balance >= tuning.budget.minimumBudget[state.mission];
}

/** Start a round: take the restart snapshot. */
export function startRound(state: CampaignState): CampaignState {
  return { ...state, snapshot: { balance: state.balance, rp: state.rp, records: [...state.records] } };
}

/** Restart the round: restore balance, RP, and records from the snapshot. */
export function restartRound(state: CampaignState): CampaignState {
  if (!state.snapshot) return state;
  const { balance, rp, records } = state.snapshot;
  return { ...state, balance, rp, records: [...records] };
}

/** Pay for the parts and the launch ticket. Throws if the player cannot afford it. */
export function buyRover(state: CampaignState, build: Build, totalCost: number): CampaignState {
  if (totalCost > state.balance) throw new Error('cannot afford this rover');
  return { ...state, balance: state.balance - totalCost, lastBuild: build };
}

export interface RoundOutcome {
  state: CampaignState;
  payout: Payout;
  /** The balance is below the next mission's minimum: the player must restart the round. */
  failed: boolean;
}

/**
 * Apply a mission result. The balance carries over even if negative. A passed round completes the
 * mission and moves the campaign to the next one, with that round's restart snapshot taken here.
 */
export function finishMission(state: CampaignState, result: MissionResult, data: GameData): RoundOutcome {
  const payout = missionPayout(result, data.milestones.milestones, data.tuning, state.records);
  const balance = state.balance + payout.money;
  const next = nextMission(state.mission);
  const failed = next !== null && balance < data.tuning.budget.minimumBudget[next];
  const newState: CampaignState = {
    ...state,
    balance,
    rp: state.rp + payout.rp,
    records: [...state.records, ...payout.newRecords],
    completed: failed ? state.completed : [...state.completed, state.mission],
  };
  if (failed) return { state: newState, payout, failed };
  const entry: MissionLogEntry = {
    mission: state.mission as MissionId,
    outcome: result.survived ? 'survived' : result.detail === 'rollover' ? 'rollover' : (result.cause ?? 'energy'),
    secondsLasted: result.secondsLasted,
    money: payout.money,
    rp: payout.rp,
    milestones: result.earned.length,
  };
  newState.log = [...(state.log ?? []).filter((e) => e.mission !== entry.mission), entry];
  if (next === null) return { state: newState, payout, failed };
  return { state: startRound({ ...newState, mission: next }), payout, failed };
}
