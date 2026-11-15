// The mission loop's rules: one step combines energy, damage, cold, soft ground, events and the end
// conditions. The mission screen measures the rover (MissionSample), calls stepMission, and draws
// the result. Pure: no rendering, no physics.
import type { DeathCause, EventsFile, Part, RealFlare, Tuning } from './types';
import { driveStats, type DriveStats } from './drive';
import { roverTotals } from './rover';
import { driveEnergy, solarIncome } from './energy';
import { impactDamage, overloadDamage, steepSlopeDamage, tiltDeg, type DamageCause } from './damage';
import { stepFreeze } from './cold';
import { stepDig, wheelSlip } from './ground';
import { flareDamage, flareProtected, type MissionEvent } from './events';

/** What the parts mean for the mission systems. */
export interface MissionSetup {
  stats: DriveStats;
  heat: number;
  hasLights: boolean;
  overloadKg: number; // total mass above the chassis maximum load
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

  // Energy
  const used = prev.poweredDown ? 0 : driveEnergy(s.distanceM, s.uphillDeg, stats.energyPerMeter, t.energy);
  state.energy = Math.min(stats.batteryCapacity, prev.energy - used + solarIncome(stats.energyIncome, s.sunlight, s.dt));
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
      const damage = events.quake?.damage ?? 0;
      hurt('quake', damage);
      notices.push({ kind: 'quake', damage });
    }
  });
  state.eventStages = stages;
  state.damage = Math.min(t.damage.max, state.damage);
  state.energy = Math.max(0, state.energy);

  state.end = missionEnd(state, t);
  return { state, slip, notices };
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
  if (s.energy < setup.stats.batteryCapacity * t.energy.lowWarningShare) w.push('lowEnergy');
  if (s.damage >= t.damage.max * t.damage.highWarningShare) w.push('highDamage');
  if (s.poweredDown) w.push('poweredDown');
  return w;
}
