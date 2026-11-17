// One-shot sound effects, synthesized per cue from oscillators and the shared noise. Soft attacks and
// short tails, all through the effects bus; at most SFX.maxVoices sound at once (more are dropped).
import type { Buses } from './graph';
import { SFX } from './mix';

export type CueId =
  | 'click' | 'partAdd' | 'partRemove' | 'launch'
  | 'milestone' | 'discover' | 'refuse'
  | 'shutter' | 'drill' | 'scan' | 'laser' | 'deploy' | 'drillDone' | 'scanDone' | 'stationDown' | 'switchOn' | 'switchOff' | 'quakeRecord'
  | 'lowEnergy' | 'damage' | 'cold' | 'caution' | 'impact' | 'bump' | 'quake'
  | 'flareWarning' | 'flareHit' | 'flareSafe' | 'stormForecast' | 'stormStart' | 'stormClear' | 'dusk' | 'dawn'
  | 'powerDown' | 'powerUp' | 'missionSurvived' | 'missionLost';

export const CUE_IDS: CueId[] = [
  'click', 'partAdd', 'partRemove', 'launch', 'milestone', 'discover', 'refuse',
  'shutter', 'drill', 'scan', 'laser', 'deploy', 'drillDone', 'scanDone', 'stationDown', 'switchOn', 'switchOff', 'quakeRecord',
  'lowEnergy', 'damage', 'cold', 'caution', 'impact', 'bump', 'quake',
  'flareWarning', 'flareHit', 'flareSafe', 'stormForecast', 'stormStart', 'stormClear', 'dusk', 'dawn',
  'powerDown', 'powerUp', 'missionSurvived', 'missionLost',
];

export interface CueOptions {
  seconds?: number; // held cues (drill, scan, laser, deploy): how long
  strength?: number; // 0..1 (impact)
  noisy?: boolean; // quakeRecord: buried in the rover's own noise
}

interface ToneOpts {
  type?: OscillatorType;
  attack?: number;
  endHz?: number; // glide to this pitch over the tone
  pan?: number;
  wet?: boolean; // send to the reverb
}

interface NoiseOpts {
  type?: BiquadFilterType;
  q?: number;
  attack?: number;
  endHz?: number;
  brown?: boolean;
  wet?: boolean;
}

/** A cue that is playing; a held cue (drill, scan, deploy) is stopped when the hold ends. */
export interface Voice {
  stop(fadeSeconds?: number): void;
}

export class Sfx {
  private ends: number[] = [];
  /** The voice being built: its dry and reverb outputs. */
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;

  constructor(private readonly b: Buses) {}

  private get ac(): BaseAudioContext {
    return this.b.ac;
  }

