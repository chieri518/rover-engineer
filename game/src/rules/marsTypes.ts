// Types for the Mars mission: the Mars terrain features (public/terrain/mars/terrain.json, agreed with
// the pipeline, see mars-build-log.md) and the Mars-only sections of the data files in data/mars/.
// Kept apart from types.ts so the Mars tracks can grow their own sections without all editing one file.
// Each section names the track that owns it; values in data/mars/*.json marked "_placeholder" are stubs.

interface Point { x: number; z: number }
interface Point3 { x: number; y: number; z: number }

// ---------------------------------------------------------------------------------------------------
// Terrain features (Mars terrain.json `features`). Owner: pipeline (M1) writes them, spine (M0) types them.

/** A named point on the Mars terrain. Every position cites where the real feature is. */
export interface MarsSite {
  name: string;
  local: Point3;
  latLon: [number, number];
  elevation_m: number;
  slope_deg: number;
  distanceFromLanding_m: number;
  driveDistanceFromLanding_m: number;
  source: string;
}

export type MarsViewpointKind = 'deltaLayers' | 'sunset';

export interface MarsViewpoint extends MarsSite {
  kind: MarsViewpointKind;
  lookToward: Point; // unit vector in the local x-z plane
  lookTarget?: Point3;
}

export interface MarsTerrainFeatures {
  /** The ancient river delta's front: layered cliffs that record the lake. */
  deltaFront: {
    name: string;
    description: string;
    scarpLocal_xz: [number, number][]; // polyline along the base of the front
    zoneRadius_m: number; // within this distance of the polyline counts as "at the delta front"
    samplePoint: MarsSite; // a drivable spot at the base, for the delta drill sample
    source: string;
  };
  /** Séítah: a ridged rock unit with sand ripples (soft ground). */
  seitah: {
    name: string;
    description: string;
    outlineLocal_xz: [number, number][]; // closed polygon
    centroidLocal: Point;
    area_km2: number;
    entryPoint: MarsSite; // nearest drivable edge from the landing
    source: string;
  };
  /** Circle approximations of the sand-ripple fields, for the circle-based softness rule (rules/ground.ts). */
  softGround: {
    description: string;
    areas: { name: string; local: Point; radius_m: number }[];
  };
  rockyAreas: { name: string; local: Point3; radius_m: number; slopeExcess_deg?: number; description?: string; source?: string }[];
  viewpoints: MarsViewpoint[];
  /** Perseverance's 2021 landing site, a landmark only (the player's lander does not land on it). */
  perseveranceLanding: { name: string; local: Point; latLon: [number, number]; source: string };
  notes?: string[];
}

// ---------------------------------------------------------------------------------------------------
// Tuning sections (data/mars/tuning.json). Optional on Tuning: only Mars has them.

/** The sol clock. Owner: rules (M3). Decided: 10 sols of 60 s, 45 s day then 15 s night. */
export interface SolTuning {
  sols: number;
  secondsPerSol: number;
  daySeconds: number; // dawn to dusk
  nightSeconds: number; // dusk to dawn, time-lapsed faster than the day
  solarLongitudeDeg: number; // season (Ls) at the start; sets the solar declination for the Sun path
  solarLongitudeDegPerSol?: number; // how fast the season advances (about 0.6 deg per sol near Ls 200)
  /** The Sun's speed at sunrise and sunset as a share of its mean day speed (1 = uniform; lower = longer low-Sun light). */
  horizonRateShare?: number;
}

/** Night: lights on or sleep, and the map-wide night cold. Owner: rules (M3). */
export interface NightTuning {
  lightsDrainPerSecond: number; // awake at night with lights on (lights, electronics): battery drain on top of driving
  awakeDrainPerSecond: number; // awake at night without lights (electronics only): the rover cannot drive
  sleepDrainPerSecond: number; // powered down (P) at night
  driveWithoutLights: boolean; // design: false, a rover without lights cannot drive at night
  freezeRatePerSecond: number; // night-wide freezing without a heater (heaterReductionPerHeat from tuning.cold applies)
  warmRecoveryPerSecond: number; // freeze meter recovery by day
  /** Solar panels give their full rate with the Sun at or above this elevation, less below (sin el / sin this). 0 = off. */
  fullSunElevationDeg: number;
}

// ---------------------------------------------------------------------------------------------------
// Events (data/mars/events.json). Owner: rules (M3).

/** One regional dust storm per mission, forecast a sol ahead. */
export interface DustStormSpec {
  windowsSeconds: [number, number][]; // the storm starts at a random time inside each window
  warningSeconds: number; // forecast lead time (one sol)
  durationSeconds: number;
  rampSeconds: number; // the storm builds up over this long after it starts and dies down over this long before it ends
  solarFactor: number; // solar income multiplier during the storm
  freezeFactor: number; // night freezing multiplier during the storm (milder nights)
  source: string;
}

// ---------------------------------------------------------------------------------------------------
// Milestone triggers. Owner: milestones and survey (M5). Unknown triggers are simply never reached.

export type MarsMilestoneTrigger =
  | { type: 'night-distance'; meters: number[] } // driven at night, one reward per threshold
  | { type: 'storm-survive' }; // still running when the dust storm clears

/** Mars zone ids that milestones.json triggers may name (rules/milestones.ts buildZones). */
export type MarsZoneId = 'delta-front' | 'delta-layers' | 'seitah' | 'sunset-viewpoint';

/** Mars-only milestone tuning (data/mars/tuning.json `milestones`), merged over the shared MilestoneTuning. */
export interface MarsMilestoneTuning {
  sunsetMinElevationDeg: number; // Blue sunset: the Sun's center at least this high (and not hidden by terrain)...
  sunsetMaxElevationDeg: number; // ...and at most this high, while setting (after local noon)
  sunsetPhotoMinDistanceM: number; // ...taken at least this far from the landing point (sunset is in view from the lander every sol)
}

/** Mars-only instrument notices (data/mars/text.json `instruments`); absent on the Moon. */
export interface MarsInstrumentText {
  sunsetHint?: string; // the setting Sun is low and in frame: press C
  sunsetTooClose?: string; // {distance} {min}
  sunsetTooHigh?: string; // the Sun is in frame but not yet low
  captionSunset?: string;
}

/** Mars-only survey and minimap legend text (data/mars/text.json `survey`); absent on the Moon. */
export interface MarsSurveyText {
  legendRocky?: string; // replaces the Moon's "Crater" legend for rocky-area rings
  legendDelta?: string;
  legendRegion?: string; // Séítah's outline
}

// ---------------------------------------------------------------------------------------------------
// Text sections (data/mars/text.json). Owners: integration (M6) for night and storm notices,
// campaign and screens (M4) for the rest. Strings marked [placeholder] are stubs.

export interface MarsTextSections {
  instruments: MarsInstrumentText; // M5
  survey: MarsSurveyText; // M5
  sol: Record<'hudSol' | 'lasted', string>;
  night: Record<'sunset' | 'dawn' | 'sleeping' | 'noLights' | 'lightsOn', string>;
  storm: Record<'forecast' | 'started' | 'cleared' | 'credit', string>;
}
