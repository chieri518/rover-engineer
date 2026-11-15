// The Mars sky: a dust-lit dome (butterscotch by day, a blue glow around a low Sun, dark at night),
// stars that fade in after dusk, and a small Sun disc. No Earth. Like the lunar Sky it is drawn first,
// from a camera at the origin that copies the view's rotation, and terrain drawn afterwards hides
// whatever is below the horizon. Colors come from marsLook.ts; the dome is not tone-mapped so its
// horizon matches the scene fog (which three mixes in after tone mapping).
import * as THREE from 'three';
import type { SkyDirection } from '../rules/sun';
import type { MarsLook } from './marsLook';
import { glowTexture, makeStars, SKY_RADIUS } from './sky';

const SUN_RADIUS_DEG = 0.18; // the Sun from Mars: about 0.35° across

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
void main() {
  vec3 d = normalize( vDir );
  vec3 c = mix( horizon, zenith, pow( max( d.y, 0.0 ), 0.45 ) );
  float a = acos( clamp( dot( d, sunDir ), -1.0, 1.0 ) );
  // A tight aureole plus a wide, faint skirt; flattened toward the horizon at sunset.
  float spread = 1.0 + 1.5 * ( 1.0 - smoothstep( 0.0, 0.35, abs( d.y - sunDir.y ) ) );
  c += glow * ( exp( -a / ( glowWidth * spread ) ) + 0.12 * exp( -a / ( glowWidth * 4.0 ) ) );
  // Dither so the dark gradients do not band.
  c += ( fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5 ) / 255.0;
  gl_FragColor = vec4( max( c, 0.0 ), 1.0 );
  #include <colorspace_fragment>
}
`;

export class MarsSky {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly stars: THREE.Points;
  private readonly sunSprite: THREE.Sprite;

  constructor() {
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
          glowWidth: { value: 0.15 },
        },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    this.dome.renderOrder = -2;
    this.scene.add(this.dome);

    this.stars = makeStars();
    const starMaterial = this.stars.material as THREE.PointsMaterial;
    starMaterial.transparent = true;
    starMaterial.blending = THREE.AdditiveBlending;
    starMaterial.opacity = 0;
    this.stars.renderOrder = -1;
    this.scene.add(this.stars);

    const glare = (SUN_RADIUS_DEG * Math.PI) / 180 / 0.08; // disc fills 8% of the sprite radius
    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }),
    );
    const size = 2 * SKY_RADIUS * 0.9 * Math.tan(glare);
    this.sunSprite.scale.set(size, size, 1);
    this.scene.add(this.sunSprite);
  }

  /** Apply the colors for the current Sun height and storm (call before update each frame). */
  setLook(look: MarsLook): void {
    const u = this.dome.material.uniforms;
    (u.zenith!.value as THREE.Color).setRGB(...look.zenith);
    (u.horizon!.value as THREE.Color).setRGB(...look.horizon);
    (u.glow!.value as THREE.Color).setRGB(...look.glow);
    u.glowWidth!.value = (look.glowWidthDeg * Math.PI) / 180;
    (this.stars.material as THREE.PointsMaterial).opacity = look.stars;
    this.stars.visible = look.stars > 0.002;
    (this.sunSprite.material as THREE.SpriteMaterial).opacity = look.sunDisc;
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
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material & { map?: THREE.Texture | null };
        mat.map?.dispose();
        mat.dispose();
      }
    });
  }
}
