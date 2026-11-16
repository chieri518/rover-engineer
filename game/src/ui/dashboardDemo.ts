// A fake finished campaign for looking at the Campaign complete dashboard without playing it:
// ?dashboard=demo (all three missions passed), ?dashboard=demo-lost (Titan lost: out of energy) and
// ?dashboard=demo-old (an older save with stats for Titan only). Never saved (Game.debugComplete).
// The rounds go through the real rules (quoteBuild, missionPayout, buildRoundStats) on the real data;
// only the measured values (distance, energy, nights) are made up.
import type { CampaignState, MissionLogEntry } from '../rules/campaign';
import { missionPayout, type EarnedMilestone, type MissionResult } from '../rules/payout';
import { quoteBuild } from '../rules/quote';
import { buildRoundStats, type NightSpent, type RoundStats } from '../rules/roundStats';
import type { Build, GameData, MissionId } from '../rules/types';
import type { WorldId } from '../worlds';

export type DemoVariant = 'demo' | 'demo-lost' | 'demo-old';

export function isDemoVariant(v: string | null): v is DemoVariant {
  return v === 'demo' || v === 'demo-lost' || v === 'demo-old';
}

interface DemoRound {
  mission: MissionId;
  build: Build;
  survived: boolean;
  secondsLasted: number;
  earned: EarnedMilestone[];
  distanceM: number;
  energyUsed: number;
  lowestShare: number; // share of the battery
  peakColdShare: number; // share of the freeze maximum
  samples: number;
  photos: number;
  nights: NightSpent[] | null;
}

const bus = (chassis: string, wheels: string, power: string, battery: string, lights: string, heater: string, payload: string[]): Build =>
  ({ chassis, wheels, power, battery, lights, heater, payload });

function rounds(variant: DemoVariant): DemoRound[] {
  const titanLost = variant === 'demo-lost';
  return [
    {
      mission: 'moon',
      build: bus('chassis-steel', 'wheels-solid', 'power-fixed-panel', 'battery-li-ion', 'lights-none', 'heater-none', ['instrument-camera']),
      survived: true, secondsLasted: 300,
      earned: [{ id: 'touchdown' }, { id: 'odometer', stages: 2 }, { id: 'crater-descent' }, { id: 'earth-on-horizon' }, { id: 'rim-panorama' }],
      distanceM: 412, energyUsed: 520, lowestShare: 0.31, peakColdShare: 0.12, samples: 0, photos: 3, nights: null,
    },
    {
      mission: 'mars',
      build: bus('chassis-titanium', 'wheels-solid', 'power-fixed-panel', 'battery-nih2', 'lights-led', 'heater-rhu', ['instrument-camera']),
      survived: true, secondsLasted: 600,
      earned: [{ id: 'mars-touchdown' }, { id: 'mars-odometer', stages: 1 }, { id: 'storm-survivor' }, { id: 'night-drive' }, { id: 'blue-sunset' }],
      distanceM: 963, energyUsed: 1840, lowestShare: 0.22, peakColdShare: 0.42, samples: 0, photos: 4,
      nights: ['lights', 'asleep', 'asleep', 'lights', 'asleep', 'asleep', 'dark', 'asleep', 'asleep', 'lights'],
    },
    titanLost
      ? {
        mission: 'titan',
        build: bus('chassis-steel', 'wheels-solid', 'power-fixed-panel', 'battery-nih2', 'lights-led', 'heater-rhu', ['instrument-camera']),
        survived: false, secondsLasted: 612,
        earned: [{ id: 'titan-touchdown' }, { id: 'titan-odometer', stages: 1 }, { id: 'dune-sea' }],
        distanceM: 1046, energyUsed: 600, lowestShare: 0, peakColdShare: 0.71, samples: 0, photos: 2, nights: [],
      }
      : {
        mission: 'titan',
        build: bus('chassis-steel', 'wheels-solid', 'power-fixed-panel', 'battery-nih2', 'lights-led', 'heater-rhu', ['instrument-camera']),
        survived: true, secondsLasted: 900,
        earned: [{ id: 'titan-touchdown' }, { id: 'titan-odometer', stages: 1 }, { id: 'dune-crossing' }, { id: 'titan-dawn' }, { id: 'titan-night-drive' }, { id: 'dune-sea' }],
        distanceM: 1384, energyUsed: 578, lowestShare: 0.04, peakColdShare: 0.63, samples: 0, photos: 2, nights: ['asleep'],
      },
  ];
}

/** A finished campaign with plausible round stats, built from the real game data. */
export function demoCampaign(dataOf: (w: WorldId) => GameData, variant: DemoVariant = 'demo'): CampaignState {
  let balance = dataOf('moon').tuning.budget.startingBudget;
  let rp = 0;
  const records: string[] = [];
  const stats: RoundStats[] = [];
  const log: MissionLogEntry[] = [];
  for (const r of rounds(variant)) {
    const data = dataOf(r.mission);
    const result: MissionResult = {
      survived: r.survived,
      cause: r.survived ? undefined : 'energy',
      secondsLasted: r.secondsLasted,
      earned: r.earned,
    };
    const payout = missionPayout(result, data.milestones.milestones, data.tuning, records);
    balance += payout.money - quoteBuild(r.build, data, balance).totalCost;
    rp += payout.rp;
    records.push(...payout.newRecords);
    const capacity = data.parts.parts.find((p) => p.id === r.build.battery)?.effects.batteryCapacity ?? 0;
    stats.push(buildRoundStats({
      mission: r.mission,
      passed: r.survived,
      result,
      payout,
      measure: {
        distanceM: r.distanceM,
        batteryCapacity: capacity,
        energyUsed: r.energyUsed,
        lowestEnergy: r.lowestShare * capacity,
        peakFreeze: r.peakColdShare * data.tuning.cold.freezeMax,
        samples: r.samples,
        photos: r.photos,
        nights: r.nights,
      },
      build: r.build,
      balanceAfter: balance,
      data,
    }));
    log.push({
      mission: r.mission,
      outcome: r.survived ? 'survived' : 'energy',
      secondsLasted: r.secondsLasted,
      money: payout.money,
      rp: payout.rp,
      milestones: payout.milestones.length,
    });
  }
  return {
    mission: 'complete',
    balance,
    rp,
    records,
    completed: ['moon', 'mars', 'titan'],
    snapshot: null,
    lastBuild: rounds(variant)[2]?.build ?? null,
    log,
    notebook: [],
    stats: variant === 'demo-old' ? stats.filter((s) => s.mission === 'titan') : stats,
  };
}
