// Mission screen: the drivable Moon plus the mission systems. Each physics step it measures the
// rover, calls the rules (rules/mission.ts) and applies what they allow; each frame it draws the HUD
// and minimap. The mission ends at 5 minutes or on one of the four deaths, then goes to the debrief.
import type { AlbumPhoto, Screen } from '../flow/flow';
import type { MissionResult } from '../rules/payout';
import { buildZones, hydrogenSignal, MilestoneTracker, type MilestoneUpdate, type Point3 } from '../rules/milestones';
import { selectedParts } from '../rules/rover';
import { roverParams } from '../rules/drive';
import { earthLitShare, gameDaysElapsed, skyDirection, sunAt } from '../rules/sun';
import { scheduleEvents, seededRng } from '../rules/events';
import { softnessAt } from '../rules/ground';
import { noLightsLookaheadM } from '../rules/cold';
import { createExplored, exploredShare, reveal } from '../rules/explore';
import {
  activeFlareWarning, missionSetup, missionWarnings, startMission, stepMission,
  type MissionEnd, type MissionSample, type MissionState, type WarningId,
} from '../rules/mission';
import type { MoonDriveLimits, MoonScene, MoonStepSample } from '../world/moonScene';
import type { Terrain } from '../world/terrainData';
import type { TerrainMasks } from '../world/terrainMasks';
import { flareWarningText, noticeText } from '../events';
import { el, fill } from './dom';
import { Hud } from './hud';
import { Minimap } from './minimap';
import { causeText, milestoneCard, missedText } from './milestoneText';
import { openTutorial, type TutorialHandle } from './tutorial';
import { tutorialPages } from './tutorialText';

const DEG = 180 / Math.PI;
const SUN_SAMPLE_STEPS = 12; // recompute sunlight at the rover every 12 physics steps (0.2 s)
const MAX_STEP_DISTANCE_M = 5; // a larger jump is a teleport, not driving
const GRADE_PROBE_M = 2;
const MINIMAP_EVERY_FRAMES = 3;
const EARTH_CHECK_EVERY_FRAMES = 10;
const PHOTO_WIDTH_PX = 960;

