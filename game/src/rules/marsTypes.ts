// Types for the Mars mission: the Mars terrain features (public/terrain/mars/terrain.json, agreed with
// the pipeline, see mars-build-log.md) and the Mars-only sections of the data files in data/mars/.
// Kept apart from types.ts so the Mars tracks can grow their own sections without all editing one file.
// Each section names the track that owns it; values in data/mars/*.json marked "_placeholder" are stubs.

import type { Instrument, SupportSlot } from './types';

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
    footContour_m?: number;
    footNear?: MarsDeltaFoot; // MP3
    floodBoulder?: MarsFloodBoulder; // MP3
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
  // The Mars sites lists (game/tools/mars_sites.py, Mars sites plan MP1 to MP4 and MP6). Optional: the
  // game loads without them, and data/mars/sites.json keeps a `local` stand-in for each place it reads.
  youngCraters?: MarsYoungCrater[]; // MP1
  slopeTargets?: MarsSlopeTargets[]; // MP2
  perseveranceSites?: MarsPerseveranceSite[]; // MP4
  missionLandmarks?: MarsMissionLandmark[]; // MP6
  notes?: string[];
}

/** MP3: the delta foot, deltaFront.footNear: the nearest 400 m of the scarp-foot line to the landing. */
export interface MarsDeltaFoot {
  name: string;
  description: string;
  lineLocal_xz: [number, number][]; // the foot line, nearest end first
  length_m: number;
  zoneRadius_m: number; // the pipeline's zone; the game's is tuning.milestones.deltaFootRadiusM
  nearestPoint: Omit<MarsSite, 'source'>; // the foot line's point nearest the landing
  lineDistanceFromLanding_m: [number, number];
  zoneMinDistanceFromLanding_m: number;
  driveDistanceFromLanding_m: number;
  drivePoint: Point;
  source: string;
}

/** MP3: the flood boulder, deltaFront.floodBoulder. Placed by design on the delta foot's lower slope. */
export interface MarsFloodBoulder {
  name: string;
  local: Point3;
  latLon: [number, number];
  diameter_m: number;
  slope_deg: number;
  downhill: Point; // unit vector down the slope
  faceSlopes_deg: { uphill: number; left: number; right: number; downhillWithin3m: number };
  readingSpot: Point & { slope_deg: number }; // the level ground on its downhill side
  distanceFromLanding_m: number;
  distanceFromFootLine_m: number;
  driveDistanceFromLanding_m: number;
  source: string;
}

/** MP1: a crater 80 to 400 m across within 1.6 km. `freshness` 'fresh': a round, raised, blocky rim (25 cm HiRISE). */
export interface MarsYoungCrater {
  id: string;
  name: string;
  local: Point3;
  latLon: [number, number];
  elevation_m: number;
  slope_deg: number;
  distanceFromLanding_m: number;
  radius_m: number; // rim crest
  diameter_m: number;
  diameterRange_m: [number, number];
  depth_m: number;
  depthToDiameter: number;
  rimCompleteness: number;
  rimUplift_m: number;
  innerWallSlope_deg: number;
  innerWallSlopeMax_deg: number;
  rimBoulderShadowsPerHa: number;
  backgroundBoulderShadowsPerHa: number;
  rimBlockRatio: number;
  freshness: 'fresh' | 'subdued';
  steepestWallSide: string;
  lowestRimSide: string;
  blockiestRimSide: string;
  driveDistanceFromLanding_m: number; // to the cheapest rim cell (drivePoint)
  drivePoint: Point;
  floorDriveDistance_m: number | null; // to the center; null if the floor cannot be reached under 18°
  rockyArea?: string; // the rockyAreas feature it is (Rocky area 2)
}

