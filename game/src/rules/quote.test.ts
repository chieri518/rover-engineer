import { describe, expect, it } from 'vitest';
import { quoteBuild } from './quote';
import { testMilestones, testParts, testTiers, testTuning } from './testData';
import type { Build, GameData } from './types';

const data = {
  parts: testParts,
  tiers: { tiers: testTiers },
  milestones: { milestones: testMilestones },
  tuning: testTuning,
} as unknown as GameData;

const build: Build = {
  chassis: 'steel', wheels: 'solid', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', instrument: 'camera',
};

describe('build quote', () => {
  it('adds the ticket to the parts and shows what is left of the balance', () => {
    const q = quoteBuild(build, data, 700); // 85 kg, size 18: Large
    expect(q.tier?.id).toBe('large');
    expect(q.totalCost).toBe(245 + 300);
    expect(q.remaining).toBe(700 - 545);
    expect(q.canAfford).toBe(true);
    expect(quoteBuild(build, data, 500).canAfford).toBe(false);
    expect(quoteBuild(build, data, 500).remaining).toBe(-45);
  });

  it('explains the tier and reports the chassis load', () => {
    const q = quoteBuild(build, data, 700);
    expect(q.tierWhy.exceeded?.tier.id).toBe('medium');
    expect(q.tierWhy.exceeded?.massOver).toBe(5);
    expect(q.maxLoad).toBe(80);
    expect(q.overloaded).toBe(true);
  });

  it('includes the derived driving stats', () => {
    const q = quoteBuild(build, data, 700);
    expect(q.drive.massKg).toBe(85);
    expect(q.drive.topSpeed).toBeCloseTo(q.drive.realTopSpeed * testTuning.speed.compression, 9);
  });

  it('quotes a draft build: an empty design, and a partial one, report the empty slots', () => {
    const empty = quoteBuild({}, data, 700);
    expect(empty.complete).toBe(false);
    expect(empty.missing).toEqual(testParts.slots);
    expect(empty.cost).toBe(0);
    expect(empty.drive.topSpeed).toBe(0);
    const partial = quoteBuild({ chassis: 'steel', lights: 'no-lights' }, data, 700);
    expect(partial.missing).toEqual(testParts.slots.filter((s) => s !== 'chassis' && s !== 'lights'));
    expect(partial.mass).toBe(testParts.parts.find((p) => p.id === 'steel')!.mass);
    expect(quoteBuild(build, data, 700).complete).toBe(true);
  });
});
