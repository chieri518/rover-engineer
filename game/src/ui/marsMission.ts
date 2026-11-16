// The Mars parts of the mission screen: the sol clock and the real Jezero Sun, the night (lights on or
// sleep), the dust storm, and their HUD words. The rules decide (rules/mission.ts marsStatus and
// MissionStep.marsNotices); this module only words them. The Moon never creates one.
import type { GameData } from '../rules/types';
import type { Rng } from '../rules/events';
import { marsSetup, marsStatus, type MarsNotice, type MarsSetup, type MarsStatus, type MissionSetup, type MissionState } from '../rules/mission';
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

  /** The Mars half of the mission setup (the site and this mission's dust storm). */
  setup(rng: Rng): MarsSetup {
    return marsSetup(this.site, this.data.events, rng);
  }

  status(state: MissionState, setup: MissionSetup): MarsStatus {
    return marsStatus(state, setup, this.data.tuning)!;
  }

  /** Words for a sunset, dawn or storm notice. A rover without lights hears it cannot drive at night. */
  noticeText(n: MarsNotice, hasLights: boolean): MarsNoticeText {
    if (n.kind === 'dusk') return { message: hasLights ? this.night.sunset : this.night.noLights, tone: 'warn' };
    if (n.kind === 'dawn') return { message: this.night.dawn, tone: 'good' };
    return { message: fill(this.storm[n.edge], this.vars), tone: n.edge === 'cleared' ? 'good' : 'warn' };
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
