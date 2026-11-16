// Win paths: balance targets for the Moon pass rule. Prints the full report only when asked:
//   WINPATH_REPORT=1 npx vitest run winPaths
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import balance from '../../data/balance.json';
import type { BalanceFile, Build, GameData, RouteLeg, RouteNode, RoutePlan } from './types';
import terrain from '../../public/terrain/terrain.json';
import { buildZones, zoneContains, type MilestoneFeatures } from './milestones';
import { resolveSites } from './sites';
import { allBuilds, buildLabel } from './balance';
import { bestPlan, canBuy, crossingAngleDeg, runPlan } from './winPaths';
import { cheapestBuild } from './rover';

const data = loadGameData();
const routes = balance as unknown as BalanceFile;
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const plan = (id: string) => routes.plans.find((p) => p.id === id)!;
const label = (b: Parameters<typeof buildLabel>[0]) => buildLabel(b, data.parts.slots);

const pass = data.tuning.budget.minimumBudget.mars;
const buyable = allBuilds(data).filter((b) => canBuy(b, data));
const best = new Map(buyable.map((b) => [label(b), bestPlan(b, data, routes)]));

describe('win paths: the Moon pass rule rewards intentional design', () => {
  it('idling never passes: every build that stays at the lander fails, by a wide margin', () => {
    for (const b of buyable) {
      const idle = runPlan(b, plan('idle'), data, routes);
      expect(idle.end.survived, label(b)).toBe(true);
      expect(idle.finalBalance, label(b)).toBeLessThan(pass - 100);
    }
  });

  it('driving around without a plan, or one or two short stops near the lander, fails for every build', () => {
    for (const b of buyable) for (const id of ['wander', 'one-stop', 'two-near']) expect(runPlan(b, plan(id), data, routes).passes, `${label(b)} ${id}`).toBe(false);
  });

  it('at least three different archetypes pass with room for a mistake, with different parts and routes', () => {
    const passing = routes.archetypes.filter((a) => runPlan(a.build, plan(a.plan), data, routes).finalBalance >= pass + routes.play.mistakeMargin);
    expect(passing.map((a) => a.name)).toEqual(routes.archetypes.map((a) => a.name));
    expect(passing.length).toBeGreaterThanOrEqual(3);
    expect(new Set(passing.map((a) => a.plan)).size).toBe(passing.length);
    expect(new Set(passing.map((a) => label(a.build))).size).toBe(passing.length);
    // Every Moon instrument is the main job of at least one passing archetype.
    const used = new Set(passing.flatMap((a) => a.build.payload));
    for (const p of data.parts.parts.filter((x) => x.slot === 'instrument')) expect(used.has(p.id), p.id).toBe(true);
  });

  it('an archetype that ignores its purpose fails: the same build and route without using the instrument', () => {
    for (const a of routes.archetypes) {
      const p = plan(a.plan);
      const blind = { ...p, stops: p.stops.map(({ use: _use, standby: _standby, ...stop }) => stop) };
      expect(runPlan(a.build, blind, data, routes).passes, a.name).toBe(false);
    }
  });

  it('most builds put together without a plan fail even with their best route', () => {
    const passing = [...best.values()].filter((r) => r.passes).length;
    expect(passing).toBeGreaterThan(0);
    expect(passing / buyable.length).toBeLessThan(0.35);
  });

  // A leg inside one field is either a crossing the model credits, well over the Boulder field angle, or clearly
  // not one (the Near prospector's cold patch to hidden hydrogen leg), never in between.
  it('the archetype routes really cross their boulder field: the crossing nodes are well over the Boulder field angle apart', () => {
    const t = data.tuning.milestones;
    for (const a of routes.archetypes) {
      const p = plan(a.plan);
      for (let i = 1; i < p.stops.length; i++) {
        const from = routes.nodes.find((n) => n.id === p.stops[i - 1]!.node)!;
        const to = routes.nodes.find((n) => n.id === p.stops[i]!.node)!;
        if (from.boulderField && from.boulderField === to.boulderField) {
          const angle = crossingAngleDeg(routes, from, to);
          if (angle > t.boulderCrossMinAngleDeg - routes.play.crossingMarginDeg) expect(angle, `${a.name} ${from.id}>${to.id}`).toBeGreaterThanOrEqual(t.boulderCrossMinAngleDeg + routes.play.crossingMarginDeg);
        }
      }
    }
  });

  // The design says a rover with no instruments cannot pass the Moon. With the Moon sites repricing
  // (Boulder field 60, Mapper 40) every empty bay fails by at least the mistake margin, even with its best route.
  it('a rover with an empty bay fails by at least the mistake margin, even with its best route', () => {
    const empty = buyable.filter((b) => b.payload.length === 0);
    expect(empty.length).toBeGreaterThan(0);
    for (const b of empty) expect(best.get(label(b))!.finalBalance, label(b)).toBeLessThanOrEqual(pass - routes.play.mistakeMargin);
  });

  // Carrying only the reflector is carrying an instrument for one cheap milestone: it fails even with its best route.
  it('a rover with only the reflector fails, even with its best route', () => {
    const lone = buyable.filter((b) => b.payload.length === 1 && b.payload[0] === 'instrument-reflector');
    expect(lone.length).toBeGreaterThan(0);
    for (const b of lone) {
      const r = best.get(label(b))!;
      expect(r.passes, `${label(b)} ${r.plan}`).toBe(false);
    }
    // The best of them does set the reflector down: the model's plans give it the chance.
    const top = lone.map((b) => best.get(label(b))!).sort((a, b) => b.finalBalance - a.finalBalance)[0]!;
    expect(top.earned.map((e) => e.id)).toContain('laser-ranging-site');
  });

  it('the cheapest build fails on every route', () => {
    const cheap = cheapestBuild(data.parts);
    for (const p of routes.plans) expect(runPlan(cheap, p, data, routes).passes, p.id).toBe(false);
  });

  it('the ice is optional: builds without a drill, and drill builds that skip the dark crater, can pass', () => {
    const iceFree = [...best.values()].filter((r) => r.passes && !r.earned.some((e) => e.id === 'water-ice'));
    expect(iceFree.length).toBeGreaterThan(5);
  });
});

