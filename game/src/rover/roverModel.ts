// The rover's look, built from three.js primitives and shaped by the selected parts: a titanium or
// steel frame, solid, wire-mesh or grouser wheels, a flat solar panel, a vertical solar mast, deployable
// solar array wings or a finned radioisotope generator at the back, the battery (nickel-hydrogen
// cylinders, a lithium-ion pack, or the larger battery's two tall modules), floodlights, the gold thermal
// blanket of a warm rover (any part with heat) with the fitted heater on its sides (radioisotope heater
// unit canisters, or the electric heater's patches and wiring), Mars's support hardware (a robotic arm
// folded at the front with its tool turret, a remote sensing mast with its head), and the payload bay's
// instruments: a camera mast and a regolith drill at the front, a neutron spectrometer and an X-ray
// spectrometer arm under the body (its head moves to the robotic arm's turret when the arm is fitted), a seismometer station and a laser retroreflector carried on the deck,
// and on Mars a weather mast, a radar antenna under the rear, a laser telescope on the mast head and an
// organics sensor head on the arm's turret, each in its own place, so any mix can be drawn. The two deployables are also drawn on the ground by world/stations.ts.
// Visual only: the physics body stays the box and four ray-cast wheels in vehicle.ts.
// A draft build (design screen preview) shows only the parts chosen so far.
//
// The detail (foil crinkles, solar-cell grids, radiator tiles, paint wear) comes from small canvas
// textures; the materials stay Lambert so the mission's terrain-shadow patch applies to them. The
// static parts are merged into one mesh per material, and each wheel into a few, to keep draw calls low.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { BusSlot, Instrument, Part, RoverHandling, SupportSlot } from '../rules/types';

/** How the model groups its static parts: one group per bus slot and support slot, and one per instrument in the bay. */
export type ModelGroup = BusSlot | SupportSlot | Instrument;

/** What the model shows, read from the selected parts. `null` / `false`: nothing drawn for that slot. */
export interface RoverLook {
  frame: 'titanium' | 'steel' | null; // null: no chassis chosen (deck, frame, electronics box and antenna)
  wheels: 'solid' | 'mesh' | 'grouser' | null; // null: no wheels, struts or drive motors
  power: 'panel' | 'mast' | 'arrays' | 'rtg' | null;
  battery: 'cylinders' | 'pack' | 'large' | null; // nickel-hydrogen, lithium-ion, the larger battery pack
  lights: boolean;
  heater: boolean; // any part gives heat (heater units, an electric heater, an RTG's waste heat): the gold blanket
  heaterKind?: 'rhu' | 'electric' | null; // the heater part fitted, drawn on the blanket's sides (null or absent: none, as on an RTG rover without one)
  arm?: boolean; // a robotic arm (Mars support hardware)
  mast?: boolean; // a remote sensing mast (Mars support hardware)
  instruments: Instrument[]; // the payload bay, in bay order (empty: no instruments drawn)
}

/** The look for the chosen parts; a slot with no part shows nothing. A complete build fills every field. */
export function roverLook(parts: Part[]): RoverLook {
  const bySlot = (slot: Part['slot']) => parts.find((p) => p.slot === slot);
  const pick = <T>(slot: Part['slot'], choose: (id: string) => T): T | null => {
    const part = bySlot(slot);
    return part ? choose(part.id) : null;
  };
  return {
    frame: pick('chassis', (id) => (id.includes('steel') ? 'steel' : 'titanium')),
    wheels: pick('wheels', (id) => (id.includes('mesh') ? 'mesh' : id.includes('grouser') ? 'grouser' : 'solid')),
    power: pick('power', (id) => (id.includes('mast') ? 'mast' : id.includes('arrays') ? 'arrays' : id.includes('rtg') ? 'rtg' : 'panel')),
    battery: pick('battery', (id) => (id.includes('nih2') ? 'cylinders' : id.includes('large') ? 'large' : 'pack')),
    lights: (bySlot('lights')?.effects.lightRange ?? 0) > 0,
    heater: parts.some((p) => (p.effects.heat ?? 0) > 0),
    heaterKind: heaterKind(bySlot('heater')),
    arm: Boolean(bySlot('arm')?.effects.arm),
    mast: Boolean(bySlot('mast')?.effects.mast),
    instruments: parts.flatMap((p) => (p.slot === 'instrument' && p.effects.instrument ? [p.effects.instrument] : [])),
  };
}

/** The heater part's look: none for no heater (or "No heater"), else the electric heater or the heater units. */
function heaterKind(part: Part | undefined): RoverLook['heaterKind'] {
  if (!part || (part.effects.heat ?? 0) <= 0) return null;
  return (part.effects.heaterDraw ?? 0) > 0 || part.id.includes('electric') ? 'electric' : 'rhu';
}

export interface RoverModel {
  /** Static parts, in the chassis frame (forward +x, up +y, right +z). */
  body: THREE.Group;
  /** One per wheel, in the vehicle's wheel order: `wheel` follows suspension and steering, `spin` rolls. */
  wheels: { wheel: THREE.Object3D; spin: THREE.Object3D }[];
  /**
   * With `bySlot`: the static parts of each slot, and of each instrument, as its own group (the
   * children of `body`), so a preview can animate one part. The wheels belong to the wheels slot.
   * Empty without `bySlot`.
   */
  slots: Partial<Record<ModelGroup, THREE.Group>>;
  /** Only with `rig`: the moving parts' pivots. */
  rig?: RoverRig;
}

/** The parts a cinematic rig moves (the intro video in cinematic/; never used in the game). */
export type RigPart = 'solarPanel' | 'cameraMast' | 'cameraPan' | 'cameraTilt';

/**
 * Pivots for the rig's moving parts, under `body`, each at its joint (chassis frame) and at rest (no
 * rotation, no offset): the solar mast's panel column hinges at the top of its pole (rotate about z to
 * fold it back); the camera mast's upper section slides along y in its lower sleeve; the camera head
 * pans about y and tilts about z. Only the parts the build has.
 */
export type RoverRig = Partial<Record<RigPart, THREE.Object3D>>;

export interface RoverModelOptions {
  /** Keep each slot's (and instrument's) static parts in a separate group (a few more draw calls). Default: one mesh per material. */
  bySlot?: boolean;
  /**
   * Cinematic rig (the intro video; off in the game): the moving parts (`RigPart`) as separate pivoted
   * groups in `rig`, and the camera head's lenses with their own material ('eye'). Same look at rest.
   */
  rig?: boolean;
}

const COLORS = {
  titanium: 0xc3c6cb,
  steel: 0x5f646b,
  steelBeam: 0x474b51,
  radiator: 0xe8e6df,
  white: 0xdcdad3,
  foil: 0xd2a243,
  cell: 0x1b2847,
  cellFrame: 0x8c9096,
  grouser: 0xa3a6aa,
  dark: 0x34373b,
  wheelSolid: 0x8f9398,
  wheelMesh: 0xbdb5a0,
  chevron: 0xb4b8bd,
  fender: 0x8e959c,
  solidRim: 0xa9adb2,
  lamp: 0xfff6dc,
  casing: 0xb9bdc3,
  lens: 0x0e1217,
  radar: 0x4b4a44, // the radar antenna's face, without its element texture
  kapton: 0xb4601f, // the electric heater's patches, without their trace texture
  wireRed: 0xa8322a,
};

/** The seismometer station, origin at the ground: a gold-foil dome on a silver base, with three feet when set down. */
export function seismometerGeometry(feet: boolean): { foil: THREE.BufferGeometry; metal: THREE.BufferGeometry } {
  const lift = feet ? 0.05 : 0;
  const base = new THREE.CylinderGeometry(0.14, 0.15, 0.03, 20);
  base.translate(0, lift + 0.015, 0);
  const metal: THREE.BufferGeometry[] = [base];
  if (feet) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
      const foot = new THREE.CylinderGeometry(0.012, 0.02, lift, 8);
      foot.translate(Math.cos(a) * 0.12, lift / 2, Math.sin(a) * 0.12);
      metal.push(foot);
    }
  }
  // A carry handle over the dome, for the arm that sets it down.
  const handle = new THREE.TorusGeometry(0.06, 0.008, 4, 12, Math.PI);
  handle.translate(0, lift + 0.13, 0);
  metal.push(handle);
  const dome = new THREE.SphereGeometry(0.11, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(0, lift + 0.03, 0);
  const collar = new THREE.CylinderGeometry(0.115, 0.115, 0.02, 18);
  collar.translate(0, lift + 0.04, 0);
  const merged = mergeAll(metal);
  return { foil: mergeAll([dome, collar]), metal: merged };
}

/**
 * The laser retroreflector, origin at the ground, facing +x: a light square frame with a grid of dark
 * corner-cube circles, tilted back by `tilt` radians from vertical-facing, on a small stand.
 */
export function reflectorGeometry(tilt: number): { frame: THREE.BufferGeometry; cells: THREE.BufferGeometry; stand: THREE.BufferGeometry } {
  const size = 0.3;
  const centerY = 0.14;
  const place = (g: THREE.BufferGeometry) => {
    g.rotateZ(-tilt);
    g.translate(0, centerY, 0);
    return g;
  };
  // The tray, with a raised lip around the corner cubes.
  const parts = [new THREE.BoxGeometry(size, 0.02, size)];
  for (const s of [-1, 1]) {
    const a = new THREE.BoxGeometry(size, 0.014, 0.014);
    a.translate(0, 0.016, s * (size / 2 - 0.007));
    const b = new THREE.BoxGeometry(0.014, 0.014, size);
    b.translate(s * (size / 2 - 0.007), 0.016, 0);
    parts.push(a, b);
  }
  const frame = place(mergeAll(parts));
  const dots: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const d = new THREE.CylinderGeometry(0.026, 0.026, 0.006, 14);
    d.translate((i - 1.5) * 0.068, 0.012, (j - 1.5) * 0.068);
    dots.push(place(d));
  }
  const cells = mergeAll(dots);
  const block = new THREE.BoxGeometry(0.1, 0.06, 0.16);
  block.translate(-0.05, 0.03, 0);
  const strut = new THREE.BoxGeometry(0.03, 0.14, 0.03);
  strut.translate(-0.07, 0.07, 0);
  const stand = mergeAll([block, strut]);
  return { frame, cells, stand };
}

/** Merge geometries (indexed or not) into one, and free the parts. */
function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const mixed = parts.some((g) => !g.index) && parts.some((g) => g.index);
  const list = mixed ? parts.map((g) => (g.index ? g.toNonIndexed() : g)) : parts;
  const merged = mergeGeometries(list)!;
  new Set([...parts, ...list]).forEach((g) => g.dispose());
  return merged;
}

/** A small seeded random generator, so the textures come out the same every time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small canvas texture, drawn once per model. `color: false` for data textures (bump maps). */
function canvasTexture(
  size: number,
  draw: (g: CanvasRenderingContext2D, s: number) => void,
  repeat: [number, number],
  color = true,
): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return null;
  draw(g, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  return texture;
}

