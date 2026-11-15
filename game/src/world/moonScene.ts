// The drivable Moon: terrain, rover, low Sun with moving shadows, sky, and the operating boundary.
// The mission screen starts it; Phase 4 adds the mission systems on top through onFrame.
import * as THREE from 'three';
import type { GameData } from '../rules/types';
import type { RoverParams } from '../rules/drive';
import { skyDirection, sunAt, type SkyDirection } from '../rules/sun';
import { loadTerrain } from './terrainData';
import { ChunkLayer } from './terrainChunks';
import { SunMasks } from './sunMask';
import { createMoonLightUniforms, patchMoonLighting } from './lunarLighting';
import { Sky } from './sky';
import { TerrainColliders } from './terrainColliders';
import { initRapier } from './physics';
import { RoverVehicle } from '../rover/vehicle';
import { KeyboardInput } from '../rover/input';
import { ChaseCamera } from '../rover/chaseCamera';

// Rendering look and cost. These are presentation settings, not game rules.
const REGOLITH_COLOR = 0x9a968e;
const SUN_INTENSITY = 5.5;
const AMBIENT_INTENSITY = 0.35; // stands in for light scattered from sunlit ground into shadows
const SHADOW_MAP_SIZE = 2048;
const SHADOW_HALF_WIDTH_M = 45; // rover shadow map, across the Sun direction
const SHADOW_HALF_HEIGHT_M = 30;
const SHADOW_DEPTH_M = 400; // along the Sun direction: rover shadows at 1.5° are ~40× the rover height
const MAX_PIXEL_RATIO = 1.5;
const PHYSICS_STEP = 1 / 60;
const CHUNK_REBUILDS_PER_FRAME = 2;
const MASK_BANDS: [number, number, number] = [16, 4, 2];

export interface MoonFrameState {
  seconds: number; // mission time; the HUD does not show it (time reads from the Sun)
  sun: SkyDirection;
  position: { x: number; y: number; z: number };
  speed: number;
  boundaryDistance: number; // meters to the operating boundary
  nearBoundary: boolean;
}

export interface MoonSceneOptions {
  container: HTMLElement;
  data: GameData;
  rover: RoverParams;
  onFrame?: (state: MoonFrameState) => void;
}

export interface MoonScene {
  dispose(): void;
}

