import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { craterWallHint, powerLine, readingNotice, weatherRecordingLine, weatherRecords, type PowerInput, type RecordingState } from './hudText';

const mars = worldGameData('mars');
const t = mars.text.hudMars!;

describe('the Mars power line (step 6c)', () => {
  const day: PowerInput = { solar: true, steady: false, sunlight: 1, night: false, storm: false, solarFactor: 1, dustFactor: 1 };

  it('an RTG rover never reads "Solar panel in sunlight": steady power, day and night', () => {
    expect(powerLine({ ...day, solar: false, steady: true }, t)).toEqual({ text: t.steady, dim: false });
    expect(powerLine({ ...day, solar: false, steady: true, night: true, sunlight: 0 }, t)).toEqual({ text: t.steady, dim: false });
    expect(t.steady).not.toMatch(/solar|sunlight/i);
    expect(powerLine({ ...day, solar: false }, t)).toEqual({ text: t.none, dim: true });
  });

  it('a solar rover reads its panels\' state: night, storm, shadow, low Sun, sunlight', () => {
    expect(powerLine(day, t)).toEqual({ text: t.solarSun, dim: false });
    expect(powerLine({ ...day, night: true, solarFactor: 0 }, t)).toEqual({ text: t.solarNight, dim: true });
    expect(powerLine({ ...day, storm: true, solarFactor: 0.4 }, t).text).toBe(t.solarStorm);
    expect(powerLine({ ...day, sunlight: 0.2 }, t)).toEqual({ text: t.solarShadow, dim: true });
    expect(powerLine({ ...day, solarFactor: 0.3 }, t)).toEqual({ text: t.solarLowSun, dim: false });
  });

  it('shows the dust factor once dust has cut income by 1% or more, and a steady source after it', () => {
    expect(powerLine({ ...day, dustFactor: 0.996 }, t).text).toBe(t.solarSun);
    expect(powerLine({ ...day, dustFactor: 0.88 }, t).text).toBe(`${t.solarSun}${t.join}${t.dust.replace('{loss}', '12')}`);
    expect(powerLine({ ...day, dustFactor: 0.88 }, t).text).toContain('dust −12%');
    const both = powerLine({ ...day, steady: true, night: true, solarFactor: 0, dustFactor: 0.7 }, t);
    expect(both).toEqual({ text: [t.solarNight, t.dust.replace('{loss}', '30'), t.steadyToo].join(t.join), dim: false });
  });
});

describe('the weather mast\'s recording state', () => {
  const records = weatherRecords(mars.milestones.milestones);
  const state = (event: string, over: Partial<RecordingState> = {}): RecordingState => ({ ...records.find((r) => r.event === event)!, active: true, counted: 0, earned: false, ...over });

  it('reads the timed records from the milestones: Storm log and Night weather (Dust devil pass has no seconds)', () => {
    expect(records.map((r) => r.id)).toEqual(['storm-log', 'night-weather']);
    for (const r of records) expect(r.seconds).toBeGreaterThan(0);
    expect(weatherRecords(worldGameData('moon').milestones.milestones)).toEqual([]);
  });

  it('counts seconds toward the record while its event is on; the storm first; paused near the lander', () => {
    const storm = state('duststorm', { counted: 23.7 });
    const night = state('night', { counted: 5 });
    expect(weatherRecordingLine([storm, night], false, t)).toBe(`Weather mast recording ${t.recordEvents.duststorm}: 23 of ${storm.seconds} s`);
    expect(weatherRecordingLine([night], false, t)).toBe(`Weather mast recording ${t.recordEvents.night}: 5 of ${night.seconds} s`);
    expect(weatherRecordingLine([{ ...storm, earned: true }, night], false, t)).toContain(t.recordEvents.night!);
    expect(weatherRecordingLine([storm], true, t)).toBe(t.recordingPaused.replace('{event}', t.recordEvents.duststorm!).replace('{seconds}', '23').replace('{total}', String(storm.seconds)));
    expect(weatherRecordingLine([{ ...storm, counted: 999 }], false, t)).toContain(`${storm.seconds} of ${storm.seconds} s`);
  });

  it('hides when no record waits: no event on, or both earned', () => {
    expect(weatherRecordingLine([], false, t)).toBeNull();
    expect(weatherRecordingLine([state('duststorm', { active: false }), state('night', { active: false })], false, t)).toBeNull();
    expect(weatherRecordingLine([state('duststorm', { earned: true }), state('night', { earned: true })], false, t)).toBeNull();
  });
});

describe('the crater wall hint and the readout\'s new type line', () => {
  it('hints on a crater\'s rim with the camera aboard until Crater wall is earned', () => {
    expect(craterWallHint(true, true, false, 'C', t)).toBe(t.craterWallHint.replace('{key}', 'C'));
    expect(craterWallHint(false, true, false, 'C', t)).toBeNull();
    expect(craterWallHint(true, false, false, 'C', t)).toBeNull();
    expect(craterWallHint(true, true, true, 'C', t)).toBeNull();
  });

  it('adds "New type: n of 6" when a reading adds a rock type for its instrument', () => {
    const xray = mars.tuning.instruments.xray;
    expect(readingNotice('Read.', [], 'maaz-basalt', xray, mars.text)).toEqual(['Read.', 'New type: 1 of 6.']);
    expect(readingNotice('Read.', ['maaz-basalt', 'lake-mudstone'], 'flood-conglomerate', xray, mars.text)).toEqual(['Read.', 'New type: 3 of 6.']);
    expect(readingNotice('Read.', ['maaz-basalt'], 'maaz-basalt', xray, mars.text)).toBe('Read.');
  });

  it('names no Mars lesson except the dust factor, the dust lesson\'s own designed line', () => {
    const { dust: _dust, _owner, recordEvents, ...rest } = t as typeof t & { _owner?: string };
    const lines = [...Object.values(rest), ...Object.values(recordEvents)].join(' ').toLowerCase();
    for (const word of ['slope', 'level', 'flat', 'steep', 'dust', 'noise', 'generator', 'lights']) expect(lines, word).not.toContain(word);
  });
});
