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
  nightClockRate: number; // mission clock rate while asleep at night (1 = normal); drains and cooling follow mission time
}

// ---------------------------------------------------------------------------------------------------
// Power. Owner: rules (T3). Solar panels earn almost nothing; a constant-power part effect
// (PartEffects.constantPower, waste heat through the part's own `heat`) is supported by the rules on every
// world, but no part uses it (Owner A). The drains are tuning.night (NightTuning): on Titan the awake
// drain (electronics) applies by day as well, because there is no solar to cover it.

export interface TitanPowerTuning {
  solarFactor: number; // multiplier on the Moon panel rate by day (effectively zero); nothing at night
}

// ---------------------------------------------------------------------------------------------------
// Cold. Owner: rules (T3). Always on, map-wide: the heater and the rover's own electronics (awake, more
// while driving) slow freezing; asleep only the heater does.

export interface TitanColdTuning {
  freezeRatePerSecond: number; // base freeze rate everywhere, all mission, without heat (the rainstorm multiplies it)
  awakeHeat: number; // heat units from the electronics while awake
  drivingHeat: number; // extra heat units while driving
  /** Freeze rate removed per heat unit on Titan (heater, awake, driving). Default: tuning.cold.heaterReductionPerHeat (the Moon's 1.5). */
  heaterReductionPerHeat?: number;
}

// ---------------------------------------------------------------------------------------------------
// Events (data/titan/events.json). Owner: rules (T3).

/** One methane rainstorm per mission, forecast 60 s ahead by the lander's weather station. */
export interface RainstormSpec {
  windowsSeconds: [number, number][]; // the storm starts at a random time inside each window
  warningSeconds: number; // forecast lead time
  durationSeconds: number;
  rampSeconds: number;
  freezeFactor: number; // multiplier on the base freeze rate at full strength (> 1: colder)
  blocksPhotos: boolean; // photos do not count while the rain falls (start to end, ramps included)
  // Rain visibility is the renderer's (tuning.look.fog with scene.setStorm(intensity)); no visibility factor here.
  source: string;
}

// ---------------------------------------------------------------------------------------------------
// Milestone triggers. Owner: milestones and survey (T5). Unknown triggers are simply never reached.
// Titan also reuses the Mars 'night-distance' and 'storm-survive' triggers (storm-survive: the rain).

export type TitanMilestoneTrigger =
  | { type: 'dune-crossing' } // from one interdune corridor to another over a dune, without getting stuck
  | { type: 'dawn' }; // still running when the Sun rises again

/**
 * Titan zone ids (rules/titanMilestones.ts buildTitanZones, T5): within duneCrests.zoneRadius_m of a crest
 * line, the dune-crest viewpoint (photoZoneRadiusM), the sample patch (its radius_m), the Selk ejecta field
 * (rockyAreas[0] x boulderCrossRadiusFactor), and each interdune corridor's outline (Dune crossing).
 */
export type TitanZoneId = 'dune-crest' | 'dune-crest-viewpoint' | 'interdune-sample' | 'ejecta-field' | 'interdune-corridor';

/**
 * Titan-only milestone tuning (data/titan/tuning.json `milestones`), merged over the shared MilestoneTuning.
 * T5 needs none: Titan zones are sized by the terrain (crest zone radius, patch and ejecta radii) and the
 * shared photo zone radius and sample spacing.
 */
export interface TitanMilestoneTuning {
  [key: string]: unknown;
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
  /**
   * Haze density per meter, clear and at peak rain; fog follows rain^rainEase on a log scale. The terrain hazes
   * as 1 - exp(-(density × depth)^shapePower): 1 is a soft haze that starts near and fades far relief gently,
   * 2 is three's exp² fog with its sharper fog line (the rover and lander keep exp², which barely touches them).
   */
  fog: { clearDensity: number; rainDensity: number; rainEase: number; shapePower: number };
  /** Dusk: the light and sky dim to `dim` × as the Sun drops from dimDeg to the horizon (a visible cue before sunset). */
  dusk: { dimDeg: number; dim: number };
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
  ground: {
    color: string; albedoContrast: number; darkSandTint: string; darkToneLow: number; darkToneHigh: number;
    /**
     * Dune relief in the flat diffuse light: the shading normal's tilt is multiplied by reliefGain, and the
     * sky light falls as (up component of that normal)^reliefOcclusion, so flanks read darker than crests and flats.
     * Both fade in between reliefNearM and reliefFarM from the camera, so the ground by the rover keeps its own look.
     */
    reliefGain: number; reliefOcclusion: number; reliefNearM: number; reliefFarM: number;
    /** Extra albedo contrast far away (tone^farToneBoost, over the same depth range): dune and interdune bands. */
    farToneBoost: number;
  };
  floodlight: { color: string; intensity: number; angle: number; penumbra: number; decay: number; targetDrop: number };
  /** Rover shadow blur (shadow map radius) and Sun-mask refresh bands; masks pause below minElevationDeg. */
  shadowRadius: number;
  sunMask: { bands: [number, number, number]; minElevationDeg: number };
  // titan-fx: beams
  /** Floodlight beams in the haze (world/titanBeams.ts; optional: no beams without it). */
  beams?: TitanBeamsTuning;
}

