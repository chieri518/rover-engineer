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
  /** The mission starts this many seconds after sunrise of sol 1 (the Sun about 15° up), not at sunrise. */
  startSecondsIntoDay?: number;
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

/**
 * Dust on the panels (data/mars/tuning.json `dust`). Owner B, provisional, for Chieri's review (Mars M8,
 * MS8). Rules: rules/dust.ts. Not on Tuning yet: step 2 adds `dust?: DustTuning` when it wires the energy step.
 */
export interface DustTuning {
  perSol: number; // share of a part's clean solar income lost per sol, times the part's dustRate
  stormMultiplier: number; // dust settles this many times as fast at full storm strength (scaled by the storm's intensity)
  minFactor: number; // the dust factor never falls below this: the panels keep this share of their clean income
  lessonLoss: number; // the dust lesson: dust has cut solar income by at least this share
  dustDevilCleanM: number; // a dust devil passing within this distance of the rover resets its dust factor to clean
  dustDevilSenseM: number; // a switched-on weather mast records a dust devil passing within this distance (Dust devil pass)
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

/**
 * Dust devils (data/mars/events.json `dustdevil`). Owner B, provisional, for Chieri's review (Mars M8,
 * MS8). Rules: rules/dust.ts. Not on EventsFile yet: step 2 adds `dustdevil?: DustDevilSpec`.
 */
export interface DustDevilSpec {
  everySols: number; // one dust devil in each run of this many sols, so on average one every everySols sols
  daySecondsWindow: [number, number]; // it forms at a random time this many seconds after a sunrise (by day only)
  lifeSeconds: number; // how long the column stands, moving in a straight line
  speedMps: number; // how fast the column moves
  maxPassM: number; // it passes the rover's position at its forming time at a random distance up to this
  rampSeconds: number; // it builds up after it forms and dies down before it ends (for the renderer)
  radiusM: number; // the column's radius (for the renderer)
  heightM: number; // the column's height (for the renderer)
  source: string;
}

/** One scheduled dust devil, drawn before the mission; placed relative to the rover when it forms. */
export interface DustDevilSlot {
  at: number; // mission seconds when it forms
  passM: number; // closest approach to the rover's position at `at`, metres
  headingDeg: number; // direction of travel, degrees from −z (north) toward +x (east), as for the Sun's azimuth
  side: 1 | -1; // which side of the rover's position it passes (1 = to the right of its travel)
}

/** A dust devil placed on the map: a column moving in a straight line from `start` at `velocity`. */
export interface DustDevil {
  at: number; // mission seconds when it forms
  endAt: number; // and when it is gone
  start: Point; // position at `at`
  velocity: Point; // metres per second in the x-z plane
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
  /** Display names for terrain.json site names (the pipeline keeps them ASCII), e.g. "Seitah" → "Séítah". */
  siteNames?: Record<string, string>;
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
  /** Campaign and screens (M4): the Moon → Mars transition on the design, ticket and landing screens. */
  campaign: MarsCampaignText;
  /** Per-world part wording, by part id: replaces the shared name or description (rules/merge.ts withPartText). */
  partText?: Record<string, { name?: string; description?: string }>;
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
