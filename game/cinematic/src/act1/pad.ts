// The launch site: a concrete launch mount with a flame trench (exhaust exits east and west), a lattice service
// tower to the north with umbilical arms, wet concrete apron, scrubland, a beach and the sea to the east, lightning
// masts with catenary wires, xenon floodlights with visible beams, and low hills on the horizon.
//
// World frame: metres, y up, +x east, -z north. The rocket stands on the mount at the origin.
import * as THREE from 'three';
import { NOISE } from './glsl';
import { withSkyFog, type FogUniforms } from './atmo';

export const PAD = {
  deckY: 10,
  /** Half-size of the open hole in the deck (the trench runs along x under it). */
  hole: 4.5,
  mountHalf: 13,
  trenchTop: 7,
  /** Rocket heat-shield height when standing on the mount. */
  rocketBaseY: 15,
  tower: { x: 0, z: -19, half: 4.5, height: 62, mast: 80 },
  shoreX: 330,
  seaY: -0.6,
};

/** Arm heights on the tower, and their length (to the rocket skin). */
const ARMS = [
  { y: 22, len: 12.2, w: 2.2 },
  { y: 39, len: 12.2, w: 2.0 },
  { y: 49, len: 12.2, w: 2.6 },
];

export interface Floodlight {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

export const FLOODS: Floodlight[] = [
  { pos: new THREE.Vector3(-150, 3, 120), target: new THREE.Vector3(0, 40, 0) },
  { pos: new THREE.Vector3(170, 3, 90), target: new THREE.Vector3(0, 36, 0) },
  { pos: new THREE.Vector3(60, 3, 190), target: new THREE.Vector3(0, 30, 0) },
];

export interface Pad {
  group: THREE.Group;
  /** Rotate the umbilical arms away (0: attached, 1: fully retracted). */
  setArms(k: number): void;
  /** Floodlight beams' visibility (the haze they light), 0..1. */
  beamUniforms: { intensity: { value: number }; time: { value: number } };
  /** Wetness/glints of the apron get the flame light; exposed for the sequence to drive. */
  groundUniforms: { scorch: { value: number } };
  dispose(): void;
}

const GROUND_FUNCS = /* glsl */ `
${NOISE}
float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
// Apron and roads: < 0 inside the concrete.
float apron(vec2 p) {
  float a = sdBox2(p, vec2(70.0, 62.0)) - 8.0;
  a = min(a, sdBox2(p - vec2(-300.0, 0.0), vec2(260.0, 5.0)));      // road west
  a = min(a, sdBox2(p - vec2(0.0, 220.0), vec2(4.0, 160.0)));       // road south
  a = min(a, sdBox2(p - vec2(-150.0, 120.0), vec2(14.0, 10.0)));    // floodlight pads
  a = min(a, sdBox2(p - vec2(170.0, 90.0), vec2(12.0, 10.0)));
  a = min(a, sdBox2(p - vec2(60.0, 190.0), vec2(12.0, 10.0)));
  return a;
}
float shore(vec2 p) { return p.x - (${PAD.shoreX.toFixed(1)} + 40.0 * fbm3(vec3(p.y * 0.004, 0.0, 1.0)) + 8.0 * snoise(vec3(p.y * 0.03, 2.0, 0.0))); }
float groundHeight(vec2 p) {
  float inA = 1.0 - smoothstep(-2.0, 0.5, apron(p));
  // Concrete slabs with joints, and fine grit.
  vec2 s = abs(fract(p / 6.0) - 0.5) * 6.0;
  float joint = (1.0 - smoothstep(0.0, 0.03, min(s.x, s.y)));
  float grit = snoise(vec3(p * 9.0, 1.0)) * 0.3 + snoise(vec3(p * 2.2, 3.0)) * 0.4;
  float concrete = 0.5 + 0.08 * grit - 0.5 * joint;
  float scrub = 0.5 + 0.6 * fbm3(vec3(p * 0.35, 5.0)) + 0.25 * snoise(vec3(p * 3.0, 6.0));
  return mix(scrub, concrete, inA);
}
`;

export function buildPad(renderer: THREE.WebGLRenderer, fog: FogUniforms): Pad {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  void aniso;

  // ------------------------------------------------------------------------------------------------ ground
  const groundUniforms = { scorch: { value: 1 } };
  const groundMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }));
  groundMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, groundUniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vGW;\nuniform float scorch;\n${GROUND_FUNCS}`)
      .replace(
        '#include <map_fragment>',
        `
        vec2 gp = vGW.xz;
        float sh = shore(gp);
        if (sh > 0.0) discard;
        float ap = apron(gp);
        float inA = 1.0 - smoothstep(-2.0, 0.5, ap);
        float nBig = fbm3(vec3(gp * 0.02, 1.0));
        float nMid = fbm3(vec3(gp * 0.15, 2.0));
        vec3 concrete = vec3(0.30, 0.295, 0.28) * (0.85 + 0.25 * nBig + 0.1 * nMid);
        vec2 s6 = abs(fract(gp / 6.0) - 0.5) * 6.0;
        float joint = 1.0 - smoothstep(0.0, 0.04, min(s6.x, s6.y));
        concrete *= 1.0 - 0.45 * joint;
        // Scorch: the exhaust paths east and west of the trench, and around the mount.
        float path = exp(-pow(gp.y / (10.0 + abs(gp.x) * 0.35), 2.0)) * smoothstep(8.0, 20.0, abs(gp.x)) * (1.0 - smoothstep(70.0, 140.0, abs(gp.x)));
        float ring = exp(-pow(length(gp) / 34.0, 2.0));
        float soot = clamp((path * 0.85 + ring * 0.6) * (0.7 + 0.5 * nMid), 0.0, 1.0) * scorch;
        concrete = mix(concrete, vec3(0.045, 0.04, 0.035), soot * 0.85);
        // Scrubland: sand, dry grass and dark shrubs.
        float shrub = smoothstep(0.1, 0.5, fbm3(vec3(gp * 0.08, 7.0)) + 0.3 * snoise(vec3(gp * 0.6, 8.0)));
        vec3 sand = vec3(0.40, 0.34, 0.25) * (0.85 + 0.2 * nMid);
        vec3 grass = vec3(0.16, 0.15, 0.08) * (0.8 + 0.3 * nMid);
        vec3 land = mix(sand, grass, smoothstep(-0.2, 0.4, nBig + 0.3));
        land = mix(land, vec3(0.05, 0.06, 0.035), shrub * 0.8);
        // Beach: light sand near the shore, wet and darker at the waterline.
        float beach = smoothstep(-60.0, -15.0, sh);
        land = mix(land, vec3(0.55, 0.49, 0.38), beach);
        land = mix(land, vec3(0.20, 0.18, 0.15), smoothstep(-6.0, -1.0, sh));
        vec3 alb = mix(land, concrete, inA);
        diffuseColor.rgb *= alb;
        // Deluge water: puddles around the mount (very smooth), wet concrete further out.
        float wetZone = (1.0 - smoothstep(30.0, 75.0, length(gp * vec2(0.8, 1.0)))) * inA;
        float puddle = smoothstep(0.08, 0.2, fbm3(vec3(gp * 0.09, 11.0)) + 0.35 * wetZone - 0.25) * wetZone;
        float wet = max(wetZone * 0.7, puddle);
        diffuseColor.rgb *= 1.0 - 0.45 * wet;
        float gRough = mix(mix(0.95, 0.8, inA), 0.25, wet);
        gRough = mix(gRough, 0.03, puddle);
        gRough = mix(gRough, 0.35, smoothstep(-6.0, -1.0, sh));
        `,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float e = 0.02;
          float h0 = groundHeight(gp);
          float hx = groundHeight(gp + vec2(e, 0.0));
          float hz = groundHeight(gp + vec2(0.0, e));
          float amp = mix(0.02, 0.004, puddle);
          vec3 nw = normalize(vec3(-(hx - h0) / e * amp, 1.0, -(hz - h0) / e * amp));
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
        }`,
      );
  };
  withSkyFog(groundMat, fog, 'ground');
  const groundGeo = track(new THREE.PlaneGeometry(9000, 9000, 1, 1));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // ------------------------------------------------------------------------------------------------ sea
  const seaUniforms = { time: { value: 0 } };
  const seaMat = track(new THREE.MeshPhysicalMaterial({ color: 0x050a10, roughness: 0.06, metalness: 0, ior: 1.33, specularIntensity: 1 }));
  seaMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, seaUniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSW;\nuniform float time;\n${NOISE}`)
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 p = vSW.xz;
          float d = length(vSW - cameraPosition);
          float fade = 1.0 / (1.0 + d / 1500.0);
          vec3 g = vec3(0.0);
          float a = 0.07;
          vec2 q = p * 0.05;
          for (int i = 0; i < 4; i++) {
            float e = 0.01;
            float h0 = snoise(vec3(q, time * 0.25 * float(i + 1)));
            float hx = snoise(vec3(q + vec2(e, 0.0), time * 0.25 * float(i + 1)));
            float hz = snoise(vec3(q + vec2(0.0, e), time * 0.25 * float(i + 1)));
            g.xz += vec2(hx - h0, hz - h0) / e * a;
            q = q * 2.3 + vec2(3.1, 1.7);
            a *= 0.55;
          }
          vec3 nw = normalize(vec3(-g.x * fade, 1.0, -g.z * fade));
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
        }`,
      );
  };
  withSkyFog(seaMat, fog, 'sea');
  const seaGeo = track(new THREE.PlaneGeometry(60000, 60000, 1, 1));
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = PAD.seaY;
  group.add(sea);

  // ------------------------------------------------------------------------------------------------ concrete
  const concreteMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  concreteMat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz; vCN = normalize(mat3(modelMatrix) * objectNormal);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCW; varying vec3 vCN;\n${NOISE}`)
      .replace(
        '#include <map_fragment>',
        `
        vec3 an = abs(vCN);
        vec2 tp = an.x > 0.5 ? vCW.zy : (an.y > 0.5 ? vCW.xz : vCW.xy);
        float n1 = fbm3(vec3(tp * 0.25, 1.0));
        float n2 = snoise(vec3(tp * 3.0, 2.0));
        vec3 c = vec3(0.34, 0.33, 0.31) * (0.85 + 0.2 * n1 + 0.06 * n2);
        // Formwork lines and soot: dark low down near the trench, streaks running down.
        // Formwork panels (1.2 m lifts, 2.4 m wide), faint stains running down, soot near the top and the trench.
        vec2 pf = abs(fract(tp / vec2(2.4, 1.2)) - 0.5) * vec2(2.4, 1.2);
        float lines = 1.0 - smoothstep(0.0, 0.025, min(pf.x, pf.y));
        c *= 1.0 - 0.12 * lines;
        float stain = fbm3(vec3(tp.x * 0.8, tp.y * 0.1, 4.0));
        c *= 1.0 - 0.18 * smoothstep(0.0, 0.6, stain);
        float pans = fbm3(vec3(tp * 0.6, 6.0));
        float soot = smoothstep(0.2, 0.9, pans + 0.6 * (1.0 - smoothstep(4.0, 10.5, vCW.y)) * 0.0 + 0.5 * smoothstep(7.0, 10.0, vCW.y)) * (1.0 - smoothstep(12.0, 30.0, length(vCW.xz)));
        c = mix(c, vec3(0.06, 0.055, 0.05), clamp(soot, 0.0, 1.0) * 0.7);
        diffuseColor.rgb *= c;
        float cRough = 0.85 - 0.2 * soot;
        `,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = cRough;');
  };
  withSkyFog(concreteMat, fog, 'concrete');

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = concreteMat) => {
    const g = track(new THREE.BoxGeometry(w, h, d));
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const { deckY, hole, mountHalf: M, trenchTop } = PAD;
  // Side blocks (north and south of the trench), and the deck slabs east and west of the hole over the trench.
  box(2 * M, deckY, M - hole, 0, deckY / 2, -(hole + (M - hole) / 2));
  box(2 * M, deckY, M - hole, 0, deckY / 2, hole + (M - hole) / 2);
  box(M - hole, deckY - trenchTop, 2 * hole, -(hole + (M - hole) / 2), (deckY + trenchTop) / 2, 0);
  box(M - hole, deckY - trenchTop, 2 * hole, hole + (M - hole) / 2, (deckY + trenchTop) / 2, 0);
  // Flame deflector: a wedge in the trench under the rocket.
  {
    const shape = new THREE.Shape();
    shape.moveTo(-9, 0);
    shape.lineTo(9, 0);
    shape.lineTo(0, 4.2);
    shape.closePath();
    const g = track(new THREE.ExtrudeGeometry(shape, { depth: 2 * hole - 0.4, bevelEnabled: false }));
    g.translate(0, 0, -(hole - 0.2));
    const m = new THREE.Mesh(g, concreteMat);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  // Trench floor runout and walls beyond the mount (east and west).
  for (const sx of [-1, 1]) {
    box(30, 1.2, 1.2, sx * (M + 15), 0.6, -(hole + 0.6));
    box(30, 1.2, 1.2, sx * (M + 15), 0.6, hole + 0.6);
  }

  // Steel: hold-down posts, the launch table ring, pipes.
  const steelMat = track(withSkyFog(new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 0.45, metalness: 0.8 }), fog));
  const paintedMat = track(withSkyFog(new THREE.MeshStandardMaterial({ color: 0x5a5c60, roughness: 0.55, metalness: 0.5 }), fog));
  {
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(3.7, 0.22, 12, 64)), steelMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = deckY + 0.6;
    ring.castShadow = true;
    group.add(ring);
    // Ring support beams across the hole (east-west, clear of the engines).
    for (const sz of [-1, 1]) box(2 * hole + 2, 0.6, 0.5, 0, deckY + 0.3, sz * 3.6, steelMat);
    const postGeo = track(new THREE.BoxGeometry(0.32, PAD.rocketBaseY - deckY - 0.6, 0.32));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const m = new THREE.Mesh(postGeo, steelMat);
      m.position.set(Math.cos(a) * 2.45, (PAD.rocketBaseY + deckY + 0.6) / 2, Math.sin(a) * 2.45);
      m.castShadow = true;
      group.add(m);
      const clamp = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 0.5, 0.7)), paintedMat);
      clamp.position.set(Math.cos(a) * 2.25, PAD.rocketBaseY - 0.15, Math.sin(a) * 2.25);
      group.add(clamp);
    }
    // Deluge pipes along the deck edges.
    const pipeGeo = track(new THREE.CylinderGeometry(0.35, 0.35, 2 * M, 16));
    pipeGeo.rotateZ(Math.PI / 2);
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(pipeGeo, paintedMat);
      p.position.set(0, deckY + 0.35, sz * (M - 0.6));
      p.castShadow = true;
      group.add(p);
    }
  }

  // ------------------------------------------------------------------------------------------------ tower
  const T = PAD.tower;
  const beams: THREE.Matrix4[] = [];
  const addBeam = (a: THREE.Vector3, b: THREE.Vector3, size = 0.32) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(size, len, size));
    beams.push(m);
  };
  const levels = Math.round(T.height / 4);
  const lv = T.height / levels;
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const;
  const C = (i: number, y: number) => new THREE.Vector3(T.x + corners[i % 4]![0] * T.half, y, T.z + corners[i % 4]![1] * T.half);
  for (let c = 0; c < 4; c++) addBeam(C(c, 0), C(c, T.height), 0.55);
  for (let l = 0; l <= levels; l++) {
    const y = l * lv;
    for (let c = 0; c < 4; c++) {
      addBeam(C(c, y), C(c + 1, y), 0.3);
      if (l < levels) {
        // X braces on every face.
        addBeam(C(c, y), C(c + 1, y + lv), 0.18);
        addBeam(C(c + 1, y), C(c, y + lv), 0.18);
      }
    }
  }
  // Top mast (lightning rod) as a thinner lattice.
  for (let c = 0; c < 4; c++) {
    const a = C(c, T.height);
    const top = new THREE.Vector3(T.x, T.mast, T.z);
    addBeam(a, top, 0.25);
  }
  addBeam(new THREE.Vector3(T.x, T.mast, T.z), new THREE.Vector3(T.x, T.mast + 8, T.z), 0.12);
  const beamGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const towerMat = track(withSkyFog(new THREE.MeshStandardMaterial({ color: 0x48484a, roughness: 0.6, metalness: 0.55 }), fog));
  const tower = new THREE.InstancedMesh(beamGeo, towerMat, beams.length);
  beams.forEach((m, i) => tower.setMatrixAt(i, m));
  tower.castShadow = tower.receiveShadow = true;
  group.add(tower);
  // Floors (grating) every 12 m, and the elevator shaft.
  const floorMat = track(withSkyFog(new THREE.MeshStandardMaterial({ color: 0x2a2a2b, roughness: 0.8, metalness: 0.4 }), fog));
  for (let y = 12; y < T.height; y += 12) box(2 * T.half, 0.25, 2 * T.half, T.x, y, T.z, floorMat);
  box(2.4, T.height, 2.4, T.x - 1.6, T.height / 2, T.z - 1.2, paintedMat);

  // Umbilical arms (box trusses), pivoting at the tower's south face.
  const armPivots: THREE.Group[] = [];
  for (const arm of ARMS) {
    const pivot = new THREE.Group();
    pivot.position.set(T.x + T.half - 0.5, arm.y, T.z + T.half);
    const truss = new THREE.Group();
    const L = arm.len;
    const w = arm.w;
    const tb: THREE.Matrix4[] = [];
    const add = (a: THREE.Vector3, b: THREE.Vector3, s: number) => {
      const d = new THREE.Vector3().subVectors(b, a);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      tb.push(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(s, d.length(), s)));
    };
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x - (T.x + T.half - 0.5), y, z);
    // Arm runs along +z toward the rocket from the tower face (x offset back to centre).
    const x0 = T.x;
    const segs = 5;
    for (const sx of [-1, 1]) for (const sy of [0, 1]) add(P(x0 + (sx * w) / 2, sy * w, 0), P(x0 + (sx * w) / 2, sy * w, L), 0.22);
    for (let i = 0; i <= segs; i++) {
      const z = (i / segs) * L;
      add(P(x0 - w / 2, 0, z), P(x0 + w / 2, 0, z), 0.15);
      add(P(x0 - w / 2, w, z), P(x0 + w / 2, w, z), 0.15);
      add(P(x0 - w / 2, 0, z), P(x0 - w / 2, w, z), 0.15);
      add(P(x0 + w / 2, 0, z), P(x0 + w / 2, w, z), 0.15);
      if (i < segs) {
        const z2 = ((i + 1) / segs) * L;
        add(P(x0 - w / 2, 0, z), P(x0 - w / 2, w, z2), 0.1);
        add(P(x0 + w / 2, w, z), P(x0 + w / 2, 0, z2), 0.1);
      }
    }
    const im = new THREE.InstancedMesh(beamGeo, towerMat, tb.length);
    tb.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    truss.add(im);
    // Umbilical hoses hanging from the arm to the rocket.
    const hose = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 10)), steelMat);
    hose.position.copy(P(x0, -0.9, L - 0.3));
    truss.add(hose);
    pivot.add(truss);
    group.add(pivot);
    armPivots.push(pivot);
  }

  // Lights on the tower (red aviation lights and work lights): emissive, bloom catches them.
  const redMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 0.8, 0.4) }));
  const workMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 7.5, 5) }));
  const bulb = track(new THREE.SphereGeometry(0.22, 10, 8));
  for (const [x, y, z] of [
    [T.x, T.mast + 8.2, T.z],
    [T.x + T.half, T.height + 0.4, T.z + T.half],
    [T.x - T.half, T.height + 0.4, T.z + T.half],
    [T.x + T.half, T.height + 0.4, T.z - T.half],
  ] as const) {
    const m = new THREE.Mesh(bulb, redMat);
    m.position.set(x, y, z);
    group.add(m);
  }
  for (let y = 12; y < T.height; y += 12) {
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(bulb, workMat);
      m.scale.setScalar(0.8);
      m.position.set(T.x + sx * T.half, y + 1.8, T.z + T.half + 0.3);
      group.add(m);
    }
  }

  // ------------------------------------------------------------------------------------------------ lightning masts + catenaries
  const mastMat = track(withSkyFog(new THREE.MeshStandardMaterial({ color: 0x2a2b2c, roughness: 0.7, metalness: 0.3 }), fog));
  const mastPos = [
    new THREE.Vector3(-95, 0, -85),
    new THREE.Vector3(95, 0, -85),
    new THREE.Vector3(95, 0, 85),
    new THREE.Vector3(-95, 0, 85),
  ];
  const mastH = 135;
  for (const p of mastPos) {
    const m = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 1.4, mastH, 12)), mastMat);
    m.position.set(p.x, mastH / 2, p.z);
    m.castShadow = true;
    group.add(m);
    const tip = new THREE.Mesh(bulb, redMat);
    tip.position.set(p.x, mastH + 0.4, p.z);
    group.add(tip);
  }
  const wireMat = track(withSkyFog(new THREE.MeshBasicMaterial({ color: 0x101114 }), fog));
  for (let i = 0; i < 4; i++) {
    const a = mastPos[i]!.clone().setY(mastH - 1);
    const b = mastPos[(i + 1) % 4]!.clone().setY(mastH - 1);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 40; k++) {
      const s = k / 40;
      const p = a.clone().lerp(b, s);
      p.y -= 26 * 4 * s * (1 - s);
      pts.push(p);
    }
    const g = track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.06, 4, false));
    group.add(new THREE.Mesh(g, wireMat));
    // A wire from each mast top to the tower mast.
  }
  for (const p of mastPos) {
    const a = p.clone().setY(mastH - 1);
    const b = new THREE.Vector3(T.x, T.mast + 6, T.z);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 40; k++) {
      const s = k / 40;
      const q = a.clone().lerp(b, s);
      q.y -= 18 * 4 * s * (1 - s);
      pts.push(q);
    }
    group.add(new THREE.Mesh(track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.05, 4, false)), wireMat));
  }

  // ------------------------------------------------------------------------------------------------ site buildings, water tower, floodlight stands
  const shedMat = track(withSkyFog(new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.8 }), fog));
  const blds: [number, number, number, number, number][] = [
    [-120, -40, 30, 9, 18],
    [-140, 30, 14, 6, 22],
    [110, -110, 26, 12, 20],
    [-380, 60, 60, 24, 40],
    [-420, -140, 30, 14, 30],
  ];
  for (const [x, z, w, h, d] of blds) {
    box(w, h, d, x, h / 2, z, shedMat);
    // A lit window strip.
    const win = new THREE.Mesh(track(new THREE.PlaneGeometry(w * 0.7, 0.8)), workMat);
    win.position.set(x, h * 0.55, z + d / 2 + 0.05);
    win.scale.setScalar(1);
    (win.material as THREE.MeshBasicMaterial).toneMapped = false;
    group.add(win);
  }
  {
    // Water tower (a sphere on a column) north-west.
    const wt = new THREE.Group();
    const col = new THREE.Mesh(track(new THREE.CylinderGeometry(3, 4, 60, 24)), shedMat);
    col.position.y = 30;
    const tank = new THREE.Mesh(track(new THREE.SphereGeometry(13, 40, 24)), shedMat);
    tank.position.y = 68;
    wt.add(col, tank);
    wt.position.set(-260, 0, -220);
    wt.traverse((o) => (o.castShadow = true));
    group.add(wt);
  }
  const lampMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(120, 125, 140) }));
  for (const f of FLOODS) {
    const stand = new THREE.Group();
    stand.position.copy(f.pos).setY(0);
    const frame = new THREE.Mesh(track(new THREE.BoxGeometry(6, 3, 1.2)), paintedMat);
    frame.position.y = 2.2;
    stand.add(frame);
    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.Mesh(track(new THREE.CircleGeometry(0.55, 20)), lampMat);
      lamp.position.set(-2.1 + i * 1.4, 2.4, 0.62);
      stand.add(lamp);
    }
    stand.lookAt(new THREE.Vector3(f.target.x, 0, f.target.z));
    group.add(stand);
  }

  // ------------------------------------------------------------------------------------------------ horizon hills (north and west, across the lagoon)
  {
    const segs = 256;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      // Only land to the west/north/south; the east is open sea.
      const east = Math.max(0, Math.cos(a));
      const r = 7000 + 1500 * Math.sin(a * 3.0 + 1.0);
      const n = Math.sin(a * 17.0) * 0.35 + Math.sin(a * 41.0 + 2.0) * 0.2 + Math.sin(a * 7.0 + 0.5) * 0.45;
      const h = Math.max(0, (90 + 120 * n) * (1 - east * 1.3));
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos.push(x, -5, z, x, h, z);
      if (i < segs) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const g = track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const hillMat = track(withSkyFog(new THREE.MeshStandardMaterial({ color: 0x0b0d0a, roughness: 1, side: THREE.DoubleSide }), fog));
    group.add(new THREE.Mesh(g, hillMat));
  }

  // ------------------------------------------------------------------------------------------------ floodlight beams (volumetric look)
  const beamUniforms = { intensity: { value: 1 }, time: { value: 0 } };
  const beamMat = track(
    new THREE.ShaderMaterial({
      uniforms: beamUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vW; varying float vAlong;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          vAlong = position.y;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float intensity; uniform float time;
        varying vec3 vW; varying float vAlong;
        #include <common>
        #include <logdepthbuf_pars_fragment>
        ${NOISE}
        void main() {
          #include <logdepthbuf_fragment>
          // Cone local: vAlong 0 (lamp) .. 1 (far). Soft falloff toward the cone edge via the view angle.
          vec3 v = normalize(cameraPosition - vW);
          vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
          float edge = pow(abs(dot(n, v)), 2.0);
          float along = (1.0 - smoothstep(0.0, 1.0, vAlong)) * smoothstep(0.0, 0.03, vAlong);
          float haze = 0.6 + 0.4 * snoise(vec3(vW * 0.04 + vec3(0.0, time * 0.3, 0.0)));
          vec3 c = vec3(0.75, 0.82, 1.0) * edge * along * haze * intensity * 0.05;
          gl_FragColor = vec4(c, 0.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      side: THREE.DoubleSide,
    }),
  );
  for (const f of FLOODS) {
    const len = f.pos.distanceTo(f.target) * 1.5;
    const g = track(new THREE.CylinderGeometry(9, 1.2, 1, 32, 1, true));
    g.translate(0, 0.5, 0);
    const m = new THREE.Mesh(g, beamMat);
    m.position.copy(f.pos).setY(f.pos.y + 2.4);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(f.target, f.pos).normalize());
    m.scale.set(len / 140, len, len / 140);
    m.renderOrder = 5;
    m.frustumCulled = false;
    group.add(m);
  }

  return {
    group,
    setArms(k) {
      // Arms swing away from the rocket (toward the west, about their hinge), staggered.
      armPivots.forEach((p, i) => {
        const ki = THREE.MathUtils.clamp(k * 1.25 - i * 0.12, 0, 1);
        const e = ki * ki * (3 - 2 * ki);
        p.rotation.y = -e * 1.25;
      });
    },
    beamUniforms,
    groundUniforms,
    dispose() {
      for (const d of disposables) d.dispose();
      tower.dispose();
    },
  };
}
