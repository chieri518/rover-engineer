// The hero's theme (D major, 96 BPM) from the first wheel touch to black, and the extremes under it.
//   wheelTouch  D        the theme lands: boom, pad, driving bass, kick, arpeggio, the melody's call
//   crater      -        everything drops to one tone in the dark (still the Moon: no diegetic sound)
//   floodlights Bm       a hit as the lights snap on; the groove comes back
//   mars        G -> A   muffled wind (thin air) and the rover's low hum under the music
//   titan       Bb -> C  loud methane rain (thick air), the deepest bass note (Bb0)
//   lightsOut   D        the last chord, held until black, where everything cuts to silence
// Each section starts its own beat grid on its cut, so every chord change lands on a cut or a hit.
import { MOODS, MOTOR, WEATHER } from '../../../src/audio/mix';
import { Layer, bell, boom, chord, hz, impulses, m, noiseBed, tone, type Score } from './synth';
import type { Times } from './times';
import { ramp } from './act1';

const BEAT = 60 / 96;

type Melody = Array<[beat: number, note: string, beats: number]>;

interface Section {
  t0: number;
  t1: number;
  /** Chord tones, low to high (the lowest is the bass's root). */
  chord: string[];
  melody: Melody;
  /** Extra low note under the bass (Titan's deepest note). */
  deep?: string;
}

