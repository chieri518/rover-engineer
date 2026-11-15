// The drivable Moon: terrain, rover, low Sun with moving shadows, sky, and the operating boundary.
// The mission screen starts it and runs the mission systems on top through onStep and onFrame.
import * as THREE from 'three';
import type { GameData, Part } from '../rules/types';
import type { RoverParams } from '../rules/drive';
import { skyDirection, sunAt, type SkyDirection } from '../rules/sun';
import { horizonMarginTan, loadTerrain, type Terrain } from './terrainData';
import { Boulders } from './boulders';
import type { SoftArea } from '../rules/ground';
import { ChunkLayer } from './terrainChunks';
import { SunMasks } from './sunMask';
import { createMoonLightUniforms, patchMoonLighting } from './lunarLighting';
import { Sky } from './sky';
import { TerrainColliders } from './terrainColliders';
import { initRapier } from './physics';
import { RoverVehicle } from '../rover/vehicle';
import { KeyboardInput } from '../rover/input';
import type { DriveInput } from '../rover/vehicle';
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
  forward: { x: number; y: number; z: number };
  boundaryDistance: number; // meters to the operating boundary
  nearBoundary: boolean;
}

interface Vec3 { x: number; y: number; z: number }

/** What happened to the rover in one physics step, for the mission systems. */
export interface MoonStepSample {
  dt: number; // mission seconds in this step (0 once the clock is stopped)
  seconds: number;
  position: Vec3;
  velocity: Vec3;
  speed: number; // signed forward speed
  forward: Vec3;
  upY: number; // y of the rover's up vector: 1 upright, below 0 upside down
  deltaV: number; // sudden change in velocity this step, beyond gravity (m/s): impacts
  input: DriveInput; // what the driver asked for
}

/** What the mission systems allow for the next physics step. */
export interface MoonDriveLimits {
  allowForward: boolean;
  allowReverse: boolean;
  speedFactor: number; // multiplies the top speed
  hardStop?: boolean; // stop the rover now, even downhill (e.g. at the edge of permanent shadow)
}

export interface MoonSceneOptions {
  container: HTMLElement;
  data: GameData;
  rover: RoverParams;
  parts?: Part[]; // the selected parts, for the rover model
  boulderAreas?: SoftArea[];
  lightRangeM?: number; // floodlights on the rover (0 or undefined: none)
  onFrame?: (state: MoonFrameState) => void;
  onStep?: (sample: MoonStepSample) => MoonDriveLimits | void;
}

export interface MoonScene {
  terrain: Terrain;
  /** Stop mission time (the Sun stops moving) once the mission has ended. */
  stopClock(): void;
  /** Pause or resume physics and mission time (e.g. while the tutorial is open). The view keeps drawing. */
  setPaused(paused: boolean): void;
  /** Switch the floodlights (if the rover has them). */
  setFloodlights(on: boolean): void;
  /** Shake the camera, e.g. for a moonquake. */
  shake(seconds: number): void;
  /** Render the current view and return it as a JPEG data URL, at most maxWidth pixels wide. */
  capture(maxWidth: number): string;
  /** Is a body in this sky direction above the terrain horizon seen from the camera, and inside the frame? */
  inView(dir: SkyDirection, frameMargin: number): boolean;
  dispose(): void;
}

