// The payload bay (game-design.md, "Payload: instruments and systems"): the chassis sets its mounting
// points, and the bay holds instruments (any mix, one of each, in the order fitted: the mission keys) and
// payload systems (the lights, one heater, and where the world offers them the arm and the mast). Each
// item takes one mounting point. Leaving an item off is just not fitting it. Pure.
//
// The desk's API: systemSlotsOf / bayParts (what the bay offers), isFitted / fittedSystems / pointsUsed /
// bayCapacity (what is in it), fitRefusal (why an item cannot go in now), toggleBayPart (fit or take off,
// the heater swap included) and fitBayToChassis (a chassis change drops instruments fitted last).
import type { DraftBuild, Instrument, MilestonesFile, MissionId, Part, PartsFile, SupportSlot, SystemSlot } from './types';
import { providesCapability, requiredInstruments, slotPartId, supportSlotsOf, SYSTEM_BUS_SLOTS, withSlotPart } from './rover';

export type PayloadProblem =
  | { kind: 'unknown'; id: string } // no part with this id
  | { kind: 'not-instrument'; id: string } // the part is not an instrument
  | { kind: 'duplicate'; id: string } // a second part giving an instrument already in the bay
  | { kind: 'over-capacity'; count: number; points: number } // more payload items (instruments + fitted systems) than mounting points
  | { kind: 'needs'; id: string; support: SupportSlot }; // an instrument whose support hardware the build lacks (Mars: the arm, the mast)

/** The bay's mounting points, from the chassis among these parts; 0 without a chassis. */
export function mountingPoints(parts: Part[]): number {
  return parts.find((p) => p.slot === 'chassis')?.effects.mountingPoints ?? 0;
}

// --- Payload systems ---

/** The payload system slots a world offers, in desk order: lights, heater, then its support slots (Mars: arm, mast). */
export function systemSlotsOf(catalog: PartsFile): SystemSlot[] {
  return [...SYSTEM_BUS_SLOTS.filter((slot) => catalog.slots.includes(slot)), ...supportSlotsOf(catalog)];
}

/** Is this part a payload system the desk can fit (it provides its system; "No lights" and the like are not)? */
export function isSystemPart(part: Part, catalog: PartsFile): boolean {
  return (systemSlotsOf(catalog) as string[]).includes(part.slot) && providesCapability(part);
}

/**
 * Everything the payload bay offers on this catalog's world, in catalog order: the system parts that
 * provide something, then the instruments. The "None" parts are never offered.
 */
export function bayParts(catalog: PartsFile): Part[] {
  return [...catalog.parts.filter((p) => isSystemPart(p, catalog)), ...catalog.parts.filter((p) => p.slot === 'instrument')];
}

/** The part fitted in a system slot, or undefined when the slot is empty or holds a part that provides nothing. */
export function fittedSystem(build: DraftBuild, slot: SystemSlot, catalog: PartsFile): Part | undefined {
  const id = slotPartId(build, slot);
  const part = id ? catalog.parts.find((p) => p.id === id && p.slot === slot) : undefined;
  return part && providesCapability(part) ? part : undefined;
}

/** The fitted payload systems, in desk order (systemSlotsOf). */
export function fittedSystems(build: DraftBuild, catalog: PartsFile): Part[] {
  return systemSlotsOf(catalog).flatMap((slot) => fittedSystem(build, slot, catalog) ?? []);
}

/** Is this part in the build's payload: an instrument in the bay, or a fitted system? */
export function isFitted(build: DraftBuild, partId: string, catalog: PartsFile): boolean {
  const part = catalog.parts.find((p) => p.id === partId);
  if (!part) return false;
  if (part.slot === 'instrument') return (build.payload ?? []).includes(partId);
  return (systemSlotsOf(catalog) as string[]).includes(part.slot) && fittedSystem(build, part.slot as SystemSlot, catalog)?.id === partId;
}

