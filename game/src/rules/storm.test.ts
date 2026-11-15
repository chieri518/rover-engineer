import { describe, expect, it } from 'vitest';
import { scheduleDustStorm, stormEdge, stormFreezeFactor, stormIntensity, stormPhase, stormSolarFactor } from './storm';
import { seededRng } from './events';
import type { DustStormSpec } from './marsTypes';
import type { EventsFile } from './types';

const spec: DustStormSpec = {
  windowsSeconds: [[180, 360]],
  warningSeconds: 60,
  durationSeconds: 120,
  rampSeconds: 10,
  solarFactor: 0.33,
  freezeFactor: 0.5,
  source: 'test',
};
const events: EventsFile = { duststorm: spec };

describe('dust storm', () => {
  it('starts inside its window, forecast a sol ahead, and lasts its duration', () => {
    for (let seed = 1; seed < 50; seed++) {
      const storm = scheduleDustStorm(events, seededRng(seed))!;
      expect(storm.startAt).toBeGreaterThanOrEqual(180);
      expect(storm.startAt).toBeLessThanOrEqual(360);
      expect(storm.startAt - storm.forecastAt).toBe(60);
      expect(storm.endAt - storm.startAt).toBe(120);
    }
  });

  it('is absent on a world without one', () => {
    expect(scheduleDustStorm({}, seededRng(1))).toBeNull();
    expect(stormPhase(300, null)).toBe('none');
    expect(stormIntensity(300, null, spec)).toBe(0);
    expect(stormEdge(0, 600, null)).toBeNull();
  });

  const storm = { forecastAt: 140, startAt: 200, endAt: 320 };

  it('goes through forecast, active and cleared', () => {
    expect(stormPhase(100, storm)).toBe('none');
    expect(stormPhase(140, storm)).toBe('forecast');
    expect(stormPhase(200, storm)).toBe('active');
    expect(stormPhase(319, storm)).toBe('active');
    expect(stormPhase(320, storm)).toBe('cleared');
  });

  it('ramps its intensity in and out', () => {
    expect(stormIntensity(199, storm, spec)).toBe(0);
    expect(stormIntensity(205, storm, spec)).toBeCloseTo(0.5, 9);
    expect(stormIntensity(260, storm, spec)).toBe(1);
    expect(stormIntensity(315, storm, spec)).toBeCloseTo(0.5, 9);
    expect(stormIntensity(320, storm, spec)).toBe(0);
    expect(stormIntensity(205, storm, { ...spec, rampSeconds: 0 })).toBe(1);
  });

  it('cuts solar income to about a third and halves night freezing at full strength', () => {
    expect(stormSolarFactor(0, spec)).toBe(1);
    expect(stormSolarFactor(1, spec)).toBeCloseTo(0.33, 9);
    expect(stormFreezeFactor(1, spec)).toBeCloseTo(0.5, 9);
    expect(stormFreezeFactor(0.5, spec)).toBeCloseTo(0.75, 9);
    expect(stormSolarFactor(1, undefined)).toBe(1);
  });

  it('reports the forecast, start and end once each', () => {
    expect(stormEdge(139.9, 140.1, storm)).toBe('forecast');
    expect(stormEdge(199.9, 200.1, storm)).toBe('started');
    expect(stormEdge(319.9, 320.1, storm)).toBe('cleared');
    expect(stormEdge(150, 160, storm)).toBeNull();
  });
});
