// Billboard particles for the launch: smoke, steam and fire share one depth-sorted, premultiplied-alpha system
// (fire is mostly additive: emission with little absorption), lit by the twilight sky, the dawn, the floodlights
// and the flames (a handful of point lights passed as uniforms). Sparks are a separate additive system whose
// ballistic paths (with one bounce) are evaluated on the GPU.
//
// Every particle is fully determined by its spawn record and the time: position follows a drag model (initial
// velocity decaying toward buoyant drift and wind), so any frame can be evaluated without stepping a simulation.
import * as THREE from 'three';
import { bake } from './bake';
import { FIRE_RAMP, LOGDEPTH, NOISE } from './glsl';

export const enum Kind {
  Smoke = 0,
  Fire = 1,
  Steam = 2,
}

/** A particle's spawn record. */
export interface Spawn {
  tb: number;
  life: number;
  p: [number, number, number];
  v: [number, number, number];
  /** Drag rate (1/s): the initial velocity decays as exp(-drag·age). */
  drag: number;
  /** Terminal upward drift (m/s) reached as the initial velocity decays. */
  buoy: number;
  size0: number;
  /** Size growth: size = size0 + grow · age^0.65. */
  grow: number;
  rot: number;
  spin: number;
  kind: Kind;
  /** Albedo multiplier (smoke darkness). */
  tint: number;
  opacity: number;
  /** Fire: initial temperature 0..1 and cooling rate (1/s). Smoke near flames can carry some heat too. */
  heat: number;
  cool: number;
  /** Fade-in time (s). */
  fadeIn?: number;
}

const STRIDE = 22;

export interface LightSet {
  /** World positions and linear colours × intensity (W-ish, falloff 1/(1 + d²/r²)). */
  pos: THREE.Vector3[];
  col: THREE.Vector3[];
  radius: number[];
}

export const MAX_LIGHTS = 8;

const ATLAS_FRAG = /* glsl */ `
// 2x2 atlas of puff shapes. R: density, G/B: normal xy (0.5-centred), A: thickness.
float puff(vec2 q, float v) {
  float d = 0.0;
  for (int i = 0; i < 9; i++) {
    vec3 h = hash33(vec3(float(i), v * 17.0, 3.0));
    vec2 c = (h.xy - 0.5) * 0.9;
    float r = 0.22 + 0.25 * h.z;
    d += exp(-dot(q - c, q - c) / (r * r)) * (0.55 + 0.45 * h.z);
  }
  float n = fbm5(vec3(q * 2.6, v * 7.0)) * 0.55 + snoise(vec3(q * 9.0, v * 3.0 + 1.0)) * 0.12;
  d = d * 0.75 + n - 0.32;
  d *= 1.0 - smoothstep(0.62, 0.98, length(q));
  return clamp(d, 0.0, 1.0);
}
void main() {
  vec2 cell = floor(vUv * 2.0);
  float v = cell.x + cell.y * 2.0;
  vec2 q = (fract(vUv * 2.0) - 0.5) * 2.0;
  float e = 1.0 / 256.0;
  float d = puff(q, v);
  float dx = puff(q + vec2(e, 0.0), v) - puff(q - vec2(e, 0.0), v);
  float dy = puff(q + vec2(0.0, e), v) - puff(q - vec2(0.0, e), v);
  // A dome over the density: the puff bulges toward the viewer where it is thick.
  vec2 g = vec2(dx, dy) / (2.0 * e) * 0.18 + q * 0.55;
  vec3 n = normalize(vec3(-g, 1.0));
  gl_FragColor = vec4(smoothstep(0.0, 0.85, d), n.xy * 0.5 + 0.5, d);
}`;

