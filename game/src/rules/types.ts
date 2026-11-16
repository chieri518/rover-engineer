// Types for the JSON files in game/data/. These are the data contract.
import type { DamageCause } from './damage';
import type { DustDevilSpec, DustStormSpec, DustTuning, MarsMilestoneTrigger, MarsMilestoneTuning, MarsTextSections, NightTuning, SolTuning } from './marsTypes';

/** The rover's bus: one part per slot. */
export type BusSlot = 'chassis' | 'wheels' | 'power' | 'battery' | 'lights' | 'heater';
/**
 * Support hardware (Mars M5): optional slots a world may offer (PartsFile.supportSlots), one part each,
 * "No arm" / "No mast" included. Instruments that need one say so (PartEffects.needs). They take no
 * mounting point.
 */
export type SupportSlot = 'arm' | 'mast';
/** A part's catalog category: a bus slot, a support slot, or 'instrument' for the payload bay (which holds a list). */
export type Slot = BusSlot | SupportSlot | 'instrument';
/** The instruments. weather, radar, laser and organics are Mars's (their behavior arrives in Mars step 4a). */
export type Instrument = 'camera' | 'drill' | 'neutron' | 'xray' | 'seismometer' | 'reflector' | 'weather' | 'radar' | 'laser' | 'organics';

export interface PartEffects {
  maxLoad?: number; // chassis: kg of total rover mass it can carry
  mountingPoints?: number; // chassis: instruments the payload bay can hold (one point each)
  baseSpeed?: number; // wheels: m/s
  grip?: number; // wheels: 0..1, higher = less slip
  energyPerMeter?: number; // wheels: energy per meter at reference mass
  energyIncome?: number; // power: energy per second in full sun
  batteryCapacity?: number; // battery: energy units
  lightRange?: number; // lights: meters
  heat?: number; // heater: heat units, slows freezing
  instrument?: Instrument; // instrument parts (payload bay)
  energyPerUse?: number; // instrument: energy each use costs (absent: none)
  standbyEnergy?: number; // instrument: energy per second while switched on, not while powered down (absent: no standby; the instrument is a switch when it has one)
  useSeconds?: number; // instrument: mission seconds the rover holds still for each use (absent: instant)
  deploy?: boolean; // instrument: a use sets the part down on the ground for good; its mass leaves the rover
  shadowHoldFactor?: number; // instrument: the hold time is multiplied by this (0..1) while the rover is in shadow (sunlight below tuning.instruments.shadowSunlight)
  coldTolerant?: boolean; // instrument: exempt from the cold slowdown (its sensor head sits outside the warm body)
  needsEarth?: boolean; // instrument: usable only where Earth is above the terrain horizon from the rover
  needsBoulder?: boolean; // instrument: usable only with a boulder within tuning.instruments.xray.reachM
  // Power the parts own (Mars M1). The draws and steadyIncome apply only on a world whose tuning has a
  // `night` section (Mars): the Moon has no idle drain, so its panels' energyIncome is net of it.
  lightsDraw?: number; // lights: energy per second while the floodlights are on (awake at night)
  heaterDraw?: number; // heater: energy per second every second of night, awake and asleep; its heat counts only while the draw is paid
  steadyIncome?: number; // power: energy per second, day and night, never scaled by sunlight, the low Sun, the storm, shadow or dust
  dustRate?: number; // power: how fast dust settles on this part (x tuning.dust.perSol); every part with energyIncome needs one on a world with dust
  neutronNoise?: boolean; // power: the part raises the neutron spectrometer's floor (an RTG; the rule is Mars step 5b). Never shown on the desk
  // Support hardware (Mars M5, M6).
  arm?: boolean; // arm slot: the part is a robotic arm (contact instruments need it)
  mast?: boolean; // mast slot: the part is a remote sensing mast (the laser spectrometer needs it)
  needs?: SupportSlot[]; // instrument: the support hardware it cannot work without; the desk refuses it until the build has it
}

export interface Part {
  id: string;
  slot: Slot;
  name: string;
  description: string;
  cost: number;
  mass: number; // kg
  size: number; // size units
  effects: PartEffects;
  /** The worlds whose desk offers this part (absent: every world). Mission ids are the world ids (src/worlds.ts WorldId). */
  worlds?: MissionId[];
}

export interface PartsFile {
  slots: BusSlot[]; // the bus slots; instrument parts go in the payload bay instead
  /** The support slots this world offers (absent: none, as on the Moon). Set per world by its parts overlay (data/mars/parts.json). */
  supportSlots?: SupportSlot[];
  parts: Part[];
}

/**
 * A world's parts overlay (data/mars/parts.json): the support slots it offers, and effects merged into
 * shared parts by part id (the Mars X-ray's `needs`). Applied to the whole catalog (rules/merge.ts withPartsOverlay).
 */
export interface PartsOverlay {
  supportSlots?: SupportSlot[];
  effects?: Record<string, Partial<PartEffects>>;
}

export interface Tier {
  id: string;
  name: string;
  massLimit: number;
  sizeLimit: number;
  price: number;
}

export interface TiersFile {
  tiers: Tier[]; // ordered smallest to largest
}

export type MilestoneCategory = 'capability' | 'scientific' | 'record' | 'picture';

/**
 * What a photo milestone wants in frame: Earth (Moon), the setting Sun (Mars), the rolled boulder within
 * tuning.milestones.boulderTrackPhotoRangeM, or a boulder the X-ray spectrometer read this mission within
 * documentedSampleRangeM (both worlds). Mars extensions: `crater-wall`, a young crater's center in frame
 * with the rover inside tuning.milestones.craterWallRimBand times its radius (Crater wall), and
 * `dustdevil`, a dust devil in frame (Dust devil). Without a target, a photo counts inside its zone.
 */
export type PhotoTarget = 'earth' | 'sunset' | 'rolled-boulder' | 'read-boulder' | 'crater-wall' | 'dustdevil';
/** What a `reading` trigger may need the reading to be on: any boulder, or the Mars delta cliff (Mars plan, laser spectrometer). */
export type ReadingTarget = 'boulder' | 'cliff';
/**
 * Events a `record` trigger waits for: the moonquake (Moon), the dust storm (Mars). Mars extensions:
 * `night` (while it is night, rules/sol.ts solClock().isNight) and `dustdevil` (a dust devil passing within
 * tuning.dust.dustDevilSenseM of the rover).
 */
