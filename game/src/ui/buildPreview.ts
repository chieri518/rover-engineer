// Design screen build preview: the rover being assembled in 3D, live, in a dark assembly bay. The
// rover stands on a lit turntable over a faint cyan grid floor, under studio lights (key, fill, rim).
// Only chosen parts show; a new or changed part drops into place with a brief cyan flash. The
// turntable turns slowly by itself and can be dragged (mouse or touch). Reduced motion: no turning
// by itself and instant swaps. Presentation only; nothing here is a rule.
import * as THREE from 'three';
import type { Part, RoverHandling } from '../rules/types';
import { buildRoverModel, roverLook, type ModelGroup, type RoverModel } from '../rover/roverModel';

// Look and motion. Presentation settings, not game rules.
const MAX_PIXEL_RATIO = 2;
const MAX_PIXELS = 2_500_000; // drawing-buffer budget for the viewport
const TURNTABLE_RADIUS_M = 1.6;
const TURNTABLE_HEIGHT_M = 0.12;
const FLOOR_SIZE_M = 16;
const GRID_STEP_M = 0.5;
const CAMERA_FOV_DEG = 30;
const CAMERA_ELEVATION_DEG = 17;
const FRAME_CENTER_Y_M = 1.15; // the camera looks at this height over the turntable center...
const FRAME_TOP_M = 2.75; // ...and fits the turntable rim and a cylinder this tall (the solar mast's top)...
const FRAME_TOP_RADIUS_M = 0.9; // ...this wide, whatever the turntable's angle
const FRAME_MARGIN = 0.9; // share of the view (from center to edge) the framed points may use
const START_YAW = -0.6; // radians: the rover's front three-quarter faces the camera
const TURN_SECONDS = 40; // one full turn of the turntable by itself
const DRAG_RADIANS_PER_PX = 0.011;
const RESUME_AFTER_MS = 2200; // the turntable starts turning again this long after a drag
const RESUME_RAMP_MS = 1200; // ...and eases back up to speed over this time
const INERTIA_DECAY = 5; // per second: how fast a flick of the turntable slows down
const DROP_MS = 360;
const DROP_HEIGHT_M = 0.45;
const FLASH_MS = 520;
const FLASH_PEAK = 0.85;
const CYAN = 0x5ec8ff;

/** The live preview on the design screen. */
export interface BuildPreview {
  /** Show these chosen parts; a part that is new or changed since the last call drops in. */
  show(parts: Part[]): void;
  /** Stop and free every GPU resource. */
  dispose(): void;
}

const noPreview: BuildPreview = { show: () => {}, dispose: () => {} };

