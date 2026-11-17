// The Mars parts of the mission screen: the sol clock and the real Jezero Sun, the night (lights on or
// sleep), the dust storm, the weather mast's readout and early forecast, and their HUD words. The rules
// decide (rules/mission.ts marsStatus and MissionStep.marsNotices); this module only words them. The Moon
// never creates one.
import type { GameData, Part } from '../rules/types';
import { nightBudget, nightNetState, partPower, type NightNetState } from '../rules/energy';
import type { Rng } from '../rules/events';
import { marsSetup, marsStatus, marsWeatherSky, type MarsNotice, type MarsSetup, type MarsStatus, type MissionSetup, type MissionState } from '../rules/mission';
import { weatherReadout } from '../rules/instruments';
import { marsSunAt } from '../rules/marsSun';
import type { SkyDirection } from '../rules/sun';
import type { MarsTextSections } from '../rules/marsTypes';
import { fill } from './dom';
import { missionVars } from './tutorialText';

export interface MarsNoticeText {
  message: string;
  tone: 'warn' | 'good';
}

export class MarsMission {
  /** The real Sun at the site after `seconds` of mission time: for the scene, the sunlight test and photos. */
  readonly sunAt: (seconds: number) => SkyDirection;
  private readonly night: MarsTextSections['night'];
  private readonly storm: MarsTextSections['storm'];
  private readonly sol: MarsTextSections['sol'];
  private readonly vars: Record<string, string | number>;

  constructor(private readonly data: GameData, readonly site: MarsSetup['site']) {
    const { night, storm, sol } = data.text;
    const solTuning = data.tuning.sol;
    if (!night || !storm || !sol || !solTuning || !data.tuning.night) throw new Error('Mars needs its sol, night and storm data');
    this.night = night;
    this.storm = storm;
    this.sol = sol;
    this.vars = missionVars(data);
    this.sunAt = (seconds) => marsSunAt(seconds, solTuning, site);
  }

  /** The Mars half of the mission setup (the site, this mission's dust storm and its dust devils). */
  setup(rng: Rng): MarsSetup {
    return marsSetup(this.site, this.data.events, rng, this.data.tuning);
  }

  status(state: MissionState, setup: MissionSetup): MarsStatus {
    return marsStatus(state, setup, this.data.tuning)!;
  }

  /**
   * Words for a sunset, dawn or storm notice. A rover without lights hears it cannot drive at night. A
   * forecast the weather mast gave early credits the mast, with the storm's lead (`leadSeconds`) in sols.
   * A rover without solar income (`solar` false: an RTG) is not told at dawn that its panel charges, nor that
   * the storm cuts its solar income.
   */
  noticeText(n: MarsNotice, hasLights: boolean, leadSeconds = 0, solar = true): MarsNoticeText {
    if (n.kind === 'dusk') return { message: hasLights ? this.night.sunset : this.night.noLights, tone: 'warn' };
    if (n.kind === 'dawn') return { message: solar ? this.night.dawn : this.night.dawnNoSolar ?? this.night.dawn, tone: 'good' };
    const wt = this.data.text.instrumentText.weather;
    const mast = (!solar && wt?.forecastNoSolar) || wt?.forecast;
    if (n.edge === 'forecast' && n.byMast && mast) {
      const sols = Math.max(0, leadSeconds) / this.data.tuning.sol!.secondsPerSol;
      return { message: fill(mast, { ...this.vars, sols: sols.toFixed(1) }), tone: 'warn' };
    }
    const words = (!solar && this.storm[`${n.edge}NoSolar` as const]) || this.storm[n.edge];
    return { message: fill(words, this.vars), tone: n.edge === 'cleared' ? 'good' : 'warn' };
  }

  /** The weather mast's HUD line now: pressure, dust opacity and their trends. Null without the mast's tuning or text. */
  weatherLine(seconds: number, setup: MissionSetup): string | null {
    const t = this.data.tuning.instruments.weather;
    const it = this.data.text.instrumentText.weather;
    const now = marsWeatherSky(seconds, setup, this.data.tuning);
    const before = t ? marsWeatherSky(seconds - t.trendSeconds, setup, this.data.tuning) : null;
    if (!t || !it?.readout || !now || !before) return null;
    const r = weatherReadout(now, before, t);
    const arrow = (x: keyof NonNullable<typeof it.trend>) => it.trend?.[x] ?? '';
    return fill(it.readout, { pressure: Math.round(r.pressurePa), pressureTrend: arrow(r.pressureTrend), tau: r.tau.toFixed(2), dustTrend: arrow(r.dustTrend) });
  }

  /** "Sol 3 of 10". */
  solLine(m: MarsStatus): string {
    return fill(this.sol.hudSol, { sol: m.clock.sol, total: this.data.tuning.sol!.sols });
  }

  /** The night state under the sol line: asleep, or lights on and draining. Null by day. */
  nightLine(m: MarsStatus, poweredDown: boolean): string | null {
    if (!m.clock.isNight) return null;
    return poweredDown ? this.night.sleeping : m.lightsOn ? this.night.lightsOn : null;
  }

  /** The standing warning for an awake rover without lights at night (it cannot drive). */
  noLightsWarning(m: MarsStatus, poweredDown: boolean, hasLights: boolean): string | null {
    return m.clock.isNight && !poweredDown && !hasLights ? this.night.noLights : null;
  }
}

