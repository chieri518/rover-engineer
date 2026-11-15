// Relationships between parts (rover-engineering-design.md, section 10): when each Moon relationship
// happens in a mission. The text and review colors are in data/relationships.json; the rules that
// decide *when* are code here, keyed by id. The mission screen calls these with what it measured and
// shows a relationship's notice the first time it happens in a mission. Pure: no rendering, no DOM.
import type { Instrument, InstrumentTuning, Relationship, RelationshipLesson, RelationshipsFile } from './types';
import type { UseSite } from './mission';
import { seismometerRecording, type SeismometerTrack, type TrackPoint } from './instruments';

/** The relationships the mission fires, with their variants. Hard blocks are not fired (the mission already stops the rover). */
export const FIRED_RELATIONSHIPS = {
  'neutron-drill': [],
  'seismometer-quiet': [],
  'cold-dark': ['heater', 'lights'],
  'xray-cold': [],
} as const satisfies Record<string, readonly string[]>;

export type RelationshipId = keyof typeof FIRED_RELATIONSHIPS;

/** A relationship that happened. `variant` names which lesson (cold and dark: heater or lights). */
export interface RelationshipEvent {
  id: RelationshipId;
  variant?: 'heater' | 'lights';
}

/**
 * A held use started. Cold and dark (heater): the cold slowed it, on a rover without a heater.
 * Colder X-ray detector: the reading is faster because the rover is in shadow.
 */
export function onUseStart(start: { slowedByCold: boolean; fasterInShadow: boolean }): RelationshipEvent[] {
  const out: RelationshipEvent[] = [];
  if (start.slowedByCold) out.push({ id: 'cold-dark', variant: 'heater' });
  if (start.fasterInShadow) out.push({ id: 'xray-cold' });
  return out;
}

/**
 * A held use finished ('instrument-done', with the site where it started). The neutron spectrometer
 * finds, the drill confirms: a drill sample in the dark crater on a rover that does not carry a
 * neutron spectrometer (one carried but switched off does not count: the rover has the answer aboard).
 */
export function onUseDone(instrument: Instrument, site: UseSite, carried: readonly Instrument[]): RelationshipEvent[] {
  if (instrument === 'drill' && site.inDarkCrater && !carried.includes('neutron')) return [{ id: 'neutron-drill' }];
  return [];
}

/** A photo was taken. Cold and dark (lights): inside permanent shadow (the cold-zone mask) on a rover without lights. */
export function onPhoto(p: { inColdZone: boolean; hasLights: boolean }): RelationshipEvent[] {
  return p.inColdZone && !p.hasLights ? [{ id: 'cold-dark', variant: 'lights' }] : [];
}

/**
 * Each mission step. The seismometer needs quiet ground: the rover is driving within the quiet
 * distance of a station on the ground that is still waiting for the moonquake.
 */
export function onStep(track: SeismometerTrack, rover: TrackPoint, t: InstrumentTuning['seismometer']): RelationshipEvent[] {
  const at = track.deployedAt;
  if (!at || !seismometerRecording(track) || !rover.moving) return [];
  return Math.hypot(rover.x - at.x, rover.z - at.z) < t.quietDistanceM ? [{ id: 'seismometer-quiet' }] : [];
}

/** One key per notice: each relationship once per mission, cold and dark once per variant. */
export function meetingKey(e: RelationshipEvent): string {
  return e.variant ? `${e.id}:${e.variant}` : e.id;
}

/**
 * Add events to what this mission has met. Returns the new list and the events met for the first time
 * (their notices show now), in order, without repeats.
 */
export function meet(met: readonly RelationshipEvent[], events: readonly RelationshipEvent[]): { met: RelationshipEvent[]; fresh: RelationshipEvent[] } {
  const keys = new Set(met.map(meetingKey));
  const fresh: RelationshipEvent[] = [];
  for (const e of events) {
    const key = meetingKey(e);
    if (keys.has(key)) continue;
    keys.add(key);
    fresh.push(e);
  }
  return { met: [...met, ...fresh], fresh };
}

/** The relationship ids met, once each, in the order first met (for the notebook). */
export function metIds(met: readonly RelationshipEvent[]): RelationshipId[] {
  return [...new Set(met.map((e) => e.id))];
}

/** The relationship's data entry. */
export function relationshipEntry(file: RelationshipsFile, id: string): Relationship | undefined {
  return file.relationships.find((r) => r.id === id);
}

/** The lesson for an event: its variant's, or the entry's own. Undefined if the data lacks it (validation catches that). */
export function lessonFor(file: RelationshipsFile, e: RelationshipEvent): RelationshipLesson | undefined {
  const r = relationshipEntry(file, e.id);
  if (!r) return undefined;
  if (e.variant) return r.variants?.[e.variant];
  return r.notice !== undefined && r.debrief !== undefined && r.answers !== undefined
    ? { notice: r.notice, debrief: r.debrief, answers: r.answers }
    : undefined;
}

const KINDS = ['needs', 'conditions', 'conflicts', 'shares', 'wear'];
const COLORS = ['green', 'yellow', 'red'];

/** relationships.json: unique ids, known parts, text present, a valid kind and review color, and every fired relationship present. */
export function relationshipProblems(file: RelationshipsFile, partIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0;
  const lessonProblems = (where: string, l: Partial<RelationshipLesson> | undefined) => {
    if (!l || !filled(l.notice) || !filled(l.debrief)) problems.push(`relationship ${where} needs a notice and a debrief`);
    if (!l?.answers || l.answers.length < 2 || !l.answers.every(filled)) problems.push(`relationship ${where} needs at least two answers`);
  };
  for (const r of file.relationships) {
    if (ids.has(r.id)) problems.push(`duplicate relationship id ${r.id}`);
    ids.add(r.id);
    if (r.world !== 'moon') problems.push(`relationship ${r.id} has unknown world ${String(r.world)}`);
    if (!KINDS.includes(r.kind)) problems.push(`relationship ${r.id} has unknown kind ${String(r.kind)}`);
    if (!COLORS.includes(r.review)) problems.push(`relationship ${r.id} has unknown review color ${String(r.review)}`);
    if (r.parts.length === 0) problems.push(`relationship ${r.id} names no parts`);
    for (const p of r.parts) if (!partIds.has(p)) problems.push(`relationship ${r.id} names unknown part ${p}`);
    if (!filled(r.name) || !filled(r.reviewText)) problems.push(`relationship ${r.id} needs a name and review text`);
    if (r.hardBlock) {
      if (r.review !== 'red') problems.push(`relationship ${r.id} is a hard block, so its review is red`);
      continue;
    }
    if (!filled(r.fact) || !filled(r.source)) problems.push(`relationship ${r.id} needs a fact and a source`);
    if (r.variants) for (const [v, l] of Object.entries(r.variants)) lessonProblems(`${r.id} (${v})`, l);
    else lessonProblems(r.id, r);
  }
  for (const [id, variants] of Object.entries(FIRED_RELATIONSHIPS)) {
    const r = relationshipEntry(file, id);
    if (!r) problems.push(`relationship ${id} is used by the mission but missing from relationships.json`);
    else if (r.hardBlock) problems.push(`relationship ${id} is used by the mission, so it cannot be a hard block`);
    else for (const v of variants as readonly string[]) if (!r.variants?.[v]) problems.push(`relationship ${id} needs a ${v} variant`);
  }
  return problems;
}
