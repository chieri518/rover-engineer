// Mission screen: the drivable world plus the mission systems. Each physics step it measures the
// rover, calls the rules (rules/mission.ts) and applies what they allow; each frame it draws the HUD
// and minimap. The mission ends at its length or on one of the deaths, then goes to the debrief.
// Mars adds the sol clock, the real Sun, night (lights on or sleep) and the dust storm (ui/marsMission.ts).
import type { AlbumPhoto, Screen } from '../flow/flow';
import type { MissionResult } from '../rules/payout';
import { buildZones, MilestoneTracker, PHOTO_ZONE_IDS, type FramedBoulder, type MilestoneUpdate, type Point3, type SunPhoto, type Zone } from '../rules/milestones';
import { isCompleteBuild, selectedParts } from '../rules/rover';
import { instrumentForKey, instrumentKeys, instrumentsOf } from '../rules/payload';
import type { Instrument } from '../rules/types';
import { scatterBoulders, scatterSiteBoulders, type Boulder } from '../rules/boulders';
import { resolveSites, type ResolvedSite, type SiteFeatures } from '../rules/sites';
import {
  emptyInstrumentLog, emptySeismometerTrack, hydrogenReading, reflectorEarthLight, rockTypeFor, rockTypeTotal, stationHint, stationPress, stationTooClose,
  stepSeismometer, xrayTarget, type InstrumentLog, type SeismometerOutcome, type StationPending, type TrackPoint,
} from '../rules/instruments';
import { emptySiteProgress, noteReading, siteDone, siteRocks, stepSurveyRun, type SurveyRun } from '../rules/siteChecks';
import {
  addToNotebook, lessonFor, meet, metIds, onSeismometer, onShadowStop, onUseDone, onUseStart, relationshipEntry, shortUseLines, type RelationshipEvent,
} from '../rules/relationships';
import { roverParams } from '../rules/drive';
import { earthLitShare, gameDaysElapsed, skyDirection, sunAt } from '../rules/sun';
import { scheduleEvents, seededRng } from '../rules/events';
import { softnessAt } from '../rules/ground';
import { noLightsLookaheadM } from '../rules/cold';
import { createExplored, exploredShare, reveal } from '../rules/explore';
import { azimuthDeg, areaCenter, buildLeads, buildSites, discover, revealSite, type Lead, type Site } from '../rules/survey';
import {
  activeFlareWarning, deployPart, isSwitchInstrument, missionSetup, missionWarnings, partsAboard, setStandby, startInstrumentUse, startMission, stepMission,
  type InstrumentRefusal, type MarsStatus, type MissionEnd, type MissionSample, type MissionSetup, type MissionState, type UseSite, type WarningId,
} from '../rules/mission';
import { WORLDS } from '../worlds';
import type { MoonDriveLimits, MoonScene, MoonStepSample } from '../world/moonScene';
import type { Terrain } from '../world/terrainData';
import type { TerrainMasks } from '../world/terrainMasks';
import { flareWarningText, noticeText } from '../events';
import { el, fill } from './dom';
import { Hud } from './hud';
import { MARS_RELIEF, Minimap } from './minimap';
import { foundNotice, hudLeadLine } from './surveyText';
import { causeText, milestoneCard, missedText } from './milestoneText';
import { openTutorial, type TutorialHandle } from './tutorial';
import { openNotebook, type NotebookHandle } from './notebook';
import { tutorialPages } from './tutorialText';
import { MarsMission } from './marsMission';

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
  if (!isCompleteBuild(game.build, data.parts)) throw new Error('the mission needs a complete rover');
  const parts = selectedParts(game.build, data.parts);
  const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
  const rng = seededRng(seed);
  // The setup changes when a station is set down (lighter rover, fewer instruments aboard), and on Mars
  // it gains the site and the dust storm once the terrain (and its latitude) has loaded.
  let setup: MissionSetup = missionSetup(parts, tuning, scheduleEvents(data.events, rng));
  let state: MissionState = startMission(setup);
  let ended: MissionEnd | null = null;
  let explored = createExplored(8000, tuning.explore); // resized to the terrain once it loads
  const earthInSky = WORLDS[game.world].earthInSky;
  let mars: MarsMission | null = null; // Mars only, once the terrain has loaded
  let marsNow: MarsStatus | null = null; // the Mars conditions after the last step
  let sunInView = false; // Mars: the Sun is in frame and above the terrain horizon
  const mt = tuning.milestones;
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
  let siteList: ResolvedSite[] = []; // the Moon's sites.json sites on the map (none on Mars)
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

  const togglePower = () => {
    if (ended) return;
    state = { ...state, poweredDown: !state.poweredDown };
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
  const relate = (events: RelationshipEvent[], vars: Record<string, string | number> = {}): RelationshipEvent[] => {
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
    scene?.setPaused(on);
    hud.setPaused(on);
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
  ));

  const announce = (u: MilestoneUpdate) => {
    for (const r of u.reached) {
      hud.milestone(milestoneCard(r, data, game.settings.missionHistory, recordsHeld));
      // Hidden hydrogen: the only way its site appears on the map.
      const tr = r.milestone.trigger;
      if (tr.type === 'transect' && tr.zone === 'hydrogen-anomaly') revealHiddenSites();
    }
    for (const m of u.missed) hud.notify(missedText(m, text));
    if (u.partialCrossings.length) hud.notify(fill(ti.partialCrossingHint, { angle: mt.boulderCrossMinAngleDeg }));
  };
  const dayText = () => (marsNow ? String(marsNow.clock.sol) : gameDaysElapsed(state.seconds, tuning.mission).toFixed(1));
  const sunNow = () => {
    if (mars) return mars.sunAt(sceneSeconds);
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
        return fill(ti.useNoBoulder, { name, reach: tuning.instruments.xray.reachM });
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
    }
  };
  /** The rules' answer to a use now, without applying it. */
  const startUse = (inst: Instrument) =>
    startInstrumentUse(state, inst, {
      speedMps: lastSample?.speedMps ?? 0,
      inColdZone: lastSample?.inColdZone ?? false,
      sunlight,
      earthInView: earthAbove,
      boulderInReach: currentBoulder() !== null,
      boulder: currentBoulder()?.index ?? null, // an X-ray reading keeps this boulder even if the rover is nudged
      inDarkCrater: inDarkCrater(),
    }, setup, tuning);
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
      return false;
    }
    state = r.state;
    // The first time in a mission, the relationship's notice explains it; later uses get the short line.
    const lines = shortUseLines(r, relate(onUseStart(r)));
    const said = { name: partOf(inst).name, seconds: Math.round(r.holdSeconds) };
    if (lines.slowCold) hud.notify(fill(ti.useSlowCold, said));
    if (lines.fastShadow) hud.notify(fill(ti.useFastShadow, said), 'good');
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
  /** The boulder within the X-ray spectrometer's reach, if any. */
  const currentBoulder = () => (roverPos ? xrayTarget(roverPos, boulders, tuning.instruments.xray) : null);
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
    const framed = framedBoulders();
    const u = tracker.photo(roverPos, earth, lit, sun, framed);
    // The rolled boulder's check: in frame within the Boulder track range (as the tracker's photo rule).
    for (const b of framed) {
      const site = boulders[b.index]?.site;
      if (b.rolled && site && Math.hypot(b.x - roverPos.x, b.z - roverPos.z) <= mt.boulderTrackPhotoRangeM) siteProgress.photographed.add(site);
    }
    const places = tracker.zones
      .filter((z) => PHOTO_ZONE_IDS.includes(z.id) && tracker!.currentZones().includes(z))
      .map((z) => z.name);
    if (earth) places.push(ti.captionEarth);
    const sunset = sun ? tracker.sunsetBlocker(roverPos, sun) : 'not-in-frame';
    if (sunset === null && ti.captionSunset) places.push(ti.captionSunset);
    const caption = fill(ti.captionDay, { place: places.length ? places.join(', ') : ti.captionSurface, day: dayText() });
    album.push({ src: scene.capture(PHOTO_WIDTH_PX), caption });
    hud.notify(places.length ? fill(ti.photoTaken, { caption }) : ti.photoNoZone, 'good');
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
      for (const z of tracker.currentZones()) if (z.id === 'young-crater' && z.site) siteProgress.drilled.add(z.site);
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
    hud.notify(newType && rockTypes > 0 ? [said, fill(ti.xrayNewType, { count, total: rockTypes })] : said, 'good');
    // Rock collection, Rare rock, and the boulder Documented sample photographs.
    if (tracker && roverPos) announce(tracker.reading('xray', roverPos, { target: 'boulder', rock: id, boulder: index }));
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
      return;
    }
    state = r.state;
    autoOff.delete(inst); // the player's own switch: on continues a paused count, off ends it
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
    const inst = instrumentForKey(e.code, parts);
    if (inst) useInstrument(inst);
  };
  window.addEventListener('keydown', onKey);

  const finish = (end: MissionEnd) => {
    ended = end;
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
    const canDrive = !ended && (mars ? mars.status(state, setup).canDrive : !state.poweredDown);
    const sample: MissionSample = {
      dt: s.dt,
      distanceM: distance,
      speedMps: Math.abs(s.speed),
      uphillDeg,
      slopeDeg: masks.slopeAt(p.x, p.z),
      sunlight,
      inColdZone,
      softness: softnessAt(p.x, p.z, masks.softAreas, tuning.ground),
      throttling: canDrive && ((throttle > 0 && limits.allowForward) || (throttle < 0 && limits.allowReverse)),
      impactMps: s.deltaV,
      upY: s.upY,
    };
    const step = stepMission(state, sample, setup, tuning, data.events);
    state = step.state;
    lastSample = sample;
    lastSlip = step.slip;
    maxImpact = Math.max(maxImpact, s.deltaV);
    for (const n of step.notices) {
      if (n.kind === 'quake') scene?.shake(data.events.quake?.shakeSeconds ?? 0);
      if (n.kind === 'standby-off') {
        for (const i of n.instruments) autoOff.add(i);
        hud.notify(fill(ti.standbyAutoOff, { names: n.instruments.map((i) => partOf(i).name).join(text.ticket.and) }));
      }
      if (n.kind === 'flare-hit' && !n.protected) hud.flashScreen();
      const msg = noticeText(n, text);
      if (msg) hud.notify(msg.message, msg.tone);
    }
    if (mars) {
      marsNow = mars.status(state, setup);
      for (const n of step.marsNotices) {
        const msg = mars.noticeText(n, setup.hasLights);
        hud.notify(msg.message, msg.tone);
      }
    }
    if (!ended && tracker) {
      roverPos = { x: p.x, y: terrain.heightAt(p.x, p.z), z: p.z };
      announce(tracker.step({
        position: roverPos,
        distanceM: state.distanceM,
        exploredShare: exploredShare(explored),
        flareSurvived: step.notices.some((n) => n.kind === 'flare-hit' && n.protected),
        switchedOn: state.standbyOn, // the neutron spectrometer's transects
        poweredDown: state.poweredDown,
        autoOff: [...autoOff],
        ...(marsNow ? { night: marsNow.clock.isNight, stormActive: marsNow.stormPhase === 'active' } : {}),
      }));
      // The cold trap checks: the same switched-on drive as the tracker's Cold trap survey.
      const here = tracker.currentZones().flatMap((z) => (z.id === 'cold-trap' && z.site ? [z.site] : []));
      const run = stepSurveyRun(surveyRun, {
        on: state.standbyOn.includes('neutron'),
        poweredDown: state.poweredDown,
        drivenM: Math.max(0, state.distanceM - lastOdometerM),
        here,
        autoOff: autoOff.has('neutron'),
      }, coldTrapSurveyM);
      lastOdometerM = state.distanceM;
      surveyRun = run.run;
      for (const id of run.surveyed) siteProgress.surveyed.add(id);
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
    // Mars: no driving at night without lights (marsNow.canDrive also covers sleep).
    const holding = state.using !== null;
    if (ended || state.poweredDown || holding || (marsNow && !marsNow.canDrive)) {
      blockedByShadow = false;
      return (limits = { allowForward: false, allowReverse: false, speedFactor: 1, hardStop: holding });
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
    return w[id];
  };

  const hintText = (): string | null => {
    if (state.using) return itx[state.using.instrument].holding ?? fill(ti.holding, { name: partOf(state.using.instrument).name });
    const zones = tracker?.currentZones() ?? [];
    if (aboard('xray') && currentBoulder()) return fill(ti.boulderHint, { key: keyOf('xray') });
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
      if (sunInView && roverPos && ti.sunsetHint) {
        const sun = sunPhoto();
        if (sun && tracker?.sunsetBlocker(roverPos, { ...sun, inFrame: true }) === null) return fill(ti.sunsetHint, { key });
      }
      if (earthInView) {
        const lit = earthLit();
        return (roverPos && earthBlocker(roverPos, lit)) ?? fill(ti.earthHint, { key });
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
    hud.notify(foundNotice(site, instruments.filter(aboard), data), 'good');
  };
  /** The hidden sites (the hydrogen-rich ground), revealed when their milestone is earned. */
  function revealHiddenSites(): void {
    for (const s of sites) {
      const found = s.hidden && s.siteId ? revealSite(sites, s.siteId) : null;
      if (found) located(found);
    }
  }
  /** Whether a site shows its check on the minimap. */
  const isDone = (s: Site) => siteDone(s.kind, s.siteId, instruments, siteProgress, presentRocks);
  const onFrame = (f: { position: { x: number; z: number }; nearBoundary: boolean; forward: { x: number; z: number } }) => {
    nearBoundary = f.nearBoundary;
    hud.update({
      energy: state.energy,
      capacity: setup.stats.batteryCapacity,
      damage: state.damage / tuning.damage.max,
      freeze: state.freeze / tuning.cold.freezeMax,
      sunlight,
      poweredDown: state.poweredDown,
    });
    if (mars && marsNow) {
      hud.setSol(mars.solLine(marsNow), ended ? null : mars.nightLine(marsNow, state.poweredDown));
      scene?.setStorm(marsNow.stormIntensity);
    }
    // On Mars the lights are on whenever the rover is awake at night (the rules drain the battery for it).
    scene?.setFloodlights(!ended && (marsNow ? marsNow.lightsOn : !state.poweredDown && sunlight < 0.5));
    // Instrument readouts: the hydrogen meter only while the spectrometer is on and the rover powered up.
    // It samples at once when it turns on (no stale or zero reading), then every HYDROGEN_EVERY_FRAMES.
    const meterOn = !ended && !state.poweredDown && state.standbyOn.includes('neutron');
    if (!meterOn) {
      hydrogenCountdown = 0;
      hydrogen = 0;
    } else if (roverPos && --hydrogenCountdown <= 0) {
      hydrogenCountdown = HYDROGEN_EVERY_FRAMES;
      hydrogen = hydrogenReading(roverPos, lastSample?.inColdZone ?? false, zones, tuning.instruments.neutron, Math.random());
      log.hydrogenPeak = Math.max(log.hydrogenPeak ?? 0, hydrogen);
    }
    hud.setHydrogen(meterOn ? hydrogen : null);
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
    hud.setFlareWarning(flare ? flareWarningText(flare.flare, text) : null, flare ? (flare.at - state.seconds) / (data.events.flare?.warningSeconds ?? 1) : 0);
    const ids = lastSample ? missionWarnings(state, lastSample, lastSlip, blockedByShadow, setup, tuning) : [];
    const noLights = mars && marsNow ? mars.noLightsWarning(marsNow, state.poweredDown, setup.hasLights) : null;
    hud.setWarnings([...(nearBoundary ? [text.mission.boundary] : []), ...(noLights ? [noLights] : []), ...ids.map(warningText)]);
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
      const open = leads.map((l, i) => ({ l, i })).filter(({ l }) => !l.site.discovered);
      minimap.draw(
        { x: p.x, z: p.z, headingX: f.forward.x, headingZ: f.forward.z },
        sites,
        open.map(({ l, i }) => ({ label: String(i + 1), azimuth: azimuthDeg(p, areaCenter(l.site.area)) })),
        isDone,
      );
      minimap.setLeads(open.map(({ l, i }) => hudLeadLine(l, i, p, data)));
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
      // A rocky area's boulders belong to its site (same center), which picks their rock suite.
      const rockySite = (a: { x: number; z: number }) => {
        const r = siteList.find((x) => x.kind === 'rocky-area' && Math.hypot(x.center.x - a.x, x.center.z - a.z) < 1);
        return r ? { site: r.id } : {};
      };
      // Rocky-area boulders first (their scatter order and places stay), then the young craters' and the
      // rolled boulder. The scene draws this same list.
      boulders = [
        ...scatterBoulders(masks.boulderAreas.map((a) => ({ ...a, ...rockySite(a) })), tuning.boulders),
        ...scatterSiteBoulders(siteList, tuning.boulders),
      ];
      presentRocks = siteRocks(boulders, tuning.instruments.xray, data.sites.sites);
      explored = createExplored(terrain.fine.extent * 2, tuning.explore);
      if (WORLDS[game.world].sky === 'mars') {
        const se = terrain.info.sunAndEarth;
        mars = new MarsMission(data, { latitudeDeg: se.siteLatitude_deg, longitudeDeg: se.siteLongitude_deg });
        setup = missionSetup(parts, tuning, setup.events, mars.setup(rng));
        marsNow = mars.status(state, setup);
      }
      minimap = new Minimap(terrain.fine, masks, terrain.fine.extent - tuning.area.boundaryInsetM, text, tuning.minimap, mars ? MARS_RELIEF : undefined);
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
        onStep,
        onFrame: (s) => onFrame({ position: s.position, nearBoundary: s.nearBoundary, forward: s.forward }),
      });
      if (disposed) return started.dispose();
      scene = started;
      if (tutorial || notebook) scene.setPaused(true);
      status.textContent = '';
      const f = masks.info.features;
      zones = buildZones({
        landing: { x: masks.info.landing.local.x, y: terrain.heightAt(masks.info.landing.local.x, masks.info.landing.local.z), z: masks.info.landing.local.z },
        rimViewpoints: f.rimViewpoints,
        rockyAreas: f.rockyAreas,
        shadowedCrater: f.shadowedCrater,
        craterDescent: f.craterDescent,
        deltaFront: f.deltaFront,
        seitah: f.seitah,
        viewpoints: f.viewpoints,
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
      instruments: () => ({ log, earthAbove, hydrogen, boulder: currentBoulder(), seismometer }),
      relationships: () => met,
      notebook: () => ({ open: notebook !== null, unread, atLaunch: notebookAtLaunch }),
      openNotebook: openNotes,
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
    scene?.dispose();
    if (import.meta.env.DEV) delete (window as unknown as { __mission?: unknown }).__mission;
  };
};
