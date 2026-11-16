import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { dashboardTotals, statsByMission } from './dashboard';
import { demoCampaign } from './dashboardDemo';

const worlds = ['moon', 'mars', 'titan'] as const;

describe('Campaign dashboard', () => {
  it('every world has every dashboard string, with no stubs', () => {
    const keys = Object.keys(loadGameData('moon').text.dashboard);
    for (const w of worlds) {
      const t = loadGameData(w).text.dashboard as unknown as Record<string, unknown>;
      expect(Object.keys(t).sort()).toEqual([...keys].sort());
      for (const [k, v] of Object.entries(t)) {
        if (k === 'worldShort') for (const m of worlds) expect((v as Record<string, string>)[m]).toBeTruthy();
        else expect(typeof v === 'string' && v.length > 0 && !/\[placeholder/.test(v)).toBe(true);
      }
    }
  });

  it('the headline sums the recorded rounds', () => {
    const state = demoCampaign(loadGameData);
    const stats = state.stats ?? [];
    expect(stats.map((s) => s.mission)).toEqual(['moon', 'mars', 'titan']);
    const totals = dashboardTotals(state);
    expect(totals.finalSurvived).toBe(true);
    expect(totals.distanceM).toBe(stats.reduce((a, s) => a + s.distanceM, 0));
    expect(totals.available).toBe(stats.reduce((a, s) => a + s.milestones.reduce((b, c) => b + c.available, 0), 0));
    expect(totals.earned).toBeGreaterThan(0);
    expect(state.balance).toBe(stats[2]!.balanceAfter);
  });

  it('a lost Titan round and an older save read as not survived and not recorded', () => {
    const lost = demoCampaign(loadGameData, 'demo-lost');
    expect(dashboardTotals(lost).finalSurvived).toBe(false);
    expect(statsByMission(lost).titan?.outcome).toBe('energy');
    const old = demoCampaign(loadGameData, 'demo-old');
    const by = statsByMission(old);
    expect(by.moon).toBeNull();
    expect(by.mars).toBeNull();
    expect(dashboardTotals(old).recorded).toBe(1);
    expect(dashboardTotals({ ...old, stats: undefined }).finalSurvived).toBeNull();
  });
});
