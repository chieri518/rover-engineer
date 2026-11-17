import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('settings', () => {
  it('Mission history defaults to on and persists when turned off', () => {
    const store = memoryStore();
    expect(loadSettings(store).missionHistory).toBe(true);
    saveSettings({ ...DEFAULT_SETTINGS, missionHistory: false }, store);
    expect(loadSettings(store).missionHistory).toBe(false);
  });

  it('falls back to the defaults without storage or with a broken save', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    const store = memoryStore();
    store.setItem('rover-engineer.settings.v1', '{not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('sound: quiet music by default, volumes and mute persist', () => {
    const store = memoryStore();
    const d = loadSettings(store);
    expect(d.musicVolume).toBe(0.25);
    expect(d.effectsVolume).toBe(0.6);
    expect(d.muted).toBe(false);
    saveSettings({ ...d, musicVolume: 0.1, effectsVolume: 0.9, muted: true }, store);
    expect(loadSettings(store)).toMatchObject({ musicVolume: 0.1, effectsVolume: 0.9, muted: true });
  });

  it('a save from before the sound settings keeps Mission history and gets the sound defaults', () => {
    const store = memoryStore();
    store.setItem('rover-engineer.settings.v1', JSON.stringify({ missionHistory: false }));
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, missionHistory: false });
  });

  it('bad volumes fall back or are clamped to 0..1', () => {
    const store = memoryStore();
    store.setItem('rover-engineer.settings.v1', JSON.stringify({ musicVolume: 'loud', effectsVolume: 4, muted: 'yes' }));
    expect(loadSettings(store)).toMatchObject({ musicVolume: 0.25, effectsVolume: 1, muted: false });
  });
});
