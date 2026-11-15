// Relationships between parts (rover-engineering-design.md, section 10): when each Moon relationship
// happens in a mission, and which builds the pre-launch review flags. The text and review colors are in
// data/relationships.json; the rules that decide *when* are code here, keyed by id. The mission screen
// calls the event hooks with what it measured and shows a relationship's notice the first time it
// happens in a mission; the ticket screen calls reviewItems. Pure: no rendering, no DOM.
import type { Build, Instrument, Part, PartsFile, Relationship, RelationshipLesson, RelationshipsFile, ReviewColor } from './types';
import type { UseSite } from './mission';
import type { SeismometerOutcome } from './instruments';
import { instrumentCosts, instrumentsOf, type InstrumentCosts } from './payload';
import { selectedParts } from './rover';

/**
 * The relationships the mission fires, each with the placeholders its notice may use (the mission
 * screen fills them). The no-lights hard block is fired too, at the mission's stop at the edge of
 * permanent shadow, so it enters the debrief and the notebook; the review always shows it.
 */
export const FIRED_RELATIONSHIPS = {
  'neutron-drill': [],
  'seismometer-quiet': ['distance', 'closest'],
  'cold-dark': [],
  'xray-cold': [],
  'no-lights': [],
} as const satisfies Record<string, readonly string[]>;

export type RelationshipId = keyof typeof FIRED_RELATIONSHIPS;

/** The ids the mission fires, in a fixed order: the Moon lessons the notebook can hold. */
export const LESSON_IDS = Object.keys(FIRED_RELATIONSHIPS) as RelationshipId[];

/** A relationship that happened. */
export interface RelationshipEvent {
  id: RelationshipId;
}

/**
 * A held use started. Cold and dark: the cold slowed it, on a rover without a heater.
 * Colder X-ray detector: the reading is faster because the rover is in shadow.
 */
export function onUseStart(start: { slowedByCold: boolean; fasterInShadow: boolean }): RelationshipEvent[] {
  const out: RelationshipEvent[] = [];
  if (start.slowedByCold) out.push({ id: 'cold-dark' });
  if (start.fasterInShadow) out.push({ id: 'xray-cold' });
  return out;
}

/**
 * A held use finished ('instrument-done', with the site where it started). The neutron spectrometer
 * finds, the drill confirms: a drill sample in the dark crater that found no ice, on a rover that does
 * not carry a neutron spectrometer (one carried but switched off does not count: the rover has the
 * answer aboard). A lucky sample that finds the ice teaches nothing about searching, so it does not fire.
 */
export function onUseDone(instrument: Instrument, site: UseSite, carried: readonly Instrument[], foundIce: boolean): RelationshipEvent[] {
  if (instrument === 'drill' && site.inDarkCrater && !foundIce && !carried.includes('neutron')) return [{ id: 'neutron-drill' }];
  return [];
}

/**
 * The short lines a held use still shows after its relationships were met: the first time in a mission
 * the relationship's notice explains the slowdown or speedup, so the short line is left out; later uses
 * get the short line, so the player still sees the hold time.
 */
export function shortUseLines(start: { slowedByCold: boolean; fasterInShadow: boolean }, fresh: readonly RelationshipEvent[]): { slowCold: boolean; fastShadow: boolean } {
  const ids = fresh.map((e) => e.id);
  return { slowCold: start.slowedByCold && !ids.includes('cold-dark'), fastShadow: start.fasterInShadow && !ids.includes('xray-cold') };
}

/** The seismometer station did something this step. The seismometer needs quiet ground: it recorded the moonquake, noisy. */
export function onSeismometer(outcome: SeismometerOutcome): RelationshipEvent[] {
  return outcome.kind === 'recorded' && outcome.record.quality === 'noisy' ? [{ id: 'seismometer-quiet' }] : [];
}

/** No lights, no permanent shadow: the mission stopped a rover without lights at the edge of permanent shadow. */
export function onShadowStop(p: { hasLights: boolean; stopped: boolean }): RelationshipEvent[] {
  return !p.hasLights && p.stopped ? [{ id: 'no-lights' }] : [];
}

/**
 * Add events to what this mission has met. Returns the new list and the events met for the first time
 * (their notices show now), in order, without repeats: each relationship once per mission.
 */
export function meet(met: readonly RelationshipEvent[], events: readonly RelationshipEvent[]): { met: RelationshipEvent[]; fresh: RelationshipEvent[] } {
  const ids = new Set(met.map((e) => e.id));
  const fresh: RelationshipEvent[] = [];
  for (const e of events) {
    if (ids.has(e.id)) continue;
    ids.add(e.id);
    fresh.push(e);
  }
  return { met: [...met, ...fresh], fresh };
}

