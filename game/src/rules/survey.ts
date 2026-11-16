// Exploration on the minimap: which sites the rover has discovered, the orbital survey leads (a rough
// bearing and distance to an area, never an exact spot), and how far the map is zoomed out. Sites come
// from terrain.json features (passed in as plain data); sizes and leads from tuning.survey and
// tuning.minimap. Mars adds the delta front (a scarp line), Séítah (an outline), its viewpoints and
// Perseverance's landing site. Titan adds its dune crests (lines), interdune corridors (outlines), the
// sample patch and Selk crater (a landmark far off the map: its lead is a bearing only). Pure: no rendering, no DOM.
import type { MilestoneTuning, SurveyTuning, Tuning } from './types';

export interface Point { x: number; z: number }

/** delta-front: Mars's scarp line; region: Séítah; landmark: Perseverance's landing site, Selk. Titan: dune-crest, corridor, sample-patch. */
export type SiteKind = 'viewpoint' | 'rocky-area' | 'crater-wall' | 'shadowed-crater' | 'delta-front' | 'region' | 'landmark'
  | 'dune-crest' | 'corridor' | 'sample-patch';

export type SiteArea =
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'polygon'; points: [number, number][] }
  /** Within r of a polyline. */
  | { kind: 'path'; points: [number, number][]; r: number };

/** A place the minimap draws once the rover has discovered it. */
export interface Site {
  key: string; // a terrain.json feature key or feature name, as the leads name them
  alias?: string; // another name a lead may use: rocky areas are also "rockyAreas.<index>"
  name: string;
  kind: SiteKind;
  area: SiteArea; // discovered once the reveal circle touches this
  discovered: boolean;
}

/** terrain.json features the survey reads: the Moon's own features are absent on Mars, and Mars's on the Moon. */
export interface SurveyFeatures {
  rimViewpoints?: { name: string; local: Point }[];
  rockyAreas: { name: string; local: Point; radius_m: number }[];
  shadowedCrater?: { outlineLocal_xz: [number, number][] };
  craterDescent?: { name: string; local: Point };
  // Mars (rules/marsTypes.ts MarsTerrainFeatures)
  deltaFront?: { name: string; scarpLocal_xz: [number, number][]; zoneRadius_m: number };
  seitah?: { name: string; outlineLocal_xz: [number, number][] };
  viewpoints?: { name: string; local: Point }[];
  perseveranceLanding?: { name: string; local: Point };
  // Titan (rules/titanTypes.ts TitanTerrainFeatures)
  duneCrests?: { zoneRadius_m: number; lines: { name: string; crestLocal_xz: [number, number][] }[] };
  interdunes?: { corridors: { name: string; outlineLocal_xz: [number, number][] }[] };
  samplePatch?: { name: string; local: Point; radius_m: number };
  selk?: { name: string; centerLocal: Point; diameter_km: number };
}

