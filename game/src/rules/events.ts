// Mission events: solar flares (with a warning) and moonquakes. One event at a random time inside
// each window from events.json; each flare is a real past flare from NASA DONKI. Pure.
import type { EventsFile, RealFlare } from './types';

export type Rng = () => number; // uniform in [0, 1)

/** Small seeded random generator (mulberry32), so a mission's events can be replayed from its seed. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type MissionEvent =
  | { kind: 'flare'; at: number; warningAt: number; flare: RealFlare }
  | { kind: 'quake'; at: number; warningAt: number };

export function scheduleEvents(events: EventsFile, rng: Rng): MissionEvent[] {
  const list: MissionEvent[] = [];
  const pool = [...events.flare.realFlares];
  for (const [a, b] of events.flare.windowsSeconds) {
    const at = a + (b - a) * rng();
    const flare = pool.splice(Math.floor(rng() * pool.length), 1)[0] ?? events.flare.realFlares[0]!;
    list.push({ kind: 'flare', at, warningAt: Math.max(0, at - events.flare.warningSeconds), flare });
  }
  for (const [a, b] of events.quake.windowsSeconds) {
    const at = a + (b - a) * rng();
    list.push({ kind: 'quake', at, warningAt: Math.max(0, at - events.quake.warningSeconds) });
  }
  return list.sort((x, y) => x.at - y.at);
}

/** A flare harms the rover unless it is powered down or sheltered in shadow when it hits. */
export function flareProtected(poweredDown: boolean, sunlight: number, events: EventsFile): boolean {
  return poweredDown || sunlight < events.flare.shelterSunlight;
}

/** "2017-09-06" → "6 September 2017" for the warning text. */
export function formatFlareDate(date: string): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
}
