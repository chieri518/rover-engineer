// Milestone triggers, data-driven from data/milestones.json. Zones are built from terrain.json features
// (passed in as plain data) and sized by tuning.milestones. The mission screen feeds the tracker the
// rover's position each step, plus photo and drill actions and flare outcomes; the tracker returns the
// milestones reached. Required parts are enforced here. Mars adds its own zones (delta front, delta
// foot, delta layers and sunset viewpoints, Séítah), night driving, the dust storm, the sunset, crater
// wall and dust devil photos, and the weather mast's timed records; the Moon's zones, Earth photo and ice
// signal simply never apply there. Titan adds dune crests, corridors, the dune-crest viewpoint, the sample
// patch and the Selk ejecta field (rules/titanMilestones.ts), Dune crossing, Dawn and photos blocked by
// rain. Pure: no rendering, no DOM.
import type { BusSlot, Instrument, Milestone, MilestoneTuning, Part, ReadingTarget, RecordEvent, RecordQuality } from './types';
import type { MarsMilestoneTuning, MarsViewpointKind } from './marsTypes';
import type { TitanViewpointKind } from './titanTypes';
import { buildTitanZones, DuneCrossing, type TitanMilestoneFeatures } from './titanMilestones';
import type { DamageCause } from './damage';
import { milestoneStages, type EarnedMilestone } from './payout';
import { meetsRequirements, requiredInstruments } from './rover';
import type { ResolvedSite } from './sites';

export interface Point { x: number; z: number }
export interface Point3 { x: number; y: number; z: number }

/** terrain.json features the milestone zones read: the Moon's own features are absent on Mars, and Mars's on the Moon. */
export interface MilestoneFeatures extends TitanMilestoneFeatures {
  landing: Point3;
  rimViewpoints?: { name: string; local: Point; lookToward: Point }[];
  rockyAreas: { name: string; local: Point; radius_m: number }[];
  shadowedCrater?: { outlineLocal_xz: [number, number][]; iceCandidate: { local: Point } };
  craterDescent?: { name: string; local: Point };
  // Mars (rules/marsTypes.ts MarsTerrainFeatures)
  /** footNear: the nearest 400 m of the scarp foot (the delta-foot zone, within tuning deltaFootRadiusM of its line). */
  deltaFront?: { name: string; scarpLocal_xz: [number, number][]; zoneRadius_m: number; footNear?: { name: string; lineLocal_xz: [number, number][] } };
  seitah?: { name: string; outlineLocal_xz: [number, number][] };
  viewpoints?: { name: string; local: Point; kind: MarsViewpointKind | TitanViewpointKind }[];
  /**
   * The pipeline's craters (Mars MP1): a rocky area that is one of them (`rockyArea`, Rocky area 2) is a
   * crater with a rim, so it is a Crater wall target, with the pipeline's center and rim-crest radius.
   */
  youngCraters?: { id: string; local: Point; radius_m: number; rockyArea?: string }[];
  // Titan (rules/titanTypes.ts TitanTerrainFeatures): duneCrests, interdunes, samplePatch (TitanMilestoneFeatures)
}

/**
 * Every zone buildZones makes, the Moon's, then Mars's (marsTypes.ts MarsZoneId), then Titan's
 * (titanTypes.ts TitanZoneId); milestone triggers may name only these (validate.ts checks).
 * buildZones's own zone literals fail to typecheck if one is missing.
 */
export const ZONE_IDS = [
  'large-crater', 'boulder-field', 'shadowed-crater', 'crater-wall', 'ice-spot', 'rim-viewpoint', 'near-lander',
  // Moon sites (sites.json, rules/sites.ts): one zone per site; the ice signal is around the hidden ice spot.
  'cold-trap', 'young-crater', 'hydrogen-anomaly', 'ice-signal',
  'delta-front', 'delta-layers', 'seitah', 'sunset-viewpoint', 'delta-foot',
  'dune-crest', 'dune-crest-viewpoint', 'interdune-sample', 'ejecta-field', 'interdune-corridor',
] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/** Zones where a photograph is of a place (its caption names the zone). */
export const PHOTO_ZONE_IDS: readonly ZoneId[] = ['rim-viewpoint', 'crater-wall', 'delta-layers', 'sunset-viewpoint', 'dune-crest-viewpoint', 'dune-crest'];

export type ZoneShape =
  | { kind: 'circle'; x: number; z: number; r: number }
  /** Inside the outline, or within marginM of it (a cold trap's outline plus its edge). */
  | { kind: 'polygon'; points: [number, number][]; marginM?: number }
  /** Within r of a polyline (the delta front's scarp). */
  | { kind: 'path'; points: [number, number][]; r: number }
  /** Below a height, on one side of a line: in when y < enterBelowY, out again once y > exitAboveY. */
  | { kind: 'below'; enterBelowY: number; exitAboveY: number; origin: Point; normal: Point };

export interface Zone {
  id: ZoneId;
  key: string; // unique per zone instance (a site's zone: "<zone id>:<site id>")
  name: string; // for photo captions and hints
  shape: ZoneShape;
  site?: string; // the sites.json id the zone comes from
  edgeM?: number; // the zone reaches this far beyond the site's own outline (a cold trap's survey edge)
  /** A young crater's or crater rocky area's center and rim radius (its `young-crater` zone): the Crater wall photo's target. */
  crater?: { x: number; z: number; radiusM: number };
}