/** Solar cells, 2 × 2 per tile: dark blue cells with silver gaps, fine grid fingers and bus bars. */
function cellTexture(repeat: [number, number]): THREE.Texture | null {
  return canvasTexture(128, (g, s) => {
    const rand = seeded(7);
    g.fillStyle = '#a3a8b0';
    g.fillRect(0, 0, s, s);
    const c = s / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = i * c + 2;
      const y = j * c + 2;
      const k = c - 4;
      const shade = 0.9 + rand() * 0.2;
      g.fillStyle = `rgb(${Math.round(27 * shade)},${Math.round(40 * shade)},${Math.round(74 * shade)})`;
      g.fillRect(x, y, k, k);
      // A soft sheen across each cell, as on real cover glass.
      const sheen = g.createLinearGradient(x, y, x + k, y + k);
      sheen.addColorStop(0, 'rgba(90,120,180,0.18)');
      sheen.addColorStop(0.5, 'rgba(90,120,180,0)');
      g.fillStyle = sheen;
      g.fillRect(x, y, k, k);
      g.fillStyle = 'rgba(150,165,195,0.22)';
      for (let f = y + 4; f < y + k; f += 5) g.fillRect(x, f, k, 1);
      g.fillStyle = 'rgba(205,210,220,0.55)';
      g.fillRect(x + k * 0.33, y, 1.5, k);
      g.fillRect(x + k * 0.66, y, 1.5, k);
    }
  }, repeat);
}

/** Wire mesh: a diamond lattice of thin wires on a transparent ground (used with alphaTest). */
function meshTexture(): THREE.Texture | null {
  return canvasTexture(64, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(s, s);
    g.moveTo(s, 0);
    g.lineTo(0, s);
    g.stroke();
    // Darker crossings, where the woven wires overlap.
    g.fillStyle = 'rgba(70,64,52,0.6)';
    for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s], [s / 2, s / 2]] as const) g.fillRect(x - 3, y - 3, 6, 6);
  }, [34, 3]);
}

/** Brushed metal (a near-white multiplier, so the material color sets the tone): fine streaks and smudges. */
function brushedTexture(seed: number, repeat: [number, number]): THREE.Texture | null {
  return canvasTexture(128, (g, s) => {
    const rand = seeded(seed);
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      const v = 215 + Math.floor(rand() * 40);
      g.fillStyle = `rgba(${v},${v},${v},0.5)`;
      g.fillRect(0, y, s, 1);
    }
    for (let k = 0; k < 6; k++) {
      g.fillStyle = `rgba(120,118,112,${0.05 + rand() * 0.06})`;
      g.beginPath();
      g.ellipse(rand() * s, rand() * s, 6 + rand() * 18, 3 + rand() * 8, rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }, repeat);
}

/** Painted steel with wear: speckle, scratches and chipped paint showing bright metal. */
function paintedTexture(seed: number, repeat: [number, number]): THREE.Texture | null {
  return canvasTexture(128, (g, s) => {
    const rand = seeded(seed);
    g.fillStyle = '#d9d9d9';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 500; k++) {
      const v = 180 + Math.floor(rand() * 60);
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      g.fillRect(rand() * s, rand() * s, 1.5, 1.5);
    }
    g.lineWidth = 1;
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgba(255,255,255,${0.3 + rand() * 0.4})`;
      const x = rand() * s;
      const y = rand() * s;
      const a = rand() * Math.PI;
      const len = 6 + rand() * 22;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    for (let k = 0; k < 7; k++) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.ellipse(rand() * s, rand() * s, 1.5 + rand() * 3, 1 + rand() * 2, rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }, repeat);
}

/** White radiator: a grid of mirror tiles with thin seams, rivets, and a little dust toward the bottom. */
function radiatorTexture(): THREE.Texture | null {
  return canvasTexture(128, (g, s) => {
    const rand = seeded(11);
    g.fillStyle = '#b9b7b0';
    g.fillRect(0, 0, s, s);
    const n = 4;
    const t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 238 + Math.floor(rand() * 17);
      g.fillStyle = `rgb(${v},${v},${v - 3})`;
      g.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
    }
    g.fillStyle = 'rgba(110,108,100,0.8)';
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) g.fillRect(i * t - 1, j * t - 1, 2, 2);
    const dust = g.createLinearGradient(0, s, 0, s * 0.55);
    dust.addColorStop(0, 'rgba(140,128,110,0.28)');
    dust.addColorStop(1, 'rgba(140,128,110,0)');
    g.fillStyle = dust;
    g.fillRect(0, 0, s, s);
  }, [4, 1]);
}

/** Crinkled multi-layer insulation: patches of brighter and darker gold, creases and taped seams. */
function foilTexture(): THREE.Texture | null {
  return canvasTexture(256, (g, s) => {
    const rand = seeded(23);
    g.fillStyle = '#f0e6d2';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 90; k++) {
      const light = rand() < 0.5;
      g.fillStyle = light ? `rgba(255,250,235,${0.2 + rand() * 0.3})` : `rgba(160,130,80,${0.08 + rand() * 0.12})`;
      g.beginPath();
      const x = rand() * s;
      const y = rand() * s;
      g.moveTo(x, y);
      for (let p = 0; p < 4; p++) g.lineTo(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 60);
      g.closePath();
      g.fill();
    }
    creases(g, s, rand, 'rgba(255,255,240,0.5)', 'rgba(120,95,55,0.32)');
    // Taped seams between blanket panels.
    g.fillStyle = 'rgba(120,95,55,0.55)';
    g.fillRect(0, s * 0.5 - 1, s, 3);
    g.fillRect(s * 0.5 - 1, 0, 3, s);
  }, [2, 1]);
}

/** The crease pattern again, as height for the foil's bump map. */
function foilBump(): THREE.Texture | null {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, s, s);
    creases(g, s, seeded(23 + 1), 'rgba(255,255,255,0.7)', 'rgba(0,0,0,0.7)');
  }, [2, 1], false);
}

function creases(g: CanvasRenderingContext2D, s: number, rand: () => number, light: string, dark: string): void {
  g.lineCap = 'round';
  for (let k = 0; k < 140; k++) {
    let x = rand() * s;
    let y = rand() * s;
    let a = rand() * Math.PI * 2;
    g.lineWidth = 0.6 + rand() * 1.4;
    g.strokeStyle = k % 2 ? light : dark;
    g.beginPath();
    g.moveTo(x, y);
    for (let p = 0; p < 3; p++) {
      a += (rand() - 0.5) * 1.6;
      const len = 6 + rand() * 18;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

/** The auger's helical flute along the drill string. */
function augerTexture(): THREE.Texture | null {
  return canvasTexture(64, (g, s) => {
    g.fillStyle = '#e4e6e9';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#6f747b';
    g.lineWidth = 9;
    for (const o of [-s, 0, s]) {
      g.beginPath();
      g.moveTo(0, o);
      g.lineTo(s, o + s);
      g.stroke();
    }
  }, [1, 10]);
}

/** Radar antenna elements: a copper bow-tie dipole on a dark board, one per tile, with a fine border. */
function radarTexture(): THREE.Texture | null {
  return canvasTexture(64, (g, s) => {
    g.fillStyle = '#3c3e3a';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(160,160,150,0.55)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, s - 2, s - 2);
    g.fillStyle = '#b8864a';
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.5);
    g.lineTo(s * 0.18, s * 0.12);
    g.lineTo(s * 0.82, s * 0.12);
    g.closePath();
    g.moveTo(s * 0.5, s * 0.5);
    g.lineTo(s * 0.18, s * 0.88);
    g.lineTo(s * 0.82, s * 0.88);
    g.closePath();
    g.fill();
    g.fillStyle = '#e0bb7c';
    g.fillRect(s * 0.46, s * 0.42, s * 0.08, s * 0.16); // the feed point
  }, [4, 3]);
}

/** An electric heater patch: amber film with a dark border and a bright copper serpentine trace. */
function heaterPatchTexture(): THREE.Texture | null {
  return canvasTexture(64, (g, s) => {
    g.fillStyle = '#3a1a08';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#b8561a';
    g.fillRect(4, 4, s - 8, s - 8);
    g.strokeStyle = '#ffd890';
    g.lineWidth = 4;
    g.beginPath();
    const rows = 6;
    for (let k = 0; k <= rows; k++) {
      const y = 9 + (k * (s - 18)) / rows;
      const [a, b] = k % 2 ? [s - 10, 10] : [10, s - 10];
      if (k === 0) g.moveTo(a, y);
      else g.lineTo(a, y);
      g.lineTo(b, y);
    }
    g.stroke();
  }, [1, 1]);
}

/** A small fictional rover marking, dark on clear. */
function markingTexture(): THREE.Texture | null {
  return canvasTexture(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#2b2d31';
    g.font = `bold ${Math.round(s * 0.4)}px Arial, Helvetica, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('REL', s / 2, s * 0.42);
    g.fillRect(s * 0.14, s * 0.68, s * 0.72, s * 0.05);
    g.fillRect(s * 0.14, s * 0.77, s * 0.34, s * 0.05);
  }, [1, 1]);
}

type Vec = [number, number, number];

/**
 * Where the floodlight beam starts, in the chassis frame: the front face of the lamp housings, at their
 * height, centred between the two. Uses the same layout as the lamp housings drawn in `buildRoverModel`.
 */
export function floodlightOrigin(handling: RoverHandling): THREE.Vector3 {
  const { lengthM: l, heightM: ht } = handling.body;
  const top = ht / 2;
  const boxH = ht * 0.78;
  const boxY = -top + 0.08 + boxH / 2;
  return new THREE.Vector3(l / 2 - 0.02 + 0.05, boxY + 0.02, 0);
}

