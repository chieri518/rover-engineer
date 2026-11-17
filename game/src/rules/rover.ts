import type { BusSlot, Build, DraftBuild, Instrument, Milestone, Part, PartsFile, RequiredSlot, Slot, SupportSlot, SystemBusSlot } from './types';

export interface RoverTotals {
  cost: number;
  mass: number;
  size: number;
}

/** The bus slots that hold payload systems (the lights and the heater), not required for a complete build. */
export const SYSTEM_BUS_SLOTS: readonly SystemBusSlot[] = ['lights', 'heater'];

/** Is this bus slot a payload system (lights, heater) rather than part of the required bus? */
export function isSystemBusSlot(slot: Slot): slot is SystemBusSlot {
  return (SYSTEM_BUS_SLOTS as readonly Slot[]).includes(slot);
}

/** The required bus slots of a catalog, in slot order: chassis, wheels, power, battery. */
export function requiredSlots(catalog: PartsFile): RequiredSlot[] {
  return catalog.slots.filter((slot): slot is RequiredSlot => !isSystemBusSlot(slot));
}

/** The support slots this catalog offers (none on the Moon). */
export function supportSlotsOf(catalog: PartsFile): SupportSlot[] {
  return catalog.supportSlots ?? [];
}

/** The part id a draft build has in a bus or support slot (undefined: none chosen yet, or a system not fitted). */
export function slotPartId(build: DraftBuild, slot: BusSlot | SupportSlot): string | undefined {
  return slot === 'arm' || slot === 'mast' ? build.support?.[slot] : build[slot];
}

/**
 * The build with this part in a bus or support slot, or with the slot emptied (`id` undefined: a system
 * taken off; an emptied `support` record goes away). Neither input is changed.
 */
export function withSlotPart(build: DraftBuild, slot: BusSlot | SupportSlot, id: string | undefined): DraftBuild {
  if (slot === 'arm' || slot === 'mast') {
    const { [slot]: _old, ...rest } = build.support ?? {};
    const support = id === undefined ? rest : { ...rest, [slot]: id };
    const { support: _s, ...others } = build;
    return Object.keys(support).length > 0 ? { ...others, support } : others;
  }
  if (id !== undefined) return { ...build, [slot]: id };
  const { [slot]: _old, ...rest } = build;
  return rest;
}

/**
 * The selected part objects for a build: the bus parts in slot order (a system slot left empty is
 * skipped), then the support parts in support slot order (only those the build names), then the payload
 * bay's instruments in bay order, as one flat list. A system slot naming a part that provides nothing
 * ("No lights") keeps that part in the list: it has no cost, mass, size or effect. Throws on an unknown
 * or mismatched part id, or an empty required slot. Bay capacity, duplicates and support needs are not
 * checked here (see payloadProblems in payload.ts).
 */
export function selectedParts(build: Build, catalog: PartsFile): Part[] {
  const find = (id: string, slot: Slot): Part => {
    const part = catalog.parts.find((p) => p.id === id);
    if (!part) throw new Error(`unknown part "${id}" in slot ${slot}`);
    if (part.slot !== slot) throw new Error(`part ${part.id} does not belong in slot ${slot}`);
    return part;
  };
  const bus = catalog.slots.flatMap((slot) => {
    const id = build[slot];
    if (id) return [find(id, slot)];
    if (isSystemBusSlot(slot)) return [];
    throw new Error(`no part in slot ${slot}`);
  });
  const support = supportSlotsOf(catalog).flatMap((slot) => {
    const id = build.support?.[slot];
    return id ? [find(id, slot)] : [];
  });
  return [...bus, ...support, ...build.payload.map((id) => find(id, 'instrument'))];
}

/**
 * What a draft build still needs before it can go to the launch ticket: the empty required bus slots
 * (chassis, wheels, power, battery), in slot order. Payload systems and the bay are never missing: left
 * off is a choice, and an empty bay is complete (November 16).
 */
