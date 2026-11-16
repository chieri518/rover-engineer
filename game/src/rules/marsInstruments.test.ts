// Mars step 4a (engineering plan Phase 4): the weather mast's earlier storm forecast and readout, the
// radar's profile, the laser's target, the organics spectrometer's long hold charged as it runs, the arm's
// slope refusal and the mast's wider photo zones. Pure rules; the numbers come from the data, so the tests
// check how the rules behave, not the starting values.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import {
  emptyInstrumentLog, emptyRadarTrack, laserTarget, radarLayer, radarTrack, stormForecastAt, stormHaze, trendOf, weatherReading,
  weatherReadout, withMastPhotoRange, type RadarSample, type RadarTrack,
} from './instruments';
import {
  marsSetup, marsStatus, marsWeatherSky, missionSetup, setStandby, startInstrumentUse, startMission, stepMission, weatherMastOnSince,
  type MissionSample, type MissionState, type UseConditions,
} from './mission';
import { MilestoneTracker, buildZones } from './milestones';
import { seededRng } from './events';
import { selectedParts } from './rover';
import { validateGameData } from './validate';
import type { Boulder } from './boulders';
import type { Build, Milestone, Tuning } from './types';
import type { DustStorm } from './storm';

const mars = loadGameData('mars');
const moon = loadGameData('moon');
const it_ = mars.tuning.instruments;
const weather = it_.weather!;
const radarT = it_.radar!;
const laserT = it_.laser!;
const site = { latitudeDeg: 18.4447, longitudeDeg: 77.4508 }; // Jezero, as in marsNight.test.ts

const base: Build = {
  chassis: 'chassis-steel', wheels: 'wheels-grouser', power: 'power-rtg', battery: 'battery-large', lights: 'lights-led', heater: 'heater-none',
  payload: [], support: { arm: 'arm-robotic', mast: 'mast-remote' },
};
const marsRover = (payload: string[], over: Partial<Build> = {}) => {
  const parts = selectedParts({ ...base, payload, ...over }, mars.parts);
  return { parts, setup: missionSetup(parts, mars.tuning, [], marsSetup(site, mars.events, seededRng(1), mars.tuning)) };
};
const still: UseConditions = { speedMps: 0, inColdZone: false, sunlight: 1, earthInView: false, boulderInReach: true, boulder: 0, slopeDeg: 0 };
const idle = (over: Partial<MissionSample> = {}): MissionSample => ({
  dt: 0.25, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 1, inColdZone: false, softness: 0,
  throttling: false, impactMps: 0, upY: 1, ...over,
});

describe('weather mast: the earlier storm forecast (B9, provisional, for Chieri\'s review)', () => {
  const storm: DustStorm = { forecastAt: 200, startAt: 260, endAt: 380 };

  it('without the mast the forecast is the orbital report\'s', () => {
    expect(stormForecastAt(storm, null, weather)).toEqual({ at: 200, byMast: false });
  });

  it('a mast on for a while gives it stormEarlyWarningSeconds earlier', () => {
    expect(stormForecastAt(storm, 0, weather)).toEqual({ at: 200 - weather.stormEarlyWarningSeconds, byMast: true });
  });

  it('a mast switched on late gives it once it has been on warmupSeconds, if that is still before the report', () => {
    const on = 200 - weather.stormEarlyWarningSeconds;
    expect(stormForecastAt(storm, on, weather)).toEqual({ at: on + weather.warmupSeconds, byMast: true });
    expect(stormForecastAt(storm, 200 - weather.warmupSeconds, weather)).toEqual({ at: 200, byMast: false });
    expect(stormForecastAt(storm, 250, weather)).toEqual({ at: 200, byMast: false });
  });

  it('never before the mission starts', () => {
    expect(stormForecastAt({ forecastAt: 10, startAt: 70, endAt: 190 }, 0, { ...weather, warmupSeconds: 0 }).at).toBe(0);
  });
});

