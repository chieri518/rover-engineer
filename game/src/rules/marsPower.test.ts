// Mars step 2: the parts own their power draws (lights, an electric heater, an RTG's steady income), and dust
// on the panels (with dust devils) in the energy step. Fixture parts and fixed test numbers, except where a
// test names the real data (seeds, today's parts on the night budget, validation).
import { describe, expect, it } from 'vitest';
import { nightBudget, nightNetState, partPower } from './energy';
import { heatNow } from './cold';
import { testParts, testTuning, testEvents } from './testData';
import { meetsRequirements, selectedParts } from './rover';
import { deployPart, marsSetup, marsStatus, missionSetup, startMission, stepMission, type MarsSetup, type MissionSample, type MissionState } from './mission';
import { scheduleDustStorm } from './storm';
import { seededRng } from './events';
import { worldGameData } from '../gameData';
import { validateGameData } from './validate';
import type { DustDevilSpec, DustTuning, NightTuning, SolTuning } from './marsTypes';
import type { Build, Milestone, Part, Tuning } from './types';

const night: NightTuning = {
  awakeDrainPerSecond: 1, sleepDrainPerSecond: 0.2, driveWithoutLights: false, freezeRatePerSecond: 8, warmRecoveryPerSecond: 6, fullSunElevationDeg: 30,
};
const sol: SolTuning = { sols: 10, secondsPerSol: 60, daySeconds: 45, nightSeconds: 15, solarLongitudeDeg: 200, horizonRateShare: 0.25 };
const dust: DustTuning = { perSol: 0.03, stormMultiplier: 3, minFactor: 0.25, lessonLoss: 0.15, dustDevilCleanM: 50, dustDevilSenseM: 150 };
const cold = { ...testTuning.cold, heaterReductionPerHeat: 1.5, freezeMax: 100 };
const t: Tuning = { ...testTuning, mission: { lengthSeconds: 600, gameDays: 10, gravity: 3.71 }, cold, sol, night, dust };
const moon: Tuning = { ...testTuning, cold }; // no night section: the parts' draws and steady income never apply

// Fixture parts (the real RTG and electric heater arrive in Mars step 3).
const PANEL = { energyIncome: 1, dustRate: 1 };
const RTG = { steadyIncome: 0.6, heat: 2 }; // no energyIncome: dust, storm and shadow never touch it
const ELECTRIC = { heat: 3, heaterDraw: 1.2 };
const LAMP = { lightRange: 20, lightsDraw: 3 };