/** MP2: 10 to 18° cells beside ground under 8°, grouped per site (the 4 largest patches). */
export interface MarsSlopeTargets {
  id: string;
  site: string; // a youngCraters id, a knob id (knob-wnw, knob-ssw) or delta-foot
  siteKind: 'youngCrater' | 'knob' | 'deltaFoot';
  name: string;
  cellCount: number;
  patchCount: number;
  patches: {
    local: Point; // the target cell nearest the patch center
    slope_deg: number;
    cells: number;
    slopeMean_deg: number;
    slopeMax_deg: number;
    levelCell: Point & { slope_deg: number }; // its level neighbor
    driveDistanceFromLanding_m: number;
  }[];
  searchRadius_m?: number;
}

/** MP4: a rock Perseverance abraded and sampled within 1.6 km (a landmark and fact anchor; names to fact-check). */
export interface MarsPerseveranceSite {
  id: string;
  name: string;
  local: Point3;
  latLon: [number, number];
  elevation_m: number;
  slope_deg: number;
  distanceFromLanding_m: number;
  driveDistanceFromLanding_m: number;
  kind: 'sample' | 'sample-attempt';
  abrasion?: string;
  samples: { name: string; sol: number | null; date: string; note?: string }[];
  waypoint: { sol: number; rmc: string };
  roverStayedSols: [number, number];
  source: string;
}

/** MP6: Wright Brothers Field (approximate). Not a site: nothing on the ground to see (MS12). */
export interface MarsMissionLandmark {
  id: string;
  name: string;
  local: Point3;
  latLon: [number, number];
  distanceFromLanding_m: number;
  driveDistanceFromLanding_m: number;
  kind: string;
  note?: string;
  source: string;
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
  /** Titan: a "sunset soon" notice this many seconds before the first sunset (absent: no notice). */
  sunsetWarningSeconds?: number;
}

/** Night: lights on or sleep, and the map-wide night cold. Owner: rules (M3). */
export interface NightTuning {
  awakeDrainPerSecond: number; // the electronics awake at night: battery drain on top of driving (the lights and heater draws are the parts', rules/energy.ts nightDraw)
  sleepDrainPerSecond: number; // the electronics powered down (P) at night
  /** Titan only (rules/titan.ts titanDrainPerSecond): the whole awake-at-night drain with the lights on. Mars uses the parts' lightsDraw instead. */
  lightsDrainPerSecond?: number;
  driveWithoutLights: boolean; // design: false, a rover without lights cannot drive at night
  freezeRatePerSecond: number; // night-wide freezing without a heater (heaterReductionPerHeat from tuning.cold applies)
  warmRecoveryPerSecond: number; // freeze meter recovery by day
  /** Solar panels give their full rate with the Sun at or above this elevation, less below (sin el / sin this). 0 = off. */
  fullSunElevationDeg: number;
}

/**
 * Dust on the panels (data/mars/tuning.json `dust`). Owner B, provisional, for Chieri's review (Mars M8,
 * MS8). Rules: rules/dust.ts; Tuning.dust, wired into the energy step (rules/mission.ts).
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
 * MS8). Rules: rules/dust.ts; EventsFile.dustdevil, scheduled in rules/mission.ts marsSetup.
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

/**
 * Mars zone ids that Mars milestones.json triggers may name (validate.ts checks them per world): Mars's
 * own (the delta front, the delta-layers and sunset viewpoints, Séítah, and the delta foot, Mars sites
 * plan MS5), and the shared ids Mars also builds: the near-lander zone, the rocky areas' boulder fields,
 * the young craters' ejecta rings and the hidden hydrated ground (the Moon's `young-crater` and
 * `hydrogen-anomaly`, from data/mars/sites.json). `delta-foot` is built by rules/milestones.ts buildZones
 * (within tuning.milestones.deltaFootRadiusM of terrain.json deltaFront.footNear's line).
 */
export const MARS_ZONE_IDS = [
  'delta-front', 'delta-layers', 'seitah', 'sunset-viewpoint', 'delta-foot',
  'near-lander', 'boulder-field', 'young-crater', 'hydrogen-anomaly',
] as const;
export type MarsZoneId = (typeof MARS_ZONE_IDS)[number];

