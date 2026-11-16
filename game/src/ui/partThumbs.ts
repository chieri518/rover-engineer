// Part thumbnails for the design screen's parts palette: each part drawn on its own from the real rover
// model (roverModel.ts), under the build preview's studio lights, framed in a three-quarter view, and read
// out once as an image data URL on a transparent background. One offscreen renderer serves a whole batch
// and is freed after it (browsers cap live WebGL contexts, and the desk's live preview holds one). The
// parts render one at a time, yielding between them, so the desk stays responsive. Without WebGL there
// are no thumbnails, and the palette shows plain labelled tiles. Presentation only; nothing here is a rule.
import * as THREE from 'three';
import type { Part, RoverHandling } from '../rules/types';
import { buildRoverModel, roverLook, type ModelGroup, type RoverLook } from '../rover/roverModel';

// Look. Presentation settings, not game rules.
const DEFAULT_SIZE_PX = 128;
const MAX_PIXEL_RATIO = 2;
const CAMERA_FOV_DEG = 24;
const CAMERA_ELEVATION_DEG = 24;
const FLAT_ELEVATION_DEG = 40; // flat parts (solar panels) are seen from higher up
const FLAT_RATIO = 0.2; // a part is flat when its height is under this share of its width
const YAW = -0.6; // radians, as the build preview's turntable starts: the part's front three-quarter faces the camera
const WHEEL_YAW = -1.05; // a wheel turned further, so its tread shows as well as its face
const LIGHTS_YAW = -0.95; // one floodlight, seen more from the front so both lamps show
const MARGIN = 0.86; // share of the view (from center to edge) the part may use
const WEBP_QUALITY = 0.9;

export interface ThumbOptions {
  /** Thumbnail size in CSS pixels (square). Default 128. */
  sizePx?: number;
  /** Device pixels per CSS pixel. Default: the screen's, at most 2. */
  pixelRatio?: number;
  /** Called with each thumbnail as soon as it is ready (cached ones first, at once). */
  onThumb?: (partId: string, url: string) => void;
  /** Stop after the part being drawn; the promise then resolves with the thumbnails made so far. */
  signal?: AbortSignal;
}

/**
 * Part id → image data URL (WebP, or PNG where the browser cannot write WebP). The look depends only on
 * the part, so one world's desk reuses another's.
 */
const cache = new Map<string, string>();
/** Parts that draw nothing on their own (the "none" parts): never drawn again. */
const blank = new Set<string>();
/** Batches run one after another, so at most one thumbnail renderer is alive at a time. */
let queue: Promise<unknown> = Promise.resolve();

/** The cached thumbnail for a part, if any. */
export function cachedThumb(partId: string): string | undefined {
  return cache.get(partId);
}

/**
 * Render (or take from the cache) a thumbnail for each part; resolves with part id → image URL (a WebP
 * or PNG data URL, usable as an <img> src) for those that have one. Parts that draw nothing alone
 * (`lights-none`, `heater-none`, `arm-none`, `mast-none`) never get one. Never rejects: without WebGL
 * it resolves with no images.
 */
export function renderPartThumbs(parts: Part[], handling: RoverHandling, options: ThumbOptions = {}): Promise<Map<string, string>> {
  const run = queue.then(() => renderBatch(parts, handling, options));
  queue = run.catch(() => undefined);
  return run;
}

/** A part drawn on its own: the objects to render, and every object the model built (to free after). */
export interface ThumbSubject {
  object: THREE.Object3D;
  /** Radians the part turns about the vertical to face the camera. */
  yaw: number;
  /** Free every geometry, material and texture the model made. */
  dispose(): void;
}

/** The model group that holds a part on the rover. */
function groupOf(part: Part): ModelGroup | undefined {
  return part.slot === 'instrument' ? part.effects.instrument : part.slot;
}

/**
 * The part on its own, from the rover model with only that part chosen: its slot's (or instrument's)
 * group (only the right floodlight of the pair), or one wheel with its suspension and fender. Null when the part draws nothing alone.
 */
export function thumbSubject(part: Part, handling: RoverHandling): ThumbSubject | null {
  const group = groupOf(part);
  if (!group) return null;
  let look: RoverLook = roverLook([part]);
  // Without a camera mast the drill brings a short navigation camera elsewhere on the deck; the
  // thumbnail is the drill tower alone (the camera group is built, then freed unseen).
  if (group === 'drill') look = { ...look, instruments: [...look.instruments, 'camera'] };
  const connectY = -handling.body.heightM / 2 + 0.12; // as in vehicle.ts
  const model = buildRoverModel(handling, connectY, look, { bySlot: true });
  const roots: THREE.Object3D[] = [model.body, ...model.wheels.map((w) => w.wheel)];
  const dispose = () => disposeObjects(roots);
  let object: THREE.Object3D | undefined;
  let yaw = YAW;
  if (group === 'wheels') {
    // One wheel (the front right), its outer face toward the camera.
    const wheel = model.wheels[0]?.wheel;
    if (wheel) {
      object = new THREE.Group();
      object.add(wheel);
      roots.push(object);
      yaw = WHEEL_YAW;
    }
  } else {
    object = model.slots[group];
    if (object && group === 'lights') {
      // The two floodlight housings sit far apart on the front corners: show the right one alone.
      keepRightSide(object);
      yaw = LIGHTS_YAW;
    }
  }
  if (!object || !hasMesh(object)) {
    dispose();
    return null;
  }
  object.removeFromParent();
  roots.push(object);
  return { object, yaw, dispose };
}

