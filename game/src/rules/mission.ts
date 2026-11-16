// The mission loop's rules: one step combines energy, damage, cold, soft ground, events and the end
// conditions. The mission screen measures the rover (MissionSample), calls stepMission, and draws
// the result. Pure: no rendering, no physics.
import type { DeathCause, EventsFile, Part, RealFlare, Tuning } from './types';
import { driveStats, type DriveStats } from './drive';
import { roverTotals } from './rover';
import { canDriveMars, constantPowerIncome, driveEnergy, lowSunFactor, nightDrainPerSecond, solarIncome } from './energy';
import { impactDamage, overloadDamage, steepSlopeDamage, tiltDeg, type DamageCause } from './damage';
import { marsFreezeRate, stepFreeze } from './cold';
import { stepDig, wheelSlip } from './ground';
import { flareDamage, flareProtected, type MissionEvent, type Rng } from './events';
import type { DustStormSpec } from './marsTypes';
import { solClock, solEdge, type SolState } from './sol';
import { marsSunAt } from './marsSun';
import { scheduleDustStorm, scheduleRainstorm, stormEdge, stormFreezeFactor, stormIntensity, stormPhase, stormSolarFactor, type DustStorm, type StormEdge, type StormPhase } from './storm';
import type { SkyDirection } from './sun';
import type { RainstormSpec } from './titanTypes';
import { rainBlocksPhotos, titanClock, titanClockRate, titanDrainPerSecond, titanFreezeRate, titanSolarFactor, titanSunAt, type TitanSite } from './titan';

/** Mars only: what the day-and-night rules need beyond the parts. */
export interface MarsSetup {
  site: { latitudeDeg: number; longitudeDeg: number }; // terrain.json sunAndEarth
  storm: DustStorm | null; // rules/storm.ts scheduleDustStorm
  stormSpec?: DustStormSpec; // events.duststorm
}

/** The Mars setup for a mission: the site and the mission's dust storm, drawn from the events' random generator. */
export function marsSetup(site: MarsSetup['site'], events: EventsFile, rng: Rng): MarsSetup {
  return { site, storm: scheduleDustStorm(events, rng), ...(events.duststorm ? { stormSpec: events.duststorm } : {}) };
}

/** Titan only: what the day, cold and rain rules need beyond the parts. */
export interface TitanSetup {
  site: TitanSite; // terrain.json sunAndEarth
  storm: DustStorm | null; // the methane rainstorm, rules/storm.ts scheduleRainstorm
  stormSpec?: RainstormSpec; // events.rainstorm
}

/** The Titan setup for a mission: the site and the mission's methane rainstorm, drawn from the events' random generator. */
export function titanSetup(site: TitanSite, events: EventsFile, rng: Rng): TitanSetup {
  return { site, storm: scheduleRainstorm(events, rng), ...(events.rainstorm ? { stormSpec: events.rainstorm } : {}) };
}

/** What the parts mean for the mission systems. */
export interface MissionSetup {
  stats: DriveStats;
  heat: number;
  hasLights: boolean;
  overloadKg: number; // total mass above the chassis maximum load
  events: MissionEvent[];
  mars?: MarsSetup; // present on Mars: the sol clock, night, map-wide cold and the dust storm apply
  titan?: TitanSetup; // present on Titan: the one-day clock, night, always-on cold and the methane rain apply
}

export function missionSetup(parts: Part[], tuning: Tuning, events: MissionEvent[], mars?: MarsSetup, titan?: TitanSetup): MissionSetup {
  const { mass } = roverTotals(parts);
  const maxLoad = parts.find((p) => p.slot === 'chassis')?.effects.maxLoad;
  return {
    stats: driveStats(parts, tuning),
    heat: parts.reduce((s, p) => s + (p.effects.heat ?? 0), 0),
    hasLights: parts.some((p) => (p.effects.lightRange ?? 0) > 0),
    overloadKg: maxLoad === undefined ? 0 : Math.max(0, mass - maxLoad),
    events,
    ...(mars ? { mars } : {}),
    ...(titan ? { titan } : {}),
  };
}

export interface MissionEnd {
  survived: boolean;
  cause?: DeathCause;
  detail?: 'rollover'; // destroyed by rolling over rather than by the damage meter
  seconds: number;
}

export type EventStage = 'pending' | 'warned' | 'done';

export interface MissionState {
  seconds: number;
  energy: number;
  damage: number;
  freeze: number;
  dig: number; // 0..1, full = stuck for good
  distanceM: number;
  poweredDown: boolean;
  impactCooldown: number;
  tiltSeconds: number; // how long the rover has been tilted past the rollover limit
  damageBy: Record<DamageCause, number>;
  eventStages: EventStage[]; // one per setup.events entry
  flaresHarmed: number;
  flaresProtected: number;
  end: MissionEnd | null;
}

