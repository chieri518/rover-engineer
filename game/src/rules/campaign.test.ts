import { describe, expect, it } from 'vitest';
import { buyRover, canStartMission, finishMission, newCampaign, nextMission, normalizeCampaign, restartRound, startRound } from './campaign';
import { testMilestones, testParts, testTiers, testTuning } from './testData';
import type { Build, GameData } from './types';

const data = {
  parts: testParts,
  tiers: { tiers: testTiers },
  milestones: { milestones: testMilestones },
  tuning: testTuning,
} as GameData;

const build: Build = {
  chassis: 'steel', wheels: 'solid', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', instrument: 'camera',
};

describe('campaign', () => {
  it('starts with the starting budget, no RP, no records', () => {
    const s = newCampaign(testTuning);
    expect(s).toMatchObject({ mission: 'moon', balance: 750, rp: 0, records: [], completed: [] });
  });

  it('checks the minimum budget before a mission can start', () => {
    const s = newCampaign(testTuning);
    expect(canStartMission(s, testTuning)).toBe(true);
    expect(canStartMission({ ...s, balance: 450 }, testTuning)).toBe(true);
    expect(canStartMission({ ...s, balance: 449 }, testTuning)).toBe(false);
  });

  it('buying a rover deducts parts and ticket, and refuses what it cannot afford', () => {
    const s = buyRover(newCampaign(testTuning), build, 545);
    expect(s.balance).toBe(205);
    expect(s.lastBuild).toEqual(build);
    expect(() => buyRover(newCampaign(testTuning), build, 751)).toThrow();
  });

  it('survived with enough money: mission completed, RP and records banked', () => {
    let s = startRound(newCampaign(testTuning));
    s = buyRover(s, build, 545);
    const out = finishMission(s, { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }, { id: 'layers' }] }, data);
    expect(out.failed).toBe(false);
    expect(out.state.balance).toBe(205 + 250 + 170);
    expect(out.state.rp).toBe(30);
    expect(out.state.records).toEqual(['touchdown']);
    expect(out.state.completed).toEqual(['moon']);
  });

  it('balance below the next mission minimum fails the round; it may go negative', () => {
    let s = startRound(newCampaign(testTuning));
    s = buyRover(s, build, 700);
    const out = finishMission(s, { survived: false, cause: 'destroyed', secondsLasted: 0, earned: [{ id: 'touchdown' }] }, data);
    expect(out.state.balance).toBe(50 + 150 - 400);
    expect(out.failed).toBe(true);
    expect(out.state.completed).toEqual([]);
  });

  it('restart restores balance, RP and records from the snapshot', () => {
    let s = { ...newCampaign(testTuning), rp: 12, records: ['old-record'] };
    s = startRound(s);
    s = buyRover(s, build, 700);
    const out = finishMission(s, { survived: false, cause: 'froze', secondsLasted: 30, earned: [{ id: 'touchdown' }] }, data);
    expect(out.state.records).toContain('touchdown');
    const restarted = restartRound(out.state);
    expect(restarted.balance).toBe(750);
    expect(restarted.rp).toBe(12);
    expect(restarted.records).toEqual(['old-record']);
  });

  it('records are earned once per campaign', () => {
    let s = startRound(newCampaign(testTuning));
    const first = finishMission(s, { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }] }, data);
    const second = finishMission(first.state, { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }] }, data);
    expect(second.payout.milestoneMoney).toBe(0);
    expect(second.state.records).toEqual(['touchdown']);
  });

  it('the snapshot is not changed by later mutations', () => {
    const s = startRound(newCampaign(testTuning));
    s.records.push('x');
    expect(s.snapshot!.records).toEqual([]);
  });

  it('runs Moon, then Mars, then the Titan end marker', () => {
    expect(nextMission('moon')).toBe('mars');
    expect(nextMission('mars')).toBe('titan');
    expect(nextMission('titan')).toBeNull();
  });

  it('a passed Moon round moves the campaign to Mars with a fresh restart snapshot', () => {
    let s = startRound(newCampaign(testTuning));
    s = buyRover(s, build, 545);
    const out = finishMission(s, { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }] }, data);
    expect(out.failed).toBe(false);
    expect(out.state.mission).toBe('mars');
    expect(out.state.completed).toEqual(['moon']);
    expect(out.state.snapshot).toEqual({ balance: out.state.balance, rp: out.state.rp, records: ['touchdown'] });
  });

  it('a failed round stays on its mission', () => {
    let s = startRound(newCampaign(testTuning));
    s = buyRover(s, build, 700);
    const out = finishMission(s, { survived: false, cause: 'destroyed', secondsLasted: 0, earned: [] }, data);
    expect(out.failed).toBe(true);
    expect(out.state.mission).toBe('moon');
  });

  it('a Mars restart restores the Mars snapshot, not the Moon one', () => {
    let s = startRound(newCampaign(testTuning));
    s = buyRover(s, build, 545);
    const moon = finishMission(s, { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }] }, data).state;
    const atMars = moon.balance;
    const m = buyRover(moon, build, atMars - 50);
    const mars = finishMission(m, { survived: false, cause: 'energy', secondsLasted: 10, earned: [{ id: 'layers' }] }, data);
    expect(mars.failed).toBe(true);
    expect(mars.state.mission).toBe('mars');
    const restarted = restartRound(mars.state);
    expect(restarted.balance).toBe(atMars);
    expect(restarted.records).toEqual(['touchdown']);
  });

  it('a passed Mars round ends the campaign at the Titan marker', () => {
    const s = startRound({ ...newCampaign(testTuning), mission: 'mars' as const, completed: ['moon' as const], balance: 1000 });
    const out = finishMission(s, { survived: true, secondsLasted: 600, earned: [] }, data);
    expect(out.failed).toBe(false);
    expect(out.state.mission).toBe('titan');
    expect(out.state.completed).toEqual(['moon', 'mars']);
  });

  it('logs each passed mission for the campaign summary, and not a failed one', () => {
    let s = startRound(newCampaign(testTuning));
    s = buyRover(s, build, 545);
    const moon = finishMission(s, { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }, { id: 'layers' }] }, data);
    expect(moon.state.log).toEqual([{ mission: 'moon', outcome: 'survived', secondsLasted: 300, money: 420, rp: 30, milestones: 2 }]);
    const lost = finishMission(buyRover(moon.state, build, moon.state.balance), { survived: false, cause: 'froze', secondsLasted: 40, earned: [] }, data);
    expect(lost.failed).toBe(true);
    expect(lost.state.log).toHaveLength(1);
    const rolled = finishMission(moon.state, { survived: false, cause: 'destroyed', detail: 'rollover', secondsLasted: 90, earned: [] }, data);
    expect(rolled.failed).toBe(false);
    expect(rolled.state.mission).toBe('titan');
    expect(rolled.state.log!.map((e) => [e.mission, e.outcome])).toEqual([['moon', 'survived'], ['mars', 'rollover']]);
  });

  it('a save from before the campaign advanced moves on to Mars', () => {
    const old = { ...newCampaign(testTuning), completed: ['moon' as const], balance: 900 };
    const s = normalizeCampaign(old);
    expect(s.mission).toBe('mars');
    expect(s.snapshot).toEqual({ balance: 900, rp: 0, records: [] });
    const current = startRound(newCampaign(testTuning));
    expect(normalizeCampaign(current)).toBe(current);
  });
});
