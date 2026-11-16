// The mission's sound: turns what the mission screen already knows (the rover's speed, the step's
// notices, the standing warnings, the weather) into the motor hum, weather ambience and cues. Warnings
// sound on their rising edge only, rate-limited; everything else sounds once per event.
import type { MarsNotice, MissionNotice } from '../rules/mission';
import type { Instrument } from '../rules/types';
import type { WorldId } from '../worlds';
import { sound } from './index';
import type { RoverHum, Weather } from './loops';
import { BUMP_COOLDOWN_SECONDS, BUMP_SHARE, MOTOR, WARNING_COOLDOWN_SECONDS } from './mix';
import type { CueId, Voice } from './sfx';
import { Cooldown, motorTone, WarningGate } from './tune';

const HUM_EVERY_STEPS = 3; // the hum follows the speed at 20 Hz, not every physics step

/** Which cue a standing warning sounds when it starts (none: the player chose it, or the HUD says enough). */
const WARNING_CUES: Record<string, CueId | null> = {
  lowEnergy: 'lowEnergy',
  highDamage: 'damage',
  cold: 'cold',
  steepSlope: 'caution',
  slip: 'caution',
  noLights: 'caution',
  boundary: 'caution',
  poweredDown: null,
};

export interface DriveSound {
  speedMps: number; // absolute
  throttle: number;
  wheelsOnGround: number;
  awake: boolean; // powered up, not paused, mission running
  deltaV: number; // this step's velocity jolt (bumps)
}

export class MissionSound {
  private hum: RoverHum | null = null;
  private weather: Weather | null = null;
  private readonly gate = new WarningGate<string>(WARNING_COOLDOWN_SECONDS);
  private readonly bump = new Cooldown(BUMP_COOLDOWN_SECONDS);
  private readonly refusal = new Cooldown(0.4);
  private held: Voice | null = null;
  private steps = 0;
  private disposed = false;

  constructor(
    private readonly world: WorldId,
    private readonly topSpeedMps: number,
    private readonly impactMinMps: number,
  ) {}

  private now(): number {
    return performance.now() / 1000;
  }

  /** Each physics step: the motor hum and soft bumps. */
  drive(d: DriveSound): void {
    if (this.disposed) return;
    if (d.awake && d.deltaV > this.impactMinMps * BUMP_SHARE && d.deltaV < this.impactMinMps && this.bump.ready(this.now())) sound.cue('bump');
    if (++this.steps % HUM_EVERY_STEPS !== 0) return;
    this.hum ??= sound.roverHum(this.world === 'moon');
    this.hum?.set(motorTone({ ...d, topSpeedMps: this.topSpeedMps, moon: this.world === 'moon' }, MOTOR));
  }

  /** The hum stops while the mission is paused or over. */
  silence(): void {
    this.hum?.set(motorTone({ speedMps: 0, topSpeedMps: 1, throttle: 0, wheelsOnGround: 0, awake: false, moon: false }, MOTOR));
  }

  /** The step's one-off events. */
  notices(notices: readonly MissionNotice[]): void {
    for (const n of notices) {
      switch (n.kind) {
        case 'impact':
          sound.cue('impact', { strength: n.damage / 20 });
          break;
        case 'quake':
          sound.cue('quake');
          break;
        case 'flare-warning':
          sound.cue('flareWarning');
          break;
        case 'flare-hit':
          sound.cue(n.protected ? 'flareSafe' : 'flareHit');
          break;
        case 'standby-off':
          sound.cue('switchOff');
          break;
        case 'instrument-done':
          this.useDone(n.instrument);
          break;
      }
    }
  }

  /** Mars and Titan: dusk, dawn and the storm (Titan's methane rain) forecast, start and end. */
  dayNotices(notices: readonly MarsNotice[]): void {
    for (const n of notices) {
      if (n.kind === 'dusk') sound.cue('dusk');
      else if (n.kind === 'dawn') sound.cue('dawn');
      else sound.cue(n.edge === 'forecast' ? 'stormForecast' : n.edge === 'started' ? 'stormStart' : 'stormClear');
    }
  }

  /** The standing warnings now (ids as the mission names them, plus 'boundary'): new ones sound once. */
  warnings(ids: readonly string[]): void {
    for (const id of this.gate.update(ids, this.now())) {
      const cue = WARNING_CUES[id];
      if (cue) sound.cue(cue);
    }
  }

  /** Storm wind and rain, each 0..1 (Mars storm, Titan rain). */
  setWeather(wind: number, rain: number): void {
    if (this.disposed) return;
    if (!this.weather && (wind > 0 || rain > 0)) this.weather = sound.weather();
    this.weather?.set(wind, rain);
  }

  /** An instrument was used (a held use starts its whir; the camera clicks; a switch beeps). */
  useStart(inst: Instrument, holdSeconds: number): void {
    this.held?.stop();
    const seconds = holdSeconds + 0.5;
    if (inst === 'camera') sound.cue('shutter');
    else if (inst === 'drill') this.held = sound.cue('drill', { seconds });
    else if (inst === 'xray') this.held = sound.cue('scan', { seconds });
    else if (inst === 'seismometer' || inst === 'reflector') this.held = sound.cue('deploy', { seconds });
    else sound.cue('switchOn');
  }

  private useDone(inst: Instrument): void {
    this.held?.stop();
    this.held = null;
    if (inst === 'drill') sound.cue('drillDone');
    else if (inst === 'xray') sound.cue('scanDone');
    else if (inst === 'seismometer' || inst === 'reflector') sound.cue('stationDown');
  }

  switched(on: boolean): void {
    sound.cue(on ? 'switchOn' : 'switchOff');
  }

  refused(): void {
    if (this.refusal.ready(this.now())) sound.cue('refuse');
  }

  power(poweredDown: boolean): void {
    sound.cue(poweredDown ? 'powerDown' : 'powerUp');
  }

  milestone(): void {
    sound.cue('milestone');
  }

  discovered(): void {
    sound.cue('discover');
  }

  quakeRecorded(noisy: boolean): void {
    sound.cue('quakeRecord', { noisy });
  }

  end(survived: boolean): void {
    this.held?.stop();
    this.silence();
    this.weather?.set(0, 0);
    sound.cue(survived ? 'missionSurvived' : 'missionLost');
  }

  dispose(): void {
    this.disposed = true;
    this.held?.stop();
    this.hum?.dispose();
    this.weather?.dispose();
    this.hum = null;
    this.weather = null;
  }
}
