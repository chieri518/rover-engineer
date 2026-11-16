// Titan milestone zones and the Dune crossing rule (phase T5). Zones come from the Titan terrain.json
// features (rules/titanTypes.ts TitanTerrainFeatures, passed in as plain data): dune crests (within
// duneCrests.zoneRadius_m of a crest line), the interdune corridors (their outlines), the dune-crest
// viewpoint, the bright interdune sample patch, and the Selk ejecta field (rockyAreas[0]). rules/milestones.ts
// adds them to the shared zones and runs the triggers. Pure: no rendering, no DOM.
import type { MilestoneTuning } from './types';
import type { Zone } from './milestones';

interface Point { x: number; z: number }

/** Titan terrain.json features the milestone zones read (absent on the Moon and Mars). */
export interface TitanMilestoneFeatures {
  duneCrests?: { zoneRadius_m: number; lines: { name: string; crestLocal_xz: [number, number][] }[] };
  interdunes?: { corridors: { name: string; outlineLocal_xz: [number, number][] }[] };
  samplePatch?: { name: string; local: Point; radius_m: number };
}

/**
 * The Titan zones: one 'dune-crest' path per crest line, one 'interdune-corridor' polygon per corridor,
 * the sample patch, and the Selk ejecta field (rockyAreas[0], sized like the boulder zones). The dune-crest
 * viewpoint is built with the other viewpoints in rules/milestones.ts. Nothing on worlds without dunes.
 */
export function buildTitanZones(
  f: TitanMilestoneFeatures & { rockyAreas: { name: string; local: Point; radius_m: number }[] },
  t: MilestoneTuning,
): Zone[] {
  if (!f.duneCrests) return [];
  const zones: Zone[] = [];
  f.duneCrests.lines.forEach((line, i) => zones.push({
    id: 'dune-crest', key: `dune-crest-${i}`, name: `${line.name} crest`,
    shape: { kind: 'path', points: line.crestLocal_xz, r: f.duneCrests!.zoneRadius_m },
  }));
  (f.interdunes?.corridors ?? []).forEach((c, i) => zones.push({
    id: 'interdune-corridor', key: `interdune-corridor-${i}`, name: c.name,
    shape: { kind: 'polygon', points: c.outlineLocal_xz },
  }));
  const s = f.samplePatch;
  if (s) zones.push({ id: 'interdune-sample', key: 'interdune-sample', name: s.name, shape: { kind: 'circle', x: s.local.x, z: s.local.z, r: s.radius_m } });
  const e = f.rockyAreas[0];
  if (e) zones.push({
    id: 'ejecta-field', key: 'ejecta-field', name: e.name,
    shape: { kind: 'circle', x: e.local.x, z: e.local.z, r: e.radius_m * t.boulderCrossRadiusFactor },
  });
  return zones;
}

/**
 * Dune crossing: from one interdune corridor to a different one, having been on a dune crest since leaving
 * the first. Getting stuck for good ends the mission (rules/ground.ts), so a finished crossing was made
 * without getting stuck. Corridors can join around a dune's end, so driving around a dune does not count:
 * the crest is required.
 */
export class DuneCrossing {
  private corridor: string | null = null; // the corridor the rover was last in
  private crest = false; // on a crest since leaving it

  /** One step: the corridor zone key the rover is in (or null) and whether it is on a dune crest. True once crossed. */
  step(corridorKey: string | null, onCrest: boolean): boolean {
    if (onCrest && this.corridor !== null) this.crest = true;
    if (corridorKey === null) return false;
    const crossed = this.corridor !== null && corridorKey !== this.corridor && this.crest;
    this.corridor = corridorKey;
    this.crest = false;
    return crossed;
  }
}
