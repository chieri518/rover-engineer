import { describe, expect, it } from 'vitest';
import { deathPenalty, isXrayReading, milestoneReward, missionPayout } from './payout';
import { testMilestones, testTuning } from './testData';
import { loadGameData } from '../gameData';
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

describe('ground-down X-ray readings (the robotic arm as the X-ray\'s upgrade, November 16)', () => {
  const mars = loadGameData('mars');
  const moon = loadGameData('moon');
  const catalog = mars.milestones.milestones;
  const m = (id: string) => catalog.find((x) => x.id === id)!;
  const factor = mars.tuning.instruments.arm!.groundDownFactor;
  const earned = [{ id: 'mars-rock-collection', stages: 2 }, { id: 'mars-rare-rock' }, { id: 'mars-documented-sample' }, { id: 'organic-signals', stages: 1 }];
  const run = (groundDown: boolean) => missionPayout({ survived: true, secondsLasted: 600, earned, ...(groundDown ? { groundDown } : {}) }, catalog, mars.tuning, []);

  it('the X-ray reading milestones are the X-ray\'s reading triggers only (Rock collection, Rare rock; not Documented sample)', () => {
    expect(catalog.filter(isXrayReading).map((x) => x.id)).toEqual(['mars-rock-collection', 'mars-rare-rock']);
    expect(isXrayReading(m('mars-documented-sample'))).toBe(false);
    expect(isXrayReading(m('organic-signals'))).toBe(false);
  });

  it('pays each stage of an X-ray reading milestone groundDownFactor times its money and RP, rounded; nothing else changes', () => {
    expect(factor).toBe(1.5);
    const plain = run(false);
    const ground = run(true);
    const paid = (p: typeof plain, id: string) => p.milestones.find((x) => x.milestone.id === id)!;
    const rc = m('mars-rock-collection');
    expect(paid(ground, 'mars-rock-collection')).toMatchObject({ stages: 2, money: Math.round(rc.money * factor) * 2, rp: Math.round(rc.rp * factor) * 2, factor });
    expect(paid(ground, 'mars-rare-rock')).toMatchObject({ money: Math.round(m('mars-rare-rock').money * factor), rp: Math.round(m('mars-rare-rock').rp * factor), factor });
    for (const id of ['mars-documented-sample', 'organic-signals']) {
      expect(paid(ground, id), id).toEqual(paid(plain, id));
      expect(paid(ground, id).factor, id).toBeUndefined();
    }
    expect(paid(plain, 'mars-rock-collection')).toMatchObject({ money: rc.money * 2, rp: rc.rp * 2 });
    expect(paid(plain, 'mars-rock-collection').factor).toBeUndefined();
    const extra = (Math.round(rc.money * factor) - rc.money) * 2 + Math.round(m('mars-rare-rock').money * factor) - m('mars-rare-rock').money;
    expect(ground.money - plain.money).toBe(extra);
    expect(ground.rp).toBeGreaterThan(plain.rp);
  });

  it('the per-stage reward the mission\'s milestone card shows matches the payout', () => {
    expect(milestoneReward(m('mars-rock-collection'), true, mars.tuning)).toEqual({ money: 158, rp: 15, factor });
    expect(milestoneReward(m('mars-rare-rock'), true, mars.tuning)).toEqual({ money: 180, rp: 45, factor });
    expect(milestoneReward(m('mars-rock-collection'), false, mars.tuning)).toEqual({ money: 105, rp: 10, factor: 1 });
  });

  it('a held record still pays nothing, ground down or not', () => {
    const p = missionPayout({ survived: true, secondsLasted: 600, earned: [{ id: 'mars-rare-rock' }], groundDown: true }, catalog, mars.tuning, ['mars-rare-rock']);
    expect(p.milestones).toEqual([]);
  });

  it('on the Moon (no arm tuning) the flag changes nothing', () => {
    const rc = moon.milestones.milestones.find((x) => x.id === 'rock-collection')!;
    expect(milestoneReward(rc, true, moon.tuning)).toEqual({ money: rc.money, rp: rc.rp, factor: 1 });
  });
});