export function act3(s: Score, T: Times): void {
  // The theme in two layers, gated together: the hall-wet upper parts, and the low end (bass, kick, booms) kept
  // nearly dry so the hall does not muddy it or rumble on after the cuts.
  const theme = new Layer(s, 'music', 2, 1);
  const low = new Layer(s, 'music', 2, 0.15);
  const out: Dest = { wet: theme.in, low: low.in };
  const pad = MOODS.calm.pad;
  const moonBell = MOODS.moon.bell!;

  const sections: Section[] = [];
  // Split a span on the beat grid nearest its middle (at least one beat each side when possible).
  const split = (t0: number, t1: number) => Math.min(t1, t0 + Math.max(1, Math.round((t1 - t0) / BEAT / 2)) * BEAT);
  sections.push({
    t0: T.wheelTouch,
    t1: T.crater,
    chord: ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4'],
    melody: [[0, 'A4', 0.5], [0.5, 'D5', 1], [1.5, 'E5', 0.5], [2, 'F#5', 2], [4, 'E5', 1], [5, 'D5', 1], [6, 'A4', 2]],
  });
  sections.push({
    t0: T.floodlights,
    t1: T.mars,
    chord: ['B1', 'F#2', 'B2', 'D3', 'F#3', 'B3'],
    melody: [[0, 'F#5', 1.5], [1.5, 'E5', 0.5], [2, 'D5', 1], [3, 'B4', 1], [4, 'D5', 2]],
  });
  const marsMid = split(T.mars, T.titan);
  sections.push({ t0: T.mars, t1: marsMid, chord: ['G1', 'D2', 'G2', 'B2', 'D3', 'G3'], melody: [[0, 'B4', 0.5], [0.5, 'D5', 0.5], [1, 'G5', 1.5], [2.5, 'F#5', 0.5], [3, 'E5', 1]] });
  sections.push({ t0: marsMid, t1: T.titan, chord: ['A1', 'E2', 'A2', 'C#3', 'E3', 'A3'], melody: [[0, 'C#5', 0.5], [0.5, 'E5', 0.5], [1, 'A5', 1.5], [2.5, 'G5', 0.5], [3, 'E5', 1]] });
  const titanMid = split(T.titan, T.lightsOut);
  sections.push({ t0: T.titan, t1: titanMid, chord: ['Bb1', 'F2', 'Bb2', 'D3', 'F3', 'Bb3'], deep: 'Bb0', melody: [[0, 'D5', 1], [1, 'F5', 1], [2, 'Bb5', 2]] });
  sections.push({ t0: titanMid, t1: T.lightsOut, chord: ['C2', 'G2', 'C3', 'E3', 'G3', 'C4'], deep: 'C1', melody: [[0, 'E5', 1], [1, 'G5', 1], [2, 'C6', 2]] });

  for (const [i, sec] of sections.entries()) {
    if (sec.t1 - sec.t0 < 0.1) continue;
    groove(s, out, sec, i === 0 || i === 1);
  }

  // The downbeat at the wheel: a boom and a bell on top.
  boom(s, low.in, T.wheelTouch, 70, 34, 0.32, 2.2, 0.12);
  bell(s, theme.in, T.wheelTouch, hz(m('A5')), 0.05, 2.5, moonBell.partial, 0.3);

  // The crater: the theme drops out on the cut; one lonely tone (a slowly beating A4) in the dark.
  theme.to(T.crater, 0, 0.03);
  low.to(T.crater, 0, 0.03);
  {
    const lone = new Layer(s, 'music', 1, 1);
    const sh = { a: 0.25, h: Math.max(0.05, T.floodlights - T.crater - 0.3), r: 0.05 };
    tone(s, lone.in, T.crater, hz(m('A4')), 0.05, sh, { pan: -0.15 });
    tone(s, lone.in, T.crater, hz(m('A4')) + 0.7, 0.05, sh, { pan: 0.15 });
  }

  // Floodlights: the hit. A brassy B minor stab whose filter snaps shut, a deep boom, bells; the theme comes back.
  theme.to(T.floodlights - 0.004, 2, 0.004);
  low.to(T.floodlights - 0.004, 2, 0.004);
  {
    const t = T.floodlights;
    chord(s, theme.in, t, [m('B1'), m('F#2'), m('B2'), m('D3'), m('F#3')], 0.07, { a: 0.006, decay: 1.6 }, { type: 'sawtooth', detune: [-10, 10], cutoff: 4000, cutoffTo: 400, sweep: 0.7, q: 1 });
    boom(s, low.in, t, 65, 30, 0.38, 2.4, 0.15);
    bell(s, theme.in, t, hz(m('B5')), 0.05, 2.5, moonBell.partial, -0.3);
    bell(s, theme.in, t + 0.01, hz(m('F#6')), 0.035, 2.5, moonBell.partial, 0.3);
  }
  // Hits on the other cuts.
  boom(s, low.in, T.mars, 65, 34, 0.26, 1.4, 0.12);
  boom(s, low.in, T.titan, 55, 26, 0.36, 2.4, 0.2);

  // lightsOut: the last chord, D major, everything at once, held until black (the master cuts it there).
  {
    const t = T.lightsOut;
    const hold = Math.max(0.1, T.black - t);
    const notes = [m('D2'), m('A2'), m('D3'), m('F#3'), m('A3'), m('D4'), m('F#4'), m('A4')];
    const sh = { a: 0.03, h: hold, r: 0.05 };
    chord(s, theme.in, t, notes, 0.05, sh, { type: 'sawtooth', detune: [-9, 9], cutoff: 3200, cutoffTo: 1600, sweep: hold, q: 0.7 });
    chord(s, theme.in, t, notes, 0.04, sh, { type: 'triangle', detune: [-pad.detuneCents, pad.detuneCents], cutoff: 2400 });
    tone(s, low.in, t, hz(m('D1')), 0.08, sh, { type: 'sine' });
    lead(s, theme.in, t, m('D6'), 0.045, hold + 0.05);
    lead(s, theme.in, t, m('D5'), 0.03, hold + 0.05);
    boom(s, low.in, t, 70, 32, 0.38, 2.5, 0.15);
    bell(s, theme.in, t, hz(m('D6')), 0.05, 3, moonBell.partial, -0.35);
    bell(s, theme.in, t + 0.015, hz(m('A6')), 0.04, 3, moonBell.partial, 0.35);
  }

  mars(s, T);
  titan(s, T);
}

/** One section of the theme: pad, bass in eighths, a kick on the beat, a sixteenth arpeggio, the melody. */
interface Dest {
  wet: AudioNode;
  low: AudioNode;
}

