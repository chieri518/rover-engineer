// PLACEHOLDER Titan terrain: procedural, NOT real data. It stands in for the Titan terrain from the data
// pipeline (public/terrain/titan/, tools/build_terrain_titan.py) so the game can load and drive on Titan.
// Writes public/terrain/titan-placeholder/ in the agreed terrain.json shape (titan-build-log.md,
// rules/titanTypes.ts TitanTerrainFeatures): linear dunes WSW-ENE with soft graded sand, firm interdune
// corridors, a dune-crest viewpoint, a crossing saddle, an interdune sample patch, a Selk ejecta field
// (rocky area) near the map edge, and Selk's rim in the far ring.
// Regenerate (deterministic, seeded) with:  node scripts/make-titan-placeholder.mjs   (from game/)
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const OUT = new URL('../public/terrain/titan-placeholder/', import.meta.url);
const GEN = 'game/scripts/make-titan-placeholder.mjs';
const DATE = '2026-11-15';
const R_TITAN = 2574730;
const ORIGIN = [7.0, 160.0]; // placeholder site in the Shangri-La dunes near Selk (east longitude); the pipeline sets the real one
const SEED = 3034;

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

// ---------- dune frame (local meters: +x east, +z south) ----------
// u runs along the crests (azimuth ORIENT from north toward east), v across them.
const ORIENT = 77; // deg
const A = (ORIENT * Math.PI) / 180;
const D = { x: Math.sin(A), z: -Math.cos(A) }; // along the crest
const N = { x: Math.cos(A), z: Math.sin(A) }; // across (mostly south)
const toUV = (x, z) => ({ u: x * D.x + z * D.z, v: x * N.x + z * N.z });
const toXZ = (u, v) => ({ x: u * D.x + v * N.x, z: u * D.z + v * N.z });

const SPACING = 2400; // crest to crest, m
const HALF_W = 700; // dune half-width, m (dunes ~1.4 km wide)
const H0 = 60; // typical dune height, m
const LANDING = { x: 250, z: -60 }; // in the central interdune corridor (v ~ 0)
const SADDLE = { u: 300, crestV: -SPACING / 2 }; // crossing saddle on the dune north of the landing
const crestIndex = (v) => Math.round((v - SPACING / 2) / SPACING);
const crestV = (k) => SPACING / 2 + k * SPACING;
/** Dune height factor at a crest position u (varies along the crest; a low saddle on the crossing). */
function duneHeight(k, u) {
  let h = H0 * (1 + 0.3 * noise(u, k * 977, 2500, 1));
  if (crestV(k) === SADDLE.crestV) h *= 1 - 0.6 * Math.exp(-(((u - SADDLE.u) / 350) ** 2));
  return h;
}
/** Height of the dunes above the interdune floor, and the dune's own height, at local (x, z). */
function dune(x, z) {
  const { u, v } = toUV(x, z);
  const wob = 90 * noise(u, 0, 1800, 2); // crests wander a little
  const k = crestIndex(v - wob), dv = v - wob - crestV(k);
  const H = duneHeight(k, u);
  if (Math.abs(dv) >= HALF_W) return { h: 0, H, frac: 0 };
  const c = Math.cos((Math.PI * dv) / (2 * HALF_W));
  const frac = c * c;
  return { h: H * frac, H, frac };
}

const ROCKY = [{ name: 'Selk ejecta field', ...toXZ(-2400, SPACING), radius_m: 230 }];
for (const a of ROCKY) { a.x = Math.round(a.x); a.z = Math.round(a.z); }
for (const a of ROCKY) { // seeded ejecta blocks
  const r = rng(SEED + a.x);
  a.bumps = Array.from({ length: 300 }, () => {
    const d = a.radius_m * Math.sqrt(r()), t = 2 * Math.PI * r();
    return { x: a.x + d * Math.cos(t), z: a.z + d * Math.sin(t), s: 5 + 7 * r(), h: 0.8 + 1.8 * r() };
  });
}
const PATCH = { ...toXZ(900, 150), radius_m: 60 };
const SELK = { bearing: 60, distance: 90000, radius: 42000, rim: 300 };
const SELK_C = { x: SELK.distance * Math.sin((SELK.bearing * Math.PI) / 180), z: -SELK.distance * Math.cos((SELK.bearing * Math.PI) / 180) };

/** Graded sand softness: crest belts 1, lower flanks ~0.3-0.6, interdunes 0, a firmer saddle. */
function softness(x, z) {
  const { frac } = dune(x, z);
  let s = smooth(0.05, 0.75, frac);
  const { u, v } = toUV(x, z);
  if (Math.abs(v - SADDLE.crestV) < HALF_W) s = Math.min(s, 0.5 + 0.5 * smooth(150, 400, Math.abs(u - SADDLE.u)));
  return s;
}

