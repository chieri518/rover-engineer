// Act 1 · Leaving Earth. Sound: steam hiss and sparks, the engines lighting, the roar (sub rumble, body, crackle)
// thinning to nothing as the air runs out, a soft thump at separation. Score (D minor, tension): a slow pulse that
// quickens, a rising drone, and a riser into the first big chord (D major add9) as the rocket clears the tower; then
// space: a high sine pad and far bells (the game's Moon palette).
import { MOODS } from '../../../src/audio/mix';
import { Layer, bell, boom, chord, hz, impulses, m, noiseBed, tone, type Score } from './synth';
import type { Times } from './times';

export function act1(s: Score, T: Times): void {
  const { b } = s;
  const fx = new Layer(s, 'effects', 1, 1);
  const music = new Layer(s, 'music', 1, 1);
  const ign = T.ignition;
  const top = T.clearTower;
  const sep = T.separation;
  const gone = Math.max(top + 1, sep - 0.15); // the air has run out: no more roar

  // --- Before ignition: steam hiss (gusting), sparks.
  const steam = noiseBed(s, fx.in, b.white, 0, ign + 1.6, [
    { type: 'highpass', hz: 2200, q: 0.5 },
    { type: 'lowpass', hz: 6500, q: 0.5 },
  ]);
  const sg = steam.gain.gain;
  sg.setValueAtTime(0, 0);
  sg.linearRampToValueAtTime(0.065, 0.6);
  for (let t = 0.6; t < ign; t += 0.25 + s.rng() * 0.45) sg.linearRampToValueAtTime(0.045 + s.rng() * 0.05, t);
  sg.linearRampToValueAtTime(0.09, ign); // a vent of steam as the engines light
  sg.linearRampToValueAtTime(0, ign + 1.5);
  const sparks = noiseBed(s, fx.in, impulses(s, ign + 2, 18, 0.6), 0, ign + 1, [
    { type: 'highpass', hz: 2500, q: 0.6 },
    { type: 'lowpass', hz: 7000, q: 0.5 },
  ], 0.5);
  sparks.gain.gain.setValueAtTime(0, 0);
  sparks.gain.gain.linearRampToValueAtTime(0.35, 0.8);
  sparks.gain.gain.setValueAtTime(0.35, ign);
  sparks.gain.gain.linearRampToValueAtTime(0, ign + 0.8);

  // --- The pulse: a low thump, slow at first, quickening into the hit at clearTower.
  {
    let t = 0.5;
    while (t < top - 0.25) {
      const k = Math.min(1, t / top);
      const loud = 0.22 + 0.14 * k;
      boom(s, music.in, t, 82, 46, loud, 0.45);
      tone(s, music.in, t, hz(m('D2')), loud * 0.25, { a: 0.01, decay: 0.35 }, { type: 'triangle', cutoff: 500 });
      t += t < ign ? 1.05 - 0.25 * (t / ign) : 0.78 - 0.45 * ((t - ign) / (top - ign));
    }
  }

  // --- Tension drone (the game's drone: three detuned saws through a lowpass), opening up towards clearTower.
  {
    const lp = new BiquadFilterNode(s.ac, { type: 'lowpass', frequency: 180, Q: 0.8 });
    const g = new GainNode(s.ac, { gain: 0 });
    lp.connect(g).connect(music.in);
    lp.frequency.setValueAtTime(180, 0);
    lp.frequency.exponentialRampToValueAtTime(380, ign);
    lp.frequency.exponentialRampToValueAtTime(1400, top);
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(0.06, 2);
    g.gain.linearRampToValueAtTime(0.1, top - 0.05);
    g.gain.linearRampToValueAtTime(0, top);
    const base = m('D2');
    for (const [semi, cents] of [[0, -4], [0, 5], [7, 2], [-12, 0]] as const) {
      const o = new OscillatorNode(s.ac, { type: 'sawtooth', frequency: hz(base + semi), detune: cents });
      o.connect(lp);
      o.start(0);
      o.stop(top + 0.05);
    }
  }
  // Minor pads over it: D minor from ignition, then Bb (the suspense of the flat sixth) until the hit.
  const mid = ign + (top - ign) * 0.5;
  const pad = MOODS.calm.pad;
  chord(s, music.in, ign, [m('D3'), m('F3'), m('A3'), m('D4')], 0.035, { a: 0.8, h: Math.max(0.05, mid - ign - 0.8), r: 0.3 }, { type: 'triangle', detune: [-pad.detuneCents, pad.detuneCents], cutoff: 1200 });
  chord(s, music.in, mid, [m('Bb2'), m('F3'), m('D4'), m('F4')], 0.04, { a: 0.3, h: Math.max(0.05, top - mid - 0.35), r: 0.05 }, { type: 'triangle', detune: [-pad.detuneCents, pad.detuneCents], cutoff: 1400, cutoffTo: 3000, sweep: top - mid });
  // Riser: two saws an octave apart, gliding up a fifth, filter opening, cut just before the hit.
  {
    const r0 = Math.max(ign, top - 2.4);
    const sh = { a: top - 0.06 - r0, h: 0, r: 0.04 };
    for (const n of [m('A2'), m('A3')]) tone(s, music.in, r0, hz(n), 0.05, sh, { type: 'sawtooth', detune: [-8, 8], glideTo: hz(n + 5), glide: top - r0, cutoff: 300, cutoffTo: 4000, sweep: top - r0 });
  }

  // --- Ignition: a whoomph, then the roar.
  boom(s, fx.in, ign, 60, 30, 0.4, 1.6, 0.4);
  const whoomph = noiseBed(s, fx.in, b.brown, ign - 0.05, ign + 1.5, [{ type: 'lowpass', hz: 150, q: 0.7 }]);
  whoomph.filters[0]!.frequency.setValueAtTime(150, ign);
  whoomph.filters[0]!.frequency.exponentialRampToValueAtTime(1500, ign + 0.35);
  whoomph.filters[0]!.frequency.exponentialRampToValueAtTime(300, ign + 1.4);
  whoomph.gain.gain.setValueAtTime(0, ign - 0.05);
  whoomph.gain.gain.linearRampToValueAtTime(0.9, ign + 0.12);
  whoomph.gain.gain.exponentialRampToValueAtTime(0.01, ign + 1.4);
  whoomph.gain.gain.linearRampToValueAtTime(0, ign + 1.45);

  const full = Math.min(ign + 1.4, top - 0.1);
  // Sub rumble: deep brown noise and a wobbling sine.
  const sub = noiseBed(s, fx.in, b.brown, ign, gone + 0.1, [{ type: 'lowpass', hz: 110, q: 0.7 }]);
  ramp(sub.gain.gain, [[ign, 0], [full, 1.4], [top, 1.6], [top + 0.6, 1.4], [gone, 0]]);
  sub.filters[0]!.frequency.setValueAtTime(110, top + 0.6);
  sub.filters[0]!.frequency.exponentialRampToValueAtTime(50, gone);
  {
    const o = new OscillatorNode(s.ac, { frequency: 38 });
    const wob = new OscillatorNode(s.ac, { frequency: 3.3 });
    const wobD = new GainNode(s.ac, { gain: 4 });
    wob.connect(wobD).connect(o.frequency);
    const g = new GainNode(s.ac, { gain: 0 });
    ramp(g.gain, [[ign, 0], [full, 0.12], [top + 0.6, 0.12], [gone, 0]]);
    o.connect(g).connect(fx.in);
    for (const x of [o, wob]) {
      x.start(ign);
      x.stop(gone + 0.1);
    }
  }
  // Body: the roar itself, a lowpassed noise that opens up at full thrust and closes as the air thins.
  const body = noiseBed(s, fx.in, b.white, ign, gone + 0.1, [
    { type: 'lowpass', hz: 300, q: 0.6 },
    { type: 'lowpass', hz: 300, q: 0.5 },
  ]);
  for (const f of body.filters) {
    f.frequency.setValueAtTime(300, ign);
    f.frequency.exponentialRampToValueAtTime(1300, full);
    f.frequency.setValueAtTime(1300, top + 0.4);
    f.frequency.exponentialRampToValueAtTime(90, gone);
  }
  ramp(body.gain.gain, [[ign, 0], [full, 0.32], [top - 0.02, 0.34], [top + 0.06, 0.16], [top + 0.7, 0.26], [gone, 0]]);
  // Flutter on the body (the plume's turbulence).
  {
    const lfo = new OscillatorNode(s.ac, { frequency: 7.3 });
    const d = new GainNode(s.ac, { gain: 0.05 });
    lfo.connect(d).connect(body.gain.gain);
    lfo.start(ign);
    lfo.stop(gone);
  }
  // Crackle: sparse impulses, band-passed: the highs go first as the air runs out.
  const crackle = noiseBed(s, fx.in, impulses(s, gone - ign + 1, 160, 0.35), ign + 0.3, gone, [
    { type: 'highpass', hz: 700, q: 0.6 },
    { type: 'lowpass', hz: 5000, q: 0.5 },
  ]);
  ramp(crackle.gain.gain, [[ign + 0.3, 0], [full + 0.4, 1.1], [top - 0.02, 1.2], [top + 0.06, 0.6], [top + 0.5, 0.8], [top + 0.5 + (gone - top) * 0.5, 0]]);

  // --- clearTower: the first big chord. D major add9: brassy saws blooming open, a triangle bed, a sub boom, bells.
  {
    const notes = [m('D2'), m('A2'), m('D3'), m('F#3'), m('A3'), m('E4'), m('F#4')];
    const hold = Math.max(1.5, sep + 0.3 - top);
    chord(s, music.in, top, notes, 0.08, { a: 0.04, h: hold, r: 2.6 }, { type: 'sawtooth', detune: [-9, 9], cutoff: 3500, cutoffTo: 900, sweep: 2.5, q: 0.8 });
    chord(s, music.in, top, notes, 0.06, { a: 0.04, h: hold, r: 3 }, { type: 'triangle', detune: [-pad.detuneCents, pad.detuneCents], cutoff: 2000 });
    boom(s, music.in, top, 70, 34, 0.38, 2.4, 0.15);
    const bl = MOODS.moon.bell!;
    bell(s, music.in, top, hz(m('D6')), 0.06, 3, bl.partial, -0.4);
    bell(s, music.in, top + 0.02, hz(m('A6')), 0.04, 3, bl.partial, 0.4);
  }

  // --- Separation: a soft thump, then space.
  boom(s, fx.in, sep, 75, 38, 0.32, 0.6, 0.25);
  const puff = noiseBed(s, fx.in, b.brown, sep, sep + 0.4, [{ type: 'lowpass', hz: 240, q: 0.7 }]);
  ramp(puff.gain.gain, [[sep, 0], [sep + 0.01, 0.5], [sep + 0.3, 0]]);

  // Space: the game's Moon pad (thin detuned sines) on D sus2, far bells. Fades before touchdown.
  {
    const mp = MOODS.moon.pad;
    const end = T.moon - 0.12;
    const sh = { a: 1.1, h: Math.max(0.1, end - sep - 1.1 - 0.3), r: 0.3 };
    chord(s, music.in, sep, [m('D4'), m('A4'), m('E5'), m('A5')], 0.05, sh, { type: 'sine', detune: [-mp.detuneCents, mp.detuneCents] });
    const bl = MOODS.moon.bell!;
    bell(s, music.in, sep + 0.5, hz(m('A5')), 0.05, 2.5, bl.partial, 0.5);
    if (sep + 1.4 < end) bell(s, music.in, sep + 1.4, hz(m('E6')), 0.04, 2.2, bl.partial, -0.5);
  }
}

/** Linear ramps through (time, value) points, starting from the first. */
export function ramp(p: AudioParam, pts: Array<[number, number]>): void {
  const [t0, v0] = pts[0]!;
  p.setValueAtTime(v0, t0);
  for (const [t, v] of pts.slice(1)) p.linearRampToValueAtTime(v, t);
}