// titan-fx: beams
/**
 * Floodlight beams in the haze: presentation only. Each light bar gets a soft volumetric cone along the
 * floodlight's direction (angle and penumbra from `floodlight`, length = the lights part's range × lengthScale).
 */
export interface TitanBeamsTuning {
  /** Beam brightness scale (in-scatter per meter, before the strength below). */
  intensity: number;
  /** Visible cone half-angle = floodlight.angle × angleScale; beam length = light range × lengthScale. */
  angleScale: number;
  lengthScale: number;
  /** Soft edge share of the cone (as a spotlight's penumbra), height over width, outward toe of each beam (deg). */
  penumbra: number;
  verticalScale: number;
  toeOutDeg: number;
  /** A brighter core along each beam's axis (so the two beams read from behind): its width (share of the cone angle) and share of the light. */
  core: { angleShare: number; share: number };
  /** Beam fades in over nearFadeM from the lamp (no hot spot at the housing); falls as 1/distance past nearM. */
  nearFadeM: number;
  nearM: number;
  /** Strength by Sun elevation: full at or below fullDeg, `dayStrength` at or above offDeg. */
  fullDeg: number;
  offDeg: number;
  dayStrength: number;
  /** Extra strength at peak rain (more scattering): × (1 + rainBoost × storm). */
  rainBoost: number;
  /** Ray-march samples per pixel. */
  samples: number;
  /** Faint glow around each light housing at night: size (m) and brightness. */
  halo: { sizeM: number; intensity: number };
  /** Raindrops glinting in the beams (rain intensity × strength): count (0: none), size (px at 10 m), fall speed, brightness, twinkle rate. */
  glints: { count: number; sizePx: number; fallMps: number; intensity: number; twinkleHz: number };
}

// ---------------------------------------------------------------------------------------------------
// Text sections (data/titan/text.json). Owners: integration (T6) for day, night, cold and rain notices,
// campaign and screens (T4) for the rest, milestones and survey (T5) for instruments and survey.
// Titan reuses the Mars section shapes (MarsTextSections) where they fit; these are the Titan additions.

export interface TitanTextSections {
  /** Day and night notices and HUD lines (T6). */
  day: Record<
    | 'sunset' | 'sunsetNoLights' | 'sunsetSoon' | 'dawn' | 'dawnWoke'
    | 'hudDay' | 'hudNight' | 'lightsOn' | 'noLights' | 'sleepFastForward' | 'sleepingDay'
    | 'panelDay' | 'panelNight',
    string
  >;
  /** Methane rain (T6; `credit` is T4's). `forecastBar` fills {seconds}. */
  rain: Record<'forecast' | 'forecastBar' | 'started' | 'cleared' | 'photoBlocked' | 'credit', string>;
  /** Always-on cold (T6). */
  cold: Record<'warning' | 'sleepCools', string>;
  /** Campaign and screens (T4): the Mars → Titan transition, the Dragonfly debrief, Campaign complete. */
  titanCampaign: TitanCampaignText;
}

export interface TitanCampaignText {
  // The "New on Titan" list is campaign.newOnMars (the shared MarsCampaignText shape the landing screen renders).
  solarNote: string; // design and ticket: solar panels give almost no power at Titan
  solarIncome: string; // design: {income} a power part's solar income at Titan (Moon rate x titanPower.solarFactor)
  factsHeading: string; // landing: "Titan in a few facts"
  facts: string[]; // landing: one short fact per line
  selk: string; // landing: {distance} km {direction} from the lander to Selk's center (terrain.json features.selk)
  dragonflyHeading: string; // debrief: "The real mission flies"
  dragonfly: string[]; // debrief: paragraphs comparing the rover with Dragonfly
  compareHeading: string; // debrief: the comparison table
  colRover: string;
  colDragonfly: string;
  /** One row per topic; rover may use {wheels}, {battery}, {capacity}, {heater}, {lights} from the rover flown. */
  compare: { label: string; rover: string; dragonfly: string }[];
  lesson: string; // debrief: the right vehicle depends on the world
  dragonflySource: string; // debrief note and credits
  complete: TitanCompleteText;
}

/** The Campaign complete screen's own strings (the rest is the comingSoon section). */
export interface TitanCompleteText {
  kicker: string;
  startEnd: string; // {start} starting budget, {balance} final balance
  totalRow: string; // campaign table: the total row
  lessonsHeading: string;
  lessons: string[]; // one line per world
}
