// Events on screen: wording for flare, moonquake and impact notices. When and how much they hurt is
// in rules/events.ts and rules/mission.ts; numbers are in data/events.json.
import type { MissionNotice } from '../rules/mission';
import type { RealFlare, TextFile } from '../rules/types';
import { formatFlareDate } from '../rules/events';
import { fill } from '../ui/dom';

export function flareWarningText(flare: RealFlare, text: TextFile): string {
  return fill(text.warnings.flareWarning, { class: flare.class, date: formatFlareDate(flare.date) });
}

/** The notice for a one-off mission event; flare warnings are shown separately with a countdown bar. */
export function noticeText(notice: MissionNotice, text: TextFile): { message: string; tone: 'warn' | 'good' } | null {
  const w = text.warnings;
  switch (notice.kind) {
    case 'flare-warning':
      return null;
    case 'flare-hit':
      return notice.protected ? { message: w.flareSafe, tone: 'good' } : { message: w.flareHit, tone: 'warn' };
    case 'quake':
      return { message: w.quake, tone: 'warn' };
    case 'impact':
      return { message: w.impact, tone: 'warn' };
  }
}