/** Mounting points the payload uses: one per instrument in the bay and one per fitted system. */
export function pointsUsed(build: DraftBuild, catalog: PartsFile): number {
  return (build.payload ?? []).length + fittedSystems(build, catalog).length;
}

/**
 * The bay's mounting points for fitting: the chassis's, or before a chassis is chosen the roomiest
 * chassis's (choosing a smaller one then drops instruments, see fitBayToChassis). `chassis` is false
 * when no chassis is chosen yet.
 */
export function bayCapacity(build: DraftBuild, catalog: PartsFile): { points: number; chassis: boolean } {
  const chassis = build.chassis ? catalog.parts.find((p) => p.id === build.chassis && p.slot === 'chassis') : undefined;
  if (chassis) return { points: mountingPoints([chassis]), chassis: true };
  return { points: Math.max(0, ...catalog.parts.map((p) => p.effects.mountingPoints ?? 0)), chassis: false };
}

/** The instruments the parts provide, in part order. */
export function instrumentsOf(parts: Part[]): Instrument[] {
  return parts.flatMap((p) => (p.effects.instrument ? [p.effects.instrument] : []));
}

/**
 * How an instrument is worked in a mission: a switch is turned on and off and draws its standby energy
 * while on; a use is a photo, a sample or a reading; a deploy sets the part down on the ground for good.
 */
export type InstrumentMode = 'switch' | 'use' | 'deploy';

/** An instrument's operating costs and conditions in a mission, from its part. */
export interface InstrumentCosts {
  instrument: Instrument;
  mode: InstrumentMode;
  energyPerUse: number; // energy each use costs
  standbyEnergy: number; // energy per second while switched on (0 unless mode is 'switch')
  useSeconds: number; // mission seconds the rover holds still for each use (0: instant)
  shadowHoldFactor: number; // the hold time is multiplied by this in shadow (1: no change)
  coldTolerant: boolean; // exempt from the cold slowdown
  needsEarth: boolean; // usable only with Earth above the horizon
  needsBoulder: boolean; // usable only with a boulder within reach
}

/** The mode an instrument part implies: a standby draw makes a switch, `deploy` a deployable, otherwise a use. */
export function instrumentMode(effects: Part['effects']): InstrumentMode {
  if ((effects.standbyEnergy ?? 0) > 0) return 'switch';
  return effects.deploy ? 'deploy' : 'use';
}

/** The operating costs of each instrument the parts provide, in part (bay) order. */
export function instrumentCosts(parts: Part[]): InstrumentCosts[] {
  return parts.flatMap((p) => {
    const e = p.effects;
    if (!e.instrument) return [];
    return [{
      instrument: e.instrument,
      mode: instrumentMode(e),
      energyPerUse: e.energyPerUse ?? 0,
      standbyEnergy: e.standbyEnergy ?? 0,
      useSeconds: e.useSeconds ?? 0,
      shadowHoldFactor: e.shadowHoldFactor ?? 1,
      coldTolerant: e.coldTolerant ?? false,
      needsEarth: e.needsEarth ?? false,
      needsBoulder: e.needsBoulder ?? false,
    }];
  });
}

/** Number keys 1 to 9 use the instruments in bay order; a bay never holds more than this. */
export const INSTRUMENT_KEYS = 9;

/** The mission key of each instrument the parts provide: 1 for the first in bay order, then 2, 3... (up to 9). */
export function instrumentKeys(parts: Part[]): Map<Instrument, number> {
  return new Map(instrumentsOf(parts).slice(0, INSTRUMENT_KEYS).map((inst, i) => [inst, i + 1]));
}

/** The instrument a key press uses: KeyboardEvent.code Digit1 to Digit9 or Numpad1 to Numpad9, in bay order. */
export function instrumentForKey(code: string, parts: Part[]): Instrument | undefined {
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (!digit) return undefined;
  const n = Number(digit[1]);
  for (const [inst, key] of instrumentKeys(parts)) if (key === n) return inst;
  return undefined;
}

