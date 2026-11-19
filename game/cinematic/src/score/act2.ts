// Act 2 · Arrival on the Moon. The Moon has no air, so there is no diegetic sound at all here (no noise of any kind):
// only the score. A held low D on touchdown; a slow rising tone as the doors open; a soft chime per status light;
// a warm pad as the panel unfolds; a gentle filter sweep for the mast; a G chord blooming as the eye lights (the
// emotional beat); then a build on A that swells straight into the theme as the first wheel touches the regolith.
import { MOODS } from '../../../src/audio/mix';
import { Layer, bell, boom, chord, envelope, hz, m, tone, type Score } from './synth';
import type { Times } from './times';

export function act2(s: Score, T: Times): void {
  const music = new Layer(s, 'music', 1.35, 1);
  const wheel = T.wheelTouch;
  const pad = MOODS.calm.pad;
  const moonBell = MOODS.moon.bell!;

  // Touchdown: a held low D (triangle and sine, dark), until the theme's bass takes over at the wheel.
  {
    const sh = { a: 1.2, h: Math.max(0.1, wheel - T.moon - 1.2), r: 0.25 };
    tone(s, music.in, T.moon, hz(m('D2')), 0.07, sh, { type: 'triangle', cutoff: 320 });
    tone(s, music.in, T.moon, hz(m('D3')), 0.02, sh, { type: 'sine' });
  }

  // The doors: a slow rising tone from hatchStart to rampDown (D4 up to A4), held a moment, then let go.
  {
    const span = Math.max(0.3, T.rampDown - T.hatchStart);
    const sh = { a: span, h: 0.5, r: 1.8 };
    tone(s, music.in, T.hatchStart, hz(m('D4')), 0.05, sh, { glideTo: hz(m('A4')), glide: span, vibrato: 4 });
    tone(s, music.in, T.hatchStart, hz(m('D3')), 0.03, sh, { type: 'triangle', glideTo: hz(m('A3')), glide: span, cutoff: 900 });
  }

  // Status lights: one glassy chime each (the game's Moon bell), climbing the D major pentatonic.
  const chimes = ['A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];
  T.leds.forEach((t, i) => {
    const note = chimes[Math.min(i, chimes.length - 1)]!;
    bell(s, music.in, t, hz(m(note)), 0.11, 2.2, moonBell.partial, -0.35 + 0.7 * (i / Math.max(1, T.leds.length - 1)));
  });

  // The panel unfolds: a warm D add9 pad fades in (the game's calm pad), until the eye lights.
  chord(s, music.in, T.panelStart, [m('D3'), m('A3'), m('E4'), m('F#4')], 0.03, { a: 1.2, h: Math.max(0.1, T.eyeOn - T.panelStart - 1.2), r: 0.6 }, {
    type: 'triangle',
    detune: [-pad.detuneCents, pad.detuneCents],
    cutoff: pad.cutoffHz,
  });

  // The mast rises: a gentle sweep, two detuned saws whose filter opens and closes.
  {
    const t = T.mastStart;
    const dur = 1.6;
    const lp = new BiquadFilterNode(s.ac, { type: 'lowpass', frequency: 250, Q: 3 });
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.55);
    lp.frequency.exponentialRampToValueAtTime(300, t + dur);
    const g = new GainNode(s.ac, { gain: 0 });
    const pan = new StereoPannerNode(s.ac, { pan: 0 });
    pan.pan.setValueAtTime(-0.4, t);
    pan.pan.linearRampToValueAtTime(0.4, t + dur);
    lp.connect(g).connect(pan).connect(music.in);
    const end = envelope(g.gain, t, 0.035, { a: dur * 0.5, h: 0, r: dur * 0.5 });
    for (const [n, c] of [[m('A3'), -7], [m('E4'), 7], [m('A4'), 0]] as const) {
      const o = new OscillatorNode(s.ac, { type: 'sawtooth', frequency: hz(n), detune: c });
      o.connect(lp);
      o.start(t);
      o.stop(end + 0.05);
    }
  }

  // The eye lights: the emotional beat. A G add9 chord blooms (triangle and sine), and a high bell.
  const build = Math.max(T.eyeOn + 0.7, wheel - 1.9);
  {
    const sh = { a: 0.45, h: Math.max(0.1, build - T.eyeOn - 0.2), r: 0.9 };
    const notes = [m('G2'), m('D3'), m('A3'), m('B3'), m('D4'), m('G4')];
    chord(s, music.in, T.eyeOn, notes, 0.035, sh, { type: 'triangle', detune: [-pad.detuneCents, pad.detuneCents], cutoff: 1800 });
    chord(s, music.in, T.eyeOn, notes.slice(2), 0.02, sh, { type: 'sine', detune: [-4, 4] });
    bell(s, music.in, T.eyeOn + 0.05, hz(m('B5')), 0.05, 3, moonBell.partial, 0.3);
  }
  // The head turns to the door: a soft sine gliding up a fourth, panned with the turn.
  tone(s, music.in, T.eyeTurn, hz(m('D5')), 0.025, { a: 0.25, h: 0.4, r: 0.8 }, { type: 'sine', glideTo: hz(m('G5')), glide: 0.6, pan: 0.35 });

  // The build: A sus4 in saws opening up, a rising tone, and quickening low hits. No gap before the wheel: the
  // build peaks on the touch and lets go under the theme's first bar, so the theme rises out of it.
  {
    const stop = wheel;
    const span = Math.max(0.05, stop - build);
    const sh = { a: span, h: 0, r: 0.5 };
    chord(s, music.in, build, [m('A2'), m('E3'), m('A3'), m('D4'), m('E4')], 0.07, sh, { type: 'sawtooth', detune: [-9, 9], cutoff: 300, cutoffTo: 2400, sweep: span });
    tone(s, music.in, build, hz(m('A4')), 0.03, sh, { type: 'triangle', glideTo: hz(m('A5')), glide: span, cutoff: 3000 });
    for (const before of [1.2, 0.75, 0.45, 0.25]) {
      const t = wheel - before;
      if (t > build) boom(s, music.in, t, 95, 50, 0.2 + 0.1 * (1 - before), 0.3);
    }
  }
}