describe('weather mast: the readout', () => {
  const storm: DustStorm = { forecastAt: 200, startAt: 260, endAt: 380 };
  const ramp = 10;

  it('dust haze rises over the lead before the storm, stays up while it blows and eases out at its end', () => {
    const lead = storm.startAt - storm.forecastAt + weather.stormEarlyWarningSeconds;
    expect(stormHaze(storm.startAt - lead - 1, storm, ramp, weather)).toBe(0);
    expect(stormHaze(storm.startAt - lead / 2, storm, ramp, weather)).toBeCloseTo(0.5, 9);
    expect(stormHaze(300, storm, ramp, weather)).toBe(1);
    expect(stormHaze(storm.endAt - ramp / 2, storm, ramp, weather)).toBeCloseTo(0.5, 9);
    expect(stormHaze(storm.endAt, storm, ramp, weather)).toBe(0);
    expect(stormHaze(300, null, ramp, weather)).toBe(0);
  });

  it('dust opacity: clear, hazy ahead of the storm, the storm value at full strength', () => {
    const at = (haze: number, stormIntensity: number) => weatherReading({ localSolarHours: 12, stormIntensity, haze }, weather).tau;
    expect(at(0, 0)).toBeCloseTo(weather.clearTau, 9);
    expect(at(1, 0)).toBeCloseTo(weather.clearTau + weather.forecastHazeTau, 9);
    expect(at(1, 1)).toBeCloseTo(weather.stormTau, 9);
  });

  it('pressure peaks at pressurePeakHour and is lowest twelve hours later', () => {
    const p = (h: number) => weatherReading({ localSolarHours: h, stormIntensity: 0, haze: 0 }, weather).pressurePa;
    expect(p(weather.pressurePeakHour)).toBeCloseTo(weather.pressurePa * (1 + weather.pressureDailySwing), 6);
    expect(p(weather.pressurePeakHour + 12)).toBeCloseTo(weather.pressurePa * (1 - weather.pressureDailySwing), 6);
  });

  it('trends: steady within the threshold, rising and falling beyond it', () => {
    expect(trendOf(10, 10.5, 1)).toBe('steady');
    expect(trendOf(12, 10, 1)).toBe('rising');
    expect(trendOf(8, 10, 1)).toBe('falling');
    const r = weatherReadout({ localSolarHours: 12, stormIntensity: 0, haze: 1 }, { localSolarHours: 11, stormIntensity: 0, haze: 0 }, weather);
    expect(r.dustTrend).toBe('rising');
    expect(r.pressureTrend).toBe('falling'); // past the morning peak
  });

  it('reads from the Mars clock and storm in a mission; nothing on the Moon', () => {
    const { setup } = marsRover(['instrument-weather']);
    expect(marsWeatherSky(22.5, setup, mars.tuning)).toMatchObject({ stormIntensity: 0, haze: 0 });
    expect(marsWeatherSky(22.5, missionSetup(selectedParts(moonBuild, moon.parts), moon.tuning, []), moon.tuning)).toBeNull();
  });
});

const moonBuild: Build = {
  chassis: 'chassis-titanium', wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-li-ion', lights: 'lights-led', heater: 'heater-rhu',
  payload: ['instrument-xray'],
};

