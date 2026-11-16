// Unit tests for the Mars day-and-night rules: night energy, no driving at night without lights,
// map-wide night cold, and how stepMission applies them (fixed test numbers, not data/mars).
import { describe, expect, it } from 'vitest';
import { canDriveMars, lowSunFactor, nightDraw } from './energy';
import { marsFreezeRate, marsSecondsToFreeze } from './cold';
import { testParts, testTuning, testEvents } from './testData';
import { selectedParts } from './rover';
import { marsStatus, missionSetup, missionWarnings, startMission, stepMission, type MarsNotice, type MarsSetup, type MissionSample, type MissionState } from './mission';
import type { NightTuning, SolTuning } from './marsTypes';
import type { Build, Part, Tuning } from './types';

const night: NightTuning = {
  awakeDrainPerSecond: 1,
  sleepDrainPerSecond: 0.2,
  driveWithoutLights: false,
  freezeRatePerSecond: 8,
  warmRecoveryPerSecond: 6,
  fullSunElevationDeg: 30,
};
const sol: SolTuning = { sols: 10, secondsPerSol: 60, daySeconds: 45, nightSeconds: 15, solarLongitudeDeg: 200, horizonRateShare: 0.25 };
const cold = { ...testTuning.cold, heaterReductionPerHeat: 1.5, freezeMax: 100 };
const t: Tuning = { ...testTuning, mission: { lengthSeconds: 600, gameDays: 10, gravity: 3.71 }, cold, sol, night };

describe('Mars night energy', () => {
  it('charges at the full rate only with the Sun high, nothing with it down', () => {
    expect(lowSunFactor(-1, night)).toBe(0);
    expect(lowSunFactor(0, night)).toBe(0);
    expect(lowSunFactor(10, night)).toBeCloseTo(Math.sin(10 * Math.PI / 180) / 0.5, 9);
    expect(lowSunFactor(30, night)).toBeCloseTo(1, 9);
    expect(lowSunFactor(60, night)).toBe(1);
    expect(lowSunFactor(5, { ...night, fullSunElevationDeg: 0 })).toBe(1);
  });

  it('drains fast with lights on, slowly asleep, and not at all by day (the LED owns the lights draw)', () => {
    const led = { lightsDraw: 3, heaterDraw: 0 };
    const at = (isNight: boolean, poweredDown: boolean, hasLights: boolean) => nightDraw(led, { isNight, poweredDown, hasLights }, night);
    expect(at(false, false, true)).toBe(0);
    expect(at(true, false, true)).toBe(4);
    expect(at(true, false, false)).toBe(1);
    expect(at(true, true, true)).toBe(0.2);
  });

  it('adds an electric heater draw every second of night, asleep too, and nothing by day', () => {
    const heated = { lightsDraw: 3, heaterDraw: 1.2 };
    expect(nightDraw(heated, { isNight: true, poweredDown: true, hasLights: true }, night)).toBeCloseTo(1.4, 9);
    expect(nightDraw(heated, { isNight: true, poweredDown: false, hasLights: true }, night)).toBeCloseTo(5.2, 9);
    expect(nightDraw(heated, { isNight: true, poweredDown: false, hasLights: false }, night)).toBeCloseTo(2.2, 9);
    expect(nightDraw(heated, { isNight: false, poweredDown: false, hasLights: true }, night)).toBe(0);
  });

  it('forbids driving at night without lights, and while asleep', () => {
    expect(canDriveMars(false, false, false, night)).toBe(true);
    expect(canDriveMars(true, false, true, night)).toBe(true);
    expect(canDriveMars(true, false, false, night)).toBe(false);
    expect(canDriveMars(true, false, false, { ...night, driveWithoutLights: true })).toBe(true);
    expect(canDriveMars(false, true, true, night)).toBe(false);
  });
});

describe('Mars night cold', () => {
  it('freezes everywhere at night, slowed by the heater and the storm, and recovers by day', () => {
    expect(marsFreezeRate(true, 0, 1, cold, night)).toBe(8);
    expect(marsFreezeRate(true, 2, 1, cold, night)).toBe(5);
    expect(marsFreezeRate(true, 2, 0.5, cold, night)).toBe(2.5);
    expect(marsFreezeRate(true, 10, 1, cold, night)).toBe(0);
    expect(marsFreezeRate(false, 0, 1, cold, night)).toBe(-6);
  });

  it('freezes an unheated rover before dawn; a radioisotope heater lasts the night', () => {
    expect(marsSecondsToFreeze(0, cold, night)).toBeLessThan(sol.nightSeconds);
    expect(marsSecondsToFreeze(2, cold, night)).toBeGreaterThan(sol.nightSeconds);
    expect(marsSecondsToFreeze(100, cold, night)).toBe(Infinity);
  });
});

