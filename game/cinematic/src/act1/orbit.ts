// Shot 3, "orbit": about 110 km up over the western Atlantic at sunrise. The rocket climbs east, pitched over;
// its exhaust, expanded in the near-vacuum, is a huge translucent bell lit by the sun. The first stage cuts off and
// separates, tumbling back; the upper stage lights its vacuum engine (the nozzle extension glowing) and pulls away.
//
// Frame: metres, y up at the point below the scene origin, +x east, -z north. The upper stage sits near the origin;
// the planet's centre is far below.
import * as THREE from 'three';
import type { FrameState, FrameView, SequenceContext } from '../timeline';
import type { PostParams } from '../post';
import { ROCKET, type Rocket } from './rocket';
import { buildEarth, EARTH_R, moveEarth } from './earth';
import { Plume } from './plume';
import { Kind, SmokeSystem, type Spawn } from './particles';
import { ACT1_CUES, ACT1_SHOTS } from './timing';
import { clamp01, easeInOutSine, lerp, smoothstep, shake } from '../lib/ease';
import { DBG } from './debug';

const ALT = 112e3;
const LAT0 = 27.2;
const LON0 = -79.6;
const PITCH = THREE.MathUtils.degToRad(26);
/** Sun: low in the east-north-east, just risen at the point below. */
const SUN_EL = THREE.MathUtils.degToRad(7);
const SUN_AZ = THREE.MathUtils.degToRad(112); // from north toward east
const GROUND_SPEED = 2100; // m/s, eastward

const DUR = ACT1_SHOTS[2]!.duration;
const MECO = ACT1_CUES.separation.t - 0.32;
const SEP = ACT1_CUES.separation.t;
const MVAC = ACT1_CUES.upperIgnition.t;