/** What the Moon sites' zones need beyond the terrain features: the resolved sites.json sites and the meter's ice signal. */
export interface ZoneOptions {
  sites?: readonly ResolvedSite[];
  /** The ice signal zone: where the meter's ice signal (1 at the spot, 0 at iceRangeM) reaches iceSignalShare. */
  neutron?: { iceRangeM: number; iceSignalShare: number };
}

/** Milestone tuning with the Mars fields (absent on the Moon). */
type ZoneTuning = MilestoneTuning & Partial<MarsMilestoneTuning>;

/**
 * The sites' zones (sites.json, both worlds): cold traps, the young craters' and rocky areas' ejecta rings
 * (with their crater for Crater wall), and the hidden hydrogen. A rocky area is a crater only when the
 * pipeline lists it as one (youngCraters[].rockyArea): Rocky area 2 on Mars, not Rocky area 1's boulder field.
 */
function siteZones(sites: readonly ResolvedSite[], t: ZoneTuning, craters: MilestoneFeatures['youngCraters'] = []): Zone[] {
  const zones: Zone[] = [];
  const circle = (s: ResolvedSite, r: number): ZoneShape => ({ kind: 'circle', x: s.center.x, z: s.center.z, r });
  for (const s of sites) {
    const base = { name: s.name, site: s.id };
    if (s.kind === 'cold-trap') {
      // Its permanent-shadow outline plus the survey edge, so a rover that stops at the edge can survey it.
      const edgeM = t.coldTrapEdgeM;
      if (s.outline) zones.push({ id: 'cold-trap', key: `cold-trap:${s.id}`, ...base, edgeM, shape: { kind: 'polygon', points: s.outline, marginM: edgeM } });
      else if (s.radiusM !== undefined) zones.push({ id: 'cold-trap', key: `cold-trap:${s.id}`, ...base, edgeM, shape: circle(s, s.radiusM + edgeM) });
    } else if ((s.kind === 'young-crater' || s.kind === 'rocky-area') && s.radiusM !== undefined) {
      // The ejecta ring, the crater floor included: Fresh ejecta sample.
      const pit = s.kind === 'young-crater' ? { x: s.center.x, z: s.center.z, radiusM: s.radiusM } : rockyCrater(s, craters);
      zones.push({
        id: 'young-crater', key: `young-crater:${s.id}`, ...base, shape: circle(s, s.radiusM * t.youngCraterEjectaFactor),
        ...(pit ? { crater: pit } : {}),
      });
    } else if (s.kind === 'hidden-hydrogen') {
      zones.push({ id: 'hydrogen-anomaly', key: `hydrogen-anomaly:${s.id}`, ...base, shape: circle(s, t.hydrogenZoneRadiusM) });
    }
  }
  return zones;
}

/** The pipeline crater a rocky area is (by its terrain feature name, or its own name), if any. */
function rockyCrater(s: ResolvedSite, craters: NonNullable<MilestoneFeatures['youngCraters']>): Zone['crater'] | undefined {
  const c = craters.find((x) => x.rockyArea !== undefined && (x.rockyArea === s.spec.feature || x.rockyArea === s.name));
  return c ? { x: c.local.x, z: c.local.z, radiusM: c.radius_m } : undefined;
}

/** Distance from a point to a closed outline's edge. */
function distanceToRing(points: [number, number][], x: number, z: number): number {
  return points.length ? distanceToPath([...points, points[0]!], x, z) : Infinity;
}

/**
 * How far a point lies outside the site's own outline (0 inside it): for a cold trap, the outline
 * without its survey edge. Zones without an extent ('below') never count as near.
 */
export function distanceToOutline(zone: Zone, p: Point): number {
  const s = zone.shape;
  const edge = zone.edgeM ?? 0;
  switch (s.kind) {
    case 'circle':
      return Math.max(0, Math.hypot(p.x - s.x, p.z - s.z) - (s.r - edge));
    case 'polygon':
      return inPolygon(s.points, p.x, p.z) ? 0 : distanceToRing(s.points, p.x, p.z);
    case 'path':
      return Math.max(0, distanceToPath(s.points, p.x, p.z) - (s.r - edge));
    case 'below':
      return Infinity;
  }
}

