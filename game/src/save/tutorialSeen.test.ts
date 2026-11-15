import { describe, expect, it } from 'vitest';
import { loadTutorialSeen, saveTutorialSeen, TUTORIAL_KEY } from './tutorialSeen';

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

const none = { design: false, drive: false };
const unseen = { moon: none, mars: none, titan: none };

describe('tutorial seen', () => {
  it('starts unseen and persists under the documented key and shape', () => {
    const store = memoryStore();
    expect(loadTutorialSeen(store)).toEqual(unseen);
    expect(saveTutorialSeen({ moon: { design: true, drive: false }, mars: { design: false, drive: true }, titan: { design: true, drive: true } }, store)).toBe(true);
    expect(JSON.parse(store.getItem(TUTORIAL_KEY)!)).toEqual({ design: true, drive: false, mars: { design: false, drive: true }, titan: { design: true, drive: true } });
    expect(TUTORIAL_KEY).toBe('rover-engineer.tutorial.v1');
    expect(loadTutorialSeen(store)).toEqual({ moon: { design: true, drive: false }, mars: { design: false, drive: true }, titan: { design: true, drive: true } });
  });

  it('reads a Moon-only save: the Moon tutorials stay seen, the Mars and Titan ones are new', () => {
    const store = memoryStore();
    store.setItem(TUTORIAL_KEY, JSON.stringify({ design: true, drive: true }));
    expect(loadTutorialSeen(store)).toEqual({ moon: { design: true, drive: true }, mars: none, titan: none });
  });

  it('falls back to unseen without storage, with a broken save, or when storage throws', () => {
    expect(loadTutorialSeen(null)).toEqual(unseen);
    expect(saveTutorialSeen({ moon: none, mars: none, titan: none }, null)).toBe(false);
    const store = memoryStore();
    store.setItem(TUTORIAL_KEY, '{not json');
    expect(loadTutorialSeen(store)).toEqual(unseen);
    store.setItem(TUTORIAL_KEY, 'null');
    expect(loadTutorialSeen(store)).toEqual(unseen);
    const blocked = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(loadTutorialSeen(blocked)).toEqual(unseen);
    expect(saveTutorialSeen({ moon: none, mars: none, titan: none }, blocked)).toBe(false);
  });
});
