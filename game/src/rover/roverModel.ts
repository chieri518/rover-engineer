// The rover's look, built from three.js primitives and shaped by the selected parts: a titanium or
// steel frame, solid or wire-mesh wheels, a flat solar panel or a vertical solar mast, the battery
// pack, floodlights, the heater's gold thermal blanket, and the payload bay's instruments: a camera
// mast and a regolith drill at the front, a neutron spectrometer and an X-ray spectrometer arm under
// the body, a seismometer station and a laser retroreflector carried on the deck, each in its own
// place, so any mix can be drawn. The two deployables are also drawn on the ground by world/stations.ts.
// Visual only: the physics body stays the box and four ray-cast wheels in vehicle.ts.
// A draft build (design screen preview) shows only the parts chosen so far.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BusSlot, Instrument, Part, RoverHandling } from '../rules/types';

/** How the model groups its static parts: one group per bus slot, and one per instrument in the bay. */
export type ModelGroup = BusSlot | Instrument;

/** What the model shows, read from the selected parts. `null` / `false`: nothing drawn for that slot. */
export interface RoverLook {
  frame: 'titanium' | 'steel' | null; // null: no chassis chosen (deck, frame, electronics box and antenna)
  wheels: 'solid' | 'mesh' | null; // null: no wheels, struts or drive motors
  power: 'panel' | 'mast' | null;
  battery: 'cylinders' | 'pack' | null;
  lights: boolean;
  heater: boolean;
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
    wheels: pick('wheels', (id) => (id.includes('mesh') ? 'mesh' : 'solid')),
    power: pick('power', (id) => (id.includes('mast') ? 'mast' : 'panel')),
    battery: pick('battery', (id) => (id.includes('nih2') ? 'cylinders' : 'pack')),
    lights: (bySlot('lights')?.effects.lightRange ?? 0) > 0,
    heater: (bySlot('heater')?.effects.heat ?? 0) > 0,
    instruments: parts.flatMap((p) => (p.slot === 'instrument' && p.effects.instrument ? [p.effects.instrument] : [])),
  };
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
}

export interface RoverModelOptions {
  /** Keep each slot's (and instrument's) static parts in a separate group (a few more draw calls). Default: one mesh per material. */
  bySlot?: boolean;
}

const COLORS = {
  titanium: 0xb9bdc3,
  steel: 0x6a6e74,
  steelBeam: 0x50545a,
  radiator: 0xe6e3da,
  foil: 0xc89a3c,
  cell: 0x1b2847,
  cellFrame: 0x8c9096,
  dark: 0x2f3134,
  wheelSolid: 0x8e9297,
  wheelMesh: 0xb8b09c,
  chevron: 0xc9ccd0,
  lamp: 0xfff6dc,
  drill: 0x8a8d92,
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
  const dome = new THREE.SphereGeometry(0.11, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(0, lift + 0.03, 0);
  const collar = new THREE.CylinderGeometry(0.115, 0.115, 0.02, 18);
  collar.translate(0, lift + 0.04, 0);
  const merged = mergeGeometries(metal)!;
  metal.forEach((g) => g.dispose());
  return { foil: mergeGeometries([dome, collar])!, metal: merged };
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
  const frame = place(new THREE.BoxGeometry(size, 0.02, size));
  const dots: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const d = new THREE.CylinderGeometry(0.026, 0.026, 0.006, 14);
    d.translate((i - 1.5) * 0.068, 0.012, (j - 1.5) * 0.068);
    dots.push(place(d));
  }
  const cells = mergeGeometries(dots)!;
  dots.forEach((g) => g.dispose());
  const block = new THREE.BoxGeometry(0.1, 0.06, 0.16);
  block.translate(-0.05, 0.03, 0);
  const strut = new THREE.BoxGeometry(0.03, 0.14, 0.03);
  strut.translate(-0.07, 0.07, 0);
  const stand = mergeGeometries([block, strut])!;
  block.dispose();
  strut.dispose();
  return { frame, cells, stand };
}

