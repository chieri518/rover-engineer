// Sanity checks on the real data in game/data/. These encode the balance targets, not exact numbers.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { quoteBuild } from './quote';
import { cheapestBuild } from './rover';
import { meetsRequirements, selectedParts } from './rover';
import type { Build, GameData, Slot } from './types';
import terrain from '../../public/terrain/terrain.json';
import { missionSetup, startMission, stepMission, type MissionState } from './mission';

const data: GameData = loadGameData();

function allBuilds(): Build[] {
  let builds: Partial<Build>[] = [{}];
  for (const slot of data.parts.slots) {
    const options = data.parts.parts.filter((p) => p.slot === slot);
    builds = builds.flatMap((b) => options.map((o) => ({ ...b, [slot as Slot]: o.id })));
  }
  return builds as Build[];
}

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

  it('the default build fits the Medium ticket, is affordable and not overloaded', () => {
    const q = quoteBuild(data.parts.defaultBuild, data, data.tuning.budget.startingBudget);
    const medium = data.tiers.tiers.findIndex((t) => t.id === 'medium');
    expect(q.tier).not.toBeNull();
    expect(data.tiers.tiers.indexOf(q.tier!)).toBeLessThanOrEqual(medium);
    expect(q.canAfford).toBe(true);
    expect(q.overloaded).toBe(false);
  });

  it('death penalties are ordered energy < stuck < froze < destroyed', () => {
    const p = data.tuning.payout.deathPenalty;
    expect(p.energy).toBeLessThan(p.stuck);
    expect(p.stuck).toBeLessThan(p.froze);
    expect(p.froze).toBeLessThan(p.destroyed);
  });

  it('speed: a light build can just reach the dark crater in one mission, a heavy build cannot', () => {
    const craterM = terrain.features.shadowedCrater.entryPoint.driveDistanceFromLanding_m;
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

  it('energy: the default build driving nonstop in half sunlight finishes with charge left, in shadow it runs out', () => {
    const half = nonstop(data.parts.defaultBuild, 0.5);
    expect(half.end?.survived).toBe(true);
    expect(half.energy).toBeGreaterThan(0.1 * quoteBuild(data.parts.defaultBuild, data, 0).drive.batteryCapacity);
    const dark = nonstop(data.parts.defaultBuild, 0);
    expect(dark.end?.cause).toBe('energy');
    expect(dark.end!.seconds).toBeGreaterThan(200);
  });

  it('energy: climbing all mission long in little sunlight drains the cheapest build', () => {
    const s = nonstop(cheapestBuild(data.parts), 0.25, 5);
    expect(s.end?.cause).toBe('energy');
  });
});
