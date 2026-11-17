// The hero rover's cinematic look, for any model buildRoverModel makes: the game's own RoverVehicle
// (`world.offline.rover.object`) or a rigged instance (heroRig.ts). Swaps the game's Lambert materials for
// physically based ones with procedural detail (crinkled gold foil, painted and brushed metal, glass-covered
// solar cells, a glass camera eye), keeps the Sun masked by terrain shadows as in the game, and adds
// emissive status LEDs with a little glow light, and handles for the floodlight lenses and the camera eye.
//
//   const dress = dressRover(world.offline.rover.object, { handling: data.tuning.rover, offline: world.offline, envMap });
//   dress.setLeds(1); dress.setLamps(1); dress.setIndirect(1);
import * as THREE from 'three';
import type { RoverHandling } from '../../../src/rules/types';
import type { MoonOfflineScene } from '../../../src/world/moonScene';
import { cinePatch, moonUniforms } from './lighting';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { brushedNormal, foilMaps, fbm, greyTexture, normalFromHeight } from './textures';

export interface DressOptions {
  /** The rover's handling (data.tuning.rover): body size, for placing the LEDs. */
  handling: RoverHandling;
  /** The world it is drawn in: the Sun is masked by its terrain shadows. Omit outside a world. */
  offline?: MoonOfflineScene;
  /** Reflections (rig/env.ts lunarEnvironment). */
  envMap?: THREE.Texture | null;
  /** Add small point lights for the LED glow and the camera eye (default true). Off: emissive only. */
  glowLights?: boolean;
}

export interface RoverDress {
  /** Status LEDs, left to right as seen from the front. */
  readonly leds: readonly { mesh: THREE.Mesh; color: THREE.Color }[];
  /** Brightness of one status LED, 0 (off) .. 1 (on). */
  setLed(index: number, k: number): void;
  /** All status LEDs at once. */
  setLeds(k: number): void;
  /** The camera head's lenses ("eye"), 0 (dark glass) .. 1 (lit). Only on a rigged model (material 'eye'). */
  setEye(k: number): void;
  /** Floodlight lenses' glow, 0 .. 1 (the game's floodlight beam itself is MoonOfflineScene.setLamp). */
  setLamps(k: number): void;
  /** Share of indirect light (ambient fill and reflections): 1 outdoors, ~0.05 inside a dark bay. */
  setIndirect(k: number): void;
  /** The glow lights (parented to the model), if any: the LED cluster's and the eye's. */
  readonly lights: { leds: THREE.PointLight | null; eye: THREE.PointLight | null };
  /** The new materials by the game's material name ('frame', 'foil', 'cells', 'eye', ...). */
  readonly materials: ReadonlyMap<string, THREE.MeshStandardMaterial>;
  dispose(): void;
}

export const LED_COLORS: [number, number, number][] = [
  [1.0, 0.42, 0.06], // amber: power
  [0.18, 1.0, 0.32], // green: systems
  [0.1, 0.75, 1.0], // cyan: comms
  [0.55, 0.65, 1.0], // blue-white: ready
];
const EYE_COLOR = new THREE.Color(0.35, 0.85, 1.0);
const LED_EMISSIVE = 28; // HDR: well above the bloom threshold
const EYE_EMISSIVE = 7;
const LAMP_EMISSIVE = 14;

type Params = THREE.MeshPhysicalMaterialParameters;

/** Shared detail textures (made once per page). */
let detail: { foil: { normal: THREE.Texture; facets: THREE.Texture }; brushed: THREE.Texture; paint: THREE.Texture; grain: THREE.Texture } | null = null;
function detailMaps() {
  if (detail) return detail;
  const paintH = fbm(256, 32, 4, 41);
  detail = {
    foil: foilMaps(7, 512, [2, 1]),
    brushed: brushedNormal(5, 256, [2, 2]),
    paint: normalFromHeight(paintH, 256, 3, [2, 2]),
    grain: greyTexture(fbm(256, 16, 4, 77).map((v) => 0.75 + v * 0.5), 256, [3, 3]),
  };
  return detail;
}

