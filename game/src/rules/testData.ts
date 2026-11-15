// Small fixed data for unit tests, so tests do not break when game/data/ is re-tuned.
import type { EventsFile, Milestone, Part, PartsFile, Tier, Tuning } from './types';

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
  speed: { compression: 4 },
  energy: { slopeEnergyFactor: 0.05, lowWarningShare: 0.2 },
  damage: {
    max: 100, rockHit: 8, impactMinMps: 3, impactPerMps: 4, impactCooldownSeconds: 0.4,
    steepSlopePerSecond: 4, overloadPerKgSecond: 0.05, highWarningShare: 0.6, rolloverTiltDeg: 75, rolloverSeconds: 0.6,
  },
  cold: {
    freezeMax: 100, freezeRatePerSecond: 4, heaterReductionPerHeat: 1.5, warmRecoveryPerSecond: 6, warningShare: 0.5,
    zones: ['shadowedCrater'], zoneSearchRadiusM: 300, noLightsMarginM: 3,
  },
  ground: {
    maxSlopeDegrees: 20, slopeWarningDegrees: 18, slipLimit: 0.2, stuckSeconds: 5, digRecoveryPerSecond: 0.25,
    normalSinkageCm: [1, 2], softRimSinkageCm: [5, 7], slipPerSinkageCm: 0.03, referenceGrip: 0.55,
    slopeSlipFreeDeg: 10, slipPerUphillDeg: 0.01, softRadiusFactor: 1, softFadeFactor: 1.5, movingSpeedMps: 0.5,
  },
  explore: { cellM: 20, revealRadiusM: 250 },
  minimap: { startSpanM: 700, marginM: 100, maxSpanM: 8000 },
  survey: {
    leads: [{ id: 'boulders', site: 'Rocky area 1' }, { id: 'shadow', site: 'shadowedCrater' }],
    roundKmBelow1: 0.1,
    roundKmAbove1: 0.5,
  },
  boulders: { perRockyArea: 10, spreadRadiusFactor: 1, minDiameterM: 0.4, maxDiameterM: 2, buriedShare: 0.3, seed: 1 },
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
    maxLateralAccelMps2: 3,
    gravityScale: 1,
    airGravityScale: 1,
    steerRateDegPerSecond: 90,
    angularDamping: 1,
  },
  area: { boundaryInsetM: 100, warningDistanceM: 60 },
  milestones: {
    photoZoneRadiusM: 60, iceSpotRadiusM: 50, boulderCrossRadiusFactor: 1.1, boulderCrossMinAngleDeg: 90, partialCrossingHint: true,
    craterDescentDepthM: 150, craterDescentExitDepthM: 100, drillSeconds: 3, albumMax: 12, photoFrameMargin: 0.85,
    sampleMinDistanceM: 200, sampleSpacingM: 200, earthPhotoMinLit: 0.25, earthPhotoMinDistanceM: 300, hydrogenSignal: true, hydrogenStrongWithinM: 100, hydrogenModerateWithinM: 250,
  },
};

const milestone = (id: string, money: number, rp: number, extra: Partial<Milestone> = {}): Milestone => ({
  id, name: id, category: 'capability', record: false, trigger: { type: 'landing' }, requires: {}, money, rp, summary: '', fact: '', ...extra,
});

export const testMilestones: Milestone[] = [
  milestone('touchdown', 150, 5, { category: 'record', record: true }),
  milestone('odometer', 30, 2, { trigger: { type: 'distance', meters: [500, 1000, 2000] } }),
  milestone('boulders', 50, 3),
  milestone('layers', 20, 25, { category: 'scientific', requires: { instrument: 'camera' } }),
  milestone('dark', 80, 5, { requires: { slots: ['lights', 'heater'] } }),
];

export const testEvents: EventsFile = {
  flare: {
    windowsSeconds: [[60, 120], [180, 260]],
    warningSeconds: 5,
    damage: 25,
    shelterSunlight: 0.1,
    source: 'test',
    realFlares: [
      { date: '2017-09-06', peakUtc: '12:02', class: 'X9.3', donkiId: 'a' },
      { date: '2024-10-03', peakUtc: '12:18', class: 'X9.0', donkiId: 'b' },
      { date: '2024-05-14', peakUtc: '16:51', class: 'X8.7', donkiId: 'c' },
    ],
  },
  quake: { windowsSeconds: [[90, 240]], warningSeconds: 0, damage: 10, shakeSeconds: 3 },
};
