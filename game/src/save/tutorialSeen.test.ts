import { describe, expect, it } from 'vitest';
import { loadTutorialSeen, saveTutorialSeen, TUTORIAL_KEY } from './tutorialSeen';

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('tutorial seen', () => {
  it('starts unseen and persists under the documented key and shape', () => {
    const store = memoryStore();
    expect(loadTutorialSeen(store)).toEqual({ design: false, drive: false });
    expect(saveTutorialSeen({ design: true, drive: false }, store)).toBe(true);
    expect(JSON.parse(store.getItem(TUTORIAL_KEY)!)).toEqual({ design: true, drive: false });
    expect(TUTORIAL_KEY).toBe('rover-engineer.tutorial.v2');
    expect(loadTutorialSeen(store)).toEqual({ design: true, drive: false });
  });

  it('falls back to unseen without storage, with a broken save, or when storage throws', () => {
    expect(loadTutorialSeen(null)).toEqual({ design: false, drive: false });
    expect(saveTutorialSeen({ design: true, drive: true }, null)).toBe(false);
    const store = memoryStore();
    store.setItem(TUTORIAL_KEY, '{not json');
    expect(loadTutorialSeen(store)).toEqual({ design: false, drive: false });
    store.setItem(TUTORIAL_KEY, 'null');
    expect(loadTutorialSeen(store)).toEqual({ design: false, drive: false });
    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(loadTutorialSeen(blocked)).toEqual({ design: false, drive: false });
    expect(saveTutorialSeen({ design: true, drive: true }, blocked)).toBe(false);
  });
});
