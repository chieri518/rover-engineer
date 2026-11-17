// The REL launcher (original design): a two-stage rocket, 4.2 m across and about 64 m tall, white with a black
// interstage and an amber band, five sea-level engines on the first stage and one vacuum engine on the second.
// Surfaces are PBR with procedural maps baked on the GPU (panel seams, welds, intertank stringers, frost on the
// cryogenic tank, grime, regeneratively cooled tube walls and heat tint on the engine bells).
//
// Local frame: metres, y up, y = 0 at the first stage's heat shield (the engine bells hang below it).
import * as THREE from 'three';
import { bake, normalFromHeight } from './bake';

export const ROCKET = {
  radius: 2.1,
  height: 64.5,
  /** Engine bell exit plane (y) and radius. */
  bellExitY: -2.5,
  bellExitR: 0.66,
  bellThroatY: -0.45,
  /** First-stage engine positions (x, z) in the rocket frame. */
  engines: [
    [0, 0],
    [1.03, 1.03],
    [-1.03, 1.03],
    [-1.03, -1.03],
    [1.03, -1.03],
  ] as [number, number][],
  stage1Top: 41,
  interstageBottom: 36,
  /** Second stage engine: exit plane and radius. */
  mvacExitY: 37.2,
  mvacExitR: 1.0,
};

/** The side of the rocket the REL mark faces (radians around y, 0 = +x). */
export const LOGO_ANGLE = Math.PI * 0.5;

const H = ROCKET.height;

/** Radius of the outer mould line at height y (the fairing ogive included). */
function bodyRadius(y: number): number {
  const R = ROCKET.radius;
  if (y < 0.7) return R - 0.08 + 0.08 * (y / 0.7);
  if (y < 50.2) return R;
  if (y < 50.7) return R + 0.15 * ((y - 50.2) / 0.5);
  const Rf = R + 0.15;
  const noseStart = 57.0;
  if (y < noseStart) return Rf;
  // Tangent ogive from noseStart to the tip, blunted.
  const L = H - noseStart;
  const rho = (Rf * Rf + L * L) / (2 * Rf);
  const x = y - noseStart;
  const r = Math.sqrt(Math.max(0, rho * rho - x * x)) + Rf - rho;
  return Math.max(0.0, r);
}

/** A surface of revolution with uv.u = angle / 2π and uv.v = y / vScale, normals from the profile slope. */
function lathe(profile: (y: number) => number, y0: number, y1: number, rings: number, segments: number, vScale: number, radial?: (y: number) => number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const s = j / rings;
    const y = radial ? radial(s) : y0 + (y1 - y0) * s;
    const r = profile(y);
    const dy = 1e-3 * (y1 - y0 || 1);
    const dr = (profile(y + dy) - profile(y - dy)) / (2 * dy);
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const a = u * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      pos.push(r * c, y, -r * sn);
      const n = new THREE.Vector3(c, -dr, -sn).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(u, y / vScale);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i;
      const b = a + segments + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // Tangents for normal mapping (three derives them in the shader when there is no tangent attribute).
  return g;
}

