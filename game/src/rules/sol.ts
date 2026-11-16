// The Mars sol clock: 10 sols of 60 s, each 45 s of day (sunrise to sunset) then 15 s of night,
// mapped to real local true solar time at the site for the season (Ls). Night is time-lapsed about
// three times faster than day. Pure.
//
// Real geometry: the solar declination comes from Mars's obliquity, sin(δ) = sin(25.19°) sin(Ls)
// (Allison & McEwen 2000, the Mars24 algorithm, without its 0.25° sin(Ls) correction), and the sunrise
// hour angle from the latitude, cos(H0) = −tan(φ) tan(δ). Game time runs from H = −H0 (sunrise) to
// +H0 (sunset) over the day and on round to 360° − H0 over the night. Within each half the hour angle
// follows a smooth cubic warp, so the Sun moves slower near the horizon (longer sunsets) and faster at
// noon and midnight; its speed is continuous at sunrise and sunset.
//
// The mission starts in the morning, not at sunrise: SolTuning.startSecondsIntoDay shifts the clock so
// that mission time 0 is that far into the first day (the Sun about 15° up at Jezero). Each sol still
// has 45 s of day and 15 s of night; the first sol is shorter by the shift, and the mission ends that
// many seconds after the tenth night's dawn. Sol numbers change at dawn.
import type { SolTuning } from './marsTypes';

const DEG = Math.PI / 180;
/** Mars's obliquity (axial tilt), degrees. */
export const MARS_OBLIQUITY_DEG = 25.19;

/**
 * Titan's obliquity to the Sun, degrees: Titan orbits in Saturn's equatorial plane with its axis about
 * normal to it, so its seasons follow Saturn's tilt (26.73°, NASA Saturn fact sheet).
 */
export const TITAN_OBLIQUITY_DEG = 26.73;

/** Solar declination at solar longitude Ls for a planet with this obliquity, degrees: sin δ = sin ε sin Ls. */
export function solarDeclinationDeg(solarLongitudeDeg: number, obliquityDeg: number): number {
  return Math.asin(Math.sin(obliquityDeg * DEG) * Math.sin(solarLongitudeDeg * DEG)) / DEG;
}

/** Solar declination on Mars at solar longitude Ls, degrees. */
export function marsSolarDeclinationDeg(solarLongitudeDeg: number): number {
  return solarDeclinationDeg(solarLongitudeDeg, MARS_OBLIQUITY_DEG);
}

/** Hour angle of sunrise and sunset (Sun's centre on the horizon), degrees. 180 = polar day, 0 = polar night. */
export function sunriseHourAngleDeg(latitudeDeg: number, declinationDeg: number): number {
  const c = -Math.tan(latitudeDeg * DEG) * Math.tan(declinationDeg * DEG);
  return Math.acos(Math.min(1, Math.max(-1, c))) / DEG;
}

/** Clock time for mission time `seconds`: 0 is sunrise of sol 1, and the mission starts startSecondsIntoDay later. */
export function solClockSeconds(seconds: number, sol: SolTuning): number {
  return Math.max(0, seconds) + Math.max(0, sol.startSecondsIntoDay ?? 0);
}

/** The season (Ls) after `seconds` of play: the start value advanced by solarLongitudeDegPerSol each sol. */
export function solarLongitudeAt(seconds: number, sol: SolTuning): number {
  return sol.solarLongitudeDeg + (sol.solarLongitudeDegPerSol ?? 0) * (Math.max(0, seconds) / sol.secondsPerSol);
}

export interface SolState {
  sol: number; // 1-based, capped at sol.sols
  secondsIntoSol: number;
  isNight: boolean;
  phaseFraction: number; // 0..1 through the current day (sunrise → sunset) or night (sunset → sunrise)
  hourAngleDeg: number; // local hour angle of the Sun, 0 = noon, −180..180
  localSolarHours: number; // local true solar time, 0..24 (12 = noon)
  sunSetting: boolean; // day and after local noon
  declinationDeg: number;
}