/** How each of the game's rover materials looks in the film (by its name in roverModel.ts). */
function upgrade(name: string, src: THREE.MeshLambertMaterial): { params: Params; physical?: boolean } | null {
  const d = detailMaps();
  const base: Params = {
    color: src.color.clone(),
    map: src.map,
    side: src.side,
    alphaTest: src.alphaTest,
    transparent: src.transparent,
    polygonOffset: src.polygonOffset,
    polygonOffsetFactor: src.polygonOffsetFactor,
  };
  switch (name) {
    case 'frame':
    case 'beam':
      // Painted steel (dark grey) or brushed titanium.
      return { params: { ...base, roughness: 0.48, metalness: src.color.r > 0.4 ? 0.8 : 0.15, normalMap: d.paint, normalScale: new THREE.Vector2(0.25, 0.25), roughnessMap: d.grain } };
    case 'dark':
      return { params: { ...base, roughness: 0.55, metalness: 0.25, roughnessMap: d.grain } };
    case 'radiator':
      // Optical solar reflector tiles: a glassy, near-mirror white.
      return { params: { ...base, roughness: 0.16, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.08 }, physical: true };
    case 'white':
      return { params: { ...base, roughness: 0.5, metalness: 0.0, normalMap: d.paint, normalScale: new THREE.Vector2(0.15, 0.15) } };
    case 'foil':
      // Gold MLI: metallic, crinkled into facets.
      return {
        params: {
          ...base,
          map: null,
          color: new THREE.Color(0.92, 0.5, 0.11),
          roughness: 0.5,
          roughnessMap: d.foil.facets,
          metalness: 0.5,
          normalMap: d.foil.normal,
          normalScale: new THREE.Vector2(0.55, 0.55),
        },
      };
    case 'casing':
      return { params: { ...base, roughness: 0.34, metalness: 0.85, normalMap: d.brushed, normalScale: new THREE.Vector2(0.2, 0.2) } };
    case 'lens':
    case 'eye':
      return { params: { ...base, color: new THREE.Color(0.02, 0.025, 0.03), roughness: 0.04, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: EYE_COLOR, emissiveIntensity: 0 }, physical: true };
    case 'marking':
      return { params: { ...base, roughness: 0.6, metalness: 0 } };
    case 'cells':
    case 'mastCells':
      // Cells under cover glass: dark blue, a glassy clearcoat that catches the low Sun.
      return { params: { ...base, roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 }, physical: true };
    case 'string':
      return { params: { ...base, roughness: 0.3, metalness: 0.9 } };
    case 'lamp':
      return { params: { ...base, color: new THREE.Color(0.9, 0.88, 0.82), roughness: 0.1, metalness: 0, emissive: new THREE.Color(1, 0.93, 0.8), emissiveIntensity: 0, clearcoat: 1, clearcoatRoughness: 0.05 }, physical: true };
    case 'tireMesh':
      return { params: { ...base, roughness: 0.42, metalness: 0.75 } };
    case 'tireSolid':
    case 'cleat':
      return { params: { ...base, roughness: 0.36, metalness: 0.85, normalMap: d.brushed, normalScale: new THREE.Vector2(0.15, 0.15) } };
    case 'fender':
      return { params: { ...base, roughness: 0.45, metalness: 0.6, normalMap: d.paint, normalScale: new THREE.Vector2(0.2, 0.2) } };
    default:
      return null;
  }
}

