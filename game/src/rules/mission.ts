// The mission loop's rules: one step combines energy, damage, cold, soft ground, events and the end
// conditions. The mission screen measures the rover (MissionSample), calls stepMission, and draws
// the result. Pure: no rendering, no physics.
import type { DeathCause, EventsFile, Instrument, Part, RealFlare, Tuning } from './types';
import { driveStats, type DriveStats } from './drive';
import { roverTotals } from './rover';
import { canDriveMars, driveEnergy, lowSunFactor, nightDraw, partPower, solarIncome, type PartPower } from './energy';
import { impactDamage, overloadDamage, steepSlopeDamage, tiltDeg, type DamageCause } from './damage';
import { heatNow, marsFreezeRate, stepFreeze } from './cold';
import { stepDig, wheelSlip } from './ground';
import { flareDamage, flareProtected, seededRng, type MissionEvent, type Rng } from './events';
import type { DustDevil, DustDevilSlot, DustDevilSpec, DustStormSpec } from './marsTypes';
import { dustDevilCleaned, dustDevilsForming, placeDustDevil, scheduleDustDevils, stepDust } from './dust';
import { solClock, solEdge, type SolState } from './sol';
import { marsSunAt } from './marsSun';
import { scheduleDustStorm, stormEdge, stormFreezeFactor, stormIntensity, stormPhase, stormSolarFactor, type DustStorm, type StormEdge, type StormPhase } from './storm';
import type { SkyDirection } from './sun';

/** Mars only: what the day-and-night rules need beyond the parts. */
export interface MarsSetup {
  site: { latitudeDeg: number; longitudeDeg: number }; // terrain.json sunAndEarth
  storm: DustStorm | null; // rules/storm.ts scheduleDustStorm
  stormSpec?: DustStormSpec; // events.duststorm
  devils?: DustDevilSlot[]; // rules/dust.ts scheduleDustDevils: placed at the rover when each forms
  devilSpec?: DustDevilSpec; // events.dustdevil
}

/**
 * The Mars setup for a mission: the site and the mission's dust storm, drawn from the events' random
 * generator, and (given the sol clock and mission length) the dust devils. The devils have their own
 * seeded stream, seeded by one draw after the storm, so a seed's storm is the same with or without them.
 */
export function marsSetup(site: MarsSetup['site'], events: EventsFile, rng: Rng, tuning?: Pick<Tuning, 'sol' | 'mission'>): MarsSetup {
  const storm = scheduleDustStorm(events, rng);
  const spec = events.dustdevil;
  // The devils' seed must stay the last use of rng here: a draw added before it would move every seed's
  // devils (and, before the storm, its storm), which the seeded storm and dust tests pin.
  const devils = spec && tuning?.sol
    ? scheduleDustDevils(spec, tuning.sol, tuning.mission.lengthSeconds, seededRng(Math.floor(rng() * 0x100000000)))
    : undefined;
  return {
    site,
    storm,
    ...(events.duststorm ? { stormSpec: events.duststorm } : {}),
    ...(spec && devils ? { devils, devilSpec: spec } : {}),
  };
}
import { instrumentCosts, type InstrumentCosts } from './payload';
import { stormForecastAt, stormHaze, type WeatherSky } from './instruments';

/** What the parts mean for the mission systems. */
export interface MissionSetup {
  stats: DriveStats;
  heat: number;
  hasLights: boolean;
  power: PartPower; // the draws and steady income the parts own (rules/energy.ts); applied only where tuning.night exists
  overloadKg: number; // total mass above the chassis maximum load
  instruments: InstrumentCosts[]; // the payload still aboard, in bay order (deployed stations leave it)
  contact: Instrument[]; // instruments the arm holds against a rock (their `needs` include the arm): a boulder in reach, level enough ground
  remote: Instrument[]; // instruments on the mast that read from a distance (their `needs` include the mast): a target in the cone ahead
  events: MissionEvent[];
  mars?: MarsSetup; // present on Mars: the sol clock, night, map-wide cold and the dust storm apply
}

