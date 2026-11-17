import { describe, expect, it } from 'vitest';
import {
  dustDevilActive,
  dustDevilCleaned,
  dustDevilClosestM,
  dustDevilPosition,
  dustDevilsForming,
  dustDevilStrength,
  dustDevilsWithin,
  dustIncomeLoss,
  dustLessonReached,
  dustLossPerSecond,
  placeDustDevil,
  roverDustRate,
  scheduleDustDevils,
  settleDust,
  stepDust,
} from './dust';
import { seededRng } from './events';
import { solClock } from './sol';
import { worldGameData } from '../gameData';
import type { DustDevilSlot, DustDevilSpec, DustTuning, SolTuning } from './marsTypes';

const dust: DustTuning = { perSol: 0.03, stormMultiplier: 3, minFactor: 0.25, lessonLoss: 0.15, dustDevilCleanM: 50, dustDevilSenseM: 150 };
const spec: DustDevilSpec = {
  everySols: 3,
  daySecondsWindow: [8, 24],
  lifeSeconds: 20,
  speedMps: 4,
  maxPassM: 300,
  rampSeconds: 3,
  radiusM: 6,
  heightM: 150,
  source: 'test',
};
const sol: SolTuning = { sols: 10, secondsPerSol: 60, daySeconds: 45, nightSeconds: 15, solarLongitudeDeg: 200, startSecondsIntoDay: 7.25 };
const SOL = 60;

/** Settle for `sols` sols in small steps, as the mission does. */
function settleFor(factor: number, sols: number, rate: number, intensity = 0): number {
  const dt = 0.1;
  for (let i = 0; i < Math.round((sols * SOL) / dt); i++) factor = settleDust(factor, dt, rate, intensity, dust, SOL);
  return factor;
}

