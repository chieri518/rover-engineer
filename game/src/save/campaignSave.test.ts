import { describe, expect, it } from 'vitest';
import { clearCampaign, loadCampaign, saveCampaign } from './campaignSave';
import { isPlayable, newCampaign, normalizeCampaign, restartRound, startRound } from '../rules/campaign';
import { testTuning } from '../rules/testData';

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