const build: Build = { chassis: 'titanium', wheels: 'mesh', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', payload: ['camera'] };
function partsWith(changes: Partial<Record<Part['slot'], Part['effects']>>): Part[] {
  const base: Partial<Record<Part['slot'], Part['effects']>> = {
    wheels: { baseSpeed: 3, grip: 0.8, energyPerMeter: 0.2 },
    power: PANEL,
    battery: { batteryCapacity: 400 },
    lights: LAMP,
    heater: { heat: 2 },
  };
  return selectedParts(build, testParts).map((p) => {
    const e = changes[p.slot] ?? base[p.slot];
    return e ? { ...p, effects: e } : p;
  });
}

const site = { latitudeDeg: 18.4447, longitudeDeg: 77.4508 };
const stormSpec = { windowsSeconds: [[180, 360]] as [number, number][], warningSeconds: 60, durationSeconds: 120, rampSeconds: 10, solarFactor: 0.33, freezeFactor: 0.5, source: '' };
const mars: MarsSetup = { site, storm: { forecastAt: 140, startAt: 200, endAt: 320 }, stormSpec };
const idle: MissionSample = {
  dt: 1, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 1, inColdZone: false, softness: 0, throttling: false, impactMps: 0, upY: 1,
};
const NOON = 22.5; // sol 1, clear
const STORM_NOON = 262.5; // sol 5, full storm
const NIGHT = 50; // sol 1

/** Energy gained over one step of `dt` from a state at `seconds`. */
function gain(parts: Part[], seconds: number, patch: Partial<MissionState> = {}, sample: Partial<MissionSample> = {}, tuning = t, m: MarsSetup | undefined = mars): number {
  const setup = missionSetup(parts, tuning, [], m);
  const s = { ...startMission(setup), seconds, energy: 200, ...patch };
  const dt = sample.dt ?? 0.01;
  return stepMission(s, { ...idle, dt, ...sample }, setup, tuning, testEvents).state.energy - 200;
}

describe('The parts own their draws (Mars M1)', () => {
  it('sums the draws, steady income, electric heat and dust rate over the parts', () => {
    expect(partPower(partsWith({}))).toEqual({ lightsDraw: 3, heaterDraw: 0, steadyIncome: 0, electricHeat: 0, dustRate: 1 });
    expect(partPower(partsWith({ power: RTG, heater: ELECTRIC }))).toEqual({ lightsDraw: 3, heaterDraw: 1.2, steadyIncome: 0.6, electricHeat: 3, dustRate: 0 });
    expect(missionSetup(partsWith({ power: RTG }), t, []).power.steadyIncome).toBe(0.6);
  });

  it('an RTG earns the same day and night, in the storm, in shadow and under dust', () => {
    const rtg = partsWith({ power: RTG, lights: {} });
    expect(gain(rtg, NOON, {}, { dt: 1 })).toBeCloseTo(0.6, 9);
    expect(gain(rtg, STORM_NOON, {}, { dt: 1 })).toBeCloseTo(0.6, 9);
    expect(gain(rtg, NOON, {}, { dt: 1, sunlight: 0 })).toBeCloseTo(0.6, 9);
    expect(gain(rtg, NOON, { mars: { dustFactor: 0.3, devils: [], roverAt: null } }, { dt: 1 })).toBeCloseTo(0.6, 9);
    // At night the electronics still draw: asleep 0.2, awake 1 (no lights).
    expect(gain(rtg, NIGHT, { poweredDown: true }, { dt: 1 })).toBeCloseTo(0.4, 9);
    expect(gain(rtg, NIGHT, {}, { dt: 1 })).toBeCloseTo(-0.4, 9);
  });

  it('an RTG rover sleeps through every night with a small battery and gains', () => {
    const setup = missionSetup(partsWith({ power: RTG, battery: { batteryCapacity: 50 } }), t, [], mars);
    let s: MissionState = { ...startMission(setup), energy: 10 };
    while (!s.end) s = stepMission({ ...s, poweredDown: marsStatus(s, setup, t)!.clock.isNight }, { ...idle, dt: 0.25 }, setup, t, testEvents).state;
    expect(s.end).toEqual({ survived: true, seconds: 600 });
    expect(s.energy).toBe(50);
  });

  it('an electric heater draws every second of night, asleep too', () => {
    const heated = partsWith({ heater: ELECTRIC });
    expect(gain(heated, NIGHT, { poweredDown: true }, { dt: 1 })).toBeCloseTo(-1.4, 9);
    expect(gain(heated, NIGHT, {}, { dt: 1 })).toBeCloseTo(-5.2, 9);
    expect(gain(heated, NOON, {}, { dt: 1 })).toBeCloseTo(1, 9); // by day only the panel
    const setup = missionSetup(heated, t, [], mars);
    expect(marsStatus({ ...startMission(setup), seconds: NIGHT, poweredDown: true }, setup, t)!.drainPerSecond).toBeCloseTo(1.4, 9);
  });

  it("an electric heater's heat counts only while the battery can pay its draw", () => {
    expect(heatNow(3, 3, 10)).toBe(3);
    expect(heatNow(3, 3, 0)).toBe(0);
    expect(heatNow(5, 3, 0)).toBe(2); // an RTG's waste heat stays
    const setup = missionSetup(partsWith({ heater: ELECTRIC }), t, [], mars);
    const at = (energy: number) => marsStatus({ ...startMission(setup), seconds: NIGHT, energy }, setup, t)!.freezeRate;
    expect(at(100)).toBeCloseTo(8 - 1.5 * 3, 9);
    expect(at(0)).toBe(8);
    const rhu = missionSetup(partsWith({}), t, [], mars);
    expect(marsStatus({ ...startMission(rhu), seconds: NIGHT, energy: 0 }, rhu, t)!.freezeRate).toBeCloseTo(8 - 1.5 * 2, 9);
  });

  it('an electric heater on a small battery empties it in the night, asleep; heater units do not', () => {
    const run = (heater: Part['effects']) => {
      const setup = missionSetup(partsWith({ heater, battery: { batteryCapacity: 10 } }), t, [], mars);
      let s: MissionState = { ...startMission(setup), seconds: 45, poweredDown: true };
      while (!s.end && s.seconds < 60) s = stepMission(s, { ...idle, dt: 0.1 }, setup, t, testEvents).state;
      return s;
    };
    const electric = run(ELECTRIC);
    expect(electric.end?.cause).toBe('energy');
    expect(electric.end!.seconds).toBeCloseTo(45 + 10 / 1.4, 0);
    expect(run({ heat: 2 }).end).toBeNull();
  });

  it('the lights draw only on Mars, awake at night with lights', () => {
    expect(gain(partsWith({}), NIGHT, {}, { dt: 1 })).toBeCloseTo(-4, 9);
    expect(gain(partsWith({ lights: {} }), NIGHT, {}, { dt: 1 })).toBeCloseTo(-1, 9);
    expect(gain(partsWith({}), NIGHT, { poweredDown: true }, { dt: 1 })).toBeCloseTo(-0.2, 9);
  });

  it('leaves the Moon unchanged: no draws, no steady income, no dust', () => {
    const allPower = partsWith({ power: { ...PANEL, ...RTG }, heater: ELECTRIC });
    expect(gain(allPower, NIGHT, {}, { dt: 1, sunlight: 0 }, moon, undefined)).toBe(0);
    expect(gain(allPower, NOON, {}, { dt: 1, sunlight: 0.5 }, moon, undefined)).toBeCloseTo(0.5, 9);
    const setup = missionSetup(allPower, moon, []);
    const step = stepMission(startMission(setup), { ...idle, dt: 60, sunlight: 0 }, setup, moon, testEvents);
    expect(step.state.mars).toBeUndefined();
    expect(step.state.energy).toBe(400);
    expect(marsStatus(step.state, setup, moon)).toBeNull();
  });

  it('keeps the draws and the Mars setup when a station is set down', () => {
    const parts = [...partsWith({ heater: ELECTRIC }), testParts.parts.find((p) => p.id === 'seismometer')!];
    const setup = missionSetup(parts, t, [], mars);
    const after = deployPart(setup, parts, ['seismometer'], t);
    expect(after.power).toEqual(setup.power);
    expect(after.mars).toBe(setup.mars);
  });

  it('meets a heater requirement with any heat (Mars M17)', () => {
    const night: Milestone = { id: 'n', name: 'n', category: 'capability', record: false, trigger: { type: 'landing' }, requires: { slots: ['heater'] }, money: 0, rp: 0, summary: '', fact: '' };
    expect(meetsRequirements(partsWith({ power: RTG, heater: {} }), night)).toBe(true);
    expect(meetsRequirements(partsWith({ heater: {} }), night)).toBe(false);
    expect(meetsRequirements(partsWith({}), night)).toBe(true);
  });
});

describe('Dust in the energy step', () => {
  const dusty = (dustFactor: number) => ({ mars: { dustFactor, devils: [], roverAt: null } });

  it('lowers solar income, not steady income', () => {
    const hybrid = partsWith({ power: { ...PANEL, ...RTG } });
    expect(gain(hybrid, NOON, {}, { dt: 1 })).toBeCloseTo(1.6, 9);
    expect(gain(hybrid, NOON, dusty(0.5), { dt: 1 })).toBeCloseTo(0.5 + 0.6, 9);
    expect(gain(partsWith({}), STORM_NOON, dusty(0.5), { dt: 1 })).toBeCloseTo(0.5 * 0.33, 9);
    expect(marsStatus({ ...startMission(missionSetup(hybrid, t, [], mars)), ...dusty(0.5) }, missionSetup(hybrid, t, [], mars), t)!.dustFactor).toBe(0.5);
  });

  /** The dust factor after running idle from `from` for `seconds`. */
  const settle = (parts: Part[], from: number, seconds: number, m: MarsSetup = mars, sample: Partial<MissionSample> = {}) => {
    const setup = missionSetup(parts, t, [], m);
    let s: MissionState = { ...startMission(setup), seconds: from, poweredDown: true };
    while (s.seconds < from + seconds - 1e-9 && !s.end) s = stepMission({ ...s, poweredDown: true }, { ...idle, dt: 0.25, ...sample }, setup, t, testEvents).state;
    return s.mars!;
  };

  it('settles every step, three times as fast in the full storm; never on an RTG rover', () => {
    expect(settle(partsWith({}), 0, 60).dustFactor).toBeCloseTo(1 - 0.03, 9);
    expect(settle(partsWith({}), 215, 60).dustFactor).toBeCloseTo(1 - 0.09, 9); // 215..275 is full storm
    expect(settle(partsWith({ power: { energyIncome: 1, dustRate: 0.8 } }), 0, 60).dustFactor).toBeCloseTo(1 - 0.024, 9);
    expect(settle(partsWith({ power: RTG }), 0, 120).dustFactor).toBe(1);
  });

  it('starts the Mars state on the first Mars step when the mission started before the Mars setup', () => {
    const moonSetup = missionSetup(partsWith({}), t, []);
    const s = startMission(moonSetup); // the mission screen starts before the terrain (and the Mars setup) loads
    expect(s.mars).toBeUndefined();
    const setup = missionSetup(partsWith({}), t, [], mars);
    expect(stepMission(s, idle, setup, t, testEvents).state.mars?.dustFactor).toBeCloseTo(1 - 0.03 / 60, 9);
  });

  const spec: DustDevilSpec = { everySols: 3, daySecondsWindow: [8, 24], lifeSeconds: 20, speedMps: 4, maxPassM: 300, rampSeconds: 3, radiusM: 6, heightM: 150, source: '' };
  const withDevil = (passM: number): MarsSetup => ({ ...mars, devils: [{ at: 100, passM, headingDeg: 90, side: 1 }], devilSpec: spec });

  it('a dust devil passing within the cleaning distance cleans the panels; a far one does not', () => {
    const at = { position: { x: 30, z: -40 } };
    const from = (factor: number, m: MarsSetup) => {
      const setup = missionSetup(partsWith({}), t, [], m);
      let s: MissionState = { ...startMission(setup), seconds: 95, ...dusty(factor) };
      while (s.seconds < 125) s = stepMission(s, { ...idle, dt: 0.25, ...at }, setup, t, testEvents).state;
      return s.mars!;
    };
    const near = from(0.7, withDevil(20));
    expect(near.devils).toHaveLength(1);
    expect(near.devils[0]!.at).toBe(100);
    expect(near.dustFactor).toBeGreaterThan(0.995); // cleaned at its pass (about 110 s), then settling again
    expect(near.roverAt).toEqual({ x: 30, z: -40 });
    const far = from(0.7, withDevil(120));
    expect(far.devils).toHaveLength(1);
    expect(far.dustFactor).toBeLessThan(0.7);
  });

  it('places no dust devil without the rover position (rules tests, the night-energy check)', () => {
    expect(settle(partsWith({}), 95, 30, withDevil(0)).devils).toEqual([]);
    expect(settle(partsWith({}), 95, 30, withDevil(0), { position: { x: 0, z: 0 } }).devils).toHaveLength(1);
  });
});

describe('Dust devils in the Mars setup (real data)', () => {
  const data = worldGameData('mars');

  it("keeps every seed's dust storm; the devils come from their own stream and replay exactly", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const setup = marsSetup(site, data.events, seededRng(seed), data.tuning);
      expect(setup.storm, `seed ${seed}`).toEqual(scheduleDustStorm(data.events, seededRng(seed)));
      expect(setup.storm).toEqual(marsSetup(site, data.events, seededRng(seed)).storm);
      expect(setup.devils!.length).toBeGreaterThanOrEqual(3);
      expect(setup.devils!.length).toBeLessThanOrEqual(4);
      expect(marsSetup(site, data.events, seededRng(seed), data.tuning).devils).toEqual(setup.devils);
      expect(setup.devilSpec).toBe(data.events.dustdevil);
    }
    expect(marsSetup(site, data.events, seededRng(1)).devils).toBeUndefined(); // without the sol clock
  });
});