export function buildZones(f: MilestoneFeatures, t: ZoneTuning, opts: ZoneOptions = {}): Zone[] {
  const zones: Zone[] = [];
  const { rimViewpoints = [], craterDescent: wall, shadowedCrater: dark } = f;
  rimViewpoints.forEach((v, i) => zones.push({
    id: 'rim-viewpoint', key: `rim-viewpoint-${i}`, name: v.name,
    shape: { kind: 'circle', x: v.local.x, z: v.local.z, r: t.photoZoneRadiusM },
  }));
  if (wall) zones.push({
    id: 'crater-wall', key: 'crater-wall', name: wall.name,
    shape: { kind: 'circle', x: wall.local.x, z: wall.local.z, r: t.photoZoneRadiusM },
  });
  f.rockyAreas.forEach((a, i) => zones.push({
    id: 'boulder-field', key: `boulder-field-${i}`, name: a.name,
    shape: { kind: 'circle', x: a.local.x, z: a.local.z, r: a.radius_m * t.boulderCrossRadiusFactor },
  }));
  if (dark) zones.push({
    id: 'shadowed-crater', key: 'shadowed-crater', name: 'Shadowed crater',
    shape: { kind: 'polygon', points: dark.outlineLocal_xz },
  });
  // Mars: the delta front (within its zone radius of the scarp), Séítah, and the two kinds of viewpoint.
  if (f.deltaFront) zones.push({
    id: 'delta-front', key: 'delta-front', name: f.deltaFront.name,
    shape: { kind: 'path', points: f.deltaFront.scarpLocal_xz, r: f.deltaFront.zoneRadius_m },
  });
  if (f.seitah) zones.push({ id: 'seitah', key: 'seitah', name: f.seitah.name, shape: { kind: 'polygon', points: f.seitah.outlineLocal_xz } });
  // The delta foot (Signs of an ancient lake, Lake organics, Rock from afar): within deltaFootRadiusM of the
  // nearest 400 m of the scarp foot; without the pipeline's foot line, a circle around the delta-foot site.
  const footSite = opts.sites?.find((s) => s.kind === 'delta-foot');
  const foot = f.deltaFront?.footNear;
  if (t.deltaFootRadiusM !== undefined && (foot?.lineLocal_xz.length || footSite)) {
    const r = t.deltaFootRadiusM;
    zones.push({
      id: 'delta-foot', key: 'delta-foot', name: footSite?.name ?? foot?.name ?? 'Delta foot',
      ...(footSite ? { site: footSite.id } : {}),
      shape: foot?.lineLocal_xz.length ? { kind: 'path', points: foot.lineLocal_xz, r } : { kind: 'circle', x: footSite!.center.x, z: footSite!.center.z, r },
    });
  }
  (f.viewpoints ?? []).forEach((v, i) => zones.push({
    id: v.kind === 'deltaLayers' ? 'delta-layers' : v.kind === 'duneCrest' ? 'dune-crest-viewpoint' : 'sunset-viewpoint',
    key: `viewpoint-${i}`, name: v.name,
    shape: { kind: 'circle', x: v.local.x, z: v.local.z, r: t.photoZoneRadiusM },
  }));
  zones.push(...buildTitanZones(f, t));
  // Ground the lander's engine plume disturbed: drill samples here do not count.
  zones.push({
    id: 'near-lander', key: 'near-lander', name: 'Lander',
    shape: { kind: 'circle', x: f.landing.x, z: f.landing.z, r: t.sampleMinDistanceM },
  });
  // The ice spot is hidden from the player (no marker); they find it by drilling in the dark crater.
  if (dark) {
    const ice = dark.iceCandidate.local;
    zones.push({ id: 'ice-spot', key: 'ice-spot', name: 'Ice spot', shape: { kind: 'circle', x: ice.x, z: ice.z, r: t.iceSpotRadiusM } });
    // Ice deposit located: the part of the dark crater where the meter's ice signal reaches its share.
    // The circle lies inside the crater (the spot is 100 to 200 m inside the shadow edge; a test checks).
    if (opts.neutron) {
      const r = (1 - opts.neutron.iceSignalShare) * opts.neutron.iceRangeM;
      zones.push({ id: 'ice-signal', key: 'ice-signal', name: 'Ice signal', shape: { kind: 'circle', x: ice.x, z: ice.z, r } });
    }
  }
  zones.push(...siteZones(opts.sites ?? [], t, f.youngCraters));
  // de Gerlache's inner wall: the side of the rim the viewpoints look toward (the north flank, toward the
  // dark crater, also drops far below the landing point and must not count).
  if (!wall) return zones; // not the Moon
  const toward = rimViewpoints[0]?.lookToward ?? { x: 0, z: 1 };
  zones.push({
    id: 'large-crater', key: 'large-crater', name: 'de Gerlache inner wall',
    shape: {
      kind: 'below',
      enterBelowY: f.landing.y - t.craterDescentDepthM,
      exitAboveY: f.landing.y - t.craterDescentExitDepthM,
      origin: { x: f.landing.x, z: f.landing.z },
      normal: toward,
    },
  });
  return zones;
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

/** Distance in the x-z plane from a point to a polyline. */
export function distanceToPath(points: [number, number][], x: number, z: number): number {
  if (points.length === 1) return Math.hypot(x - points[0]![0], z - points[0]![1]);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]!;
    const [bx, bz] = points[i]!;
    const ex = bx - ax;
    const ez = bz - az;
    const u = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    best = Math.min(best, Math.hypot(x - (ax + u * ex), z - (az + u * ez)));
  }
  return best;
}

export function zoneContains(zone: Zone, p: Point3, wasInside = false): boolean {
  const s = zone.shape;
  switch (s.kind) {
    case 'circle':
      return (p.x - s.x) ** 2 + (p.z - s.z) ** 2 <= s.r * s.r;
    case 'polygon':
      return inPolygon(s.points, p.x, p.z) || (s.marginM !== undefined && distanceToRing(s.points, p.x, p.z) <= s.marginM);
    case 'path':
      return distanceToPath(s.points, p.x, p.z) <= s.r;
    case 'below': {
      const side = (p.x - s.origin.x) * s.normal.x + (p.z - s.origin.z) * s.normal.z > 0;
      return side && p.y < (wasInside ? s.exitAboveY : s.enterBelowY);
    }
  }
}

function zoneCenter(zone: Zone): Point | null {
  return zone.shape.kind === 'circle' ? { x: zone.shape.x, z: zone.shape.z } : null;
}

/** The angle in degrees, around a center, between two points given relative to it. */
function aroundDeg(a: Point, b: Point): number {
  const cos = (a.x * b.x + a.z * b.z) / (Math.hypot(a.x, a.z) * Math.hypot(b.x, b.z) || 1);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
}

/** A milestone reached this step. For staged milestones (Odometer), `stage` counts from 1. */
export interface Reached {
  milestone: Milestone;
  stage: number;
  stages: number; // how many stages the milestone has (1 for most)
}