export function missionSetup(parts: Part[], tuning: Tuning, events: MissionEvent[], mars?: MarsSetup): MissionSetup {
  const { mass } = roverTotals(parts);
  const maxLoad = parts.find((p) => p.slot === 'chassis')?.effects.maxLoad;
  return {
    stats: driveStats(parts, tuning),
    heat: parts.reduce((s, p) => s + (p.effects.heat ?? 0), 0),
    hasLights: parts.some((p) => (p.effects.lightRange ?? 0) > 0),
    power: partPower(parts),
    overloadKg: maxLoad === undefined ? 0 : Math.max(0, mass - maxLoad),
    instruments: instrumentCosts(parts),
    contact: needing(parts, 'arm'),
    remote: needing(parts, 'mast'),
    events,
    ...(mars ? { mars } : {}),
  };
}

/** The instruments among the parts whose `needs` include this support hardware. */
function needing(parts: Part[], support: 'arm' | 'mast'): Instrument[] {
  return parts.flatMap((p) => (p.effects.instrument && p.effects.needs?.includes(support) ? [p.effects.instrument] : []));
}

export interface MissionEnd {
  survived: boolean;
  cause?: DeathCause;
  detail?: 'rollover'; // destroyed by rolling over rather than by the damage meter
  seconds: number;
}

export type EventStage = 'pending' | 'warned' | 'done';

/**
 * Where and how a held use started. The rover holds still, so this is also where it finishes: the
 * result and the relationships read it from the 'instrument-done' notice, not from the screen.
 */
export interface UseSite {
  boulder: number | null; // the boulder an X-ray reading targets (index in the boulder list), locked at the start
  inDarkCrater: boolean; // inside the dark crater (the shadowed-crater zone)
  slowedByCold: boolean; // the hold was lengthened by the cold (no heater)
  fasterInShadow: boolean; // the hold was shortened by shadow (shadowHoldFactor)
  target?: 'boulder' | 'cliff'; // a remote reading (the laser): what it was aimed at, locked at the start (boulder: site.boulder)
}

export interface MissionState {
  seconds: number;
  energy: number;
  damage: number;
  freeze: number;
  dig: number; // 0..1, full = stuck for good
  distanceM: number;
  poweredDown: boolean;
  standbyOn: Instrument[]; // instruments switched on (each draws its standby energy while the rover is powered up)
  /**
   * An instrument use the rover holds still for (paused while powered down). chargePerSecond: a use charged
   * as it runs (tuning.instruments.chargedWhileHeld), energy per second of the hold; absent: paid at the start.
   */
  using: { instrument: Instrument; secondsLeft: number; totalSeconds?: number /* the hold's length when it differs from useSeconds (cold, shadow) */; site: UseSite; chargePerSecond?: number } | null;
  deployed: Instrument[]; // stations set down on the ground, in the order deployed (they left the rover)
  impactCooldown: number;
  tiltSeconds: number; // how long the rover has been tilted past the rollover limit
  damageBy: Record<DamageCause, number>;
  eventStages: EventStage[]; // one per setup.events entry
  flaresHarmed: number;
  flaresProtected: number;
  end: MissionEnd | null;
  mars?: MarsState; // Mars only: started on the first Mars step if absent (the Mars setup arrives with the terrain)
}

/** What the Mars rules carry from step to step. */
export interface MarsState {
  dustFactor: number; // dust on the panels: solar income multiplier, 1 = clean (rules/dust.ts)
  devils: DustDevil[]; // the dust devils placed so far, each where the rover was when it formed (for cleaning and the renderer)
  roverAt: { x: number; z: number } | null; // the rover's position at the last step (a devil's closest pass is checked along the step)
  // Mars step 4a (optional, so a state made before them still steps):
  weatherSince?: number | null; // the weather mast has been switched on, with the rover powered up, since this mission time (null: not now)
  forecastAt?: number | null; // when the dust storm's forecast was given (null: not yet)
  forecastByMast?: boolean; // the weather mast gave it, before the orbital report (rules/instruments.ts stormForecastAt)
}

