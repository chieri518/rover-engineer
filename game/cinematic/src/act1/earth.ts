// The Earth for the orbit shot, from NASA imagery (cinematic/tools/fetch-assets.mjs; credits in
// cinematic/assets/CREDITS.md): Blue Marble ground, VIIRS true-colour clouds (extracted to a cloud mask at load),
// Black Marble city lights, all on one lat/lon box over the western Atlantic, with whole-Earth fallbacks outside it.
// Lit by a low sun through the atmosphere (reddened at the terminator), with cloud relief and cloud shadows, an
// ocean sun glint, city lights on the night side, and a single-scattering atmosphere shell (Rayleigh + Mie) drawn
// over it: blue limb, sunrise orange at the terminator, aerial haze.
//
// Units: metres in the scene; the shaders work in kilometres relative to the planet centre for precision.
import * as THREE from 'three';
import { bake } from './bake';

export const EARTH_R = 6371e3;
const ATMO_H = 100e3;
/** The region's lat/lon box (degrees); must match cinematic/tools/fetch-assets.mjs. */
const REGION = { south: 17, north: 45, west: -92, east: -58 };
const ASSETS = '/cinematic/assets/download/';

const ATMO_COMMON = /* glsl */ `
const float Rg = 6371.0;
const float Rt = 6471.0;
const vec3 betaR = vec3(5.8e-3, 13.5e-3, 33.1e-3); // per km
const float betaM = 8e-3;
const float HR = 8.0;
const float HM = 1.2;
vec2 raySphere(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
// Optical depth (Rayleigh, Mie) from point p (km, planet frame) toward the sun, 6 steps. Where the planet blocks
// the sun the depth grows smoothly over a few km of grazing height (the sun's disc and refraction soften the
// shadow edge), so the terminator and the Earth's shadow in the air have no hard steps.
vec2 sunDepth(vec3 p, vec3 L) {
  float tc = -dot(p, L);
  float hmin = tc > 0.0 ? length(p + L * tc) - Rg : length(p) - Rg;
  float t1 = raySphere(p, L, Rt).y;
  float dt = max(t1, 0.0) / 6.0;
  vec2 od = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    vec3 q = p + L * (float(i) + 0.5) * dt;
    float h = max(length(q) - Rg, 0.0);
    od += vec2(exp(-h / HR), exp(-h / HM)) * dt;
  }
  float block = 1.0 - smoothstep(-8.0, 3.0, hmin);
  return od + vec2(block * 400.0);
}
vec3 transmit(vec2 od) { return exp(-(betaR * od.x + betaM * 1.1 * od.y)); }
`;

