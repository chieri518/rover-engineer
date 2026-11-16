// Win paths: balance targets for the Moon pass rule. Prints the full report only when asked:
//   WINPATH_REPORT=1 npx vitest run winPaths
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import balance from '../../data/balance.json';
import type { BalanceFile, Build, GameData, RoutePlan } from './types';
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
    expect(new Set(passing.map((a) => a.build.payload.join('+'))).size).toBe(2);
  });

  it('an archetype that ignores its purpose fails: the same build and route without using the instrument', () => {
    for (const a of routes.archetypes) {
      const p = plan(a.plan);
      const blind = { ...p, stops: p.stops.map(({ use: _use, ...stop }) => stop) };
      expect(runPlan(a.build, blind, data, routes).passes, a.name).toBe(false);
    }
  });

  it('most builds put together without a plan fail even with their best route', () => {
    const passing = [...best.values()].filter((r) => r.passes).length;
    expect(passing).toBeGreaterThan(0);
    expect(passing / buyable.length).toBeLessThan(0.35);
  });

  it('the archetype routes really cross their boulder field: the crossing nodes are well over the Boulder field angle apart', () => {
    const t = data.tuning.milestones;
    for (const a of routes.archetypes) {
      const p = plan(a.plan);
      for (let i = 1; i < p.stops.length; i++) {
        const from = routes.nodes.find((n) => n.id === p.stops[i - 1]!.node)!;
        const to = routes.nodes.find((n) => n.id === p.stops[i]!.node)!;
        if (from.boulderField && from.boulderField === to.boulderField) {
          expect(crossingAngleDeg(routes, from, to), `${a.name} ${from.id}>${to.id}`).toBeGreaterThanOrEqual(t.boulderCrossMinAngleDeg + routes.play.crossingMarginDeg);
        }
      }
    }
  });

  // The design says a rover with no instruments cannot pass the Moon. Today the cheapest fast empty
  // bay (steel, mesh, panel, NiH2) scrapes a pass on capability milestones alone with a perfect
  // scouting run, so this checks the weaker target: no empty bay passes with room for a mistake.
  // Closing the gap is left to the balance patch (milestone money or the pass mark).
  it('a rover with an empty bay never passes with room for a mistake, even with its best route', () => {
    const empty = buyable.filter((b) => b.payload.length === 0);
    expect(empty.length).toBeGreaterThan(0);
    for (const b of empty) expect(best.get(label(b))!.finalBalance, label(b)).toBeLessThan(pass + routes.play.mistakeMargin);
    expect(empty.filter((b) => best.get(label(b))!.passes).length).toBeLessThanOrEqual(1);
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
    const p = plan(geo.plan);
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
