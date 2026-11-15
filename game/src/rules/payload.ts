// The payload bay: the chassis sets its mounting points (one per instrument), and the bay holds any
// mix of instruments, one of each, or none. Pure.
import type { DraftBuild, Instrument, Part, PartsFile } from './types';

export type PayloadProblem =
  | { kind: 'unknown'; id: string } // no part with this id
  | { kind: 'not-instrument'; id: string } // the part is not an instrument
  | { kind: 'duplicate'; id: string } // a second part giving an instrument already in the bay
  | { kind: 'over-capacity'; count: number; points: number }; // more instruments than mounting points

/** The bay's mounting points, from the chassis among these parts; 0 without a chassis. */
export function mountingPoints(parts: Part[]): number {
  return parts.find((p) => p.slot === 'chassis')?.effects.mountingPoints ?? 0;
}

/** The instruments the parts provide, in part order. */
export function instrumentsOf(parts: Part[]): Instrument[] {
  return parts.flatMap((p) => (p.effects.instrument ? [p.effects.instrument] : []));
}

/** An instrument's operating costs in a mission, from its part. */
export interface InstrumentCosts {
  instrument: Instrument;
  energyPerUse: number; // energy each use costs
  standbyEnergy: number; // energy per second while switched on (0: no standby; such an instrument is used, not switched)
  useSeconds: number; // mission seconds the rover holds still for each use (0: instant)
}

/** The operating costs of each instrument the parts provide, in part (bay) order. */
export function instrumentCosts(parts: Part[]): InstrumentCosts[] {
  return parts.flatMap((p) => {
    const e = p.effects;
    if (!e.instrument) return [];
    return [{ instrument: e.instrument, energyPerUse: e.energyPerUse ?? 0, standbyEnergy: e.standbyEnergy ?? 0, useSeconds: e.useSeconds ?? 0 }];
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
 * What is wrong with the build's payload. Capacity is checked only once a chassis is chosen (a draft
 * without one has no mounting points yet). An unconfirmed bay has no problems.
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
    else seen.add(part.effects.instrument);
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
