// Sanity checks on the real data in game/data/. These encode the balance targets, not exact numbers.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { quoteBuild } from './quote';
import { cheapestBuild } from './rover';
import { meetsRequirements, selectedParts } from './rover';
import type { Build, GameData, Slot } from './types';
import terrain from '../../public/terrain/terrain.json';

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

  it('the Moon minimum budget is enough to buy at least one launchable rover', () => {
    const min = data.tuning.budget.minimumBudget.moon;
    const quotes = allBuilds().map((b) => quoteBuild(b, data, min));
    expect(quotes.some((q) => q.canLaunch && q.canAfford)).toBe(true);
  });

  it('the starting budget is above the Moon minimum, and the default build can launch', () => {
    expect(data.tuning.budget.startingBudget).toBeGreaterThanOrEqual(data.tuning.budget.minimumBudget.moon);
    expect(quoteBuild(cheapestBuild(data.parts), data, data.tuning.budget.startingBudget).canLaunch).toBe(true);
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
});
