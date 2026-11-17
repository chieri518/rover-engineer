// Build enumeration for a world with support slots (Mars): each bus mix with each bay that fits, and the
// support hardware that bay needs. Kept apart from balance.ts (the Moon's evaluator). Pure.
import type { Build, GameData, Part } from './types';
import { mountingPoints, pointsUsed } from './payload';

/** Every subset of the instrument parts, each part at most once, in catalog order (the empty bay first, then by size). */
function payloadSubsets(instruments: Part[]): string[][] {
  let subsets: string[][] = [[]];
  for (const part of instruments) subsets = subsets.flatMap((s) => [s, [...s, part.id]]);
  return subsets.sort((a, b) => a.length - b.length);
}

/**
 * The support parts a bay calls for, on a world that offers support slots (Mars): in each support slot
 * the part that provides it when an instrument in the bay needs it, and the cheapest part ("No arm")
 * otherwise. Undefined on a world without support slots.
 */
export function supportFor(payload: string[], data: GameData): Build['support'] {
  const slots = data.parts.supportSlots ?? [];
  if (slots.length === 0) return undefined;
  const needs = new Set(payload.flatMap((id) => data.parts.parts.find((p) => p.id === id)?.effects.needs ?? []));
  const support: NonNullable<Build['support']> = {};
  for (const slot of slots) {
    const options = data.parts.parts.filter((p) => p.slot === slot);
    const chosen = needs.has(slot) ? options.find((p) => p.effects[slot]) : [...options].sort((a, b) => a.cost - b.cost)[0];
    if (chosen) support[slot] = chosen.id;
  }
  return support;
}

/**
 * Every build: each mix of bus parts (the lights and heater options included, "None" meaning not fitted),
 * with each bay that fits its chassis together with the fitted systems (instruments + lights, heater, arm
 * and mast ≤ mounting points), and the support each bay needs (and nothing more).
 */
export function allBuildsWithSupport(data: GameData): Build[] {
  let buses: Partial<Build>[] = [{}];
  for (const slot of data.parts.slots) {
    const options = data.parts.parts.filter((p) => p.slot === slot);
    buses = buses.flatMap((b) => options.map((o) => ({ ...b, [slot]: o.id })));
  }
  const bays = payloadSubsets(data.parts.parts.filter((p) => p.slot === 'instrument'));
  const support = new Map(bays.map((bay) => [bay, supportFor(bay, data)]));
  return buses.flatMap((bus) => {
    const points = mountingPoints(data.parts.parts.filter((p) => p.id === bus.chassis));
    return bays.flatMap((payload) => {
      const s = support.get(payload);
      const build = (s ? { ...bus, payload, support: s } : { ...bus, payload }) as Build;
      return pointsUsed(build, data.parts) <= points ? [build] : [];
    });
  });
}