describe('The night budget (Mars M15)', () => {
  const data = worldGameData('mars');
  const n = data.tuning.night!;
  const seconds = data.tuning.sol!.nightSeconds;
  const real = (id: string) => data.parts.parts.find((p) => p.id === id)!;
  const fixture = (slot: Part['slot'], effects: Part['effects']): Part => ({ id: `fixture-${slot}`, slot, name: '', description: '', cost: 0, mass: 0, size: 0, effects });

  it("gives today's numbers with today's parts: 3 asleep, 60 with lights", () => {
    const parts = ['power-fixed-panel', 'lights-led', 'heater-rhu'].map(real);
    expect(nightBudget(partPower(parts), true, n, seconds)).toEqual({
      asleep: expect.closeTo(3, 9), withLights: 60, heater: 0, steady: 0, net: { asleep: expect.closeTo(-3, 9), withLights: -60 },
    });
    expect(nightBudget(partPower([real('heater-rhu')]), false, n, seconds).withLights).toBeNull();
  });

  it('adds the electric heater to both and shows an RTG over the night', () => {
    const parts = [fixture('power', RTG), real('lights-led'), fixture('heater', ELECTRIC)];
    const b = nightBudget(partPower(parts), true, n, seconds);
    expect(b.asleep).toBeCloseTo(21, 9);
    expect(b.withLights).toBeCloseTo(78, 9);
    expect(b.heater).toBeCloseTo(18, 9);
    expect(b.steady).toBeCloseTo(9, 9);
    expect(b.net.asleep).toBeCloseTo(-12, 9);
    expect(b.net.withLights!).toBeCloseTo(-69, 9);
  });

  it('gives the net change over the night: an RTG covers a sleeping night, and none without lights', () => {
    const rtg = nightBudget(partPower([fixture('power', RTG), real('lights-led')]), true, n, seconds);
    expect(rtg.net.asleep).toBeCloseTo(6, 9); // 9 earned, 3 drawn
    expect(rtg.net.withLights!).toBeCloseTo(-51, 9); // 9 earned, 60 drawn
    expect(nightBudget(partPower([fixture('power', RTG)]), false, n, seconds).net.withLights).toBeNull();
  });

  it('states a night by its net change against the battery: gain, small, large (from largeLossShare), empties', () => {
    expect(n.largeLossShare).toBe(0.1);
    expect(nightNetState(6, 400, n)).toBe('gain');
    expect(nightNetState(0, 400, n)).toBe('gain'); // covered exactly
    expect(nightNetState(-21, 400, n)).toBe('small');
    expect(nightNetState(-39.9, 400, n)).toBe('small');
    expect(nightNetState(-40, 400, n)).toBe('large');
    expect(nightNetState(-78, 400, n)).toBe('large');
    expect(nightNetState(-399, 400, n)).toBe('large');
    expect(nightNetState(-400, 400, n)).toBe('empties');
    expect(nightNetState(-500, 400, n)).toBe('empties');
    expect(nightNetState(-78, null, n)).toBe('small'); // no battery chosen: nothing to compare with
    expect(nightNetState(-78, 400, { ...n, largeLossShare: undefined })).toBe('small');
  });
});

