// The film's lander (fictional REL cargo lander, original design): an octagonal descent stage on four
// shock-absorbing legs, a cargo bay behind a hinged hatch that swings down into the rover's ramp, gold and
// silver multi-layer insulation, white structure with panel lines and fasteners, four main engines whose
// bells still glow after touchdown, RCS thruster pods, propellant tanks, a high-gain dish aimed at Earth and
// a vertical solar array turned to the low Sun. Built from primitives with procedural detail maps.
//
// Local frame: origin on the ground at the lander's centre, +x out of the bay door, +y up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cinePatch, type MoonUniforms } from '../rig/lighting';
import { brushedNormal, canvasTexture, fbm, foilMaps, greyTexture, panelMaps, treadPlateNormal } from '../rig/textures';

// Layout (m).
export const LANDER = {
  radius: 3.0, // octagon circumradius
  bottomY: 0.85, // underside of the body
  floorY: 1.05, // bay floor (the rover stands here)
  bandY: 3.0, // gold band below, white upper band above
  ceilingY: 3.95, // bay ceiling
  deckY: 4.25, // top deck
  doorHalfW: 1.0,
  doorTopY: 3.85,
  bayBackX: -0.62,
  bayHalfW: 1.12,
  hingeX: 2.8,
  hatchThick: 0.12,
  footR: 5.4,
  footPadR: 0.44,
} as const;

const APOTHEM = LANDER.radius * Math.cos(Math.PI / 8);
const FACE_W = 2 * LANDER.radius * Math.sin(Math.PI / 8);
export const HATCH_LEN = LANDER.doorTopY - LANDER.floorY + 0.02;

export interface LanderParts {
  object: THREE.Group;
  /** The hatch's pivot (at the hinge): rotation.z = -angle (0 closed, `openAngle` resting on the ground). */
  hatch: THREE.Object3D;
  openAngle: number;
  /** Set the hatch angle (rad from closed) and the cables that lower it. */
  setHatch(angle: number): void;
  /** Scale the bay's fill lights (bounce from the ramp, the sunlit wall): 1 in the bay shots, 0 once the rover is out. */
  setFill(k: number): void;
  /** Engine bells' afterglow, 0..1. */
  setGlow(k: number): void;
  /** Indirect light share for the exterior (1) and the bay interior (dark, ~0.05). */
  indirect: { outside: THREE.IUniform<number>; inside: THREE.IUniform<number> };
  /** The bay's small indicator lights (emissive). */
  setBayLights(k: number, work?: number): void;
  /** Ramp surface: height above the lander's ground plane at local (x, z) when fully open, or null off the ramp. */
  rampHeight(x: number, z: number): number | null;
  /** World positions of the footpad centres (for the regolith patches). */
  footpads: THREE.Vector3[];
  dispose(): void;
}

export interface LanderOptions {
  moon?: MoonUniforms;
  envMap: THREE.Texture | null;
  /** Ground height in the lander's local frame (relative to its origin), for legs and the ramp's toe. */
  groundLocal: (x: number, z: number) => number;
  /** Unit direction to Earth in the lander's local frame (the high-gain dish points there). */
  earthLocal: THREE.Vector3;
  /** Unit direction to the Sun in the local frame (the solar array turns to it). */
  sunLocal: THREE.Vector3;
}

