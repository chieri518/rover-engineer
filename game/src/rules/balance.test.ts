// The balance report: every build's numbers and any dominated builds. Prints only when asked:
//   BALANCE_REPORT=1 npx vitest run balance
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { allBuilds, dominatedPairs, evaluateBuild, simulate, type BuildEval } from './balance';
import terrain from '../../public/terrain/terrain.json';

const data = loadGameData();
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const report = Boolean(env.BALANCE_REPORT);
const craterM = terrain.features.shadowedCrater.entryPoint.driveDistanceFromLanding_m;

function row(e: BuildEval) {
  const sun = simulate(e.build, data, { sunlight: 1, driveShare: 1 });
  const half = simulate(e.build, data, { sunlight: 0.5, driveShare: 1 });
  const careful = simulate(e.build, data, { sunlight: 0.5, driveShare: 0.7 });
  // To the dark crater entry in mostly sun (0.8), then shadow for the rest of the mission.
  const crater = simulate(e.build, data, { sunlight: (m) => (m < craterM ? 0.8 : 0), driveShare: 1 });
  const end = (r: typeof sun) => (r.end.survived ? `ok ${Math.round((100 * r.energy) / e.battery)}%` : `${r.end.cause} ${Math.round(r.end.seconds)}s`);
  return {
    build: e.label,
    cost: e.cost,
    kg: e.mass,
    size: e.size,
    tier: e.tier ?? 'NONE',
    total: e.total,
    over: e.overloadKg,
    'm/s': +e.topSpeed.toFixed(1),
    crater: Math.round(craterM / e.topSpeed),
    'e/km': Math.round(e.energyPerMeter * 1000),
    bat: e.battery,
    inc: e.income,
    'net sun': +(e.income - e.driveDrain).toFixed(2),
    'shadow km': +(e.battery / e.energyPerMeter / 1000).toFixed(1),
    'sun nonstop': end(sun),
    'half nonstop': end(half),
    'half 70%': end(careful),
    'crater run': `${end(crater)} ${(crater.distanceM / 1000).toFixed(1)}km`,
  };
}

describe('balance report', () => {
  it('evaluates every build', () => {
    const evals = allBuilds(data).map((b) => evaluateBuild(b, data));
    expect(evals).toHaveLength(2 ** data.parts.slots.length);
    if (!report) return;
    const sorted = [...evals].sort((a, b) => a.mass - b.mass);
    console.table(sorted.map(row));
    const pairs = dominatedPairs(evals);
    console.log(`${pairs.length} dominated pairs`);
    for (const [a, b] of pairs.slice(0, 40)) console.log(`  ${a.label} (${a.tier} ${a.total}) beats ${b.label} (${b.tier} ${b.total})`);
    const tiers = new Map<string, number>();
    for (const e of evals) tiers.set(e.tier ?? 'NONE', (tiers.get(e.tier ?? 'NONE') ?? 0) + 1);
    console.log('builds per tier', Object.fromEntries(tiers));
  });
});
