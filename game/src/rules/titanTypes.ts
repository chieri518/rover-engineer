// Types for the Titan mission: the Titan terrain features (public/terrain/titan/terrain.json, agreed with
// the pipeline, see titan-build-log.md) and the Titan-only sections of the data files in data/titan/.
// Kept apart from types.ts so the Titan tracks can grow their own sections without all editing one file.
// Each section names the track that owns it; values in data/titan/*.json marked "_placeholder" are stubs,
// values marked "_interface" are set with Owner A. Titan reuses the Mars SolTuning and NightTuning
// (rules/marsTypes.ts) for its one-day clock and its night, unless the rules track (T3) decides otherwise.

interface Point { x: number; z: number }
interface Point3 { x: number; y: number; z: number }

// ---------------------------------------------------------------------------------------------------
// Terrain features (Titan terrain.json `features`). Owner: pipeline (T1) writes them, spine (T0) types them.
// Agreed with the pipeline at 16:05 (titan-build-log.md). Heights are meters above an arbitrary local datum.

/** A named point on the Titan terrain (same shape as a Mars site). */
export interface TitanSite {
  name: string;
  local: Point3;
  latLon: [number, number];
  elevation_m: number;
  slope_deg: number;
  distanceFromLanding_m: number;
  driveDistanceFromLanding_m: number;
  source: string;
}

export type TitanViewpointKind = 'duneCrest';

export interface TitanViewpoint extends TitanSite {
  kind: TitanViewpointKind;
  lookToward: Point; // unit vector in the local x-z plane
  lookTarget?: Point3;
}

export interface TitanTerrainFeatures {
  /** Linear dunes, crest lines roughly WSW-ENE. */
  duneCrests: {
    description: string;
    orientation_deg: number; // crest-line azimuth from north toward east (about 75 to 80)
    zoneRadius_m: number; // within this distance of a crest line counts as "on the crest"
    source: string;
    lines: { name: string; crestLocal_xz: [number, number][]; height_m: number; width_m: number }[];
  };
  /** Firm interdune corridors between the dunes (Dune crossing: from one corridor to another). */
  interdunes: {
    description: string;
    corridors: { name: string; outlineLocal_xz: [number, number][]; centerLocal_xz: [number, number][] }[];
  };
  /**
   * Graded dune-sand softness: soft-ground.png (softness = value/255) is authoritative. `areas` is a circle
   * cover of the softest sand (>= 0.6) so the circle-based rule (rules/ground.ts) keeps working.
   */
  softGround: {
    description: string;
    maskIsAuthoritative: boolean;
    areas: { name: string; local: Point; radius_m: number }[];
  };
  /** [0] is the Selk ejecta field: the survey lead target and the farthest goal. */
  rockyAreas: (TitanSite & { radius_m: number; slopeExcess_deg?: number; description?: string })[];
  viewpoints: TitanViewpoint[];
  /** A bright interdune patch to sample (Organic sands sample). */
  samplePatch: TitanSite & { radius_m: number; description: string };
  /** The suggested crossing over the nearest dune: crestPoint is the saddle. */
  crossingRoute: {
    name: string;
    description: string;
    fromCorridor: TitanSite;
    crestPoint: TitanSite;
    toCorridor: TitanSite;
    pathLocal_xz: [number, number][];
    maxSlope_deg: number;
    source: string;
  };
  /** Selk crater, a landmark on the horizon only. */
  selk: {
    name: string;
    description: string;
    centerLatLon: [number, number];
    centerLocal: Point;
    diameter_km: number;
    rimHeight_m: number;
    bearingFromLanding_deg: number;
    distanceFromLanding_km: number; // to the center
    source: string;
  };
  notes: string[];
}

// ---------------------------------------------------------------------------------------------------
// Time and day. Owner: rules (T3). The day itself is `tuning.sol` (SolTuning, one sol of 900 s: 450 s day,
// 450 s night, start 150 s after sunrise); the night is `tuning.night` (NightTuning). Titan adds:

/** Sleeping fast-forwards the clock at night (design: 4x). */
export interface TitanSleepTuning {
  nightClockRate: number; // mission clock rate while asleep at night (1 = normal)
}

// ---------------------------------------------------------------------------------------------------
// Power. Owner: rules (T3). Solar panels earn almost nothing; a constant-power part effect is supported
// by the rules, but no part uses it (Owner A).

export interface TitanPowerTuning {
  solarFactor: number; // multiplier on the Moon panel rate by day (effectively zero)
}

// ---------------------------------------------------------------------------------------------------
// Cold. Owner: rules (T3). Always on, map-wide: the heater and the rover's own electronics (awake, more
// while driving) slow freezing; asleep only the heater does.

export interface TitanColdTuning {
  freezeRatePerSecond: number; // base freeze rate everywhere, all mission, without heat
  awakeHeat: number; // heat units from the electronics while awake (heaterReductionPerHeat from tuning.cold applies)
  drivingHeat: number; // extra heat units while driving
}

// ---------------------------------------------------------------------------------------------------
// Events (data/titan/events.json). Owner: rules (T3).

/** One methane rainstorm per mission, forecast 60 s ahead by the lander's weather station. */
export interface RainstormSpec {
  windowsSeconds: [number, number][]; // the storm starts at a random time inside each window
  warningSeconds: number; // forecast lead time
  durationSeconds: number;
  rampSeconds: number;
  freezeFactor: number; // freeze rate multiplier during the storm (> 1: colder)
  visibilityFactor: number; // view distance multiplier at full strength (rendering, T2/T6)
  blocksPhotos: boolean; // photos do not count during the storm
  source: string;
}

