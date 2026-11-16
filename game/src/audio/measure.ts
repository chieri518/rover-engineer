// Development check of the mix: render each music mood, the rover hum, the weather and every effect
// offline through the real bus graph at the player's volumes, and report peak and RMS in dBFS.
import type { Settings } from '../save/settings';
import { buildBuses, setVolumes } from './graph';
import { RoverHum, Weather } from './loops';
import { MOODS, MOTOR, type MoodId } from './mix';
import { MoodVoice } from './music';
import { CUE_IDS, Sfx, type CueId } from './sfx';
import { levels, motorTone } from './tune';

const RATE = 44100;

async function render(seconds: number, s: Pick<Settings, 'musicVolume' | 'effectsVolume'>, play: (b: ReturnType<typeof buildBuses>) => void) {
  const ac = new OfflineAudioContext(2, Math.round(RATE * seconds), RATE);
  const b = buildBuses(ac);
  setVolumes(b, s.musicVolume, s.effectsVolume, 0);
  play(b);
  const out = await ac.startRendering();
  return levels([out.getChannelData(0), out.getChannelData(1)]);
}

export async function measureMix(settings: Pick<Settings, 'musicVolume' | 'effectsVolume'>, seconds = 30) {
  const music: Partial<Record<MoodId, { peakDb: number; rmsDb: number }>> = {};
  for (const id of Object.keys(MOODS) as MoodId[]) {
    music[id] = await render(seconds, settings, (b) => new MoodVoice(b, id, MOODS[id], 0, 0.5).tick(seconds));
  }
  const loops = {
    roverTopSpeed: await render(4, settings, (b) => new RoverHum(b, false).set(motorTone({ speedMps: 4, topSpeedMps: 4, throttle: 1, wheelsOnGround: 4, awake: true, moon: false }, MOTOR))),
    roverMoonTopSpeed: await render(4, settings, (b) => new RoverHum(b, true).set(motorTone({ speedMps: 4, topSpeedMps: 4, throttle: 1, wheelsOnGround: 4, awake: true, moon: true }, MOTOR))),
    fullStormWind: await render(6, settings, (b) => new Weather(b).set(1, 0)),
    fullRain: await render(6, settings, (b) => new Weather(b).set(0, 1)),
  };
  const effects: Partial<Record<CueId, { peakDb: number; rmsDb: number }>> = {};
  for (const id of CUE_IDS) effects[id] = await render(5, settings, (b) => new Sfx(b).play(id, { seconds: 2, strength: 1 }, 0));
  return { settings, music, loops, effects };
}
