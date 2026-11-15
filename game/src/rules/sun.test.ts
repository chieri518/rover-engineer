import { describe, expect, it } from 'vitest';
import { gameDaysElapsed, skyDirection, sunAt, sunSweepDeg } from './sun';
import { testTuning } from './testData';

const site = { latitudeDeg: -88.5378, longitudeDeg: -67.6065 };
const { sun, mission } = testTuning;

describe('sun', () => {
  it('starts at the start azimuth and sweeps gameDays × degreesPerEarthDay, decreasing', () => {
    expect(sunAt(0, sun, mission, site).azimuthDeg).toBeCloseTo(sun.startAzimuthDeg, 6);
    const end = sunAt(mission.lengthSeconds, sun, mission, site);
    const expected = (((sun.startAzimuthDeg - sunSweepDeg(sun, mission)) % 360) + 360) % 360;
    expect(end.azimuthDeg).toBeCloseTo(expected, 6);
    expect(sunSweepDeg(sun, mission)).toBeCloseTo(168, 6);
  });

  it('stops moving after the mission length', () => {
    expect(sunAt(mission.lengthSeconds + 50, sun, mission, site).azimuthDeg).toBeCloseTo(
      sunAt(mission.lengthSeconds, sun, mission, site).azimuthDeg,
      9,
    );
    expect(gameDaysElapsed(mission.lengthSeconds / 2, mission)).toBeCloseTo(7, 9);
  });

  it('stays within a few degrees of the horizon at the pole, highest opposite the pole', () => {
    for (let t = 0; t <= mission.lengthSeconds; t += 10) {
      const s = sunAt(t, sun, mission, site);
      // Small-angle form from terrain.json: el ≈ −subLat + 1.46 cos(az − lon)
      const approx = -sun.subsolarLatitudeDeg + 1.46 * Math.cos(((s.azimuthDeg - site.longitudeDeg) * Math.PI) / 180);
      expect(s.elevationDeg).toBeCloseTo(approx, 1);
      expect(Math.abs(s.elevationDeg)).toBeLessThan(3.1);
    }
  });

  it('gives unit direction vectors in the terrain frame', () => {
    const north = skyDirection(0, 0);
    expect(north.z).toBeCloseTo(-1, 9);
    const east = skyDirection(90, 0);
    expect(east.x).toBeCloseTo(1, 9);
    const d = sunAt(123, sun, mission, site);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9);
  });
});
