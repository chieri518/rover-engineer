// The real Sun at the Mars site on the sol clock (rules/sol.ts), as a SkyDirection like the lunar
// rules/sun.ts, so the scene and the sun masks work unchanged. Mars terrain.json: local −z is north,
// +x east, azimuth from −z toward +x. Pure.
//
// sin(el) = sin(φ) sin(δ) + cos(φ) cos(δ) cos(H)
// azimuth (from north, toward east) = 180° + atan2(sin H, cos H sin φ − tan δ cos φ)
import type { SolTuning } from './marsTypes';
import { skyDirection, type SkyDirection } from './sun';
import { solClock } from './sol';

const DEG = Math.PI / 180;

/** Sun azimuth and elevation from latitude, declination and hour angle (all degrees). */
export function sunAzEl(latitudeDeg: number, declinationDeg: number, hourAngleDeg: number): { azimuthDeg: number; elevationDeg: number } {
  const lat = latitudeDeg * DEG;
  const dec = declinationDeg * DEG;
  const h = hourAngleDeg * DEG;
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
  const az = 180 + Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) / DEG;
  return { azimuthDeg: ((az % 360) + 360) % 360, elevationDeg: Math.asin(Math.min(1, Math.max(-1, sinEl))) / DEG };
}

/** The Sun at the Mars site after `seconds` of play. Elevation goes below 0 at night. */
export function marsSunAt(seconds: number, sol: SolTuning, site: { latitudeDeg: number; longitudeDeg: number }): SkyDirection {
  const clock = solClock(seconds, sol, site.latitudeDeg);
  const { azimuthDeg, elevationDeg } = sunAzEl(site.latitudeDeg, clock.declinationDeg, clock.hourAngleDeg);
  return skyDirection(azimuthDeg, elevationDeg);
}