/**
 * The support hardware a build carries: each support slot whose chosen part provides it (the robotic
 * arm has `arm`, the mast `mast`; "No arm" provides nothing).
 */
export function supportProvided(build: DraftBuild, catalog: PartsFile): Set<SupportSlot> {
  const provided = new Set<SupportSlot>();
  for (const slot of supportSlotsOf(catalog)) {
    const id = build.support?.[slot];
    const part = id ? catalog.parts.find((p) => p.id === id && p.slot === slot) : undefined;
    if (part?.effects[slot]) provided.add(slot);
  }
  return provided;
}

/** The support hardware an instrument part needs that the build does not carry, in the part's order (empty: none missing). */
export function unmetNeeds(part: Part, build: DraftBuild, catalog: PartsFile): SupportSlot[] {
  const needs = part.effects.needs ?? [];
  if (needs.length === 0) return [];
  const provided = supportProvided(build, catalog);
  return needs.filter((n) => !provided.has(n));
}

/**
 * What is wrong with the build's payload. Capacity counts the instruments and the fitted systems, and is
 * checked only once a chassis is chosen (a draft without one has no mounting points yet). An instrument
 * whose support hardware is not fitted (Mars: the X-ray and organics spectrometers need the arm, the
 * laser spectrometer the mast) is a problem.
 */
export function payloadProblems(build: DraftBuild, catalog: PartsFile): PayloadProblem[] {
  const problems: PayloadProblem[] = [];
  const payload = build.payload ?? [];
  const seen = new Set<string>();
  for (const id of payload) {
    const part = catalog.parts.find((p) => p.id === id);
    if (!part) problems.push({ kind: 'unknown', id });
    else if (part.slot !== 'instrument' || !part.effects.instrument) problems.push({ kind: 'not-instrument', id });
    else if (seen.has(part.effects.instrument)) problems.push({ kind: 'duplicate', id });
    else {
      seen.add(part.effects.instrument);
      for (const support of unmetNeeds(part, build, catalog)) problems.push({ kind: 'needs', id, support });
    }
  }
  const chassis = build.chassis ? catalog.parts.find((p) => p.id === build.chassis) : undefined;
  if (chassis) {
    const points = mountingPoints([chassis]);
    const count = pointsUsed(build, catalog);
    if (count > points) problems.push({ kind: 'over-capacity', count, points });
  }
  return problems;
}

/** True when the build's payload (instruments and fitted systems) takes more mounting points than its chassis has. */
export function isBayOverCapacity(build: DraftBuild, catalog: PartsFile): boolean {
  return payloadProblems(build, catalog).some((p) => p.kind === 'over-capacity');
}

/**
 * Add an instrument at the end of the instrument list (the next mission key), or take it out, with
 * `points` mounting points free for instruments. Adding past them changes nothing. Low level: the desk
 * uses toggleBayPart, which also counts the fitted systems.
 */
export function togglePayload(payload: string[] | undefined, id: string, points: number): string[] {
  const bay = payload ?? [];
  if (bay.includes(id)) return bay.filter((x) => x !== id);
  return bay.length < points ? [...bay, id] : bay;
}

/**
 * Fit the instruments to this many mounting points: the instruments added last are dropped. Returns the
 * kept and the dropped part ids. Low level: fitBayToChassis leaves room for the fitted systems first.
 */
export function fitPayload(payload: string[], points: number): { kept: string[]; dropped: string[] } {
  const room = Math.max(0, points);
  return { kept: payload.slice(0, room), dropped: payload.slice(room) };
}

/** Why a part cannot be fitted now: the bay is full, or (an instrument) its support hardware is not fitted. */
export type FitRefusal = { kind: 'full' } | { kind: 'needs'; support: SupportSlot[] };

/**
 * Why this bay part cannot be fitted to the build now, or null when it can (or is already fitted, so it
 * can be taken off). A full bay refuses instruments and systems alike, except that swapping one heater
 * for the other takes no extra point. An instrument whose support hardware is missing is refused. A part
 * the bay does not offer (unknown, a required bus part, a "None" part) is refused as full.
 */