/**
 * The desk's night budget line (Mars M15): the night tile's label and its full sentence (the draws asleep and
 * awake with lights, the electric heater's share, an RTG's income, and the battery's net change). Null where
 * there is no night budget (the Moon, Titan); a dash until the power source is chosen.
 */
export function nightBudgetLine(data: GameData, parts: Part[]): { label: string; value: string } | null {
  const tile = nightBudgetTile(data, parts);
  return tile && { label: tile.label, value: tile.sentence };
}

/**
 * One value of the night tile: its label, the signed net rate per second ("+0.4", "−3.4") with its unit, or
 * "No lights"; the night's net change underneath ("+6 per night"), with the battery share for an amber or red
 * value ("−78 per night · 20%"); its state.
 */
export interface NightTileItem {
  key: 'asleep' | 'lights';
  label: string;
  value: string;
  unit: string; // "/s"; empty for "No lights"
  sub: string | null; // null: no value (a rover without lights)
  state: NightNetState | null; // null: no value (a rover without lights)
}

export interface NightTile {
  label: string; // "Night energy"
  items: NightTileItem[]; // asleep, then awake with lights; none until the power source is chosen
  sentence: string; // the tooltip and screen-reader sentence; a dash until the power source is chosen
}

/** A signed energy figure: "+6", "+0", "−21" (a true minus sign). */
export function signedEnergy(x: number): string {
  const v = Number(x.toFixed(1));
  return v < 0 ? `\u2212${String(-v)}` : `+${String(v === 0 ? 0 : v)}`;
}

/**
 * A signed rate per second: one decimal ("+0.4", "−3.4", "+2.0"), or two when its size is under 0.1 ("−0.05"),
 * so a small rate never reads "0.0". A true minus sign, never "−0".
 */
export function signedRate(x: number): string {
  const digits = Math.abs(x) < 0.1 ? 2 : 1;
  const v = Number(x.toFixed(digits));
  return v < 0 ? `\u2212${(-v).toFixed(digits)}` : `+${Math.abs(v).toFixed(digits)}`;
}

/**
 * The night budget as the specification's night tile shows it: the battery's net rate at night per second,
 * asleep and awake with the lights on, with the whole night's net change underneath (rules/energy.ts
 * nightBudget, nightNetState: green when steady income covers it, amber from night.largeLossShare of the
 * battery, red when it would empty the battery), and the whole breakdown as one sentence. Null where there
 * is no night budget (the Moon, Titan).
 */
export function nightBudgetTile(data: GameData, parts: Part[]): NightTile | null {
  const { night, sol } = data.tuning;
  const t = data.text.nightBudget;
  if (!night || !sol || !t) return null;
  const seconds = sol.nightSeconds;
  const label = fill(t.label, { seconds });
  if (!parts.some((p) => p.slot === 'power')) return { label, items: [], sentence: '\u2014' };
  const hasLights = parts.some((p) => (p.effects.lightRange ?? 0) > 0); // as rules/mission.ts missionSetup
  const b = nightBudget(partPower(parts), hasLights, night, seconds);
  const battery = parts.some((p) => p.slot === 'battery') ? parts.reduce((sum, p) => sum + (p.effects.batteryCapacity ?? 0), 0) : null;
  const energy = (x: number) => String(Number(x.toFixed(1)));
  const percent = (net: number) => (battery ? Math.round((-net / battery) * 100) : 0);
  const item = (key: NightTileItem['key'], net: number | null, rate: number | null): NightTileItem => {
    const label = key === 'asleep' ? t.asleep : t.lights;
    if (net === null || rate === null) return { key, label, value: t.noLights, unit: '', sub: null, state: null };
    const state = nightNetState(net, battery, night);
    const sub = fill(state === 'large' || state === 'empties' ? t.perNightShare : t.perNight, { net: signedEnergy(net), percent: percent(net) });
    return { key, label, value: signedRate(rate), unit: data.text.design.spec.perSecond, sub, state };
  };
  const items = [item('asleep', b.net.asleep, b.rate.asleep), item('lights', b.net.withLights, b.rate.withLights)];

  const uses = [fill(t.usesAsleep, { energy: energy(b.asleep) }), b.withLights !== null && fill(t.usesLights, { energy: energy(b.withLights) })]
    .filter((x): x is string => Boolean(x)).join(t.usesJoin);
  const heater = b.heater > 0 ? fill(b.withLights !== null ? t.heaterEach : t.heaterOne, { energy: energy(b.heater) }) : '';
  const steady = b.steady > 0 ? fill(t.steady, { energy: energy(b.steady) }) : '';
  const changes = [
    fill(t.changesAsleep, { rate: signedRate(b.rate.asleep), net: signedEnergy(b.net.asleep), seconds }),
    b.net.withLights !== null && b.rate.withLights !== null && fill(t.changesLights, { rate: signedRate(b.rate.withLights), net: signedEnergy(b.net.withLights), seconds }),
  ].filter((x): x is string => Boolean(x)).join(t.changesJoin);
  const states = items.flatMap((x) => {
    const net = x.key === 'asleep' ? b.net.asleep : b.net.withLights;
    if (net === null || battery === null || battery <= 0) return [];
    if (x.state === 'empties') return [fill(t.stateEmpties, { mode: x.label })];
    if (x.state === 'large') return [fill(t.stateLarge, { mode: x.label, percent: percent(net) })];
    return [];
  });
  const sentence = [fill(t.sentence, { seconds, uses, heater, steady, changes }), ...states].join(' ');
  return { label, items, sentence };
}
