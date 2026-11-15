// Screen flow: title → design → ticket → landing → mission → debrief,
// then restart round (back to design, snapshot restored) or "Mars: coming soon".
import type { Build, GameData } from '../rules/types';
import {
  buyRover, finishMission, newCampaign, restartRound, startRound,
  type CampaignState, type RoundOutcome,
} from '../rules/campaign';
import type { MissionResult } from '../rules/payout';
import { quoteBuild } from '../rules/quote';
import { clearCampaign, loadCampaign, saveCampaign } from '../save/campaignSave';

export type ScreenId = 'title' | 'design' | 'ticket' | 'landing' | 'mission' | 'debrief' | 'marsSoon';

/** A screen renders into root and may return a cleanup function. */
export type Screen = (game: Game, root: HTMLElement) => void | (() => void);

export class Game {
  campaign: CampaignState | null;
  build: Build;
  outcome: RoundOutcome | null = null;
  lastResult: MissionResult | null = null;
  private current: ScreenId = 'title';
  private cleanup: (() => void) | null = null;

  constructor(
    readonly data: GameData,
    private readonly root: HTMLElement,
    private readonly screens: Record<ScreenId, Screen>,
  ) {
    this.campaign = loadCampaign();
    this.build = this.campaign?.lastBuild ?? data.parts.defaultBuild;
  }

  get screen(): ScreenId {
    return this.current;
  }

  go(screen: ScreenId): void {
    this.cleanup?.();
    this.cleanup = null;
    this.current = screen;
    this.root.replaceChildren();
    this.root.dataset.screen = screen;
    this.cleanup = this.screens[screen](this, this.root) ?? null;
  }

  private setCampaign(state: CampaignState): CampaignState {
    this.campaign = state;
    saveCampaign(state);
    return state;
  }

  /** The campaign, which every screen after the title can rely on. */
  get state(): CampaignState {
    if (!this.campaign) throw new Error('no campaign');
    return this.campaign;
  }

  newCampaign(): void {
    clearCampaign();
    this.setCampaign(startRound(newCampaign(this.data.tuning)));
    this.build = this.data.parts.defaultBuild;
    this.outcome = null;
    this.go('design');
  }

  continueCampaign(): void {
    if (this.state.completed.includes('moon')) return this.go('marsSoon');
    // Any round in progress is rolled back to its snapshot, as on a restart.
    this.setCampaign(startRound(restartRound(this.state)));
    this.go('design');
  }

  buyTicket(): void {
    const quote = quoteBuild(this.build, this.data, this.state.balance);
    if (!quote.canLaunch || !quote.canAfford) return;
    this.setCampaign(buyRover(this.state, this.build, quote.totalCost));
    this.go('landing');
  }

  endMission(result: MissionResult): void {
    this.lastResult = result;
    this.outcome = finishMission(this.state, result, this.data);
    this.setCampaign(this.outcome.state);
    this.go('debrief');
  }

  restartRound(): void {
    this.setCampaign(startRound(restartRound(this.state)));
    this.outcome = null;
    this.go('design');
  }
}