describe('weather mast in the mission', () => {
  /** Runs to just past the forecast, with the mast switched on from `onAt` (null: never). */
  const run = (onAt: number | null, poweredDownUntil = 0) => {
    const { setup } = marsRover(['instrument-weather']);
    const storm = setup.mars!.storm!;
    let s: MissionState = startMission(setup);
    const forecasts: { at: number; byMast: boolean }[] = [];
    while (s.seconds < storm.startAt - 0.5 && !s.end) {
      if (onAt !== null && s.seconds >= onAt && !s.standbyOn.includes('weather')) {
        const r = setStandby(s, 'weather', true, setup, mars.tuning);
        if (r.ok) s = r.state;
      }
      s = { ...s, poweredDown: s.seconds < poweredDownUntil };
      const step = stepMission(s, idle({ position: { x: 0, z: 0 } }), setup, mars.tuning, mars.events);
      s = step.state;
      for (const n of step.marsNotices) if (n.kind === 'storm' && n.edge === 'forecast') forecasts.push({ at: s.seconds, byMast: n.byMast === true });
    }
    return { storm, forecasts, state: s, setup };
  };

  it('without the mast the forecast comes once, at the orbital report', () => {
    const { storm, forecasts } = run(null);
    expect(forecasts).toHaveLength(1);
    expect(forecasts[0]!.byMast).toBe(false);
    expect(forecasts[0]!.at).toBeCloseTo(storm.forecastAt, 0);
  });

  it('with the mast on from the start it comes once, early, and credits the mast', () => {
    const { storm, forecasts, state, setup } = run(0);
    expect(forecasts).toHaveLength(1);
    expect(forecasts[0]!.byMast).toBe(true);
    expect(forecasts[0]!.at).toBeCloseTo(storm.forecastAt - weather.stormEarlyWarningSeconds, 0);
    expect(weatherMastOnSince(state)).toBe(0);
    // The storm phase reads 'forecast' from the early forecast on.
    expect(marsStatus({ ...state, seconds: storm.forecastAt - 1 }, setup, mars.tuning)?.stormPhase).toBe('forecast');
  });

  it('powered down, the mast does not count as on', () => {
    const { setup } = marsRover(['instrument-weather']);
    const storm = setup.mars!.storm!;
    const { forecasts } = run(0, storm.forecastAt); // asleep (in the game, by night) until the report
    expect(forecasts).toEqual([{ at: expect.closeTo(storm.forecastAt, 0) as number, byMast: false }]);
  });
});

describe('ground-penetrating radar: the profile', () => {
  const step = (over: Partial<RadarSample> = {}): RadarSample => ({ on: true, dt: 0.5, distanceM: 1, headingDeg: 0, moving: true, layer: 'floor', ...over });
  const drive = (track: RadarTrack, n: number, over: Partial<RadarSample> = {}) => {
    for (let i = 0; i < n; i++) track = radarTrack(track, step(over), radarT);
    return track;
  };

  it('adds a column every columnM driven, with the layer under the rover', () => {
    const t = drive(emptyRadarTrack(), 10 * radarT.columnM);
    expect(t.columns).toHaveLength(10);
    expect(t.profileM).toBeCloseTo(10 * radarT.columnM, 9);
    expect(t.columns[0]).toEqual({ layer: 'floor', startsProfile: true });
    expect(t.columns.slice(1).every((c) => !c.startsProfile)).toBe(true);
    expect(drive(t, radarT.columnM, { layer: 'seitah' }).layers).toEqual(['floor', 'seitah']);
  });

  it('a gentle curve keeps the profile; a sharp turn breaks it and a new one starts', () => {
    let t = drive(emptyRadarTrack(), 4 * radarT.columnM);
    const gentle = radarT.turnBreakDeg / 2 / radarT.columnM; // degrees per meter, half the limit per column
    for (let i = 0; i < 8 * radarT.columnM; i++) t = radarTrack(t, step({ headingDeg: (i + 1) * gentle }), radarT);
    expect(t.profileM).toBeCloseTo(12 * radarT.columnM, 9);
    const before = t.longestM;
    t = radarTrack(t, step({ headingDeg: 8 * radarT.columnM * gentle + radarT.turnBreakDeg + 5 }), radarT);
    expect(t.profileM).toBe(1);
    expect(t.longestM).toBe(before);
    t = drive(t, 2 * radarT.columnM, { headingDeg: 8 * radarT.columnM * gentle + radarT.turnBreakDeg + 5 });
    expect(t.columns.filter((c) => c.startsProfile)).toHaveLength(2);
  });

  it('headings wrap: 359° to 1° is a 2° turn', () => {
    let t = drive(emptyRadarTrack(), 1, { headingDeg: 359 });
    t = radarTrack(t, step({ headingDeg: 1 }), radarT);
    expect(t.profileM).toBe(2);
  });

  it('a short pause keeps the profile; standing still for stopBreakSeconds breaks it', () => {
    let t = drive(emptyRadarTrack(), 6);
    t = radarTrack(t, step({ moving: false, distanceM: 0, dt: radarT.stopBreakSeconds / 2 }), radarT);
    t = drive(t, 2);
    expect(t.profileM).toBe(8);
    t = radarTrack(t, step({ moving: false, distanceM: 0, dt: radarT.stopBreakSeconds }), radarT);
    expect(t.profileM).toBe(0);
    expect(t.longestM).toBe(8);
  });

  it('switched off, the profile ends; the strip keeps at most `columns` columns', () => {
    const t = drive(emptyRadarTrack(), (radarT.columns + 5) * radarT.columnM);
    expect(t.columns).toHaveLength(radarT.columns);
    const off = radarTrack(t, step({ on: false }), radarT);
    expect(off.profileM).toBe(0);
    expect(off.columns).toBe(t.columns);
    expect(drive(off, radarT.columnM).columns.at(-1)!.startsProfile).toBe(true);
  });

  it('layer kinds come from the zone under the rover, first match, else the default', () => {
    expect(radarLayer([], radarT)).toBe(radarT.defaultLayer);
    expect(radarLayer(['near-lander', 'seitah'], radarT)).toBe('seitah');
    expect(radarLayer(['delta-front', 'seitah'], radarT)).toBe('delta');
  });
});