/** World-scaled UVs by box projection along each vertex normal's dominant axis (detail maps tile evenly). */
function boxUV(g: THREE.BufferGeometry, scale: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) [u, v] = [pos.getZ(i), pos.getY(i)];
    else if (ay >= az) [u, v] = [pos.getX(i), pos.getZ(i)];
    else [u, v] = [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function logoTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 512, (g) => {
    g.clearRect(0, 0, 1024, 512);
    // An orbit ring swept around the letters, and the letters in a heavy geometric face.
    g.strokeStyle = '#1b1d22';
    g.lineCap = 'round';
    g.lineWidth = 26;
    g.beginPath();
    g.ellipse(512, 262, 430, 150, -0.12, Math.PI * 0.92, Math.PI * 2.62);
    g.stroke();
    g.fillStyle = '#1b1d22';
    g.beginPath();
    g.arc(512 + Math.cos(Math.PI * 2.62 - 0.12) * 430 * 0.98, 262 + Math.sin(Math.PI * 2.62) * 150 - 10, 26, 0, Math.PI * 2);
    g.fill();
    g.font = '900 250px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('REL', 512, 268);
    // Stencilled and weathered: bridges cut through the letters, and the paint worn away in specks and scuffs.
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    for (const x of [372, 528, 668]) g.fillRect(x, 150, 9, 240);
    let s = 91;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1300; i++) {
      const r = rand() < 0.9 ? 1 + rand() * 3 : 4 + rand() * 9;
      g.globalAlpha = 0.5 + rand() * 0.5;
      g.beginPath();
      g.ellipse(rand() * 1024, rand() * 512, r, r * (0.4 + rand() * 0.6), rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.6;
    for (let i = 0; i < 40; i++) {
      const x = rand() * 1024;
      const y = rand() * 512;
      g.fillRect(x, y, 40 + rand() * 160, 2 + rand() * 3);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  });
}

function stripeTexture(): THREE.CanvasTexture {
  // Amber and dark hazard chevrons for the hatch's hinge edge (no text).
  return canvasTexture(512, 64, (g) => {
    g.fillStyle = '#d98a1c';
    g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#16171a';
    for (let x = -64; x < 576; x += 64) {
      g.beginPath();
      g.moveTo(x, 64);
      g.lineTo(x + 32, 64);
      g.lineTo(x + 64, 0);
      g.lineTo(x + 32, 0);
      g.closePath();
      g.fill();
    }
  });
}

function nozzleGlowTexture(): THREE.CanvasTexture {
  return canvasTexture(16, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    // v = 0 at the bell's exit (bottom), 1 at the throat (top): hot at the throat.
    grad.addColorStop(0, 'rgb(0,0,0)');
    grad.addColorStop(0.55, 'rgb(20,2,0)');
    grad.addColorStop(0.85, 'rgb(200,40,4)');
    grad.addColorStop(1, 'rgb(255,120,40)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 256);
  });
}

export function buildLander(opts: LanderOptions): LanderParts {
  const object = new THREE.Group();
  object.name = 'act2:lander';
  const indirect = { outside: { value: 1 }, inside: { value: 0.05 } };
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  // ---------------------------------------------------------------------------------------------------
  // Materials
  const foil = foilMaps(11, 512, [1, 1]);
  const foilFine = foilMaps(29, 512, [1, 1]);
  const panels = panelMaps(5, 4, 4, 1024, [1, 1]);
  const brushed = brushedNormal(3, 256, [1, 1]);
  const tread = treadPlateNormal(512, [1, 1]);
  const grain = greyTexture(fbm(256, 24, 4, 9).map((v) => 0.7 + v * 0.6), 256);
  const glowTex = nozzleGlowTexture();
  const logo = logoTexture();
  const stripes = stripeTexture();
  stripes.wrapS = THREE.RepeatWrapping;
  for (const t of [foil.normal, foil.facets, foilFine.normal, foilFine.facets, panels.normal, panels.grime, brushed, tread, grain, glowTex, logo, stripes]) track(t);

  const make = (p: THREE.MeshPhysicalMaterialParameters, inside = false, physical = false) => {
    const m = physical ? new THREE.MeshPhysicalMaterial(p) : new THREE.MeshStandardMaterial(p as THREE.MeshStandardMaterialParameters);
    m.envMap = opts.envMap;
    return track(cinePatch(m, { moon: opts.moon, indirect: inside ? indirect.inside : indirect.outside, key: 'lander' }));
  };
  const M = {
    gold: make({ color: new THREE.Color(0.74, 0.4, 0.07), metalness: 0.8, roughness: 0.55, roughnessMap: foil.facets, normalMap: foil.normal, normalScale: new THREE.Vector2(1.0, 1.0) }),
    bronze: make({ color: new THREE.Color(0.62, 0.33, 0.09), metalness: 0.75, roughness: 0.55, roughnessMap: foil.facets, normalMap: foilFine.normal, normalScale: new THREE.Vector2(0.65, 0.65) }),
    darkPanel: make({ color: new THREE.Color(0.11, 0.115, 0.12), metalness: 0.25, roughness: 0.5, normalMap: panels.normal, normalScale: new THREE.Vector2(0.9, 0.9), aoMap: panels.grime }),
    silver: make({ color: new THREE.Color(0.85, 0.85, 0.87), metalness: 1, roughness: 0.5, roughnessMap: foilFine.facets, normalMap: foilFine.normal, normalScale: new THREE.Vector2(0.5, 0.5) }),
    white: make({ color: new THREE.Color(0.6, 0.6, 0.58), metalness: 0, roughness: 0.52, normalMap: panels.normal, normalScale: new THREE.Vector2(0.9, 0.9), aoMap: panels.grime, aoMapIntensity: 1 }),
    whitePlain: make({ color: new THREE.Color(0.6, 0.59, 0.57), metalness: 0, roughness: 0.5, roughnessMap: grain }),
    dark: make({ color: new THREE.Color(0.045, 0.047, 0.05), metalness: 0.35, roughness: 0.55, roughnessMap: grain }),
    graphite: make({ color: new THREE.Color(0.1, 0.1, 0.105), metalness: 0.6, roughness: 0.42, normalMap: brushed, normalScale: new THREE.Vector2(0.2, 0.2) }),
    alu: make({ color: new THREE.Color(0.72, 0.73, 0.75), metalness: 1, roughness: 0.3, normalMap: brushed, normalScale: new THREE.Vector2(0.3, 0.3) }),
    chrome: make({ color: new THREE.Color(0.75, 0.76, 0.78), metalness: 1, roughness: 0.28, normalMap: brushed, normalScale: new THREE.Vector2(0.15, 0.15) }),
    nozzle: make({ color: new THREE.Color(0.32, 0.3, 0.3), metalness: 1, roughness: 0.4, normalMap: brushed, normalScale: new THREE.Vector2(0.25, 0.25), emissive: new THREE.Color(1, 1, 1), emissiveMap: glowTex, emissiveIntensity: 0, side: THREE.DoubleSide }),
    cells: make({ color: new THREE.Color(0.05, 0.07, 0.16), metalness: 0.4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }, false, true),
    logo: make({ map: logo, transparent: true, alphaTest: 0.5, roughness: 0.55, metalness: 0 }),
    stripes: make({ map: stripes, roughness: 0.5, metalness: 0 }),
    tread: make({ color: new THREE.Color(0.62, 0.63, 0.65), metalness: 1, roughness: 0.38, normalMap: tread, normalScale: new THREE.Vector2(1.2, 1.2) }),
    // The bay: dim fill only.
    inSilver: make({ color: new THREE.Color(0.8, 0.8, 0.82), metalness: 1, roughness: 0.5, roughnessMap: foilFine.facets, normalMap: foilFine.normal, normalScale: new THREE.Vector2(0.35, 0.35) }, true),
    inDark: make({ color: new THREE.Color(0.05, 0.052, 0.055), metalness: 0.4, roughness: 0.5, roughnessMap: grain }, true),
    inGrey: make({ color: new THREE.Color(0.3, 0.31, 0.32), metalness: 0.7, roughness: 0.4, normalMap: brushed, normalScale: new THREE.Vector2(0.2, 0.2) }, true),
    inTread: make({ color: new THREE.Color(0.5, 0.51, 0.53), metalness: 1, roughness: 0.42, normalMap: tread, normalScale: new THREE.Vector2(1.2, 1.2) }, true),
    inWhite: make({ color: new THREE.Color(0.7, 0.7, 0.68), metalness: 0, roughness: 0.55, normalMap: panels.normal, normalScale: new THREE.Vector2(0.8, 0.8), aoMap: panels.grime }, true),
    cable: make({ color: new THREE.Color(0.08, 0.08, 0.085), metalness: 0.1, roughness: 0.7 }, true),
    bayLight: new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(1, 0.08, 0.04), emissiveIntensity: 0 }),
    bayLightG: new THREE.MeshStandardMaterial({ color: 0x002200, emissive: new THREE.Color(0.1, 1, 0.3), emissiveIntensity: 0 }),
  };
  track(M.bayLight);
  track(M.bayLightG);

  // Static parts are collected per material and merged at the end (a few draw calls).
  const statics = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const put = (g: THREE.BufferGeometry, m: THREE.Material, uvScale = 0.5, matrix?: THREE.Matrix4) => {
    if (matrix) g.applyMatrix4(matrix);
    // Foil crinkles at a few centimetres whatever the part's size.
    if (m === M.gold || m === M.bronze || m === M.silver || m === M.inSilver) uvScale = 1.3;
    if (uvScale > 0) boxUV(g, uvScale);
    const list = statics.get(m) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    statics.set(m, list);
  };
  const at = (x: number, y: number, z: number, ry = 0, rz = 0, rx = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YZX')), new THREE.Vector3(1, 1, 1));
  const box = (sx: number, sy: number, sz: number) => new THREE.BoxGeometry(sx, sy, sz);
  const cyl = (r0: number, r1: number, h: number, seg = 24, open = false) => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);
  /** A rod between two points. */
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 12) => {
    const d = b.clone().sub(a);
    const g = cyl(r, r, d.length(), seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  };
  /** A face panel of the octagon (face k: outward normal at k·45° from +x), spanning y0..y1, inset along its normal. */
  const faceMatrix = (k: number, y: number, out = 0) => {
    const a = (k * Math.PI) / 4;
    return at(Math.cos(a) * (APOTHEM + out), y, -Math.sin(a) * (APOTHEM + out), a);
  };
  const facePanel = (k: number, y0: number, y1: number, m: THREE.Material, out = 0, width = FACE_W, thick = 0.06) =>
    put(box(thick, y1 - y0, width), m, 0.5, faceMatrix(k, (y0 + y1) / 2, out - thick / 2));

  const L = LANDER;
  // ---------------------------------------------------------------------------------------------------
  // Body shell: gold MLI below, white structure above, silver bands, the door face framed around the opening.
  for (let k = 0; k < 8; k++) {
    if (k === 0) continue;
    facePanel(k, L.bottomY, L.bandY, k % 2 === 0 ? M.bronze : M.gold, 0.0);
    facePanel(k, L.bandY, L.deckY, k === 2 || k === 6 || k === 4 ? M.darkPanel : M.white, 0.0);
    facePanel(k, L.bandY - 0.06, L.bandY + 0.06, M.silver, 0.02, FACE_W * 0.98, 0.04);
    facePanel(k, L.bottomY, L.bottomY + 0.18, M.graphite, 0.03, FACE_W * 0.99, 0.06);
    // Corner longerons at the octagon's vertices.
    const va = ((k + 0.5) * Math.PI) / 4;
    put(box(0.09, L.deckY - L.bottomY + 0.04, 0.09), M.alu, 0.5, at(Math.cos(va) * (L.radius - 0.01), (L.bottomY + L.deckY) / 2, -Math.sin(va) * (L.radius - 0.01), va));
  }
  // The door face: pillars beside the opening, the header above, the sill below.
  {
    const sideW = (FACE_W - 2 * L.doorHalfW) / 2;
    for (const s of [-1, 1]) {
      put(box(0.16, L.deckY - L.bottomY, sideW + 0.02), M.white, 0.5, at(APOTHEM - 0.08, (L.bottomY + L.deckY) / 2, s * (L.doorHalfW + sideW / 2)));
      // Door jamb with a dark seal.
      put(box(0.22, L.doorTopY - L.floorY, 0.05), M.alu, 0.5, at(APOTHEM - 0.05, (L.floorY + L.doorTopY) / 2, s * (L.doorHalfW + 0.025)));
      put(box(0.05, L.doorTopY - L.floorY, 0.03), M.dark, 0.5, at(APOTHEM + 0.02, (L.floorY + L.doorTopY) / 2, s * (L.doorHalfW + 0.05)));
    }
    put(box(0.16, L.deckY - L.doorTopY, FACE_W), M.white, 0.5, at(APOTHEM - 0.08, (L.doorTopY + L.deckY) / 2, 0));
    put(box(0.24, 0.1, 2 * L.doorHalfW + 0.1), M.alu, 0.5, at(APOTHEM - 0.04, L.doorTopY + 0.05, 0));
    put(box(0.16, L.floorY - L.bottomY, FACE_W), M.graphite, 0.5, at(APOTHEM - 0.08, (L.bottomY + L.floorY) / 2, 0));
    for (const s of [-1, 1]) put(box(0.06, 0.06, (FACE_W - 2 * L.doorHalfW) / 2), M.silver, 0.5, at(APOTHEM + 0.01, L.bandY, s * (L.doorHalfW + (FACE_W - 2 * L.doorHalfW) / 4)));
    // Hinge knuckles along the sill.
    for (const z of [-0.85, -0.3, 0.3, 0.85]) {
      const g = cyl(0.055, 0.055, 0.26, 20);
      g.rotateX(Math.PI / 2);
      put(g, M.alu, 0.5, at(L.hingeX + 0.02, L.floorY - 0.02, z));
    }
    // Cable sheaves at the header's ends (the hatch is lowered on two cables, like a drawbridge).
    for (const s of [-1, 1]) {
      const g = cyl(0.07, 0.07, 0.05, 20);
      g.rotateX(Math.PI / 2);
      put(g, M.dark, 0.5, at(APOTHEM + 0.1, L.doorTopY - 0.06, s * (L.doorHalfW - 0.06)));
      put(box(0.22, 0.12, 0.04), M.alu, 0.5, at(APOTHEM + 0.02, L.doorTopY - 0.06, s * (L.doorHalfW - 0.06 + 0.045)));
    }
  }
  // Underside: a gold-foil heat shield plate; top deck.
  {
    const g = cyl(L.radius * 0.98, L.radius * 0.98, 0.05, 8);
    g.rotateY(Math.PI / 8);
    put(g, M.gold, 0.5, at(0, L.bottomY + 0.02, 0));
    const t = cyl(L.radius + 0.02, L.radius + 0.02, 0.08, 8);
    t.rotateY(Math.PI / 8);
    put(t, M.whitePlain, 0.5, at(0, L.deckY + 0.04, 0));
    const lip = cyl(L.radius + 0.05, L.radius + 0.05, 0.04, 8);
    lip.rotateY(Math.PI / 8);
    put(lip, M.alu, 0.5, at(0, L.deckY + 0.1, 0));
  }
  // REL logos on the upper band: on the faces either side of the door (seen in the wide shots).
  for (const k of [7, 3]) {
    const g = new THREE.PlaneGeometry(0.95, 0.475);
    g.rotateY(Math.PI / 2);
    put(g, M.logo, 0, faceMatrix(k, (L.bandY + L.deckY) / 2 + 0.05, 0.004));
  }
  // Side faces: stringers across the white band, radiator slats, a strapped pressurant bottle or an
  // avionics box on the gold band, and a cable harness down each corner.
  const facePoint = (k: number, u: number, y: number, out: number) => {
    const a = (k * Math.PI) / 4;
    return new THREE.Vector3(Math.cos(a) * (APOTHEM + out) + Math.sin(a) * u, y, -Math.sin(a) * (APOTHEM + out) + Math.cos(a) * u);
  };
  for (const k of [1, 2, 6, 7]) {
    const a = (k * Math.PI) / 4;
    for (const y of [L.bandY + 0.3, L.deckY - 0.16]) put(box(0.05, 0.05, FACE_W * 0.96), M.alu, 0.5, faceMatrix(k, y, 0.025));
    const us = k === 7 ? [-0.98, -0.86, 0.86, 0.98] : [-0.95, -0.76, -0.57, -0.38, -0.19, 0, 0.19, 0.38, 0.57, 0.76, 0.95];
    for (const u of us) {
      const p = facePoint(k, u, L.bandY + 0.78, 0.05);
      put(box(0.09, 0.72, 0.016), M.whitePlain, 0.5, at(p.x, p.y, p.z, a));
    }
    if (k === 2 || k === 6) {
      const c = facePoint(k, 0, 1.85, 0.2);
      const g = cyl(0.17, 0.17, 1.3, 32);
      g.rotateX(Math.PI / 2);
      put(g, M.silver, 0.5, at(c.x, c.y, c.z, a));
      for (const s of [-1, 1]) {
        const cap = new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        cap.rotateX((s * Math.PI) / 2);
        cap.translate(0, 0, s * 0.65);
        put(cap, M.silver, 0.5, at(c.x, c.y, c.z, a));
        const strap = new THREE.TorusGeometry(0.175, 0.012, 6, 32);
        strap.translate(0, 0, s * 0.38);
        put(strap, M.graphite, 0, at(c.x, c.y, c.z, a));
        const foot = facePoint(k, s * 0.38, 1.85, 0.04);
        put(box(0.12, 0.06, 0.04), M.graphite, 0.5, at(foot.x, foot.y, foot.z, a));
      }
    } else {
      const c = facePoint(k, k === 1 ? 0.45 : -0.45, 1.75, 0.13);
      put(new RoundedBoxGeometry(0.24, 0.4, 0.55, 2, 0.02), M.whitePlain, 0.5, at(c.x, c.y, c.z, a));
      const fins = facePoint(k, k === 1 ? 0.45 : -0.45, 1.75, 0.26);
      for (let i = -3; i <= 3; i++) put(box(0.025, 0.36, 0.008), M.graphite, 0.5, at(fins.x, fins.y, fins.z, a).multiply(at(0, 0, i * 0.07)));
    }
    // A harness down the corner toward the next face.
    const va = ((k + 0.5) * Math.PI) / 4;
    const cx = Math.cos(va) * (L.radius + 0.06);
    const cz = -Math.sin(va) * (L.radius + 0.06);
    put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(cx, L.deckY - 0.1, cz), new THREE.Vector3(cx * 1.005, 2.4, cz * 1.005), new THREE.Vector3(cx, L.bottomY + 0.3, cz)]), 20, 0.028, 8), M.dark, 0);
  }
  // Radiator fins on the back faces and solar cells on the side faces' upper band.
  for (const k of [3, 4, 5]) {
    for (let i = -4; i <= 4; i++) {
      const a = (k * Math.PI) / 4;
      const along = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)).multiplyScalar(i * 0.22);
      put(box(0.1, 0.9, 0.02), M.whitePlain, 0.5, at(Math.cos(a) * (APOTHEM + 0.05) + along.x, L.bandY + 0.6, -Math.sin(a) * (APOTHEM + 0.05) + along.z, a));
    }
  }
  for (const k of [2, 6]) {
    put(box(0.03, 0.95, FACE_W * 0.86), M.cells, 0, faceMatrix(k, L.bandY + 0.62, 0.02));
    put(box(0.035, 1.0, FACE_W * 0.9), M.alu, 0.5, faceMatrix(k, L.bandY + 0.62, 0.0));
  }

  // ---------------------------------------------------------------------------------------------------
  // Top: four propellant tanks in cradles, a central avionics drum, RCS pods, star trackers, the high-gain
  // dish on a boom aimed at Earth, and a vertical solar array on a mast, turned to the Sun.
  // Exposed structure above the deck: an octagonal truss (posts, a top ring, cross-bracing) carrying four
  // big spherical propellant tanks on struts, with feed lines down to the engines.
  {
    const R = L.radius - 0.2;
    const top = L.deckY + 1.15;
    for (let k = 0; k < 8; k++) {
      const a0 = ((k + 0.5) * Math.PI) / 4;
      const a1 = ((k + 1.5) * Math.PI) / 4;
      const p0 = new THREE.Vector3(Math.cos(a0) * R, L.deckY + 0.1, -Math.sin(a0) * R);
      const p1 = new THREE.Vector3(Math.cos(a1) * R, L.deckY + 0.1, -Math.sin(a1) * R);
      const q0 = p0.clone().setY(top);
      const q1 = p1.clone().setY(top);
      put(rod(p0, q0, 0.045, 10), M.alu, 0.5);
      put(rod(q0, q1, 0.04, 10), M.alu, 0.5);
      put(rod(p0, q1, 0.022, 8), M.alu, 0.5);
      put(new THREE.SphereGeometry(0.06, 12, 8), M.graphite, 0.5, at(q0.x, q0.y, q0.z));
    }
  }
  for (const [x, z] of [[1.2, 1.2], [1.2, -1.2], [-1.2, 1.2], [-1.2, -1.2]] as const) {
    const r = 0.8;
    const cy = L.deckY + 0.5 + r;
    put(new THREE.SphereGeometry(r, 48, 28), (x > 0) === (z > 0) ? M.silver : M.whitePlain, 0.6, at(x, cy, z));
    const ring = new THREE.TorusGeometry(r + 0.02, 0.04, 8, 48);
    ring.rotateX(Math.PI / 2);
    put(ring, M.alu, 0.5, at(x, cy, z));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      put(rod(new THREE.Vector3(x + Math.cos(a) * (r + 0.02), cy, z + Math.sin(a) * (r + 0.02)), new THREE.Vector3(x + Math.cos(a) * 0.55, L.deckY + 0.1, z + Math.sin(a) * 0.55), 0.03), M.alu, 0.5);
    }
    // Feed line from the tank's bottom down through the deck.
    put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x, cy - r, z), new THREE.Vector3(x * 0.8, L.deckY + 0.3, z * 0.8), new THREE.Vector3(x * 0.55, L.deckY + 0.05, z * 0.55)]), 16, 0.035, 8), M.alu, 0);
  }
  put(cyl(0.55, 0.55, 0.9, 32), M.gold, 0.6, at(0, L.deckY + 0.55, 0));
  put(cyl(0.58, 0.58, 0.05, 32), M.alu, 0.5, at(0, L.deckY + 1.02, 0));
  // Plumbing between tanks and the drum.
  for (const [x, z] of [[1, 0.4], [-1, 0.4], [1, -0.4], [-1, -0.4]] as const) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x * 0.6, L.deckY + 0.2, z), new THREE.Vector3(x * 0.4, L.deckY + 0.3, z * 1.2), new THREE.Vector3(0.5 * Math.sign(x), L.deckY + 0.35, z * 0.6)]);
    put(new THREE.TubeGeometry(curve, 16, 0.02, 6), M.alu, 0.5);
  }
  // RCS thruster pods at four upper corners.
  for (let k = 0; k < 4; k++) {
    const a = ((k * 2 + 1) * Math.PI) / 4 + Math.PI / 8;
    const px = Math.cos(a) * (L.radius + 0.22);
    const pz = -Math.sin(a) * (L.radius + 0.22);
    const y = L.deckY - 0.25;
    put(rod(new THREE.Vector3(Math.cos(a) * (L.radius - 0.05), y, -Math.sin(a) * (L.radius - 0.05)), new THREE.Vector3(px, y, pz), 0.04), M.alu, 0.5);
    put(new RoundedBoxGeometry(0.22, 0.22, 0.22, 2, 0.03), M.gold, 1.5, at(px, y, pz, a));
    // Four nozzles: up, down and both sides.
    const dirs = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a))];
    for (const d of dirs) {
      const g = cyl(0.025, 0.055, 0.1, 16, true);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().negate()));
      g.translate(px + d.x * 0.16, y + d.y * 0.16, pz + d.z * 0.16);
      put(g, M.graphite, 0.5);
    }
  }
  // Star trackers with baffles.
  for (const [x, z] of [[-0.2, 1.7], [0.2, 1.72]] as const) {
    const g = cyl(0.07, 0.09, 0.22, 20, true);
    g.rotateX(-0.6);
    put(g, M.dark, 0.5, at(x, L.deckY + 0.25, z));
    put(box(0.18, 0.12, 0.18), M.gold, 1.5, at(x, L.deckY + 0.14, z - 0.05));
  }
  // High-gain antenna: a boom, a gimbal and a parabolic dish facing Earth.
  {
    const base = new THREE.Vector3(-1.95, L.deckY + 0.1, 0.0);
    const top = new THREE.Vector3(-1.95, L.deckY + 2.3, 0.0);
    put(rod(base, top, 0.045), M.alu, 0.5);
    put(box(0.18, 0.16, 0.18), M.dark, 0.5, at(top.x, top.y, top.z));
    const e = opts.earthLocal.clone().normalize();
    const rDish = 0.6;
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const r = (i / 16) * rDish;
      profile.push(new THREE.Vector2(r, (r * r) / (4 * 0.42)));
    }
    for (let i = 16; i >= 0; i--) {
      const r = (i / 16) * rDish;
      profile.push(new THREE.Vector2(r * 0.995, (r * r) / (4 * 0.42) - 0.025));
    }
    const dish = new THREE.LatheGeometry(profile, 48);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), e);
    const c = top.clone().add(e.clone().multiplyScalar(0.18));
    dish.applyQuaternion(q).translate(c.x, c.y, c.z);
    put(dish, M.whitePlain, 0.5);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const rim = new THREE.Vector3(Math.cos(a) * rDish * 0.9, (rDish * rDish * 0.81) / (4 * 0.42), Math.sin(a) * rDish * 0.9).applyQuaternion(q).add(c);
      const feed = new THREE.Vector3(0, 0.42, 0).applyQuaternion(q).add(c);
      put(rod(rim, feed, 0.008, 6), M.alu, 0.5);
    }
    const feedPos = new THREE.Vector3(0, 0.44, 0).applyQuaternion(q).add(c);
    const fg = cyl(0.03, 0.045, 0.08, 16);
    fg.applyQuaternion(q).translate(feedPos.x, feedPos.y, feedPos.z);
    put(fg, M.dark, 0.5);
    put(rod(top, c, 0.03), M.alu, 0.5);
  }
  // Vertical solar array: a mast and a tall panel facing the Sun (it rides just above the horizon at the pole).
  {
    const sun = opts.sunLocal.clone();
    sun.y = 0;
    sun.normalize();
    const mastBase = new THREE.Vector3(0.9, L.deckY + 0.1, -0.2);
    const mastTop = new THREE.Vector3(0.9, L.deckY + 2.1, -0.2);
    put(rod(mastBase, mastTop, 0.05), M.alu, 0.5);
    const yaw = Math.atan2(-sun.z, sun.x); // panel normal toward the Sun
    const pc = new THREE.Vector3(0.9, L.deckY + 3.0, -0.2);
    put(box(0.04, 1.7, 1.5), M.cells, 0, at(pc.x, pc.y, pc.z, yaw));
    put(box(0.05, 1.76, 0.04), M.alu, 0.5, at(pc.x - Math.sin(yaw) * 0, pc.y, pc.z, yaw).multiply(at(0, 0, 0.77)));
    put(box(0.05, 1.76, 0.04), M.alu, 0.5, at(pc.x, pc.y, pc.z, yaw).multiply(at(0, 0, -0.77)));
    put(box(0.05, 0.04, 1.56), M.alu, 0.5, at(pc.x, pc.y, pc.z, yaw).multiply(at(0, 0.86, 0)));
    put(box(0.05, 0.04, 1.56), M.alu, 0.5, at(pc.x, pc.y, pc.z, yaw).multiply(at(0, -0.86, 0)));
    put(box(0.05, 0.03, 1.5), M.alu, 0.5, at(pc.x, pc.y, pc.z, yaw));
    put(box(0.04, 1.7, 0.02), M.alu, 0.5, at(pc.x, pc.y, pc.z, yaw).multiply(at(-0.01, 0, 0)));
    // Back of the panel: a dark substrate.
    put(box(0.01, 1.68, 1.48), M.dark, 0.5, at(pc.x, pc.y, pc.z, yaw).multiply(at(-0.03, 0, 0)));
    put(cyl(0.08, 0.08, 0.12, 20), M.dark, 0.5, at(mastTop.x, mastTop.y + 0.02, mastTop.z));
  }
  // Omni antennas.
  for (const [x, z] of [[-0.4, -1.8], [0.4, 1.9]] as const) {
    put(rod(new THREE.Vector3(x, L.deckY + 0.1, z), new THREE.Vector3(x, L.deckY + 0.8, z), 0.012, 8), M.alu, 0.5);
    put(new THREE.SphereGeometry(0.035, 12, 8), M.whitePlain, 0.5, at(x, L.deckY + 0.82, z));
  }

  // ---------------------------------------------------------------------------------------------------
  // Main engines under the body, with afterglow.
  const nozzleGeos: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const x = Math.cos(a) * 1.25;
    const z = -Math.sin(a) * 1.25;
    // Bell profile (lathe): throat at the top, exit at the bottom. UV v: 0 at the exit, 1 at the throat.
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const s = i / 20;
      pts.push(new THREE.Vector2(0.09 + 0.25 * Math.pow(1 - s, 1.6), -0.62 * (1 - s)));
    }
    const bell = new THREE.LatheGeometry(pts, 40);
    bell.translate(x, L.bottomY - 0.12, z);
    nozzleGeos.push(bell);
    put(cyl(0.14, 0.11, 0.16, 24), M.graphite, 0.5, at(x, L.bottomY - 0.06, z));
    put(new THREE.TorusGeometry(0.335, 0.012, 6, 40).rotateX(Math.PI / 2), M.alu, 0, at(x, L.bottomY - 0.74, z));
  }
  const nozzleMesh = new THREE.Mesh(mergeGeometries(nozzleGeos.map((g) => g.toNonIndexed()))!, M.nozzle);
  nozzleGeos.forEach((g) => g.dispose());
  nozzleMesh.castShadow = true;
  nozzleMesh.receiveShadow = true;
  object.add(nozzleMesh);

  // ---------------------------------------------------------------------------------------------------
  // Legs: a primary shock strut (outer cylinder, chrome piston) from the upper body to the footpad, two
  // secondary struts from the body's underside to a knee on the primary, and a footpad pressed into the regolith.
  const footpads: THREE.Vector3[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const c = Math.cos(a);
    const s = -Math.sin(a);
    const fx = c * L.footR;
    const fz = s * L.footR;
    const fy = opts.groundLocal(fx, fz) - 0.035; // pressed in
    footpads.push(new THREE.Vector3(fx, fy, fz));
    const ball = new THREE.Vector3(fx, fy + 0.32, fz);
    const top = new THREE.Vector3(c * (L.radius - 0.05), L.bandY + 0.25, s * (L.radius - 0.05));
    const mid = top.clone().lerp(ball, 0.55);
    put(rod(top, mid, 0.1, 20), M.gold, 0.5);
    put(rod(mid.clone().lerp(top, 0.05), mid.clone().lerp(ball, 0.02), 0.115, 20), M.alu, 0.5);
    put(rod(mid, ball, 0.068, 20), M.graphite, 0.5);
    put(rod(top, top.clone().lerp(mid, 0.12), 0.13, 20), M.alu, 0.5);
    // Secondary struts to a knee.
    const knee = top.clone().lerp(ball, 0.72);
    for (const da of [-0.32, 0.32]) {
      const b = new THREE.Vector3(Math.cos(a + da) * (L.radius - 0.35), L.bottomY + 0.05, -Math.sin(a + da) * (L.radius - 0.35));
      put(rod(b, knee, 0.045, 14), M.alu, 0.5);
      put(new THREE.SphereGeometry(0.07, 14, 10), M.graphite, 0.5, at(b.x, b.y, b.z));
    }
    put(new THREE.SphereGeometry(0.1, 16, 12), M.graphite, 0.5, at(knee.x, knee.y, knee.z));
    // Footpad: a shallow dish with a rim, on a ball joint.
    put(new THREE.SphereGeometry(0.11, 16, 12), M.graphite, 0.5, at(ball.x, ball.y, ball.z));
    put(cyl(0.12, 0.2, 0.2, 24), M.alu, 0.5, at(fx, fy + 0.2, fz));
    put(cyl(L.footPadR, L.footPadR - 0.06, 0.12, 40), M.gold, 1.2, at(fx, fy + 0.06, fz));
    put(new THREE.TorusGeometry(L.footPadR - 0.01, 0.018, 8, 48).rotateX(Math.PI / 2), M.alu, 0, at(fx, fy + 0.12, fz));
    put(cyl(L.footPadR * 0.55, L.footPadR - 0.01, 0.06, 40), M.alu, 0.5, at(fx, fy + 0.15, fz));
  }

  // ---------------------------------------------------------------------------------------------------
  // The bay: tread-plate floor with wheel guide rails, walls of ribs and silver blanket, cable trays, an
  // equipment rack on the back wall with a few dim indicator lights.
  {
    const x0 = L.bayBackX;
    const x1 = APOTHEM - 0.16;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const hw = L.bayHalfW;
    put(box(len, 0.06, 2 * hw), M.inTread, 0.8, at(cx, L.floorY - 0.03, 0));
    for (const z of [-0.75, 0.75]) {
      for (const s of [-1, 1]) put(box(len, 0.05, 0.03), M.inGrey, 0.5, at(cx, L.floorY + 0.025, z + s * 0.17));
    }
    // Ceiling and walls.
    put(box(len, 0.06, 2 * hw), M.inWhite, 0.5, at(cx, L.ceilingY + 0.03, 0));
    for (const s of [-1, 1]) put(box(len, L.ceilingY - L.floorY, 0.04), M.inSilver, 0.6, at(cx, (L.floorY + L.ceilingY) / 2, s * (hw + 0.02)));
    put(box(0.04, L.ceilingY - L.floorY, 2 * hw), M.inSilver, 0.6, at(x0 - 0.02, (L.floorY + L.ceilingY) / 2, 0));
    // Ribs on the walls and across the ceiling.
    for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.55) {
      for (const s of [-1, 1]) {
        put(box(0.06, L.ceilingY - L.floorY, 0.08), M.inDark, 0.5, at(x, (L.floorY + L.ceilingY) / 2, s * (hw - 0.04)));
        put(box(0.025, L.ceilingY - L.floorY, 0.14), M.inDark, 0.5, at(x, (L.floorY + L.ceilingY) / 2, s * (hw - 0.07)));
      }
      put(box(0.06, 0.1, 2 * hw), M.inDark, 0.5, at(x, L.ceilingY - 0.05, 0));
    }
    // Cable trays with bundles along the walls.
    for (const s of [-1, 1]) {
      for (const y of [L.floorY + 1.55, L.ceilingY - 0.35]) {
        put(box(len - 0.2, 0.04, 0.14), M.inGrey, 0.5, at(cx, y, s * (hw - 0.16)));
        for (let i = 0; i < 4; i++) {
          const zz = s * (hw - 0.11 - i * 0.03);
          put(rod(new THREE.Vector3(x0 + 0.15, y + 0.035, zz), new THREE.Vector3(x1 - 0.15, y + 0.035, zz), 0.012 + (i % 2) * 0.004, 6), M.cable, 0.5);
        }
      }
    }
    // Back wall: an equipment rack.
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.65;
      put(new RoundedBoxGeometry(0.3, 0.9, 0.55, 2, 0.02), i === 1 ? M.inWhite : M.inGrey, 0.5, at(x0 + 0.16, L.floorY + 1.9, z));
      put(new RoundedBoxGeometry(0.25, 0.35, 0.5, 2, 0.02), M.inDark, 0.5, at(x0 + 0.14, L.floorY + 0.6, z));
    }
    // The rover's launch locks: clamps on the floor at each wheel (opened).
    for (const [x, z] of [[0.7, 0.98], [0.7, -0.98], [2.1, 0.98], [2.1, -0.98]] as const) {
      put(box(0.16, 0.12, 0.1), M.inGrey, 0.5, at(x, L.floorY + 0.06, z));
      put(box(0.05, 0.22, 0.05), M.inDark, 0.5, at(x, L.floorY + 0.15, z - Math.sign(z) * 0.06));
    }
  }
  // Bay indicator lights (separate meshes so they glow on their own).
  const bayLights: THREE.Mesh[] = [];
  {
    const g = new THREE.SphereGeometry(0.012, 10, 8);
    track(g);
    const spots: [number, number, number, THREE.Material][] = [
      [L.bayBackX + 0.32, L.floorY + 2.2, -0.75, M.bayLight],
      [L.bayBackX + 0.32, L.floorY + 2.15, -0.68, M.bayLightG],
      [L.bayBackX + 0.32, L.floorY + 2.2, 0.62, M.bayLight],
      [L.bayBackX + 0.32, L.floorY + 2.2, 0.0, M.bayLightG],
      [1.0, L.ceilingY - 0.08, -0.6, M.bayLight],
      [2.0, L.ceilingY - 0.08, 0.6, M.bayLight],
    ];
    for (const [x, y, z, m] of spots) {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      object.add(mesh);
      bayLights.push(mesh);
    }
  }
  // A dim cool work light along the back of the ceiling (it comes up as the hatch opens): it silhouettes the
  // rover against the back of the bay.
  const workMat = track(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const workLight = new THREE.PointLight(0xbcd4ff, 0, 6, 2);
  {
    const strip = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.025, 1.5)), workMat);
    strip.position.set(L.bayBackX + 0.25, L.ceilingY - 0.04, 0);
    object.add(strip);
    put(box(0.12, 0.04, 1.6), M.inDark, 0.5, at(L.bayBackX + 0.25, L.ceilingY - 0.02, 0));
    workLight.position.set(L.bayBackX + 0.4, L.ceilingY - 0.25, 0);
    object.add(workLight);
  }

  // ---------------------------------------------------------------------------------------------------
  // The hatch: closed, it is the door's outer skin (white panels, a chevron band at the hinge, a silver frame);
  // open, its inner face is the ramp (tread plate, side rails, cleats).
  const hatch = new THREE.Object3D();
  hatch.name = 'act2:hatch';
  hatch.position.set(L.hingeX, L.floorY, 0);
  object.add(hatch);
  const hatchStatics = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const hput = (g: THREE.BufferGeometry, m: THREE.Material, uvScale = 0.5, matrix?: THREE.Matrix4) => {
    if (matrix) g.applyMatrix4(matrix);
    if (uvScale > 0) boxUV(g, uvScale);
    const list = hatchStatics.get(m) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    hatchStatics.set(m, list);
  };
  {
    const T = L.hatchThick;
    const W = 2 * L.doorHalfW - 0.04;
    const H = HATCH_LEN;
    // Outer skin (+x) and inner tread surface (-x: the ramp's top once open).
    hput(box(T * 0.7, H, W), M.whitePlain, 0.5, at(T * 0.55, H / 2, 0));
    hput(box(0.02, H - 0.1, W - 0.1), M.white, 0.45, at(T + 0.0, H / 2 + 0.02, 0));
    hput(box(0.02, H, W), M.inTread, 0.8, at(0.01, H / 2, 0));
    // Frame around the outer skin.
    for (const s of [-1, 1]) hput(box(T + 0.02, H, 0.06), M.alu, 0.5, at(T / 2, H / 2, s * (W / 2 - 0.03)));
    hput(box(T + 0.02, 0.06, W), M.alu, 0.5, at(T / 2, H - 0.03, 0));
    // Ramp side rails on the inner face, and cleats across it.
    for (const s of [-1, 1]) hput(box(0.1, H - 0.1, 0.05), M.alu, 0.5, at(-0.05, H / 2, s * (W / 2 - 0.03)));
    for (let y = 0.35; y < H - 0.2; y += 0.32) hput(box(0.018, 0.035, W - 0.2), M.inGrey, 0.5, at(-0.009, y, 0));
    // Chevron band near the hinge on the outer face, and a toe lip at the far edge.
    const band = new THREE.PlaneGeometry(W - 0.12, 0.16);
    band.rotateY(Math.PI / 2);
    const uv = band.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 6);
    hput(band, M.stripes, 0, at(T + 0.012, 0.2, 0));
    hput(box(0.04, 0.1, W), M.graphite, 0.5, at(-0.0, H + 0.03, 0));
    // A second, smaller REL mark on the outer skin.
    const mark = new THREE.PlaneGeometry(0.56, 0.28);
    mark.rotateY(Math.PI / 2);
    hput(mark, M.logo, 0, at(T + 0.013, H * 0.62, 0));
  }
  for (const [m, list] of hatchStatics) {
    const mesh = new THREE.Mesh(mergeGeometries(list)!, m);
    list.forEach((g) => g.dispose());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    hatch.add(mesh);
  }
  // Lowering cables: from the sheaves at the header to the hatch's far corners.
  const cableGeo = track(new THREE.CylinderGeometry(0.008, 0.008, 1, 6));
  const cables = [-1, 1].map((s) => {
    const m = new THREE.Mesh(cableGeo, M.dark);
    m.castShadow = true;
    object.add(m);
    return { mesh: m, s };
  });
  const sheave = (s: number) => new THREE.Vector3(APOTHEM + 0.1, L.doorTopY - 0.06, s * (L.doorHalfW - 0.06));
  const tipLocal = (s: number) => new THREE.Vector3(L.hatchThick + 0.02, HATCH_LEN - 0.08, s * (L.doorHalfW - 0.06));

  // The angle at which the hatch's outer tip edge rests on the ground.
  const restAngle = (() => {
    let lo = Math.PI / 2;
    let hi = Math.PI * 0.85;
    const tipY = (a: number) => {
      const p = new THREE.Vector3(L.hatchThick, HATCH_LEN, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), -a).add(hatch.position);
      return p.y - opts.groundLocal(p.x, 0) - 0.01;
    };
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (tipY(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  })();

  // Light into the bay once it opens: the sunlit ramp and regolith outside the door, and the slash of sun on
  // the near wall, bounce a soft fill onto the rover.
  const bounce = new THREE.PointLight(0xfff2e4, 0, 9, 2);
  bounce.position.set(L.hingeX + 1.25, L.floorY + 1.0, -0.2);
  const slash = new THREE.PointLight(0xffeedd, 0, 4, 2);
  slash.position.set(L.hingeX - 0.4, L.floorY + 1.3, -L.bayHalfW + 0.25);
  object.add(bounce, slash);
  let openK = 0;
  let fill = 1;
  const setHatch = (angle: number) => {
    openK = Math.min(1, angle / restAngle);
    bounce.intensity = 1.0 * openK * fill;
    slash.intensity = 0.4 * Math.max(0, (openK - 0.3) / 0.7) * fill;
    hatch.rotation.z = -angle;
    hatch.updateMatrix();
    for (const { mesh, s } of cables) {
      const a = sheave(s);
      const b = tipLocal(s).applyMatrix4(hatch.matrix);
      const d = b.clone().sub(a);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.scale.set(1, d.length(), 1);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
  };
  setHatch(0);

  // Merge the statics.
  for (const [m, list] of statics) {
    const mesh = new THREE.Mesh(mergeGeometries(list)!, m);
    list.forEach((g) => g.dispose());
    mesh.castShadow = m !== M.logo;
    mesh.receiveShadow = true;
    object.add(mesh);
  }

  // Ramp surface height (fully open), for the rover's wheels: the inner face plane through the hinge.
  const rampHeight = (x: number, z: number): number | null => {
    if (Math.abs(z) > L.doorHalfW) return null;
    const along = (x - L.hingeX) / Math.sin(restAngle);
    if (along < -0.05 || along > HATCH_LEN) return null;
    // Inner face direction after rotation: (sin a, cos a) along the plate.
    const t = (x - L.hingeX) / Math.sin(restAngle);
    return L.floorY + t * Math.cos(restAngle) + 0.02;
  };

  return {
    object,
    hatch,
    openAngle: restAngle,
    setHatch,
    setFill(k) {
      fill = k;
    },
    setGlow(k) {
      M.nozzle.emissiveIntensity = 0.3 * k;
    },
    indirect,
    setBayLights(k, work = 0) {
      M.bayLight.emissiveIntensity = 6 * k;
      M.bayLightG.emissiveIntensity = 4 * k;
      workMat.color.setRGB(0.74, 0.83, 1).multiplyScalar(6 * work);
      workLight.intensity = 0.35 * work;
    },
    rampHeight,
    footpads,
    dispose() {
      object.traverse((o) => {
        if (o instanceof THREE.Mesh && o.geometry !== cableGeo) o.geometry.dispose();
      });
      for (const d of disposables) d.dispose();
      object.removeFromParent();
    },
  };
}