const EARTH_VERT = /* glsl */ `
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;

const EARTH_FRAG = /* glsl */ `
uniform vec3 center;      // planet centre (scene, m)
uniform mat3 toEcef;      // scene direction -> ECEF
uniform vec3 sunDir;
uniform float sunIrr;
uniform sampler2D rGround, rCloud, rLights, wGround, wClouds, wLights;
uniform vec4 region;      // south, north, west, east (deg)
uniform vec2 cloudTexel;
uniform float lightsGain;
uniform float time;
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_fragment>
${ATMO_COMMON}
float inRegion(vec2 ll) {
  vec2 a = vec2((ll.y - region.z) / (region.w - region.z), (ll.x - region.x) / (region.y - region.x));
  vec2 e = min(a, 1.0 - a);
  return smoothstep(0.0, 0.02, min(e.x, e.y));
}
vec2 regionUv(vec2 ll) { return vec2((ll.y - region.z) / (region.w - region.z), (ll.x - region.x) / (region.y - region.x)); }
vec2 worldUv(vec2 ll) { return vec2((ll.y + 180.0) / 360.0, (ll.x + 90.0) / 180.0); }
float cloudAt(vec2 ll, float k) {
  float rc = texture2D(rCloud, regionUv(ll)).r;
  float wc = smoothstep(0.15, 0.85, texture2D(wClouds, worldUv(ll)).r);
  return mix(wc, rc, k);
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 pk = (vW - center) * 0.001;           // km, planet frame (scene axes)
  vec3 n = normalize(pk);
  vec3 e = toEcef * n;
  vec2 ll = vec2(degrees(asin(clamp(e.z, -1.0, 1.0))), degrees(atan(e.y, e.x)));
  float k = inRegion(ll);
  vec3 ground = mix(texture2D(wGround, worldUv(ll)).rgb, texture2D(rGround, regionUv(ll)).rgb, k);
  float lights = mix(texture2D(wLights, worldUv(ll)).r, texture2D(rLights, regionUv(ll)).r, k);
  float cloud = cloudAt(ll, k);
  // Ocean: bluish and dark in the Blue Marble.
  float water = smoothstep(0.004, 0.03, ground.b - max(ground.r, ground.g) * 0.8) * (1.0 - smoothstep(0.12, 0.2, ground.g));

  vec3 V = normalize(cameraPosition * 0.001 - (vW * 0.001));
  vec3 L = sunDir;
  float mu = dot(n, L);
  vec3 Tg = transmit(sunDepth(n * (Rg + 0.05), L));
  vec3 Tc = transmit(sunDepth(n * (Rg + 4.0), L));   // cloud tops see the sun longer
  // Cloud relief: the cloud mask as a height field, tilting the cloud normal.
  vec2 ruv = regionUv(ll);
  float cx = texture2D(rCloud, ruv + vec2(cloudTexel.x, 0.0)).r - texture2D(rCloud, ruv - vec2(cloudTexel.x, 0.0)).r;
  float cy = texture2D(rCloud, ruv + vec2(0.0, cloudTexel.y)).r - texture2D(rCloud, ruv - vec2(0.0, cloudTexel.y)).r;
  vec3 eastS = normalize(transpose(toEcef) * vec3(-sin(radians(ll.y)), cos(radians(ll.y)), 0.0));
  vec3 northS = cross(n, eastS);
  vec3 nc = normalize(n - (eastS * cx + northS * cy) * 2.2 * k);
  float muc = dot(nc, L);
  // Cloud shadow on the ground: the cloud cover toward the sun, at the cloud height (long at grazing light).
  vec3 Lt = L - n * mu;
  float tanEl = max(mu, 0.02) / max(length(Lt), 1e-3);
  float shadowKm = min(4.0 / tanEl, 120.0);
  vec2 dLL = vec2(dot(Lt, northS), dot(Lt, eastS)) / max(length(Lt), 1e-4) * shadowKm / Rg;
  vec2 llS = ll + degrees(dLL) * vec2(1.0, 1.0 / max(cos(radians(ll.x)), 0.2));
  float shade = 1.0 - 0.75 * cloudAt(llS, inRegion(llS));

  // Ground and ocean.
  vec3 sky = vec3(0.02, 0.05, 0.12) * smoothstep(-0.15, 0.2, mu);   // skylight
  vec3 albedo = ground * mix(1.0, 0.7, water);
  vec3 col = albedo * (sunIrr * Tg * max(mu, 0.0) * shade + sky) / 3.14159;
  // Sun glint on the water (GGX, rough sea).
  vec3 Hh = normalize(L + V);
  float nh = max(dot(n, Hh), 0.0);
  float a2 = 0.09 * 0.09;
  float D = a2 / (3.14159 * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(V, Hh), 0.0), 5.0);
  col += water * D * F * sunIrr * Tg * max(mu, 0.0) * shade * 0.25 / max(4.0 * max(dot(n, V), 0.05), 1e-3);
  // Clouds: bright, wrap-lit, darker in their own shade.
  float cl = clamp(muc * 0.8 + 0.2, 0.0, 1.0);
  vec3 cloudCol = vec3(0.92) * (sunIrr * Tc * cl * smoothstep(-0.08, 0.05, mu + 0.02) + sky * 1.5) / 3.14159;
  col = mix(col, cloudCol, cloud);
  // City lights on the night side, dimmed by cloud.
  float night = 1.0 - smoothstep(-0.1, 0.03, mu);
  vec3 lightCol = vec3(1.0, 0.62, 0.3) * pow(lights, 1.6) * lightsGain;
  col += lightCol * night * (1.0 - 0.85 * cloud);
  gl_FragColor = vec4(col, 1.0);
}`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 center;
uniform vec3 sunDir;
uniform float sunI;
uniform float steps;
varying vec3 vW;
#include <common>
#include <logdepthbuf_pars_fragment>
${ATMO_COMMON}
void main() {
  #include <logdepthbuf_fragment>
  vec3 o = (cameraPosition - center) * 0.001;
  vec3 d = normalize(vW - cameraPosition);
  vec2 ta = raySphere(o, d, Rt);
  if (ta.y < 0.0) discard;
  float t0 = max(ta.x, 0.0);
  float t1 = ta.y;
  vec2 tg = raySphere(o, d, Rg);
  if (tg.x > 0.0) t1 = min(t1, tg.x);
  float N = steps;
  float dt = (t1 - t0) / N;
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  vec2 odView = vec2(0.0);
  for (int i = 0; i < 24; i++) {
    if (float(i) >= N) break;
    vec3 p = o + d * (t0 + (float(i) + 0.5) * dt);
    float h = length(p) - Rg;
    vec2 dens = vec2(exp(-h / HR), exp(-h / HM)) * dt;
    odView += dens;
    vec2 odSun = sunDepth(p, sunDir);
    vec3 T = transmit(odView + odSun);
    sumR += T * dens.x;
    sumM += T * dens.y;
  }
  float mu = dot(d, sunDir);
  float pR = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu);
  float g = 0.76;
  float pM = 3.0 / (8.0 * 3.14159) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 inscatter = sunI * (sumR * betaR * pR + sumM * betaM * pM);
  vec3 Tv = transmit(odView);
  gl_FragColor = vec4(inscatter, dot(Tv, vec3(0.3, 0.4, 0.3)));
}`;