/** Elevation (m above an arbitrary local datum) at local (x, z). Detail finer than the grid `pixel` is left out. */
function elevation(x, z, pixel = 5) {
  const oct = (amp, cell, s) => (cell >= 3 * pixel ? amp * noise(x, z, cell, s) : 0);
  let h = 40 + 15 * noise(x, z, 20000, 3) + 25 * noise(x, z, 60000, 4);
  h += dune(x, z).h;
  const flat = smooth(150, 350, Math.hypot(x - LANDING.x, z - LANDING.z));
  h += flat * (oct(1.5, 400, 5) + oct(0.5, 80, 6) + oct(0.15, 20, 7));
  // Selk: a raised rim with a lower floor, far outside the play area (horizon only)
  const dc = Math.hypot(x - SELK_C.x, z - SELK_C.z);
  h += SELK.rim * Math.exp(-(((dc - SELK.radius) / 5000) ** 2)) - 200 * smooth(SELK.radius, SELK.radius * 0.7, dc);
  for (const a of ROCKY) {
    if (pixel > 10 || Math.hypot(x - a.x, z - a.z) > a.radius_m + 40) continue;
    for (const b of a.bumps) {
      const q = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.s * b.s);
      if (q < 9) h += b.h * Math.exp(-q);
    }
  }
  return h;
}
const height = (x, z, pixel) => elevation(x, z, pixel) - (x * x + z * z) / (2 * R_TITAN);

// ---------- grids and PNGs (as in make-mars-placeholder.mjs) ----------
function sampleGrid(n, pixel) {
  const half = (n - 1) / 2, h = new Float64Array(n * n);
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) h[row * n + col] = height((col - half) * pixel, (row - half) * pixel, pixel);
  return h;
}
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
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = depth;
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
const NS = 1601, PX = 5, HALF = 800;
const hm = sampleGrid(NS, PX);
const hmRange = encode16('heightmap.png', NS, hm);
const slope = new Float64Array(NS * NS);
for (let row = 0; row < NS; row++) for (let col = 0; col < NS; col++) {
  const at = (c, r) => hm[clamp(r, 0, NS - 1) * NS + clamp(c, 0, NS - 1)];
  const dc = col === 0 || col === NS - 1 ? 1 : 2, dr = row === 0 || row === NS - 1 ? 1 : 2;
  const gx = (at(col + 1, row) - at(col - 1, row)) / (dc * PX), gz = (at(col, row + 1) - at(col, row - 1)) / (dr * PX);
  slope[row * NS + col] = (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI;
}
encode8('slope.png', NS, (i) => slope[i] * 4);
const xz = (i) => [((i % NS) - HALF) * PX, (Math.floor(i / NS) - HALF) * PX];
encode8('soft-ground.png', NS, (i) => softness(...xz(i)) * 255);
encode8('albedo.png', NS, (i) => {
  const [x, z] = xz(i), { frac } = dune(x, z);
  const patch = smooth(PATCH.radius_m + 30, PATCH.radius_m - 10, Math.hypot(x - PATCH.x, z - PATCH.z));
  const rocks = ROCKY.reduce((m, a) => Math.max(m, smooth(a.radius_m + 60, a.radius_m * 0.6, Math.hypot(x - a.x, z - a.z))), 0);
  return 150 - 90 * smooth(0.02, 0.4, frac) + 8 * noise(x, z, 300, 11) + 5 * noise(x, z, 40, 12) + 3 * noise(x, z, 10, 13)
    + 30 * patch + 25 * rocks;
});
const near = encode16('distant-near.png', 1001, sampleGrid(1001, 50));
const far = encode16('distant-far.png', 1001, sampleGrid(1001, 200));

// ---------- sites ----------
const latLon = (x, z) => [round(ORIGIN[0] - (z / R_TITAN) * (180 / Math.PI), 5),
  round(ORIGIN[1] + (x / (R_TITAN * Math.cos((ORIGIN[0] * Math.PI) / 180))) * (180 / Math.PI), 5)];
const slopeAt = (x, z) => slope[clamp(Math.round(z / PX) + HALF, 0, NS - 1) * NS + clamp(Math.round(x / PX) + HALF, 0, NS - 1)];
function site(name, x, z, extra = {}) {
  x = Math.round(x); z = Math.round(z);
  const d = Math.hypot(x - LANDING.x, z - LANDING.z);
  return { name, local: { x, y: round(height(x, z), 2), z }, latLon: latLon(x, z), elevation_m: round(elevation(x, z)),
    slope_deg: round(slopeAt(x, z)), distanceFromLanding_m: Math.round(d), driveDistanceFromLanding_m: Math.round(d * 1.15),
    source: 'placeholder', ...extra };
}
const IN = 3990;
const inside = (p) => Math.abs(p.x) <= IN && Math.abs(p.z) <= IN;
/** Points along v = const, every `step` m of u, inside the play area. */
function lineAlong(v, step = 400) {
  const pts = [];
  for (let u = -6000; u <= 6000; u += step) { const p = toXZ(u, v); if (inside(p)) pts.push([Math.round(p.x), Math.round(p.z)]); }
  return pts;
}
/** Clip a convex polygon to the play-area square (Sutherland-Hodgman). */
function clipSquare(poly) {
  const edges = [(p) => p[0] >= -IN, (p) => p[0] <= IN, (p) => p[1] >= -IN, (p) => p[1] <= IN];
  const cut = [(a, b) => (-IN - a[0]) / (b[0] - a[0]), (a, b) => (IN - a[0]) / (b[0] - a[0]), (a, b) => (-IN - a[1]) / (b[1] - a[1]), (a, b) => (IN - a[1]) / (b[1] - a[1])];
  let out = poly;
  for (let e = 0; e < 4; e++) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[(i + 1) % src.length], ina = edges[e](a), inb = edges[e](b);
      if (ina) out.push(a);
      if (ina !== inb) { const t = cut[e](a, b); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    }
    if (out.length === 0) break;
  }
  return out.map(([x, z]) => [Math.round(x), Math.round(z)]);
}

