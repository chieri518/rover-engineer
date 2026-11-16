import { describe, expect, it } from 'vitest';
import { loadGameData, worldGameData } from '../gameData';
import { buildLeads, buildSites, type Site, type SurveyFeatures } from '../rules/survey';
import { resolveSites } from '../rules/sites';
import type { Instrument } from '../rules/types';
import terrain from '../../public/terrain/terrain.json';
import marsTerrain from '../../public/terrain/mars/terrain.json';
import { briefingLines, foundNotice, hudLeadLine, kmText, leadView } from './surveyText';

const data = loadGameData();
const sites = buildSites(terrain.features as unknown as SurveyFeatures, data.tuning.milestones, data.text.survey.shadowedCraterName, resolveSites(data.sites.sites, terrain.features as never));
const leads = buildLeads(sites, data.tuning.survey);
const site = (name: string) => sites.find((s) => s.name === name)!;

describe('survey text', () => {
  it('writes km without a trailing zero', () => {
    expect(kmText(3)).toBe('3');
    expect(kmText(0.30000000000000004)).toBe('0.3');
    expect(kmText(2.5)).toBe('2.5');
  });

  it('briefs each lead as a rough direction and distance from the lander', () => {
    const lines = briefingLines(leads, terrain.landing.local, data);
    expect(lines).toHaveLength(4);
    for (const l of lines) expect(l).not.toMatch(/\{\w+\}/);
    expect(lines.join('\n')).toContain('Permanent shadow: about 3 km north.');
    expect(lines.join('\n')).toContain('Boulder field: about 0.3 km west-northwest.');
    expect(lines.join('\n')).toContain('Layered wall exposure: about 0.7 km south-southwest.');
    expect(lines.join('\n')).toContain('Young crater: about 0.5 km east-northeast.');
  });

  it('numbers the live lines under the map', () => {
    expect(hudLeadLine(leads[2]!, 2, terrain.landing.local, data)).toBe('3. Permanent shadow: 3 km N');
  });
});

describe('site notices', () => {
  const t = data.text.survey;
  const m = data.tuning.milestones;

  it('names the site with its own note, then what each instrument aboard can do there, in bay order', () => {
    expect(foundNotice(site('East crater'), ['drill', 'seismometer', 'xray'], data)).toEqual([
      `Located: East crater, ${t.siteNotes['east-crater']}`,
      t.siteLines['young-crater']!.drill,
      t.siteLines['young-crater']!.xray,
    ]);
    // The Documented sample line at young craters and rocky areas, with both the camera and the X-ray spectrometer aboard.
    const both = foundNotice(site('NW crater'), ['xray', 'camera'], data);
    expect(both).toHaveLength(3);
    expect(both[2]).toBe(t.siteLineDocumented.replace('{documentedRange}', String(m.documentedSampleRangeM)));
    expect(foundNotice(site('NW crater'), ['camera'], data)).toEqual([`Located: NW crater, ${t.siteNotes['nw-crater']}`]);
  });

  it('uses the kind\'s note for a site with none of its own; rocky areas match their sites.json entry by name', () => {
    expect(foundNotice(site('East cold trap'), ['neutron'], data)).toEqual([`Located: East cold trap, ${t.siteKindNotes['cold-trap']}`, t.siteLines['cold-trap']!.neutron]);
    expect(foundNotice(site('Rocky area 1'), ['camera', 'xray'], data)).toEqual([
      `Located: Rocky area 1, ${t.siteKindNotes['rocky-area']}`,
      t.siteLines['rocky-area']!.xray,
      t.siteLineDocumented.replace('{documentedRange}', String(m.documentedSampleRangeM)),
    ]);
    const rb = foundNotice(site('Rolled boulder'), ['camera'], data);
    expect(rb[1]).toBe(t.siteLines['rolled-boulder']!.camera!.replace('{photoRange}', String(m.boulderTrackPhotoRangeM)));
    expect(foundNotice(site('Hydrogen-rich ground'), ['neutron'], data)).toEqual([`Located: Hydrogen-rich ground, ${t.siteKindNotes['hidden-hydrogen']}`]);
  });

  it('keeps the plain line for sites with no note: viewpoints, the dark crater, and any site without a sites.json id (Mars)', () => {
    for (const s of sites.filter((x) => x.kind === 'viewpoint' || x.kind === 'shadowed-crater' || x.kind === 'crater-wall')) {
      expect(foundNotice(s, ['camera', 'neutron', 'drill'], data)).toEqual([t.found.replace('{name}', s.name)]);
    }
    const marsRocky: Site = { ...site('Rocky area 1'), siteId: undefined, name: 'Rocky area' };
    expect(foundNotice(marsRocky, ['xray'], data)).toEqual([t.found.replace('{name}', 'Rocky area')]);
  });

  it('fills every placeholder and names no lesson (the spoiler guard)', () => {
    const crater = t.shadowedCraterName.toLowerCase();
    const loads: Instrument[][] = [[], ['camera', 'drill', 'neutron'], ['xray', 'camera', 'drill'], ['neutron', 'seismometer', 'reflector']];
    for (const s of sites) {
      for (const aboard of loads) {
        const text = foundNotice(s, aboard, data).join(' ');
        expect(text).not.toMatch(/\{\w+\}/);
        const lower = text.toLowerCase().replaceAll(crater, '');
        for (const word of ['quiet', 'drive away', 'heater', 'shadow', 'light', 'temperature', 'far from', 'faster', 'sharper']) expect(lower, `${s.name}: ${word}`).not.toContain(word);
      }
    }
  });
});

