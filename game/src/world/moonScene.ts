// The drivable world (the Moon, Mars or Titan): terrain, rover, Sun with moving shadows, sky, and the operating
// boundary. The mission screen starts it and runs the mission systems on top through onStep and onFrame.
// The world's sky model (worlds.ts) picks the look: the lunar black sky and regolith photometry, or the
// Mars dust sky, ground color, sky light, fog and storm haze (marsLook.ts, marsSky.ts), or the Titan haze
// sky, dim diffuse light, fog and methane rain (titanLook.ts, titanSky.ts, numbers in tuning.look).
import * as THREE from 'three';
import type { GameData, Part } from '../rules/types';
import type { RoverParams } from '../rules/drive';
import { skyDirection, sunAt, type SkyDirection } from '../rules/sun';
import { horizonMarginTan, loadTerrain, type Terrain } from './terrainData';
import { Boulders } from './boulders';
import { Lander } from './lander';
import type { SoftArea } from '../rules/ground';
import { ChunkLayer } from './terrainChunks';
import { SunMasks } from './sunMask';
import { ALBEDO_MEAN, createMoonLightUniforms, patchMoonLighting, type Photometry } from './lunarLighting';
import { Sky } from './sky';
import { MarsSky } from './marsSky';
import { MARS_GROUND_HEX, marsLook, type MarsLook } from './marsLook';
import { TitanRain, TitanSky } from './titanSky';
import { titanLook, type TitanLook } from './titanLook';
import { TerrainColliders } from './terrainColliders';
import { initRapier } from './physics';
import { terrainUrl, WORLDS, type WorldId } from '../worlds';
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
const ALBEDO_EDGE_FADE_M = 150; // the LROC albedo blends to the plain regolith tone at the play-area edge
const MAX_ANISOTROPY = 8;
// Mars: the Sun moves 1.5°/s near the horizon and up to 5°/s at noon (the Moon's 0.6°/s), so the masks
// refresh in fewer bands (a full refresh in 10 frames, no single band costlier than the Moon's largest),
// and not at all once the Sun is well below the horizon.
const MARS_MASK_BANDS: [number, number, number] = [4, 4, 2];
const MARS_MASK_MIN_ELEVATION_DEG = -3;
const MARS_ALBEDO_CONTRAST = 0.7; // HiRISE images are stretched: keep the ground's contrast in check
const STORM_EASE_S = 2; // the haze eases toward the storm intensity it is given

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
  brake?: boolean; // hold the brakes (Titan: a powered-down rover, or one that cannot drive, brakes to a stop)
}