describe('laser spectrometer: the target ahead', () => {
  const b = (x: number, z: number, radius = 1): Boulder => ({ x, z, radius } as Boulder);
  const north = { x: 0, z: -1 };
  const p = { x: 0, z: 0 };

  it('the nearest boulder in the cone and within reach (surface distance)', () => {
    const boulders = [b(0, -8), b(0, -5), b(0, 5), b(0, -(laserT.reachM + 2))];
    expect(laserTarget(p, north, { boulders, cliff: null }, laserT)).toMatchObject({ kind: 'boulder', index: 1, distanceM: 4 });
    expect(laserTarget(p, { x: 0, z: 1 }, { boulders, cliff: null }, laserT)).toMatchObject({ index: 2 });
    expect(laserTarget(p, north, { boulders: [b(0, -(laserT.reachM + 2))], cliff: null }, laserT)).toBeNull();
  });

  it('a boulder outside the cone is not a target unless its disc reaches into it', () => {
    const off = (deg: number, radius: number) => {
      const r = (deg * Math.PI) / 180;
      return b(Math.sin(r) * 8, -Math.cos(r) * 8, radius);
    };
    expect(laserTarget(p, north, { boulders: [off(laserT.coneDeg + 20, 0.5)], cliff: null }, laserT)).toBeNull();
    expect(laserTarget(p, north, { boulders: [off(laserT.coneDeg + 5, 2)], cliff: null }, laserT)).not.toBeNull();
  });

  it('the delta cliff: its foot line within reach in the cone; the nearer of a boulder and the cliff wins', () => {
    const cliff: [number, number][] = [[-50, -10], [50, -10]];
    expect(laserTarget(p, north, { boulders: [], cliff }, laserT)).toMatchObject({ kind: 'cliff', index: null, z: -10 });
    expect(laserTarget(p, { x: 0, z: 1 }, { boulders: [], cliff }, laserT)).toBeNull();
    expect(laserTarget({ x: 0, z: 10 }, north, { boulders: [], cliff }, laserT)).toBeNull(); // 20 m away
    expect(laserTarget(p, north, { boulders: [b(0, -6)], cliff }, laserT)).toMatchObject({ kind: 'boulder' });
    expect(laserTarget(p, north, { boulders: [b(2, -11, 0.5)], cliff }, laserT)).toMatchObject({ kind: 'cliff' });
  });
});

