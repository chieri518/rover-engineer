import { describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from './settings';

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('settings', () => {
  it('Mission history defaults to on and persists when turned off', () => {
    const store = memoryStore();
    expect(loadSettings(store).missionHistory).toBe(true);
    saveSettings({ missionHistory: false }, store);
    expect(loadSettings(store).missionHistory).toBe(false);
  });

  it('falls back to the defaults without storage or with a broken save', () => {
    expect(loadSettings(null).missionHistory).toBe(true);
    const store = memoryStore();
    store.setItem('rover-engineer.settings.v1', '{not json');
    expect(loadSettings(store).missionHistory).toBe(true);
  });
});
