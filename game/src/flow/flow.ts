// Screen flow: title → (new campaign: the intro film, then the Welcome to REL intro) → design → ticket → landing → mission → debrief, then restart the round (back to
// design, snapshot restored) or continue to the next world's design screen (Moon → Mars → Titan), and after the
// last world the end screen ('complete': Campaign complete, with the campaign summary).
import type { DraftBuild, GameData, MissionId, Part } from '../rules/types';
import {
  buyRover, endCampaign, finishMission, isPlayable, MISSION_ORDER, newCampaign, normalizeCampaign, recordLessons, restartRound, startRound,
  type CampaignState, type RoundOutcome,
} from '../rules/campaign';
import { worldOfStep, type WorldId } from '../worlds';
import type { MissionResult } from '../rules/payout';
import type { InstrumentLog } from '../rules/instruments';
import { quoteBuild } from '../rules/quote';
import { completeBuild } from '../rules/rover';
import { carryBuild } from '../rules/payload';
import { clearCampaign, loadCampaign, saveCampaign } from '../save/campaignSave';
import { loadSettings, saveSettings, type Settings } from '../save/settings';
import { loadTutorialSeen, resetTutorialSeen, saveTutorialSeen, type TutorialId, type TutorialSeen, type TutorialSeenByWorld } from '../save/tutorialSeen';

/** A photograph taken during the mission, kept in memory for the debrief album. */
export interface AlbumPhoto {
  src: string; // JPEG data URL
  caption: string;
}

export type ScreenId = 'title' | 'settings' | 'credits' | 'film' | 'intro' | 'design' | 'ticket' | 'landing' | 'mission' | 'debrief' | 'complete';

/** A screen renders into root and may return a cleanup function. */
export type Screen = (game: Game, root: HTMLElement) => void | (() => void);

/** Follows the game from outside the screens (the sound): screen changes and settings changes. */
export interface GameListener {
  screen?(screen: ScreenId, from: ScreenId): void;
  settings?(settings: Settings): void;
}

export class Game {
  campaign: CampaignState | null;
  /** The rover on the design screen. A new campaign starts with every slot empty; a restart keeps the last design. */
  build: DraftBuild;
  /**
   * Parts the carried design lost because this world does not offer them (the desk's "Not offered" notice):
   * from the build on the desk or the last rover bought. Empty once a rover is bought on this world.
   */
  notOffered: Part[] = [];
  outcome: RoundOutcome | null = null;
  lastResult: MissionResult | null = null;
  /** Photographs from the last mission (not saved: data URLs are too large for localStorage). */
  album: AlbumPhoto[] = [];
  /** What the instruments recorded in the last mission, for the debrief (not saved). */
  instrumentLog: InstrumentLog | null = null;
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
  /** false for a debug start (?world=mars, ?world=titan): the throwaway campaign does not overwrite the save. */
  private persist = true;
  private readonly listeners = new Set<GameListener>();

  constructor(
    private readonly dataFor: (world: WorldId) => GameData,
    private readonly root: HTMLElement,
    private readonly screens: Record<ScreenId, Screen>,
  ) {
    const saved = loadCampaign();
    this.campaign = saved && normalizeCampaign(saved);
    this.world = this.campaign ? worldOfStep(this.campaign.mission) : 'moon';
    // Drops part ids the catalog no longer has, and parts this world does not offer (with a notice); old
    // saves move their instrument into the bay.
    this.build = {};
    this.carryToWorld(this.campaign?.lastBuild);
  }

