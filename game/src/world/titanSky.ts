// The Titan sky: a hazy dome (orange-brown by day, a warm smear around a low Sun, near black at night),
// a faint, blurred Sun disc behind the haze, no stars, no Earth, no Saturn (all hidden by the haze).
// Like the Mars sky it is drawn first, from a camera at the origin that copies the view's rotation, and
// terrain drawn afterwards hides whatever is below the horizon. Colors come from titanLook.ts; the dome
// is not tone-mapped so its horizon matches the scene fog.
//
// TitanRain: optional methane rain streaks in the main scene, in a box that follows the camera.
import * as THREE from 'three';
import type { SkyDirection } from '../rules/sun';
import type { TitanLook } from './titanLook';
import { glowTexture, SKY_RADIUS } from './sky';
import { TITAN_CLOUD_PARS, TITAN_CLOUD_SKY, titanCloudUniforms } from './titanClouds';

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 sunDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 glow;
uniform float glowWidth; // radians
varying vec3 vDir;
${TITAN_CLOUD_PARS}
void main() {
  vec3 d = normalize( vDir );
  // Thick haze: the sky stays near the horizon color most of the way up.
  vec3 c = mix( horizon, zenith, pow( max( d.y, 0.0 ), 0.6 ) );
  float a = acos( clamp( dot( d, sunDir ), -1.0, 1.0 ) );
  // A broad, soft brightening around the Sun, spread along the horizon when the Sun is low.
  float spread = 1.0 + 1.2 * ( 1.0 - smoothstep( 0.0, 0.4, abs( d.y - sunDir.y ) ) );
  c += glow * ( exp( -a / ( glowWidth * spread ) ) + 0.25 * exp( -a / ( glowWidth * 3.0 ) ) );
  // Methane clouds (titanClouds.ts): a faint streaky layer, drawn over the haze and the Sun's glow.
  ${TITAN_CLOUD_SKY}
  gl_FragColor = vec4( max( c, 0.0 ), 1.0 );
  #include <colorspace_fragment>
  // Dither after the sRGB encode, so the near-black night sky does not turn to grain.
  gl_FragColor.rgb += ( fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5 ) / 255.0;
}
`;

export class TitanSky {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly sunSprite: THREE.Sprite;

  /** sunRadiusDeg: apparent radius of the blurred Sun disc (the real Sun is about 0.03°; the haze spreads it). */
  constructor(sunRadiusDeg: number) {
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(60, 1, 1, SKY_RADIUS * 2);

    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_RADIUS * 0.95, 64, 32),
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          sunDir: { value: new THREE.Vector3(0, 1, 0) },
          zenith: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          glow: { value: new THREE.Color() },
          glowWidth: { value: 0.3 },
          ...titanCloudUniforms, // shared objects: updateTitanClouds sets them
        },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    this.dome.renderOrder = -2;
    this.scene.add(this.dome);

    const glare = (sunRadiusDeg * Math.PI) / 180 / 0.08; // disc fills 8% of the sprite radius
    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }),
    );
    const size = 2 * SKY_RADIUS * 0.9 * Math.tan(glare);
    this.sunSprite.scale.set(size, size, 1);
    this.scene.add(this.sunSprite);
  }

  /** Apply the colors for the current Sun height and rain (call before update each frame). */
  setLook(look: TitanLook): void {
    const u = this.dome.material.uniforms;
    (u.zenith!.value as THREE.Color).setRGB(...look.zenith);
    (u.horizon!.value as THREE.Color).setRGB(...look.horizon);
    (u.glow!.value as THREE.Color).setRGB(...look.glow);
    u.glowWidth!.value = (look.glowWidthDeg * Math.PI) / 180;
    const sm = this.sunSprite.material as THREE.SpriteMaterial;
    sm.opacity = look.sunDisc;
    sm.color.setRGB(...look.sunDiscColor);
    this.sunSprite.visible = look.sunDisc > 0.002;
  }

  update(view: THREE.PerspectiveCamera, sun: SkyDirection): void {
    this.camera.quaternion.copy(view.quaternion);
    if (this.camera.fov !== view.fov || this.camera.aspect !== view.aspect) {
      this.camera.fov = view.fov;
      this.camera.aspect = view.aspect;
      this.camera.updateProjectionMatrix();
    }
    (this.dome.material.uniforms.sunDir!.value as THREE.Vector3).set(sun.x, sun.y, sun.z);
    this.sunSprite.position.set(sun.x, sun.y, sun.z).multiplyScalar(SKY_RADIUS * 0.9);
  }

  dispose(): void {
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material & { map?: THREE.Texture | null };
        mat.map?.dispose();
        mat.dispose();
      }
    });
  }
}

const RAIN_VERTEX = /* glsl */ `
attribute float tip; // 0 at the bottom of a streak, 1 at its top
uniform vec3 camPos;
uniform float fallM; // meters fallen so far (time × fall speed)
uniform float box;
uniform float lengthM;
void main() {
  // Each drop falls and wraps inside a box centered on the camera, so the rain stays fixed in the world.
  vec3 p = position - vec3( 0.0, fallM, 0.0 );
  p = mod( p - camPos, box ) - 0.5 * box + camPos;
  p.y += tip * lengthM;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}
`;

const RAIN_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float opacity;
void main() {
  gl_FragColor = vec4( color, opacity );
  #include <colorspace_fragment>
}
`;

export interface TitanRainOptions {
  count: number;
  boxM: number;
  fallMps: number;
  lengthM: number;
}

/** Methane rain streaks around the camera; invisible (and skipped) while opacity is 0. */
export class TitanRain {
  readonly object: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private fallen = 0;

  constructor(private readonly opts: TitanRainOptions) {
    const n = Math.max(0, Math.floor(opts.count));
    const pos = new Float32Array(n * 6);
    const tip = new Float32Array(n * 2);
    // A fixed pseudo-random layout (no Math.random), so the rain looks the same every run.
    let s = 12345;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * opts.boxM;
    for (let i = 0; i < n; i++) {
      const x = rnd();
      const y = rnd();
      const z = rnd();
      pos.set([x, y, z, x, y, z], i * 6);
      tip[i * 2 + 1] = 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      uniforms: {
        camPos: { value: new THREE.Vector3() },
        fallM: { value: 0 },
        box: { value: opts.boxM },
        lengthM: { value: opts.lengthM },
        color: { value: new THREE.Color() },
        opacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.object = new THREE.LineSegments(geometry, material);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  /** Advance the drops and follow the camera; opacity 0..1 and linear color from the look. */
  update(dt: number, camera: THREE.Camera, opacity: number, color: readonly [number, number, number]): void {
    const u = this.object.material.uniforms;
    this.object.visible = opacity > 0.01;
    if (!this.object.visible) return;
    this.fallen = (this.fallen + dt * this.opts.fallMps) % (this.opts.boxM * 1000);
    u.fallM!.value = this.fallen;
    (u.camPos!.value as THREE.Vector3).copy(camera.position);
    (u.color!.value as THREE.Color).setRGB(color[0], color[1], color[2]);
    u.opacity!.value = opacity;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
