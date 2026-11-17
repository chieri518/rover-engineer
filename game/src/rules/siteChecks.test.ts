import { describe, expect, it } from 'vitest';
import { loadGameData, worldGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import marsTerrain from '../../public/terrain/mars/terrain.json';
import { scatterBoulders, scatterSiteBoulders, type Boulder } from './boulders';
import type { Zone } from './milestones';
import {
  craterWallSites, emptySiteProgress, MARS_CHECK_KINDS, marsSiteDone, marsSiteTasks, marsSitesIn, noteReading, noteSiteReading, siteDone, siteRocks,
  stagedTransectMeters, stepSurveyRun, type SurveyRun,
} from './siteChecks';
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

  it('the low-energy switch-off pauses, like a power-down', () => {
    let r = step(null, true, 30, ['east-cold-trap']);
    r = stepSurveyRun(r.run, { on: false, poweredDown: false, drivenM: 15, here: [], autoOff: true }, 50);
    expect(r.run!.meters).toBe(30);
    r = step(r.run, true, 20);
    expect(r.surveyed).toEqual(['east-cold-trap']);
  });
});

describe('site checks on Mars (step 6c): what this rover can do at the site, once', () => {
  const rocksM = new Map([
    ['east-crater', new Set(['maaz-basalt', 'salt-veined-basalt'])],
    ['rocky-area-1', new Set(['salt-veined-basalt'])],
    ['wnw-knob', new Set(['maaz-basalt'])],
    ['seitah-edge', new Set(['olivine-cumulate'])],
    ['delta-foot', new Set(['lake-mudstone'])],
    ['flood-boulder', new Set(['flood-conglomerate'])],
  ]);
  const ctx = { rocks: rocksM, craterWalls: new Set(['east-crater', 'rocky-area-2']) };
  const b = (site: string): Boulder => ({ x: 0, z: 0, radius: 1, site });

  it('a young crater: one reading per reading instrument (not every rock type), a radar profile, a sample, a rim photo', () => {
    const p = emptySiteProgress();
    const done = (carried: Instrument[]) => marsSiteDone('young-crater', 'east-crater', carried, p, ctx);
    expect(marsSiteTasks('young-crater', 'east-crater', ['camera', 'xray', 'organics', 'laser', 'radar', 'drill', 'neutron', 'weather'], ctx))
      .toEqual(['camera', 'xray', 'organics', 'laser', 'radar', 'drill']);
    expect(done(['xray'])).toBe(false);
    noteReading(p, b('east-crater'), 'maaz-basalt');
    expect(done(['xray'])).toBe(true); // one type of the two is enough (generous)
    expect(done(['xray', 'organics', 'laser'])).toBe(false);
    noteSiteReading(p, 'east-crater', 'organics');
    noteSiteReading(p, 'east-crater', 'laser');
    expect(done(['xray', 'organics', 'laser'])).toBe(true);
    expect(done(['radar'])).toBe(false);
    p.profiled.add('east-crater');
    expect(done(['radar'])).toBe(true);
    expect(done(['drill', 'camera'])).toBe(false);
    p.drilled.add('east-crater');
    p.photographed.add('east-crater');
    expect(done(['drill', 'camera'])).toBe(true);
    // The neutron spectrometer and the weather mast have nothing to do at a crater.
    expect(done(['neutron', 'weather'])).toBe(false);
    expect(marsSiteTasks('young-crater', 'east-crater', ['neutron', 'weather'], ctx)).toEqual([]);
  });

  it('the camera counts only at a crater with a rim: Rocky area 2, not Rocky area 1\'s block field', () => {
    expect(marsSiteTasks('rocky-area', 'rocky-area-1', ['camera', 'xray'], ctx)).toEqual(['xray']);
    expect(marsSiteTasks('rocky-area', 'rocky-area-2', ['camera'], ctx)).toEqual(['camera']);
  });

  it('a knob: readings only; the Séítah edge and the delta foot: readings, a sample and a drive through their zone', () => {
    expect(marsSiteTasks('knob', 'wnw-knob', ['camera', 'xray', 'organics', 'laser', 'radar', 'drill', 'neutron'], ctx)).toEqual(['xray', 'organics', 'laser']);
    const all: Instrument[] = ['camera', 'xray', 'organics', 'laser', 'radar', 'drill', 'neutron'];
    expect(marsSiteTasks('seitah-edge', 'seitah-edge', all, ctx)).toEqual(['xray', 'organics', 'laser', 'drill', 'radar', 'neutron']);
    expect(marsSiteTasks('delta-foot', 'delta-foot', all, ctx)).toEqual(['xray', 'organics', 'laser', 'drill', 'radar', 'neutron']);
    const p = emptySiteProgress();
    noteReading(p, b('seitah-edge'), 'olivine-cumulate');
    p.drilled.add('seitah-edge');
    expect(marsSiteDone('seitah-edge', 'seitah-edge', ['xray', 'drill'], p, ctx)).toBe(true);
    expect(marsSiteDone('seitah-edge', 'seitah-edge', ['xray', 'drill', 'neutron'], p, ctx)).toBe(false);
    p.surveyed.add('seitah-edge');
    expect(marsSiteDone('seitah-edge', 'seitah-edge', ['xray', 'drill', 'neutron'], p, ctx)).toBe(true);
    // The laser can read the delta cliff even where no boulder lies.
    const bare = { ...ctx, rocks: new Map() };
    expect(marsSiteTasks('delta-foot', 'delta-foot', ['laser', 'xray'], bare)).toEqual(['laser']);
    noteSiteReading(p, 'delta-foot', 'laser');
    expect(marsSiteDone('delta-foot', 'delta-foot', ['laser', 'xray'], p, bare)).toBe(true);
  });

  it('the flood boulder: read (X-ray), and photographed only with the X-ray spectrometer aboard', () => {
    const p = emptySiteProgress();
    expect(marsSiteTasks('flood-boulder', 'flood-boulder', ['camera'], ctx)).toEqual([]);
    expect(marsSiteDone('flood-boulder', 'flood-boulder', ['camera'], p, ctx)).toBe(false);
    noteReading(p, b('flood-boulder'), 'flood-conglomerate');
    expect(marsSiteDone('flood-boulder', 'flood-boulder', ['xray'], p, ctx)).toBe(true);
    expect(marsSiteDone('flood-boulder', 'flood-boulder', ['xray', 'camera'], p, ctx)).toBe(false);
    p.photographed.add('flood-boulder');
    expect(marsSiteDone('flood-boulder', 'flood-boulder', ['xray', 'camera'], p, ctx)).toBe(true);
  });

  it('no check for the hydrated ground, other kinds or a site without an id; noteSiteReading ignores a boulder with no site', () => {
    const p = emptySiteProgress();
    p.surveyed.add('hydrated-ground');
    expect(marsSiteDone('hidden-hydrogen', 'hydrated-ground', ['neutron'], p, ctx)).toBe(false);
    expect(marsSiteDone('region', 'seitah', ['drill'], p, ctx)).toBe(false);
    expect(marsSiteDone('knob', undefined, ['xray'], p, ctx)).toBe(false);
    noteSiteReading(p, undefined, 'laser');
    expect(p.readings.size).toBe(0);
    expect(MARS_CHECK_KINDS).toEqual(['young-crater', 'rocky-area', 'knob', 'seitah-edge', 'delta-foot', 'flood-boulder']);
  });

  it('the zones a drill sample or a drive credits; crater walls from the zones; the staged transect meters', () => {
    const zones = [
      { id: 'young-crater', site: 'east-crater' }, { id: 'seitah' }, { id: 'delta-foot', site: 'delta-foot' },
      { id: 'delta-front' }, { id: 'near-lander' }, { id: 'hydrogen-anomaly', site: 'hydrated-ground' },
    ] as Zone[];
    expect(marsSitesIn(zones, 'drill')).toEqual(['east-crater', 'seitah-edge', 'delta-foot']);
    expect(marsSitesIn(zones, 'radar')).toEqual(['east-crater', 'seitah-edge', 'delta-foot']);
    expect(marsSitesIn(zones, 'neutron')).toEqual(['seitah-edge', 'delta-foot']);
    expect(marsSitesIn([{ id: 'delta-front' }] as Zone[], 'drill')).toEqual([]);
    const crater = { x: 0, z: 0, radiusM: 1 };
    expect([...craterWallSites([{ id: 'young-crater', site: 'a', crater }, { id: 'young-crater', site: 'b' }, { id: 'seitah', crater }] as Zone[])]).toEqual(['a']);
    const mars = worldGameData('mars').milestones.milestones;
    const meters = (id: string) => (mars.find((m) => m.id === id)!.trigger as { meters: number }).meters;
    expect(stagedTransectMeters(mars, 'radar')).toBe(meters('buried-layers'));
    expect(stagedTransectMeters(mars, 'neutron')).toBe(meters('hydrogen-traverse'));
    expect(stagedTransectMeters(mars, 'weather')).toBe(Infinity);
  });

  it('every Mars check site on the real map has something to do for a fully loaded rover', () => {
    const mars = worldGameData('mars');
    const sites = resolveSites(mars.sites.sites, marsTerrain.features as never);
    const boulders = scatterSiteBoulders(sites, mars.tuning.boulders);
    const present = siteRocks(boulders, mars.tuning.instruments.xray, mars.sites.sites);
    const all: Instrument[] = ['camera', 'xray', 'organics', 'laser', 'radar', 'drill', 'neutron', 'weather'];
    for (const s of sites.filter((x) => MARS_CHECK_KINDS.includes(x.kind) && x.kind !== 'rocky-area')) {
      expect(marsSiteTasks(s.kind, s.id, all, { rocks: present, craterWalls: new Set() }), s.id).toContain('xray');
    }
  });
});