export function buildRoverModel(handling: RoverHandling, connectY: number, look: RoverLook, options: RoverModelOptions = {}): RoverModel {
  const { lengthM: l, widthM: w, heightM: ht } = handling.body;
  const r = handling.wheelRadiusM;
  const body = new THREE.Group();
  const mats = new Map<string, THREE.MeshLambertMaterial>();
  /** A material, made once per model (the texture is drawn only when the material is first needed). */
  const mat = (key: string, params: () => THREE.MeshLambertMaterialParameters, noShadow = false) => {
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshLambertMaterial(params());
      m.name = key; // tells the materials apart (the intro video's material upgrade); no effect on the look
      if (noShadow) m.userData.noShadow = true;
      // Callers free `map`; the bump map is freed with the material.
      const material = m;
      if (material.bumpMap) material.addEventListener('dispose', () => material.bumpMap?.dispose());
      mats.set(key, m);
    }
    return m;
  };
  /** A material with a canvas texture: the texture multiplies the color (or the fallback color alone, without a DOM). */
  const textured = (key: string, color: number, map: () => THREE.Texture | null, extra: THREE.MeshLambertMaterialParameters = {}) =>
    mat(key, () => ({ color, map: map(), ...extra }));
  let slot: ModelGroup = 'chassis'; // the group the static parts added next belong to
  const rigOn = options.rig ?? false;
  let rigPart: RigPart | null = null; // with `rig`: the moving part the parts added next belong to
  const rigAnchors: Partial<Record<RigPart, THREE.Vector3>> = {};
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = body) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData.slot = slot;
    if (rigPart) mesh.userData.rig = rigPart;
    parent.add(mesh);
    return mesh;
  };
  const box = (sx: number, sy: number, sz: number) => new THREE.BoxGeometry(sx, sy, sz);
  const rod = (radius: number, length: number, segments = 8) => new THREE.CylinderGeometry(radius, radius, length, segments);
  /** A rod along z (an axle, a lens barrel facing sideways), or along x with `alongX`. */
  const axle = (radius: number, length: number, segments = 12, alongX = false) => {
    const g = rod(radius, length, segments);
    return alongX ? g.rotateZ(Math.PI / 2) : g.rotateX(Math.PI / 2);
  };
  /** A round rod from a to b. */
  const strut = (a: Vec, b: Vec, radius: number, segments = 6) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const g = rod(radius, dir.length(), segments);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    const mid = va.add(vb).multiplyScalar(0.5);
    return g.translate(mid.x, mid.y, mid.z);
  };
  /** A cable through the given points. */
  const cable = (points: Vec[], radius = 0.009) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), points.length * 6, radius, 4);
  /** Small bolt heads on a face, the head along `axis`. */
  const bolts = (points: Vec[], axis: 'x' | 'y' | 'z', radius = 0.011) =>
    mergeAll(points.map(([x, y, z]) => {
      const g = rod(radius, 0.012, 6);
      if (axis === 'x') g.rotateZ(Math.PI / 2);
      if (axis === 'z') g.rotateX(Math.PI / 2);
      return g.translate(x, y, z);
    }));

  const steel = look.frame === 'steel';
  const frame = steel
    ? textured('frame', COLORS.steel, () => paintedTexture(3, [1, 1]))
    : textured('frame', COLORS.titanium, () => brushedTexture(5, [1, 1]));
  const dark = mat('dark', () => ({ color: COLORS.dark }));
  const radiator = textured('radiator', COLORS.radiator, radiatorTexture);
  const white = mat('white', () => ({ color: COLORS.white, side: THREE.DoubleSide }));
  const foil = mat('foil', () => {
    const map = foilTexture();
    return { color: COLORS.foil, map, bumpMap: map ? foilBump() : null, bumpScale: 2.5 };
  });
  const casing = textured('casing', COLORS.casing, () => brushedTexture(9, [1, 1]));
  const lens = mat('lens', () => ({ color: COLORS.lens, emissive: 0x0b2033 }));
  const top = ht / 2;

  // Frame: a deck plate with an edge trim and bolts. The titanium frame is a light tube space frame
  // with joint nodes around the electronics box; the steel frame has heavy I-beams, cross members and
  // a rear bumper.
  const deckY = -top + 0.05; // deck plate center
  const deckBottom = deckY - 0.02;
  const deckW = w - 0.06; // clear of the wheels' inner faces
  if (look.frame) {
    slot = 'chassis';
    add(box(l, 0.04, deckW), frame, 0, deckY, 0);
    for (const z of [-1, 1]) add(box(l, 0.012, 0.02), dark, 0, deckY + 0.026, z * (deckW / 2 - 0.01));
    const edge: Vec[] = [];
    for (let k = 0; k < 9; k++) for (const z of [-1, 1]) edge.push([-l / 2 + 0.08 + k * (l - 0.16) / 8, deckY + 0.026, z * (deckW / 2 - 0.04)]);
    add(bolts(edge, 'y', 0.01), frame);
    if (steel) {
      const beam = textured('beam', COLORS.steelBeam, () => paintedTexture(4, [3, 1]));
      for (const z of [-1, 1]) {
        const bz = z * 0.6;
        add(box(l + 0.12, 0.12, 0.022), beam, 0, -top + 0.06, bz);
        for (const y of [-1, 1]) add(box(l + 0.12, 0.016, 0.08), beam, 0, -top + 0.06 + y * 0.052, bz);
        const row: Vec[] = [];
        for (let k = 0; k < 10; k++) row.push([-l / 2 + 0.05 + k * (l - 0.1) / 9, -top + 0.06, bz + z * 0.014]);
        add(bolts(row, 'z', 0.012), frame);
        // Gussets where the beams meet the bumper.
        add(box(0.12, 0.09, 0.012), beam, -l / 2 - 0.02, -top + 0.06, bz - z * 0.03);
      }
      for (const x of [-1, 0, 1]) add(box(0.08, 0.06, 1.12), beam, x * (l / 2 - 0.12), deckBottom - 0.03, 0);
      add(box(0.06, 0.09, 1.28), beam, -l / 2 - 0.09, -top + 0.06, 0);
    } else {
      const px = l / 2 - 0.04;
      const pz = deckW / 2 - 0.03;
      const lowY = deckY + 0.04;
      const highY = 0.2;
      const tubes: THREE.BufferGeometry[] = [];
      const nodes: THREE.BufferGeometry[] = [];
      const node = (p: Vec) => nodes.push(new THREE.SphereGeometry(0.026, 8, 6).translate(...p));
      for (const z of [-1, 1]) {
        tubes.push(strut([-px - 0.02, lowY, z * pz], [px + 0.02, lowY, z * pz], 0.02, 8));
        tubes.push(strut([-px, highY, z * pz], [px, highY, z * pz], 0.016));
        for (const x of [-1, 0, 1]) {
          tubes.push(strut([x * px, lowY, z * pz], [x * px, highY, z * pz], 0.016));
          node([x * px, lowY, z * pz]);
          node([x * px, highY, z * pz]);
        }
        // N-truss diagonals on the long sides.
        tubes.push(strut([-px, lowY, z * pz], [0, highY, z * pz], 0.012));
        tubes.push(strut([0, lowY, z * pz], [px, highY, z * pz], 0.012));
      }
      for (const x of [-1, 1]) tubes.push(strut([x * px, highY, -pz], [x * px, highY, pz], 0.016));
      add(mergeAll(tubes), frame);
      add(mergeAll(nodes), frame);
    }
    // Suspension mounts under the deck, where the dampers meet the frame.
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      add(box(0.12, 0.04, 0.09), dark, x * handling.wheelBaseM / 2, deckBottom - 0.02, z * (handling.wheelTrackM / 2 - 0.16));
    }
  }

  // Warm electronics box: white radiator panels (chassis), wrapped in gold thermal blanket when the
  // heater is fitted (the blanket and fins belong to the heater, so they show even before a chassis).
  const boxL = l * 0.74;
  const boxH = ht * 0.78;
  const boxW = w * 0.8;
  const boxX = -0.04;
  const boxY = -top + 0.08 + boxH / 2;
  const deckTopY = boxY + boxH / 2; // top of the box
  slot = look.heater ? 'heater' : 'chassis';
  if (look.frame || look.heater) {
    const shell = mergeVertices(new RoundedBoxGeometry(boxL, boxH, boxW, 2, 0.022));
    add(shell, look.heater ? foil : radiator, boxX, boxY, 0);
    // The fictional maker's marking on each side, between the fins.
    const marking = mat('marking', () => ({ map: markingTexture(), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }), true);
    if (marking.map) {
      for (const z of [-1, 1]) {
        const plate = new THREE.PlaneGeometry(0.17, 0.17);
        if (z < 0) plate.rotateY(Math.PI);
        add(plate, marking, boxX + boxL * 0.2, boxY + 0.03, z * (boxW / 2 + 0.002));
      }
    }
    // A lid seam with bolts around the top.
    const lid: Vec[] = [];
    for (let k = 0; k < 7; k++) for (const z of [-1, 1]) lid.push([boxX - boxL / 2 + 0.08 + k * (boxL - 0.16) / 6, deckTopY - 0.03, z * (boxW / 2 + 0.002)]);
    add(bolts(lid, 'z', 0.009), dark);
  }
  if (look.heater) {
    // Radiator fins on the sides: the heater's warmth has to be managed too.
    for (const z of [-1, 1]) for (let k = 0; k < 4; k++) {
      const fx = boxX - boxL * 0.3 + k * boxL * 0.2;
      add(box(0.03, boxH * 0.8, 0.05), radiator, fx, boxY, z * (boxW / 2 + 0.025));
    }
    for (const z of [-1, 1]) add(box(boxL * 0.64, 0.02, 0.04), dark, boxX, boxY + boxH * 0.42, z * (boxW / 2 + 0.02));
  }
  // The fitted heater, on the blanket in the two rear bays between the fins (the front bay has the
  // marking), shallow enough to stay inside the fins and clear of the titanium frame's side tubes.
  const bays = [boxX - boxL * 0.2, boxX];
  if (look.heaterKind === 'rhu') {
    // Radioisotope heater units: a row of small dark canisters with silver end caps, standing on a shelf
    // in front of a silver backplate, held by a clamp band.
    const cr = 0.019;
    const ch = 0.12;
    const cy = boxY - 0.01;
    for (const z of [-1, 1]) for (const bay of bays) {
      const face = z * (boxW / 2);
      const cz = face + z * (0.006 + cr);
      add(box(0.22, 0.16, 0.004), casing, bay, cy, face + z * 0.002);
      add(box(0.23, 0.012, 0.05), frame, bay, cy - ch / 2 - 0.014, face + z * 0.025);
      add(box(0.23, 0.014, 0.004), frame, bay, cy + 0.01, cz + z * (cr + 0.002));
      for (let k = 0; k < 4; k++) {
        const x = bay + (k - 1.5) * 0.054;
        add(rod(cr, ch, 10), dark, x, cy, cz);
        for (const s of [-1, 1]) add(rod(cr + 0.003, 0.014, 10), casing, x, cy + s * (ch / 2 - 0.004), cz);
      }
    }
  } else if (look.heaterKind === 'electric') {
    // The electric heater: amber resistive patches with copper traces, each with a thermostat and a pair
    // of leads (red and black) that run up and into the box under the lid.
    const patch = mat('heaterPatch', () => {
      const map = heaterPatchTexture();
      return { color: map ? 0xffffff : COLORS.kapton, map };
    });
    const wire = mat('wireRed', () => ({ color: COLORS.wireRed }));
    const py = boxY - 0.01;
    for (const z of [-1, 1]) for (const bay of bays) {
      const face = z * (boxW / 2);
      const patchMesh = add(box(0.21, 0.19, 0.004), patch, bay, py, face + z * 0.003);
      if (z < 0) patchMesh.rotation.y = Math.PI; // the trace reads the same way on both sides
      add(box(0.05, 0.034, 0.018), casing, bay + 0.06, py + 0.06, face + z * 0.014); // the thermostat
      for (const [k, m] of [[0, wire], [1, dark]] as const) {
        const x = bay - 0.07 + k * 0.022;
        const zz = face + z * (0.012 + k * 0.004);
        add(cable([[x, py + 0.075, zz], [x + 0.01, py + 0.11, zz + z * 0.006], [x - 0.01, boxY + boxH * 0.38, zz]], 0.008), m);
      }
      add(cable([[bay + 0.06, py + 0.077, face + z * 0.012], [bay + 0.03, py + 0.12, face + z * 0.016], [bay - 0.02, boxY + boxH * 0.38, face + z * 0.012]], 0.007), wire);
    }
  }
  const deckTop = look.power === 'panel' || look.power === 'arrays' ? deckTopY + 0.07 : deckTopY + 0.02; // what deck-mounted instruments stand on

  // Power: a flat panel over the deck (also under deployable arrays), a vertical solar mast for a Sun on
  // the horizon, or a radioisotope generator at the back.
  slot = 'power';
  if (look.power === 'panel' || look.power === 'arrays') {
    const pl = l * 0.98;
    const pw = w * 1.02;
    const py = deckTopY + 0.055;
    const cells = mat('cells', () => {
      const map = cellTexture([16, 11]);
      return { color: map ? 0xffffff : COLORS.cell, map };
    });
    add(box(pl - 0.03, 0.022, pw - 0.03), cells, -0.02, py, 0);
    // An edge frame, and standoffs to the deck.
    for (const z of [-1, 1]) add(box(pl, 0.03, 0.025), frame, -0.02, py, z * (pw / 2 - 0.012));
    for (const x of [-1, 1]) add(box(0.025, 0.03, pw - 0.05), frame, -0.02 + x * (pl / 2 - 0.012), py, 0);
    add(box(0.02, 0.026, pw - 0.05), frame, -0.02, py, 0);
    for (const x of [-1, 0, 1]) for (const z of [-1, 1]) add(rod(0.014, 0.05), frame, x * l * 0.36, deckTopY + 0.025, z * w * 0.36);
    add(box(pl - 0.08, 0.008, pw - 0.08), dark, -0.02, py - 0.015, 0);
  } else if (look.power === 'mast') {
    const mx = -l * 0.3;
    const poleH = 0.45;
    const panelH = 1.1;
    const side = 0.42;
    const panelY = deckTopY + poleH + panelH / 2;
    add(rod(0.07, 0.07, 16), dark, mx, deckTopY + 0.035, 0); // the gimbal that turns it to the Sun
    if (rigOn) {
      // The pole in two pieces: the panel column (with its share of the pole) hinges at the pole's top.
      add(rod(0.035, poleH, 10), frame, mx, deckTopY + poleH / 2, 0);
      rigPart = 'solarPanel';
      rigAnchors.solarPanel = new THREE.Vector3(mx, deckTopY + poleH, 0);
      add(rod(0.035, panelH, 10), frame, mx, deckTopY + poleH + panelH / 2, 0);
    } else add(rod(0.035, poleH + panelH, 10), frame, mx, deckTopY + (poleH + panelH) / 2, 0);
    const face = mat('mastCells', () => {
      const map = cellTexture([2, 6]);
      return { color: map ? 0xffffff : COLORS.cell, map };
    });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const p = add(box(side - 0.02, panelH - 0.02, 0.02), face, mx + Math.sin(a) * side / 2, panelY, Math.cos(a) * side / 2);
      p.rotation.y = a;
    }
    // Corner longerons, ribs and a top cap.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(0.025, panelH + 0.02, 0.025), frame, mx + sx * side / 2, panelY, sz * side / 2);
    for (const y of [-1, 0, 1]) {
      for (const s of [-1, 1]) {
        add(box(side + 0.02, 0.018, 0.012), frame, mx, panelY + y * (panelH / 2 - 0.009), s * (side / 2 + 0.008));
        add(box(0.012, 0.018, side + 0.02), frame, mx + s * (side / 2 + 0.008), panelY + y * (panelH / 2 - 0.009), 0);
      }
    }
    add(box(side + 0.04, 0.03, side + 0.04), frame, mx, panelY + panelH / 2 + 0.015, 0);
    add(rod(0.05, 0.04, 12), dark, mx, panelY + panelH / 2 + 0.05, 0);
    rigPart = null;
    // A low radiator plate where the flat panel would be.
    add(box(l * 0.4, 0.02, w * 0.6), radiator, l * 0.12, deckTopY + 0.01, 0);
  } else if (look.power === 'rtg') {
    // A radioisotope generator at the back, tilted up like Curiosity's: a dark core with radial cooling fins.
    const length = 0.55;
    const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.1, 0.1, length, 16)];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const fin = new THREE.BoxGeometry(0.1, length * 0.92, 0.012);
      fin.translate(0.13, 0, 0);
      fin.rotateY(a);
      parts.push(fin);
    }
    const core = mergeGeometries(parts.slice(0, 1))!;
    const fins = mergeGeometries(parts.slice(1))!;
    parts.forEach((g) => g.dispose());
    for (const g of [core, fins]) g.rotateZ(1.0); // the top leans out behind the rover
    const rx = -l / 2 - 0.2;
    const ry = deckTopY - 0.05;
    add(core, dark, rx, ry, 0);
    add(fins, radiator, rx, ry, 0);
    for (const z of [-1, 1]) add(box(0.3, 0.04, 0.04), frame, -l / 2 - 0.06, ry - 0.06, z * 0.12); // mounting struts
  }
  if (look.power === 'arrays') {
    // Deployable solar arrays: two wings folded out from the deck, beyond the wheels.
    const wingW = w * 0.48;
    const wingCells = mat('wingCells', () => {
      const map = cellTexture([7, 4]);
      return { color: map ? 0xffffff : COLORS.cell, map };
    });
    const wingFrame = mat('cellFrame', () => ({ color: COLORS.cellFrame }));
    for (const z of [-1, 1]) {
      const zc = z * (w * 0.51 + wingW / 2);
      add(box(l * 0.86, 0.022, wingW + 0.02), wingFrame, -0.04, deckTopY + 0.05, zc);
      add(box(l * 0.83, 0.026, wingW - 0.01), wingCells, -0.04, deckTopY + 0.053, zc);
      add(axle(0.012, 0.18), frame, -0.04, deckTopY + 0.05, z * w * 0.51); // the hinge
    }
  }

  // Battery: nickel-hydrogen cells are cylindrical pressure vessels with domed ends, in clamp bands
  // on a rack; lithium-ion is a compact ribbed pack; the larger battery is two tall ribbed modules, one
  // each side of the centre line (clear of an RTG's base), under white top plates with terminal posts.
  slot = 'battery';
  const bx = -l / 2 + 0.02;
  if (look.battery === 'cylinders') {
    const len = 0.3;
    const rad = 0.062;
    const vessel = () => {
      const capA = new THREE.SphereGeometry(rad, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, len / 2, 0);
      const capB = new THREE.SphereGeometry(rad, 14, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, -len / 2, 0);
      return mergeAll([rod(rad, len, 14), capA, capB]).rotateX(Math.PI / 2);
    };
    for (let k = 0; k < 4; k++) {
      const vy = -top + 0.165 + (k % 2) * 0.135;
      const vz = (k < 2 ? -1 : 1) * 0.24;
      add(vessel(), casing, bx, vy, vz);
      for (const s of [-1, 1]) add(axle(rad + 0.006, 0.025, 14), dark, bx, vy, vz + s * len * 0.3);
    }
    for (const z of [-0.47, 0, 0.47]) add(box(0.16, 0.32, 0.014), frame, bx + 0.02, -top + 0.23, z);
    add(cable([[bx + 0.06, -top + 0.3, 0.04], [bx + 0.1, -top + 0.36, 0.08], [bx + 0.18, -top + 0.3, 0.12]]), dark);
  } else if (look.battery === 'pack') {
    add(box(0.12, 0.2, w * 0.48), dark, bx, -top + 0.19, 0);
    for (let k = 0; k < 6; k++) add(box(0.016, 0.014, w * 0.44), dark, bx - 0.066, -top + 0.115 + k * 0.03, 0); // cooling ribs
    add(box(0.13, 0.02, w * 0.5), casing, bx, -top + 0.3, 0);
    for (const z of [-1, 1]) add(axle(0.018, 0.04, 10, true), frame, bx + 0.08, -top + 0.25, z * 0.18);
    add(cable([[bx + 0.1, -top + 0.25, 0.18], [bx + 0.16, -top + 0.27, 0.22], [bx + 0.22, -top + 0.3, 0.26]]), dark);
  } else if (look.battery === 'large') {
    const mh = 0.27; // module height
    const my = -top + 0.09 + mh / 2;
    const topY = my + mh / 2;
    const plate = mat('batteryPlate', () => ({ color: COLORS.white }));
    const red = mat('wireRed', () => ({ color: COLORS.wireRed }));
    for (const z of [-1, 1]) {
      const mz = z * 0.26;
      add(box(0.13, mh, 0.15), dark, bx, my, mz);
      for (let k = 0; k < 8; k++) add(box(0.016, 0.014, 0.13), dark, bx - 0.071, my - mh / 2 + 0.025 + k * 0.031, mz); // cooling ribs
      for (const s of [-1, 1]) add(box(0.012, mh - 0.03, 0.016), casing, bx + 0.066, my, mz + s * 0.055); // front straps
      add(box(0.15, 0.02, 0.17), plate, bx, topY + 0.01, mz);
      add(rod(0.016, 0.026, 10), red, bx - 0.03, topY + 0.033, mz - 0.035);
      add(rod(0.016, 0.026, 10), dark, bx - 0.03, topY + 0.033, mz + 0.035);
    }
    add(box(0.15, 0.012, 0.7), frame, bx, -top + 0.084, 0); // the mounting rail under both
    add(cable([[bx - 0.03, topY + 0.05, -0.225], [bx - 0.04, topY + 0.09, 0], [bx - 0.03, topY + 0.05, 0.225]]), dark); // the modules' interconnect
    add(cable([[bx + 0.066, my + 0.06, 0.2], [bx + 0.14, my + 0.08, 0.22], [bx + 0.22, -top + 0.3, 0.26]]), dark);
  }

  // High-gain antenna at the back, for the link to Earth (part of the chassis): a parabolic dish with
  // a feed on three struts, on a gimbal; and a short low-gain whip beside it.
  if (look.frame) {
    slot = 'chassis';
    const antX = -l * 0.36;
    const antZ = look.power === 'mast' ? -w * 0.36 : -w * 0.32;
    const antY = look.power === 'mast' ? deckTopY : deckTopY + 0.08;
    add(rod(0.02, 0.36), frame, antX, antY + 0.18, antZ);
    add(box(0.07, 0.06, 0.07), dark, antX, antY + 0.37, antZ);
    const focal = 0.12;
    const radius = 0.17;
    const depth = (radius * radius) / (4 * focal);
    const profile: THREE.Vector2[] = [];
    for (let k = 0; k <= 5; k++) {
      const rr = 0.012 + (radius - 0.012) * (k / 5);
      profile.push(new THREE.Vector2(rr, (rr * rr) / (4 * focal) - 0.01));
    }
    profile.push(new THREE.Vector2(radius + 0.006, depth));
    for (let k = 5; k >= 0; k--) {
      const rr = 0.012 + (radius - 0.012) * (k / 5);
      profile.push(new THREE.Vector2(rr, (rr * rr) / (4 * focal)));
    }
    const aim = new THREE.Matrix4().makeTranslation(antX + 0.04, antY + 0.42, antZ).multiply(new THREE.Matrix4().makeRotationZ(-0.95));
    add(new THREE.LatheGeometry(profile, 20).applyMatrix4(aim), white);
    const feeds: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      feeds.push(strut([Math.cos(a) * radius * 0.95, depth, Math.sin(a) * radius * 0.95], [0, focal, 0], 0.005, 4));
    }
    add(mergeAll(feeds).applyMatrix4(aim), frame);
    add(rod(0.022, 0.05, 10).translate(0, focal + 0.02, 0).applyMatrix4(aim), dark);
    add(rod(0.006, 0.3, 5), dark, antX + 0.16, antY + 0.15, antZ - 0.05);
    add(new THREE.SphereGeometry(0.014, 8, 6), dark, antX + 0.16, antY + 0.31, antZ - 0.05);
    add(cable([[antX, antY + 0.02, antZ + 0.02], [antX + 0.1, antY + 0.01, antZ + 0.08], [antX + 0.25, antY + 0.008, antZ + 0.1]]), dark);
  }

  // Floodlights: a housing on each front corner with two round LED lamps in bezels, on a bracket.
  slot = 'lights';
  if (look.lights) {
    const lamp = mat('lamp', () => ({ color: COLORS.lamp, emissive: 0xb0a88e }), true);
    const lx = l / 2 - 0.02; // keep in step with floodlightOrigin()
    const ly = boxY + 0.02;
    for (const z of [-1, 1]) {
      const lz = z * w * 0.3;
      add(new RoundedBoxGeometry(0.08, 0.1, 0.22, 1, 0.015).toNonIndexed(), dark, lx, ly, lz);
      for (const s of [-1, 1]) {
        add(axle(0.034, 0.012, 14, true), lamp, lx + 0.044, ly, lz + s * 0.055);
        const bezel = add(new THREE.TorusGeometry(0.037, 0.008, 4, 14), frame, lx + 0.047, ly, lz + s * 0.055);
        bezel.rotation.y = Math.PI / 2;
      }
      add(strut([lx - 0.01, ly - 0.05, lz], [lx - 0.05, deckY + 0.02, lz], 0.014), frame);
    }
  }

  // Instruments, each in its own place: a tall camera mast with a pan/tilt stereo head near the front
  // corner, and a drill tower at the front (with a short navigation camera when there is no camera mast).
  const cameraHead = (x: number, height: number, z: number, rig = false) => {
    const headY = deckTopY + height + 0.1;
    add(rod(0.05, 0.05, 12), dark, x, deckTopY + 0.025, z);
    if (rig) {
      // Telescoping: a lower sleeve, and the upper section (with its cable and a collar) sliding in it.
      const sleeve = Math.min(0.42, height * 0.45);
      add(rod(0.032, sleeve, 10), frame, x, deckTopY + sleeve / 2, z);
      add(rod(0.038, 0.03, 10), dark, x, deckTopY + sleeve, z);
      rigPart = 'cameraMast';
      rigAnchors.cameraMast = new THREE.Vector3(x, deckTopY, z);
      add(rod(0.024, height - sleeve + 0.1, 10), frame, x, deckTopY + (height + sleeve - 0.1) / 2, z);
      add(rod(0.006, height - sleeve - 0.04, 4), dark, x - 0.033, deckTopY + (height + sleeve) / 2, z);
      add(rod(0.034, 0.025, 10), dark, x, deckTopY + height * 0.75, z);
    } else {
      add(rod(0.026, height, 10), frame, x, deckTopY + height / 2, z);
      add(rod(0.007, height - 0.05, 4), dark, x - 0.035, deckTopY + height / 2, z);
      if (height > 0.6) for (const f of [0.35, 0.7]) add(rod(0.036, 0.025, 10), dark, x, deckTopY + height * f, z);
    }
    // Pan unit, a tilt yoke and the head.
    if (rig) {
      rigPart = 'cameraPan';
      rigAnchors.cameraPan = new THREE.Vector3(x, deckTopY + height, z);
    }
    add(rod(0.045, 0.06, 12), dark, x, deckTopY + height + 0.03, z);
    for (const s of [-1, 1]) add(box(0.05, 0.1, 0.014), frame, x, headY - 0.02, z + s * 0.19);
    add(box(0.05, 0.014, 0.394), frame, x, headY - 0.07, z);
    if (rig) {
      rigPart = 'cameraTilt';
      rigAnchors.cameraTilt = new THREE.Vector3(x, headY, z);
    }
    const eye = rig ? mat('eye', () => ({ color: COLORS.lens, emissive: 0x0b2033 })) : lens;
    add(new RoundedBoxGeometry(0.14, 0.11, 0.36, 1, 0.012).toNonIndexed(), casing, x, headY, z);
    add(box(0.03, 0.012, 0.36), dark, x + 0.06, headY + 0.06, z); // sunshade
    for (const s of [-1, 1]) {
      add(axle(0.03, 0.05, 12, true), dark, x + 0.085, headY, z + s * 0.11);
      add(axle(0.022, 0.006, 12, true), eye, x + 0.111, headY, z + s * 0.11);
    }
    add(axle(0.018, 0.03, 10, true), dark, x + 0.08, headY + 0.01, z);
    add(axle(0.012, 0.006, 10, true), eye, x + 0.096, headY + 0.01, z);
    rigPart = null;
  };
  const hasCamera = look.instruments.includes('camera');
  if (look.instruments.includes('drill')) {
    slot = 'drill';
    const dx = l / 2 + 0.08;
    const rail = 1.05;
    const railY = -top + 0.15;
    const towerY = railY + rail / 2 - 0.25;
    // The tower: a back plate with two guide rails, braced to the body.
    add(box(0.025, rail, 0.16), casing, dx - 0.045, towerY, 0);
    for (const s of [-1, 1]) add(box(0.025, rail, 0.025), frame, dx - 0.02, towerY, s * 0.055);
    add(box(0.08, 0.06, 0.26), dark, dx - 0.09, deckY, 0);
    add(strut([dx - 0.05, towerY + rail * 0.3, 0], [boxX + boxL / 2, deckTopY - 0.04, 0], 0.016), frame);
    // The carriage: a motor under gold blanket.
    const carY = railY + rail - 0.2;
    add(box(0.2, 0.16, 0.22), foil, dx + 0.04, carY, 0);
    add(rod(0.05, 0.08, 12), dark, dx + 0.1, carY + 0.12, 0);
    // The drill string, with its auger flute, reaches down to just above the ground.
    const groundY = connectY - handling.suspension.restLengthM - r;
    const stringTop = carY - 0.08;
    const stringLen = stringTop - (groundY + 0.12);
    const auger = mat('string', () => {
      const map = augerTexture();
      return { color: map ? 0xffffff : 0xd0d3d7, map };
    });
    add(rod(0.024, stringLen, 12), auger, dx + 0.1, stringTop - stringLen / 2, 0);
    add(rod(0.04, 0.03, 12), dark, dx + 0.1, railY - 0.2, 0); // the guide at the foot of the tower
    add(box(0.12, 0.02, 0.04), dark, dx + 0.04, railY - 0.2, 0);
    const bit = add(new THREE.ConeGeometry(0.035, 0.08, 10), dark, dx + 0.1, groundY + 0.08, 0);
    bit.rotation.z = Math.PI;
    add(cable([[dx + 0.02, carY + 0.05, 0.12], [dx - 0.04, carY - 0.1, 0.12], [dx - 0.08, deckTopY - 0.04, 0.1]]), dark);
    if (!hasCamera) cameraHead(l * 0.3, 0.45, w * 0.3);
  }
  if (hasCamera) {
    slot = 'camera';
    cameraHead(l * 0.32, 1.0, w * 0.28, rigOn);
  }

  // Low on the body: the neutron spectrometer, a detector block on the front face between the front
  // wheels (below the floodlights, beside the drill), and the X-ray spectrometer on the back, its
  // sensor head on a jointed arm lowered toward the ground under the rear of the body. With the robotic
  // arm fitted, the X-ray head sits on the arm's turret instead (drawn after the arm).
  const hasInstrument = (i: Instrument) => look.instruments.includes(i);
  if (hasInstrument('neutron')) {
    slot = 'neutron';
    const nx = l * 0.42;
    add(new RoundedBoxGeometry(0.2, 0.12, 0.42, 1, 0.012).toNonIndexed(), casing, nx, 0.0, 0);
    for (let k = 0; k < 7; k++) add(box(0.16, 0.022, 0.008), dark, nx - 0.01, 0.07, (k - 3) * 0.055);
    // Two helium-3 detector tubes across the front face, with end caps.
    for (const y of [-1, 1]) {
      add(axle(0.03, 0.4, 14), casing, nx + 0.13, y * 0.032, 0);
      for (const s of [-1, 1]) add(axle(0.034, 0.03, 14), dark, nx + 0.13, y * 0.032, s * 0.21);
    }
    add(box(0.05, 0.1, 0.36), frame, nx - 0.1, -0.105, 0);
    add(cable([[nx - 0.1, 0.0, 0.12], [nx - 0.16, -0.06, 0.14], [nx - 0.2, deckY + 0.03, 0.16]]), dark);
  }
  if (hasInstrument('xray') && !look.arm) {
    slot = 'xray';
    const ax = -l * 0.43;
    add(new RoundedBoxGeometry(0.18, 0.12, 0.22, 1, 0.012).toNonIndexed(), casing, ax, -0.29, 0);
    add(box(0.1, 0.064, 0.12), frame, ax, deckBottom - 0.032, 0);
    // The arm reaches out behind the rover: shoulder, upper arm, elbow, forearm, and the sensor head
    // (under gold blanket) with its contact ring, held just above the ground.
    const shoulder: Vec = [ax - 0.1, -0.31, 0];
    const elbow: Vec = [ax - 0.26, -0.36, 0];
    const head: Vec = [ax - 0.3, -0.48, 0];
    add(axle(0.034, 0.1, 14), dark, ...shoulder);
    add(axle(0.03, 0.08, 14), dark, ...elbow);
    for (const s of [-1, 1]) add(strut([shoulder[0], shoulder[1], s * 0.025], [elbow[0], elbow[1], s * 0.025], 0.013), frame);
    add(strut(elbow, [head[0], head[1] + 0.05, 0], 0.016), frame);
    add(rod(0.055, 0.08, 16), foil, head[0], head[1], 0);
    add(rod(0.04, 0.02, 16), dark, head[0], head[1] - 0.05, 0);
    add(rod(0.032, 0.008, 16), casing, head[0], head[1] - 0.064, 0);
    add(cable([[ax - 0.06, -0.28, 0.06], [ax - 0.18, -0.32, 0.06], [elbow[0], elbow[1] + 0.02, 0.05]], 0.006), dark);
  }

  // Mars support hardware, after Perseverance's: a remote sensing mast near the front left corner (a white
  // head with a big round telescope aperture between twin zoom cameras, on a pan/tilt unit), and a robotic
  // arm folded across the front right, below the floodlights: shoulder, upper arm, elbow, forearm and
  // wrist, ending in a turret of tools that points down and forward.
  const mx = l * 0.36;
  const mz = -w * 0.3;
  const mastHeight = 1.25;
  const mastHeadY = deckTopY + mastHeight + 0.08; // the head's center
  const ax = l / 2 + 0.08;
  const ay = -0.08;
  const zs = w * 0.36; // the arm's shoulder
  const ze = w * 0.12; // the elbow, clear of the drill
  const zw = zs + 0.03; // the wrist
  const armY = ay - 0.02; // the folded arm lies flat at this height
  const xu = ax + 0.02; // the upper arm
  const xf = ax + 0.11; // the forearm, in front of it
  const turret = new THREE.Vector3(ax + 0.14, armY - 0.1, zw); // the tool turret's hub (its axis along z)
  // Angles around the hub, from +x toward +y. The X-ray head, when fitted, takes the contact sensor's
  // place, turned a little further up so it clears the organics head and the wrist.
  const tool = { contact: 0.45, xray: 0.7, organics: -0.6, corer: -1.75, brush: -2.75 };
  /** The frame of a tool on the turret: origin at the hub, +x pointing out along the tool. */
  const onTurret = (angle: number) =>
    new THREE.Matrix4().makeTranslation(turret.x, turret.y, turret.z).multiply(new THREE.Matrix4().makeRotationZ(angle));
  /** A point `reach` out from the hub along a tool's angle. */
  const out = (angle: number, reach: number): Vec => [turret.x + Math.cos(angle) * reach, turret.y + Math.sin(angle) * reach, turret.z];
  if (look.mast) {
    slot = 'mast';
    const baseY = deckTop; // on the solar panel when there is one
    const headY = mastHeadY;
    const poleBottom = baseY + 0.1;
    const poleTop = headY - 0.15;
    // Base: a footing, the deploy hinge block (the mast folds flat for launch) and its pin.
    add(rod(0.07, 0.025, 14), dark, mx, baseY + 0.0125, mz);
    add(new RoundedBoxGeometry(0.11, 0.08, 0.11, 1, 0.01).toNonIndexed(), casing, mx, baseY + 0.065, mz);
    add(axle(0.022, 0.15, 10), dark, mx, baseY + 0.07, mz);
    // The pole, with clamp collars and a cable run up its back.
    add(rod(0.034, poleTop - poleBottom + 0.02, 10), frame, mx, (poleBottom + poleTop) / 2, mz);
    for (const f of [0.08, 0.45, 0.82]) add(rod(0.044, 0.026, 10), dark, mx, poleBottom + (poleTop - poleBottom) * f, mz);
    add(cable([[mx - 0.07, baseY + 0.02, mz + 0.04], [mx - 0.05, poleBottom + 0.04, mz], [mx - 0.05, poleTop - 0.06, mz], [mx - 0.03, poleTop + 0.03, mz]]), dark);
    // Pan unit, the tilt yoke with its axle hubs, and the head.
    add(rod(0.05, 0.06, 12), dark, mx, poleTop + 0.03, mz);
    add(box(0.07, 0.014, 0.35), frame, mx, headY - 0.083, mz);
    for (const s of [-1, 1]) {
      add(box(0.07, 0.13, 0.014), frame, mx, headY - 0.02, mz + s * 0.168);
      add(axle(0.03, 0.03, 12), dark, mx, headY, mz + s * 0.19);
    }
    add(new RoundedBoxGeometry(0.22, 0.16, 0.3, 1, 0.014).toNonIndexed(), white, mx, headY, mz);
    add(box(0.224, 0.01, 0.304), dark, mx, headY - 0.035, mz); // a seam
    add(box(0.01, 0.12, 0.26), radiator, mx - 0.115, headY, mz); // radiator plate on the back
    add(box(0.06, 0.01, 0.31), white, mx + 0.12, headY + 0.085, mz); // sunshade over the optics
    // The optics: a big round telescope aperture in the middle, twin zoom cameras below on either side,
    // and a small navigation camera pair above them.
    add(axle(0.062, 0.03, 16, true), dark, mx + 0.12, headY + 0.012, mz);
    add(axle(0.048, 0.006, 16, true), lens, mx + 0.134, headY + 0.012, mz);
    add(new THREE.TorusGeometry(0.053, 0.008, 4, 16).rotateY(Math.PI / 2), frame, mx + 0.137, headY + 0.012, mz);
    for (const s of [-1, 1]) {
      add(axle(0.028, 0.06, 12, true), dark, mx + 0.13, headY - 0.035, mz + s * 0.105);
      add(axle(0.02, 0.006, 12, true), lens, mx + 0.161, headY - 0.035, mz + s * 0.105);
      add(axle(0.016, 0.03, 10, true), dark, mx + 0.12, headY + 0.04, mz + s * 0.105);
      add(axle(0.011, 0.006, 10, true), lens, mx + 0.136, headY + 0.04, mz + s * 0.105);
    }
  }
  if (look.arm) {
    slot = 'arm';
    // Shoulder: a bolted mounting plate on the front of the deck, the azimuth joint (along x) and the
    // elevation joint.
    add(box(0.03, 0.17, 0.15), frame, l / 2 + 0.015, armY + 0.005, zs);
    const plateBolts: Vec[] = [];
    for (const y of [-1, 1]) for (const z of [-1, 1]) plateBolts.push([l / 2 + 0.031, armY + 0.005 + y * 0.065, zs + z * 0.055]);
    add(bolts(plateBolts, 'x', 0.009), dark);
    add(axle(0.05, 0.04, 12, true), dark, l / 2 + 0.05, armY, zs);
    add(rod(0.045, 0.11, 12), dark, xu, armY, zs);
    add(rod(0.05, 0.012, 12), frame, xu, armY + 0.06, zs);
    // Upper arm to the elbow (two joint hubs tied by link plates), forearm back to the wrist.
    add(axle(0.028, zs - ze, 10), frame, xu, armY, (zs + ze) / 2);
    add(axle(0.034, 0.02, 10), dark, xu, armY, zs - 0.09);
    add(rod(0.042, 0.09, 12), dark, xu, armY, ze);
    add(rod(0.036, 0.08, 12), dark, xf, armY, ze);
    for (const s of [-1, 1]) add(box(xf - xu + 0.05, 0.012, 0.07), frame, (xu + xf) / 2, armY + s * 0.048, ze);
    add(axle(0.024, zw - 0.035 - ze, 10), frame, xf, armY, (ze + zw - 0.035) / 2);
    add(axle(0.03, 0.02, 10), dark, xf, armY, ze + 0.1);
    add(axle(0.034, 0.07, 12, true), dark, xf, armY, zw); // the wrist joint
    add(strut([xf, armY - 0.02, zw], [turret.x, turret.y + 0.04, zw], 0.022, 8), dark);
    // The turret: a hub with end caps, and its tools: a coring drill pointing down, a contact sensor
    // pointing forward (the X-ray head when it is fitted), a dust brush toward the body, and a bare
    // flange where a spectrometer can mount.
    add(axle(0.05, 0.08, 12), casing, turret.x, turret.y, turret.z);
    for (const s of [-1, 1]) add(axle(0.054, 0.012, 12), dark, turret.x, turret.y, turret.z + s * 0.042);
    add(strut(out(tool.corer, 0.045), out(tool.corer, 0.13), 0.034, 10), casing);
    add(strut(out(tool.corer, 0.13), out(tool.corer, 0.16), 0.022, 10), dark);
    add(strut(out(tool.corer, 0.16), out(tool.corer, 0.22), 0.01, 6), frame);
    if (!hasInstrument('xray')) {
      const contact = onTurret(tool.contact);
      add(new RoundedBoxGeometry(0.08, 0.06, 0.06, 1, 0.008).toNonIndexed().translate(0.09, 0, 0).applyMatrix4(contact), casing);
      add(axle(0.026, 0.014, 10, true).translate(0.137, 0, 0).applyMatrix4(contact), dark);
      add(axle(0.018, 0.004, 10, true).translate(0.145, 0, 0).applyMatrix4(contact), lens);
    }
    add(strut(out(tool.brush, 0.045), out(tool.brush, 0.1), 0.02, 8), dark);
    add(strut(out(tool.brush, 0.1), out(tool.brush, 0.125), 0.032, 10), frame);
    add(strut(out(tool.organics, 0.045), out(tool.organics, 0.065), 0.032, 10), dark);
    // Cables along the top of the arm, from the shoulder over the elbow to the wrist.
    add(cable([[l / 2 + 0.032, armY + 0.07, zs - 0.05], [xu - 0.01, armY + 0.045, zs - 0.1], [xu, armY + 0.04, ze + 0.1],
      [(xu + xf) / 2, armY + 0.072, ze + 0.02], [xf, armY + 0.04, ze + 0.1], [xf, armY + 0.038, zw - 0.07]], 0.007), dark);
  }
  if (look.arm && hasInstrument('xray')) {
    // The X-ray head on the turret, as at the back without the arm: a mounting flange, the head under
    // gold blanket, its contact ring and the casing ring at the tip. Its cable runs over the hub, on the
    // side away from the organics head's, into the wrist.
    slot = 'xray';
    const place = onTurret(tool.xray);
    add(axle(0.03, 0.03, 12, true).translate(0.06, 0, 0).applyMatrix4(place), dark);
    add(axle(0.055, 0.08, 16, true).translate(0.115, 0, 0).applyMatrix4(place), foil);
    add(axle(0.04, 0.02, 16, true).translate(0.165, 0, 0).applyMatrix4(place), dark);
    add(axle(0.032, 0.008, 16, true).translate(0.179, 0, 0).applyMatrix4(place), casing);
    const from = new THREE.Vector3(0.1, 0.045, 0.04).applyMatrix4(place).toArray();
    add(cable([from, [turret.x - 0.005, turret.y + 0.075, turret.z + 0.06], [xf + 0.01, armY - 0.01, zw + 0.045], [xf - 0.02, armY, zw + 0.03]], 0.006), dark);
  }

  // Mars instruments: a weather mast on the back right of the deck, the radar's flat antenna under the
  // rear, the laser telescope on top of the mast head (or on the deck before a mast is chosen), and the
  // organics spectrometer's sensor head on the arm's turret (or in a small housing low on the front).
  if (hasInstrument('weather')) {
    slot = 'weather';
    const wx = -l * 0.12;
    const wz = w * 0.34;
    const height = 0.6;
    const topY = deckTop + height;
    add(rod(0.04, 0.025, 12), dark, wx, deckTop + 0.0125, wz);
    add(rod(0.016, height, 8), frame, wx, deckTop + height / 2, wz);
    add(rod(0.022, 0.03, 8), dark, wx, deckTop + 0.2, wz);
    // Two booms at different heights, angled apart, each with a wind sensor (a cylinder with three fins)
    // and an air temperature needle.
    for (const [i, a] of [[0, 0.7], [1, Math.PI - 0.7]] as const) {
      const by = topY - 0.12 - i * 0.07;
      const ex = wx + Math.cos(a) * 0.2;
      const ez = wz + Math.sin(a) * 0.2;
      add(rod(0.024, 0.04, 8), dark, wx, by, wz);
      add(strut([wx, by, wz], [ex, by, ez], 0.009), frame);
      add(rod(0.016, 0.08, 8), casing, ex, by, ez);
      for (let k = 0; k < 3; k++) {
        const fa = a + (k * Math.PI * 2) / 3;
        const fin = add(box(0.036, 0.06, 0.004), white, ex + Math.cos(fa) * 0.034, by, ez + Math.sin(fa) * 0.034);
        fin.rotation.y = -fa;
      }
      add(strut([ex, by - 0.04, ez], [ex + Math.cos(a) * 0.05, by - 0.065, ez + Math.sin(a) * 0.05], 0.004, 4), dark);
    }
    // A sky-facing dust and radiation sensor on top: a disk with a window and a ring of small eyes.
    add(rod(0.04, 0.014, 12), casing, wx, topY + 0.007, wz);
    add(rod(0.026, 0.004, 12), lens, wx, topY + 0.016, wz);
    const eyes: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      eyes.push(rod(0.005, 0.004, 6).translate(Math.cos(a) * 0.033, 0, Math.sin(a) * 0.033));
    }
    add(mergeAll(eyes), lens, wx, topY + 0.015, wz);
    add(cable([[wx - 0.025, topY - 0.2, wz], [wx - 0.025, deckTop + 0.15, wz], [wx - 0.05, deckTop + 0.02, wz - 0.04], [wx - 0.1, deckTop + 0.005, wz - 0.08]], 0.006), dark);
  }
  if (hasInstrument('radar')) {
    slot = 'radar';
    // A flat antenna panel under the rear, tilted to face down and back, with a framed face of bow-tie
    // elements in four bays, hung from the deck on struts, and its electronics box and cable.
    const pw = 0.34;
    const pd = 0.46;
    const pt = 0.024;
    const place = new THREE.Matrix4().makeTranslation(-l * 0.28, -top - 0.05, 0).multiply(new THREE.Matrix4().makeRotationZ(-0.2));
    const at = (x: number, y: number, z: number): Vec => new THREE.Vector3(x, y, z).applyMatrix4(place).toArray();
    const face = mat('radarFace', () => {
      const map = radarTexture();
      return { color: map ? 0xffffff : COLORS.radar, map };
    });
    add(box(pw, pt, pd).applyMatrix4(place), dark);
    add(new THREE.PlaneGeometry(pw - 0.032, pd - 0.032).rotateX(Math.PI / 2).translate(0, -pt / 2 - 0.001, 0).applyMatrix4(place), face);
    const rim: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      rim.push(box(pw, 0.012, 0.016).translate(0, -pt / 2 - 0.006, s * (pd / 2 - 0.008)));
      rim.push(box(0.016, 0.012, pd - 0.032).translate(s * (pw / 2 - 0.008), -pt / 2 - 0.006, 0));
    }
    for (const k of [-1, 0, 1]) rim.push(box(0.008, 0.008, pd - 0.032).translate((k * (pw - 0.032)) / 4, -pt / 2 - 0.004, 0));
    add(mergeAll(rim).applyMatrix4(place), frame);
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const foot: Vec = [-l * 0.28 + x * 0.12, deckBottom, z * 0.17];
      add(strut(at(x * 0.12, pt / 2, z * 0.17), foot, 0.012), frame);
      add(box(0.05, 0.01, 0.05), dark, foot[0], deckBottom - 0.005, foot[2]);
    }
    add(new RoundedBoxGeometry(0.12, 0.04, 0.14, 1, 0.008).toNonIndexed().translate(0.02, pt / 2 + 0.02, 0).applyMatrix4(place), casing);
    add(cable([at(-0.04, pt / 2 + 0.025, 0.06), [-l * 0.28 - 0.1, deckBottom - 0.02, 0.12], [-l * 0.28 - 0.04, deckBottom - 0.004, 0.2]], 0.007), dark);
  }
  if (hasInstrument('laser')) {
    slot = 'laser';
    // A telescope unit in its own right, so it reads as an add-on to the mast head: a tube in two cradles
    // on a bolted saddle plate, a lens ring in the front bezel under a three-sided sunshade, and the laser's
    // electronics box (under gold blanket) behind, with its cable. On the deck it stands on a pedestal.
    const x = mx + 0.01;
    const z = mz;
    if (!look.mast) add(rod(0.05, 0.05, 12), dark, x - 0.05, deckTop + 0.025, z);
    const baseY = look.mast ? mastHeadY + 0.08 : deckTop + 0.05;
    const cy = baseY + 0.085; // the tube's axis
    add(box(0.26, 0.02, 0.12), dark, x - 0.05, baseY + 0.01, z);
    add(bolts([[x - 0.16, baseY + 0.02, z - 0.045], [x - 0.16, baseY + 0.02, z + 0.045], [x + 0.06, baseY + 0.02, z - 0.045], [x + 0.06, baseY + 0.02, z + 0.045]], 'y', 0.008), frame);
    for (const cx of [x - 0.04, x + 0.05]) add(box(0.03, 0.03, 0.1), frame, cx, baseY + 0.035, z);
    add(axle(0.05, 0.2, 14, true), casing, x - 0.02, cy, z);
    add(axle(0.056, 0.02, 14, true), dark, x + 0.09, cy, z);
    add(axle(0.04, 0.006, 14, true), lens, x + 0.098, cy, z);
    add(new THREE.TorusGeometry(0.044, 0.007, 4, 14).rotateY(Math.PI / 2), frame, x + 0.101, cy, z);
    add(box(0.07, 0.008, 0.132), dark, x + 0.13, cy + 0.062, z);
    for (const s of [-1, 1]) add(box(0.07, 0.07, 0.008), dark, x + 0.13, cy + 0.025, z + s * 0.062);
    add(new RoundedBoxGeometry(0.1, 0.12, 0.11, 1, 0.01).toNonIndexed(), foil, x - 0.15, baseY + 0.08, z);
    add(cable([[x - 0.2, baseY + 0.05, z + 0.03], [x - 0.215, baseY, z + 0.05], [x - 0.128, baseY - 0.06, z + 0.07]], 0.007), dark);
  }
  if (hasInstrument('organics')) {
    slot = 'organics';
    /** The sensor head along +x of `place`: a gold-blanketed body on a flange, a lens barrel with a contact ring, and a small context camera on top. */
    const head = (place: THREE.Matrix4) => {
      add(axle(0.03, 0.012, 10, true).translate(0.066, 0, 0).applyMatrix4(place), dark);
      add(new RoundedBoxGeometry(0.1, 0.07, 0.075, 1, 0.01).toNonIndexed().translate(0.12, 0, 0).applyMatrix4(place), foil);
      add(axle(0.026, 0.03, 12, true).translate(0.185, 0, 0).applyMatrix4(place), dark);
      add(axle(0.018, 0.006, 12, true).translate(0.2, 0, 0).applyMatrix4(place), lens);
      add(new THREE.TorusGeometry(0.028, 0.005, 4, 12).rotateY(Math.PI / 2).translate(0.202, 0, 0).applyMatrix4(place), frame);
      add(box(0.05, 0.02, 0.03).translate(0.12, 0.045, 0).applyMatrix4(place), casing);
      add(axle(0.008, 0.006, 8, true).translate(0.147, 0.045, 0).applyMatrix4(place), lens);
    };
    if (look.arm) {
      const place = onTurret(tool.organics);
      head(place);
      const from = new THREE.Vector3(0.09, 0.035, -0.03).applyMatrix4(place).toArray();
      add(cable([from, [turret.x + 0.03, turret.y + 0.05, turret.z - 0.06], [xf, armY - 0.03, zw - 0.1], [xf, armY - 0.03, zw - 0.18]], 0.006), dark);
    } else {
      // A small housing under the front edge of the deck, the head looking out of it, forward and down.
      const hx = l / 2 - 0.035;
      const hz = w * 0.3;
      add(box(0.11, 0.012, 0.12), dark, hx, deckBottom - 0.006, hz);
      add(new RoundedBoxGeometry(0.08, 0.09, 0.1, 1, 0.01).toNonIndexed(), casing, hx, deckBottom - 0.057, hz);
      head(new THREE.Matrix4().makeTranslation(hx - 0.04, deckBottom - 0.06, hz).multiply(new THREE.Matrix4().makeRotationZ(-0.6)));
      add(cable([[hx - 0.03, deckBottom - 0.03, hz + 0.05], [hx - 0.06, deckBottom - 0.015, hz + 0.08], [hx - 0.1, deckBottom - 0.004, hz + 0.1]], 0.006), dark);
    }
  }

  // On the deck, until set down on the ground: the seismometer station and the laser retroreflector,
  // each held in a small cradle.
  if (hasInstrument('seismometer')) {
    slot = 'seismometer';
    const g = seismometerGeometry(false);
    const sx = l * 0.14;
    const sz = -w * 0.22;
    add(rod(0.165, 0.012, 20), dark, sx, deckTop - 0.004, sz);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
      add(box(0.03, 0.05, 0.03), dark, sx + Math.cos(a) * 0.16, deckTop + 0.02, sz + Math.sin(a) * 0.16);
    }
    add(g.metal, casing, sx, deckTop, sz);
    add(g.foil, foil, sx, deckTop, sz);
  }
  if (hasInstrument('reflector')) {
    slot = 'reflector';
    const g = reflectorGeometry(0.95);
    const rx = -l * 0.02;
    const rz = w * 0.27;
    add(box(0.2, 0.012, 0.24), dark, rx - 0.05, deckTop - 0.004, rz);
    add(g.stand, dark, rx, deckTop, rz);
    add(g.frame, white, rx, deckTop, rz);
    add(g.cells, lens, rx, deckTop, rz);
  }

  // Wheels with their suspension: each wheel is merged into a few meshes per material, for the
  // rolling part (`spin`) and the part that follows suspension and steering (`wheel`).
  const wheels: RoverModel['wheels'] = [];
  const rig = rigOn ? rigAnchors : undefined;
  if (!look.wheels) return { ...mergeByMaterial(body, options.bySlot ?? false, rig), wheels };
  slot = 'wheels';
  const mesh = look.wheels === 'mesh';
  const wheelW = 0.22;
  const grouser = look.wheels === 'grouser'; // Mars: more and taller grousers, a lighter drum
  const tireMat = mesh
    ? mat('tireMesh', () => ({ color: COLORS.wheelMesh, map: meshTexture(), alphaTest: 0.4, side: THREE.DoubleSide }))
    : grouser
      ? textured('tireGrouser', COLORS.grouser, () => brushedTexture(13, [6, 1]), { side: THREE.DoubleSide })
      : textured('tireSolid', COLORS.wheelSolid, () => brushedTexture(13, [6, 1]), { side: THREE.DoubleSide });
  const rimMat = mat('cleat', () => ({ color: mesh ? COLORS.chevron : COLORS.solidRim }));
  const fender = mat('fender', () => ({ color: COLORS.fender, side: THREE.DoubleSide }));
  const zSigns = [1, -1, 1, -1]; // wheel order in vehicle.ts: front right, front left, rear right, rear left (+z is right)
  const restY = connectY - handling.suspension.restLengthM; // wheel center, in the body frame, at rest
  const damperTop = deckBottom + 0.005 - restY; // the damper reaches up into its mount under the deck
  for (let i = 0; i < 4; i++) {
    const zs = zSigns[i]!;
    const wheel = new THREE.Object3D();
    wheel.position.y = restY;
    const spin = new THREE.Object3D();
    if (mesh) {
      // Apollo-style wire-mesh tire with titanium chevrons, rim hoops, and a spun-metal hub disc.
      add(new THREE.CylinderGeometry(r, r, wheelW, 32, 1, true).rotateX(Math.PI / 2), tireMat, 0, 0, 0, spin);
      const cleats: THREE.BufferGeometry[] = [];
      const count = 18;
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        for (const s of [-1, 1]) {
          const g = new THREE.BoxGeometry(0.03, 0.01, wheelW * 0.52);
          g.rotateY(s * 0.6);
          g.translate(s * 0.012, r + 0.004, s * wheelW * 0.23);
          g.rotateZ(a);
          cleats.push(g);
        }
      }
      for (const s of [-1, 1]) {
        cleats.push(new THREE.TorusGeometry(r - 0.004, 0.011, 3, 28).translate(0, 0, s * wheelW / 2));
        const disc = new THREE.CylinderGeometry(0.075, 0.16, 0.03, 20, 1, true).rotateX(s * Math.PI / 2);
        cleats.push(disc.translate(0, 0, s * (wheelW / 2 - 0.06)));
      }
      add(mergeAll(cleats), rimMat, 0, 0, 0, spin);
    } else {
      // A rigid metal wheel: a drum with grousers (taller and more of them on the grouser wheels), closed
      // faces with raised ribs, and rim lips.
      add(new THREE.CylinderGeometry(r - 0.012, r - 0.012, wheelW, 32, 1, true).rotateX(Math.PI / 2), tireMat, 0, 0, 0, spin);
      const faces: THREE.BufferGeometry[] = [];
      for (const s of [-1, 1]) {
        const face = new THREE.CircleGeometry(r - 0.014, 32);
        if (s < 0) face.rotateY(Math.PI);
        faces.push(face.translate(0, 0, s * (wheelW / 2 - 0.02)));
      }
      add(mergeAll(faces), tireMat, 0, 0, 0, spin);
      const metal: THREE.BufferGeometry[] = [];
      const count = grouser ? 24 : 20;
      for (let k = 0; k < count; k++) {
        const g = new THREE.BoxGeometry(0.022, grouser ? 0.05 : 0.024, wheelW * 0.98);
        if (!grouser) g.rotateY(0.18 * (k % 2 ? 1 : -1));
        g.translate(0, grouser ? r + 0.01 : r - 0.002, 0);
        g.rotateZ((k / count) * Math.PI * 2);
        metal.push(g);
      }
      for (const s of [-1, 1]) {
        metal.push(new THREE.TorusGeometry(r - 0.012, 0.013, 3, 28).translate(0, 0, s * wheelW / 2));
        for (let k = 0; k < 6; k++) {
          const rib = new THREE.BoxGeometry(0.03, r - 0.1, 0.02);
          rib.translate(0, 0.06 + (r - 0.1) / 2, s * (wheelW / 2 - 0.012));
          metal.push(rib.rotateZ((k / 6) * Math.PI * 2 + 0.3));
        }
      }
      add(mergeAll(metal), rimMat, 0, 0, 0, spin);
    }
    const hubParts = [axle(0.06, wheelW + 0.03, 14)];
    const boltCircle: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      boltCircle.push(axle(0.01, wheelW + 0.036, 6).translate(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0));
    }
    add(mergeAll([...hubParts, ...boltCircle]), dark, 0, 0, 0, spin);
    wheel.add(spin);
    mergeChildren(spin);
    // Between the wheel and the body: the drive motor, a knuckle, and a coil-over damper that reaches up
    // into its mount; a fender over the outer part of the tire on two brackets.
    const zi = -zs * (wheelW / 2 + 0.05); // inner side
    add(axle(0.085, 0.07, 16), dark, 0, 0, -zs * (wheelW / 2 + 0.04), wheel);
    add(axle(0.05, 0.03, 12), frame, 0, 0, -zs * (wheelW / 2 + 0.09), wheel);
    add(box(0.07, 0.07, 0.05), dark, 0, 0.09, zi, wheel);
    add(rod(0.014, 0.12, 8), frame, 0, 0.17, zi, wheel);
    const upper = damperTop - 0.2;
    add(rod(0.03, upper, 10), dark, 0, 0.2 + upper / 2, zi, wheel);
    const coil: THREE.Vector3[] = [];
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2 * 6;
      coil.push(new THREE.Vector3(Math.cos(a) * 0.042, 0.13 + (k / 64) * (damperTop - 0.18), Math.sin(a) * 0.042));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 54, 0.006, 3).translate(0, 0, zi), frame, 0, 0, 0, wheel);
    const fenderR = r + 0.04;
    const reach = 1.0;
    const fenderZ = zs * 0.02;
    add(new THREE.CylinderGeometry(fenderR, fenderR, wheelW - 0.02, 14, 1, true, Math.PI - reach, reach * 2).rotateX(Math.PI / 2), fender, 0, 0, fenderZ, wheel);
    const brackets: THREE.BufferGeometry[] = [];
    const fenderInner = fenderZ - zs * (wheelW / 2 - 0.01);
    for (const s of [-1, 1]) {
      const ex = s * Math.sin(reach - 0.12) * fenderR;
      const ey = Math.cos(reach - 0.12) * fenderR;
      brackets.push(strut([0, 0.05, zi], [ex, ey, zi], 0.01));
      brackets.push(strut([ex, ey, zi], [ex, ey, fenderInner], 0.01));
    }
    add(mergeAll(brackets), frame, 0, 0, 0, wheel);
    mergeChildren(wheel, spin);
    wheels.push({ wheel, spin });
  }
  return { ...mergeByMaterial(body, options.bySlot ?? false, rig), wheels };
}