describe('Mars power and dust validation', () => {
  const data = worldGameData('mars');

  it('needs a dustRate on every solar part on a world with dust, and only there', () => {
    const parts = data.parts.parts.map((p) => {
      if (p.id === 'power-fixed-panel') return { ...p, effects: { energyIncome: 1 } };
      if (p.id === 'heater-rhu') return { ...p, effects: { heat: 2, dustRate: 1 } };
      return p;
    });
    expect(validateGameData({ ...data, parts: { ...data.parts, parts } })).toEqual([
      'part power-fixed-panel has solar income but no dustRate (needed on mars, which has dust)',
      'part heater-rhu has a dustRate but no solar income',
    ]);
    const moonData = worldGameData('moon');
    const bare = moonData.parts.parts.map((p) => (p.id === 'power-fixed-panel' ? { ...p, effects: { energyIncome: 1 } } : p));
    expect(validateGameData({ ...moonData, parts: { ...moonData.parts, parts: bare } })).toEqual([]);
  });

  it('checks tuning.dust and events.dustdevil', () => {
    const tuning = { ...data.tuning, dust: { ...data.tuning.dust!, perSol: -0.1, stormMultiplier: 0.5, minFactor: 0, lessonLoss: 1, dustDevilCleanM: 200, dustDevilSenseM: 400 } };
    const events = { ...data.events, dustdevil: { ...data.events.dustdevil!, everySols: 0, lifeSeconds: 0, speedMps: -1, daySecondsWindow: [8, 40] as [number, number] } };
    expect(validateGameData({ ...data, tuning, events })).toEqual([
      'tuning.dust.perSol must not be negative',
      'tuning.dust.stormMultiplier must be at least 1 (the storm never slows dust down)',
      'tuning.dust.minFactor must be above 0 and at most 1',
      'tuning.dust.lessonLoss must be above 0 and below 1 - minFactor (the lesson must be reachable above the floor)',
      'tuning.dust.dustDevilSenseM must be at most events.dustdevil.maxPassM (or no devil could pass that close)',
      'events.dustdevil.everySols must be above 0',
      'events.dustdevil.lifeSeconds must be above 0',
      'events.dustdevil.speedMps must not be negative',
    ]);
    const late = { ...data.events, dustdevil: { ...data.events.dustdevil!, daySecondsWindow: [8, 30] as [number, number] } };
    expect(validateGameData({ ...data, events: late })).toEqual([
      'events.dustdevil.daySecondsWindow must be a [start, end] in the day, with end + lifeSeconds at most tuning.sol.daySeconds',
    ]);
    const cleanFar = { ...data.tuning, dust: { ...data.tuning.dust!, dustDevilCleanM: 200 } };
    expect(validateGameData({ ...data, tuning: cleanFar })).toEqual(['tuning.dust needs 0 <= dustDevilCleanM <= dustDevilSenseM']);
  });
});
