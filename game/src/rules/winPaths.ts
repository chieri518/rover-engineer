// Win paths: an offline estimate of what each build earns on the Moon when it is driven along a route
// plan with reasonable play. It drives the real mission rules (stepMission) over drive legs measured
// once on the terrain (data/balance.json), credits milestones the way the mission does, and applies
// the real payout and pass rule. Used by the balance tests to check that idling fails, that several
// different builds pass on different routes, and that most builds put together without a plan fail.
// Pure: no rendering, no DOM. An estimate, not the game: the browser playtests confirm it.
import type { BalanceFile, Build, GameData, Milestone, Part, RouteLeg, RouteNode, RoutePlan } from './types';
import { quoteBuild } from './quote';
import { meetsRequirements, selectedParts } from './rover';
import { missionSetup, startMission, stepMission, type MissionEnd, type MissionState } from './mission';
import { wheelSlip } from './ground';
import { earthLitShare, skyDirection, sunAt } from './sun';
import { missionPayout, type EarnedMilestone, type Payout } from './payout';
import { driveEnergy } from './energy';
import type { MissionEvent } from './events';

export interface PlanRun {
  plan: string;
  end: MissionEnd;
  earned: EarnedMilestone[];
  payout: Payout;
  distanceM: number;
  total: number; // parts and ticket
  finalBalance: number; // starting budget − total + payout
  passes: boolean; // finalBalance ≥ the next mission's minimum budget
  stopsReached: number; // plan stops completed
  log: string[]; // one line per stop and per notable event, with the mission second
}

const DT = 0.5;

/** A share sampled every `step` seconds, read at `seconds` (linear between samples). */
export function litAt(series: number[], step: number, seconds: number): number {
  const i = Math.min(Math.max(seconds / step, 0), series.length - 1);
  const a = Math.floor(i);
  const b = Math.min(a + 1, series.length - 1);
  return series[a]! + (series[b]! - series[a]!) * (i - a);
}

function legBetween(routes: BalanceFile, from: string, to: string): RouteLeg {
  const leg = routes.legs.find((l) => l.from === from && l.to === to);
  if (!leg) throw new Error(`no measured leg from ${from} to ${to}`);
  return leg;
}

function nodeById(routes: BalanceFile, id: string): RouteNode {
  const node = routes.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`unknown route node ${id}`);
  return node;
}

