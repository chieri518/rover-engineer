// Mission screen: the drivable world plus the mission systems. Each physics step it measures the
// rover, calls the rules (rules/mission.ts) and applies what they allow; each frame it draws the HUD
// and minimap. The mission ends at its length or on one of the deaths, then goes to the debrief.
// Mars adds the sol clock, the real Sun, night (lights on or sleep) and the dust storm (ui/marsMission.ts),
// and its four instruments: the weather mast, the radar, the laser and the organics spectrometer (step 4a).
// Titan adds the one-day clock, the sleep fast-forward, the always-on cold and the methane rain (ui/titanMission.ts).
import type { AlbumPhoto, Screen } from '../flow/flow';
import { earnedLines, type MissionResult } from '../rules/payout';
import { buildZones, MilestoneTracker, PHOTO_ZONE_IDS, type FramedBoulder, type MilestoneUpdate, type PhotoView, type Point3, type SunPhoto, type Zone } from '../rules/milestones';
import { completeBuild, selectedParts } from '../rules/rover';
import { instrumentForKey, instrumentKeys, instrumentsOf } from '../rules/payload';
import type { Instrument } from '../rules/types';
import type { Boulder } from '../rules/boulders';
import { worldBoulders } from '../world/boulderList';
import { resolveSites, type ResolvedSite, type SiteFeatures } from '../rules/sites';
import {
  emptyInstrumentLog, emptyRadarTrack, emptySeismometerTrack, hasNeutronNoise, hydrogenReading, laserTarget, radarLayer, radarTrack, reflectorEarthLight, rockTypeFor,
  rockTypeTotal, stationHint, stationPress, stationTooClose, stepSeismometer, withMastPhotoRange, xrayTarget,
  type InstrumentLog, type LaserTarget, type SeismometerOutcome, type StationPending, type TrackPoint,
} from '../rules/instruments';
import {
  craterWallSites, emptySiteProgress, marsSiteDone, marsSitesIn, noteReading, noteSiteReading, siteDone, siteRocks, stagedTransectMeters, stepSurveyRun,
  type SurveyRun,
} from '../rules/siteChecks';
import { dustDevilsWithin, dustIncomeLoss } from '../rules/dust';
import {
  addToNotebook, lessonFor, meet, metIds, onDust, onNeutronMeter, onNightNoLights, onSeismometer, onWorld, onShadowStop, onUseDone, onUseRefused, onUseStart,
  relationshipEntry, shortUseLines, type RelationshipEvent,
} from '../rules/relationships';
import { roverParams } from '../rules/drive';
import { earthLitShare, gameDaysElapsed, skyDirection, sunAt } from '../rules/sun';
import { scheduleEvents, seededRng } from '../rules/events';
import { noLightsLookaheadM } from '../rules/cold';
import { createExplored, exploredShare, reveal } from '../rules/explore';
import { azimuthDeg, areaCenter, buildLeads, buildSites, discover, revealHidden, type Lead, type Site } from '../rules/survey';
import {
  activeFlareWarning, deployPart, isSwitchInstrument, missionSetup, missionWarnings, partsAboard, setStandby, startInstrumentUse, startMission, stepMission,
  type InstrumentRefusal, type MarsStatus, type TitanStatus, type MissionEnd, type MissionSample, type MissionSetup, type MissionState, type UseSite, type WarningId,
} from '../rules/mission';
import { startTally, stepTally, tallyMeasure, type MissionTally } from '../rules/roundStats';
import { WORLDS } from '../worlds';
import type { MoonDriveLimits, MoonScene, MoonStepSample } from '../world/moonScene';
import type { Terrain } from '../world/terrainData';
import type { TerrainMasks } from '../world/terrainMasks';
import { flareWarningText, noticeText } from '../events';
import { el, fill } from './dom';
import { Hud, MILESTONE_LOG_KEY } from './hud';
import { MARS_RELIEF, Minimap, TITAN_RELIEF } from './minimap';
import { foundNotice, hudLeadLine, leadView } from './surveyText';
import { craterWallHint, powerLine, readingNotice, weatherRecordingLine, weatherRecords } from './hudText';
import { causeText, milestoneCard, milestoneLog, missedText } from './milestoneText';
import { openTutorial, type TutorialHandle } from './tutorial';
import { openNotebook, type NotebookHandle } from './notebook';
import { tutorialPages } from './tutorialText';
import { MarsMission } from './marsMission';
import { TitanMission } from './titanMission';
import { MissionSound } from '../audio/missionSound';

const DEG = 180 / Math.PI;
const SUN_SAMPLE_STEPS = 12; // recompute sunlight at the rover every 12 physics steps (0.2 s)
const MAX_STEP_DISTANCE_M = 5; // a larger jump is a teleport, not driving
const GRADE_PROBE_M = 2;
const MINIMAP_EVERY_FRAMES = 3;
const EARTH_CHECK_EVERY_FRAMES = 10; // also the Mars Sun-in-view check
const PHOTO_WIDTH_PX = 960;
const HYDROGEN_EVERY_FRAMES = 12; // the hydrogen meter's live reading is resampled this often
const NOTEBOOK_KEY = 'KeyN'; // opens the engineering notebook (game-design.md, section 7)

