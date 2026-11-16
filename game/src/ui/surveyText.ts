// Wording for the orbital survey leads (the landing briefing and the list under the minimap) and for the
// notice when the rover locates a site.
import { leadBearing, type Lead, type Point, type Site } from '../rules/survey';
import type { GameData, Instrument, SiteKind } from '../rules/types';
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

/** Where the site notice adds "photograph a boulder after reading it" (camera and X-ray spectrometer aboard). */
const DOCUMENTED_KINDS: readonly string[] = ['young-crater', 'rocky-area'];

/**
 * The notice for a newly located site, one line per entry. A sites.json site with a note (its own in
 * siteNotes, else its kind's in siteKindNotes) reads "Located: {name}, {note}", then what each
 * instrument aboard can do there (siteLines, in bay order), then, at young craters and rocky areas with
 * both the camera and the X-ray spectrometer aboard, the Documented sample line. Instrument-aware but
 * lesson-blind: the lines say what an instrument can do, never what might go wrong. Any other site
 * (Mars, viewpoints, the dark crater) keeps the plain "Located" line.
 */
export function foundNotice(site: Site, aboard: readonly Instrument[], data: GameData): string[] {
  const t = data.text.survey;
  const m = data.tuning.milestones;
  const name = t.siteNames?.[site.name] ?? site.name;
  const kind = site.kind as SiteKind;
  const note = site.siteId ? t.siteNotes[site.siteId] ?? t.siteKindNotes[kind] : undefined;
  if (!note) return [fill(t.found, { name })];
  const vars = { photoRange: m.boulderTrackPhotoRangeM, documentedRange: m.documentedSampleRangeM };
  const lines = aboard.flatMap((i) => {
    const line = t.siteLines[kind]?.[i];
    return line ? [fill(line, vars)] : [];
  });
  if (DOCUMENTED_KINDS.includes(site.kind) && aboard.includes('camera') && aboard.includes('xray')) lines.push(fill(t.siteLineDocumented, vars));
  return [fill(t.foundNote, { name, note }), ...lines];
}
