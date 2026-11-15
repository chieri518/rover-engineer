// Loads the game data from game/data/ (bundled at build time) and checks it.
import parts from '../data/parts.json';
import tiers from '../data/tiers.json';
import milestones from '../data/milestones.json';
import tuning from '../data/tuning.json';
import events from '../data/events.json';
import text from '../data/text.json';
import type { GameData, PartsFile, TiersFile, MilestonesFile, Tuning, EventsFile, TextFile } from './rules/types';
import { validateGameData } from './rules/validate';

export function loadGameData(): GameData {
  const data: GameData = {
    parts: parts as PartsFile,
    tiers: tiers as TiersFile,
    milestones: milestones as MilestonesFile,
    tuning: tuning as Tuning,
    events: events as unknown as EventsFile,
    text: text as TextFile,
  };
  const problems = validateGameData(data);
  if (problems.length > 0) throw new Error(`Invalid game data:\n${problems.join('\n')}`);
  return data;
}
