// Ambient music, synthesized live: per mood a drone with a slowly moving filter, pad chords that swell
// and fade, sparse bell tones picked at random from the mood's scale, and (Mars, Titan) filtered noise.
// Nothing loops: chords and bells are chosen as it plays, so it never repeats and has no seam.
import type { Buses } from './graph';
import { MOODS, MUSIC_FADE_SECONDS, SCHEDULER, type MoodDef, type MoodId } from './mix';
import { between, midiToHz, pickChord, pickDegree } from './tune';

/** One mood playing: its own output gain, so moods crossfade. */
export class MoodVoice {
  private readonly out: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private nextChord: number;
  private nextBell: number;
  private lastChord: number | null = null;
  private lastBell: number | null = null;
  private stopped = false;

  constructor(
    private readonly b: Buses,
    readonly id: MoodId,
    private readonly def: MoodDef = MOODS[id],
    start = b.ac.currentTime,
    fadeIn = MUSIC_FADE_SECONDS,
    private readonly rng: () => number = Math.random,
  ) {
    const ac = b.ac;
    this.out = ac.createGain();
    this.out.gain.setValueAtTime(0, start);
    this.out.gain.linearRampToValueAtTime(def.gain, start + Math.max(0.01, fadeIn));
    this.out.connect(b.music);
    this.out.connect(b.musicReverb);
    this.drone(start);
    this.air(start);
    this.nextChord = start + 0.2;
    this.nextBell = start + between(def.bell?.every ?? [4, 8], rng);
  }

  private lfo(hz: number, depth: number, target: AudioParam, start: number): void {
    const ac = this.b.ac;
    const o = ac.createOscillator();
    o.frequency.value = hz;
    const g = ac.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start(start + this.rng() * 2);
    this.sources.push(o);
  }

  private drone(start: number): void {
    const d = this.def.drone;
    if (!d) return;
    const ac = this.b.ac;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = d.cutoffHz;
    filter.Q.value = 0.7;
    this.lfo(d.lfoHz, d.lfoDepthHz, filter.frequency, start);
    const g = ac.createGain();
    g.gain.value = d.gain;
    filter.connect(g).connect(this.out);
    const base = this.def.root + 12 * d.octave;
    for (const [semi, cents] of [[0, -4], [0, 5], [7, 2]] as const) {
      const o = ac.createOscillator();
      o.type = d.type;
      o.frequency.value = midiToHz(base + semi);
      o.detune.value = cents;
      o.connect(filter);
      o.start(start);
      this.sources.push(o);
    }
  }

  private air(start: number): void {
    const a = this.def.air;
    if (!a) return;
    const ac = this.b.ac;
    const src = ac.createBufferSource();
    src.buffer = this.b.white;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = a.type;
    filter.frequency.value = a.hz;
    filter.Q.value = a.q;
    this.lfo(a.lfoHz, a.lfoDepthHz, filter.frequency, start);
    const g = ac.createGain();
    g.gain.value = a.gain;
    // A second, slower swell on the level, like gusts.
    this.lfo(a.lfoHz * 0.43, a.gain * 0.5, g.gain, start);
    src.connect(filter).connect(g).connect(this.out);
    src.start(start, this.rng() * 1.5);
    this.sources.push(src);
  }

  private chord(t: number): void {
    const p = this.def.pad;
    const ac = this.b.ac;
    const degrees = pickChord(this.def.scale, p.notes, this.rng, this.lastChord);
    this.lastChord = degrees[0] ?? null;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.cutoffHz;
    filter.Q.value = 0.5;
    const env = ac.createGain();
    const end = t + p.attack + p.hold;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + p.attack);
    env.gain.setValueAtTime(1, end);
    env.gain.setTargetAtTime(0, end, p.release / 4);
    filter.connect(env).connect(this.out);
    const stopAt = end + p.release * 1.6;
    for (const d of degrees) {
      const hz = midiToHz(this.def.root + 12 * p.octave + this.def.scale[d]!);
      const pan = ac.createStereoPanner();
      pan.pan.value = (this.rng() * 2 - 1) * 0.6;
      const g = ac.createGain();
      g.gain.value = p.gain;
      g.connect(pan).connect(filter);
      for (const cents of [-p.detuneCents, p.detuneCents]) {
        const o = ac.createOscillator();
        o.type = p.type;
        o.frequency.value = hz;
        o.detune.value = cents;
        o.connect(g);
        o.start(t);
        o.stop(stopAt);
      }
    }
  }

  private bell(t: number): void {
    const bl = this.def.bell;
    if (!bl) return;
    const ac = this.b.ac;
    const i = pickDegree(this.def.scale, this.rng, this.lastBell);
    this.lastBell = i;
    const hz = midiToHz(this.def.root + 12 * bl.octave + this.def.scale[i]!);
    const pan = ac.createStereoPanner();
    pan.pan.value = (this.rng() * 2 - 1) * 0.8;
    pan.connect(this.out);
    for (const [mult, share, decay] of [[1, 1, bl.decay], [bl.partial, 0.25, bl.decay * 0.4]] as const) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz * mult;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(bl.gain * share, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  }

  /** Schedule chords and bells up to `until` (audio time). */
  tick(until: number): void {
    if (this.stopped) return;
    const p = this.def.pad;
    while (this.nextChord < until) {
      this.chord(this.nextChord);
      this.nextChord += between(p.every, this.rng);
    }
    const bl = this.def.bell;
    while (bl && this.nextBell < until) {
      this.bell(this.nextBell);
      this.nextBell += between(bl.every, this.rng);
    }
  }

  /** Fade out and stop. */
  stop(fade = MUSIC_FADE_SECONDS, at = this.b.ac.currentTime): void {
    if (this.stopped) return;
    this.stopped = true;
    const g = this.out.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(0, at + fade);
    for (const s of this.sources) s.stop(at + fade + 0.1);
    // Chords and bells already scheduled end by themselves; the output is cut once they would be silent.
    const out = this.out;
    if (typeof window !== 'undefined') window.setTimeout(() => out.disconnect(), (fade + 12) * 1000);
  }
}

/** The music: one mood at a time, crossfading on a change, scheduled a little ahead by a timer. */
export class MusicPlayer {
  private current: MoodVoice | null = null;
  private timer: number | null = null;

  constructor(private readonly b: Buses) {}

  get mood(): MoodId | null {
    return this.current?.id ?? null;
  }

  setMood(id: MoodId): void {
    if (this.current?.id === id) return;
    this.current?.stop();
    this.current = new MoodVoice(this.b, id);
    this.current.tick(this.b.ac.currentTime + SCHEDULER.lookaheadSeconds);
    if (this.timer === null) {
      this.timer = window.setInterval(() => this.current?.tick(this.b.ac.currentTime + SCHEDULER.lookaheadSeconds), SCHEDULER.intervalMs);
    }
  }
}
