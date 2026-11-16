// Title screen cover: a small live scene behind the title. The game's rover stands on regolith at the
// lunar south pole: the Sun a few degrees above the horizon casts long shadows, Earth hangs low in the
// north, and the camera slowly circles the rover. No physics and no mission terrain: a procedural
// ground patch, a few rocks and a star field keep it light. Presentation only; nothing here is a rule.
import * as THREE from 'three';
import type { RoverHandling } from '../rules/types';
import { buildRoverModel, type RoverLook } from '../rover/roverModel';
import { earthTexture, glowTexture } from '../world/sky';

// Look and motion. Presentation settings, not game rules.
const MAX_PIXEL_RATIO = 2;
const MAX_PIXELS = 4_000_000; // drawing-buffer budget: a 4K screen at ratio 2 renders at a lower ratio
const ORBIT_SECONDS = 140; // one full circle around the rover
const ORBIT_RADIUS_M = 9;
const CAMERA_HEIGHT_M = 1.15;
const TARGET_HEIGHT_M = 0.8;
const STILL_ANGLE = 1.4; // camera angle (radians) for reduced motion and the first frame
const SUN_AZIMUTH_DEG = 98; // measured from north (−z) toward east (+x)
const SUN_ELEVATION_DEG = 5; // real south-pole Sun stays under about 1.5°; a little higher keeps the ground readable
const SUN_INTENSITY = 7;
const EARTH_ELEVATION_DEG = 2.6; // low in the north, as seen from the south pole site
const EARTH_DIAMETER_DEG = 3.4; // Earth is about 1.9° across from the Moon; drawn larger to read on a cover
const SKY_RADIUS = 3000;
const GROUND_RADIUS = 2600;
const STAR_COUNT = 3000;
const ROCK_COUNT = 90;
const SHADOW_HALF_M = 16;

/** The rover on the cover: a capable build with the heater's gold blanket and the camera mast. */
const COVER_LOOK: RoverLook = {
  frame: 'titanium',
  wheels: 'mesh',
  power: 'panel',
  battery: 'pack',
  lights: true,
  heater: true,
  instruments: ['camera'],
};

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Direction from an azimuth (from −z toward +x) and an elevation, in degrees. */
function skyDir(azDeg: number, elDeg: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

// Smooth value noise for the ground.
function hash(ix: number, iz: number): number {
  const h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}
function fbm(x: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

interface Crater { x: number; z: number; r: number; depth: number }
const CRATERS: Crater[] = [
  { x: 8.5, z: -5, r: 2.2, depth: 0.45 },
  { x: -11, z: 8, r: 4.5, depth: 0.9 },
  { x: 3, z: 13, r: 1.6, depth: 0.3 },
  { x: -6, z: -14, r: 3, depth: 0.6 },
  { x: 24, z: 16, r: 9, depth: 1.8 },
  { x: -32, z: -26, r: 14, depth: 2.8 },
  { x: 40, z: -38, r: 7, depth: 1.4 },
  { x: -70, z: 55, r: 26, depth: 5 },
  { x: 150, z: 120, r: 60, depth: 12 },
];

/** Ground height: gentle rolling regolith, a few craters, and distant massifs on the horizon. */
function groundHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  // Small bumps fade out under the rover so it stands level; the gentle large-scale roll stays.
  const near = THREE.MathUtils.smoothstep(d, 2.2, 6);
  let h = fbm(x * 0.015, z * 0.015, 4) * 3 + fbm(x * 0.12, z * 0.12, 3) * 0.35 * near;
  for (const c of CRATERS) {
    const r = Math.hypot(x - c.x, z - c.z) / c.r;
    if (r < 1) h += c.depth * (r * r - 1); // bowl
    h += c.depth * 0.25 * Math.exp(-(((r - 1) / 0.35) ** 2)); // raised rim
  }
  if (d > 500) {
    // Massifs on the horizon, kept low toward the north so Earth clears them.
    const towardEarth = Math.max(0, -z / d); // 1 looking north
    const lowNorth = 1 - 0.85 * Math.pow(towardEarth, 6);
    const ridge = (1 - Math.abs(fbm(x * 0.0016, z * 0.0016, 4))) ** 2;
    h += THREE.MathUtils.smoothstep(d, 500, 1800) * ridge * 170 * lowNorth;
  }
  return h;
}

/** A polar grid: fine near the rover, coarse toward the horizon. */
function groundGeometry(): THREE.BufferGeometry {
  const rings = 150;
  const segments = 240;
  const positions: number[] = [0, groundHeight(0, 0), 0];
  const uvs: number[] = [0, 0];
  const index: number[] = [];
  const inner = 0.4;
  for (let i = 0; i < rings; i++) {
    const r = inner * Math.pow(GROUND_RADIUS / inner, i / (rings - 1));
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      positions.push(x, groundHeight(x, z), z);
      uvs.push(x / 3, z / 3);
    }
  }
  const at = (i: number, j: number) => 1 + i * segments + (j % segments);
  for (let j = 0; j < segments; j++) index.push(0, at(0, j + 1), at(0, j));
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = at(i, j);
      const b = at(i, j + 1);
      const c = at(i + 1, j);
      const d = at(i + 1, j + 1);
      index.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Regolith speckle: fine grains and small pits, used as color and bump map. */
function regolithTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(size, size);
  const rand = seeded(11);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tileable noise: sample on a torus-like wrap by mixing four offsets.
      const u = x / size;
      const v = y / size;
      const n = (fbm(u * 8, v * 8, 4) * (1 - u) * (1 - v) + fbm((u - 1) * 8, v * 8, 4) * u * (1 - v)
        + fbm(u * 8, (v - 1) * 8, 4) * (1 - u) * v + fbm((u - 1) * 8, (v - 1) * 8, 4) * u * v);
      const grain = (rand() - 0.5) * 34;
      const value = Math.max(0, Math.min(255, 150 + n * 70 + grain));
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = value;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function stars(): THREE.Points {
  const rand = seeded(7);
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const u = rand() * 1.1 - 0.1; // mostly above the horizon
    const phi = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions.set([r * Math.cos(phi) * SKY_RADIUS, u * SKY_RADIUS, r * Math.sin(phi) * SKY_RADIUS], i * 3);
    const b = 0.25 + 0.75 * Math.pow(rand(), 5);
    const tint = rand();
    colors.set([b * (0.85 + 0.15 * tint), b * 0.93, b * (1.05 - 0.15 * tint)], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 1.7, sizeAttenuation: false, vertexColors: true, depthWrite: false, toneMapped: false,
  }));
  points.renderOrder = -1;
  return points;
}

