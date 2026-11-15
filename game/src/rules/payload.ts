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
 * A build read back from a save, in the current shape. Saves from before the payload bay have an
 * `instrument` slot: its part becomes the bay's only instrument.
 */
export function upgradeSavedBuild(saved: unknown): DraftBuild {
  if (typeof saved !== 'object' || saved === null) return {};
  const { instrument, payload, ...bus } = saved as Record<string, unknown>;
  const draft: Record<string, unknown> = Object.fromEntries(Object.entries(bus).filter(([, v]) => typeof v === 'string'));
  if (Array.isArray(payload)) draft.payload = payload.filter((x): x is string => typeof x === 'string');
  else if (typeof instrument === 'string') draft.payload = [instrument];
  return draft as DraftBuild;
}
