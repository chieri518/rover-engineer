// Milestone triggers, data-driven from data/milestones.json. Zones are built from terrain.json features
// (passed in as plain data) and sized by tuning.milestones. The mission screen feeds the tracker the
// rover's position each step, plus photo and drill actions and flare outcomes; the tracker returns the
// milestones reached. Required parts are enforced here. Pure: no rendering, no DOM.
import type { Milestone, MilestoneTuning, Part, Slot } from './types';
import type { EarnedMilestone } from './payout';
import { meetsRequirements } from './rover';

export interface Point { x: number; z: number }
export interface Point3 { x: number; y: number; z: number }

/** The terrain.json features the milestones use. */
export interface MilestoneFeatures {
  landing: Point3;
  rimViewpoints: { name: string; local: Point; lookToward: Point }[];
  rockyAreas: { name: string; local: Point; radius_m: number }[];
  shadowedCrater: { outlineLocal_xz: [number, number][]; iceCandidate: { local: Point } };
  craterDescent: { name: string; local: Point };
}

/** Zone ids that milestones.json triggers refer to. */
export type ZoneId = 'large-crater' | 'boulder-field' | 'shadowed-crater' | 'crater-wall' | 'ice-spot' | 'rim-viewpoint';

export type ZoneShape =
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'polygon'; points: [number, number][] }
  /** Below a height, on one side of a line: in when y < enterBelowY, out again once y > exitAboveY. */
  | { kind: 'below'; enterBelowY: number; exitAboveY: number; origin: Point; normal: Point };

export interface Zone {
  id: ZoneId;
  key: string; // unique per zone instance
  name: string; // for photo captions and hints
  shape: ZoneShape;
}

export function buildZones(f: MilestoneFeatures, t: MilestoneTuning): Zone[] {
  const zones: Zone[] = [];
  f.rimViewpoints.forEach((v, i) => zones.push({
    id: 'rim-viewpoint', key: `rim-viewpoint-${i}`, name: v.name,
    shape: { kind: 'circle', x: v.local.x, z: v.local.z, r: t.photoZoneRadiusM },
  }));
  zones.push({
    id: 'crater-wall', key: 'crater-wall', name: f.craterDescent.name,
    shape: { kind: 'circle', x: f.craterDescent.local.x, z: f.craterDescent.local.z, r: t.photoZoneRadiusM },
  });
  f.rockyAreas.forEach((a, i) => zones.push({
    id: 'boulder-field', key: `boulder-field-${i}`, name: a.name,
    shape: { kind: 'circle', x: a.local.x, z: a.local.z, r: a.radius_m * t.boulderCrossRadiusFactor },
  }));
  zones.push({
    id: 'shadowed-crater', key: 'shadowed-crater', name: 'Shadowed crater',
    shape: { kind: 'polygon', points: f.shadowedCrater.outlineLocal_xz },
  });
  const ice = f.shadowedCrater.iceCandidate.local;
  zones.push({ id: 'ice-spot', key: 'ice-spot', name: 'Ice candidate', shape: { kind: 'circle', x: ice.x, z: ice.z, r: t.iceSpotRadiusM } });
  // de Gerlache's inner wall: the side of the rim the viewpoints look toward (the north flank, toward the
  // dark crater, also drops far below the landing point and must not count).
  const toward = f.rimViewpoints[0]?.lookToward ?? { x: 0, z: 1 };
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

export function zoneContains(zone: Zone, p: Point3, wasInside = false): boolean {
  const s = zone.shape;
  switch (s.kind) {
    case 'circle':
      return (p.x - s.x) ** 2 + (p.z - s.z) ** 2 <= s.r * s.r;
    case 'polygon':
      return inPolygon(s.points, p.x, p.z);
    case 'below': {
      const side = (p.x - s.origin.x) * s.normal.x + (p.z - s.origin.z) * s.normal.z > 0;
      return side && p.y < (wasInside ? s.exitAboveY : s.enterBelowY);
    }
  }
}

function zoneCenter(zone: Zone): Point | null {
  return zone.shape.kind === 'circle' ? { x: zone.shape.x, z: zone.shape.z } : null;
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
  missing: (Slot | 'camera' | 'drill')[];
}

export interface MilestoneUpdate {
  reached: Reached[];
  missed: Missed[];
}

export interface StepInput {
  position: Point3; // the rover; y is the ground height under it
  distanceM: number; // total distance driven this mission
  exploredShare: number; // share of the map explored (rules/explore.ts)
  flareSurvived?: boolean; // a flare struck this step and the rover was protected
}

function missingParts(parts: Part[], m: Milestone): Missed['missing'] {
  const missing: Missed['missing'] = [];
  for (const slot of m.requires.slots ?? []) {
    if (!meetsRequirements(parts, { ...m, requires: { slots: [slot] } })) missing.push(slot);
  }
  const inst = m.requires.instrument;
  if (inst && !parts.some((p) => p.effects.instrument === inst)) missing.push(inst);
  return missing;
}

export class MilestoneTracker {
  private readonly earned = new Map<string, number>(); // id → stages reached
  private readonly inside = new Map<string, Point | null>(); // zone key → where it was entered
  private readonly missedOnce = new Set<string>();

  constructor(
    private readonly catalog: Milestone[],
    private readonly parts: Part[],
    readonly zones: Zone[],
    private readonly t: MilestoneTuning,
  ) {}

  /** Whether this rover is equipped to earn the milestone at all. */
  eligible(m: Milestone): boolean {
    return meetsRequirements(this.parts, m);
  }

  private fire(m: Milestone, update: MilestoneUpdate, stagesNow = 1): void {
    const stages = m.trigger.type === 'distance' ? m.trigger.meters.length : 1;
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
    return { reached: [], missed: [] };
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

  step(input: StepInput): MilestoneUpdate {
    const u = this.empty();
    const p = input.position;
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
        }
      } else if (tr.type === 'event') {
        if (tr.event === 'flare' && input.flareSurvived) this.fire(m, u);
      }
    }
    return u;
  }

  /** "Cross": left the zone on a different side from where it entered. */
  private crossed(zone: Zone, entry: Point | null, p: Point3): boolean {
    const c = zoneCenter(zone);
    if (!c || !entry) return true;
    const exit = { x: p.x - c.x, z: p.z - c.z };
    const cos = (entry.x * exit.x + entry.z * exit.z) / (Math.hypot(entry.x, entry.z) * Math.hypot(exit.x, exit.z) || 1);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI) >= this.t.boulderCrossMinAngleDeg;
  }

  /** A photograph from the rover's position. `earthInView`: Earth is above the horizon and in frame. */
  photo(p: Point3, earthInView: boolean): MilestoneUpdate {
    const u = this.empty();
    const zones = this.zones.filter((z) => zoneContains(z, p, this.inside.has(z.key)));
    this.each('photo', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'photo') return;
      if (tr.target === 'earth' ? earthInView : zones.some((z) => z.id === tr.zone)) this.fire(m, u);
    });
    return u;
  }

  /** A completed drill sample at the rover's position. */
  drill(p: Point3): MilestoneUpdate {
    const u = this.empty();
    const zones = this.zones.filter((z) => zoneContains(z, p, this.inside.has(z.key)));
    this.each('drill', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'drill') return;
      if (!tr.zone || zones.some((z) => z.id === tr.zone)) this.fire(m, u);
    });
    return u;
  }

  /** The mission has ended. */
  finish(survived: boolean, damage: number): MilestoneUpdate {
    const u = this.empty();
    this.each('survive', (m) => {
      const tr = m.trigger;
      if (tr.type !== 'survive' || !survived) return;
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
