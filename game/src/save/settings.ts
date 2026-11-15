// Player settings in localStorage, kept apart from the campaign so a new campaign keeps them.
// Every access is wrapped: without storage the defaults apply and changes last for the session.

export interface Settings {
  /** Real-history facts on milestone pop-ups and the real-rover comparison in the debrief. */
  missionHistory: boolean;
}

export const DEFAULT_SETTINGS: Settings = { missionHistory: true };

const KEY = 'rover-engineer.settings.v1';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(store: KeyValueStore | null = defaultStore()): Settings {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<Settings>;
    return { missionHistory: typeof v.missionHistory === 'boolean' ? v.missionHistory : DEFAULT_SETTINGS.missionHistory };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, store: KeyValueStore | null = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
