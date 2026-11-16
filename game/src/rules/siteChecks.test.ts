import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import { scatterBoulders, scatterSiteBoulders, type Boulder } from './boulders';
import { emptySiteProgress, noteReading, siteDone, siteRocks, stepSurveyRun, type SurveyRun } from './siteChecks';
import { resolveSites } from './sites';
import type { Instrument } from './types';

const data = loadGameData();
const xray = data.tuning.instruments.xray;
const rocks = new Map([['east-crater', new Set(['noritic-anorthosite', 'ferroan-anorthosite'])], ['rolled-boulder', new Set(['magnesian-norite'])]]);
const all: Instrument[] = ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'];

describe('site checks: done from what the rover did at the site', () => {
  it('a young crater needs every rock type its boulders hold read there (X-ray) and a counted ejecta sample (drill)', () => {
    const p = emptySiteProgress();
    const done = (carried: Instrument[]) => siteDone('young-crater', 'east-crater', carried, p, rocks);
    expect(done(['xray'])).toBe(false);
    noteReading(p, { x: 0, z: 0, radius: 1, site: 'east-crater' }, 'noritic-anorthosite');
    expect(done(['xray'])).toBe(false);
    noteReading(p, { x: 1, z: 0, radius: 1, site: 'east-crater' }, 'ferroan-anorthosite');
    expect(done(['xray'])).toBe(true);
    expect(done(['xray', 'drill'])).toBe(false);
    p.drilled.add('east-crater');
    expect(done(['xray', 'drill'])).toBe(true);
    expect(done(['drill'])).toBe(true);
    // The camera has nothing of its own to do at a young crater (Documented sample is any read boulder).
    expect(done(['camera', 'drill'])).toBe(true);
  });

  it('a rover that can do nothing at a site never shows its check', () => {
    const p = emptySiteProgress();
    p.drilled.add('east-crater');
    p.surveyed.add('east-cold-trap');
    p.photographed.add('rolled-boulder');
    expect(siteDone('young-crater', 'east-crater', ['camera', 'neutron', 'seismometer'], p, rocks)).toBe(false);
    expect(siteDone('cold-trap', 'east-cold-trap', ['camera', 'drill', 'xray'], p, rocks)).toBe(false);
    expect(siteDone('rolled-boulder', 'rolled-boulder', ['drill', 'neutron'], p, rocks)).toBe(false);
    expect(siteDone('rolled-boulder', 'rolled-boulder', [], p, rocks)).toBe(false);
    // A site with no boulders gives the X-ray spectrometer nothing to do there.
    expect(siteDone('young-crater', 'nowhere', ['xray'], p, rocks)).toBe(false);
  });

  it('a cold trap once surveyed; the rolled boulder once read and photographed, whichever the rover can', () => {
    const p = emptySiteProgress();
    expect(siteDone('cold-trap', 'east-cold-trap', ['neutron'], p, rocks)).toBe(false);
    p.surveyed.add('east-cold-trap');
    expect(siteDone('cold-trap', 'east-cold-trap', ['neutron'], p, rocks)).toBe(true);
    const rb = (carried: Instrument[]) => siteDone('rolled-boulder', 'rolled-boulder', carried, p, rocks);
    p.photographed.add('rolled-boulder');
    expect(rb(['camera'])).toBe(true);
    expect(rb(['camera', 'xray'])).toBe(false);
    noteReading(p, { x: 0, z: 0, radius: 1.75, site: 'rolled-boulder', rolled: true }, 'magnesian-norite');
    expect(rb(['xray'])).toBe(true);
    expect(rb(['camera', 'xray'])).toBe(true);
  });

  it('no check for other kinds, sites without a sites.json id, or a reading of a boulder with no site', () => {
    const p = emptySiteProgress();
    p.surveyed.add('hidden-hydrogen');
    expect(siteDone('hidden-hydrogen', 'hidden-hydrogen', all, p, rocks)).toBe(false);
    expect(siteDone('viewpoint', 'rim-1', all, p, rocks)).toBe(false);
    expect(siteDone('cold-trap', undefined, all, p, rocks)).toBe(false);
    noteReading(p, { x: 0, z: 0, radius: 1 } satisfies Boulder, 'regolith-breccia');
    expect(p.rocksRead.size).toBe(0);
  });

  it('reads the rock types each real site holds from the mission\'s boulders', () => {
    const sites = resolveSites(data.sites.sites, terrain.features);
    const ra = sites.filter((s) => s.kind === 'rocky-area');
    const boulders = [
      ...scatterBoulders(terrain.features.rockyAreas.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m, site: ra.find((s) => s.name === a.name)?.id })), data.tuning.boulders),
      ...scatterSiteBoulders(sites, data.tuning.boulders),
    ];
    const present = siteRocks(boulders, xray, data.sites.sites);
    expect([...present.get('rolled-boulder')!]).toEqual(['magnesian-norite']);
    for (const id of ['rocky-area-1', 'rocky-area-2', 'nw-crater', 'east-crater', 'se-crater']) {
      const suite = xray.suites.find((s) => s.id === data.sites.sites.find((x) => x.id === id)!.rockSuite)!;
      const held = present.get(id);
      expect(held, id).toBeDefined();
      for (const r of held!) expect(suite.rocks.map((x) => x.id), id).toContain(r);
    }
  });
});

describe('site checks: the cold trap survey run', () => {
  const step = (run: SurveyRun | null, on: boolean, drivenM: number, here: string[] = [], poweredDown = false) =>
    stepSurveyRun(run, { on, poweredDown, drivenM, here }, 50);

  it('surveys every cold trap touched by an unbroken switched-on drive of the meters, touched anywhere on the way', () => {
    let r = step(null, true, 10, ['east-cold-trap']);
    expect(r.surveyed).toEqual([]);
    r = step(r.run, true, 39);
    expect(r.surveyed).toEqual([]);
    r = step(r.run, true, 1);
    expect(r.surveyed).toEqual(['east-cold-trap']);
    // Later traps in the same run count at once, past the milestone's last stage too.
    r = step(r.run, true, 5, ['south-cold-trap']);
    expect(r.surveyed).toEqual(['east-cold-trap', 'south-cold-trap']);
  });

  it('switching off starts again; a power-down pauses', () => {
    let r = step(null, true, 30, ['east-cold-trap']);
    r = step(r.run, true, 10, [], true);
    expect(r.run!.meters).toBe(30);
    r = step(r.run, false, 0);
    expect(r.run).toBeNull();
    r = step(r.run, true, 45);
    expect(r.surveyed).toEqual([]);
    r = step(r.run, true, 10);
    expect(r.surveyed).toEqual([]); // the trap was touched in the earlier run, not this one
  });
});