/** Sites sized like the milestone zones: viewpoint and wall zones, the boulder spread, the shadow outline. */
export function buildSites(f: SurveyFeatures, m: MilestoneTuning, shadowedCraterName: string): Site[] {
  const circle = (x: number, z: number, r: number): SiteArea => ({ kind: 'circle', x, z, r });
  const { craterDescent: wall, shadowedCrater: dark } = f;
  return [
    ...(f.rimViewpoints ?? []).map((v): Site => ({ key: v.name, name: v.name, kind: 'viewpoint', area: circle(v.local.x, v.local.z, m.photoZoneRadiusM), discovered: false })),
    ...f.rockyAreas.map((a, i): Site => ({ key: a.name, alias: `rockyAreas.${i}`, name: a.name, kind: 'rocky-area', area: circle(a.local.x, a.local.z, a.radius_m * m.boulderCrossRadiusFactor), discovered: false })),
    ...(wall ? [{ key: 'craterDescent', name: wall.name, kind: 'crater-wall', area: circle(wall.local.x, wall.local.z, m.photoZoneRadiusM), discovered: false } satisfies Site] : []),
    ...(dark ? [{ key: 'shadowedCrater', name: shadowedCraterName, kind: 'shadowed-crater', area: { kind: 'polygon', points: dark.outlineLocal_xz }, discovered: false } satisfies Site] : []),
    // Mars: sized like its milestone zones (the delta front's zone radius, Séítah's outline, viewpoint circles).
    ...(f.viewpoints ?? []).map((v, i): Site => ({ key: v.name, alias: `viewpoints.${i}`, name: v.name, kind: 'viewpoint', area: circle(v.local.x, v.local.z, m.photoZoneRadiusM), discovered: false })),
    ...(f.deltaFront ? [{ key: 'deltaFront', name: f.deltaFront.name, kind: 'delta-front', area: { kind: 'path', points: f.deltaFront.scarpLocal_xz, r: f.deltaFront.zoneRadius_m }, discovered: false } satisfies Site] : []),
    ...(f.seitah ? [{ key: 'seitah', name: f.seitah.name, kind: 'region', area: { kind: 'polygon', points: f.seitah.outlineLocal_xz }, discovered: false } satisfies Site] : []),
    ...(f.perseveranceLanding ? [{ key: 'perseveranceLanding', name: f.perseveranceLanding.name, kind: 'landmark', area: circle(f.perseveranceLanding.local.x, f.perseveranceLanding.local.z, 0), discovered: false } satisfies Site] : []),
    // Titan: sized like its milestone zones (crest zone radius, corridor outlines, the patch's radius).
    ...(f.duneCrests?.lines ?? []).map((l, i): Site => ({ key: `duneCrests.${i}`, name: `${l.name} crest`, kind: 'dune-crest', area: { kind: 'path', points: l.crestLocal_xz, r: f.duneCrests!.zoneRadius_m }, discovered: false })),
    ...(f.interdunes?.corridors ?? []).map((c, i): Site => ({ key: `interdunes.${i}`, name: c.name, kind: 'corridor', area: { kind: 'polygon', points: c.outlineLocal_xz }, discovered: false })),
    ...(f.samplePatch ? [{ key: 'samplePatch', name: f.samplePatch.name, kind: 'sample-patch', area: circle(f.samplePatch.local.x, f.samplePatch.local.z, f.samplePatch.radius_m), discovered: false } satisfies Site] : []),
    // Selk's center is tens of km off the map, so it is never discovered; its lead is a bearing to the rim.
    ...(f.selk ? [{ key: 'selk', name: f.selk.name, kind: 'landmark', area: circle(f.selk.centerLocal.x, f.selk.centerLocal.z, (f.selk.diameter_km * 1000) / 2), discovered: false } satisfies Site] : []),
  ];
}

/** The point of a polyline nearest to p. */
export function nearestOnPath(points: [number, number][], p: Point): Point {
  let best = { x: points[0]?.[0] ?? 0, z: points[0]?.[1] ?? 0 };
  let bestD = Math.hypot(p.x - best.x, p.z - best.z);
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]!;
    const [bx, bz] = points[i]!;
    const ex = bx - ax;
    const ez = bz - az;
    const u = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / (ex * ex + ez * ez || 1)));
    const q = { x: ax + u * ex, z: az + u * ez };
    const d = Math.hypot(p.x - q.x, p.z - q.z);
    if (d < bestD) [best, bestD] = [q, d];
  }
  return best;
}

function inPolygon(points: [number, number][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i]!;
    const [xj, zj] = points[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from a point to the near edge of an area (0 inside it). */
export function distanceToArea(area: SiteArea, p: Point): number {
  if (area.kind === 'circle') return Math.max(0, Math.hypot(p.x - area.x, p.z - area.z) - area.r);
  if (area.kind === 'path') {
    const q = nearestOnPath(area.points, p);
    return Math.max(0, Math.hypot(p.x - q.x, p.z - q.z) - area.r);
  }
  if (inPolygon(area.points, p.x, p.z)) return 0;
  let best = Infinity;
  const pts = area.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, az] = pts[j]!;
    const [bx, bz] = pts[i]!;
    const ex = bx - ax;
    const ez = bz - az;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / (ex * ex + ez * ez || 1)));
    best = Math.min(best, Math.hypot(p.x - (ax + t * ex), p.z - (az + t * ez)));
  }
  return best;
}

