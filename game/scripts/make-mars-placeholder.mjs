// PLACEHOLDER Mars terrain: procedural, NOT real data. It stands in for the real Jezero crater
// terrain (public/terrain/mars/, built by the data pipeline) so the game can load and drive on Mars.
// Writes public/terrain/mars-placeholder/ in the same file shapes as the Moon terrain.
// Regenerate (deterministic, seeded) with:  node scripts/make-mars-placeholder.mjs   (from game/)
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const OUT = new URL('../public/terrain/mars-placeholder/', import.meta.url);
const GEN = 'game/scripts/make-mars-placeholder.mjs';
const DATE = '2026-11-15';
const R_MARS = 3389500;
const ORIGIN = [18.4447, 77.4508]; // Octavia E. Butler Landing (Perseverance, 2021)
const SEED = 2026;

// ---------- small helpers ----------
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const smooth = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(ix, iz, s) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s + SEED, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise in [-1, 1], cell size `cell` meters. */
function noise(x, z, cell, s) {
  const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
  const q = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = q(fx - ix), v = q(fz - iz);
  const a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s);
  return 2 * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) - 1;
}

// ---------- features (local meters: +x east, +z south) ----------
const LANDING = { x: 250, z: 0 };                    // REL lands near OEB (origin), not on it
const OEB = { x: 0, z: 0 };
const DELTA = { cx: -9000, cz: -3500, r: 6800 };     // delta lobe: inside this circle is the higher delta
const DELTA_RISE = 40;                               // scarp height, m
const PHI0 = Math.atan2(-DELTA.cz, -DELTA.cx);       // angle (around delta center) facing the origin
const RAMP_PHI = PHI0 - (9 * Math.PI) / 180;         // gentle ramp ~1 km north of the closest point
const CRATER = { cx: 8000 * Math.cos(Math.PI / 8), cz: -8000 * Math.sin(Math.PI / 8), r: 22500, rim: 600 };
const SEITAH = { cx: -1250, cz: 1150, r: 720 };
const r1 = rng(SEED);
const SEITAH_R = Array.from({ length: 20 }, () => SEITAH.r * (0.85 + 0.3 * r1())); // polygon radii
const SOFT = [
  { name: 'Seitah ripples 1', x: SEITAH.cx - 200, z: SEITAH.cz + 120, radius_m: 230 },
  { name: 'Seitah ripples 2', x: SEITAH.cx + 230, z: SEITAH.cz - 150, radius_m: 200 },
  { name: 'Seitah ripples 3', x: SEITAH.cx + 60, z: SEITAH.cz + 330, radius_m: 160 },
];
const ROCKY = [
  { name: 'East boulder field', x: 2300, z: -350, radius_m: 180 },
  { name: 'North boulder field', x: 450, z: -2500, radius_m: 160 },
];
for (const a of ROCKY) { // seeded boulder mounds
  const r = rng(SEED + a.x);
  a.bumps = Array.from({ length: 260 }, () => {
    const d = a.radius_m * Math.sqrt(r()), t = 2 * Math.PI * r();
    return { x: a.x + d * Math.cos(t), z: a.z + d * Math.sin(t), s: 6 + 6 * r(), h: 0.8 + 1.4 * r() };
  });
}

/** Seitah polygon radius at angle t around its center (linear between the 20 vertices). */
function seitahRadius(t) {
  const f = (((t / (2 * Math.PI)) % 1) + 1) % 1 * 20, i = Math.floor(f) % 20;
  return SEITAH_R[i] + (SEITAH_R[(i + 1) % 20] - SEITAH_R[i]) * (f - Math.floor(f));
}
function seitahInside(x, z) { // 1 inside, smooth 60 m edge
  const dx = x - SEITAH.cx, dz = z - SEITAH.cz;
  const rp = seitahRadius(Math.atan2(dz, dx));
  return smooth(rp + 60, rp - 60, Math.hypot(dx, dz));
}
/** Scarp width parameter: 20 m half-rise / w gives the max slope (w 46 m -> ~23 deg; ramp w 260 m -> ~4.4 deg). */
function scarpW(phi) { return 46 + 214 * Math.exp(-(((phi - RAMP_PHI) / 0.045) ** 2)); }
function deltaU(x, z) { // + inside the delta (west), meters from the scarp center line
  const dx = x - DELTA.cx, dz = z - DELTA.cz;
  return { u: DELTA.r - Math.hypot(dx, dz), phi: Math.atan2(dz, dx) };
}
function softness(x, z) {
  let s = 0;
  for (const a of SOFT) s = Math.max(s, smooth(a.radius_m + 80, a.radius_m, Math.hypot(x - a.x, z - a.z)));
  return s;
}