/** The REL mark: a ring with an orbiting dot (amber) and the letters REL (charcoal). R = letters, G = mark. */
async function logoTexture(): Promise<THREE.CanvasTexture> {
  try {
    await import('@fontsource/chakra-petch/700.css');
    await document.fonts.load('700 200px "Chakra Petch"');
  } catch {
    /* fall back to the system font */
  }
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'lighter';
  // Mark: ring + dot, on the left.
  g.strokeStyle = '#00ff00';
  g.lineWidth = 26;
  g.beginPath();
  g.arc(210, 256, 150, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#00ff00';
  g.beginPath();
  g.ellipse(210, 256, 205, 62, -0.42, Math.PI * 1.08, Math.PI * 1.92);
  g.lineWidth = 16;
  g.stroke();
  g.beginPath();
  g.arc(210 + 150 * Math.cos(-0.7), 256 + 150 * Math.sin(-0.7), 30, 0, Math.PI * 2);
  g.fill();
  // Letters.
  g.fillStyle = '#ff0000';
  g.font = '700 300px "Chakra Petch", "Helvetica Neue", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('REL', 400, 270);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

const BODY_COMMON = /* glsl */ `
uniform sampler2D tLogo;
uniform float logoU;
const float H = ${H.toFixed(2)};
const float PI = 3.14159265;
float ringLine(float y, float period, float width) { float d = abs(fract(y / period + 0.5) - 0.5) * period; return 1.0 - smoothstep(0.0, width, d); }
float band(float y, float a, float b, float soft) { return smoothstep(a - soft, a + soft, y) * (1.0 - smoothstep(b - soft, b + soft, y)); }
// Everything about the body surface at (u, y): albedo, height (0..1), roughness, metalness.
void surface(vec2 uv, out vec3 albedo, out float height, out float rough, out float metal) {
  float y = uv.y * H;
  float u = uv.x;
  float x = u * 2.0 * PI * 2.1; // arc length, metres
  vec3 white = vec3(0.78, 0.78, 0.76);
  vec3 dark = vec3(0.028, 0.03, 0.033);
  vec3 grey = vec3(0.22, 0.225, 0.23);
  vec3 amber = vec3(0.86, 0.43, 0.05);
  // Large-scale paint variation and grime.
  float big = fbm3(vec3(x * 0.15, y * 0.08, 1.3));
  float fine = snoise(vec3(x * 6.0, y * 6.0, 4.0));
  float streak = fbm3(vec3(x * 2.5, y * 0.12, 7.7)); // vertical rain streaks
  albedo = white * (0.94 + 0.06 * big) * (1.0 - 0.1 * smoothstep(0.2, 0.7, streak));
  height = 0.5 + 0.01 * fine;
  rough = 0.38 + 0.08 * big + 0.05 * fine;
  metal = 0.0;

  // Panel welds: rings every 2.6 m on the tanks, two vertical seams.
  float weld = ringLine(y - 1.3, 2.6, 0.012) * band(y, 1.2, 50.0, 0.02);
  float vseam = (1.0 - smoothstep(0.0, 0.01, abs(fract(u * 4.0 + 0.125) - 0.5) * 2.0 * 2.0 * PI * 2.1 / 4.0 - 0.0)) * 0.0;
  float seamU = abs(fract(u * 4.0) - 0.5) * (2.0 * PI * 2.1 / 4.0);
  vseam = (1.0 - smoothstep(0.004, 0.012, abs(seamU - 1.65))) * band(y, 1.2, 36.0, 0.02);
  height += weld * 0.18 + vseam * 0.10;
  albedo *= 1.0 - 0.28 * weld - 0.15 * vseam;
  // Rivet rows either side of the welds.
  float rivY = abs(fract((y - 1.3) / 2.6 + 0.5) - 0.5) * 2.6;
  float rivets = (1.0 - smoothstep(0.004, 0.009, length(vec2(fract(x / 0.09) - 0.5, (rivY - 0.05) / 0.09) * 0.09))) * band(y, 1.2, 50.0, 0.02);
  height += rivets * 0.12;

  // Engine skirt (heat-shield quilting), black.
  float skirt = 1.0 - smoothstep(1.15, 1.25, y);
  vec2 q = vec2(x / 0.32, y / 0.32);
  vec2 qf = abs(fract(q) - 0.5);
  float quilt = smoothstep(0.5, 0.36, max(qf.x, qf.y));
  albedo = mix(albedo, dark * (0.8 + 0.4 * fine) + vec3(0.02, 0.012, 0.005) * big, skirt);
  height = mix(height, 0.35 + 0.3 * quilt, skirt);
  rough = mix(rough, 0.75, skirt);

  // Intertank: grey with stringers.
  float it = band(y, 16.6, 18.2, 0.01);
  float stringer = smoothstep(0.25, 0.0, abs(fract(x / 0.16) - 0.5));
  albedo = mix(albedo, grey * (0.9 + 0.2 * stringer), it);
  height = mix(height, 0.3 + 0.5 * stringer, it);
  rough = mix(rough, 0.5, it);
  metal = mix(metal, 0.3, it);

  // Interstage: black composite with a fine weave, and its lower edge.
  float is_ = band(y, 36.0, 41.0, 0.008);
  float weave = 0.5 + 0.5 * sin(x * 260.0) * sin(y * 260.0);
  albedo = mix(albedo, dark * (0.9 + 0.25 * weave) * (1.0 + 0.3 * big), is_);
  rough = mix(rough, 0.42 + 0.08 * weave, is_);
  height = mix(height, 0.5 + 0.02 * weave, is_);
  // Amber band under the interstage and a thin one on the second stage.
  float amb = band(y, 35.0, 35.75, 0.004) + band(y, 49.2, 49.45, 0.004);
  albedo = mix(albedo, amber, clamp(amb, 0.0, 1.0));

  // Fairing seams: the separation joint (vertical, two halves) and the base ring.
  float fair = smoothstep(50.6, 50.7, y);
  float fseam = (1.0 - smoothstep(0.004, 0.01, abs(fract(u * 2.0 + 0.25) - 0.5) * PI * 2.25)) * fair;
  float fring = ringLine(y - 50.75, 100.0, 0.015) + ringLine(y - 57.0, 100.0, 0.01);
  height += -fseam * 0.25 - fring * 0.15;
  albedo *= 1.0 - 0.25 * fseam - 0.15 * fring;
  // Nose tip: dark ablative cap.
  albedo = mix(albedo, dark * 1.5, smoothstep(64.0, 64.15, y));

  // Frost on the liquid-oxygen tank (18-35 m): patchy, bluish white, rough and bumpy, with melt streaks.
  float frostZone = band(y, 18.4, 34.6, 0.25);
  float fpatch = fbm5(vec3(x * 0.7, y * 0.35, 2.0)) * 0.9 + 0.35 - 0.25 * smoothstep(30.0, 34.6, y);
  float meltStreak = fbm3(vec3(x * 4.0, y * 0.25, 9.0));
  float frost = frostZone * smoothstep(-0.05, 0.25, fpatch - 0.25 * meltStreak);
  float crystals = fbm5(vec3(x * 28.0, y * 28.0, 3.0));
  albedo = mix(albedo, vec3(0.86, 0.9, 0.95) * (0.92 + 0.12 * crystals), frost);
  height = mix(height, 0.55 + 0.35 * crystals, frost);
  rough = mix(rough, 0.82 + 0.1 * crystals, frost);

  // Light soot on the lowest metres of the tank, streaking up.
  float soot = (1.0 - smoothstep(1.2, 3.5 + 1.5 * streak, y)) * (1.0 - skirt);
  albedo *= 1.0 - 0.45 * soot;

  // The REL mark, facing logoU, 26.5-30 m up.
  float du = fract(u - logoU + 0.5) - 0.5;
  vec2 luv = vec2(du * 2.0 * PI * 2.1 / 7.0 + 0.5, (y - 26.6) / 3.5);
  if (luv.x > 0.0 && luv.x < 1.0 && luv.y > 0.0 && luv.y < 1.0) {
    vec3 L = texture2D(tLogo, luv).rgb;
    albedo = mix(albedo, dark * 1.4, L.r * (1.0 - frost * 0.7));
    albedo = mix(albedo, amber, L.g * (1.0 - frost * 0.7));
    height += (L.r + L.g) * 0.02;
  }
}
`;

const BELL_COMMON = /* glsl */ `
// Bell outer wall: u around, v from the throat (0) to the exit (1). Height in .a of the data map.
void bell(vec2 uv, out vec3 albedo, out float height, out float rough, out float metal) {
  float u = uv.x, v = uv.y;
  float tubes = 0.5 + 0.5 * cos(u * 3.14159265 * 2.0 * 160.0);
  tubes = pow(tubes, 0.6);
  float hat = 0.0;
  for (int i = 0; i < 4; i++) {
    float vb = 0.22 + float(i) * 0.2;
    hat += 1.0 - smoothstep(0.004, 0.012, abs(v - vb));
  }
  float n = fbm3(vec3(u * 30.0, v * 6.0, 1.0));
  // Heat tint: straw and bronze near the throat, blue-violet mid, sooty dark at the exit.
  vec3 steel = vec3(0.42, 0.40, 0.38);
  vec3 straw = vec3(0.62, 0.45, 0.22);
  vec3 blue = vec3(0.16, 0.18, 0.34);
  vec3 c = mix(straw, steel, smoothstep(0.0, 0.25, v));
  c = mix(c, blue, smoothstep(0.25, 0.55, v + 0.08 * n) * 0.6);
  c = mix(c, vec3(0.08, 0.075, 0.07), smoothstep(0.65, 1.0, v + 0.1 * n));
  c *= 0.75 + 0.25 * tubes;
  albedo = c * (0.9 + 0.2 * n);
  height = 0.5 * tubes + 0.4 * hat;
  rough = 0.32 + 0.25 * smoothstep(0.5, 1.0, v) + 0.1 * n;
  metal = 0.85;
}
`;

export interface Rocket {
  group: THREE.Group;
  stage1: THREE.Group;
  stage2: THREE.Group;
  /** Per-engine glow of the nozzle interiors (0..1), and the igniter flash (0..1, green). */
  setEngines(glow: number[], igniter: number, time?: number): void;
  /** Upper stage engine glow (0..1) and the radiative nozzle extension's heat (0..1). */
  setMvac(glow: number, heat: number): void;
  /** Ascent soot on the first stage's lower body (0 on the pad, 1 in the orbit shot). */
  setSoot(k: number): void;
  dispose(): void;
}

export async function buildRocket(renderer: THREE.WebGLRenderer): Promise<Rocket> {
  const disposables: { dispose(): void }[] = [];
  const logo = await logoTexture();
  disposables.push(logo);

  // ------------------------------------------------------------------------------------------------ body maps
  const BW = 2048;
  const BH = 8192;
  const bodyUniforms = { tLogo: { value: logo }, logoU: { value: LOGO_ANGLE / (Math.PI * 2) } };
  const bodyAlbedo = bake(renderer, {
    width: BW,
    height: BH,
    type: THREE.HalfFloatType,
    uniforms: bodyUniforms,
    frag: `${BODY_COMMON}
      void main() { vec3 a; float h, r, m; surface(vUv, a, h, r, m); gl_FragColor = vec4(a, 1.0); }`,
  });
  const bodyData = bake(renderer, {
    width: BW,
    height: BH,
    uniforms: bodyUniforms,
    frag: `${BODY_COMMON}
      void main() { vec3 a; float h, r, m; surface(vUv, a, h, r, m); gl_FragColor = vec4(h, clamp(r, 0.0, 1.0), m, 1.0); }`,
  });
  const bodyNormal = normalFromHeight(renderer, bodyData.texture, BW, BH, 3.0, 'r');
  disposables.push(bodyAlbedo, bodyData, bodyNormal);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: bodyAlbedo.texture,
    roughnessMap: bodyData.texture,
    metalnessMap: bodyData.texture,
    normalMap: bodyNormal.texture,
    normalScale: new THREE.Vector2(1, 1),
    roughness: 1,
    metalness: 1,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });
  // Ascent soot (orbit shot only): the exhaust's backflow blackens the first stage's lower metres in streaks.
  const soot = { value: 0 };
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.soot = soot;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float soot;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float y = vMapUv.y * ${H.toFixed(2)};
          float a = vMapUv.x * 6.2831;
          float streaks = 0.5 + 0.5 * sin(a * 37.0 + sin(a * 5.0) * 3.0) * sin(a * 13.0 + 1.7);
          float reach = 3.0 + 9.0 * streaks;
          float k = soot * (1.0 - smoothstep(1.0, reach, y)) * step(y, 36.0);
          diffuseColor.rgb *= 1.0 - 0.75 * k;
        }`,
      );
  };
  bodyMat.customProgramCacheKey = () => 'rocket-body';
  disposables.push(bodyMat);

  // ------------------------------------------------------------------------------------------------ bell maps
  const bellAlbedo = bake(renderer, {
    width: 2048,
    height: 512,
    type: THREE.HalfFloatType,
    frag: `${BELL_COMMON} void main() { vec3 a; float h, r, m; bell(vUv, a, h, r, m); gl_FragColor = vec4(a, 1.0); }`,
  });
  const bellData = bake(renderer, {
    width: 2048,
    height: 512,
    frag: `${BELL_COMMON} void main() { vec3 a; float h, r, m; bell(vUv, a, h, r, m); gl_FragColor = vec4(h, clamp(r, 0.0, 1.0), m, 1.0); }`,
  });
  const bellNormal = normalFromHeight(renderer, bellData.texture, 2048, 512, 6.0, 'r');
  disposables.push(bellAlbedo, bellData, bellNormal);

  // Nozzle glow uniforms shared by the inner walls (one per engine).
  const engineGlow = ROCKET.engines.map(() => ({ value: 0 }));
  const igniter = { value: 0 };
  const tflow = { value: 0 };
  const makeBellMat = (glow: { value: number }, opts: { mvac?: boolean } = {}) => {
    const m = new THREE.MeshPhysicalMaterial({
      map: bellAlbedo.texture,
      roughnessMap: bellData.texture,
      metalnessMap: bellData.texture,
      normalMap: bellNormal.texture,
      roughness: 1,
      metalness: 1,
      side: THREE.DoubleSide,
      color: opts.mvac ? new THREE.Color(0.35, 0.33, 0.33) : new THREE.Color(0.75, 0.72, 0.7),
      envMapIntensity: 0.45,
    });
    const heat = { value: 0 };
    m.userData.heat = heat;
    m.onBeforeCompile = (s) => {
      s.uniforms.glow = glow;
      s.uniforms.igniter = igniter;
      s.uniforms.heat = heat;
      s.uniforms.tflow = tflow;
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float glow; uniform float igniter; uniform float heat; uniform float tflow;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            float v = vMapUv.y;
            if (!gl_FrontFacing) {
              // Inside the bell: white-hot at the throat, orange at the exit; the igniter flashes green first.
              float tubes = 0.75 + 0.25 * cos(vMapUv.x * 6.2831 * 160.0);
              // Hot gas streaming down the wall: bright streaks that flicker.
              float a = vMapUv.x * 6.2831;
              float flow = 0.55 + 0.45 * sin(a * 23.0 + sin(a * 7.0 + tflow * 3.0) * 2.0 + v * 4.0 - tflow * 9.0) * sin(a * 11.0 - tflow * 5.0 + v * 2.0);
              vec3 hot = mix(vec3(1.0, 0.95, 0.85) * 60.0, vec3(1.0, 0.55, 0.15) * 10.0, smoothstep(0.0, 0.4, v));
              hot = mix(hot, vec3(1.0, 0.3, 0.05) * 2.5, smoothstep(0.35, 1.0, v));
              hot *= mix(1.0, flow, smoothstep(0.1, 0.5, v));
              totalEmissiveRadiance += hot * tubes * glow + vec3(0.3, 1.0, 0.4) * 10.0 * igniter * (1.0 - v * 0.8) * max(0.0, 1.0 - glow * 1.5);
            }
            // The radiatively cooled extension glows dull red to orange when it is hot.
            totalEmissiveRadiance += mix(vec3(1.0, 0.35, 0.08), vec3(0.5, 0.06, 0.01), v) * 3.0 * heat * smoothstep(0.15, 0.35, v);
          }`,
        );
    };
    disposables.push(m);
    return m;
  };

  // ------------------------------------------------------------------------------------------------ geometry
  const group = new THREE.Group();
  const stage1 = new THREE.Group();
  const stage2 = new THREE.Group();
  group.add(stage1, stage2);

  const seg = 192;
  const s1Body = lathe(bodyRadius, 0, ROCKET.stage1Top, 240, seg, H);
  const s2Body = lathe(bodyRadius, ROCKET.stage1Top, H, 360, seg, H, (s) => {
    // Denser rings near the nose.
    const y0 = ROCKET.stage1Top;
    return y0 + (H - y0) * (1 - Math.pow(1 - s, 1.6));
  });
  disposables.push(s1Body, s2Body);
  const body1 = new THREE.Mesh(s1Body, bodyMat);
  const body2 = new THREE.Mesh(s2Body, bodyMat);
  body1.castShadow = body1.receiveShadow = true;
  body2.castShadow = body2.receiveShadow = true;
  stage1.add(body1);
  stage2.add(body2);
  // The interstage is open at the top: its inner wall (dark), seen after separation.
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6, side: THREE.BackSide });
  disposables.push(innerMat);
  const interInner = new THREE.Mesh(new THREE.CylinderGeometry(ROCKET.radius - 0.02, ROCKET.radius - 0.02, 5, 96, 1, true), innerMat);
  interInner.position.y = 38.5;
  stage1.add(interInner);
  disposables.push(interInner.geometry);
  // Stage 1 tank dome top (inside the interstage) and stage 2 base.
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3d, roughness: 0.5, metalness: 0.6 });
  disposables.push(domeMat);
  const dome1 = new THREE.Mesh(new THREE.SphereGeometry(ROCKET.radius - 0.05, 64, 16, 0, Math.PI * 2, 0, Math.PI * 0.32), domeMat);
  dome1.scale.y = 0.45;
  dome1.position.y = 36.0;
  stage1.add(dome1);
  const base2 = new THREE.Mesh(new THREE.SphereGeometry(ROCKET.radius - 0.05, 64, 16, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), domeMat);
  base2.scale.y = 0.45;
  base2.position.y = ROCKET.stage1Top + 0.05;
  stage2.add(base2);
  disposables.push(dome1.geometry, base2.geometry);

  // Heat shield underside (quilted black).
  const shieldMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.85 });
  disposables.push(shieldMat);
  const shield = new THREE.Mesh(new THREE.CircleGeometry(ROCKET.radius - 0.08, 96), shieldMat);
  shield.rotation.x = Math.PI / 2;
  shield.position.y = 0.002;
  stage1.add(shield);
  disposables.push(shield.geometry);

  // Raceway (a cable tunnel along the side) and small details.
  const detailMat = new THREE.MeshPhysicalMaterial({ color: 0xc9c9c6, roughness: 0.45, clearcoat: 0.2 });
  const darkDetail = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.55, metalness: 0.4 });
  disposables.push(detailMat, darkDetail);
  const raceAngle = LOGO_ANGLE + Math.PI * 0.62;
  const addOnBody = (parent: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, angle: number, y: number, out = 0) => {
    const m = new THREE.Mesh(geo, mat);
    const r = ROCKET.radius + out;
    m.position.set(Math.cos(angle) * r, y, -Math.sin(angle) * r);
    m.rotation.y = angle;
    m.castShadow = true;
    parent.add(m);
    disposables.push(geo);
    return m;
  };
  addOnBody(stage1, new THREE.BoxGeometry(0.2, 34.5, 0.34), detailMat, raceAngle, 1.3 + 34.5 / 2, 0.08);
  addOnBody(stage2, new THREE.BoxGeometry(0.16, 8.5, 0.26), detailMat, raceAngle, 41.4 + 4.25, 0.06);
  // Umbilical plates and vents.
  addOnBody(stage1, new THREE.BoxGeometry(0.06, 0.9, 0.7), darkDetail, LOGO_ANGLE + Math.PI, 33.2, 0.02);
  addOnBody(stage1, new THREE.BoxGeometry(0.06, 0.7, 0.55), darkDetail, LOGO_ANGLE + Math.PI, 2.2, 0.02);
  addOnBody(stage2, new THREE.BoxGeometry(0.06, 0.6, 0.5), darkDetail, LOGO_ANGLE + Math.PI, 47.5, 0.02);
  for (const a of [0.3, 1.9, 3.5, 5.0]) addOnBody(stage1, new THREE.CylinderGeometry(0.035, 0.035, 0.5, 12), darkDetail, a, 0.6, 0.02);

  // ------------------------------------------------------------------------------------------------ engines
  const { bellThroatY: yT, bellExitY: yE, bellExitR: rE } = ROCKET;
  const rT = 0.22;
  const bellProfile = (y: number) => {
    const s = THREE.MathUtils.clamp((yT - y) / (yT - yE), 0, 1);
    return rT + (rE - rT) * (1 - Math.pow(1 - s, 1.9));
  };
  const bellGeo = lathe(bellProfile, yT, yE, 64, 96, 1, undefined);
  // uv.v from throat (0) to exit (1).
  {
    const uvA = bellGeo.getAttribute('uv') as THREE.BufferAttribute;
    const posA = bellGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < uvA.count; i++) uvA.setY(i, (yT - posA.getY(i)) / (yT - yE));
  }
  // Normals on a lathe pointing outward; flip winding so front faces are outside.
  flipWinding(bellGeo);
  disposables.push(bellGeo);
  const lipGeo = new THREE.TorusGeometry(rE + 0.012, 0.025, 8, 96);
  lipGeo.rotateX(Math.PI / 2);
  disposables.push(lipGeo);
  const bootGeo = lathe((y) => 0.32 + (0.6 - 0.32) * ((y - yT) / -yT), yT, 0, 12, 64, 1);
  disposables.push(bootGeo);
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.95 });
  bootMat.onBeforeCompile = (s) => {
    // Fabric wrinkles: perturb the normal with a few ripples.
    s.fragmentShader = s.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       { float w = sin(vBootUv.y * 48.0 + sin(vBootUv.x * 37.0) * 2.0) * 0.5 + sin(vBootUv.x * 90.0 + vBootUv.y * 9.0) * 0.25;
         normal = normalize(normal + vec3(0.0, w * 0.35, 0.0)); }`,
    ).replace('#include <common>', '#include <common>\nvarying vec2 vBootUv;');
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBootUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBootUv = vec2(atan(position.z, position.x), position.y * 3.0);');
  };
  disposables.push(bootMat);
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.4, metalness: 0.9 });
  disposables.push(lipMat);

  const bellMats: THREE.MeshPhysicalMaterial[] = [];
  ROCKET.engines.forEach(([x, z], i) => {
    const e = new THREE.Group();
    e.position.set(x, 0, z);
    const mat = makeBellMat(engineGlow[i]!);
    bellMats.push(mat);
    const bell = new THREE.Mesh(bellGeo, mat);
    bell.castShadow = bell.receiveShadow = true;
    const lip = new THREE.Mesh(lipGeo, lipMat);
    lip.position.y = yE;
    const boot = new THREE.Mesh(bootGeo, bootMat);
    e.add(bell, lip, boot);
    // Slight random roll so the tube pattern differs per engine.
    e.rotation.y = i * 1.3;
    stage1.add(e);
  });

  // Second-stage vacuum engine: short regenerative bell + long radiative extension (dark, glows when hot).
  const mvacGlow = { value: 0 };
  const mvacMat = makeBellMat(mvacGlow, { mvac: true });
  const mvTop = ROCKET.stage1Top - 0.2;
  const mvExit = ROCKET.mvacExitY;
  const mvProfile = (y: number) => {
    const s = THREE.MathUtils.clamp((mvTop - y) / (mvTop - mvExit), 0, 1);
    return 0.2 + (ROCKET.mvacExitR - 0.2) * (1 - Math.pow(1 - s, 1.7));
  };
  const mvGeo = lathe(mvProfile, mvTop, mvExit, 64, 96, 1);
  {
    const uvA = mvGeo.getAttribute('uv') as THREE.BufferAttribute;
    const posA = mvGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < uvA.count; i++) uvA.setY(i, (mvTop - posA.getY(i)) / (mvTop - mvExit));
  }
  flipWinding(mvGeo);
  disposables.push(mvGeo);
  const mv = new THREE.Mesh(mvGeo, mvacMat);
  mv.castShadow = true;
  stage2.add(mv);

  return {
    group,
    stage1,
    stage2,
    setEngines(glow, ig, time = 0) {
      glow.forEach((g, i) => (engineGlow[i]!.value = g));
      igniter.value = ig;
      tflow.value = time;
    },
    setSoot(k) {
      soot.value = k;
    },
    setMvac(glow, heat) {
      mvacGlow.value = glow;
      (mvacMat.userData.heat as { value: number }).value = heat;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

function flipWinding(g: THREE.BufferGeometry) {
  const idx = g.getIndex()!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
}
