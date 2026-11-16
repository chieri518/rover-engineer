import type { Build, CampaignStep, GameData, HistoryKey, MissionId, Tuning } from './types';
import { missionPayout, type MissionResult, type Payout } from './payout';
import { addToNotebook, metIds } from './relationships';
import { buildRoundStats, type RoundStats } from './roundStats';

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
  /**
   * The engineering notebook: relationship ids discovered, in the order discovered. Not part of the
   * snapshot, so a restart keeps it: what a failed run taught carries over (game-design.md, section 3).
   */
  notebook: string[];
  /**
   * Round stats for the campaign dashboard: one per mission, the latest round played (a retry replaces
   * it). Optional: older saves have none, and the dashboard then shows those missions as not recorded.
   */
  stats?: RoundStats[];
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
    notebook: [],
  };
}

/** A player below the mission's minimum budget cannot start it. */
export function canStartMission(state: CampaignState, tuning: Tuning): boolean {
  return isPlayable(state.mission) && state.balance >= tuning.budget.minimumBudget[state.mission];
}

/**
 * Whether a round passes. Moon and Mars: the balance meets the next mission's minimum budget. The last
 * mission (Titan) passes on survival: the rover still running at the end of the mission (asleep counts);
 * the balance does not decide it.
 */
export function roundPasses(mission: MissionId, survived: boolean, balance: number, tuning: Tuning): boolean {
  const next = nextMission(mission);
  if (next === null || !isPlayable(next)) return survived;
  return balance >= tuning.budget.minimumBudget[next];
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
  /** The round did not pass (Moon, Mars: below the next mission's minimum; Titan: the rover was lost): restart it, or on Titan end the campaign. */
  failed: boolean;
}

/**
 * Apply a mission result. The balance carries over even if negative; the relationships met enter the
 * notebook. A passed round completes the mission and moves the campaign to the next one, with that
 * round's restart snapshot taken here. With the result's measure, the round's stats are recorded,
 * passed or not (they replace that mission's earlier stats).
 */
export function finishMission(state: CampaignState, result: MissionResult, data: GameData): RoundOutcome {
  const payout = missionPayout(result, data.milestones.milestones, data.tuning, state.records);
  const balance = state.balance + payout.money;
  const next = nextMission(state.mission);
  const mission = state.mission as MissionId;
  const failed = !roundPasses(mission, result.survived, balance, data.tuning);
  const stats = result.measure
    ? [...(state.stats ?? []).filter((r) => r.mission !== mission),
      buildRoundStats({ mission, passed: !failed, result, payout, measure: result.measure, build: state.lastBuild, balanceAfter: balance, data })]
    : state.stats;
  const newState: CampaignState = {
    ...state,
    balance,
    rp: state.rp + payout.rp,
    records: [...state.records, ...payout.newRecords],
    completed: failed ? state.completed : [...state.completed, state.mission],
    notebook: addToNotebook(state.notebook, metIds(result.relationships ?? [])),
    ...(stats ? { stats } : {}),
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

/**
 * End the campaign after a failed last round (Titan lost): the round's result stands (balance, RP,
 * records and stats as the round left them), the mission is not completed, and the campaign moves to
 * the end marker. Only the last mission can end the campaign this way.
 */
export function endCampaign(state: CampaignState): CampaignState {
  if (!isPlayable(state.mission)) return state;
  const next = nextMission(state.mission);
  if (next === null || isPlayable(next)) return state;
  return { ...state, mission: next, snapshot: null };
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