/** Elevation (m above the Mars datum, MOLA-like) at local (x, z). Detail finer than the grid `pixel` is left out. */
function elevation(x, z, pixel = 5) {
  const oct = (amp, cell, s) => (cell >= 3 * pixel ? amp * noise(x, z, cell, s) : 0);
  let h = -2600;
  // crater: flat floor, inner wall, irregular rim ~600 m above the floor, falling off outside
  const dc = Math.hypot(x - CRATER.cx, z - CRATER.cz), ang = Math.atan2(z - CRATER.cz, x - CRATER.cx);
  const rim = CRATER.rim * (1 + 0.2 * Math.sin(3 * ang + 1) + 0.1 * Math.sin(7 * ang + 2));
  const rr = dc / CRATER.r;
  h += rr < 1 ? rim * smooth(0.7, 1, rr) ** 1.6 : 150 + (rim - 150) * Math.exp(-(dc - CRATER.r) / 7000);
  // regional undulation (km scale) and the plains beyond the rim
  h += 60 * noise(x, z, 9000, 1) + 120 * smooth(1, 1.4, rr) * noise(x, z, 30000, 2);
  // delta: ~40 m scarp along a gently curved line, a gentle ramp on one stretch
  const { u, phi } = deltaU(x, z);
  const lobe = smooth(-17000, -12000, x); // delta fades out into the western rim
  h += lobe * DELTA_RISE * 0.5 * (1 + Math.tanh(u / scarpW(phi)));
  // gentle hills (a few m), damped around the landing point
  const flat = smooth(180, 380, Math.hypot(x - LANDING.x, z - LANDING.z));
  h += flat * (oct(6, 1200, 3) + oct(2.5, 300, 4) + oct(0.8, 80, 5) + oct(0.25, 25, 6));
  // Seitah: ridges trending NE-SW, a few m high
  const si = seitahInside(x, z);
  if (si > 0 && pixel <= 10) {
    const d = (x - z) / Math.SQRT2 + 25 * noise(x, z, 200, 7);
    h += si * 3 * Math.sin((Math.PI * d) / 70) ** 2 * (0.6 + 0.4 * noise(x, z, 150, 8));
  }
  // rocky areas: boulder mounds
  for (const a of ROCKY) {
    if (pixel > 10 || Math.hypot(x - a.x, z - a.z) > a.radius_m + 40) continue;
    for (const b of a.bumps) {
      const q = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.s * b.s);
      if (q < 9) h += b.h * Math.exp(-q);
    }
  }
  return h;
}
/** Tangent-plane height (what the renderer uses): elevation minus the curvature drop r^2 / 2R. */
const height = (x, z, pixel) => elevation(x, z, pixel) - (x * x + z * z) / (2 * R_MARS);

