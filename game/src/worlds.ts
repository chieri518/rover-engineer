// The world registry: what differs between the Moon, Mars and Titan outside the data files. Game numbers
// (gravity, mission length, rates) stay in data/ and data/<world>/ (see gameData.ts); this file holds
// where each world's terrain lives and which sky and lighting model draws it.
import type { CampaignStep, MissionId } from './rules/types';

export type WorldId = MissionId;

export interface WorldDef {
  id: WorldId;
  /** Terrain pipeline output, relative to the site root (BASE_URL), with a trailing slash. */
  terrainBase: string;
  /** Which sky and ground lighting draws this world (world/ rendering picks its model by this). */
  sky: 'moon' | 'mars' | 'titan';
  /** Earth hangs in the sky (Moon): Earth photos, Earth in the sky dome. */
  earthInSky: boolean;
}

/**
 * Where the Mars terrain is loaded from: the real Jezero terrain from the pipeline (tools/build_terrain_mars.py).
 * The flat placeholder in terrain/mars-placeholder/ has the same file names and terrain.json shape.
 */
export const MARS_TERRAIN_BASE = 'terrain/mars/';

/**
 * Where the Titan terrain is loaded from: the Shangri-La dunes from the pipeline (tools/build_terrain_titan.py), modeled on
 * Cassini data. The placeholder in terrain/titan-placeholder/ (scripts/make-titan-placeholder.mjs) has the same file names and shape.
 */
export const TITAN_TERRAIN_BASE = 'terrain/titan/';

export const WORLDS: Record<WorldId, WorldDef> = {
  moon: { id: 'moon', terrainBase: 'terrain/', sky: 'moon', earthInSky: true },
  mars: { id: 'mars', terrainBase: MARS_TERRAIN_BASE, sky: 'mars', earthInSky: false },
  titan: { id: 'titan', terrainBase: TITAN_TERRAIN_BASE, sky: 'titan', earthInSky: false },
};

export const WORLD_IDS = Object.keys(WORLDS) as WorldId[];

export function isWorldId(v: unknown): v is WorldId {
  return typeof v === 'string' && (WORLD_IDS as string[]).includes(v);
}

/** The world a campaign step plays on. The end marker (complete) shows the last world's data. */
export function worldOfStep(step: CampaignStep): WorldId {
  return step === 'complete' ? 'titan' : step;
}

/** URL of a file in the world's terrain folder. */
export function terrainUrl(world: WorldId, file = ''): string {
  return `${import.meta.env.BASE_URL}${WORLDS[world].terrainBase}${file}`;
}

/** Debug start: `?world=mars` or `?world=titan` begins a throwaway campaign at that world's mission. */
export function worldFromQuery(search: string): WorldId | null {
  const v = new URLSearchParams(search).get('world');
  return isWorldId(v) ? v : null;
}
