// Desk wording for support hardware (Mars M5): an instrument's needs on its card, the reason a card is
// greyed, and the warning when the bay holds an instrument whose support part is missing. Words from
// data/mars/text.json `support`; on a world without support slots there is nothing to say.
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
  const t = data.text.support;
  if (!t) return [];
  return problems.flatMap((p) => {
    if (p.kind !== 'needs') return [];
    const part: Part | undefined = data.parts.parts.find((x) => x.id === p.id);
    return [fill(t.missing, { part: part?.name ?? p.id, support: t[p.support] })];
  });
}