/** A trigger that fired on a rover without the required parts: not credited. */
export interface Missed {
  milestone: Milestone;
  missing: (BusSlot | Instrument)[];
}

export interface MilestoneUpdate {
  reached: Reached[];
  missed: Missed[];
  /** Zones left without counting as a crossing (a hint, once per zone): the rover turned back instead of crossing. */
  partialCrossings: Zone[];
}

export interface StepInput {
  position: Point3; // the rover; y is the ground height under it
  distanceM: number; // total distance driven this mission
  exploredShare: number; // share of the map explored (rules/explore.ts)
  flareSurvived?: boolean; // a flare struck this step and the rover was protected
  /** Mars: it is night now (dusk to dawn; rules/sol.ts solClock().isNight). Distance driven while true counts for Night drive. */
  night?: boolean;
  /** Mars: the dust storm is active now (rules/storm.ts stormPhase() === 'active'). Storm survivor fires when it clears. */
  /** Titan: the methane rain is active now (rules track T3). */
  stormActive?: boolean;
  /** Standby instruments switched on now (MissionState.standbyOn): their transects count the distance driven. */
  switchedOn?: readonly Instrument[];
  /** The rover is powered down now (a flare): transects pause, neither counting nor starting again. */
  poweredDown?: boolean;
  /** Standby instruments the low-energy warning switched off (not the player), until the player switches them again: their transects pause, like a power-down, instead of starting again. */
  autoOff?: readonly Instrument[];
  /** Seconds since the last step (the simulation step): timed records (`record.seconds`, the weather mast) count them. */
  dt?: number;
  /** Mars: a dust devil passed within tuning.dust.dustDevilSenseM of the rover during this step (rules/dust.ts dustDevilsWithin). */
  dustDevilPassed?: boolean;
  /** Titan: rain blocks photos now (the rain is active and events.rainstorm.blocksPhotos). Photos then count for nothing. */
  photosBlocked?: boolean;
}

/**
 * What a finished reading found: its target, and for a boulder its rock type and index (the X-ray and the
 * laser pass both, the organics spectrometer its boulder). Rock types and boulders count per instrument:
 * a laser reading never counts toward the X-ray's Rock collection, Rare rock or Documented sample.
 */
export interface ReadingResult {
  target?: ReadingTarget;
  rock?: string; // the rock type read (rules/instruments.ts rockTypeFor)
  boulder?: number; // which boulder (scatter order), for Documented sample
}

/** A boulder inside the camera frame when a photo was taken (the world's frame test, photoFrameMargin). */
export interface FramedBoulder {
  index: number; // in the boulder list, as ReadingResult.boulder
  x: number;
  z: number;
  rolled?: boolean; // the rolled boulder (Boulder track)
}

/** Mars: what else the camera saw when a photo was taken (the world's frame test, photoFrameMargin). */
export interface PhotoView {
  /** Whether a ground point (at the terrain height) is inside the frame (projection only: terrain does not hide it, which is generous for a crater center below the near rim): Crater wall asks it about craters' centers. */
  groundInFrame?: (p: Point) => boolean;
  /** Where each dust devil standing now and inside the frame is (rules/dust.ts dustDevilPosition): Dust devil. */
  dustDevilsInFrame?: readonly Point[];
}

/** A station on the ground. */
interface Station {
  at: Point;
  earthInView: boolean;
  outside: boolean; // set down outside the near-lander zone
}

/** A transect in progress: an unbroken switched-on drive, and the zones it has touched so far. */
interface TransectRun {
  meters: number;
  outsideM: number; // the meters driven outside the near-lander zone (a transect with no zone counts only these)
  touched: Set<string>; // zone keys
}

/** Mars: the Sun as the camera saw it when a photo was taken, for Blue sunset. */
export interface SunPhoto {
  elevationDeg: number; // the Sun's center above the horizon (rules/marsSun.ts marsSunAt().elevationDeg)
  setting: boolean; // after local noon (rules/sol.ts solClock().sunSetting)
  inFrame: boolean; // inside the camera frame and not hidden by terrain (scene.inView(sunDir, photoFrameMargin))
}

/** Why a sunset photo would not count, or null when it would. */
export type SunsetBlocker = 'not-in-frame' | 'not-setting' | 'too-high' | 'too-low' | 'too-close';

function missingParts(parts: Part[], m: Milestone): Missed['missing'] {
  const missing: Missed['missing'] = [];
  for (const slot of m.requires.slots ?? []) {
    if (!meetsRequirements(parts, { ...m, requires: { slots: [slot] } })) missing.push(slot);
  }
  for (const inst of requiredInstruments(m)) if (!parts.some((p) => p.effects.instrument === inst)) missing.push(inst);
  return missing;
}

export class MilestoneTracker {
  private readonly earned = new Map<string, number>(); // id → stages reached
  private readonly inside = new Map<string, Point | null>(); // zone key → where it was entered
  private readonly missedOnce = new Set<string>();
  private readonly partialHinted = new Set<string>(); // zone keys already reported as a partial crossing
  private readonly sampleSites: Point[] = []; // where counted drill samples were taken
  private readonly landing: Point;
  private lastDistanceM: number | null = null;
  private nightM = 0; // distance driven at night this mission
  private stormWasActive = false;
  private readonly runs = new Map<Instrument, TransectRun>(); // switched-on drives in progress
  private readonly surveyed = new Map<string, Set<string>>(); // staged transect id → zone keys credited
  private readonly rocksRead = new Map<Instrument, Set<string>>(); // distinct rock types read this mission, per instrument
  private readonly boulderRead = new Map<Instrument, Set<number>>(); // boulders read this mission, per instrument
  private readonly readingSites = new Map<Instrument, Point[]>(); // where counted readings were taken, per instrument
  private readonly stations = new Map<Instrument, Station>();
  private readonly recordSeconds = new Map<string, number>(); // "<instrument>:<event>" → seconds counted while the event is active
  private readonly recordStep = new Map<string, number>(); // the counts already advanced this step
  private wasNight = false; // Titan Dawn: night ended while the mission ran
  private blocked = false; // Titan: rain blocks photos (from the last step)
  private readonly duneCrossing = new DuneCrossing();