function startMarsState(): MarsState {
  return { dustFactor: 1, devils: [], roverAt: null, weatherSince: null, forecastAt: null, forecastByMast: false };
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
  position?: { x: number; z: number }; // where the rover is (Mars: dust devils form at it and clean near it); absent: no dust devils
}

export type MissionNotice =
  | { kind: 'flare-warning'; flare: RealFlare; at: number }
  | { kind: 'flare-hit'; flare: RealFlare; protected: boolean; damage: number }
  | { kind: 'quake'; damage: number }
  | { kind: 'impact'; damage: number }
  | { kind: 'instrument-done'; instrument: Instrument; deployed: boolean; site: UseSite } // a held instrument use finished (deployed: a station was set down)
  | { kind: 'instrument-stopped'; instrument: Instrument; reason: 'energy' } // a use charged as it runs stopped: the battery could not pay for the next step of it
  | { kind: 'standby-off'; instruments: Instrument[] }; // the battery fell to the low-energy warning: switched-on instruments were switched off

/**
 * Mars notices: sunset, dawn (the rover wakes if it was asleep) and the dust storm's forecast, start and end.
 * byMast: the weather mast gave the forecast early (present only then).
 */
export type MarsNotice = { kind: 'dusk' } | { kind: 'dawn'; woke: boolean } | { kind: 'storm'; edge: StormEdge; byMast?: true };

export interface MissionStep {
  state: MissionState;
  slip: number; // current wheel slip, 0..1
  notices: MissionNotice[];
  marsNotices: MarsNotice[]; // always empty on the Moon
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
    standbyOn: [],
    using: null,
    deployed: [],
    impactCooldown: 0,
    tiltSeconds: 0,
    damageBy: { impact: 0, slope: 0, overload: 0, flare: 0, quake: 0 },
    eventStages: setup.events.map(() => 'pending'),
    flaresHarmed: 0,
    flaresProtected: 0,
    end: null,
    ...(setup.mars ? { mars: startMarsState() } : {}),
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
  const marsNotices: MarsNotice[] = [];

  // Energy: driving and instruments on standby (nothing while powered down), against solar income.
  // Mars: low Sun, the dust storm and dust on the panels cut solar income (none at night); the parts'
  // steady income (an RTG) is never cut; the night draw (electronics, lights, an electric heater) applies
  // awake or asleep. Standby never ends the mission by itself: its draw never takes the battery below the
  // low-energy warning level; when it would, the switched-on instruments switch off (with a notice).
  // The Mars night draw is not capped that way: it can empty the battery.
  const marsPrev = mars ? prev.mars ?? startMarsState() : null;
  const drive = prev.poweredDown ? 0 : driveEnergy(s.distanceM, s.uphillDeg, stats.energyPerMeter, t.energy);
  const sunlight = mars ? s.sunlight * mars.solarFactor : s.sunlight;
  const solar = solarIncome(stats.energyIncome * (marsPrev?.dustFactor ?? 1), sunlight, s.dt);
  const steady = mars ? setup.power.steadyIncome * s.dt : 0;
  const drain = mars ? mars.drainPerSecond * s.dt : 0;
  const afterDrive = Math.min(stats.batteryCapacity, prev.energy - drive - drain + solar + steady);
  const standby = prev.poweredDown ? 0 : standbyDraw(prev, setup) * s.dt;
  const aboveLow = Math.max(0, afterDrive - lowEnergyLevel(setup, t));
  let standbyOff = false;
  if (prev.standbyOn.length > 0 && !prev.poweredDown && (standby >= aboveLow || aboveLow <= 0)) standbyOff = true;
  state.energy = afterDrive - Math.min(standby, aboveLow);
  state.distanceM = prev.distanceM + Math.max(0, s.distanceM);
  // The weather mast counts as on for a step when it was switched on and the rover powered up at its start.
  const mastOn = !prev.poweredDown && prev.standbyOn.includes('weather') && isSwitchInstrument('weather', setup);
  if (mars && marsPrev) state.mars = stepMars(marsPrev, prev.seconds, state.seconds, s, mars.stormIntensity, setup, t, mastOn);

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
  state.freeze = mars
    ? Math.min(t.cold.freezeMax, Math.max(0, prev.freeze + mars.freezeRate * s.dt))
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