describe('the mast widens the camera\'s photo zones', () => {
  it('on Mars with a mast aboard, not without one, never on the Moon', () => {
    const mt = mars.tuning.milestones;
    const withMast = withMastPhotoRange(mt, marsRover([]).parts, it_.mast);
    expect(withMast.photoZoneRadiusM).toBeCloseTo(mt.photoZoneRadiusM * it_.mast!.photoRangeFactor, 9);
    expect(withMastPhotoRange(mt, marsRover([], { support: { arm: 'arm-none', mast: 'mast-none' } }).parts, it_.mast)).toBe(mt);
    expect(moon.tuning.instruments.mast).toBeUndefined();
    expect(withMastPhotoRange(moon.tuning.milestones, selectedParts(moonBuild, moon.parts), moon.tuning.instruments.mast)).toBe(moon.tuning.milestones);
  });
});

describe('contact readings on slopes (MS2, B13, provisional, for Chieri\'s review)', () => {
  const limit = it_.arm!.slopeLimitDeg;

  it('the X-ray and organics spectrometers refuse on ground steeper than the arm\'s limit', () => {
    const { setup } = marsRover(['instrument-xray', 'instrument-organics']);
    expect(setup.contact).toEqual(['xray', 'organics']);
    const s = startMission(setup);
    for (const inst of ['xray', 'organics'] as const) {
      expect(startInstrumentUse(s, inst, { ...still, slopeDeg: limit + 0.5 }, setup, mars.tuning)).toMatchObject({ ok: false, reason: 'slope' });
      expect(startInstrumentUse(s, inst, { ...still, slopeDeg: limit }, setup, mars.tuning).ok).toBe(true);
    }
  });

  it('with no boulder in reach they say so first', () => {
    const { setup } = marsRover(['instrument-organics']);
    expect(startInstrumentUse(startMission(setup), 'organics', { ...still, boulderInReach: false, slopeDeg: limit + 5 }, setup, mars.tuning))
      .toMatchObject({ ok: false, reason: 'no-boulder' });
  });

  it('the Moon\'s X-ray reads on any slope (no arm there)', () => {
    const setup = missionSetup(selectedParts(moonBuild, moon.parts), moon.tuning, []);
    expect(setup.contact).toEqual([]);
    expect(startInstrumentUse(startMission(setup), 'xray', { ...still, slopeDeg: 19 }, setup, moon.tuning).ok).toBe(true);
  });
});

describe('laser spectrometer in the mission', () => {
  it('needs a target ahead; locks the target kind at the start and reports it when done', () => {
    const { setup } = marsRover(['instrument-laser']);
    expect(setup.remote).toEqual(['laser']);
    const s = startMission(setup);
    expect(startInstrumentUse(s, 'laser', { ...still, remoteTarget: null }, setup, mars.tuning)).toMatchObject({ ok: false, reason: 'no-target' });
    const use = startInstrumentUse(s, 'laser', { ...still, boulder: null, remoteTarget: 'cliff', slopeDeg: 15 }, setup, mars.tuning);
    if (!use.ok) throw new Error(use.reason);
    expect(use.state.using?.site.target).toBe('cliff');
    let st = use.state;
    const done = [];
    for (let i = 0; i < 20 && st.using; i++) {
      const out = stepMission(st, idle(), setup, mars.tuning, mars.events);
      st = out.state;
      done.push(...out.notices.filter((n) => n.kind === 'instrument-done'));
    }
    expect(done).toMatchObject([{ instrument: 'laser', site: { target: 'cliff', boulder: null } }]);
  });
});

