// Boulder positions in the rocky areas (small fresh craters in terrain.json) and at the sites.json sites.
// Deterministic, so the world (world/boulders.ts) draws the same boulders the instruments find. Pure.
//
// Mars (Mars step 5c, provisional, for Chieri's review): every Mars site kind with contact targets gets
// boulders (young craters, knobs, the Séítah edge, the delta foot) and the flood boulder is one fixed,
// larger boulder. Counts: tuning.boulders.perSite by id, else perSiteKind by kind, else (young craters)
// perYoungCrater. A share (slopeTargetShare) of each young crater's and knob's boulders sits on the
// pipeline's slope-target patches (10 to 18° cells beside level ground), on the cell's half nearest its
// level neighbour, so a rover parked level can reach it. No Mars site boulder lies on soft ground, nor
// (once tuning.boulders.maxSlopeDeg is set and the world passes its slope) on ground too steep to drive
// to. On the Moon (no Mars keys, no slope targets, no soft ground) the scatter is exactly as before.
import type { Tuning } from './types';
import { seededRng } from './events';
import { softnessAt, type SoftArea } from './ground';
import type { Point, ResolvedSite, SlopePatch } from './sites';

export interface Boulder {
  x: number;
  z: number;
  radius: number;
  site?: string; // the sites.json id it belongs to, which picks its rock suite (absent: the fallback rock list)
  rolled?: boolean; // the one rolled boulder (the Moon)
  flood?: boolean; // the one flood boulder (Mars): larger, readable from its level downhill side
  slopeTarget?: boolean; // placed on a slope-target patch (Mars): ground the arm refuses, level ground beside
}

/** Deterministic boulder positions and sizes: small ones common, large ones rare. */
export function scatterBoulders(areas: (SoftArea & { site?: string })[], b: Tuning['boulders']): Boulder[] {
  const rng = seededRng(b.seed);
  const list: Boulder[] = [];
  for (const a of areas) {
    const spread = a.radiusM * b.spreadRadiusFactor;
    for (let i = 0; i < b.perRockyArea; i++) {
      const r = spread * Math.sqrt(rng());
      const th = rng() * Math.PI * 2;
      const size = b.minDiameterM * (b.maxDiameterM / b.minDiameterM) ** (rng() ** 3);
      list.push({ x: a.x + r * Math.cos(th), z: a.z + r * Math.sin(th), radius: size / 2, ...(a.site ? { site: a.site } : {}) });
    }
  }
  return list;
}

/** Where boulders may not lie: true on soft ground (or, with the world's slope, too steep to drive to). */
export type SoftTest = (x: number, z: number) => boolean;

/**
 * Mars boulder tuning not yet in rules/types.ts (Mars step 5c asks for it): site boulders avoid ground
 * steeper than this, so the rover can drive up to every contact target. Absent: no slope test.
 */
type SiteBoulderTuning = Tuning['boulders'];

/** What the world can tell about the ground at a point (world/terrainMasks.ts), for placeBoulders. */
export interface BoulderGround {
  /** soft-ground.png, 0 (firm) to 1 (sand ripples). Mars only. */
  softAt?: (x: number, z: number) => number;
  /** slope.png, degrees (nearest 5 m sample). */
  slopeAt?: (x: number, z: number) => number;
}

/**
 * The soft-ground test for site boulders: wherever the rover would sink (rules/ground.ts softnessAt > 0)
 * on Mars's sand-ripple fields (terrain.json features.softGround). Undefined on the Moon, whose soft
 * ground is the rocky areas' fresh rims, where its boulders belong.
 */
export function softGroundTest(
  features: { softGround?: { areas: { local: Point; radius_m: number }[] } },
  ground: Tuning['ground'],
): SoftTest | undefined {
  const areas = features.softGround?.areas.map((a): SoftArea => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));
  if (!areas || areas.length === 0) return undefined;
  return (x, z) => softnessAt(x, z, areas, ground) > 0;
}

/** Tries for a firm, clear spot before a site boulder is left out (deterministic: the same tries every run). */
const FIRM_TRIES = 24;

/** How many boulders a site gets: perSite by id, else perSiteKind by kind, else perYoungCrater for young craters. */
export function siteBoulderCount(s: Pick<ResolvedSite, 'id' | 'kind'>, b: Tuning['boulders']): number {
  return b.perSite?.[s.id] ?? b.perSiteKind?.[s.kind] ?? (s.kind === 'young-crater' ? b.perYoungCrater : 0);
}