export type RecordEvent = 'quake' | 'duststorm' | 'night' | 'dustdevil';
/** The seismometer station's record of the moonquake (rules/instruments.ts SeismometerRecord). */
export type RecordQuality = 'clean' | 'noisy';

/**
 * A milestone's trigger. The instrument triggers (transect, reading, record, deploy) are shared by every
 * world: the Moon builds them first, Mars reuses them (Moon sites plan, M6). Unknown or unbuilt triggers
 * are simply never reached.
 */
export type MilestoneTrigger =
  | { type: 'landing' }
  | { type: 'distance'; meters: number[] } // one reward per threshold reached
  | { type: 'explore'; share: number }
  | { type: 'zone'; zone: string; mode: 'enter-and-exit' | 'cross' }
  | { type: 'photo'; zone?: string; target?: PhotoTarget }
  /** sites: staged, one reward per sample site, up to this many, each at least sampleSpacingM from the others. */
  | { type: 'drill'; zone?: string; sites?: number }
  | { type: 'event'; event: 'flare' | 'quake'; condition: 'no-damage' }
  /** no-damage: no damage from any cause except those listed (moonquakes cannot be avoided). */
  | { type: 'survive'; condition?: 'no-damage'; except?: DamageCause[] }
  /**
   * The instrument was switched on for an unbroken drive of at least `meters` that touches the zone.
   * sites: staged, one stage per distinct zone instance, up to this many (Cold trap survey).
   * Mars extensions: `zones` instead of `zone` lists several zone ids, any of which counts (Buried layers:
   * a young crater, Séítah or the delta front); with neither, the drive counts anywhere outside the
   * near-lander zone (Long profile). Moon transects all name one `zone`.
   */
  | { type: 'transect'; instrument: Instrument; zone?: string; zones?: string[]; meters: number; sites?: number }
  /**
   * A use of the instrument finishes, inside the zone or on the target kind if given. sites: staged as the
   * drill (one stage per reading site, each at least sampleSpacingM from the others, none inside the
   * near-lander zone). rocks: staged by distinct rock types this instrument read this mission, one stage
   * per count (Rock collection [2, 3, 4]). rock: the reading must find this rock type (an id in
   * tuning.instruments.xray.suites). Rock types and read boulders count per instrument (Mars step 5a).
   */
  | { type: 'reading'; instrument: Instrument; zone?: string; target?: ReadingTarget; sites?: number; rocks?: number[]; rock?: string }
  /**
   * The instrument was deployed (or, for one aboard, switched on) when the event came. On the Moon the
   * station must have been set down outside the near-lander zone. quality: the record must be this good.
   * Mars extension (M16) `seconds`: an instrument aboard was switched on, the rover powered up and outside
   * the near-lander zone, for at least this many seconds while the event was active (a power-down pauses
   * the count; 0: at the moment the event comes). Stations keep the Moon rule.
   */
  | { type: 'record'; instrument: Instrument; event: RecordEvent; quality?: RecordQuality; seconds?: number }
  /**
   * The station is set down outside the near-lander zone; needs 'earth': with Earth in view; near: within
   * withinM of the other station on the ground. A pair fires when the second of the two goes down, either order.
   */
  | { type: 'deploy'; instrument: Instrument; needs?: 'earth'; near?: { instrument: Instrument; withinM: number } }
  | MarsMilestoneTrigger;

export interface MilestoneRequirements {
  slots?: BusSlot[]; // the part in each slot must have a non-zero capability effect
  instrument?: Instrument; // some part in the payload bay must provide it
  instruments?: Instrument[]; // combos: the payload bay must provide every one of these
}

export interface Milestone {
  id: string;
  name: string;
  category: MilestoneCategory;
  record: boolean; // records can be earned once per campaign
  trigger: MilestoneTrigger;
  requires: MilestoneRequirements;
  money: number; // per stage for staged triggers (distance)
  rp: number;
  summary: string; // what the rover did, in the formal mission-log tone of the pop-up
  howTo?: string; // how to earn it, in plain words for the desk and the debrief (names no lesson's cause or fix)
  fact: string; // one real-history sentence, shown only when the Mission history setting is on
  source?: string; // where the fact comes from (not shown in the pop-up)
}

export interface MilestonesFile {
  milestones: Milestone[];
}

export type DeathCause = 'energy' | 'stuck' | 'froze' | 'destroyed';
/** Debrief real-rover comparisons: one per ending; a rollover is 'destroyed' with its own comparison. */
export type HistoryKey = DeathCause | 'survived' | 'rollover';
/** A playable world, and the mission played on it. See src/worlds.ts. */
export type MissionId = 'moon' | 'mars';
/** A step of the campaign: a playable mission, or the end marker after the last one ("Titan: coming soon"). */
export type CampaignStep = MissionId | 'titan';

