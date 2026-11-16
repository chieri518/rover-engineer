// Milestone triggers, data-driven from data/milestones.json. Zones are built from terrain.json features
// (passed in as plain data) and sized by tuning.milestones. The mission screen feeds the tracker the
// rover's position each step, plus photo and drill actions and flare outcomes; the tracker returns the
// milestones reached. Required parts are enforced here. Mars adds its own zones (delta front, delta
// layers and sunset viewpoints, Séítah), night driving, the dust storm and the sunset photo; the Moon's
// zones, Earth photo and hydrogen signal simply never apply there. Pure: no rendering, no DOM.
import type { BusSlot, Instrument, Milestone, MilestoneTuning, Part, ReadingTarget, RecordEvent, RecordQuality } from './types';
import type { MarsMilestoneTuning, MarsViewpointKind } from './marsTypes';
import type { DamageCause } from './damage';
import { milestoneStages, type EarnedMilestone } from './payout';
import { meetsRequirements, requiredInstruments } from './rover';
import type { ResolvedSite } from './sites';

export interface Point { x: number; z: number }
export interface Point3 { x: number; y: number; z: number }

/** terrain.json features the milestone zones read: the Moon's own features are absent on Mars, and Mars's on the Moon. */
export interface MilestoneFeatures {
  landing: Point3;
  rimViewpoints?: { name: string; local: Point; lookToward: Point }[];
  rockyAreas: { name: string; local: Point; radius_m: number }[];
  shadowedCrater?: { outlineLocal_xz: [number, number][]; iceCandidate: { local: Point } };
  craterDescent?: { name: string; local: Point };
  // Mars (rules/marsTypes.ts MarsTerrainFeatures)
  deltaFront?: { name: string; scarpLocal_xz: [number, number][]; zoneRadius_m: number };
  seitah?: { name: string; outlineLocal_xz: [number, number][] };
  viewpoints?: { name: string; local: Point; kind: MarsViewpointKind }[];
}

/**
 * Every zone buildZones makes, the Moon's then Mars's (marsTypes.ts MarsZoneId); milestone triggers may
 * name only these (validate.ts checks). buildZones's own zone literals fail to typecheck if one is missing.
 */
export const ZONE_IDS = [
  'large-crater', 'boulder-field', 'shadowed-crater', 'crater-wall', 'ice-spot', 'rim-viewpoint', 'near-lander',
  // Moon sites (sites.json, rules/sites.ts): one zone per site; the ice signal is around the hidden ice spot.
  'cold-trap', 'young-crater', 'hydrogen-anomaly', 'ice-signal',
  'delta-front', 'delta-layers', 'seitah', 'sunset-viewpoint',
] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/** Zones where a photograph is of a place (its caption names the zone). */
export const PHOTO_ZONE_IDS: readonly ZoneId[] = ['rim-viewpoint', 'crater-wall', 'delta-layers', 'sunset-viewpoint'];

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
}

/** What the Moon sites' zones need beyond the terrain features: the resolved sites.json sites and the meter's ice signal. */
export interface ZoneOptions {
  sites?: readonly ResolvedSite[];
  /** The ice signal zone: where the meter's ice signal (1 at the spot, 0 at iceRangeM) reaches iceSignalShare. */
  neutron?: { iceRangeM: number; iceSignalShare: number };
}

/** The Moon sites' zones (none on Mars, which has no sites.json sites). */
function siteZones(sites: readonly ResolvedSite[], t: MilestoneTuning): Zone[] {
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
      zones.push({ id: 'young-crater', key: `young-crater:${s.id}`, ...base, shape: circle(s, s.radiusM * t.youngCraterEjectaFactor) });
    } else if (s.kind === 'hidden-hydrogen') {
      zones.push({ id: 'hydrogen-anomaly', key: `hydrogen-anomaly:${s.id}`, ...base, shape: circle(s, t.hydrogenZoneRadiusM) });
    }
  }
  return zones;
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

export function buildZones(f: MilestoneFeatures, t: MilestoneTuning, opts: ZoneOptions = {}): Zone[] {
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
  (f.viewpoints ?? []).forEach((v, i) => zones.push({
    id: v.kind === 'deltaLayers' ? 'delta-layers' : 'sunset-viewpoint', key: `viewpoint-${i}`, name: v.name,
    shape: { kind: 'circle', x: v.local.x, z: v.local.z, r: t.photoZoneRadiusM },
  }));
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
  zones.push(...siteZones(opts.sites ?? [], t));
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
  stormActive?: boolean;
  /** Standby instruments switched on now (MissionState.standbyOn): their transects count the distance driven. */
  switchedOn?: readonly Instrument[];
  /** The rover is powered down now (a flare): transects pause, neither counting nor starting again. */
  poweredDown?: boolean;
  /** Standby instruments the low-energy warning switched off (not the player), until the player switches them again: their transects pause, like a power-down, instead of starting again. */
  autoOff?: readonly Instrument[];
}

