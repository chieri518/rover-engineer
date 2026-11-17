// The master, done on the rendered samples (after the game's bus chain): a DC/subsonic highpass, a gentle
// lowpass against harsh highs on laptop speakers, a look-ahead true-peak limiter (so the loudness normalization
// in the mux can stay linear), and a hard cut to digital silence at black. Pure functions on Float32Arrays.

export interface MasterOpts {
  sampleRate: number;
  /** Everything from here on is exactly zero (a 5 ms fade ends here). */
  cutAt: number;
  /** Limiter ceiling (linear, true peak estimated at 4x). */
  ceiling: number;
  /** Gain into the limiter. */
  drive: number;
}

/** RBJ biquad, in place. */
function biquad(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): void {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]!;
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    x[i] = y0;
  }
}

function pass(x: Float32Array, type: 'highpass' | 'lowpass', f: number, q: number, sr: number): void {
  const w = (2 * Math.PI * f) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b = type === 'lowpass' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  biquad(x, b[0]! / a0, b[1]! / a0, b[2]! / a0, (-2 * cos) / a0, (1 - alpha) / a0);
}

/** The largest of the samples and three Catmull-Rom points between each pair (a 4x true-peak estimate). */
function truePeaks(chans: Float32Array[]): Float32Array {
  const n = chans[0]!.length;
  const out = new Float32Array(n);
  for (const x of chans) {
    for (let i = 0; i < n; i++) {
      const p0 = x[Math.max(0, i - 1)]!;
      const p1 = x[i]!;
      const p2 = x[Math.min(n - 1, i + 1)]!;
      const p3 = x[Math.min(n - 1, i + 2)]!;
      let peak = Math.abs(p1);
      for (const t of [0.25, 0.5, 0.75]) {
        const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
        peak = Math.max(peak, Math.abs(v));
      }
      if (peak > out[i]!) out[i] = peak;
    }
  }
  return out;
}

/**
 * Look-ahead limiter, linked stereo: the gain needed at each sample is the ceiling over the true peak; it is
 * spread backwards over the look-ahead (a ramp, so the gain is already down when the peak arrives), then released
 * smoothly. Returns the largest gain reduction in dB.
 */
function limit(chans: Float32Array[], sr: number, ceiling: number): number {
  const n = chans[0]!.length;
  const peaks = truePeaks(chans);
  const ahead = Math.round(0.004 * sr);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) need[i] = peaks[i]! > ceiling ? ceiling / peaks[i]! : 1;
  // Backwards: reach each sample's need linearly over the look-ahead before it.
  const g = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    const v = need[i]!;
    if (v >= 1) continue;
    for (let k = 0; k <= ahead && i - k >= 0; k++) {
      const r = v + (1 - v) * (k / (ahead + 1));
      if (r < g[i - k]!) g[i - k] = r;
    }
  }
  // Forwards: release (one-pole, 120 ms), never above what the look-ahead asked for.
  const rel = Math.exp(-1 / (0.12 * sr));
  let cur = 1;
  let most = 1;
  for (let i = 0; i < n; i++) {
    const target = g[i]!;
    cur = target < cur ? target : target + (cur - target) * rel;
    g[i] = cur;
    if (cur < most) most = cur;
  }
  for (const x of chans) for (let i = 0; i < n; i++) x[i] = x[i]! * g[i]!;
  return 20 * Math.log10(most);
}

export function master(chans: Float32Array[], o: MasterOpts): { reductionDb: number } {
  const sr = o.sampleRate;
  for (const x of chans) {
    pass(x, 'highpass', 28, 0.7, sr);
    pass(x, 'lowpass', 13000, 0.6, sr);
    if (o.drive !== 1) for (let i = 0; i < x.length; i++) x[i] = x[i]! * o.drive;
  }
  const reductionDb = limit(chans, sr, o.ceiling);
  const cut = Math.round(o.cutAt * sr);
  const fade = Math.round(0.005 * sr);
  for (const x of chans) {
    for (let i = Math.max(0, cut - fade); i < x.length; i++) x[i] = i >= cut ? 0 : x[i]! * ((cut - i) / fade);
  }
  return { reductionDb };
}
