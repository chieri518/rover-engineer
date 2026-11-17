// The minimap's site checks: a small check on a discovered site once this rover has done everything it
// can do at that site (game-design.md, Minimap and exploration). Several milestones are not tied to one
// site (Fresh ejecta sample pays once anywhere, Rock collection counts types across sites, Documented
// sample is any read boulder), so "done" is defined from what the rover did at the site itself:
// - a young crater or rocky area: with the X-ray spectrometer, every rock type its boulders hold read
//   there; with the drill, a counted sample inside its ejecta ring;
// - a cold trap: surveyed (credited to Cold trap survey);
// - the rolled boulder: read (X-ray spectrometer) and in a photo within the Boulder track range (camera).
// Only instruments carried count; a rover that can do nothing at a site never shows a check there.
// Mars (step 6c) has its own rule, marsSiteDone: what each carried instrument can do at the site, once
// (a reading there, a sample, a switched-on drive through it, a photo), never every rock type.
// Pure: no rendering, no DOM.
import type { Boulder } from './boulders';
import { rockTypeFor } from './instruments';
import type { Zone } from './milestones';
import type { Instrument, InstrumentTuning, Milestone, SiteSpec } from './types';

/** What the rover has done at each site this mission, by sites.json id. */
export interface SiteProgress {
  rocksRead: Map<string, Set<string>>; // rock types read at each site's boulders
  drilled: Set<string>; // young craters and rocky areas with a counted drill sample in their ejecta ring
  photographed: Set<string>; // the rolled boulder in a photo within boulderTrackPhotoRangeM
  surveyed: Set<string>; // cold traps credited to Cold trap survey; Mars: sites a neutron drive credited (marsSitesIn)
  // Mars (step 6c), unused on the Moon:
  readings: Map<string, Set<Instrument>>; // sites where each reading instrument (organics, laser) read a boulder (or the delta cliff)
  profiled: Set<string>; // sites a radar profile credited (marsSitesIn)
}