  /** Output for one part of the voice: panned, into the voice's dry output and (optionally) its reverb send. */
  private out(pan = 0, wet = false): AudioNode {
    const p = this.ac.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.dry!);
    if (wet) p.connect(this.wet!);
    return p;
  }

  private tone(t: number, hz: number, dur: number, gain: number, o: ToneOpts = {}): void {
    const ac = this.ac;
    const osc = ac.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(hz, t);
    if (o.endHz) osc.frequency.exponentialRampToValueAtTime(o.endHz, t + dur);
    const g = ac.createGain();
    const attack = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
    osc.connect(g).connect(this.out(o.pan, o.wet));
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, gain: number, hz: number, o: NoiseOpts = {}): void {
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = o.brown ? this.b.brown : this.b.white;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(hz, t);
    if (o.endHz) f.frequency.exponentialRampToValueAtTime(o.endHz, t + dur);
    f.Q.value = o.q ?? 1;
    const g = ac.createGain();
    const attack = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
    src.connect(f).connect(g).connect(this.out(0, o.wet));
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** A held mechanical whir (drill, servo, scan): a filtered buzz with a tremolo, faded in and out. */
  private whir(t: number, dur: number, hz: number, gain: number, cutoff: number, tremHz: number, grit: number): void {
    const ac = this.ac;
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz * 0.8, t);
    osc.frequency.linearRampToValueAtTime(hz, t + 0.3);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const env = ac.createGain();
    const end = t + Math.max(0.4, dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.25);
    env.gain.setValueAtTime(gain, end - 0.3);
    env.gain.linearRampToValueAtTime(0, end);
    const trem = ac.createOscillator();
    trem.frequency.value = tremHz;
    const tremDepth = ac.createGain();
    tremDepth.gain.value = 0.35;
    const vca = ac.createGain();
    vca.gain.value = 0.65;
    trem.connect(tremDepth).connect(vca.gain);
    osc.connect(f).connect(vca).connect(env).connect(this.out());
    osc.start(t);
    trem.start(t);
    osc.stop(end + 0.05);
    trem.stop(end + 0.05);
    if (grit > 0) {
      const src = ac.createBufferSource();
      src.buffer = this.b.white;
      src.loop = true;
      const nf = ac.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = cutoff * 1.5;
      nf.Q.value = 1.2;
      const ng = ac.createGain();
      ng.gain.value = grit;
      src.connect(nf).connect(ng).connect(vca);
      src.start(t, Math.random());
      src.stop(end + 0.05);
    }
  }

  /** Play a cue now (or at `at`, audio time). Returns null when dropped (too many voices at once). */
  play(id: CueId, opts: CueOptions = {}, at = this.ac.currentTime): Voice | null {
    const ac = this.ac;
    const now = ac.currentTime;
    this.ends = this.ends.filter((e) => e > now);
    if (this.ends.length >= SFX.maxVoices) return null;
    const dry = ac.createGain();
    const wet = ac.createGain();
    dry.connect(this.b.effects);
    wet.connect(this.b.effectsReverb);
    this.dry = dry;
    this.wet = wet;
    const length = this.render(id, at + 0.01, opts);
    this.dry = this.wet = null;
    const end = at + length;
    this.ends.push(end);
    return {
      stop: (fade = 0.2) => {
        const t = ac.currentTime;
        if (t >= end) return;
        for (const g of [dry.gain, wet.gain]) {
          g.cancelScheduledValues(t);
          g.setValueAtTime(g.value, t);
          g.linearRampToValueAtTime(0, t + fade);
        }
      },
    };
  }

  /** Builds the cue; returns its length in seconds. */
  private render(id: CueId, t: number, o: CueOptions): number {
    const s = SFX;
    switch (id) {
      // UI and building
      case 'click':
        this.tone(t, 2100, 0.035, s.click, { endHz: 1500 });
        return 0.05;
      case 'partAdd':
        this.noise(t, 0.06, s.part * 0.6, 900, { type: 'lowpass' });
        this.tone(t + 0.01, 523, 0.12, s.part, { type: 'triangle' });
        this.tone(t + 0.08, 784, 0.22, s.part * 0.8, { type: 'triangle', wet: true });
        return 0.32;
      case 'partRemove':
        this.tone(t, 659, 0.12, s.part * 0.8, { type: 'triangle' });
        this.tone(t + 0.07, 440, 0.2, s.part * 0.7, { type: 'triangle' });
        return 0.3;
      case 'launch':
        // A rising rumble and roar, and a bright tone climbing out of it.
        this.noise(t, 4.5, s.launch, 90, { type: 'lowpass', attack: 1.2, endHz: 400, brown: true });
        this.noise(t + 0.4, 4, s.launch * 0.35, 300, { type: 'bandpass', q: 0.6, attack: 1.5, endHz: 2400, wet: true });
        this.tone(t + 0.3, 110, 4, s.launch * 0.25, { type: 'triangle', attack: 1.4, endHz: 330 });
        return 4.6;
      // Milestones and instruments
      case 'milestone':
        [784, 988, 1175, 1568].forEach((hz, i) => this.tone(t + i * 0.11, hz, 1.6, s.chime * (i === 3 ? 0.7 : 1), { pan: -0.3 + i * 0.2, wet: true }));
        return 2;
      case 'discover':
        this.tone(t, 880, 0.6, s.chime * 0.6, { wet: true });
        this.tone(t + 0.12, 1320, 0.8, s.chime * 0.5, { wet: true });
        return 0.95;
      case 'refuse':
        this.tone(t, 247, 0.1, s.instrument * 0.6, { type: 'triangle' });
        this.tone(t + 0.12, 233, 0.14, s.instrument * 0.6, { type: 'triangle' });
        return 0.3;
      case 'shutter':
        this.noise(t, 0.025, s.instrument * 1.4, 4000, { type: 'highpass' });
        this.tone(t, 1800, 0.02, s.instrument * 0.4, { type: 'square' });
        this.noise(t + 0.075, 0.04, s.instrument * 1.1, 3000, { type: 'highpass' });
        return 0.15;
      case 'drill': {
        const d = o.seconds ?? 2;
        this.whir(t, d, 95, s.instrument * 0.9, 900, 11, 0.5);
        return d + 0.1;
      }
      case 'scan': {
        const d = o.seconds ?? 1.5;
        this.tone(t, 330, d, s.instrument * 0.35, { attack: 0.3, endHz: 660, wet: true });
        for (let k = 0.25; k < d; k += 0.35) this.tone(t + k, 1760, 0.05, s.instrument * 0.35);
        return d + 0.1;
      }
      case 'laser': {
        // The laser spectrometer's zaps: bursts of sharp ticks (Perseverance's microphone heard SuperCam's
        // laser on Mars as clicks), a short pause between bursts, and a faint charge tone under each burst.
        const d = o.seconds ?? 2;
        for (let burst = 0.1; burst < d - 0.2; burst += 1.2) {
          this.tone(t + burst, 2200, 0.8, s.instrument * 0.12, { attack: 0.2, endHz: 2600 });
          for (let k = 0; k < 8 && burst + k * 0.1 < d; k++) {
            const z = t + burst + k * 0.1;
            this.noise(z, 0.012, s.instrument * 1.1, 3500, { type: 'highpass' });
            this.tone(z, 1400, 0.015, s.instrument * 0.3, { type: 'square' });
          }
        }
        return d + 0.1;
      }
      case 'deploy': {
        const d = o.seconds ?? 2;
        this.whir(t, d, 70, s.instrument * 0.7, 600, 5, 0.25);
        return d + 0.1;
      }
      case 'drillDone':
        this.tone(t, 988, 0.25, s.instrument * 0.7, { wet: true });
        this.tone(t + 0.12, 1319, 0.4, s.instrument * 0.6, { wet: true });
        return 0.55;
      case 'scanDone':
        [1568, 1760, 2093].forEach((hz, i) => this.tone(t + i * 0.07, hz, 0.12, s.instrument * 0.55));
        return 0.35;
      case 'stationDown':
        this.tone(t, 140, 0.35, s.instrument * 1.4, { endHz: 60 });
        this.noise(t, 0.12, s.instrument * 0.5, 500, { type: 'lowpass' });
        this.tone(t + 0.3, 1047, 0.7, s.instrument * 0.45, { wet: true });
        return 1;
      case 'switchOn':
        this.tone(t, 880, 0.09, s.instrument * 0.6);
        this.tone(t + 0.08, 1320, 0.16, s.instrument * 0.6);
        return 0.25;
      case 'switchOff':
        this.tone(t, 1320, 0.09, s.instrument * 0.55);
        this.tone(t + 0.08, 880, 0.16, s.instrument * 0.55);
        return 0.25;
      case 'quakeRecord':
        // The seismometer's ping: a clear bell, or one muddied by the rover's own noise.
        this.tone(t, 1318, 2.2, s.instrument * 0.8, { wet: true });
        this.tone(t, 1318 * 2.76, 0.8, s.instrument * 0.2, { wet: true });
        if (o.noisy) this.noise(t, 1.2, s.instrument * 0.5, 1500, { q: 0.7 });
        return 2.3;
      // Warnings and hazards
      case 'lowEnergy':
        this.tone(t, 880, 0.3, s.warning, { attack: 0.03 });
        this.tone(t + 0.32, 659, 0.45, s.warning, { attack: 0.03 });
        return 0.8;
      case 'damage':
        this.tone(t, 392, 0.28, s.warning, { type: 'triangle', attack: 0.02 });
        this.tone(t + 0.3, 370, 0.4, s.warning, { type: 'triangle', attack: 0.02 });
        return 0.75;
      case 'cold':
        this.tone(t, 2637, 1.2, s.warning * 0.45, { attack: 0.1, endHz: 1975, wet: true });
        this.tone(t + 0.08, 3136, 1.0, s.warning * 0.3, { attack: 0.1, endHz: 2349, wet: true });
        this.noise(t, 1, s.warning * 0.3, 6000, { type: 'highpass', attack: 0.2 });
        return 1.25;
      case 'caution':
        this.tone(t, 587, 0.35, s.warning * 0.8, { attack: 0.03 });
        return 0.4;
      case 'impact': {
        const k = 0.5 + 0.5 * Math.min(1, Math.max(0, o.strength ?? 0.5));
        this.tone(t, 120, 0.35, s.impact * k, { endHz: 45 });
        this.noise(t, 0.18, s.impact * 0.6 * k, 700, { type: 'lowpass' });
        this.noise(t + 0.02, 0.1, s.impact * 0.25 * k, 2500, { q: 2 });
        return 0.4;
      }
      case 'bump':
        this.tone(t, 90, 0.18, s.impact * 0.3, { endHz: 50 });
        this.noise(t, 0.08, s.impact * 0.15, 500, { type: 'lowpass' });
        return 0.2;
      case 'quake':
        this.noise(t, 3, s.quake, 110, { type: 'lowpass', attack: 0.5, brown: true });
        this.tone(t, 38, 2.6, s.quake * 0.7, { attack: 0.6, endHz: 30 });
        return 3.1;
      case 'flareWarning':
        [0, 0.28, 0.56].forEach((d) => this.tone(t + d, 740, 0.2, s.flare * 0.8, { attack: 0.02, wet: true }));
        return 0.8;
      case 'flareHit':
        this.noise(t, 1.4, s.flare * 1.2, 3500, { q: 0.5, attack: 0.05, endHz: 900 });
        this.tone(t, 1600, 1.2, s.flare * 0.35, { type: 'sawtooth', endHz: 200, attack: 0.02 });
        return 1.5;
      case 'flareSafe':
        this.noise(t, 0.8, s.flare * 0.4, 2000, { q: 0.7, attack: 0.05 });
        this.tone(t + 0.2, 659, 0.5, s.flare * 0.6, { wet: true });
        this.tone(t + 0.35, 988, 0.7, s.flare * 0.5, { wet: true });
        return 1.1;
      case 'stormForecast':
        this.tone(t, 523, 0.5, s.weatherAlert, { attack: 0.05, wet: true });
        this.tone(t + 0.45, 466, 0.8, s.weatherAlert, { attack: 0.05, wet: true });
        return 1.3;
      case 'stormStart':
        this.noise(t, 2.5, s.weatherAlert * 1.5, 300, { q: 0.6, attack: 1, endHz: 1200, wet: true });
        this.tone(t, 349, 1.2, s.weatherAlert * 0.8, { attack: 0.08 });
        return 2.6;
      case 'stormClear':
        this.tone(t, 523, 0.5, s.weatherAlert, { attack: 0.05, wet: true });
        this.tone(t + 0.3, 784, 0.9, s.weatherAlert, { attack: 0.05, wet: true });
        return 1.25;
      case 'dusk':
        this.tone(t, 330, 1.6, s.weatherAlert * 0.7, { attack: 0.4, endHz: 262, wet: true });
        return 1.7;
      case 'dawn':
        this.tone(t, 392, 1.4, s.weatherAlert * 0.7, { attack: 0.4, endHz: 523, wet: true });
        return 1.5;
      case 'powerDown':
        this.tone(t, 600, 0.45, s.power, { type: 'triangle', endHz: 150 });
        return 0.5;
      case 'powerUp':
        this.tone(t, 150, 0.45, s.power, { type: 'triangle', endHz: 600 });
        return 0.5;
      case 'missionSurvived':
        [523, 659, 784, 1047].forEach((hz, i) => this.tone(t + i * 0.18, hz, 2.2, s.end, { pan: -0.3 + i * 0.2, wet: true }));
        return 2.8;
      case 'missionLost':
        this.tone(t, 220, 2.2, s.end, { type: 'triangle', attack: 0.1, wet: true });
        this.tone(t + 0.4, 207, 2.4, s.end * 0.8, { type: 'triangle', attack: 0.1, wet: true });
        return 2.9;
    }
  }
}