describe('dust on the panels', () => {
  it('takes the dust rate from the solar parts, weighted by income; an RTG rover has none', () => {
    expect(roverDustRate([{ energyIncome: 1.5 }])).toBe(1); // fixed panel: ×1 when it names no rate
    expect(roverDustRate([{ energyIncome: 1.2, dustRate: 0.8 }])).toBeCloseTo(0.8, 9); // solar mast
    expect(roverDustRate([{ energyIncome: 2.6, dustRate: 1.5 }])).toBeCloseTo(1.5, 9); // deployable arrays
    expect(roverDustRate([{}, { dustRate: 1.5 }])).toBe(0); // RTG: no energyIncome
    expect(roverDustRate([])).toBe(0);
    expect(roverDustRate([{ energyIncome: 1, dustRate: 1 }, { energyIncome: 3, dustRate: 2 }])).toBeCloseTo(1.75, 9);
  });

  it('settles perSol × dustRate of the clean income per sol, in a straight line', () => {
    expect(settleFor(1, 1, 1)).toBeCloseTo(0.97, 6);
    expect(settleFor(1, 1, 1.5)).toBeCloseTo(0.955, 6);
    expect(settleFor(1, 1, 0.8)).toBeCloseTo(0.976, 6);
    expect(settleFor(1, 10, 1)).toBeCloseTo(0.7, 6); // a fixed panel over a clear mission
    expect(dustLossPerSecond(1, 0, dust, SOL)).toBeCloseTo(0.0005, 12);
  });

  it('settles three times as fast at full storm strength, scaled by the intensity', () => {
    expect(settleFor(1, 1, 1, 1)).toBeCloseTo(0.91, 6);
    expect(settleFor(1, 1, 1, 0.5)).toBeCloseTo(0.94, 6);
    expect(dustLossPerSecond(1, 2, dust, SOL)).toBeCloseTo(dustLossPerSecond(1, 1, dust, SOL), 12); // clamped
  });

  it('never falls below minFactor, and stays there', () => {
    expect(settleFor(1, 30, 1.5, 1)).toBe(0.25);
    expect(settleDust(0.25, 10, 1.5, 1, dust, SOL)).toBe(0.25);
    expect(settleDust(0.26, 1000, 1, 0, dust, SOL)).toBe(0.25);
  });

  it('does not touch an RTG rover, a world without dust tuning, or a zero or negative step', () => {
    expect(settleFor(1, 10, 0, 1)).toBe(1);
    expect(settleDust(0.8, 60, 1, 0, undefined, SOL)).toBe(0.8);
    expect(settleDust(0.8, 0, 1, 0, dust, SOL)).toBe(0.8);
    expect(settleDust(0.8, -5, 1, 0, dust, SOL)).toBe(0.8);
    expect(settleDust(0.8, 5, 1, 0, dust, 0)).toBe(0.8);
  });

  it('resets to clean when a dust devil cleaned the panels this step', () => {
    expect(stepDust(0.6, { dt: 0.1, dustRate: 1, stormIntensity: 0, cleaned: true }, dust, SOL)).toBe(1);
    expect(stepDust(0.6, { dt: 60, dustRate: 1, stormIntensity: 0, cleaned: false }, dust, SOL)).toBeCloseTo(0.57, 9);
    expect(stepDust(0.6, { dt: 1, dustRate: 1, stormIntensity: 0, cleaned: true }, undefined, SOL)).toBe(0.6);
  });

  it('reaches the dust lesson once dust has cut income by 15%', () => {
    expect(dustIncomeLoss(1)).toBe(0);
    expect(dustIncomeLoss(0.8)).toBeCloseTo(0.2, 9);
    expect(dustLessonReached(1, dust)).toBe(false);
    expect(dustLessonReached(0.851, dust)).toBe(false);
    expect(dustLessonReached(0.85, dust)).toBe(true);
    expect(dustLessonReached(0.5, dust)).toBe(true);
    expect(dustLessonReached(0.5, undefined)).toBe(false);
    expect(dustLessonReached(0.5, { ...dust, lessonLoss: 0 })).toBe(false);
    // Clear sols to the lesson: fixed panel 5, solar mast 6.25, deployable arrays 3.33.
    expect(dustLessonReached(settleFor(1, 4.9, 1), dust)).toBe(false);
    expect(dustLessonReached(settleFor(1, 5.01, 1), dust)).toBe(true);
    expect(dustLessonReached(settleFor(1, 6.2, 0.8), dust)).toBe(false);
    expect(dustLessonReached(settleFor(1, 3.4, 1.5), dust)).toBe(true);
  });
});

describe('dust devil schedule', () => {
  const realLength = sol.sols * sol.secondsPerSol;

  it('draws one every 3 sols on average, 3 or 4 a mission, at most one per run of sols', () => {
    let total = 0;
    const seeds = 3000;
    for (let seed = 1; seed <= seeds; seed++) {
      const slots = scheduleDustDevils(spec, sol, realLength, seededRng(seed));
      expect(slots.length === 3 || slots.length === 4).toBe(true);
      const runs = slots.map((s) => Math.floor(Math.floor((s.at + 7.25) / SOL) / 3));
      expect(new Set(runs).size).toBe(slots.length);
      total += slots.length;
    }
    expect(total / seeds).toBeCloseTo(10 / 3, 1);
  });

  it('forms and dies by day, inside the mission, in time order', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const slots = scheduleDustDevils(spec, sol, realLength, seededRng(seed));
      slots.forEach((s, i) => {
        expect(s.at).toBeGreaterThanOrEqual(0);
        expect(s.at + spec.lifeSeconds).toBeLessThanOrEqual(realLength);
        if (i > 0) expect(s.at).toBeGreaterThan(slots[i - 1]!.at);
        expect(solClock(s.at, sol, 18.44).isNight).toBe(false);
        expect(solClock(s.at + spec.lifeSeconds - 1e-6, sol, 18.44).isNight).toBe(false);
        const into = (s.at + 7.25) % SOL;
        expect(into).toBeGreaterThanOrEqual(8);
        expect(into).toBeLessThanOrEqual(24);
        expect(s.passM).toBeGreaterThanOrEqual(0);
        expect(s.passM).toBeLessThanOrEqual(300);
        expect(s.headingDeg).toBeGreaterThanOrEqual(0);
        expect(s.headingDeg).toBeLessThan(360);
      });
    }
  });

  it('replays from its seed, and is empty without a spec or a sol clock', () => {
    expect(scheduleDustDevils(spec, sol, realLength, seededRng(42))).toEqual(scheduleDustDevils(spec, sol, realLength, seededRng(42)));
    expect(scheduleDustDevils(undefined, sol, realLength, seededRng(1))).toEqual([]);
    expect(scheduleDustDevils(spec, undefined, realLength, seededRng(1))).toEqual([]);
    expect(scheduleDustDevils({ ...spec, everySols: 0 }, sol, realLength, seededRng(1))).toEqual([]);
  });

  it('draws the same numbers per run whether a devil is kept or not', () => {
    // A shorter mission drops late devils but keeps the early ones exactly.
    const full = scheduleDustDevils(spec, sol, realLength, seededRng(7));
    const short = scheduleDustDevils(spec, sol, 200, seededRng(7));
    expect(short).toEqual(full.filter((s) => s.at + spec.lifeSeconds <= 200));
  });

  it('reports the devils that form between two times', () => {
    const slots: DustDevilSlot[] = [
      { at: 10, passM: 0, headingDeg: 0, side: 1 },
      { at: 100, passM: 0, headingDeg: 0, side: 1 },
    ];
    expect(dustDevilsForming(slots, 0, 10)).toEqual([slots[0]]);
    expect(dustDevilsForming(slots, 10, 99)).toEqual([]);
    expect(dustDevilsForming(slots, 0, 600)).toEqual(slots);
  });
});