const SHAKE_AMPLITUDE_M = 0.35;
const FLOODLIGHT_INTENSITY = 300;
const HARD_STOP_KEEP = 0.9; // share of horizontal velocity kept per physics step during a hard stop

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
  }, opts.parts ?? []);
  rover.object.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
      patchMoonLighting(obj.material, lightUniforms, false);
    }
  });
  scene.add(rover.object);
  let lamp: THREE.SpotLight | null = null;
  if (opts.lightRangeM) {
    // Floodlights: what lets the rover see inside permanent shadow. Off until it is dark.
    lamp = new THREE.SpotLight(0xf4f1ea, FLOODLIGHT_INTENSITY, opts.lightRangeM, 0.6, 0.5, 1.2);
    lamp.intensity = 0; // intensity, not visibility: a changing light count would recompile every shader
    lamp.position.set(tuning.rover.body.lengthM / 2, 0.4, 0);
    lamp.target.position.set(tuning.rover.body.lengthM / 2 + 10, -1.2, 0);
    rover.object.add(lamp, lamp.target);
  }
  const boulders = new Boulders(rapier, world, opts.boulderAreas ?? [], tuning.boulders, (x, z) => fine.sample(x, z));
  patchMoonLighting(boulders.mesh.material as THREE.MeshLambertMaterial, lightUniforms, true);
  scene.add(boulders.mesh);
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
  let clockRunning = true;
  let paused = false;
  let shakeLeft = 0;
  let limits: MoonDriveLimits = { allowForward: true, allowReverse: true, speedFactor: 1 };
  const gravityStep = tuning.mission.gravity * tuning.rover.gravityScale * PHYSICS_STEP;
  const lastVel = rover.velocity(new THREE.Vector3());
  const vel = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const limitInput = (raw: DriveInput): DriveInput => {
    if ((raw.throttle > 0 && !limits.allowForward) || (raw.throttle < 0 && !limits.allowReverse)) return { ...raw, throttle: 0 };
    return raw;
  };
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

  const draw = () => {
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(sky.scene, sky.camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
  };
  const ndc = new THREE.Vector3();

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

    const raw = input.read();
    acc = paused ? 0 : acc + dt;
    let steps = 0;
    while (acc >= PHYSICS_STEP && steps < 5) {
      rover.setInput(limitInput(raw));
      rover.speedFactor = limits.speedFactor;
      rover.update(PHYSICS_STEP);
      if (limits.hardStop) rover.damp(HARD_STOP_KEEP);
      world.step();
      acc -= PHYSICS_STEP;
      steps++;
      // Mission time follows simulated time, so a slow frame rate cannot cost the rover distance.
      const stepDt = clockRunning ? PHYSICS_STEP * timeScale : 0;
      seconds = Math.min(tuning.mission.lengthSeconds, seconds + stepDt);
      rover.sync();
      rover.velocity(vel);
      const deltaV = Math.hypot(vel.x - lastVel.x, vel.y - lastVel.y + gravityStep, vel.z - lastVel.z);
      lastVel.copy(vel);
      if (opts.onStep) {
        const p = rover.position;
        rover.forward(fwd);
        const next = opts.onStep({
          dt: stepDt,
          seconds,
          position: { x: p.x, y: p.y, z: p.z },
          velocity: { x: vel.x, y: vel.y, z: vel.z },
          speed: rover.speed,
          forward: { x: fwd.x, y: fwd.y, z: fwd.z },
          upY: rover.up(up).y,
          deltaV,
          input: raw,
        });
        if (next) limits = next;
      }
    }
    if (steps === 5) acc = 0;
    rover.sync();
    const pos = rover.position;
    colliders.update(pos.x, pos.z);
    for (const layer of layers) layer.update(pos.x, pos.z, CHUNK_REBUILDS_PER_FRAME);

    const sun = sunNow();
    placeSun(sun);
    masks.updateStep(renderer, sun);

    chase.update(dt, pos, rover.forward(forward));
    if (shakeLeft > 0) {
      shakeLeft = Math.max(0, shakeLeft - dt);
      const a = SHAKE_AMPLITUDE_M * Math.min(1, shakeLeft);
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
      camera.position.z += (Math.random() - 0.5) * a;
    }
    sky.update(camera, sun);
    draw();

    const boundaryDistance = limit - Math.max(Math.abs(pos.x), Math.abs(pos.z));
    opts.onFrame?.({
      seconds,
      sun,
      position: { x: pos.x, y: pos.y, z: pos.z },
      speed: rover.speed,
      forward: { x: forward.x, y: forward.y, z: forward.z },
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
        rover.velocity(lastVel);
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
      tipOver(rollDeg = 180) {
        rover.tipOver(rollDeg);
      },
      boulders() {
        return boulders.list;
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
    terrain,
    stopClock() {
      clockRunning = false;
    },
    setPaused(p: boolean) {
      paused = p;
    },
    setFloodlights(on: boolean) {
      if (lamp) lamp.intensity = on ? FLOODLIGHT_INTENSITY : 0;
    },
    shake(secondsToShake: number) {
      shakeLeft = Math.max(shakeLeft, secondsToShake);
    },
    capture(maxWidth: number) {
      // Draw again and copy in the same task: the WebGL buffer is not kept between frames.
      draw();
      const src = renderer.domElement;
      const k = Math.min(1, maxWidth / Math.max(src.width, 1));
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(src.width * k));
      out.height = Math.max(1, Math.round(src.height * k));
      out.getContext('2d')!.drawImage(src, 0, 0, out.width, out.height);
      return out.toDataURL('image/jpeg', 0.85);
    },
    inView(dir: SkyDirection, frameMargin: number) {
      const c = camera.position;
      ndc.set(c.x + dir.x * 1000, c.y + dir.y * 1000, c.z + dir.z * 1000).project(camera);
      const inFrame = ndc.z < 1 && Math.abs(ndc.x) <= frameMargin && Math.abs(ndc.y) <= frameMargin;
      return inFrame && horizonMarginTan(terrain, c.x, c.z, c.y, dir) > 0;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      input.dispose();
      boulders.dispose();
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

