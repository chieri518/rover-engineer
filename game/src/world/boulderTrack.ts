// The rolled boulder's track: the game's first terrain decal. A thin ribbon draped on the ground from
// the top of the wall down to just short of the boulder, textured like real lunar boulder tracks in LRO
// images: a chain of small oval bounce/roll imprints along a faint trough, a little brighter than the
// surrounding regolith (freshly disturbed soil). Procedural texture, no image files.
// Drawn with a multiplicative blend (ground * (1 + mask * (brighten - 1))) instead of a lit, colored decal:
// the terrain shader multiplies in albedo, speckle and sun, so a decal with its own flat color read darker
// than a sunlit ground. Scaling what is already on screen keeps the ground's texture, sun and shadows, and
// the track is the same fraction brighter lit or in shade.
import * as THREE from 'three';
import type { HeightGrid } from './terrainData';
import type { Tuning } from '../rules/types';

export interface BoulderTrackLine {
  from: { x: number; z: number };
  to: { x: number; z: number };
}


function makeTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const cx = w / 2;
  // Faint trough: soft band along the whole track.
  const band = ctx.createLinearGradient(0, 0, w, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.25, 'rgba(255,255,255,0.18)');
  band.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  band.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h);
  // Chain of oval imprints, each a soft radial blob stretched along the track; the chain wanders a little.
  const n = 14;
  for (let i = 0; i < n; i++) {
    const y = ((i + 0.5 + (rnd() - 0.5) * 0.4) / n) * h;
    const x = cx + (rnd() - 0.5) * w * 0.16;
    const rx = w * (0.1 + 0.07 * rnd());
    const ry = (h / n) * (0.75 + 0.35 * rnd()); // overlapping, so the chain reads as one groove
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(255,255,255,0.3)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Fade the left and right edges so the ribbon has soft sides.
  ctx.globalCompositeOperation = 'multiply';
  const edge = ctx.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, '#000');
  edge.addColorStop(0.25, '#fff');
  edge.addColorStop(0.75, '#fff');
  edge.addColorStop(1, '#000');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function createBoulderTrack(
  line: BoulderTrackLine,
  fine: HeightGrid,
  cfg: Tuning['boulderTrack'],
): THREE.Mesh {
  const { widthM: WIDTH_M, tileLengthM: TILE_LENGTH_M, stepAlongM: STEP_ALONG_M, pointsAcross: POINTS_ACROSS, liftM: LIFT_M, stopShortM: STOP_SHORT_M, brighten: BRIGHTEN, glow: GLOW } = cfg;
  const dx = line.to.x - line.from.x;
  const dz = line.to.z - line.from.z;
  const full = Math.hypot(dx, dz);
  const length = Math.max(full - STOP_SHORT_M, 1);
  const ux = dx / full;
  const uz = dz / full;
  const px = -uz;
  const pz = ux;
  const rows = Math.max(2, Math.ceil(length / STEP_ALONG_M) + 1);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < rows; i++) {
    const t = (i / (rows - 1)) * length;
    for (let j = 0; j < POINTS_ACROSS; j++) {
      const s = (j / (POINTS_ACROSS - 1) - 0.5) * WIDTH_M;
      // A gentle wander so it does not look ruled.
      const x = line.from.x + ux * t + px * (s + Math.sin(t * 0.21) * 0.35);
      const z = line.from.z + uz * t + pz * (s + Math.sin(t * 0.21) * 0.35);
      pos.push(x, fine.sample(x, z) + LIFT_M, z);
      uv.push(j / (POINTS_ACROSS - 1), t / TILE_LENGTH_M);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < POINTS_ACROSS - 1; j++) {
      const a = i * POINTS_ACROSS + j;
      const b = a + 1;
      const c = a + POINTS_ACROSS;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // Make sure normals face up whatever the winding came out as.
  const nrm = geo.getAttribute('normal');
  if (nrm.getY(0) < 0) {
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
    nrm.needsUpdate = true;
  }
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setRGB(BRIGHTEN - 1, BRIGHTEN - 1, BRIGHTEN - 1, THREE.SRGBColorSpace), // blended on the displayed (sRGB) values
    map: makeTexture(),
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor, // dst * src + dst * 1
    blendDst: THREE.OneFactor,
    toneMapped: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  // A faint additive layer on top, so the track also shows where the ground is nearly black (a multiplied
  // black stays black).
  const glow = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setRGB(GLOW, GLOW, GLOW, THREE.SRGBColorSpace),
    map: material.map,
    transparent: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  const glowMesh = new THREE.Mesh(geo, glow);
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 1;
  mesh.add(glowMesh);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

export function disposeBoulderTrack(mesh: THREE.Mesh): void {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  const m = mesh.material as THREE.MeshBasicMaterial;
  m.map?.dispose();
  m.dispose();
  for (const child of mesh.children) ((child as THREE.Mesh).material as THREE.Material).dispose();
}
