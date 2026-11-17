// Engine exhaust as a ray-marched emissive volume inside a bounding cylinder (drawn back faces, additive), so it
// reads right from inside the plume in the close-up as well as from a kilometre away. Sea level: five engine cores
// with shock diamonds that merge into one turbulent column, its temperature falling along the axis. Vacuum: one
// wide translucent bell that scatters sunlight, hot only near the nozzle.
//
// Plume frame: y = 0 at the nozzle exit plane, the exhaust runs toward -y. The scene's depth (a log-depth texture)
// clips the march so walls, the deck and the rocket hide what is behind them.
import * as THREE from 'three';
import { FIRE_RAMP, LOGDEPTH, NOISE } from './glsl';

const VERT = /* glsl */ `
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;

const FRAG = /* glsl */ `
#define NE 5
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float logFar;
uniform vec3 camFwd;
uniform mat4 toLocal;
uniform float boundR;
uniform float boundL;
uniform float time;
uniform float steps;
uniform float jitter;
uniform vec2 enginePos[NE];
uniform float engineOn[NE];
uniform float front[NE];
uniform float exitR;
uniform float gain;
uniform float columnOn;
uniform float columnLen;
uniform float spread;
uniform float floorS;
uniform float vacuum;
uniform float vacExpand;
uniform vec3 sunDir;
uniform vec3 sunCol;
uniform float vacScatter;
uniform float vacHot;
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE}
${LOGDEPTH}
${FIRE_RAMP}

vec3 seaLevel(vec3 p) {
  float s = -p.y;
  if (s < 0.0 || s > floorS + 1.0) return vec3(0.0);
  vec3 col = vec3(0.0);
  float lambda = exitR * 1.45;
  for (int i = 0; i < NE; i++) {
    float on = engineOn[i];
    if (on <= 0.0) continue;
    vec2 d = p.xz - enginePos[i];
    float rho = length(d);
    if (rho > exitR * 1.6 + s * 0.05 || s > front[i] + 0.5 || s > 14.0) continue;
    float fm = smoothstep(front[i], front[i] - 1.2, s);
    float rc = exitR * (0.9 + 0.1 * cos(s * 6.2831 / lambda)) + s * 0.03;
    float core = exp(-pow(rho / rc, 4.0)) * exp(-s / 6.0);
    float ph = s / lambda;
    float diamond = pow(0.5 + 0.5 * cos(ph * 6.2831), 8.0) * exp(-s / 4.5) * smoothstep(0.15, 0.8, s);
    float knot = exp(-pow(rho / (rc * 0.45), 2.0)) * diamond;
    float n = snoise(vec3(d * 3.0, (s - time * 40.0) * 0.8 + float(i) * 7.0));
    col += on * fm * (vec3(1.0, 0.82, 0.55) * core * (3.0 + 1.0 * n) + vec3(1.0, 0.95, 0.85) * knot * 12.0);
  }
  float rhoC = length(p.xz);
  if (columnOn > 0.0 && rhoC < (1.5 + s * spread) * 1.6 + 0.5) {
    float rho = rhoC;
    float R = 1.5 + s * spread;
    vec3 q = vec3(p.x * 0.55, (s - time * 28.0) * 0.22, p.z * 0.55);
    float n = fbm3(q);
    float edge = R * (1.0 + 0.45 * n) - rho;
    float dens = smoothstep(-0.2, R * 0.5, edge);
    float T = clamp(1.0 - s / columnLen, 0.0, 1.0);
    T = clamp(T * (0.8 + 0.35 * n), 0.0, 1.0);
    float fm = smoothstep(columnOn * columnLen * 1.3, columnOn * columnLen * 1.3 - 4.0, s);
    float startCore = smoothstep(0.0, 2.5, s);
    col += fireRamp(T) * dens * pow(T, 1.3) * 4.0 * fm * startCore;
  }
  // Fire spreading where the column meets the ground/deck.
  float toFloor = floorS - s;
  if (toFloor < 6.0 && columnOn > 0.0) {
    float rho = length(p.xz);
    float n = fbm3(vec3(p.xz * 0.35, time * 1.5));
    float sheet = exp(-max(toFloor, 0.0) / 1.5) * smoothstep(floorS * 0.25 + 14.0, 2.0, rho * (1.0 - 0.3 * n));
    col += fireRamp(0.75 + 0.2 * n) * sheet * 1.0 * columnOn;
  }
  return col;
}

