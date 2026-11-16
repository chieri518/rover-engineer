// Wording for the orbital survey leads: the landing briefing and the list under the minimap.
import { leadBearing, type Lead, type Point } from '../rules/survey';
import type { GameData } from '../rules/types';
import { fill } from './dom';

/** "0.3", "3", "3.5": km without a trailing ".0". */
export function kmText(km: number): string {
  return String(Number(km.toFixed(1)));
}

/** One briefing line per lead, with direction and distance from the lander. */
export function briefingLines(leads: Lead[], landing: Point, data: GameData): string[] {
  const t = data.text.survey;
  return leads.map((l) => {
    const b = leadBearing(l, landing, data.tuning.survey);
    const name = t.leads[l.id]?.name ?? l.site.name;
    return fill(t.lead, { name, distance: kmText(b.distanceKm), direction: t.compass[b.compass] ?? '', source: t.leads[l.id]?.source ?? '' });
  });
}

/** The live line under the minimap: "1. Permanent shadow: 2.8 km N". Numbered by the lead's place in the list. */
export function hudLeadLine(lead: Lead, index: number, rover: Point, data: GameData): string {
  const t = data.text.survey;
  const b = leadBearing(lead, rover, data.tuning.survey);
  return `${index + 1}. ${fill(t.hudLead, { name: t.leads[lead.id]?.name ?? lead.site.name, distance: kmText(b.distanceKm), direction: t.compassShort[b.compass] ?? '' })}`;
}
