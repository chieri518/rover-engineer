import type { GameData, Milestone, MoonPipelineFeatures, PhotoTarget, PipelineFeatureList, ReadingTarget, RecordEvent, SiteKind, SupportSlot } from './types';
import { MARS_ROCK_IDS, MARS_ZONE_IDS } from './marsTypes';
import { ZONE_IDS } from './milestones';
import { KNOWN_WORLDS } from './payload';
import { relationshipProblems } from './relationships';
import { requiredInstruments } from './rover';
import { coldZoneAnchor, type SiteFeatures } from './sites';

const PHOTO_TARGETS: readonly PhotoTarget[] = ['earth', 'sunset', 'rolled-boulder', 'read-boulder', 'crater-wall', 'dustdevil'];
const RECORD_EVENTS: readonly RecordEvent[] = ['quake', 'duststorm', 'night', 'dustdevil'];
const READING_TARGETS: readonly ReadingTarget[] = ['boulder', 'cliff'];
const SUPPORT_SLOTS: readonly SupportSlot[] = ['arm', 'mast'];
const SITE_KINDS: readonly SiteKind[] = [
  'young-crater', 'rocky-area', 'cold-trap', 'rolled-boulder', 'hidden-hydrogen', 'knob', 'seitah-edge', 'delta-foot', 'flood-boulder',
];
const PIPELINE_LISTS: readonly PipelineFeatureList[] = ['coldTraps', 'youngCraters', 'boulderTrackCandidates', 'lowLightPatches'];
/** Site kinds whose boulders the X-ray spectrometer reads: each needs a rock suite. */
const SUITE_KINDS: readonly SiteKind[] = ['young-crater', 'rocky-area', 'rolled-boulder', 'knob', 'seitah-edge', 'delta-foot', 'flood-boulder'];

/** The zone ids a world's milestone triggers may name: Mars's own list (marsTypes.ts), else every zone buildZones makes. */
function worldZoneIds(data: GameData): readonly string[] {
  return data.world === 'mars' ? MARS_ZONE_IDS : ZONE_IDS;
}

/** Checks the data files for broken references and missing entries. Returns a list of problems. */
export function validateGameData(data: GameData): string[] {
  const problems: string[] = [];
  const { slots, parts } = data.parts;
  const supportSlots = data.parts.supportSlots ?? [];
  const ids = new Set<string>();
  const instrumentOnly = ['instrument', 'energyPerUse', 'standbyEnergy', 'useSeconds', 'deploy', 'shadowHoldFactor', 'coldTolerant', 'needsEarth', 'needsBoulder', 'needs'] as const;
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
      if (!(slots as string[]).includes(part.slot) && !(supportSlots as string[]).includes(part.slot)) problems.push(`part ${part.id} has unknown slot ${part.slot}`);
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
  problems.push(...supportProblems(data));
  problems.push(...powerProblems(data));
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
 * Support hardware (Mars M5, M6): the world's support slots are known and listed once, each has at least
 * one part on this world, only an arm-slot part is an arm (and only a mast-slot part a mast), and every
 * instrument's `needs` names a support slot this world offers, with a part there that provides it (or the
 * instrument could never be carried).
 */
function supportProblems(data: GameData): string[] {
  const problems: string[] = [];
  const offered = data.parts.supportSlots ?? [];
  const parts = data.parts.parts;
  offered.forEach((slot, i) => {
    if (!SUPPORT_SLOTS.includes(slot)) problems.push(`parts.supportSlots names unknown support slot ${String(slot)}`);
    else if (offered.indexOf(slot) !== i) problems.push(`parts.supportSlots lists ${slot} twice`);
    else if (!parts.some((p) => p.slot === slot)) problems.push(`support slot ${slot} has no parts on ${data.world}`);
  });
  for (const part of parts) {
    for (const slot of SUPPORT_SLOTS) {
      const v = part.effects[slot];
      if (v !== undefined && typeof v !== 'boolean') problems.push(`part ${part.id} needs ${slot} to be true or false`);
      if (v && part.slot !== slot) problems.push(`part ${part.id} has ${slot} but is not in the ${slot} slot`);
    }
    const needs = part.effects.needs;
    if (needs === undefined) continue;
    if (!Array.isArray(needs)) {
      problems.push(`part ${part.id} needs a list of support slots in needs`);
      continue;
    }
    for (const need of needs) {
      if (!SUPPORT_SLOTS.includes(need)) problems.push(`part ${part.id} needs unknown support slot ${String(need)}`);
      else if (!offered.includes(need)) problems.push(`part ${part.id} needs the ${need}, which ${data.world} does not offer`);
      else if (!parts.some((p) => p.slot === need && p.effects[need])) problems.push(`part ${part.id} needs the ${need}, but no ${need} part on ${data.world} provides it`);
    }
  }
  return problems;
}