vec3 vac(vec3 p, vec3 V) {
  float s = -p.y;
  if (s < 0.0) return vec3(0.0);
  float rho = length(p.xz);
  float R = exitR + s * vacExpand;
  vec3 q = vec3(p.x, s - time * 60.0, p.z) * (0.6 / max(1.0, R * 0.25));
  float n = fbm3(q);
  float x = rho / R;
  float body = exp(-x * x * 2.2) * exp(-s / boundL * 2.2);
  float shell = exp(-pow((x - 0.92) / 0.09, 2.0)) * exp(-s / boundL * 1.6) * 0.55;
  float dens = (body + shell) * (0.75 + 0.35 * n) / (1.0 + R * 0.15);
  // Sunlight scattered by the exhaust: forward-peaked phase function.
  float mu = dot(V, sunDir);
  float phase = 0.25 + 1.6 * pow(max(mu * 0.5 + 0.5, 0.0), 6.0);
  vec3 scat = sunCol * dens * phase * vacScatter;
  float hot = exp(-s / (exitR * 2.2)) * exp(-x * x * 3.0);
  vec3 em = fireRamp(0.8 * exp(-s / (exitR * 4.0)) + 0.15) * hot * vacHot;
  return scat + em;
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 ro = (toLocal * vec4(cameraPosition, 1.0)).xyz;
  vec3 wDir = normalize(vW - cameraPosition);
  vec3 rd = normalize((toLocal * vec4(wDir, 0.0)).xyz);
  float scale = length((toLocal * vec4(wDir, 0.0)).xyz);
  // Ray vs. the finite cylinder (radius boundR, y from -boundL to 0).
  float a = dot(rd.xz, rd.xz);
  float b = dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - boundR * boundR;
  float h = b * b - a * c;
  if (h < 0.0 || a < 1e-8) discard;
  h = sqrt(h);
  float t0 = (-b - h) / a;
  float t1 = (-b + h) / a;
  float ty0 = (0.0 - ro.y) / rd.y;
  float ty1 = (-boundL - ro.y) / rd.y;
  float tyn = min(ty0, ty1), tyf = max(ty0, ty1);
  t0 = max(max(t0, tyn), 0.0);
  t1 = min(t1, tyf);
  // Opaque scene depth along the ray (local units).
  float sceneZ = viewZFromLogDepth(texture2D(tDepth, gl_FragCoord.xy / resolution).x, logFar);
  float sceneT = sceneZ / max(dot(wDir, camFwd), 1e-3) * scale;
  t1 = min(t1, sceneT);
  if (t1 <= t0) discard;
  float N = steps;
  float dt = (t1 - t0) / N;
  float j = hash12(gl_FragCoord.xy + jitter * 61.7);
  vec3 sum = vec3(0.0);
  vec3 Vl = rd;
  for (int i = 0; i < 64; i++) {
    if (float(i) >= N) break;
    vec3 p = ro + rd * (t0 + (float(i) + j) * dt);
    sum += vacuum > 0.5 ? vac(p, Vl) : seaLevel(p);
  }
  vec3 col = sum * dt / scale * gain;
  gl_FragColor = vec4(col, 0.0);
}`;

export interface PlumeUniforms {
  tDepth: { value: THREE.Texture | null };
  resolution: { value: THREE.Vector2 };
  logFar: { value: number };
  camFwd: { value: THREE.Vector3 };
  toLocal: { value: THREE.Matrix4 };
  boundR: { value: number };
  boundL: { value: number };
  time: { value: number };
  steps: { value: number };
  jitter: { value: number };
  enginePos: { value: THREE.Vector2[] };
  engineOn: { value: number[] };
  front: { value: number[] };
  exitR: { value: number };
  gain: { value: number };
  columnOn: { value: number };
  columnLen: { value: number };
  spread: { value: number };
  floorS: { value: number };
  vacuum: { value: number };
  vacExpand: { value: number };
  sunDir: { value: THREE.Vector3 };
  sunCol: { value: THREE.Vector3 };
  vacScatter: { value: number };
  vacHot: { value: number };
}

export class Plume {
  readonly mesh: THREE.Mesh;
  readonly uniforms: PlumeUniforms;
  private readonly material: THREE.ShaderMaterial;
  constructor(o: { boundR: number; boundL: number; engines: [number, number][]; exitR: number; vacuum?: boolean }) {
    this.uniforms = {
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      logFar: { value: 1 },
      camFwd: { value: new THREE.Vector3() },
      toLocal: { value: new THREE.Matrix4() },
      boundR: { value: o.boundR },
      boundL: { value: o.boundL },
      time: { value: 0 },
      steps: { value: 40 },
      jitter: { value: 0 },
      enginePos: { value: Array.from({ length: 5 }, (_, i) => new THREE.Vector2(...(o.engines[i] ?? [0, 0]))) },
      engineOn: { value: [0, 0, 0, 0, 0] },
      front: { value: [0, 0, 0, 0, 0] },
      exitR: { value: o.exitR },
      gain: { value: 1 },
      columnOn: { value: 0 },
      columnLen: { value: 40 },
      spread: { value: 0.12 },
      floorS: { value: 1e4 },
      vacuum: { value: o.vacuum ? 1 : 0 },
      vacExpand: { value: 1.2 },
      sunDir: { value: new THREE.Vector3(1, 0, 0) },
      sunCol: { value: new THREE.Vector3(1, 1, 1) },
      vacScatter: { value: 1 },
      vacHot: { value: 20 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.BackSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    const g = new THREE.CylinderGeometry(o.boundR, o.boundR, o.boundL, 48, 1, false);
    g.translate(0, -o.boundL / 2, 0);
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }

  /** Call before drawing: camera-dependent uniforms (after the mesh's world matrix is current). */
  prepare(camera: THREE.Camera) {
    this.mesh.updateWorldMatrix(true, false);
    this.uniforms.toLocal.value.copy(this.mesh.matrixWorld).invert();
    camera.getWorldDirection(this.uniforms.camFwd.value);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
