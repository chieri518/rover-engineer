import type { GameData, Milestone, MoonPipelineFeatures, PhotoTarget, PipelineFeatureList, ReadingTarget, SiteKind } from './types';
import { ZONE_IDS } from './milestones';
import { KNOWN_WORLDS } from './payload';
import { relationshipProblems } from './relationships';
import { requiredInstruments } from './rover';
import { coldZoneAnchor, type SiteFeatures } from './sites';

const PHOTO_TARGETS: readonly PhotoTarget[] = ['earth', 'sunset', 'rolled-boulder', 'read-boulder'];
const READING_TARGETS: readonly ReadingTarget[] = ['boulder', 'cliff'];
const SITE_KINDS: readonly SiteKind[] = ['young-crater', 'rocky-area', 'cold-trap', 'rolled-boulder', 'hidden-hydrogen'];
const PIPELINE_LISTS: readonly PipelineFeatureList[] = ['coldTraps', 'youngCraters', 'boulderTrackCandidates', 'lowLightPatches'];
/** Site kinds whose boulders the X-ray spectrometer reads: each needs a rock suite. */
const SUITE_KINDS: readonly SiteKind[] = ['young-crater', 'rocky-area', 'rolled-boulder'];

/** Checks the data files for broken references and missing entries. Returns a list of problems. */
export function validateGameData(data: GameData): string[] {
  const problems: string[] = [];
  const { slots, parts } = data.parts;
  const ids = new Set<string>();
  const instrumentOnly = ['instrument', 'energyPerUse', 'standbyEnergy', 'useSeconds', 'deploy', 'shadowHoldFactor', 'coldTolerant', 'needsEarth', 'needsBoulder'] as const;
  for (const part of parts) {
    if (ids.has(part.id)) problems.push(`duplicate part id ${part.id}`);
    ids.add(part.id);
    const e = part.effects;
    if (part.slot === 'instrument') {
      if (!e.instrument) problems.push(`instrument part ${part.id} has no instrument effect`);
      // A switch (standby draw) is turned on and off: it has no use to pay for, hold still for, or deploy.
      if ((e.standbyEnergy ?? 0) > 0) {
        for (const key of ['energyPerUse', 'useSeconds', 'deploy', 'shadowHoldFactor', 'needsEarth', 'needsBoulder'] as const) {
          if (e[key]) problems.push(`instrument part ${part.id} has a standby draw, so it cannot also have ${key}`);
        }
      }
      // Setting a station down, and the boulder and Earth checks, belong to a held use (the rover stops for them).
      if (!((e.standbyEnergy ?? 0) > 0) && !((e.useSeconds ?? 0) > 0)) {
        for (const key of ['deploy', 'needsEarth', 'needsBoulder'] as const) {
          if (e[key]) problems.push(`instrument part ${part.id} has ${key}, so it needs useSeconds above 0`);
        }
      }
      if (e.shadowHoldFactor !== undefined && !(e.shadowHoldFactor > 0 && e.shadowHoldFactor <= 1)) {
        problems.push(`instrument part ${part.id} needs a shadowHoldFactor above 0 and at most 1`);
      }
    } else {
      if (!slots.includes(part.slot)) problems.push(`part ${part.id} has unknown slot ${part.slot}`);
      for (const key of instrumentOnly) if (e[key] !== undefined) problems.push(`part ${part.id} is not an instrument but has ${key}`);
    }
    for (const [key, v] of Object.entries(e)) {
      if (typeof v === 'number' && !(Number.isFinite(v) && v >= 0)) problems.push(`part ${part.id} has a negative or non-finite ${key}`);
    }
    if (part.slot === 'chassis') {
      const points = e.mountingPoints;
      if (points === undefined || !Number.isInteger(points) || points < 0) problems.push(`chassis ${part.id} needs a whole number of mountingPoints`);
    }
    for (const v of [part.cost, part.mass, part.size]) {
      if (!(Number.isFinite(v) && v >= 0)) {
        problems.push(`part ${part.id} has a negative or non-finite cost, mass or size`);
        break;
      }
    }
  }
  // Each world needs at least one part in every bus slot (this data is one world's offer).
  for (const slot of slots) {
    if (!parts.some((p) => p.slot === slot)) problems.push(`slot ${slot} has no parts on ${data.world}`);
  }
  problems.push(...catalogProblems(data));
  problems.push(...dustProblems(data));
  const allIds = new Set(data.allParts.parts.map((p) => p.id));
  for (const id of Object.keys(data.text.partText ?? {})) {
    if (!allIds.has(id)) problems.push(`text.partText names unknown part ${id}`);
  }
  const tiers = data.tiers.tiers;
  if (tiers.length === 0) problems.push('no ticket tiers');
  for (let i = 1; i < tiers.length; i++) {
    const a = tiers[i - 1]!;
    const b = tiers[i]!;
    if (b.massLimit < a.massLimit || b.sizeLimit < a.sizeLimit || b.price < a.price) {
      problems.push(`tier ${b.id} is not larger than ${a.id}`);
    }
  }
  const milestoneIds = new Set<string>();
  for (const m of data.milestones.milestones) {
    if (milestoneIds.has(m.id)) problems.push(`duplicate milestone id ${m.id}`);
    milestoneIds.add(m.id);
    for (const slot of m.requires.slots ?? []) {
      if (!slots.includes(slot)) problems.push(`milestone ${m.id} requires unknown slot ${slot}`);
    }
    for (const inst of requiredInstruments(m)) {
      if (!parts.some((p) => p.effects.instrument === inst)) problems.push(`milestone ${m.id} requires instrument ${inst}, which no part provides`);
    }
    problems.push(...triggerProblems(m, data));
  }
  problems.push(...instrumentTuningProblems(data));
  problems.push(...siteProblems(data));
  problems.push(...relationshipProblems(data.relationships, data.allParts.parts));
  const { flare, quake, duststorm } = data.events;
  if (flare && flare.realFlares.length < flare.windowsSeconds.length) {
    problems.push('events.json needs at least one real flare per flare window');
  }
  for (const [a, b] of [...(flare?.windowsSeconds ?? []), ...(quake?.windowsSeconds ?? []), ...(duststorm?.windowsSeconds ?? [])]) {
    if (!(a <= b && b <= data.tuning.mission.lengthSeconds)) problems.push(`event window [${a}, ${b}] is outside the mission`);
  }
  return problems;
}