export interface Tuning {
  /** gravity: the world's surface gravity in m/s² (Mars sets its own in data/mars/tuning.json). */
  mission: { lengthSeconds: number; gameDays: number; gravity: number };
    budget: {
    startingBudget: number;
    /** A step's minimum is the pass mark of the mission before it (titan: the Mars pass mark). */
    minimumBudget: Record<CampaignStep, number>;
  };
  payout: {
    survivalPayout: number;
    deathPenalty: Record<DeathCause, number>;
    penaltyMinFraction: number; // share of the base penalty left if the rover lasted the full mission
  };
  mass: {
    referenceMass: number;
    speedLossPerKg: number; // share of base speed lost per kg above the reference mass
    minSpeedFactor: number; // a rover never drops below this share of its base speed
    energyGainPerKg: number; // share of energy per meter added per kg above the reference mass
  };
  /** Driving is compressed like time: game speed = real speed × compression. Part base speeds are real m/s. */
  speed: { compression: number };
  energy: {
    slopeEnergyFactor: number; // drive energy grows by this share per degree of uphill grade
    lowWarningShare: number; // warn when the battery falls below this share of capacity
  };
  damage: {
    max: number;
    rockHit: number; // damage from a hard impact at impactMinMps
    impactMinMps: number; // a sudden velocity change below this is not an impact
    impactPerMps: number; // extra damage per m/s above impactMinMps
    impactCooldownSeconds: number; // one collision counts once
    steepSlopePerSecond: number; // while driving on ground steeper than ground.maxSlopeDegrees
    overloadPerKgSecond: number; // while driving, per kg above the chassis maximum load
    highWarningShare: number; // warn when damage passes this share of the maximum
    rolloverTiltDeg: number; // the rover counts as rolled over beyond this tilt...
    rolloverSeconds: number; // ...held this long
  };
  cold: {
    freezeMax: number;
    freezeRatePerSecond: number; // inside a cold zone, without a heater
    heaterReductionPerHeat: number; // freeze rate removed per heat unit of the heater
    warmRecoveryPerSecond: number; // outside the cold zones
    warningShare: number; // warn when the freeze meter passes this share
    zones: string[]; // terrain.json features whose permanent shadow is a cold zone (feature name or key)
    zoneSearchRadiusM: number; // how far from the feature point its shadowed patch may start
    noLightsMarginM: number; // without lights the rover stops this far before permanent shadow, plus its braking distance
  };
  ground: {
    maxSlopeDegrees: number; // steeper ground damages a driving rover
    slopeWarningDegrees: number; // warn from this slope
    slipLimit: number; // above this slip the wheels dig in (Apollo 15: about 20%)
    stuckSeconds: number; // digging in for this long leaves the rover stuck for good
    digRecoveryPerSecond: number; // share of the dig-in meter recovered per second while not digging
    normalSinkageCm: [number, number];
    softRimSinkageCm: [number, number];
    slipPerSinkageCm: number; // sinkage scales with mass / mass.referenceMass and referenceGrip / grip
    referenceGrip: number; // sinkage scales with referenceGrip / wheel grip
    slopeSlipFreeDeg: number; // uphill grades below this add no slip
    slipPerUphillDeg: number;
    softRadiusFactor: number; // ground inside rockyArea.radius × this is fully soft (fresh crater rim)
    softFadeFactor: number; // softness fades to zero at rockyArea.radius × this
    movingSpeedMps: number; // above this speed the rover counts as driving
  };
  explore: { cellM: number; revealRadiusM: number };
  /** The rolled boulder's track decal (world/boulderTrack.ts): a ribbon draped on the terrain. */
  boulderTrack: {
    widthM: number;
    tileLengthM: number; // the texture repeats along the track every this many meters
    stepAlongM: number; // mesh rows along the track
    pointsAcross: number; // mesh points across the track
    liftM: number; // above the terrain, against z-fighting
    stopShortM: number; // the track ends this far before the boulder's center
    brighten: number; // the track multiplies the ground on screen by up to this (a multiplicative blend)
    glow: number; // peak light of a faint additive layer, so the track still shows on nearly black ground
  };
  /** The minimap's zoom: it starts at startSpanM and widens to fit the explored area plus marginM. */
  minimap: { startSpanM: number; marginM: number; maxSpanM: number };
  survey: SurveyTuning;
  /** Boulders scattered in the rocky areas (fresh craters): most are small, a few reach maxDiameterM. */
  boulders: {
    perRockyArea: number;
    perYoungCrater: number; // boulders around each young crater in sites.json (no soft ground there)
    rolledBoulderDiameterM: number; // the one rolled boulder (sites.json kind rolled-boulder)
    // Mars sites (data/mars/tuning.json; rules in Mars step 5c). Absent on the Moon.
    perSiteKind?: Partial<Record<SiteKind, number>>; // boulders at each site of these kinds (knobs, the Séítah edge, the delta foot)
    perSite?: Record<string, number>; // by sites.json id: replaces its kind's count (East crater: 60)
    floodBoulderDiameterM?: number; // the one flood boulder (sites.json kind flood-boulder)
    slopeTargetShare?: number; // share of each young crater's and knob's boulders put on terrain.json slopeTargets cells (10 to 18°, level ground beside)
    maxSlopeDeg?: number; // no site boulder on ground steeper than this (the world's slope; Mars step 5c)
    spreadRadiusFactor: number; // scattered out to rockyArea.radius × this
    minDiameterM: number;
    maxDiameterM: number;
    buriedShare: number; // share of each boulder's height below the ground
    seed: number;
  };
  sun: SunTuning;
  earth: { azimuthDeg: number; elevationDeg: number };
  rover: RoverHandling;
  area: {
    boundaryInsetM: number; // the operating boundary sits this far inside the 8 km play area
    warningDistanceM: number; // the "leaving the area" notice shows this close to the boundary
  };
  milestones: MilestoneTuning & Partial<MarsMilestoneTuning>; // Mars fields: rules/marsTypes.ts
  /** Mars only (data/mars/tuning.json): the sol clock and the night. See rules/marsTypes.ts. */
  sol?: SolTuning;
  night?: NightTuning;
  dust?: DustTuning; // dust on the panels (rules/dust.ts)
  instruments: InstrumentTuning;
}