export async function buildOrbit(ctx: SequenceContext, rocket: Rocket) {
  const { renderer } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const camera = new THREE.PerspectiveCamera(36, ctx.width / ctx.height, 0.3, 3e7);
  const sunDir = new THREE.Vector3(Math.cos(SUN_EL) * Math.sin(SUN_AZ), Math.sin(SUN_EL), -Math.cos(SUN_EL) * Math.cos(SUN_AZ)).normalize();

  const earth = await buildEarth(renderer, { lat0: LAT0, lon0: LON0, alt: ALT });
  earth.setSun(sunDir);
  scene.add(earth.group);

  // The sun's disc (far behind everything, hidden by the planet when it is below the limb).
  const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.92).multiplyScalar(120) });
  const sunDist = 1.6e7;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(sunDist * 0.0047, 32, 16), sunMat);
  sun.position.copy(sunDir).multiplyScalar(sunDist);
  scene.add(sun);

  // Light: the sun (unfiltered up here) and a faint blue earthshine from below.
  const sunLight = new THREE.DirectionalLight(0xfff6ec, 7);
  sunLight.position.copy(sunDir).multiplyScalar(500);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -45;
  sc.right = 45;
  sc.top = 45;
  sc.bottom = -45;
  sc.near = 100;
  sc.far = 1000;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight, sunLight.target);
  scene.add(new THREE.HemisphereLight(0x000000, 0x6a7a90, 1.6));

  // Environment for reflections: black space, a bright blue-orange limb band, a dark planet below.
  const envScene = new THREE.Scene();
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sunDir: { value: sunDir } },
    vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir; varying vec3 vD;
      void main() {
        vec3 d = normalize(vD);
        float dip = -0.185;
        float toward = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0), 3.0);
        float band = exp(-pow((d.y - dip) / 0.03, 2.0));
        vec3 c = vec3(0.0);
        c += band * mix(vec3(0.05, 0.12, 0.35), vec3(1.4, 0.6, 0.25), toward);
        c += step(d.y, dip) * mix(vec3(0.004, 0.006, 0.012), vec3(0.06, 0.08, 0.12), toward);
        c += vec3(1.0, 0.95, 0.9) * 60.0 * pow(max(dot(d, sunDir), 0.0), 2000.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), envMat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 1000);
  pmrem.dispose();
  envMat.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1;

  // Vacuum plumes: the first stage's five engines merge into one wide bell; the upper stage's single engine.
  const plume1 = new Plume({ boundR: 220, boundL: 380, engines: [[0, 0]], exitR: 1.9, vacuum: true });
  plume1.mesh.position.y = ROCKET.bellExitY;
  const plume2 = new Plume({ boundR: 150, boundL: 260, engines: [[0, 0]], exitR: ROCKET.mvacExitR, vacuum: true });
  plume2.mesh.position.y = ROCKET.mvacExitY;

  const axis = new THREE.Vector3(Math.cos(PITCH), Math.sin(PITCH), 0);
  const rocketQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  const rocketOrigin = axis.clone().multiplyScalar(-46);

  // Separation: puffs of gas from the interstage joint (pushers, vents), lit by the sun (world frame).
  const spawns: Spawn[] = [];
  const toWorld = (p: [number, number, number], point: boolean): [number, number, number] => {
    const v = new THREE.Vector3(...p).applyQuaternion(rocketQuat);
    if (point) v.add(rocketOrigin);
    return [v.x, v.y, v.z];
  };
  {
    let seed = 0x5e9a;
    const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2;
      const sp = 2 + r() * 6;
      spawns.push({
        tb: SEP + r() * 0.15,
        life: 2.5 + r() * 1.5,
        p: toWorld([Math.cos(a) * 2.1, ROCKET.stage1Top - 0.2, Math.sin(a) * 2.1], true),
        v: toWorld([Math.cos(a) * sp, -1 - r() * 2, Math.sin(a) * sp], false),
        drag: 0.25,
        buoy: 0,
        size0: 0.4 + r() * 0.6,
        grow: 4 + r() * 4,
        rot: r() * 6.28,
        spin: (r() - 0.5) * 0.6,
        kind: Kind.Steam,
        tint: 0.9,
        opacity: 0.07 + r() * 0.08,
        heat: 0,
        cool: 1,
        fadeIn: 0.05,
      });
    }
  }
  const gas = new SmokeSystem({ renderer, spawns, wind: new THREE.Vector3(), groundAt: () => -1e9 });
  gas.uniforms.skyAmb.value.set(0.01, 0.015, 0.03);
  gas.uniforms.groundAmb.value.set(0.02, 0.03, 0.05);
  gas.uniforms.dawnDir.value.copy(sunDir);
  gas.uniforms.dawnCol.value.set(5, 4.8, 4.5);
  gas.setLights({ pos: [], col: [], radius: [] });
  scene.add(gas.far.mesh, gas.near.mesh);

  const depthRT = new THREE.WebGLRenderTarget(ctx.width, ctx.height, { depthBuffer: true });
  depthRT.depthTexture = new THREE.DepthTexture(ctx.width, ctx.height, THREE.FloatType);
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const res = new THREE.Vector2(ctx.width, ctx.height);
  const logFar = Math.log2(camera.far + 1);
  for (const u of [plume1.uniforms, plume2.uniforms, gas.uniforms]) {
    u.tDepth.value = depthRT.depthTexture;
    u.resolution.value = res;
    u.logFar.value = logFar;
  }
  for (const p of [plume1, plume2]) {
    p.uniforms.sunDir.value.copy(sunDir);
    p.uniforms.sunCol.value.set(1, 0.97, 0.92);
    p.uniforms.steps.value = ctx.settings.quality === 'final' ? 40 : 24;
  }

  let tShot = 0;
  let sub = 0;
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  return {
    update(f: FrameState): FrameView {
      const t = f.t;
      tShot = t;
      if (rocket.group.parent !== scene) scene.add(rocket.group);
      if (plume1.mesh.parent !== rocket.stage1) rocket.stage1.add(plume1.mesh);
      if (plume2.mesh.parent !== rocket.stage2) rocket.stage2.add(plume2.mesh);
      // The planet slides west under us.
      moveEarth(earth, v3(-GROUND_SPEED * t, -(EARTH_R + ALT), 0));

      // Upper stage at the origin, accelerating along its axis after its engine lights.
      const a2 = Math.max(0, t - MVAC - 0.15);
      const s2 = 0.5 * 9 * a2 * a2;
      rocket.group.quaternion.copy(rocketQuat);
      rocket.group.position.copy(axis).multiplyScalar(s2).add(rocketOrigin);
      rocket.stage2.position.set(0, 0, 0);
      // First stage: burning, cut-off, then drifting back and tumbling slowly.
      const as = Math.max(0, t - SEP);
      rocket.stage1.position.set(0.15 * as * as, -(2.2 * as + 0.4 * as * as) - s2, -0.25 * as);
      rocket.stage1.rotation.set(0.05 * as * as, 0, -0.07 * as - 0.02 * as * as);
      const on1 = t < MECO ? 1 : Math.max(0, 1 - (t - MECO) / 0.18);
      rocket.setEngines([on1, on1, on1, on1, on1].map((x) => x * 0.6), 0);
      const lv2 = t < MVAC ? 0 : 1 - Math.exp(-(t - MVAC) / 0.12);
      rocket.setMvac(lv2 * 0.7, smoothstep(MVAC + 0.1, MVAC + 1.4, t));

      const u1 = plume1.uniforms;
      u1.time.value = t;
      u1.vacExpand.value = 0.75 + 0.8 * clamp01((t - MECO) / 0.3);
      u1.vacScatter.value = 0.25 * on1;
      u1.vacHot.value = 9 * on1;
      u1.gain.value = 1;
      const u2 = plume2.uniforms;
      u2.time.value = t;
      u2.vacExpand.value = 0.85;
      u2.vacScatter.value = 0.3 * lv2;
      u2.vacHot.value = 14 * lv2;
      plume1.mesh.visible = on1 > 0.001;
      plume2.mesh.visible = lv2 > 0.001;

      // Camera: off the rocket's south-west flank, slowly drifting and pushing in, a little float.
      const k = t / DUR;
      const center = rocketOrigin.clone().add(axis.clone().multiplyScalar(40));
      const look = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(8)), -0.17, -Math.cos(THREE.MathUtils.degToRad(8))).normalize();
      const side = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0)).normalize();
      const dist = lerp(105, 88, easeInOutSine(k));
      camera.position.copy(center).addScaledVector(look, -dist).addScaledVector(side, lerp(-18, 8, easeInOutSine(k))).addScaledVector(new THREE.Vector3(0, 1, 0), lerp(-6, 6, k));
      camera.position.x += shake(t, 41, 0.6) * 0.8;
      camera.position.y += shake(t, 42, 0.6) * 0.8;
      const target = camera.position.clone().addScaledVector(look, 100).addScaledVector(side, lerp(-4, 2, k));
      target.y += 3;
      camera.lookAt(target);
      camera.fov = 40;
      if (DBG.cam && DBG.orbitCam) {
        camera.position.set(...DBG.cam.pos);
        camera.lookAt(...DBG.cam.look);
        camera.fov = DBG.cam.fov;
      }
      camera.aspect = ctx.width / ctx.height;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      // Lens flare from the sun when it is in frame.
      const sp = sun.position.clone().project(camera);
      const inFrame = sp.z < 1 && Math.abs(sp.x) < 1.2 && Math.abs(sp.y) < 1.2;
      const post: Partial<PostParams> = {
        exposure: 1.0,
        bloomStrength: 0.25,
        bloomRadius: 0.6,
        bloomThreshold: 4.0,
        focusDistance: dist,
        aperture: 0,
        vignette: 0.38,
        grain: 0.22,
        chromaticAberration: 0.7,
        tint: [1.0, 0.99, 1.02],
        saturation: 1.1,
        contrast: 1.08,
        lift: 0.004,
        liftColor: [0.3, 0.45, 1.0],
        flare: inFrame ? { x: sp.x, y: sp.y, intensity: 0.5, color: [1, 0.9, 0.75] } : null,
        fade: 1 - smoothstep(DUR - 0.5, DUR, t) * 0,
      };
      if (DBG.exposure) post.exposure = DBG.exposure;
      return { camera, post };
    },
    render(target: THREE.WebGLRenderTarget, cam: THREE.PerspectiveCamera) {
      sub++;
      const hide = [plume1.mesh, plume2.mesh, gas.far.mesh, gas.near.mesh, earth.group.children[1]!];
      earth.group.children[1]!.visible = !DBG.noAtmo;
      const vis = hide.map((o) => o.visible);
      for (const o of hide) o.visible = false;
      scene.overrideMaterial = depthMat;
      renderer.setRenderTarget(depthRT);
      renderer.clear(true, true, false);
      renderer.render(scene, cam);
      scene.overrideMaterial = null;
      hide.forEach((o, i) => (o.visible = vis[i]!));
      gas.update(tShot, cam, () => -1e9);
      for (const p of [plume1, plume2]) {
        p.uniforms.jitter.value = sub % 997;
        p.prepare(cam);
      }
      renderer.setRenderTarget(target);
      renderer.render(scene, cam);
    },
    dispose() {
      earth.dispose();
      sun.geometry.dispose();
      sunMat.dispose();
      envRT.dispose();
      plume1.dispose();
      plume2.dispose();
      gas.dispose();
      depthRT.dispose();
      depthMat.dispose();
    },
  };
}