export async function startMoonScene(opts: MoonSceneOptions): Promise<MoonScene> {
  const { container, data } = opts;
  const tuning = data.tuning;
  const [terrain, rapier] = await Promise.all([loadTerrain(), initRapier()]);
  const { fine, near, far, info } = terrain;
  const site = { latitudeDeg: info.sunAndEarth.siteLatitude_deg, longitudeDeg: info.sunAndEarth.siteLongitude_deg };

  // Renderer and cameras
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400_000);
  const sky = new Sky(skyDirection(tuning.earth.azimuthDeg, tuning.earth.elevationDeg));

  // Terrain: three chunked layers sharing one regolith material.
  const lightUniforms = createMoonLightUniforms(fine, near, far);
  const masks = new SunMasks(terrain, MASK_BANDS);
  lightUniforms.moonMaskFine.value = masks.fine;
  lightUniforms.moonMaskNear.value = masks.near;
  lightUniforms.moonMaskFar.value = masks.far;
  const terrainMaterial = patchMoonLighting(new THREE.MeshLambertMaterial({ color: REGOLITH_COLOR }), lightUniforms, true);
  const layers = [
    new ChunkLayer({ grid: fine, chunkCells: 100, lod: { steps: [1, 2, 4, 10], distances: [500, 1200, 2500, Infinity] } }, terrainMaterial),
    new ChunkLayer({ grid: near, chunkCells: 100, inner: fine, lod: { steps: [1, 2, 4], distances: [7000, 15000, Infinity] } }, terrainMaterial),
    new ChunkLayer({ grid: far, chunkCells: 100, inner: near, lod: { steps: [1, 2], distances: [50000, Infinity] } }, terrainMaterial),
  ];
  for (const layer of layers) scene.add(layer.group);

  // Lights: the Sun (rover shadows only; terrain shadows come from the sun masks) and a faint fill.
  const sunLight = new THREE.DirectionalLight(0xfff8f0, SUN_INTENSITY);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  Object.assign(sunLight.shadow.camera, {
    left: -SHADOW_HALF_WIDTH_M,
    right: SHADOW_HALF_WIDTH_M,
    top: SHADOW_HALF_HEIGHT_M,
    bottom: -SHADOW_HALF_HEIGHT_M,
    near: 1,
    far: SHADOW_DEPTH_M,
  });
  sunLight.shadow.camera.updateProjectionMatrix();
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight, sunLight.target, new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY));

  // Physics world with the operating boundary as invisible walls.
  const world = new rapier.World({ x: 0, y: -tuning.mission.gravity, z: 0 });
  world.timestep = PHYSICS_STEP;
  const limit = fine.extent - tuning.area.boundaryInsetM;
  for (const [x, z, hx, hz] of [
    [limit + 0.5, 0, 0.5, limit + 1],
    [-limit - 0.5, 0, 0.5, limit + 1],
    [0, limit + 0.5, limit + 1, 0.5],
    [0, -limit - 0.5, limit + 1, 0.5],
  ] as const) {
    world.createCollider(rapier.ColliderDesc.cuboid(hx, 3000, hz).setTranslation(x, 1000, z));
  }
  const colliders = new TerrainColliders(rapier, world, fine);

  // Rover at the landing point.
  const landing = info.landing.local;
  colliders.update(landing.x, landing.z);
  const rover = new RoverVehicle(world, rapier, opts.rover, tuning.rover, {
    x: landing.x,
    y: fine.sample(landing.x, landing.z),
    z: landing.z,
    headingDeg: tuning.rover.startHeadingDeg,
  });
  rover.object.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
      patchMoonLighting(obj.material, lightUniforms, false);
    }
  });
  scene.add(rover.object);
  const input = new KeyboardInput();
  const chase = new ChaseCamera(camera, (x, z) => terrain.heightAt(x, z));

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // Mission time drives the Sun.
  let seconds = 0;
  let timeScale = 1;
  const sunNow = () => sunAt(seconds, tuning.sun, tuning.mission, site);
  const forward = new THREE.Vector3();
  const placeSun = (sun: SkyDirection) => {
    const p = rover.position;
    sunLight.target.position.copy(p);
    sunLight.position.set(p.x + sun.x * SHADOW_DEPTH_M * 0.5, p.y + sun.y * SHADOW_DEPTH_M * 0.5, p.z + sun.z * SHADOW_DEPTH_M * 0.5);
    sunLight.target.updateMatrixWorld();
  };

  for (const layer of layers) layer.update(landing.x, landing.z, Infinity);
  masks.updateAll(renderer, sunNow());

  // Frame-time samples for performance checks.
  const frameTimes: number[] = [];
  let acc = 0;
  let last = performance.now();
  let frame = 0;
  let disposed = false;

  const loop = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    frameTimes.push(now - last);
    if (frameTimes.length > 120) frameTimes.shift();
    last = now;

    rover.setInput(input.read());
    acc += dt;
    let steps = 0;
    while (acc >= PHYSICS_STEP && steps < 5) {
      rover.update(PHYSICS_STEP);
      world.step();
      acc -= PHYSICS_STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    rover.sync();
    const pos = rover.position;
    colliders.update(pos.x, pos.z);
    for (const layer of layers) layer.update(pos.x, pos.z, CHUNK_REBUILDS_PER_FRAME);

    // Mission time follows simulated time, so a slow frame rate cannot cost the rover distance.
    seconds = Math.min(tuning.mission.lengthSeconds, seconds + steps * PHYSICS_STEP * timeScale);
    const sun = sunNow();
    placeSun(sun);
    masks.updateStep(renderer, sun);

    chase.update(dt, pos, rover.forward(forward));
    sky.update(camera, sun);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(sky.scene, sky.camera);
    renderer.clearDepth();
    renderer.render(scene, camera);

    const boundaryDistance = limit - Math.max(Math.abs(pos.x), Math.abs(pos.z));
    opts.onFrame?.({
      seconds,
      sun,
      position: { x: pos.x, y: pos.y, z: pos.z },
      speed: rover.speed,
      boundaryDistance,
      nearBoundary: boundaryDistance < tuning.area.warningDistanceM,
    });
  };
  frame = requestAnimationFrame(loop);

  // Development hooks for screenshots and tuning (not in production builds).
  if (import.meta.env.DEV) {
    (window as unknown as { __moon?: unknown }).__moon = {
      setTime(s: number) {
        seconds = s;
        masks.updateAll(renderer, sunNow());
      },
      setTimeScale(k: number) {
        timeScale = k;
      },
      teleport(x: number, z: number, headingDeg: number) {
        colliders.update(x, z);
        rover.teleport(x, fine.sample(x, z), z, headingDeg);
        for (const layer of layers) layer.update(x, z, Infinity);
        chase.reset();
      },
      drive(throttle: number, steer: number, brake = false) {
        input.override = { throttle, steer, brake };
      },
      release() {
        input.override = null;
      },
      setSpeedBoost(k: number) {
        rover.speedBoost = k;
      },
      stats() {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / Math.max(frameTimes.length, 1);
        const p = rover.position;
        const f = rover.forward(new THREE.Vector3());
        return {
          fps: 1000 / avg,
          frameMs: avg,
          seconds,
          sun: sunNow(),
          rover: {
            x: p.x,
            y: p.y,
            z: p.z,
            speed: rover.speed,
            topSpeed: opts.rover.topSpeed,
            forward: { x: f.x, y: f.y, z: f.z },
            wheelsInContact: rover.wheelsInContact,
          },
          colliders: colliders.count,
          vertices: layers.map((l) => l.vertexCount),
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        };
      },
    };
  }

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      input.dispose();
      rover.dispose();
      world.free();
      for (const layer of layers) layer.dispose();
      terrainMaterial.dispose();
      masks.dispose();
      sky.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      if (import.meta.env.DEV) delete (window as unknown as { __moon?: unknown }).__moon;
    },
  };
}