/** How the instruments behave in a mission (rules/mission.ts, rules/instruments.ts). */
export interface InstrumentTuning {
  coldSlowdown: number; // an instrument's hold time is multiplied by this in a cold zone on a rover without a heater (cold-tolerant parts excepted)
  shadowSunlight: number; // the rover counts as in shadow below this sunlight share (shadowHoldFactor)
  stationOffsetM: number; // a deployed station is set down this far to the rover's left (from its center)
  stationConfirmSeconds: number; // inside the near-lander zone a station's key must be pressed again within this long to set it down
  neutron: {
    iceRangeM: number; // in permanent shadow, the hydrogen signal falls from 1 at the ice spot's center to 0 at this distance
    coldBackground: number; // the reading anywhere in permanent shadow (0..1): a little hydrogen in every cold trap
    noiseFloor: number; // the reading on ordinary ground (0..1)
    jitter: number; // the live reading wobbles by up to this much (counting noise)
    edgeRampM: number; // outside every cold zone the reading falls in a straight line from coldBackground to noiseFloor over this distance
    anomalyPeak: number; // the hidden hydrogen spot: the reading at its center...
    anomalyEdge: number; // ...at its zone edge (tuning.milestones.hydrogenZoneRadiusM), in a straight line...
    anomalyRangeM: number; // ...then down to noiseFloor at this distance from the center
    iceSignalShare: number; // Ice deposit located: the dark crater's ice signal (0..1) reaches at least this (within (1 - share) x iceRangeM of the spot)
    // Mars (data/mars/tuning.json; rules in Mars step 5b). Absent on the Moon.
    unitReadings?: Record<string, number>; // by zone id: the reading inside that zone, where it is above noiseFloor (Séítah, the delta foot; a game simplification)
    rtgFloorRise?: number; // on a rover whose power part has neutronNoise (an RTG): the noise floor rises by this...
    rtgJitter?: number; // ...and the reading wobbles by up to this (instead of jitter)
  };
  xray: {
    reachM: number; // a boulder counts when its surface is this close to the rover's center
    rocks: RockWeight[]; // fallback rock types for a boulder with no site (or a site with no suite), picked by weight
    suites: { id: string; rocks: RockWeight[] }[]; // rock suites; each site in sites.json names its suite by id (rockSuite)
  };
  seismometer: {
    recordWindowSeconds: number; // the station records the ground for this long before the moonquake
    quietDistanceM: number; // the rover driving closer than this during the window makes the trace noisy
  };
  // Mars instruments (Mars step 4a; data/mars/tuning.json). Absent on the Moon, so none of their rules apply there.
  arm?: ArmTuning;
  mast?: MastTuning;
  weather?: WeatherTuning;
  radar?: RadarTuning;
  laser?: LaserTuning;
  /** Held uses charged as they run (energyPerUse / useSeconds per second of the hold) instead of up front: the organics spectrometer. */
  chargedWhileHeld?: Instrument[];
}

/** The robotic arm (Mars MS2, Owner B item B13): contact instruments (whose `needs` include the arm) refuse to read on steeper ground. */
export interface ArmTuning {
  slopeLimitDeg: number; // the ground under the rover must be at most this steep (slope.png)
}

/** The remote sensing mast (Mars M5): the camera's photo zones (tuning.milestones.photoZoneRadiusM) grow by this on a rover with a mast. */
export interface MastTuning {
  photoRangeFactor: number;
}

/**
 * The weather mast (Mars M4, Owner B item B9, provisional, for Chieri's review): the storm forecast comes
 * earlier once the mast has been switched on, with the rover powered up, for a while; the HUD shows a
 * pressure and dust readout with trends.
 */
export interface WeatherTuning {
  stormEarlyWarningSeconds: number; // the forecast comes this much earlier than the orbital report's
  warmupSeconds: number; // ...once the mast has been on (and the rover powered up) without a break for this long
  pressurePa: number; // the readout's mean surface pressure
  pressureDailySwing: number; // share of pressurePa the daily cycle adds and takes away
  pressurePeakHour: number; // local solar hour of the daily pressure peak
  clearTau: number; // dust opacity on a clear sol
  stormTau: number; // dust opacity at full storm strength
  forecastHazeTau: number; // dust opacity the air gains over the early-warning lead before the storm (what the mast's trend shows)
  trendSeconds: number; // the trend arrows compare the readout now with this long ago
  pressureTrendPa: number; // a pressure change smaller than this reads as steady
  dustTrendTau: number; // a dust change smaller than this reads as steady
}

/**
 * The ground-penetrating radar (Mars M4): a profile of columns along the drive, one per columnM driven,
 * broken by a sharp turn or a stop. Layer kinds come from the zone under the rover.
 */
export interface RadarTuning {
  columnM: number; // meters of driving per profile column
  turnBreakDeg: number; // a heading change above this within one column breaks the profile
  stopBreakSeconds: number; // standing still this long breaks the profile
  columns: number; // columns kept for the HUD strip
  layers: { zone: string; kind: string }[]; // the zone under the rover → layer kind, first match wins
  defaultLayer: string; // the layer kind anywhere else
}

/** The laser spectrometer (Mars M4): its target is the nearest boulder or point of the delta cliff in a cone ahead. */
export interface LaserTuning {
  reachM: number; // a boulder's surface or a cliff point within this distance of the rover's center
  coneDeg: number; // half-angle of the cone ahead of the rover
}

/** A rock type (an id in text.json rocks) and its weight in a suite: each boulder reads one, picked by weight and seeded by its position. */
export interface RockWeight {
  id: string;
  weight: number;
}

/** Zone sizes and actions for the milestones (zones come from terrain.json features and sites.json). */
export interface MilestoneTuning {
  photoZoneRadiusM: number; // viewpoint zones: a circle this wide around each terrain.json viewpoint
  iceSpotRadiusM: number; // drilling within this distance of the hidden ice spot finds ice
  boulderCrossRadiusFactor: number; // a rocky area's zone is its radius times this (where the boulders lie)
  boulderCrossMinAngleDeg: number; // "cross": entry and exit points at least this far apart around the center
  partialCrossingHint: boolean; // leaving a boulder field short of a crossing shows a notice, once per field (off: silent)
  craterDescentDepthM: number; // de Gerlache's inner wall: at least this far below the landing point...
  craterDescentExitDepthM: number; // ...and back out: climb back above this depth below landing
  albumMax: number; // photos kept per mission
  photoFrameMargin: number; // Earth counts as in view inside this share of the frame (NDC)
  sampleMinDistanceM: number; // drill samples count only this far from the landing point (ground the lander disturbed)
  sampleSpacingM: number; // a staged sample milestone counts a new site only this far from earlier sites
  earthPhotoMinLit: number; // the Earth photo counts only when at least this share of Earth's disc is lit (its phase)
  earthPhotoMinDistanceM: number; // ...and only this far from the landing point, so it is not free at the start
  coldTrapEdgeM: number; // a cold trap's survey zone: its outline plus this edge (a rover without lights can survey from it)
  youngCraterEjectaFactor: number; // the young-crater drill zone: within this times a young crater's or rocky area's radius
  boulderTrackPhotoRangeM: number; // Boulder track: the rolled boulder in frame from within this distance
  documentedSampleRangeM: number; // Documented sample: a boulder read this mission, in frame from within this distance
  hydrogenZoneRadiusM: number; // the hidden hydrogen zone: a circle this wide around its site; the meter reads neutron.anomalyEdge at its edge
  // A boulder photo's line of sight (world/moonScene.ts inFrame): the terrain is sampled every photoLosStepM
  // from the camera, must stay photoLosClearanceM below the sight line, and the last photoLosTailM before the
  // boulder are not tested (the ground it rests on).
  photoLosStepM: number;
  photoLosClearanceM: number;
  photoLosTailM: number;
}

