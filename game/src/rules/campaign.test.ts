import { describe, expect, it } from 'vitest';
import { buyRover, canStartMission, endCampaign, finishMission, isPlayable, newCampaign, nextMission, normalizeCampaign, recordLessons, restartRound, roundPasses, startRound } from './campaign';
import type { RoundMeasure } from './roundStats';
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

  it('runs Moon, then Mars, then Titan, then the end marker', () => {
    expect(nextMission('moon')).toBe('mars');
    expect(nextMission('mars')).toBe('titan');
    expect(nextMission('titan')).toBe('complete');
    expect(nextMission('complete')).toBeNull();
    expect(isPlayable('titan')).toBe(true);
    expect(isPlayable('complete')).toBe(false);
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

  it('a passed Mars round moves the campaign to Titan with a fresh restart snapshot', () => {
    const s = startRound({ ...newCampaign(testTuning), mission: 'mars' as const, completed: ['moon' as const], balance: 1000 });
    const out = finishMission(s, { survived: true, secondsLasted: 600, earned: [] }, data);
    expect(out.failed).toBe(false);
    expect(out.state.mission).toBe('titan');
    expect(out.state.completed).toEqual(['moon', 'mars']);
    expect(out.state.snapshot).toEqual({ balance: out.state.balance, rp: out.state.rp, records: [] });
  });

  it('a passed Titan round ends the campaign at the end marker; a Titan restart restores the Titan snapshot', () => {
    const s = startRound({ ...newCampaign(testTuning), mission: 'titan' as const, completed: ['moon' as const, 'mars' as const], balance: 900 });
    const out = finishMission(s, { survived: true, secondsLasted: 900, earned: [] }, data);
    expect(out.failed).toBe(false);
    expect(out.state.mission).toBe('complete');
    expect(out.state.completed).toEqual(['moon', 'mars', 'titan']);
    expect(out.state.log!.map((e) => e.mission)).toEqual(['titan']);
    const lost = finishMission(buyRover(s, build, 900), { survived: false, cause: 'froze', secondsLasted: 500, earned: [] }, data);
    expect(lost.failed).toBe(true); // the rover was lost before the end
    expect(lost.state.mission).toBe('titan');
    expect(restartRound(lost.state).balance).toBe(900);
  });

  it('Titan passes on survival: the balance does not decide it; Moon and Mars still need the pass mark', () => {
    expect(roundPasses('titan', true, -500, testTuning)).toBe(true);
    expect(roundPasses('titan', false, 10_000, testTuning)).toBe(false);
    expect(roundPasses('moon', false, testTuning.budget.minimumBudget.mars, testTuning)).toBe(true);
    expect(roundPasses('moon', true, testTuning.budget.minimumBudget.mars - 1, testTuning)).toBe(false);
    expect(roundPasses('mars', true, testTuning.budget.minimumBudget.titan - 1, testTuning)).toBe(false);
    const s = startRound({ ...newCampaign(testTuning), mission: 'titan' as const, completed: ['moon' as const, 'mars' as const], balance: 0 });
    const broke = finishMission(buyRover(s, build, 0), { survived: true, secondsLasted: 900, earned: [] }, data);
    expect(broke.failed).toBe(false);
    expect(broke.state.mission).toBe('complete');
    const rich = startRound({ ...s, balance: 50_000 });
    const lost = finishMission(rich, { survived: false, cause: 'energy', secondsLasted: 612, earned: [] }, data);
    expect(lost.failed).toBe(true);
  });

  it('ending the campaign after a lost Titan round keeps the round and goes to the end marker', () => {
    const s = startRound({ ...newCampaign(testTuning), mission: 'titan' as const, completed: ['moon' as const, 'mars' as const], balance: 900 });
    const lost = finishMission(s, { survived: false, cause: 'energy', secondsLasted: 612, earned: [{ id: 'boulders' }] }, data);
    const ended = endCampaign(lost.state);
    expect(ended.mission).toBe('complete');
    expect(ended.completed).toEqual(['moon', 'mars']); // Titan not survived
    expect(ended.balance).toBe(lost.state.balance);
    expect(ended.snapshot).toBeNull();
    expect(isPlayable(ended.mission)).toBe(false);
    expect(normalizeCampaign(ended)).toBe(ended);
    const moon = startRound(newCampaign(testTuning));
    expect(endCampaign(moon)).toBe(moon); // only the last mission can end the campaign
  });

  it('records round stats as each mission ends, passed or not; a retry replaces them', () => {
    const measure: RoundMeasure = { distanceM: 800, batteryCapacity: 200, energyUsed: 90, lowestEnergy: 110, peakFreeze: 0, samples: 1, photos: 2, nights: null };
    let s = buyRover(startRound(newCampaign(testTuning)), build, 545);
    const moon = finishMission(s, { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }], measure }, data);
    expect(moon.state.stats!.map((r) => [r.mission, r.passed, r.distanceM, r.balanceAfter])).toEqual([['moon', true, 800, moon.state.balance]]);
    s = buyRover(moon.state, build, moon.state.balance);
    const lost = finishMission(s, { survived: false, cause: 'froze', secondsLasted: 40, earned: [], measure: { ...measure, nights: [] } }, data);
    expect(lost.failed).toBe(true);
    expect(lost.state.stats!.map((r) => [r.mission, r.passed, r.outcome])).toEqual([['moon', true, 'survived'], ['mars', false, 'froze']]);
    const retry = finishMission(restartRound(lost.state), { survived: true, secondsLasted: 600, earned: [], measure: { ...measure, distanceM: 50, nights: ['asleep'] } }, data);
    expect(retry.state.stats!.filter((r) => r.mission === 'mars').map((r) => [r.passed, r.distanceM])).toEqual([[true, 50]]);
    const unmeasured = finishMission(startRound(newCampaign(testTuning)), { survived: true, secondsLasted: 300, earned: [] }, data);
    expect(unmeasured.state.stats).toBeUndefined();
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

  it('a save at the old Titan end marker is now the Titan round', () => {
    const old = { ...newCampaign(testTuning), mission: 'titan' as const, completed: ['moon' as const, 'mars' as const], balance: 950 };
    const s = normalizeCampaign(old);
    expect(s.mission).toBe('titan');
    expect(isPlayable(s.mission)).toBe(true);
    expect(s.snapshot).toEqual({ balance: 950, rp: 0, records: [] });
    expect(normalizeCampaign(s)).toBe(s);
    const finished = { ...newCampaign(testTuning), mission: 'complete' as const, completed: ['moon' as const, 'mars' as const, 'titan' as const] };
    expect(normalizeCampaign(finished)).toBe(finished);
  });
});

describe('recordLessons', () => {
  it('merges new ids into the notebook only, once each, leaving everything else alone', () => {
    const s = buyRover(startRound(newCampaign(testTuning)), build, 545);
    const next = recordLessons(s, ['cold-dark', 'no-lights', 'cold-dark']);
    expect(next.notebook).toEqual(['cold-dark', 'no-lights']);
    expect({ ...next, notebook: [] }).toEqual({ ...s, notebook: [] });
    expect(next.snapshot).toBe(s.snapshot);
    expect(recordLessons(next, ['no-lights', 'xray-cold']).notebook).toEqual(['cold-dark', 'no-lights', 'xray-cold']);
  });

  it('returns the same state when nothing is new, and finishMission stays idempotent after it', () => {
    const s = recordLessons(startRound(newCampaign(testTuning)), ['no-lights']);
    expect(recordLessons(s, ['no-lights'])).toBe(s);
    expect(recordLessons(s, [])).toBe(s);
    const out = finishMission(s, { survived: true, secondsLasted: 1, earned: [], relationships: [{ id: 'no-lights' }, { id: 'cold-dark' }] } as never, data);
    expect(out.state.notebook).toEqual(['no-lights', 'cold-dark']);
  });
});