/**
 * The power the parts own (Mars M1; rules/energy.ts partPower): lightsDraw, heaterDraw and steadyIncome
 * are finite numbers, not negative, and an electric heater (heaterDraw above 0) gives heat, or its draw
 * would buy nothing.
 */
function powerProblems(data: GameData): string[] {
  const problems: string[] = [];
  for (const part of data.parts.parts) {
    const e = part.effects;
    for (const key of ['lightsDraw', 'heaterDraw', 'steadyIncome'] as const) {
      const v: unknown = e[key];
      if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) problems.push(`part ${part.id} needs ${key} to be a finite number, not negative`);
    }
    if ((e.heaterDraw ?? 0) > 0 && !((e.heat ?? 0) > 0)) problems.push(`part ${part.id} has a heaterDraw but no heat`);
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
  const { dust, sol, night } = data.tuning;
  const devil = data.events.dustdevil;
  // The energy step reads tuning.dust on every world with a night (Mars) or dust devils.
  if (!dust && (night || devil)) problems.push(`tuning.dust is needed on ${data.world}, which has ${night ? 'a night' : 'dust devils'}`);
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
    ...Object.entries(it.neutron).filter(([k]) => k !== 'unitReadings').map(([k, v]) => [`neutron.${k}`, v as number] as [string, number]),
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
  // Mars: unit readings by zone (above the floor, below the hidden ground's edge, so the hydrated ground still stands out).
  for (const [zone, v] of Object.entries(n.unitReadings ?? {})) {
    if (!worldZoneIds(data).includes(zone)) problems.push(`tuning.instruments.neutron.unitReadings names unknown zone ${zone}`);
    if (!(v > n.noiseFloor && v < n.anomalyEdge)) problems.push(`tuning.instruments.neutron.unitReadings.${zone} must be above noiseFloor and below anomalyEdge`);
  }
  if (!(n.noiseFloor + (n.rtgFloorRise ?? 0) <= 1)) problems.push('tuning.instruments.neutron: noiseFloor + rtgFloorRise must be at most 1');
  const mt = data.tuning.milestones;
  for (const key of ['coldTrapEdgeM', 'youngCraterEjectaFactor', 'boulderTrackPhotoRangeM', 'documentedSampleRangeM', 'hydrogenZoneRadiusM'] as const) {
    if (!(Number.isFinite(mt[key]) && mt[key] > 0)) problems.push(`tuning.milestones.${key} must be a finite number above 0`);
  }
  // Mars sites (Mars step 4b): the delta-foot zone and the Crater wall band.
  if (mt.deltaFootRadiusM !== undefined && !(Number.isFinite(mt.deltaFootRadiusM) && mt.deltaFootRadiusM > 0)) problems.push('tuning.milestones.deltaFootRadiusM must be a finite number above 0');
  if (mt.craterWallRimBand !== undefined) {
    const [lo, hi] = mt.craterWallRimBand;
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo! > 0 && lo! < hi!)) problems.push('tuning.milestones.craterWallRimBand must be [low, high] with 0 < low < high');
  }
  problems.push(...rockIdProblems(data));
  problems.push(...boulderTuningProblems(data));
  for (const part of data.parts.parts) {
    const inst = part.effects.instrument;
    if (inst && !data.text.instrumentText?.[inst]) problems.push(`instrument ${inst} has no text in text.json instrumentText`);
  }
  problems.push(...marsInstrumentProblems(data));
  return problems;
}

/**
 * The Mars instruments' tuning (Mars step 4a), where a world has it: finite numbers in range, the arm's
 * slope limit below the steep-slope warning (so the arm lesson has drivable ground to happen on), radar
 * layers on known zones with text, and held uses charged as they run that are held uses.
 */