describe('organics spectrometer: a long hold charged as it runs', () => {
  const { setup } = marsRover(['instrument-organics']);
  const cost = setup.instruments.find((c) => c.instrument === 'organics')!;
  const rate = cost.energyPerUse / cost.useSeconds;

  it('starts with nothing charged, then pays energyPerUse / useSeconds per second of the hold', () => {
    const s = { ...startMission(setup), energy: 500 };
    const use = startInstrumentUse(s, 'organics', still, setup, mars.tuning);
    if (!use.ok) throw new Error(use.reason);
    expect(use.cost).toBe(cost.energyPerUse);
    expect(use.state.energy).toBe(500);
    expect(use.state.using).toMatchObject({ instrument: 'organics', secondsLeft: cost.useSeconds, chargePerSecond: rate });
    // Night with sleep would add a drain; compare with the same step without the reading.
    const sample = idle({ dt: 1 });
    const withUse = stepMission(use.state, sample, setup, mars.tuning, mars.events).state.energy;
    const without = stepMission(s, sample, setup, mars.tuning, mars.events).state.energy;
    expect(without - withUse).toBeCloseTo(rate, 9);
  });

  it('charges the whole energyPerUse over the hold, and pauses while powered down', () => {
    let s: MissionState = { ...startMission(setup), energy: 500 };
    const use = startInstrumentUse(s, 'organics', still, setup, mars.tuning);
    if (!use.ok) throw new Error(use.reason);
    s = use.state;
    let charged = 0;
    let done = false;
    for (let i = 0; i < 200 && !done; i++) {
      const paused = i >= 10 && i < 20;
      const before = { ...s, poweredDown: paused };
      const out = stepMission(before, idle({ dt: 0.25 }), setup, mars.tuning, mars.events);
      const free = stepMission({ ...before, using: null }, idle({ dt: 0.25 }), setup, mars.tuning, mars.events);
      charged += free.state.energy - out.state.energy;
      if (paused) expect(out.state.using?.secondsLeft).toBe(before.using?.secondsLeft);
      done = out.notices.some((n) => n.kind === 'instrument-done');
      s = { ...out.state, poweredDown: false };
    }
    expect(done).toBe(true);
    expect(charged).toBeCloseTo(cost.energyPerUse, 6);
  });

  it('is refused unless the battery holds the whole reading, and stops when the battery cannot pay', () => {
    const low = { ...startMission(setup), energy: cost.energyPerUse };
    expect(startInstrumentUse(low, 'organics', still, setup, mars.tuning)).toMatchObject({ ok: false, reason: 'energy', cost: cost.energyPerUse });
    const use = startInstrumentUse({ ...low, energy: cost.energyPerUse + 1 }, 'organics', still, setup, mars.tuning);
    if (!use.ok) throw new Error(use.reason);
    // The battery is drained some other way (here: set low) before the hold is paid for.
    const out = stepMission({ ...use.state, energy: rate * 0.1 }, idle({ dt: 1, sunlight: 0 }), setup, { ...mars.tuning }, mars.events);
    expect(out.state.using).toBeNull();
    expect(out.state.end).toBeNull();
    expect(out.notices).toContainEqual({ kind: 'instrument-stopped', instrument: 'organics', reason: 'energy' });
  });

  it('other held uses still pay up front (the Moon\'s drill and X-ray)', () => {
    const moonSetup = missionSetup(selectedParts(moonBuild, moon.parts), moon.tuning, []);
    const use = startInstrumentUse({ ...startMission(moonSetup), energy: 100 }, 'xray', still, moonSetup, moon.tuning);
    if (!use.ok) throw new Error(use.reason);
    expect(use.state.energy).toBe(100 - use.cost);
    expect(use.state.using && 'chargePerSecond' in use.state.using).toBe(false);
  });
});

