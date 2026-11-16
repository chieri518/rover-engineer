import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { seededRng } from './events';
import { missionSetup, startMission, stepMission, titanSetup, titanStatus, type MissionSample, type MissionState, type MarsNotice } from './mission';
import { scheduleDustStorm, scheduleRainstorm, stormFreezeFactor, stormIntensity, stormPhase } from './storm';
import { marsSolarDeclinationDeg, solarDeclinationDeg, solClock, TITAN_OBLIQUITY_DEG } from './sol';
import {
  isNightAt, maskSoftness, nextDawnAt, rainBlocksPhotos, sampleMask, titanClock, titanClockRate, titanDrainPerSecond, titanFreezeRate,
  titanMissionDelta, titanSolarFactor, titanSunAt,
} from './titan';
import type { Part } from './types';

const data = worldGameData('titan');
const t = data.tuning;
const sol = t.sol!;
const site = { latitudeDeg: 5.162, longitudeDeg: 161.4494 };

describe('Titan clock and Sun', () => {
  it('puts the subsolar point about 20 deg south in late 2034 (Ls 309)', () => {
    expect(solarDeclinationDeg(309, TITAN_OBLIQUITY_DEG)).toBeCloseTo(-20.46, 1);
    expect(titanClock(0, sol, site.latitudeDeg).declinationDeg).toBeCloseTo(-20.46, 1);
    // Mars keeps its own obliquity by default
    expect(solClock(0, worldGameData('mars').tuning.sol!, 18.4).declinationDeg).toBeCloseTo(marsSolarDeclinationDeg(200), 1);
  });

  it('starts 150 s after sunrise with the Sun high in the east; noon is about 65 deg up due south', () => {
    const start = titanSunAt(0, sol, site);
    expect(start.elevationDeg).toBeGreaterThan(45);
    expect(start.elevationDeg).toBeLessThan(56);
    expect(start.azimuthDeg).toBeGreaterThan(90);
    expect(start.azimuthDeg).toBeLessThan(180);
    const noon = titanSunAt(sol.daySeconds / 2 - sol.startSecondsIntoDay!, sol, site); // 75 s
    expect(noon.elevationDeg).toBeCloseTo(64.4, 0);
    expect(noon.azimuthDeg).toBeCloseTo(180, 0);
  });

  it('sets at 300 s in the south-west, is dark all night and rises again at 750 s', () => {
    expect(titanSunAt(299, sol, site).elevationDeg).toBeGreaterThan(0);
    const dusk = titanSunAt(300, sol, site);
    expect(dusk.elevationDeg).toBeCloseTo(0, 0);
    expect(dusk.azimuthDeg).toBeGreaterThan(240);
    expect(dusk.azimuthDeg).toBeLessThan(270);
    for (const s of [320, 500, 700, 740]) expect(titanSunAt(s, sol, site).elevationDeg).toBeLessThan(0);
    expect(titanSunAt(760, sol, site).elevationDeg).toBeGreaterThan(0);
    expect(titanSunAt(900, sol, site).elevationDeg).toBeGreaterThan(40);
  });

  it('knows night and the next dawn without a latitude', () => {
    expect(isNightAt(0, sol)).toBe(false);
    expect(isNightAt(299.9, sol)).toBe(false);
    expect(isNightAt(300, sol)).toBe(true);
    expect(isNightAt(749.9, sol)).toBe(true);
    expect(isNightAt(750, sol)).toBe(false);
    expect(nextDawnAt(0, sol)).toBe(750);
    expect(nextDawnAt(600, sol)).toBe(750);
    expect(titanClock(500, sol, site.latitudeDeg)).toMatchObject({ sol: 1, isNight: true });
    expect(titanClock(899, sol, site.latitudeDeg)).toMatchObject({ sol: 1, isNight: false });
  });
});

describe('Titan sleep fast-forward', () => {
  const sleep = t.sleep!;
  it('runs the clock 4x only while asleep at night', () => {
    expect(titanClockRate(true, true, sleep)).toBe(4);
    expect(titanClockRate(true, false, sleep)).toBe(1);
    expect(titanClockRate(false, true, sleep)).toBe(1);
    expect(titanClockRate(true, true, undefined)).toBe(1);
  });

  it('turns wall time into mission time, splitting the step at dawn', () => {
    expect(titanMissionDelta(0.5, 100, true, sol, sleep)).toBe(0.5); // asleep by day: normal
    expect(titanMissionDelta(0.5, 400, false, sol, sleep)).toBe(0.5); // awake at night: normal
    expect(titanMissionDelta(0.5, 400, true, sol, sleep)).toBe(2);
    // 1 mission second before dawn: 0.25 wall seconds at 4x, then 0.75 at 1x
    expect(titanMissionDelta(1, 749, true, sol, sleep)).toBeCloseTo(1.75, 9);
  });
});

