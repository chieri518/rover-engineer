#!/usr/bin/env node
// Download the public-domain NASA imagery the intro's Earth-orbit shot uses (Act 1) into
// cinematic/assets/download/ (gitignored). Run once from game/:
//
//   node cinematic/tools/fetch-assets.mjs            fetch what is missing
//   node cinematic/tools/fetch-assets.mjs --force    fetch everything again
//
// Downloads are untrusted data: only https URLs on nasa.gov hosts (redirects too), only image responses, the bytes
// must be a JPEG or PNG whose header gives the expected size, and every file has a byte limit. Files already
// present are skipped. Credits and licenses: cinematic/assets/CREDITS.md.
import { mkdirSync, existsSync, writeFileSync, renameSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../assets/download');
const force = process.argv.includes('--force');

/** The region under the orbit shot (degrees): the western Atlantic off the US east coast. Keep in sync with act1/earth.ts. */
export const REGION = { south: 17, north: 45, west: -92, east: -58 };
const regionW = REGION.east - REGION.west;
const regionH = REGION.north - REGION.south;

function gibs(layer, width, { time, format = 'image/jpeg' } = {}) {
  const height = Math.round((width * regionH) / regionW);
  const q = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer, STYLES: '', CRS: 'EPSG:4326',
    // WMS 1.3.0 + EPSG:4326: axis order is lat,lon.
    BBOX: `${REGION.south},${REGION.west},${REGION.north},${REGION.east}`,
    WIDTH: String(width), HEIGHT: String(height), FORMAT: format,
  });
  if (time) q.set('TIME', time);
  return { url: `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q}`, width, height };
}

const EO = 'https://assets.science.nasa.gov/content/dam/science/esd/eo';
const FILES = [
  // Regional, all on the same lat/lon box (equirectangular), from NASA GIBS.
  { name: 'region-ground.jpg', ...gibs('BlueMarble_ShadedRelief_Bathymetry', 4096), maxBytes: 40e6 },
  { name: 'region-day.jpg', ...gibs('VIIRS_NOAA20_CorrectedReflectance_TrueColor', 8192, { time: '2024-09-20' }), maxBytes: 80e6 },
  { name: 'region-lights.jpg', ...gibs('VIIRS_Black_Marble', 4096), maxBytes: 40e6 },
  // Whole-Earth fallbacks for anything outside the region (the far limb), from NASA Earth Observatory.
  { name: 'world-ground.jpg', url: `${EO}/images/bmng/bmng-topography-bathymetry/september/world.topo.bathy.200409.3x5400x2700.jpg`, width: 5400, height: 2700, maxBytes: 30e6 },
  { name: 'world-clouds.jpg', url: `${EO}/content-feature/bluemarble/images/cloud_combined_2048.jpg`, width: 2048, height: 1024, maxBytes: 10e6 },
  { name: 'world-lights.jpg', url: `${EO}/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg`, width: 3600, height: 1800, maxBytes: 20e6 },
];

function allowed(u) {
  const url = new URL(u);
  return url.protocol === 'https:' && (url.hostname === 'nasa.gov' || url.hostname.endsWith('.nasa.gov'));
}

/** Image size from the bytes (JPEG SOF or PNG IHDR), or null when the bytes are not a JPEG/PNG. */
function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a && b.toString('latin1', 12, 16) === 'IHDR') {
    return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { type: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

async function fetchChecked(url, maxBytes) {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!allowed(current)) throw new Error(`refusing a non-nasa.gov or non-https URL: ${current}`);
    const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': 'rover-engineer-intro-asset-fetch' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) throw new Error(`not an image (${type}): ${(await res.text()).slice(0, 300)}`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error(`too big: ${declared} bytes`);
    const chunks = [];
    let n = 0;
    for await (const c of res.body) {
      n += c.length;
      if (n > maxBytes) throw new Error(`too big: over ${maxBytes} bytes`);
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  }
  throw new Error('too many redirects');
}

function check(name, bytes, f) {
  const size = imageSize(bytes);
  if (!size) throw new Error(`${name}: not a JPEG or PNG`);
  if (size.width !== f.width || size.height !== f.height) throw new Error(`${name}: ${size.width}x${size.height}, expected ${f.width}x${f.height}`);
  if (bytes.length < 50e3) throw new Error(`${name}: suspiciously small (${bytes.length} bytes)`);
}

mkdirSync(dir, { recursive: true });
let failed = 0;
for (const f of FILES) {
  const file = path.join(dir, f.name);
  if (!force && existsSync(file)) {
    try {
      check(f.name, readFileSync(file), f);
      console.log(`have  ${f.name}`);
      continue;
    } catch {
      console.log(`stale ${f.name}, fetching again`);
    }
  }
  process.stdout.write(`fetch ${f.name} ... `);
  try {
    const bytes = await fetchChecked(f.url, f.maxBytes);
    check(f.name, bytes, f);
    const tmp = `${file}.part`;
    writeFileSync(tmp, bytes);
    renameSync(tmp, file);
    console.log(`${(bytes.length / 1e6).toFixed(1)} MB, ${f.width}x${f.height}`);
  } catch (e) {
    rmSync(`${file}.part`, { force: true });
    console.log(`FAILED: ${e.message}`);
    failed++;
  }
}
if (failed) {
  console.error(`${failed} file(s) failed; the orbit shot falls back to lower-resolution or missing layers.`);
  process.exit(1);
}
console.log(`assets in ${dir}`);
