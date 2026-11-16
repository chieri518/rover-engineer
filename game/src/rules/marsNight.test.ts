// The Mars night-energy check (stands in for a Mars winPaths): real data/mars numbers with the Moon parts.
// A simple driver plays all 10 sols through stepMission: it drives by day while the battery is above a
// reserve, then at night either sleeps or keeps driving with the lights on. No terrain: the Sun is
// visible whenever it is up. The storm is drawn per seed as in the game.
import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { selectedParts } from './rover';
import { marsSetup, marsStatus, missionSetup, startMission, stepMission, type MissionState } from './mission';
import { seededRng } from './events';
import { marsSecondsToFreeze } from './cold';
import type { Build, Slot } from './types';

const data = worldGameData('mars');
const t = data.tuning;
const site = { latitudeDeg: 18.4447, longitudeDeg: 77.4508 };

const base: Build = {
  chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', payload: ['instrument-camera'],
};
const builds: Record<string, Build> = {
  'cheap (fixed panel, small battery)': base,
  'big battery': { ...base, battery: 'battery-nih2' },
  'light and fast (mast, mesh, titanium)': { ...base, chassis: 'chassis-titanium', wheels: 'wheels-mesh', power: 'power-solar-mast', payload: ['instrument-drill'] },
};
const withPart = (b: Build, slot: Slot, id: string): Build => ({ ...b, [slot]: id });

type NightPlan = 'sleep' | 'lights' | 'lights-parked';
interface Plan {
  night: NightPlan | ((sol: number) => NightPlan);
  dayReserve: number; // share of the battery kept back by day: drive only above it
}

function play(build: Build, plan: Plan, seed: number): MissionState {
  const parts = selectedParts(build, data.parts);
  const setup = missionSetup(parts, t, [], marsSetup(site, data.events, seededRng(seed)));
  const cap = setup.stats.batteryCapacity;
  const dt = 0.1;
  let s = startMission(setup);
  while (!s.end) {
    const m = marsStatus(s, setup, t)!;
    const choice = typeof plan.night === 'function' ? plan.night(m.clock.sol) : plan.night;
    if (m.clock.isNight && choice === 'sleep' && !s.poweredDown) s = { ...s, poweredDown: true };
    const now = marsStatus(s, setup, t)!;
    const wantsDrive = now.clock.isNight ? choice === 'lights' : s.energy > plan.dayReserve * cap;
    const driving = now.canDrive && wantsDrive;
    const speed = driving ? setup.stats.topSpeed : 0;
    s = stepMission(
      s,
      {
        dt, distanceM: speed * dt, speedMps: speed, uphillDeg: 0, slopeDeg: 0, sunlight: now.sun.elevationDeg > 0 ? 1 : 0,
        inColdZone: false, softness: 0, throttling: driving, impactMps: 0, upY: 1,
      },
      setup, t, data.events,
    ).state;
  }
  return s;
}

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

describe('Mars data', () => {
  it('fits 10 sols of 45 s day and 15 s night into the mission, with the storm inside it', () => {
    const sol = t.sol!;
    expect(sol.sols * sol.secondsPerSol).toBe(t.mission.lengthSeconds);
    expect(sol.daySeconds + sol.nightSeconds).toBe(sol.secondsPerSol);
    expect(sol.sols).toBe(t.mission.gameDays);
    const storm = data.events.duststorm!;
    expect(storm.warningSeconds).toBe(sol.secondsPerSol); // forecast a sol ahead
    for (const [, b] of storm.windowsSeconds) expect(b + storm.durationSeconds).toBeLessThanOrEqual(t.mission.lengthSeconds);
    expect(t.cold.zones).toEqual([]);
  });

  it('starts the mission in the morning, with the Sun about 15° up', () => {
    const setup = missionSetup([], t, [], marsSetup(site, data.events, seededRng(1)));
    const start = marsStatus(startMission(setup), setup, t)!;
    expect(start.sun.elevationDeg).toBeGreaterThan(13);
    expect(start.sun.elevationDeg).toBeLessThan(17);
    expect(start.clock).toMatchObject({ sol: 1, isNight: false });
  });

  it('freezes a rover without a heater before its first dawn; the radioisotope heater lasts the night', () => {
    const heat = (id: string) => data.parts.parts.find((p) => p.id === id)!.effects.heat ?? 0;
    expect(marsSecondsToFreeze(heat('heater-none'), t.cold, t.night!)).toBeLessThan(t.sol!.nightSeconds);
    expect(marsSecondsToFreeze(heat('heater-rhu'), t.cold, t.night!)).toBeGreaterThan(t.sol!.nightSeconds * 1.2);
  });
});

describe('Mars night-energy check (Moon parts)', () => {
  for (const [name, build] of Object.entries(builds)) {
    it(`${name}: survives all 10 sols when it sleeps at night`, () => {
      for (const seed of seeds) {
        const end = play(build, { night: 'sleep', dayReserve: 0.3 }, seed).end;
        expect(end, `seed ${seed}`).toEqual({ survived: true, seconds: t.mission.lengthSeconds });
      }
    });
  }

  it('a small battery runs out when the rover drives with its lights on every night', () => {
    for (const seed of seeds) {
      const end = play(base, { night: 'lights', dayReserve: 0.3 }, seed).end;
      expect(end?.cause, `seed ${seed}`).toBe('energy');
      expect(end!.seconds).toBeLessThan(t.mission.lengthSeconds * 0.8);
    }
  });

  it('a small battery runs out with the lights on all night even parked, if it also drives by day', () => {
    for (const seed of seeds) {
      expect(play(base, { night: 'lights-parked', dayReserve: 0.3 }, seed).end?.cause, `seed ${seed}`).toBe('energy');
    }
  });

  it('one night of driving with lights is affordable (the Night drive milestone)', () => {
    for (const seed of seeds) {
      const end = play(base, { night: (sol) => (sol === 2 ? 'lights' : 'sleep'), dayReserve: 0.3 }, seed).end;
      expect(end?.survived, `seed ${seed}`).toBe(true);
    }
  });

  it('a rover without a heater freezes on its first night, even asleep', () => {
    const end = play(withPart(base, 'heater', 'heater-none'), { night: 'sleep', dayReserve: 0.3 }, 1).end;
    expect(end?.cause).toBe('froze');
    expect(end!.seconds).toBeLessThan(t.sol!.secondsPerSol);
  });

  it('a rover without lights sleeps through the nights and survives', () => {
    for (const seed of seeds.slice(0, 3)) {
      expect(play(withPart(base, 'lights', 'lights-none'), { night: 'lights', dayReserve: 0.3 }, seed).end?.survived).toBe(true);
    }
  });
});
