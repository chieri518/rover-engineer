// The mission's boulder list (Mars step 6a): rules/boulders.ts placeBoulders with the world's masks. On Mars
// the site boulders stay off soft-ground.png's sand ripples and off ground steeper than
// tuning.boulders.maxSlopeDeg (slope.png); the Moon passes no masks, so its boulders are exactly as before
// (passing its masks would move the Moon's site boulders). The mission reads this list and the scene draws
// the same list (startMoonScene `boulders`). No three here: the mission screen imports it before the 3D
// modules load.
import { placeBoulders, type Boulder, type BoulderGround } from '../rules/boulders';
import type { ResolvedSite } from '../rules/sites';
import type { Tuning } from '../rules/types';
import { WORLDS, type WorldId } from '../worlds';
import type { TerrainMasks } from './terrainMasks';

/** The parts of the world's masks the boulder list reads (world/terrainMasks.ts TerrainMasks). */
export type BoulderMasks = Pick<TerrainMasks, 'boulderAreas' | 'slopeAt' | 'softAt'> & {
  info: { features: Parameters<typeof placeBoulders>[3] };
};

/** What the world tells placeBoulders about its ground: Mars's soft ground and slope, nothing on the Moon. */
export function boulderGround(world: WorldId, masks: Pick<BoulderMasks, 'slopeAt' | 'softAt'>): BoulderGround {
  if (WORLDS[world].sky !== 'mars') return {};
  return { softAt: (x, z) => masks.softAt(x, z), slopeAt: (x, z) => masks.slopeAt(x, z) };
}

/**
 * Every boulder on the map, in the order the instruments index them: the rocky areas', then the sites'
 * (rules/boulders.ts placeBoulders). `sites`: rules/sites.ts resolveSites of the world's sites.json.
 */
export function worldBoulders(
  world: WorldId,
  masks: BoulderMasks,
  sites: readonly ResolvedSite[],
  tuning: Pick<Tuning, 'boulders' | 'ground'>,
): Boulder[] {
  return placeBoulders(masks.boulderAreas, sites, tuning, masks.info.features, boulderGround(world, masks));
}
