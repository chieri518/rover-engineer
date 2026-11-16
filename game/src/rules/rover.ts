import type { BusSlot, Build, DraftBuild, Milestone, Part, PartsFile, Slot } from './types';

export interface RoverTotals {
  cost: number;
  mass: number;
  size: number;
}

/**
 * The selected part objects for a build: the bus parts in slot order, then the payload bay's
 * instruments in bay order, as one flat list. Throws on an unknown or mismatched part id.
 * Bay capacity and duplicates are not checked here (see payloadProblems in payload.ts).
 */
export function selectedParts(build: Build, catalog: PartsFile): Part[] {
  const find = (id: string, slot: Slot): Part => {
    const part = catalog.parts.find((p) => p.id === id);
    if (!part) throw new Error(`unknown part "${id}" in slot ${slot}`);
    if (part.slot !== slot) throw new Error(`part ${part.id} does not belong in slot ${slot}`);
    return part;
  };
  return [...catalog.slots.map((slot) => find(build[slot], slot)), ...build.payload.map((id) => find(id, 'instrument'))];
}

/**
 * What a draft build still needs, in slot order: the empty bus slots, then 'instrument' while the
 * payload bay is not confirmed (an empty bay counts once the player has confirmed it).
 */
export function missingSlots(build: DraftBuild, catalog: PartsFile): Slot[] {
  const bus: Slot[] = catalog.slots.filter((slot) => !build[slot]);
  return build.payload === undefined ? [...bus, 'instrument'] : bus;
}

export function isCompleteBuild(build: DraftBuild, catalog: PartsFile): build is Build {
  return missingSlots(build, catalog).length === 0;
}

/** The chosen parts of a draft build, as selectedParts orders them, skipping empty slots. */
export function chosenParts(build: DraftBuild, catalog: PartsFile): Part[] {
  const slots = catalog.slots.filter((s) => build[s]);
  const chosen = { ...Object.fromEntries(slots.map((s) => [s, build[s]!])), payload: build.payload ?? [] };
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

/** Whether a rover with these parts is equipped to earn the milestone. */
export function meetsRequirements(parts: Part[], milestone: Milestone): boolean {
  const { slots = [], instrument } = milestone.requires;
  for (const slot of slots) {
    const part = parts.find((p) => p.slot === slot);
    if (!part || !slotProvidesCapability(part, slot)) return false;
  }
  if (instrument && !parts.some((p) => p.effects.instrument === instrument)) return false;
  return true;
}

/** The cheapest option in each bus slot, with an empty payload bay. */
export function cheapestBuild(catalog: PartsFile): Build {
  const build = { payload: [] as string[] } as Build;
  for (const slot of catalog.slots) {
    const options = catalog.parts.filter((p) => p.slot === slot).sort((a, b) => a.cost - b.cost);
    build[slot] = options[0]!.id;
  }
  return build;
}
