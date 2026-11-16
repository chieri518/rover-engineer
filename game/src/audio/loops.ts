// Continuous sounds during a mission, built once and steered by parameter glides (no nodes made per
// frame): the rover's motor hum and wheel crunch, and the weather (Mars storm wind, Titan rain).
import type { Buses } from './graph';
import { MOTOR, WEATHER } from './mix';
import type { MotorTone } from './tune';

/** The motor: a filtered sawtooth with a faint whine, and a gritty noise for the wheels on the ground. */
export class RoverHum {
  private readonly osc: OscillatorNode;
  private readonly whine: OscillatorNode;
  private readonly filter: BiquadFilterNode;
  private readonly gain: GainNode;
  private readonly crunch: GainNode;
  private readonly grain: OscillatorNode;
  private readonly noise: AudioBufferSourceNode;
  private readonly out: GainNode;

  constructor(private readonly b: Buses, thinAir: boolean) {
    const ac = b.ac;
    const t = ac.currentTime;
    this.out = ac.createGain();
    this.out.connect(b.effects);

    this.osc = ac.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = MOTOR.idleHz;
    this.whine = ac.createOscillator();
    this.whine.type = 'sine';
    this.whine.frequency.value = MOTOR.idleHz * 3;
    const whineGain = ac.createGain();
    whineGain.gain.value = MOTOR.whineGain;
    this.filter = ac.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 1.5;
    this.filter.frequency.value = (thinAir ? MOTOR.thinAirCutoffHz : MOTOR.cutoffHz)[0];
    this.gain = ac.createGain();
    this.gain.gain.value = 0;
    this.osc.connect(this.filter);
    this.whine.connect(whineGain).connect(this.filter);
    this.filter.connect(this.gain).connect(this.out);

    // Wheel crunch: band-passed noise chopped by a low "grain" oscillator, so it crackles rather than hisses.
    this.noise = ac.createBufferSource();
    this.noise.buffer = b.white;
    this.noise.loop = true;
    const nf = ac.createBiquadFilter();
    nf.type = thinAir ? 'lowpass' : 'bandpass';
    nf.frequency.value = thinAir ? MOTOR.thinAirCrunchHz : MOTOR.crunchHz;
    nf.Q.value = 0.9;
    const chop = ac.createGain();
    chop.gain.value = 0.5;
    this.grain = ac.createOscillator();
    this.grain.type = 'sawtooth';
    this.grain.frequency.value = MOTOR.crunchGrainHz[0];
    const grainDepth = ac.createGain();
    grainDepth.gain.value = 0.5;
    this.grain.connect(grainDepth).connect(chop.gain);
    this.crunch = ac.createGain();
    this.crunch.gain.value = 0;
    this.noise.connect(nf).connect(chop).connect(this.crunch).connect(this.out);

    this.osc.start(t);
    this.whine.start(t);
    this.grain.start(t);
    this.noise.start(t);
  }

  set(tone: MotorTone): void {
    const t = this.b.ac.currentTime;
    const k = MOTOR.smoothing;
    this.osc.frequency.setTargetAtTime(tone.hz, t, k);
    this.whine.frequency.setTargetAtTime(tone.hz * 3, t, k);
    this.filter.frequency.setTargetAtTime(tone.cutoffHz, t, k);
    this.gain.gain.setTargetAtTime(tone.gain, t, k);
    this.crunch.gain.setTargetAtTime(tone.crunchGain, t, k);
    this.grain.frequency.setTargetAtTime(tone.crunchGrainHz, t, k);
  }

  dispose(): void {
    const t = this.b.ac.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.1);
    for (const s of [this.osc, this.whine, this.grain, this.noise]) s.stop(t + 0.6);
  }
}

/** Weather: storm wind (gusting band-passed noise) and rain (a soft hiss over a low patter). */
export class Weather {
  private readonly wind: GainNode;
  private readonly rain: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(private readonly b: Buses) {
    const ac = b.ac;
    const t = ac.currentTime;
    const loop = (buffer: AudioBuffer) => {
      const s = ac.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.start(t, Math.random() * 1.5);
      this.sources.push(s);
      return s;
    };
    const filter = (type: BiquadFilterType, hz: number, q: number) => {
      const f = ac.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      f.Q.value = q;
      return f;
    };
    const lfo = (hz: number, depth: number, target: AudioParam) => {
      const o = ac.createOscillator();
      o.frequency.value = hz;
      const g = ac.createGain();
      g.gain.value = depth;
      o.connect(g).connect(target);
      o.start(t);
      this.sources.push(o);
    };

    this.wind = ac.createGain();
    this.wind.gain.value = 0;
    const wf = filter('bandpass', 700, 0.7);
    lfo(0.11, 400, wf.frequency);
    const gust = ac.createGain();
    gust.gain.value = 0.7;
    lfo(0.06, 0.3, gust.gain);
    loop(b.white).connect(wf).connect(gust).connect(this.wind).connect(b.effects);

    this.rain = ac.createGain();
    this.rain.gain.value = 0;
    const hiss = filter('highpass', 2500, 0.5);
    const hissTop = filter('lowpass', 8000, 0.5);
    const hissGain = ac.createGain();
    hissGain.gain.value = 0.6;
    loop(b.white).connect(hiss).connect(hissTop).connect(hissGain).connect(this.rain);
    const patter = filter('bandpass', 900, 0.8);
    const patterGain = ac.createGain();
    patterGain.gain.value = 0.5;
    lfo(0.09, 0.15, patterGain.gain);
    loop(b.brown).connect(patter).connect(patterGain).connect(this.rain);
    this.rain.connect(b.effects);
    this.rain.connect(b.effectsReverb);
  }

  /** Storm wind and rain, each 0..1. */
  set(wind: number, rain: number): void {
    const t = this.b.ac.currentTime;
    this.wind.gain.setTargetAtTime(WEATHER.windBase + (WEATHER.windMax - WEATHER.windBase) * clamp01(wind), t, WEATHER.smoothing);
    this.rain.gain.setTargetAtTime(WEATHER.rainMax * clamp01(rain), t, WEATHER.smoothing);
  }

  dispose(): void {
    const t = this.b.ac.currentTime;
    this.wind.gain.setTargetAtTime(0, t, 0.4);
    this.rain.gain.setTargetAtTime(0, t, 0.4);
    for (const s of this.sources) s.stop(t + 2.5);
  }
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}