export interface Earth {
  group: THREE.Group;
  uniforms: { center: { value: THREE.Vector3 }; sunDir: { value: THREE.Vector3 } };
  setSun(dir: THREE.Vector3): void;
  dispose(): void;
}

async function loadTex(url: string, srgb: boolean, mipmaps = true): Promise<THREE.Texture | null> {
  try {
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.generateMipmaps = mipmaps;
    tex.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.anisotropy = 16;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  } catch {
    console.warn(`act1: missing ${url}; run node cinematic/tools/fetch-assets.mjs`);
    return null;
  }
}

function solid(r: number, g: number, b: number): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

/** Build the Earth with the region's point (lat0, lon0) straight below the scene origin, `alt` metres down. */
export async function buildEarth(renderer: THREE.WebGLRenderer, o: { lat0: number; lon0: number; alt: number }): Promise<Earth> {
  const disposables: { dispose(): void }[] = [];
  const [rGround, rDay, rLights, wGround, wClouds, wLights] = await Promise.all([
    loadTex(`${ASSETS}region-ground.jpg`, true),
    loadTex(`${ASSETS}region-day.jpg`, false, false),
    loadTex(`${ASSETS}region-lights.jpg`, false),
    loadTex(`${ASSETS}world-ground.jpg`, true),
    loadTex(`${ASSETS}world-clouds.jpg`, false),
    loadTex(`${ASSETS}world-lights.jpg`, false),
  ]);
  // Cloud mask from the VIIRS true colour: white, unsaturated and bright is cloud; dark sea and green land are not.
  let rCloud: THREE.Texture;
  let cloudSize = new THREE.Vector2(1, 1);
  if (rDay) {
    const img = rDay.image as { width: number; height: number };
    const w = Math.min(img.width, 8192);
    const h = Math.round((w * img.height) / img.width);
    const rt = bake(renderer, {
      width: w,
      height: h,
      format: THREE.RedFormat,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      uniforms: { tDay: { value: rDay } },
      frag: /* glsl */ `
        uniform sampler2D tDay;
        void main() {
          vec3 c = texture2D(tDay, vUv).rgb;
          float mn = min(c.r, min(c.g, c.b));
          float mx = max(c.r, max(c.g, c.b));
          float sat = (mx - mn) / max(mx, 1e-3);
          float a = smoothstep(0.28, 0.78, mn) * (1.0 - smoothstep(0.18, 0.45, sat));
          gl_FragColor = vec4(a, 0.0, 0.0, 1.0);
        }`,
    });
    rDay.dispose();
    rCloud = rt.texture;
    disposables.push(rt);
    cloudSize = new THREE.Vector2(1 / w, 1 / h);
  } else {
    rCloud = solid(0, 0, 0);
    disposables.push(rCloud);
  }
  const fallbackGround = solid(8, 20, 45);
  const black = solid(0, 0, 0);
  disposables.push(fallbackGround, black);
  for (const t of [rGround, rLights, wGround, wClouds, wLights]) if (t) disposables.push(t);

  // Scene direction -> ECEF: east, up, south at (lat0, lon0) are scene +x, +y, +z.
  const la = THREE.MathUtils.degToRad(o.lat0);
  const lo = THREE.MathUtils.degToRad(o.lon0);
  const E = new THREE.Vector3(-Math.sin(lo), Math.cos(lo), 0);
  const U = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la));
  const Nn = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la));
  const toEcef = new THREE.Matrix3().set(E.x, U.x, -Nn.x, E.y, U.y, -Nn.y, E.z, U.z, -Nn.z);

  const center = new THREE.Vector3(0, -(EARTH_R + o.alt), 0);
  const sunDir = new THREE.Vector3(1, 0, 0);
  const earthMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      center: { value: center },
      toEcef: { value: toEcef },
      sunDir: { value: sunDir },
      sunIrr: { value: 7 },
      rGround: { value: rGround ?? fallbackGround },
      rCloud: { value: rCloud },
      rLights: { value: rLights ?? black },
      wGround: { value: wGround ?? fallbackGround },
      wClouds: { value: wClouds ?? black },
      wLights: { value: wLights ?? black },
      region: { value: new THREE.Vector4(REGION.south, REGION.north, REGION.west, REGION.east) },
      cloudTexel: { value: cloudSize.multiplyScalar(1.5) },
      lightsGain: { value: 0.35 },
      time: { value: 0 },
    },
  });
  disposables.push(earthMat);
  const earthGeo = new THREE.SphereGeometry(EARTH_R, 768, 384);
  disposables.push(earthGeo);
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.frustumCulled = false;
  earth.renderOrder = -2;

  // The atmosphere composites over the planet and space only. It marches the whole view ray and ignores depth,
  // so it is drawn in the opaque pass before everything else (renderOrder -1, not transparent): a craft in front of
  // the planet (above the air, at orbital height) is then drawn over it, solid, instead of hazed through.
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: { center: { value: center }, sunDir: { value: sunDir }, sunI: { value: 16 }, steps: { value: 20 } },
    side: THREE.BackSide,
    transparent: false,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.SrcAlphaFactor,
  });
  disposables.push(atmoMat);
  const atmoGeo = new THREE.SphereGeometry(EARTH_R + ATMO_H + 2e3, 256, 128);
  disposables.push(atmoGeo);
  const atmo = new THREE.Mesh(atmoGeo, atmoMat);
  atmo.frustumCulled = false;
  atmo.renderOrder = -1;

  const group = new THREE.Group();
  group.add(earth, atmo);
  earth.position.copy(center);
  atmo.position.copy(center);
  return {
    group,
    uniforms: { center: { value: center }, sunDir: { value: sunDir } },
    setSun(dir) {
      sunDir.copy(dir);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

export function moveEarth(e: Earth, center: THREE.Vector3) {
  e.uniforms.center.value.copy(center);
  for (const c of e.group.children) c.position.copy(center);
}