/** Orbital survey leads: rough bearings to areas of interest, given at the landing briefing. */
export interface SurveyTuning {
  /** site: a terrain.json feature key (craterDescent, shadowedCrater) or feature name (Rocky area 1). */
  leads: { id: string; site: string }[];
  roundKmBelow1: number; // lead distances under 1 km are rounded to this many km...
  roundKmAbove1: number; // ...and longer ones to this many
}

/** The Sun's path over the mission. Azimuths follow terrain.json: from local -z, turning toward +x. */
export interface SunTuning {
  startAzimuthDeg: number; // subsolar longitude at mission start
  degreesPerEarthDay: number; // the azimuth decreases this much per Earth day (360 / 29.53)
  subsolarLatitudeDeg: number; // constant over one mission; sets the mean Sun elevation
}

/** Vehicle handling shared by every build. Part effects (mass, speed, grip) come on top. */
export interface RoverHandling {
  startHeadingDeg: number; // azimuth the rover faces at landing
  body: { lengthM: number; widthM: number; heightM: number };
  wheelRadiusM: number;
  wheelTrackM: number; // left-right distance between wheel centers
  wheelBaseM: number; // front-back distance between wheel centers
  centerOfMassDropM: number; // center of mass below the body center: keeps the rover planted in low gravity
  suspension: {
    restLengthM: number;
    maxTravelM: number;
    stiffness: number; // per unit of rover mass, so heavier rovers sag the same
    compression: number; // damping while compressing
    relaxation: number; // damping while extending
  };
  accelerationMps2: number;
  brakeDecelMps2: number;
  reverseSpeedFactor: number; // reverse top speed as a share of forward top speed
  gripToFrictionSlip: number; // wheel grip (0..1) times this = tire friction coefficient
  sideFrictionStiffness: number;
  maxSteerDeg: number;
  maxLateralAccelMps2: number; // steering lock shrinks with speed so a full turn stays below this
  steerRateDegPerSecond: number;
  /**
   * Gravity on the rover body on the ground, as a multiple of the world's gravity (mission.gravity). Driving is compressed ~4×
   * like time; a true time-lapse would also scale accelerations by 4² = 16, which would stop the rover
   * climbing. airGravityScale applies the time-lapse value while the wheels are off the ground.
   */
  gravityScale: number;
  /**
   * Gravity scale while all four wheels are off the ground (in between for one to three wheels off).
   * 16 = the time-lapse value: a hop over a bump lasts and rises as it would for a real rover at real speed.
   */
  airGravityScale: number;
  angularDamping: number;
}

export interface EventSpec {
  windowsSeconds: [number, number][]; // one event at a random time inside each window
  warningSeconds: number;
  damage: number;
}

/** A real past solar flare from NASA's DONKI database. */
export interface RealFlare {
  date: string; // YYYY-MM-DD (UTC)
  peakUtc: string; // HH:MM
  class: string; // GOES X-ray class, e.g. "X9.3"
  donkiId: string;
}

export interface FlareSpec extends EventSpec {
  shelterSunlight: number; // a rover receiving less sunlight than this is sheltered in shadow
  damagePerX?: number; // extra damage per X-class unit above X1; `damage` is the X1 baseline
  source: string;
  realFlares: RealFlare[];
}

export interface QuakeSpec extends EventSpec {
  shakeSeconds: number;
}

/** Each world has its own events: the Moon has flares and quakes, Mars a dust storm (data/mars/events.json). */
export interface EventsFile {
  flare?: FlareSpec;
  quake?: QuakeSpec;
  duststorm?: DustStormSpec;
  dustdevil?: DustDevilSpec; // Mars (rules/dust.ts)
}

