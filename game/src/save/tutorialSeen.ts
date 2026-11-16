// Which tutorials the player has seen, in localStorage, kept apart from the campaign so a new campaign
// does not show them again. Every access is wrapped: without storage, "seen" lasts for the session.
// Each world has its own design and drive tutorials (Mars explains the night and the dust storm), so
// "seen" is kept per world. Stored as { design, drive } for the Moon (the original format) plus
// { mars: { design, drive }, titan: { design, drive } }. The key is v2 so returning players see the
// tutorials once more, with the payload bay, pre-launch review and notebook pages; a v1 save is ignored.
import type { WorldId } from '../worlds';

export interface TutorialSeen {
  design: boolean;
  drive: boolean;
}

export type TutorialId = keyof TutorialSeen;

export type TutorialSeenByWorld = Record<WorldId, TutorialSeen>;

export const TUTORIAL_KEY = 'rover-engineer.tutorial.v2';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const unseen = (): TutorialSeen => ({ design: false, drive: false });

function readSeen(v: unknown): TutorialSeen {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Partial<TutorialSeen>;
  return { design: o.design === true, drive: o.drive === true };
}

/** Nothing seen in any world: what a new campaign starts with, so every tutorial shows again. */
export function allUnseen(): TutorialSeenByWorld {
  return { moon: unseen(), mars: unseen(), titan: unseen() };
}

/** Forget every tutorial in every world and write that to storage (a new campaign). Returns the fresh state. */
export function resetTutorialSeen(store: KeyValueStore | null = defaultStore()): TutorialSeenByWorld {
  const fresh = allUnseen();
  saveTutorialSeen(fresh, store);
  return fresh;
}

export function loadTutorialSeen(store: KeyValueStore | null = defaultStore()): TutorialSeenByWorld {
  try {
    const raw = store?.getItem(TUTORIAL_KEY);
    if (!raw) return { moon: unseen(), mars: unseen(), titan: unseen() };
    const v = JSON.parse(raw) as { mars?: unknown; titan?: unknown } | null;
    return { moon: readSeen(v), mars: readSeen(v?.mars), titan: readSeen(v?.titan) };
  } catch {
    return { moon: unseen(), mars: unseen(), titan: unseen() };
  }
}

export function saveTutorialSeen(seen: TutorialSeenByWorld, store: KeyValueStore | null = defaultStore()): boolean {
  try {
    if (!store) return false;
    const { moon, mars, titan } = seen;
    store.setItem(TUTORIAL_KEY, JSON.stringify({
      design: moon.design, drive: moon.drive, mars: { design: mars.design, drive: mars.drive }, titan: { design: titan.design, drive: titan.drive },
    }));
    return true;
  } catch {
    return false;
  }
}
