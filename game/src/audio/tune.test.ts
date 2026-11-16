import { describe, expect, it } from 'vitest';
import { BUS, MOODS, MOTOR } from './mix';
import { Cooldown, levels, midiToHz, moodFor, motorTone, pickChord, pickDegree, volumeGain, WarningGate } from './tune';

function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('sound helpers', () => {
  it('volume sliders map to a squared gain, clamped to the bus maximum', () => {
    expect(volumeGain(0, 1)).toBe(0);
    expect(volumeGain(1, BUS.musicMax)).toBe(BUS.musicMax);
    expect(volumeGain(0.5, 1)).toBeCloseTo(0.25);
    expect(volumeGain(3, 1)).toBe(1);
    expect(volumeGain(Number.NaN, 1)).toBe(0);
  });

  it('the default music sits well below the default effects', () => {
    expect(volumeGain(0.25, BUS.musicMax)).toBeLessThan(volumeGain(0.6, BUS.effectsMax) / 5);
  });

  it('MIDI to Hz', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });

  it('missions play their world mood; every other screen the calm theme', () => {
    expect(moodFor('mission', 'moon')).toBe('moon');
    expect(moodFor('mission', 'titan')).toBe('titan');
    expect(moodFor('design', 'mars')).toBe('calm');
    expect(moodFor('title', 'moon')).toBe('calm');
    expect(moodFor('debrief', 'titan')).toBe('calm');
  });

  it('note choices stay in the scale and never repeat back to back', () => {
    const scale = MOODS.moon.scale;
    let prev: number | null = null;
    const rng = seq([0.1, 0.1, 0.1, 0.99, 0.5, 0.5, 0.0]);
    for (let k = 0; k < 50; k++) {
      const i = pickDegree(scale, rng, prev);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(scale.length);
      expect(i).not.toBe(prev);
      prev = i;
    }
    expect(pickDegree([5], Math.random, 0)).toBe(0);
  });

  it('chords are distinct scale degrees', () => {
    const chord = pickChord(MOODS.calm.scale, 3, seq([0.3]), null);
    expect(new Set(chord).size).toBe(3);
    for (const d of chord) expect(d).toBeLessThan(MOODS.calm.scale.length);
    expect(pickChord([], 3, Math.random, null)).toEqual([]);
  });

  it('the motor is silent asleep, idles when still and rises with speed', () => {
    const base = { speedMps: 0, topSpeedMps: 4, throttle: 0, wheelsOnGround: 4, awake: true, moon: false };
    const idle = motorTone(base, MOTOR);
    const fast = motorTone({ ...base, speedMps: 4, throttle: 1 }, MOTOR);
    expect(motorTone({ ...base, awake: false }, MOTOR).gain).toBe(0);
    expect(idle.gain).toBeGreaterThan(0);
    expect(idle.crunchGain).toBe(0);
    expect(fast.hz).toBeGreaterThan(idle.hz);
    expect(fast.gain).toBeGreaterThan(idle.gain);
    expect(fast.crunchGain).toBeGreaterThan(0);
    // Airborne: no crunch. Over top speed: capped.
    expect(motorTone({ ...base, speedMps: 4, wheelsOnGround: 0 }, MOTOR).crunchGain).toBe(0);
    expect(motorTone({ ...base, speedMps: 40 }, MOTOR).hz).toBe(MOTOR.topHz);
  });

  it('on the Moon the hum is muffled and quieter', () => {
    const base = { speedMps: 3, topSpeedMps: 4, throttle: 1, wheelsOnGround: 4, awake: true, moon: false };
    const air = motorTone(base, MOTOR);
    const moon = motorTone({ ...base, moon: true }, MOTOR);
    expect(moon.cutoffHz).toBeLessThan(air.cutoffHz);
    expect(moon.gain).toBeLessThan(air.gain);
  });

  it('warnings sound on their rising edge, once per cooldown', () => {
    const gate = new WarningGate(25);
    expect(gate.update(['lowEnergy'], 0)).toEqual(['lowEnergy']);
    expect(gate.update(['lowEnergy'], 1)).toEqual([]); // still on: silent
    expect(gate.update(['lowEnergy', 'cold'], 2)).toEqual(['cold']);
    expect(gate.update([], 3)).toEqual([]);
    expect(gate.update(['lowEnergy'], 10)).toEqual([]); // back on within the cooldown: silent
    expect(gate.update([], 20)).toEqual([]);
    expect(gate.update(['lowEnergy'], 40)).toEqual(['lowEnergy']); // after the cooldown: sounds again
  });

  it('a cooldown lets one event through per period', () => {
    const c = new Cooldown(0.5);
    expect(c.ready(0)).toBe(true);
    expect(c.ready(0.2)).toBe(false);
    expect(c.ready(0.6)).toBe(true);
  });

  it('levels: peak and RMS in dBFS', () => {
    const full = new Float32Array([1, -1, 1, -1]);
    expect(levels([full])).toEqual({ peakDb: 0, rmsDb: 0 });
    expect(levels([new Float32Array([0.5, -0.5])]).peakDb).toBeCloseTo(-6, 0);
    expect(levels([new Float32Array(4)]).peakDb).toBe(-Infinity);
  });
});