export interface MoonSceneOptions {
  container: HTMLElement;
  /** Which world's terrain, albedo, sky and lighting to use. */
  world: WorldId;
  /** Where the Sun is after `seconds` of mission time. Default: the lunar model (rules/sun.ts sunAt). */
  sunAt?: (seconds: number) => SkyDirection;
  /**
   * Mission seconds that pass in `wallDt` seconds of physics at mission time `seconds` (Titan: the sleep
   * fast-forward, rules/titan.ts titanMissionDelta). Default: the same as the physics time. Physics always
   * runs at wall time.
   */
  missionDelta?: (wallDt: number, seconds: number) => number;
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
  /** Dust-storm haze (Mars) or methane rain (Titan), 0 (clear) to 1 (peak); the view eases toward it. Ignored on the Moon. */
  setStorm(intensity: number): void;
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
// Mars floodlights: softer and warmer than the Moon's, so the night ground in front of the rover reads as
// ground, not a blown-out white wedge (the Mars night already has some sky light).
const MARS_FLOODLIGHT = { color: 0xffe8cc, intensity: 70, angle: 0.65, penumbra: 0.9, decay: 1.0, targetDrop: 0.8 };
const HARD_STOP_KEEP = 0.9; // share of horizontal velocity kept per physics step during a hard stop

export async function startMoonScene(opts: MoonSceneOptions): Promise<MoonScene> {
  const { container, data } = opts;
  const tuning = data.tuning;
  const skyModel = WORLDS[opts.world].sky;
  // Titan's look lives in data (tuning.look); a Titan world without it falls back to the Mars model.
  const titanTuning = skyModel === 'titan' && tuning.look?.colors ? tuning.look : undefined;
  const titan = !!titanTuning;
  const [terrain, rapier, albedo] = await Promise.all([loadTerrain(opts.world), initRapier(), loadAlbedo(opts.world, skyModel !== 'moon')]);
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
  const mars = skyModel !== 'moon' && !titan; // Mars, or a hazy world without its own look yet
  const marsSky = mars ? new MarsSky() : null;
  const titanSky = titanTuning ? new TitanSky(titanTuning.sunDisc.radiusDeg) : null;
  const sky = marsSky ?? titanSky ?? new Sky(skyDirection(tuning.earth.azimuthDeg, tuning.earth.elevationDeg));
  const hazy = mars || titan; // a sky that lights the scene: hemisphere light, fog, storm or rain haze
  const photometry: Photometry = titan ? 'titan' : mars ? 'mars' : true;
  const groundColor = titanTuning ? new THREE.Color(titanTuning.ground.color).getHex() : mars ? MARS_GROUND_HEX : REGOLITH_COLOR;

  // Terrain: three chunked layers sharing one regolith material.
  const lightUniforms = createMoonLightUniforms(fine, near, far);
  const masks = new SunMasks(terrain, titanTuning ? titanTuning.sunMask.bands : mars ? MARS_MASK_BANDS : MASK_BANDS);
  const maskMinElevationDeg = titanTuning ? titanTuning.sunMask.minElevationDeg : mars ? MARS_MASK_MIN_ELEVATION_DEG : -Infinity;
  lightUniforms.moonMaskFine.value = masks.fine;
  lightUniforms.moonMaskNear.value = masks.near;
  lightUniforms.moonMaskFar.value = masks.far;
  if (albedo) {
    albedo.texture.anisotropy = Math.min(MAX_ANISOTROPY, renderer.capabilities.getMaxAnisotropy());
    lightUniforms.moonAlbedo.value = albedo.texture;
    lightUniforms.moonAlbedoRect.value.set(albedo.minX, albedo.minZ, albedo.span, ALBEDO_EDGE_FADE_M);
    if (mars) lightUniforms.moonAlbedoTone.value.set(albedo.mean ?? ALBEDO_MEAN, MARS_ALBEDO_CONTRAST);
    if (titanTuning) lightUniforms.moonAlbedoTone.value.set(albedo.mean ?? ALBEDO_MEAN, titanTuning.ground.albedoContrast);
  } else {
    // No map: a 1×1 texture at the mean albedo, so the shader stays the same and the ground is plain.
    lightUniforms.moonAlbedo.value = plainAlbedo();
  }
  if (titanTuning) {
    const g = titanTuning.ground;
    lightUniforms.moonDarkTint.value.set(g.darkSandTint); // sRGB hex to the linear working space
    lightUniforms.moonDarkTone.value.set(g.darkToneLow, g.darkToneHigh);
    lightUniforms.moonTitanRelief.value.set(g.reliefGain, g.reliefOcclusion, g.reliefNearM, g.reliefFarM);
    lightUniforms.moonHazeShape.value = titanTuning.fog.shapePower;
  }
  // The play area gets the albedo map and fine detail; the distant rings stay plain regolith of the same mean tone.
  const groundMaterial = patchMoonLighting(new THREE.MeshLambertMaterial({ color: groundColor }), lightUniforms, photometry, true);
  const terrainMaterial = patchMoonLighting(new THREE.MeshLambertMaterial({ color: groundColor }), lightUniforms, photometry);
  const layers = [
    new ChunkLayer({ grid: fine, chunkCells: 100, lod: { steps: [1, 2, 4, 10], distances: [500, 1200, 2500, Infinity] } }, groundMaterial),
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
  if (titanTuning) sunLight.shadow.radius = titanTuning.shadowRadius; // diffuse light: soft rover shadows
  // Mars and Titan: sunlight color and strength, sky light and fog follow the Sun's height and the storm (rain) each frame.
  const skyLight = hazy ? new THREE.HemisphereLight(0xffffff, 0x000000, 1) : new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
  scene.add(sunLight, sunLight.target, skyLight);
  const fog = hazy ? new THREE.FogExp2(0x000000, 0) : null;
  scene.fog = fog;
  const rain = titanTuning
    ? new TitanRain({ count: titanTuning.rain.streakCount, boxM: titanTuning.rain.streakBoxM, fallMps: titanTuning.rain.fallMps, lengthM: titanTuning.rain.streakLengthM })
    : null;
  if (rain) scene.add(rain.object);
  let storm = 0;
  let stormTarget = 0;
  let look: MarsLook | TitanLook | null = null;
  const applyHazeLook = (l: Pick<MarsLook, 'sun' | 'skyLight' | 'groundLight' | 'fog' | 'fogDensity'>) => {
    if (!fog) return;
    sunLight.intensity = 1; // the look's sunlight color carries its strength
    sunLight.color.setRGB(...l.sun);
    const hemi = skyLight as THREE.HemisphereLight;
    hemi.color.setRGB(...l.skyLight);
    hemi.groundColor.setRGB(...l.groundLight);
    fog.color.setRGB(...l.fog);
    fog.density = l.fogDensity;
  };
  const applyMarsLook = (sun: SkyDirection) => {
    if (marsSky) {
      const l = marsLook(sun.elevationDeg, storm);
      look = l;
      applyHazeLook(l);
      marsSky.setLook(l);
    } else if (titanSky && titanTuning) {
      const l = titanLook(sun.elevationDeg, storm, titanTuning);
      look = l;
      applyHazeLook(l);
      titanSky.setLook(l);
    }
  };

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
  const lander = new Lander(world, rapier, { x: landing.x, z: landing.z, headingDeg: tuning.rover.startHeadingDeg }, (x, z) => fine.sample(x, z));
  for (const object of [rover.object, lander.object]) {
    object.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
        patchMoonLighting(obj.material, lightUniforms, false);
      }
    });
  }
  scene.add(rover.object, lander.object);
  let lamp: THREE.SpotLight | null = null;
  const titanLamp = titanTuning?.floodlight;
  const lampIntensity = titanLamp ? titanLamp.intensity : mars ? MARS_FLOODLIGHT.intensity : FLOODLIGHT_INTENSITY;
  if (opts.lightRangeM) {
    // Floodlights: what lets the rover see inside permanent shadow. Off until it is dark.
    lamp = titanLamp
      ? new THREE.SpotLight(new THREE.Color(titanLamp.color), lampIntensity, opts.lightRangeM, titanLamp.angle, titanLamp.penumbra, titanLamp.decay)
      : mars
        ? new THREE.SpotLight(MARS_FLOODLIGHT.color, lampIntensity, opts.lightRangeM, MARS_FLOODLIGHT.angle, MARS_FLOODLIGHT.penumbra, MARS_FLOODLIGHT.decay)
        : new THREE.SpotLight(0xf4f1ea, lampIntensity, opts.lightRangeM, 0.6, 0.5, 1.2);
    lamp.intensity = 0; // intensity, not visibility: a changing light count would recompile every shader
    lamp.position.set(tuning.rover.body.lengthM / 2, 0.4, 0);
    lamp.target.position.set(tuning.rover.body.lengthM / 2 + 10, titanLamp ? -titanLamp.targetDrop : mars ? -MARS_FLOODLIGHT.targetDrop : -1.2, 0);
    rover.object.add(lamp, lamp.target);
  }
  const boulders = new Boulders(rapier, world, opts.boulderAreas ?? [], tuning.boulders, (x, z) => fine.sample(x, z));
  patchMoonLighting(boulders.mesh.material as THREE.MeshLambertMaterial, lightUniforms, photometry);
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
  let orbit: { azimuthDeg: number; distance: number; height: number } | null = null; // development close-up camera
  let shakeLeft = 0;
  let limits: MoonDriveLimits = { allowForward: true, allowReverse: true, speedFactor: 1 };
  const lastVel = rover.velocity(new THREE.Vector3());
  const vel = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const limitInput = (raw: DriveInput): DriveInput => {
    if (limits.brake) return { ...raw, throttle: 0, brake: true };
    if ((raw.throttle > 0 && !limits.allowForward) || (raw.throttle < 0 && !limits.allowReverse)) return { ...raw, throttle: 0 };
    return raw;
  };
  let sunOverride: SkyDirection | null = null; // development: hold the Sun at a set direction
  let lampOverride: boolean | null = null; // development: force the floodlights on or off
  const sunNow = () => sunOverride ?? (opts.sunAt ? opts.sunAt(seconds) : sunAt(seconds, tuning.sun, tuning.mission, site));
  const forward = new THREE.Vector3();
  const placeSun = (sun: SkyDirection) => {
    const p = rover.position;
    sunLight.target.position.copy(p);
    sunLight.position.set(p.x + sun.x * SHADOW_DEPTH_M * 0.5, p.y + sun.y * SHADOW_DEPTH_M * 0.5, p.z + sun.z * SHADOW_DEPTH_M * 0.5);
    sunLight.target.updateMatrixWorld();
  };

  for (const layer of layers) layer.update(landing.x, landing.z, Infinity);
  masks.updateAll(renderer, sunNow());
  applyMarsLook(sunNow());

  const draw = () => {
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(sky.scene, sky.camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
  };
  const ndc = new THREE.Vector3();

  // Airborne statistics for tuning the ride over bumps (development only).
  const air = { steps: 0, airSteps: 0, partSteps: 0, run: 0, longestS: 0, hops: 0, maxRiseMps: 0, maxClearM: 0, maxDeltaV: 0, distM: 0 };
  let airLast: { x: number; z: number } | null = null;
  const recordAir = (vy: number, dv: number) => {
    const c = rover.wheelsInContact;
    const p = rover.position;
    if (Math.abs(rover.speed) < 1) return; // only while driving
    air.steps++;
    if (airLast) air.distM += Math.hypot(p.x - airLast.x, p.z - airLast.z);
    airLast = { x: p.x, z: p.z };
    air.maxDeltaV = Math.max(air.maxDeltaV, dv);
    if (c < 4) air.partSteps++;
    if (c === 0) {
      air.airSteps++;
      if (air.run === 0) air.hops++;
      air.run++;
      air.longestS = Math.max(air.longestS, air.run * PHYSICS_STEP);
      air.maxRiseMps = Math.max(air.maxRiseMps, vy);
      const h = tuning.rover;
      const ride = h.body.heightM / 2 - 0.12 + h.suspension.restLengthM + h.wheelRadiusM;
      air.maxClearM = Math.max(air.maxClearM, p.y - fine.sample(p.x, p.z) - ride);
    } else air.run = 0;
  };

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
      const airStep = rover.airDownAccel * PHYSICS_STEP; // extra pull while wheels are off the ground
      if (limits.hardStop) rover.damp(HARD_STOP_KEEP);
      world.step();
      acc -= PHYSICS_STEP;
      steps++;
      // Mission time follows simulated time, so a slow frame rate cannot cost the rover distance.
      const wallDt = PHYSICS_STEP * timeScale;
      const stepDt = clockRunning ? (opts.missionDelta ? opts.missionDelta(wallDt, seconds) : wallDt) : 0;
      seconds = Math.min(tuning.mission.lengthSeconds, seconds + stepDt);
      rover.sync();
      rover.velocity(vel);
      const deltaV = Math.hypot(vel.x - lastVel.x, vel.y - lastVel.y + tuning.mission.gravity * tuning.rover.gravityScale * PHYSICS_STEP + airStep, vel.z - lastVel.z);
      lastVel.copy(vel);
      if (import.meta.env.DEV) recordAir(vel.y, deltaV);
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
    // Mars and Titan nights: the Sun is far below the horizon and gives no light, so the masks can wait for dawn.
    if (sun.elevationDeg > maskMinElevationDeg) masks.updateStep(renderer, sun);
    if (hazy) {
      storm += (stormTarget - storm) * Math.min(1, dt / STORM_EASE_S);
      applyMarsLook(sun);
    }

    chase.update(dt, pos, rover.forward(forward));
    if (orbit) {
      const a = (orbit.azimuthDeg * Math.PI) / 180;
      camera.position.set(pos.x + Math.sin(a) * orbit.distance, pos.y + orbit.height, pos.z - Math.cos(a) * orbit.distance);
      camera.lookAt(pos.x, pos.y + 0.2, pos.z);
    }
    if (shakeLeft > 0) {
      shakeLeft = Math.max(0, shakeLeft - dt);
      const a = SHAKE_AMPLITUDE_M * Math.min(1, shakeLeft);
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
      camera.position.z += (Math.random() - 0.5) * a;
    }
    sky.update(camera, sun);
    if (rain && look && 'rainStreaks' in look) rain.update(paused ? 0 : dt, camera, look.rainStreaks, look.rainColor);
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
      /** Hold the Sun at a sky direction (deg); null returns it to mission time. */
      setSun(azimuthDeg: number | null, elevationDeg = 0) {
        sunOverride = azimuthDeg === null ? null : skyDirection(azimuthDeg, elevationDeg);
        masks.updateAll(renderer, sunNow());
        applyMarsLook(sunNow());
      },
      /** Set the storm haze at once (no easing), 0..1. */
      setStorm(k: number) {
        stormTarget = storm = Math.min(1, Math.max(0, k));
        applyMarsLook(sunNow());
      },
      /** Force the floodlights on or off (null: back to the mission's choice). */
      lamp(on: boolean | null) {
        lampOverride = on;
        if (lamp && on !== null) lamp.intensity = on ? lampIntensity : 0;
      },
      /** The current Mars or Titan look (null on the Moon). */
      look() {
        return look;
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
      /** Look at the rover from a world azimuth (deg), distance and height (m); null returns to the chase camera. */
      orbit(view: { azimuthDeg: number; distance: number; height: number } | null) {
        orbit = view;
      },
      setSpeedBoost(k: number) {
        rover.speedBoost = k;
      },
      /** Airborne statistics while driving since the last reset (wheel contact per physics step). */
      air() {
        return { ...air, airShare: air.airSteps / Math.max(1, air.steps), partShare: air.partSteps / Math.max(1, air.steps), hopsPerKm: air.hops / Math.max(0.001, air.distM / 1000) };
      },
      resetAir() {
        Object.assign(air, { steps: 0, airSteps: 0, partSteps: 0, run: 0, longestS: 0, hops: 0, maxRiseMps: 0, maxClearM: 0, maxDeltaV: 0, distM: 0 });
        airLast = null;
      },
      /** Retune the shared handling live (development only), e.g. { airGravityScale: 16 } or { suspension: {...} }. */
      tune(patch: Partial<typeof tuning.rover>) {
        const h = tuning.rover as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(patch)) h[k] = typeof v === 'object' && v ? { ...(h[k] as object), ...v } : v;
        rover.applyHandling();
        return tuning.rover;
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
    setStorm(intensity: number) {
      stormTarget = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : 0));
    },
    setFloodlights(on: boolean) {
      if (lamp) lamp.intensity = (lampOverride ?? on) ? lampIntensity : 0;
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
      rain?.dispose();
      rover.dispose();
      lander.dispose();
      world.free();
      for (const layer of layers) layer.dispose();
      terrainMaterial.dispose();
      groundMaterial.dispose();
      lightUniforms.moonAlbedo.value?.dispose();
      masks.dispose();
      sky.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      if (import.meta.env.DEV) delete (window as unknown as { __moon?: unknown }).__moon;
    },
  };
}


