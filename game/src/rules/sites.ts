// Where each sites.json site is on the map, from the terrain.json features (passed in as plain data),
// and where each named cold zone (tuning.cold.zones) sits. A site is resolved from, in order: its
// pipeline feature once the pipeline has produced it, its own `local` position (a provisional candidate,
// or a measured stand-in such as Rocky area 1's cold patch), or the existing terrain.json feature it
// names. Pure: no rendering, no DOM.
import type { MoonPipelineFeatures, SiteKind, SiteSpec } from './types';

export interface Point { x: number; z: number }

/** The terrain.json features the sites read: the Moon's own features and the pipeline's new lists (all optional). */
export interface SiteFeatures extends MoonPipelineFeatures {
  rockyAreas?: { name: string; local: Point; radius_m: number }[];
  rimViewpoints?: { name: string; local: Point }[];
  shadowedCrater?: { centroidLocal: Point; outlineLocal_xz: number[][] };
  craterDescent?: { name: string; local: Point };
}

/** A site with its place on the map: a center, and a radius or an outline where the site has an extent. */
export interface ResolvedSite {
  id: string;
  kind: SiteKind;
  name: string;
  center: Point;
  radiusM?: number; // craters, rocky areas and cold traps without an outline
  outline?: [number, number][]; // the dark crater's permanent-shadow outline, or a pipeline cold trap's
  track?: { from: Point; to: Point }; // the rolled boulder's track: from the wall top down to the foot where it rests (center)
  spec: SiteSpec;
}

type Geometry = Pick<ResolvedSite, 'center' | 'radiusM' | 'outline' | 'track'>;

const at = (p: { x: number; z: number } | undefined): Point | null => (p ? { x: p.x, z: p.z } : null);
/** An outline as [x, z] pairs (JSON gives number[][]). */
const ring = (points: number[][]): [number, number][] => points.map((q) => [q[0] ?? 0, q[1] ?? 0]);

/** The pipeline feature a site names, once the pipeline has produced its list and the id is in it. */
function fromPipeline(site: SiteSpec, f: SiteFeatures): Geometry | null {
  const ref = site.pipeline;
  if (!ref) return null;
  switch (ref.list) {
    case 'coldTraps': {
      const c = f.coldTraps?.find((x) => x.id === ref.id);
      const center = at(c?.centroidLocal);
      if (!c || !center) return null;
      const outline = c.outlineLocal_xz && c.outlineLocal_xz.length >= 3 ? ring(c.outlineLocal_xz) : undefined;
      const radiusM = outline ? undefined : c.area_m2 ? Math.sqrt(c.area_m2 / Math.PI) : site.radiusM;
      return { center, ...(outline ? { outline } : {}), ...(radiusM !== undefined ? { radiusM } : {}) };
    }
    case 'youngCraters': {
      const c = f.youngCraters?.find((x) => x.id === ref.id);
      const center = at(c?.local);
      if (!c || !center) return null;
      const radiusM = c.radius_m ?? site.radiusM;
      return { center, ...(radiusM !== undefined ? { radiusM } : {}) };
    }
    case 'boulderTrackCandidates': {
      const c = f.boulderTrackCandidates?.find((x) => x.id === ref.id);
      const center = at(c?.local);
      const top = at(c?.wallTop);
      if (!center) return null;
      return top ? { center, track: { from: top, to: center } } : { center };
    }
    case 'lowLightPatches': {
      // The point farthest inside the patch: a curved patch's centroid can lie near its edge.
      const c = f.lowLightPatches?.find((x) => x.id === ref.id);
      const center = at(c?.innerPoint) ?? at(c?.centroidLocal);
      return center ? { center } : null;
    }
  }
}

/** An existing terrain.json feature by key (shadowedCrater, craterDescent) or by name (Rocky area 1). */
export function featureGeometry(name: string, f: SiteFeatures): Geometry | null {
  if (name === 'shadowedCrater') {
    return f.shadowedCrater ? { center: at(f.shadowedCrater.centroidLocal)!, outline: ring(f.shadowedCrater.outlineLocal_xz) } : null;
  }
  if (name === 'craterDescent') return f.craterDescent ? { center: at(f.craterDescent.local)! } : null;
  const rocky = f.rockyAreas?.find((a) => a.name === name);
  if (rocky) return { center: at(rocky.local)!, radiusM: rocky.radius_m };
  const other = [...(f.rimViewpoints ?? []), ...(f.craterDescent ? [f.craterDescent] : [])].find((p) => p.name === name);
  return other ? { center: at(other.local)! } : null;
}

/** One site's place on the map, or null when nothing it names exists. */
export function resolveSite(site: SiteSpec, f: SiteFeatures): ResolvedSite | null {
  const g = fromPipeline(site, f)
    ?? (site.local ? { center: at(site.local)!, ...(site.radiusM !== undefined ? { radiusM: site.radiusM } : {}) } : null)
    ?? (site.feature !== undefined ? featureGeometry(site.feature, f) : null);
  return g ? { id: site.id, kind: site.kind, name: site.name, ...g, spec: site } : null;
}

/** Every site that resolves (a site that names nothing on the map is dropped; siteTerrainProblems reports it). */
export function resolveSites(sites: readonly SiteSpec[], f: SiteFeatures): ResolvedSite[] {
  return sites.flatMap((s) => {
    const r = resolveSite(s, f);
    return r ? [r] : [];
  });
}

/**
 * Where a named cold zone (tuning.cold.zones) sits: a terrain.json feature key or name, else a cold trap
 * in sites.json by name (provisional ones included; a pipeline cold trap once produced). The world's cold
 * mask flood-fills the permanently shadowed patch nearest this point (world/terrainMasks.ts).
 * Null: the zone names nothing, and would silently freeze nothing.
 */
export function coldZoneAnchor(zone: string, f: SiteFeatures, sites: readonly SiteSpec[]): Point | null {
  const feature = featureGeometry(zone, f);
  if (feature) return feature.center;
  const trap = sites.find((s) => s.kind === 'cold-trap' && s.name === zone);
  return trap ? resolveSite(trap, f)?.center ?? null : null;
}
