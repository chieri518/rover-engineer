// The Titan parts of the mission screen: the one-day clock and the real Sun at the Shangri-La site, the
// sleep fast-forward, the long night (lights on or sleep), the always-on cold, the methane rain and its
// forecast, and their HUD words. The rules decide (rules/mission.ts titanStatus, MissionStep.marsNotices,
// rules/titan.ts titanMissionDelta); this module only words them. The lander does not recharge on Titan,
// so nothing here points the player back to base. The Moon and Mars never create one.
import type { GameData } from '../rules/types';
import type { Rng } from '../rules/events';
import { titanSetup, titanStatus, type MarsNotice, type MissionSetup, type MissionState, type TitanSetup, type TitanStatus } from '../rules/mission';
import { titanMissionDelta, titanSunAt, type TitanSite } from '../rules/titan';
import type { SkyDirection } from '../rules/sun';
import type { TitanTextSections } from '../rules/titanTypes';
import { fill } from './dom';
import { missionVars } from './tutorialText';

export interface TitanNoticeText {
  message: string;
  tone: 'warn' | 'good';
}

export class TitanMission {
  /** The real Sun at the site after `seconds` of mission time: for the scene, the sunlight test and photos. */
  readonly sunAt: (seconds: number) => SkyDirection;
  private readonly day: TitanTextSections['day'];
  private readonly rain: TitanTextSections['rain'];
  private readonly cold: TitanTextSections['cold'];
  private readonly vars: Record<string, string | number>;

  constructor(private readonly data: GameData, readonly site: TitanSite) {
    const { day, rain, cold } = data.text;
    const sol = data.tuning.sol;
    if (!day || !rain || !cold || !sol || !data.tuning.night || !data.tuning.titanCold) throw new Error('Titan needs its day, night, cold and rain data');
    this.day = day;
    this.rain = rain;
    this.cold = cold;
    this.vars = missionVars(data);
    this.sunAt = (seconds) => titanSunAt(seconds, sol, site);
  }

  /** The Titan half of the mission setup (the site and this mission's methane rain). */
  setup(rng: Rng): TitanSetup {
    return titanSetup(this.site, this.data.events, rng);
  }

  status(state: MissionState, setup: MissionSetup, driving = false): TitanStatus {
    return titanStatus(state, setup, this.data.tuning, driving)!;
  }

  /** Mission seconds in `wallDt` real seconds: 4× while asleep at night, up to dawn. For startMoonScene({ missionDelta }). */
  missionDelta(wallDt: number, missionSeconds: number, poweredDown: boolean): number {
    return titanMissionDelta(wallDt, missionSeconds, poweredDown, this.data.tuning.sol!, this.data.tuning.sleep);
  }

  /** Words for a sunset, dawn or rain notice. A rover without lights hears it cannot drive at night. */
  noticeText(n: MarsNotice, hasLights: boolean): TitanNoticeText {
    if (n.kind === 'dusk') return { message: hasLights ? this.day.sunset : this.day.sunsetNoLights, tone: 'warn' };
    if (n.kind === 'dawn') return { message: n.woke ? this.day.dawnWoke : this.day.dawn, tone: 'good' };
    return { message: fill(this.rain[n.edge], this.vars), tone: n.edge === 'cleared' ? 'good' : 'warn' };
  }

  /** "Titan day" or "Titan night", the line under the panel line. */
  dayLine(t: TitanStatus): string {
    return t.clock.isNight ? this.day.hudNight : this.day.hudDay;
  }

  /** The night state next to the day line: lights on and draining. Null otherwise (sleep has its banner). */
  nightLine(t: TitanStatus, poweredDown: boolean): string | null {
    return t.clock.isNight && !poweredDown && t.lightsOn ? this.day.lightsOn : null;
  }

  /** The panel line replacing "Solar panel in sunlight": Titan's haze leaves almost no solar power. */
  panelLine(t: TitanStatus): string {
    return t.clock.isNight ? this.day.panelNight : this.day.panelDay;
  }

  /** The banner while powered down: the night fast-forward, or a plain power-down by day. Null awake. */
  sleepBanner(t: TitanStatus, poweredDown: boolean): string | null {
    if (!poweredDown) return null;
    return t.clockRate > 1 ? fill(this.day.sleepFastForward, this.vars) : this.day.sleepingDay;
  }

  /** The standing warning for an awake rover without lights at night (it cannot drive). */
  noLightsWarning(t: TitanStatus, poweredDown: boolean, hasLights: boolean): string | null {
    return t.clock.isNight && !poweredDown && !hasLights ? this.day.noLights : null;
  }

  /** The cold warning: asleep only the heater counts, so a sleeping rover hears that it is cooling. */
  coldWarning(t: TitanStatus, poweredDown: boolean): string {
    return poweredDown && t.freezeRate > 0 ? this.cold.sleepCools : this.cold.warning;
  }

  /** The rain forecast bar: words and the share of the warning time left (1 → 0), or null outside the forecast. */
  forecast(t: TitanStatus, setup: MissionSetup, seconds: number): { message: string; remaining: number } | null {
    const storm = setup.titan?.storm;
    if (!storm || t.stormPhase !== 'forecast') return null;
    const left = Math.max(0, storm.startAt - seconds);
    return { message: fill(this.rain.forecastBar, { seconds: Math.ceil(left) }), remaining: left / Math.max(1e-6, storm.startAt - storm.forecastAt) };
  }

  /** The notice for a photograph taken in the rain (it goes into the album but counts for nothing). */
  get photoBlocked(): string {
    return this.rain.photoBlocked;
  }
}
