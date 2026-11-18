// Earth as a close-up globe for the title cover: NASA Blue Marble imagery with its clouds
// (public/earth/earth-day.jpg, made by scripts/make-earth-texture.py; credits on the credits screen), lit by
// the scene's Sun so its phase is real geometry, with a soft terminator warmed by the atmosphere, a sun glint
// on the oceans, and a thin blue atmosphere on the disc and as a halo around the sunlit limb. Until the image
// loads (or if it fails) the globe shows the procedural texture the mission sky uses. Presentation only.
import * as THREE from 'three';
import { earthTexture } from './sky';

const EARTH_IMAGE = `${import.meta.env.BASE_URL}earth/earth-day.jpg`;
const HALO_SCALE = 1.04; // the atmosphere halo's radius over Earth's (drawn thicker than the real ~1.6%, to read at cover size)

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 p = modelMatrix * vec4(position, 1.0);
  vPosW = p.xyz;
  gl_Position = projectionMatrix * viewMatrix * p;
}
`;

const SURFACE_FRAGMENT = /* glsl */ `
uniform sampler2D dayMap;
uniform vec3 sunDir;
uniform float brightness;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 L = normalize(sunDir);
  float mu = dot(N, L);
  vec3 day = texture2D(dayMap, vUv).rgb;

  // Soft terminator (the atmosphere bends light a little past it), reddened where the light grazes.
  float lit = smoothstep(-0.05, 0.18, mu) * (0.25 + 0.75 * clamp(mu + 0.1, 0.0, 1.0));
  vec3 tint = mix(vec3(1.0, 0.5, 0.28), vec3(1.0), smoothstep(0.0, 0.3, mu));
  vec3 col = day * lit * tint * brightness;

  // Sun glint on open water: blue, dark pixels (clouds and land are excluded by their colour).
  float lum = dot(day, vec3(0.2126, 0.7152, 0.0722));
  float ocean = smoothstep(0.02, 0.08, day.b - max(day.r, day.g)) * (1.0 - smoothstep(0.08, 0.2, lum));
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 70.0) * 0.9 * ocean * smoothstep(0.0, 0.2, mu);

  // Atmosphere seen through the disc: blue haze that thickens toward the limb, on the sunlit side.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  vec3 sky = vec3(0.32, 0.56, 1.0);
  col = mix(col, sky * lit * brightness, 0.45 * fres);
  col += sky * fres * 0.35 * smoothstep(-0.15, 0.35, mu) * brightness;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const HALO_FRAGMENT = /* glsl */ `
uniform vec3 sunDir;
uniform float brightness;
uniform float innerZ;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  // Back faces of a slightly larger shell: brightest at Earth's limb, fading to nothing at the shell's edge.
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  float edge = clamp(-dot(N, V) / innerZ, 0.0, 1.0);
  float a = pow(edge, 2.2) * smoothstep(-0.2, 0.4, dot(N, normalize(sunDir)));
  gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * a * 0.9 * brightness, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface EarthGlobeOptions {
  radius: number;
  /** Unit vector toward the Sun, in world space. */
  sunDir: THREE.Vector3;
  /** Earth's position as seen from the camera, as a unit vector (sets which side faces the viewer). */
  viewDir: THREE.Vector3;
  /** Longitude (degrees east) at the centre of the face turned toward the viewer. */
  facingLongitudeDeg: number;
  /** Turn about the line of sight (degrees, clockwise as seen): 0 shows north up. */
  rollDeg: number;
  brightness?: number;
  /** Called once the NASA image has replaced the placeholder (to redraw a still frame). */
  onLoad?: () => void;
}

export interface EarthGlobe {
  object: THREE.Group;
  dispose(): void;
}

export function earthGlobe(o: EarthGlobeOptions): EarthGlobe {
  const placeholder = earthTexture();
  const uniforms = {
    dayMap: { value: placeholder as THREE.Texture },
    sunDir: { value: o.sunDir.clone().normalize() },
    brightness: { value: o.brightness ?? 1.25 },
  };
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(o.radius, 96, 64),
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: SURFACE_FRAGMENT }),
  );

  // On the halo's back faces at Earth's limb, -dot(N, V) is sqrt(1 - 1/scale²).
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(o.radius * HALO_SCALE, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        sunDir: uniforms.sunDir,
        brightness: uniforms.brightness,
        innerZ: { value: Math.sqrt(1 - 1 / (HALO_SCALE * HALO_SCALE)) },
      },
      vertexShader: VERTEX,
      fragmentShader: HALO_FRAGMENT,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  // Orientation: spin about Earth's axis so the chosen longitude faces the viewer, then roll about the line
  // of sight. SphereGeometry puts texture u = 0 (longitude −180°) on −x and u = 0.25 on +z.
  const u = (o.facingLongitudeDeg + 180) / 360;
  const lonAz = Math.atan2(-Math.cos(2 * Math.PI * u), Math.sin(2 * Math.PI * u));
  const toViewer = o.viewDir.clone().negate();
  const viewerAz = Math.atan2(toViewer.x, toViewer.z);
  const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), viewerAz - lonAz);
  const roll = new THREE.Quaternion().setFromAxisAngle(o.viewDir.clone().normalize(), THREE.MathUtils.degToRad(o.rollDeg));
  const object = new THREE.Group();
  object.add(surface, halo);
  surface.quaternion.copy(roll.multiply(spin));

  let disposed = false;
  let image: THREE.Texture | null = null;
  new THREE.TextureLoader().load(
    EARTH_IMAGE,
    (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      image = tex;
      uniforms.dayMap.value = tex;
      o.onLoad?.();
    },
    undefined,
    () => console.warn('Earth image unavailable; the cover keeps the drawn Earth.'),
  );

  return {
    object,
    dispose() {
      disposed = true;
      placeholder.dispose();
      image?.dispose();
      for (const m of [surface, halo]) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    },
  };
}