export function fitRefusal(build: DraftBuild, partId: string, catalog: PartsFile): FitRefusal | null {
  const part = catalog.parts.find((p) => p.id === partId);
  if (!part || !bayParts(catalog).includes(part)) return { kind: 'full' };
  if (isFitted(build, partId, catalog)) return null;
  const swap = part.slot !== 'instrument' && fittedSystem(build, part.slot as SystemSlot, catalog) !== undefined;
  if (!swap && pointsUsed(build, catalog) >= bayCapacity(build, catalog).points) return { kind: 'full' };
  if (part.slot === 'instrument') {
    if ((build.payload ?? []).some((id) => catalog.parts.find((p) => p.id === id)?.effects.instrument === part.effects.instrument)) return { kind: 'full' };
    const support = unmetNeeds(part, build, catalog);
    if (support.length > 0) return { kind: 'needs', support };
  }
  return null;
}

/**
 * Fit a bay part, or take it off if it is fitted. An instrument goes at the end of the bay (the next
 * mission key); a system goes in its slot, replacing the other part there (the heater swap: at most one
 * heater). A refused fit (fitRefusal) changes nothing. Taking off is always allowed, also from a bay over
 * capacity, and taking off the arm or the mast leaves an instrument that needs it in the bay (a 'needs'
 * problem until it is fitted again or the instrument comes out). The input is not changed.
 */
export function toggleBayPart(build: DraftBuild, partId: string, catalog: PartsFile): DraftBuild {
  const part = catalog.parts.find((p) => p.id === partId);
  if (!part) return build;
  const fitted = isFitted(build, partId, catalog);
  if (!fitted && fitRefusal(build, partId, catalog)) return build;
  if (part.slot === 'instrument') {
    const payload = build.payload ?? [];
    return { ...build, payload: fitted ? payload.filter((id) => id !== partId) : [...payload, partId] };
  }
  return withSlotPart(build, part.slot as SystemSlot, fitted ? undefined : partId);
}

/**
 * The build with its payload fitted to its chassis: when the instruments and systems take more points
 * than the chassis has, the instruments fitted last are dropped. Systems are never dropped this way (the
 * four systems take at most four points, which every chassis has). Without a chassis nothing changes.
 * Returns the build and the dropped instrument ids.
 */
export function fitBayToChassis(build: DraftBuild, catalog: PartsFile): { build: DraftBuild; dropped: string[] } {
  const { points, chassis } = bayCapacity(build, catalog);
  if (!chassis || !build.payload) return { build, dropped: [] };
  const { kept, dropped } = fitPayload(build.payload, points - fittedSystems(build, catalog).length);
  return dropped.length === 0 ? { build, dropped } : { build: { ...build, payload: kept }, dropped };
}

/**
 * A build read back from a save, in the current shape, keeping only what the catalog still has, so a
 * save with a renamed or removed part cannot break the desk:
 * - a bus or support slot whose part id is unknown (or names a part of another slot) is left empty;
 * - a payload system slot naming a part that provides nothing (the "No lights", "No heater", "No arm" and
 *   "No mast" choices of saves from before November 16) is left empty: not fitted, as before;
 * - payload ids that are unknown, not instruments, or repeat an instrument already in the bay are
 *   dropped, keeping bay order. A bay that ends up empty is just empty. More payload items than mounting
 *   points are kept (the desk reports it, and the player takes something out).
 * - saves without `support` (every Moon save) load as they are.
 * Saves from before the payload bay have an `instrument` slot: its part becomes the bay's only instrument.
 */