export function emptySiteProgress(): SiteProgress {
  return { rocksRead: new Map(), drilled: new Set(), photographed: new Set(), surveyed: new Set(), readings: new Map(), profiled: new Set() };
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
 * and the rover powered up; switching off by hand ends the run; a power-down or the low-energy switch-off (`autoOff`) pauses it. Every cold trap touched
 * by a run that reaches `meters` is surveyed, including those past the milestone's last stage.
 * `here`: the cold trap site ids whose zones the rover is in after this step.
 */
export function stepSurveyRun(
  run: SurveyRun | null,
  input: { on: boolean; poweredDown: boolean; drivenM: number; here: readonly string[]; autoOff?: boolean },
  meters: number,
): { run: SurveyRun | null; surveyed: string[] } {
  if (input.poweredDown || (input.autoOff && !input.on)) return { run, surveyed: [] }; // paused, not ended
  if (!input.on) return { run: null, surveyed: [] };
  const next = run ?? { meters: 0, touched: new Set<string>() };
  next.meters += input.drivenM;
  for (const id of input.here) next.touched.add(id);
  return { run: next, surveyed: next.meters >= meters ? [...next.touched] : [] };
}

// ---------------------------------------------------------------------------------------------------
// Mars (step 6c). The check means "this rover got what this site offers": each carried instrument that
// has a milestone to gain there has done its one thing at the site. Generous: one reading per instrument
// (not every rock type: the readout's "New type: n of 6" keeps the collection going), any counted sample
// inside the site's zone, a switched-on drive that credited the site, a photo from the crater's rim.

/** What a carried instrument can do at a Mars site of this kind (the site notices' lines say the same). */
const MARS_TASKS: Record<string, Instrument[]> = {
  // Crater wall (camera, only where the site is a crater with a rim), Rock collection, Organic signals,
  // Remote reading, Buried layers (radar), Core sample.
  'young-crater': ['camera', 'xray', 'organics', 'laser', 'radar', 'drill'],
  'rocky-area': ['camera', 'xray', 'organics', 'laser', 'radar', 'drill'],
  knob: ['xray', 'organics', 'laser'],
  // Séítah core (drill), Buried layers and Hydrogen traverse (Séítah's zone).
  'seitah-edge': ['xray', 'organics', 'laser', 'drill', 'radar', 'neutron'],
  // Signs of an ancient lake, Lake organics, Rock from afar, Buried layers and Hydrogen traverse (the delta front's zone).
  'delta-foot': ['xray', 'organics', 'laser', 'drill', 'radar', 'neutron'],
  // Rare rock; Documented sample (camera, only with the X-ray spectrometer aboard: the photo of a read boulder).
  'flood-boulder': ['xray', 'camera'],
};

/** What marsSiteDone needs beyond the progress. */
export interface MarsCheckContext {
  rocks: ReadonlyMap<string, ReadonlySet<string>>; // siteRocks of the mission's boulders: a site with none gives readings nothing
  craterWalls: ReadonlySet<string>; // site ids whose young-crater zone has a crater (tracker.zones z.crater): Crater wall targets
}

/** The Mars site kinds that can show a check. */
export const MARS_CHECK_KINDS: readonly string[] = Object.keys(MARS_TASKS);

/** The instruments that have something to do at this Mars site, of those carried (empty: no check). */
export function marsSiteTasks(kind: string, siteId: string | undefined, carried: readonly Instrument[], ctx: MarsCheckContext): Instrument[] {
  if (!siteId || !(kind in MARS_TASKS)) return [];
  const boulders = (ctx.rocks.get(siteId)?.size ?? 0) > 0;
  return MARS_TASKS[kind]!.filter((i) => {
    if (!carried.includes(i)) return false;
    switch (i) {
      case 'camera':
        return kind === 'flood-boulder' ? carried.includes('xray') : ctx.craterWalls.has(siteId);
      case 'xray':
      case 'organics':
        return boulders;
      case 'laser':
        return boulders || kind === 'delta-foot'; // the delta cliff
      default:
        return true;
    }
  });
}

/** Whether a Mars site shows its check: every task marsSiteTasks lists is done. False when there is none. */
export function marsSiteDone(kind: string, siteId: string | undefined, carried: readonly Instrument[], progress: SiteProgress, ctx: MarsCheckContext): boolean {
  const tasks = marsSiteTasks(kind, siteId, carried, ctx);
  if (tasks.length === 0 || !siteId) return false;
  return tasks.every((i) => {
    switch (i) {
      case 'xray':
        return (progress.rocksRead.get(siteId)?.size ?? 0) > 0 || progress.readings.get(siteId)?.has('xray') === true;
      case 'organics':
      case 'laser':
        return progress.readings.get(siteId)?.has(i) === true;
      case 'drill':
        return progress.drilled.has(siteId);
      case 'camera':
        return progress.photographed.has(siteId);
      case 'radar':
        return progress.profiled.has(siteId);
      case 'neutron':
        return progress.surveyed.has(siteId);
      default:
        return true;
    }
  });
}

/** Record a reading at a site (Mars: organics on a boulder, laser on a boulder or the delta cliff). */
export function noteSiteReading(p: SiteProgress, siteId: string | undefined, instrument: Instrument): void {
  if (!siteId) return;
  const read = p.readings.get(siteId) ?? new Set<Instrument>();
  read.add(instrument);
  p.readings.set(siteId, read);
}

/**
 * The Mars check sites the rover's zones (tracker.currentZones()) put it in, for a counted drill sample or
 * a radar or neutron drive: a young crater's or crater rocky area's ejecta ring is its own site; Séítah
 * counts for the Séítah edge; the delta foot's zone (drill) or the delta front's (radar, neutron, whose
 * milestones count it) for the delta foot. Neutron has nothing at craters.
 */
export function marsSitesIn(zones: readonly Pick<Zone, 'id' | 'site'>[], use: 'drill' | 'radar' | 'neutron'): string[] {
  const out = new Set<string>();
  for (const z of zones) {
    if (z.id === 'young-crater' && z.site && use !== 'neutron') out.add(z.site);
    else if (z.id === 'seitah') out.add('seitah-edge');
    else if (z.id === 'delta-foot' && use === 'drill') out.add(z.site ?? 'delta-foot');
    else if (z.id === 'delta-front' && use !== 'drill') out.add('delta-foot');
  }
  return [...out];
}

/** The craters with a rim among the zones (Crater wall targets): MarsCheckContext.craterWalls. */
export function craterWallSites(zones: readonly Pick<Zone, 'id' | 'site' | 'crater'>[]): Set<string> {
  return new Set(zones.flatMap((z) => (z.id === 'young-crater' && z.crater && z.site ? [z.site] : [])));
}

/**
 * The meters of an instrument's staged transect (Buried layers: radar; Hydrogen traverse: neutron), for
 * stepSurveyRun's `meters` on Mars: the shortest such milestone. Infinity when there is none.
 */
export function stagedTransectMeters(milestones: readonly Milestone[], instrument: Instrument): number {
  return milestones.reduce((m, x) => {
    const t = x.trigger;
    return t.type === 'transect' && t.instrument === instrument && t.sites !== undefined ? Math.min(m, t.meters) : m;
  }, Infinity);
}