/** The relationship ids met, once each, in the order first met (for the notebook). */
export function metIds(met: readonly RelationshipEvent[]): RelationshipId[] {
  return [...new Set(met.map((e) => e.id))];
}

/** Notebook ids plus newly met ones, once each, keeping the notebook's order (new ones at the end). */
export function addToNotebook(notebook: readonly string[], ids: readonly string[]): string[] {
  return [...new Set([...notebook, ...ids])];
}

/** The relationship's data entry. */
export function relationshipEntry(file: RelationshipsFile, id: string): Relationship | undefined {
  return file.relationships.find((r) => r.id === id);
}

/** The lesson for an event. Undefined if the data lacks it (validation catches that). */
export function lessonFor(file: RelationshipsFile, e: RelationshipEvent | { id: string }): RelationshipLesson | undefined {
  const r = relationshipEntry(file, e.id);
  return r && r.notice !== undefined && r.debrief !== undefined && r.answers !== undefined
    ? { notice: r.notice, debrief: r.debrief, answers: r.answers }
    : undefined;
}

/** One lesson in the debrief's "What the rover taught us". `fact` and `source` only with Mission history on. */
export interface TaughtLesson {
  id: RelationshipId;
  name: string;
  debrief: string;
  answers: string[];
  fact?: string;
  source?: string;
}

/**
 * The debrief's lessons: each relationship met this mission, once, in the order met. A mission result
 * without relationships (missing: none met) gives none; an id whose data has no lesson is skipped.
 */
export function taughtLessons(met: readonly RelationshipEvent[] | undefined, file: RelationshipsFile, history: boolean): TaughtLesson[] {
  return metIds(met ?? []).flatMap((id) => {
    const entry = relationshipEntry(file, id);
    const lesson = lessonFor(file, { id });
    if (!entry || !lesson) return [];
    const real = history ? { fact: entry.fact, source: entry.source } : {};
    return [{ id, name: entry.name, debrief: lesson.debrief, answers: lesson.answers, ...real }];
  });
}

// --- Notebook ---

/** One notebook entry: a discovered relationship with everything the player has learned about it. */
export interface NotebookEntry {
  id: RelationshipId;
  entry: Relationship;
  lesson: RelationshipLesson;
}

/**
 * The engineering notebook: the discovered Moon lessons in the order discovered, and the count of all
 * Moon lessons (undiscovered ones are counted, never named). Unknown or repeated ids are skipped.
 */
export function notebookView(notebook: readonly string[], file: RelationshipsFile): { entries: NotebookEntry[]; total: number } {
  const entries: NotebookEntry[] = [];
  for (const id of new Set(notebook)) {
    if (!(LESSON_IDS as readonly string[]).includes(id)) continue;
    const entry = relationshipEntry(file, id);
    const lesson = lessonFor(file, { id });
    if (entry && lesson) entries.push({ id: id as RelationshipId, entry, lesson });
  }
  return { entries, total: LESSON_IDS.filter((id) => lessonFor(file, { id })).length };
}

// --- Pre-launch review ---

/** What a build holds that the review predicates look at. */
export interface BuildFacts {
  instruments: Instrument[];
  costs: InstrumentCosts[];
  heater: boolean;
  lights: boolean;
}

export function buildFacts(parts: Part[]): BuildFacts {
  return {
    instruments: instrumentsOf(parts),
    costs: instrumentCosts(parts),
    heater: parts.some((p) => (p.effects.heat ?? 0) > 0),
    lights: parts.some((p) => (p.effects.lightRange ?? 0) > 0),
  };
}

/** Does a build trigger a relationship? 'risk': it can happen (the entry's review color); 'solved': the build has the answer (green); null: not relevant. */
export type BuildVerdict = 'risk' | 'solved' | null;

/** Per relationship, keyed by id like the event hooks: whether a build triggers it. */
export const BUILD_PREDICATES: Record<RelationshipId, (b: BuildFacts) => BuildVerdict> = {
  'neutron-drill': (b) => (!b.instruments.includes('drill') ? null : b.instruments.includes('neutron') ? 'solved' : 'risk'),
  // Only a held use can be slowed by the cold (mission.ts), and a cold-tolerant part never is.
  'cold-dark': (b) => (!b.costs.some((c) => c.useSeconds > 0 && !c.coldTolerant) ? null : b.heater ? 'solved' : 'risk'),
  'xray-cold': (b) => (b.instruments.includes('xray') ? 'risk' : null),
  'seismometer-quiet': (b) => (b.instruments.includes('seismometer') ? 'risk' : null),
  'no-lights': (b) => (b.lights ? null : 'risk'),
};

/** The ids whose predicate can say 'solved': their data needs a `reviewSolved` line. */
export const SOLVABLE_IDS: readonly RelationshipId[] = ['neutron-drill', 'cold-dark'];

