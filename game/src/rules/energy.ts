// Energy: battery, solar income and drive cost. Pure, no physics.
import type { Part, Tuning } from './types';
import type { NightTuning } from './marsTypes';
import { roverDustRate } from './dust';

const DEG = Math.PI / 180;

/**
 * Energy to drive `distanceM` game meters. energyPerMeter already includes the mass penalty
 * (drive.ts); climbing adds slopeEnergyFactor per degree of uphill grade. Downhill costs the flat rate.
 */
export function driveEnergy(distanceM: number, uphillDeg: number, energyPerMeter: number, energy: Tuning['energy']): number {
  return Math.max(0, distanceM) * energyPerMeter * (1 + energy.slopeEnergyFactor * Math.max(0, uphillDeg));
}

/** Solar income over dt seconds: the power source's full-sun income times the share of the Sun's disc visible. */
export function solarIncome(energyIncome: number, sunlight: number, dt: number): number {
  return energyIncome * Math.min(Math.max(sunlight, 0), 1) * dt;
}

/** Constant-power income over dt seconds (PartEffects.constantPower): day and night, asleep or awake, regardless of the Sun. */
export function constantPowerIncome(constantPower: number, dt: number): number {
  return Math.max(0, constantPower) * dt;
}

/** How far the battery alone drives on flat ground (game meters). Shown on the design screen. */
export function flatRangeM(batteryCapacity: number, energyPerMeter: number): number {
  return energyPerMeter > 0 ? batteryCapacity / energyPerMeter : Infinity;
}

// ---------------------------------------------------------------------------------------------------
// Mars: day and night (data/mars/tuning.json `night`).

/**
 * Share of a panel's full-sun rate at this Sun elevation: sin(el) / sin(fullSunElevationDeg), capped at 1,
 * 0 with the Sun down. Low Sun means slow charging in the morning and evening.
 */
export function lowSunFactor(elevationDeg: number, night: NightTuning): number {
  if (elevationDeg <= 0) return 0;
  if (night.fullSunElevationDeg <= 0) return 1;
  return Math.min(1, Math.sin(elevationDeg * DEG) / Math.sin(night.fullSunElevationDeg * DEG));
}

/**
 * The power the parts own (Mars M1), summed over the rover's parts. Applied only on a world whose tuning
 * has a `night` section (Mars). A panel's energyIncome is effectively net: the Moon has no idle drain, so
 * the daytime draw is folded into the panel's rating. At night, with no solar income, the hidden draws
 * appear: the electronics (the world's, NightTuning), the lights and an electric heater (the parts').
 */
export interface PartPower {
  lightsDraw: number; // energy/s while the floodlights are on (awake at night with lights)
  heaterDraw: number; // energy/s every second of night, awake and asleep
  steadyIncome: number; // energy/s day and night, never scaled by sunlight, the low Sun, the storm, shadow or dust
  electricHeat: number; // the heat of the parts that draw for it: it counts only while the draw is paid (rules/cold.ts heatNow)
  dustRate: number; // the rover's dust rate (rules/dust.ts roverDustRate): 0 without solar income
}

export function partPower(parts: Part[]): PartPower {
  const sum = (f: (p: Part) => number | undefined) => parts.reduce((s, p) => s + Math.max(0, f(p) ?? 0), 0);
  return {
    lightsDraw: sum((p) => p.effects.lightsDraw),
    heaterDraw: sum((p) => p.effects.heaterDraw),
    steadyIncome: sum((p) => p.effects.steadyIncome),
    electricHeat: sum((p) => ((p.effects.heaterDraw ?? 0) > 0 ? p.effects.heat : 0)),
    dustRate: roverDustRate(parts.map((p) => p.effects)),
  };
}

/** What decides the night draw at this moment. */
export interface NightDrawState {
  isNight: boolean;
  poweredDown: boolean;
  hasLights: boolean; // the rover carries lights: awake at night they are on
}

/**
 * Battery drain per second at night, apart from driving and instrument standby: the electronics (awake or
 * asleep, the world's), the lights while awake (the parts' lightsDraw) and an electric heater, asleep too
 * (heaterDraw). No drain by day. Not capped: an empty battery at night ends the mission.
 */
export function nightDraw(power: Pick<PartPower, 'lightsDraw' | 'heaterDraw'>, state: NightDrawState, night: NightTuning): number {
  if (!state.isNight) return 0;
  const electronics = state.poweredDown ? night.sleepDrainPerSecond : night.awakeDrainPerSecond;
  const lights = !state.poweredDown && state.hasLights ? power.lightsDraw : 0;
  return electronics + lights + power.heaterDraw;
}

/** One night's energy for the desk's night tile (Mars M15). */
export interface NightBudget {
  asleep: number; // the whole night powered down
  withLights: number | null; // the whole night awake with the lights on (parked); null without lights
  heater: number; // the electric heater's share of each of the above (0 without one)
  steady: number; // steady income earned over the night (an RTG)
  /** The battery's net change over the night (steady income minus draw): positive when the income covers it. */
  net: { asleep: number; withLights: number | null };
  /** The same net change as a rate: per second of night (net over the night's length). */
  rate: { asleep: number; withLights: number | null };
}

export function nightBudget(power: PartPower, hasLights: boolean, night: NightTuning, nightSeconds: number): NightBudget {
  const draw = (poweredDown: boolean) => nightDraw(power, { isNight: true, poweredDown, hasLights }, night) * nightSeconds;
  const steady = power.steadyIncome * nightSeconds;
  const asleep = draw(true);
  const withLights = hasLights ? draw(false) : null;
  const net = { asleep: steady - asleep, withLights: withLights === null ? null : steady - withLights };
  const perSecond = (x: number) => (nightSeconds > 0 ? x / nightSeconds : 0);
  return {
    asleep,
    withLights,
    heater: power.heaterDraw * nightSeconds,
    steady,
    net,
    rate: { asleep: perSecond(net.asleep), withLights: net.withLights === null ? null : perSecond(net.withLights) },
  };
}

/**
 * How a night's net change reads on the desk: 'gain' when steady income covers the night (net 0 or more),
 * 'empties' when the loss is at least the battery, 'large' when it is at least night.largeLossShare of it,
 * else 'small'. Without a battery (capacity null) a loss is always 'small': there is nothing to compare it with.
 */
export type NightNetState = 'gain' | 'small' | 'large' | 'empties';

export function nightNetState(net: number, batteryCapacity: number | null, night: NightTuning): NightNetState {
  if (net >= 0) return 'gain';
  if (batteryCapacity === null || batteryCapacity <= 0) return 'small';
  const loss = -net;
  if (loss >= batteryCapacity) return 'empties';
  if (night.largeLossShare !== undefined && loss >= batteryCapacity * night.largeLossShare) return 'large';
  return 'small';
}

/** Whether the rover may drive on Mars: never asleep, and at night only with lights (unless the night allows it). */
export function canDriveMars(isNight: boolean, poweredDown: boolean, hasLights: boolean, night: NightTuning): boolean {
  if (poweredDown) return false;
  return !isNight || hasLights || night.driveWithoutLights;
}