/** The parts of texture.json the game reads. */
interface TextureInfo {
  playArea: { file: string; size_px: [number, number]; pixel_m: number };
}

/**
 * The LROC albedo map of the play area (public/terrain/texture.json): pixel (col, row) is centered
 * on heightmap vertex (col, row), so the image spans half a pixel beyond the grid on each side.
 * Returns null if it fails to load: the ground is then plain regolith. `measureMean`: also measure the
 * image's mean linear value (Mars: the grayscale HiRISE image is relative brightness on the ground color).
 */
async function loadAlbedo(
  world: WorldId,
  measureMean = false,
): Promise<{ texture: THREE.Texture; minX: number; minZ: number; span: number; mean?: number } | null> {
  try {
    const base = terrainUrl(world);
    const res = await fetch(`${base}texture.json`);
    if (!res.ok) return null;
    const { playArea: p } = (await res.json()) as TextureInfo;
    const texture = await new THREE.TextureLoader().loadAsync(base + p.file);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false; // row 0 is grid north (−z): v = 0 there
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    const span = p.size_px[0] * p.pixel_m;
    const mean = measureMean ? meanLinear(texture.image as CanvasImageSource) : undefined;
    return { texture, minX: -span / 2, minZ: -span / 2, span, mean };
  } catch {
    return null;
  }
}

/** Mean linear value of an sRGB grayscale image (red channel), measured on a small copy. */
function meanLinear(image: CanvasImageSource): number | undefined {
  try {
    const n = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0, n, n);
    const px = ctx.getImageData(0, 0, n, n).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      const v = px[i]! / 255;
      sum += v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    const mean = sum / (n * n);
    return mean > 1e-3 ? mean : undefined;
  } catch {
    return undefined;
  }
}

function plainAlbedo(): THREE.Texture {
  const srgb = new THREE.Color().setRGB(ALBEDO_MEAN, ALBEDO_MEAN, ALBEDO_MEAN, THREE.LinearSRGBColorSpace)
    .getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  const v = Math.round(srgb.r * 255);
  const texture = new THREE.DataTexture(new Uint8Array([v, v, v, 255]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
