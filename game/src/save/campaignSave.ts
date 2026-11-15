// Campaign save in localStorage. Every access is wrapped: the game still runs if storage is
// unavailable (private mode, blocked site data); it just will not remember the campaign.
// The format is the CampaignState as it is (key v1). Saves from every build load: older ones have no
// `log` (the campaign summary then lists only later missions), and a save with the Moon completed but
// still on mission 'moon' is moved on to Mars by normalizeCampaign when the game starts.
import { isCampaignStep, type CampaignState } from '../rules/campaign';

const KEY = 'rover-engineer.campaign.v1';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function looksLikeCampaign(value: unknown): value is CampaignState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isCampaignStep(v.mission) &&
    typeof v.balance === 'number' &&
    typeof v.rp === 'number' &&
    Array.isArray(v.records) &&
    Array.isArray(v.completed) &&
    v.completed.every(isCampaignStep) &&
    (v.log === undefined || Array.isArray(v.log))
  );
}

export function loadCampaign(store: KeyValueStore | null = defaultStore()): CampaignState | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return looksLikeCampaign(parsed) ? parsed : null;
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