/** How many of a site's boulders go on its slope-target patches (none without patches or a share). */
export function slopeTargetCount(s: Pick<ResolvedSite, 'id' | 'kind' | 'slopePatches'>, b: Tuning['boulders']): number {
  if (!s.slopePatches?.length || !b.slopeTargetShare) return 0;
  const n = siteBoulderCount(s, b);
  return Math.min(n, Math.round(n * b.slopeTargetShare));
}

/**
 * A point on a slope-target patch: on the slope cell, in its half nearest the level cell (a quarter to
 * under half of the way there, a little to either side), so the nearest 5 m sample is still the slope
 * cell and the level cell is close enough for the arm.
 */
function onPatch(p: SlopePatch, u: number, v: number): Point {
  const dx = p.levelCell.x - p.local.x;
  const dz = p.levelCell.z - p.local.z;
  const along = 0.25 + 0.2 * u; // share of the way to the level cell
  const side = 0.2 * (v - 0.5); // share of the cell spacing, across
  return { x: p.local.x + along * dx - side * dz, z: p.local.z + along * dz + side * dx };
}

/** Uniform along a polyline by length, then across it within ±halfWidth. */
function alongLine(line: readonly [number, number][], halfWidth: number, u: number, w: number): Point {
  const lens = line.slice(1).map(([x, z], i) => Math.hypot(x - line[i]![0], z - line[i]![1]));
  let d = u * lens.reduce((a, l) => a + l, 0);
  for (let i = 0; i < lens.length; i++) {
    const len = lens[i]!;
    if (d <= len || i === lens.length - 1) {
      const [ax, az] = line[i]!;
      const [bx, bz] = line[i + 1]!;
      const t = len > 0 ? Math.min(1, d / len) : 0;
      const nx = len > 0 ? -(bz - az) / len : 0;
      const nz = len > 0 ? (bx - ax) / len : 0;
      const off = (2 * w - 1) * halfWidth;
      return { x: ax + t * (bx - ax) + off * nx, z: az + t * (bz - az) + off * nz };
    }
    d -= len;
  }
  return { x: line[0]![0], z: line[0]![1] };
}

export interface SiteBoulderOptions {
  /** Ground no site boulder lies on (soft, or too steep). Absent: no test (the Moon). */
  soft?: SoftTest;
}

/**
 * Boulders at the sites.json sites: the young craters' (both worlds), the rolled boulder (the Moon), and
 * on Mars the knobs', the Séítah edge's, the delta foot's and the flood boulder. Its own random stream, so
 * the rocky-area boulders from scatterBoulders keep their places. Rocky areas are not included here.
 * Order: the sites' order, each site's slope-target boulders first. A boulder with no firm, clear spot in
 * FIRM_TRIES draws is left out (none on the real Mars sites).
 */