  constructor(
    private readonly catalog: Milestone[],
    private readonly parts: Part[],
    readonly zones: Zone[],
    private readonly t: MilestoneTuning & Partial<MarsMilestoneTuning>,
  ) {
    const lander = zones.find((z) => z.id === 'near-lander');
    this.landing = lander && lander.shape.kind === 'circle' ? { x: lander.shape.x, z: lander.shape.z } : { x: 0, z: 0 };
  }

  /** Whether this rover is equipped to earn the milestone at all. */
  eligible(m: Milestone): boolean {
    return meetsRequirements(this.parts, m);
  }

  private fire(m: Milestone, update: MilestoneUpdate, stagesNow = 1): void {
    const stages = milestoneStages(m);
    const before = this.earned.get(m.id) ?? 0;
    const target = Math.min(stagesNow, stages);
    if (target <= before) return;
    if (!this.eligible(m)) {
      if (!this.missedOnce.has(m.id)) {
        this.missedOnce.add(m.id);
        update.missed.push({ milestone: m, missing: missingParts(this.parts, m) });
      }
      return;
    }
    this.earned.set(m.id, target);
    for (let stage = before + 1; stage <= target; stage++) update.reached.push({ milestone: m, stage, stages });
  }

  private each(type: Milestone['trigger']['type'], fn: (m: Milestone) => void): void {
    for (const m of this.catalog) if (m.trigger.type === type) fn(m);
  }

  private empty(): MilestoneUpdate {
    return { reached: [], missed: [], partialCrossings: [] };
  }

  /** The rover has landed. */
  land(): MilestoneUpdate {
    const u = this.empty();
    this.each('landing', (m) => this.fire(m, u));
    return u;
  }

  /** Zones the rover is in after the last step. */
  currentZones(): Zone[] {
    return this.zones.filter((z) => this.inside.has(z.key));
  }

  /** Titan: whether rain blocks photos now (from the last step), for the notice. */
  photosBlocked(): boolean {
    return this.blocked;
  }

  /** Distance driven at night so far this mission (Mars). */
  nightDistanceM(): number {
    return this.nightM;
  }

  step(input: StepInput): MilestoneUpdate {
    const u = this.empty();
    const p = input.position;
    const driven = this.lastDistanceM === null ? 0 : Math.max(0, input.distanceM - this.lastDistanceM);
    this.lastDistanceM = input.distanceM;
    if (input.night) this.nightM += driven;
    const stormCleared = this.stormWasActive && !input.stormActive;
    this.stormWasActive = input.stormActive ?? false;
    const dawn = this.wasNight && !input.night;
    this.wasNight = input.night ?? false;
    this.blocked = input.photosBlocked ?? false;
    const exited: { zone: Zone; entry: Point | null }[] = [];
    for (const zone of this.zones) {
      const was = this.inside.has(zone.key);
      const now = zoneContains(zone, p, was);
      if (now && !was) {
        const c = zoneCenter(zone);
        this.inside.set(zone.key, c ? { x: p.x - c.x, z: p.z - c.z } : null);
      } else if (!now && was) {
        exited.push({ zone, entry: this.inside.get(zone.key) ?? null });
        this.inside.delete(zone.key);
      }
    }
    this.stepTransects(input, driven);
    this.stepRecords(input, u);
    // Titan: Dune crossing, from one corridor to another over a crest.
    const corridor = this.zones.find((z) => z.id === 'interdune-corridor' && this.inside.has(z.key));
    const onCrest = this.zones.some((z) => z.id === 'dune-crest' && this.inside.has(z.key));
    const duneCrossed = this.duneCrossing.step(corridor?.key ?? null, onCrest);
    for (const m of this.catalog) {
      const tr = m.trigger;
      if (tr.type === 'distance') {
        this.fire(m, u, tr.meters.filter((d) => input.distanceM >= d).length);
      } else if (tr.type === 'explore') {
        if (input.exploredShare >= tr.share) this.fire(m, u);
      } else if (tr.type === 'zone') {
        for (const { zone, entry } of exited) {
          if (zone.id !== tr.zone) continue;
          if (tr.mode === 'enter-and-exit' || this.crossed(zone, entry, p)) this.fire(m, u);
          else if (this.t.partialCrossingHint && !this.earned.has(m.id) && !this.partialHinted.has(zone.key)) {
            this.partialHinted.add(zone.key);
            u.partialCrossings.push(zone);
          }
        }
      } else if (tr.type === 'event') {
        if (tr.event === 'flare' && input.flareSurvived) this.fire(m, u);
      } else if (tr.type === 'night-distance') {
        this.fire(m, u, tr.meters.filter((d) => this.nightM >= d).length);
      } else if (tr.type === 'storm-survive') {
        if (stormCleared) this.fire(m, u);
      } else if (tr.type === 'transect') {
        this.checkTransect(m, tr, u);
      } else if (tr.type === 'dune-crossing') {
        if (duneCrossed) this.fire(m, u);
      } else if (tr.type === 'dawn') {
        if (dawn) this.fire(m, u);
      }
    }
    return u;
  }

