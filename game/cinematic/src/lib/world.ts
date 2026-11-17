// Start one of the game's real worlds (terrain, sky, lighting, weather, rover, lander) for offline rendering.
// The game's moonScene runs no loop of its own here: the sequence steps physics and the view, places the camera,
// and draws into the post chain's target (see MoonOfflineScene in src/world/moonScene.ts).
import { startMoonScene, type MoonOfflineScene, type MoonScene } from '../../../src/world/moonScene';
import { loadGameData } from '../../../src/gameData';
import type { GameData } from '../../../src/rules/types';
import type { Boulder } from '../../../src/world/boulders';
import type { WorldId } from '../../../src/worlds';
import type { SequenceContext } from '../timeline';
import { heroRover } from './heroRover';
import { loadTerrainMasks } from '../../../src/world/terrainMasks';
import { scatterBoulders, scatterSiteBoulders } from '../../../src/rules/boulders';
import { resolveSites, type ResolvedSite, type SiteFeatures } from '../../../src/rules/sites';

export interface CinematicWorld {
  scene: MoonScene;
  offline: MoonOfflineScene;
  data: GameData;
  /** The landing point (terrain coordinates) where the rover starts, beside the lander. */
  landing: { x: number; z: number };
  /** The world's mission sites (Moon: craters, cold traps, rocky areas...; see data/sites.json) and its boulders. */
  sites: ResolvedSite[];
  boulders: readonly Boulder[];
}

/** The boulders the game scatters on this world (same seeds, so the same rocks in the same places). */
async function gameBoulders(world: WorldId, data: GameData): Promise<{ sites: ResolvedSite[]; boulders: Boulder[] }> {
  const tuning = data.tuning;
  const masks = await loadTerrainMasks(tuning, world, data.sites.sites);
  const sites = resolveSites(data.sites.sites, masks.info.features as SiteFeatures);
  const rockySite = (a: { x: number; z: number }) => {
    const r = sites.find((x) => x.kind === 'rocky-area' && Math.hypot(x.center.x - a.x, x.center.z - a.z) < 1);
    return r ? { site: r.id } : {};
  };
  const boulders = [
    ...scatterBoulders(masks.boulderAreas.map((a) => ({ ...a, ...rockySite(a) })), tuning.boulders),
    ...scatterSiteBoulders(sites, tuning.boulders),
  ];
  return { sites, boulders };
}

export async function startWorld(world: WorldId, ctx: SequenceContext, opts: { boulders?: readonly Boulder[] } = {}): Promise<CinematicWorld> {
  const data = loadGameData(world);
  const hero = heroRover(data);
  const game = await gameBoulders(world, data);
  const boulders = opts.boulders ?? game.boulders;
  const scene = await startMoonScene({
    container: document.createElement('div'),
    world,
    data,
    rover: hero.params,
    parts: hero.parts,
    lightRangeM: hero.lightRangeM,
    boulders,
    boulderTrack: game.sites.find((x) => x.kind === 'rolled-boulder')?.track ?? null,
    offline: { renderer: ctx.renderer, width: ctx.width, height: ctx.height },
  });
  const landing = scene.terrain.info.landing.local;
  return { scene, offline: scene.offline!, data, landing: { x: landing.x, z: landing.z }, sites: game.sites, boulders };
}
