import type { GameData } from './types';
import { ZONE_IDS } from './milestones';

/** Checks the data files for broken references and missing entries. Returns a list of problems. */
export function validateGameData(data: GameData): string[] {
  const problems: string[] = [];
  const { slots, parts } = data.parts;
  const ids = new Set<string>();
  for (const part of parts) {
    if (ids.has(part.id)) problems.push(`duplicate part id ${part.id}`);
    ids.add(part.id);
    if (part.slot === 'instrument') {
      if (!part.effects.instrument) problems.push(`instrument part ${part.id} has no instrument effect`);
    } else if (!slots.includes(part.slot)) problems.push(`part ${part.id} has unknown slot ${part.slot}`);
    if (part.slot === 'chassis') {
      const points = part.effects.mountingPoints;
      if (points === undefined || !Number.isInteger(points) || points < 0) problems.push(`chassis ${part.id} needs a whole number of mountingPoints`);
    }
    if (part.cost < 0 || part.mass < 0 || part.size < 0) problems.push(`part ${part.id} has a negative value`);
  }
  for (const slot of slots) {
    if (!parts.some((p) => p.slot === slot)) problems.push(`slot ${slot} has no parts`);
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
    if (m.requires.instrument && !parts.some((p) => p.effects.instrument === m.requires.instrument)) {
      problems.push(`milestone ${m.id} requires instrument ${m.requires.instrument}, which no part provides`);
    }
    // A trigger naming an unknown zone would silently never fire.
    const tr = m.trigger;
    const zone = tr.type === 'zone' || tr.type === 'photo' || tr.type === 'drill' ? tr.zone : undefined;
    if (zone !== undefined && !(ZONE_IDS as readonly string[]).includes(zone)) problems.push(`milestone ${m.id} names unknown zone ${zone}`);
  }
  if (data.events.flare.realFlares.length < data.events.flare.windowsSeconds.length) {
    problems.push('events.json needs at least one real flare per flare window');
  }
  for (const [a, b] of [...data.events.flare.windowsSeconds, ...data.events.quake.windowsSeconds]) {
    if (!(a <= b && b <= data.tuning.mission.lengthSeconds)) problems.push(`event window [${a}, ${b}] is outside the mission`);
  }
  return problems;
}
