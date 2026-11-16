// Player settings in localStorage, kept apart from the campaign so a new campaign keeps them.
// Every access is wrapped: without storage the defaults apply and changes last for the session.

export interface Settings {
  /** Real-history facts on milestone pop-ups and the real-rover comparison in the debrief. */
  missionHistory: boolean;
  /** Music volume, 0..1 (the slider's position; the sound mix maps it to a gain). */
  musicVolume: number;
  /** Sound effects volume, 0..1. */
  effectsVolume: number;
  /** All sound off (the HUD toggle and the M key); the volumes are kept for unmuting. */
  muted: boolean;
}

export const DEFAULT_SETTINGS: Settings = { missionHistory: true, musicVolume: 0.25, effectsVolume: 0.6, muted: false };

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
    // Each field is checked on its own: a save from before a setting existed keeps the others.
    const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
    const volume = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : d);
    return {
      missionHistory: bool(v.missionHistory, DEFAULT_SETTINGS.missionHistory),
      musicVolume: volume(v.musicVolume, DEFAULT_SETTINGS.musicVolume),
      effectsVolume: volume(v.effectsVolume, DEFAULT_SETTINGS.effectsVolume),
      muted: bool(v.muted, DEFAULT_SETTINGS.muted),
    };
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
