import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { buildLeads, buildSites, type Site, type SurveyFeatures } from '../rules/survey';
import { resolveSites } from '../rules/sites';
import type { Instrument } from '../rules/types';
import terrain from '../../public/terrain/terrain.json';
import { briefingLines, foundNotice, hudLeadLine, kmText } from './surveyText';

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