export function upgradeSavedBuild(saved: unknown, catalog: PartsFile): DraftBuild {
  if (typeof saved !== 'object' || saved === null) return {};
  const record = saved as Record<string, unknown>;
  const known = (id: unknown, slot: string): id is string => {
    const part = typeof id === 'string' ? catalog.parts.find((p) => p.id === id && p.slot === slot) : undefined;
    return part !== undefined && providesCapability(part);
  };
  const draft: DraftBuild = {};
  for (const slot of catalog.slots) {
    const id = record[slot];
    if (known(id, slot)) draft[slot] = id;
  }
  const savedSupport = typeof record.support === 'object' && record.support !== null ? (record.support as Record<string, unknown>) : {};
  for (const slot of supportSlotsOf(catalog)) {
    const id = savedSupport[slot];
    if (known(id, slot)) draft.support = { ...draft.support, [slot]: id };
  }
  const savedBay = Array.isArray(record.payload) ? record.payload : typeof record.instrument === 'string' ? [record.instrument] : undefined;
  if (savedBay) {
    const bay: string[] = [];
    const seen = new Set<Instrument>();
    for (const id of savedBay) {
      const inst = catalog.parts.find((p) => p.id === id && p.slot === 'instrument')?.effects.instrument;
      if (typeof id !== 'string' || !inst || seen.has(inst)) continue;
      seen.add(inst);
      bay.push(id);
    }
    draft.payload = bay;
  }
  return draft;
}

// --- A catalog per world ---

const WORLD_LIST = ['moon', 'mars', 'titan'] as const satisfies readonly MissionId[];
/** Every world id, for checking `Part.worlds` and `Relationship.world`. */
export const KNOWN_WORLDS: readonly MissionId[] = WORLD_LIST;
/** A type error here means a MissionId is missing from KNOWN_WORLDS. */
type ListsEvery<Missing extends never> = Missing;
export type KnownWorldsComplete = ListsEvery<Exclude<MissionId, (typeof WORLD_LIST)[number]>>;

/** Does this world's desk offer the part? A part without `worlds` is offered everywhere. */
export function offeredOn(part: Part, world: MissionId): boolean {
  return part.worlds === undefined || part.worlds.includes(world);
}

/** The catalog one world offers: the same slots, the parts it offers, in catalog order. */
export function catalogFor(catalog: PartsFile, world: MissionId): PartsFile {
  return { ...catalog, parts: catalog.parts.filter((p) => offeredOn(p, world)) };
}

/**
 * A build (from the desk or a save) brought to a world: the build the world's catalog can hold
 * (upgradeSavedBuild against the world's offer), and the parts it lost because the world does not offer
 * them, once each, bus slots first, then support slots, then the bay in order (the desk's "Not offered" notice). Ids no
 * catalog knows, and "None" parts, are dropped silently. A Mars build on Titan loses its arm and mast this way.
 */
export function carryBuild(saved: unknown, allParts: PartsFile, world: MissionId): { build: DraftBuild; dropped: Part[] } {
  const known = upgradeSavedBuild(saved, allParts);
  // Support ids come from the raw save too, so a Mars save carried to a world without support slots still names them.
  const raw = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>).support : undefined;
  const rawSupport = typeof raw === 'object' && raw !== null ? Object.values(raw).filter((v): v is string => typeof v === 'string') : [];
  // A part that provides nothing ("No arm") is not lost: it was never fitted.
  const lost = (p: Part) => !offeredOn(p, world) && providesCapability(p);
  const ids = [
    ...allParts.slots.flatMap((s) => known[s] ?? []),
    ...supportSlotsOf(allParts).flatMap((s) => known.support?.[s] ?? []),
    ...rawSupport,
    ...(known.payload ?? []),
  ];
  const dropped = [...new Set(ids)].flatMap((id) => allParts.parts.find((p) => p.id === id && lost(p)) ?? []);
  return { build: upgradeSavedBuild(saved, catalogFor(allParts, world)), dropped };
}

/** Does any milestone require this instrument? Derived, so a card's "earns nothing yet" line goes away once one does. */
export function earnsMilestones(instrument: Instrument, file: MilestonesFile): boolean {
  return file.milestones.some((m) => requiredInstruments(m).includes(instrument));
}