export const missionScreen: Screen = (game, root) => {
  const { data } = game;
  const { tuning, text } = data;
  const view = el('div', { class: 'mission-view' });
  const status = el('div', { class: 'status' }, text.mission.loading);
  let disposed = false;
  let scene: MoonScene | null = null;

  // Mission state
  const build = completeBuild(game.build, data.parts);
  if (!build) throw new Error('the mission needs a complete rover');
  const parts = selectedParts(build, data.parts);
  const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
  const rng = seededRng(seed);
  // The setup changes when a station is set down (lighter rover, fewer instruments aboard), and on Mars
  // it gains the site and the dust storm once the terrain (and its latitude) has loaded.
  let setup: MissionSetup = missionSetup(parts, tuning, scheduleEvents(data.events, rng));
  let state: MissionState = startMission(setup);
  // The round stats tally (lowest battery, peak cold, energy used, nights): stepped with the state, read only at the end.
  let tally: MissionTally = startTally(state);
  let ended: MissionEnd | null = null;
  let explored = createExplored(8000, tuning.explore); // resized to the terrain once it loads
  const earthInSky = WORLDS[game.world].earthInSky;
  let mars: MarsMission | null = null; // Mars only, once the terrain has loaded
  let marsNow: MarsStatus | null = null; // the Mars conditions after the last step
  let sunInView = false; // Mars: the Sun is in frame and above the terrain horizon
  let titan: TitanMission | null = null; // Titan only, once the terrain has loaded
  let titanNow: TitanStatus | null = null; // the Titan conditions after the last step
  /** Mars or Titan: the day, night and storm conditions both worlds share (null on the Moon). */
  const dayNow = (): MarsStatus | TitanStatus | null => marsNow ?? titanNow;
  // The milestone tuning: with a mast aboard (Mars), the camera's viewpoint photo zones are wider.
  const mt = withMastPhotoRange(tuning.milestones, parts, tuning.instruments.mast);
  // The payload bay, in bay order: instrument i is used with number key i + 1 or its HUD button. The
  // keys and buttons stay fixed to the launch bay order; a deployed station's button is disabled.
  const instruments = instrumentsOf(parts);
  const keys = instrumentKeys(parts);
  const carries = (i: Instrument) => instruments.includes(i);
  const aboard = (i: Instrument) => carries(i) && !state.deployed.includes(i);
  const keyOf = (i: Instrument) => keys.get(i) ?? 0;
  const partOf = (i: Instrument) => parts.find((p) => p.effects.instrument === i)!;
  const costOf = (i: Instrument) => setup.instruments.find((c) => c.instrument === i);
  const recordsHeld = [...game.state.records];
  const earthDir = skyDirection(tuning.earth.azimuthDeg, tuning.earth.elevationDeg);
  let tracker: MilestoneTracker | null = null;
  const album: AlbumPhoto[] = [];
  let earthInView = false;
  let roverPos: Point3 | null = null; // ground point under the rover after the last step
  // The new instruments: what they need from the world, and what they recorded (the debrief's log).
  let boulders: Boulder[] = [];
  let zones: Zone[] = [];
  let siteList: ResolvedSite[] = []; // the world's sites.json sites on the map (rules/sites.ts resolveSites)
  let floodSite: string | null = null; // Mars: the flood boulder's site id (its camera check)
  let earthAbove = false; // Earth above the terrain horizon from the rover (reflector light and deploy check)
  let hydrogen = 0; // the neutron spectrometer's live reading
  const log: InstrumentLog = emptyInstrumentLog(instruments);
  let seismometer = emptySeismometerTrack(); // the station, the rover's track while it records, and its record
  let stationSetDown: { x: number; z: number } | null = null; // a seismometer station set down this step
  let hydrogenCountdown = 0; // frames until the hydrogen meter is resampled (0: sample now)
  // Relationships met this mission (rules/relationships.ts): each notice shows once per mission. A new
  // one enters the in-mission notebook at once; the campaign notebook is saved at once too (game.recordLessons).
  let met: RelationshipEvent[] = [];
  const notebookAtLaunch = [...game.state.notebook];
  let unread = false; // a relationship met since the notebook was last opened
  const factsShown = new Set<Instrument>(); // each instrument's history fact shows once per mission
  // The minimap's site checks (rules/siteChecks.ts): what the rover did at each site, the rock types each
  // site's boulders hold, and the neutron spectrometer's switched-on drive for the cold trap survey.
  const siteProgress = emptySiteProgress();
  let presentRocks = new Map<string, Set<string>>();
  let surveyRun: SurveyRun | null = null;
  let lastOdometerM = 0;
  const coldTrapSurveyM = data.milestones.milestones.reduce(
    (m, x) => (x.trigger.type === 'transect' && x.trigger.zone === 'cold-trap' ? Math.min(m, x.trigger.meters) : m), Infinity);
  const rockTypes = rockTypeTotal(tuning.instruments.xray); // Rock collection's "New type: n of 5"
  // A station key pressed inside the near-lander zone waits here for its confirming second press.
  let stationPending: StationPending | null = null;
  let seismometerTooClose: string | null = null; // the station went down near the lander: said after its set-down notice
  // Mars instruments (step 4a): the radar's profile, the laser's target, and the delta cliff it can aim at.
  let radar = emptyRadarTrack();
  let laser: LaserTarget | null = null;
  let cliffLine: [number, number][] | null = null; // terrain.json deltaFront.scarpLocal_xz (Mars)
  let roverForward: { x: number; z: number } = { x: 0, z: -1 }; // the rover's heading after the last step
  // Mars (step 6b): the RTG's neutron noise on the hydrogen meter, the radar's and neutron spectrometer's
  // switched-on drives for the site checks (Buried layers, Hydrogen traverse), and the weather mast's timed records.
  const noisy = hasNeutronNoise(parts);
  const marsRuns: Record<'radar' | 'neutron', SurveyRun | null> = { radar: null, neutron: null };
  const marsRunMeters = { radar: stagedTransectMeters(data.milestones.milestones, 'radar'), neutron: stagedTransectMeters(data.milestones.milestones, 'neutron') };
  const weatherRecs = weatherRecords(data.milestones.milestones);

  // What the last step measured
  let ctx: {
    terrain: Terrain;
    masks: TerrainMasks;
    sunVisibility: typeof import('../world/terrainData').sunVisibility;
    horizonMarginTan: typeof import('../world/terrainData').horizonMarginTan;
    groundEyeM: number; // eye height for the horizon tests (terrainData.GROUND_EYE_M): the reflector's Earth light
  } | null = null;
  let lastPos: { x: number; z: number } | null = null;
  let sceneSeconds = 0; // mission time of the last step (drives the Sun)
  let sunlight = 1;
  let sunCountdown = 0;
  let lastSample: MissionSample | null = null;
  let lastSlip = 0;
  let blockedByShadow = false;
  let nearBoundary = false;
  let maxImpact = 0; // largest velocity jolt so far (development readout)
  let limits: MoonDriveLimits = { allowForward: true, allowReverse: true, speedFactor: 1 };
  let paused = false; // the tutorial or the notebook is open
  const audio = new MissionSound(game.world, roverParams(parts, tuning).topSpeed, tuning.damage.impactMinMps);

  const togglePower = () => {
    if (ended) return;
    state = { ...state, poweredDown: !state.poweredDown };
    audio.power(state.poweredDown);
  };
  const ti = text.instruments;
  const itx = text.instrumentText;
  const controls = [text.mission.controls, ...instruments.map((i) => fill(itx[i].controls, {
    key: keyOf(i),
    energy: costOf(i)?.energyPerUse ?? 0,
    standby: costOf(i)?.standbyEnergy ?? 0,
  }))]
    .join(' ');
  /** The instrument's real-history fact, the first time it is used in a mission (Mission history setting). */
  const showFact = (inst: Instrument) => {
    const fact = itx[inst].fact;
    if (!fact || !game.settings.missionHistory || factsShown.has(inst)) return;
    factsShown.add(inst);
    hud.notify(fact, 'good');
  };
  /**
   * Record relationships that happened; show the notice of each met for the first time (its own HUD
   * slot) and mark the notebook unread. `vars` fills the notice's placeholders beyond {distance}.
   * Returns the events met for the first time.
   */
  const relate = (all: RelationshipEvent[], vars: Record<string, string | number> = {}): RelationshipEvent[] => {
    const events = onWorld(all, data.relationships, data.world); // no Moon lesson on Mars
    if (events.length === 0) return [];
    const r = meet(met, events);
    met = r.met;
    const added = r.fresh.map((e) => e.id).filter((id) => !game.state.notebook.includes(id));
    if (added.length > 0) game.recordLessons(added); // saved when first met, not only at mission end
    for (const e of r.fresh) {
      const lesson = lessonFor(data.relationships, e);
      if (!lesson) continue;
      const tone = relationshipEntry(data.relationships, e.id)?.review === 'green' ? 'good' : 'warn';
      hud.lesson(fill(lesson.notice, { distance: tuning.instruments.seismometer.quietDistanceM, ...vars }), tone);
      if (!notebookAtLaunch.includes(e.id)) setUnread(true);
    }
    return r.fresh;
  };
  /** The tutorial and the notebook pause the scene and the HUD's lesson timers together. */
  const pauseMission = (on: boolean) => {
    paused = on;
    scene?.setPaused(on);
    hud.setPaused(on);
    if (on) audio.silence();
  };
  // Drive tutorial: opens by itself on the first mission (the scene loads meanwhile); the Help button
  // reopens it. The mission is paused while it is open.
  let tutorial: TutorialHandle | null = null;
  const openHelp = () => {
    if (tutorial || notebook || ended) return;
    const pages = tutorialPages('drive', data, { mission: game.state.mission, instruments });
    tutorial = openTutorial(root, 'drive', pages, text.tutorial, () => {
      tutorial = null;
      pauseMission(false);
      game.markTutorialSeen('drive');
    });
    pauseMission(true);
  };
  const help = el('button', {
    type: 'button',
    class: 'help-button',
    id: 'tutorial-help-drive',
    title: text.tutorial.helpDrive,
    onclick: openHelp,
  }, text.tutorial.help);
  // Engineering notebook: a HUD button and the N key open it over the mission, paused like the tutorial.
  // It holds the campaign notebook plus what this mission has met so far; a dot marks an unread entry.
  let notebook: NotebookHandle | null = null;
  const unreadMark = el('span', { class: 'unread-mark', hidden: true }, el('span', { class: 'visually-hidden' }, text.notebook.unread));
  const notebookButton = el('button', {
    type: 'button',
    class: 'help-button notebook-button',
    id: 'notebook-open-mission',
    title: text.notebook.openMission,
    onclick: () => openNotes(),
  }, text.notebook.open, unreadMark);
  function setUnread(on: boolean): void {
    unread = on;
    unreadMark.hidden = !on;
    notebookButton.classList.toggle('unread', on);
  }
  function openNotes(): void {
    if (notebook || tutorial) return;
    const thisMission = metIds(met).filter((id) => !notebookAtLaunch.includes(id));
    notebook = openNotebook(root, data, {
      ids: addToNotebook(notebookAtLaunch, thisMission),
      newIds: thisMission,
      closeKey: NOTEBOOK_KEY,
      onClose: () => {
        notebook = null;
        if (!ended) pauseMission(false); // the clock is stopped for good once the mission has ended
      },
    });
    setUnread(false);
    if (!ended) pauseMission(true);
  }
  // One HUD button per instrument, in bay order (the same order as the number keys).
  // A switch instrument (one with a standby draw) shows whether it is on.
  const buttonLabels = new Map<Instrument, HTMLSpanElement>(instruments.map((inst) => [inst, el('span', {}, itx[inst].button)]));
  const instrumentButtons = new Map<Instrument, HTMLButtonElement>(instruments.map((inst) => [inst, el('button', {
    type: 'button',
    class: 'instrument-button',
    onclick: () => useInstrument(inst),
    ...(isSwitchInstrument(inst, setup) ? { 'aria-pressed': 'false' } : {}),
  }, el('span', { class: 'instrument-key' }, String(keyOf(inst))), buttonLabels.get(inst)!)]));
  const hud = new Hud(text, togglePower, el('div', { class: 'hud-extra' },
    instruments.length > 0 && el('div', { class: 'hud-instruments', role: 'group', 'aria-label': ti.buttonsLabel }, ...instrumentButtons.values()),
    el('p', { class: 'muted' }, controls),
    status,
    el('div', { class: 'hud-help' }, help, notebookButton),
  ), () => game.setSettings({ muted: !game.settings.muted }));
  hud.setMuted(game.settings.muted);
  const stopListening = game.listen({ settings: (st) => hud.setMuted(st.muted) }); // the M key mutes too

  // The HUD's milestone list: the ids reached, the latest first (a staged milestone moves up at each stage).
  const milestoneOrder: string[] = [];
  const refreshMilestoneLog = () => {
    if (!tracker) return;
    const lines = earnedLines(tracker.result(), data.milestones.milestones, tuning, recordsHeld, setup.groundDown);
    hud.setMilestoneLog(milestoneLog(lines, milestoneOrder, text));
  };
  const announce = (u: MilestoneUpdate) => {
    if (u.reached.length) audio.milestone();
    for (const r of u.reached) {
      const at = milestoneOrder.indexOf(r.milestone.id);
      if (at !== -1) milestoneOrder.splice(at, 1);
      milestoneOrder.unshift(r.milestone.id);
    }
    if (u.reached.length) refreshMilestoneLog();
    for (const r of u.reached) {
      hud.milestone(milestoneCard(r, data, game.settings.missionHistory, recordsHeld, setup.groundDown));
      // Hidden hydrogen: the only way its site appears on the map.
      const tr = r.milestone.trigger;
      if (tr.type === 'transect' && tr.zone === 'hydrogen-anomaly') revealHiddenSites();
    }
    for (const m of u.missed) hud.notify(missedText(m, text));
    if (u.partialCrossings.length) hud.notify(fill(ti.partialCrossingHint, { angle: mt.boulderCrossMinAngleDeg }));
  };
  const dayText = () => (dayNow() ? String(dayNow()!.clock.sol) : gameDaysElapsed(state.seconds, tuning.mission).toFixed(1));
  const sunNow = () => {
    if (mars) return mars.sunAt(sceneSeconds);
    if (titan) return titan.sunAt(sceneSeconds);
    const se = ctx?.terrain.info.sunAndEarth;
    return sunAt(sceneSeconds, tuning.sun, tuning.mission, { latitudeDeg: se?.siteLatitude_deg ?? 0, longitudeDeg: se?.siteLongitude_deg ?? 0 });
  };
  /** Sunlit share of Earth's disc right now (its phase). */
  const earthLit = () => earthLitShare(sunNow(), earthDir);
  const earthDarkText = (lit: number) => fill(ti.earthDarkHint, { lit: Math.round(lit * 100), min: Math.round(mt.earthPhotoMinLit * 100) });
  const earthTooCloseText = (p: { x: number; z: number }) => {
    const L = ctx?.terrain.info.landing.local ?? { x: 0, z: 0 };
    return fill(ti.earthTooCloseHint, { distance: Math.round(Math.hypot(p.x - L.x, p.z - L.z)), min: mt.earthPhotoMinDistanceM });
  };
  /** Why an Earth photo here would not count, or null if it would. */
  const earthBlocker = (p: { x: number; z: number }, lit: number): string | null =>
    lit < mt.earthPhotoMinLit ? earthDarkText(lit) : tracker?.earthPhotoTooClose(p) ? earthTooCloseText(p) : null;

  /** Mars: the Sun as the camera sees it now, for the Blue sunset photo. */
  const sunPhoto = (): SunPhoto | undefined => {
    if (!mars || !marsNow || !scene) return undefined;
    const sun = sunNow();
    return { elevationDeg: sun.elevationDeg, setting: marsNow.clock.sunSetting, inFrame: scene.inView(sun, mt.photoFrameMargin) };
  };
  /** Why a sunset photo did not count, when the player can act on it (the Sun too high, too near the lander). */
  const sunsetBlockerText = (p: { x: number; z: number }, why: ReturnType<MilestoneTracker['sunsetBlocker']>): string | null => {
    if (why === 'too-high' && ti.sunsetTooHigh) return fill(ti.sunsetTooHigh, { max: mt.sunsetMaxElevationDeg ?? 0 });
    if (why === 'too-close' && ti.sunsetTooClose) {
      const L = ctx?.terrain.info.landing.local ?? { x: 0, z: 0 };
      return fill(ti.sunsetTooClose, { distance: Math.round(Math.hypot(p.x - L.x, p.z - L.z)), min: mt.sunsetPhotoMinDistanceM ?? 0 });
    }
    return null;
  };

  /** The notice for a refused instrument use. */
  const refusalText = (inst: Instrument, reason: InstrumentRefusal, cost: number): string | null => {
    const name = partOf(inst)?.name ?? inst;
    switch (reason) {
      case 'ended':
        return null;
      case 'not-carried':
        return itx[inst].notCarried;
      case 'deployed':
        return fill(ti.useDeployed, { name });
      case 'no-earth':
        return fill(ti.useNoEarth, { name });
      case 'no-boulder':
        return fill(ti.useNoBoulder, { name, reach: setup.reachM });
      case 'low-energy':
        return fill(ti.standbyLowEnergy, { name, share: Math.round(tuning.energy.lowWarningShare * 100) });
      case 'busy':
        return ti.useBusy;
      case 'powered-down':
        return fill(ti.usePoweredDown, { name });
      case 'moving':
        return fill(ti.useMoving, { name });
      case 'energy':
        return fill(ti.useNoEnergy, { name, cost, energy: Math.floor(state.energy) });
      case 'slope':
        return fill(itx[inst].slope ?? ti.useMoving, { name, slope: Math.round(lastSample?.slopeDeg ?? 0), max: tuning.instruments.arm?.slopeLimitDeg ?? 0 });
      case 'no-target':
        return fill(itx[inst].noTarget ?? ti.useNoBoulder, { name, reach: tuning.instruments.laser?.reachM ?? 0 });
    }
  };
  /** The rules' answer to a use now, without applying it. */
  const startUse = (inst: Instrument) => {
    // A remote reading (the laser, on the mast) aims at its target ahead; the others read the boulder in reach.
    const remote = setup.remote.includes(inst);
    const aim = remote ? currentLaserTarget() : null;
    return startInstrumentUse(state, inst, {
      speedMps: lastSample?.speedMps ?? 0,
      inColdZone: lastSample?.inColdZone ?? false,
      sunlight,
      earthInView: earthAbove,
      boulderInReach: currentBoulder() !== null,
      boulder: remote ? aim?.index ?? null : currentBoulder()?.index ?? null, // a reading keeps this boulder even if the rover is nudged
      inDarkCrater: inDarkCrater(),
      slopeDeg: lastSample?.slopeDeg ?? 0,
      remoteTarget: aim?.kind ?? null,
    }, setup, tuning);
  };
  /** Run the rules for a use; on success the state is updated (energy charged, hold started). */
  const tryUse = (inst: Instrument): boolean => {
    if (!carries(inst)) {
      hud.notify(itx[inst].notCarried);
      return false;
    }
    const r = startUse(inst);
    if (!r.ok) {
      const msg = refusalText(inst, r.reason, r.cost);
      if (msg) hud.notify(msg);
      if (msg) audio.refused();
      if (mars) relate(onUseRefused(r.reason)); // the arm cannot reach on a slope (the slope notice shows too)
      return false;
    }
    state = r.state;
    audio.useStart(inst, r.holdSeconds);
    // The first time in a mission, the relationship's notice explains it; later uses get the short line.
    const lines = shortUseLines(r, relate(onUseStart(r)));
    const said = { name: partOf(inst).name, seconds: Math.round(r.holdSeconds) };
    if (lines.slowCold) hud.notify(fill(ti.useSlowCold, said));
    if (lines.fastShadow && !mars) hud.notify(fill(ti.useFastShadow, said), 'good'); // the Moon's shade lesson line (xray-cold); Mars has no such lesson
    return true;
  };
  /**
   * The boulders a photo would show: within the farthest boulder photo range, inside the frame and not
   * hidden by terrain (scene.inFrame on the boulder's top). No light is needed, as for every photo.
   */
  const framedBoulders = (): FramedBoulder[] => {
    if (!scene || !ctx || !roverPos) return [];
    const range = Math.max(mt.boulderTrackPhotoRangeM, mt.documentedSampleRangeM);
    const out: FramedBoulder[] = [];
    boulders.forEach((b, index) => {
      if (Math.hypot(b.x - roverPos!.x, b.z - roverPos!.z) > range) return;
      const top = { x: b.x, y: ctx!.terrain.heightAt(b.x, b.z) + b.radius, z: b.z };
      if (scene!.inFrame(top, mt.photoFrameMargin)) out.push({ index, x: b.x, z: b.z, ...(b.rolled ? { rolled: true } : {}) });
    });
    return out;
  };
  /** The boulder within reach of a boulder reading (the X-ray's, or the arm's when one is fitted), if any. */
  const currentBoulder = () => (roverPos ? xrayTarget(roverPos, boulders, { reachM: setup.reachM }) : null);
  /** Mars: the laser spectrometer's target in the cone ahead (a boulder or the delta cliff), if any. */
  const currentLaserTarget = (): LaserTarget | null => {
    const t = tuning.instruments.laser;
    return t && roverPos ? laserTarget(roverPos, roverForward, { boulders, cliff: cliffLine }, t) : null;
  };
  /** A station: an instrument set down on the ground (the seismometer and the reflector). */
  const isStation = (i: Instrument) => partOf(i)?.effects.deploy === true;
  /** The rover is inside the near-lander zone, where a station set down earns no milestones. */
  const roverTooClose = () => roverPos !== null && stationTooClose(roverPos, zones);
  /** The rover is inside the dark crater (the shadowed-crater zone). */
  const inDarkCrater = () => tracker?.currentZones().some((z) => z.id === 'shadowed-crater') ?? false;

  const takePhoto = () => {
    if (ended || !scene || !tracker || !roverPos) return;
    if (!carries('camera')) return hud.notify(itx.camera.notCarried);
    if (album.length >= mt.albumMax) return hud.notify(fill(ti.photoAlbumFull, { max: mt.albumMax }));
    if (!tryUse('camera')) return;
    const earth = earthInSky && scene.inView(earthDir, mt.photoFrameMargin);
    const lit = earthInSky ? earthLit() : 0;
    const sun = sunPhoto();
    const rained = titan && tracker.photosBlocked() ? titan.photoBlocked : null; // Titan: the rain blocks photo milestones
    const framed = framedBoulders();
    // Mars: the frame test on craters' centers (Crater wall) and the dust devils in frame (Dust devil).
    const sc = scene;
    const view: PhotoView = mars ? { groundInFrame: (q) => sc.groundInFrame(q, mt.photoFrameMargin), dustDevilsInFrame: sc.dustDevilsInFrame(mt.photoFrameMargin) } : {};
    const u = tracker.photo(roverPos, earth, lit, sun, framed, view);
    // The rolled boulder's check: in frame within the Boulder track range (as the tracker's photo rule).
    for (const b of framed) {
      const site = boulders[b.index]?.site;
      if (b.rolled && site && Math.hypot(b.x - roverPos.x, b.z - roverPos.z) <= mt.boulderTrackPhotoRangeM) siteProgress.photographed.add(site);
    }
    const places = tracker.zones
      .filter((z) => PHOTO_ZONE_IDS.includes(z.id) && tracker!.currentZones().includes(z))
      .map((z) => z.name);
    if (mars) {
      // Mars site checks: a rim photo with the crater's center in frame (Crater wall's rule); the flood
      // boulder in frame within Documented sample's range once the X-ray spectrometer has read it.
      const walls = tracker.craterWallsNear(roverPos).filter((z) => z.crater && z.site && view.groundInFrame!({ x: z.crater.x, z: z.crater.z }));
      for (const z of walls) siteProgress.photographed.add(z.site!);
      for (const b of framed) {
        const site = boulders[b.index]?.site;
        if (site && site === floodSite && tracker.wasRead(b.index, 'xray') && Math.hypot(b.x - roverPos.x, b.z - roverPos.z) <= mt.documentedSampleRangeM) {
          siteProgress.photographed.add(site);
        }
      }
      if (walls[0] && ti.captionCraterWall) places.push(fill(ti.captionCraterWall, { name: text.survey.siteNames?.[walls[0].name] ?? walls[0].name }));
      if ((view.dustDevilsInFrame?.length ?? 0) > 0 && ti.captionDustDevil) places.push(ti.captionDustDevil);
    }
    if (earth) places.push(ti.captionEarth);
    const sunset = sun ? tracker.sunsetBlocker(roverPos, sun) : 'not-in-frame';
    if (sunset === null && ti.captionSunset) places.push(ti.captionSunset);
    const caption = fill(ti.captionDay, { place: places.length ? places.join(', ') : ti.captionSurface, day: dayText() });
    album.push({ src: scene.capture(PHOTO_WIDTH_PX), caption });
    // Mars: a photo that earned a milestone without a named place (Documented sample) is not "no zone".
    const counted = places.length > 0 || (mars !== null && u.reached.length > 0);
    if (rained) hud.notify(rained);
    else hud.notify(counted ? fill(ti.photoTaken, { caption }) : ti.photoNoZone, 'good');
    const blocker = earth ? earthBlocker(roverPos, lit) : sun ? sunsetBlockerText(roverPos, sunset) : null;
    if (blocker) hud.notify(blocker);
    announce(u);
  };

  // The drill holds the rover still for its useSeconds (rules: startInstrumentUse); stepMission
  // reports when it is done, and finishDrill reads the sample.
  const startDrill = () => {
    if (ended) return;
    tryUse('drill');
  };

  const finishDrill = (site: UseSite) => {
    if (!tracker || !roverPos) return;
    const zones = tracker.zones.filter((z) => tracker!.currentZones().includes(z)).map((z) => z.id);
    const repeat = tracker.sampleTooClose(roverPos);
    const u = tracker.drill(roverPos);
    if (zones.includes('near-lander')) hud.notify(fill(ti.drillNearLander, { distance: mt.sampleMinDistanceM }));
    else {
      // A counted sample inside a young crater's or rocky area's ejecta ring: that site's drill check.
      // Mars: also Séítah (the Séítah edge's check) and the delta-foot zone (rules/siteChecks.ts marsSitesIn).
      if (mars) for (const id of marsSitesIn(tracker.currentZones(), 'drill')) siteProgress.drilled.add(id);
      else for (const z of tracker.currentZones()) if (z.id === 'young-crater' && z.site) siteProgress.drilled.add(z.site);
      const done = repeat ? fill(ti.drillSameSite, { distance: mt.sampleSpacingM }) : ti.drillDone;
      // The drill only confirms ice: it gives no hydrogen reading (the neutron spectrometer does).
      const result = zones.includes('ice-spot') ? ti.drillIce : zones.includes('shadowed-crater') ? ti.drillNoIce : done;
      hud.notify(result, 'good');
    }
    relate(onUseDone('drill', site, instruments, zones.includes('ice-spot')));
    announce(u);
  };

  /** The X-ray reading is done: the rock type of the boulder targeted when it started. */
  const finishXray = (site: UseSite) => {
    const index = site.boulder;
    const boulder = index === null ? undefined : boulders[index];
    if (index === null || !boulder) return hud.notify(ti.xrayNoTarget);
    const id = rockTypeFor(boulder, tuning.instruments.xray, data.sites.sites);
    const rock = text.rocks[id] ?? { name: id, elements: '' };
    const again = log.rocks.find((r) => r.boulder === index);
    const newType = !again && !log.rocks.some((r) => r.rock === id); // a rock type not read before this mission
    if (!again) log.rocks.push({ boulder: index, rock: id });
    noteReading(siteProgress, boulder, id);
    const said = again ? fill(ti.xrayAgain, { rock: rock.name }) : fill(ti.xrayResult, { rock: rock.name, elements: rock.elements });
    const count = new Set(log.rocks.map((r) => r.rock)).size;
    // A fitted arm grinds the rock first: said once, on the mission's first new boulder (the debrief shows the raised rewards).
    const ground = setup.groundDown && !again && log.rocks.length === 1 && text.support?.groundDown
      ? fill(text.support.groundDown, { percent: Math.round(((tuning.instruments.arm?.groundDownFactor ?? 1) - 1) * 100) })
      : null;
    const lines = [said, ...(newType && rockTypes > 0 ? [fill(ti.xrayNewType, { count, total: rockTypes })] : []), ...(ground ? [ground] : [])];
    hud.notify(lines.length === 1 ? said : lines, 'good');
    // Rock collection, Rare rock, and the boulder Documented sample photographs.
    if (tracker && roverPos) announce(tracker.reading('xray', roverPos, { target: 'boulder', rock: id, boulder: index }));
  };

  /**
   * The laser reading is done: the boulder's rock type (as the X-ray reads it) or the delta cliff, aimed at
   * when it started. It feeds the shared `reading` trigger with its target, rock and boulder; rock types
   * and boulders count per instrument, so a laser reading never counts toward the X-ray's Rock collection
   * or Documented sample. The readout adds the laser's own "New type: n of 6".
   */
  const finishLaser = (site: UseSite) => {
    const lt = itx.laser; // read only while a laser is aboard (Mars)
    if (site.target === 'cliff') {
      log.laser.push({ target: 'cliff', boulder: null, rock: null });
      if (lt.resultCliff) hud.notify(lt.resultCliff, 'good');
      // The delta cliff read from the delta-foot zone: the delta foot's laser check.
      if (tracker?.currentZones().some((z) => z.id === 'delta-foot')) noteSiteReading(siteProgress, 'delta-foot', 'laser');
      if (tracker && roverPos) announce(tracker.reading('laser', roverPos, { target: 'cliff' }));
      return;
    }
    const index = site.boulder;
    const boulder = index === null ? undefined : boulders[index];
    if (index === null || !boulder) return; // cannot happen: a boulder reading starts only aimed at one
    const id = rockTypeFor(boulder, tuning.instruments.xray, data.sites.sites);
    const rock = text.rocks[id] ?? { name: id, elements: '' };
    const before = log.laser.flatMap((r) => (r.rock ? [r.rock] : []));
    log.laser.push({ target: 'boulder', boulder: index, rock: id });
    noteSiteReading(siteProgress, boulder.site, 'laser');
    const said = fill(lt.result ?? ti.xrayResult, { rock: rock.name, elements: rock.elements });
    hud.notify(readingNotice(said, before, id, tuning.instruments.xray, text), 'good');
    if (tracker && roverPos) announce(tracker.reading('laser', roverPos, { target: 'boulder', rock: id, boulder: index }));
  };

  /** The organics reading is done: no rock type; it feeds the shared `reading` trigger on its boulder. */
  const finishOrganics = (site: UseSite) => {
    const index = site.boulder;
    if (index === null) return; // cannot happen: an organics reading starts only with a boulder in reach
    log.organics++;
    if (itx.organics.result) hud.notify(itx.organics.result, 'good');
    noteSiteReading(siteProgress, boulders[index]?.site, 'organics');
    if (tracker && roverPos) announce(tracker.reading('organics', roverPos, { target: 'boulder', boulder: index }));
  };

  /** A station's hold is done: it is on the ground, the rover is lighter and drops the part. */
  const finishDeploy = (inst: 'seismometer' | 'reflector') => {
    const aboard = partsAboard(parts, state.deployed);
    setup = deployPart(setup, parts, state.deployed, tuning);
    const at = scene?.deploy(inst, roverParams(aboard, tuning), aboard) ?? (roverPos ? { x: roverPos.x, z: roverPos.z } : { x: 0, z: 0 });
    const button = instrumentButtons.get(inst);
    if (button) button.disabled = true;
    buttonLabels.get(inst)!.textContent = ti.deployedButton;
    stationPending = null;
    // Laser ranging site and Science station: where it went down and whether Earth was in view (the
    // reflector cannot be set down without it). earthAbove is measured at the rover's position, up to
    // EARTH_CHECK_EVERY_FRAMES frames stale; the rover holds still while the station goes down, so that
    // is negligible.
    if (tracker) announce(tracker.deploy(inst, at, earthAbove));
    // Set down inside the near-lander zone after the confirming second press: it works, but earns nothing.
    // Said after the set-down notice (the seismometer's comes from seismometerNotice later in this step).
    const tooClose = stationTooClose(at, zones) ? fill(ti.stationPlacedTooClose, { name: partOf(inst).name, distance: mt.sampleMinDistanceM }) : null;
    if (inst === 'reflector') {
      log.reflectorPlaced = true;
      hud.notify(ti.reflectorDeployed, 'good');
      if (tooClose) hud.notify(tooClose);
      return;
    }
    seismometerTooClose = tooClose;
    log.stationPlaced = true;
    stationSetDown = at; // stepSeismometer places it later in this step (before a moonquake in the same step)
  };

  /** A held use finished (an 'instrument-done' notice): report what the instrument found. */
  const finishUse = (inst: Instrument, site: UseSite) => {
    if (inst === 'drill') finishDrill(site);
    else if (inst === 'xray') finishXray(site);
    else if (inst === 'laser') finishLaser(site);
    else if (inst === 'organics') finishOrganics(site);
    else if (inst === 'seismometer' || inst === 'reflector') finishDeploy(inst);
    if (inst !== 'seismometer') showFact(inst); // the station's fact follows its set-down notice (seismometerNotice)
  };

  /** What the seismometer station did this step: set down, missed the moonquake, or recorded it. */
  const seismometerNotice = (o: SeismometerOutcome) => {
    if (o.kind === 'deployed' || o.kind === 'missed') {
      if (o.kind === 'deployed') hud.notify(ti.seismometerDeployed, 'good');
      else {
        log.quake = 'missed';
        hud.notify(ti.quakeMissed);
      }
      if (seismometerTooClose) hud.notify(seismometerTooClose);
      seismometerTooClose = null;
      return showFact('seismometer');
    }
    const { quality, closestM } = o.record;
    log.quake = quality;
    // Moonquake record and Clean seismogram: the station's record, with where it was set down.
    const at = seismometer.deployedAt;
    if (tracker) announce(tracker.record('seismometer', 'quake', quality, at ? { x: at.x, z: at.z } : undefined));
    hud.showQuakeTrace(quality);
    audio.quakeRecorded(quality === 'noisy');
    // A noisy record is the seismometer's lesson: the first time, its notice replaces the short line.
    const fresh = relate(onSeismometer(o), { closest: Math.round(closestM) });
    if (quality === 'clean') hud.notify(ti.quakeClean, 'good');
    else if (fresh.length === 0) hud.notify(fill(ti.quakeNoisy, { distance: Math.round(closestM) }));
  };

  /** Standby instruments the low-energy warning switched off: their transects pause until the player switches them again. */
  const autoOff = new Set<Instrument>();

  /** Switch a standby instrument on or off. */
  const toggleStandby = (inst: Instrument) => {
    const on = !state.standbyOn.includes(inst);
    const r = setStandby(state, inst, on, setup, tuning);
    if (!r.ok) {
      const msg = refusalText(inst, r.reason, 0);
      if (msg) hud.notify(msg);
      if (msg) audio.refused();
      return;
    }
    state = r.state;
    autoOff.delete(inst); // the player's own switch: on continues a paused count, off ends it
    audio.switched(on);
    const name = partOf(inst).name;
    hud.notify(on ? fill(ti.standbyOn, { name, standby: costOf(inst)?.standbyEnergy ?? 0 }) : fill(ti.standbyOff, { name }), 'good');
    if (on) showFact(inst);
  };

  function useInstrument(inst: Instrument): void {
    if (tutorial || notebook || ended) return;
    // A switch instrument (with a standby draw) is switched on or off; the others are used.
    if (state.deployed.includes(inst)) {
      const msg = refusalText(inst, 'deployed', 0);
      if (msg) hud.notify(msg);
      audio.refused();
    } else if (isSwitchInstrument(inst, setup)) toggleStandby(inst);
    else if (inst === 'camera') takePhoto();
    else if (isStation(inst)) pressStation(inst);
    else tryUse(inst);
  }

  /**
   * A station's key. Inside the near-lander zone the first press only asks for a second press within
   * stationConfirmSeconds (rules/instruments.ts stationPress). Any other refusal (moving, no Earth,
   * powered down, busy) is shown first, so a confirmation is never asked for a press that would fail.
   */
  function pressStation(inst: Instrument): void {
    if (!carries(inst)) return void hud.notify(itx[inst].notCarried);
    const r = startUse(inst);
    if (!r.ok) {
      const msg = refusalText(inst, r.reason, r.cost);
      if (msg) hud.notify(msg);
      if (mars) relate(onUseRefused(r.reason));
      return;
    }
    const press = stationPress(stationPending, inst, state.seconds, roverTooClose(), tuning.instruments.stationConfirmSeconds);
    stationPending = press.pending;
    if (press.action === 'confirm') {
      return void hud.notify(fill(ti.stationConfirm, { name: partOf(inst).name, key: keyOf(inst), seconds: tuning.instruments.stationConfirmSeconds }));
    }
    tryUse(inst);
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || tutorial || notebook) return;
    if (e.code === NOTEBOOK_KEY) return openNotes();
    if (e.code === 'KeyP') togglePower();
    if (e.code === MILESTONE_LOG_KEY) hud.toggleMilestoneLog();
    const inst = instrumentForKey(e.code, parts);
    if (inst) useInstrument(inst);
  };
  window.addEventListener('keydown', onKey);

  const finish = (end: MissionEnd) => {
    ended = end;
    audio.end(end.survived);
    for (const button of instrumentButtons.values()) button.disabled = true;
    scene?.stopClock();
    if (tracker) announce(tracker.finish(end.survived, state.damageBy));
    const h = text.hud;
    const days = gameDaysElapsed(end.seconds, tuning.mission);
    const lines = [
      end.survived ? h.endedSurvived : fill(h.endedFailed, { cause: causeText(end, text) }),
      fill(h.lasted, { days: end.survived ? tuning.mission.gameDays : days.toFixed(1), total: tuning.mission.gameDays }),
    ];
    const result: MissionResult = {
      survived: end.survived,
      cause: end.cause,
      detail: end.detail,
      secondsLasted: end.seconds,
      earned: tracker?.result() ?? [],
      relationships: met, // for the debrief and the engineering notebook (added at mission end)
      measure: tallyMeasure(tally, state, setup.stats.batteryCapacity, album.length, !!(setup.mars ?? setup.titan)),
      ...(setup.groundDown ? { groundDown: true } : {}), // a fitted arm ground down the X-ray's readings: its reading milestones pay more
    };
    hud.showEnd(lines, () => game.endMission(result, album, log), () => openNotes());
  };

  const onStep = (s: MoonStepSample): MoonDriveLimits | void => {
    if (!ctx) return;
    const { terrain, masks } = ctx;
    const p = s.position;
    let distance = lastPos ? Math.hypot(p.x - lastPos.x, p.z - lastPos.z) : 0;
    // A teleport or a time jump (development helpers) makes the last sunlight reading stale.
    if (distance > MAX_STEP_DISTANCE_M || Math.abs(s.seconds - sceneSeconds) > 1) sunCountdown = 0;
    if (distance > MAX_STEP_DISTANCE_M) distance = 0;
    lastPos = { x: p.x, z: p.z };
    sceneSeconds = s.seconds;
    if (Math.hypot(s.forward.x, s.forward.z) > 1e-6) roverForward = { x: s.forward.x, z: s.forward.z };

    const vh = Math.hypot(s.velocity.x, s.velocity.z);
    let uphillDeg = 0;
    if (vh > 0.3) {
      const dx = (s.velocity.x / vh) * GRADE_PROBE_M;
      const dz = (s.velocity.z / vh) * GRADE_PROBE_M;
      uphillDeg = Math.atan2(terrain.heightAt(p.x + dx, p.z + dz) - terrain.heightAt(p.x - dx, p.z - dz), 2 * GRADE_PROBE_M) * DEG;
    }
    if (--sunCountdown <= 0) {
      sunCountdown = SUN_SAMPLE_STEPS;
      sunlight = ctx.sunVisibility(terrain, p.x, p.z, sunNow());
    }
    const inColdZone = masks.inColdZone(p.x, p.z);
    const throttle = s.input.throttle;
    const canDrive = !ended && (mars ? mars.status(state, setup).canDrive : titan ? titan.status(state, setup).canDrive : !state.poweredDown);
    const sample: MissionSample = {
      dt: s.dt,
      distanceM: distance,
      speedMps: Math.abs(s.speed),
      uphillDeg,
      slopeDeg: masks.slopeAt(p.x, p.z),
      sunlight,
      inColdZone,
      softness: masks.softnessAt(p.x, p.z, tuning.ground),
      throttling: canDrive && ((throttle > 0 && limits.allowForward) || (throttle < 0 && limits.allowReverse)),
      impactMps: s.deltaV,
      upY: s.upY,
      position: { x: p.x, z: p.z }, // Mars: dust devils form at the rover and clean near it
    };
    // Mars: where the rover and the clock were before this step, for a dust devil passing during it.
    // The round stats compare the state before and after the step.
    const prevSeconds = state.seconds;
    const roverPrev = state.mars?.roverAt ?? null;
    const prevState = state;
    const step = stepMission(state, sample, setup, tuning, data.events);
    state = step.state;
    lastSample = sample;
    lastSlip = step.slip;
    maxImpact = Math.max(maxImpact, s.deltaV);
    audio.notices(step.notices);
    if (mars || titan) audio.dayNotices(step.marsNotices);
    audio.drive({ speedMps: Math.abs(s.speed), throttle: throttle, wheelsOnGround: s.wheelsOnGround, awake: !ended && !paused && !state.poweredDown, deltaV: s.deltaV });
    for (const n of step.notices) {
      if (n.kind === 'quake') scene?.shake(data.events.quake?.shakeSeconds ?? 0);
      if (n.kind === 'standby-off') {
        for (const i of n.instruments) autoOff.add(i);
        hud.notify(fill(ti.standbyAutoOff, { names: n.instruments.map((i) => partOf(i).name).join(text.ticket.and) }));
      }
      if (n.kind === 'flare-hit' && !n.protected) hud.flashScreen();
      if (n.kind === 'instrument-stopped') {
        const said = itx[n.instrument].stopped;
        if (said) hud.notify(fill(said, { name: partOf(n.instrument).name }));
      }
      const msg = noticeText(n, text);
      if (msg) hud.notify(msg.message, msg.tone);
    }
    if (mars) {
      marsNow = mars.status(state, setup);
      for (const n of step.marsNotices) {
        const lead = setup.mars?.storm ? setup.mars.storm.startAt - state.seconds : 0;
        const msg = mars.noticeText(n, setup.hasLights, lead, setup.stats.energyIncome > 0);
        hud.notify(msg.message, msg.tone);
        if (n.kind === 'storm' && n.byMast) log.stormForecastByMast = true;
      }
      // The weather mast's record: seconds switched on with the rover powered up.
      if (!state.poweredDown && state.standbyOn.includes('weather')) log.weatherSeconds += s.dt;
      // The Mars lessons met while driving: the RTG's noise on a reading hydrogen meter, dust on the panels.
      relate(onNeutronMeter({ reading: !state.poweredDown && state.standbyOn.includes('neutron'), noisy }));
      relate(onDust(marsNow.dustFactor, tuning.dust), { loss: Math.round(dustIncomeLoss(marsNow.dustFactor) * 100) });
    }
    // Mars: a dust devil passed within the weather mast's sensing distance during this step (Dust devil pass).
    const devils = state.mars?.devils ?? [];
    const dustDevilPassed = mars !== null && devils.length > 0 && tuning.dust !== undefined
      && dustDevilsWithin(devils, prevSeconds, state.seconds, roverPrev ?? { x: p.x, z: p.z }, { x: p.x, z: p.z }, tuning.dust.dustDevilSenseM).length > 0;
    if (titan) {
      titanNow = titan.status(state, setup, Math.abs(s.speed) > tuning.ground.movingSpeedMps);
      const soon = titan.sunsetSoon(prevSeconds, state.seconds);
      if (soon) hud.notify(soon.message, soon.tone);
      for (const n of step.marsNotices) {
        const msg = titan.noticeText(n, setup.hasLights);
        hud.notify(msg.message, msg.tone);
      }
    }
    if (!ended) {
      const day = dayNow();
      const drilled = step.notices.some((n) => n.kind === 'instrument-done' && n.instrument === 'drill');
      tally = stepTally(tally, prevState, state, day ? { night: day.clock.isNight, lightsOn: day.lightsOn } : null, drilled);
    }
    if (!ended && tracker) {
      roverPos = { x: p.x, y: terrain.heightAt(p.x, p.z), z: p.z };
      announce(tracker.step({
        position: roverPos,
        distanceM: state.distanceM,
        exploredShare: exploredShare(explored),
        flareSurvived: step.notices.some((n) => n.kind === 'flare-hit' && n.protected),
        switchedOn: state.standbyOn, // the transects (neutron, radar) and the weather mast's timed records
        poweredDown: state.poweredDown,
        autoOff: [...autoOff],
        dt: s.dt,
        ...(dayNow() ? { night: dayNow()!.clock.isNight, stormActive: dayNow()!.stormPhase === 'active' } : {}),
        ...(marsNow ? { dustDevilPassed } : {}),
        ...(titanNow ? { photosBlocked: titanNow.photosBlocked } : {}),
      }));
      // The cold trap checks: the same switched-on drive as the tracker's Cold trap survey.
      const here = tracker.currentZones().flatMap((z) => (z.id === 'cold-trap' && z.site ? [z.site] : []));
      const lastOdometerBefore = lastOdometerM;
      const run = stepSurveyRun(surveyRun, {
        on: state.standbyOn.includes('neutron'),
        poweredDown: state.poweredDown,
        drivenM: Math.max(0, state.distanceM - lastOdometerM),
        here,
        autoOff: autoOff.has('neutron'),
      }, coldTrapSurveyM);
      lastOdometerM = state.distanceM;
      surveyRun = run.run;
      // The radar's profile: switched on and powered up, along the drive, with the layer under the rover.
      const radarTuning = tuning.instruments.radar;
      if (radarTuning && carries('radar')) {
        const on = !state.poweredDown && state.standbyOn.includes('radar');
        radar = radarTrack(radar, {
          on,
          dt: s.dt,
          distanceM: distance,
          headingDeg: Math.atan2(s.forward.x, -s.forward.z) * DEG,
          moving: sample.speedMps > tuning.ground.movingSpeedMps,
          layer: radarLayer(tracker.currentZones().map((z) => z.id), radarTuning),
        }, radarTuning);
        if (on) log.radarLongestM = Math.max(log.radarLongestM ?? 0, radar.longestM);
        log.radarLayers = radar.layers;
      }
      for (const id of run.surveyed) siteProgress.surveyed.add(id);
      // Mars site checks: the radar's and neutron spectrometer's switched-on drives through a site's zone,
      // as the tracker's Buried layers and Hydrogen traverse count them.
      if (mars) {
        for (const inst of ['radar', 'neutron'] as const) {
          if (!carries(inst)) continue;
          const r = stepSurveyRun(marsRuns[inst], {
            on: state.standbyOn.includes(inst),
            poweredDown: state.poweredDown,
            drivenM: Math.max(0, state.distanceM - lastOdometerBefore),
            here: marsSitesIn(tracker.currentZones(), inst),
            autoOff: autoOff.has(inst),
          }, marsRunMeters[inst]);
          marsRuns[inst] = r.run;
          for (const id of r.surveyed) (inst === 'radar' ? siteProgress.profiled : siteProgress.surveyed).add(id);
        }
      }
      for (const n of step.notices) if (n.kind === 'instrument-done') finishUse(n.instrument, n.site);
    }
    // The seismometer station: set down this step, the rover's track while it records, then the moonquake.
    const point: TrackPoint = { seconds: state.seconds, x: p.x, z: p.z, moving: sample.speedMps > tuning.ground.movingSpeedMps };
    const seismic = stepSeismometer(seismometer, { point, deployed: stationSetDown, quake: step.notices.some((n) => n.kind === 'quake') }, tuning.instruments.seismometer);
    seismometer = seismic.track;
    stationSetDown = null;
    for (const o of seismic.outcomes) seismometerNotice(o);
    if (state.end && !ended) finish(state.end);

    // What the rover may do next step.
    // Mars and Titan: no driving at night without lights (canDrive also covers sleep).
    const holding = state.using !== null;
    if (ended || state.poweredDown || holding || (dayNow() && !dayNow()!.canDrive)) {
      blockedByShadow = false;
      // Titan: a sleeping rover, or one that cannot drive, brakes to a stop instead of coasting on.
      return (limits = { allowForward: false, allowReverse: false, speedFactor: 1, hardStop: holding, ...(titan && !ended ? { brake: true } : {}) });
    }
    // Without lights the rover stops at the edge of permanent shadow.
    let allowForward = true;
    let allowReverse = true;
    if (!setup.hasLights && !inColdZone) {
      const look = noLightsLookaheadM(s.speed, tuning.rover.brakeDecelMps2, tuning.cold);
      const f = s.forward;
      const fl = Math.hypot(f.x, f.z) || 1;
      allowForward = !masks.inColdZone(p.x + (f.x / fl) * look, p.z + (f.z / fl) * look);
      allowReverse = !masks.inColdZone(p.x - (f.x / fl) * look, p.z - (f.z / fl) * look);
    }
    blockedByShadow = (throttle > 0 && !allowForward) || (throttle < 0 && !allowReverse);
    const headingIn = (s.speed > 0.2 && !allowForward) || (s.speed < -0.2 && !allowReverse);
    // The stop at the edge of permanent shadow is the no-lights lesson (once per mission).
    relate(onShadowStop({ hasLights: setup.hasLights, stopped: blockedByShadow || headingIn }));
    return (limits = { allowForward, allowReverse, speedFactor: Math.max(0.2, 1 - step.slip), hardStop: headingIn });
  };

  const warningText = (id: WarningId): string => {
    const w = text.warnings;
    if (id === 'steepSlope') return fill(w.steepSlope, { slope: Math.round(lastSample?.slopeDeg ?? 0), max: tuning.ground.maxSlopeDegrees });
    if (id === 'slip') return fill(w.slip, { slip: Math.round(lastSlip * 100) });
    if (id === 'poweredDown' && marsNow?.clock.isNight) return text.night?.sleeping ?? w.poweredDown;
    if (id === 'cold' && titan && titanNow) return titan.coldWarning(titanNow, state.poweredDown);
    return w[id];
  };

  const hintText = (): string | null => {
    if (state.using) return itx[state.using.instrument].holding ?? fill(ti.holding, { name: partOf(state.using.instrument).name });
    const zones = tracker?.currentZones() ?? [];
    if (aboard('xray') && currentBoulder()) return fill(ti.boulderHint, { key: keyOf('xray') });
    if (aboard('organics') && currentBoulder() && itx.organics.target) return fill(itx.organics.target, { key: keyOf('organics') });
    // A station aboard near the lander: said before it is set down, not after. A reflector without Earth
    // in view is refused outright instead (its Earth light says so), so it gets no too-close hint.
    if (roverTooClose()) {
      const station = instruments.find((i) => isStation(i) && aboard(i) && stationHint(costOf(i)?.needsEarth ?? false, earthAbove, true) === 'too-close');
      if (station) return fill(ti.stationTooCloseHint, { name: partOf(station).name, distance: mt.sampleMinDistanceM });
    }
    if (carries('camera')) {
      const key = keyOf('camera');
      const view = zones.find((z) => PHOTO_ZONE_IDS.includes(z.id));
      if (view) return fill(ti.viewpointHint, { name: view.name, key });
      // Mars: on a crater's rim, before Crater wall is earned.
      if (mars && text.hudMars && roverPos && tracker) {
        const wall = craterWallHint(tracker.craterWallsNear(roverPos).length > 0, true, tracker.has('crater-wall'), String(key), text.hudMars);
        if (wall) return wall;
      }
      if (sunInView && roverPos && ti.sunsetHint) {
        const sun = sunPhoto();
        if (sun && tracker?.sunsetBlocker(roverPos, { ...sun, inFrame: true }) === null) return fill(ti.sunsetHint, { key });
      }
      // Earth is in view from the landing at the start: near the lander there is no standing hint (the photo
      // would not count, and the notice saying why comes only when the player takes one).
      if (earthInView && roverPos && !tracker?.earthPhotoTooClose(roverPos)) {
        const lit = earthLit();
        return earthBlocker(roverPos, lit) ?? fill(ti.earthHint, { key });
      }
    }
    // The exact ice spot is never revealed: inside the dark crater the hint only invites a test drill.
    if (zones.some((z) => z.id === 'shadowed-crater')) {
      if (carries('drill')) return fill(ti.iceSearchHint, { key: keyOf('drill') });
      if (carries('neutron')) return ti.neutronHint;
    }
    return null;
  };

  let minimap: Minimap | null = null;
  // Sites appear on the map once discovered; leads point toward areas until then. Both start fresh on
  // every mission (map memory resets each try).
  let sites: Site[] = [];
  let leads: Lead[] = [];
  let frame = 0;
  /** A newly found site: on the map, with its notice (what the instruments aboard can do there). */
  const located = (site: Site) => {
    minimap?.includeSite(site);
    audio.discovered();
    hud.notify(foundNotice(site, instruments.filter(aboard), data), 'good');
  };
  /** The hidden sites (the Moon's hydrogen-rich ground, Mars's hydrated ground), revealed when their milestone is earned. */
  function revealHiddenSites(): void {
    for (const found of revealHidden(sites)) located(found);
  }
  /** Whether a site shows its check on the minimap (Mars: rules/siteChecks.ts marsSiteDone). */
  const isDone = (s: Site) => (mars
    ? marsSiteDone(s.kind, s.siteId, instruments, siteProgress, { rocks: presentRocks, craterWalls: craterWallSites(tracker?.zones ?? []) })
    : siteDone(s.kind, s.siteId, instruments, siteProgress, presentRocks));
  const onFrame = (f: { position: { x: number; z: number }; nearBoundary: boolean; forward: { x: number; z: number } }) => {
    nearBoundary = f.nearBoundary;
    hud.update({
      energy: state.energy,
      capacity: setup.stats.batteryCapacity,
      damage: state.damage / tuning.damage.max,
      freeze: state.freeze / tuning.cold.freezeMax,
      sunlight,
      poweredDown: state.poweredDown,
      ...(titan && titanNow ? { panelText: titan.panelLine(titanNow) } : {}),
    });
    if (mars && marsNow) {
      hud.setSol(mars.solLine(marsNow), ended ? null : mars.nightLine(marsNow, state.poweredDown));
      scene?.setStorm(marsNow.stormIntensity);
      scene?.setDustDevils(state.mars?.devils ?? []);
      // The truthful power line in place of the Moon's sunlight line (an RTG never reads "Solar panel in sunlight").
      const ht = text.hudMars;
      if (ht) {
        hud.setPowerLine(powerLine({
          solar: setup.stats.energyIncome > 0,
          steady: setup.power.steadyIncome > 0,
          sunlight,
          night: marsNow.clock.isNight,
          storm: marsNow.stormPhase === 'active',
          solarFactor: marsNow.solarFactor,
          dustFactor: marsNow.dustFactor,
        }, ht));
      }
      // No lights at night: the lesson shows with the HUD's no-lights warning.
      if (!ended) relate(onNightNoLights({ isNight: marsNow.clock.isNight, poweredDown: state.poweredDown, hasLights: setup.hasLights, canDrive: marsNow.canDrive }));
      audio.setWeather(ended ? 0 : marsNow.stormIntensity, 0);
    }
    if (titan && titanNow) {
      hud.setSol(titan.dayLine(titanNow), ended ? null : titan.nightLine(titanNow, state.poweredDown));
      hud.setBanner(ended ? null : titan.sleepBanner(titanNow, state.poweredDown));
      scene?.setStorm(titanNow.stormIntensity);
      audio.setWeather(0, ended ? 0 : titanNow.stormIntensity); // the methane rain
    }
    // On Mars and Titan the lights are on whenever the rover is awake at night (the rules drain the battery for it).
    scene?.setFloodlights(!ended && (dayNow() ? dayNow()!.lightsOn : !state.poweredDown && sunlight < 0.5));
    // Instrument readouts: the hydrogen meter only while the spectrometer is on and the rover powered up.
    // It samples at once when it turns on (no stale or zero reading), then every HYDROGEN_EVERY_FRAMES.
    const meterOn = !ended && !state.poweredDown && state.standbyOn.includes('neutron');
    if (!meterOn) {
      hydrogenCountdown = 0;
      hydrogen = 0;
    } else if (roverPos && --hydrogenCountdown <= 0) {
      hydrogenCountdown = HYDROGEN_EVERY_FRAMES;
      hydrogen = hydrogenReading(roverPos, lastSample?.inColdZone ?? false, zones, tuning.instruments.neutron, Math.random(), noisy);
      log.hydrogenPeak = Math.max(log.hydrogenPeak ?? 0, hydrogen);
    }
    hud.setHydrogen(meterOn ? hydrogen : null);
    // Mars instruments: the weather readout and the radar strip while switched on and powered up, the
    // laser's target while it is aboard, and a long hold's progress (a use charged as it runs).
    const live = (i: Instrument) => !ended && !state.poweredDown && state.standbyOn.includes(i);
    hud.setWeather(mars && live('weather') ? mars.weatherLine(state.seconds, setup) : null);
    // The weather mast's count toward Storm log and Night weather, paused near the lander.
    if (mars && marsNow && text.hudMars) {
      const ms = marsNow;
      const tr = tracker;
      hud.setRecording(live('weather') && tr ? weatherRecordingLine(weatherRecs.map((r) => ({
        ...r,
        active: r.event === 'duststorm' ? ms.stormPhase === 'active' : r.event === 'night' ? ms.clock.isNight : false,
        counted: tr.recordSecondsFor('weather', r.event),
        earned: tr.has(r.id),
      })), roverTooClose(), text.hudMars) : null);
    }
    const it = itx.radar; // absent on the Moon
    hud.setRadar(live('radar') ? radar.columns : null, it?.strip ? fill(it.strip, { meters: Math.round(radar.profileM) }) : '');
    laser = !ended && aboard('laser') ? currentLaserTarget() : null;
    if (mars) scene?.setLaserTarget(laser);
    const lt = itx.laser; // read only while a laser is aboard (Mars)
    hud.setLaserTarget(laser && lt.target ? fill(lt.target, {
      target: (laser.kind === 'cliff' ? lt.targetCliff : lt.targetBoulder) ?? laser.kind,
      distance: Math.round(laser.distanceM),
      key: keyOf('laser'),
    }) : null);
    const hold = state.using;
    if (!ended && hold?.chargePerSecond) {
      const total = hold.totalSeconds ?? costOf(hold.instrument)?.useSeconds ?? hold.secondsLeft;
      hud.setProgress(total > 0 ? 1 - hold.secondsLeft / total : 1, itx[hold.instrument].holding ?? partOf(hold.instrument).name);
    } else hud.setProgress(null);
    if (earthInSky && ctx && roverPos && frame % EARTH_CHECK_EVERY_FRAMES === 0) {
      earthAbove = ctx.horizonMarginTan(ctx.terrain, roverPos.x, roverPos.z, roverPos.y + ctx.groundEyeM, earthDir) > 0;
    }
    hud.setEarthLight(!ended && aboard('reflector') ? reflectorEarthLight(earthAbove, roverTooClose()) : null);
    for (const [inst, button] of instrumentButtons) {
      const on = !ended && state.standbyOn.includes(inst);
      button.classList.toggle('active', !ended && (state.using?.instrument === inst || on));
      if (button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', String(on));
    }
    if (ended) return;
    const flare = activeFlareWarning(state, setup);
    // Titan has no flares: the same bar counts down the methane rain forecast.
    const rain = titan && titanNow ? titan.forecast(titanNow, setup, state.seconds) : null;
    if (rain) hud.setFlareWarning(rain.message, rain.remaining);
    else hud.setFlareWarning(flare ? flareWarningText(flare.flare, text) : null, flare ? (flare.at - state.seconds) / (data.events.flare?.warningSeconds ?? 1) : 0);
    const ids = (lastSample ? missionWarnings(state, lastSample, lastSlip, blockedByShadow, setup, tuning) : [])
      // Titan: the sleep banner says it; the cold warning waits until the meter shows at least 1%.
      .filter((id) => !(titan && (id === 'poweredDown' || (id === 'cold' && Math.round((state.freeze / tuning.cold.freezeMax) * 100) < 1))));
    const noLights = mars && marsNow ? mars.noLightsWarning(marsNow, state.poweredDown, setup.hasLights)
      : titan && titanNow ? titan.noLightsWarning(titanNow, state.poweredDown, setup.hasLights) : null;
    hud.setWarnings([...(nearBoundary ? [text.mission.boundary] : []), ...(noLights ? [noLights] : []), ...ids.map(warningText)]);
    audio.warnings([...(nearBoundary ? ['boundary'] : []), ...(noLights ? ['noLights'] : []), ...ids]);
    if (carries('camera') && scene && frame % EARTH_CHECK_EVERY_FRAMES === 0) {
      if (earthInSky) earthInView = scene.inView(earthDir, mt.photoFrameMargin);
      if (mars) sunInView = scene.inView(sunNow(), mt.photoFrameMargin);
    }
    hud.setHint(hintText());
    const p = f.position;
    if (reveal(explored, p.x, p.z, tuning.explore.revealRadiusM) > 0) {
      minimap?.reveal(p.x, p.z, tuning.explore.revealRadiusM);
      for (const site of discover(sites, p, tuning.explore.revealRadiusM)) located(site);
    }
    if (minimap && frame++ % MINIMAP_EVERY_FRAMES === 0) {
      const rover = { x: p.x, z: p.z, headingX: f.forward.x, headingZ: f.forward.z };
      if (mars) {
        // Mars: lead arrows with distances, nearest first (ui/surveyText.ts leadView).
        const v = leadView(leads, p, data);
        minimap.draw(rover, sites, v.arrows, isDone);
        minimap.setLeads(v.lines, v.nearest);
      } else {
        const open = leads.map((l, i) => ({ l, i })).filter(({ l }) => !l.site.discovered);
        minimap.draw(rover, sites, open.map(({ l, i }) => ({ label: String(i + 1), azimuth: azimuthDeg(p, areaCenter(l.site.area)) })), isDone);
        minimap.setLeads(open.map(({ l, i }) => hudLeadLine(l, i, p, data)));
      }
    }
  };

  // Load three, Rapier and the terrain only when the mission starts, so the menus stay light.
  void Promise.all([import('../world/moonScene'), import('../world/terrainData'), import('../world/terrainMasks')])
    .then(async ([{ startMoonScene }, terrainData, { loadTerrainMasks }]) => {
      const [terrain, masks] = await Promise.all([terrainData.loadTerrain(game.world), loadTerrainMasks(tuning, game.world, data.sites.sites)]);
      if (disposed) return;
      ctx = { terrain, masks, sunVisibility: terrainData.sunVisibility, horizonMarginTan: terrainData.horizonMarginTan, groundEyeM: terrainData.GROUND_EYE_M };
      // The Moon's sites (sites.json, empty on Mars): their zones, boulders and the rolled boulder's track.
      siteList = resolveSites(data.sites.sites, masks.info.features as SiteFeatures);
      // Every boulder, rocky areas' first then the sites' (world/boulderList.ts; Mars keeps site boulders off
      // sand and steep ground). The scene draws this same list.
      boulders = worldBoulders(game.world, masks, siteList, tuning);
      floodSite = siteList.find((x) => x.kind === 'flood-boulder')?.id ?? null;
      presentRocks = siteRocks(boulders, tuning.instruments.xray, data.sites.sites);
      explored = createExplored(terrain.fine.extent * 2, tuning.explore);
      if (WORLDS[game.world].sky === 'mars') {
        const se = terrain.info.sunAndEarth;
        mars = new MarsMission(data, { latitudeDeg: se.siteLatitude_deg, longitudeDeg: se.siteLongitude_deg });
        setup = missionSetup(parts, tuning, setup.events, mars.setup(rng));
        marsNow = mars.status(state, setup);
      }
      if (WORLDS[game.world].sky === 'titan') {
        const se = terrain.info.sunAndEarth;
        titan = new TitanMission(data, { latitudeDeg: se.siteLatitude_deg, longitudeDeg: se.siteLongitude_deg });
        setup = missionSetup(parts, tuning, setup.events, undefined, titan.setup(rng));
        titanNow = titan.status(state, setup);
      }
      const relief = mars ? MARS_RELIEF : titan ? TITAN_RELIEF : undefined;
      minimap = new Minimap(terrain.fine, masks, terrain.fine.extent - tuning.area.boundaryInsetM, text, tuning.minimap, relief);
      sites = buildSites(masks.info.features, mt, text.survey.shadowedCraterName, siteList);
      leads = buildLeads(sites, tuning.survey);
      hud.root.append(minimap.root);
      const started = await startMoonScene({
        container: view,
        world: game.world,
        data,
        rover: roverParams(parts, tuning),
        parts,
        boulders,
        boulderTrack: siteList.find((x) => x.kind === 'rolled-boulder')?.track ?? null,
        lightRangeM: parts.reduce((m, p) => Math.max(m, p.effects.lightRange ?? 0), 0),
        ...(mars ? { sunAt: mars.sunAt } : {}),
        // Titan: the real Sun, and asleep at night the mission clock runs 4x (physics stays on wall time).
        ...(titan ? { sunAt: titan.sunAt, missionDelta: (dt: number, at: number) => titan!.missionDelta(dt, at, state.poweredDown && !ended) } : {}),
        onStep,
        onFrame: (s) => onFrame({ position: s.position, nearBoundary: s.nearBoundary, forward: s.forward }),
      });
      if (disposed) return started.dispose();
      scene = started;
      if (tutorial || notebook) scene.setPaused(true);
      status.textContent = '';
      const f = masks.info.features;
      cliffLine = f.deltaFront?.scarpLocal_xz ?? null;
      zones = buildZones({
        landing: { x: masks.info.landing.local.x, y: terrain.heightAt(masks.info.landing.local.x, masks.info.landing.local.z), z: masks.info.landing.local.z },
        rimViewpoints: f.rimViewpoints,
        rockyAreas: f.rockyAreas,
        shadowedCrater: f.shadowedCrater,
        craterDescent: f.craterDescent,
        deltaFront: f.deltaFront,
        seitah: f.seitah,
        viewpoints: f.viewpoints,
        youngCraters: f.youngCraters, // Mars: craters with a rim (Crater wall), Rocky area 2 among them
        duneCrests: f.duneCrests,
        interdunes: f.interdunes,
        samplePatch: f.samplePatch,
      }, mt, { sites: siteList, neutron: tuning.instruments.neutron });
      tracker = new MilestoneTracker(data.milestones.milestones, parts, zones, mt);
      announce(tracker.land());
    })
    .catch((err: unknown) => {
      if (!disposed) status.textContent = fill(text.mission.loadFailed, { error: String(err) });
    });

  // Development hooks for testing the mission systems (not in production builds).
  if (import.meta.env.DEV) {
    (window as unknown as { __mission?: unknown }).__mission = {
      seed,
      get setup() {
        return setup;
      },
      state: () => state,
      /** The round stats tally so far (lowest battery, peak cold, energy used, nights). */
      tally: () => tally,
      /** Mars: the sol clock, Sun, storm and night conditions now (null on the Moon). */
      mars: () => marsNow,
      /** Mars: move the dust storm so its forecast starts now (arrives a sol later). */
      stormSoon() {
        const m = setup.mars;
        if (!m?.storm) return;
        const lead = m.storm.startAt - m.storm.forecastAt;
        const length = m.storm.endAt - m.storm.startAt;
        m.storm = { forecastAt: state.seconds + 0.1, startAt: state.seconds + 0.1 + lead, endAt: state.seconds + 0.1 + lead + length };
      },
      instruments: () => ({ log, earthAbove, hydrogen, boulder: currentBoulder(), seismometer, radar, laser: currentLaserTarget(), using: state.using }),
      relationships: () => met,
      notebook: () => ({ open: notebook !== null, unread, atLaunch: notebookAtLaunch }),
      openNotebook: openNotes,
      /** Titan: the day clock, Sun, rain, cold and night conditions now (null elsewhere). */
      titan: () => titanNow,
      /** Titan: move the methane rain so its forecast starts now (the rain follows a minute later). */
      rainSoon() {
        const ti = setup.titan;
        if (!ti?.storm) return;
        const lead = ti.storm.startAt - ti.storm.forecastAt;
        const length = ti.storm.endAt - ti.storm.startAt;
        ti.storm = { forecastAt: state.seconds + 0.1, startAt: state.seconds + 0.1 + lead, endAt: state.seconds + 0.1 + lead + length };
      },
      /** Jump mission time (the rules and the scene's Sun) to `seconds`; edges inside the jump are skipped. */
      jumpTo(seconds: number) {
        state = { ...state, seconds };
        (window as unknown as { __moon?: { setTime(s: number): void } }).__moon?.setTime(seconds);
      },
      sample: () => ({ sample: lastSample, slip: lastSlip, sunlight, blockedByShadow, explored: exploredShare(explored), maxImpact }),
      /** Every survey site (name, kind, sites.json id, discovered, hidden, check shown), and the open leads. */
      survey: () => ({
        discovered: sites.filter((s) => s.discovered).map((s) => s.name),
        openLeads: leads.filter((l) => !l.site.discovered).map((l) => l.id),
        sites: sites.map((s) => ({ name: s.name, kind: s.kind, siteId: s.siteId, discovered: s.discovered, hidden: s.hidden ?? false, done: isDone(s) })),
      }),
      /**
       * Discover sites without driving there, hidden ones included: all, or those whose name, sites.json id
       * or kind matches. Each gets its notice and widens the map. Returns the names found.
       */
      discover(match?: string) {
        const hit = sites.filter((s) => !s.discovered && (!match || s.name === match || s.siteId === match || s.kind === match));
        for (const s of hit) {
          s.discovered = true;
          located(s);
        }
        return hit.map((s) => s.name);
      },
      /** What the site checks read (mutable: add a site id to a set to see its check), and each site's rock types. */
      siteProgress: () => ({ progress: siteProgress, rocks: presentRocks, surveyRun }),
      stationPending: () => stationPending,
      milestones: () => ({
        earned: tracker?.result() ?? [],
        zones: tracker?.currentZones().map((z) => z.key) ?? [],
        earthInView: earthInSky && (scene?.inView(earthDir, mt.photoFrameMargin) ?? false),
        sunInView,
        sunset: roverPos ? (() => { const sun = sunPhoto(); return sun ? { ...sun, blocker: tracker?.sunsetBlocker(roverPos!, sun) } : null; })() : null,
        earthLit: earthLit(),
        album: album.map((a) => a.caption),
        drilling: state.using?.instrument === 'drill' ? state.using.secondsLeft : 0,
        /** Mars: the weather mast's timed-record seconds, and the craters whose rim band holds the rover. */
        records: tracker ? { storm: tracker.recordSecondsFor('weather', 'duststorm'), night: tracker.recordSecondsFor('weather', 'night') } : null,
        craterWalls: tracker && roverPos ? tracker.craterWallsNear(roverPos).map((z) => z.key) : [],
      }),
      photo: takePhoto,
      drill: startDrill,
      boulders: () => boulders,
      /** The Moon's sites as placed (sites.json resolved on the terrain) and every zone with its key. */
      sites: () => siteList.map((x) => ({ id: x.id, kind: x.kind, center: x.center, radiusM: x.radiusM, track: x.track })),
      zones: () => zones.map((z) => ({ key: z.key, id: z.id, shape: z.shape })),
      /** The boulders a photo would show now (index, rolled), and whether the rover is in a cold zone. */
      framed: framedBoulders,
      cold: () => (ctx && roverPos ? ctx.masks.inColdZone(roverPos.x, roverPos.z) : null),
      use: useInstrument,
      resetMaxImpact() {
        maxImpact = 0;
      },
      set(patch: Partial<MissionState>) {
        state = { ...state, ...patch };
      },
      togglePower,
      /** Schedule a flare (warning now, hit after the warning time) or a quake (now). */
      inject(kind: 'flare' | 'quake') {
        if (!data.events[kind]) return;
        const at = state.seconds + (kind === 'flare' ? data.events.flare!.warningSeconds : 0.1);
        setup.events.push(kind === 'flare'
          ? { kind, at, warningAt: state.seconds, flare: data.events.flare!.realFlares[0]! }
          : { kind, at, warningAt: at });
        state = { ...state, eventStages: [...state.eventStages, 'pending'] };
      },
    };
  }

  root.append(view, hud.root);
  if (!game.tutorialSeen.drive) openHelp();

  return () => {
    disposed = true;
    tutorial?.dispose();
    notebook?.dispose();
    window.removeEventListener('keydown', onKey);
    audio.dispose();
    stopListening();
    scene?.dispose();
    if (import.meta.env.DEV) delete (window as unknown as { __mission?: unknown }).__mission;
  };
};
