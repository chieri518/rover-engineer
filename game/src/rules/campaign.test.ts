import { describe, expect, it } from 'vitest';
import { buyRover, canStartMission, finishMission, newCampaign, restartRound, startRound } from './campaign';
import { testMilestones, testParts, testTiers, testTuning } from './testData';
import type { Build, GameData } from './types';

const data = {
  parts: testParts,
  tiers: { tiers: testTiers },
  milestones: { milestones: testMilestones },
  tuning: testTuning,
} as GameData;

const build: Build = {
  chassis: 'steel', wheels: 'solid', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', payload: ['camera'],
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

  it('a new campaign starts with an empty notebook', () => {
    expect(newCampaign(testTuning).notebook).toEqual([]);
  });

  it('finishing a mission adds the relationships met to the notebook, once each, in the order met', () => {
    let s = startRound({ ...newCampaign(testTuning), notebook: ['xray-cold'] });
    s = buyRover(s, build, 545);
    const out = finishMission(s, {
      survived: true, secondsLasted: 300, earned: [],
      relationships: [{ id: 'cold-dark' }, { id: 'xray-cold' }, { id: 'seismometer-quiet' }],
    }, data);
    expect(out.state.notebook).toEqual(['xray-cold', 'cold-dark', 'seismometer-quiet']);
    // A result without relationships leaves the notebook as it was.
    expect(finishMission(out.state, { survived: true, secondsLasted: 300, earned: [] }, data).state.notebook).toEqual(out.state.notebook);
  });

  it('a failed round still adds to the notebook, and the restart keeps it (it is not in the snapshot)', () => {
    let s = startRound(newCampaign(testTuning));
    expect(s.snapshot).not.toHaveProperty('notebook');
    s = buyRover(s, build, 700);
    const out = finishMission(s, { survived: false, cause: 'froze', secondsLasted: 30, earned: [], relationships: [{ id: 'cold-dark' }] }, data);
    expect(out.failed).toBe(true);
    const restarted = startRound(restartRound(out.state));
    expect(restarted.balance).toBe(750);
    expect(restarted.notebook).toEqual(['cold-dark']);
  });

  it('the snapshot is not changed by later mutations', () => {
    const s = startRound(newCampaign(testTuning));
    s.records.push('x');
    expect(s.snapshot!.records).toEqual([]);
  });
});