export function missingSlots(build: DraftBuild, catalog: PartsFile): Slot[] {
  return requiredSlots(catalog).filter((slot) => !build[slot]);
}

/** True once the required bus is chosen. completeBuild gives the Build to hand onward. */
export function isCompleteBuild(build: DraftBuild, catalog: PartsFile): boolean {
  return missingSlots(build, catalog).length === 0;
}

/**
 * The draft as a Build for the ticket and the mission, or null while a required bus slot is empty. An
 * undefined bay becomes an empty one; everything else is kept as it is.
 */
export function completeBuild(build: DraftBuild, catalog: PartsFile): Build | null {
  return isCompleteBuild(build, catalog) ? ({ ...build, payload: build.payload ?? [] } as Build) : null;
}

/** The chosen parts of a draft build, as selectedParts orders them, skipping empty slots. */
export function chosenParts(build: DraftBuild, catalog: PartsFile): Part[] {
  const slots = catalog.slots.filter((s) => build[s]);
  const chosen = { ...Object.fromEntries(slots.map((s) => [s, build[s]!])), payload: build.payload ?? [], support: build.support };
  return selectedParts(chosen as Build, { ...catalog, slots });
}

export function roverTotals(parts: Part[]): RoverTotals {
  return parts.reduce(
    (t, p) => ({ cost: t.cost + p.cost, mass: t.mass + p.mass, size: t.size + p.size }),
    { cost: 0, mass: 0, size: 0 },
  );
}

/** True when the rover's total mass (chassis included) is above the chassis maximum load. */
export function isChassisOverloaded(parts: Part[]): boolean {
  const chassis = parts.find((p) => p.slot === 'chassis');
  if (!chassis || chassis.effects.maxLoad === undefined) return false;
  return roverTotals(parts).mass > chassis.effects.maxLoad;
}

/**
 * Does this part provide its slot's capability? Payload systems only if they do something: lights with
 * a light range, a heater with heat, the arm and the mast with their flag ("No lights", "No heater",
 * "No arm" and "No mast" do not). Every other part does.
 */
export function providesCapability(part: Part): boolean {
  const e = part.effects;
  switch (part.slot) {
    case 'lights':
      return (e.lightRange ?? 0) > 0;
    case 'heater':
      return (e.heat ?? 0) > 0;
    case 'arm':
      return e.arm === true;
    case 'mast':
      return e.mast === true;
    default:
      return true;
  }
}

/** Every instrument a milestone needs: `requires.instrument` and, for combos, all of `requires.instruments`. */
export function requiredInstruments(milestone: Milestone): Instrument[] {
  const { instrument, instruments = [] } = milestone.requires;
  return [...new Set([...(instrument ? [instrument] : []), ...instruments])];
}

/** Whether a rover with these parts is equipped to earn the milestone (combos: every listed instrument). */
export function meetsRequirements(parts: Part[], milestone: Milestone): boolean {
  const { slots = [] } = milestone.requires;
  for (const slot of slots) {
    // Any heat meets a heater requirement (Mars M17): an RTG's waste heat warms a rover without a heater.
    if (slot === 'heater' && parts.reduce((sum, p) => sum + (p.effects.heat ?? 0), 0) > 0) continue;
    const part = parts.find((p) => p.slot === slot);
    if (!part || !providesCapability(part)) return false;
  }
  return requiredInstruments(milestone).every((inst) => parts.some((p) => p.effects.instrument === inst));
}

/** The cheapest option in each required bus slot, with no payload systems and an empty payload bay. */
export function cheapestBuild(catalog: PartsFile): Build {
  const build = { payload: [] as string[] } as unknown as Build;
  const cheapest = (slot: Slot) => catalog.parts.filter((p) => p.slot === slot).sort((a, b) => a.cost - b.cost)[0]!.id;
  for (const slot of requiredSlots(catalog)) build[slot] = cheapest(slot);
  return build;
}