const crestLines = [];
const corridors = [];
const corridorNames = { '-1': 'North corridor', '0': 'Landing corridor', '1': 'South corridor', '-2': 'Far north corridor', '2': 'Far south corridor' };
for (let k = -3; k <= 2; k++) {
  const line = lineAlong(crestV(k));
  if (line.length >= 2) crestLines.push({ name: `Dune ${crestLines.length + 1}`, crestLocal_xz: line, height_m: H0, width_m: 2 * HALF_W });
}
for (let j = -2; j <= 2; j++) { // corridor j lies between crests j-1 and j (centered on v = j * SPACING)
  const v0 = j * SPACING - (SPACING / 2 - HALF_W), v1 = j * SPACING + (SPACING / 2 - HALF_W);
  const rect = [[-7000, v0], [7000, v0], [7000, v1], [-7000, v1]].map(([u, v]) => { const p = toXZ(u, v); return [p.x, p.z]; });
  const outline = clipSquare(rect);
  const center = lineAlong(j * SPACING);
  if (outline.length >= 3 && center.length >= 2) corridors.push({ name: corridorNames[String(j)], outlineLocal_xz: outline, centerLocal_xz: center });
}
// Circle cover of the softest sand (softness >= 0.6): along each crest, away from the saddle.
const softAreas = [];
for (let k = -3; k <= 2; k++) {
  for (let u = -6000; u <= 6000; u += 300) {
    const p = toXZ(u, crestV(k) + 90 * noise(u, 0, 1800, 2));
    if (!inside(p) || softness(p.x, p.z) < 0.6) continue;
    softAreas.push({ name: `Dune sand ${softAreas.length + 1}`, local: { x: Math.round(p.x), z: Math.round(p.z) }, radius_m: 300 });
  }
}
const at = (u, v) => toXZ(u, v + 90 * noise(u, 0, 1800, 2));
const from = toXZ(SADDLE.u, -450), crest = at(SADDLE.u, SADDLE.crestV), to = toXZ(SADDLE.u, -1950);
const path = [-450, -800, SADDLE.crestV, -1600, -1950].map((v) => { const p = v === SADDLE.crestV ? crest : toXZ(SADDLE.u, v); return [Math.round(p.x), Math.round(p.z)]; });
let pathMax = 0;
for (let i = 0; i + 1 < path.length; i++) for (let t = 0; t <= 1; t += 0.02) pathMax = Math.max(pathMax, slopeAt(path[i][0] + t * (path[i + 1][0] - path[i][0]), path[i][1] + t * (path[i + 1][1] - path[i][1])));
const view = at(-700, SPACING / 2);
const meanSlope = (cx, cz, r0, r1) => { let s = 0, n = 0;
  for (let z = cz - r1; z <= cz + r1; z += PX) for (let x = cx - r1; x <= cx + r1; x += PX) {
    const d = Math.hypot(x - cx, z - cz); if (d >= r0 && d <= r1) { s += slopeAt(x, z); n++; } }
  return s / n; };