// ---------- grids ----------
function sampleGrid(n, pixel) {
  const half = (n - 1) / 2, h = new Float64Array(n * n);
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) h[row * n + col] = height((col - half) * pixel, (row - half) * pixel, pixel);
  return h;
}
/** Grayscale PNG writer with the Paeth filter (fast-png writes unfiltered rows: ~2x bigger files). */
function writePng(file, n, depth, data) {
  const bpp = depth / 8, stride = n * bpp, raw = Buffer.alloc(n * stride);
  for (let i = 0; i < data.length; i++) depth === 16 ? raw.writeUInt16BE(data[i], i * 2) : (raw[i] = data[i]);
  const out = Buffer.alloc(n * (stride + 1));
  for (let r = 0; r < n; r++) {
    out[r * (stride + 1)] = 4;
    for (let c = 0; c < stride; c++) {
      const i = r * stride + c, a = c >= bpp ? raw[i - bpp] : 0, b = r ? raw[i - stride] : 0, d = c >= bpp && r ? raw[i - stride - bpp] : 0;
      const p = a + b - d, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - d);
      out[r * (stride + 1) + 1 + c] = (raw[i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : d)) & 255;
    }
  }
  const chunk = (type, body) => { const len = Buffer.alloc(4), crc = Buffer.alloc(4), tb = Buffer.concat([Buffer.from(type), body]);
    len.writeUInt32BE(body.length); crc.writeUInt32BE(crc32(tb)); return Buffer.concat([len, tb, crc]); };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = depth; // color type 0 (gray), rest 0
  writeFileSync(new URL(file, OUT), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
function encode16(file, n, h) {
  let lo = Infinity, hi = -Infinity;
  for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const min_m = Math.floor(lo), max_m = Math.ceil(hi), data = new Uint16Array(n * n);
  for (let i = 0; i < h.length; i++) data[i] = Math.round(((h[i] - min_m) / (max_m - min_m)) * 65535);
  writePng(file, n, 16, data);
  return { min_m, max_m };
}
function encode8(file, n, fn) {
  const data = new Uint8Array(n * n);
  for (let i = 0; i < data.length; i++) data[i] = clamp(Math.round(fn(i)), 0, 255);
  writePng(file, n, 8, data);
}

mkdirSync(OUT, { recursive: true });
const N = 1601, PX = 5, HALF = 800;
const hm = sampleGrid(N, PX);
const hmRange = encode16('heightmap.png', N, hm);
const slope = new Float64Array(N * N);
for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) {
  const at = (c, r) => hm[clamp(r, 0, N - 1) * N + clamp(c, 0, N - 1)];
  const dc = col === 0 || col === N - 1 ? 1 : 2, dr = row === 0 || row === N - 1 ? 1 : 2;
  const gx = (at(col + 1, row) - at(col - 1, row)) / (dc * PX), gz = (at(col, row + 1) - at(col, row - 1)) / (dr * PX);
  slope[row * N + col] = (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI;
}
encode8('slope.png', N, (i) => slope[i] * 4);
const xz = (i) => [((i % N) - HALF) * PX, (Math.floor(i / N) - HALF) * PX];
encode8('soft-ground.png', N, (i) => softness(...xz(i)) * 255);
encode8('albedo.png', N, (i) => {
  const [x, z] = xz(i), { u, phi } = deltaU(x, z);
  const face = Math.exp(-((u / (1.5 * scarpW(phi))) ** 2)); // layered bands on the scarp face
  return 128 + 6 * noise(x, z, 400, 11) + 5 * noise(x, z, 40, 12) + 3 * noise(x, z, 10, 13)
    + 14 * smooth(-100, 100, u) - 22 * seitahInside(x, z) + 10 * face * Math.sin((hm[i] * 2 * Math.PI) / 3);
});
const near = encode16('distant-near.png', 1001, sampleGrid(1001, 50));
const far = encode16('distant-far.png', 1001, sampleGrid(1001, 200));

// ---------- sites ----------
const latLon = (x, z) => [round(ORIGIN[0] - (z / R_MARS) * (180 / Math.PI), 5),
  round(ORIGIN[1] + (x / (R_MARS * Math.cos((ORIGIN[0] * Math.PI) / 180))) * (180 / Math.PI), 5)];
const slopeAt = (x, z) => slope[clamp(Math.round(z / PX) + HALF, 0, N - 1) * N + clamp(Math.round(x / PX) + HALF, 0, N - 1)];
function site(name, x, z, extra = {}) {
  x = Math.round(x); z = Math.round(z);
  const d = Math.hypot(x - LANDING.x, z - LANDING.z);
  return { name, local: { x, y: round(height(x, z), 2), z }, latLon: latLon(x, z), elevation_m: round(elevation(x, z)),
    slope_deg: round(slopeAt(x, z)), distanceFromLanding_m: Math.round(d), driveDistanceFromLanding_m: Math.round(d * 1.15),
    source: 'placeholder', ...extra };
}
const onDelta = (phi, u) => [DELTA.cx + (DELTA.r - u) * Math.cos(phi), DELTA.cz + (DELTA.r - u) * Math.sin(phi)];
const towardDelta = (x, z) => { const dx = DELTA.cx - x, dz = DELTA.cz - z, l = Math.hypot(dx, dz); return { x: round(dx / l, 3), z: round(dz / l, 3) }; };

const scarpLine = [];
for (let deg = -25; deg <= 25; deg += 2.5) {
  const phi = PHI0 + (deg * Math.PI) / 180, [x, z] = onDelta(phi, -1.5 * scarpW(phi));
  if (Math.abs(x) < 3800 && Math.abs(z) < 3800) scarpLine.push([Math.round(x), Math.round(z)]);
}
const [sx, sz] = onDelta(PHI0, -1.5 * scarpW(PHI0));
const [vx, vz] = onDelta(PHI0 + 0.03, -260);
const [ux, uz] = onDelta(RAMP_PHI, -350); // ramp foot, on the floor
const [rx, rz] = onDelta(RAMP_PHI + 0.05, 250); // sunset spot on the delta top
const outline = SEITAH_R.map((r, k) => { const t = (k / 20) * 2 * Math.PI; return [Math.round(SEITAH.cx + r * Math.cos(t)), Math.round(SEITAH.cz + r * Math.sin(t))]; });
let area = 0;
for (let k = 0; k < 20; k++) { const [a, b] = outline[k], [c, d] = outline[(k + 1) % 20]; area += a * d - c * b; }
// Seitah entry: on the polygon edge on the side facing the landing point
const tEntry = Math.atan2(LANDING.z - SEITAH.cz, LANDING.x - SEITAH.cx), rEntry = seitahRadius(tEntry);
const meanSlope = (cx, cz, r0, r1) => { let s = 0, n = 0;
  for (let z = cz - r1; z <= cz + r1; z += PX) for (let x = cx - r1; x <= cx + r1; x += PX) {
    const d = Math.hypot(x - cx, z - cz); if (d >= r0 && d <= r1) { s += slopeAt(x, z); n++; } }
  return s / n; };

let landingMax = 0;
for (let z = -75; z <= 75; z += PX) for (let x = -75; x <= 75; x += PX) if (x * x + z * z <= 75 * 75) landingMax = Math.max(landingMax, slopeAt(LANDING.x + x, LANDING.z + z));
let maxSlope = 0, minH = Infinity, maxH = -Infinity;
for (let i = 0; i < hm.length; i++) { maxSlope = Math.max(maxSlope, slope[i]); minH = Math.min(minH, hm[i]); maxH = Math.max(maxH, hm[i]); }

const bounds = (half) => ({ xMin: -half, xMax: half, zMin: -half, zMax: half });
const H16 = 'height_m = min_m + value / 65535 * (max_m - min_m)';
const terrain = {
  version: 1, generated: DATE, generator: GEN, placeholder: true,
  site: 'PLACEHOLDER procedural terrain standing in for Jezero crater, Mars (not real data)',
  frame: {
    description: 'Local right-handed, y-up frame in meters (Three.js convention). Origin = play-area center at originLatLon (Octavia E. Butler Landing). +x = east, +z = south, +y = up. Image rows increase with +z, columns with +x.',
    originLatLon: ORIGIN,
    azimuthConvention: 'azimuth_deg is measured from local -z (north), turning toward +x (east)',
    heights: 'All heightmaps store TANGENT-PLANE heights: elevation (m, MOLA-like datum) minus the curvature drop r^2 / (2R), r = horizontal distance from the origin, R = 3389500 m. To recover elevation: elevation = height + (x^2 + z^2) / (2 * 3389500).',
  },
  sunAndEarth: { siteLatitude_deg: ORIGIN[0], siteLongitude_deg: ORIGIN[1] },
  playArea: {
    size_m: 8000, pixel_m: PX, samples: N, boundsLocal: bounds(4000),
    pixelToLocal: 'sample (col, row) -> x = (col - 800) * 5, z = (row - 800) * 5 (vertex-centered grid)',
    files: {
      heightmap: { file: 'heightmap.png', encoding: 'uint16 grayscale PNG', ...hmRange, formula: H16 },
      slope: { file: 'slope.png', encoding: 'uint8 grayscale PNG', formula: 'slope_deg = value / 4' },
      softGround: { file: 'soft-ground.png', encoding: 'uint8 grayscale PNG', formula: 'softness = value / 255 (0 normal, 1 softest sand ripples)' },
    },
    elevationRange_m: [round(minH), round(maxH)],
  },
  distantTerrain: [
    { name: 'near ring', file: 'distant-near.png', encoding: 'uint16 grayscale PNG', ...near, formula: H16, size_m: 50000, pixel_m: 50, samples: 1001,
      boundsLocal: bounds(25000), pixelToLocal: 'x = (col - 500) * 50, z = (row - 500) * 50',
      hole: 'Covers the play area too; skip or sink the part inside playArea.boundsLocal.', source: 'placeholder' },
    { name: 'far ring', file: 'distant-far.png', encoding: 'uint16 grayscale PNG', ...far, formula: H16, size_m: 200000, pixel_m: 200, samples: 1001,
      boundsLocal: bounds(100000), pixelToLocal: 'x = (col - 500) * 200, z = (row - 500) * 200',
      hole: "Covers the near ring too; skip or sink the part inside the near ring's bounds.", source: 'placeholder' },
  ],
  landing: (({ name, local, latLon, elevation_m, slope_deg }) => ({ name, local, latLon, elevation_m, slope_deg }))(site('Landing', LANDING.x, LANDING.z)),
  features: {
    deltaFront: {
      name: 'Delta front', description: 'PLACEHOLDER: a ~40 m scarp where the ancient river delta (higher ground, west) meets the crater floor; steepest ~23 deg, with a gentle ~4 deg ramp on its northern stretch.',
      scarpLocal_xz: scarpLine, zoneRadius_m: 150, samplePoint: site('Delta front sample point', sx, sz), source: 'placeholder',
    },
    seitah: {
      name: 'Seitah', description: 'PLACEHOLDER: ridged rock unit with sand ripples (soft ground) southwest of the landing point.',
      outlineLocal_xz: outline, centroidLocal: { x: SEITAH.cx, z: SEITAH.cz }, area_km2: round(Math.abs(area) / 2e6, 2),
      entryPoint: site('Seitah entry', SEITAH.cx + rEntry * Math.cos(tEntry), SEITAH.cz + rEntry * Math.sin(tEntry)), source: 'placeholder',
    },
    softGround: { description: 'Sand ripples inside Seitah: softness 1 inside each circle, fading to 0 over 80 m (soft-ground.png).',
      areas: SOFT.map(({ name, x, z, radius_m }) => ({ name, local: { x, z }, radius_m })) },
    rockyAreas: ROCKY.map((a) => site(a.name, a.x, a.z, { radius_m: a.radius_m,
      slopeExcess_deg: round(meanSlope(a.x, a.z, 0, a.radius_m) - meanSlope(a.x, a.z, a.radius_m + 60, a.radius_m + 200)),
      description: 'PLACEHOLDER: boulder field on the crater floor (bumpy, steeper ground).' })),
    viewpoints: [
      site('Delta layers view', vx, vz, { kind: 'deltaLayers', lookToward: towardDelta(vx, vz) }),
      site('Sunset over the delta', rx, rz, { kind: 'sunset', lookToward: { x: -1, z: 0 } }),
    ],
    perseveranceLanding: { name: 'Octavia E. Butler Landing', local: OEB, latLon: latLon(OEB.x, OEB.z), source: 'placeholder position' },
    deltaRamp: site('Delta ramp foot', ux, uz),
    notes: ['PLACEHOLDER: procedural terrain, replaced by the real Jezero terrain in terrain/mars/.'],
  },
  files_bytes: {},
  sources: [{ dataset: 'Placeholder procedural terrain (not real data)', provider: 'Rover Engineer team' }],
  credits: ['Placeholder terrain: procedural, not NASA data. The real Jezero crater terrain replaces it.'],
};
const texture = {
  version: 1, generated: DATE, generator: GEN, placeholder: true,
  playArea: { file: 'albedo.png', encoding: '8-bit grayscale PNG', size_px: [N, N], pixel_m: PX,
    grid: 'Same grid as heightmap.png: pixel (col, row) is centered on heightmap vertex (col, row), i.e. x = (col - 800) * 5, z = (row - 800) * 5. Row 0 = -z (north), column 0 = -x.' },
  source: { dataset: 'Placeholder procedural ground texture (not real data)', credit: 'Rover Engineer team' },
};
for (const f of ['albedo.png', 'distant-far.png', 'distant-near.png', 'heightmap.png', 'slope.png', 'soft-ground.png'])
  terrain.files_bytes[f] = statSync(new URL(f, OUT)).size;
writeFileSync(new URL('terrain.json', OUT), JSON.stringify(terrain, null, 2) + '\n');
writeFileSync(new URL('texture.json', OUT), JSON.stringify(texture, null, 2) + '\n');
console.log(`landing max slope within 75 m: ${landingMax.toFixed(2)} deg; play-area max slope: ${maxSlope.toFixed(1)} deg`);