  /**
   * Switched-on drives: each standby instrument counts the meters driven while it is on and the rover
   * powered up, and the zones touched on the way. Switching it off by hand starts the count again; a
   * power-down, or the low-energy switch-off (Phase 6), only pauses it until it is switched on again.
   */
  private stepTransects(input: StepInput, driven: number): void {
    if (input.poweredDown) return;
    const on = input.switchedOn ?? [];
    const kept = input.autoOff ?? [];
    for (const inst of [...this.runs.keys()]) if (!on.includes(inst) && !kept.includes(inst)) this.runs.delete(inst);
    if (on.length === 0) return;
    const here = this.zones.filter((z) => this.inside.has(z.key));
    const nearLander = here.some((z) => z.id === 'near-lander');
    for (const inst of on) {
      const run = this.runs.get(inst) ?? { meters: 0, outsideM: 0, touched: new Set<string>() };
      this.runs.set(inst, run);
      run.meters += driven;
      if (!nearLander) run.outsideM += driven;
      for (const z of here) run.touched.add(z.key);
    }
  }

  /** Whether a record event is active this step (`record.seconds`; the moonquake is a station's, through record()). */
  private eventActive(event: RecordEvent, input: StepInput): boolean {
    switch (event) {
      case 'duststorm': return input.stormActive === true;
      case 'night': return input.night === true;
      case 'dustdevil': return input.dustDevilPassed === true;
      case 'quake': return false;
    }
  }

