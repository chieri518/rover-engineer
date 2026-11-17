// Easing and interpolation helpers for camera moves and animation.
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0 before a, 1 after b, smooth in between. */
export const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
export const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInCubic = (k: number) => k * k * k;
export const easeInOutSine = (k: number) => -(Math.cos(Math.PI * k) - 1) / 2;
export const easeOutExpo = (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
/** Progress of t through [a, b], eased (cubic in-out by default). */
export const phase = (t: number, a: number, b: number, ease: (k: number) => number = easeInOutCubic) => ease(clamp01((t - a) / (b - a)));

/** Smooth 1D value noise (deterministic), for handheld camera shake and flicker. */
export function noise1(x: number, seed = 0): number {
  const h = (i: number) => {
    let n = (i * 374761393 + seed * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296 * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/** Handheld-style shake: sum of noise octaves, roughly in [-1, 1]. */
export function shake(t: number, seed: number, freq = 6): number {
  return noise1(t * freq, seed) * 0.6 + noise1(t * freq * 2.3, seed + 7) * 0.3 + noise1(t * freq * 5.1, seed + 13) * 0.1;
}
