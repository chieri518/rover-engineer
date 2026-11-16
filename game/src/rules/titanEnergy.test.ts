// The Titan battery-only check (stands in for a Titan winPaths): real data/titan numbers with the Moon
// parts (batteries 400 and 600, the radioisotope heater with heat 2). A simple driver plays the one Titan
// day through stepMission in wall-clock steps (titanMissionDelta: asleep at night the clock runs 4x): it
// drives by day up to a distance and above a battery reserve, then at night sleeps, parks with the lights
// on, or drives with the lights on. Flat ground, no terrain. The rainstorm is drawn per seed as in the game.
import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { selectedParts } from './rover';
import { missionSetup, startMission, stepMission, titanSetup, titanStatus, type MissionState } from './mission';
import { seededRng } from './events';
import { nextDawnAt, titanMissionDelta, titanSecondsToFreeze } from './titan';
import type { Build, Slot } from './types';

const data = worldGameData('titan');
const t = data.tuning;
const site = { latitudeDeg: 5.162, longitudeDeg: 161.4494 }; // public/terrain/titan/terrain.json sunAndEarth
const dawnAt = nextDawnAt(t.sol!.daySeconds, t.sol!); // mission time of the dawn after the night (750 s)
const duskAt = t.sol!.daySeconds - t.sol!.startSecondsIntoDay!; // 300 s

const small: Build = {
  chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', instrument: 'instrument-camera',
};
const big: Build = { ...small, battery: 'battery-nih2' };
const withPart = (b: Build, slot: Slot, id: string): Build => ({ ...b, [slot]: id });

type NightPlan = 'sleep' | 'lights-parked' | 'lights';
interface Plan {
  night: NightPlan;
  dayReserve?: number; // share of the battery kept back by day: drive only above it (default 0.3)
  dayDistanceM?: number; // stop driving by day after this distance (default: no limit)
  nightDistanceM?: number; // with 'lights': stop driving at night after this distance (default: no limit)
  dawnDrive?: boolean; // drive after dawn above the reserve (default false: park)
}

interface Run {
  state: MissionState;
  wallSeconds: number;
  freezeAtDawn: number | null;
  maxFreeze: number;
}

function play(build: Build, plan: Plan, seed: number): Run {
  const parts = selectedParts(build, data.parts);
  const setup = missionSetup(parts, t, [], undefined, titanSetup(site, data.events, seededRng(seed)));
  const cap = setup.stats.batteryCapacity;
  const reserve = (plan.dayReserve ?? 0.3) * cap;
  const wallDt = 0.1;
  let s = startMission(setup);
  let wall = 0;
  let freezeAtDawn: number | null = null;
  let maxFreeze = 0;
  let dayDistance = 0;
  let nightDistance = 0;
  while (!s.end) {
    const status = titanStatus(s, setup, t)!;
    const night = status.clock.isNight;
    if (night && plan.night === 'sleep' && !s.poweredDown) s = { ...s, poweredDown: true };
    const now = titanStatus(s, setup, t)!;
    let wants: boolean;
    if (now.clock.isNight) wants = plan.night === 'lights' && nightDistance < (plan.nightDistanceM ?? Infinity);
    else if (s.seconds >= dawnAt) wants = !!plan.dawnDrive && s.energy > reserve;
    else wants = s.energy > reserve && dayDistance < (plan.dayDistanceM ?? Infinity);
    const driving = now.canDrive && wants;
    const dt = titanMissionDelta(wallDt, s.seconds, s.poweredDown, t.sol!, t.sleep);
    const speed = driving ? setup.stats.topSpeed : 0;
    const before = s.seconds;
    s = stepMission(
      s,
      {
        dt, distanceM: speed * dt, speedMps: speed, uphillDeg: 0, slopeDeg: 0, sunlight: now.sun.elevationDeg > 0 ? 1 : 0,
        inColdZone: false, softness: 0, throttling: driving, impactMps: 0, upY: 1,
      },
      setup, t, data.events,
    ).state;
    if (driving) {
      if (now.clock.isNight) nightDistance += speed * dt;
      else dayDistance += speed * dt;
    }
    wall += wallDt;
    maxFreeze = Math.max(maxFreeze, s.freeze);
    if (before < dawnAt && s.seconds >= dawnAt) freezeAtDawn = s.freeze;
  }
  return { state: s, wallSeconds: wall, freezeAtDawn, maxFreeze };
}

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const survived = { survived: true, seconds: t.mission.lengthSeconds };