export function scatterSiteBoulders(sites: readonly ResolvedSite[], b: Tuning['boulders'], opts: SiteBoulderOptions = {}): Boulder[] {
  const rng = seededRng(b.seed + 1);
  const list: Boulder[] = [];
  const size = () => b.minDiameterM * (b.maxDiameterM / b.minDiameterM) ** (rng() ** 3);
  // The flood boulder keeps its reading side clear: no other boulder's center within its radius plus the
  // largest boulder's diameter of it or of its reading spot.
  const flood = b.floodBoulderDiameterM !== undefined ? sites.find((s) => s.kind === 'flood-boulder') : undefined;
  const floodClearM = (b.floodBoulderDiameterM ?? 0) / 2 + b.maxDiameterM;
  const keepClear = flood ? [flood.center, ...(flood.readingSpot ? [flood.readingSpot] : [])] : [];
  const ok = (p: Point) => !opts.soft?.(p.x, p.z) && keepClear.every((c) => Math.hypot(p.x - c.x, p.z - c.z) > floodClearM);
  const tries = opts.soft || flood ? FIRM_TRIES : 1; // the Moon: the first draw, as always
  /** Draw spots until one is firm and clear. Null: none. */
  const place = (spot: () => Point): Point | null => {
    for (let i = 0; i < tries; i++) {
      const p = spot();
      if (ok(p)) return p;
    }
    return null;
  };
  const push = (p: Point | null, s: ResolvedSite, extra: Partial<Boulder> = {}) => {
    const d = size();
    if (p) list.push({ x: p.x, z: p.z, radius: d / 2, site: s.id, ...extra });
  };
  for (const s of sites) {
    switch (s.kind) {
      case 'young-crater':
      case 'knob':
      case 'seitah-edge': {
        if (s.radiusM === undefined) break;
        const n = siteBoulderCount(s, b);
        const onSlope = slopeTargetCount(s, b);
        for (let i = 0; i < onSlope; i++) {
          const patch = s.slopePatches![i % s.slopePatches!.length]!;
          push(place(() => onPatch(patch, rng(), rng())), s, { slopeTarget: true });
        }
        const spread = s.radiusM * b.spreadRadiusFactor;
        for (let i = onSlope; i < n; i++) {
          push(place(() => {
            const r = spread * Math.sqrt(rng());
            const th = rng() * Math.PI * 2;
            return { x: s.center.x + r * Math.cos(th), z: s.center.z + r * Math.sin(th) };
          }), s);
        }
        break;
      }
      case 'delta-foot': {
        // Along the foot line, inside its zone: inset by the spread factor, so a rover reading a boulder
        // from its far side still stands in the zone.
        const line = s.line;
        if (!line || s.radiusM === undefined) break;
        const half = s.radiusM / b.spreadRadiusFactor;
        const n = siteBoulderCount(s, b);
        for (let i = 0; i < n; i++) push(place(() => alongLine(line, half, rng(), rng())), s);
        break;
      }
      case 'flood-boulder':
        if (b.floodBoulderDiameterM !== undefined) list.push({ x: s.center.x, z: s.center.z, radius: b.floodBoulderDiameterM / 2, site: s.id, flood: true });
        break;
      case 'rolled-boulder':
        list.push({ x: s.center.x, z: s.center.z, radius: b.rolledBoulderDiameterM / 2, site: s.id, rolled: true });
        break;
      default:
        break;
    }
  }
  return list;
}

/**
 * The ground site boulders avoid: the soft-ground circles (softGroundTest), the world's soft-ground mask
 * (any softness), and with tuning.boulders.maxSlopeDeg the world's slope over it. Undefined when nothing
 * applies (the Moon).
 */
export function siteBoulderBlocked(
  features: Parameters<typeof softGroundTest>[0],
  t: Pick<Tuning, 'boulders' | 'ground'>,
  ground: BoulderGround = {},
): SoftTest | undefined {
  const tests: SoftTest[] = [];
  const circles = softGroundTest(features, t.ground);
  if (circles) tests.push(circles);
  const { softAt, slopeAt } = ground;
  if (softAt) tests.push((x, z) => softAt(x, z) > 0);
  const maxSlope = (t.boulders as SiteBoulderTuning).maxSlopeDeg;
  if (slopeAt && maxSlope !== undefined) tests.push((x, z) => slopeAt(x, z) > maxSlope);
  return tests.length > 0 ? (x, z) => tests.some((f) => f(x, z)) : undefined;
}

/**
 * Every boulder on the map in the order the instruments index them: the rocky areas' (scatterBoulders,
 * each tagged with the rocky-area site at its center, within 1 m, for its rock suite), then the sites'
 * (scatterSiteBoulders, off the ground siteBoulderBlocked rules out). What world/boulders.ts draws and the
 * mission reads, on both worlds; `ground` from the world's masks (on the Moon it changes nothing).
 */
export function placeBoulders(
  rockyAreas: readonly SoftArea[],
  sites: readonly ResolvedSite[],
  t: Pick<Tuning, 'boulders' | 'ground'>,
  features: Parameters<typeof softGroundTest>[0],
  ground: BoulderGround = {},
): Boulder[] {
  const rockySite = (a: Point) => {
    const r = sites.find((x) => x.kind === 'rocky-area' && Math.hypot(x.center.x - a.x, x.center.z - a.z) < 1);
    return r ? { site: r.id } : {};
  };
  const soft = siteBoulderBlocked(features, t, ground);
  return [
    ...scatterBoulders(rockyAreas.map((a) => ({ ...a, ...rockySite(a) })), t.boulders),
    ...scatterSiteBoulders(sites, t.boulders, soft ? { soft } : {}),
  ];
}
