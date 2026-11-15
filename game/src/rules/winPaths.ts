// Win paths: an offline estimate of what each build earns on the Moon when it is driven along a route
// plan with reasonable play. It drives the real mission rules (stepMission) over drive legs measured
// once on the terrain (data/balance.json), credits milestones the way the mission does, and applies
// the real payout and pass rule. Used by the balance tests to check that idling fails, that several
// different builds pass on different routes, and that most builds put together without a plan fail.
// Pure: no rendering, no DOM. An estimate, not the game: the browser playtests confirm it.
import type { BalanceFile, Build, GameData, Instrument, Milestone, Part, RouteLeg, RouteNode, RoutePlan } from './types';
import { quoteBuild } from './quote';
import { meetsRequirements, selectedParts } from './rover';
import { instrumentsOf } from './payload';
import {
  deployPart, missionSetup, setStandby, standbyDraw, startInstrumentUse, startMission, stepMission,
  type InstrumentRefusal, type MissionEnd, type MissionState,
} from './mission';
import { wheelSlip } from './ground';
import { earthLitShare, skyDirection, sunAt } from './sun';
import { missionPayout, type EarnedMilestone, type Payout } from './payout';
import { driveEnergy } from './energy';
import type { MissionEvent } from './events';

/** An instrument use or standby switch the mission rules refused during a plan run. */
export interface PlanRefusal {
  instrument: Instrument;
  reason: InstrumentRefusal;
  node: string; // where the rover was
  seconds: number; // mission second
}

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
  refusals: PlanRefusal[]; // uses and standby switches the rules refused (instruments the build does not carry are skipped, not refused)
  deployed: Instrument[]; // stations set down, in order
  standbyEnergy: number; // energy drawn by switched-on instruments
  standbyOff: number[]; // mission seconds when the low-energy warning switched standby instruments off
  energyLeft: number; // battery at the end
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