function marsInstrumentProblems(data: GameData): string[] {
  const problems: string[] = [];
  const it = data.tuning.instruments;
  const positive = (key: string, v: number) => {
    if (!(Number.isFinite(v) && v > 0)) problems.push(`tuning.instruments.${key} must be a finite number above 0`);
  };
  if (it.arm) {
    positive('arm.slopeLimitDeg', it.arm.slopeLimitDeg);
    if (!(it.arm.slopeLimitDeg < data.tuning.ground.slopeWarningDegrees)) problems.push('tuning.instruments.arm.slopeLimitDeg must be below tuning.ground.slopeWarningDegrees (drivable ground the arm refuses)');
  }
  if (it.mast && !(Number.isFinite(it.mast.photoRangeFactor) && it.mast.photoRangeFactor >= 1)) problems.push('tuning.instruments.mast.photoRangeFactor must be at least 1');
  if (it.weather) {
    const w = it.weather;
    for (const key of ['stormEarlyWarningSeconds', 'pressurePa', 'trendSeconds'] as const) positive(`weather.${key}`, w[key]);
    for (const key of ['warmupSeconds', 'pressureDailySwing', 'clearTau', 'forecastHazeTau', 'pressureTrendPa', 'dustTrendTau'] as const) {
      if (!(Number.isFinite(w[key]) && w[key] >= 0)) problems.push(`tuning.instruments.weather.${key} must be a finite number, not negative`);
    }
    if (!(w.pressureDailySwing < 1)) problems.push('tuning.instruments.weather.pressureDailySwing must be below 1');
    if (!(w.pressurePeakHour >= 0 && w.pressurePeakHour < 24)) problems.push('tuning.instruments.weather.pressurePeakHour must be an hour, 0 to 24');
    if (!(w.stormTau >= w.clearTau + w.forecastHazeTau)) problems.push('tuning.instruments.weather.stormTau must be at least clearTau + forecastHazeTau (the storm reads dustier than the haze ahead of it)');
  }
  if (it.radar) {
    const r = it.radar;
    for (const key of ['columnM', 'turnBreakDeg', 'stopBreakSeconds', 'columns'] as const) positive(`radar.${key}`, r[key]);
    const names = data.text.instrumentText?.radar?.layers;
    for (const l of r.layers) {
      if (!(ZONE_IDS as readonly string[]).includes(l.zone)) problems.push(`tuning.instruments.radar.layers names unknown zone ${l.zone}`);
    }
    for (const kind of new Set([r.defaultLayer, ...r.layers.map((l) => l.kind)])) {
      if (!names?.[kind]) problems.push(`radar layer ${kind} has no text in instrumentText.radar.layers`);
    }
  }
  if (it.laser) {
    positive('laser.reachM', it.laser.reachM);
    if (!(it.laser.coneDeg > 0 && it.laser.coneDeg < 90)) problems.push('tuning.instruments.laser.coneDeg must be above 0 and below 90');
  }
  for (const inst of it.chargedWhileHeld ?? []) {
    const part = data.parts.parts.find((p) => p.effects.instrument === inst);
    if (part && !((part.effects.useSeconds ?? 0) > 0)) problems.push(`tuning.instruments.chargedWhileHeld: ${inst} has no held use to charge`);
  }
  return problems;
}

/** On Mars every rock a suite or the fallback list names is a Mars rock type (no Moon rock reaches Mars). */
function rockIdProblems(data: GameData): string[] {
  if (data.world !== 'mars') return [];
  const { rocks, suites } = data.tuning.instruments.xray;
  const ids = [...rocks.map((r) => r.id), ...suites.flatMap((suite) => suite.rocks.map((r) => r.id))];
  return [...new Set(ids)].filter((id) => !(MARS_ROCK_IDS as readonly string[]).includes(id)).map((id) => `rock ${id} is not a Mars rock type (marsTypes.ts MARS_ROCK_IDS)`);
}

