// The pre-dawn sky over the pad: an analytic twilight model (deep blue zenith, the sun's glow on the eastern
// horizon, the Earth's shadow and the pink Belt of Venus opposite), a few stars, and a high cirrus deck lit pink
// from below by the sun that is still under the horizon. Linear HDR.
import * as THREE from 'three';
import { NOISE } from './glsl';

export const SKY_GLSL = /* glsl */ `
uniform vec3 sunDir;
uniform float skyTime;
vec3 twilight(vec3 d) {
  float h = d.y;
  vec3 sH = normalize(vec3(sunDir.x, 0.0, sunDir.z));
  vec3 dH = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
  float c = dot(dH, sH);               // 1 toward the sun's azimuth, -1 away
  float toward = pow(max(c * 0.5 + 0.5, 0.0), 2.5);
  float tight = pow(max(c, 0.0), 10.0);
  float hp = max(h, 0.0);
  vec3 zenith = vec3(0.012, 0.026, 0.075);
  vec3 mid = vec3(0.035, 0.06, 0.13);
  vec3 col = mix(mid, zenith, smoothstep(0.0, 0.75, hp));
  // Glow on the sun side: red-orange at the horizon, gold, then a pale green-cyan band above.
  vec3 glowLow = vec3(1.05, 0.30, 0.07);
  vec3 glowMid = vec3(0.85, 0.48, 0.18);
  vec3 glowHigh = vec3(0.18, 0.24, 0.26);
  float gl = exp(-hp / 0.035);
  float gm = exp(-hp / 0.11);
  float gh = exp(-hp / 0.3);
  col += toward * (glowLow * gl * 0.9 + glowMid * gm * 0.35 + glowHigh * gh * 0.25);
  col += tight * (vec3(1.2, 0.55, 0.18) * exp(-hp / 0.06) * 1.2 + vec3(0.6, 0.4, 0.2) * exp(-hp / 0.2) * 0.3);
  // Opposite the sun: the Earth's shadow (blue-grey) under the Belt of Venus (pink).
  float away = pow(max(-c * 0.5 + 0.5, 0.0), 1.5);
  col = mix(col, vec3(0.03, 0.04, 0.085), away * exp(-hp / 0.05) * 0.8);
  col += away * vec3(0.16, 0.07, 0.10) * exp(-pow((hp - 0.12) / 0.07, 2.0)) * 0.55;
  // Horizon haze everywhere.
  col += vec3(0.05, 0.05, 0.09) * exp(-hp / 0.03) * (1.0 - toward * 0.5);
  if (h < 0.0) col = mix(col, vec3(0.02, 0.025, 0.045), smoothstep(0.0, -0.05, h));
  return col;
}
`;

const SKY_FRAG = /* glsl */ `
${NOISE}
${SKY_GLSL}
uniform float starAmount;
uniform float cirrusAmount;
varying vec3 vDir;
vec3 stars(vec3 d) {
  vec3 p = d * 420.0;
  vec3 i = floor(p);
  vec3 f = fract(p) - 0.5;
  vec3 r = hash33(i);
  float on = step(0.985, r.x);
  vec3 o = (r - 0.5) * 0.7;
  float dd = length(f - o);
  float b = on * exp(-dd * dd * 60.0) * (0.3 + 3.0 * pow(r.y, 6.0));
  vec3 tint = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), r.z);
  return tint * b;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = twilight(d);
  float h = d.y;
  // Stars, fading toward the dawn and the horizon.
  vec3 sH = normalize(vec3(sunDir.x, 0.0, sunDir.z));
  float c = dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), sH);
  col += stars(d) * starAmount * smoothstep(0.08, 0.5, h) * (1.0 - 0.85 * pow(max(c * 0.5 + 0.5, 0.0), 2.0)) * 0.12;
  // Cirrus deck at 9 km, lit from below by the sun (pink and gold on the sun side, mauve away from it).
  if (h > 0.0) {
    vec2 p = d.xz / max(h, 0.02) * 9.0 + vec2(skyTime * 0.004, 0.0);
    vec2 q = vec2(p.x * 0.18 + p.y * 0.05, p.y * 0.55);
    float n = fbm5(vec3(q * 0.35, 2.0)) + 0.5 * fbm3(vec3(q * 1.6 + 3.0, 5.0));
    float streaks = fbm3(vec3(p.x * 0.05, p.y * 1.4, 9.0));
    float a = smoothstep(0.05, 0.75, n + 0.35 * streaks) * cirrusAmount;
    a *= smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.55, 0.95, h));
    float toward = pow(max(c * 0.5 + 0.5, 0.0), 3.0);
    vec3 lit = mix(vec3(0.22, 0.10, 0.16), vec3(1.25, 0.48, 0.25), toward);
    lit += vec3(1.4, 0.8, 0.4) * pow(max(c, 0.0), 8.0) * exp(-h / 0.12);
    col = mix(col, lit * (0.6 + 0.4 * n), a * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeSkyDome(sunDir: THREE.Vector3): { mesh: THREE.Mesh; uniforms: { sunDir: { value: THREE.Vector3 }; skyTime: { value: number }; starAmount: { value: number }; cirrusAmount: { value: number } } } {
  const uniforms = { sunDir: { value: sunDir.clone() }, skyTime: { value: 0 }, starAmount: { value: 1 }, cirrusAmount: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>\n${SKY_FRAG.replace('void main() {', 'void main() {\n#include <logdepthbuf_fragment>\n')}`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(30000, 64, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}
