// Small fixed data for unit tests, so tests do not break when game/data/ is re-tuned.
import type { Milestone, Part, PartsFile, Tier, Tuning } from './types';

const part = (id: string, slot: Part['slot'], cost: number, mass: number, size: number, effects: Part['effects'] = {}): Part => ({
  id, slot, name: id, description: '', cost, mass, size, effects,
});

export const testParts: PartsFile = {
  slots: ['chassis', 'wheels', 'power', 'battery', 'lights', 'heater', 'instrument'],
  parts: [
    part('steel', 'chassis', 60, 30, 5, { maxLoad: 80 }),
    part('titanium', 'chassis', 160, 15, 4, { maxLoad: 70 }),
    part('solid', 'wheels', 30, 20, 4),
    part('mesh', 'wheels', 70, 10, 5),
    part('panel', 'power', 40, 10, 4),
    part('battery', 'battery', 30, 10, 2),
    part('lamp', 'lights', 15, 5, 1, { lightRange: 20 }),
    part('no-lights', 'lights', 0, 0, 0, { lightRange: 0 }),
    part('heater', 'heater', 20, 5, 1, { heat: 1 }),
    part('camera', 'instrument', 50, 5, 1, { instrument: 'camera' }),
    part('drill', 'instrument', 90, 10, 5, { instrument: 'drill' }),
  ],
};

export const testTiers: Tier[] = [
  { id: 'small', name: 'Small', massLimit: 60, sizeLimit: 20, price: 80 },
  { id: 'medium', name: 'Medium', massLimit: 80, sizeLimit: 24, price: 160 },
  { id: 'large', name: 'Large', massLimit: 100, sizeLimit: 28, price: 300 },
];

export const testTuning: Tuning = {
  mission: { lengthSeconds: 300, gameDays: 14, gravity: 1.62 },
  budget: { startingBudget: 750, minimumBudget: { moon: 450, mars: 300 } },
  payout: {
    survivalPayout: 250,
    deathPenalty: { energy: 100, stuck: 200, froze: 300, destroyed: 400 },
    penaltyMinFraction: 0.25,
  },
  mass: { referenceMass: 60, speedLossPerKg: 0.006, minSpeedFactor: 0.4, energyGainPerKg: 0.01 },
  energy: { slopeEnergyFactor: 0.05 },
  damage: { max: 100, rockHit: 8, steepSlopePerSecond: 4, overloadPerSecond: 0.2 },
  cold: { freezeMax: 100, freezeRatePerSecond: 4, heaterReductionPerHeat: 1.5, warmRecoveryPerSecond: 6 },
  ground: { maxSlopeDegrees: 20, slipLimit: 0.2, stuckSeconds: 4, normalSinkageCm: [1, 2], softRimSinkageCm: [5, 7] },
  sun: { startAzimuthDeg: 20, degreesPerEarthDay: 12, subsolarLatitudeDeg: -1 },
  earth: { azimuthDeg: 0, elevationDeg: 0.6 },
  rover: {
    startHeadingDeg: 0,
    body: { lengthM: 1.8, widthM: 1.3, heightM: 0.45 },
    wheelRadiusM: 0.3,
    wheelTrackM: 1.5,
    wheelBaseM: 1.4,
    centerOfMassDropM: 0.3,
    suspension: { restLengthM: 0.35, maxTravelM: 0.25, stiffness: 12, compression: 3, relaxation: 3.5 },
    accelerationMps2: 1,
    brakeDecelMps2: 2,
    reverseSpeedFactor: 0.5,
    gripToFrictionSlip: 1.5,
    sideFrictionStiffness: 1,
    maxSteerDeg: 30,
    steerRateDegPerSecond: 90,
    angularDamping: 1,
  },
  area: { boundaryInsetM: 100, warningDistanceM: 60 },
};

const milestone = (id: string, money: number, rp: number, extra: Partial<Milestone> = {}): Milestone => ({
  id, name: id, category: 'capability', record: false, trigger: { type: 'landing' }, requires: {}, money, rp, fact: '', ...extra,
});

export const testMilestones: Milestone[] = [
  milestone('touchdown', 150, 5, { category: 'record', record: true }),
  milestone('odometer', 30, 2, { trigger: { type: 'distance', meters: [500, 1000, 2000] } }),
  milestone('boulders', 50, 3),
  milestone('layers', 20, 25, { category: 'scientific', requires: { instrument: 'camera' } }),
  milestone('dark', 80, 5, { requires: { slots: ['lights', 'heater'] } }),
];
