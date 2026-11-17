import { describe, expect, it } from 'vitest';
import { clearCampaign, loadCampaign, saveCampaign } from './campaignSave';
import { isPlayable, newCampaign, normalizeCampaign, restartRound, startRound } from '../rules/campaign';
import { testTuning } from '../rules/testData';
import { loadGameData } from '../gameData';
import { carryBuild, payloadProblems } from '../rules/payload';
import { quoteBuild } from '../rules/quote';
import { completeBuild } from '../rules/rover';
import type { Build } from '../rules/types';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const throwingStore = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
  removeItem: () => { throw new Error('denied'); },
};

describe('campaign save', () => {
  it('round-trips a campaign, snapshot included', () => {
    const store = memoryStore();
    const state = startRound({ ...newCampaign(testTuning), rp: 7, records: ['touchdown'] });
    expect(saveCampaign(state, store)).toBe(true);
    expect(loadCampaign(store)).toEqual(state);
    clearCampaign(store);
    expect(loadCampaign(store)).toBeNull();
  });

  it('round-trips round stats, and keeps older saves without them working', () => {
    const store = memoryStore();
    const stats = {
      mission: 'titan' as const, passed: false, outcome: 'energy' as const, secondsLasted: 612, missionSeconds: 900, distanceM: 2100,
      milestones: [{ category: 'capability' as const, earned: 2, available: 5 }], moneyEarned: 120, penalty: 40, net: 80,
      spentRover: 400, spentTicket: 160, balanceAfter: 950, rp: 12, batteryCapacity: 300, energyUsed: 300, lowestBattery: 0,
      peakCold: 0.42, samples: 1, photos: 3, build: { parts: ['steel'], payload: ['camera'] }, nights: { survived: 0, asleep: 0, lights: 0, dark: 0 },
    };
    const state = { ...startRound(newCampaign(testTuning)), stats: [stats] };
    saveCampaign(state, store);
    expect(loadCampaign(store)).toEqual(state);
    store.setItem('rover-engineer.campaign.v1', JSON.stringify({ ...state, stats: [stats, { mission: 'moon' }, 3] }));
    expect(loadCampaign(store)!.stats).toEqual([stats]); // damaged entries are dropped
    const { stats: _drop, ...old } = state;
    store.setItem('rover-engineer.campaign.v1', JSON.stringify(old));
    expect(loadCampaign(store)!.stats).toBeUndefined(); // the dashboard shows these missions as not recorded
  });

  it('works without storage', () => {
    expect(saveCampaign(newCampaign(testTuning), null)).toBe(false);
    expect(loadCampaign(null)).toBeNull();
    expect(() => clearCampaign(null)).not.toThrow();
  });

  it('survives storage that throws', () => {
    expect(saveCampaign(newCampaign(testTuning), throwingStore)).toBe(false);
    expect(loadCampaign(throwingStore)).toBeNull();
    expect(() => clearCampaign(throwingStore)).not.toThrow();
  });

  it('keeps the notebook, and loads an older save without one with an empty notebook', () => {
    const store = memoryStore();
    const state = { ...startRound(newCampaign(testTuning)), notebook: ['cold-dark', 'xray-cold'] };
    saveCampaign(state, store);
    expect(loadCampaign(store)?.notebook).toEqual(['cold-dark', 'xray-cold']);
    const { notebook: _dropped, ...old } = state;
    store.setItem('rover-engineer.campaign.v1', JSON.stringify(old));
    expect(loadCampaign(store)).toEqual({ ...old, notebook: [] });
    store.setItem('rover-engineer.campaign.v1', JSON.stringify({ ...old, notebook: ['cold-dark', 7, null] }));
    expect(loadCampaign(store)?.notebook).toEqual(['cold-dark']);
    store.setItem('rover-engineer.campaign.v1', JSON.stringify({ ...old, notebook: 'cold-dark' }));
    expect(loadCampaign(store)?.notebook).toEqual([]);
  });

  it('ignores corrupt or foreign data', () => {
    const store = memoryStore();
    store.setItem('rover-engineer.campaign.v1', '{not json');
    expect(loadCampaign(store)).toBeNull();
    store.setItem('rover-engineer.campaign.v1', '{"hello":1}');
    expect(loadCampaign(store)).toBeNull();
  });
});