/** Keep only the triangles on the right of the rover (+z) in each mesh under `root` (slot meshes are merged in the chassis frame). */
function keepRightSide(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const source = obj.geometry as THREE.BufferGeometry;
    const flat = source.index ? source.toNonIndexed() : source;
    const pos = flat.getAttribute('position');
    const keep: number[] = [];
    for (let t = 0; t + 2 < pos.count; t += 3) {
      if (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2) > 0) keep.push(t, t + 1, t + 2);
    }
    const trimmed = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(flat.attributes)) {
      const a = attr as THREE.BufferAttribute;
      const out = new (a.array.constructor as Float32ArrayConstructor)(keep.length * a.itemSize);
      keep.forEach((v, i) => {
        for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.array[v * a.itemSize + k]!;
      });
      trimmed.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize, a.normalized));
    }
    if (flat !== source) flat.dispose();
    source.dispose();
    obj.geometry = trimmed;
  });
}

function hasMesh(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && (obj.geometry.getAttribute('position')?.count ?? 0) > 0) found = true;
  });
  return found;
}

function disposeObjects(roots: THREE.Object3D[]): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const root of roots) {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        geometries.add(obj.geometry);
        for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(m);
      } else if (obj instanceof THREE.DirectionalLight) {
        obj.dispose(); // its shadow map
      }
    });
  }
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    const t = m as THREE.Material & { map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null };
    t.map?.dispose();
    t.emissiveMap?.dispose(); // the bump map goes with its material (roverModel.ts)
    m.dispose();
  });
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function renderBatch(parts: Part[], handling: RoverHandling, options: ThumbOptions): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const todo: Part[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part.id)) continue;
    seen.add(part.id);
    const url = cache.get(part.id);
    if (url) {
      result.set(part.id, url);
      options.onThumb?.(part.id, url);
    } else if (!blank.has(part.id)) todo.push(part);
  }
  if (todo.length === 0 || options.signal?.aborted) return result;

  const sizePx = Math.max(1, Math.round(options.sizePx ?? DEFAULT_SIZE_PX));
  const screenRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const ratio = Math.max(0.5, options.pixelRatio ?? Math.min(screenRatio, MAX_PIXEL_RATIO));
  const studio = makeStudio(Math.round(sizePx * ratio));
  if (!studio) return result;
  try {
    for (const part of todo) {
      await nextTask(); // let the desk breathe between parts
      if (options.signal?.aborted || studio.lost()) break;
      let url: string | null;
      try {
        const subject = thumbSubject(part, handling);
        if (!subject) {
          blank.add(part.id);
          continue;
        }
        try {
          url = studio.shoot(subject);
        } finally {
          subject.dispose();
        }
      } catch (err) {
        console.warn(`Part thumbnail failed (${part.id}):`, err);
        continue;
      }
      if (!url) continue;
      cache.set(part.id, url);
      result.set(part.id, url);
      options.onThumb?.(part.id, url);
    }
  } finally {
    studio.dispose();
  }
  return result;
}

interface Studio {
  /** Draw one part and read it out; null if nothing could be read. */
  shoot(subject: ThumbSubject): string | null;
  lost(): boolean;
  dispose(): void;
}

/** The offscreen renderer, lights and camera for a batch; null without WebGL. */
/** Set once creating the thumbnail renderer has failed (no WebGL): later desk visits neither retry nor log again. */
let noWebGL = false;

