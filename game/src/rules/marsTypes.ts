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
  solarLongitudeDeg: number; // season (Ls); sets the solar declination for the Sun path
}

/** Night: lights on or sleep, and the map-wide night cold. Owner: rules (M3). */
export interface NightTuning {
  lightsDrainPerSecond: number; // lights on at night: battery drain on top of driving
  sleepDrainPerSecond: number; // powered down (P) at night
  driveWithoutLights: boolean; // design: false, a rover without lights cannot drive at night
  freezeRatePerSecond: number; // night-wide freezing without a heater (heaterReductionPerHeat from tuning.cold applies)
  warmRecoveryPerSecond: number; // freeze meter recovery by day
}

// ---------------------------------------------------------------------------------------------------
// Events (data/mars/events.json). Owner: rules (M3).

/** One regional dust storm per mission, forecast a sol ahead. */
export interface DustStormSpec {
  windowsSeconds: [number, number][]; // the storm starts at a random time inside each window
  warningSeconds: number; // forecast lead time (one sol)
  durationSeconds: number;
  solarFactor: number; // solar income multiplier during the storm
  freezeFactor: number; // night freezing multiplier during the storm (milder nights)
  source: string;
}

// ---------------------------------------------------------------------------------------------------
// Milestone triggers. Owner: milestones and survey (M5). Unknown triggers are simply never reached.

export type MarsMilestoneTrigger =
  | { type: 'night-distance'; meters: number[] } // driven at night, one reward per threshold
  | { type: 'storm-survive' }; // still running when the dust storm clears

/** Mars zone ids that milestones.json triggers may name (M5 builds the zones). */
export type MarsZoneId = 'delta-front' | 'delta-layers' | 'seitah' | 'sunset-viewpoint';

// ---------------------------------------------------------------------------------------------------
// Text sections (data/mars/text.json). Owners: integration (M6) for night and storm notices,
// campaign and screens (M4) for the rest. Strings marked [placeholder] are stubs.

export interface MarsTextSections {
  sol: Record<'hudSol' | 'lasted', string>;
  night: Record<'sunset' | 'dawn' | 'sleeping' | 'noLights' | 'lightsOn', string>;
  storm: Record<'forecast' | 'started' | 'cleared' | 'credit', string>;
  /** Campaign and screens (M4): the Moon → Mars transition on the design, ticket and landing screens. */
  campaign: MarsCampaignText;
}

export interface MarsCampaignText {
  kicker: string; // design screen, above the heading: which mission this is
  carryOver: string; // {balance}: the balance carried over from the Moon
  passMark: string; // {minimum}: the next mission's pass mark (Titan)
  sameParts: string; // parts and ticket tiers are the Moon's for now
  ticketNote: string; // ticket screen: same tiers as the Moon
  perseverance: string; // landing: {distance} km {direction} to Perseverance's landing site
  newHeading: string; // landing: "New on Mars"
  newOnMars: string[]; // landing: one line per new constraint, {placeholders} from the Mars data
  sourcesLabel: string; // credits: label for the landing briefing's sources
  sources: string; // sources for the real facts in the landing briefing
}
