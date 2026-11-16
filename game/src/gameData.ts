// Loads the game data from game/data/ (bundled at build time) and checks it. Each world's data is the
// shared files with that world's overlay from data/<world>/ deep-merged over them (rules/merge.ts), and
// the part catalog filtered to the parts the world offers (rules/payload.ts catalogFor).
import parts from '../data/parts.json';
import tiers from '../data/tiers.json';
import milestones from '../data/milestones.json';
import tuning from '../data/tuning.json';
import events from '../data/events.json';
import text from '../data/text.json';
import marsTuning from '../data/mars/tuning.json';
import marsEvents from '../data/mars/events.json';
import marsMilestones from '../data/mars/milestones.json';
import marsText from '../data/mars/text.json';
import marsParts from '../data/mars/parts.json';
import marsTiers from '../data/mars/tiers.json';
import marsSites from '../data/mars/sites.json';
import relationships from '../data/relationships.json';
import sites from '../data/sites.json';
import type { GameData, PartsFile, PartsOverlay, TiersFile, MilestonesFile, Tuning, EventsFile, TextFile, RelationshipsFile, SitesFile } from './rules/types';
import { validateGameData } from './rules/validate';
import { deepMerge, withPartsOverlay, withPartText } from './rules/merge';
import { catalogFor } from './rules/payload';
import type { WorldId } from './worlds';

/** The shared data files, before any world's overlay or filter. */
const shared: Omit<GameData, 'world' | 'allParts'> = {
  parts: parts as PartsFile,
  tiers: tiers as TiersFile,
  milestones: milestones as MilestonesFile,
  tuning: tuning as Tuning,
  events: events as unknown as EventsFile,
  text: text as unknown as TextFile, // instrumentText for Mars's own instruments comes with data/mars/text.json (validation checks each world's)
  relationships: relationships as RelationshipsFile,
  sites: sites as SitesFile,
};

/**
 * Per-world overlays. The part catalog is one file: each part says which worlds offer it (Part.worlds),
 * text.partText rewords parts per world, and the world's parts overlay (PartsOverlay) adds its support
 * slots and per-world effects. Ticket tiers are deep-merged like the other overlays (Mars's list replaces
 * the shared one). Relationships are shared (each relationship names its world). Each world has its own
 * sites file, replaced whole (data/sites.json is the Moon's, data/mars/sites.json Mars's), so no Moon site
 * reaches Mars.
 */
const overlays: Record<WorldId, Partial<Record<keyof GameData, unknown>>> = {
  moon: {},
  mars: { tuning: marsTuning, events: marsEvents, milestones: marsMilestones, text: marsText, parts: marsParts, tiers: marsTiers, sites: marsSites as SitesFile },
};

/** The world's data: shared data with the world's overlay merged over it, and the parts the world offers. */
export function worldGameData(world: WorldId): GameData {
  const o = overlays[world];
  const text = deepMerge(shared.text, o.text);
  const allParts = withPartText(withPartsOverlay(shared.parts, o.parts as PartsOverlay | undefined), text.partText);
  return {
    world,
    parts: catalogFor(allParts, world),
    allParts,
    tiers: o.tiers === undefined ? shared.tiers : deepMerge(shared.tiers, o.tiers),
    milestones: deepMerge(shared.milestones, o.milestones),
    tuning: deepMerge(shared.tuning, o.tuning),
    events: deepMerge(shared.events, o.events),
    text,
    relationships: shared.relationships,
    sites: o.sites === undefined ? shared.sites : deepMerge<SitesFile>({ sites: [] }, o.sites), // replaced whole (deepMerge only drops its _ notes)
  };
}

const cache = new Map<WorldId, GameData>();

/** The checked data for a world (the Moon by default), built once. */
export function loadGameData(world: WorldId = 'moon'): GameData {
  let data = cache.get(world);
  if (!data) {
    data = worldGameData(world);
    const problems = validateGameData(data);
    if (problems.length > 0) throw new Error(`Invalid ${world} game data:\n${problems.join('\n')}`);
    cache.set(world, data);
  }
  return data;
}
