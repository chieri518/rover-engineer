import { describe, expect, it } from 'vitest';
import { deathPenalty, missionPayout } from './payout';
import { testMilestones, testTuning } from './testData';
import type { DeathCause } from './types';

describe('death penalty', () => {
  it('grows by cause: energy < stuck < froze < destroyed', () => {
    const causes: DeathCause[] = ['energy', 'stuck', 'froze', 'destroyed'];
    const penalties = causes.map((c) => deathPenalty(c, 100, testTuning));
    for (let i = 1; i < penalties.length; i++) expect(penalties[i]!).toBeGreaterThan(penalties[i - 1]!);
  });

  it('shrinks the longer the rover lasted', () => {
    expect(deathPenalty('destroyed', 0, testTuning)).toBe(400);
    expect(deathPenalty('destroyed', 150, testTuning)).toBe(250);
    expect(deathPenalty('destroyed', 300, testTuning)).toBe(100);
    expect(deathPenalty('destroyed', 60, testTuning)).toBeGreaterThan(deathPenalty('destroyed', 120, testTuning));
  });

  it('clamps time outside the mission length', () => {
    expect(deathPenalty('energy', -5, testTuning)).toBe(100);
    expect(deathPenalty('energy', 999, testTuning)).toBe(25);
  });
});

describe('mission payout', () => {
  it('survived: survival payout + milestone money, RP from milestones', () => {
    const p = missionPayout(
      { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }, { id: 'layers' }] },
      testMilestones, testTuning, [],
    );
    expect(p.survivalPayout).toBe(250);
    expect(p.milestoneMoney).toBe(170);
    expect(p.penalty).toBe(0);
    expect(p.money).toBe(420);
    expect(p.rp).toBe(30);
    expect(p.newRecords).toEqual(['touchdown']);
  });

  it('died: milestones still pay, minus the penalty, no survival payout', () => {
    const p = missionPayout(
      { survived: false, cause: 'stuck', secondsLasted: 150, earned: [{ id: 'boulders' }] },
      testMilestones, testTuning, [],
    );
    expect(p.survivalPayout).toBe(0);
    expect(p.penalty).toBe(125); // 200 * (1 - 0.75 * 0.5)
    expect(p.money).toBe(50 - 125);
    expect(p.rp).toBe(3);
  });

  it('pays staged milestones once per stage, capped at the number of stages', () => {
    const run = (stages: number) =>
      missionPayout({ survived: true, secondsLasted: 300, earned: [{ id: 'odometer', stages }] }, testMilestones, testTuning, []);
    expect(run(2).milestoneMoney).toBe(60);
    expect(run(2).rp).toBe(4);
    expect(run(9).milestoneMoney).toBe(90);
    expect(run(0).milestones).toHaveLength(0);
  });

  it('pays a record only once per campaign', () => {
    const p = missionPayout(
      { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }] }, testMilestones, testTuning, ['touchdown'],
    );
    expect(p.milestoneMoney).toBe(0);
    expect(p.newRecords).toEqual([]);
  });

  it('ignores a milestone reported twice', () => {
    const p = missionPayout(
      { survived: true, secondsLasted: 300, earned: [{ id: 'boulders' }, { id: 'boulders' }] }, testMilestones, testTuning, [],
    );
    expect(p.milestoneMoney).toBe(50);
  });

  it('rejects a death without a cause and unknown milestones', () => {
    expect(() => missionPayout({ survived: false, secondsLasted: 10, earned: [] }, testMilestones, testTuning, [])).toThrow();
    expect(() =>
      missionPayout({ survived: true, secondsLasted: 300, earned: [{ id: 'nope' }] }, testMilestones, testTuning, []),
    ).toThrow();
  });
});
