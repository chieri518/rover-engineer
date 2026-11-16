import { describe, expect, it } from 'vitest';
import { buildRoundStats, isRoundStats, startTally, stepTally, tallyMeasure, type RoundMeasure } from './roundStats';
import { missionPayout } from './payout';
import { missionSetup, startMission, type MissionState } from './mission';
import { selectedParts } from './rover';
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

const start = (): MissionState => startMission(missionSetup(selectedParts(build, testParts), testTuning, []));
const at = (s: MissionState, patch: Partial<MissionState>): MissionState => ({ ...s, ...patch });

describe('mission tally', () => {
  it('tracks the lowest battery, the peak cold and the energy used without touching the state', () => {
    const s0 = start();
    let tally = startTally(s0);
    const s1 = at(s0, { seconds: 1, energy: s0.energy - 30, freeze: 20 });
    const s2 = at(s1, { seconds: 2, energy: s1.energy + 10, freeze: 5 }); // solar income: charge rises
    const s3 = at(s2, { seconds: 3, energy: s2.energy - 15, freeze: 10 });
    tally = stepTally(tally, s0, s1, null);
    tally = stepTally(tally, s1, s2, null);
    tally = stepTally(tally, s2, s3, null, true);
    expect(tally.lowestEnergy).toBe(s0.energy - 35);
    expect(tally.peakFreeze).toBe(20);
    expect(tally.energyUsed).toBe(45);
    expect(tally.samples).toBe(1);
    expect(tally.nights).toEqual([]);
  });

  it('classifies each night lived through to dawn by how most of it was spent', () => {
    let s = start();
    let tally = startTally(s);
    const step = (patch: Partial<MissionState>, night: boolean, lightsOn: boolean) => {
      const next = at(s, patch);
      tally = stepTally(tally, s, next, { night, lightsOn });
      s = next;
    };
    step({ seconds: 10 }, false, false);
    step({ seconds: 20 }, true, true); // 10 s lights
    step({ seconds: 50, poweredDown: true }, true, false); // 30 s asleep
    step({ seconds: 60, poweredDown: false }, false, false); // dawn
    step({ seconds: 70 }, true, true); // 10 s lights
    step({ seconds: 75 }, false, false); // dawn
    step({ seconds: 80 }, true, false); // 5 s dark, night still going
    expect(tally.nights).toEqual(['asleep', 'lights']);
    const survived = at(s, { end: { survived: true, seconds: 80 } });
    expect(tallyMeasure(tally, survived, 100, 2, true).nights).toEqual(['asleep', 'lights', 'dark']);
    const lost = at(s, { end: { survived: false, cause: 'froze', seconds: 80 } });
    expect(tallyMeasure(tally, lost, 100, 2, true).nights).toEqual(['asleep', 'lights']);
    expect(tallyMeasure(tally, lost, 100, 2, false).nights).toBeNull(); // the Moon has no nights
  });
});

describe('round stats', () => {
  const measure: RoundMeasure = {
    distanceM: 1234, batteryCapacity: 200, energyUsed: 150, lowestEnergy: 50, peakFreeze: 40, samples: 2, photos: 3,
    nights: ['asleep', 'lights', 'asleep'],
  };

  it('builds a record from the result, payout, measure and the rover flown', () => {
    const result = { survived: true, secondsLasted: 300, earned: [{ id: 'touchdown' }, { id: 'odometer', stages: 2 }, { id: 'layers' }] };
    const payout = missionPayout(result, testMilestones, testTuning, []);
    const r = buildRoundStats({ mission: 'mars', passed: true, result, payout, measure, build, balanceAfter: 777, data });
    expect(r).toMatchObject({
      mission: 'mars', passed: true, outcome: 'survived', secondsLasted: 300, missionSeconds: 300, distanceM: 1234,
      moneyEarned: payout.survivalPayout + payout.milestoneMoney, penalty: 0, net: payout.money, rp: payout.rp, balanceAfter: 777,
      batteryCapacity: 200, energyUsed: 150, lowestBattery: 0.25, peakCold: 0.4, samples: 2, photos: 3,
      nights: { survived: 3, asleep: 2, lights: 1, dark: 0 },
    });
    expect(r.milestones).toEqual([
      { category: 'capability', earned: 1, available: 3 },
      { category: 'scientific', earned: 1, available: 1 },
      { category: 'record', earned: 1, available: 1 },
    ]);
    const parts = selectedParts(build, testParts);
    const busCost = parts.filter((p) => p.slot !== 'instrument').reduce((s, p) => s + p.cost, 0);
    const payloadCost = parts.filter((p) => p.slot === 'instrument').reduce((s, p) => s + p.cost, 0);
    expect(r.spentRover).toBe(busCost + payloadCost);
    expect(r.spentTicket).toBeGreaterThan(0);
    expect(r.build).toEqual({ parts: ['steel', 'solid', 'panel', 'battery', 'lamp', 'heater'], payload: ['camera'] });
    expect(isRoundStats(r)).toBe(true);
  });

  it('records how the rover was lost, the penalty, and no nights on the Moon', () => {
    const result = { survived: false, cause: 'destroyed' as const, detail: 'rollover' as const, secondsLasted: 120, earned: [] };
    const payout = missionPayout(result, testMilestones, testTuning, []);
    const r = buildRoundStats({ mission: 'moon', passed: false, result, payout, measure: { ...measure, nights: null }, build: null, balanceAfter: -5, data });
    expect(r.outcome).toBe('rollover');
    expect(r.penalty).toBe(payout.penalty);
    expect(r.net).toBe(-payout.penalty);
    expect(r.nights).toBeNull();
    expect(r.spentRover).toBe(0);
    expect(r.build).toEqual({ parts: [], payload: [] });
  });

  it('rejects entries that are not stats', () => {
    expect(isRoundStats(null)).toBe(false);
    expect(isRoundStats({ mission: 'moon' })).toBe(false);
  });
});
