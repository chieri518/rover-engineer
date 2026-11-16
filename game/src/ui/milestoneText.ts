// Wording for milestone pop-ups and the debrief, from text.json and milestones.json.
import type { Missed, Reached } from '../rules/milestones';
import type { MissionResult } from '../rules/payout';
import type { BusSlot, GameData, Milestone, MilestoneCategory, TextFile } from '../rules/types';
import { fill, money } from './dom';
import type { MilestoneCard } from './hud';
import { missionVars } from './tutorialText';

export function categoryLabel(c: MilestoneCategory, text: TextFile): string {
  const t = text.milestone;
  return { capability: t.categoryCapability, scientific: t.categoryScientific, record: t.categoryRecord, picture: t.categoryPicture }[c];
}

/** The summary line with its placeholders filled ({meters} for Odometer, {share} for Mapper). */
export function milestoneSummary(m: Milestone, stage = 1): string {
  const tr = m.trigger;
  return fill(m.summary, {
    meters: tr.type === 'distance' || tr.type === 'night-distance' ? (tr.meters[stage - 1] ?? 0) : 0,
    share: tr.type === 'explore' ? Math.round(tr.share * 1000) / 10 : 0,
  });
}

/** "500 m", "1 km": an Odometer distance in plain units. */
function distanceText(m: number): string {
  return m >= 1000 ? `${+(m / 1000).toFixed(1)} km` : `${m} m`;
}

/** "2, 3 and 4". */
function listText(items: (string | number)[], text: TextFile): string {
  const words = items.map(String);
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')}${text.ticket.and}${words[words.length - 1]}`;
}

/**
 * The how-to-earn line with its numbers filled from the trigger and the tuning, so it cannot drift from
 * the rules: {distances} (Odometer), {share} (Mapper), {depth} (Crater descent), {days}, {minDistance}
 * (the near-lander zone: drill samples and stations), {sampleSpacing}, {earthMinDistance}, {sites},
 * {meters} (a transect), {rocks} (Rock collection), {range} (boulder photos), {percent} (the ice signal)
 * and {withinM} (Science station). Undefined for a milestone with no how-to line (Mars).
 */
export function milestoneHowTo(m: Milestone, data: GameData): string | undefined {
  if (!m.howTo) return undefined;
  const tr = m.trigger;
  const mt = data.tuning.milestones;
  const vars: Record<string, string | number> = {
    ...missionVars(data),
    minDistance: mt.sampleMinDistanceM,
    depth: mt.craterDescentDepthM,
    percent: Math.round(data.tuning.instruments.neutron.iceSignalShare * 100),
  };
  if (tr.type === 'distance' || tr.type === 'night-distance') vars.distances = listText(tr.meters.map(distanceText), data.text);
  if (tr.type === 'explore') vars.share = Math.round(tr.share * 1000) / 10;
  if ((tr.type === 'drill' || tr.type === 'transect' || tr.type === 'reading') && tr.sites !== undefined) vars.sites = tr.sites;
  if (tr.type === 'transect') vars.meters = tr.meters;
  if (tr.type === 'reading' && tr.rocks) vars.rocks = listText(tr.rocks, data.text);
  if (tr.type === 'photo' && tr.target === 'rolled-boulder') vars.range = mt.boulderTrackPhotoRangeM;
  if (tr.type === 'photo' && tr.target === 'read-boulder') vars.range = mt.documentedSampleRangeM;
  if (tr.type === 'deploy' && tr.near) vars.withinM = tr.near.withinM;
  return fill(m.howTo, vars);
}

export function milestoneTitle(m: Milestone, stage: number, stages: number, text: TextFile): string {
  return stages > 1 ? fill(text.milestone.stage, { name: m.name, stage, stages }) : m.name;
}

export function milestoneCard(r: Reached, data: GameData, history: boolean, recordsHeld: readonly string[]): MilestoneCard {
  const { text } = data;
  const m = r.milestone;
  const held = m.record && recordsHeld.includes(m.id);
  const label = [text.milestone.reached, categoryLabel(m.category, text), m.record && m.category !== 'record' ? text.milestone.record : null]
    .filter(Boolean)
    .join(' · ');
  return {
    label,
    title: milestoneTitle(m, r.stage, r.stages, text),
    body: milestoneSummary(m, r.stage),
    reward: held ? null : fill(text.milestone.reward, { money: money(m.money, text), rp: m.rp }),
    note: held ? text.milestone.recordHeld : undefined,
    // One fact per milestone: staged milestones show it on the first stage only.
    fact: history && r.stage === 1 ? m.fact : undefined,
  };
}

export function missedText(missed: Missed, text: TextFile): string {
  const names = missed.missing.map((s) => (s in text.instrumentText ? s : text.slots[s as BusSlot].toLowerCase()));
  return fill(text.milestone.notCredited, { name: missed.milestone.name, missing: names.join(text.ticket.and) });
}

/** "Out of energy", or "Destroyed: the rover rolled over". */
export function causeText(result: Pick<MissionResult, 'cause' | 'detail'>, text: TextFile): string {
  if (result.detail === 'rollover') return text.debrief.rollover;
  return result.cause ? text.causes[result.cause] : '';
}