// ---------------------------------------------------------------------------------------------------
// Milestone triggers. Owner: milestones and survey (T5). Unknown triggers are simply never reached.
// Titan also reuses the Mars 'night-distance' and 'storm-survive' triggers (storm-survive: the rain).

export type TitanMilestoneTrigger =
  | { type: 'dune-crossing' } // from one interdune corridor to another over a dune, without getting stuck
  | { type: 'dawn' }; // still running when the Sun rises again

/** Titan zone ids that milestones.json triggers may name (rules/milestones.ts buildZones, T5). */
export type TitanZoneId = 'dune-crest' | 'dune-crest-viewpoint' | 'interdune-sample' | 'ejecta-field';

/** Titan-only milestone tuning (data/titan/tuning.json `milestones`), merged over the shared MilestoneTuning. */
export interface TitanMilestoneTuning {
  [key: string]: unknown; // T5 fills
}

// ---------------------------------------------------------------------------------------------------
// Sky and light (data/titan/tuning.json `look`). Owner: sky and light (T2).

/** Colors are sRGB hex strings "#rrggbb". Rendering values (world/titanLook.ts, titanSky.ts, moonScene.ts), not game rules. */
export interface TitanLookTuning {
  /** Top-of-atmosphere sunlight in scene intensity units (tuned with screenshots against the Moon and Mars). */
  sunIntensity: number;
  /** Sun elevation the eye adaptation and sky brightness are referenced to (about the site's noon Sun). */
  referenceElevationDeg: number;
  /** Titan's radius over the haze scale height, for the airmass. */
  radiusOverScaleHeight: number;
  /** Effective optical depth of the direct (shadow-casting) beam, its relative depth per channel, and its gain. */
  directDepth: number;
  directReddening: [number, number, number];
  directGain: number;
  /** Diffuse sky light: gain, power of sin(elevation), twilight share at sunset and its fall (per degree below). */
  diffuseGain: number;
  diffuseSunPower: number;
  twilightShare: number;
  twilightScaleDeg: number;
  /** Sky hue moves from the dusk colors to the day colors between these Sun elevations. */
  duskLowDeg: number;
  duskHighDeg: number;
  /** Displayed sky brightness ~ (sky light)^skyGamma, adapted while the Sun is up (at most skyAdaptMax). */
  skyGamma: number;
  skyAdaptK: number;
  skyAdaptMax: number;
  /** Eye adaptation of the scene light: × (reference / now)^adaptK, at most adaptMax. */
  adaptK: number;
  adaptMax: number;
  /** Ambient floor at night (near black: the floodlights matter), ground bounce share, sky light saturation. */
  nightLight: number;
  groundBounce: number;
  skyLightSaturation: number;
  colors: {
    sun: string;
    dayHorizon: string;
    dayZenith: string;
    duskHorizon: string;
    duskZenith: string;
    rainHorizon: string;
    rainZenith: string;
    night: string;
    glow: string;
    duskGlow: string;
  };
  glow: { dayStrength: number; duskStrength: number; widthDeg: number; duskWidthDeg: number; highDeg: number; twilightScaleDeg: number };
  /** The faint Sun disc: opacity with the Sun high, reached at fullDeg elevation; size in degrees (radius). */
  sunDisc: { opacity: number; fullDeg: number; radiusDeg: number };
  /** exp² fog density per meter: clear and at peak rain; fog follows rain^rainEase on a log scale. */
  fog: { clearDensity: number; rainDensity: number; rainEase: number };
  rain: {
    /** Share of the eye adaptation lost at peak rain (the scene darkens), extra direct depth, sky light dimming. */
    gloom: number;
    directDepth: number;
    skyDim: number;
    /** Rain streaks (optional visual): opacity at peak, count, box around the camera, fall speed, streak length, color. */
    streakOpacity: number;
    streakCount: number;
    streakBoxM: number;
    fallMps: number;
    streakLengthM: number;
    color: string;
  };
  /** Ground: mean color (tints the grayscale albedo map), albedo contrast, and a tint for the dark dune sand. */
  ground: { color: string; albedoContrast: number; darkSandTint: string; darkToneLow: number; darkToneHigh: number };
  floodlight: { color: string; intensity: number; angle: number; penumbra: number; decay: number; targetDrop: number };
  /** Rover shadow blur (shadow map radius) and Sun-mask refresh bands; masks pause below minElevationDeg. */
  shadowRadius: number;
  sunMask: { bands: [number, number, number]; minElevationDeg: number };
}

// ---------------------------------------------------------------------------------------------------
// Text sections (data/titan/text.json). Owners: integration (T6) for day, night, cold and rain notices,
// campaign and screens (T4) for the rest, milestones and survey (T5) for instruments and survey.
// Titan reuses the Mars section shapes (MarsTextSections) where they fit; these are the Titan additions.

export interface TitanTextSections {
  /** Day and night notices (T6). */
  day: Record<'sunset' | 'dawn' | 'sleepFastForward', string>;
  /** Methane rain (T6). */
  rain: Record<'forecast' | 'started' | 'cleared' | 'photoBlocked' | 'credit', string>;
  /** Always-on cold (T6). */
  cold: Record<'warning' | 'sleepCools', string>;
  /** Campaign and screens (T4): the Mars → Titan transition, the Dragonfly debrief, Campaign complete. */
  titanCampaign: TitanCampaignText;
}

export interface TitanCampaignText {
  newHeading: string; // landing: "New on Titan"
  newOnTitan: string[]; // landing: one line per new constraint
  solarNote: string; // design and ticket: "Solar panels: almost no power at Titan"
  dragonfly: string; // debrief: the real mission flies
  dragonflySource: string;
}