function groove(s: Score, d: Dest, sec: Section, light: boolean): void {
  const { t0, t1 } = sec;
  const dest = d.wet;
  const len = t1 - t0;
  const notes = sec.chord.map(m);
  const pad = MOODS.calm.pad;
  const sh = { a: 0.06, h: Math.max(0.01, len - 0.06 - 0.08), r: 0.08 };
  chord(s, dest, t0, notes.slice(1), 0.03, sh, { type: 'sawtooth', detune: [-9, 9], cutoff: 1700, q: 0.6 });
  chord(s, dest, t0, notes.slice(1), 0.03, sh, { type: 'triangle', detune: [-pad.detuneCents, pad.detuneCents], cutoff: 2000 });
  if (sec.deep) {
    // The deepest note: a sine and the game's Titan drone (a dark lowpassed saw) an octave up.
    tone(s, d.low, t0, hz(m(sec.deep)), 0.16, sh, { type: 'sine' });
    tone(s, d.low, t0, hz(m(sec.deep) + 12), 0.08, sh, { type: 'sawtooth', detune: [-4, 5], cutoff: MOODS.titan.drone!.cutoffHz });
  }
  const root = notes[0]!;
  // Bass: eighths, root with an octave jump, accent on the beat.
  const pattern = [0, 0, 12, 0, 0, 12, 0, 7];
  for (let k = 0; t0 + k * BEAT * 0.5 < t1 - 0.06; k++) {
    const t = t0 + k * BEAT * 0.5;
    const on = k % 2 === 0;
    tone(s, d.low, t, hz(root + pattern[k % pattern.length]!), on ? 0.11 : 0.08, { a: 0.004, decay: Math.min(0.28, t1 - t - 0.03) }, {
      type: 'sawtooth',
      cutoff: 900,
      cutoffTo: 220,
      sweep: 0.2,
      q: 2,
    });
  }
  // Kick on every beat (the first beat of the section is the hit, played elsewhere).
  for (let k = 1; t0 + k * BEAT < t1 - 0.06; k++) boom(s, d.low, t0 + k * BEAT, 95, 45, light ? 0.22 : 0.3, 0.3);
  // Arpeggio: sixteenths up the chord's upper tones, two octaves up, soft plucks.
  const arp = notes.slice(2).map((n) => n + 24);
  for (let k = 0; t0 + k * BEAT * 0.25 < t1 - 0.04; k++) {
    const t = t0 + k * BEAT * 0.25;
    tone(s, dest, t, hz(arp[k % arp.length]!), k % 4 === 0 ? 0.03 : 0.02, { a: 0.003, decay: Math.min(0.2, t1 - t - 0.02) }, {
      type: 'triangle',
      cutoff: 3500,
      pan: k % 2 ? 0.35 : -0.35,
    });
  }
  // Melody: the lead, cut at the section's end.
  for (const [beat, note, beats] of sec.melody) {
    const t = t0 + beat * BEAT;
    if (t > t1 - 0.08) break;
    lead(s, dest, t, m(note), 0.06, Math.min(beats * BEAT, t1 - t) - 0.02);
  }
}

/** The lead voice: a triangle with a sine an octave up, a little vibrato, into the hall. */
function lead(s: Score, dest: AudioNode, t: number, note: number, gain: number, dur: number): void {
  const r = Math.min(0.12, dur * 0.3);
  const sh = { a: 0.025, h: Math.max(0.01, dur - 0.025 - r), r };
  tone(s, dest, t, hz(note), gain, sh, { type: 'triangle', cutoff: 2800, vibrato: 10 });
  tone(s, dest, t, hz(note + 12), gain * 0.25, sh, { type: 'sine', vibrato: 10 });
}