/** Angle between two nodes of a boulder field, seen from the field's center (degrees). */
export function crossingAngleDeg(routes: BalanceFile, a: RouteNode, b: RouteNode): number {
  const c = routes.boulderFields.find((f) => f.name === a.boulderField);
  if (!c) throw new Error(`unknown boulder field ${a.boulderField}`);
  const ax = a.x - c.x, az = a.z - c.z, bx = b.x - c.x, bz = b.z - c.z;
  const cos = (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Drive a build along a plan and price the result. The build must be able to launch. */
export function runPlan(build: Build, plan: RoutePlan, data: GameData, routes: BalanceFile): PlanRun {
  const t = data.tuning;
  const mt = t.milestones;
  const play = routes.play;
  const catalog = data.milestones.milestones;
  const parts: Part[] = selectedParts(build, data.parts);
  const quote = quoteBuild(build, data, t.budget.startingBudget);
  // The two flares, as real flares of the median class in events.json, at fixed times.
  const flares = data.events.flare.realFlares;
  const flare = [...flares].sort((a, b) => parseFloat(a.class.slice(1)) - parseFloat(b.class.slice(1)))[Math.floor(flares.length / 2)]!;
  const events: MissionEvent[] = play.flareSeconds.map((at) => ({ kind: 'flare', at, warningAt: at - data.events.flare.warningSeconds, flare }));
  const setup = missionSetup(parts, t, events);
  const speed = setup.stats.topSpeed * play.speedShare;
  const instrument = parts.find((p) => p.slot === 'instrument')?.effects.instrument;
  const step = routes.litStepSeconds;
  const earthDir = skyDirection(t.earth.azimuthDeg, t.earth.elevationDeg);
  const log: string[] = [];

  const earned = new Map<string, number>(); // id → stages
  const credit = (m: Milestone | undefined, stages = 1) => {
    if (m && (earned.get(m.id) ?? 0) < stages && meetsRequirements(parts, m)) earned.set(m.id, stages);
  };
  const sites: RouteNode[] = []; // counted drill sample sites
  const byTrigger = (pred: (m: Milestone) => boolean) => catalog.filter(pred);
  const zoneMilestones = (zone: string) => byTrigger((m) => m.trigger.type === 'zone' && m.trigger.zone === zone);

  let s: MissionState = startMission(setup);
  let at = nodeById(routes, 'landing');
  let stopIndex = 0;
  let leg: RouteLeg | null = null;
  let legPos = 0;
  let busyUntil = 0; // drilling or sheltering from a flare: parked
  let actionDone = true; // the instrument action at the current stop
  let deep = false; // below the Crater descent depth on the de Gerlache side
  let inDark = false;
  let crossed = false;
  const flaresLeft = [...play.flareSeconds];
  const seenLegs = new Set<string>();
  let newGroundM = 0;

  const legEnergy = (l: RouteLeg) =>
    driveEnergy(l.distanceM, (Math.atan2(l.climbM, l.distanceM) * 180) / Math.PI, setup.stats.energyPerMeter, t.energy);

  const arrive = (node: RouteNode, via: RouteLeg) => {
    const key = [via.from, via.to].sort().join('>');
    if (!seenLegs.has(key)) newGroundM += via.distanceM;
    seenLegs.add(key);
    const from = nodeById(routes, via.from);
    if (from.boulderField && from.boulderField === node.boulderField && crossingAngleDeg(routes, from, node) >= mt.boulderCrossMinAngleDeg + play.crossingMarginDeg) {
      crossed = true;
      for (const m of zoneMilestones('boulder-field')) credit(m);
    }
    if (node.deGerlacheSide && node.belowLandingM > mt.craterDescentDepthM) deep = true;
    if (deep && node.belowLandingM < mt.craterDescentExitDepthM) for (const m of zoneMilestones('large-crater')) credit(m);
    if (node.darkCrater) inDark = true;
    if (inDark && !node.darkCrater) for (const m of zoneMilestones('shadowed-crater')) credit(m);
    at = node;
    log.push(`${Math.round(s.seconds)}s at ${node.id} (energy ${Math.round(s.energy)})`);
  };

  const useInstrument = () => {
    if (instrument === 'camera') {
      for (const m of byTrigger((m) => m.trigger.type === 'photo' && m.trigger.zone !== undefined && m.trigger.zone === at.photoZone)) credit(m);
      const sun = sunAt(s.seconds, t.sun, t.mission, routes.site);
      const lit = earthLitShare(sun, earthDir);
      if (at.earthVisible && at.fromLandingM >= mt.earthPhotoMinDistanceM && lit >= mt.earthPhotoMinLit) {
        for (const m of byTrigger((m) => m.trigger.type === 'photo' && m.trigger.target === 'earth')) credit(m);
      }
      log.push(`${Math.round(s.seconds)}s photo at ${at.id}`);
    } else if (instrument === 'drill') {
      busyUntil = s.seconds + mt.drillSeconds;
      if (at.fromLandingM >= mt.sampleMinDistanceM) {
        const here = at;
        const newSite = sites.every((n) => Math.hypot(n.x - here.x, n.z - here.z) >= mt.sampleSpacingM);
        if (newSite) sites.push(here);
        for (const m of catalog) {
          const tr = m.trigger;
          if (tr.type !== 'drill') continue;
          if (tr.zone && !(tr.zone === 'ice-spot' && here.iceSpot === true)) continue;
          if (tr.sites) credit(m, Math.min(sites.length, tr.sites));
          else credit(m);
        }
      }
      log.push(`${Math.round(s.seconds)}s drill at ${at.id}`);
    }
  };

  while (!s.end) {
    let driving = false;
    let sunlight = litAt(at.lit, step, s.seconds);
    let cold = Boolean(at.darkCrater);
    let uphill = 0;
    let softness = 0;
    let poweredDown = false;

    // At each flare warning the player stops and powers down, unless the plan presses on.
    if (flaresLeft.length && s.seconds >= flaresLeft[0]! - data.events.flare.warningSeconds) {
      flaresLeft.shift();
      if (!plan.ignoreFlares) busyUntil = Math.max(busyUntil, s.seconds + play.flareStopSeconds);
    }

    if (s.seconds < busyUntil) {
      poweredDown = true;
    } else if (leg) {
      driving = true;
    } else if (!actionDone) {
      const stop = plan.stops[stopIndex - 1]!;
      if (stop.waitUntil === undefined || s.seconds >= stop.waitUntil) {
        actionDone = true;
        if (stop.use) useInstrument();
      }
    } else if (stopIndex < plan.stops.length) {
      const next = plan.stops[stopIndex]!;
      if (next.node === at.id) {
        stopIndex++;
        actionDone = false;
      } else {
        const l = legBetween(routes, at.id, next.node);
        // Reasonable play: recharge in sunlight before a leg the battery cannot cover with a reserve.
        const need = Math.min(setup.stats.batteryCapacity, legEnergy(l) + play.reserveShare * setup.stats.batteryCapacity);
        if (s.energy >= need || sunlight < 0.3 || cold) {
          leg = l;
          legPos = 0;
          driving = true;
          stopIndex++;
          actionDone = false;
        }
      }
    }

    let distance = 0;
    if (driving && leg) {
      distance = Math.min(speed * DT, leg.distanceM - legPos);
      legPos += distance;
      const f = legPos / leg.distanceM;
      sunlight = litAt(leg.lit, step, s.seconds);
      uphill = (Math.atan2(leg.climbM, leg.distanceM) * 180) / Math.PI;
      const coldShare = leg.coldM / leg.distanceM;
      const toDark = nodeById(routes, leg.to).darkCrater;
      const fromDark = nodeById(routes, leg.from).darkCrater;
      cold = (toDark === true && f > 1 - coldShare) || (fromDark === true && f < coldShare);
      const a = nodeById(routes, leg.from);
      if (a.boulderField && a.boulderField === nodeById(routes, leg.to).boulderField) {
        softness = 1;
        uphill = Math.max(uphill, play.crossingUphillDeg);
      }
    }

    const res = stepMission({ ...s, poweredDown }, {
      dt: DT, distanceM: distance, speedMps: distance / DT, uphillDeg: uphill, slopeDeg: 5, sunlight, inColdZone: cold,
      softness, throttling: driving, impactMps: 0, upY: 1,
    }, setup, t, data.events);
    if (res.state.flaresProtected > s.flaresProtected) for (const m of byTrigger((m) => m.trigger.type === 'event')) credit(m);
    s = { ...res.state, poweredDown: false };

    if (leg && legPos >= leg.distanceM - 1e-6 && !s.end) {
      const done = leg;
      leg = null;
      arrive(nodeById(routes, done.to), done);
    }
  }

  // End of mission milestones.
  if (s.end?.survived) {
    const harmed = s.damageBy.impact + s.damageBy.slope + s.damageBy.overload + s.damageBy.flare;
    // A boulder field crossing with reasonable (not perfect) driving is assumed to touch a rock.
    if (harmed === 0 && !crossed) for (const m of byTrigger((m) => m.trigger.type === 'survive')) credit(m);
  }
  for (const m of byTrigger((m) => m.trigger.type === 'landing')) credit(m);
  const result: EarnedMilestone[] = [...earned].map(([id, stages]) => (stages > 1 ? { id, stages } : { id }));
  for (const m of catalog) {
    if (m.trigger.type === 'distance') {
      const stages = m.trigger.meters.filter((d) => s.distanceM >= d).length;
      if (stages > 0 && meetsRequirements(parts, m)) result.push({ id: m.id, stages });
    } else if (m.trigger.type === 'explore') {
      const share = play.mapperBaseShare + (play.mapperSharePerKm * newGroundM) / 1000;
      if (share >= m.trigger.share && meetsRequirements(parts, m)) result.push({ id: m.id });
    }
  }
  const end = s.end!;
  const payout = missionPayout(
    { survived: end.survived, cause: end.cause, secondsLasted: end.seconds, earned: result },
    catalog, t, [],
  );
  const finalBalance = t.budget.startingBudget - quote.totalCost + payout.money;
  return {
    plan: plan.id,
    end,
    earned: result,
    payout,
    distanceM: s.distanceM,
    total: quote.totalCost,
    finalBalance,
    passes: finalBalance >= t.budget.minimumBudget.mars,
    stopsReached: stopIndex,
    log,
  };
}

/** True when the build can launch and the starting budget can buy it. */
export function canBuy(build: Build, data: GameData): boolean {
  const q = quoteBuild(build, data, data.tuning.budget.startingBudget);
  return q.canLaunch && q.canAfford;
}

/** The plan that leaves the build with the most money. */
export function bestPlan(build: Build, data: GameData, routes: BalanceFile, plans = routes.plans): PlanRun {
  let best: PlanRun | null = null;
  for (const plan of plans) {
    const run = runPlan(build, plan, data, routes);
    if (!best || run.finalBalance > best.finalBalance) best = run;
  }
  if (!best) throw new Error('no plans');
  return best;
}

/** Wheel slip on a soft boulder-field crossing: above the limit the rover digs in and gets stuck. */
export function crossingSlip(build: Build, data: GameData, routes: BalanceFile): number {
  const setup = missionSetup(selectedParts(build, data.parts), data.tuning, []);
  return wheelSlip(1, setup.stats.massKg, setup.stats.grip, routes.play.crossingUphillDeg, data.tuning);
}
