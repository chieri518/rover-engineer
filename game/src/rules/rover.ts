import type { Build, DraftBuild, Milestone, Part, PartsFile, Slot } from './types';

export interface RoverTotals {
  cost: number;
  mass: number;
  size: number;
}

/** The selected part objects for a build, in slot order. Throws on an unknown or mismatched part id. */
export function selectedParts(build: Build, catalog: PartsFile): Part[] {
  return catalog.slots.map((slot) => {
    const part = catalog.parts.find((p) => p.id === build[slot]);
    if (!part) throw new Error(`unknown part "${build[slot]}" in slot ${slot}`);
    if (part.slot !== slot) throw new Error(`part ${part.id} does not belong in slot ${slot}`);
    return part;
  });
}

/** The slots of a draft build that have no part chosen yet, in slot order. */
export function missingSlots(build: DraftBuild, catalog: PartsFile): Slot[] {
  return catalog.slots.filter((slot) => !build[slot]);
}

export function isCompleteBuild(build: DraftBuild, catalog: PartsFile): build is Build {
  return missingSlots(build, catalog).length === 0;
}

/** The chosen parts of a draft build, in slot order, skipping empty slots. */
export function chosenParts(build: DraftBuild, catalog: PartsFile): Part[] {
  const chosen = Object.fromEntries(catalog.slots.filter((s) => build[s]).map((s) => [s, build[s]!]));
  return selectedParts(chosen as Build, { ...catalog, slots: catalog.slots.filter((s) => build[s]) });
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

/** Does the part in this slot actually provide its capability? (A future "none" option would not.) */
function slotProvidesCapability(part: Part, slot: Slot): boolean {
  const e = part.effects;
  switch (slot) {
    case 'lights':
      return (e.lightRange ?? 0) > 0;
    case 'heater':
      return (e.heat ?? 0) > 0;
    case 'instrument':
      return e.instrument !== undefined;
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

/** The cheapest option in each slot. */
export function cheapestBuild(catalog: PartsFile): Build {
  const build = {} as Build;
  for (const slot of catalog.slots) {
    const options = catalog.parts.filter((p) => p.slot === slot).sort((a, b) => a.cost - b.cost);
    build[slot] = options[0]!.id;
  }
  return build;
}