/**
 * Drive a build along a plan and price the result. The build must be able to launch.
 *
 * The rover is in one of these states each step: sheltering from a flare (parked and powered down for
 * play.flareStopSeconds after each warning, unless the plan ignores flares; a held use pauses),
 * holding still for an instrument use (parked and powered up: state.using counts down), driving a
 * leg, or at a stop (waiting, starting its uses in order, recharging before the next leg).
 */
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
  let setup = missionSetup(parts, t, events); // recomputed when a station is set down
  let speed = setup.stats.topSpeed * play.speedShare;
  const carried = instrumentsOf(parts); // at launch: a deployed station is still "carried" (the rules refuse it as deployed)
  const step = routes.litStepSeconds;
  const earthDir = skyDirection(t.earth.azimuthDeg, t.earth.elevationDeg);
  const nodes = new Map(routes.nodes.map((n) => [n.id, n]));
  const node = (id: string) => nodes.get(id) ?? nodeById(routes, id);
  const log: string[] = [];
  const refusals: PlanRefusal[] = [];
  const standbyOff: number[] = [];
  let standbyEnergy = 0;

  const earned = new Map<string, number>(); // id → stages
  const credit = (m: Milestone | undefined, stages = 1) => {
    if (m && (earned.get(m.id) ?? 0) < stages && meetsRequirements(parts, m)) earned.set(m.id, stages);
  };
  const sites: RouteNode[] = []; // counted drill sample sites
  const byTrigger = (pred: (m: Milestone) => boolean) => catalog.filter(pred);
  const zoneMilestones = (zone: string) => byTrigger((m) => m.trigger.type === 'zone' && m.trigger.zone === zone);

  let s: MissionState = startMission(setup);
  let at = node('landing');
  let stopIndex = 0;
  let leg: RouteLeg | null = null;
  let legPos = 0;
  let shelterUntil = 0; // parked and powered down for a flare until this mission second
  let actionDone = true; // the instrument uses at the current stop are started and finished
  let queue: Instrument[] = []; // the current stop's uses not started yet
  let stopStarted = false; // the current stop's uses were started (its first step after any wait)
  let pendingStandby: Instrument[] | undefined; // the current stop's standby list, switched when the rover leaves it
  let deep = false; // below the Crater descent depth on the de Gerlache side
  let inDark = false;
  let crossed = false;
  const flaresLeft = [...play.flareSeconds];
  const seenLegs = new Set<string>();
  let newGroundM = 0;
  const now = () => Math.round(s.seconds);

  const legEnergy = (l: RouteLeg) =>
    driveEnergy(l.distanceM, (Math.atan2(l.climbM, l.distanceM) * 180) / Math.PI, setup.stats.energyPerMeter, t.energy);

  const refuse = (instrument: Instrument, reason: InstrumentRefusal) => {
    refusals.push({ instrument, reason, node: at.id, seconds: s.seconds });
    log.push(`${now()}s ${instrument} refused at ${at.id} (${reason})`);
  };

  const arrive = (n: RouteNode, via: RouteLeg) => {
    const key = [via.from, via.to].sort().join('>');
    if (!seenLegs.has(key)) newGroundM += via.distanceM;
    seenLegs.add(key);
    const from = node(via.from);
    if (from.boulderField && from.boulderField === n.boulderField && crossingAngleDeg(routes, from, n) >= mt.boulderCrossMinAngleDeg + play.crossingMarginDeg) {
      crossed = true;
      for (const m of zoneMilestones('boulder-field')) credit(m);
    }
    if (n.deGerlacheSide && n.belowLandingM > mt.craterDescentDepthM) deep = true;
    if (deep && n.belowLandingM < mt.craterDescentExitDepthM) for (const m of zoneMilestones('large-crater')) credit(m);
    if (n.darkCrater) inDark = true;
    if (inDark && !n.darkCrater) for (const m of zoneMilestones('shadowed-crater')) credit(m);
    at = n;
    log.push(`${now()}s at ${n.id} (energy ${Math.round(s.energy)})`);
  };

  /** Make a stop the current one: its uses wait to be started. */
  const beginStop = () => {
    queue = [...(plan.stops[stopIndex]!.use ?? [])];
    stopIndex++;
    actionDone = false;
    stopStarted = false;
  };

  /** Leaving a stop: switch on its standby instruments (the build's switches only) and all others off. */
  const leave = () => {
    const want = pendingStandby;
    pendingStandby = undefined;
    if (!want) return;
    for (const inst of s.standbyOn) {
      if (want.includes(inst)) continue;
      const r = setStandby(s, inst, false, setup, t);
      if (r.ok) s = r.state;
    }
    for (const inst of want) {
      if (!carried.includes(inst)) continue;
      const r = setStandby(s, inst, true, setup, t);
      if (r.ok) s = r.state;
      else refuse(inst, r.reason);
    }
    log.push(`${now()}s standby [${s.standbyOn.join(' ')}] leaving ${at.id}`);
  };

  /** A sample read at the end of a drill hold, where the rover is parked. */
  const drillDone = (here: RouteNode) => {
    if (here.fromLandingM >= mt.sampleMinDistanceM) {
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
    log.push(`${now()}s drill done at ${here.id}`);
  };

  /** Start one use with the real rules (power, conditions, energy, hold time); true if it started. */
  const useInstrument = (instrument: Instrument) => {
    if (!carried.includes(instrument)) return;
    const use = startInstrumentUse(s, instrument, {
      speedMps: 0,
      inColdZone: Boolean(at.darkCrater),
      sunlight: litAt(at.lit, step, s.seconds),
      earthInView: at.earthVisible,
      boulderInReach: Boolean(at.boulderField),
    }, setup, t);
    if (!use.ok) {
      refuse(instrument, use.reason);
      return;
    }
    s = use.state;
    if (instrument === 'camera') {
      for (const m of byTrigger((m) => m.trigger.type === 'photo' && m.trigger.zone !== undefined && m.trigger.zone === at.photoZone)) credit(m);
      const sun = sunAt(s.seconds, t.sun, t.mission, routes.site);
      const lit = earthLitShare(sun, earthDir);
      if (at.earthVisible && at.fromLandingM >= mt.earthPhotoMinDistanceM && lit >= mt.earthPhotoMinLit) {
        for (const m of byTrigger((m) => m.trigger.type === 'photo' && m.trigger.target === 'earth')) credit(m);
      }
      log.push(`${now()}s photo at ${at.id}`);
    } else {
      log.push(`${now()}s ${instrument} at ${at.id}${use.holdSeconds > 0 ? ` (hold ${use.holdSeconds}s)` : ''}`);
    }
  };

  while (!s.end) {
    let driving = false;
    let sunlight = litAt(at.lit, step, s.seconds);
    let cold = Boolean(at.darkCrater);
    let uphill = 0;
    let softness = 0;

    // At each flare warning the player stops and powers down, unless the plan presses on.
    if (flaresLeft.length && s.seconds >= flaresLeft[0]! - data.events.flare.warningSeconds) {
      flaresLeft.shift();
      if (!plan.ignoreFlares) {
        shelterUntil = Math.max(shelterUntil, s.seconds + play.flareStopSeconds);
        log.push(`${now()}s flare warning: shelter at ${leg ? `${leg.from}>${leg.to}` : at.id}${s.using ? ` (${s.using.instrument} hold paused)` : ''}`);
      }
    }
    const poweredDown = s.seconds < shelterUntil;

    if (poweredDown || s.using) {
      // Parked: sheltering from a flare, or holding still while an instrument use counts down.
    } else if (leg) {
      driving = true;
    } else {
      let spent = false;
      if (!actionDone) {
        const stop = plan.stops[stopIndex - 1]!;
        if (stop.waitUntil === undefined || s.seconds >= stop.waitUntil) {
          // Start the stop's uses in order; a held use parks the rover until it is done, then the next starts.
          if (!stopStarted) spent = stopStarted = true;
          while (queue.length && !s.using) useInstrument(queue.shift()!);
          if (!queue.length && !s.using) {
            actionDone = true;
            pendingStandby = stop.standby;
          }
        }
      }
      // The stop's first step is spent there; after a hold the rover moves on as soon as it is done.
      if (actionDone && !spent) {
        if (stopIndex < plan.stops.length) {
          const next = plan.stops[stopIndex]!;
          if (next.node === at.id) {
            leave();
            beginStop();
          } else {
            const l = legBetween(routes, at.id, next.node);
            // Reasonable play: recharge in sunlight before a leg the battery cannot cover with a reserve.
            const need = Math.min(setup.stats.batteryCapacity, legEnergy(l) + play.reserveShare * setup.stats.batteryCapacity);
            if (s.energy >= need || sunlight < 0.3 || cold) {
              leave();
              leg = l;
              legPos = 0;
              driving = true;
              beginStop();
            }
          }
        } else {
          leave(); // the last stop
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
      const a = node(leg.from);
      const b = node(leg.to);
      cold = (b.darkCrater === true && f > 1 - coldShare) || (a.darkCrater === true && f < coldShare);
      if (a.boulderField && a.boulderField === b.boulderField) {
        softness = 1;
        uphill = Math.max(uphill, play.crossingUphillDeg);
      }
    }

    const prev: MissionState = { ...s, poweredDown };
    if (!poweredDown) standbyEnergy += standbyDraw(prev, setup) * DT;
    const res = stepMission(prev, {
      dt: DT, distanceM: distance, speedMps: distance / DT, uphillDeg: uphill, slopeDeg: 5, sunlight, inColdZone: cold,
      softness, throttling: driving, impactMps: 0, upY: 1,
    }, setup, t, data.events);
    if (res.state.flaresProtected > s.flaresProtected) for (const m of byTrigger((m) => m.trigger.type === 'event')) credit(m);
    s = { ...res.state, poweredDown: false };
    for (const n of res.notices) {
      if (n.kind === 'standby-off') {
        standbyOff.push(s.seconds);
        log.push(`${now()}s low energy: standby off [${n.instruments.join(' ')}]`);
      } else if (n.kind === 'instrument-done') {
        if (n.instrument === 'drill') drillDone(at);
        if (n.deployed) {
          // The station is on the ground: the rest of the run uses the lighter rover.
          setup = deployPart(setup, parts, s.deployed, t);
          speed = setup.stats.topSpeed * play.speedShare;
          log.push(`${now()}s ${n.instrument} deployed at ${at.id}`);
        }
      }
    }

    if (leg && legPos >= leg.distanceM - 1e-6 && !s.end) {
      const done = leg;
      leg = null;
      arrive(node(done.to), done);
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
    refusals,
    deployed: s.deployed,
    standbyEnergy,
    standbyOff,
    energyLeft: s.energy,
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