export interface SharedTextFile {
  moneyPrefix: string;
  moneySuffix: string;
  moneyNote: string;
  title: Record<'heading' | 'subtitle' | 'kicker' | 'coverCaption' | 'newCampaign' | 'continueCampaign', string>;
  slots: Record<BusSlot | 'instrument', string> & Partial<Record<SupportSlot, string>>; // support slot names come with the world that offers them
  design: Record<
    | 'heading' | 'tutorial' | 'overTopTier' | 'overBudget' | 'chassisOverloaded' | 'belowMinimum' | 'tierSaving'
    | 'speedInfoButton' | 'speedInfoTitle' | 'speedInfoBuild' | 'speedInfoSources' | 'slotEmpty' | 'slotsEmpty' | 'tierSoFar'
    | 'previewLabel' | 'previewEmpty' // the live 3D build preview (aria label, empty-state hint)
    | 'bayHint' | 'bayPoints' | 'bayNoChassis' | 'bayFull' | 'bayNone' | 'bayNoneChosen' | 'bayDropped' | 'bayOverCapacity' | 'bayKey' // the payload bay
    | 'notOffered' // parts a carried build lost because this world does not offer them ({parts}; reworded per world)
    | 'instrumentEnergy' | 'instrumentEnergyItem' | 'instrumentEnergyNone' | 'instrumentMilestones' | 'instrumentMilestonesJoin' | 'energyPerUse' | 'energyStandby' | 'useHold', // instrument operating costs
    string
  > & {
    speedInfo: string[]; // the optional real-speed pop-up, one paragraph per entry
    /** By instrument: a desk card's short line on where the instrument is used (Mars step 6d; none on the Moon). Names places, never a lesson. */
    instrumentWhere?: Partial<Record<Instrument, string>>;
  };
  ticket: Record<
    'heading' | 'briefing' | 'tierRule' | 'whySmallest' | 'whyPushed' | 'whyNone' | 'massOver' | 'sizeOver' | 'and',
    string
  >;
  review: Record<'heading' | 'intro' | 'empty' | 'green' | 'yellow' | 'blocked' | 'hardBlock', string>; // the pre-launch review on the ticket screen
  notebook: Record<
    | 'open' | 'openTitle' | 'openMission' | 'unread' | 'heading' | 'count' | 'intro' | 'empty' | 'worldEmpty' | 'answers' | 'source' | 'newBadge' | 'close' | 'closeHint',
    string
  > & { worlds: Record<MissionId, string> }; // the engineering notebook; worlds: each world's section heading
  landing: Record<'heading' | 'briefing', string>;
  survey: Record<
    | 'heading' | 'intro' | 'lead' | 'hudHeading' | 'hudLead' | 'found' | 'legendLead' | 'shadowedCraterName' | 'loading'
    | 'foundNote' // {name}, {note}: a found site with its note (siteNotes, else siteKindNotes)
    | 'siteLineDocumented', // with the camera and the X-ray spectrometer aboard, at young craters and rocky areas: {documentedRange}
    string
  > & {
    siteNotes: Record<string, string>; // by sites.json id: what the site is, after "Located: {name}, "
    siteKindNotes: Partial<Record<SiteKind, string>>; // the same by site kind, for a site with no note of its own
    /** By site kind, then instrument: what that instrument can do there, shown only for instruments aboard. {photoRange} */
    siteLines: Partial<Record<SiteKind, Partial<Record<Instrument, string>>>>;
    leads: Record<string, { name: string; source: string }>; // by lead id in tuning.survey
    compass: string[]; // 16 points from north, full words
    compassShort: string[]; // 16 points from north, abbreviated
  };
  mission: Record<'heading' | 'briefing' | 'controls' | 'boundary' | 'loading' | 'loadFailed', string>; // loadFailed: {error}
  hud: Record<
    | 'energy' | 'damage' | 'cold' | 'sunlit' | 'shadow' | 'powerDown' | 'powerUp' | 'poweredDown' | 'minimap'
    | 'endedHeading' | 'endedSurvived' | 'endedFailed' | 'lasted' | 'toDebrief'
    | 'legendLander' | 'legendViewpoint' | 'legendCrater' | 'legendCold'
    | 'legendYoungCrater' | 'legendColdTrap' | 'legendRolledBoulder' | 'legendHydrogen' | 'legendDone', // the Moon sites (Moon sites plan, Phase 5)
    string
  >;
  warnings: Record<
    | 'lowEnergy' | 'highDamage' | 'cold' | 'steepSlope' | 'slip' | 'noLights' | 'poweredDown'
    | 'flareWarning' | 'flareHit' | 'flareSafe' | 'quake' | 'impact',
    string
  >;
  debrief: Record<
    | 'heading' | 'survived' | 'failedRound' | 'passedRound' | 'cause' | 'rollover' | 'milestonesHeading' | 'noMilestones'
    | 'recordHeld' | 'payoutHeading' | 'survivalPayout' | 'milestoneMoney' | 'penalty' | 'net' | 'rpEarned' | 'balance'
    | 'albumHeading' | 'noPhotos' | 'historyHeading' | 'restart' | 'continue'
    | 'logRockTypes' | 'logEarned' | 'logEarnedJoin' | 'stagedCount' | 'groupRover' | 'groupCombo' | 'notReachedHeading' | 'notReachedNote' // Moon sites plan, Phase 5
    | 'notReachedNeeds' // a "Not reached" line naming the support part the rover lacked: {name}, {needs} (Mars M18)
    | 'logHeading' | 'logNote' | 'logRock' | 'logNoRocks' | 'logQuakeClean' | 'logQuakeNoisy' | 'logQuakeMissed' | 'logQuakeNone' | 'logStationNone' | 'logReflector' | 'logReflectorNone' | 'logHydrogen' | 'logHydrogenNone'
    | 'taughtHeading' | 'taughtNote' | 'taughtAnswers' | 'taughtSource', // "What the rover taught us": the relationships met
    string
  >;
  causes: Record<DeathCause, string>;
  history: Record<HistoryKey, string>;
  historySources: Record<HistoryKey, string>;
  /** Each world's name, for the credits and the campaign summary. */
  worlds: Record<MissionId, string>;
  /** After the last playable mission ("Titan: coming soon"): banked RP and the campaign summary. */
  comingSoon: Record<
    | 'heading' | 'body' | 'rpBanked' | 'balance' | 'backToTitle' | 'summaryHeading' | 'colMission' | 'colOutcome'
    | 'colNet' | 'colRp' | 'colMilestones' | 'completed' | 'records' | 'noLog',
    string
  >;
  milestone: Record<'reached' | 'stage' | 'reward' | 'record' | 'recordHeld' | 'notCredited' | 'categoryCapability' | 'categoryScientific' | 'categoryRecord' | 'categoryPicture', string>;
  instruments: Record<
    | 'buttonsLabel' | 'photoTaken' | 'photoNoZone' | 'photoAlbumFull'
    | 'viewpointHint' | 'earthHint' | 'iceSearchHint' | 'drillDone' | 'drillIce' | 'drillNoIce' | 'drillNearLander' | 'drillSameSite' | 'earthDarkHint' | 'earthTooCloseHint' | 'partialCrossingHint'
    | 'captionEarth' | 'captionDay' | 'captionSurface'
    | 'holding' | 'useMoving' | 'usePoweredDown' | 'useBusy' | 'useNoEnergy' | 'useSlowCold' | 'useFastShadow' | 'useDeployed'
    | 'useNoEarth' | 'useNoBoulder' | 'standbyLowEnergy' | 'standbyOff' | 'standbyOn' | 'standbyAutoOff' | 'deployedButton'
    | 'hydrogenMeter' | 'earthLight' | 'earthInView' | 'earthHidden' | 'earthInViewTooClose' | 'xrayResult' | 'xrayAgain' | 'xrayNoTarget' | 'seismometerDeployed' | 'reflectorDeployed'
    | 'quakeClean' | 'quakeNoisy' | 'quakeMissed' | 'quakeTrace' | 'boulderHint' | 'neutronHint'
    | 'stationTooCloseHint' | 'stationConfirm' | 'stationPlacedTooClose' // stations inside the near-lander zone: {name} {distance} {key} {seconds}
    | 'xrayNewType', // Rock collection's count after a reading of a new rock type: {count} {total}
    string
  >;
  /** Per instrument: HUD button, controls line, refusal when not carried, and the history fact shown on first use. */
  instrumentText: Record<Instrument, InstrumentText>;
  /** X-ray spectrometer rock types (placeholder content), keyed by tuning.instruments.xray.rocks ids. */
  rocks: Record<string, { name: string; elements: string }>;
  settings: Record<'heading' | 'open' | 'history' | 'historyHelp' | 'back', string>;
  tutorial: Record<
    | 'label' | 'designHeading' | 'driveHeading' | 'help' | 'helpDesign' | 'helpDrive'
    | 'next' | 'back' | 'skip' | 'done' | 'step' | 'reopen' | 'tierItem' | 'tierJoin',
    string
  > & { design: TutorialPage[]; drive: TutorialPage[] };
  credits: Record<
    | 'open' | 'heading' | 'intro' | 'disclaimer'
    | 'terrain' | 'imagery' | 'spaceWeather' | 'soil' | 'milestones' | 'debrief' | 'generatedHeading' | 'generated'
    | 'loading' | 'loadFailed' | 'imageryFallback' | 'provider' | 'imageCredit' | 'license' | 'productPage'
    | 'flaresUsed' | 'speedLabel' | 'instrumentsLabel' | 'relationshipsLabel' | 'survivedLabel' | 'back',
    string
  > & { terrainFallback: string[]; soilEntries: CreditEntry[] };
}

