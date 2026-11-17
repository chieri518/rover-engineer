// Deterministic time and randomness for offline rendering. Imported first by main.ts (before three or any
// game module runs), so everything that reads the clock or rolls dice sees the virtual values:
//  - performance.now() and Date.now() return the virtual time (ms), which only moves when the timeline sets it;
//  - requestAnimationFrame queues callbacks that run only when flushFrame() is called (once per sub-frame);
//  - Math.random() is a seeded generator (reseeded at every sequence start, so a sequence renders the same
//    whether the render starts at 0 or in the middle).
// In live play mode (?mode=play) the clock follows real time instead, still through the same functions.

const realNow = performance.now.bind(performance);
const realRaf = window.requestAnimationFrame.bind(window);
const EPOCH_MS = Date.UTC(2026, 10, 16, 6, 0, 0); // any fixed date

let virtualMs = 0;
let rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
let rafId = 1;

/** mulberry32: small, fast, good enough for visuals. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let globalRandom = seeded(0x5eed);
Math.random = () => globalRandom();
performance.now = () => virtualMs;
Date.now = () => EPOCH_MS + Math.floor(virtualMs);
window.requestAnimationFrame = (cb: FrameRequestCallback) => {
  const id = rafId++;
  rafQueue.push({ id, cb });
  return id;
};
window.cancelAnimationFrame = (id: number) => {
  rafQueue = rafQueue.filter((q) => q.id !== id);
};

export const clock = {
  /** Virtual time in seconds. */
  get seconds() {
    return virtualMs / 1000;
  },
  set(seconds: number) {
    virtualMs = seconds * 1000;
  },
  /** Reseed Math.random (done at the start of every sequence with a seed from its id). */
  reseed(seed: number) {
    globalRandom = seeded(seed);
  },
  /** Run the queued animation-frame callbacks once (callbacks they queue wait for the next flush). */
  flushFrame() {
    const q = rafQueue;
    rafQueue = [];
    for (const { cb } of q) cb(virtualMs);
  },
  /** Real time (ms) for progress logs; never use it for anything that ends up in a frame. */
  realNow,
  /** The browser's real requestAnimationFrame, for the live play mode. */
  realRaf,
};

/** A stable 32-bit hash of a string (for seeds). */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
