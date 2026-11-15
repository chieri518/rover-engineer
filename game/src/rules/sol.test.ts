import { describe, expect, it } from 'vitest';
import { marsSolarDeclinationDeg, solClock, solEdge, sunriseHourAngleDeg } from './sol';
import { marsSunAt, sunAzEl } from './marsSun';
import type { SolTuning } from './marsTypes';

const sol: SolTuning = { sols: 10, secondsPerSol: 60, daySeconds: 45, nightSeconds: 15, solarLongitudeDeg: 200, horizonRateShare: 0.25 };
const jezero = { latitudeDeg: 18.4447, longitudeDeg: 77.4508 };

describe('Mars solar geometry', () => {
  it('gives the real declination for the season', () => {
    expect(marsSolarDeclinationDeg(0)).toBeCloseTo(0, 6);
    expect(marsSolarDeclinationDeg(90)).toBeCloseTo(25.19, 2);
    expect(marsSolarDeclinationDeg(200)).toBeCloseTo(-8.37, 1);
  });

  it('puts sunrise near 87° hour angle at Jezero in early northern autumn (days a little shorter than nights)', () => {
    const h0 = sunriseHourAngleDeg(jezero.latitudeDeg, marsSolarDeclinationDeg(200));
    expect(h0).toBeCloseTo(87.2, 0);
    expect(sunriseHourAngleDeg(80, 20)).toBe(180); // polar day
    expect(sunriseHourAngleDeg(80, -20)).toBe(0); // polar night
  });

  it('finds the Sun due south at noon and on the horizon at the sunrise hour angle', () => {
    const noon = sunAzEl(18.4447, -8.37, 0);
    expect(noon.azimuthDeg).toBeCloseTo(180, 6);
    expect(noon.elevationDeg).toBeCloseTo(90 - 18.4447 - 8.37, 1);
    const set = sunAzEl(18.4447, -8.37, sunriseHourAngleDeg(18.4447, -8.37));
    expect(set.elevationDeg).toBeCloseTo(0, 6);
    expect(set.azimuthDeg).toBeGreaterThan(255); // west-southwest in autumn
    expect(set.azimuthDeg).toBeLessThan(265);
    expect(sunAzEl(18.4447, -8.37, -90).azimuthDeg).toBeLessThan(180); // morning: east
  });
});

describe('sol clock', () => {
  it('counts sols and splits each into 45 s of day and 15 s of night', () => {
    expect(solClock(0, sol, jezero.latitudeDeg)).toMatchObject({ sol: 1, isNight: false, phaseFraction: 0 });
    expect(solClock(44.9, sol, jezero.latitudeDeg).isNight).toBe(false);
    expect(solClock(45, sol, jezero.latitudeDeg)).toMatchObject({ sol: 1, isNight: true, phaseFraction: 0 });
    expect(solClock(60, sol, jezero.latitudeDeg)).toMatchObject({ sol: 2, isNight: false });
    expect(solClock(599, sol, jezero.latitudeDeg).sol).toBe(10);
    expect(solClock(600, sol, jezero.latitudeDeg).sol).toBe(10); // the mission end stays on the last sol
    expect(solClock(-5, sol, jezero.latitudeDeg).sol).toBe(1);
  });

  it('maps the day to real local solar time: sunrise, noon, sunset, midnight', () => {
    const at = (t: number) => solClock(t, sol, jezero.latitudeDeg);
    expect(at(22.5).localSolarHours).toBeCloseTo(12, 6);
    expect(at(0).localSolarHours).toBeCloseTo(12 - 87.2 / 15, 1);
    expect(at(45).localSolarHours).toBeCloseTo(12 + 87.2 / 15, 1);
    expect(at(52.5).localSolarHours).toBeCloseTo(0, 6);
    expect(at(10).sunSetting).toBe(false);
    expect(at(30).sunSetting).toBe(true);
    expect(at(50).sunSetting).toBe(false);
  });

  it('time-lapses the night about three times faster than the day', () => {
    const h0 = 87.2;
    const dayRate = (2 * h0) / 45;
    const nightRate = (360 - 2 * h0) / 15;
    expect(nightRate / dayRate).toBeGreaterThan(2.8);
    expect(nightRate / dayRate).toBeLessThan(3.5);
  });

  it('advances the season slowly', () => {
    const slow = { ...sol, solarLongitudeDegPerSol: 0.6 };
    expect(solClock(540, slow, jezero.latitudeDeg).declinationDeg).toBeLessThan(solClock(0, slow, jezero.latitudeDeg).declinationDeg - 1.5);
    expect(solClock(540, sol, jezero.latitudeDeg).declinationDeg).toBeCloseTo(solClock(0, sol, jezero.latitudeDeg).declinationDeg, 9);
  });

  it('reports each sunset and dawn once, and not the mission start or end', () => {
    expect(solEdge(44.9, 45.1, sol)).toBe('dusk');
    expect(solEdge(59.9, 60.1, sol)).toBe('dawn');
    expect(solEdge(45.1, 59.9, sol)).toBeNull();
    expect(solEdge(0, 0.1, sol)).toBeNull();
    expect(solEdge(599.9, 600, sol)).toBeNull();
    let dusks = 0;
    let dawns = 0;
    for (let t = 0; t < 600; t += 0.25) {
      const e = solEdge(t, t + 0.25, sol);
      if (e === 'dusk') dusks++;
      if (e === 'dawn') dawns++;
    }
    expect(dusks).toBe(10);
    expect(dawns).toBe(9);
  });
});