// stepMission with a Mars setup: the fixed test parts with drive effects added.
const build: Build = { chassis: 'titanium', wheels: 'mesh', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', payload: ['camera'] };
function partsWith(changes: Partial<Record<Part['slot'], Part['effects']>>): Part[] {
  return selectedParts(build, testParts).map((p) => {
    const base: Partial<Record<Part['slot'], Part['effects']>> = {
      wheels: { baseSpeed: 3, grip: 0.8, energyPerMeter: 0.2 },
      power: { energyIncome: 1 },
      battery: { batteryCapacity: 400 },
      lights: { lightRange: 20, lightsDraw: 3 },
      heater: { heat: 2 },
    };
    const e = changes[p.slot] ?? base[p.slot];
    return e ? { ...p, effects: e } : p;
  });
}
const site = { latitudeDeg: 18.4447, longitudeDeg: 77.4508 };
const storm = { forecastAt: 140, startAt: 200, endAt: 320 };
const mars: MarsSetup = { site, storm, stormSpec: { windowsSeconds: [[180, 360]], warningSeconds: 60, durationSeconds: 120, rampSeconds: 10, solarFactor: 0.33, freezeFactor: 0.5, source: '' } };

const idle: MissionSample = {
  dt: 0.25, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 1, inColdZone: false, softness: 0,
  throttling: false, impactMps: 0, upY: 1,
};

function runMars(parts: Part[], seconds: number, onStep?: (s: MissionState) => Partial<MissionState>) {
  const setup = missionSetup(parts, t, [], mars);
  let s = startMission(setup);
  const notices: MarsNotice[] = [];
  while (s.seconds < seconds && !s.end) {
    s = { ...s, ...(onStep?.(s) ?? {}) };
    const step = stepMission(s, idle, setup, t, testEvents);
    s = step.state;
    notices.push(...step.marsNotices);
  }
  return { state: s, notices, setup };
}

describe('Mars mission step', () => {
  it('leaves the Moon alone: no Mars setup, no Mars notices or status', () => {
    const setup = missionSetup(partsWith({}), t, []);
    expect(setup.mars).toBeUndefined();
    const step = stepMission(startMission(setup), { ...idle, dt: 60 }, setup, t, testEvents);
    expect(step.marsNotices).toEqual([]);
    expect(step.state.energy).toBe(400); // full battery, no night drain
    expect(marsStatus(step.state, setup, t)).toBeNull();
  });

  it('announces sunset and dawn, and wakes a sleeping rover at dawn', () => {
    const { notices, state } = runMars(partsWith({}), 61, (s) => (s.seconds >= 45 && s.seconds < 46 ? { poweredDown: true } : {}));
    expect(notices).toEqual([{ kind: 'dusk' }, { kind: 'dawn', woke: true }]);
    expect(state.poweredDown).toBe(false);
  });

  it('has no solar income at night and drains the night drain', () => {
    const setup = missionSetup(partsWith({}), t, [], mars);
    const dusk = { ...startMission(setup), seconds: 46, energy: 200 };
    const awake = stepMission(dusk, { ...idle, dt: 1 }, setup, t, testEvents).state;
    expect(awake.energy).toBeCloseTo(196, 9); // lights on, sunlight ignored
    const asleep = stepMission({ ...dusk, poweredDown: true }, { ...idle, dt: 1 }, setup, t, testEvents).state;
    expect(asleep.energy).toBeCloseTo(199.8, 9);
  });

  it('charges less with a low Sun and in the storm', () => {
    const setup = missionSetup(partsWith({}), t, [], mars);
    const gain = (seconds: number) => {
      const s = { ...startMission(setup), seconds, energy: 100 };
      return stepMission(s, { ...idle, dt: 0.01 }, setup, t, testEvents).state.energy - 100;
    };
    expect(gain(22.5)).toBeCloseTo(0.01, 6); // noon of sol 1: full rate
    expect(gain(1)).toBeLessThan(0.005); // just after sunrise
    expect(gain(262.5)).toBeCloseTo(0.0033, 6); // noon inside the storm
  });

  it('runs out of energy at night like on the Moon', () => {
    const { state } = runMars(partsWith({ battery: { batteryCapacity: 30 } }), 600);
    expect(state.end?.cause).toBe('energy');
    expect(marsStatus(state, runMars(partsWith({}), 0).setup, t)?.clock.isNight).toBe(true);
  });

  it('freezes an unheated rover on its first night', () => {
    const { state } = runMars(partsWith({ heater: {} }), 600, (s) => (s.seconds >= 45 ? { poweredDown: true } : {}));
    expect(state.end?.cause).toBe('froze');
    expect(state.end?.seconds).toBeCloseTo(45 + 100 / 8, 0);
  });

  it('reports the dust storm forecast, start and end', () => {
    const { notices } = runMars(partsWith({}), 330);
    expect(notices.filter((n) => n.kind === 'storm')).toEqual([
      { kind: 'storm', edge: 'forecast' },
      { kind: 'storm', edge: 'started' },
      { kind: 'storm', edge: 'cleared' },
    ]);
  });

  it('gives the HUD and the scene one status per frame', () => {
    const setup = missionSetup(partsWith({ lights: {} }), t, [], mars);
    const at = (seconds: number, poweredDown = false) => marsStatus({ ...startMission(setup), seconds, poweredDown }, setup, t)!;
    expect(at(22.5)).toMatchObject({ canDrive: true, lightsOn: false, drainPerSecond: 0, stormPhase: 'none', stormIntensity: 0 });
    expect(at(22.5).clock.sol).toBe(1);
    expect(at(22.5).sun.elevationDeg).toBeGreaterThan(60);
    expect(at(50)).toMatchObject({ canDrive: false, lightsOn: false, drainPerSecond: 1, solarFactor: 0 });
    expect(at(50, true)).toMatchObject({ canDrive: false, drainPerSecond: 0.2 });
    expect(at(260)).toMatchObject({ stormPhase: 'active', stormIntensity: 1 });
    expect(at(260).solarFactor).toBeCloseTo(0.33, 2);
    const lit = missionSetup(partsWith({}), t, [], mars);
    expect(marsStatus({ ...startMission(lit), seconds: 50 }, lit, t)).toMatchObject({ canDrive: true, lightsOn: true, drainPerSecond: 4 });
  });

  it('shows the cold warning at night on Mars while the meter is up', () => {
    const setup = missionSetup(partsWith({}), t, [], mars);
    const s = { ...startMission(setup), seconds: 50, freeze: 20 };
    expect(missionWarnings(s, idle, 0, false, setup, t)).toContain('cold');
    expect(missionWarnings({ ...s, seconds: 10 }, idle, 0, false, setup, t)).not.toContain('cold');
  });
});
