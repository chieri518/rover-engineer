import { describe, expect, it } from 'vitest';
import { clearCampaign, loadCampaign, saveCampaign } from './campaignSave';
import { newCampaign, startRound } from '../rules/campaign';
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

  it('ignores corrupt or foreign data', () => {
    const store = memoryStore();
    store.setItem('rover-engineer.campaign.v1', '{not json');
    expect(loadCampaign(store)).toBeNull();
    store.setItem('rover-engineer.campaign.v1', '{"hello":1}');
    expect(loadCampaign(store)).toBeNull();
  });
});
