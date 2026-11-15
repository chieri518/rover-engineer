import { describe, expect, it } from 'vitest';
import { testEvents, testParts, testTuning as t } from './testData';
import { selectedParts } from './rover';
import {
  deployPart, isSwitchInstrument, missionSetup, missionWarnings, partsAboard, setStandby, standbyDraw, startInstrumentUse, startMission, stepMission,
  type MissionSample, type MissionSetup, type MissionState, type UseConditions,
} from './mission';
import type { MissionEvent } from './events';
import type { Build, Part } from './types';

const build: Build = { chassis: 'titanium', wheels: 'mesh', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', payload: ['camera'] };
const parts = selectedParts(build, testParts).map((p) => {
  // The fixed test parts have no drive effects; give them some.
  if (p.slot === 'wheels') return { ...p, effects: { baseSpeed: 3, grip: 0.8, energyPerMeter: 0.2 } };
  if (p.slot === 'power') return { ...p, effects: { energyIncome: 1 } };
  if (p.slot === 'battery') return { ...p, effects: { batteryCapacity: 100 } };
  return p;
});

const flare: MissionEvent = { kind: 'flare', at: 10, warningAt: 5, flare: testEvents.flare.realFlares[0]! };
const quake: MissionEvent = { kind: 'quake', at: 20, warningAt: 20 };

const idle: MissionSample = {
  dt: 1, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 1, inColdZone: false, softness: 0,
  throttling: false, impactMps: 0, upY: 1,
};

function run(setup: MissionSetup, sample: Partial<MissionSample>, seconds: number, state = startMission(setup)) {
  let s: MissionState = state;
  const notices = [];
  for (let i = 0; i < seconds && !s.end; i++) {
    const step = stepMission(s, { ...idle, ...sample }, setup, t, testEvents);
    s = step.state;
    notices.push(...step.notices);
  }
  return { state: s, notices };
}

describe('mission setup', () => {
  it('reads heat, lights and overload from the parts', () => {
    const setup = missionSetup(parts, t, []);
    expect(setup.heat).toBe(1);
    expect(setup.hasLights).toBe(true);
    expect(setup.overloadKg).toBe(0);
    const heavy = missionSetup(parts.map((p) => (p.slot === 'chassis' ? { ...p, effects: { maxLoad: 40 } } : p)), t, []);
    expect(heavy.overloadKg).toBeGreaterThan(0);
  });
});

describe('mission step', () => {
  const setup = missionSetup(parts, t, []);

  it('starts with a full battery and survives the full length when idle in the sun', () => {
    const s = startMission(setup);
    expect(s.energy).toBe(100);
    const end = run(setup, {}, 400).state.end;
    expect(end).toEqual({ survived: true, seconds: t.mission.lengthSeconds });
  });

  it('runs out of energy when driving in shadow', () => {
    const { state } = run(setup, { distanceM: 10, speedMps: 10, sunlight: 0, throttling: true }, 400);
    expect(state.end?.cause).toBe('energy');
    expect(state.end?.seconds).toBeCloseTo(100 / (10 * setup.stats.energyPerMeter), 0);
  });

  it('charges in the sun but never above capacity', () => {
    const s0 = { ...startMission(setup), energy: 50 };
    const { state } = run(setup, {}, 10, s0);
    expect(state.energy).toBe(60);
    expect(run(setup, {}, 100, s0).state.energy).toBe(100);
  });

  it('a powered-down rover uses no drive energy', () => {
    const s0 = { ...startMission(setup), poweredDown: true };
    const { state } = run(setup, { distanceM: 10, speedMps: 10, sunlight: 0 }, 5, s0);
    expect(state.energy).toBe(100);
  });

  it('is destroyed by accumulated damage on steep ground', () => {
    const { state } = run(setup, { slopeDeg: 30, speedMps: 5, distanceM: 0 }, 400);
    expect(state.end?.cause).toBe('destroyed');
    expect(state.damageBy.slope).toBe(t.damage.max);
  });

  it('counts an impact once per cooldown', () => {
    const step1 = stepMission(startMission(setup), { ...idle, dt: 0.1, impactMps: 5 }, setup, t, testEvents);
    expect(step1.state.damage).toBe(t.damage.rockHit + 2 * t.damage.impactPerMps);
    expect(step1.notices[0]?.kind).toBe('impact');
    const step2 = stepMission(step1.state, { ...idle, dt: 0.1, impactMps: 5 }, setup, t, testEvents);
    expect(step2.state.damage).toBe(step1.state.damage);
  });

  it('ends at once as destroyed when the rover rolls over', () => {
    let s = startMission(setup);
    for (let i = 0; i < 10 && !s.end; i++) s = stepMission(s, { ...idle, dt: 0.1, upY: -0.2 }, setup, t, testEvents).state;
    expect(s.end).toMatchObject({ survived: false, cause: 'destroyed', detail: 'rollover' });
    expect(s.damage).toBe(0);
  });

  it('freezes in a cold zone; the heater slows it', () => {
    const heated = run(setup, { inColdZone: true }, 400).state.end!;
    const bare = missionSetup(parts.filter((p) => p.slot !== 'heater'), t, []);
    const cold = run(bare, { inColdZone: true }, 400).state.end!;
    expect(cold.cause).toBe('froze');
    expect(heated.cause).toBe('froze');
    expect(cold.seconds).toBeLessThan(heated.seconds);
  });

  it('gets stuck when pushing on with high slip', () => {
    const heavy = missionSetup(parts.map((p) => (p.slot === 'wheels' ? { ...p, mass: 60, effects: { ...p.effects, grip: 0.4 } } : p)), t, []);
    const { state } = run(heavy, { softness: 1, throttling: true, speedMps: 1 }, 400);
    expect(state.end?.cause).toBe('stuck');
    expect(state.end?.seconds).toBe(t.ground.stuckSeconds);
  });

  it('warns of a flare, then damages a rover in the sun but not one powered down or in shadow', () => {
    const withEvents = missionSetup(parts, t, [flare, quake]);
    const sunny = run(withEvents, {}, 15);
    expect(sunny.notices.map((n) => n.kind)).toEqual(['flare-warning', 'flare-hit']);
    expect(sunny.state.damageBy.flare).toBe(testEvents.flare.damage);
    expect(sunny.state.flaresHarmed).toBe(1);

    const shaded = run(withEvents, { sunlight: 0 }, 15);
    expect(shaded.state.damageBy.flare).toBe(0);
    expect(shaded.state.flaresProtected).toBe(1);

    const off = run(withEvents, {}, 15, { ...startMission(withEvents), poweredDown: true });
    expect(off.state.damageBy.flare).toBe(0);
  });

  it('a moonquake damages the rover', () => {
    const withEvents = missionSetup(parts, t, [quake]);
    const { state, notices } = run(withEvents, {}, 25);
    expect(state.damageBy.quake).toBe(testEvents.quake.damage);
    expect(notices.map((n) => n.kind)).toEqual(['quake']);
  });

  it('stops changing once ended', () => {
    const ended = run(setup, { slopeDeg: 30, speedMps: 5 }, 400).state;
    const after = stepMission(ended, { ...idle, slopeDeg: 30, speedMps: 5 }, setup, t, testEvents);
    expect(after.state).toBe(ended);
  });

  it('lists standing warnings', () => {
    const s = { ...startMission(setup), energy: 5, damage: 80, freeze: 10, poweredDown: true };
    const w = missionWarnings(s, { ...idle, inColdZone: true, slopeDeg: 19, speedMps: 3 }, 0.3, true, setup, t);
    expect(w).toEqual(['noLights', 'cold', 'slip', 'steepSlope', 'lowEnergy', 'highDamage', 'poweredDown']);
    expect(missionWarnings(startMission(setup), idle, 0, false, setup, t)).toEqual([]);
  });
});

describe('instruments in a mission', () => {
  // A drill (10 energy per use, 3 s hold) and a camera (free, instant), plus a neutron spectrometer
  // with a standby draw of 0.5 energy per second (test parts).
  const withTestDrive = (ps: Part[]) => ps.map((p) => parts.find((q) => q.id === p.id) ?? p);
  const drillParts = withTestDrive(selectedParts({ ...build, payload: ['drill', 'camera'] }, testParts));
  const setup = missionSetup(drillParts, t, []);
  const switchParts = withTestDrive(selectedParts({ ...build, payload: ['camera', 'neutron'] }, testParts));
  const switchSetup = missionSetup(switchParts, t, []);
  const still: UseConditions = { speedMps: 0, inColdZone: false, sunlight: 1 };

  it('setup lists each instrument with its mode and costs, in bay order', () => {
    expect(setup.instruments.map((c) => [c.instrument, c.mode, c.energyPerUse, c.useSeconds])).toEqual([['drill', 'use', 10, 3], ['camera', 'use', 0, 0]]);
    expect(switchSetup.instruments.map((c) => c.mode)).toEqual(['use', 'switch']);
  });

  it('a drill sample charges its energy at once and holds the rover for the part\'s useSeconds', () => {
    const use = startInstrumentUse(startMission(setup), 'drill', still, setup, t);
    expect(use).toMatchObject({ ok: true, holdSeconds: 3, slowedByCold: false, fasterInShadow: false, cost: 10 });
    if (!use.ok) return;
    expect(use.state.energy).toBe(90);
    expect(use.state.using).toEqual({ instrument: 'drill', secondsLeft: 3 });
  });

  it('a held use counts down and finishes with a notice, once', () => {
    const use = startInstrumentUse(startMission(setup), 'drill', still, setup, t);
    if (!use.ok) throw new Error('refused');
    const step = (s: MissionState) => stepMission(s, { ...idle, dt: 1, sunlight: 0 }, setup, t, testEvents);
    const a = step(use.state);
    const b = step(a.state);
    const c = step(b.state);
    expect([a, b].flatMap((x) => x.notices)).toEqual([]);
    expect(c.notices).toEqual([{ kind: 'instrument-done', instrument: 'drill', deployed: false }]);
    expect(c.state.using).toBeNull();
    expect(step(c.state).notices).toEqual([]);
  });

  it('a held use pauses while the rover is powered down and resumes on power-up', () => {
    const use = startInstrumentUse(startMission(setup), 'drill', still, setup, t);
    if (!use.ok) throw new Error('refused');
    const down = run(setup, {}, 10, { ...use.state, poweredDown: true });
    expect(down.state.using).toEqual({ instrument: 'drill', secondsLeft: 3 });
    expect(down.notices).toEqual([]);
    const up = run(setup, {}, 3, { ...down.state, poweredDown: false });
    expect(up.state.using).toBeNull();
    expect(up.notices).toEqual([{ kind: 'instrument-done', instrument: 'drill', deployed: false }]);
  });

  it('the camera is free and instant', () => {
    const s0 = startMission(setup);
    const use = startInstrumentUse(s0, 'camera', { speedMps: 3, inColdZone: true, sunlight: 0 }, setup, t);
    expect(use).toMatchObject({ ok: true, holdSeconds: 0, cost: 0 });
    if (use.ok) expect(use.state).toEqual(s0);
  });

  it('refuses a use on too little energy: a use never empties the battery', () => {
    expect(startInstrumentUse({ ...startMission(setup), energy: 10 }, 'drill', still, setup, t)).toEqual({ ok: false, reason: 'energy', cost: 10 });
    expect(startInstrumentUse({ ...startMission(setup), energy: 10.5 }, 'drill', still, setup, t).ok).toBe(true);
    expect(startInstrumentUse({ ...startMission(setup), energy: 0.1 }, 'camera', still, setup, t).ok).toBe(true);
  });

  it('refuses while powered down, while moving (held uses only), while another hold runs, and after the end', () => {
    const s0 = startMission(setup);
    expect(startInstrumentUse({ ...s0, poweredDown: true }, 'drill', still, setup, t)).toMatchObject({ ok: false, reason: 'powered-down' });
    expect(startInstrumentUse({ ...s0, poweredDown: true }, 'camera', still, setup, t)).toMatchObject({ ok: false, reason: 'powered-down' });
    expect(startInstrumentUse(s0, 'drill', { ...still, speedMps: 1 }, setup, t)).toMatchObject({ ok: false, reason: 'moving' });
    const busy = { ...s0, using: { instrument: 'drill' as const, secondsLeft: 1 } };
    expect(startInstrumentUse(busy, 'drill', still, setup, t)).toMatchObject({ ok: false, reason: 'busy' });
    expect(startInstrumentUse(busy, 'camera', still, setup, t).ok).toBe(true); // a photo while drilling
    expect(startInstrumentUse({ ...s0, end: { survived: true, seconds: 300 } }, 'drill', still, setup, t)).toMatchObject({ ok: false, reason: 'ended' });
    expect(startInstrumentUse(startMission(missionSetup(parts, t, [])), 'drill', still, missionSetup(parts, t, []), t))
      .toMatchObject({ ok: false, reason: 'not-carried' });
    // A switch is not used: it is switched (setStandby).
    expect(startInstrumentUse(startMission(switchSetup), 'neutron', still, switchSetup, t)).toMatchObject({ ok: false, reason: 'not-carried' });
  });

  it('a held use is slower in a cold zone on a rover without a heater', () => {
    const cold = { ...still, inColdZone: true };
    expect(startInstrumentUse(startMission(setup), 'drill', cold, setup, t)).toMatchObject({ ok: true, holdSeconds: 3, slowedByCold: false });
    const bare = missionSetup(drillParts.filter((p) => p.slot !== 'heater'), t, []);
    expect(startInstrumentUse(startMission(bare), 'drill', cold, bare, t)).toMatchObject({ ok: true, holdSeconds: 3 * t.instruments.coldSlowdown, slowedByCold: true });
    expect(startInstrumentUse(startMission(bare), 'drill', still, bare, t)).toMatchObject({ holdSeconds: 3, slowedByCold: false });
  });

  it('only an instrument with a standby draw is a switch; it starts off', () => {
    expect(isSwitchInstrument('neutron', switchSetup)).toBe(true);
    expect(isSwitchInstrument('camera', switchSetup)).toBe(false);
    const s0 = startMission(switchSetup);
    expect(s0.standbyOn).toEqual([]);
    expect(setStandby(s0, 'camera', true, switchSetup, t)).toEqual({ ok: false, reason: 'not-carried' });
    const on = setStandby(s0, 'neutron', true, switchSetup, t);
    expect(on.ok && on.state.standbyOn).toEqual(['neutron']);
    const off = on.ok ? setStandby(on.state, 'neutron', false, switchSetup, t) : on;
    expect(off.ok && off.state.standbyOn).toEqual([]);
  });

  const switchedOn = (s: MissionState) => {
    const r = setStandby(s, 'neutron', true, switchSetup, t);
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  };

  it('a switched-on instrument draws its standby energy each second, but not while powered down or switched off', () => {
    const on = switchedOn(startMission(switchSetup));
    expect(standbyDraw(on, switchSetup)).toBe(0.5);
    const dark = { sunlight: 0 };
    expect(run(switchSetup, dark, 10, on).state.energy).toBeCloseTo(95);
    expect(run(switchSetup, dark, 10, { ...on, poweredDown: true }).state.energy).toBe(100);
    expect(run(switchSetup, dark, 10, startMission(switchSetup)).state.energy).toBe(100);
  });

  it('switching on can wait for power-up: allowed while powered down, drawing nothing until then', () => {
    const r = setStandby({ ...startMission(switchSetup), poweredDown: true }, 'neutron', true, switchSetup, t);
    expect(r.ok && r.state.standbyOn).toEqual(['neutron']);
  });

  it('standby never ends the mission: at the low-energy warning it switches off with a notice, and cannot be switched on below it', () => {
    const low = t.energy.lowWarningShare * switchSetup.stats.batteryCapacity; // 20
    const on = { ...switchedOn(startMission(switchSetup)), energy: low + 1 };
    const { state, notices } = run(switchSetup, { sunlight: 0 }, 5, on);
    expect(notices).toEqual([{ kind: 'standby-off', instruments: ['neutron'] }]);
    expect(state.standbyOn).toEqual([]);
    expect(state.energy).toBeCloseTo(low); // two seconds of draw took it down to the warning level, and no lower
    expect(setStandby(state, 'neutron', true, switchSetup, t)).toEqual({ ok: false, reason: 'low-energy' });
    expect(setStandby({ ...state, energy: low + 0.1 }, 'neutron', true, switchSetup, t).ok).toBe(true);
    // A draw larger than all the energy above the warning level in one step still cannot take the battery lower.
    const hungry = { ...switchSetup, instruments: switchSetup.instruments.map((c) => (c.mode === 'switch' ? { ...c, standbyEnergy: 500 } : c)) };
    const big = stepMission({ ...on, energy: low + 5 }, { ...idle, sunlight: 0 }, hungry, t, testEvents);
    expect(big.state.energy).toBeCloseTo(low);
    expect(big.state.end).toBeNull();
    expect(big.notices).toEqual([{ kind: 'standby-off', instruments: ['neutron'] }]);
    // Left on in the dark without the auto-off it would have run the battery flat; it survives instead.
    expect(run(switchSetup, { sunlight: 0 }, 400, on).state.end).toEqual({ survived: true, seconds: t.mission.lengthSeconds });
  });
});

describe('the new Moon instruments in a mission', () => {
  const withTestDrive = (ps: Part[]) => ps.map((p) => parts.find((q) => q.id === p.id) ?? p);
  const steel = { ...build, chassis: 'steel' };
  const bay = withTestDrive(selectedParts({ ...steel, payload: ['xray', 'seismometer', 'reflector'] }, testParts));
  const setup = missionSetup(bay, t, [quake]);
  const still: UseConditions = { speedMps: 0, inColdZone: false, sunlight: 1, earthInView: true, boulderInReach: true };

  it('the X-ray spectrometer needs a boulder within reach', () => {
    expect(startInstrumentUse(startMission(setup), 'xray', { ...still, boulderInReach: false }, setup, t)).toMatchObject({ ok: false, reason: 'no-boulder' });
    expect(startInstrumentUse(startMission(setup), 'xray', still, setup, t)).toMatchObject({ ok: true, holdSeconds: 4, cost: 3 });
  });

  it('the X-ray reading is faster in shadow, and the cold does not slow it, even without a heater', () => {
    const shade = { ...still, sunlight: t.instruments.shadowSunlight - 0.01 };
    expect(startInstrumentUse(startMission(setup), 'xray', shade, setup, t)).toMatchObject({ ok: true, holdSeconds: 2, fasterInShadow: true });
    const bare = missionSetup(bay.filter((p) => p.slot !== 'heater'), t, []);
    const crater = { ...shade, sunlight: 0, inColdZone: true };
    expect(startInstrumentUse(startMission(bare), 'xray', crater, bare, t)).toMatchObject({ ok: true, holdSeconds: 2, slowedByCold: false, fasterInShadow: true });
    // A station set down in the same crater is slowed by the cold.
    expect(startInstrumentUse(startMission(bare), 'seismometer', crater, bare, t)).toMatchObject({ ok: true, holdSeconds: 3 * t.instruments.coldSlowdown, slowedByCold: true, fasterInShadow: false });
  });

  it('the reflector can be set down only with Earth in view', () => {
    expect(startInstrumentUse(startMission(setup), 'reflector', { ...still, earthInView: false }, setup, t)).toMatchObject({ ok: false, reason: 'no-earth' });
    expect(startInstrumentUse(startMission(setup), 'reflector', still, setup, t)).toMatchObject({ ok: true, holdSeconds: 3, cost: 0 });
  });

  it('a station is set down when its hold ends; the rover is then lighter and faster, and the station cannot be used again', () => {
    const use = startInstrumentUse(startMission(setup), 'seismometer', still, setup, t);
    if (!use.ok) throw new Error(use.reason);
    const { state, notices } = run(setup, {}, 3, use.state);
    expect(notices).toEqual([{ kind: 'instrument-done', instrument: 'seismometer', deployed: true }]);
    expect(state.deployed).toEqual(['seismometer']);
    const after = deployPart(setup, bay, state.deployed, t);
    expect(after.stats.massKg).toBe(setup.stats.massKg - 4);
    expect(after.stats.topSpeed).toBeGreaterThanOrEqual(setup.stats.topSpeed);
    expect(after.stats.energyPerMeter).toBeLessThanOrEqual(setup.stats.energyPerMeter);
    expect(after.instruments.map((c) => c.instrument)).toEqual(['xray', 'reflector']);
    expect(after.events).toBe(setup.events);
    expect(partsAboard(bay, state.deployed).some((p) => p.id === 'seismometer')).toBe(false);
    expect(startInstrumentUse(state, 'seismometer', still, after, t)).toMatchObject({ ok: false, reason: 'deployed' });
  });

  it('deploying sheds overload: a frame over its maximum load carries less after a station leaves', () => {
    const tight = bay.map((p) => (p.slot === 'chassis' ? { ...p, effects: { ...p.effects, maxLoad: setupMass(bay) - 2 } } : p));
    const s1 = missionSetup(tight, t, []);
    expect(s1.overloadKg).toBe(2);
    expect(deployPart(s1, tight, ['seismometer'], t).overloadKg).toBe(0);
  });
});

function setupMass(ps: Part[]): number {
  return ps.reduce((m, p) => m + p.mass, 0);
}