function rocks(): THREE.InstancedMesh {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const p = geometry.attributes.position as THREE.BufferAttribute;
  const rand = seeded(23);
  const jitter = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let s = jitter.get(key);
    if (s === undefined) jitter.set(key, (s = 0.7 + rand() * 0.5));
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.7, p.getZ(i) * s);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0x8a867e, roughness: 1, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, ROCK_COUNT);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < ROCK_COUNT; i++) {
    let r = 0;
    let size = 0;
    // Pebbles near the rover, boulders farther out; none on the camera's circle.
    if (i < 25) {
      r = 1.8 + rand() * 2.4;
      size = 0.04 + rand() * 0.08;
    } else {
      r = 8.5 + Math.pow(rand(), 1.5) * 70;
      size = 0.12 + Math.pow(rand(), 3) * (0.5 + r * 0.012);
    }
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
    m.compose(new THREE.Vector3(x, groundHeight(x, z) + size * 0.25, z), q, new THREE.Vector3(size, size, size));
    mesh.setMatrixAt(i, m);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Start the cover in a container (it fills the container). Returns a function that stops it and frees
 * every GPU resource. If WebGL is unavailable it adds the `fallback` class (a CSS star background) instead.
 */
export function mountTitleCover(container: HTMLElement, handling: RoverHandling): () => void {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  } catch (err) {
    console.warn('Title cover unavailable (no WebGL):', err);
    container.classList.add('fallback');
    return () => {};
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, SKY_RADIUS * 2);
  const reduced = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let frame = 0;
  let stopped = false;

  const onResize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO, Math.sqrt(MAX_PIXELS / (w * h))));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // Keep the rover framed: a portrait screen widens the view; a wide one moves the rover right of
    // the title panel, a tall one moves it above the panel.
    camera.fov = aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(13.5)) / aspect)) : 35;
    if (aspect >= 1) camera.setViewOffset(w, h, -w * (aspect > 1.3 ? 0.17 : 0.1), h * 0.04, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.15, w, h);
    camera.updateProjectionMatrix();
    if (!loopRunning()) render();
  };

  const disposeAll = () => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats as (THREE.Material & { map?: THREE.Texture | null })[]) {
          mat.map?.dispose();
          mat.dispose();
        }
      } else if (obj instanceof THREE.DirectionalLight) {
        obj.dispose(); // its shadow map
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };

  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000);
    renderer.domElement.className = 'title-cover-canvas';
    container.append(renderer.domElement);

    const sunDir = skyDir(SUN_AZIMUTH_DEG, SUN_ELEVATION_DEG);
    const earthDir = skyDir(0, EARTH_ELEVATION_DEG);

    scene.add(stars());

    // Sun: a glare low on the horizon and the light that casts the long shadows.
    const glare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    glare.position.copy(sunDir).multiplyScalar(SKY_RADIUS * 0.9);
    glare.scale.setScalar(SKY_RADIUS * 0.9 * 0.12);
    glare.renderOrder = -1;
    scene.add(glare);

    const sun = new THREE.DirectionalLight(0xfff4e6, SUN_INTENSITY);
    sun.position.copy(sunDir).multiplyScalar(150);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -SHADOW_HALF_M;
    sc.right = sc.top = SHADOW_HALF_M;
    sc.near = 50;
    sc.far = 260;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    // Faint fill: sunlight scattered from the ground into shadows, and earthshine.
    scene.add(new THREE.HemisphereLight(0x3a4a6a, 0x4a463e, 0.4));

    // Earth, lit by the same Sun, so it shows a real phase.
    const earthDistance = SKY_RADIUS * 0.8;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(earthDistance * Math.tan(THREE.MathUtils.degToRad(EARTH_DIAMETER_DEG / 2)), 48, 32),
      new THREE.MeshLambertMaterial({ map: earthTexture() }),
    );
    earth.position.copy(earthDir).multiplyScalar(earthDistance);
    earth.rotation.set(0.4, 1.2, 0.2);
    scene.add(earth);

    // Ground and rocks.
    const regolith = regolithTexture();
    regolith.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const ground = new THREE.Mesh(groundGeometry(), new THREE.MeshStandardMaterial({
      color: 0x9b978f, map: regolith, roughness: 1, metalness: 0,
    }));
    ground.receiveShadow = true;
    scene.add(ground, rocks());

    // The rover, with its wheels at the rest position, standing on the ground at the origin.
    const connectY = -handling.body.heightM / 2 + 0.12;
    const model = buildRoverModel(handling, connectY, COVER_LOOK);
    const rover = new THREE.Group();
    rover.add(model.body);
    const corners: [number, number][] = [
      [handling.wheelBaseM / 2, handling.wheelTrackM / 2],
      [handling.wheelBaseM / 2, -handling.wheelTrackM / 2],
      [-handling.wheelBaseM / 2, handling.wheelTrackM / 2],
      [-handling.wheelBaseM / 2, -handling.wheelTrackM / 2],
    ];
    model.wheels.forEach(({ wheel }, i) => {
      const [x, z] = corners[i]!;
      wheel.position.x = x;
      wheel.position.z = z;
      rover.add(wheel);
    });
    rover.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.receiveShadow = true;
    });
    // Wheel bottoms sit at connectY − rest length − radius; settle slightly into the soil.
    rover.position.y = -(connectY - handling.suspension.restLengthM - handling.wheelRadiusM) + groundHeight(0, 0) - 0.03;
    // Tilt with the ground's slope, facing roughly north-west.
    const e = 0.5;
    const up = new THREE.Vector3(groundHeight(-e, 0) - groundHeight(e, 0), 2 * e, groundHeight(0, -e) - groundHeight(0, e)).normalize();
    rover.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-30)));
    scene.add(rover);
  } catch (err) {
    console.warn('Title cover unavailable:', err);
    disposeAll();
    container.classList.add('fallback');
    return () => {};
  }

  const baseY = groundHeight(0, 0);
  const target = new THREE.Vector3(0, baseY + TARGET_HEIGHT_M, 0);
  let lastTime = 0;
  let angle = STILL_ANGLE;
  let shown = false;
  function render(): void {
    const cx = Math.cos(angle) * ORBIT_RADIUS_M;
    const cz = Math.sin(angle) * ORBIT_RADIUS_M;
    camera.position.set(cx, Math.max(baseY + CAMERA_HEIGHT_M, groundHeight(cx, cz) + 0.9), cz);
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (!shown) {
      shown = true;
      container.classList.add('ready');
    }
  }
  function loopRunning(): boolean {
    return frame !== 0;
  }
  const tick = (t: number) => {
    frame = 0;
    if (stopped) return;
    const dt = lastTime ? Math.min(0.1, (t - lastTime) / 1000) : 0;
    lastTime = t;
    angle += (dt * Math.PI * 2) / ORBIT_SECONDS;
    render();
    frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (stopped || frame || reduced?.matches) return;
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  // Reduced motion holds the camera still; turning it on or off while the title is open applies at once.
  const onMotionChange = () => {
    if (reduced?.matches) {
      stop();
      render();
    } else start();
  };
  // If the browser drops the context, show the CSS sky until it comes back.
  const onContextLost = (e: Event) => {
    e.preventDefault();
    stop();
    container.classList.add('fallback');
  };
  const onContextRestored = () => {
    container.classList.remove('fallback');
    render();
    start();
  };

  window.addEventListener('resize', onResize);
  reduced?.addEventListener?.('change', onMotionChange);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
  onResize();
  render();
  start();

  return () => {
    if (stopped) return;
    stopped = true;
    stop();
    window.removeEventListener('resize', onResize);
    reduced?.removeEventListener?.('change', onMotionChange);
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
    disposeAll();
  };
}