/** What the mission screen measured about the rover over one step. */
export interface MissionSample {
  dt: number; // mission seconds in this step
  distanceM: number; // horizontal distance driven (game meters)
  speedMps: number; // absolute speed
  uphillDeg: number; // grade along the direction of travel (positive = climbing)
  slopeDeg: number; // terrain slope under the rover (slope.png)
  sunlight: number; // 0..1 share of the Sun's disc visible from the rover
  inColdZone: boolean;
  softness: number; // 0..1
  throttling: boolean; // the driver is pushing the throttle (and the rover is allowed to drive)
  impactMps: number; // sudden velocity change this step
  upY: number; // y component of the rover's up vector
}

export type MissionNotice =
  | { kind: 'flare-warning'; flare: RealFlare; at: number }
  | { kind: 'flare-hit'; flare: RealFlare; protected: boolean; damage: number }
  | { kind: 'quake'; damage: number }
  | { kind: 'impact'; damage: number };

/** Mars and Titan notices: sunset, dawn (the rover wakes if it was asleep) and the storm's forecast, start and end (Titan: the methane rain). */
export type MarsNotice = { kind: 'dusk' } | { kind: 'dawn'; woke: boolean } | { kind: 'storm'; edge: StormEdge };

export interface MissionStep {
  state: MissionState;
  slip: number; // current wheel slip, 0..1
  notices: MissionNotice[];
  marsNotices: MarsNotice[]; // Mars and Titan day, night and storm notices; always empty on the Moon
}

export function startMission(setup: MissionSetup): MissionState {
  return {
    seconds: 0,
    energy: setup.stats.batteryCapacity,
    damage: 0,
    freeze: 0,
    dig: 0,
    distanceM: 0,
    poweredDown: false,
    impactCooldown: 0,
    tiltSeconds: 0,
    damageBy: { impact: 0, slope: 0, overload: 0, flare: 0, quake: 0 },
    eventStages: setup.events.map(() => 'pending'),
    flaresHarmed: 0,
    flaresProtected: 0,
    end: null,
  };
}

export function stepMission(prev: MissionState, s: MissionSample, setup: MissionSetup, t: Tuning, events: EventsFile): MissionStep {
  const stats = setup.stats;
  const driving = !prev.poweredDown && s.speedMps > t.ground.movingSpeedMps;
  const slip = s.throttling ? wheelSlip(s.softness, stats.massKg, stats.grip, s.uphillDeg, t) : 0;
  if (prev.end) return { state: prev, slip, notices: [], marsNotices: [] };

  const state: MissionState = { ...prev, damageBy: { ...prev.damageBy } };
  const notices: MissionNotice[] = [];
  const hurt = (cause: DamageCause, amount: number) => {
    if (amount <= 0) return;
    state.damage += amount;
    state.damageBy[cause] += amount;
  };

  state.seconds = Math.min(t.mission.lengthSeconds, prev.seconds + s.dt);

  const mars = marsConditions(prev, setup, t);
  const world = mars ?? titanConditions(prev, setup, t, driving);
  const marsNotices: MarsNotice[] = [];

  // Energy (Mars: low Sun and the dust storm cut solar income; none at night; a night drain while awake or asleep.
  // Titan: almost no solar; the electronics drain day and night. Constant power, from any part that has it, on every world.)
  const used = prev.poweredDown ? 0 : driveEnergy(s.distanceM, s.uphillDeg, stats.energyPerMeter, t.energy);
  const sunlight = world ? s.sunlight * world.solarFactor : s.sunlight;
  const drain = world ? world.drainPerSecond * s.dt : 0;
  const income = solarIncome(stats.energyIncome, sunlight, s.dt) + constantPowerIncome(stats.constantPower ?? 0, s.dt);
  state.energy = Math.min(stats.batteryCapacity, prev.energy - used - drain + income);
  state.distanceM = prev.distanceM + Math.max(0, s.distanceM);

  // Damage
  state.impactCooldown = Math.max(0, prev.impactCooldown - s.dt);
  const impact = state.impactCooldown > 0 ? 0 : impactDamage(s.impactMps, t.damage);
  if (impact > 0) {
    hurt('impact', impact);
    state.impactCooldown = t.damage.impactCooldownSeconds;
    notices.push({ kind: 'impact', damage: impact });
  }
  hurt('slope', steepSlopeDamage(s.slopeDeg, driving, s.dt, t));
  hurt('overload', overloadDamage(setup.overloadKg, driving, s.dt, t.damage));
  state.tiltSeconds = tiltDeg(s.upY) > t.damage.rolloverTiltDeg ? prev.tiltSeconds + s.dt : 0;

  // Cold and soft ground
  state.freeze = world
    ? Math.min(t.cold.freezeMax, Math.max(0, prev.freeze + world.freezeRate * s.dt))
    : stepFreeze(prev.freeze, s.inColdZone, setup.heat, s.dt, t.cold);
  state.dig = stepDig(prev.dig, slip, s.throttling, s.dt, t.ground);

  // Events
  const stages = [...prev.eventStages];
  setup.events.forEach((ev, i) => {
    if (stages[i] === 'done') return;
    if (stages[i] === 'pending' && state.seconds >= ev.warningAt && ev.kind === 'flare') {
      stages[i] = 'warned';
      notices.push({ kind: 'flare-warning', flare: ev.flare, at: ev.at });
    }
    if (state.seconds < ev.at) return;
    stages[i] = 'done';
    if (ev.kind === 'flare') {
      const safe = flareProtected(prev.poweredDown, s.sunlight, events);
      const damage = safe ? 0 : flareDamage(ev.flare, events);
      hurt('flare', damage);
      if (safe) state.flaresProtected++;
      else state.flaresHarmed++;
      notices.push({ kind: 'flare-hit', flare: ev.flare, protected: safe, damage });
    } else {
      const damage = events.quake?.damage ?? 0;
      hurt('quake', damage);
      notices.push({ kind: 'quake', damage });
    }
  });
  state.eventStages = stages;
  state.damage = Math.min(t.damage.max, state.damage);
  state.energy = Math.max(0, state.energy);

  state.end = missionEnd(state, t);

  // Mars and Titan: sunset and dawn (sleep ends at dawn by itself), the storm's forecast, start and end
  const daySetup = setup.mars ?? setup.titan;
  if (world && daySetup && t.sol && !state.end) {
    const edge = solEdge(prev.seconds, state.seconds, t.sol);
    if (edge === 'dusk') marsNotices.push({ kind: 'dusk' });
    if (edge === 'dawn') {
      marsNotices.push({ kind: 'dawn', woke: state.poweredDown });
      state.poweredDown = false;
    }
    const storm = stormEdge(prev.seconds, state.seconds, daySetup.storm);
    if (storm) marsNotices.push({ kind: 'storm', edge: storm });
  }
  return { state, slip, notices, marsNotices };
}