const archetype = (name: string) => routes.archetypes.find((a) => a.name === name)!;
/** The game data with the neutron spectrometer drawing this much energy per second on standby. */
const neutronDraw = (standbyEnergy: number): GameData => ({
  ...data,
  parts: { ...data.parts, parts: data.parts.parts.map((p) => (p.id === 'instrument-neutron' ? { ...p, effects: { ...p.effects, standbyEnergy } } : p)) },
});
const secondsOf = (log: string[], pattern: RegExp) => log.filter((l) => pattern.test(l)).map((l) => parseFloat(l));

describe('win paths: the plan runs follow the instrument rules', () => {
  it('the archetype plans run without a refused use, and every drill hold finishes and is credited', () => {
    for (const a of routes.archetypes) {
      const p = plan(a.plan);
      const r = runPlan(a.build, p, data, routes);
      expect(r.refusals, a.name).toEqual([]);
      const carriesDrill = a.build.payload.includes('instrument-drill');
      const drills = carriesDrill ? p.stops.filter((s) => s.use?.includes('drill')).length : 0;
      expect(secondsOf(r.log, /drill done/), a.name).toHaveLength(drills);
    }
    // The drill geologist plans three sample sites, all credited.
    const geo = runPlan(archetype('Drill geologist').build, plan(archetype('Drill geologist').plan), data, routes);
    expect(geo.earned).toContainEqual({ id: 'regolith-sample', stages: 3 });
    const ice = runPlan(archetype('Ice hunter').build, plan(archetype('Ice hunter').plan), data, routes);
    expect(ice.earned.map((e) => e.id)).toContain('water-ice');
  });

  it('a drill hold pauses while the rover shelters from a flare, then finishes and is credited', () => {
    const geo = archetype('Drill geologist');
    const warningAt = routes.play.flareSeconds[0]! - data.events.flare!.warningSeconds;
    const start = warningAt - 1;
    const p: RoutePlan = { id: 'flare-drill', name: 'Drill just before a flare warning', stops: [{ node: 'rocky1East', use: ['drill'], waitUntil: start }] };
    const r = runPlan(geo.build, p, data, routes);
    expect(r.refusals).toEqual([]);
    expect(r.log.some((l) => l.includes('drill hold paused'))).toBe(true);
    const [done] = secondsOf(r.log, /drill done at rocky1East/);
    const hold = data.parts.parts.find((x) => x.id === 'instrument-drill')!.effects.useSeconds!;
    expect(done).toBeGreaterThanOrEqual(start + hold + routes.play.flareStopSeconds - 1);
    expect(r.earned).toContainEqual({ id: 'regolith-sample' });
  });

  it('a switched-on neutron spectrometer draws energy through the mission rules, and costs the plan', () => {
    const geo = archetype('Drill geologist');
    const b: Build = { ...geo.build, payload: ['instrument-drill', 'instrument-neutron'] };
    const p = { ...plan(geo.plan), stops: plan(geo.plan).stops.map(({ standby: _standby, ...stop }) => stop) };
    const on: RoutePlan = { ...p, id: `${p.id}-neutron`, stops: [{ node: 'landing', standby: ['neutron'] }, ...p.stops] };
    const off = runPlan(b, p, data, routes);
    const run = runPlan(b, on, data, routes);
    expect(off.standbyEnergy).toBe(0);
    expect(run.standbyEnergy).toBeGreaterThan(10);
    expect(run.refusals).toEqual([]);
    expect(run.end.survived).toBe(true);
    // The draw shows at the first stop, before any recharge wait.
    const firstArrival = (r: typeof run) => Number(/at rocky1East \(energy (\d+)\)/.exec(r.log.join('|'))![1]);
    expect(firstArrival(run)).toBeLessThan(firstArrival(off));
    // A build without the spectrometer skips the standby switch.
    expect(runPlan(geo.build, on, data, routes).refusals).toEqual([]);
  });

  it('standby never ends a run: at the low-energy warning it switches off, and switching on again there is refused', () => {
    const scout = archetype('Camera scout');
    const b: Build = { ...scout.build, payload: ['instrument-camera', 'instrument-neutron'] };
    const hungry = neutronDraw(3); // far above the panel's income
    const parked = runPlan(b, { id: 'standby-parked', name: 'Neutron on at the lander', stops: [{ node: 'landing', standby: ['neutron'] }] }, hungry, routes);
    expect(parked.end.survived).toBe(true);
    expect(parked.standbyOff.length).toBeGreaterThan(0);
    // In shadow the battery stays below the warning after the switch-off, so switching on again is refused.
    const dark: RoutePlan = {
      id: 'standby-dark', name: 'Neutron on in shadow',
      stops: [{ node: 'rocky2South', standby: ['neutron'] }, { node: 'rocky2South', waitUntil: 250, standby: ['neutron'] }],
    };
    const r = runPlan(b, dark, hungry, routes);
    expect(r.end.survived).toBe(true);
    expect(r.standbyOff.length).toBe(1);
    expect(r.refusals).toEqual([expect.objectContaining({ instrument: 'neutron', reason: 'low-energy', node: 'rocky2South' })]);
  });

  it('deployables and the X-ray spectrometer: conditions from the route nodes, refusals recorded, stations left behind', () => {
    const scout = archetype('Camera scout');
    const b: Build = { ...scout.build, payload: ['instrument-xray', 'instrument-seismometer', 'instrument-reflector'] };
    const p: RoutePlan = {
      id: 'stations', name: 'Stations at the boulder field',
      stops: [
        { node: 'rocky1East', use: ['xray', 'seismometer', 'reflector'] }, // boulders, Earth in view
        { node: 'rim1', use: ['seismometer', 'xray'] }, // already deployed; no boulders
        { node: 'wall', use: ['reflector'] }, // already deployed (and no Earth)
      ],
    };
    const r = runPlan(b, p, data, routes);
    expect(r.end.survived).toBe(true);
    expect(r.deployed).toEqual(['seismometer', 'reflector']);
    expect(r.refusals.map((x) => `${x.instrument} ${x.reason} ${x.node}`)).toEqual([
      'seismometer deployed rim1', 'xray no-boulder rim1', 'reflector deployed wall',
    ]);
    const noEarth = runPlan(b, { id: 'wall-reflector', name: 'Reflector without Earth', stops: [{ node: 'wall', use: ['reflector'] }] }, data, routes);
    expect(noEarth.refusals.map((x) => x.reason)).toEqual(['no-earth']);
    expect(noEarth.deployed).toEqual([]);
  });
});

