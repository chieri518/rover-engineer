// The minimap's site checks: a small check on a discovered site once this rover has done everything it
// can do at that site (game-design.md, Minimap and exploration). Several milestones are not tied to one
// site (Fresh ejecta sample pays once anywhere, Rock collection counts types across sites, Documented
// sample is any read boulder), so "done" is defined from what the rover did at the site itself:
// - a young crater or rocky area: with the X-ray spectrometer, every rock type its boulders hold read
//   there; with the drill, a counted sample inside its ejecta ring;
// - a cold trap: surveyed (credited to Cold trap survey);
// - the rolled boulder: read (X-ray spectrometer) and in a photo within the Boulder track range (camera).
// Only instruments carried count; a rover that can do nothing at a site never shows a check there.
// Pure: no rendering, no DOM.
import type { Boulder } from './boulders';
import { rockTypeFor } from './instruments';
import type { Instrument, InstrumentTuning, SiteSpec } from './types';

/** What the rover has done at each site this mission, by sites.json id. */
export interface SiteProgress {
  rocksRead: Map<string, Set<string>>; // rock types read at each site's boulders
  drilled: Set<string>; // young craters and rocky areas with a counted drill sample in their ejecta ring
  photographed: Set<string>; // the rolled boulder in a photo within boulderTrackPhotoRangeM
  surveyed: Set<string>; // cold traps credited to Cold trap survey
}

export function emptySiteProgress(): SiteProgress {
  return { rocksRead: new Map(), drilled: new Set(), photographed: new Set(), surveyed: new Set() };
}

/** Record an X-ray reading of a boulder: its rock type counts at the boulder's site. */
export function noteReading(p: SiteProgress, boulder: Boulder, rock: string): void {
  if (!boulder.site) return;
  const read = p.rocksRead.get(boulder.site) ?? new Set<string>();
  read.add(rock);
  p.rocksRead.set(boulder.site, read);
}

/** The rock types each site's boulders hold: what X-ray readings there can find. */
export function siteRocks(boulders: readonly Boulder[], t: InstrumentTuning['xray'], sites: readonly SiteSpec[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const b of boulders) {
    if (!b.site) continue;
    const rocks = out.get(b.site) ?? new Set<string>();
    rocks.add(rockTypeFor(b, t, sites));
    out.set(b.site, rocks);
  }
  return out;
}

/** The site kinds that can show a check (the minimap's survey kinds). */
type CheckKind = 'young-crater' | 'rocky-area' | 'cold-trap' | 'rolled-boulder';

/** What a carried instrument can do at a site of this kind, for its check. */
const TASKS: Record<CheckKind, Instrument[]> = {
  'young-crater': ['xray', 'drill'],
  'rocky-area': ['xray', 'drill'],
  'cold-trap': ['neutron'],
  'rolled-boulder': ['xray', 'camera'],
};

/**
 * Whether a site shows its check: every carried instrument that can act there has done so. False for a
 * site with no sites.json id, for kinds without a check, and when no carried instrument can act there.
 * `rocks`: siteRocks of the mission's boulders.
 */
export function siteDone(
  kind: string,
  siteId: string | undefined,
  carried: readonly Instrument[],
  progress: SiteProgress,
  rocks: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  if (!siteId || !(kind in TASKS)) return false;
  const present = rocks.get(siteId);
  // A site with no boulders gives the X-ray spectrometer nothing to do there.
  const tasks = TASKS[kind as CheckKind].filter((i) => carried.includes(i) && (i !== 'xray' || (present?.size ?? 0) > 0));
  if (tasks.length === 0) return false;
  return tasks.every((i) => {
    switch (i) {
      case 'xray': {
        const read = progress.rocksRead.get(siteId);
        return [...present!].every((r) => read?.has(r));
      }
      case 'drill':
        return progress.drilled.has(siteId);
      case 'camera':
        return progress.photographed.has(siteId);
      case 'neutron':
        return progress.surveyed.has(siteId);
      default:
        return true;
    }
  });
}

/** An unbroken switched-on drive of the neutron spectrometer, and the cold traps it has touched. */
export interface SurveyRun {
  meters: number;
  touched: Set<string>; // cold trap site ids
}

/**
 * One mission step of the cold trap survey, for the checks. It mirrors MilestoneTracker's staged
 * transect (rules/milestones.ts checkTransect): the meters count while the spectrometer is switched on
 * and the rover powered up; switching off ends the run; a power-down pauses it. Every cold trap touched
 * by a run that reaches `meters` is surveyed, including those past the milestone's last stage.
 * `here`: the cold trap site ids whose zones the rover is in after this step.
 */
export function stepSurveyRun(
  run: SurveyRun | null,
  input: { on: boolean; poweredDown: boolean; drivenM: number; here: readonly string[] },
  meters: number,
): { run: SurveyRun | null; surveyed: string[] } {
  if (input.poweredDown) return { run, surveyed: [] };
  if (!input.on) return { run: null, surveyed: [] };
  const next = run ?? { meters: 0, touched: new Set<string>() };
  next.meters += input.drivenM;
  for (const id of input.here) next.touched.add(id);
  return { run: next, surveyed: next.meters >= meters ? [...next.touched] : [] };
}