// Horizon from the landing (eye 1.7 m), every 5 deg of azimuth, out to 100 km.
const eye = height(LANDING.x, LANDING.z) + 1.7;
const horizon = [];
for (let az = 0; az < 360; az += 5) {
  const s = Math.sin((az * Math.PI) / 180), c = -Math.cos((az * Math.PI) / 180);
  let best = -90;
  for (let d = 20; d <= 100000; d *= 1.02) { const p = { x: LANDING.x + d * s, z: LANDING.z + d * c };
    best = Math.max(best, (Math.atan2(height(p.x, p.z, d < 4000 ? 5 : 200) - eye, d) * 180) / Math.PI); }
  horizon.push(round(best, 2));
}
let landingMax = 0;
for (let z = -75; z <= 75; z += PX) for (let x = -75; x <= 75; x += PX) if (x * x + z * z <= 75 * 75) landingMax = Math.max(landingMax, slopeAt(LANDING.x + x, LANDING.z + z));
let maxSlope = 0, minH = Infinity, maxH = -Infinity;
for (let i = 0; i < hm.length; i++) { maxSlope = Math.max(maxSlope, slope[i]); minH = Math.min(minH, hm[i]); maxH = Math.max(maxH, hm[i]); }

const bounds = (half) => ({ xMin: -half, xMax: half, zMin: -half, zMax: half });
const H16 = 'height_m = min_m + value / 65535 * (max_m - min_m)';
const selkDist = Math.hypot(SELK_C.x - LANDING.x, SELK_C.z - LANDING.z);
const terrain = {
  version: 1, generated: DATE, generator: GEN, placeholder: true,
  site: 'PLACEHOLDER procedural terrain standing in for the Shangri-La dunes near Selk crater, Titan (not real data)',
  frame: {
    description: 'Local right-handed, y-up frame in meters (Three.js convention). Origin = play-area center at originLatLon. +x = east, +z = south, +y = up. Image rows increase with +z, columns with +x.',
    originLatLon: ORIGIN,
    azimuthConvention: 'azimuth_deg is measured from local -z (north), turning toward +x (east)',
    heights: 'All heightmaps store TANGENT-PLANE heights: elevation (m above an arbitrary local datum) minus the curvature drop r^2 / (2R), r = horizontal distance from the origin, R = 2574730 m.',
  },
  sunAndEarth: { siteLatitude_deg: ORIGIN[0], siteLongitude_deg: ORIGIN[1], note: 'PLACEHOLDER site (east longitude). No Earth in the sky on Titan.' },
  playArea: {
    size_m: 8000, pixel_m: PX, samples: NS, boundsLocal: bounds(4000),
    pixelToLocal: 'sample (col, row) -> x = (col - 800) * 5, z = (row - 800) * 5 (vertex-centered grid)',
    files: {
      heightmap: { file: 'heightmap.png', encoding: 'uint16 grayscale PNG', ...hmRange, formula: H16 },
      slope: { file: 'slope.png', encoding: 'uint8 grayscale PNG', formula: 'slope_deg = value / 4' },
      softGround: { file: 'soft-ground.png', encoding: 'uint8 grayscale PNG', formula: 'softness = value / 255 (0 firm interdune, 1 loose crest sand)' },
    },
    elevationRange_m: [round(minH), round(maxH)],
  },
  distantTerrain: [
    { name: 'near ring', file: 'distant-near.png', encoding: 'uint16 grayscale PNG', ...near, formula: H16, size_m: 50000, pixel_m: 50, samples: 1001,
      boundsLocal: bounds(25000), pixelToLocal: 'x = (col - 500) * 50, z = (row - 500) * 50',
      hole: 'Covers the play area too; skip or sink the part inside playArea.boundsLocal.', source: 'placeholder' },
    { name: 'far ring', file: 'distant-far.png', encoding: 'uint16 grayscale PNG', ...far, formula: H16, size_m: 200000, pixel_m: 200, samples: 1001,
      boundsLocal: bounds(100000), pixelToLocal: 'x = (col - 500) * 200, z = (row - 500) * 200',
      hole: "Covers the near ring too; skip or sink the part inside the near ring's bounds.", source: 'placeholder (carries a stand-in for Selk crater rim)' },
  ],
  landing: (({ name, local, latLon, elevation_m, slope_deg, source }) => ({ name, local, latLon, elevation_m, slope_deg, source }))(site('Landing', LANDING.x, LANDING.z)),
  features: {
    duneCrests: {
      description: `PLACEHOLDER: linear dunes about ${H0} m high and ${2 * HALF_W / 1000} km wide, crests ${SPACING / 1000} km apart, running WSW-ENE.`,
      orientation_deg: ORIENT, zoneRadius_m: 150, source: 'placeholder', lines: crestLines,
    },
    interdunes: { description: 'PLACEHOLDER: firm, bright interdune corridors between the dunes (softness 0).', corridors },
    softGround: {
      description: 'Graded dune sand: soft-ground.png is authoritative (crest belts 1, lower flanks ~0.3-0.6, interdunes 0, a firmer saddle on the crossing route). areas: a circle cover of the sand with softness >= 0.6.',
      maskIsAuthoritative: true, areas: softAreas,
    },
    rockyAreas: ROCKY.map((a) => site(a.name, a.x, a.z, { radius_m: a.radius_m,
      slopeExcess_deg: round(meanSlope(a.x, a.z, 0, a.radius_m) - meanSlope(a.x, a.z, a.radius_m + 60, a.radius_m + 200)),
      description: 'PLACEHOLDER: a field of ejecta blocks from Selk crater, in an interdune corridor near the map edge.' })),
    viewpoints: [site('Dune crest view', view.x, view.z, { kind: 'duneCrest', lookToward: { x: round(N.x, 3), z: round(N.z, 3) } })],
    samplePatch: site('Bright interdune patch', PATCH.x, PATCH.z, { radius_m: PATCH.radius_m, description: 'PLACEHOLDER: a bright patch of interdune ground to sample.' }),
    crossingRoute: {
      name: 'Dune crossing', description: 'PLACEHOLDER: from the landing corridor over a low saddle in the dune to the north, to the next corridor.',
      fromCorridor: site('Crossing start', from.x, from.z), crestPoint: site('Crossing saddle', crest.x, crest.z), toCorridor: site('Crossing end', to.x, to.z),
      pathLocal_xz: path, maxSlope_deg: round(pathMax), source: 'placeholder',
    },
    selk: {
      name: 'Selk crater', description: 'PLACEHOLDER: an impact crater about 80 km across; its rim stands on the horizon.',
      centerLatLon: latLon(SELK_C.x, SELK_C.z), centerLocal: { x: Math.round(SELK_C.x), z: Math.round(SELK_C.z) }, diameter_km: (2 * SELK.radius) / 1000,
      rimHeight_m: SELK.rim, bearingFromLanding_deg: round(((Math.atan2(SELK_C.x - LANDING.x, -(SELK_C.z - LANDING.z)) * 180) / Math.PI + 360) % 360),
      distanceFromLanding_km: round(selkDist / 1000), source: 'placeholder position',
    },
    notes: ['PLACEHOLDER: procedural terrain, replaced by the pipeline terrain in terrain/titan/.'],
  },
  horizonFromLanding: { eyeHeight_m: 1.7, azimuthStep_deg: 5, elevation_deg_by_azimuth: horizon },
  files_bytes: {},
  sources: [{ dataset: 'Placeholder procedural terrain (not real data)', provider: 'Rover Engineer team' }],
  credits: ['Placeholder terrain: procedural, not NASA data. The Titan terrain modeled on Cassini data replaces it.'],
};
const texture = {
  version: 1, generated: DATE, generator: GEN, placeholder: true,
  playArea: { file: 'albedo.png', encoding: '8-bit grayscale PNG', size_px: [NS, NS], pixel_m: PX,
    grid: 'Same grid as heightmap.png: pixel (col, row) is centered on heightmap vertex (col, row), i.e. x = (col - 800) * 5, z = (row - 800) * 5. Row 0 = -z (north), column 0 = -x.' },
  source: { dataset: 'Placeholder procedural ground texture (not real data)', credit: 'Rover Engineer team' },
};
for (const f of ['albedo.png', 'distant-far.png', 'distant-near.png', 'heightmap.png', 'slope.png', 'soft-ground.png'])
  terrain.files_bytes[f] = statSync(new URL(f, OUT)).size;
writeFileSync(new URL('terrain.json', OUT), JSON.stringify(terrain, null, 2) + '\n');
writeFileSync(new URL('texture.json', OUT), JSON.stringify(texture, null, 2) + '\n');
console.log(`landing max slope within 75 m: ${landingMax.toFixed(2)} deg; play-area max slope: ${maxSlope.toFixed(1)} deg; crossing max ${pathMax.toFixed(1)} deg`);
console.log(`crests ${crestLines.length}, corridors ${corridors.length}, soft circles ${softAreas.length}; ejecta ${ROCKY[0].x},${ROCKY[0].z}; view ${Math.round(view.x)},${Math.round(view.z)}`);
