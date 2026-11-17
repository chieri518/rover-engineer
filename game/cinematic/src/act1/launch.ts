// The launch choreography in sequence time (seconds from the start of Act 1): when each engine lights, when the
// hold-downs let go, where the rocket is, and every particle the pad throws up (spawned deterministically from a
// seeded generator, so each render is identical).
import { ACT1_CUES, ACT1_SHOTS } from './timing';
import { Kind, type Spawn, type SparkSpawn } from './particles';
import { PAD } from './pad';
import { ROCKET } from './rocket';

const shotStart = (id: string) => {
  let t = 0;
  for (const s of ACT1_SHOTS) {
    if (s.id === id) return t;
    t += s.duration;
  }
  throw new Error(`no shot ${id}`);
};
const cue = (k: keyof typeof ACT1_CUES) => shotStart(ACT1_CUES[k].shot) + ACT1_CUES[k].t;

export const T = {
  shot1: shotStart('ignition'),
  shot2: shotStart('liftoff'),
  shot3: shotStart('orbit'),
  end: shotStart('orbit') + ACT1_SHOTS[2]!.duration,
  sparks: cue('sparks'),
  ignition: cue('ignition'),
  release: cue('liftoff'),
  clearTower: cue('clearTower'),
  separation: cue('separation'),
  upperIgnition: cue('upperIgnition'),
};

/** Engine start times: the centre engine first, then the outer pairs (staggered start). */
export const ENGINE_START = [T.ignition - 0.06, T.ignition + 0.05, T.ignition + 0.14, T.ignition + 0.09, T.ignition + 0.18];

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Engine i's thrust level (0..1) at time t: a quick rise with a small overshoot. */
export function engineLevel(i: number, t: number): number {
  const a = t - ENGINE_START[i]!;
  if (a <= 0) return 0;
  const k = 1 - Math.exp(-a / 0.12);
  return k * (1 + 0.15 * Math.exp(-a / 0.35) * Math.sin(a * 18));
}

/** Igniter flash (green TEA-TEB) for engine i. */
export function igniterFlash(i: number, t: number): number {
  const a = t - (ENGINE_START[i]! - 0.12);
  if (a < 0 || a > 0.35) return 0;
  return Math.sin((a / 0.35) * Math.PI) ** 2;
}

/** Height the rocket has risen since release (m). Starts slow (the weight shows), then accelerates. */
export function rise(t: number): number {
  const a = t - T.release;
  if (a <= 0) return 0;
  return 2.5 * a * a + 1.2 * a * a * a;
}

export function rocketBaseY(t: number): number {
  return PAD.rocketBaseY + rise(t);
}

/** Engine nozzle exit height (world y). */
export function nozzleY(t: number): number {
  return rocketBaseY(t) + ROCKET.bellExitY;
}

/** Ground under (x, z) for particles: the deck on the mount (outside the hole and the trench), else the ground. */
export function groundAt(x: number, z: number): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax < PAD.mountHalf && az < PAD.mountHalf) {
    if (ax < PAD.hole && az < PAD.hole) return 0;
    return PAD.deckY;
  }
  return 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spawn times for a rate (per second) that varies over [t0, t1]. */
function spawnTimes(t0: number, t1: number, rate: (t: number) => number, r: () => number): number[] {
  const out: number[] = [];
  let acc = r();
  const dt = 1 / 240;
  for (let t = t0; t < t1; t += dt) {
    acc += rate(t) * dt;
    while (acc >= 1) {
      acc -= 1;
      out.push(t + r() * dt);
    }
  }
  return out;
}

