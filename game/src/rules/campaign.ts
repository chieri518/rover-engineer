import type { Build, CampaignStep, GameData, MissionId, Tuning } from './types';
import { missionPayout, type MissionResult, type Payout } from './payout';

/** What a restart restores: balance, RP, and records, as they were at the start of the round. */
export interface CampaignSnapshot {
  balance: number;
  rp: number;
  records: string[];
}

export interface CampaignState {
  mission: CampaignStep; // the mission this round is for ('titan': the campaign is over, "Titan: coming soon")
  balance: number;
  rp: number;
  records: string[]; // record milestone ids, earned once per campaign
  completed: CampaignStep[];
  snapshot: CampaignSnapshot | null; // taken at the start of the current round
  lastBuild: Build | null; // convenience: the design screen starts from the last build
}

/** Campaign order. Titan is the end marker: it is not playable yet ("Titan: coming soon"). */
const MISSION_ORDER: CampaignStep[] = ['moon', 'mars', 'titan'];

export function nextMission(mission: CampaignStep): CampaignStep | null {
  return MISSION_ORDER[MISSION_ORDER.indexOf(mission) + 1] ?? null;
}

/** A step that can be played (titan is the end marker). */
export function isPlayable(step: CampaignStep): step is MissionId {
  return step !== 'titan';
}

/**
 * Saves from before the campaign advanced on its own kept mission 'moon' after the Moon was completed:
 * move such a campaign on to the first mission it has not completed, with a fresh round snapshot.
 */
export function normalizeCampaign(state: CampaignState): CampaignState {
  let mission = state.mission;
  for (let next = nextMission(mission); state.completed.includes(mission) && next; next = nextMission(mission)) mission = next;
  return mission === state.mission ? state : startRound({ ...state, mission });
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
  if (failed || next === null) return { state: newState, payout, failed };
  return { state: startRound({ ...newState, mission: next }), payout, failed };
}
