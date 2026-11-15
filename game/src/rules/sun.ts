// Where the Sun and Earth are in the sky during the Moon mission. Pure math, no rendering.
// Frame and formulas follow public/terrain/terrain.json: azimuth from local -z, turning toward +x;
// direction = (sin az, -cos az) on the ground. The HUD has no clock: this is how time shows.
import type { SunTuning, Tuning } from './types';

const DEG = Math.PI / 180;

export interface SkyDirection {
  azimuthDeg: number; // 0..360
  elevationDeg: number;
  /** Unit vector toward the body in the local frame (x east-ish, y up, z). */
  x: number;
  y: number;
  z: number;
}

export function skyDirection(azimuthDeg: number, elevationDeg: number): SkyDirection {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return {
    azimuthDeg: ((azimuthDeg % 360) + 360) % 360,
    elevationDeg,
    x: Math.cos(el) * Math.sin(az),
    y: Math.sin(el),
    z: -Math.cos(el) * Math.cos(az),
  };
}

/** Earth days of game time that have passed after `seconds` of play. */
export function gameDaysElapsed(seconds: number, mission: Tuning['mission']): number {
  const t = Math.min(Math.max(seconds, 0), mission.lengthSeconds);
  return (t / mission.lengthSeconds) * mission.gameDays;
}

/**
 * The Sun after `seconds` of play. Its azimuth is the subsolar longitude, which falls about 12.19° per
 * Earth day; its elevation comes from the site latitude and longitude:
 * sin(el) = sin(lat) sin(subLat) + cos(lat) cos(subLat) cos(subLon − lon).
 */
export function sunAt(
  seconds: number,
  sun: SunTuning,
  mission: Tuning['mission'],
  site: { latitudeDeg: number; longitudeDeg: number },
): SkyDirection {
  const azimuth = sun.startAzimuthDeg - sun.degreesPerEarthDay * gameDaysElapsed(seconds, mission);
  const lat = site.latitudeDeg * DEG;
  const subLat = sun.subsolarLatitudeDeg * DEG;
  const sinEl =
    Math.sin(lat) * Math.sin(subLat) +
    Math.cos(lat) * Math.cos(subLat) * Math.cos((azimuth - site.longitudeDeg) * DEG);
  return skyDirection(azimuth, Math.asin(sinEl) / DEG);
}

/**
 * Share of Earth's disc that is sunlit as seen from the Moon (its phase): (1 − cos E) / 2, where E is the
 * angle between the Sun and Earth. 0 = new Earth (Sun behind Earth), 1 = full Earth (Sun behind the viewer).
 */
export function earthLitShare(sun: SkyDirection, earth: SkyDirection): number {
  const cosE = sun.x * earth.x + sun.y * earth.y + sun.z * earth.z;
  return (1 - Math.min(1, Math.max(-1, cosE))) / 2;
}

/** Total Sun azimuth swept over a full mission, in degrees. */
export function sunSweepDeg(sun: SunTuning, mission: Tuning['mission']): number {
  return sun.degreesPerEarthDay * mission.gameDays;
}
