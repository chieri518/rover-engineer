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
import relationships from '../data/relationships.json';
import sites from '../data/sites.json';
import type { GameData, PartsFile, TiersFile, MilestonesFile, Tuning, EventsFile, TextFile, RelationshipsFile, SitesFile } from './rules/types';
import { validateGameData } from './rules/validate';
import { deepMerge, withPartText } from './rules/merge';
import { catalogFor } from './rules/payload';
import type { WorldId } from './worlds';

/** The shared data files, before any world's overlay or filter. */
const shared: Omit<GameData, 'world' | 'allParts'> = {
  parts: parts as PartsFile,
  tiers: tiers as TiersFile,
  milestones: milestones as MilestonesFile,
  tuning: tuning as Tuning,
  events: events as unknown as EventsFile,
  text: text as TextFile,
  relationships: relationships as RelationshipsFile,
  sites: sites as SitesFile,
};

/**
 * Per-world overlays. The part catalog is one file: each part says which worlds offer it (Part.worlds),
 * and text.partText rewords parts per world. Ticket tiers and relationships are shared (each relationship
 * names its world). sites.json is the Moon's: Mars has none of its sites.
 */
const overlays: Record<WorldId, Partial<Record<keyof GameData, unknown>>> = {
  moon: {},
  mars: { tuning: marsTuning, events: marsEvents, milestones: marsMilestones, text: marsText, sites: { sites: [] } },
};

/** The world's data: shared data with the world's overlay merged over it, and the parts the world offers. */
export function worldGameData(world: WorldId): GameData {
  const o = overlays[world];
  const text = deepMerge(shared.text, o.text);
  const allParts = withPartText(shared.parts, text.partText);
  return {
    world,
    parts: catalogFor(allParts, world),
    allParts,
    tiers: shared.tiers,
    milestones: deepMerge(shared.milestones, o.milestones),
    tuning: deepMerge(shared.tuning, o.tuning),
    events: deepMerge(shared.events, o.events),
    text,
    relationships: shared.relationships,
    sites: (o.sites as SitesFile | undefined) ?? shared.sites, // replaced whole: the Moon's _about note does not reach Mars
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