/** A small canvas texture, drawn once per model. */
function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat: [number, number]): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return null;
  draw(g, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  return texture;
}

/** Solar cells: dark blue squares with thin silver gaps. */
function cellTexture(repeat: [number, number]): THREE.Texture | null {
  return canvasTexture(64, (g, s) => {
    g.fillStyle = '#9aa0a8';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#1b2847';
    g.fillRect(3, 3, s - 6, s - 6);
    g.fillStyle = '#2a3a63';
    g.fillRect(3, 3, s - 6, 4);
  }, repeat);
}

/** Wire mesh: a diamond lattice of thin wires on a transparent ground (used with alphaTest). */
function meshTexture(): THREE.Texture | null {
  return canvasTexture(64, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(s, s);
    g.moveTo(s, 0);
    g.lineTo(0, s);
    g.stroke();
  }, [26, 2]);
}

export function buildRoverModel(handling: RoverHandling, connectY: number, look: RoverLook, options: RoverModelOptions = {}): RoverModel {
  const { lengthM: l, widthM: w, heightM: ht } = handling.body;
  const r = handling.wheelRadiusM;
  const body = new THREE.Group();
  const mats = new Map<string, THREE.MeshLambertMaterial>();
  const mat = (key: string, params: THREE.MeshLambertMaterialParameters) => {
    let m = mats.get(key);
    if (!m) mats.set(key, (m = new THREE.MeshLambertMaterial(params)));
    return m;
  };
  let slot: ModelGroup = 'chassis'; // the group the static parts added next belong to
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData.slot = slot;
    parent.add(mesh);
    return mesh;
  };
  const box = (sx: number, sy: number, sz: number) => new THREE.BoxGeometry(sx, sy, sz);
  const rod = (radius: number, length: number, segments = 8) => new THREE.CylinderGeometry(radius, radius, length, segments);

  const frameColor = look.frame === 'steel' ? COLORS.steel : COLORS.titanium;
  const frame = mat('frame', { color: frameColor });
  const dark = mat('dark', { color: COLORS.dark });
  const radiator = mat('radiator', { color: COLORS.radiator });
  const foil = mat('foil', { color: COLORS.foil });
  const top = ht / 2;

  // Frame: a deck plate; the steel frame adds heavy side beams and cross members.
  if (look.frame) {
    slot = 'chassis';
    add(box(l, 0.06, w), frame, 0, -top + 0.05, 0);
    if (look.frame === 'steel') {
      const beam = mat('beam', { color: COLORS.steelBeam });
      for (const z of [-1, 1]) add(box(l + 0.12, 0.12, 0.09), beam, 0, -top + 0.06, z * (w / 2 - 0.02));
      for (const x of [-1, 0, 1]) add(box(0.08, 0.1, w - 0.1), beam, x * (l / 2 - 0.12), -top + 0.04, 0);
    } else {
      for (const z of [-1, 1]) {
        const tube = add(rod(0.03, l + 0.06), frame, 0, -top + 0.09, z * (w / 2 - 0.03));
        tube.rotation.z = Math.PI / 2;
      }
    }
  }

  // Warm electronics box: white radiator panels (chassis), wrapped in gold thermal blanket when the
  // heater is fitted (the blanket and fins belong to the heater, so they show even before a chassis).
  const boxL = l * 0.74;
  const boxH = ht * 0.78;
  const boxW = w * 0.8;
  const boxY = -top + 0.08 + boxH / 2;
  slot = look.heater ? 'heater' : 'chassis';
  if (look.frame || look.heater) add(box(boxL, boxH, boxW), look.heater ? foil : radiator, -0.04, boxY, 0);
  if (look.heater) {
    // Radiator fins on the sides: the heater's warmth has to be managed too.
    for (const z of [-1, 1]) for (let k = 0; k < 4; k++) {
      add(box(0.03, boxH * 0.8, 0.05), radiator, -0.04 - boxL * 0.3 + k * boxL * 0.2, boxY, z * (boxW / 2 + 0.025));
    }
  }
  const deckY = boxY + boxH / 2; // top of the box
  const deckTop = look.power === 'panel' ? deckY + 0.07 : deckY + 0.02; // what deck-mounted instruments stand on

  // Power: a flat panel over the deck, or a vertical solar mast for a Sun on the horizon.
  const cells = (repeat: [number, number], key: string) => {
    const map = cellTexture(repeat);
    return mat(key, { color: map ? 0xffffff : COLORS.cell, map });
  };
  slot = 'power';
  if (look.power === 'panel') {
    add(box(l * 0.98, 0.025, w * 1.02), mat('cellFrame', { color: COLORS.cellFrame }), -0.02, deckY + 0.05, 0);
    add(box(l * 0.95, 0.03, w * 0.98), cells([10, 7], 'cells'), -0.02, deckY + 0.055, 0);
    for (const x of [-1, 1]) for (const z of [-1, 1]) add(rod(0.015, 0.05), frame, x * l * 0.35, deckY + 0.025, z * w * 0.35);
  } else if (look.power === 'mast') {
    const mx = -l * 0.3;
    const poleH = 0.45;
    const panelH = 1.1;
    const side = 0.42;
    add(rod(0.035, poleH + panelH), frame, mx, deckY + (poleH + panelH) / 2, 0);
    const face = cells([3, 8], 'mastCells');
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const p = add(box(side, panelH, 0.025), face, mx + Math.sin(a) * side / 2, deckY + poleH + panelH / 2, Math.cos(a) * side / 2);
      p.rotation.y = a;
    }
    add(box(side + 0.04, 0.03, side + 0.04), frame, mx, deckY + poleH + panelH + 0.015, 0);
    // A low radiator plate where the flat panel would be.
    add(box(l * 0.4, 0.02, w * 0.6), radiator, l * 0.12, deckY + 0.01, 0);
  }

  // Battery: nickel-hydrogen cells are cylindrical pressure vessels; lithium-ion is a compact pack.
  slot = 'battery';
  if (look.battery === 'cylinders') {
    const cell = mat('nih2', { color: 0xa7abb1 });
    for (let k = 0; k < 4; k++) {
      const c = add(rod(0.065, w * 0.55, 12), cell, -l / 2 + 0.02, -top + 0.17 + (k % 2) * 0.13, (k < 2 ? -1 : 1) * w * 0.17);
      c.rotation.x = Math.PI / 2;
      c.scale.y = 0.55;
    }
  } else if (look.battery === 'pack') {
    add(box(0.1, 0.16, w * 0.45), dark, -l / 2 + 0.02, -top + 0.18, 0);
  }

  // High-gain antenna at the back, for the link to Earth (part of the chassis).
  if (look.frame) {
    slot = 'chassis';
    const antX = -l * 0.36;
    const antZ = look.power === 'mast' ? -w * 0.36 : -w * 0.32;
    const antY = look.power === 'mast' ? deckY : deckY + 0.08;
    add(rod(0.02, 0.35), frame, antX, antY + 0.175, antZ);
    const dish = add(new THREE.CylinderGeometry(0.17, 0.03, 0.07, 16, 1, true), mat('dish', { color: COLORS.radiator, side: THREE.DoubleSide }), antX + 0.03, antY + 0.4, antZ);
    dish.rotation.z = -1.0;
  }

  // Floodlights: a light bar on each front corner.
  slot = 'lights';
  if (look.lights) {
    const lamp = mat('lamp', { color: COLORS.lamp, emissive: 0x9a937e });
    for (const z of [-1, 1]) {
      add(box(0.08, 0.1, 0.22), dark, l / 2 - 0.02, boxY + 0.02, z * w * 0.3);
      add(box(0.02, 0.07, 0.18), lamp, l / 2 + 0.03, boxY + 0.02, z * w * 0.3);
    }
  }

  // Instruments, each in its own place: a tall camera mast with a stereo head near the front corner,
  // and a drill tower at the front (with a short navigation camera when there is no camera mast).
  const cameraHead = (x: number, height: number, z: number) => {
    add(rod(0.03, height), frame, x, deckY + height / 2, z);
    add(box(0.16, 0.14, 0.4), dark, x, deckY + height + 0.06, z);
    for (const s of [-1, 1]) {
      const lens = add(rod(0.035, 0.06, 12), mat('lens', { color: 0x111216, emissive: 0x0a1a2a }), x + 0.1, deckY + height + 0.06, z + s * 0.12);
      lens.rotation.z = Math.PI / 2;
    }
  };
  const hasCamera = look.instruments.includes('camera');
  if (look.instruments.includes('drill')) {
    slot = 'drill';
    const drill = mat('drill', { color: COLORS.drill });
    const dx = l / 2 + 0.08;
    const rail = 1.05;
    const railY = -top + 0.15;
    add(box(0.12, rail, 0.16), drill, dx, railY + rail / 2 - 0.25, 0);
    add(box(0.2, 0.16, 0.22), foil, dx + 0.02, railY + rail - 0.2, 0);
    // The drill string reaches down to just above the ground.
    const groundY = connectY - handling.suspension.restLengthM - r;
    const stringTop = railY + rail - 0.3;
    const stringLen = stringTop - (groundY + 0.12);
    add(rod(0.022, stringLen), mat('string', { color: 0xd0d3d7 }), dx + 0.1, stringTop - stringLen / 2, 0);
    const bit = add(new THREE.ConeGeometry(0.04, 0.08, 10), dark, dx + 0.1, groundY + 0.08, 0);
    bit.rotation.z = Math.PI;
    if (!hasCamera) cameraHead(l * 0.3, 0.45, w * 0.3);
  }
  if (hasCamera) {
    slot = 'camera';
    cameraHead(l * 0.32, 1.0, w * 0.28);
  }

  // Low on the body: the neutron spectrometer, a detector block on the front face between the front
  // wheels (below the floodlights, beside the drill), and the X-ray spectrometer on the back, its
  // sensor head on a short arm lowered toward the ground under the rear of the body.
  const hasInstrument = (i: Instrument) => look.instruments.includes(i);
  const casing = mat('casing', { color: 0xb4b8be });
  if (hasInstrument('neutron')) {
    slot = 'neutron';
    const nx = l * 0.42;
    add(box(0.2, 0.1, 0.34), casing, nx, 0.0, 0);
    for (const z of [-1, 1]) {
      const tube = add(rod(0.028, 0.14, 12), dark, nx + 0.11, 0.0, z * 0.09);
      tube.rotation.x = Math.PI / 2;
    }
    add(box(0.05, 0.04, 0.3), frame, nx - 0.1, -0.06, 0);
  }
  if (hasInstrument('xray')) {
    slot = 'xray';
    const ax = -l * 0.43;
    add(box(0.14, 0.1, 0.16), casing, ax, -0.28, 0);
    const arm = add(rod(0.016, 0.26), frame, ax + 0.05, -0.4, 0);
    arm.rotation.z = -0.38;
    add(rod(0.05, 0.07, 14), dark, ax + 0.1, -0.52, 0);
    add(rod(0.032, 0.012, 14), mat('apxs', { color: 0xc9ccd0 }), ax + 0.1, -0.563, 0);
  }

  // On the deck, until set down on the ground: the seismometer station and the laser retroreflector.
  if (hasInstrument('seismometer')) {
    slot = 'seismometer';
    const g = seismometerGeometry(false);
    add(g.metal, casing, l * 0.14, deckTop, -w * 0.22);
    add(g.foil, foil, l * 0.14, deckTop, -w * 0.22);
  }
  if (hasInstrument('reflector')) {
    slot = 'reflector';
    const g = reflectorGeometry(0.95);
    add(g.stand, dark, -l * 0.02, deckTop, w * 0.27);
    add(g.frame, radiator, -l * 0.02, deckTop, w * 0.27);
    add(g.cells, dark, -l * 0.02, deckTop, w * 0.27);
  }

  // Wheels with their suspension struts.
  const wheels: RoverModel['wheels'] = [];
  if (!look.wheels) return { ...mergeByMaterial(body, options.bySlot ?? false), wheels };
  slot = 'wheels';
  const wheelW = 0.22;
  const tireMat = look.wheels === 'mesh'
    ? mat('tireMesh', { color: COLORS.wheelMesh, map: meshTexture(), alphaTest: 0.4, side: THREE.DoubleSide })
    : mat('tireSolid', { color: COLORS.wheelSolid });
  const tire = new THREE.CylinderGeometry(r, r, wheelW, 28, 1, look.wheels === 'mesh');
  tire.rotateX(Math.PI / 2);
  // Grousers (solid wheels) or chevrons (mesh wheels, as on the Apollo rover): one merged geometry.
  const cleats: THREE.BufferGeometry[] = [];
  const count = look.wheels === 'mesh' ? 16 : 14;
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    if (look.wheels === 'mesh') {
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.035, 0.012, wheelW * 0.55);
        g.rotateY(s * 0.6);
        g.translate(s * 0.012, r + 0.004, s * wheelW * 0.22);
        g.rotateZ(a);
        cleats.push(g);
      }
    } else {
      const g = new THREE.BoxGeometry(0.03, 0.025, wheelW);
      g.translate(0, r + 0.008, 0);
      g.rotateZ(a);
      cleats.push(g);
    }
  }
  const cleatGeometry = mergeGeometries(cleats);
  cleats.forEach((g) => g.dispose());
  const cleatMat = mat('cleat', { color: look.wheels === 'mesh' ? COLORS.chevron : 0x7d8186 });
  const hub = new THREE.CylinderGeometry(r * 0.55, r * 0.55, wheelW * 0.9, 16);
  hub.rotateX(Math.PI / 2);
  const hubCap = new THREE.CylinderGeometry(r * 0.22, r * 0.22, wheelW + 0.04, 12);
  hubCap.rotateX(Math.PI / 2);
  const strutLen = handling.suspension.restLengthM + 0.12;
  const strut = rod(0.028, strutLen);
  const zSigns = [1, -1, 1, -1]; // wheel order in vehicle.ts: front right, front left, rear right, rear left (+z is right)
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Object3D();
    wheel.position.y = connectY - handling.suspension.restLengthM;
    const spin = new THREE.Object3D();
    add(tire, tireMat, 0, 0, 0, spin);
    add(cleatGeometry, cleatMat, 0, 0, 0, spin);
    add(hub, look.wheels === 'mesh' ? frame : mat('hub', { color: 0x83878c }), 0, 0, 0, spin);
    add(hubCap, dark, 0, 0, 0, spin);
    wheel.add(spin);
    // The strut and drive motor stay upright with the wheel's steering, between the wheel and the body.
    const inner = -zSigns[i]! * (wheelW / 2 + 0.05);
    add(strut, frame, 0, strutLen / 2, inner, wheel);
    add(box(0.12, 0.12, 0.08), dark, 0, 0, inner, wheel);
    wheels.push({ wheel, spin });
  }
  return { ...mergeByMaterial(body, options.bySlot ?? false), wheels };
}

/**
 * One mesh per material for the static parts: a few draw calls instead of dozens (twice, with the
 * shadow pass). With `bySlot`, one mesh per material within each slot's own group.
 */
function mergeByMaterial(group: THREE.Group, bySlot: boolean): Pick<RoverModel, 'body' | 'slots'> {
  const byKey = new Map<string, { slot: ModelGroup; material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.updateMatrix();
    const g = (child.geometry as THREE.BufferGeometry).clone().applyMatrix4(child.matrix);
    child.geometry.dispose();
    const material = child.material as THREE.Material;
    const slot = child.userData.slot as ModelGroup;
    const key = bySlot ? `${slot}:${material.uuid}` : material.uuid;
    const entry = byKey.get(key) ?? { slot, material, geometries: [] };
    entry.geometries.push(g);
    byKey.set(key, entry);
  }
  const merged = new THREE.Group();
  const slots: RoverModel['slots'] = {};
  for (const { slot, material, geometries } of byKey.values()) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
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
  return { body: merged, slots };
}
