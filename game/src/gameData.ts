// Loads the game data from game/data/ (bundled at build time) and checks it. Each world's data is the
// shared files with that world's overlay from data/<world>/ deep-merged over them (rules/merge.ts).
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
import type { GameData, PartsFile, TiersFile, MilestonesFile, Tuning, EventsFile, TextFile } from './rules/types';
import { validateGameData } from './rules/validate';
import { deepMerge } from './rules/merge';
import type { WorldId } from './worlds';

const shared: GameData = {
  parts: parts as PartsFile,
  tiers: tiers as TiersFile,
  milestones: milestones as MilestonesFile,
  tuning: tuning as Tuning,
  events: events as unknown as EventsFile,
  text: text as TextFile,
};

/** Per-world overlays. Parts and ticket tiers are shared (the demo reuses the Moon's). */
const overlays: Record<WorldId, Partial<Record<keyof GameData, unknown>>> = {
  moon: {},
  mars: { tuning: marsTuning, events: marsEvents, milestones: marsMilestones, text: marsText },
};

/** The world's data: shared data with the world's overlay merged over it. */
export function worldGameData(world: WorldId): GameData {
  const o = overlays[world];
  return {
    parts: shared.parts,
    tiers: shared.tiers,
    milestones: deepMerge(shared.milestones, o.milestones),
    tuning: deepMerge(shared.tuning, o.tuning),
    events: deepMerge(shared.events, o.events),
    text: deepMerge(shared.text, o.text),
  };
}

const cache = new Map<WorldId, GameData>();

/** The checked data for a world (the Moon by default), built once. */
export function loadGameData(world: WorldId = 'moon'): GameData {
  let data = cache.get(world);
  if (!data) {
    data = world === 'moon' ? shared : worldGameData(world);
    const problems = validateGameData(data);
    if (problems.length > 0) throw new Error(`Invalid ${world} game data:\n${problems.join('\n')}`);
    cache.set(world, data);
  }
  return data;
}
