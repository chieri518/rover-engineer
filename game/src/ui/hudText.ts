// Wording for the Mars HUD lines (Mars step 6c): the power line (solar state, the dust factor, a steady
// source), the weather mast's recording state, the crater wall hint and the readout's "New type" line.
// Pure: text in, text out, no DOM; ui/hud.ts shows the results. The Moon keeps its own sunlight line.
import { newRockType } from '../rules/instruments';
import type { MarsHudText } from '../rules/marsTypes';
import type { InstrumentTuning, Milestone, RecordEvent, TextFile } from '../rules/types';
import { fill } from './dom';

/** What the power line reads, one moment of a Mars mission. */
export interface PowerInput {
  solar: boolean; // the rover has solar income (setup.stats.energyIncome > 0)
  steady: boolean; // the rover has a steady source (setup.power.steadyIncome > 0: an RTG)
  sunlight: number; // 0..1, the Sun on the rover past the terrain (the mission's sunlight)
  night: boolean; // MarsStatus.clock.isNight
  storm: boolean; // the dust storm is on (MarsStatus.stormPhase === 'active')
  solarFactor: number; // MarsStatus.solarFactor: low Sun × storm, 0 at night
  dustFactor: number; // MarsStatus.dustFactor: 1 clean
}

/** The power line, and whether it reads dim (no income right now). */
export interface PowerLine {
  text: string;
  dim: boolean;
}

/**
 * The Mars power line: truthful for every power source. A rover with only a steady source reads steady
 * power (never "Solar panel in sunlight"); a solar rover reads its panels' state (night, storm, shadow,
 * low Sun, sunlight) with the dust factor once dust has cut income by at least 1%, and "steady power"
 * after it when it has a steady source too.
 */
export function powerLine(p: PowerInput, t: MarsHudText): PowerLine {
  if (!p.solar) return p.steady ? { text: t.steady, dim: false } : { text: t.none, dim: true };
  const state = p.night ? t.solarNight
    : p.storm ? t.solarStorm
      : p.sunlight <= 0.5 ? t.solarShadow
        : p.solarFactor < 0.5 ? t.solarLowSun
          : t.solarSun;
  const parts = [state];
  const loss = Math.round((1 - p.dustFactor) * 100);
  if (loss >= 1) parts.push(fill(t.dust, { loss }));
  if (p.steady) parts.push(t.steadyToo);
  const solarIn = !p.night && p.sunlight > 0.5 && p.solarFactor > 0;
  return { text: parts.join(t.join), dim: !solarIn && !p.steady };
}

/** A timed weather record the mast can work toward: its event, seconds, and milestone id. */
export interface WeatherRecord {
  id: string;
  event: RecordEvent;
  seconds: number;
}

/** The weather mast's timed records (Storm log, Night weather) from the milestones: `record` with seconds > 0. */
export function weatherRecords(milestones: readonly Milestone[]): WeatherRecord[] {
  return milestones.flatMap((m) => {
    const t = m.trigger;
    return t.type === 'record' && t.instrument === 'weather' && (t.seconds ?? 0) > 0 ? [{ id: m.id, event: t.event, seconds: t.seconds! }] : [];
  });
}

/** One timed record as the mission sees it now. */
export interface RecordingState extends WeatherRecord {
  active: boolean; // the event is on (the storm active; night)
  counted: number; // tracker.recordSecondsFor('weather', event)
  earned: boolean; // tracker.has(id)
}

/**
 * The weather mast's recording line, or null: shown while the mast is switched on and a record not yet
 * earned has its event on (the storm first). `paused`: the count does not run now (near the lander, or
 * powered down), so the line says so instead of a running count.
 */
export function weatherRecordingLine(records: readonly RecordingState[], paused: boolean, t: MarsHudText): string | null {
  const order: RecordEvent[] = ['duststorm', 'night'];
  const now = records.filter((r) => r.active && !r.earned).sort((a, b) => order.indexOf(a.event) - order.indexOf(b.event))[0];
  if (!now) return null;
  const vars = {
    event: t.recordEvents[now.event as 'duststorm' | 'night'] ?? now.event,
    seconds: Math.min(now.seconds, Math.floor(now.counted)),
    total: now.seconds,
  };
  return fill(paused ? t.recordingPaused : t.recording, vars);
}

/** The crater wall hint (camera aboard, in a crater's rim band, Crater wall not yet earned), or null. */
export function craterWallHint(inRimBand: boolean, camera: boolean, earned: boolean, key: string, t: MarsHudText): string | null {
  return inRimBand && camera && !earned ? fill(t.craterWallHint, { key }) : null;
}

/**
 * A reading's notice with the readout's "New type: n of 6" line when this reading adds a rock type
 * (rules/instruments.ts newRockType). `readBefore`: the rock ids this instrument read before this reading
 * (rock types count per instrument, so the laser keeps its own count). One line when nothing is new.
 */
export function readingNotice(said: string, readBefore: readonly string[], rock: string, xray: InstrumentTuning['xray'], text: TextFile): string | string[] {
  const n = newRockType(readBefore, rock, xray);
  return n ? [said, fill(text.instruments.xrayNewType, n)] : said;
}