  if (standbyOff && !state.end) {
    notices.push({ kind: 'standby-off', instruments: prev.standbyOn });
    state.standbyOn = [];
  }

  // A held instrument use counts down, but not while the rover is powered down (it resumes on power-up);
  // it finishes only if the mission goes on. A deployable's part is then on the ground.
  // A use charged as it runs pays for the part of the hold this step covers; when the battery cannot, the
  // use stops (it never ends the mission by itself) and nothing is found.
  const charge = prev.using?.chargePerSecond ? prev.using.chargePerSecond * Math.min(s.dt, prev.using.secondsLeft) : 0;
  if (prev.using && !prev.poweredDown && charge > 0 && !state.end && state.energy - charge <= 0) {
    state.using = null;
    notices.push({ kind: 'instrument-stopped', instrument: prev.using.instrument, reason: 'energy' });
  } else if (prev.using && !prev.poweredDown) {
    if (!state.end) state.energy -= charge;
    const secondsLeft = prev.using.secondsLeft - s.dt;
    state.using = secondsLeft > 1e-9 ? { ...prev.using, secondsLeft } : null;
    if (!state.using && !state.end) {
      const inst = prev.using.instrument;
      const deploy = setup.instruments.find((c) => c.instrument === inst)?.mode === 'deploy';
      if (deploy) state.deployed = [...prev.deployed, inst];
      notices.push({ kind: 'instrument-done', instrument: inst, deployed: deploy, site: prev.using.site });
    }
  }

