// Campaign save in localStorage. Every access is wrapped: the game still runs if storage is
// unavailable (private mode, blocked site data); it just will not remember the campaign.
import type { CampaignState } from '../rules/campaign';

const KEY = 'rover-engineer.campaign.v1';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function looksLikeCampaign(value: unknown): value is Omit<CampaignState, 'notebook'> & { notebook?: unknown } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.mission === 'string' &&
    typeof v.balance === 'number' &&
    typeof v.rp === 'number' &&
    Array.isArray(v.records) &&
    Array.isArray(v.completed)
  );
}

/** A save from before the engineering notebook has none: it starts empty. Entries that are not ids are dropped. */
function withNotebook(v: Omit<CampaignState, 'notebook'> & { notebook?: unknown }): CampaignState {
  const notebook = Array.isArray(v.notebook) ? v.notebook.filter((id): id is string => typeof id === 'string') : [];
  return { ...v, notebook };
}

export function loadCampaign(store: KeyValueStore | null = defaultStore()): CampaignState | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return looksLikeCampaign(parsed) ? withNotebook(parsed) : null;
  } catch {
    return null;
  }
}

/** Returns false if the save could not be written. */
export function saveCampaign(state: CampaignState, store: KeyValueStore | null = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearCampaign(store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    // Nothing to do: storage is unavailable.
  }
}