  /**
   * Timed records (Mars M16, the weather mast aboard): the seconds an event is active with the instrument
   * switched on, the rover powered up and outside the near-lander zone. Anything else (switched off, a
   * power-down or sleep, the low-energy switch-off, near the lander) pauses the count; it starts again
   * only when the event ends (one night, one storm). `seconds` 0 counts at the moment the event comes.
   */
  private stepRecords(input: StepInput, u: MilestoneUpdate): void {
    const counting = !input.poweredDown && !this.inside.has('near-lander');
    const on = input.switchedOn ?? [];
    this.each('record', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'record' || tr.seconds === undefined) return;
      const key = `${tr.instrument}:${tr.event}`;
      if (!this.eventActive(tr.event, input)) return void this.recordSeconds.delete(key);
      if (!counting || !on.includes(tr.instrument)) return;
      // Several milestones may share one count: add this step's seconds once.
      const counted = this.recordStep.get(key);
      const total = counted ?? (this.recordSeconds.get(key) ?? 0) + Math.max(0, input.dt ?? 0);
      this.recordStep.set(key, total);
      this.recordSeconds.set(key, total);
      if (total >= tr.seconds) this.fire(m, u);
    });
    this.recordStep.clear();
  }

  /** Seconds counted so far toward a timed record of this event (0 when the event is not active), for the HUD. */
  recordSecondsFor(instrument: Instrument, event: RecordEvent): number {
    return this.recordSeconds.get(`${instrument}:${event}`) ?? 0;
  }

  /**
   * A transect counts once its unbroken drive reaches `meters` and has touched the zone (or any zone of
   * `zones`) anywhere on the way; a staged transect (sites) counts one stage per distinct zone instance
   * (each cold trap, each young crater once). With no zone, only the meters driven outside the
   * near-lander zone count (Long profile): driving near the lander pauses the count, it does not break it.
   */
  private checkTransect(m: Milestone, tr: Extract<Milestone['trigger'], { type: 'transect' }>, u: MilestoneUpdate): void {
    const run = this.runs.get(tr.instrument);
    if (!run) return;
    const ids: readonly string[] | null = tr.zones ?? (tr.zone !== undefined ? [tr.zone] : null);
    if (ids === null) {
      if (run.outsideM >= tr.meters) this.fire(m, u);
      return;
    }
    if (run.meters < tr.meters) return;
    const keys = this.zones.filter((z) => ids.includes(z.id) && run.touched.has(z.key)).map((z) => z.key);
    if (keys.length === 0) return;
    if (!tr.sites) return this.fire(m, u);
    // A rover without the parts is told once and credits nothing, so its zones stay uncounted.
    if (!this.eligible(m)) return this.fire(m, u);
    const done = this.surveyed.get(m.id) ?? new Set<string>();
    this.surveyed.set(m.id, done);
    for (const k of keys) done.add(k);
    this.fire(m, u, Math.min(done.size, tr.sites));
  }

  /** Whether a point lies in the zone with this id (any instance). */
  private inZone(p: Point3, id: ZoneId): boolean {
    return this.zones.some((z) => z.id === id && zoneContains(z, p, this.inside.has(z.key)));
  }

  private readSet<T>(sets: Map<Instrument, Set<T>>, instrument: Instrument): Set<T> {
    const set = sets.get(instrument) ?? new Set<T>();
    sets.set(instrument, set);
    return set;
  }

  /**
   * A finished instrument reading at the rover's position (the X-ray, laser or organics spectrometer).
   * Staged by distinct rock types this instrument read (rocks), by a needed rock type (rock), or by site
   * (sites, as the drill: each site at least sampleSpacingM from the others, and none inside the
   * near-lander zone). Rock types and boulders count per instrument.
   */
  reading(instrument: Instrument, p: Point3, result: ReadingResult = {}): MilestoneUpdate {
    const u = this.empty();
    const rocks = this.readSet(this.rocksRead, instrument);
    if (result.rock !== undefined) rocks.add(result.rock);
    if (result.boulder !== undefined) this.readSet(this.boulderRead, instrument).add(result.boulder);
    const sites = this.readingSites.get(instrument) ?? [];
    this.readingSites.set(instrument, sites);
    const newSite = !this.inZone(p, 'near-lander') && !sites.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < this.t.sampleSpacingM);
    let siteCounted = false;
    this.each('reading', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'reading' || tr.instrument !== instrument) return;
      if (tr.zone && !this.inZone(p, tr.zone as ZoneId)) return;
      if (tr.target && tr.target !== result.target) return;
      if (tr.rock !== undefined && tr.rock !== result.rock) return;
      if (tr.rocks) return this.fire(m, u, tr.rocks.filter((n) => rocks.size >= n).length);
      if (tr.sites) {
        if (!newSite) return;
        if (!siteCounted) sites.push({ x: p.x, z: p.z });
        siteCounted = true;
        return this.fire(m, u, Math.min(sites.length, tr.sites));
      }
      this.fire(m, u);
    });
    return u;
  }

  /** Whether a boulder was read this mission: by this instrument, or by any (Documented sample: by the instruments it requires). */
  wasRead(boulder: number, by?: Instrument | readonly Instrument[]): boolean {
    const list = by === undefined ? [...this.boulderRead.keys()] : typeof by === 'string' ? [by] : by;
    return list.some((i) => this.boulderRead.get(i)?.has(boulder) ?? false);
  }

  /** Distinct rock types this instrument read this mission. */
  rockTypesRead(instrument: Instrument): number {
    return this.rocksRead.get(instrument)?.size ?? 0;
  }

  /**
   * The event came while the instrument was recording: the station on the ground (deployedAt) or, with
   * no position, an instrument aboard. A station set down inside the near-lander zone earns nothing.
   * quality: how good the record was (the seismometer's clean or noisy trace). Timed records (`seconds`,
   * Mars) are counted by step() instead and never fire here.
   */
  record(instrument: Instrument, event: RecordEvent, quality?: RecordQuality, deployedAt?: Point): MilestoneUpdate {
    const u = this.empty();
    if (deployedAt && this.inZone({ x: deployedAt.x, y: 0, z: deployedAt.z }, 'near-lander')) return u;
    this.each('record', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'record' || tr.seconds !== undefined || tr.instrument !== instrument || tr.event !== event) return;
      if (tr.quality !== undefined && tr.quality !== quality) return;
      this.fire(m, u);
    });
    return u;
  }

  /**
   * A station has been set down here. Deploy milestones need their station outside the near-lander
   * zone, with Earth in view when it went down if asked (needs 'earth'), and, for a pair (near), the
   * other station on the ground too, also outside, within withinM: the pair fires when the second goes
   * down, in either order.
   */
  deploy(instrument: Instrument, at: Point, earthInView: boolean): MilestoneUpdate {
    const u = this.empty();
    const outside = !this.inZone({ x: at.x, y: 0, z: at.z }, 'near-lander');
    if (!this.stations.has(instrument)) this.stations.set(instrument, { at: { x: at.x, z: at.z }, earthInView, outside });
    this.each('deploy', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'deploy') return;
      if (tr.instrument !== instrument && tr.near?.instrument !== instrument) return;
      const station = this.stations.get(tr.instrument);
      if (!station || !station.outside || (tr.needs === 'earth' && !station.earthInView)) return;
      if (tr.near) {
        const other = this.stations.get(tr.near.instrument);
        if (!other || !other.outside) return;
        if (Math.hypot(other.at.x - station.at.x, other.at.z - station.at.z) > tr.near.withinM) return;
      }
      this.fire(m, u);
    });
    return u;
  }

  /** "Cross": left the zone on a different side from where it entered. */
  private crossed(zone: Zone, entry: Point | null, p: Point3): boolean {
    const c = zoneCenter(zone);
    if (!c || !entry) return true;
    return aroundDeg(entry, { x: p.x - c.x, z: p.z - c.z }) >= this.t.boulderCrossMinAngleDeg;
  }

  /**
   * A photograph from the rover's position. `earthInView`: Earth is above the horizon and in frame;
   * `earthLit`: the sunlit share of Earth's disc (rules/sun.ts earthLitShare). The Earth photo needs both.
   * `sun` (Mars): the Sun as the camera saw it, for the sunset photo. `framed`: the boulders inside the
   * frame, for Boulder track (the rolled boulder within boulderTrackPhotoRangeM) and Documented sample
   * (a boulder read this mission, by an instrument the milestone requires, within documentedSampleRangeM).
   * `view` (Mars): the frame test on craters' centers (Crater wall) and the dust devils in frame (Dust
   * devil). One photo can earn several. Titan: nothing counts while rain blocks photos, and a 'dune-crest'
   * photo also counts at the dune-crest viewpoint (it stands on a crest).
   */
  photo(p: Point3, earthInView: boolean, earthLit: number, sun?: SunPhoto, framed: readonly FramedBoulder[] = [], view: PhotoView = {}): MilestoneUpdate {
    const u = this.empty();
    if (this.blocked) return u;
    const zones = this.zones.filter((z) => zoneContains(z, p, this.inside.has(z.key)));
    this.each('photo', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'photo') return;
      const readBy = requiredInstruments(m);
      const counts = tr.target === 'earth' ? this.earthPhotoCounts(p, earthInView, earthLit)
        : tr.target === 'sunset' ? !!sun && this.sunsetBlocker(p, sun) === null
          : tr.target === 'rolled-boulder' ? framed.some((b) => b.rolled && this.within(p, b, this.t.boulderTrackPhotoRangeM))
            : tr.target === 'read-boulder' ? framed.some((b) => this.wasRead(b.index, readBy) && this.within(p, b, this.t.documentedSampleRangeM))
              : tr.target === 'crater-wall' ? this.craterWallCounts(p, view)
                : tr.target === 'dustdevil' ? this.dustDevilPhotoCounts(p, view)
                  : zones.some((z) => z.id === tr.zone || (tr.zone === 'dune-crest' && z.id === 'dune-crest-viewpoint'));
      if (counts) this.fire(m, u);
    });
    return u;
  }

  /**
   * The craters whose rim band holds the rover: between craterWallRimBand times a young crater's (or a
   * crater rocky area's) radius from its center. Without the Mars tuning there are none. For the HUD hint.
   */
  craterWallsNear(p: Point): Zone[] {
    const band = this.t.craterWallRimBand;
    if (!band) return [];
    const [lo, hi] = band;
    return this.zones.filter((z) => {
      if (!z.crater) return false;
      const d = Math.hypot(p.x - z.crater.x, p.z - z.crater.z);
      return d >= lo * z.crater.radiusM && d <= hi * z.crater.radiusM;
    });
  }

  /** Crater wall: the rover in a crater's rim band with that crater's center in frame. */
  private craterWallCounts(p: Point, view: PhotoView): boolean {
    const inFrame = view.groundInFrame;
    return !!inFrame && this.craterWallsNear(p).some((z) => inFrame({ x: z.crater!.x, z: z.crater!.z }));
  }

  /** Dust devil: a dust devil in frame, within dustDevilPhotoRangeM when the tuning sets it. */
  private dustDevilPhotoCounts(p: Point, view: PhotoView): boolean {
    const range = this.t.dustDevilPhotoRangeM;
    return (view.dustDevilsInFrame ?? []).some((d) => range === undefined || this.within(p, d, range));
  }

  private within(p: Point, q: Point, m: number): boolean {
    return Math.hypot(p.x - q.x, p.z - q.z) <= m;
  }

  /**
   * Why a sunset photo here would not count (null: it counts): the Sun must be in frame, setting, low
   * (sunsetMinElevationDeg to sunsetMaxElevationDeg), and the rover at least sunsetPhotoMinDistanceM from
   * the lander. Without the Mars tuning there is no sunset photo ('not-in-frame').
   */
  sunsetBlocker(p: Point, sun: SunPhoto): SunsetBlocker | null {
    const { sunsetMinElevationDeg: lo, sunsetMaxElevationDeg: hi, sunsetPhotoMinDistanceM: minM } = this.t;
    if (lo === undefined || hi === undefined || !sun.inFrame) return 'not-in-frame';
    if (!sun.setting) return 'not-setting';
    if (sun.elevationDeg > hi) return 'too-high';
    if (sun.elevationDeg < lo) return 'too-low';
    if (Math.hypot(p.x - this.landing.x, p.z - this.landing.z) < (minM ?? 0)) return 'too-close';
    return null;
  }

  /** Whether an Earth photo here would be too close to the lander to count. */
  earthPhotoTooClose(p: Point): boolean {
    return Math.hypot(p.x - this.landing.x, p.z - this.landing.z) < this.t.earthPhotoMinDistanceM;
  }

  /**
   * Whether an Earth photo counts: Earth in view, lit enough to show (not a dark new Earth), and taken
   * far enough from the lander (Earth is in view at the start, so the photo is not free).
   */
  earthPhotoCounts(p: Point, earthInView: boolean, earthLit: number): boolean {
    return earthInView && earthLit >= this.t.earthPhotoMinLit && !this.earthPhotoTooClose(p);
  }

  /** Whether a sample here would repeat an earlier sample site (closer than sampleSpacingM). */
  sampleTooClose(p: Point): boolean {
    return this.sampleSites.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < this.t.sampleSpacingM);
  }

  /**
   * A completed drill sample at the rover's position. Samples near the lander do not count. A staged
   * sample milestone (sites) counts one stage per new site, at least sampleSpacingM from earlier ones.
   */
  drill(p: Point3): MilestoneUpdate {
    const u = this.empty();
    const zones = this.zones.filter((z) => zoneContains(z, p, this.inside.has(z.key)));
    if (zones.some((z) => z.id === 'near-lander')) return u;
    const newSite = !this.sampleTooClose(p);
    if (newSite) this.sampleSites.push({ x: p.x, z: p.z });
    this.each('drill', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'drill') return;
      if (tr.zone && !zones.some((z) => z.id === tr.zone)) return;
      if (tr.sites) {
        if (newSite) this.fire(m, u, Math.min(this.sampleSites.length, tr.sites));
      } else this.fire(m, u);
    });
    return u;
  }

  /** The mission has ended. */
  finish(survived: boolean, damageBy: Partial<Record<DamageCause, number>>): MilestoneUpdate {
    const u = this.empty();
    this.each('survive', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'survive' || !survived) return;
      const except = tr.except ?? [];
      const damage = Object.entries(damageBy).reduce((s, [cause, d]) => s + (except.includes(cause as DamageCause) ? 0 : (d ?? 0)), 0);
      if (tr.condition !== 'no-damage' || damage <= 0) this.fire(m, u);
    });
    return u;
  }

  has(id: string): boolean {
    return this.earned.has(id);
  }

  /** What the mission earned, for the payout. */
  result(): EarnedMilestone[] {
    return [...this.earned].map(([id, stages]) => (stages > 1 ? { id, stages } : { id }));
  }
}