describe('Mars Sun on the sol clock', () => {
  const sun = (t: number) => marsSunAt(t, sol, jezero);

  it('rises at the start of each sol, peaks at noon, sets at dusk and is down all night', () => {
    expect(sun(0).elevationDeg).toBeCloseTo(0, 6);
    expect(sun(22.5).elevationDeg).toBeCloseTo(63.2, 0);
    expect(sun(22.5).azimuthDeg).toBeCloseTo(180, 6);
    expect(sun(45).elevationDeg).toBeCloseTo(0, 6);
    expect(sun(52.5).elevationDeg).toBeCloseTo(-80, 0);
    for (let t = 45.1; t < 60; t += 0.5) expect(sun(t).elevationDeg).toBeLessThan(0);
    for (let t = 0.1; t < 45; t += 0.5) expect(sun(t).elevationDeg).toBeGreaterThan(0);
    expect(sun(0).azimuthDeg).toBeGreaterThan(95); // rises east-southeast
    expect(sun(0).azimuthDeg).toBeLessThan(103);
  });

  it('moves smoothly, without jumps at sunrise or sunset', () => {
    let prev = sun(0);
    for (let t = 0.05; t <= 120; t += 0.05) {
      const cur = sun(t);
      const step = Math.acos(Math.min(1, prev.x * cur.x + prev.y * cur.y + prev.z * cur.z)) * (180 / Math.PI);
      expect(step).toBeLessThan(1.2); // deg per 0.05 s
      prev = cur;
    }
  });

  it('keeps the Sun low for a few seconds around sunset (blue sunset, twilight)', () => {
    let lowDay = 0;
    let twilight = 0;
    for (let t = 30; t < 60; t += 0.01) {
      const el = sun(t).elevationDeg;
      if (el > 0 && el < 5) lowDay += 0.01;
      if (el <= 0 && el > -8) twilight += 0.01;
    }
    expect(lowDay).toBeGreaterThan(3);
    expect(twilight).toBeGreaterThan(2.5);
  });

  it('returns a unit vector in the terrain frame (-z north, +x east)', () => {
    const s = sun(10);
    expect(Math.hypot(s.x, s.y, s.z)).toBeCloseTo(1, 9);
    expect(s.x).toBeGreaterThan(0); // morning Sun is east
    expect(sun(22.5).z).toBeGreaterThan(0); // noon Sun is south
  });
});