/**
 * Cubic warp of u in [−1, 1]: odd, w(±1) = ±1, slope `edge` at ±1 and (3 − edge) / 2 at 0. Monotonic
 * for edge in [0, 3].
 */
function warp(u: number, edge: number): number {
  const a = (3 - edge) / 2;
  return a * u + (1 - a) * u * u * u;
}

/**
 * The sol clock after `seconds` of play. Mission time 0 is startSecondsIntoDay after sunrise of sol 1.
 * Needs the site latitude for the real day length, and the world's obliquity for the season (Mars by
 * default; Titan passes TITAN_OBLIQUITY_DEG, its one day is a single "sol" of 900 s).
 */
export function solClock(seconds: number, sol: SolTuning, latitudeDeg: number, obliquityDeg = MARS_OBLIQUITY_DEG): SolState {
  const t = solClockSeconds(seconds, sol);
  const clockIndex = Math.floor(t / sol.secondsPerSol);
  const index = Math.min(clockIndex, sol.sols - 1); // the mission's last seconds (the dawn after the last night) stay on the last sol
  const into = t - clockIndex * sol.secondsPerSol;
  const declinationDeg = solarDeclinationDeg(solarLongitudeAt(t, sol), obliquityDeg);
  const h0 = sunriseHourAngleDeg(latitudeDeg, declinationDeg);
  const nightSpan = 360 - 2 * h0;

  // Sun speed at the horizon (degrees of hour angle per second), shared by both halves.
  const share = Math.min(Math.max(sol.horizonRateShare ?? 1, 0), 3);
  const dayMeanRate = (2 * h0) / sol.daySeconds;
  const edgeRate = share * dayMeanRate;
  const nightMeanRate = nightSpan / sol.nightSeconds;
  const nightEdge = nightMeanRate > 0 ? Math.min(3, edgeRate / nightMeanRate) : 1;

  const isNight = into >= sol.daySeconds;
  let hourAngle: number;
  let phaseFraction: number;
  if (!isNight) {
    phaseFraction = into / sol.daySeconds;
    hourAngle = h0 * warp(2 * phaseFraction - 1, share);
  } else {
    phaseFraction = (into - sol.daySeconds) / sol.nightSeconds;
    hourAngle = 180 + (nightSpan / 2) * warp(2 * phaseFraction - 1, nightEdge);
  }
  const wrapped = ((hourAngle + 180) % 360 + 360) % 360 - 180;
  const localSolarHours = (((12 + hourAngle / 15) % 24) + 24) % 24;
  return {
    sol: index + 1,
    secondsIntoSol: into,
    isNight,
    phaseFraction,
    hourAngleDeg: wrapped,
    localSolarHours,
    sunSetting: !isNight && hourAngle > 0,
    declinationDeg,
  };
}

export type SolEdge = 'dawn' | 'dusk';

/** The sunrise or sunset crossed between two mission times (prev < edge ≤ now), or null. Mission start is not a dawn. */
export function solEdge(prevMissionSeconds: number, missionSeconds: number, sol: SolTuning): SolEdge | null {
  if (missionSeconds <= prevMissionSeconds) return null;
  const shift = solClockSeconds(0, sol);
  const prevSeconds = prevMissionSeconds + shift;
  const seconds = missionSeconds + shift;
  const last = sol.sols * sol.secondsPerSol + shift; // the mission end, in clock time
  for (let k = Math.floor(prevSeconds / sol.secondsPerSol); k * sol.secondsPerSol <= seconds; k++) {
    const dusk = k * sol.secondsPerSol + sol.daySeconds;
    if (prevSeconds < dusk && dusk <= seconds && dusk < last) return 'dusk';
    const dawn = (k + 1) * sol.secondsPerSol;
    if (prevSeconds < dawn && dawn <= seconds && dawn < last) return 'dawn';
  }
  return null;
}
