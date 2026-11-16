// Milestone lists for the desk and the debrief: what each instrument can earn (desk cards, names only),
// the debrief's groups (by instrument), its "Not reached" list, and the instrument log's rock count. Pure.
import type { EarnedMilestone } from './payout';
import { rockTypeTotal } from './instruments';
import { meetsRequirements, requiredInstruments } from './rover';
import type { Instrument, InstrumentTuning, Milestone, Part } from './types';

/** The milestones an instrument can earn, in catalog order: those that require it, combos included. */
export function instrumentMilestones(instrument: Instrument, milestones: readonly Milestone[]): Milestone[] {
  return milestones.filter((m) => requiredInstruments(m).includes(instrument));
}

/** Where a milestone goes in the debrief: no instrument (the rover), one instrument, or several (together). */
export type MilestoneGroupKey = { kind: 'rover' } | { kind: 'instrument'; instrument: Instrument } | { kind: 'combo' };

export interface MilestoneGroup {
  key: MilestoneGroupKey;
  milestones: Milestone[]; // in catalog order
}

export function milestoneGroupKey(m: Milestone): MilestoneGroupKey {
  const insts = requiredInstruments(m);
  if (insts.length === 0) return { kind: 'rover' };
  if (insts.length === 1) return { kind: 'instrument', instrument: insts[0]! };
  return { kind: 'combo' };
}

/**
 * Group milestones for the debrief: the rover's own first, then one group per instrument in bay order
 * (an instrument not in the bay, which cannot normally earn, after those), then the combos. Empty groups
 * are left out; each group keeps the given order.
 */
export function groupMilestones(milestones: readonly Milestone[], bay: readonly Instrument[]): MilestoneGroup[] {
  const rover: Milestone[] = [];
  const combo: Milestone[] = [];
  const byInstrument = new Map<Instrument, Milestone[]>(bay.map((i) => [i, []]));
  for (const m of milestones) {
    const key = milestoneGroupKey(m);
    if (key.kind === 'rover') rover.push(m);
    else if (key.kind === 'combo') combo.push(m);
    else {
      const list = byInstrument.get(key.instrument) ?? [];
      list.push(m);
      byInstrument.set(key.instrument, list);
    }
  }
  const groups: MilestoneGroup[] = [{ key: { kind: 'rover' }, milestones: rover }];
  for (const [instrument, list] of byInstrument) groups.push({ key: { kind: 'instrument', instrument }, milestones: list });
  groups.push({ key: { kind: 'combo' }, milestones: combo });
  return groups.filter((g) => g.milestones.length > 0);
}

/** Stages earned this mission (0 when not earned). */
export function stagesEarned(earned: readonly EarnedMilestone[], id: string): number {
  const e = earned.find((x) => x.id === id);
  return e ? (e.stages ?? 1) : 0;
}

/** The earned milestones that need this instrument (alone or in a combo), in catalog order. */
export function earnedWith(instrument: Instrument, milestones: readonly Milestone[], earned: readonly EarnedMilestone[]): Milestone[] {
  return instrumentMilestones(instrument, milestones).filter((m) => stagesEarned(earned, m.id) > 0);
}

/**
 * "Not reached" (game-design.md, M11 and the Phase 0 rules): the milestones this rover could have earned
 * and did not. Only milestones that need at least one instrument (capability milestones need no parts
 * and would always be listed); the rover carried every part the milestone requires (slots too: Ice
 * deposit located needs lights); a record already held at launch is left out; a staged milestone with
 * any stage earned is not listed. Ordered by the debrief's groups (bay order, then combos).
 */
export function notReached(
  milestones: readonly Milestone[],
  parts: readonly Part[],
  earned: readonly EarnedMilestone[],
  recordsHeldAtLaunch: readonly string[],
  bay: readonly Instrument[],
): Milestone[] {
  const list = milestones.filter((m) =>
    requiredInstruments(m).length > 0
    && meetsRequirements(parts as Part[], m)
    && !(m.record && recordsHeldAtLaunch.includes(m.id))
    && stagesEarned(earned, m.id) === 0);
  return groupMilestones(list, bay).flatMap((g) => g.milestones);
}

/** Rock types read this mission out of all the types the rock suites hold (total 0: no suites, as on Mars). */
export function rockTypeTally(rocksRead: readonly { rock: string }[], xray: InstrumentTuning['xray']): { count: number; total: number } {
  return { count: new Set(rocksRead.map((r) => r.rock)).size, total: rockTypeTotal(xray) };
}
