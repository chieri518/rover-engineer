// Where each sites.json site is on the map, from the terrain.json features (passed in as plain data),
// and where each named cold zone (tuning.cold.zones) sits. A site is resolved from, in order: its
// pipeline feature once the pipeline has produced it, its own `local` position (a provisional candidate,
// or a measured stand-in such as Rocky area 1's cold patch), or the existing terrain.json feature it
// names. Pure: no rendering, no DOM.
// Mars (Mars step 5c): a site's `terrain` path (a dotted path into terrain.json features) gives its center
// once that feature is there, ahead of its `local` stand-in; a young crater or knob also carries the
// pipeline's slope-target patches (features.slopeTargets), the delta foot its foot line
// (deltaFront.footNear) and the flood boulder its level reading spot (deltaFront.floodBoulder).
import type { MoonPipelineFeatures, SiteKind, SiteSpec } from './types';

export interface Point { x: number; z: number }

/**
 * One slope-target patch (terrain.json slopeTargets, MP2): `local` a 10 to 18° cell, `levelCell` its
 * level neighbour (under 8°, within 5 m). Boulders placed on it give the arm lesson and "park level".
 */
export interface SlopePatch { local: Point; levelCell: Point }

/** The Mars features the sites read (rules/marsTypes.ts MarsTerrainFeatures has the full shapes). */
export interface MarsSiteFeatures {
  slopeTargets?: { id: string; site: string; patches: { local: Point; levelCell: Point }[] }[];
  deltaFront?: {
    footNear?: { lineLocal_xz: [number, number][] | number[][]; zoneRadius_m?: number };
    floodBoulder?: { local: Point; readingSpot?: Point };
  };
}

/** The terrain.json features the sites read: the Moon's own features and the pipeline's new lists (all optional). */
export interface SiteFeatures extends MoonPipelineFeatures, MarsSiteFeatures {
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
  // Mars (absent on the Moon):
  slopePatches?: SlopePatch[]; // a young crater's or knob's slope-target patches (terrain.json slopeTargets)
  line?: [number, number][]; // the delta foot: its foot line (deltaFront.footNear), nearest end first; radiusM is its zone
  readingSpot?: Point; // the flood boulder: the level ground on its downhill side
  spec: SiteSpec;
}

type Geometry = Pick<ResolvedSite, 'center' | 'radiusM' | 'outline' | 'track'>;
type Extras = Pick<ResolvedSite, 'slopePatches' | 'line' | 'readingSpot' | 'radiusM'>;

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

/**
 * The terrain.json feature at a dotted path from `features` (deltaFront.floodBoulder, seitah.entryPoint);
 * in a list the next segment is an item's id (slopeTargets.slope-targets-knob-wnw). Undefined if absent.
 */
export function featureAtPath(path: string, f: object): unknown {
  let node: unknown = f;
  for (const key of path.split('.')) {
    if (Array.isArray(node)) node = node.find((x: unknown) => (x as { id?: unknown } | null)?.id === key);
    else if (node && typeof node === 'object') node = (node as Record<string, unknown>)[key];
    else return undefined;
  }
  return node;
}

/** A point from a terrain feature: its `local`, or the feature itself when it is a point. */
function pointOf(node: unknown): Point | null {
  const n = node as { local?: unknown; x?: unknown; z?: unknown } | null | undefined;
  const p = (n && typeof n === 'object' && n.local && typeof n.local === 'object' ? n.local : n) as { x?: unknown; z?: unknown } | null | undefined;
  return p && typeof p.x === 'number' && typeof p.z === 'number' ? { x: p.x, z: p.z } : null;
}

/** The slope-target patches of a site: its pipeline young crater's list, or the list its `terrain` path names. */
function slopePatchesOf(site: SiteSpec, f: SiteFeatures): SlopePatch[] | undefined {
  const lists = f.slopeTargets;
  if (!lists) return undefined;
  const list = (site.pipeline?.list === 'youngCraters' ? lists.find((t) => t.site === site.pipeline!.id) : undefined)
    ?? (site.terrain?.startsWith('slopeTargets.') ? lists.find((t) => t.id === site.terrain!.slice('slopeTargets.'.length)) : undefined);
  const patches = list?.patches.flatMap((p) => {
    const local = pointOf(p.local);
    const levelCell = pointOf(p.levelCell);
    return local && levelCell ? [{ local, levelCell }] : [];
  });
  return patches && patches.length > 0 ? patches : undefined;
}

/** Mars extras by site kind: slope-target patches, the delta foot's line and zone, the flood boulder's reading spot. */
function marsExtras(site: SiteSpec, f: SiteFeatures): Extras {
  const out: Extras = {};
  if (site.kind === 'young-crater' || site.kind === 'knob') {
    const patches = slopePatchesOf(site, f);
    if (patches) out.slopePatches = patches;
  } else if (site.kind === 'delta-foot') {
    const foot = f.deltaFront?.footNear;
    if (foot && foot.lineLocal_xz.length >= 2) {
      out.line = ring(foot.lineLocal_xz as number[][]);
      const r = site.radiusM ?? foot.zoneRadius_m;
      if (r !== undefined) out.radiusM = r;
    }
  } else if (site.kind === 'flood-boulder') {
    const spot = pointOf(f.deltaFront?.floodBoulder?.readingSpot);
    if (spot) out.readingSpot = spot;
  }
  return out;
}

/** One site's place on the map, or null when nothing it names exists. */
export function resolveSite(site: SiteSpec, f: SiteFeatures): ResolvedSite | null {
  const radius = site.radiusM !== undefined ? { radiusM: site.radiusM } : {};
  const fromTerrain = site.terrain !== undefined ? pointOf(featureAtPath(site.terrain, f)) : null;
  const g = fromPipeline(site, f)
    ?? (fromTerrain ? { center: fromTerrain, ...radius } : null)
    ?? (site.local ? { center: at(site.local)!, ...radius } : null)
    ?? (site.feature !== undefined ? featureGeometry(site.feature, f) : null);
  return g ? { id: site.id, kind: site.kind, name: site.name, ...g, ...marsExtras(site, f), spec: site } : null;
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