describe('win paths: the Moon sites archetypes (Phase 6)', () => {
  it('each new archetype earns its own instruments\' milestones on its route', () => {
    const ids = (name: string) => {
      const a = archetype(name);
      return Object.fromEntries(runPlan(a.build, plan(a.plan), data, routes).earned.map((e) => [e.id, e.stages ?? 1]));
    };
    expect(ids('Rock hound')).toMatchObject({ 'rock-collection': 3, 'rare-rock': 1, 'boulder-track': 1, 'documented-sample': 1, 'rim-panorama': 1, 'earth-on-horizon': 1 });
    expect(ids('Station keeper')).toMatchObject({ 'science-station': 1, 'laser-ranging-site': 1, 'moonquake-record': 1, 'clean-seismogram': 1, 'rock-collection': 3, 'rare-rock': 1 });
    expect(ids('Near prospector')).toMatchObject({ 'cold-trap-survey': 2, 'hidden-hydrogen': 1, 'rock-collection': 3, 'rare-rock': 1 });
  });

  // Decided in Phase 0: the Station keeper's Clean seismogram is credited only for a route that stays away from the
  // stations through the whole moonquake window, so it does not depend on when the quake comes.
  it('the Station keeper\'s record is clean wherever the moonquake falls in its window', () => {
    const a = archetype('Station keeper');
    const [from, to] = data.events.quake!.windowsSeconds[0]!;
    for (let at = from; at <= to; at += 5) {
      const r = runPlan(a.build, plan(a.plan), data, { ...routes, play: { ...routes.play, quakeSeconds: at } });
      expect(r.earned.map((e) => e.id), `quake at ${at}s`).toContain('clean-seismogram');
    }
  });

  // Decided in Phase 6: the far neutron route (the plan's Dark prospector) is an example, not an archetype. On steel
  // it reaches the crater edge after about 295 s, below the energy needed to switch the spectrometer on; on titanium
  // the build needs the Medium ticket (size 21), so even with every milestone of the route it ends below the pass mark.
  it('the far neutron route does not pass: the Dark prospector example fails on steel and on titanium', () => {
    const dark = (chassis: string): Build => ({ chassis, wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-li-ion', lights: 'lights-led', heater: 'heater-rhu', payload: ['instrument-neutron'] });
    const steel = runPlan(dark('chassis-steel'), plan('dark-neutron'), data, routes);
    expect(steel.passes).toBe(false);
    expect(steel.earned.map((e) => e.id)).not.toContain('ice-deposit-located');
    // Even with the low-energy switch-off moved out of the way, titanium earns the route's milestones and still fails.
    const lowLevel: GameData = { ...data, tuning: { ...data.tuning, energy: { ...data.tuning.energy, lowWarningShare: 0.05 } } };
    const ti = runPlan(dark('chassis-titanium'), plan('dark-neutron'), lowLevel, routes);
    expect(ti.earned.map((e) => e.id)).toContain('ice-deposit-located');
    expect(ti.passes).toBe(false);
  });
});

describe('win paths report', () => {
  it('prints every build and archetype', () => {
    if (!env.WINPATH_REPORT) return;
    console.log(`pass mark ${pass}`);
    for (const a of routes.archetypes) {
      const r = runPlan(a.build, plan(a.plan), data, routes);
      console.log(`${a.name.padEnd(16)} ${label(a.build).padEnd(28)} total ${r.total} ${a.plan.padEnd(14)} end ${r.end.survived ? 'ok' : r.end.cause} ${Math.round(r.end.seconds)}s ${Math.round(r.distanceM)}m final ${r.finalBalance} ${r.passes ? 'PASS' : 'fail'} [${r.earned.map((e) => e.id + (e.stages ? '×' + e.stages : '')).join(' ')}]`);
      if (r.refusals.length) console.log(`   refused: ${r.refusals.map((x) => `${x.instrument} ${x.reason} at ${x.node} ${Math.round(x.seconds)}s`).join(', ')}`);
      if (env.WINPATH_LOG) console.log('   ' + r.log.join(' | '));
    }
    const rows = buyable.map((b) => {
      const top = best.get(label(b))!;
      const idle = runPlan(b, plan('idle'), data, routes);
      const wander = runPlan(b, plan('wander'), data, routes);
      return { build: label(b), total: top.total, best: top.plan, final: top.finalBalance, pass: top.passes, idle: idle.finalBalance, wander: wander.finalBalance, earned: top.earned.map((e) => e.id).join(' ') };
    }).sort((a, b) => b.final - a.final);
    console.table(rows);
    console.log(`${rows.filter((r) => r.pass).length} of ${rows.length} affordable builds can pass with their best plan; idle passes ${rows.filter((r) => r.idle >= pass).length}; wander passes ${rows.filter((r) => r.wander >= pass).length}`);
    const byPlan = new Map<string, number>();
    for (const r of rows.filter((r) => r.pass)) byPlan.set(r.best, (byPlan.get(r.best) ?? 0) + 1);
    console.log('passing builds by best plan', Object.fromEntries(byPlan));
  });
});

// ---------------------------------------------------------------------------------------------------
// Moon sites and milestones (Phase 3): the balance model credits the new triggers. These tests drive synthetic
// nodes and legs; the measured ones (Phase 6) are in balance.json.

describe('win paths: the Moon sites triggers', () => {
  const landing = routes.nodes.find((n) => n.id === 'landing')!;
  const litNode = routes.nodes.find((n) => n.id === 'rim1')!.lit;
  const litLeg = routes.legs.find((l) => l.from === 'landing' && l.to === 'rim1')!.lit;
  const n = (id: string, x: number, z: number, extra: Partial<RouteNode> = {}): RouteNode => ({
    id, x, z, fromLandingM: Math.round(Math.hypot(x - landing.x, z - landing.z)), belowLandingM: 0, earthVisible: true, lit: litNode, ...extra,
  });
  const extra: RouteNode[] = [
    n('bench', landing.x, landing.z - 400),
    n('bench2', landing.x, landing.z - 480),
    n('near', landing.x, landing.z - 100),
    n('crater', landing.x - 400, landing.z - 150, { earthVisible: false, rocks: ['noritic-anorthosite', 'ferroan-anorthosite'], zones: ['young-crater:east-crater'] }),
    n('rolled', landing.x - 410, landing.z - 150, { earthVisible: false, rocks: ['magnesian-norite'], rolledBoulderM: 5 }),
    n('far', landing.x - 400, landing.z + 600, { rocks: ['regolith-breccia'] }),
  ];
  const all = [landing, ...extra];
  const zonesOf: Record<string, string[]> = { 'landing>bench': ['cold-trap:east-cold-trap'], 'bench>bench2': ['cold-trap:south-cold-trap'] };
  const legs: RouteLeg[] = all.flatMap((a) => all.filter((b) => b !== a).map((b) => ({
    from: a.id, to: b.id, distanceM: Math.round(Math.hypot(a.x - b.x, a.z - b.z) * 1.1), climbM: 0, descentM: 0, coldM: 0, lit: litLeg,
    ...(zonesOf[`${a.id}>${b.id}`] ?? zonesOf[`${b.id}>${a.id}`] ? { zones: zonesOf[`${a.id}>${b.id}`] ?? zonesOf[`${b.id}>${a.id}`] } : {}),
  })));
  const synth: BalanceFile = { ...routes, nodes: [...routes.nodes.filter((x) => x.id !== 'landing'), ...all], legs: [...routes.legs.filter((l) => !all.some((a) => a.id === l.from) || !all.some((a) => a.id === l.to)), ...legs] };
  const bus = { chassis: 'chassis-steel', wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-li-ion', lights: 'lights-none', heater: 'heater-none' } as const;
  const build = (...payload: string[]): Build => ({ ...bus, payload: payload.map((p) => `instrument-${p}`) });
  const run = (b: Build, stops: RoutePlan['stops']) => runPlan(b, { id: 'synthetic', name: 'synthetic', stops }, data, synth);
  const earned = (r: ReturnType<typeof run>) => Object.fromEntries(r.earned.map((e) => [e.id, e.stages ?? 1]));

  it('the route nodes carry the site zones they really lie in (buildZones on the real terrain and sites.json)', () => {
    const f = terrain.features;
    const zones = buildZones({ landing: terrain.landing.local, rimViewpoints: f.rimViewpoints, rockyAreas: f.rockyAreas, shadowedCrater: f.shadowedCrater as unknown as MilestoneFeatures['shadowedCrater'], craterDescent: f.craterDescent },
      data.tuning.milestones, { sites: resolveSites(data.sites.sites, f), neutron: data.tuning.instruments.neutron });
    for (const node of routes.nodes) {
      const inside = zones.filter((z) => (z.site || z.id === 'ice-signal') && zoneContains(z, { x: node.x, y: 0, z: node.z })).map((z) => z.key);
      expect([...(node.zones ?? [])].sort(), node.id).toEqual(inside.sort());
    }
  });

  it('Fresh ejecta sample: a drill sample in an ejecta ring (the Drill geologist at Rocky area 1), not elsewhere', () => {
    const geo = archetype('Drill geologist');
    expect(earned(runPlan(geo.build, plan(geo.plan), data, routes))['fresh-ejecta-sample']).toBe(1);
    expect(earned(runPlan(geo.build, plan('near-wall'), data, routes))['fresh-ejecta-sample']).toBeUndefined();
  });

  it('X-ray readings: Rock collection by distinct types, Rare rock at the rolled boulder, Documented sample and Boulder track', () => {
    const r = run(build('xray', 'camera'), [
      { node: 'crater', use: ['xray', 'xray', 'camera'] },
      { node: 'rolled', use: ['xray', 'camera'] },
      { node: 'far', use: ['xray'] },
    ]);
    expect(r.refusals).toEqual([]);
    expect(earned(r)).toMatchObject({ 'rock-collection': 3, 'rare-rock': 1, 'documented-sample': 1, 'boulder-track': 1 });
    const two = run(build('xray', 'camera'), [{ node: 'crater', use: ['camera', 'xray', 'xray'] }]); // photo before the reading
    expect(earned(two)).toMatchObject({ 'rock-collection': 1 });
    expect(earned(two)['documented-sample']).toBeUndefined();
    expect(earned(run(build('camera'), [{ node: 'rolled', use: ['camera'] }]))['boulder-track']).toBe(1);
  });

  it('stations: Laser ranging, Science station, and a clean Moonquake record when the rover drives away', () => {
    const r = run(build('seismometer', 'reflector'), [{ node: 'bench', use: ['seismometer', 'reflector'] }, { node: 'far' }]);
    expect(r.deployed).toEqual(['seismometer', 'reflector']);
    expect(earned(r)).toMatchObject({ 'laser-ranging-site': 1, 'science-station': 1, 'moonquake-record': 1, 'clean-seismogram': 1 });
    // Driving past the station in the record window makes the trace noisy.
    const noisy = run(build('seismometer', 'reflector'), [
      { node: 'bench', use: ['seismometer'] }, { node: 'bench2', waitUntil: routes.play.quakeSeconds - 15 }, { node: 'near' },
    ]);
    expect(earned(noisy)).toMatchObject({ 'moonquake-record': 1 });
    expect(earned(noisy)['clean-seismogram']).toBeUndefined();
    // Near the lander, or apart: none of the station milestones.
    expect(Object.keys(earned(run(build('seismometer', 'reflector'), [{ node: 'near', use: ['seismometer', 'reflector'] }, { node: 'far' }])))).not.toContain('moonquake-record');
    const apart = earned(run(build('seismometer', 'reflector'), [{ node: 'bench', use: ['seismometer'] }, { node: 'far', use: ['reflector'] }]));
    expect(apart['science-station']).toBeUndefined();
    expect(apart['laser-ranging-site']).toBe(1);
  });

  it('neutron standby on legs: a switched-on drive along a leg that touches a cold trap earns a survey stage per trap', () => {
    const on = run(build('neutron'), [{ node: 'landing', standby: ['neutron'] }, { node: 'bench' }, { node: 'bench2' }]);
    expect(on.refusals).toEqual([]);
    expect(earned(on)['cold-trap-survey']).toBe(2);
    expect(earned(run(build('neutron'), [{ node: 'bench' }, { node: 'bench2' }]))['cold-trap-survey']).toBeUndefined(); // never switched on
    expect(earned(run(build('neutron'), [{ node: 'landing', standby: ['neutron'] }, { node: 'bench' }, { node: 'landing' }]))['cold-trap-survey']).toBe(1); // the same trap twice
    // The Ice hunter's build with the spectrometer instead of the drill, switched on at the crater edge. On the
    // measured legs it reaches the edge at about 275 s with the battery just above the low-energy level, so the
    // standby switches itself off on the way in and the count starts again: no Ice deposit located. With a lower
    // warning level the same run earns it and the dark crater's survey stage (Phase 6: the rule stays; see the
    // Dark prospector test).
    const ice = archetype('Ice hunter');
    const b = { ...ice.build, payload: ['instrument-neutron'] };
    const edgePlan: RoutePlan = { id: 'neutron-edge', name: 'neutron on at the edge', stops: [{ node: 'darkEdge', standby: ['neutron'] }, { node: 'ice' }, { node: 'darkEdge' }] };
    const real = runPlan(b, edgePlan, data, routes);
    expect(real.standbyOff.length).toBeGreaterThan(0);
    expect(earned(real)['ice-deposit-located']).toBeUndefined();
    const lowLevel: GameData = { ...data, tuning: { ...data.tuning, energy: { ...data.tuning.energy, lowWarningShare: 0.05 } } };
    expect(earned(runPlan(b, edgePlan, lowLevel, routes))).toMatchObject({ 'ice-deposit-located': 1, 'cold-trap-survey': 1 });
    expect(earned(runPlan({ ...b, lights: 'lights-none' }, edgePlan, lowLevel, routes))['ice-deposit-located']).toBeUndefined(); // it needs lights
  });
});