/**
 * The six Mars rock types (game-design.md, Mars rock types; MS10). Names and readouts in data/mars/text.json
 * `rocks`; suites by site in data/mars/tuning.json instruments.xray.suites. Flood conglomerate is the rare
 * rock, only at the flood boulder (placed by design).
 */
export const MARS_ROCK_IDS = [
  'maaz-basalt', 'salt-veined-basalt', 'olivine-cumulate', 'carbonate-olivine-rock', 'lake-mudstone', 'flood-conglomerate',
] as const;
export type MarsRockId = (typeof MARS_ROCK_IDS)[number];

/** Mars-only milestone tuning (data/mars/tuning.json `milestones`), merged over the shared MilestoneTuning. */
export interface MarsMilestoneTuning {
  sunsetMinElevationDeg: number; // Blue sunset: the Sun's center at least this high (and not hidden by terrain)...
  sunsetMaxElevationDeg: number; // ...and at most this high, while setting (after local noon)
  sunsetPhotoMinDistanceM: number; // ...taken at least this far from the landing point (sunset is in view from the lander every sol)
  /** The delta-foot zone (Signs of an ancient lake, Lake organics, Rock from afar): within this of terrain.json deltaFront.footNear's line. */
  deltaFootRadiusM: number;
  /** Crater wall: a young crater's center in frame, the rover between these multiples of the crater's radius from it. */
  craterWallRimBand: [number, number];
  /** Dust devil: the devil in frame within this distance of the rover. Absent: any devil in frame counts (the design's rule). */
  dustDevilPhotoRangeM?: number;
}

/** Mars-only instrument notices (data/mars/text.json `instruments`); absent on the Moon. */
export interface MarsInstrumentText {
  sunsetHint?: string; // the setting Sun is low and in frame: press C
  sunsetTooClose?: string; // {distance} {min}
  sunsetTooHigh?: string; // the Sun is in frame but not yet low
  captionSunset?: string;
  captionCraterWall?: string; // {name}: the crater whose inner wall a Crater wall photo shows (Mars step 6b)
  captionDustDevil?: string; // a dust devil in the photo (Mars step 6b)
}

/** Mars-only survey and minimap legend text (data/mars/text.json `survey`); absent on the Moon. */
export interface MarsSurveyText {
  legendRocky?: string; // replaces the Moon's "Crater" legend for rocky-area rings
  legendDelta?: string;
  legendRegion?: string; // Séítah's outline
  /** Display names for terrain.json site names (the pipeline keeps them ASCII), e.g. "Seitah" → "Séítah". */
  siteNames?: Record<string, string>;
  // Mars step 6c: the new site kinds' legend entries (each shows once such a site is on the map).
  legendKnob?: string;
  legendSeitahEdge?: string;
  legendDeltaFoot?: string;
  legendFloodBoulder?: string;
  /** Under a lead arrow's number on the minimap: {distance} in km from the rover. */
  leadDistance?: string;
  /** By sites.json id, then instrument: a site's own line, before its kind's siteLines (Rocky area 2's crater wall). */
  siteLinesById?: Record<string, Partial<Record<Instrument, string>>>;
  /**
   * The terrain features with no sites.json id (Séítah, the delta front, the viewpoints, Perseverance's
   * landing site), by survey site key: the note after "Located: {name}, " and what each instrument aboard
   * can do there. Lesson-blind, like the site lines.
   */
  featureNotes?: Record<string, string>;
  featureLines?: Record<string, Partial<Record<Instrument, string>>>;
}

/**
 * Mars HUD lines (data/mars/text.json `hudMars`, Mars step 6c; ui/hudText.ts). The power line replaces the
 * Moon's "Solar panel in sunlight" on Mars, so a rover without panels never reads it: solar states, the
 * dust factor ({loss} percent), a steady source. The weather mast's recording state: {event}, {seconds},
 * {total}. The crater wall hint: {key}.
 */
