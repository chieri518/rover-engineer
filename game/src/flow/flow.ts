// Screen flow: title → design → ticket → landing → mission → debrief, then restart the round (back to
// design, snapshot restored) or continue to the next world's design screen (Moon → Mars), and after the
// last world the "coming soon" screen (comingSoon: "Titan: coming soon", with the campaign summary).
import type { DraftBuild, GameData, MissionId } from '../rules/types';
import {
  buyRover, finishMission, isPlayable, newCampaign, normalizeCampaign, restartRound, startRound,
  type CampaignState, type RoundOutcome,
} from '../rules/campaign';
import { worldOfStep, type WorldId } from '../worlds';
import type { MissionResult } from '../rules/payout';
import { quoteBuild } from '../rules/quote';
import { isCompleteBuild } from '../rules/rover';
import { clearCampaign, loadCampaign, saveCampaign } from '../save/campaignSave';
import { loadSettings, saveSettings, type Settings } from '../save/settings';
import { loadTutorialSeen, saveTutorialSeen, type TutorialId, type TutorialSeen, type TutorialSeenByWorld } from '../save/tutorialSeen';

/** A photograph taken during the mission, kept in memory for the debrief album. */
export interface AlbumPhoto {
  src: string; // JPEG data URL
  caption: string;
}

export type ScreenId = 'title' | 'settings' | 'credits' | 'design' | 'ticket' | 'landing' | 'mission' | 'debrief' | 'comingSoon';

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
  settings: Settings = loadSettings();
  /** Tutorials already seen, per world; each opens by itself only the first time its screen is reached. */
  private seenByWorld: TutorialSeenByWorld = loadTutorialSeen();
  /**
   * The world whose data the screens show: the campaign's mission, except that the debrief keeps the
   * world just played until the player continues (finishMission has already moved the campaign on).
   */
  world: WorldId;
  private current: ScreenId = 'title';
  private cleanup: (() => void) | null = null;
  /** false for a debug start (?world=mars): the throwaway campaign does not overwrite the save. */
  private persist = true;

  constructor(
    private readonly dataFor: (world: WorldId) => GameData,
    private readonly root: HTMLElement,
    private readonly screens: Record<ScreenId, Screen>,
  ) {
    const saved = loadCampaign();
    this.campaign = saved && normalizeCampaign(saved);
    this.build = this.campaign?.lastBuild ?? {};
    this.world = this.campaign ? worldOfStep(this.campaign.mission) : 'moon';
  }

  /** The current world's game data (shared data with the world's overlay). */
  get data(): GameData {
    return this.dataFor(this.world);
  }

  /** Any world's game data (the credits and the campaign summary list every world). */
  dataOf(world: WorldId): GameData {
    return this.dataFor(world);
  }

  /** The current world's tutorials already seen (Mars has its own design and drive tutorials). */
  get tutorialSeen(): TutorialSeen {
    return this.seenByWorld[this.world];
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
    if (this.persist) saveCampaign(state);
    return state;
  }

  /** The campaign, which every screen after the title can rely on. */
  get state(): CampaignState {
    if (!this.campaign) throw new Error('no campaign');
    return this.campaign;
  }

  newCampaign(): void {
    this.persist = true;
    this.world = 'moon';
    clearCampaign();
    this.setCampaign(startRound(newCampaign(this.data.tuning)));
    this.build = {};
    this.outcome = null;
    this.go('design');
  }

  /** From the title or the debrief: on to the campaign's current mission, or the coming-soon screen at the end. */
  continueCampaign(): void {
    const mission = this.state.mission;
    this.world = worldOfStep(mission);
    this.outcome = null;
    if (!isPlayable(mission)) return this.go('comingSoon');
    // Any round in progress is rolled back to its snapshot, as on a restart.
    this.setCampaign(startRound(restartRound(this.state)));
    this.go('design');
  }

  /**
   * Debug start (?world=mars): a throwaway campaign at that world's mission with the earlier missions
   * marked completed, straight to the design screen. It is not saved.
   */
  debugStart(world: MissionId): void {
    this.persist = false;
    this.world = world;
    const order: MissionId[] = ['moon', 'mars'];
    const fresh = newCampaign(this.data.tuning);
    this.setCampaign(startRound({ ...fresh, mission: world, completed: order.slice(0, order.indexOf(world)) }));
    this.build = {};
    this.outcome = null;
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
    this.seenByWorld = { ...this.seenByWorld, [this.world]: { ...this.tutorialSeen, [id]: true } };
    saveTutorialSeen(this.seenByWorld);
  }

  endMission(result: MissionResult, album: AlbumPhoto[] = []): void {
    this.lastResult = result;
    this.album = album;
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