/** Replace the meshes among `parent`'s children (except `keep`) with one mesh per material. */
function mergeChildren(parent: THREE.Object3D, keep?: THREE.Object3D): void {
  const meshes = parent.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c !== keep);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const mesh of meshes) {
    mesh.updateMatrix();
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    mesh.geometry.dispose();
    const material = mesh.material as THREE.Material;
    byMaterial.set(material, [...(byMaterial.get(material) ?? []), g]);
    mesh.removeFromParent();
  }
  for (const [material, geometries] of byMaterial) {
    const merged = new THREE.Mesh(mergeAll(geometries), material);
    merged.castShadow = !material.userData.noShadow;
    parent.add(merged);
  }
}

/**
 * One mesh per material for the static parts: a few draw calls instead of dozens (twice, with the
 * shadow pass). With `bySlot`, one mesh per material within each slot's own group.
 */
function mergeByMaterial(
  group: THREE.Group,
  bySlot: boolean,
  rigAnchors?: Partial<Record<RigPart, THREE.Vector3>>,
): Pick<RoverModel, 'body' | 'slots' | 'rig'> {
  const byKey = new Map<string, { slot: ModelGroup; material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  const rigParts = new Map<RigPart, Map<THREE.Material, THREE.BufferGeometry[]>>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.updateMatrix();
    const g = (child.geometry as THREE.BufferGeometry).clone().applyMatrix4(child.matrix);
    child.geometry.dispose();
    const material = child.material as THREE.Material;
    const part = child.userData.rig as RigPart | undefined;
    if (rigAnchors && part) {
      const byMat = rigParts.get(part) ?? new Map<THREE.Material, THREE.BufferGeometry[]>();
      byMat.set(material, [...(byMat.get(material) ?? []), g]);
      rigParts.set(part, byMat);
      continue;
    }
    const slot = child.userData.slot as ModelGroup;
    const key = bySlot ? `${slot}:${material.uuid}` : material.uuid;
    const entry = byKey.get(key) ?? { slot, material, geometries: [] };
    entry.geometries.push(g);
    byKey.set(key, entry);
  }
  const merged = new THREE.Group();
  const slots: RoverModel['slots'] = {};
  for (const { slot, material, geometries } of byKey.values()) {
    const mesh = new THREE.Mesh(mergeAll(geometries), material);
    mesh.castShadow = !material.userData.noShadow;
    let parent: THREE.Group = merged;
    if (bySlot) {
      let own = slots[slot];
      if (!own) {
        own = slots[slot] = new THREE.Group();
        own.name = slot;
        merged.add(own);
      }
      parent = own;
    }
    parent.add(mesh);
  }
  if (!rigAnchors) return { body: merged, slots };
  // Each moving part: a pivot at its joint (relative to its parent's joint), holding its meshes in the chassis frame.
  const parentOf: Record<RigPart, RigPart | null> = { solarPanel: null, cameraMast: null, cameraPan: 'cameraMast', cameraTilt: 'cameraPan' };
  const rig: RoverRig = {};
  for (const part of ['solarPanel', 'cameraMast', 'cameraPan', 'cameraTilt'] as const) {
    const byMat = rigParts.get(part);
    const anchor = rigAnchors[part];
    if (!byMat || !anchor) continue;
    const up = parentOf[part];
    const parentPivot = up ? rig[up] : undefined;
    const pivot = new THREE.Object3D();
    pivot.name = `rig:${part}`;
    pivot.position.copy(anchor);
    if (up && parentPivot) pivot.position.sub(rigAnchors[up]!);
    const holder = new THREE.Group();
    holder.position.copy(anchor).negate();
    for (const [material, geometries] of byMat) {
      const mesh = new THREE.Mesh(mergeAll(geometries), material);
      mesh.castShadow = !material.userData.noShadow;
      holder.add(mesh);
    }
    pivot.add(holder);
    (parentPivot ?? merged).add(pivot);
    rig[part] = pivot;
  }
  return { body: merged, slots, rig };
}
