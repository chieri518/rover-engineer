// Dust in vacuum: every grain flies on its own clean ballistic arc and drops (no air: no billowing, no
// drifting cloud). Positions are closed-form functions of time (p0 + v·t − ½·g·t²), so any sub-frame
// can be drawn directly. Grains shine in the low Sun (forward-scattering when the camera looks toward it),
// go dark in the lander's shadow, and in the bay only catch the light inside the door's sunbeam.
import * as THREE from 'three';

export interface Grain {
  p: THREE.Vector3;
  v: THREE.Vector3;
  /** Launch time (sequence seconds). */
  t0: number;
  /** Ground height under the landing point (world y), or -Infinity to never land. */
  groundY: number;
  /** Size in metres (drawn at least ~1 px). */
  size: number;
  /** Brightness multiplier. */
  bright: number;
}

export interface DustOptions {
  /** Gravity (m/s²) for this emitter (1.62 on the Moon; less for electrostatically lofted motes). */
  g: number;
  /** Unit vector to the Sun (world). */
  sun: THREE.Vector3;
  color: THREE.Color;
  /** Linear HDR brightness of a fully lit grain. */
  intensity: number;
  /** Shadow caster: the lander's body as a vertical cylinder (world centre xz, radius, y range). */
  shadow?: { center: THREE.Vector2; radius: number; y0: number; y1: number };
  /** Visible only inside the bay's sunbeam: the door rectangle (world centre, half extents along its axes). */
  beam?: { center: THREE.Vector3; axisU: THREE.Vector3; axisV: THREE.Vector3; halfU: number; halfV: number; normal: THREE.Vector3 };
  /** Internal render height in pixels (point sizes are in pixels). */
  viewportHeight: number;
}

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aV;
attribute vec4 aT; // x: t0, y: landing time, z: size (m), w: brightness
uniform float uTime, uG, uPxPerUnit;
uniform vec3 uSun;
uniform vec4 uShadow; // centre x, z, radius, enabled
uniform vec2 uShadowY;
uniform vec4 uBeamC; // door centre, w: enabled
uniform vec3 uBeamU, uBeamV, uBeamN;
uniform vec2 uBeamHalf;
varying float vLight;
varying float vSize;
void main() {
  float dt = uTime - aT.x;
  if ( dt < 0.0 || uTime > aT.y ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); gl_PointSize = 0.0; vLight = 0.0; return; }
  vec3 p = position + aV * dt - vec3( 0.0, 0.5 * uG * dt * dt, 0.0 );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
  float lit = 1.0;
  if ( uShadow.w > 0.5 ) {
    // Ray toward the Sun against the lander's body cylinder.
    vec2 o = p.xz - uShadow.xy;
    vec2 d = normalize( uSun.xz );
    float b = dot( o, d );
    float c = dot( o, o ) - uShadow.z * uShadow.z;
    float disc = b * b - c;
    if ( disc > 0.0 ) {
      float t = -b - sqrt( disc );
      float t2 = -b + sqrt( disc );
      if ( t2 > 0.0 ) {
        float tt = max( t, 0.0 ) / length( uSun.xz );
        float y = p.y + uSun.y * tt;
        if ( y > uShadowY.x && y < uShadowY.y ) lit = 0.0;
      }
    }
  }
  if ( uBeamC.w > 0.5 ) {
    // Inside the bay: lit only if the ray toward the Sun leaves through the door opening.
    float den = dot( uSun, uBeamN );
    lit = 0.0;
    if ( den > 1e-4 ) {
      float t = dot( uBeamC.xyz - p, uBeamN ) / den;
      if ( t >= 0.0 ) {
        vec3 q = p + uSun * t - uBeamC.xyz;
        float u = dot( q, uBeamU );
        float v = dot( q, uBeamV );
        lit = ( 1.0 - smoothstep( uBeamHalf.x - 0.03, uBeamHalf.x, abs( u ) ) ) * ( 1.0 - smoothstep( uBeamHalf.y - 0.03, uBeamHalf.y, abs( v ) ) );
      }
    }
  }
  // Phase: forward scattering toward a camera looking at the Sun, mild backscatter.
  vec3 toCam = normalize( cameraPosition - p );
  float g = dot( toCam, -uSun );
  float phase = 0.5 + 2.2 * pow( max( g, 0.0 ), 8.0 ) + 0.35 * pow( max( -g, 0.0 ), 2.0 );
  vLight = lit * phase * aT.w;
  float px = aT.z * uPxPerUnit / max( -mv.z, 1e-3 );
  vSize = px;
  // Sub-pixel grains: draw at 1.5 px and dim by area, so they shimmer less.
  gl_PointSize = max( px, 1.5 );
  vLight *= min( 1.0, ( px * px ) / ( 1.5 * 1.5 ) ) ;
}`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uIntensity;
varying float vLight;
varying float vSize;
void main() {
  #include <logdepthbuf_fragment>
  if ( vLight <= 0.0 ) discard;
  vec2 c = gl_PointCoord - 0.5;
  float r = length( c ) * 2.0;
  float a = 1.0 - smoothstep( 0.55, 1.0, r );
  if ( a <= 0.0 ) discard;
  gl_FragColor = vec4( uColor * uIntensity * vLight * a, 1.0 );
}`;

export class Dust {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(grains: Grain[], opts: DustOptions) {
    const n = grains.length;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const t = new Float32Array(n * 4);
    grains.forEach((g, i) => {
      pos.set([g.p.x, g.p.y, g.p.z], i * 3);
      vel.set([g.v.x, g.v.y, g.v.z], i * 3);
      // Landing: solve p.y + v.y·t − ½·g·t² = groundY.
      let land = 1e9;
      if (Number.isFinite(g.groundY)) {
        const a = 0.5 * opts.g;
        const b = -g.v.y;
        const c = g.groundY - g.p.y;
        const disc = b * b - 4 * a * c;
        land = disc >= 0 ? g.t0 + (-b + Math.sqrt(disc)) / (2 * a) : g.t0;
      }
      t.set([g.t0, land, g.size, g.bright], i * 4);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aV', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(t, 4));
    const s = opts.shadow;
    const b = opts.beam;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uG: { value: opts.g },
        uPxPerUnit: { value: opts.viewportHeight },
        uSun: { value: opts.sun.clone().normalize() },
        uShadow: { value: s ? new THREE.Vector4(s.center.x, s.center.y, s.radius, 1) : new THREE.Vector4() },
        uShadowY: { value: s ? new THREE.Vector2(s.y0, s.y1) : new THREE.Vector2() },
        uBeamC: { value: b ? new THREE.Vector4(b.center.x, b.center.y, b.center.z, 1) : new THREE.Vector4() },
        uBeamU: { value: b ? b.axisU.clone() : new THREE.Vector3() },
        uBeamV: { value: b ? b.axisV.clone() : new THREE.Vector3() },
        uBeamN: { value: b ? b.normal.clone() : new THREE.Vector3() },
        uBeamHalf: { value: b ? new THREE.Vector2(b.halfU, b.halfV) : new THREE.Vector2() },
        uColor: { value: opts.color.clone() },
        uIntensity: { value: opts.intensity },
      },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      transparent: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  /** Point sizes scale with this: projection factor (pixels per metre at 1 m) = viewportHeight / (2·tan(fov/2)). */
  setCamera(camera: THREE.PerspectiveCamera, viewportHeight: number): void {
    this.material.uniforms.uPxPerUnit!.value = viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }

  update(t: number): void {
    this.material.uniforms.uTime!.value = t;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