  // Mars: sunset and dawn (sleep ends at dawn by itself), the dust storm's forecast, start and end
  if (mars && t.sol && !state.end) {
    const edge = solEdge(prev.seconds, state.seconds, t.sol);
    if (edge === 'dusk') marsNotices.push({ kind: 'dusk' });
    if (edge === 'dawn') {
      marsNotices.push({ kind: 'dawn', woke: state.poweredDown });
      state.poweredDown = false;
    }
    // The forecast comes once: from the orbital report, or earlier from a weather mast that has been on a while.
    const m = state.mars!;
    const storm = setup.mars!.storm;
    const stormAt = stormEdge(prev.seconds, state.seconds, storm);
    if (storm && m.forecastAt == null && state.seconds < storm.startAt) {
      const forecast = t.instruments.weather ? stormForecastAt(storm, m.weatherSince ?? null, t.instruments.weather) : { at: storm.forecastAt, byMast: false };
      if (state.seconds >= forecast.at) {
        state.mars = { ...m, forecastAt: state.seconds, forecastByMast: forecast.byMast };
        marsNotices.push(forecast.byMast ? { kind: 'storm', edge: 'forecast', byMast: true } : { kind: 'storm', edge: 'forecast' });
      }
    }
    if (stormAt && stormAt !== 'forecast') marsNotices.push({ kind: 'storm', edge: stormAt });
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
  drainPerSecond: number; // night draw apart from driving and standby (rules/energy.ts nightDraw)
  dustFactor: number; // dust on the panels: solar income multiplier, 1 = clean (not part of solarFactor)
  freezeRate: number; // freeze meter change per second (negative = recovering)
  canDrive: boolean; // false asleep, and at night without lights
  lightsOn: boolean; // awake at night with lights: the floodlights are on and their draw (the parts' lightsDraw) applies
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
  const phase = stormPhase(at, m.storm);
  return {
    clock,
    sun,
    stormPhase: phase === 'none' && state.mars?.forecastAt != null ? 'forecast' : phase, // a weather mast's forecast comes early
    stormIntensity: intensity,
    solarFactor: night ? 0 : lowSunFactor(sun.elevationDeg, t.night) * stormSolarFactor(intensity, spec),
    drainPerSecond: nightDraw(setup.power, { isNight: night, poweredDown: state.poweredDown, hasLights: setup.hasLights }, t.night),
    dustFactor: state.mars?.dustFactor ?? 1,
    freezeRate: marsFreezeRate(night, heatNow(setup.heat, setup.power.electricHeat, state.energy), stormFreezeFactor(intensity, spec), t.cold, t.night),
    canDrive: canDriveMars(night, state.poweredDown, setup.hasLights, t.night),
    lightsOn: night && setup.hasLights && !state.poweredDown,
  };
}

/**
 * One step of the Mars state: the dust devils that form this step are placed where the rover is (a step
 * without a position places none), a devil passing within tuning.dust.dustDevilCleanM along the step
 * cleans the panels, and otherwise dust settles (faster in the storm). Dust settles on every rover; it
 * only matters for solar income, and a rover without solar income has a dust rate of 0.
 */
function stepMars(prev: MarsState, prevSeconds: number, seconds: number, s: MissionSample, stormIntensity: number, setup: MissionSetup, t: Tuning, mastOn: boolean): MarsState {
  const m = setup.mars!;
  const at = s.position ? { x: s.position.x, z: s.position.z } : null;
  let devils = prev.devils;
  if (at && m.devils && m.devilSpec) {
    const forming = dustDevilsForming(m.devils, prevSeconds, seconds);
    if (forming.length > 0) devils = [...devils, ...forming.map((slot) => placeDustDevil(slot, m.devilSpec!, at))];
  }
  const cleaned = at !== null && dustDevilCleaned(devils, prevSeconds, seconds, prev.roverAt ?? at, at, t.dust);
  const dustFactor = stepDust(prev.dustFactor, { dt: seconds - prevSeconds, dustRate: setup.power.dustRate, stormIntensity, cleaned }, t.dust, t.sol?.secondsPerSol ?? 0);
  return { ...prev, dustFactor, devils, roverAt: at ?? prev.roverAt, weatherSince: mastOn ? prev.weatherSince ?? prevSeconds : null };
}

/** Mars: since when the weather mast has been switched on with the rover powered up (null: not now; always null on the Moon). */
export function weatherMastOnSince(state: MissionState): number | null {
  return state.mars?.weatherSince ?? null;
}

/**
 * Mars: what the weather mast reads from at a mission time (the time of day, the storm and the haze ahead
 * of it), for rules/instruments.ts weatherReadout. Null on the Moon or without tuning.instruments.weather.
 */
export function marsWeatherSky(seconds: number, setup: MissionSetup, t: Tuning): WeatherSky | null {
  const m = setup.mars;
  if (!m || !t.sol || !t.instruments.weather) return null;
  const at = Math.max(0, seconds);
  return {
    localSolarHours: solClock(at, t.sol, m.site.latitudeDeg).localSolarHours,
    stormIntensity: stormIntensity(at, m.storm, m.stormSpec),
    haze: stormHaze(at, m.storm, m.stormSpec?.rampSeconds ?? 0, t.instruments.weather),
  };
}

/** The parts still on the rover: deployed stations have left it. */
export function partsAboard(parts: Part[], deployed: readonly Instrument[]): Part[] {
  return parts.filter((p) => !(p.effects.instrument && deployed.includes(p.effects.instrument)));
}

/**
 * The setup after stations were set down: stats (mass, speed, energy per meter, sinkage), overload and
 * the instruments aboard are recomputed from the parts still aboard. `parts` is the full launch build;
 * the events are kept (the same list, so the event stages still line up), and on Mars the site and the
 * dust storm (the same object, so the night, cold and storm rules carry on).
 */
export function deployPart(setup: MissionSetup, parts: Part[], deployed: readonly Instrument[], tuning: Tuning): MissionSetup {
  return missionSetup(partsAboard(parts, deployed), tuning, setup.events, setup.mars);
}

/** The low-energy warning level: tuning.energy.lowWarningShare of the battery. */
export function lowEnergyLevel(setup: MissionSetup, t: Tuning): number {
  return setup.stats.batteryCapacity * t.energy.lowWarningShare;
}

/** True when the battery is below the low-energy warning level (the HUD warning shows). */
export function isLowEnergy(s: MissionState, setup: MissionSetup, t: Tuning): boolean {
  return s.energy < lowEnergyLevel(setup, t);
}

/** Energy per second the switched-on instruments draw while the rover is powered up. */
export function standbyDraw(s: MissionState, setup: MissionSetup): number {
  return setup.instruments.reduce((sum, c) => sum + (s.standbyOn.includes(c.instrument) ? c.standbyEnergy : 0), 0);
}

/** True for an instrument aboard that is switched on and off (it has a standby draw) rather than used. */
export function isSwitchInstrument(instrument: Instrument, setup: MissionSetup): boolean {
  return setup.instruments.find((c) => c.instrument === instrument)?.mode === 'switch';
}

export type InstrumentRefusal =
  | 'ended'
  | 'deployed' // the station is already on the ground
  | 'not-carried'
  | 'busy' // another held use is still going
  | 'powered-down'
  | 'moving' // a held use needs the rover stopped
  | 'no-earth' // needs Earth above the horizon from the rover
  | 'no-boulder' // needs a boulder within reach
  | 'slope' // a contact reading (the arm) on ground steeper than tuning.instruments.arm.slopeLimitDeg
  | 'no-target' // a remote reading (the mast) with no target in the cone ahead
  | 'energy' // the use would empty the battery
  | 'low-energy'; // switching on a standby draw at or below the low-energy warning

export type StandbySwitch = { ok: true; state: MissionState } | { ok: false; reason: Extract<InstrumentRefusal, 'ended' | 'not-carried' | 'low-energy'> };

/**
 * Switch a standby instrument on or off. Switching on is refused while the battery is at or below
 * the low-energy warning level (stepMission switches standby off there and never lets its draw take the
 * battery lower, so standby never ends the mission).
 * Switching on while powered down is allowed: it draws nothing until power-up. An instrument that
 * is not a switch counts as not carried.
 */
export function setStandby(s: MissionState, instrument: Instrument, on: boolean, setup: MissionSetup, t: Tuning): StandbySwitch {
  if (s.end) return { ok: false, reason: 'ended' };
  if (!isSwitchInstrument(instrument, setup)) return { ok: false, reason: 'not-carried' };
  if (s.standbyOn.includes(instrument) === on) return { ok: true, state: s };
  if (on && s.energy <= lowEnergyLevel(setup, t)) return { ok: false, reason: 'low-energy' };
  return { ok: true, state: { ...s, standbyOn: on ? [...s.standbyOn, instrument] : s.standbyOn.filter((i) => i !== instrument) } };
}

/** What the mission screen measured for an instrument use. */
export interface UseConditions {
  speedMps: number;
  inColdZone: boolean;
  sunlight: number; // 0..1 at the rover
  earthInView?: boolean; // Earth above the terrain horizon from the rover (needsEarth instruments)
  boulderInReach?: boolean; // a boulder within tuning.instruments.xray.reachM (needsBoulder instruments)
  boulder?: number | null; // which boulder that is (index in the boulder list): a held use keeps it in its site; for a remote reading, the boulder it aims at
  inDarkCrater?: boolean; // inside the dark crater (the shadowed-crater zone)
  slopeDeg?: number; // the ground under the rover (contact readings on a world with tuning.instruments.arm)
  remoteTarget?: 'boulder' | 'cliff' | null; // what a remote reading would aim at now (rules/instruments.ts laserTarget)
}

export type InstrumentStart =
  | { ok: true; state: MissionState; holdSeconds: number; slowedByCold: boolean; fasterInShadow: boolean; cost: number }
  | { ok: false; reason: InstrumentRefusal; cost: number };

/**
 * Start using an instrument (not a switch: see setStandby): checks power, speed, conditions and
 * energy, charges the energy per use at once, and returns how long the rover holds still: its
 * useSeconds, times tuning.instruments.coldSlowdown in a cold zone on a rover without a heater
 * (cold-tolerant parts excepted), times its shadowHoldFactor when the rover is in shadow; 0 for an
 * instant use. A held use is tracked in state.using and finishes with an 'instrument-done' notice
 * from stepMission. A use is refused when its energy would empty the battery, so an instrument never
 * ends the mission by itself. A deployed station cannot be used again.
 */
export function startInstrumentUse(
  s: MissionState,
  instrument: Instrument,
  sample: UseConditions,
  setup: MissionSetup,
  t: Tuning,
): InstrumentStart {
  const c = setup.instruments.find((x) => x.instrument === instrument);
  const cost = c?.energyPerUse ?? 0;
  const refuse = (reason: InstrumentRefusal): InstrumentStart => ({ ok: false, reason, cost });
  if (s.end) return refuse('ended');
  if (s.deployed.includes(instrument)) return refuse('deployed');
  if (!c || c.mode === 'switch') return refuse('not-carried');
  const held = c.useSeconds > 0;
  if (held && s.using) return refuse('busy');
  if (s.poweredDown) return refuse('powered-down');
  if (held && sample.speedMps > t.ground.movingSpeedMps) return refuse('moving');
  if (c.needsEarth && !sample.earthInView) return refuse('no-earth');
  const contact = setup.contact.includes(instrument);
  const remote = setup.remote.includes(instrument);
  if ((c.needsBoulder || contact) && !sample.boulderInReach) return refuse('no-boulder');
  const arm = t.instruments.arm;
  if (contact && arm && (sample.slopeDeg ?? 0) > arm.slopeLimitDeg) return refuse('slope');
  if (remote && !sample.remoteTarget) return refuse('no-target');
  if (cost > 0 && s.energy <= cost) return refuse('energy');
  // The heat that counts now (an electric heater's only while its draw is paid), as in the freeze step.
  const slowedByCold = held && sample.inColdZone && heatNow(setup.heat, setup.power.electricHeat, s.energy) <= 0 && !c.coldTolerant;
  const fasterInShadow = held && c.shadowHoldFactor !== 1 && sample.sunlight < t.instruments.shadowSunlight;
  const holdSeconds = held ? c.useSeconds * (slowedByCold ? t.instruments.coldSlowdown : 1) * (fasterInShadow ? c.shadowHoldFactor : 1) : 0;
  const site: UseSite = {
    boulder: sample.boulder ?? null, inDarkCrater: sample.inDarkCrater ?? false, slowedByCold, fasterInShadow,
    ...(remote && sample.remoteTarget ? { target: sample.remoteTarget } : {}),
  };
  // A use charged as it runs pays energyPerUse spread over its actual hold (stepMission), nothing now, so a
  // hold slowed by the cold or sped up in shadow still costs energyPerUse in all; it starts only when the
  // battery holds the whole reading's energy, as any use.
  const chargePerSecond = held && holdSeconds > 0 && t.instruments.chargedWhileHeld?.includes(instrument) ? cost / holdSeconds : 0;
  const using = held ? { instrument, secondsLeft: holdSeconds, ...(holdSeconds !== c.useSeconds ? { totalSeconds: holdSeconds } : {}), site, ...(chargePerSecond > 0 ? { chargePerSecond } : {}) } : s.using;
  const state: MissionState = { ...s, energy: s.energy - (chargePerSecond > 0 ? 0 : cost), using };
  return { ok: true, state, holdSeconds, slowedByCold, fasterInShadow, cost };
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
  if ((sample.inColdZone || marsNight) && s.freeze > 0) w.push('cold');
  if (slip > t.ground.slipLimit) w.push('slip');
  if (sample.slopeDeg >= t.ground.slopeWarningDegrees && sample.speedMps > t.ground.movingSpeedMps) w.push('steepSlope');
  if (isLowEnergy(s, setup, t)) w.push('lowEnergy');
  if (s.damage >= t.damage.max * t.damage.highWarningShare) w.push('highDamage');
  if (s.poweredDown) w.push('poweredDown');
  return w;
}
