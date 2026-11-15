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
  mass: { referenceMass: number; speedLossPerKg: number; energyGainPerKg: number };
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
  design: Record<'heading' | 'tutorial' | 'overTopTier' | 'overBudget' | 'chassisOverloaded' | 'belowMinimum', string>;
  ticket: Record<'heading' | 'briefing', string>;
  landing: Record<'heading' | 'briefing', string>;
  mission: Record<'heading' | 'briefing', string>;
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