/** What a finished reading found (the X-ray spectrometer: a boulder and its rock type). */
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

/** A station on the ground. */
interface Station {
  at: Point;
  earthInView: boolean;
  outside: boolean; // set down outside the near-lander zone
}

/** A transect in progress: an unbroken switched-on drive, and the zones it has touched so far. */
interface TransectRun {
  meters: number;
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
  private readonly rocksRead = new Set<string>(); // distinct rock types read this mission
  private readonly boulderRead = new Set<number>(); // boulders read this mission
  private readonly readingSites = new Map<Instrument, Point[]>(); // where counted readings were taken, per instrument
  private readonly stations = new Map<Instrument, Station>();

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
    for (const inst of on) {
      const run = this.runs.get(inst) ?? { meters: 0, touched: new Set<string>() };
      this.runs.set(inst, run);
      run.meters += driven;
      for (const z of here) run.touched.add(z.key);
    }
  }

  /**
   * A transect counts once its unbroken drive reaches `meters` and has touched the zone anywhere on the
   * way; a staged transect (sites) counts one stage per distinct zone instance (each cold trap once).
   */
  private checkTransect(m: Milestone, tr: Extract<Milestone['trigger'], { type: 'transect' }>, u: MilestoneUpdate): void {
    const run = this.runs.get(tr.instrument);
    if (!run || run.meters < tr.meters) return;
    const keys = this.zones.filter((z) => z.id === tr.zone && run.touched.has(z.key)).map((z) => z.key);
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

  /**
   * A finished instrument reading at the rover's position (the X-ray spectrometer on a boulder). Staged
   * by distinct rock types (rocks), by a needed rock type (rock), or by site (sites, as the drill).
   */
  reading(instrument: Instrument, p: Point3, result: ReadingResult = {}): MilestoneUpdate {
    const u = this.empty();
    if (result.rock !== undefined) this.rocksRead.add(result.rock);
    if (result.boulder !== undefined) this.boulderRead.add(result.boulder);
    const sites = this.readingSites.get(instrument) ?? [];
    this.readingSites.set(instrument, sites);
    const newSite = !sites.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < this.t.sampleSpacingM);
    let siteCounted = false;
    this.each('reading', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'reading' || tr.instrument !== instrument) return;
      if (tr.zone && !this.inZone(p, tr.zone as ZoneId)) return;
      if (tr.target && tr.target !== result.target) return;
      if (tr.rock !== undefined && tr.rock !== result.rock) return;
      if (tr.rocks) return this.fire(m, u, tr.rocks.filter((n) => this.rocksRead.size >= n).length);
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

  /** Whether a boulder was read this mission (Documented sample). */
  wasRead(boulder: number): boolean {
    return this.boulderRead.has(boulder);
  }

  /**
   * The event came while the instrument was recording: the station on the ground (deployedAt) or, with
   * no position, an instrument aboard. A station set down inside the near-lander zone earns nothing.
   * quality: how good the record was (the seismometer's clean or noisy trace).
   */
  record(instrument: Instrument, event: RecordEvent, quality?: RecordQuality, deployedAt?: Point): MilestoneUpdate {
    const u = this.empty();
    if (deployedAt && this.inZone({ x: deployedAt.x, y: 0, z: deployedAt.z }, 'near-lander')) return u;
    this.each('record', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'record' || tr.instrument !== instrument || tr.event !== event) return;
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
   * (a boulder read this mission within documentedSampleRangeM). One photo can earn several.
   */
  photo(p: Point3, earthInView: boolean, earthLit: number, sun?: SunPhoto, framed: readonly FramedBoulder[] = []): MilestoneUpdate {
    const u = this.empty();
    const zones = this.zones.filter((z) => zoneContains(z, p, this.inside.has(z.key)));
    this.each('photo', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'photo') return;
      const counts = tr.target === 'earth' ? this.earthPhotoCounts(p, earthInView, earthLit)
        : tr.target === 'sunset' ? !!sun && this.sunsetBlocker(p, sun) === null
          : tr.target === 'rolled-boulder' ? framed.some((b) => b.rolled && this.within(p, b, this.t.boulderTrackPhotoRangeM))
            : tr.target === 'read-boulder' ? framed.some((b) => this.boulderRead.has(b.index) && this.within(p, b, this.t.documentedSampleRangeM))
              : zones.some((z) => z.id === tr.zone);
      if (counts) this.fire(m, u);
    });
    return u;
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
