// titan-fx: rain. Methane raindrops on Titan (presentation only): large, slow drops drifting in the wind.
// Lorenz (1993, Planet. Space Sci. 41:647): in Titan's thick air and low gravity, drops grow to about 9.5 mm and
// fall at about 1.6 m/s, roughly 6x slower than Earth's largest. One instanced draw: each drop is a camera-facing
// quad that falls and wraps in a box around the camera, so the rain stays fixed in the world. Perspective gives
// the depth (near drops big, far drops fine); drops smaller than minPx are drawn fainter instead of smaller, so
// distant rain does not shimmer. The number drawn follows the rain intensity. Numbers: tuning.look.rainDrops.
import * as THREE from 'three';
import type { TitanRainDropsTuning } from '../rules/titanTypes';
import { titanWetUniforms } from './titanWet';

// The renderer uses a logarithmic depth buffer: without its chunks the drops would fail the depth test against the ground.
const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec2 corner;      // quad corner, -1..1
attribute vec3 offset;      // drop position in the box (m)
attribute vec4 drop;        // radius (m), fall speed (m/s), sway phase, random 0..1
uniform vec3 boxCenter;     // the camera, pushed ahead along its view so most drops are in sight
uniform float time;
uniform float box;
uniform vec2 wind;
uniform vec2 sway;          // amplitude (m), angular frequency (rad/s)
uniform float stretch;
uniform float pxPerM;       // pixels per meter at 1 m depth
uniform vec3 fade;          // minPx, fadeNearM, fadeFarM
uniform vec3 lampPos;       // floodlight (world), its beam direction, color x intensity (0 when off)
uniform vec3 lampDir;
uniform vec3 lampColor;
uniform vec4 lampCone;      // cos outer, cos inner, range (m), decay
uniform float lampGain;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vLamp;
void main() {
  vec3 p = offset + vec3( wind.x * time, - drop.y * time, wind.y * time );
  p.xz += sway.x * vec2( sin( sway.y * time + drop.z ), cos( sway.y * 0.83 * time + drop.z * 1.7 ) );
  p = mod( p - boxCenter, box ) - 0.5 * box + boxCenter;
  // Drops in the floodlight beam catch its light (cone, decay and range as three.js lights the scene's spotlight).
  vec3 toLamp = lampPos - p;
  float ld = max( length( toLamp ), 0.3 );
  float cone = smoothstep( lampCone.x, lampCone.y, dot( - toLamp / ld, lampDir ) );
  float q = saturate( 1.0 - pow( ld / lampCone.z, 4.0 ) );
  vLamp = lampGain * lampColor * cone * q * q / max( pow( ld, lampCone.w ), 0.01 );
  vec4 view = viewMatrix * vec4( p, 1.0 );
  float depth = max( -view.z, 1e-3 );
  // Never smaller than minPx: below that, fainter (keeping the drop's light), so the far rain is a fine haze of dots.
  float r = drop.x;
  float rMin = fade.x / ( pxPerM / depth );
  float faint = 1.0;
  if ( r < rMin ) { faint = ( r / rMin ) * ( r / rMin ); r = rMin; }
  // Long axis along the fall direction on screen (world up seen from the camera), with motion blur.
  vec2 up = ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xy;
  up = length( up ) > 1e-3 ? normalize( up ) : vec2( 0.0, 1.0 );
  vec2 side = vec2( up.y, -up.x );
  view.xy += side * corner.x * r + up * corner.y * r * stretch;
  gl_Position = projectionMatrix * view;
  #include <logdepthbuf_vertex>
  vUv = corner;
  float near = smoothstep( fade.y * 0.5, fade.y, depth );
  float far = 1.0 - smoothstep( fade.z * 0.6, fade.z, depth );
  vAlpha = faint * near * far;
}
`;

const FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 color;
uniform float opacity;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vLamp;
void main() {
  #include <logdepthbuf_fragment>
  // A bead: round at the leading (lower) end, a short blurred trail above, a bright rim and a highlight.
  vec2 q = vec2( vUv.x, vUv.y < 0.0 ? vUv.y : vUv.y * 0.55 );
  float d = length( q );
  if ( d > 1.0 ) discard;
  float body = 1.0 - smoothstep( 0.55, 1.0, d );
  float rim = smoothstep( 0.35, 0.8, d ) * ( 1.0 - smoothstep( 0.8, 1.0, d ) );
  float spot = 1.0 - smoothstep( 0.0, 0.3, length( vUv - vec2( -0.3, -0.35 ) ) );
  float trail = vUv.y > 0.0 ? 1.0 - 0.6 * vUv.y : 1.0;
  float a = ( 0.35 * body + 0.6 * rim + 0.7 * spot ) * trail;
  vec3 lit = color + vLamp;
  float glow = min( 1.0, dot( vLamp, vec3( 0.33 ) ) );
  gl_FragColor = vec4( lit * ( 0.8 + 0.8 * spot ), min( 1.0, a * opacity * ( 1.0 + glow ) ) * vAlpha );
  #include <colorspace_fragment>
}
`;

