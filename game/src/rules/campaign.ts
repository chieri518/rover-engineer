import type { Build, GameData, MissionId, Tuning } from './types';
import { missionPayout, type MissionResult, type Payout } from './payout';
import { addToNotebook, metIds } from './relationships';

/** What a restart restores: balance, RP, and records, as they were at the start of the round. */
export interface CampaignSnapshot {
  balance: number;
  rp: number;
  records: string[];
}

export interface CampaignState {
  mission: MissionId; // the mission this round is for
  balance: number;
  rp: number;
  records: string[]; // record milestone ids, earned once per campaign
  completed: MissionId[];
  snapshot: CampaignSnapshot | null; // taken at the start of the current round
  lastBuild: Build | null; // convenience: the design screen starts from the last build
  /**
   * The engineering notebook: relationship ids discovered, in the order discovered. Not part of the
   * snapshot, so a restart keeps it: what a failed run taught carries over (game-design.md, section 3).
   */
  notebook: string[];
}

/** Mission order. Mars is not playable yet; it is used only for its minimum budget. */
const MISSION_ORDER: MissionId[] = ['moon', 'mars'];

export function nextMission(mission: MissionId): MissionId | null {
  return MISSION_ORDER[MISSION_ORDER.indexOf(mission) + 1] ?? null;
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
    notebook: [],
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

/** Restart the round: restore balance, RP, and records from the snapshot. The notebook is kept. */
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

/** Apply a mission result. The balance carries over even if negative; the relationships met enter the notebook. */
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
    notebook: addToNotebook(state.notebook, metIds(result.relationships ?? [])),
  };
  return { state: newState, payout, failed };
}

/**
 * A relationship met for the first time: merge it into the campaign's notebook (a lesson is saved when
 * learned, not only at mission end). Only the notebook changes; balance, RP, records and the snapshot
 * are untouched. Returns the same state when nothing is new.
 */
export function recordLessons(state: CampaignState, ids: readonly string[]): CampaignState {
  const notebook = addToNotebook(state.notebook, ids);
  return notebook.length === state.notebook.length ? state : { ...state, notebook };
}