/** text.json, with the Mars-only sections that data/mars/text.json adds. */
export type TextFile = SharedTextFile & Partial<MarsTextSections>;

/** An instrument's mission text. {key} is its mission key; controls may also use {energy} and {standby}. */
export interface InstrumentText {
  button: string; // HUD button label
  controls: string; // the controls line under the HUD buttons
  notCarried: string; // the notice when it is used on a rover that does not carry it
  holding?: string; // the hint while the rover holds still for it (default: instruments.holding)
  fact?: string; // one real-history sentence, shown on first use when Mission history is on
  source?: string; // where the fact comes from (credits)
  // Mars instruments (Mars step 4a). Placeholders as noted; absent where the instrument has no such notice.
  slope?: string; // a contact reading refused on ground steeper than the arm's limit: {name} {slope} {max}
  noTarget?: string; // the laser: no target in the cone ahead: {reach}
  target?: string; // the laser's target readout: {target} {distance} {key}
  targetBoulder?: string; // the laser target's name: a boulder
  targetCliff?: string; // ...the delta cliff
  result?: string; // a finished reading: the laser on a boulder {rock} {elements}; the organics spectrometer
  resultCliff?: string; // the laser on the delta cliff
  stopped?: string; // a reading charged as it runs, stopped because the battery could not pay for the rest: {name}
  forecast?: string; // the weather mast: the earlier storm forecast, crediting the mast: {sols} and the mission vars
  readout?: string; // the weather mast's HUD line: {pressure} {pressureTrend} {tau} {dustTrend}
  trend?: Record<'rising' | 'falling' | 'steady', string>; // the weather readout's trend arrows
  strip?: string; // the radar strip's label: {meters} of unbroken profile
  layers?: Record<string, string>; // the radar's layer kinds (tuning.instruments.radar), for the strip and the log
  log?: string; // the debrief's instrument log line (placeholders per instrument, see ui/screens.ts)
  logNone?: string; // ...when it was carried but recorded nothing
  logStorm?: string; // the weather mast: added to its log line when it forecast the dust storm early
}

/** One page of a tutorial. {name} placeholders are filled from the game data. */
export interface TutorialPage {
  title: string;
  body: string[]; // one paragraph per entry
  instrument?: Partial<Record<Instrument, string>>; // shown only for the instruments carried, in bay order; {key} is the mission key
}

/** A hand-written credits entry, for sources with no metadata in the data files. */
export interface CreditEntry {
  label: string;
  text?: string;
  citation?: string;
  url?: string;
}

export interface GameData {
  /** The world this data is for: its overlay is merged in, and parts and relationships are filtered to it. */
  world: MissionId;
  /** The parts this world offers (Part.worlds), with the world's wording. */
  parts: PartsFile;
  /** Every world's parts, with this world's wording: to name the parts a carried build loses, and to check references. */
  allParts: PartsFile;
  tiers: TiersFile;
  milestones: MilestonesFile;
  tuning: Tuning;
  events: EventsFile;
  text: TextFile;
  relationships: RelationshipsFile;
  sites: SitesFile;
}

/**
 * Kinds of site in sites.json (Moon sites and milestones plan, section 2). Mars (data/mars/sites.json, Mars
 * sites plan section 2) reuses young-crater, rocky-area and hidden-hydrogen (the hydrated ground), and adds
 * knob (slope targets), seitah-edge (firm ground at Séítah's edge), delta-foot and flood-boulder.
 */
export type SiteKind = 'young-crater' | 'rocky-area' | 'cold-trap' | 'rolled-boulder' | 'hidden-hydrogen'
  | 'knob' | 'seitah-edge' | 'delta-foot' | 'flood-boulder';
/** The terrain.json feature lists the pipeline adds for the Moon sites (plan, Phase 1, P1 to P4). */
export type PipelineFeatureList = 'coldTraps' | 'youngCraters' | 'boulderTrackCandidates' | 'lowLightPatches';

