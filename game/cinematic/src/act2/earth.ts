// Earth seen from the lunar south pole, for the long-lens shot where it is large in frame: drawn in the
// main scene exactly over the game sky's Earth (same direction and size, far behind the terrain so the
// horizon hides it as the game's does), with a procedural surface computed on the sphere (no seams):
// oceans with a sun glint, continents, ice caps, cloud bands with swirling storms, a blue limb and a thin
// warm terminator. Lit by the Sun from the act's direction (its phase follows).
import * as THREE from 'three';

const EARTH_RADIUS_DEG = 0.95; // as the game's sky (world/sky.ts)

const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 7; i++) { if (i >= oct) break; s += a * snoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
`;

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;     // object-space normal (the surface point)
varying vec3 vWN;    // world normal
varying vec3 vView;  // world direction to the camera
void main() {
  vN = normalize(position);
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun;
uniform float uIntensity;
varying vec3 vN;
varying vec3 vWN;
varying vec3 vView;
${NOISE}
void main() {
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vN);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  // Continents: low-frequency fbm with a warped coastline.
  vec3 q = p * 1.6 + vec3(fbm(p * 2.0 + 3.1, 3), fbm(p * 2.0 - 7.3, 3), 0.0) * 0.35;
  float land = fbm(q, 6) + 0.06;
  float isLand = smoothstep(0.0, 0.02, land);
  float shelf = smoothstep(-0.07, 0.0, land) * (1.0 - isLand);
  // Land colour: dry tan around 20-35° latitude, greener toward the equator and higher latitudes, mottled.
  float al = abs(lat);
  float dry = smoothstep(0.15, 0.35, al) * (1.0 - smoothstep(0.55, 0.8, al));
  float tex = fbm(p * 9.0, 4);
  vec3 green = mix(vec3(0.07, 0.11, 0.045), vec3(0.16, 0.17, 0.08), tex * 0.5 + 0.5);
  vec3 desert = mix(vec3(0.42, 0.33, 0.2), vec3(0.58, 0.47, 0.31), tex * 0.5 + 0.5);
  vec3 landCol = mix(green, desert, clamp(dry + tex * 0.3, 0.0, 1.0));
  vec3 ocean = mix(vec3(0.012, 0.035, 0.09), vec3(0.03, 0.09, 0.16), shelf);
  vec3 albedo = mix(ocean, landCol, isLand);
  // Ice caps.
  float ice = smoothstep(1.08, 1.2, al + fbm(p * 5.0, 3) * 0.12);
  albedo = mix(albedo, vec3(0.85, 0.88, 0.92), ice);
  // Clouds: latitude bands (tropics, storm tracks) and warped fbm swirls.
  vec3 w = p * 3.0;
  w += vec3(fbm(p * 4.0 + 1.7, 4), fbm(p * 4.0 + 9.2, 4), fbm(p * 4.0 - 4.4, 4)) * 0.9;
  float c = fbm(w, 6);
  float band = 0.5 + 0.35 * cos(lat * 6.0) + 0.25 * smoothstep(0.6, 1.0, al);
  float cloud = smoothstep(0.02, 0.35, c + (band - 0.6) * 0.35);
  float wisp = smoothstep(0.1, 0.5, fbm(w * 3.0 + 5.0, 4)) * 0.35;
  cloud = clamp(cloud + wisp * (1.0 - cloud) * 0.6, 0.0, 1.0);
  vec3 col;
  vec3 n = normalize(vWN);
  float mu = dot(n, uSun);
  float day = smoothstep(-0.06, 0.12, mu);
  float lit = max(mu, 0.0);
  // Surface (Lambert), ocean glint, clouds over.
  vec3 surf = albedo * lit;
  vec3 h = normalize(uSun + normalize(vView));
  float spec = pow(max(dot(n, h), 0.0), 60.0) * (1.0 - isLand) * (1.0 - ice) * lit * 0.6;
  surf += vec3(1.0, 0.95, 0.85) * spec;
  vec3 cloudCol = vec3(0.92, 0.93, 0.95) * (0.08 + 0.92 * lit);
  col = mix(surf, cloudCol * day, cloud * 0.92);
  // Atmosphere: blue scattering on the day side, strongest at the limb; a thin warm terminator.
  float rim = 1.0 - max(dot(n, normalize(vView)), 0.0);
  vec3 sky = vec3(0.25, 0.45, 1.0) * (0.12 + 1.2 * pow(rim, 3.0)) * smoothstep(-0.15, 0.25, mu);
  col += sky * 0.55;
  col += vec3(1.0, 0.45, 0.2) * 0.08 * exp(-pow(mu / 0.05, 2.0)) * (1.0 - cloud * 0.5);
  gl_FragColor = vec4(col * uIntensity, 1.0);
}`;

export class Earth {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly dir: THREE.Vector3;
  private readonly distance = 300_000;

  constructor(earthDir: THREE.Vector3, sunDir: THREE.Vector3, intensity = 1.6) {
    this.dir = earthDir.clone().normalize();
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uSun: { value: sunDir.clone().normalize() }, uIntensity: { value: intensity } },
    });
    const r = this.distance * Math.tan((EARTH_RADIUS_DEG * Math.PI) / 180) * 1.004;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 128, 64), this.material);
    // Turn the globe so a cloud-swirled ocean and a continent's edge face the Moon.
    this.mesh.rotation.set(0.35, 2.2, 0.15);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'act2:earth';
  }

  /** Keep the globe at its sky direction from the camera (it is "at infinity"). */
  update(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position).addScaledVector(this.dir, this.distance);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
