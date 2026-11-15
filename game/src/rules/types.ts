// Types for the JSON files in game/data/. These are the data contract.
import type { DamageCause } from './damage';

export type Slot = 'chassis' | 'wheels' | 'power' | 'battery' | 'lights' | 'heater' | 'instrument';
export type Instrument = 'camera' | 'drill';

export interface PartEffects {
  maxLoad?: number; // chassis: kg of total rover mass it can carry
  baseSpeed?: number; // wheels: m/s
  grip?: number; // wheels: 0..1, higher = less slip
  energyPerMeter?: number; // wheels: energy per meter at reference mass
  energyIncome?: number; // power: energy per second in full sun
  batteryCapacity?: number; // battery: energy units
  lightRange?: number; // lights: meters
  heat?: number; // heater: heat units, slows freezing
  instrument?: Instrument; // instrument slot
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
}

export interface PartsFile {
  slots: Slot[];
  parts: Part[];
  defaultBuild: Build; // what the design screen starts with in a new campaign
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

export type MilestoneTrigger =
  | { type: 'landing' }
  | { type: 'distance'; meters: number[] } // one reward per threshold reached
  | { type: 'explore'; share: number }
  | { type: 'zone'; zone: string; mode: 'enter-and-exit' | 'cross' }
  | { type: 'photo'; zone?: string; target?: string }
  | { type: 'drill'; zone?: string }
  | { type: 'event'; event: 'flare' | 'quake'; condition: 'no-damage' }
  /** no-damage: no damage from any cause except those listed (moonquakes cannot be avoided). */
  | { type: 'survive'; condition?: 'no-damage'; except?: DamageCause[] };

export interface MilestoneRequirements {
  slots?: Slot[]; // the part in each slot must have a non-zero capability effect
  instrument?: Instrument;
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
  fact: string; // one real-history sentence, shown only when the Mission history setting is on
  source?: string; // where the fact comes from (not shown in the pop-up)
}

export interface MilestonesFile {
  milestones: Milestone[];
}

export type DeathCause = 'energy' | 'stuck' | 'froze' | 'destroyed';
/** Debrief real-rover comparisons: one per ending; a rollover is 'destroyed' with its own comparison. */
export type HistoryKey = DeathCause | 'survived' | 'rollover';
export type MissionId = 'moon' | 'mars';

export interface Tuning {
  mission: { lengthSeconds: number; gameDays: number; gravity: number };
  budget: { startingBudget: number; minimumBudget: Record<MissionId, number> };
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
  /** Boulders scattered in the rocky areas (fresh craters): most are small, a few reach maxDiameterM. */
  boulders: {
    perRockyArea: number;
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
  milestones: MilestoneTuning;
}

/** Zone sizes and actions for the milestones (zones come from terrain.json features). */
export interface MilestoneTuning {
  photoZoneRadiusM: number; // viewpoint zones: a circle this wide around each terrain.json viewpoint
  iceSpotRadiusM: number; // drilling within this distance of the hidden ice spot finds ice
  boulderCrossRadiusFactor: number; // a rocky area's zone is its radius times this (where the boulders lie)
  boulderCrossMinAngleDeg: number; // "cross": entry and exit points at least this far apart around the center
  craterDescentDepthM: number; // de Gerlache's inner wall: at least this far below the landing point...
  craterDescentExitDepthM: number; // ...and back out: climb back above this depth below landing
  drillSeconds: number; // mission seconds the rover stands still while drilling
  albumMax: number; // photos kept per mission
  photoFrameMargin: number; // Earth counts as in view inside this share of the frame (NDC)
  sampleMinDistanceM: number; // drill samples count only this far from the landing point (ground the lander disturbed)
  earthPhotoMinLit: number; // the Earth photo counts only when at least this share of Earth's disc is lit (its phase)
  hydrogenSignal: boolean; // drill samples in the dark crater report a hydrogen signal that grows nearer the ice (off: no clue)
  hydrogenStrongWithinM: number; // "strong" within this distance of the ice spot center...
  hydrogenModerateWithinM: number; // ..."moderate" within this one, "weak" farther away
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
   * Gravity on the rover body as a multiple of lunar gravity. Driving is compressed ~4× like time;
   * a true time-lapse would also scale accelerations by 4² = 16. A smaller factor keeps the rover
   * on the ground at compressed speeds while keeping some lunar float.
   */
  gravityScale: number;
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

export interface EventsFile {
  flare: EventSpec & {
    shelterSunlight: number; // a rover receiving less sunlight than this is sheltered in shadow
    damagePerX?: number; // extra damage per X-class unit above X1; `damage` is the X1 baseline
    source: string;
    realFlares: RealFlare[];
  };
  quake: EventSpec & { shakeSeconds: number };
}

export interface TextFile {
  moneyPrefix: string;
  moneySuffix: string;
  moneyNote: string;
  title: Record<'heading' | 'subtitle' | 'newCampaign' | 'continueCampaign', string>;
  slots: Record<Slot, string>;
  design: Record<
    | 'heading' | 'tutorial' | 'overTopTier' | 'overBudget' | 'chassisOverloaded' | 'belowMinimum' | 'tierSaving'
    | 'speedInfoButton' | 'speedInfoTitle' | 'speedInfoBuild' | 'speedInfoSources',
    string
  > & { speedInfo: string[] }; // speedInfo: the optional real-speed pop-up, one paragraph per entry
  ticket: Record<
    'heading' | 'briefing' | 'tierRule' | 'whySmallest' | 'whyPushed' | 'whyNone' | 'massOver' | 'sizeOver' | 'and',
    string
  >;
  landing: Record<'heading' | 'briefing', string>;
  mission: Record<'heading' | 'briefing' | 'controls' | 'boundary' | 'loading', string>;
  hud: Record<
    | 'energy' | 'damage' | 'cold' | 'sunlit' | 'shadow' | 'powerDown' | 'powerUp' | 'poweredDown' | 'minimap'
    | 'endedHeading' | 'endedSurvived' | 'endedFailed' | 'lasted' | 'toDebrief'
    | 'legendLander' | 'legendViewpoint' | 'legendCrater' | 'legendCold',
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
    | 'albumHeading' | 'noPhotos' | 'historyHeading' | 'restart' | 'continue',
    string
  >;
  causes: Record<DeathCause, string>;
  history: Record<HistoryKey, string>;
  historySources: Record<HistoryKey, string>;
  marsSoon: Record<'heading' | 'body' | 'rpBanked' | 'balance' | 'backToTitle', string>;
  milestone: Record<'reached' | 'stage' | 'reward' | 'record' | 'recordHeld' | 'notCredited' | 'categoryCapability' | 'categoryScientific' | 'categoryRecord' | 'categoryPicture', string>;
  instruments: Record<
    | 'cameraControls' | 'drillControls' | 'photoTaken' | 'photoNoZone' | 'photoAlbumFull' | 'noCamera' | 'noDrill'
    | 'viewpointHint' | 'earthHint' | 'iceSearchHint' | 'drilling' | 'drillMoving' | 'drillDone' | 'drillIce' | 'drillNoIce' | 'drillNearLander' | 'earthDarkHint'
    | 'captionEarth' | 'captionDay' | 'captionSurface',
    string
  >;
  settings: Record<'heading' | 'open' | 'history' | 'historyHelp' | 'back', string>;
  drill: Record<
    | 'searchHintHydrogen' | 'hydrogenSignal' | 'hydrogenWeak' | 'hydrogenModerate' | 'hydrogenStrong'
    | 'hydrogenHistory' | 'hydrogenSource',
    string
  >;
}

export interface GameData {
  parts: PartsFile;
  tiers: TiersFile;
  milestones: MilestonesFile;
  tuning: Tuning;
  events: EventsFile;
  text: TextFile;
}

/** A rover build: one part id per slot. */
export type Build = Record<Slot, string>;