/** The middle of an area: a circle's center, a polygon's or path's vertex average. */
export function areaCenter(area: SiteArea): Point {
  if (area.kind === 'circle') return { x: area.x, z: area.z };
  const n = area.points.length || 1;
  return {
    x: area.points.reduce((s, [x]) => s + x, 0) / n,
    z: area.points.reduce((s, [, z]) => s + z, 0) / n,
  };
}

/** Mark the sites the reveal circle at p touches. Returns the newly discovered ones. */
export function discover(sites: Site[], p: Point, revealRadiusM: number): Site[] {
  const found: Site[] = [];
  for (const s of sites) {
    if (!s.discovered && distanceToArea(s.area, p) <= revealRadiusM) {
      s.discovered = true;
      found.push(s);
    }
  }
  return found;
}

/** Azimuth in degrees (0 = local −z, grid north; 90 = +x), as in terrain.json. */
export function azimuthDeg(from: Point, to: Point): number {
  const a = (Math.atan2(to.x - from.x, -(to.z - from.z)) * 180) / Math.PI;
  return (a + 360) % 360;
}

/** One of 16 compass points: 0 = north, 1 = north-northeast, ... 15 = north-northwest. */
export function compassPoint(azimuth: number): number {
  return Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16;
}

/** A distance in km, rounded as the survey reports it (finer below 1 km). */
export function roundedKm(distanceM: number, t: SurveyTuning): number {
  const km = distanceM / 1000;
  const step = km < 1 ? t.roundKmBelow1 : t.roundKmAbove1;
  return Math.max(step, Math.round(km / step) * step);
}

export interface Lead {
  id: string;
  site: Site;
}

/** The survey leads from tuning, matched to their sites (a lead whose site is missing is dropped). */
export function buildLeads(sites: Site[], t: SurveyTuning): Lead[] {
  return t.leads.flatMap((l) => {
    const site = sites.find((s) => s.key === l.site || s.alias === l.site);
    return site ? [{ id: l.id, site }] : [];
  });
}

export interface LeadBearing {
  azimuth: number; // toward the area's center
  compass: number; // compassPoint(azimuth)
  distanceKm: number; // to the near edge, rounded
}

/**
 * Where a lead's area lies from a point: a rough bearing and distance, not a spot. The bearing is toward
 * the area's center, or for a long line (the delta front) toward its nearest point.
 */
export function leadBearing(lead: Lead, from: Point, t: SurveyTuning): LeadBearing {
  const a = lead.site.area;
  const azimuth = azimuthDeg(from, a.kind === 'path' ? nearestOnPath(a.points, from) : areaCenter(a));
  return { azimuth, compass: compassPoint(azimuth), distanceKm: roundedKm(distanceToArea(lead.site.area, from), t) };
}

/** The part of the map explored so far, as a box (grows with each reveal circle). */
export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }

export function growBounds(b: Bounds | null, p: Point, radiusM: number): Bounds {
  if (!b) return { minX: p.x - radiusM, maxX: p.x + radiusM, minZ: p.z - radiusM, maxZ: p.z + radiusM };
  return {
    minX: Math.min(b.minX, p.x - radiusM),
    maxX: Math.max(b.maxX, p.x + radiusM),
    minZ: Math.min(b.minZ, p.z - radiusM),
    maxZ: Math.max(b.maxZ, p.z + radiusM),
  };
}

/** The square the minimap shows: everything explored plus a margin, never smaller than the start view. */
export interface MapView { cx: number; cz: number; spanM: number }

export function mapView(b: Bounds, t: Tuning['minimap']): MapView {
  const w = b.maxX - b.minX + 2 * t.marginM;
  const h = b.maxZ - b.minZ + 2 * t.marginM;
  return {
    cx: (b.minX + b.maxX) / 2,
    cz: (b.minZ + b.maxZ) / 2,
    spanM: Math.min(t.maxSpanM, Math.max(t.startSpanM, w, h)),
  };
}