describe('Mars site notices and leads (step 6c)', () => {
  const mars = worldGameData('mars');
  const mt = mars.text.survey;
  const mSites = buildSites(marsTerrain.features as unknown as SurveyFeatures, mars.tuning.milestones, mt.shadowedCraterName, resolveSites(mars.sites.sites, marsTerrain.features as never));
  const mSite = (name: string) => mSites.find((s) => s.name === name)!;
  const docRange = String(mars.tuning.milestones.documentedSampleRangeM);
  const ALL: Instrument[] = ['camera', 'drill', 'xray', 'organics', 'laser', 'radar', 'neutron', 'weather'];

  it('every Mars site names itself with a note and lines for the instruments aboard, placeholders filled', () => {
    for (const s of mSites.filter((x) => !x.hidden)) {
      const lines = foundNotice(s, ALL, mars);
      expect(lines[0], s.name).toMatch(/^Located: .+, /);
      expect(lines.join(' '), s.name).not.toMatch(/\{\w+\}/);
    }
    // The hydrated ground too, once found.
    expect(foundNotice(mSite('Hydrated ground'), ['neutron'], mars)[0]).toBe(`Located: Hydrated ground, ${mt.siteKindNotes['hidden-hydrogen']}`);
  });

  it('a site\'s own line comes before its kind\'s: the camera at Rocky area 2 (a crater with a rim), not Rocky area 1', () => {
    expect(foundNotice(mSite('Rocky area 2'), ['camera'], mars)).toEqual([`Located: Rocky area 2, ${mt.siteNotes['rocky-area-2']}`, mt.siteLinesById!['rocky-area-2']!.camera]);
    expect(foundNotice(mSite('Rocky area 1'), ['camera'], mars)).toEqual([`Located: Rocky area 1, ${mt.siteNotes['rocky-area-1']}`]);
  });

  it('the Documented sample line at the knobs, the Séítah edge and the delta foot; the flood boulder\'s photo only with the X-ray aboard', () => {
    const doc = mt.siteLineDocumented.replace('{documentedRange}', docRange);
    expect(foundNotice(mSite('WNW knob'), ['xray', 'camera'], mars).at(-1)).toBe(doc);
    expect(foundNotice(mSite('Delta foot'), ['xray', 'camera'], mars).at(-1)).toBe(doc);
    expect(foundNotice(mSite('Flood boulder'), ['camera'], mars)).toHaveLength(1);
    expect(foundNotice(mSite('Flood boulder'), ['camera', 'xray'], mars)).toEqual([
      `Located: Flood boulder, ${mt.siteKindNotes['flood-boulder']}`,
      mt.siteLines['flood-boulder']!.camera!.replace('{documentedRange}', docRange),
      mt.siteLines['flood-boulder']!.xray,
    ]);
  });

  it('the terrain features without a sites.json id read their own notes and lines (Séítah, the delta front)', () => {
    expect(foundNotice(mSite('Seitah'), ['drill', 'camera'], mars)).toEqual([`Located: Séítah, ${mt.featureNotes!.seitah}`, mt.featureLines!.seitah!.drill]);
    expect(foundNotice(mSite('Delta front'), ['camera', 'neutron'], mars)).toEqual([
      `Located: Delta front, ${mt.featureNotes!.deltaFront}`, mt.featureLines!.deltaFront!.camera, mt.featureLines!.deltaFront!.neutron,
    ]);
    expect(foundNotice(mSite('Octavia E. Butler Landing'), ALL, mars)).toEqual([`Located: Octavia E. Butler Landing, ${mt.featureNotes!.perseveranceLanding}`]);
  });

  it('the Mars notices name no Mars lesson (slope, level, flat, steep, dust, noise, generator, lights)', () => {
    for (const s of mSites) {
      const text = foundNotice(s, ALL, mars).join(' ').toLowerCase();
      for (const word of ['slope', 'level', 'flat', 'steep', 'dust', 'noise', 'generator', 'light']) expect(text, `${s.name}: ${word}`).not.toContain(word);
    }
  });

  it('the open leads, nearest first, each arrow with its distance; the numbers stay the briefing\'s', () => {
    const fresh = buildSites(marsTerrain.features as unknown as SurveyFeatures, mars.tuning.milestones, mt.shadowedCraterName, resolveSites(mars.sites.sites, marsTerrain.features as never));
    const leads = buildLeads(fresh, mars.tuning.survey);
    const landing = marsTerrain.landing.local;
    const v = leadView(leads, landing, mars);
    expect(v.lines).toHaveLength(4);
    expect(v.nearest).toBe(0);
    // From the lander the boulder field (lead 3) is nearest, then the young crater (lead 4).
    expect(v.arrows.map((a) => a.label)).toEqual(['3', '4', '2', '1']);
    expect(v.lines[0]).toBe(hudLeadLine(leads[2]!, 2, landing, mars));
    expect(v.arrows[0]).toMatchObject({ nearest: true, distance: '0.6 km' });
    expect(v.arrows.slice(1).some((a) => a.nearest)).toBe(false);
    // A found lead drops out; when all are found nothing stands out.
    leads[2]!.site.discovered = true;
    expect(leadView(leads, landing, mars).arrows.map((a) => a.label)).toEqual(['4', '2', '1']);
    for (const l of leads) l.site.discovered = true;
    expect(leadView(leads, landing, mars)).toEqual({ arrows: [], lines: [], nearest: null });
  });

  it('on the Moon a lead arrow carries no distance (no leadDistance text)', () => {
    const v = leadView(buildLeads(buildSites(terrain.features as unknown as SurveyFeatures, data.tuning.milestones, data.text.survey.shadowedCraterName, resolveSites(data.sites.sites, terrain.features as never)), data.tuning.survey), terrain.landing.local, data);
    expect(v.arrows.every((a) => a.distance === undefined)).toBe(true);
  });
});
