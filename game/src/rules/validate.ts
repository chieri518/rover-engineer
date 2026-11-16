import type { GameData } from './types';
import { ZONE_IDS } from './milestones';
import { relationshipProblems } from './relationships';

/** Checks the data files for broken references and missing entries. Returns a list of problems. */
export function validateGameData(data: GameData): string[] {
  const problems: string[] = [];
  const { slots, parts } = data.parts;
  const ids = new Set<string>();
  const instrumentOnly = ['instrument', 'energyPerUse', 'standbyEnergy', 'useSeconds', 'deploy', 'shadowHoldFactor', 'coldTolerant', 'needsEarth', 'needsBoulder'] as const;
  for (const part of parts) {
    if (ids.has(part.id)) problems.push(`duplicate part id ${part.id}`);
    ids.add(part.id);
    const e = part.effects;
    if (part.slot === 'instrument') {
      if (!e.instrument) problems.push(`instrument part ${part.id} has no instrument effect`);
      // A switch (standby draw) is turned on and off: it has no use to pay for, hold still for, or deploy.
      if ((e.standbyEnergy ?? 0) > 0) {
        for (const key of ['energyPerUse', 'useSeconds', 'deploy', 'shadowHoldFactor', 'needsEarth', 'needsBoulder'] as const) {
          if (e[key]) problems.push(`instrument part ${part.id} has a standby draw, so it cannot also have ${key}`);
        }
      }
      // Setting a station down, and the boulder and Earth checks, belong to a held use (the rover stops for them).
      if (!((e.standbyEnergy ?? 0) > 0) && !((e.useSeconds ?? 0) > 0)) {
        for (const key of ['deploy', 'needsEarth', 'needsBoulder'] as const) {
          if (e[key]) problems.push(`instrument part ${part.id} has ${key}, so it needs useSeconds above 0`);
        }
      }
      if (e.shadowHoldFactor !== undefined && !(e.shadowHoldFactor > 0 && e.shadowHoldFactor <= 1)) {
        problems.push(`instrument part ${part.id} needs a shadowHoldFactor above 0 and at most 1`);
      }
    } else {
      if (!slots.includes(part.slot)) problems.push(`part ${part.id} has unknown slot ${part.slot}`);
      for (const key of instrumentOnly) if (e[key] !== undefined) problems.push(`part ${part.id} is not an instrument but has ${key}`);
    }
    for (const [key, v] of Object.entries(e)) {
      if (typeof v === 'number' && !(Number.isFinite(v) && v >= 0)) problems.push(`part ${part.id} has a negative or non-finite ${key}`);
    }
    if (part.slot === 'chassis') {
      const points = e.mountingPoints;
      if (points === undefined || !Number.isInteger(points) || points < 0) problems.push(`chassis ${part.id} needs a whole number of mountingPoints`);
    }
    for (const v of [part.cost, part.mass, part.size]) {
      if (!(Number.isFinite(v) && v >= 0)) {
        problems.push(`part ${part.id} has a negative or non-finite cost, mass or size`);
        break;
      }
    }
  }
  for (const slot of slots) {
    if (!parts.some((p) => p.slot === slot)) problems.push(`slot ${slot} has no parts`);
  }
  for (const id of Object.keys(data.text.partText ?? {})) {
    if (!ids.has(id)) problems.push(`text.partText names unknown part ${id}`);
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
  problems.push(...instrumentTuningProblems(data));
  problems.push(...relationshipProblems(data.relationships, ids));
  const { flare, quake, duststorm } = data.events;
  if (flare && flare.realFlares.length < flare.windowsSeconds.length) {
    problems.push('events.json needs at least one real flare per flare window');
  }
  for (const [a, b] of [...(flare?.windowsSeconds ?? []), ...(quake?.windowsSeconds ?? []), ...(duststorm?.windowsSeconds ?? [])]) {
    if (!(a <= b && b <= data.tuning.mission.lengthSeconds)) problems.push(`event window [${a}, ${b}] is outside the mission`);
  }
  return problems;
}

/** tuning.instruments: finite, non-negative numbers; rock types with text and weight. */
function instrumentTuningProblems(data: GameData): string[] {
  const problems: string[] = [];
  const it = data.tuning.instruments;
  if (!(it.coldSlowdown >= 1)) problems.push('tuning.instruments.coldSlowdown must be at least 1 (the cold never speeds an instrument up)');
  const numbers: [string, number][] = [
    ['shadowSunlight', it.shadowSunlight],
    ['stationOffsetM', it.stationOffsetM],
    ...Object.entries(it.neutron).map(([k, v]) => [`neutron.${k}`, v] as [string, number]),
    ['xray.reachM', it.xray.reachM],
    ...Object.entries(it.seismometer).map(([k, v]) => [`seismometer.${k}`, v] as [string, number]),
  ];
  for (const [key, v] of numbers) if (!(Number.isFinite(v) && v >= 0)) problems.push(`tuning.instruments.${key} must be a finite number, not negative`);
  if (!(it.neutron.iceRangeM > 0)) problems.push('tuning.instruments.neutron.iceRangeM must be above 0');
  if (it.xray.rocks.length === 0 || !it.xray.rocks.some((r) => r.weight > 0)) problems.push('tuning.instruments.xray.rocks needs at least one rock with a weight above 0');
  for (const r of it.xray.rocks) {
    if (!(Number.isFinite(r.weight) && r.weight >= 0)) problems.push(`rock ${r.id} needs a finite weight, not negative`);
    if (!data.text.rocks?.[r.id]) problems.push(`rock ${r.id} has no text in text.json rocks`);
  }
  for (const part of data.parts.parts) {
    const inst = part.effects.instrument;
    if (inst && !data.text.instrumentText?.[inst]) problems.push(`instrument ${inst} has no text in text.json instrumentText`);
  }
  return problems;
}