describe('campaign save across worlds', () => {
  const key = 'rover-engineer.campaign.v1';

  it('loads a save from before Mars (Moon completed, still on the Moon) and moves it on to Mars', () => {
    const store = memoryStore();
    // Written by the Moon-only build: no log, mission left at 'moon'.
    store.setItem(key, JSON.stringify({
      mission: 'moon', balance: 910, rp: 40, records: ['touchdown'], completed: ['moon'],
      snapshot: { balance: 600, rp: 0, records: [] }, lastBuild: null,
    }));
    const s = normalizeCampaign(loadCampaign(store)!);
    expect(s.mission).toBe('mars');
    expect(s.snapshot).toEqual({ balance: 910, rp: 40, records: ['touchdown'] });
  });

  it('round-trips a Mars round in progress; restarting rolls back to the Mars snapshot', () => {
    const store = memoryStore();
    const atMars = startRound({ ...newCampaign(testTuning), mission: 'mars' as const, completed: ['moon' as const], balance: 900, rp: 30 });
    const bought = { ...atMars, balance: 100 }; // the rover was bought, then the page was closed
    saveCampaign(bought, store);
    const loaded = normalizeCampaign(loadCampaign(store)!);
    expect(loaded).toEqual(bought);
    expect(restartRound(loaded).balance).toBe(900);
  });

  it('round-trips a finished campaign at the end marker, log included', () => {
    const store = memoryStore();
    const done = {
      ...newCampaign(testTuning), mission: 'complete' as const, completed: ['moon' as const, 'mars' as const, 'titan' as const],
      log: [{ mission: 'moon' as const, outcome: 'survived' as const, secondsLasted: 300, money: 400, rp: 30, milestones: 4 }],
    };
    saveCampaign(done, store);
    const loaded = loadCampaign(store)!;
    expect(loaded).toEqual(done);
    expect(normalizeCampaign(loaded)).toBe(loaded);
    expect(isPlayable(loaded.mission)).toBe(false);
  });

  it('a save at the old Titan end marker loads as the playable Titan round', () => {
    const store = memoryStore();
    const old = startRound({ ...newCampaign(testTuning), mission: 'titan' as const, completed: ['moon' as const, 'mars' as const], balance: 950 });
    saveCampaign(old, store);
    const loaded = normalizeCampaign(loadCampaign(store)!);
    expect(loaded).toEqual(old);
    expect(isPlayable(loaded.mission)).toBe(true);
    expect(restartRound(loaded).balance).toBe(950);
  });

  it('rejects unknown missions', () => {
    const store = memoryStore();
    store.setItem(key, JSON.stringify({ ...newCampaign(testTuning), mission: 'venus' }));
    expect(loadCampaign(store)).toBeNull();
    store.setItem(key, JSON.stringify({ ...newCampaign(testTuning), completed: ['moon', 'pluto'] }));
    expect(loadCampaign(store)).toBeNull();
  });

  it('a new campaign replaces a finished one', () => {
    const store = memoryStore();
    saveCampaign({ ...newCampaign(testTuning), mission: 'complete', completed: ['moon', 'mars', 'titan'] }, store);
    clearCampaign(store);
    saveCampaign(startRound(newCampaign(testTuning)), store);
    expect(loadCampaign(store)).toMatchObject({ mission: 'moon', completed: [], log: [] });
  });
});

describe('builds in saves from before payload systems (November 16)', () => {
  // The desk loads campaign.lastBuild through carryBuild (src/flow/flow.ts carryToWorld): real data, each world's catalog.
  const all = loadGameData('mars').allParts;
  const moonSave = {
    chassis: 'chassis-titanium', wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-li-ion',
    lights: 'lights-none', heater: 'heater-rhu', payload: ['instrument-camera', 'instrument-xray'],
  };
  const marsSave = {
    chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion', lights: 'lights-led', heater: 'heater-rhu',
    payload: ['instrument-laser', 'instrument-xray', 'instrument-camera'], support: { arm: 'arm-robotic', mast: 'mast-remote' },
  };

  it('a saved campaign with an old lastBuild loads as it is', () => {
    const store = memoryStore();
    const state = { ...startRound(newCampaign(testTuning)), lastBuild: moonSave as unknown as Build };
    store.setItem('rover-engineer.campaign.v1', JSON.stringify(state));
    expect(loadCampaign(store)?.lastBuild).toEqual(moonSave);
  });

  it('a Mars save with the X-ray and the arm loads on Mars complete and can launch, the arm kept as the X-ray\'s upgrade; without the arm it is complete too', () => {
    const mars = loadGameData('mars');
    const save = { ...moonSave, support: { arm: 'arm-robotic', mast: 'mast-none' } };
    const { build, dropped } = carryBuild(save, all, 'mars');
    expect(dropped).toEqual([]);
    const done = completeBuild(build, mars.parts)!;
    expect(done.support?.arm).toBe('arm-robotic');
    expect(payloadProblems(done, mars.parts)).toEqual([]);
    expect(quoteBuild(done, mars, 1000).canLaunch).toBe(true);
    const noArm = completeBuild(carryBuild(moonSave, all, 'mars').build, mars.parts)!;
    expect(payloadProblems(noArm, mars.parts)).toEqual([]);
  });

  it('a Moon save with "No lights" loads on the Moon complete, the lights not fitted', () => {
    const { build, dropped } = carryBuild(moonSave, all, 'moon');
    const { lights: _l, ...rest } = moonSave;
    expect(build).toEqual(rest);
    expect(dropped).toEqual([]);
    expect(completeBuild(build, loadGameData('moon').parts)).toEqual(rest);
  });

  it('a save without a bay loads with an empty one, complete', () => {
    const { payload: _p, ...noBay } = moonSave;
    const { build } = carryBuild(noBay, all, 'moon');
    expect(build.payload).toBeUndefined();
    expect(completeBuild(build, loadGameData('moon').parts)?.payload).toEqual([]);
  });

  it('a Mars save now over capacity loads with the over-capacity problem; on Titan it loses the arm and mast with the notice', () => {
    const mars = loadGameData('mars');
    const { build } = carryBuild(marsSave, all, 'mars');
    expect(quoteBuild(build, mars, 1000).payloadProblems).toEqual([{ kind: 'over-capacity', count: 7, points: 5 }]);
    const titan = carryBuild(marsSave, all, 'titan');
    expect(titan.dropped.map((p) => p.id)).toEqual(['arm-robotic', 'mast-remote', 'instrument-laser']);
    expect(titan.build.support).toBeUndefined();
    expect(titan.build.payload).toEqual(['instrument-xray', 'instrument-camera']);
    // A Mars save with "No arm" and "No mast" names nothing lost on Titan.
    expect(carryBuild({ ...marsSave, payload: ['instrument-camera'], support: { arm: 'arm-none', mast: 'mast-none' } }, all, 'titan').dropped).toEqual([]);
  });
});