export function buildSpawns(quality: 'preview' | 'final'): { smoke: Spawn[]; sparks: SparkSpawn[] } {
  const q = quality === 'final' ? 1 : 0.45;
  const r = rng(0x1a7c4);
  const R = (a: number, b: number) => a + (b - a) * r();
  const smoke: Spawn[] = [];
  const sparks: SparkSpawn[] = [];
  const base: Omit<Spawn, 'tb' | 'p' | 'v'> = {
    life: 4,
    drag: 1,
    buoy: 1,
    size0: 1,
    grow: 1,
    rot: 0,
    spin: 0,
    kind: Kind.Steam,
    tint: 1,
    opacity: 0.5,
    heat: 0,
    cool: 1,
  };
  const add = (s: Partial<Spawn> & Pick<Spawn, 'tb' | 'p' | 'v'>) => smoke.push({ ...base, rot: R(0, 6.283), spin: R(-0.4, 0.4), ...s });
  const thrust = (t: number) => ENGINE_START.reduce((s, _, i) => s + engineLevel(i, t), 0) / ENGINE_START.length;
  const baseY0 = PAD.rocketBaseY;

  // 1. Cold vapour pouring off the tank and the engine section before launch (sinks, drifts).
  for (const tb of spawnTimes(-3, T.release + 0.5, () => 34 * q, r)) {
    const a = R(0, Math.PI * 2);
    const y = R(baseY0 + 0.5, baseY0 + 6);
    add({ tb, life: R(3.5, 5.5), p: [Math.cos(a) * 2.3, y, Math.sin(a) * 2.3], v: [Math.cos(a) * R(0.4, 1.2), R(-1.2, -0.3), Math.sin(a) * R(0.4, 1.2)], drag: 0.7, buoy: -0.5, size0: R(0.5, 1.0), grow: R(1.0, 1.8), kind: Kind.Steam, tint: R(0.85, 1), opacity: R(0.08, 0.16), fadeIn: 0.6 });
  }
  // LOX vent plume high on the tank (visible in the wide shot until liftoff).
  for (const tb of spawnTimes(-4, T.release + 0.3, () => 14 * q, r)) {
    const a = Math.PI * 0.5 + R(-0.3, 0.3);
    add({ tb, life: R(4, 6), p: [Math.cos(a) * 2.3, baseY0 + 34.5, -Math.sin(a) * 2.3], v: [Math.cos(a) * R(3, 5), R(-0.5, 0.5), -Math.sin(a) * R(3, 5)], drag: 1.2, buoy: -0.8, size0: R(0.6, 1), grow: R(2, 3), kind: Kind.Steam, opacity: R(0.15, 0.25), fadeIn: 0.3 });
  }
  // 2. Deluge water mist rising off the deck before ignition.
  for (const tb of spawnTimes(T.ignition - 1.3, T.ignition + 0.1, (t) => 30 * q * smooth(T.ignition - 1.3, T.ignition - 0.5, t), r)) {
    const side = Math.floor(R(0, 4));
    const s = R(-PAD.hole, PAD.hole);
    const [x, z] = side === 0 ? [PAD.hole, s] : side === 1 ? [-PAD.hole, s] : side === 2 ? [s, PAD.hole] : [s, -PAD.hole];
    add({ tb, life: R(2.5, 4), p: [x * 1.05, PAD.deckY + 0.3, z * 1.05], v: [R(-1, 1), R(1.5, 3.5), R(-1, 1)], drag: 1, buoy: 0.6, size0: R(0.5, 1), grow: R(1.5, 2.5), kind: Kind.Steam, opacity: R(0.08, 0.15), fadeIn: 0.4 });
  }

  // 3. Ignition: fire boiling up out of the hole around the engines (the close-up), and the first fireball.
  for (const tb of spawnTimes(T.ignition, T.ignition + 2.0, (t) => 320 * q * Math.max(0, thrust(t)) * (1 - 0.5 * smooth(T.ignition + 0.9, T.ignition + 2.0, t)), r)) {
    // Mostly from the far edges of the hole, so the engines stand dark against the fire (the close-up looks from
    // the south-east); a little from the near edges.
    const pick = r();
    const side = pick < 0.45 ? 3 : pick < 0.8 ? 1 : pick < 0.93 ? 0 : 2;
    const s = R(-PAD.hole, PAD.hole);
    const [x, z] = side === 0 ? [PAD.hole, s] : side === 1 ? [-PAD.hole, s] : side === 2 ? [s, PAD.hole] : [s, -PAD.hole];
    const out = R(3, 9);
    const nx = side === 0 ? 1 : side === 1 ? -1 : 0;
    const nz = side === 2 ? 1 : side === 3 ? -1 : 0;
    add({ tb, life: R(1.2, 2.2), p: [x * 0.95, PAD.deckY - R(0.5, 2), z * 0.95], v: [nx * out + R(-2, 2), R(8, 18), nz * out + R(-2, 2)], drag: 1.6, buoy: 4, size0: R(1.0, 1.8), grow: R(4, 7), kind: Kind.Fire, heat: R(0.75, 1.0), cool: R(1.3, 2.0), opacity: R(0.5, 0.85), tint: R(0.3, 0.5), fadeIn: 0.05 });
    // Steam flashing off the deluge water with it.
    if (r() < 0.55) add({ tb: tb + R(0.1, 0.4), life: R(3, 5), p: [x * 1.1, PAD.deckY + 0.5, z * 1.1], v: [nx * out * 0.8 + R(-2, 2), R(5, 12), nz * out * 0.8 + R(-2, 2)], drag: 1.1, buoy: 3, size0: R(1.5, 2.5), grow: R(5, 8), kind: Kind.Steam, heat: R(0.05, 0.15), cool: 2, opacity: R(0.35, 0.6), tint: R(0.75, 0.95), fadeIn: 0.15 });
  }
  // Fireball rolling out under the nozzles at the hit.
  for (const tb of spawnTimes(T.ignition - 0.04, T.ignition + 0.5, () => 90 * q, r)) {
    const a = R(0, Math.PI * 2);
    const sp = R(5, 14);
    add({ tb, life: R(0.5, 1.0), p: [Math.cos(a) * R(0, 2), baseY0 + ROCKET.bellExitY - R(0.5, 2.0), Math.sin(a) * R(0, 2)], v: [Math.cos(a) * sp * 0.5, R(-14, -6), Math.sin(a) * sp * 0.5], drag: 2.2, buoy: 2, size0: R(0.8, 1.4), grow: R(3, 5), kind: Kind.Fire, heat: R(0.85, 1.0), cool: 2.2, opacity: 0.7, tint: 0.4, fadeIn: 0.04 });
  }

  // 4. The flame trench: fire and steam blasting out of both exits, then rolling clouds.
  const trench = (t: number) => {
    const th = thrust(t - 0.35);
    const ris = rise(t);
    return th * (1 - smooth(25, 80, ris));
  };
  for (const sx of [-1, 1]) {
    for (const tb of spawnTimes(T.ignition + 0.3, T.shot3, (t) => 85 * q * trench(t), r)) {
      const k = trench(tb);
      const sp = R(35, 60) * (0.6 + 0.4 * k);
      add({ tb, life: R(1.2, 2.2), p: [sx * R(13, 15), R(1.5, 5), R(-3.5, 3.5)], v: [sx * sp, R(1, 7), R(-9, 9)], drag: R(0.9, 1.4), buoy: 5, size0: R(2.2, 3.5), grow: R(7, 10), kind: Kind.Fire, heat: R(0.75, 0.95), cool: R(1.1, 1.6), opacity: R(0.5, 0.8), tint: R(0.35, 0.5), fadeIn: 0.06 });
    }
    for (const tb of spawnTimes(T.ignition + 0.35, T.shot3, (t) => 70 * q * trench(t), r)) {
      const k = trench(tb);
      const sp = R(30, 55) * (0.6 + 0.4 * k);
      const dark = r() < 0.3;
      add({ tb, life: R(7, 11), p: [sx * R(14, 18), R(2, 6), R(-4, 4)], v: [sx * sp, R(2, 9), R(-12, 12)], drag: R(0.45, 0.7), buoy: R(3, 6), size0: R(3.5, 5), grow: R(10, 15), kind: dark ? Kind.Smoke : Kind.Steam, heat: R(0.12, 0.22), cool: R(1.5, 2.5), opacity: R(0.55, 0.8), tint: dark ? R(0.45, 0.65) : R(0.75, 0.95), fadeIn: 0.2 });
    }
  }

  // 5. After release: the column hits the deck, then the ground, and spreads out radially.
  const impact = (t: number) => {
    const ris = rise(t);
    if (t < T.release) return 0;
    return thrust(t) * smooth(3, 14, ris) * (1 - smooth(110, 240, ris));
  };
  for (const tb of spawnTimes(T.release, T.shot3, (t) => 130 * q * impact(t), r)) {
    const a = R(0, Math.PI * 2);
    const sp = R(25, 50);
    const ris = rise(tb);
    const y = ris < 40 ? PAD.deckY + 0.5 : 1;
    add({ tb, life: R(1.0, 1.8), p: [Math.cos(a) * R(2, 6), y, Math.sin(a) * R(2, 6)], v: [Math.cos(a) * sp, R(0, 5), Math.sin(a) * sp], drag: 1.5, buoy: 5, size0: R(2, 3), grow: R(6, 9), kind: Kind.Fire, heat: R(0.75, 0.95), cool: 1.4, opacity: 0.7, tint: 0.4, fadeIn: 0.05 });
    if (r() < 0.75) {
      const dark = r() < 0.25;
      add({ tb: tb + R(0.05, 0.3), life: R(7, 11), p: [Math.cos(a) * R(4, 9), y + 1, Math.sin(a) * R(4, 9)], v: [Math.cos(a) * sp * 0.9, R(2, 8), Math.sin(a) * sp * 0.9], drag: R(0.45, 0.7), buoy: R(3, 6), size0: R(4, 6), grow: R(10, 14), kind: dark ? Kind.Smoke : Kind.Steam, heat: R(0.12, 0.2), cool: 2, opacity: R(0.55, 0.8), tint: dark ? R(0.45, 0.6) : R(0.75, 0.95), fadeIn: 0.2 });
    }
  }
  // 6. The exhaust trail left in the air behind the rising rocket.
  for (const tb of spawnTimes(T.release + 0.8, T.shot3, (t) => 45 * q * smooth(T.release + 0.8, T.release + 2, t), r)) {
    const yN = nozzleY(tb);
    const below = R(25, 45);
    if (yN - below < 8) continue;
    add({ tb, life: R(6, 9), p: [R(-2, 2), yN - below, R(-2, 2)], v: [R(-3, 3), R(-12, -4), R(-3, 3)], drag: 0.8, buoy: 1.5, size0: R(5, 8), grow: R(5, 8), kind: Kind.Steam, heat: R(0.1, 0.18), cool: 1.5, opacity: R(0.4, 0.6), tint: R(0.75, 0.9), fadeIn: 0.25 });
  }

  // ---------------------------------------------------------------------------------------------- sparks
  // Igniter sparks (radial outward firing igniters on the deck at the hole corners, spraying under the engines).
  const corners: [number, number][] = [
    [PAD.hole - 0.3, PAD.hole - 0.3],
    [-(PAD.hole - 0.3), PAD.hole - 0.3],
    [-(PAD.hole - 0.3), -(PAD.hole - 0.3)],
    [PAD.hole - 0.3, -(PAD.hole - 0.3)],
  ];
  for (const tb of spawnTimes(T.sparks, T.ignition + 0.25, (t) => 900 * smooth(T.sparks, T.sparks + 0.25, t) * (q > 0.5 ? 1 : 0.5), r)) {
    const [cx, cz] = corners[Math.floor(r() * 4)]!;
    // Aim at the space under the engines, spread wide, upward.
    const ax = -cx + R(-3, 3);
    const az = -cz + R(-3, 3);
    const len = Math.hypot(ax, az);
    const sp = R(5, 13);
    const vy = R(1, 8);
    const vx = (ax / len) * sp;
    const vz = (az / len) * sp;
    // Predict the landing to choose the floor (deck or trench floor).
    const tl = (vy + Math.sqrt(vy * vy + 2 * 9.81 * 0.4)) / 9.81;
    const lx = cx + vx * tl * 0.8;
    const lz = cz + vz * tl * 0.8;
    const floor = Math.abs(lx) < PAD.hole && Math.abs(lz) < PAD.hole ? 0.5 : PAD.deckY + 0.02;
    sparks.push({ tb, life: R(0.6, 1.6), p: [cx, PAD.deckY + 0.4, cz], v: [vx, vy, vz], width: R(0.004, 0.009), bright: R(0.6, 1.4), floor });
  }
  // Burning debris thrown at ignition and during the first seconds of liftoff.
  for (const tb of spawnTimes(T.ignition, T.release + 2.5, (t) => (t < T.ignition + 0.4 ? 900 : 120) * (q > 0.5 ? 1 : 0.5), r)) {
    const a = R(0, Math.PI * 2);
    const sp = R(12, 35);
    const fromTrench = tb > T.ignition + 0.4 && r() < 0.6;
    const p: [number, number, number] = fromTrench ? [(r() < 0.5 ? -1 : 1) * 14, R(1, 5), R(-3, 3)] : [Math.cos(a) * R(1, 4.5), PAD.deckY + R(0, 1), Math.sin(a) * R(1, 4.5)];
    const v: [number, number, number] = fromTrench ? [Math.sign(p[0]) * R(30, 60), R(3, 15), R(-10, 10)] : [Math.cos(a) * sp, R(4, 20), Math.sin(a) * sp];
    sparks.push({ tb, life: R(0.5, 1.4), p, v, width: R(0.01, 0.025), bright: R(0.6, 1.5), floor: fromTrench ? 0.02 : PAD.deckY + 0.02 });
  }
  return { smoke, sparks };
}