/** Everything the Mars rules say about one moment, for the HUD, the scene and the milestones. */
export interface MarsStatus {
  clock: SolState; // sol number, isNight, local solar time, sunSetting
  sun: SkyDirection; // the real Sun at the site (elevation < 0 at night)
  stormPhase: StormPhase;
  stormIntensity: number; // 0..1, for the renderer
  solarFactor: number; // multiplies the measured sunlight: low Sun × storm, 0 at night
  drainPerSecond: number; // night drain apart from driving
  freezeRate: number; // freeze meter change per second (negative = recovering)
  canDrive: boolean; // false asleep, and at night without lights
  lightsOn: boolean; // awake at night with lights: the floodlights are on and the lights drain applies
}

/** The Mars conditions at the state's time, or null on the Moon (no `setup.mars` or no sol/night tuning). */
export function marsStatus(state: MissionState, setup: MissionSetup, t: Tuning): MarsStatus | null {
  return marsConditions(state, setup, t);
}

function marsConditions(state: MissionState, setup: MissionSetup, t: Tuning): MarsStatus | null {
  const m = setup.mars;
  if (!m || !t.sol || !t.night) return null;
  const at = state.seconds;
  const clock = solClock(at, t.sol, m.site.latitudeDeg);
  const sun = marsSunAt(at, t.sol, m.site);
  const spec = m.stormSpec;
  const intensity = stormIntensity(at, m.storm, spec);
  const night = clock.isNight;
  return {
    clock,
    sun,
    stormPhase: stormPhase(at, m.storm),
    stormIntensity: intensity,
    solarFactor: night ? 0 : lowSunFactor(sun.elevationDeg, t.night) * stormSolarFactor(intensity, spec),
    drainPerSecond: nightDrainPerSecond(night, state.poweredDown, setup.hasLights, t.night),
    freezeRate: marsFreezeRate(night, setup.heat, stormFreezeFactor(intensity, spec), t.cold, t.night),
    canDrive: canDriveMars(night, state.poweredDown, setup.hasLights, t.night),
    lightsOn: night && setup.hasLights && !state.poweredDown,
  };
}