/**
 * The catalog per world: each part's `worlds` is a non-empty list of known world ids (a part no world
 * offers would never be checked or shown), and part ids are unique across every world's parts.
 */
function catalogProblems(data: GameData): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const part of data.allParts.parts) {
    if (seen.has(part.id)) problems.push(`duplicate part id ${part.id} in the catalog`);
    seen.add(part.id);
    if (part.worlds === undefined) continue;
    if (!Array.isArray(part.worlds) || part.worlds.length === 0) problems.push(`part ${part.id} has an empty worlds list (leave it out to offer the part everywhere)`);
    else for (const w of part.worlds) if (!KNOWN_WORLDS.includes(w)) problems.push(`part ${part.id} names unknown world ${String(w)}`);
  }
  return problems;
}

/**
 * Dust on the panels and dust devils (rules/dust.ts). On a world with dust every part with solar income
 * says how fast dust settles on it (a dustRate), and only such parts have one. tuning.dust and
 * events.dustdevil hold numbers the rules can use: dust never speeds up in the storm, the floor keeps
 * some income, the lesson fires above the floor, a devil cleans no farther than it is sensed and can pass
 * that close, and every devil forms and ends inside the day.
 */
function dustProblems(data: GameData): string[] {
  const problems: string[] = [];
  const { dust, sol } = data.tuning;
  const devil = data.events.dustdevil;
  for (const part of data.parts.parts) {
    const e = part.effects;
    if (dust && (e.energyIncome ?? 0) > 0 && e.dustRate === undefined) problems.push(`part ${part.id} has solar income but no dustRate (needed on ${data.world}, which has dust)`);
    if (e.dustRate !== undefined && !((e.energyIncome ?? 0) > 0)) problems.push(`part ${part.id} has a dustRate but no solar income`);
  }
  if (dust) {
    const finite = Object.values(dust).every((v) => typeof v === 'number' && Number.isFinite(v));
    if (!finite) problems.push('tuning.dust needs finite numbers');
    if (!(dust.perSol >= 0)) problems.push('tuning.dust.perSol must not be negative');
    if (!(dust.stormMultiplier >= 1)) problems.push('tuning.dust.stormMultiplier must be at least 1 (the storm never slows dust down)');
    if (!(dust.minFactor > 0 && dust.minFactor <= 1)) problems.push('tuning.dust.minFactor must be above 0 and at most 1');
    if (!(dust.lessonLoss > 0 && dust.lessonLoss < 1 - dust.minFactor)) problems.push('tuning.dust.lessonLoss must be above 0 and below 1 - minFactor (the lesson must be reachable above the floor)');
    if (!(dust.dustDevilCleanM >= 0 && dust.dustDevilCleanM <= dust.dustDevilSenseM)) problems.push('tuning.dust needs 0 <= dustDevilCleanM <= dustDevilSenseM');
    if (devil && !(dust.dustDevilSenseM <= devil.maxPassM)) problems.push('tuning.dust.dustDevilSenseM must be at most events.dustdevil.maxPassM (or no devil could pass that close)');
  }
  if (devil) {
    const [w0, w1] = devil.daySecondsWindow;
    if (!(devil.everySols > 0)) problems.push('events.dustdevil.everySols must be above 0');
    if (!(devil.lifeSeconds > 0)) problems.push('events.dustdevil.lifeSeconds must be above 0');
    if (!(devil.speedMps >= 0)) problems.push('events.dustdevil.speedMps must not be negative');
    if (!(devil.maxPassM >= 0 && devil.rampSeconds >= 0 && devil.radiusM > 0 && devil.heightM > 0)) problems.push('events.dustdevil needs maxPassM and rampSeconds not negative, radiusM and heightM above 0');
    if (!sol) problems.push('events.dustdevil needs tuning.sol (devils form by day)');
    else if (!(w0 !== undefined && w1 !== undefined && w0 >= 0 && w0 <= w1 && w1 + devil.lifeSeconds <= sol.daySeconds)) {
      problems.push('events.dustdevil.daySecondsWindow must be a [start, end] in the day, with end + lifeSeconds at most tuning.sol.daySeconds');
    }
  }
  return problems;
}