/**
 * One site in data/sites.json: a design choice on top of the terrain (which crater holds the rolled
 * boulder, which low-light slope is the hidden hydrogen, each site's rock suite, display names). Where it
 * is comes in one of three ways: an existing terrain.json feature (`feature`), a pipeline feature by id
 * (`pipeline`), or a candidate position until the pipeline confirms it (`provisional` with `local`).
 */
export interface SiteSpec {
  id: string; // stable, for code and other entries (within)
  kind: SiteKind;
  name: string; // display name; tuning.cold.zones names cold traps by it
  feature?: string; // an existing terrain.json feature: key (shadowedCrater) or name (Rocky area 1)
  pipeline?: { list: PipelineFeatureList; id: string }; // a feature the pipeline produced, by its id
  /**
   * Mars: the terrain.json feature this site's `local` is copied from, as a dotted path from `features`
   * (deltaFront.floodBoulder, seitah.entryPoint); in a list, the item's id is the next segment
   * (slopeTargets.slope-targets-knob-wnw). The data test checks the path exists and, where the feature has
   * a `local`, that it matches. rules/sites.ts reads `local` until it resolves the path itself.
   */
  terrain?: string;
  provisional?: boolean; // true: `local` (and `radiusM`) are candidates from the plan, not yet confirmed by the pipeline
  local?: { x: number; z: number }; // the site's center in the local frame
  radiusM?: number; // young crater and cold trap radius (a provisional cold trap is a circle until the pipeline gives its outline)
  rockSuite?: string; // a key in tuning.instruments.xray.suites: what the X-ray spectrometer reads at this site's boulders
  within?: string; // rolled boulder: the id of the young crater it lies in
  note?: string; // where the values come from
}

/** data/sites.json (the Moon's) and data/mars/sites.json (Mars's, which replaces it whole). */
export interface SitesFile {
  sites: SiteSpec[];
}

interface FeaturePoint { x: number; y?: number; z: number }

/**
 * The pipeline's new Moon terrain.json feature lists (plan, Phase 1 table). Every field optional: the
 * pipeline owns the shape; the game reads what it needs and validation only relies on `id`.
 */
export interface MoonPipelineFeatures {
  /** P1: permanent-shadow patches in the play area (LOLA 60 m, PSR >= 0.5) over 2,000 m². */
  coldTraps?: {
    id?: string;
    name?: string;
    centroidLocal?: FeaturePoint;
    outlineLocal_xz?: number[][]; // [x, z] pairs (number[][] as JSON gives it)
    area_m2?: number;
    distanceFromLanding_m?: number;
    driveDistanceFromLanding_m?: number;
    avgIllumination?: number;
  }[];
  /** P2: small fresh craters 40 to 150 m across within 1.6 km. */
  youngCraters?: {
    id?: string;
    name?: string;
    local?: FeaturePoint;
    radius_m?: number;
    depth_m?: number;
    avgIllumination?: number;
    earthVisibility?: number;
  }[];
  /** P3: points at the foot of walls steeper than 25° with a 50 to 150 m run below, with the wall's top point. */
  boulderTrackCandidates?: {
    id?: string;
    name?: string;
    local?: FeaturePoint;
    wallTop?: FeaturePoint; // the top of the run the boulder rolled down (its track runs from here to local)
    youngCrater?: string | null; // the young crater it lies in, if any
  }[];
  /** P4: ground outside permanent shadow with average illumination under 15% and slope under 15°, within 1 km. */
  lowLightPatches?: {
    id?: string;
    name?: string;
    centroidLocal?: FeaturePoint;
    innerPoint?: FeaturePoint; // the point farthest inside the patch (the centroid of a curved patch can lie near its edge)
    outlineLocal_xz?: number[][]; // [x, z] pairs (number[][] as JSON gives it)
    area_m2?: number;
    avgIllumination?: number;
    slope_deg?: number;
  }[];
}

/** The kinds of relationship between parts (rover-engineering-design.md, section 10). */
export type RelationshipKind = 'needs' | 'conditions' | 'conflicts' | 'shares' | 'wear';

/** The pre-launch review's status colors: fine, a risk to plan around, something will not work. */
export type ReviewColor = 'green' | 'yellow' | 'red';

/** What the player reads when a relationship happens: the mission notice, the debrief's why, the answers. */
export interface RelationshipLesson {
  notice: string; // shown in the mission the first time it happens (placeholders from FIRED_RELATIONSHIPS, filled by the mission screen)
  debrief: string; // what happened and why, for the debrief and the notebook
  answers: string[]; // at least two ways to solve it
}

/**
 * One relationship between parts. When it happens, and which builds trigger it, is code in
 * rules/relationships.ts, keyed by id; the text and the review color live here. A hard block
 * (`hardBlock`) is red and the pre-launch review always shows it for a build that triggers it, even
 * before it is discovered. Every relationship the mission fires has a lesson and a real fact.
 */
export interface Relationship extends Partial<RelationshipLesson> {
  id: string;
  world: MissionId; // the mission, the review and the notebook show only the current world's
  kind: RelationshipKind;
  name: string; // a short title, for the debrief, the notebook and the review
  parts: string[]; // part ids involved (the cause at the desk)
  review: ReviewColor;
  reviewText: string; // the pre-launch review's line (without the color word; the review shows the color)
  reviewSolved?: string; // the review's line when the build carries the answer (shown green)
  hardBlock?: boolean;
  fact?: string; // the real mission behind it (debrief with Mission history on; always in the notebook)
  source?: string;
}

/** data/relationships.json */
export interface RelationshipsFile {
  relationships: Relationship[];
}

/**
 * A rover build: one part id per bus slot, plus the payload bay (instrument part ids, in bay order), and
 * one part id per support slot on a world that offers them (absent on the Moon, so every Moon build and
 * save stays valid as it is).
 */
export type Build = Record<BusSlot, string> & { payload: string[]; support?: Partial<Record<SupportSlot, string>> };
/**
 * A build on the design screen: a new campaign starts with every slot empty. `payload` undefined: the
 * player has not confirmed the bay yet; `[]`: a confirmed empty bay.
 */
export type DraftBuild = Partial<Record<BusSlot, string>> & { payload?: string[]; support?: Partial<Record<SupportSlot, string>> };