export interface MarsHudText {
  solarSun: string;
  solarLowSun: string;
  solarShadow: string;
  solarStorm: string;
  solarNight: string;
  dust: string; // {loss}
  steady: string; // a rover with only a steady source
  steadyToo: string; // appended when a solar rover also has a steady source
  none: string; // no power income at all
  join: string;
  recording: string; // {event} {seconds} {total}
  recordingPaused: string; // {event} {seconds} {total}: counted but paused (near the lander)
  recordEvents: Partial<Record<'duststorm' | 'night', string>>;
  craterWallHint: string; // {key}
}

// ---------------------------------------------------------------------------------------------------
// Text sections (data/mars/text.json). Owners: integration (M6) for night and storm notices,
// campaign and screens (M4) for the rest. Strings marked [placeholder] are stubs.

export interface MarsTextSections {
  instruments: MarsInstrumentText; // M5
  survey: MarsSurveyText; // M5
  hudMars: MarsHudText; // Mars step 6c
  sol: Record<'hudSol' | 'lasted', string>;
  /** dawnNoSolar: the dawn notice for a rover without solar income (an RTG), which no panel charges (Mars step 6b). */
  night: Record<'sunset' | 'dawn' | 'sleeping' | 'noLights' | 'lightsOn', string> & { dawnNoSolar?: string };
  storm: Record<'forecast' | 'started' | 'cleared' | 'credit', string> & Partial<Record<'forecastNoSolar' | 'startedNoSolar' | 'clearedNoSolar', string>>; // NoSolar: for a rover without solar income (an RTG)
  /** Campaign and screens (M4): the Moon → Mars transition on the design, ticket and landing screens. */
  campaign: MarsCampaignText;
  /**
   * The desk's night budget line (Mars M15, ui/marsMission.ts nightBudgetLine): what one night costs this
   * build asleep and awake with lights, the electric heater's share and an RTG's income. {energy}, {seconds}.
   */
  nightBudget: Record<'label' | 'asleep' | 'lights' | 'heater' | 'steady' | 'separator', string> & {
    /** The night tile's short units beside each large number (asleep, with lights, the RTG's income). */
    units: Record<'asleep' | 'lights' | 'steady', string>;
  };
  /** Per-world part wording, by part id: replaces the shared name or description (rules/merge.ts withPartText). */
  partText?: Record<string, { name?: string; description?: string }>;
  /**
   * Support hardware on the desk (Mars M5, ui/supportText.ts): `needs` on an instrument's card and its
   * refusal ({support}), `missing` in the warnings ({part}, {support}), and each support part's name.
   * The arm as the X-ray's upgrade: `xrayWithArm` on the X-ray's card and `armAdds` on the arm's ({reach}),
   * `groundDown` on the first ground-down X-ray reading and `groundDownReward` after a raised reward ({percent}).
   */
  support: Record<'needs' | 'missing' | SupportSlot, string> & Partial<Record<'xrayWithArm' | 'armAdds' | 'groundDown' | 'groundDownReward', string>>;
}

export interface MarsCampaignText {
  carryOver: string; // {balance}: the balance carried over from the Moon
  passMark: string; // {minimum}: the next mission's pass mark (Titan)
  sameParts: string; // design screen: Mars has its own parts and ticket tiers
  ticketNote: string; // ticket screen: Mars's own tiers
  perseverance: string; // landing: {distance} km {direction} to Perseverance's landing site
  newHeading: string; // landing: "New on Mars"
  newOnMars: string[]; // landing: one line per new constraint, {placeholders} from the Mars data
  sourcesLabel: string; // credits: label for the landing briefing's sources
  sources: string; // sources for the real facts in the landing briefing
}