/** Boulder counts by site kind and site (Mars sites): whole numbers on known kinds and sites; the slope-target share a share. */
function boulderTuningProblems(data: GameData): string[] {
  const problems: string[] = [];
  const b = data.tuning.boulders;
  const count = (v: number | undefined) => v !== undefined && Number.isInteger(v) && v >= 0;
  for (const [kind, v] of Object.entries(b.perSiteKind ?? {})) {
    if (!SITE_KINDS.includes(kind as SiteKind)) problems.push(`tuning.boulders.perSiteKind names unknown site kind ${kind}`);
    if (!count(v)) problems.push(`tuning.boulders.perSiteKind.${kind} must be a whole number, not negative`);
  }
  for (const [id, v] of Object.entries(b.perSite ?? {})) {
    if (!data.sites.sites.some((s) => s.id === id)) problems.push(`tuning.boulders.perSite names unknown site ${id}`);
    if (!count(v)) problems.push(`tuning.boulders.perSite.${id} must be a whole number, not negative`);
  }
  if (b.floodBoulderDiameterM !== undefined && !(b.floodBoulderDiameterM > 0)) problems.push('tuning.boulders.floodBoulderDiameterM must be above 0');
  if (b.slopeTargetShare !== undefined && !(b.slopeTargetShare >= 0 && b.slopeTargetShare <= 1)) problems.push('tuning.boulders.slopeTargetShare must be a share, 0 to 1');
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
  // A trigger naming an unknown zone would silently never fire. Zones are checked per world (Mars: marsTypes.ts MARS_ZONE_IDS).
  const zone = tr.type === 'zone' || tr.type === 'photo' || tr.type === 'drill' || tr.type === 'transect' || tr.type === 'reading' ? tr.zone : undefined;
  const zones = [...(zone !== undefined ? [zone] : []), ...(tr.type === 'transect' ? tr.zones ?? [] : [])];
  for (const z of zones) if (!worldZoneIds(data).includes(z)) problems.push(`milestone ${m.id} names unknown zone ${z}`);
  if (tr.type === 'transect' && tr.zones !== undefined && (tr.zone !== undefined || tr.zones.length === 0)) {
    problems.push(`milestone ${m.id} needs either one zone or a non-empty zones list, not both`);
  }
  if (tr.type === 'photo' && tr.target !== undefined && !PHOTO_TARGETS.includes(tr.target)) problems.push(`milestone ${m.id} names unknown photo target ${tr.target}`);
  if (tr.type === 'record') {
    if (!RECORD_EVENTS.includes(tr.event)) problems.push(`milestone ${m.id} waits for unknown event ${String(tr.event)}`);
    if (tr.seconds !== undefined && !(Number.isFinite(tr.seconds) && tr.seconds >= 0)) problems.push(`milestone ${m.id} needs record seconds as a finite number, not negative`);
  }
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
    if (!site.feature && !site.pipeline && !((site.provisional || site.terrain) && site.local)) {
      problems.push(`${at} needs a terrain.json feature, a pipeline feature, or a provisional local position`);
    }
    if (site.terrain !== undefined && !site.local) problems.push(`${at} names terrain.json ${site.terrain} but has no local stand-in`);
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

/** How far a site's local stand-in may lie from the terrain.json feature it copies (`terrain`). */
const TERRAIN_MATCH_M = 1;

/** A terrain.json feature by dotted path from `features`; in a list, the next segment is an item's id. */
export function terrainPath(features: Record<string, unknown>, path: string): unknown {
  let at: unknown = features;
  for (const key of path.split('.')) {
    if (Array.isArray(at)) at = at.find((item) => item && typeof item === 'object' && (item as { id?: unknown }).id === key);
    else if (at && typeof at === 'object') at = (at as Record<string, unknown>)[key];
    else return undefined;
    if (at === undefined || at === null) return undefined;
  }
  return at;
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
    if (site.terrain !== undefined) {
      // A local stand-in copied from a terrain.json feature: the feature exists and, where it has a position, still matches.
      const f = terrainPath(features, site.terrain);
      if (f === undefined) problems.push(`site ${site.id} names terrain.json ${site.terrain}, which does not exist`);
      const at = f && typeof f === 'object' ? (f as { local?: { x?: unknown; z?: unknown } }).local : undefined;
      if (at && typeof at.x === 'number' && typeof at.z === 'number' && site.local && Math.hypot(at.x - site.local.x, at.z - site.local.z) > TERRAIN_MATCH_M) {
        problems.push(`site ${site.id}'s local (${site.local.x}, ${site.local.z}) no longer matches terrain.json ${site.terrain} (${at.x}, ${at.z})`);
      }
    }
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