describe('dust devil column', () => {
  const rover = { x: 100, z: -50 };
  const slot: DustDevilSlot = { at: 30, passM: 40, headingDeg: 0, side: 1 }; // moving north, passing to the east

  it('moves along its heading and passes the rover point at passM halfway through its life', () => {
    const devil = placeDustDevil(slot, spec, rover);
    expect(devil.endAt).toBe(50);
    const mid = dustDevilPosition(devil, 40);
    expect(mid.x).toBeCloseTo(140, 9); // east of the rover
    expect(mid.z).toBeCloseTo(-50, 9);
    const end = dustDevilPosition(devil, 50);
    expect(end.z - mid.z).toBeCloseTo(-40, 9); // north is −z, 4 m/s for 10 s
    expect(dustDevilClosestM(devil, 30, 50, rover, rover)).toBeCloseTo(40, 9);

    const west = placeDustDevil({ ...slot, side: -1 }, spec, rover);
    expect(dustDevilPosition(west, 40).x).toBeCloseTo(60, 9);
    const east = placeDustDevil({ ...slot, headingDeg: 90 }, spec, rover); // moving east, passing to the south (+z)
    expect(dustDevilPosition(east, 40).z).toBeCloseTo(-10, 9);
    expect(dustDevilPosition(east, 50).x - dustDevilPosition(east, 40).x).toBeCloseTo(40, 9);
  });

  it('only counts while it stands, and a long step cannot skip a pass', () => {
    const devil = placeDustDevil(slot, spec, rover);
    expect(dustDevilActive(devil, 29.9)).toBe(false);
    expect(dustDevilActive(devil, 30)).toBe(true);
    expect(dustDevilActive(devil, 50)).toBe(false);
    expect(dustDevilClosestM(devil, 0, 29, rover, rover)).toBe(Infinity);
    expect(dustDevilClosestM(devil, 50, 60, rover, rover)).toBe(Infinity);
    expect(dustDevilClosestM(devil, 0, 600, rover, rover)).toBeCloseTo(40, 9);
    expect(dustDevilClosestM(devil, 30, 35, rover, rover)).toBeCloseTo(Math.hypot(40, 20), 9); // still approaching
  });

  it('follows a moving rover through the step', () => {
    const devil = placeDustDevil(slot, spec, rover);
    // The rover drives east, toward the devil's line, at 3 m/s during the pass (devil − rover is linear in time).
    expect(dustDevilClosestM(devil, 35, 45, { x: 85, z: -50 }, { x: 115, z: -50 })).toBeCloseTo(32, 9); // (25.6, −19.2) at 44.8 s
    expect(dustDevilClosestM(devil, 38, 42, { x: 124, z: -50 }, { x: 136, z: -50 })).toBeCloseTo(8, 9); // (6.4, −4.8) at 41.2 s
  });

  it('cleans within 50 m and is sensed within 150 m', () => {
    const near = placeDustDevil({ ...slot, passM: 45 }, spec, rover);
    const mid = placeDustDevil({ ...slot, passM: 120 }, spec, rover);
    const far = placeDustDevil({ ...slot, passM: 200 }, spec, rover);
    const all = [near, mid, far];
    expect(dustDevilsWithin(all, 0, 60, rover, rover, dust.dustDevilCleanM)).toEqual([0]);
    expect(dustDevilsWithin(all, 0, 60, rover, rover, dust.dustDevilSenseM)).toEqual([0, 1]);
    expect(dustDevilCleaned(all, 0, 60, rover, rover, dust)).toBe(true);
    expect(dustDevilCleaned([mid, far], 0, 60, rover, rover, dust)).toBe(false);
    expect(dustDevilCleaned(all, 0, 60, rover, rover, undefined)).toBe(false);
  });

  it('builds up and dies down for the renderer', () => {
    const devil = placeDustDevil(slot, spec, rover);
    expect(dustDevilStrength(devil, 29, spec)).toBe(0);
    expect(dustDevilStrength(devil, 31.5, spec)).toBeCloseTo(0.5, 9);
    expect(dustDevilStrength(devil, 40, spec)).toBe(1);
    expect(dustDevilStrength(devil, 48.5, spec)).toBeCloseTo(0.5, 9);
    expect(dustDevilStrength(devil, 50, spec)).toBe(0);
    expect(dustDevilStrength(devil, 31, { ...spec, rampSeconds: 0 })).toBe(1);
  });
});