export interface ReviewItem {
  id: string;
  color: ReviewColor;
  name: string;
  text: string;
  solved: boolean;
  hardBlock: boolean;
}

/**
 * The pre-launch review: the build's relationships that are in the notebook, plus hard blocks (always
 * shown, discovered or not), in data order. Relationships the build does not trigger are left out, so a
 * first build shows only its hard blocks. The player can always launch: the review only informs.
 */
export function reviewItems(build: Build, notebook: readonly string[], data: { parts: PartsFile; relationships: RelationshipsFile }): ReviewItem[] {
  const facts = buildFacts(selectedParts(build, data.parts));
  const known = new Set(notebook);
  return data.relationships.relationships.flatMap((r) => {
    if (!r.hardBlock && !known.has(r.id)) return [];
    const predicate = BUILD_PREDICATES[r.id as RelationshipId] as ((b: BuildFacts) => BuildVerdict) | undefined;
    const verdict = predicate?.(facts) ?? null;
    if (!verdict) return [];
    const solved = verdict === 'solved';
    return [{
      id: r.id,
      color: solved ? 'green' : r.review,
      name: r.name,
      text: solved ? (r.reviewSolved ?? r.reviewText) : r.reviewText,
      solved,
      hardBlock: r.hardBlock === true,
    }];
  });
}

// --- Validation ---

const KINDS = ['needs', 'conditions', 'conflicts', 'shares', 'wear'];
const COLORS = ['green', 'yellow', 'red'];

/** The {name} placeholders in a text. */
function placeholders(s: string | undefined): string[] {
  return [...(s ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
}

/**
 * relationships.json: unique ids, known parts, text present, a valid kind and review color, every fired
 * relationship present with its lesson and real fact, a build predicate for every entry, no variants
 * (the mission fires one lesson per relationship), and placeholders only where the mission fills them.
 */
export function relationshipProblems(file: RelationshipsFile, partIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0;
  const fired = FIRED_RELATIONSHIPS as Record<string, readonly string[]>;
  for (const r of file.relationships) {
    if (ids.has(r.id)) problems.push(`duplicate relationship id ${r.id}`);
    ids.add(r.id);
    if (r.world !== 'moon') problems.push(`relationship ${r.id} has unknown world ${String(r.world)}`);
    if (!KINDS.includes(r.kind)) problems.push(`relationship ${r.id} has unknown kind ${String(r.kind)}`);
    if (!COLORS.includes(r.review)) problems.push(`relationship ${r.id} has unknown review color ${String(r.review)}`);
    if (r.parts.length === 0) problems.push(`relationship ${r.id} names no parts`);
    for (const p of r.parts) if (!partIds.has(p)) problems.push(`relationship ${r.id} names unknown part ${p}`);
    if (!filled(r.name) || !filled(r.reviewText)) problems.push(`relationship ${r.id} needs a name and review text`);
    if (r.hardBlock && r.review !== 'red') problems.push(`relationship ${r.id} is a hard block, so its review is red`);
    if ('variants' in r) problems.push(`relationship ${r.id} has variants, but the mission fires one lesson per relationship`);
    if (!(r.id in BUILD_PREDICATES)) problems.push(`relationship ${r.id} has no build predicate, so the review cannot show it`);
    if (SOLVABLE_IDS.includes(r.id as RelationshipId) && !filled(r.reviewSolved)) problems.push(`relationship ${r.id} needs a reviewSolved line`);
    const allowed = fired[r.id] ?? [];
    for (const name of placeholders(r.notice)) {
      if (!allowed.includes(name)) problems.push(`relationship ${r.id} notice uses {${name}}, which the mission does not fill`);
    }
    for (const s of [r.name, r.reviewText, r.reviewSolved, r.debrief, r.fact, r.source, ...(r.answers ?? [])]) {
      for (const name of placeholders(s)) problems.push(`relationship ${r.id} uses {${name}} outside its notice`);
    }
    if (!(r.id in fired)) {
      if (!r.hardBlock) problems.push(`relationship ${r.id} is never fired by the mission and is not a hard block`);
      continue;
    }
    if (!filled(r.notice) || !filled(r.debrief)) problems.push(`relationship ${r.id} needs a notice and a debrief`);
    if (!r.answers || r.answers.length < 2 || !r.answers.every(filled)) problems.push(`relationship ${r.id} needs at least two answers`);
    if (!filled(r.fact) || !filled(r.source)) problems.push(`relationship ${r.id} needs a fact and a source`);
  }
  for (const id of LESSON_IDS) {
    if (!ids.has(id)) problems.push(`relationship ${id} is used by the mission but missing from relationships.json`);
  }
  return problems;
}