export function dressRover(model: THREE.Object3D, opts: DressOptions): RoverDress {
  const moon = opts.offline ? moonUniforms(opts.offline) : undefined;
  const indirect = { value: 1 };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const replaced = new Map<THREE.Material, THREE.Material>();
  const make = (params: Params, physical: boolean, key: string) => {
    const m = physical ? new THREE.MeshPhysicalMaterial(params) : new THREE.MeshStandardMaterial(params as THREE.MeshStandardMaterialParameters);
    m.envMap = opts.envMap ?? null;
    m.envMapIntensity = 1;
    return cinePatch(m, { moon, indirect, key });
  };
  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const src = obj.material as THREE.Material;
    if (!(src instanceof THREE.MeshLambertMaterial)) return;
    let dst = replaced.get(src);
    if (!dst) {
      const up = upgrade(src.name, src);
      if (!up) return;
      const m = make(up.params, up.physical ?? false, 'rover');
      m.name = src.name;
      m.userData = { ...src.userData };
      materials.set(src.name, m);
      replaced.set(src, m);
      dst = m;
    }
    obj.material = dst;
  });

  // Status LEDs: a row on a dark plate on top of the electronics box, at its left-front corner (seen from
  // above, behind or ahead: the chase camera's angle as well as the bay's).
  const { lengthM: l, widthM: w, heightM: ht } = opts.handling.body;
  const top = ht / 2;
  const boxL = l * 0.74;
  const boxH = ht * 0.78;
  const boxW = w * 0.8;
  const boxX = -0.04;
  const boxY = -top + 0.08 + boxH / 2;
  const deckY = boxY + boxH / 2;
  const ledX = (i: number) => boxX + boxL / 2 - 0.09 - i * 0.05;
  const ledZ = -boxW / 2 + 0.075;
  const bezelMat = make({ color: 0x15171a, roughness: 0.5, metalness: 0.3 }, false, 'rover');
  const plateMat = make({ color: 0x0c0d0f, roughness: 0.32, metalness: 0.2 }, false, 'rover');
  const ledGroup = new THREE.Group();
  ledGroup.name = 'cine:leds';
  const plate = new RoundedBoxGeometry(0.23, 0.012, 0.055, 2, 0.004);
  const plateMesh = new THREE.Mesh(plate, plateMat);
  plateMesh.position.set((ledX(0) + ledX(3)) / 2, deckY + 0.004, ledZ);
  ledGroup.add(plateMesh);
  const domeGeo = new THREE.SphereGeometry(0.0095, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
  const bezelGeo = new THREE.TorusGeometry(0.0115, 0.003, 6, 20).rotateX(Math.PI / 2);
  const leds = LED_COLORS.map((c, i) => {
    const color = new THREE.Color(...c);
    const mat = new THREE.MeshPhysicalMaterial({ color: color.clone().multiplyScalar(0.25), roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, emissive: color, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(domeGeo, cinePatch(mat, { moon, indirect, key: 'rover' }));
    mesh.position.set(ledX(i), deckY + 0.01, ledZ);
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.set(ledX(i), deckY + 0.011, ledZ);
    ledGroup.add(mesh, bezel);
    return { mesh, color, k: 0 };
  });
  for (const o of ledGroup.children) (o as THREE.Mesh).castShadow = false;
  // The LED group goes with the body (not a wheel): the first child group of the model, or the model itself.
  const bodyGroup = model.children.find((c) => c instanceof THREE.Group && !c.name.startsWith('rig:')) ?? model;
  bodyGroup.add(ledGroup);

  const glow = opts.glowLights ?? true;
  const ledLight = glow ? new THREE.PointLight(0xffffff, 0, 5, 2) : null;
  if (ledLight) {
    ledLight.position.set((ledX(0) + ledX(3)) / 2, deckY + 0.06, ledZ);
    bodyGroup.add(ledLight);
  }
  const eyeLight = glow ? new THREE.PointLight(EYE_COLOR, 0, 5, 2) : null;
  const tilt = model.getObjectByName('rig:cameraTilt');
  if (eyeLight && tilt) {
    eyeLight.position.set(0.7, 0.05, 0);
    tilt.add(eyeLight);
  }

  const updateLedLight = () => {
    if (!ledLight) return;
    const sum = new THREE.Color(0, 0, 0);
    let k = 0;
    for (const led of leds) {
      sum.add(led.color.clone().multiplyScalar(led.k));
      k += led.k;
    }
    if (k > 0) ledLight.color.copy(sum.multiplyScalar(1 / k));
    ledLight.intensity = 0.05 * k;
  };

  return {
    leds,
    setLed(i, k) {
      const led = leds[i];
      if (!led) return;
      led.k = Math.max(0, k);
      (led.mesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = LED_EMISSIVE * led.k;
      updateLedLight();
    },
    setLeds(k) {
      for (let i = 0; i < leds.length; i++) this.setLed(i, k);
    },
    setEye(k) {
      // A rigged model has its own 'eye' material; the game's model shares 'lens' with the camera head.
      const m = materials.get('eye') ?? materials.get('lens');
      if (m) m.emissiveIntensity = EYE_EMISSIVE * Math.max(0, k);
      if (eyeLight) eyeLight.intensity = 0.25 * Math.max(0, k);
    },
    setLamps(k) {
      const m = materials.get('lamp');
      if (m) m.emissiveIntensity = LAMP_EMISSIVE * Math.max(0, k);
    },
    setIndirect(k) {
      indirect.value = k;
    },
    lights: { leds: ledLight, eye: eyeLight },
    materials,
    dispose() {
      ledGroup.removeFromParent();
      ledLight?.removeFromParent();
      eyeLight?.removeFromParent();
      domeGeo.dispose();
      bezelGeo.dispose();
      plate.dispose();
      for (const led of leds) (led.mesh.material as THREE.Material).dispose();
      bezelMat.dispose();
      plateMat.dispose();
      for (const [src, dst] of replaced) {
        src.dispose();
        dst.dispose();
      }
    },
  };
}