export const missionScreen: Screen = (game, root) => {
  const { data } = game;
  const { tuning, text } = data;
  const view = el('div', { class: 'mission-view' });
  const status = el('div', { class: 'status' }, text.mission.loading);
  let disposed = false;
  let scene: MoonScene | null = null;

  // Mission state
  const parts = selectedParts(game.build, data.parts);
  const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
  const setup = missionSetup(parts, tuning, scheduleEvents(data.events, seededRng(seed)));
  let state: MissionState = startMission(setup);
  let ended: MissionEnd | null = null;
  const explored = createExplored(8000, tuning.explore);
  const mt = tuning.milestones;
  const instrument = parts.find((p) => p.slot === 'instrument')?.effects.instrument ?? null;
  const recordsHeld = [...game.state.records];
  const earthDir = skyDirection(tuning.earth.azimuthDeg, tuning.earth.elevationDeg);
  let tracker: MilestoneTracker | null = null;
  const album: AlbumPhoto[] = [];
  let drillLeft = 0; // mission seconds of drilling left (0 = not drilling)
  let earthInView = false;
  let roverPos: Point3 | null = null; // ground point under the rover after the last step

  // What the last step measured
  let ctx: { terrain: Terrain; masks: TerrainMasks; sunVisibility: typeof import('../world/terrainData').sunVisibility } | null = null;
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
  const td = text.drill;
  let hydrogenFactShown = false; // the real-world note on the hydrogen signal shows once per mission
  const controls = [text.mission.controls, instrument === 'camera' ? ti.cameraControls : instrument === 'drill' ? ti.drillControls : '']
    .filter(Boolean).join(' ');
  // Drive tutorial: opens by itself on the first mission (the scene loads meanwhile); the Help button
  // reopens it. The mission is paused while it is open.
  let tutorial: TutorialHandle | null = null;
  const openHelp = () => {
    if (tutorial || ended) return;
    const pages = tutorialPages('drive', data, { mission: game.state.mission, instrument });
    tutorial = openTutorial(root, 'drive', pages, text.tutorial, () => {
      tutorial = null;
      scene?.setPaused(false);
      game.markTutorialSeen('drive');
    });
    scene?.setPaused(true);
  };
  const help = el('button', {
    type: 'button',
    class: 'help-button',
    id: 'tutorial-help-drive',
    title: text.tutorial.helpDrive,
    onclick: openHelp,
  }, text.tutorial.help);
  const hud = new Hud(text, togglePower, el('div', { class: 'hud-extra' },
    el('p', { class: 'muted' }, controls),
    status,
    el('div', { class: 'hud-help' }, help),
  ));

  const announce = (u: MilestoneUpdate) => {
    for (const r of u.reached) hud.milestone(milestoneCard(r, data, game.settings.missionHistory, recordsHeld));
    for (const m of u.missed) hud.notify(missedText(m, text));
  };
  const dayText = () => gameDaysElapsed(state.seconds, tuning.mission).toFixed(1);
  const sunNow = () => {
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

  const takePhoto = () => {
    if (ended || !scene || !tracker || !roverPos) return;
    if (instrument !== 'camera') return hud.notify(ti.noCamera);
    if (album.length >= mt.albumMax) return hud.notify(fill(ti.photoAlbumFull, { max: mt.albumMax }));
    const earth = scene.inView(earthDir, mt.photoFrameMargin);
    const lit = earthLit();
    const u = tracker.photo(roverPos, earth, lit);
    const places = tracker.zones
      .filter((z) => (z.id === 'rim-viewpoint' || z.id === 'crater-wall') && tracker!.currentZones().includes(z))
      .map((z) => z.name);
    if (earth) places.push(ti.captionEarth);
    const caption = fill(ti.captionDay, { place: places.length ? places.join(', ') : ti.captionSurface, day: dayText() });
    album.push({ src: scene.capture(PHOTO_WIDTH_PX), caption });
    hud.notify(places.length ? fill(ti.photoTaken, { caption }) : ti.photoNoZone, 'good');
    const blocker = earth ? earthBlocker(roverPos, lit) : null;
    if (blocker) hud.notify(blocker);
    announce(u);
  };

  const startDrill = () => {
    if (ended || drillLeft > 0) return;
    if (instrument !== 'drill') return hud.notify(ti.noDrill);
    if (state.poweredDown) return hud.notify(text.warnings.poweredDown);
    if ((lastSample?.speedMps ?? 0) > tuning.ground.movingSpeedMps) return hud.notify(ti.drillMoving);
    drillLeft = mt.drillSeconds;
  };

  const finishDrill = () => {
    if (!tracker || !roverPos) return;
    const zones = tracker.zones.filter((z) => tracker!.currentZones().includes(z)).map((z) => z.id);
    const u = tracker.drill(roverPos);
    if (zones.includes('near-lander')) hud.notify(fill(ti.drillNearLander, { distance: mt.sampleMinDistanceM }));
    else {
      const result = zones.includes('ice-spot') ? ti.drillIce : zones.includes('shadowed-crater') ? ti.drillNoIce : ti.drillDone;
      // In the dark crater each sample also reads the hydrogen signal, a clue to where the ice is.
      const level = hydrogenSignal(roverPos, tracker.zones, mt);
      const levelWord = level === 'strong' ? td.hydrogenStrong : level === 'moderate' ? td.hydrogenModerate : td.hydrogenWeak;
      hud.notify(level ? `${result} ${fill(td.hydrogenSignal, { level: levelWord })}` : result, 'good');
      if (level && game.settings.missionHistory && !hydrogenFactShown) {
        hydrogenFactShown = true;
        hud.notify(td.hydrogenHistory, 'good');
      }
    }
    announce(u);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || tutorial) return;
    if (e.code === 'KeyP') togglePower();
    if (e.code === 'KeyC') takePhoto();
    if (e.code === 'KeyF') startDrill();
  };
  window.addEventListener('keydown', onKey);

  const finish = (end: MissionEnd) => {
    ended = end;
    drillLeft = 0;
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
    };
    hud.showEnd(lines, () => game.endMission(result, album));
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
    const canDrive = !ended && !state.poweredDown;
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
      if (n.kind === 'quake') scene?.shake(data.events.quake.shakeSeconds);
      if (n.kind === 'flare-hit' && !n.protected) hud.flashScreen();
      const msg = noticeText(n, text);
      if (msg) hud.notify(msg.message, msg.tone);
    }
    if (!ended && tracker) {
      roverPos = { x: p.x, y: terrain.heightAt(p.x, p.z), z: p.z };
      announce(tracker.step({
        position: roverPos,
        distanceM: state.distanceM,
        exploredShare: exploredShare(explored),
        flareSurvived: step.notices.some((n) => n.kind === 'flare-hit' && n.protected),
      }));
      if (drillLeft > 0) {
        drillLeft = Math.max(0, drillLeft - s.dt);
        if (drillLeft === 0 && !state.end) finishDrill();
      }
    }
    if (state.end && !ended) finish(state.end);

    // What the rover may do next step.
    if (ended || state.poweredDown || drillLeft > 0) {
      blockedByShadow = false;
      return (limits = { allowForward: false, allowReverse: false, speedFactor: 1, hardStop: drillLeft > 0 });
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
    return (limits = { allowForward, allowReverse, speedFactor: Math.max(0.2, 1 - step.slip), hardStop: headingIn });
  };

  const warningText = (id: WarningId): string => {
    const w = text.warnings;
    if (id === 'steepSlope') return fill(w.steepSlope, { slope: Math.round(lastSample?.slopeDeg ?? 0), max: tuning.ground.maxSlopeDegrees });
    if (id === 'slip') return fill(w.slip, { slip: Math.round(lastSlip * 100) });
    return w[id];
  };

  const hintText = (): string | null => {
    if (drillLeft > 0) return ti.drilling;
    const zones = tracker?.currentZones() ?? [];
    if (instrument === 'camera') {
      const view = zones.find((z) => z.id === 'rim-viewpoint' || z.id === 'crater-wall');
      if (view) return fill(ti.viewpointHint, { name: view.name });
      if (earthInView) {
        const lit = earthLit();
        return (roverPos && earthBlocker(roverPos, lit)) ?? ti.earthHint;
      }
    }
    // The exact ice spot is never revealed: inside the dark crater the hint only invites a test drill.
    if (instrument === 'drill' && zones.some((z) => z.id === 'shadowed-crater')) return mt.hydrogenSignal ? td.searchHintHydrogen : ti.iceSearchHint;
    return null;
  };

  let minimap: Minimap | null = null;
  let frame = 0;
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
    scene?.setFloodlights(!ended && !state.poweredDown && sunlight < 0.5);
    if (ended) return;
    const flare = activeFlareWarning(state, setup);
    hud.setFlareWarning(flare ? flareWarningText(flare.flare, text) : null, flare ? (flare.at - state.seconds) / data.events.flare.warningSeconds : 0);
    const ids = lastSample ? missionWarnings(state, lastSample, lastSlip, blockedByShadow, setup, tuning) : [];
    hud.setWarnings([...(nearBoundary ? [text.mission.boundary] : []), ...ids.map(warningText)]);
    if (instrument === 'camera' && scene && frame % EARTH_CHECK_EVERY_FRAMES === 0) earthInView = scene.inView(earthDir, mt.photoFrameMargin);
    hud.setHint(hintText());
    if (reveal(explored, f.position.x, f.position.z, tuning.explore.revealRadiusM) > 0) {
      minimap?.reveal(f.position.x, f.position.z, tuning.explore.revealRadiusM);
    }
    if (minimap && frame++ % MINIMAP_EVERY_FRAMES === 0) {
      minimap.draw({ x: f.position.x, z: f.position.z, headingX: f.forward.x, headingZ: f.forward.z });
    }
  };

  // Load three, Rapier and the terrain only when the mission starts, so the menus stay light.
  void Promise.all([import('../world/moonScene'), import('../world/terrainData'), import('../world/terrainMasks')])
    .then(async ([{ startMoonScene }, terrainData, { loadTerrainMasks }]) => {
      const [terrain, masks] = await Promise.all([terrainData.loadTerrain(), loadTerrainMasks(tuning)]);
      if (disposed) return;
      ctx = { terrain, masks, sunVisibility: terrainData.sunVisibility };
      minimap = new Minimap(terrain.fine, masks, terrain.fine.extent - tuning.area.boundaryInsetM, text);
      hud.root.append(minimap.root);
      const started = await startMoonScene({
        container: view,
        data,
        rover: roverParams(parts, tuning),
        parts,
        boulderAreas: masks.softAreas,
        lightRangeM: parts.reduce((m, p) => Math.max(m, p.effects.lightRange ?? 0), 0),
        onStep,
        onFrame: (s) => onFrame({ position: s.position, nearBoundary: s.nearBoundary, forward: s.forward }),
      });
      if (disposed) return started.dispose();
      scene = started;
      if (tutorial) scene.setPaused(true);
      status.textContent = '';
      const f = masks.info.features;
      tracker = new MilestoneTracker(data.milestones.milestones, parts, buildZones({
        landing: { x: masks.info.landing.local.x, y: terrain.heightAt(masks.info.landing.local.x, masks.info.landing.local.z), z: masks.info.landing.local.z },
        rimViewpoints: f.rimViewpoints,
        rockyAreas: f.rockyAreas,
        shadowedCrater: f.shadowedCrater,
        craterDescent: f.craterDescent,
      }, mt), mt);
      announce(tracker.land());
    })
    .catch((err: unknown) => {
      if (!disposed) status.textContent = `The Moon failed to load: ${String(err)}`;
    });

  // Development hooks for testing the mission systems (not in production builds).
  if (import.meta.env.DEV) {
    (window as unknown as { __mission?: unknown }).__mission = {
      seed,
      setup,
      state: () => state,
      sample: () => ({ sample: lastSample, slip: lastSlip, sunlight, blockedByShadow, explored: exploredShare(explored), maxImpact }),
      milestones: () => ({
        earned: tracker?.result() ?? [],
        zones: tracker?.currentZones().map((z) => z.key) ?? [],
        earthInView: scene?.inView(earthDir, mt.photoFrameMargin) ?? false,
        earthLit: earthLit(),
        album: album.map((a) => a.caption),
        drilling: drillLeft,
      }),
      photo: takePhoto,
      drill: startDrill,
      resetMaxImpact() {
        maxImpact = 0;
      },
      set(patch: Partial<MissionState>) {
        state = { ...state, ...patch };
      },
      togglePower,
      /** Schedule a flare (warning now, hit after the warning time) or a quake (now). */
      inject(kind: 'flare' | 'quake') {
        const at = state.seconds + (kind === 'flare' ? data.events.flare.warningSeconds : 0.1);
        setup.events.push(kind === 'flare'
          ? { kind, at, warningAt: state.seconds, flare: data.events.flare.realFlares[0]! }
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
    window.removeEventListener('keydown', onKey);
    scene?.dispose();
    if (import.meta.env.DEV) delete (window as unknown as { __mission?: unknown }).__mission;
  };
};