describe('Titan power and cold', () => {
  const night = t.night!;
  const tc = t.titanCold!;
  it('gives the tiny solar factor by day and nothing at night', () => {
    expect(titanSolarFactor(false, t.titanPower)).toBe(0.001);
    expect(titanSolarFactor(true, t.titanPower)).toBe(0);
  });

  it('drains the electronics day and night, the lights at night, the sleep drain asleep', () => {
    expect(titanDrainPerSecond(false, false, true, night)).toBe(night.awakeDrainPerSecond);
    expect(titanDrainPerSecond(true, false, true, night)).toBe(night.lightsDrainPerSecond);
    expect(titanDrainPerSecond(true, false, false, night)).toBe(night.awakeDrainPerSecond);
    expect(titanDrainPerSecond(true, true, true, night)).toBe(night.sleepDrainPerSecond);
    expect(titanDrainPerSecond(false, true, true, night)).toBe(night.sleepDrainPerSecond);
  });

  it('cools: awake and driving heat count only while awake; the rain multiplies the base rate', () => {
    const k = tc.heaterReductionPerHeat!;
    expect(titanFreezeRate(0, true, false, 1, tc, t.cold)).toBeCloseTo(tc.freezeRatePerSecond, 9);
    expect(titanFreezeRate(0, true, true, 1, tc, t.cold)).toBeCloseTo(tc.freezeRatePerSecond, 9); // asleep: driving heat ignored
    expect(titanFreezeRate(2, false, false, 1, tc, t.cold)).toBeCloseTo(tc.freezeRatePerSecond - k * (2 + tc.awakeHeat), 9);
    expect(titanFreezeRate(2, false, true, 1, tc, t.cold)).toBeCloseTo(tc.freezeRatePerSecond - k * (2 + tc.awakeHeat + tc.drivingHeat), 9);
    expect(titanFreezeRate(2, false, false, 1, tc, t.cold)).toBeLessThan(0); // awake with the heater recovers
    expect(titanFreezeRate(2, true, false, 1.5, tc, t.cold)).toBeCloseTo(tc.freezeRatePerSecond * 1.5 - k * 2, 9);
    // without a Titan override, the Moon's reduction per heat unit applies
    const { heaterReductionPerHeat: _, ...noOverride } = tc;
    expect(titanFreezeRate(1, true, false, 1, noOverride, t.cold)).toBeCloseTo(tc.freezeRatePerSecond - t.cold.heaterReductionPerHeat, 9);
  });
});

describe('Titan methane rain', () => {
  const spec = data.events.rainstorm!;
  it('is scheduled in its window, forecast 60 s ahead, and differs by seed', () => {
    const starts = new Set<number>();
    for (let seed = 1; seed <= 8; seed++) {
      const rain = scheduleRainstorm(data.events, seededRng(seed))!;
      expect(rain.startAt).toBeGreaterThanOrEqual(spec.windowsSeconds[0]![0]);
      expect(rain.startAt).toBeLessThanOrEqual(spec.windowsSeconds[0]![1]);
      expect(rain.startAt - rain.forecastAt).toBe(spec.warningSeconds);
      expect(rain.endAt - rain.startAt).toBe(spec.durationSeconds);
      starts.add(Math.round(rain.startAt));
    }
    expect(starts.size).toBeGreaterThan(4);
    expect(scheduleDustStorm(data.events, seededRng(1))).toBeNull(); // no dust storm on Titan
    expect(scheduleRainstorm(worldGameData('mars').events, seededRng(1))).toBeNull(); // no rain on Mars
  });

  it('ramps, makes it colder and blocks photos only while it falls', () => {
    const rain = { forecastAt: 340, startAt: 400, endAt: 460 };
    expect(stormIntensity(405, rain, spec)).toBeCloseTo(0.5, 9);
    expect(stormIntensity(430, rain, spec)).toBe(1);
    expect(stormFreezeFactor(1, spec)).toBe(spec.freezeFactor);
    expect(stormFreezeFactor(0, spec)).toBe(1);
    expect(rainBlocksPhotos(stormPhase(350, rain), spec)).toBe(false);
    expect(rainBlocksPhotos(stormPhase(401, rain), spec)).toBe(true);
    expect(rainBlocksPhotos(stormPhase(460, rain), spec)).toBe(false);
  });
});

