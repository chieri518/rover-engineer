// The mission loop's rules: one step combines energy, damage, cold, soft ground, events and the end
// conditions. The mission screen measures the rover (MissionSample), calls stepMission, and draws
// the result. Pure: no rendering, no physics.
import type { DeathCause, EventsFile, Instrument, Part, RealFlare, Tuning } from './types';
import { driveStats, type DriveStats } from './drive';
import { roverTotals } from './rover';
import { driveEnergy, solarIncome } from './energy';
import { impactDamage, overloadDamage, steepSlopeDamage, tiltDeg, type DamageCause } from './damage';
import { stepFreeze } from './cold';
import { stepDig, wheelSlip } from './ground';
import { flareDamage, flareProtected, type MissionEvent } from './events';
import { instrumentCosts, type InstrumentCosts } from './payload';

/** What the parts mean for the mission systems. */
export interface MissionSetup {
  stats: DriveStats;
  heat: number;
  hasLights: boolean;
  overloadKg: number; // total mass above the chassis maximum load
  instruments: InstrumentCosts[]; // the payload still aboard, in bay order (deployed stations leave it)
  events: MissionEvent[];
}

export function missionSetup(parts: Part[], tuning: Tuning, events: MissionEvent[]): MissionSetup {
  const { mass } = roverTotals(parts);
  const maxLoad = parts.find((p) => p.slot === 'chassis')?.effects.maxLoad;
  return {
    stats: driveStats(parts, tuning),
    heat: parts.reduce((s, p) => s + (p.effects.heat ?? 0), 0),
    hasLights: parts.some((p) => (p.effects.lightRange ?? 0) > 0),
    overloadKg: maxLoad === undefined ? 0 : Math.max(0, mass - maxLoad),
    instruments: instrumentCosts(parts),
    events,
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
  standbyOn: Instrument[]; // instruments switched on (each draws its standby energy while the rover is powered up)
  using: { instrument: Instrument; secondsLeft: number } | null; // an instrument use the rover holds still for (paused while powered down)
  deployed: Instrument[]; // stations set down on the ground, in the order deployed (they left the rover)
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
  | { kind: 'impact'; damage: number }
  | { kind: 'instrument-done'; instrument: Instrument; deployed: boolean } // a held instrument use finished (deployed: a station was set down)
  | { kind: 'standby-off'; instruments: Instrument[] }; // the battery fell to the low-energy warning: switched-on instruments were switched off

export interface MissionStep {
  state: MissionState;
  slip: number; // current wheel slip, 0..1
  notices: MissionNotice[];
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
  };
}

export function stepMission(prev: MissionState, s: MissionSample, setup: MissionSetup, t: Tuning, events: EventsFile): MissionStep {
  const stats = setup.stats;
  const driving = !prev.poweredDown && s.speedMps > t.ground.movingSpeedMps;
  const slip = s.throttling ? wheelSlip(s.softness, stats.massKg, stats.grip, s.uphillDeg, t) : 0;
  if (prev.end) return { state: prev, slip, notices: [] };

  const state: MissionState = { ...prev, damageBy: { ...prev.damageBy } };
  const notices: MissionNotice[] = [];
  const hurt = (cause: DamageCause, amount: number) => {
    if (amount <= 0) return;
    state.damage += amount;
    state.damageBy[cause] += amount;
  };

  state.seconds = Math.min(t.mission.lengthSeconds, prev.seconds + s.dt);

  // Energy: driving and instruments on standby (nothing while powered down), against solar income.
  // Standby never ends the mission by itself: its draw never takes the battery below the low-energy
  // warning level; when it would, the switched-on instruments switch off (with a notice).
  const drive = prev.poweredDown ? 0 : driveEnergy(s.distanceM, s.uphillDeg, stats.energyPerMeter, t.energy);
  const afterDrive = Math.min(stats.batteryCapacity, prev.energy - drive + solarIncome(stats.energyIncome, s.sunlight, s.dt));
  const standby = prev.poweredDown ? 0 : standbyDraw(prev, setup) * s.dt;
  const aboveLow = Math.max(0, afterDrive - lowEnergyLevel(setup, t));
  let standbyOff = false;
  if (prev.standbyOn.length > 0 && !prev.poweredDown && (standby >= aboveLow || aboveLow <= 0)) standbyOff = true;
  state.energy = afterDrive - Math.min(standby, aboveLow);
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
  state.freeze = stepFreeze(prev.freeze, s.inColdZone, setup.heat, s.dt, t.cold);
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
      hurt('quake', events.quake.damage);
      notices.push({ kind: 'quake', damage: events.quake.damage });
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
  if (prev.using && !prev.poweredDown) {
    const secondsLeft = prev.using.secondsLeft - s.dt;
    state.using = secondsLeft > 1e-9 ? { ...prev.using, secondsLeft } : null;
    if (!state.using && !state.end) {
      const inst = prev.using.instrument;
      const deploy = setup.instruments.find((c) => c.instrument === inst)?.mode === 'deploy';
      if (deploy) state.deployed = [...prev.deployed, inst];
      notices.push({ kind: 'instrument-done', instrument: inst, deployed: deploy });
    }
  }
  return { state, slip, notices };
}

/** The parts still on the rover: deployed stations have left it. */
export function partsAboard(parts: Part[], deployed: readonly Instrument[]): Part[] {
  return parts.filter((p) => !(p.effects.instrument && deployed.includes(p.effects.instrument)));
}

/**
 * The setup after stations were set down: stats (mass, speed, energy per meter, sinkage), overload and
 * the instruments aboard are recomputed from the parts still aboard. `parts` is the full launch build;
 * the events are kept (the same list, so the event stages still line up).
 */
export function deployPart(setup: MissionSetup, parts: Part[], deployed: readonly Instrument[], tuning: Tuning): MissionSetup {
  return missionSetup(partsAboard(parts, deployed), tuning, setup.events);
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
  if (c.needsBoulder && !sample.boulderInReach) return refuse('no-boulder');
  if (cost > 0 && s.energy <= cost) return refuse('energy');
  const slowedByCold = held && sample.inColdZone && setup.heat <= 0 && !c.coldTolerant;
  const fasterInShadow = held && c.shadowHoldFactor !== 1 && sample.sunlight < t.instruments.shadowSunlight;
  const holdSeconds = held ? c.useSeconds * (slowedByCold ? t.instruments.coldSlowdown : 1) * (fasterInShadow ? c.shadowHoldFactor : 1) : 0;
  const state: MissionState = { ...s, energy: s.energy - cost, using: held ? { instrument, secondsLeft: holdSeconds } : s.using };
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
  if (sample.inColdZone && s.freeze > 0) w.push('cold');
  if (slip > t.ground.slipLimit) w.push('slip');
  if (sample.slopeDeg >= t.ground.slopeWarningDegrees && sample.speedMps > t.ground.movingSpeedMps) w.push('steepSlope');
  if (isLowEnergy(s, setup, t)) w.push('lowEnergy');
  if (s.damage >= t.damage.max * t.damage.highWarningShare) w.push('highDamage');
  if (s.poweredDown) w.push('poweredDown');
  return w;
}