/** tuning.instruments: finite, non-negative numbers; rock types with text and weight. */
function instrumentTuningProblems(data: GameData): string[] {
  const problems: string[] = [];
  const it = data.tuning.instruments;
  if (!(it.coldSlowdown >= 1)) problems.push('tuning.instruments.coldSlowdown must be at least 1 (the cold never speeds an instrument up)');
  const numbers: [string, number][] = [
    ['shadowSunlight', it.shadowSunlight],
    ['stationOffsetM', it.stationOffsetM],
    ['stationConfirmSeconds', it.stationConfirmSeconds],
    ...Object.entries(it.neutron).map(([k, v]) => [`neutron.${k}`, v] as [string, number]),
    ['xray.reachM', it.xray.reachM],
    ...Object.entries(it.seismometer).map(([k, v]) => [`seismometer.${k}`, v] as [string, number]),
  ];
  for (const [key, v] of numbers) if (!(Number.isFinite(v) && v >= 0)) problems.push(`tuning.instruments.${key} must be a finite number, not negative`);
  if (!(it.neutron.iceRangeM > 0)) problems.push('tuning.instruments.neutron.iceRangeM must be above 0');
  if (it.xray.rocks.length === 0 || !it.xray.rocks.some((r) => r.weight > 0)) problems.push('tuning.instruments.xray.rocks needs at least one rock with a weight above 0');
  for (const r of it.xray.rocks) {
    if (!(Number.isFinite(r.weight) && r.weight >= 0)) problems.push(`rock ${r.id} needs a finite weight, not negative`);
    if (!data.text.rocks?.[r.id]) problems.push(`rock ${r.id} has no text in text.json rocks`);
  }
  const suiteIds = new Set<string>();
  for (const suite of it.xray.suites) {
    if (suiteIds.has(suite.id)) problems.push(`duplicate rock suite ${suite.id}`);
    suiteIds.add(suite.id);
    if (!suite.rocks.some((r) => r.weight > 0)) problems.push(`rock suite ${suite.id} needs at least one rock with a weight above 0`);
    for (const r of suite.rocks) {
      if (!(Number.isFinite(r.weight) && r.weight >= 0)) problems.push(`rock ${r.id} in suite ${suite.id} needs a finite weight, not negative`);
      if (!data.text.rocks?.[r.id]) problems.push(`rock ${r.id} in suite ${suite.id} has no text in text.json rocks`);
    }
  }
  // The hidden hydrogen spot reads 40 to 50% in its zone, higher than the cold traps, and its rise
  // shows beyond the zone; the ice signal's zone is the part of the dark crater above the cold background.
  const n = it.neutron;
  const zoneM = data.tuning.milestones.hydrogenZoneRadiusM;
  if (!(n.anomalyEdge <= n.anomalyPeak && n.anomalyPeak <= 1)) problems.push('tuning.instruments.neutron needs anomalyEdge <= anomalyPeak <= 1');
  if (!(n.anomalyEdge > n.coldBackground)) problems.push('tuning.instruments.neutron.anomalyEdge must be above coldBackground (the hidden spot reads higher than the cold traps)');
  if (!(n.anomalyRangeM > zoneM)) problems.push('tuning.instruments.neutron.anomalyRangeM must be beyond tuning.milestones.hydrogenZoneRadiusM');
  if (!(n.iceSignalShare > n.coldBackground && n.iceSignalShare <= 1)) problems.push('tuning.instruments.neutron.iceSignalShare must be above coldBackground and at most 1');
  if (!(n.coldBackground > n.noiseFloor)) problems.push('tuning.instruments.neutron.coldBackground must be above noiseFloor');
  const mt = data.tuning.milestones;
  for (const key of ['coldTrapEdgeM', 'youngCraterEjectaFactor', 'boulderTrackPhotoRangeM', 'documentedSampleRangeM', 'hydrogenZoneRadiusM'] as const) {
    if (!(Number.isFinite(mt[key]) && mt[key] > 0)) problems.push(`tuning.milestones.${key} must be a finite number above 0`);
  }
  for (const part of data.parts.parts) {
    const inst = part.effects.instrument;
    if (inst && !data.text.instrumentText?.[inst]) problems.push(`instrument ${inst} has no text in text.json instrumentText`);
  }
  return problems;
}

