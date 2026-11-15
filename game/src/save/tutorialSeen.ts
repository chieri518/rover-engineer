// Which tutorials the player has seen, in localStorage, kept apart from the campaign so a new campaign
// does not show them again. Every access is wrapped: without storage, "seen" lasts for the session.

export interface TutorialSeen {
  design: boolean;
  drive: boolean;
}

export type TutorialId = keyof TutorialSeen;

export const TUTORIAL_KEY = 'rover-engineer.tutorial.v1';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadTutorialSeen(store: KeyValueStore | null = defaultStore()): TutorialSeen {
  try {
    const raw = store?.getItem(TUTORIAL_KEY);
    if (!raw) return { design: false, drive: false };
    const v = JSON.parse(raw) as Partial<TutorialSeen> | null;
    return { design: v?.design === true, drive: v?.drive === true };
  } catch {
    return { design: false, drive: false };
  }
}

export function saveTutorialSeen(seen: TutorialSeen, store: KeyValueStore | null = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(TUTORIAL_KEY, JSON.stringify({ design: seen.design, drive: seen.drive }));
    return true;
  } catch {
    return false;
  }
}
