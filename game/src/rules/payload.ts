// The payload bay: the chassis sets its mounting points (one per instrument), and the bay holds any
// mix of instruments, one of each, or none. Pure.
import type { DraftBuild, Instrument, MilestonesFile, MissionId, Part, PartsFile, SupportSlot } from './types';
import { requiredInstruments, supportSlotsOf } from './rover';

export type PayloadProblem =
  | { kind: 'unknown'; id: string } // no part with this id
  | { kind: 'not-instrument'; id: string } // the part is not an instrument
  | { kind: 'duplicate'; id: string } // a second part giving an instrument already in the bay
  | { kind: 'over-capacity'; count: number; points: number } // more instruments than mounting points
  | { kind: 'needs'; id: string; support: SupportSlot }; // an instrument whose support hardware the build lacks (Mars: the arm, the mast)

/** The bay's mounting points, from the chassis among these parts; 0 without a chassis. */
export function mountingPoints(parts: Part[]): number {
  return parts.find((p) => p.slot === 'chassis')?.effects.mountingPoints ?? 0;
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
 * What is wrong with the build's payload. Capacity is checked only once a chassis is chosen (a draft
 * without one has no mounting points yet). An instrument whose support hardware is missing (Mars: the
 * X-ray and organics spectrometers need the arm, the laser spectrometer the mast) is refused, also while
 * the support slot is still empty. An unconfirmed bay has no problems.
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
    if (payload.length > points) problems.push({ kind: 'over-capacity', count: payload.length, points });
  }
  return problems;
}

/** True when the build's bay holds more instruments than its chassis has mounting points. */
export function isBayOverCapacity(build: DraftBuild, catalog: PartsFile): boolean {
  return payloadProblems(build, catalog).some((p) => p.kind === 'over-capacity');
}

/**
 * Add an instrument at the end of the bay (the next mission key), or take it out. Adding to a full
 * bay changes nothing. An unconfirmed bay counts as empty.
 */
export function togglePayload(payload: string[] | undefined, id: string, points: number): string[] {
  const bay = payload ?? [];
  if (bay.includes(id)) return bay.filter((x) => x !== id);
  return bay.length < points ? [...bay, id] : bay;
}

/**
 * Fit the bay to a chassis with this many mounting points: the instruments added last are dropped.
 * Returns the kept and the dropped part ids.
 */
export function fitPayload(payload: string[], points: number): { kept: string[]; dropped: string[] } {
  return { kept: payload.slice(0, points), dropped: payload.slice(points) };
}

/**
 * A build read back from a save, in the current shape, keeping only what the catalog still has, so a
 * save with a renamed or removed part cannot break the desk:
 * - a bus slot whose part id is unknown (or names a part of another slot) is left empty;
 * - payload ids that are unknown, not instruments, or repeat an instrument already in the bay are
 *   dropped; if that empties a bay that held something, the bay is left unconfirmed so the player
 *   chooses again. More instruments than mounting points are kept (the desk reports it).
 * - a support slot (where the catalog offers them) keeps its part id only if the catalog has it in that
 *   slot; saves without `support` (every Moon save) load as they are.
 * Saves from before the payload bay have an `instrument` slot: its part becomes the bay's only instrument.
 */
export function upgradeSavedBuild(saved: unknown, catalog: PartsFile): DraftBuild {
  if (typeof saved !== 'object' || saved === null) return {};
  const record = saved as Record<string, unknown>;
  const draft: DraftBuild = {};
  for (const slot of catalog.slots) {
    const id = record[slot];
    if (typeof id === 'string' && catalog.parts.some((p) => p.id === id && p.slot === slot)) draft[slot] = id;
  }
  const savedSupport = typeof record.support === 'object' && record.support !== null ? (record.support as Record<string, unknown>) : {};
  for (const slot of supportSlotsOf(catalog)) {
    const id = savedSupport[slot];
    if (typeof id === 'string' && catalog.parts.some((p) => p.id === id && p.slot === slot)) draft.support = { ...draft.support, [slot]: id };
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
    if (bay.length > 0 || savedBay.length === 0) draft.payload = bay;
  }
  return draft;
}

// --- A catalog per world ---

const WORLD_LIST = ['moon', 'mars'] as const satisfies readonly MissionId[];
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
 * catalog knows are dropped silently, as before.
 */
export function carryBuild(saved: unknown, allParts: PartsFile, world: MissionId): { build: DraftBuild; dropped: Part[] } {
  const known = upgradeSavedBuild(saved, allParts);
  const ids = [
    ...allParts.slots.flatMap((s) => known[s] ?? []),
    ...supportSlotsOf(allParts).flatMap((s) => known.support?.[s] ?? []),
    ...(known.payload ?? []),
  ];
  const dropped = [...new Set(ids)].flatMap((id) => allParts.parts.find((p) => p.id === id && !offeredOn(p, world)) ?? []);
  return { build: upgradeSavedBuild(saved, catalogFor(allParts, world)), dropped };
}

/** Does any milestone require this instrument? Derived, so a card's "earns nothing yet" line goes away once one does. */
export function earnsMilestones(instrument: Instrument, file: MilestonesFile): boolean {
  return file.milestones.some((m) => requiredInstruments(m).includes(instrument));
}