/** The rock types the suites can find (each boulder reads one rock of its site's suite). */
function suiteRockIds(data: GameData): Set<string> {
  return new Set(data.tuning.instruments.xray.suites.flatMap((suite) => suite.rocks.map((r) => r.id)));
}

/** A milestone's trigger: zones, instruments, photo targets, rock types and stage counts that exist. */
function triggerProblems(m: Milestone, data: GameData): string[] {
  const problems: string[] = [];
  const tr = m.trigger;
  // A trigger naming an unknown zone would silently never fire.
  const zone = tr.type === 'zone' || tr.type === 'photo' || tr.type === 'drill' || tr.type === 'transect' || tr.type === 'reading' ? tr.zone : undefined;
  if (zone !== undefined && !(ZONE_IDS as readonly string[]).includes(zone)) problems.push(`milestone ${m.id} names unknown zone ${zone}`);
  if (tr.type === 'photo' && tr.target !== undefined && !PHOTO_TARGETS.includes(tr.target)) problems.push(`milestone ${m.id} names unknown photo target ${tr.target}`);
  const stages = (sites: number | undefined) => sites === undefined || (Number.isInteger(sites) && sites >= 1);
  if ((tr.type === 'drill' || tr.type === 'transect' || tr.type === 'reading') && !stages(tr.sites)) problems.push(`milestone ${m.id} needs a whole number of sites, at least 1`);
  // The instrument triggers: the instrument whose use fires them must be one the milestone requires,
  // so the desk, the missed-part notice and the debrief agree with what fires it.
  if (tr.type === 'transect' || tr.type === 'reading' || tr.type === 'record' || tr.type === 'deploy') {
    const required = requiredInstruments(m);
    const used = [tr.instrument, ...(tr.type === 'deploy' && tr.near ? [tr.near.instrument] : [])];
    for (const inst of used) {
      if (!data.parts.parts.some((p) => p.effects.instrument === inst)) problems.push(`milestone ${m.id} triggers on instrument ${inst}, which no part provides`);
      else if (!required.includes(inst)) problems.push(`milestone ${m.id} triggers on instrument ${inst} but does not require it`);
    }
  }
  if (tr.type === 'transect' && !(tr.meters > 0)) problems.push(`milestone ${m.id} needs a transect of more than 0 meters`);
  if (tr.type === 'deploy' && tr.near && !(tr.near.withinM > 0)) problems.push(`milestone ${m.id} needs near.withinM above 0`);
  if (tr.type === 'reading') {
    if (tr.target !== undefined && !READING_TARGETS.includes(tr.target)) problems.push(`milestone ${m.id} names unknown reading target ${tr.target}`);
    const rocks = suiteRockIds(data);
    if (tr.rock !== undefined && !rocks.has(tr.rock)) problems.push(`milestone ${m.id} needs rock ${tr.rock}, which no rock suite holds`);
    if (tr.rocks) {
      const ascending = tr.rocks.every((n, i) => Number.isInteger(n) && n >= 1 && (i === 0 || n > tr.rocks![i - 1]!));
      if (tr.rocks.length === 0 || !ascending) problems.push(`milestone ${m.id} needs rocks as rising whole numbers, at least 1`);
      else if (tr.rocks[tr.rocks.length - 1]! > rocks.size) problems.push(`milestone ${m.id} asks for ${tr.rocks[tr.rocks.length - 1]} rock types; the suites hold ${rocks.size}`);
    }
  }
  return problems;
}

