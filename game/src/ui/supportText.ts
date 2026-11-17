// Desk wording for support hardware (Mars M5): an instrument's needs on its card, the reason a card is
// greyed, the warning when the bay holds an instrument whose support part is missing, and what the arm adds
// to the X-ray (its optional upgrade). Words from data/mars/text.json `support`; on a world without support
// slots there is nothing to say.
import type { PayloadProblem } from '../rules/payload';
import type { GameData, Part, SupportSlot } from '../rules/types';
import { fill } from './dom';

/** "Needs the robotic arm." for each support part the instrument needs, or null when it needs none (or the world has no words for it). */
export function needsText(needs: readonly SupportSlot[], data: GameData): string | null {
  const t = data.text.support;
  if (!t || needs.length === 0) return null;
  return needs.map((n) => fill(t.needs, { support: t[n] })).join(' ');
}

/** The warnings for instruments in the bay whose support part is missing, one per missing part. */
export function missingSupportWarnings(problems: readonly PayloadProblem[], data: GameData): string[] {
  return missingSupportPairs(problems, data).map((w) => w.full);
}

/** The same warnings, each with its short form for the desk's specification ("X-ray spectrometer needs the robotic arm"). */
export function missingSupportPairs(problems: readonly PayloadProblem[], data: GameData): { short: string; full: string }[] {
  const t = data.text.support;
  if (!t) return [];
  return problems.flatMap((p) => {
    if (p.kind !== 'needs') return [];
    const part: Part | undefined = data.parts.parts.find((x) => x.id === p.id);
    const vars = { part: part?.name ?? p.id, support: t[p.support] };
    return [{ short: fill(data.text.design.spec.warnSupport, vars), full: fill(t.missing, vars) }];
  });
}

/**
 * What the robotic arm adds, on the cards of the parts it upgrades (game-design.md, The X-ray spectrometer and
 * the robotic arm): the X-ray's card says what it gains with the arm, the arm's card what it gives. Only on a
 * world that offers the arm (tuning.instruments.arm); empty for every other part.
 */
export function armNotes(part: Part, data: GameData): string[] {
  const t = data.text.support;
  const arm = data.tuning.instruments.arm;
  if (!t || !arm) return [];
  const line = part.effects.instrument === 'xray' ? t.xrayWithArm : part.effects.arm === true ? t.armAdds : undefined;
  return line ? [fill(line, { reach: arm.reachM })] : [];
}
