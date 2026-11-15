// Screen flow: title → design → ticket → landing → mission → debrief,
// then restart round (back to design, snapshot restored) or "Mars: coming soon".
import type { DraftBuild, GameData } from '../rules/types';
import {
  buyRover, finishMission, newCampaign, restartRound, startRound,
  type CampaignState, type RoundOutcome,
} from '../rules/campaign';
import type { MissionResult } from '../rules/payout';
import type { InstrumentLog } from '../rules/instruments';
import { quoteBuild } from '../rules/quote';
import { isCompleteBuild } from '../rules/rover';
import { upgradeSavedBuild } from '../rules/payload';
import { clearCampaign, loadCampaign, saveCampaign } from '../save/campaignSave';
import { loadSettings, saveSettings, type Settings } from '../save/settings';
import { loadTutorialSeen, saveTutorialSeen, type TutorialId, type TutorialSeen } from '../save/tutorialSeen';

/** A photograph taken during the mission, kept in memory for the debrief album. */
export interface AlbumPhoto {
  src: string; // JPEG data URL
  caption: string;
}

export type ScreenId = 'title' | 'settings' | 'credits' | 'design' | 'ticket' | 'landing' | 'mission' | 'debrief' | 'marsSoon';

/** A screen renders into root and may return a cleanup function. */
export type Screen = (game: Game, root: HTMLElement) => void | (() => void);

export class Game {
  campaign: CampaignState | null;
  /** The rover on the design screen. A new campaign starts with every slot empty; a restart keeps the last design. */
  build: DraftBuild;
  outcome: RoundOutcome | null = null;
  lastResult: MissionResult | null = null;
  /** Photographs from the last mission (not saved: data URLs are too large for localStorage). */
  album: AlbumPhoto[] = [];
  /** What the instruments recorded in the last mission, for the debrief (not saved). */
  instrumentLog: InstrumentLog | null = null;
  settings: Settings = loadSettings();
  /** Tutorials already seen; each opens by itself only the first time its screen is reached. */
  tutorialSeen: TutorialSeen = loadTutorialSeen();
  private current: ScreenId = 'title';
  private cleanup: (() => void) | null = null;

  constructor(
    readonly data: GameData,
    private readonly root: HTMLElement,
    private readonly screens: Record<ScreenId, Screen>,
  ) {
    this.campaign = loadCampaign();
    this.build = upgradeSavedBuild(this.campaign?.lastBuild, data.parts); // drops part ids the catalog no longer has; old saves move their instrument into the bay
  }

  get screen(): ScreenId {
    return this.current;
  }

  go(screen: ScreenId): void {
    this.cleanup?.();
    this.cleanup = null;
    this.current = screen;
    this.root.replaceChildren();
    window.scrollTo?.(0, 0); // each screen starts at the top (the credits page is long)
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
    this.build = {};
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
    const build = this.build;
    if (!isCompleteBuild(build, this.data.parts)) return;
    const quote = quoteBuild(build, this.data, this.state.balance);
    if (!quote.canLaunch || !quote.canAfford) return;
    this.setCampaign(buyRover(this.state, build, quote.totalCost));
    this.go('landing');
  }

  setSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
  }

  markTutorialSeen(id: TutorialId): void {
    this.tutorialSeen = { ...this.tutorialSeen, [id]: true };
    saveTutorialSeen(this.tutorialSeen);
  }

  endMission(result: MissionResult, album: AlbumPhoto[] = [], instrumentLog: InstrumentLog | null = null): void {
    this.lastResult = result;
    this.album = album;
    this.instrumentLog = instrumentLog;
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
