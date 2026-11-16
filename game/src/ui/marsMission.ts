// The Mars parts of the mission screen: the sol clock and the real Jezero Sun, the night (lights on or
// sleep), the dust storm, the weather mast's readout and early forecast, and their HUD words. The rules
// decide (rules/mission.ts marsStatus and MissionStep.marsNotices); this module only words them. The Moon
// never creates one.
import type { GameData, Part } from '../rules/types';
import { nightBudget, partPower } from '../rules/energy';
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
   */
  noticeText(n: MarsNotice, hasLights: boolean, leadSeconds = 0): MarsNoticeText {
    if (n.kind === 'dusk') return { message: hasLights ? this.night.sunset : this.night.noLights, tone: 'warn' };
    if (n.kind === 'dawn') return { message: this.night.dawn, tone: 'good' };
    const mast = this.data.text.instrumentText.weather?.forecast;
    if (n.edge === 'forecast' && n.byMast && mast) {
      const sols = Math.max(0, leadSeconds) / this.data.tuning.sol!.secondsPerSol;
      return { message: fill(mast, { ...this.vars, sols: sols.toFixed(1) }), tone: 'warn' };
    }
    return { message: fill(this.storm[n.edge], this.vars), tone: n.edge === 'cleared' ? 'good' : 'warn' };
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
 * The desk's night budget line (Mars M15): what one night costs this build asleep and parked awake with the
 * lights on (with the electric heater's share of each), and an RTG's income over the night. Null where
 * there is no night (the Moon); a dash until the power, lights and heater are chosen.
 */
export function nightBudgetLine(data: GameData, parts: Part[]): { label: string; value: string } | null {
  const { night, sol } = data.tuning;
  const t = data.text.nightBudget;
  if (!night || !sol || !t) return null;
  const label = fill(t.label, { seconds: sol.nightSeconds });
  if (!(['power', 'lights', 'heater'] as const).every((slot) => parts.some((p) => p.slot === slot))) return { label, value: '—' };
  const hasLights = parts.some((p) => (p.effects.lightRange ?? 0) > 0); // as rules/mission.ts missionSetup
  const b = nightBudget(partPower(parts), hasLights, night, sol.nightSeconds);
  const energy = (x: number) => String(Number(x.toFixed(1)));
  const items = [
    fill(t.asleep, { energy: energy(b.asleep) }),
    b.withLights !== null && fill(t.lights, { energy: energy(b.withLights) }),
    b.heater > 0 && fill(t.heater, { energy: energy(b.heater) }),
    b.steady > 0 && fill(t.steady, { energy: energy(b.steady) }),
  ].filter((x): x is string => Boolean(x));
  return { label, value: items.join(t.separator) };
}