describe('Titan data', () => {
  it('fits one day of 450 s day and 450 s night, starting 150 s after sunrise, with the rain inside the mission', () => {
    const sol = t.sol!;
    expect(sol.sols * sol.secondsPerSol).toBe(t.mission.lengthSeconds);
    expect([sol.daySeconds, sol.nightSeconds, sol.startSecondsIntoDay]).toEqual([450, 450, 150]);
    expect(duskAt).toBe(300);
    expect(dawnAt).toBe(750);
    const rain = data.events.rainstorm!;
    for (const [, b] of rain.windowsSeconds) expect(b + rain.durationSeconds).toBeLessThanOrEqual(t.mission.lengthSeconds);
    expect(t.cold.zones).toEqual([]);
    expect(t.titanPower!.solarFactor).toBeLessThan(0.01);
  });

  it('solar panels earn almost nothing: a fixed panel makes under 1 energy over the whole day', () => {
    const panel = data.parts.parts.find((p) => p.id === 'power-fixed-panel')!.effects.energyIncome!;
    expect(panel * t.titanPower!.solarFactor * duskAt).toBeLessThan(1);
  });

  it('cold: without a heater a sleeper freezes within the night and an awake rover within the mission; the heater sleeper lasts the night', () => {
    const heat = (id: string) => data.parts.parts.find((p) => p.id === id)!.effects.heat ?? 0;
    const tc = t.titanCold!;
    expect(titanSecondsToFreeze(heat('heater-none'), true, false, tc, t.cold)).toBeLessThan(t.sol!.nightSeconds);
    expect(titanSecondsToFreeze(heat('heater-none'), false, false, tc, t.cold)).toBeLessThan(t.mission.lengthSeconds);
    const heaterSleep = titanSecondsToFreeze(heat('heater-rhu'), true, false, tc, t.cold);
    expect(heaterSleep).toBeGreaterThan(t.sol!.nightSeconds * 1.15);
    expect(heaterSleep).toBeLessThan(t.sol!.nightSeconds * 1.6); // little margin
    expect(titanSecondsToFreeze(heat('heater-rhu'), false, false, tc, t.cold)).toBe(Infinity);
  });
});

describe('Titan battery-only check (Moon parts)', () => {
  it('big battery: drives by day above a 30% reserve, sleeps at night, survives to the end', () => {
    for (const seed of seeds) {
      const run = play(big, { night: 'sleep' }, seed);
      expect(run.state.end, `seed ${seed}`).toEqual(survived);
      expect(run.state.distanceM).toBeGreaterThan(1200);
    }
  });

  it('small battery: the same careful plan survives too, on a shorter drive', () => {
    for (const seed of seeds) {
      const run = play(small, { night: 'sleep' }, seed);
      expect(run.state.end, `seed ${seed}`).toEqual(survived);
      expect(run.state.distanceM).toBeGreaterThan(800);
    }
  });

  it('big battery reaches a goal 1.4 km out (plus 10% for dunes) by day, sleeps there and survives', () => {
    // The target for the regenerated Selk ejecta field (1.2 to 1.4 km drive); no return trip, the lander does not recharge.
    for (const seed of seeds) {
      const run = play(big, { night: 'sleep', dayReserve: 0, dayDistanceM: 1400 * 1.1 }, seed);
      expect(run.state.end, `seed ${seed}`).toEqual(survived);
      expect(run.state.distanceM).toBeGreaterThanOrEqual(1540);
    }
  });

  it('sleeping fast-forwards the night: a sleeper plays the 900 s mission in under 600 s of wall time', () => {
    const run = play(big, { night: 'sleep' }, 1);
    expect(run.state.end?.survived).toBe(true);
    const expected = t.mission.lengthSeconds - t.sol!.nightSeconds + t.sol!.nightSeconds / t.sleep!.nightClockRate;
    expect(run.wallSeconds).toBeCloseTo(expected, -1);
    expect(run.wallSeconds).toBeLessThan(600);
  });

  it('small battery: driving with the lights on all night empties it before dawn', () => {
    for (const seed of seeds) {
      const end = play(small, { night: 'lights' }, seed).state.end;
      expect(end?.cause, `seed ${seed}`).toBe('energy');
      expect(end!.seconds).toBeLessThan(dawnAt);
    }
  });

  it('small battery: lights on all night, even parked, runs out if it also drove by day', () => {
    for (const seed of seeds) {
      expect(play(small, { night: 'lights-parked' }, seed).state.end?.cause, `seed ${seed}`).toBe('energy');
    }
  });

  it('big battery: a careful lights-on night (300 m by day, 300 m at night, then parked with lights) survives and stays warm', () => {
    for (const seed of seeds) {
      const run = play(big, { night: 'lights', dayReserve: 0, dayDistanceM: 300, nightDistanceM: 300 }, seed);
      expect(run.state.end, `seed ${seed}`).toEqual(survived);
      expect(run.maxFreeze, `seed ${seed}`).toBeLessThan(20); // awake with the heater stays safe
    }
  });

  it('heater sleeper: survives the night with little margin, even when the rain falls at night', () => {
    let worst = 0;
    for (const seed of seeds) {
      const run = play(big, { night: 'sleep' }, seed);
      expect(run.state.end?.survived, `seed ${seed}`).toBe(true);
      expect(run.freezeAtDawn!, `seed ${seed}`).toBeGreaterThan(60);
      worst = Math.max(worst, run.freezeAtDawn!);
    }
    expect(worst).toBeLessThan(t.cold.freezeMax * 0.92);
  });

  it('no heater: a sleeper freezes before dawn', () => {
    for (const seed of seeds.slice(0, 3)) {
      const end = play(withPart(big, 'heater', 'heater-none'), { night: 'sleep' }, seed).state.end;
      expect(end?.cause, `seed ${seed}`).toBe('froze');
      expect(end!.seconds).toBeLessThan(dawnAt);
    }
  });

  it('no heater: an awake rover that parks (lights on at night) freezes within the mission', () => {
    for (const seed of seeds.slice(0, 3)) {
      const end = play(withPart(big, 'heater', 'heater-none'), { night: 'lights-parked', dayDistanceM: 300 }, seed).state.end;
      expect(end?.cause, `seed ${seed}`).toBe('froze');
    }
  });

  it('no lights: the rover cannot drive at night; awake without lights it pays the electronics drain', () => {
    const run = play(withPart(big, 'lights', 'lights-none'), { night: 'lights', dayDistanceM: 500 }, 1);
    expect(run.state.end?.survived).toBe(true);
    expect(run.state.distanceM).toBeLessThan(510);
  });
});