const SMOKE_VERT = /* glsl */ `
attribute vec4 iA; // pos.xyz, size
attribute vec4 iB; // rot, alpha, heat, variant + 4·kind
attribute vec4 iC; // tint, seed, -, -
varying vec2 vUv;
varying vec3 vW;
varying vec3 vR;
varying vec3 vU;
varying vec4 vP; // alpha, heat, kind, tint
varying float vViewZ;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(iB.x), s = sin(iB.x);
  vec3 r = camR * c + camU * s;
  vec3 u = -camR * s + camU * c;
  vec3 w = iA.xyz + (r * position.x + u * position.y) * iA.w;
  float variant = mod(iB.w, 4.0);
  vec2 cell = vec2(mod(variant, 2.0), floor(variant / 2.0));
  vUv = (cell + uv) * 0.5;
  vW = w;
  vR = r;
  vU = u;
  vP = vec4(iB.y, iB.z, floor(iB.w / 4.0), iC.x);
  vec4 mv = viewMatrix * vec4(w, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;

const SMOKE_FRAG = /* glsl */ `
uniform sampler2D atlas;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float logFar;
uniform vec3 lightPos[${MAX_LIGHTS}];
uniform vec3 lightCol[${MAX_LIGHTS}];
uniform float lightRad[${MAX_LIGHTS}];
uniform vec3 skyAmb;
uniform vec3 groundAmb;
uniform vec3 dawnDir;
uniform vec3 dawnCol;
uniform float fireGain;
varying vec2 vUv;
varying vec3 vW;
varying vec3 vR;
varying vec3 vU;
varying vec4 vP;
varying float vViewZ;
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE}
${LOGDEPTH}
${FIRE_RAMP}
void main() {
  #include <logdepthbuf_fragment>
  vec4 tex = texture2D(atlas, vUv);
  float kind = vP.z;
  float D = tex.r;
  float alpha = D * vP.x;
  // Soft particles against the opaque scene, and fade very close to the camera.
  float sceneZ = viewZFromLogDepth(texture2D(tDepth, gl_FragCoord.xy / resolution).x, logFar);
  float soft = clamp((sceneZ - vViewZ) / (1.0 + vViewZ * 0.04), 0.0, 1.0);
  alpha *= soft * smoothstep(1.0, 4.0, vViewZ);
  if (alpha < 0.002) discard;
  vec3 V = normalize(cameraPosition - vW);
  vec2 nl = tex.gb * 2.0 - 1.0;
  vec3 N = normalize(nl.x * vR + nl.y * vU + V * sqrt(max(0.0, 1.0 - dot(nl, nl))));
  float thick = tex.a;
  // Ambient: sky above, dark ground below.
  vec3 light = mix(groundAmb, skyAmb, N.y * 0.5 + 0.5);
  float wrapD = clamp(dot(N, dawnDir) * 0.5 + 0.5, 0.0, 1.0);
  light += dawnCol * (wrapD * wrapD + pow(clamp(dot(-V, dawnDir), 0.0, 1.0), 6.0) * (0.4 + 0.6 * D) * 1.2);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec3 dl = lightPos[i] - vW;
    float d2 = dot(dl, dl);
    vec3 L = dl * inversesqrt(d2 + 1e-4);
    float att = 1.0 / (1.0 + d2 / (lightRad[i] * lightRad[i]));
    float ndl = clamp(dot(N, L) * 0.8 + 0.2, 0.0, 1.0);
    // Light through thin edges toward the viewer.
    float trans = pow(clamp(dot(-V, L), 0.0, 1.0), 3.0) * (1.0 - D) * 0.6;
    light += lightCol[i] * att * (ndl + trans);
  }
  float self = mix(1.0, 0.35, thick);
  vec3 albedo = (kind > 1.5 ? vec3(0.92, 0.93, 0.95) : vec3(0.62, 0.6, 0.58)) * vP.w;
  vec3 col = albedo * light * self;
  // Hot gas: emission by temperature, brightest in the dense core of the puff.
  float heat = vP.y;
  if (heat > 0.001) {
    float core = smoothstep(0.1, 0.9, D + 0.25 * snoise(vec3(vUv * 18.0, vP.w * 9.0)));
    vec3 em = fireRamp(heat * (0.75 + 0.35 * core)) * pow(heat, 2.2) * fireGain * (0.35 + 0.9 * core);
    col += em;
  }
  float absorb = kind > 0.5 && kind < 1.5 ? 0.35 : 1.0;
  gl_FragColor = vec4(col * alpha, alpha * absorb);
}`;

export class SmokeLayer {
  readonly mesh: THREE.Mesh;
  readonly geo: THREE.InstancedBufferGeometry;
  readonly a: THREE.InstancedBufferAttribute;
  readonly b: THREE.InstancedBufferAttribute;
  readonly c: THREE.InstancedBufferAttribute;
  constructor(capacity: number, material: THREE.ShaderMaterial) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.b = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.c = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iA', this.a);
    this.geo.setAttribute('iB', this.b);
    this.geo.setAttribute('iC', this.c);
    this.geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
  }
  dispose() {
    this.geo.dispose();
  }
}

export interface SmokeSystemOptions {
  renderer: THREE.WebGLRenderer;
  spawns: Spawn[];
  /** Wind (m/s), applied fully to the drifting part of the motion. */
  wind: THREE.Vector3;
  /** Height of the ground under (x, z) for particles to roll over. */
  groundAt: (x: number, z: number) => number;
}

export class SmokeSystem {
  readonly material: THREE.ShaderMaterial;
  readonly far: SmokeLayer;
  readonly near: SmokeLayer;
  private readonly data: Float32Array;
  private readonly n: number;
  private readonly atlas: THREE.WebGLRenderTarget;
  private readonly wind: THREE.Vector3;
  private readonly groundAt: (x: number, z: number) => number;
  private order: Int32Array;
  private depth: Float32Array;
  private px: Float32Array;
  readonly uniforms: {
    atlas: { value: THREE.Texture };
    tDepth: { value: THREE.Texture | null };
    resolution: { value: THREE.Vector2 };
    logFar: { value: number };
    lightPos: { value: THREE.Vector3[] };
    lightCol: { value: THREE.Vector3[] };
    lightRad: { value: number[] };
    skyAmb: { value: THREE.Vector3 };
    groundAmb: { value: THREE.Vector3 };
    dawnDir: { value: THREE.Vector3 };
    dawnCol: { value: THREE.Vector3 };
    fireGain: { value: number };
  };

  constructor(o: SmokeSystemOptions) {
    this.wind = o.wind;
    this.groundAt = o.groundAt;
    this.n = o.spawns.length;
    this.data = new Float32Array(this.n * STRIDE);
    o.spawns.forEach((s, i) => {
      const d = this.data;
      const k = i * STRIDE;
      d[k] = s.tb;
      d[k + 1] = s.life;
      d[k + 2] = s.p[0];
      d[k + 3] = s.p[1];
      d[k + 4] = s.p[2];
      d[k + 5] = s.v[0];
      d[k + 6] = s.v[1];
      d[k + 7] = s.v[2];
      d[k + 8] = s.drag;
      d[k + 9] = s.buoy;
      d[k + 10] = s.size0;
      d[k + 11] = s.grow;
      d[k + 12] = s.rot;
      d[k + 13] = s.spin;
      d[k + 14] = s.kind;
      d[k + 15] = s.tint;
      d[k + 16] = s.opacity;
      d[k + 17] = s.heat;
      d[k + 18] = s.cool;
      d[k + 19] = s.fadeIn ?? 0.12;
      d[k + 20] = (i * 0.618034) % 1; // seed
      d[k + 21] = (i * 7) % 4; // atlas variant
    });
    this.order = new Int32Array(this.n);
    this.depth = new Float32Array(this.n);
    this.px = new Float32Array(this.n * 9);
    this.atlas = bake(o.renderer, { width: 1024, height: 1024, frag: ATLAS_FRAG, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    const lights = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3());
    this.uniforms = {
      atlas: { value: this.atlas.texture },
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      logFar: { value: 1 },
      lightPos: { value: lights.map(() => new THREE.Vector3(0, -1e4, 0)) },
      lightCol: { value: lights.map(() => new THREE.Vector3()) },
      lightRad: { value: lights.map(() => 10) },
      skyAmb: { value: new THREE.Vector3(0.05, 0.07, 0.12) },
      groundAmb: { value: new THREE.Vector3(0.01, 0.01, 0.015) },
      dawnDir: { value: new THREE.Vector3(1, 0.05, 0).normalize() },
      dawnCol: { value: new THREE.Vector3(0.1, 0.05, 0.03) },
      fireGain: { value: 30 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.far = new SmokeLayer(this.n, this.material);
    this.near = new SmokeLayer(this.n, this.material);
    this.far.mesh.renderOrder = 10;
    this.near.mesh.renderOrder = 30;
  }

  setLights(l: LightSet) {
    for (let i = 0; i < MAX_LIGHTS; i++) {
      if (i < l.pos.length) {
        this.uniforms.lightPos.value[i]!.copy(l.pos[i]!);
        this.uniforms.lightCol.value[i]!.copy(l.col[i]!);
        this.uniforms.lightRad.value[i] = l.radius[i]!;
      } else {
        this.uniforms.lightCol.value[i]!.set(0, 0, 0);
      }
    }
  }

  /**
   * Evaluate every live particle at time t, sort back to front for `camera`, and split them into the layer behind
   * `splitZ(x, y, z)` (view depth of the flame at that point; far) and the one in front (near).
   */
  update(t: number, camera: THREE.Camera, splitZ: (x: number, y: number, z: number) => number, budget = 1) {
    const d = this.data;
    const px = this.px;
    const view = camera.matrixWorldInverse;
    const e = view.elements;
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      const k = i * STRIDE;
      const a = t - d[k]!;
      const life = d[k + 1]!;
      if (a < 0 || a > life) continue;
      if (budget < 1 && d[k + 20]! > budget) continue;
      const drag = d[k + 8]!;
      const ed = drag > 0 ? (1 - Math.exp(-drag * a)) / drag : a;
      const drift = a - ed;
      const seed = d[k + 20]!;
      const wob = 0.6 * Math.sqrt(a);
      let x = d[k + 2]! + d[k + 5]! * ed + this.wind.x * drift + Math.sin(seed * 40 + a * 0.7) * wob;
      let y = d[k + 3]! + d[k + 6]! * ed + d[k + 9]! * drift;
      let z = d[k + 4]! + d[k + 7]! * ed + this.wind.z * drift + Math.cos(seed * 31 + a * 0.6) * wob;
      const size = d[k + 10]! + d[k + 11]! * Math.pow(a, 0.65);
      const g = this.groundAt(x, z) + size * 0.22;
      if (y < g) y = g;
      const fadeIn = Math.min(1, a / d[k + 19]!);
      const u = a / life;
      const fadeOut = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45);
      const alpha = d[k + 16]! * fadeIn * fadeOut * fadeOut;
      if (alpha < 0.003) continue;
      const heat = d[k + 17]! * Math.exp(-d[k + 18]! * a);
      const vz = -(e[2]! * x + e[6]! * y + e[10]! * z + e[14]!);
      if (vz < -size) continue;
      const j = live * 9;
      px[j] = x;
      px[j + 1] = y;
      px[j + 2] = z;
      px[j + 3] = size;
      px[j + 4] = d[k + 12]! + d[k + 13]! * a;
      px[j + 5] = alpha;
      px[j + 6] = heat;
      px[j + 7] = d[k + 21]! + 4 * d[k + 14]!;
      px[j + 8] = d[k + 15]!;
      this.depth[live] = vz;
      this.order[live] = live;
      live++;
    }
    const ord = this.order.subarray(0, live);
    const dep = this.depth;
    ord.sort((p, q) => dep[q]! - dep[p]!);
    let nf = 0;
    let nn = 0;
    const fa = this.far.a.array as Float32Array;
    const fb = this.far.b.array as Float32Array;
    const fc = this.far.c.array as Float32Array;
    const na = this.near.a.array as Float32Array;
    const nb = this.near.b.array as Float32Array;
    const nc = this.near.c.array as Float32Array;
    for (let r = 0; r < live; r++) {
      const j = ord[r]! * 9;
      const isFar = dep[ord[r]!]! > splitZ(px[j]!, px[j + 1]!, px[j + 2]!);
      const A = isFar ? fa : na;
      const B = isFar ? fb : nb;
      const Cc = isFar ? fc : nc;
      const o = (isFar ? nf++ : nn++) * 4;
      A[o] = px[j]!;
      A[o + 1] = px[j + 1]!;
      A[o + 2] = px[j + 2]!;
      A[o + 3] = px[j + 3]!;
      B[o] = px[j + 4]!;
      B[o + 1] = px[j + 5]!;
      B[o + 2] = px[j + 6]!;
      B[o + 3] = px[j + 7]!;
      Cc[o] = px[j + 8]!;
      Cc[o + 1] = 0;
    }
    for (const [layer, count] of [
      [this.far, nf],
      [this.near, nn],
    ] as const) {
      layer.geo.instanceCount = count;
      layer.a.needsUpdate = layer.b.needsUpdate = layer.c.needsUpdate = true;
      layer.a.addUpdateRange(0, count * 4);
      layer.b.addUpdateRange(0, count * 4);
      layer.c.addUpdateRange(0, count * 4);
    }
    return live;
  }

  dispose() {
    this.far.dispose();
    this.near.dispose();
    this.material.dispose();
    this.atlas.dispose();
  }
}


// ---------------------------------------------------------------------------------------------------------------
// Sparks

export interface SparkSpawn {
  tb: number;
  life: number;
  p: [number, number, number];
  v: [number, number, number];
  /** Streak width (m) and brightness. */
  width: number;
  bright: number;
  /** Floor height for the bounce (-1e4: none). */
  floor: number;
}

const SPARK_VERT = /* glsl */ `
attribute vec4 iP; // p0, tb
attribute vec4 iV; // v0, life
attribute vec4 iS; // width, bright, floor, seed
uniform float time;
uniform float gravity;
uniform float streak;
varying float vHeat;
varying float vTemp;
varying float vAcross;
varying float vAlong;
#include <common>
#include <logdepthbuf_pars_vertex>
vec3 pathAt(float a, out float bounced) {
  vec3 p = iP.xyz; vec3 v = iV.xyz;
  bounced = 0.0;
  // Light drag: positions as if velocity decays slowly.
  float k = 0.6;
  float e = (1.0 - exp(-k * a)) / k;
  vec3 q = p + v * e;
  q.y -= 0.5 * gravity * a * a;
  if (q.y < iS.z) {
    // Find the bounce by bisection, then continue with damped, reflected velocity.
    float lo = 0.0, hi = a;
    for (int i = 0; i < 10; i++) {
      float m = 0.5 * (lo + hi);
      float em = (1.0 - exp(-k * m)) / k;
      float y = p.y + v.y * em - 0.5 * gravity * m * m;
      if (y > iS.z) lo = m; else hi = m;
    }
    float ab = lo;
    float eb = (1.0 - exp(-k * ab)) / k;
    vec3 pb = p + v * eb; pb.y = iS.z;
    vec3 vb = v * exp(-k * ab); vb.y -= gravity * ab;
    vb = vec3(vb.x * 0.55, -vb.y * 0.32, vb.z * 0.55);
    float a2 = a - ab;
    float e2 = (1.0 - exp(-k * a2)) / k;
    q = pb + vb * e2; q.y -= 0.5 * gravity * a2 * a2;
    q.y = max(q.y, iS.z);
    bounced = 1.0;
  }
  return q;
}
void main() {
  float a = time - iP.w;
  float life = iV.w;
  if (a < 0.0 || a > life) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  float b0, b1;
  vec3 head = pathAt(a, b0);
  vec3 tail = pathAt(max(0.0, a - streak), b1);
  vec3 along = head - tail;
  float len = length(along);
  vec3 dir = len > 1e-5 ? along / len : vec3(0.0, 1.0, 0.0);
  vec3 toCam = normalize(cameraPosition - head);
  vec3 side = normalize(cross(dir, toCam) + 1e-6);
  // position.x: -0.5..0.5 across, position.y: -0.5 (tail) .. 0.5 (head)
  float s = position.y + 0.5;
  vec3 w = mix(tail, head, s) + side * position.x * iS.x + dir * (s - 0.5) * iS.x;
  float u = a / max(life, 0.05);
  vTemp = mix(0.95, 0.45, u);
  vHeat = iS.y * exp(-u * 1.5) * (1.0 - smoothstep(0.75, 1.0, u));
  vAcross = position.x * 2.0;
  vAlong = s;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  #include <logdepthbuf_vertex>
}`;

const SPARK_FRAG = /* glsl */ `
varying float vHeat;
varying float vTemp;
varying float vAcross;
varying float vAlong;
#include <common>
#include <logdepthbuf_pars_fragment>
${FIRE_RAMP}
void main() {
  #include <logdepthbuf_fragment>
  float prof = exp(-vAcross * vAcross * 4.0) * mix(0.35, 1.0, vAlong);
  vec3 c = fireRamp(vTemp) * vHeat * prof;
  gl_FragColor = vec4(c, 0.0);
}`;

export class SparkSystem {
  readonly mesh: THREE.Mesh;
  readonly uniforms = { time: { value: 0 }, gravity: { value: 9.81 }, streak: { value: 0.03 } };
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  constructor(spawns: SparkSpawn[], gain = 40) {
    const base = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    const p = new Float32Array(spawns.length * 4);
    const v = new Float32Array(spawns.length * 4);
    const s = new Float32Array(spawns.length * 4);
    spawns.forEach((sp, i) => {
      p.set([...sp.p, sp.tb], i * 4);
      v.set([...sp.v, sp.life], i * 4);
      s.set([sp.width, sp.bright * gain, sp.floor, (i * 0.618) % 1], i * 4);
    });
    this.geo.setAttribute('iP', new THREE.InstancedBufferAttribute(p, 4));
    this.geo.setAttribute('iV', new THREE.InstancedBufferAttribute(v, 4));
    this.geo.setAttribute('iS', new THREE.InstancedBufferAttribute(s, 4));
    this.geo.instanceCount = spawns.length;
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }
  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}
