// Campaign save in localStorage. Every access is wrapped: the game still runs if storage is
// unavailable (private mode, blocked site data); it just will not remember the campaign.
// The format is the CampaignState as it is (key v1). Saves from every build load: older ones have no
// `log` (the campaign summary then lists only later missions), and a save with the Moon completed but
// still on mission 'moon' is moved on to Mars by normalizeCampaign when the game starts. Round stats
// (for the campaign dashboard) are optional: older saves have none, and entries that are not stats are dropped.
import { isCampaignStep, type CampaignState } from '../rules/campaign';
import { isRoundStats } from '../rules/roundStats';

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
    isCampaignStep(v.mission) &&
    typeof v.balance === 'number' &&
    typeof v.rp === 'number' &&
    Array.isArray(v.records) &&
    Array.isArray(v.completed) &&
    v.completed.every(isCampaignStep) &&
    (v.log === undefined || Array.isArray(v.log))
  );
}

/** A save from before the engineering notebook has none: it starts empty. Entries that are not ids are dropped. */
function withNotebook(v: Omit<CampaignState, 'notebook'> & { notebook?: unknown }): CampaignState {
  const notebook = Array.isArray(v.notebook) ? v.notebook.filter((id): id is string => typeof id === 'string') : [];
  const { stats, ...rest } = v as typeof v & { stats?: unknown };
  return { ...rest, notebook, ...(Array.isArray(stats) ? { stats: stats.filter(isRoundStats) } : {}) };
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