/** sites.json on its own: ids, kinds, where each site is, rock suites and the rolled boulder's crater. */
function siteProblems(data: GameData): string[] {
  const problems: string[] = [];
  const { sites } = data.sites;
  const ids = new Set<string>();
  const suites = new Set(data.tuning.instruments.xray.suites.map((suite) => suite.id));
  for (const site of sites) {
    const at = `site ${site.id}`;
    if (ids.has(site.id)) problems.push(`duplicate site id ${site.id}`);
    ids.add(site.id);
    if (!SITE_KINDS.includes(site.kind)) problems.push(`${at} has unknown kind ${site.kind}`);
    if (site.pipeline && !PIPELINE_LISTS.includes(site.pipeline.list)) problems.push(`${at} names unknown pipeline list ${site.pipeline.list}`);
    if (!site.feature && !site.pipeline && !(site.provisional && site.local)) {
      problems.push(`${at} needs a terrain.json feature, a pipeline feature, or a provisional local position`);
    }
    if (site.local && !(Number.isFinite(site.local.x) && Number.isFinite(site.local.z))) problems.push(`${at} has a non-finite local position`);
    if (site.radiusM !== undefined && !(Number.isFinite(site.radiusM) && site.radiusM > 0)) problems.push(`${at} needs a radiusM above 0`);
    // A provisional crater or cold trap is a circle until the pipeline gives its outline or radius.
    if (site.provisional && !site.pipeline && (site.kind === 'young-crater' || site.kind === 'cold-trap') && site.radiusM === undefined) {
      problems.push(`${at} is provisional and needs a radiusM`);
    }
    if (site.rockSuite !== undefined && !suites.has(site.rockSuite)) problems.push(`${at} names unknown rock suite ${site.rockSuite}`);
    if (site.rockSuite === undefined && SUITE_KINDS.includes(site.kind)) problems.push(`${at} needs a rockSuite`);
  }
  for (const site of sites) {
    if (site.within === undefined) continue;
    const crater = sites.find((s) => s.id === site.within);
    if (!crater || crater.kind !== 'young-crater') problems.push(`site ${site.id} lies within ${site.within}, which is not a young crater in sites.json`);
  }
  return problems;
}

/**
 * The sites against the real terrain (terrain.json features, which the game loads at run time; the data
 * test checks them). A `feature` must name a terrain.json feature key or name; a `pipeline` reference
 * must name an id in its list once the pipeline has produced that list, and a site whose list is missing
 * must still be provisional. Provisional sites are accepted either way. Each cold zone in tuning.cold.zones
 * must resolve to a place: a terrain.json feature, or a cold trap in sites.json that resolves (provisional
 * ones included).
 */
export function siteTerrainProblems(data: GameData, features: Record<string, unknown> & MoonPipelineFeatures): string[] {
  const problems: string[] = [];
  const names = new Set<string>();
  for (const [key, value] of Object.entries(features)) {
    names.add(key);
    for (const item of Array.isArray(value) ? value : [value]) {
      const name = item && typeof item === 'object' ? (item as { name?: unknown }).name : undefined;
      if (typeof name === 'string') names.add(name);
    }
  }
  for (const site of data.sites.sites) {
    if (site.feature !== undefined && !names.has(site.feature)) problems.push(`site ${site.id} names terrain.json feature ${site.feature}, which does not exist`);
    if (!site.pipeline) continue;
    const list = features[site.pipeline.list];
    if (!list) {
      if (!site.provisional) problems.push(`site ${site.id} names terrain.json ${site.pipeline.list}, which the pipeline has not produced; mark it provisional`);
    } else if (!list.some((f) => f.id === site.pipeline!.id)) {
      problems.push(`site ${site.id} names ${site.pipeline.list} id ${site.pipeline.id}, which terrain.json does not have`);
    }
  }
  // Each cold zone must resolve to a place (rules/sites.ts coldZoneAnchor), or it would silently freeze nothing.
  for (const zone of data.tuning.cold.zones) {
    if (!coldZoneAnchor(zone, features as SiteFeatures, data.sites.sites)) problems.push(`cold zone ${zone} resolves to no terrain.json feature and no cold trap in sites.json`);
  }
  return problems;
}