/** The rover's motor hum (the game's RoverHum: a filtered saw with a faint whine at 3x), fixed at a cruise. */
function roverHum(s: Score, dest: AudioNode, t0: number, t1: number, cutoff: number, gain: number): void {
  const f = MOTOR.idleHz + (MOTOR.topHz - MOTOR.idleHz) * 0.45;
  const lp = new BiquadFilterNode(s.ac, { type: 'lowpass', frequency: cutoff, Q: 1.5 });
  const g = new GainNode(s.ac, { gain: 0 });
  ramp(g.gain, [[t0, 0], [t0 + 0.015, gain], [t1 - 0.015, gain], [t1, 0]]);
  lp.connect(g).connect(dest);
  const o = new OscillatorNode(s.ac, { type: 'sawtooth', frequency: f });
  const w = new OscillatorNode(s.ac, { type: 'sine', frequency: f * 3 });
  const wg = new GainNode(s.ac, { gain: MOTOR.whineGain });
  // A slow wobble as the wheels roll over the ground.
  const lfo = new OscillatorNode(s.ac, { frequency: 1.3 });
  const lg = new GainNode(s.ac, { gain: 2.5 });
  lfo.connect(lg);
  lg.connect(o.frequency);
  o.connect(lp);
  w.connect(wg).connect(lp);
  for (const x of [o, w, lfo]) {
    x.start(t0);
    x.stop(t1 + 0.05);
  }
}

/** Mars: storm wind through thin air (muffled, gusting, growing as the storm rolls in) and the rover's hum. */
function mars(s: Score, T: Times): void {
  const fx = new Layer(s, 'effects', 1.25, 1);
  const { mars: t0, titan: t1 } = T;
  const air = MOODS.mars.air!;
  const wind = noiseBed(s, fx.in, s.b.white, t0, t1, [
    { type: 'bandpass', hz: air.hz, q: air.q },
    { type: 'lowpass', hz: 650, q: 0.5 },
  ]);
  const bp = wind.filters[0]!.frequency;
  ramp(bp, [[t0, 380], [t0 + (t1 - t0) * 0.4, 620], [t0 + (t1 - t0) * 0.7, 420], [t1, 560]]);
  const w = WEATHER.windMax * 6;
  ramp(wind.gain.gain, [[t0, 0], [t0 + 0.02, w * 0.45], [t0 + (t1 - t0) * 0.35, w * 0.7], [t0 + (t1 - t0) * 0.55, w * 0.55], [t1 - 0.03, w], [t1, 0]]);
  roverHum(s, fx.in, t0, t1, MOTOR.thinAirCutoffHz[1] - 60, 0.11);
}

/** Titan: loud methane rain through thick air (hiss, patter, drops, a low rumble) and a fuller rover hum. */
function titan(s: Score, T: Times): void {
  const fx = new Layer(s, 'effects', 0.7, 1.5);
  const { titan: t0, black: t1 } = T;
  const r = WEATHER.rainMax;
  const hiss = noiseBed(s, fx.in, s.b.white, t0, t1, [
    { type: 'highpass', hz: 2200, q: 0.5 },
    { type: 'lowpass', hz: 6500, q: 0.5 },
  ]);
  ramp(hiss.gain.gain, [[t0, 0], [t0 + 0.03, r * 3.2], [t1, r * 3.6]]);
  const patter = noiseBed(s, fx.in, s.b.brown, t0, t1, [{ type: 'bandpass', hz: 900, q: 0.8 }]);
  ramp(patter.gain.gain, [[t0, 0], [t0 + 0.03, r * 5], [t1, r * 5]]);
  const drops = noiseBed(s, fx.in, impulses(s, t1 - t0 + 1, 90, 0.5), t0, t1, [
    { type: 'bandpass', hz: 2600, q: 0.6 },
    { type: 'lowpass', hz: 6000, q: 0.5 },
  ], 0.7);
  ramp(drops.gain.gain, [[t0, 0], [t0 + 0.03, 1.4], [t1, 1.4]]);
  const rumble = noiseBed(s, fx.in, s.b.brown, t0, t1, [{ type: 'lowpass', hz: 140, q: 0.7 }]);
  ramp(rumble.gain.gain, [[t0, 0], [t0 + 0.03, 0.5], [t1, 0.5]]);
  roverHum(s, fx.in, t0, t1, MOTOR.cutoffHz[1] * 0.6, 0.09);
}
