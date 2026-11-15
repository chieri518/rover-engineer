// Types for the JSON files in game/data/. These are the data contract.

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
  | { type: 'survive'; condition?: 'no-damage' };

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
  fact: string;
}

export interface MilestonesFile {
  milestones: Milestone[];
}

export type DeathCause = 'energy' | 'stuck' | 'froze' | 'destroyed';
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
  energy: { slopeEnergyFactor: number };
  damage: { max: number; rockHit: number; steepSlopePerSecond: number; overloadPerSecond: number };
  cold: {
    freezeMax: number;
    freezeRatePerSecond: number;
    heaterReductionPerHeat: number;
    warmRecoveryPerSecond: number;
  };
  ground: {
    maxSlopeDegrees: number;
    slipLimit: number;
    stuckSeconds: number;
    normalSinkageCm: [number, number];
    softRimSinkageCm: [number, number];
  };
  sun: SunTuning;
  earth: { azimuthDeg: number; elevationDeg: number };
  rover: RoverHandling;
  area: {
    boundaryInsetM: number; // the operating boundary sits this far inside the 8 km play area
    warningDistanceM: number; // the "leaving the area" notice shows this close to the boundary
  };
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
  windowsSeconds: [number, number][];
  warningSeconds: number;
  damage: number;
}

export interface EventsFile {
  flare: EventSpec & { realFlares: { date: string; class: string }[] };
  quake: EventSpec & { faultDamageMultiplier: number };
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
  debrief: Record<'heading' | 'survived' | 'failedRound' | 'passedRound', string>;
  causes: Record<DeathCause, string>;
  history: Record<DeathCause | 'survived', string>;
  marsSoon: Record<'heading' | 'body', string>;
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