describe('Titan soft-ground mask', () => {
  // 3x3 grid at 5 m: x, z in [-5, 5]
  const mask = { data: [0, 0, 0, 0, 255, 0, 0, 0, 0], n: 3, pixelM: 5 };
  it('samples value / 255 bilinearly on the vertex-centered grid, clamped at the edges', () => {
    expect(maskSoftness(mask, 0, 0)).toBe(1);
    expect(maskSoftness(mask, 2.5, 0)).toBeCloseTo(0.5, 9);
    expect(maskSoftness(mask, 2.5, 2.5)).toBeCloseTo(0.25, 9);
    expect(maskSoftness(mask, 5, 5)).toBe(0);
    expect(maskSoftness(mask, 100, -100)).toBe(0);
    expect(sampleMask(mask, -2.5, 0)).toBeCloseTo(127.5, 9);
  });
});

describe('Titan mission loop', () => {
  const nuclear: Part = {
    id: 'test-rtg', slot: 'power', name: 'test', description: '', cost: 0, mass: 0, size: 1, effects: { constantPower: 0.5, heat: 1 },
  };
  const battery: Part = { id: 'b', slot: 'battery', name: 'b', description: '', cost: 0, mass: 0, size: 1, effects: { batteryCapacity: 400 } };
  const parked = (dt: number): MissionSample => ({
    dt, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 0, inColdZone: false, softness: 0, throttling: false, impactMps: 0, upY: 1,
  });
  const noRain = { ...data.events, rainstorm: undefined };
  const run = (parts: Part[], from: (s: MissionState) => MissionState, until: number) => {
    const setup = missionSetup(parts, t, [], undefined, titanSetup(site, noRain, seededRng(1)));
    let s = from(startMission(setup));
    const notices: MarsNotice[] = [];
    while (s.seconds < until && !s.end) {
      const step = stepMission(s, parked(0.5), setup, t, noRain);
      s = step.state;
      notices.push(...step.marsNotices);
    }
    return { s, setup, notices };
  };

  it('drains the electronics by day, cools asleep, and wakes the rover at dawn with a notice', () => {
    const day = run([battery], (s) => s, 100);
    expect(day.s.energy).toBeCloseTo(400 - 100 * t.night!.awakeDrainPerSecond, 6);
    const asleep = run([battery, { ...battery, id: 'h', slot: 'heater', effects: { heat: 2 } }], (s) => ({ ...s, poweredDown: true, seconds: 299 }), 760);
    expect(asleep.notices.map((n) => n.kind)).toEqual(['dusk', 'dawn']);
    expect(asleep.notices[1]).toEqual({ kind: 'dawn', woke: true });
    expect(asleep.s.poweredDown).toBe(false);
    expect(asleep.s.freeze).toBeGreaterThan(60);
    expect(asleep.s.end).toBeNull();
  });

  it('a constant-power part adds income day and night, asleep too, and its heat counts against the cold (no real part has it)', () => {
    expect(data.parts.parts.some((p) => p.effects.constantPower !== undefined)).toBe(false);
    const withPower = run([battery, nuclear], (s) => ({ ...s, energy: 100, poweredDown: true, seconds: 400 }), 500);
    const without = run([battery], (s) => ({ ...s, energy: 100, poweredDown: true, seconds: 400 }), 500);
    expect(withPower.s.energy - without.s.energy).toBeCloseTo(100 * 0.5, 6);
    expect(withPower.s.freeze).toBeLessThan(without.s.freeze);
    const status = titanStatus(withPower.s, withPower.setup, t)!;
    expect(status).toMatchObject({ canDrive: false, lightsOn: false, clockRate: t.sleep!.nightClockRate }); // asleep at night
  });

  it('reports the rain to the HUD and the milestones: phase, intensity, photos blocked, storm notices', () => {
    const setup = missionSetup([battery, { ...battery, id: 'h', slot: 'heater', effects: { heat: 2 } }], t, [], undefined, titanSetup(site, data.events, seededRng(3)));
    const rain = setup.titan!.storm!;
    let s = startMission(setup);
    const edges: string[] = [];
    while (!s.end && s.seconds < rain.endAt + 1) {
      const step = stepMission(s, parked(0.5), setup, t, data.events);
      s = step.state;
      for (const n of step.marsNotices) if (n.kind === 'storm') edges.push(n.edge);
      if (s.seconds > rain.startAt + 15 && s.seconds < rain.endAt - 15) {
        const st = titanStatus(s, setup, t)!;
        expect(st).toMatchObject({ stormPhase: 'active', stormIntensity: 1, photosBlocked: true });
      }
    }
    expect(edges).toEqual(['forecast', 'started', 'cleared']);
  });
});