function makeStudio(pixels: number): Studio | null {
  if (typeof document === 'undefined' || noWebGL) return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power',
    });
  } catch (err) {
    noWebGL = true;
    console.warn('Part thumbnails unavailable (no WebGL):', err);
    return null;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.01, 100);
  // The build preview's studio: a warm key with soft shadows, a cool fill from the left, a cyan rim from behind.
  const hemi = new THREE.HemisphereLight(0xa9c2e6, 0x141c2a, 0.9);
  const key = new THREE.DirectionalLight(0xfff1de, 2.8);
  const keyDir = new THREE.Vector3(3.2, 5, 3.6).normalize();
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  key.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0x9cbcff, 0.9);
  fill.position.set(-4.5, 1.8, 2.2);
  const rim = new THREE.DirectionalLight(0x7fd6ff, 2.2);
  rim.position.set(-1.5, 3.2, -4.6);
  scene.add(hemi, key, key.target, fill, rim);
  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(pixels, pixels, false);
  } catch (err) {
    console.warn('Part thumbnails unavailable:', err);
    free();
    return null;
  }

  function free(): void {
    disposeObjects([scene]);
    renderer.dispose();
    renderer.forceContextLoss();
  }

  const pivot = new THREE.Group(); // turns the part to face the camera
  scene.add(pivot);
  const center = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const v = new THREE.Vector3();

  return {
    lost: () => renderer.getContext().isContextLost(),
    shoot(subject: ThumbSubject): string | null {
      pivot.rotation.y = subject.yaw;
      pivot.add(subject.object);
      try {
        pivot.updateMatrixWorld(true);
        // Every vertex in world space, for a tight fit.
        const points: number[] = [];
        const box = new THREE.Box3();
        subject.object.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          const pos = obj.geometry.getAttribute('position');
          if (!pos) return;
          obj.receiveShadow = true;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
            points.push(v.x, v.y, v.z);
            box.expandByPoint(v);
          }
        });
        if (points.length === 0) return null;
        box.getCenter(center);
        const size = box.getSize(v);
        const radius = Math.max(0.05, size.length() / 2);
        const flat = size.y < FLAT_RATIO * Math.max(size.x, size.z);

        // The camera looks at the center from a fixed direction (a little above); find the closest
        // distance at which the part's projected width and height fit, then shift the view to center it.
        const el = THREE.MathUtils.degToRad(flat ? FLAT_ELEVATION_DEG : CAMERA_ELEVATION_DEG);
        toCamera.set(0, Math.sin(el), Math.cos(el));
        right.set(1, 0, 0); // the camera's right and up vectors for that direction
        up.set(0, Math.cos(el), -Math.sin(el));
        const n = points.length / 3;
        const xs = new Float32Array(n);
        const ys = new Float32Array(n);
        const ds = new Float32Array(n); // how far toward the camera each point is
        let nearest = -Infinity;
        for (let i = 0; i < n; i++) {
          v.set(points[3 * i]! - center.x, points[3 * i + 1]! - center.y, points[3 * i + 2]! - center.z);
          xs[i] = v.dot(right);
          ys[i] = v.dot(up);
          ds[i] = v.dot(toCamera);
          nearest = Math.max(nearest, ds[i]!);
        }
        const t = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV_DEG) / 2);
        const extent = (distance: number) => {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (let i = 0; i < n; i++) {
            const depth = (distance - ds[i]!) * t;
            const px = xs[i]! / depth;
            const py = ys[i]! / depth;
            if (px < x0) x0 = px;
            if (px > x1) x1 = px;
            if (py < y0) y0 = py;
            if (py > y1) y1 = py;
          }
          return { x0, x1, y0, y1 };
        };
        let lo = nearest + 0.02;
        let hi = nearest + radius * 40 + 1;
        for (let i = 0; i < 26; i++) {
          const mid = (lo + hi) / 2;
          const e = extent(mid);
          if (e.x1 - e.x0 <= 2 * MARGIN && e.y1 - e.y0 <= 2 * MARGIN) hi = mid;
          else lo = mid;
        }
        const e = extent(hi);
        camera.position.copy(center).addScaledVector(toCamera, hi);
        camera.near = Math.max(0.01, hi - nearest - 0.05);
        camera.far = hi + radius * 2 + 1;
        camera.up.set(0, 1, 0);
        camera.lookAt(center);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        // Shift the image so the part's projection is centered (a translation in clip space).
        const shift = new THREE.Matrix4().makeTranslation(-(e.x0 + e.x1) / 2, -(e.y0 + e.y1) / 2, 0);
        camera.projectionMatrix.premultiply(shift);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        // The key's shadow camera wraps the part.
        key.target.position.copy(center);
        key.position.copy(center).addScaledVector(keyDir, radius * 4);
        const sc = key.shadow.camera;
        sc.left = sc.bottom = -radius * 1.1;
        sc.right = sc.top = radius * 1.1;
        sc.near = radius;
        sc.far = radius * 7;
        sc.updateProjectionMatrix();
        key.shadow.normalBias = radius * 0.01;
        key.target.updateMatrixWorld();
        key.updateMatrixWorld();
        key.shadow.needsUpdate = true;

        renderer.render(scene, camera);
        // WebP where the browser can write it (a fraction of the PNG's size), else PNG.
        const url = renderer.domElement.toDataURL('image/webp', WEBP_QUALITY);
        return url.startsWith('data:image/') ? url : null;
      } finally {
        subject.object.removeFromParent();
      }
    },
    dispose: free,
  };
}