const ahead = new THREE.Vector3();
/** Share of the box ahead of the camera: drops behind it are never seen. */
const BOX_AHEAD = 0.35;

export class TitanRaindrops {
  readonly object: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private time = 0;
  private readonly count: number;
  private readonly size = new THREE.Vector2();

  constructor(private readonly t: TitanRainDropsTuning) {
    const n = (this.count = Math.max(0, Math.floor(t.count)));
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); // unused, for three's bookkeeping
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const offset = new Float32Array(n * 3);
    const drop = new Float32Array(n * 4);
    // A fixed pseudo-random layout (no Math.random), so the rain looks the same every run.
    let s = 24680;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < n; i++) {
      offset.set([rnd() * t.boxM, rnd() * t.boxM, rnd() * t.boxM], i * 3);
      // Many small drops, few large ones.
      const k = Math.pow(rnd(), 1.6);
      const diameterMm = t.sizeMinMm + (t.sizeMaxMm - t.sizeMinMm) * k;
      const radiusM = (diameterMm / 2000) * t.drawScale;
      const speed = t.fallMps * (1 - t.fallSpread * (1 - k));
      drop.set([radiusM, speed, rnd() * Math.PI * 2, rnd()], i * 4);
    }
    geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offset, 3));
    geometry.setAttribute('drop', new THREE.InstancedBufferAttribute(drop, 4));
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        boxCenter: { value: new THREE.Vector3() },
        time: { value: 0 },
        box: { value: t.boxM },
        wind: { value: new THREE.Vector2(t.windMps[0], t.windMps[1]) },
        sway: { value: new THREE.Vector2(t.swayM, t.swayHz * Math.PI * 2) },
        stretch: { value: t.stretch },
        pxPerM: { value: 600 },
        fade: { value: new THREE.Vector3(t.minPx, t.fadeNearM, t.fadeFarM) },
        color: { value: new THREE.Color() },
        opacity: { value: t.opacity },
        // Shared with the wet ground: TitanWet keeps the floodlight uniforms current.
        lampPos: titanWetUniforms.titanWetLampPos,
        lampDir: titanWetUniforms.titanWetLampDir,
        lampColor: titanWetUniforms.titanWetLamp,
        lampCone: titanWetUniforms.titanWetLampCone,
        lampGain: { value: t.lampGain },
      },
      transparent: true,
      depthWrite: false,
    });
    this.object = new THREE.Mesh(geometry, material);
    this.object.frustumCulled = false;
    this.object.visible = false;
    this.object.renderOrder = 1;
    this.object.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(this.size);
      const proj = (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] ?? 1;
      material.uniforms.pxPerM!.value = proj * this.size.y * 0.5;
    };
  }

  /** Advance the drops and follow the camera; rain intensity 0..1 sets how many fall, color (linear) from the look. */
  update(dt: number, camera: THREE.Camera, intensity: number, color: readonly [number, number, number]): void {
    const k = Math.min(1, Math.max(0, intensity));
    const drawn = Math.floor(this.count * k);
    this.object.visible = drawn > 0;
    this.object.geometry.instanceCount = drawn;
    if (!this.object.visible) return;
    // Wrap the clock well before float precision suffers; the box pattern repeats on its own anyway.
    this.time = (this.time + dt) % 3600;
    const u = this.object.material.uniforms;
    u.time!.value = this.time;
    camera.getWorldDirection(ahead);
    (u.boxCenter!.value as THREE.Vector3).copy(camera.position).addScaledVector(ahead, this.t.boxM * BOX_AHEAD);
    // In the dark (night, the look's rain color at its floor) unlit drops fade to darkShare: the floodlight shows them.
    const lum = 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
    const lit = Math.min(1, Math.max(0, (lum - 0.03) / 0.09));
    const dark = this.t.darkShare + (1 - this.t.darkShare) * lit * lit * (3 - 2 * lit);
    (u.color!.value as THREE.Color).setRGB(color[0], color[1], color[2]).multiplyScalar(this.t.brightness * dark);
    u.opacity!.value = this.t.opacity * Math.min(1, 0.4 + k);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
