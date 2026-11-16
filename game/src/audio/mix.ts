// The sound mix: every level and synth constant in one place. These are presentation, not game rules
// (like the look constants in ui/buildPreview.ts), so they live in code. Gains are linear (1 = 0 dBFS
// for a full-scale wave); the master chain ends in a compressor and a limiter well below clipping.
// "Not too loud": the music sits far behind the effects, and nothing is meant to startle.

/** Master bus and its protection. */
export const MASTER = {
  gain: 0.7, // before the compressor
  compressor: { threshold: -20, knee: 12, ratio: 3, attack: 0.02, release: 0.4 },
  limiter: { threshold: -6, knee: 0, ratio: 20, attack: 0.002, release: 0.15 }, // keeps peaks near -6 dBFS
  fadeSeconds: 0.25, // mute, unmute, tab hidden
};

/** The bus gains at a slider's 100%; a slider maps to its bus by volumeGain (a squared curve). */
export const BUS = {
  musicMax: 0.55,
  effectsMax: 0.9,
};

/** A long hall made from a generated impulse response (decaying stereo noise). */
export const REVERB = {
  seconds: 5.5,
  decay: 2.6, // the envelope's power: higher dies away sooner
  musicSend: 0.55,
  effectsSend: 0.12,
  return: 0.6,
};

/** Crossfade between music moods on a screen change. */
export const MUSIC_FADE_SECONDS = 4;
/** The music scheduler wakes this often and schedules this far ahead (seconds). */
export const SCHEDULER = { intervalMs: 400, lookaheadSeconds: 1.2 };

/** One mood of the ambient music: a drone, slow pad chords and sparse bell tones from a scale. */
export interface MoodDef {
  root: number; // MIDI note of the scale's root
  scale: number[]; // semitones above the root (spread over octaves for the bells)
  gain: number; // the mood's output level
  drone: { gain: number; cutoffHz: number; lfoHz: number; lfoDepthHz: number; type: OscillatorType; octave: number } | null;
  pad: {
    gain: number; // per voice
    type: OscillatorType;
    octave: number; // octave offset from the root for the chord tones
    notes: number; // chord tones per chord
    detuneCents: number;
    cutoffHz: number;
    attack: number;
    hold: number;
    release: number;
    every: [number, number]; // seconds between chords (random in range)
  };
  bell: { gain: number; octave: number; decay: number; every: [number, number]; partial: number } | null;
  air: { gain: number; type: BiquadFilterType; hz: number; q: number; lfoHz: number; lfoDepthHz: number } | null; // filtered noise
}

export type MoodId = 'calm' | 'moon' | 'mars' | 'titan';

export const MOODS: Record<MoodId, MoodDef> = {
  // Menus and the design screens: warm, unhurried, a major pentatonic around D.
  calm: {
    root: 50,
    scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],
    gain: 0.5,
    drone: { gain: 0.05, cutoffHz: 380, lfoHz: 0.05, lfoDepthHz: 140, type: 'sawtooth', octave: -1 },
    pad: { gain: 0.035, type: 'triangle', octave: 1, notes: 3, detuneCents: 7, cutoffHz: 1400, attack: 4, hold: 5, release: 7, every: [8, 12] },
    bell: { gain: 0.05, octave: 2, decay: 3.5, every: [5, 11], partial: 2.76 },
    air: null,
  },
  // The Moon: sparse, cold, high and empty. Thin sines, glassy bells far apart, no air.
  moon: {
    root: 64,
    scale: [0, 2, 7, 9, 14, 19, 21],
    gain: 0.5,
    drone: { gain: 0.03, cutoffHz: 1600, lfoHz: 0.03, lfoDepthHz: 600, type: 'sine', octave: 0 },
    pad: { gain: 0.022, type: 'sine', octave: 1, notes: 2, detuneCents: 4, cutoffHz: 3000, attack: 6, hold: 6, release: 9, every: [12, 18] },
    bell: { gain: 0.035, octave: 2, decay: 5, every: [7, 16], partial: 3.01 },
    air: null,
  },
  // Mars: warmer, dorian around A, with a soft wind of filtered noise.
  mars: {
    root: 45,
    scale: [0, 2, 3, 7, 9, 10, 12, 14, 15, 19],
    gain: 0.5,
    drone: { gain: 0.055, cutoffHz: 420, lfoHz: 0.04, lfoDepthHz: 180, type: 'sawtooth', octave: 0 },
    pad: { gain: 0.032, type: 'triangle', octave: 1, notes: 3, detuneCents: 9, cutoffHz: 1100, attack: 5, hold: 5, release: 8, every: [9, 14] },
    bell: { gain: 0.035, octave: 2, decay: 3, every: [9, 18], partial: 2.4 },
    air: { gain: 0.045, type: 'bandpass', hz: 600, q: 0.8, lfoHz: 0.07, lfoDepthHz: 350 },
  },
  // Titan: low and murky, phrygian around C, a dark rumble under it.
  titan: {
    root: 36,
    scale: [0, 1, 3, 7, 8, 12, 13, 15],
    gain: 0.55,
    drone: { gain: 0.08, cutoffHz: 260, lfoHz: 0.025, lfoDepthHz: 110, type: 'sawtooth', octave: 0 },
    pad: { gain: 0.03, type: 'sawtooth', octave: 1, notes: 3, detuneCents: 11, cutoffHz: 520, attack: 7, hold: 6, release: 10, every: [11, 17] },
    bell: { gain: 0.03, octave: 1, decay: 5, every: [12, 22], partial: 2.1 },
    air: { gain: 0.05, type: 'lowpass', hz: 220, q: 0.5, lfoHz: 0.05, lfoDepthHz: 90 },
  },
};

/** The rover's motor hum and wheel crunch (see motorTone for the speed mapping). */
export const MOTOR = {
  idleHz: 46,
  topHz: 128, // at top speed
  effortHz: 8, // added while the throttle is held
  idleGain: 0.05,
  speedGain: 0.16,
  effortGain: 0.05,
  cutoffHz: [500, 1500] as [number, number], // lowpass at idle and at top speed
  moonCutoffHz: [220, 420] as [number, number], // no air on the Moon: muffled, felt through the chassis
  moonGain: 0.75,
  whineGain: 0.12, // a faint gear whine at 3x the motor pitch, relative to the hum
  crunchGain: 0.09,
  crunchHz: 1800,
  moonCrunchHz: 700,
  crunchGrainHz: [3, 14] as [number, number], // grit rate at a crawl and at top speed
  smoothing: 0.08, // seconds: how fast the hum follows the speed
};

/** Weather ambience in the mission (effects bus): Mars wind, Titan methane rain. */
export const WEATHER = {
  windBase: 0.0, // Mars's calm wind is in its music mood; this is the storm's wind
  windMax: 0.13,
  rainMax: 0.11,
  smoothing: 1.5,
};

/** One-shot effects. */
export const SFX = {
  maxVoices: 10, // more at once are dropped
  click: 0.05,
  part: 0.09,
  launch: 0.22,
  chime: 0.1,
  instrument: 0.1,
  warning: 0.11,
  impact: 0.3,
  quake: 0.28,
  flare: 0.12,
  weatherAlert: 0.09,
  end: 0.12,
  power: 0.08,
};

/** Warnings sound once when they start; the same warning waits at least this long to sound again. */
export const WARNING_COOLDOWN_SECONDS = 25;
/** A bump that does no damage still thuds softly above this share of the damage threshold. */
export const BUMP_SHARE = 0.55;
export const BUMP_COOLDOWN_SECONDS = 0.5;
