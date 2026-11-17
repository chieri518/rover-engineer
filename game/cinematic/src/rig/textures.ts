// Procedural detail maps for the cinematic materials (rover and lander): tangent-space normal maps and
// grey maps made once in JS, seeded, tileable. No image files.
import * as THREE from 'three';

/** Seeded generator (mulberry32). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dataTexture(data: Uint8Array, size: number, color: boolean, repeat: [number, number]): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** A tileable height field to a normal map (strength: height units per texel to slope). */
export function normalFromHeight(h: Float32Array, size: number, strength: number, repeat: [number, number] = [1, 1]): THREE.DataTexture {
  const out = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out[i] = Math.round((-dx / len * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((dy / len * 0.5 + 0.5) * 255); // texture v runs up: flip y
      out[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return dataTexture(out, size, false, repeat);
}

/** A grey map (roughness, AO, tint) from values 0..1. */
export function greyTexture(v: Float32Array, size: number, repeat: [number, number] = [1, 1], color = false): THREE.DataTexture {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const g = Math.round(Math.min(1, Math.max(0, v[i]!)) * 255);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = g;
    out[i * 4 + 3] = 255;
  }
  return dataTexture(out, size, color, repeat);
}

/** Tileable value noise (fbm) on a size×size grid, cells of `cell` texels, `octaves` octaves. */
export function fbm(size: number, cell: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const rand = seeded(seed + o * 101);
    const n = Math.max(1, Math.round(size / cell));
    const grid = new Float32Array(n * n).map(() => rand());
    const g = (i: number, j: number) => grid[((j + n) % n) * n + ((i + n) % n)]!;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const i = Math.floor(fx);
        const j = Math.floor(fy);
        let u = fx - i;
        let v = fy - j;
        u = u * u * (3 - 2 * u);
        v = v * v * (3 - 2 * v);
        const a = g(i, j) * (1 - u) + g(i + 1, j) * u;
        const b = g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u;
        out[y * size + x]! += (a * (1 - v) + b * v) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
    cell /= 2;
  }
  for (let i = 0; i < out.length; i++) out[i]! /= total;
  return out;
}

/**
 * Crinkled multi-layer insulation: a sheet with broad soft undulations, sharp creases (ridges and valleys
 * drawn as blurred strokes, wrapped so the tile repeats) and a taped seam along the tile's edges.
 * Returns the normal map and a grey map for roughness variation (creases a little rougher).
 */
export function foilMaps(seed: number, size = 512, repeat: [number, number] = [1, 1]): { normal: THREE.DataTexture; facets: THREE.DataTexture } {
  const rand = seeded(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, size, size);
  const wrapped = (draw: (ox: number, oy: number) => void) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy);
  };
  // Broad undulations.
  g.filter = `blur(${Math.round(size / 28)}px)`;
  for (let i = 0; i < 46; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = size * (0.04 + rand() * 0.12);
    const ry = rx * (0.3 + rand() * 0.7);
    const a = rand() * Math.PI;
    const v = rand() < 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${0.18 + rand() * 0.22})`;
    wrapped((ox, oy) => {
      g.beginPath();
      g.ellipse(x + ox, y + oy, rx, ry, a, 0, Math.PI * 2);
      g.fill();
    });
  }
  // Creases: long ones first, then many short ones.
  g.filter = `blur(${(size / 420).toFixed(2)}px)`;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 260; i++) {
    const big = i < 60;
    let x = rand() * size;
    let y = rand() * size;
    let a = rand() * Math.PI * 2;
    const pts: [number, number][] = [[x, y]];
    const segs = big ? 3 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 2);
    for (let k = 0; k < segs; k++) {
      a += (rand() - 0.5) * 1.2;
      const len = (big ? 0.05 + rand() * 0.12 : 0.015 + rand() * 0.04) * size;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      pts.push([x, y]);
    }
    const v = rand() < 0.5 ? 255 : 0;
    g.strokeStyle = `rgba(${v},${v},${v},${(big ? 0.45 : 0.3) + rand() * 0.3})`;
    g.lineWidth = (big ? 1.6 : 0.9) * (size / 512) * (0.7 + rand() * 0.8);
    wrapped((ox, oy) => {
      g.beginPath();
      g.moveTo(pts[0]![0] + ox, pts[0]![1] + oy);
      for (const [px, py] of pts.slice(1)) g.lineTo(px + ox, py + oy);
      g.stroke();
    });
  }
  g.filter = 'none';
  const img = g.getImageData(0, 0, size, size).data;
  const h = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  const seam = size * 0.012;
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    let v = (img[i * 4]! - 128) / 128;
    // A taped seam along the tile edges: a flat raised strip.
    const d = Math.min(x, size - x, y, size - y);
    if (d < seam) v = v * 0.15 + 0.35;
    else if (d < seam * 1.6) v -= 0.25 * (1 - (d - seam) / (seam * 0.6));
    h[i] = v;
    rough[i] = 0.85 + Math.abs((img[i * 4]! - 128) / 128) * 0.35 + (d < seam ? 0.12 : 0);
  }
  return { normal: normalFromHeight(h, size, 2.2 * (size / 512), repeat), facets: greyTexture(rough, size, repeat) };
}

/**
 * Panel lines and fasteners for painted structure: a grid of `cols`×`rows` panels with recessed seams,
 * rows of rivet heads along them, and faint fbm undulation (oil-canning). Height → normal map, plus an
 * ambient-occlusion-ish grime map (darker in the seams, a little dirt).
 */
export function panelMaps(seed: number, cols: number, rows: number, size = 1024, repeat: [number, number] = [1, 1]): { normal: THREE.DataTexture; grime: THREE.DataTexture } {
  const h = new Float32Array(size * size);
  const g = new Float32Array(size * size);
  const wav = fbm(size, size / 4, 3, seed);
  const dirt = fbm(size, size / 16, 4, seed + 3);
  const pw = size / cols;
  const ph = size / rows;
  const seam = 2.2; // texels
  const rivetR = 2.6;
  const rivetStep = 22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      const lx = x % pw;
      const ly = y % ph;
      const dEdge = Math.min(lx, pw - lx, ly, ph - ly);
      let height = wav[k]! * 2.5;
      let occl = 1;
      if (dEdge < seam) {
        height -= 1.6 * (1 - dEdge / seam);
        occl = 0.55 + 0.45 * (dEdge / seam);
      } else if (dEdge < seam + 3) occl = 0.9 + 0.1 * ((dEdge - seam) / 3);
      // Rivets in a row 7 texels inside each seam.
      const inset = 7;
      for (const [d, along] of [[lx, ly], [pw - lx, ly], [ly, lx], [ph - ly, lx]] as const) {
        if (Math.abs(d - inset) < rivetR + 1) {
          const m = along % rivetStep;
          const r = Math.hypot(d - inset, Math.min(m, rivetStep - m) - 0);
          if (r < rivetR) height += 1.2 * Math.sqrt(1 - (r / rivetR) ** 2);
          else if (r < rivetR + 1.2) occl *= 0.85;
        }
      }
      h[k] = height;
      g[k] = occl * (0.86 + 0.14 * dirt[k]!);
    }
  }
  return { normal: normalFromHeight(h, size, 1.0, repeat), grime: greyTexture(g, size, repeat) };
}

/** Brushed / machined metal: fine streaks along x. */
export function brushedNormal(seed: number, size = 256, repeat: [number, number] = [1, 1]): THREE.DataTexture {
  const rand = seeded(seed);
  const h = new Float32Array(size * size);
  const rows = new Float32Array(size).map(() => rand());
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = rows[y]! * 0.6 + rand() * 0.08;
  return normalFromHeight(h, size, 0.6, repeat);
}

/** Diamond tread plate (the ramp's walking surface): raised lozenges in a staggered pattern. */
export function treadPlateNormal(size = 512, repeat: [number, number] = [1, 1]): THREE.DataTexture {
  const h = new Float32Array(size * size);
  const n = 8;
  const c = size / n;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / c);
      const off = row % 2 ? c / 2 : 0;
      const lx = ((x + off) % c) - c / 2;
      const ly = (y % c) - c / 2;
      const orient = (Math.floor((x + off) / c) + row) % 2 ? 1 : -1;
      // A lozenge: long along one diagonal.
      const a = (lx + orient * ly) / Math.SQRT2;
      const b = (lx - orient * ly) / Math.SQRT2;
      const d = Math.pow(Math.abs(a) / (c * 0.36), 2) + Math.pow(Math.abs(b) / (c * 0.08), 2);
      h[y * size + x] = d < 1 ? Math.sqrt(1 - d) * 3 : 0;
    }
  }
  return normalFromHeight(h, size, 1.2, repeat);
}

/** A canvas texture (sRGB unless `color` is false), repeat-wrapped, mipmapped. */
export function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void, color = true): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}