/** Grid floor: thin cyan lines fading out from the center, over a soft pool of light. */
function floorTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const cells = FLOOR_SIZE_M / GRID_STEP_M;
  const step = size / cells;
  for (let i = 0; i <= cells; i++) {
    const major = i % 4 === 0;
    g.strokeStyle = major ? 'rgba(94, 200, 255, 0.5)' : 'rgba(94, 200, 255, 0.22)';
    g.lineWidth = major ? 2 : 1.25;
    const p = Math.round(i * step) + 0.5;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, size);
    g.moveTo(0, p);
    g.lineTo(size, p);
    g.stroke();
  }
  const c = size / 2;
  const ttR = (TURNTABLE_RADIUS_M / FLOOR_SIZE_M) * size;
  // Fade the grid out toward the edge.
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createRadialGradient(c, c, ttR * 0.9, c, c, c);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  // A soft pool of light under the turntable, and a cyan glow around its rim.
  g.globalCompositeOperation = 'destination-over';
  const pool = g.createRadialGradient(c, c, 0, c, c, c * 0.62);
  pool.addColorStop(0, 'rgba(120, 165, 225, 0.22)');
  pool.addColorStop(0.5, 'rgba(70, 110, 170, 0.1)');
  pool.addColorStop(1, 'rgba(40, 70, 120, 0)');
  g.fillStyle = pool;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'source-over';
  const glow = g.createRadialGradient(c, c, ttR * 0.98, c, c, ttR * 1.35);
  glow.addColorStop(0, 'rgba(94, 200, 255, 0.35)');
  glow.addColorStop(1, 'rgba(94, 200, 255, 0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(c, c, ttR * 1.35, 0, Math.PI * 2);
  g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Turntable plate: rings and spokes, drawn twice, as a color map and as a glow (emissive) map. */
function plateTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const draw = (base: string | null, line: (a: number) => string) => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d')!;
    const c = size / 2;
    g.fillStyle = base ?? '#000';
    g.fillRect(0, 0, size, size);
    if (base) {
      // Brushed-metal sheen: faint concentric rings.
      for (let r = 8; r < c; r += 6) {
        g.strokeStyle = `rgba(255, 255, 255, ${0.012 + 0.012 * Math.sin(r * 0.37) ** 2})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(c, c, r, 0, Math.PI * 2);
        g.stroke();
      }
    }
    for (let k = 1; k <= 6; k++) {
      g.strokeStyle = line(k === 6 ? 0.9 : 0.4);
      g.lineWidth = k === 6 ? 5 : 2;
      g.beginPath();
      g.arc(c, c, (c - 6) * (k / 6), 0, Math.PI * 2);
      g.stroke();
    }
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const r0 = (c - 6) * (k % 6 === 0 ? 1 / 6 : 4 / 6);
      g.strokeStyle = line(k % 6 === 0 ? 0.35 : 0.2);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      g.lineTo(c + Math.cos(a) * (c - 6), c + Math.sin(a) * (c - 6));
      g.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  return {
    map: draw('#1a2333', (a) => `rgba(120, 200, 240, ${a * 0.5})`),
    glow: draw(null, (a) => `rgba(94, 200, 255, ${a})`),
  };
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      geometries.add(obj.geometry);
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(m);
    } else if (obj instanceof THREE.DirectionalLight) {
      obj.dispose(); // its shadow map
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    const t = m as THREE.Material & { map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null };
    t.map?.dispose();
    t.emissiveMap?.dispose();
    m.dispose();
  });
}

interface Snap {
  object: THREE.Object3D;
  flash: THREE.MeshBasicMaterial;
  ghosts: THREE.Mesh[];
  start: number;
}

/**
 * Start the preview in a container (it fills the container). Calls `unavailable` and returns a
 * preview that does nothing if WebGL cannot start, so the desk works without it.
 */
export function mountBuildPreview(container: HTMLElement, handling: RoverHandling, unavailable: () => void): BuildPreview {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (err) {
    console.warn('Build preview unavailable (no WebGL):', err);
    unavailable();
    return noPreview;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 100);
  const reduced = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const motion = () => !reduced?.matches;
  const canvas = renderer.domElement;
  const turntable = new THREE.Group(); // turns: the plate and the rover
  const rover = new THREE.Group();
  const connectY = -handling.body.heightM / 2 + 0.12; // as in vehicle.ts
  // Wheel bottoms (connectY − rest length − radius) stand on the plate.
  rover.position.y = TURNTABLE_HEIGHT_M - (connectY - handling.suspension.restLengthM - handling.wheelRadiusM);
  turntable.add(rover);

  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    canvas.className = 'preview-canvas';
    container.append(canvas);

    // Studio lights: a warm key with soft shadows, a cool fill from the left, a cyan rim from behind.
    scene.add(new THREE.HemisphereLight(0xa9c2e6, 0x141c2a, 0.9));
    const key = new THREE.DirectionalLight(0xfff1de, 2.8);
    key.position.set(3.2, 5, 3.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -2.4;
    sc.right = sc.top = 2.4;
    sc.near = 1;
    sc.far = 16;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight(0x9cbcff, 0.9);
    fill.position.set(-4.5, 1.8, 2.2);
    const rim = new THREE.DirectionalLight(0x7fd6ff, 2.2);
    rim.position.set(-1.5, 3.2, -4.6);
    scene.add(key, fill, rim);

    // Bay floor: the grid, the light pool and the rim glow (unlit).
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_SIZE_M, FLOOR_SIZE_M),
      new THREE.MeshBasicMaterial({ map: floorTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = -1;
    scene.add(floor);

    // Turntable: a dark drum with glowing cyan rims; the plate on top turns with the rover.
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(TURNTABLE_RADIUS_M, TURNTABLE_RADIUS_M * 1.03, TURNTABLE_HEIGHT_M, 96, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x18202d, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }),
    );
    drum.position.y = TURNTABLE_HEIGHT_M / 2;
    scene.add(drum);
    const ring = (radius: number, y: number, tube: number, opacity: number) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 8, 160),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: opacity < 1, opacity, toneMapped: false }),
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = y;
      scene.add(mesh);
    };
    ring(TURNTABLE_RADIUS_M * 1.002, TURNTABLE_HEIGHT_M, 0.011, 1);
    ring(TURNTABLE_RADIUS_M * 1.03, 0.006, 0.008, 0.55);
    const { map, glow } = plateTextures();
    map.anisotropy = glow.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(TURNTABLE_RADIUS_M, 96),
      new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0.55, roughness: 0.62, metalness: 0.25 }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = TURNTABLE_HEIGHT_M;
    plate.receiveShadow = true;
    turntable.add(plate);
    turntable.rotation.y = START_YAW;
    scene.add(turntable);
  } catch (err) {
    console.warn('Build preview unavailable:', err);
    disposeObject(scene);
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    unavailable();
    return noPreview;
  }

  // --- The model: rebuilt for every change of parts; the changed parts snap in. ---
  let model: { root: THREE.Group; slots: Map<ModelGroup, THREE.Object3D> } | null = null;
  let shownIds = new Map<ModelGroup, string>();
  let firstShow = true;
  let snaps: Snap[] = [];

  function buildModel(parts: Part[]): { root: THREE.Group; slots: Map<ModelGroup, THREE.Object3D> } {
    const built: RoverModel = buildRoverModel(handling, connectY, roverLook(parts), { bySlot: true });
    const root = new THREE.Group();
    root.add(built.body);
    const slots = new Map<ModelGroup, THREE.Object3D>(Object.entries(built.slots) as [ModelGroup, THREE.Group][]);
    if (built.wheels.length) {
      const wheels = new THREE.Group();
      const corners: [number, number][] = [
        [handling.wheelBaseM / 2, handling.wheelTrackM / 2],
        [handling.wheelBaseM / 2, -handling.wheelTrackM / 2],
        [-handling.wheelBaseM / 2, handling.wheelTrackM / 2],
        [-handling.wheelBaseM / 2, -handling.wheelTrackM / 2],
      ];
      built.wheels.forEach(({ wheel }, i) => {
        const [x, z] = corners[i]!;
        wheel.position.x = x;
        wheel.position.z = z;
        wheels.add(wheel);
      });
      root.add(wheels);
      slots.set('wheels', wheels);
    }
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.receiveShadow = true;
    });
    return { root, slots };
  }

  function endSnap(snap: Snap): void {
    snap.object.position.y = 0;
    for (const ghost of snap.ghosts) ghost.removeFromParent();
    snap.flash.dispose();
  }

  function startSnap(object: THREE.Object3D, now: number): void {
    const flash = new THREE.MeshBasicMaterial({
      color: CYAN, transparent: true, opacity: FLASH_PEAK, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const meshes: THREE.Mesh[] = [];
    object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshes.push(obj);
    });
    // A ghost of each mesh in additive cyan, sharing its geometry, fades out as the part lands.
    const ghosts = meshes.map((mesh) => {
      const ghost = new THREE.Mesh(mesh.geometry, flash);
      ghost.renderOrder = 1;
      mesh.add(ghost);
      return ghost;
    });
    object.position.y = DROP_HEIGHT_M;
    snaps.push({ object, flash, ghosts, start: now });
  }

  function show(parts: Part[]): void {
    if (stopped) return;
    // Each bus slot, and each instrument in the bay, is one group: a new or changed one snaps in.
    const group = (p: Part): ModelGroup | undefined => (p.slot === 'instrument' ? p.effects.instrument : p.slot);
    const ids = new Map(parts.flatMap((p): [ModelGroup, string][] => {
      const g = group(p);
      return g ? [[g, p.id]] : [];
    }));
    const same = ids.size === shownIds.size && [...ids].every(([slot, id]) => shownIds.get(slot) === id);
    if (same && model) return;
    const changed = [...ids].filter(([slot, id]) => shownIds.get(slot) !== id).map(([slot]) => slot);
    for (const snap of snaps) endSnap(snap);
    snaps = [];
    if (model) {
      model.root.removeFromParent();
      disposeObject(model.root);
    }
    model = buildModel(parts);
    rover.add(model.root);
    if (!firstShow && motion()) {
      const now = performance.now();
      for (const slot of changed) {
        const object = model.slots.get(slot);
        if (object) startSnap(object, now);
      }
    }
    firstShow = false;
    shownIds = ids;
    kick();
  }

  // --- Framing, turning and dragging. ---
  const target = new THREE.Vector3(0, FRAME_CENTER_Y_M, 0);
  // Points that must stay in view: the turntable's rim (bottom edge) and the top of the tallest build.
  const framed: THREE.Vector3[] = [];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    framed.push(new THREE.Vector3(Math.cos(a) * TURNTABLE_RADIUS_M * 1.03, 0, Math.sin(a) * TURNTABLE_RADIUS_M * 1.03));
    framed.push(new THREE.Vector3(Math.cos(a) * FRAME_TOP_RADIUS_M, FRAME_TOP_M, Math.sin(a) * FRAME_TOP_RADIUS_M));
  }
  const projected = new THREE.Vector3();
  function placeCamera(distance: number): void {
    const el = THREE.MathUtils.degToRad(CAMERA_ELEVATION_DEG);
    camera.position.set(0, target.y + Math.sin(el) * distance, Math.cos(el) * distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  /** The closest camera distance (binary search) that keeps every framed point in view. */
  function frameCamera(aspect: number): void {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const fits = () => framed.every((p) => {
      projected.copy(p).project(camera);
      return Math.abs(projected.x) <= FRAME_MARGIN && Math.abs(projected.y) <= FRAME_MARGIN && projected.z < 1;
    });
    let near = 2;
    let far = 60;
    for (let i = 0; i < 24; i++) {
      const mid = (near + far) / 2;
      placeCamera(mid);
      if (fits()) far = mid;
      else near = mid;
    }
    placeCamera(far);
  }

  const onResize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO, Math.sqrt(MAX_PIXELS / (w * h))));
    renderer.setSize(w, h, false);
    frameCamera(w / h);
    render();
  };

  let shown = false;
  function render(): void {
    if (stopped || lost) return;
    renderer.render(scene, camera);
    if (!shown) {
      shown = true;
      container.classList.add('ready');
    }
  }

  let stopped = false;
  let lost = false;
  let inView = true;
  let frame = 0;
  let lastTime = 0;
  let spin = 0; // radians per second from a flick
  let drag: { id: number; x: number; t: number } | null = null;
  let lastTouch = -Infinity; // when the player last let go of the turntable

  /** Whether the next frame changes anything (with motion on, the turntable is always turning or about to). */
  function animating(): boolean {
    return Boolean(drag) || snaps.length > 0 || Math.abs(spin) > 0.01 || motion();
  }

  const tick = (t: number) => {
    frame = 0;
    if (stopped || lost) return;
    const dt = lastTime ? Math.min(0.1, (t - lastTime) / 1000) : 0;
    lastTime = t;
    if (!drag) {
      if (Math.abs(spin) > 0.01 && motion()) {
        turntable.rotation.y += spin * dt;
        spin *= Math.exp(-INERTIA_DECAY * dt);
      } else spin = 0;
      if (motion()) {
        const since = t - lastTouch - RESUME_AFTER_MS;
        const ramp = since <= 0 ? 0 : Math.min(1, since / RESUME_RAMP_MS);
        turntable.rotation.y += ((dt * Math.PI * 2) / TURN_SECONDS) * ramp * ramp * (3 - 2 * ramp);
      }
    }
    snaps = snaps.filter((snap) => {
      const age = t - snap.start;
      const p = Math.min(1, Math.max(0, age / DROP_MS));
      // Ease out with a small overshoot: the part seats itself.
      const s = 1.6;
      const eased = 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;
      snap.object.position.y = DROP_HEIGHT_M * (1 - eased);
      const f = Math.min(1, Math.max(0, age / FLASH_MS));
      snap.flash.opacity = FLASH_PEAK * (1 - f) * (1 - f);
      if (p >= 1 && f >= 1) {
        endSnap(snap);
        return false;
      }
      return true;
    });
    render();
    if (inView && animating()) frame = requestAnimationFrame(tick);
  };

  function kick(): void {
    if (stopped || lost) return;
    if (!inView) return; // shown when it scrolls back into view
    if (!frame) {
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    }
  }
  function stopLoop(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, t: e.timeStamp };
    spin = 0;
    canvas.setPointerCapture?.(e.pointerId);
    container.classList.add('dragging');
    kick();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dt = Math.max(1, e.timeStamp - drag.t) / 1000;
    turntable.rotation.y += dx * DRAG_RADIANS_PER_PX;
    spin = 0.6 * spin + 0.4 * ((dx * DRAG_RADIANS_PER_PX) / dt);
    drag = { id: e.pointerId, x: e.clientX, t: e.timeStamp };
    if (!frame) render();
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    // A flick keeps turning briefly; a drag that stopped before letting go does not.
    if (e.timeStamp - drag.t > 80) spin = 0;
    spin = THREE.MathUtils.clamp(spin, -8, 8);
    drag = null;
    lastTouch = performance.now();
    container.classList.remove('dragging');
    kick();
  };

  // Reduced motion: stop turning at once; turning it off resumes.
  const onMotionChange = () => {
    if (!motion()) {
      for (const snap of snaps) endSnap(snap);
      snaps = [];
      spin = 0;
      render();
    }
    kick();
  };
  // If the browser drops the context, show the empty bay until it comes back.
  const onContextLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    stopLoop();
    container.classList.add('lost');
  };
  const onContextRestored = () => {
    lost = false;
    container.classList.remove('lost');
    render();
    kick();
  };

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
  if (resizeObserver) resizeObserver.observe(container);
  else window.addEventListener('resize', onResize);
  // No frames while the viewport is scrolled out of sight (phones, where it sits above the parts).
  const viewObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      if (inView) kick();
      else stopLoop();
    })
    : null;
  viewObserver?.observe(container);
  reduced?.addEventListener?.('change', onMotionChange);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  onResize();

  return {
    show,
    dispose: () => {
      if (stopped) return;
      stopped = true;
      stopLoop();
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', onResize);
      viewObserver?.disconnect();
      reduced?.removeEventListener?.('change', onMotionChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      for (const snap of snaps) endSnap(snap);
      snaps = [];
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
