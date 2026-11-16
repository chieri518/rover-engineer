import type { BusSlot, Build, DraftBuild, Instrument, Milestone, Part, PartsFile, Slot, SupportSlot } from './types';

export interface RoverTotals {
  cost: number;
  mass: number;
  size: number;
}

/** The support slots this catalog offers (none on the Moon). */
export function supportSlotsOf(catalog: PartsFile): SupportSlot[] {
  return catalog.supportSlots ?? [];
}

/** The part id a draft build has in a bus or support slot (undefined: none chosen yet). */
export function slotPartId(build: DraftBuild, slot: BusSlot | SupportSlot): string | undefined {
  return slot === 'arm' || slot === 'mast' ? build.support?.[slot] : build[slot];
}

/** The build with this part in a bus or support slot. Neither input is changed. */
export function withSlotPart(build: DraftBuild, slot: BusSlot | SupportSlot, id: string): DraftBuild {
  return slot === 'arm' || slot === 'mast' ? { ...build, support: { ...build.support, [slot]: id } } : { ...build, [slot]: id };
}

/**
 * The selected part objects for a build: the bus parts in slot order, then the support parts in support
 * slot order (only those the build names; isCompleteBuild checks they are all chosen), then the payload
 * bay's instruments in bay order, as one flat list. Throws on an unknown or mismatched part id.
 * Bay capacity, duplicates and support needs are not checked here (see payloadProblems in payload.ts).
 */
export function selectedParts(build: Build, catalog: PartsFile): Part[] {
  const find = (id: string, slot: Slot): Part => {
    const part = catalog.parts.find((p) => p.id === id);
    if (!part) throw new Error(`unknown part "${id}" in slot ${slot}`);
    if (part.slot !== slot) throw new Error(`part ${part.id} does not belong in slot ${slot}`);
    return part;
  };
  const support = supportSlotsOf(catalog).flatMap((slot) => {
    const id = build.support?.[slot];
    return id ? [find(id, slot)] : [];
  });
  return [...catalog.slots.map((slot) => find(build[slot], slot)), ...support, ...build.payload.map((id) => find(id, 'instrument'))];
}

/**
 * What a draft build still needs, in slot order: the empty bus slots, the empty support slots (a world
 * that offers them asks for a choice, "No arm" included), then 'instrument' while the payload bay is not
 * confirmed (an empty bay counts once the player has confirmed it).
 */
export function missingSlots(build: DraftBuild, catalog: PartsFile): Slot[] {
  const bus: Slot[] = catalog.slots.filter((slot) => !build[slot]);
  const support: Slot[] = supportSlotsOf(catalog).filter((slot) => !build.support?.[slot]);
  return build.payload === undefined ? [...bus, ...support, 'instrument'] : [...bus, ...support];
}

export function isCompleteBuild(build: DraftBuild, catalog: PartsFile): build is Build {
  return missingSlots(build, catalog).length === 0;
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

/** Does the part in this slot actually provide its capability? ("No lights" and "No heater" do not.) */
function slotProvidesCapability(part: Part, slot: BusSlot): boolean {
  const e = part.effects;
  switch (slot) {
    case 'lights':
      return (e.lightRange ?? 0) > 0;
    case 'heater':
      return (e.heat ?? 0) > 0;
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
    // Any heat meets a heater requirement (Mars M17): an RTG's waste heat warms a rover with "No heater".
    if (slot === 'heater' && parts.reduce((sum, p) => sum + (p.effects.heat ?? 0), 0) > 0) continue;
    const part = parts.find((p) => p.slot === slot);
    if (!part || !slotProvidesCapability(part, slot)) return false;
  }
  return requiredInstruments(milestone).every((inst) => parts.some((p) => p.effects.instrument === inst));
}

/** The cheapest option in each bus slot (and support slot, where the world offers them), with an empty payload bay. */
export function cheapestBuild(catalog: PartsFile): Build {
  const build = { payload: [] as string[] } as Build;
  const cheapest = (slot: Slot) => catalog.parts.filter((p) => p.slot === slot).sort((a, b) => a.cost - b.cost)[0]!.id;
  for (const slot of catalog.slots) build[slot] = cheapest(slot);
  const support = supportSlotsOf(catalog);
  if (support.length > 0) build.support = Object.fromEntries(support.map((slot) => [slot, cheapest(slot)]));
  return build;
}
