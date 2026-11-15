// Sanity checks on the real data in game/data/. These encode the balance targets, not exact numbers.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { quoteBuild } from './quote';
import { cheapestBuild } from './rover';
import { meetsRequirements, selectedParts } from './rover';
import type { Build, GameData } from './types';
import terrain from '../../public/terrain/terrain.json';
import { missionSetup, startMission, stepMission, type MissionState } from './mission';
import { allBuilds as everyBuild, dominatedPairs, evaluateBuild, simulate } from './balance';

const data: GameData = loadGameData();
const allBuilds = () => everyBuild(data);
const craterM = terrain.features.shadowedCrater.entryPoint.driveDistanceFromLanding_m;

describe('game data', () => {
  it('passes validation', () => {
    expect(() => loadGameData()).not.toThrow();
  });

  it('has 7 slots with 2 options each, 3 tiers and 13 milestones', () => {
    expect(data.parts.slots).toHaveLength(7);
    for (const slot of data.parts.slots) expect(data.parts.parts.filter((p) => p.slot === slot)).toHaveLength(2);
    expect(data.tiers.tiers.map((t) => t.name)).toEqual(['Small', 'Medium', 'Large']);
    expect(data.milestones.milestones).toHaveLength(13);
  });

  it('offers camera and drill as the instrument options', () => {
    const instruments = data.parts.parts.filter((p) => p.slot === 'instrument').map((p) => p.effects.instrument);
    expect(instruments.sort()).toEqual(['camera', 'drill']);
  });

  it('a mid build fits the Medium tier and is affordable from the starting budget', () => {
    const mid: Build = {
      chassis: 'chassis-titanium', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
      lights: 'lights-led', heater: 'heater-rhu', instrument: 'instrument-camera',
    };
    const q = quoteBuild(mid, data, data.tuning.budget.startingBudget);
    expect(q.tier?.id).toBe('medium');
    expect(q.canAfford).toBe(true);
    expect(q.overloaded).toBe(false);
  });

  it('every tier is used by some build, and the starting budget cannot buy the best of everything', () => {
    const quotes = allBuilds().map((b) => quoteBuild(b, data, data.tuning.budget.startingBudget));
    for (const tier of data.tiers.tiers) expect(quotes.some((q) => q.tier?.id === tier.id)).toBe(true);
    expect(quotes.some((q) => q.canLaunch && !q.canAfford)).toBe(true);
  });

  it('the top tier is a real limit: the bulkiest builds cannot launch', () => {
    const quotes = allBuilds().map((b) => quoteBuild(b, data, data.tuning.budget.startingBudget));
    expect(quotes.some((q) => !q.canLaunch)).toBe(true);
    expect(quotes.filter((q) => q.canLaunch).length).toBeGreaterThan(quotes.length * 0.9);
  });

  it('the Moon minimum budget is enough to buy at least one launchable rover', () => {
    const min = data.tuning.budget.minimumBudget.moon;
    const quotes = allBuilds().map((b) => quoteBuild(b, data, min));
    expect(quotes.some((q) => q.canLaunch && q.canAfford)).toBe(true);
  });

  it('the starting budget is above the Moon minimum, and the cheapest build can launch', () => {
    expect(data.tuning.budget.startingBudget).toBeGreaterThanOrEqual(data.tuning.budget.minimumBudget.moon);
    expect(quoteBuild(cheapestBuild(data.parts), data, data.tuning.budget.startingBudget).canLaunch).toBe(true);
  });

  it('the default build fits exactly the Medium ticket, is affordable and not overloaded', () => {
    const q = quoteBuild(data.parts.defaultBuild, data, data.tuning.budget.startingBudget);
    expect(q.tier?.id).toBe('medium');
    expect(q.canAfford).toBe(true);
    expect(q.overloaded).toBe(false);
  });

  it('cheap parts are heavy, light parts are expensive: in every slot with two real parts, the cheaper one is heavier', () => {
    for (const slot of ['chassis', 'wheels', 'power', 'battery'] as const) {
      const [a, b] = data.parts.parts.filter((p) => p.slot === slot).sort((x, y) => x.cost - y.cost);
      expect(a!.cost, slot).toBeLessThan(b!.cost);
      expect(a!.mass, slot).toBeGreaterThan(b!.mass);
    }
  });

  it('no build dominates another: a better build always costs more (ticket included)', () => {
    const pairs = dominatedPairs(allBuilds().map((b) => evaluateBuild(b, data)));
    expect(pairs.map(([a, b]) => `${a.label} (${a.total}) beats ${b.label} (${b.total})`)).toEqual([]);
  });

  it('tier jumps matter: several sensible builds sit just over a tier limit', () => {
    // Launchable, affordable, not overloaded, and within 3 kg or 1 size unit of the tier below.
    const tiers = data.tiers.tiers;
    const near = allBuilds()
      .map((b) => evaluateBuild(b, data))
      .filter((e) => {
        const i = tiers.findIndex((t) => t.name === e.tier);
        if (i < 1 || e.total > data.tuning.budget.startingBudget || e.overloadKg > 0) return false;
        const below = tiers[i - 1]!;
        return e.mass - below.massLimit <= 3 && e.size - below.sizeLimit <= 1;
      });
    expect(near.length).toBeGreaterThanOrEqual(5);
  });

  it('death penalties are ordered energy < stuck < froze < destroyed', () => {
    const p = data.tuning.payout.deathPenalty;
    expect(p.energy).toBeLessThan(p.stuck);
    expect(p.stuck).toBeLessThan(p.froze);
    expect(p.froze).toBeLessThan(p.destroyed);
  });

  it('speed: a light build can just reach the dark crater in one mission, a heavy build cannot', () => {
    const seconds = data.tuning.mission.lengthSeconds;
    const dark = data.milestones.milestones.find((m) => m.id === 'into-the-dark')!;
    const quotes = allBuilds().map((b) => ({ b, q: quoteBuild(b, data, data.tuning.budget.startingBudget) }));
    const launchable = quotes.filter(({ q }) => q.canLaunch && q.canAfford);
    // Fastest build that can buy and is equipped for the dark crater (lights and heater).
    const crater = launchable.filter(({ b }) => meetsRequirements(selectedParts(b, data.parts), dark));
    const fastest = Math.max(...crater.map(({ q }) => q.drive.topSpeed));
    const slowest = Math.min(...launchable.map(({ q }) => q.drive.topSpeed));
    expect(fastest).toBeGreaterThanOrEqual(10);
    expect(fastest).toBeLessThanOrEqual(14);
    expect(slowest).toBeGreaterThanOrEqual(5);
    expect(slowest).toBeLessThanOrEqual(7.5);
    // Top speed for the whole mission, with room for slopes, turns and stops.
    expect(fastest * seconds).toBeGreaterThan(craterM * 1.1);
    expect(slowest * seconds).toBeLessThan(craterM * 0.75);
  });

  // Drive flat out at top speed for the whole mission with a given share of sunlight.
  function nonstop(build: Build, sunlight: number, uphillDeg = 0): MissionState {
    const parts = selectedParts(build, data.parts);
    const setup = missionSetup(parts, data.tuning, []);
    let s = startMission(setup);
    const dt = 0.5;
    while (!s.end) {
      const v = setup.stats.topSpeed;
      s = stepMission(s, {
        dt, distanceM: v * dt, speedMps: v, uphillDeg, slopeDeg: 5, sunlight, inColdZone: false, softness: 0,
        throttling: true, impactMps: 0, upY: 1,
      }, setup, data.tuning, data.events).state;
    }
    return s;
  }

  it('energy: driving nonstop in full sun slowly drains the default build; a solar mast about breaks even', () => {
    const d = data.parts.defaultBuild;
    const capacity = quoteBuild(d, data, 0).drive.batteryCapacity;
    const sun = nonstop(d, 1);
    expect(sun.end?.survived).toBe(true);
    expect(sun.energy).toBeGreaterThan(0.05 * capacity);
    expect(sun.energy).toBeLessThan(0.5 * capacity);
    const mast = evaluateBuild({ ...d, power: 'power-solar-mast' }, data);
    expect(Math.abs(mast.income - mast.driveDrain)).toBeLessThan(0.3);
  });

  it('energy: careless play runs out, careful play survives (default build, half sunlight)', () => {
    const d = data.parts.defaultBuild;
    const careless = simulate(d, data, { sunlight: 0.5, driveShare: 1 });
    expect(careless.end.cause).toBe('energy');
    expect(careless.end.seconds).toBeGreaterThan(200);
    const careful = simulate(d, data, { sunlight: 0.5, driveShare: 0.7 });
    expect(careful.end.survived).toBe(true);
    const dark = nonstop(d, 0);
    expect(dark.end?.cause).toBe('energy');
    expect(dark.end!.seconds).toBeLessThan(200);
  });

  it('energy: the dark crater dash needs a big battery or a solar mast', () => {
    // Fast crater-equipped builds (entry before ~265 s): drive there in mostly sun, then into the shadow.
    const dark = data.milestones.milestones.find((m) => m.id === 'into-the-dark')!;
    const fast = allBuilds()
      .filter((b) => meetsRequirements(selectedParts(b, data.parts), dark))
      .map((b) => evaluateBuild(b, data))
      .filter((e) => e.tier !== null && craterM / e.topSpeed < 265);
    const dash = (b: Build) => simulate(b, data, { sunlight: (m) => (m < craterM ? 0.8 : 0), driveShare: 1 });
    const plain = fast.filter((e) => e.build.battery === 'battery-li-ion' && e.build.power === 'power-fixed-panel');
    const invested = fast.filter((e) => e.build.battery === 'battery-nih2' || e.build.power === 'power-solar-mast');
    expect(plain.length).toBeGreaterThan(0);
    expect(invested.length).toBeGreaterThan(0);
    for (const e of plain) expect(dash(e.build).end.cause).toBe('energy');
    for (const e of invested) expect(dash(e.build).end.survived).toBe(true);
  });

  it('energy: climbing all mission long in little sunlight drains the cheapest build', () => {
    const s = nonstop(cheapestBuild(data.parts), 0.25, 5);
    expect(s.end?.cause).toBe('energy');
  });
});