describe('the shared triggers take the Mars instruments', () => {
  const zones = buildZones({ landing: { x: 0, y: 0, z: 0 }, rockyAreas: [], seitah: { name: 'Seitah', outlineLocal_xz: [[100, -50], [300, -50], [300, 50], [100, 50]] } }, mars.tuning.milestones);
  const m = (id: string, trigger: Milestone['trigger'], instrument: Milestone['requires']['instrument']): Milestone => ({
    id, name: id, category: 'scientific', record: false, trigger, requires: { instrument }, money: 1, rp: 1, summary: '', fact: '',
  } as Milestone);

  it('the radar feeds `transect` as the neutron spectrometer does: switched on, an unbroken drive touching the zone', () => {
    const { parts } = marsRover(['instrument-radar']);
    const tracker = new MilestoneTracker([m('buried', { type: 'transect', instrument: 'radar', zone: 'seitah', meters: 150 }, 'radar')], parts, zones, mars.tuning.milestones);
    let reached = 0;
    for (let x = 0; x <= 200; x += 5) {
      const u = tracker.step({ position: { x, y: 0, z: 0 }, distanceM: x, exploredShare: 0, switchedOn: ['radar'] });
      reached += u.reached.length;
    }
    expect(reached).toBe(1);
  });

  it('the laser and organics feed `reading` with their instrument and target', () => {
    const { parts } = marsRover(['instrument-laser', 'instrument-organics']);
    const tracker = new MilestoneTracker([
      m('afar', { type: 'reading', instrument: 'laser', target: 'cliff' }, 'laser'),
      m('organic', { type: 'reading', instrument: 'organics', target: 'boulder' }, 'organics'),
    ], parts, zones, mars.tuning.milestones);
    const p = { x: 500, y: 0, z: 500 };
    expect(tracker.reading('laser', p, { target: 'boulder' }).reached).toHaveLength(0);
    expect(tracker.reading('laser', p, { target: 'cliff' }).reached.map((r) => r.milestone.id)).toEqual(['afar']);
    expect(tracker.reading('organics', p, { target: 'boulder' }).reached.map((r) => r.milestone.id)).toEqual(['organic']);
  });
});

describe('Mars instrument data', () => {
  it('the instrument log starts empty for the Mars instruments', () => {
    expect(emptyInstrumentLog(['weather', 'radar'])).toMatchObject({ weatherSeconds: 0, stormForecastByMast: false, radarLongestM: null, radarLayers: [], laser: [], organics: 0 });
  });

  it('every new instrument has a history fact with a source, and no text says "found organic molecules" or "signs of life"', () => {
    for (const inst of ['weather', 'radar', 'laser', 'organics'] as const) {
      const t = mars.text.instrumentText[inst];
      expect(t.fact, inst).toBeTruthy();
      expect(t.source, inst).toBeTruthy();
      expect(t.controls, inst).not.toMatch(/no results yet|no readings yet|no profile yet/);
    }
    const all = JSON.stringify(mars.text.instrumentText);
    expect(all).not.toMatch(/found organic molecules|signs of life/i);
  });

  it('validation catches broken Mars instrument tuning', () => {
    const bad = (patch: Partial<Tuning['instruments']>) => validateGameData({ ...mars, tuning: { ...mars.tuning, instruments: { ...it_, ...patch } } });
    expect(bad({ arm: { slopeLimitDeg: mars.tuning.ground.slopeWarningDegrees } })).toContain(
      'tuning.instruments.arm.slopeLimitDeg must be below tuning.ground.slopeWarningDegrees (drivable ground the arm refuses)');
    expect(bad({ radar: { ...radarT, layers: [{ zone: 'nowhere', kind: 'floor' }] } })).toContain('tuning.instruments.radar.layers names unknown zone nowhere');
    expect(bad({ radar: { ...radarT, defaultLayer: 'basalt' } })).toContain('radar layer basalt has no text in instrumentText.radar.layers');
    expect(bad({ laser: { ...laserT, coneDeg: 90 } })).toContain('tuning.instruments.laser.coneDeg must be above 0 and below 90');
    expect(bad({ chargedWhileHeld: ['radar'] })).toContain('tuning.instruments.chargedWhileHeld: radar has no held use to charge');
    expect(bad({ mast: { photoRangeFactor: 0.5 } })).toContain('tuning.instruments.mast.photoRangeFactor must be at least 1');
  });

  it('the Moon has none of the Mars instrument tuning', () => {
    const t = moon.tuning.instruments;
    expect([t.arm, t.mast, t.weather, t.radar, t.laser, t.chargedWhileHeld]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });
});