/** Everything the Titan rules say about one moment, for the HUD, the scene and the milestones. */
export interface TitanStatus {
  clock: SolState; // isNight, local solar time, sunSetting (sol is always 1)
  sun: SkyDirection; // the real Sun at the site (elevation < 0 at night)
  stormPhase: StormPhase; // the methane rain: none, forecast, active, cleared
  stormIntensity: number; // 0..1, for scene.setStorm
  photosBlocked: boolean; // the rain is falling and blocks photos
  solarFactor: number; // multiplies the measured sunlight: the Titan factor by day, 0 at night
  drainPerSecond: number; // drain apart from driving: electronics day and night, lights at night, or sleep
  freezeRate: number; // freeze meter change per second (negative = recovering)
  canDrive: boolean; // false asleep, and at night without lights
  lightsOn: boolean; // awake at night with lights
  clockRate: number; // mission seconds per wall second (sleep fast-forward at night); see titanMissionDelta
}

/**
 * The Titan conditions at the state's time, or null off Titan (no `setup.titan` or no sol/night/titanCold
 * tuning). `driving` adds the driving heat to the freeze rate (stepMission passes it).
 */
export function titanStatus(state: MissionState, setup: MissionSetup, t: Tuning, driving = false): TitanStatus | null {
  return titanConditions(state, setup, t, driving);
}

function titanConditions(state: MissionState, setup: MissionSetup, t: Tuning, driving: boolean): TitanStatus | null {
  const ti = setup.titan;
  if (!ti || !t.sol || !t.night || !t.titanCold) return null;
  const at = state.seconds;
  const clock = titanClock(at, t.sol, ti.site.latitudeDeg);
  const spec = ti.stormSpec;
  const phase = stormPhase(at, ti.storm);
  const intensity = stormIntensity(at, ti.storm, spec);
  const night = clock.isNight;
  return {
    clock,
    sun: titanSunAt(at, t.sol, ti.site),
    stormPhase: phase,
    stormIntensity: intensity,
    photosBlocked: rainBlocksPhotos(phase, spec),
    solarFactor: titanSolarFactor(night, t.titanPower),
    drainPerSecond: titanDrainPerSecond(night, state.poweredDown, setup.hasLights, t.night),
    freezeRate: titanFreezeRate(setup.heat, state.poweredDown, driving && !state.poweredDown, stormFreezeFactor(intensity, spec), t.titanCold, t.cold),
    canDrive: canDriveMars(night, state.poweredDown, setup.hasLights, t.night),
    lightsOn: night && setup.hasLights && !state.poweredDown,
    clockRate: titanClockRate(night, state.poweredDown, t.sleep),
  };
}

/** The end conditions, most severe first. Null while the mission goes on. */
export function missionEnd(s: MissionState, t: Tuning): MissionEnd | null {
  const at = s.seconds;
  if (s.tiltSeconds >= t.damage.rolloverSeconds) return { survived: false, cause: 'destroyed', detail: 'rollover', seconds: at };
  if (s.damage >= t.damage.max) return { survived: false, cause: 'destroyed', seconds: at };
  if (s.energy <= 0) return { survived: false, cause: 'energy', seconds: at };
  if (s.freeze >= t.cold.freezeMax) return { survived: false, cause: 'froze', seconds: at };
  if (s.dig >= 1) return { survived: false, cause: 'stuck', seconds: at };
  if (at >= t.mission.lengthSeconds) return { survived: true, seconds: at };
  return null;
}

/** The flare whose warning is showing, if any. */
export function activeFlareWarning(s: MissionState, setup: MissionSetup): Extract<MissionEvent, { kind: 'flare' }> | null {
  for (let i = 0; i < setup.events.length; i++) {
    const ev = setup.events[i]!;
    if (ev.kind === 'flare' && s.eventStages[i] === 'warned') return ev;
  }
  return null;
}

export type WarningId = 'poweredDown' | 'lowEnergy' | 'highDamage' | 'cold' | 'steepSlope' | 'slip' | 'noLights';

/** Standing warnings for the HUD, most urgent first. */
export function missionWarnings(
  s: MissionState,
  sample: MissionSample,
  slip: number,
  blockedByShadow: boolean,
  setup: MissionSetup,
  t: Tuning,
): WarningId[] {
  const w: WarningId[] = [];
  if (blockedByShadow) w.push('noLights');
  const marsNight = !!(setup.mars && t.sol && solClock(s.seconds, t.sol, setup.mars.site.latitudeDeg).isNight);
  if ((sample.inColdZone || marsNight || !!setup.titan) && s.freeze > 0) w.push('cold');
  if (slip > t.ground.slipLimit) w.push('slip');
  if (sample.slopeDeg >= t.ground.slopeWarningDegrees && sample.speedMps > t.ground.movingSpeedMps) w.push('steepSlope');
  if (s.energy < setup.stats.batteryCapacity * t.energy.lowWarningShare) w.push('lowEnergy');
  if (s.damage >= t.damage.max * t.damage.highWarningShare) w.push('highDamage');
  if (s.poweredDown) w.push('poweredDown');
  return w;
}
