// Mission screen: the drivable Moon plus the mission systems. Each physics step it measures the
// rover, calls the rules (rules/mission.ts) and applies what they allow; each frame it draws the HUD
// and minimap. The mission ends at 5 minutes or on one of the four deaths, then goes to the debrief.
import type { Screen } from '../flow/flow';
import type { EarnedMilestone, MissionResult } from '../rules/payout';
import { selectedParts } from '../rules/rover';
import { roverParams } from '../rules/drive';
import { gameDaysElapsed, sunAt } from '../rules/sun';
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

const DEG = 180 / Math.PI;
const SUN_SAMPLE_STEPS = 12; // recompute sunlight at the rover every 12 physics steps (0.2 s)
const MAX_STEP_DISTANCE_M = 5; // a larger jump is a teleport, not driving
const GRADE_PROBE_M = 2;
const MINIMAP_EVERY_FRAMES = 3;

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

  // What the last step measured
  let ctx: { terrain: Terrain; masks: TerrainMasks; sunVisibility: typeof import('../world/terrainData').sunVisibility } | null = null;
  let lastPos: { x: number; z: number } | null = null;
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
  const hud = new Hud(text, togglePower, el('div', { class: 'hud-extra' },
    el('p', { class: 'muted' }, text.mission.controls),
    status,
  ));
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyP' && !e.repeat) togglePower();
  };
  window.addEventListener('keydown', onKey);

  const odometer = data.milestones.milestones.find((m) => m.id === 'odometer');
  const earned = (): EarnedMilestone[] => {
    const meters = odometer?.trigger.type === 'distance' ? odometer.trigger.meters : [];
    const stages = meters.filter((m) => state.distanceM >= m).length;
    return [{ id: 'touchdown' }, ...(stages > 0 ? [{ id: 'odometer', stages }] : [])];
  };

  const finish = (end: MissionEnd) => {
    ended = end;
    scene?.stopClock();
    const h = text.hud;
    const days = gameDaysElapsed(end.seconds, tuning.mission);
    const lines = [
      end.survived ? h.endedSurvived : end.detail === 'rollover' ? h.rollover : fill(h.endedFailed, { cause: text.causes[end.cause!] }),
      fill(h.lasted, { days: end.survived ? tuning.mission.gameDays : days.toFixed(1), total: tuning.mission.gameDays }),
    ];
    const result: MissionResult = { survived: end.survived, cause: end.cause, secondsLasted: end.seconds, earned: earned() };
    hud.showEnd(lines, () => game.endMission(result));
  };

  const onStep = (s: MoonStepSample): MoonDriveLimits | void => {
    if (!ctx) return;
    const { terrain, masks } = ctx;
    const p = s.position;
    let distance = lastPos ? Math.hypot(p.x - lastPos.x, p.z - lastPos.z) : 0;
    if (distance > MAX_STEP_DISTANCE_M) distance = 0;
    lastPos = { x: p.x, z: p.z };

    const vh = Math.hypot(s.velocity.x, s.velocity.z);
    let uphillDeg = 0;
    if (vh > 0.3) {
      const dx = (s.velocity.x / vh) * GRADE_PROBE_M;
      const dz = (s.velocity.z / vh) * GRADE_PROBE_M;
      uphillDeg = Math.atan2(terrain.heightAt(p.x + dx, p.z + dz) - terrain.heightAt(p.x - dx, p.z - dz), 2 * GRADE_PROBE_M) * DEG;
    }
    if (--sunCountdown <= 0) {
      sunCountdown = SUN_SAMPLE_STEPS;
      const site = { latitudeDeg: terrain.info.sunAndEarth.siteLatitude_deg, longitudeDeg: terrain.info.sunAndEarth.siteLongitude_deg };
      sunlight = ctx.sunVisibility(terrain, p.x, p.z, sunAt(s.seconds, tuning.sun, tuning.mission, site));
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
    if (state.end && !ended) finish(state.end);

    // What the rover may do next step.
    if (ended || state.poweredDown) {
      blockedByShadow = false;
      return (limits = { allowForward: false, allowReverse: false, speedFactor: 1 });
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
        boulderAreas: masks.softAreas,
        lightRangeM: parts.reduce((m, p) => Math.max(m, p.effects.lightRange ?? 0), 0),
        onStep,
        onFrame: (s) => onFrame({ position: s.position, nearBoundary: s.nearBoundary, forward: s.forward }),
      });
      if (disposed) return started.dispose();
      scene = started;
      status.textContent = '';
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

  return () => {
    disposed = true;
    window.removeEventListener('keydown', onKey);
    scene?.dispose();
    if (import.meta.env.DEV) delete (window as unknown as { __mission?: unknown }).__mission;
  };
};