  /** The design (from a save, or the desk's build) brought to the current world, and what it lost there. */
  private carryToWorld(design: unknown): void {
    const { allParts, world } = this.data;
    const desk = carryBuild(design, allParts, world);
    const last = carryBuild(this.campaign?.lastBuild, allParts, world);
    this.build = desk.build;
    this.notOffered = [...desk.dropped, ...last.dropped].filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
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

  /** Follow screen and settings changes; returns a function that stops listening. */
  listen(listener: GameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  go(screen: ScreenId): void {
    this.cleanup?.();
    this.cleanup = null;
    const from = this.current;
    this.current = screen;
    for (const l of this.listeners) l.screen?.(screen, from);
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
    this.seenByWorld = resetTutorialSeen(); // a new campaign shows every tutorial again; Continue and round restarts keep them
    this.setCampaign(startRound(newCampaign(this.data.tuning)));
    this.build = {};
    this.notOffered = [];
    this.outcome = null;
    this.go('film'); // the intro film, the Welcome to REL intro, then the design desk (Continue and restarts skip both)
  }

  /** From the title or the debrief: on to the campaign's current mission, or Campaign complete at the end. */
  continueCampaign(): void {
    const mission = this.state.mission;
    this.world = worldOfStep(mission);
    this.outcome = null;
    if (!isPlayable(mission)) return this.go('complete');
    // Any round in progress is rolled back to its snapshot, as on a restart.
    this.setCampaign(startRound(restartRound(this.state)));
    this.carryToWorld(this.build);
    this.go('design');
  }

  /**
   * Debug start (?world=mars): a throwaway campaign at that world's mission with the earlier missions
   * marked completed, straight to the design screen. It is not saved.
   */
  debugStart(world: MissionId): void {
    this.persist = false;
    this.world = world;
    const order = MISSION_ORDER;
    const fresh = newCampaign(this.data.tuning);
    // A debug start skips the earlier missions, so it starts with at least this mission's minimum budget.
    const balance = Math.max(fresh.balance, this.data.tuning.budget.minimumBudget[world] ?? 0);
    this.setCampaign(startRound({ ...fresh, balance, mission: world, completed: order.slice(0, order.indexOf(world)) }));
    this.build = {};
    this.notOffered = [];
    this.outcome = null;
    this.go('design');
  }

  buyTicket(): void {
    const build = completeBuild(this.build, this.data.parts);
    if (!build) return;
    const quote = quoteBuild(build, this.data, this.state.balance);
    if (!quote.canLaunch || !quote.canAfford) return;
    this.setCampaign(buyRover(this.state, build, quote.totalCost));
    this.notOffered = [];
    this.go('landing');
  }

  setSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    for (const l of this.listeners) l.settings?.(this.settings);
  }

  markTutorialSeen(id: TutorialId): void {
    this.seenByWorld = { ...this.seenByWorld, [this.world]: { ...this.tutorialSeen, [id]: true } };
    saveTutorialSeen(this.seenByWorld);
  }

  /** Save lessons met mid-mission at once, so a reload or crash does not lose them. Only the notebook changes. */
  recordLessons(ids: readonly string[]): void {
    if (!this.campaign) return;
    const next = recordLessons(this.campaign, ids);
    if (next !== this.campaign) this.setCampaign(next);
  }

  endMission(result: MissionResult, album: AlbumPhoto[] = [], instrumentLog: InstrumentLog | null = null): void {
    this.lastResult = result;
    this.album = album;
    this.instrumentLog = instrumentLog;
    this.outcome = finishMission(this.state, result, this.data);
    this.setCampaign(this.outcome.state);
    this.go('debrief');
  }

  /** After a lost Titan round: end the campaign with Titan not survived, on to Campaign complete. */
  endCampaign(): void {
    this.setCampaign(endCampaign(this.state));
    this.world = worldOfStep(this.state.mission);
    this.outcome = null;
    this.go('complete');
  }

  /**
   * Debug start (?dashboard=demo): show Campaign complete for a given finished campaign (not saved).
   */
  debugComplete(state: CampaignState): void {
    this.persist = false;
    this.campaign = state;
    this.world = worldOfStep(state.mission);
    this.outcome = null;
    this.go('complete');
  }

  restartRound(): void {
    this.setCampaign(startRound(restartRound(this.state)));
    this.carryToWorld(this.build); // the snapshot may bring back a last rover with parts this world does not offer
    this.outcome = null;
    this.go('design');
  }
}
