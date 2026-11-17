// Wording for the orbital survey leads (the list under the minimap) and for the
// notice when the rover locates a site.
import { distanceToArea, leadBearing, type Lead, type Point, type Site } from '../rules/survey';
import type { GameData, Instrument, SiteKind } from '../rules/types';
import { fill } from './dom';
import type { LeadArrow } from './minimap';

/** "0.3", "3", "3.5": km without a trailing ".0". */
export function kmText(km: number): string {
  return String(Number(km.toFixed(1)));
}

/** The live line under the minimap: "1. Permanent shadow: 2.8 km N". Numbered by the lead's place in the list. */
export function hudLeadLine(lead: Lead, index: number, rover: Point, data: GameData): string {
  const t = data.text.survey;
  const b = leadBearing(lead, rover, data.tuning.survey);
  return `${index + 1}. ${fill(t.hudLead, { name: t.leads[lead.id]?.name ?? lead.site.name, distance: kmText(b.distanceKm), direction: t.compassShort[b.compass] ?? '' })}`;
}

/**
 * Mars (step 6c): the open leads as the minimap shows them, nearest first. Each arrow points along the
 * lead's bearing (toward the area's center, or the delta front's nearest point, as its line says) and
 * carries its distance; the nearest arrow and line stand out, so a first-time player sees where to go.
 * The numbers stay the leads' places in the briefing. `nearest`: the index of the nearest line (0), or
 * null when every lead is found.
 */
export function leadView(leads: readonly Lead[], rover: Point, data: GameData): { arrows: LeadArrow[]; lines: string[]; nearest: number | null } {
  const t = data.text.survey;
  const open = leads
    .map((l, i) => ({ l, i, b: leadBearing(l, rover, data.tuning.survey), d: distanceToArea(l.site.area, rover) }))
    .filter(({ l }) => !l.site.discovered)
    .sort((a, b) => a.d - b.d || a.i - b.i);
  return {
    arrows: open.map(({ i, b }, k) => ({
      label: String(i + 1),
      azimuth: b.azimuth,
      ...(t.leadDistance ? { distance: fill(t.leadDistance, { distance: kmText(b.distanceKm) }) } : {}),
      ...(k === 0 ? { nearest: true } : {}),
    })),
    lines: open.map(({ l, i }) => hudLeadLine(l, i, rover, data)),
    nearest: open.length ? 0 : null,
  };
}

/**
 * Where the site notice adds "photograph a boulder after reading it" (camera and X-ray spectrometer
 * aboard): young craters and rocky areas; on Mars also the knobs, the Séítah edge and the delta foot,
 * whose boulders Documented sample counts as well (the flood boulder has its own camera line).
 */
const DOCUMENTED_KINDS: readonly string[] = ['young-crater', 'rocky-area', 'knob', 'seitah-edge', 'delta-foot'];

/** A site line that needs another instrument aboard to mean anything (the flood boulder's photo is of a read boulder). */
const LINE_NEEDS: Partial<Record<string, Partial<Record<Instrument, Instrument>>>> = {
  'flood-boulder': { camera: 'xray' },
};

/**
 * The notice for a newly located site, one line per entry. A sites.json site with a note (its own in
 * siteNotes, else its kind's in siteKindNotes) reads "Located: {name}, {note}", then what each
 * instrument aboard can do there (siteLines, in bay order), then, at young craters and rocky areas with
 * both the camera and the X-ray spectrometer aboard, the Documented sample line. Instrument-aware but
 * lesson-blind: the lines say what an instrument can do, never what might go wrong. A line of the
 * site's own (siteLinesById) comes before its kind's. A terrain feature with no sites.json id reads its
 * note and lines by survey key (featureNotes, featureLines: Mars's Séítah, delta front, viewpoints and
 * landing site). Any other site (the Moon's viewpoints, the dark crater) keeps the plain "Located" line.
 */
export function foundNotice(site: Site, aboard: readonly Instrument[], data: GameData): string[] {
  const t = data.text.survey;
  const m = data.tuning.milestones;
  const name = t.siteNames?.[site.name] ?? site.name;
  const kind = site.kind as SiteKind;
  const note = site.siteId ? t.siteNotes[site.siteId] ?? t.siteKindNotes[kind] : t.featureNotes?.[site.key];
  if (!note) return [fill(t.found, { name })];
  const vars = { photoRange: m.boulderTrackPhotoRangeM, documentedRange: m.documentedSampleRangeM };
  const own = site.siteId ? t.siteLinesById?.[site.siteId] : t.featureLines?.[site.key];
  const kindLines = site.siteId ? t.siteLines[kind] : undefined;
  const lines = aboard.flatMap((i) => {
    const needs = LINE_NEEDS[kind]?.[i];
    if (needs && !aboard.includes(needs)) return [];
    const line = own?.[i] ?? kindLines?.[i];
    return line ? [fill(line, vars)] : [];
  });
  if (site.siteId && DOCUMENTED_KINDS.includes(site.kind) && aboard.includes('camera') && aboard.includes('xray')) lines.push(fill(t.siteLineDocumented, vars));
  return [fill(t.foundNote, { name, note }), ...lines];
}