describe('Mars dust data', () => {
  const mars = worldGameData('mars');
  const marsDust = (mars.tuning as unknown as { dust?: DustTuning }).dust;
  const marsDevil = (mars.events as unknown as { dustdevil?: DustDevilSpec }).dustdevil;
  const moon = worldGameData('moon');

  it('holds the decided starting values (Mars M8, MS8)', () => {
    expect(marsDust).toEqual({ perSol: 0.03, stormMultiplier: 3, minFactor: 0.25, lessonLoss: 0.15, dustDevilCleanM: 50, dustDevilSenseM: 150 });
    expect(marsDevil).toMatchObject({ everySols: 3, maxPassM: 300 });
    expect(Object.keys(marsDevil ?? {}).sort()).toEqual(Object.keys(spec).sort());
  });

  it('fits together: devils by day, cleaning inside sensing inside the pass range, the lesson above the floor', () => {
    const t = mars.tuning.sol!;
    const [w0, w1] = marsDevil!.daySecondsWindow;
    expect(w0).toBeGreaterThanOrEqual(t.startSecondsIntoDay ?? 0);
    expect(w1 + marsDevil!.lifeSeconds).toBeLessThanOrEqual(t.daySeconds);
    expect(marsDust!.dustDevilCleanM).toBeLessThanOrEqual(marsDust!.dustDevilSenseM);
    expect(marsDust!.dustDevilSenseM).toBeLessThanOrEqual(marsDevil!.maxPassM);
    expect(marsDust!.lessonLoss).toBeLessThan(1 - marsDust!.minFactor);
    expect(scheduleDustDevils(marsDevil, t, mars.tuning.mission.lengthSeconds, seededRng(1)).length).toBeGreaterThanOrEqual(3);
  });

  it('is absent on the Moon', () => {
    expect((moon.tuning as unknown as { dust?: DustTuning }).dust).toBeUndefined();
    expect((moon.events as unknown as { dustdevil?: DustDevilSpec }).dustdevil).toBeUndefined();
  });
});
