// titan-fx: beams. Titan floodlight beams in the thick, hazy air (presentation only, no rule change).
//
// Each light bar on the rover's front corners gets a soft volumetric cone along the floodlight's own
// direction, angle and range: a cone mesh drawn additively whose pixels ray-march the light scattered
// along the view ray inside the cone (spotlight falloff across, 1/distance and range fade along, clipped
// at the ground under the rover). Strength follows the Sun (off by day, full at night), the lamp, and the
// methane rain (more scattering). A faint halo glows at each housing, and a few raindrops glint inside the
// beams while it rains (one Points draw). Numbers: data/titan/tuning.json `look.beams` (TitanBeamsTuning).
import * as THREE from 'three';
import type { TitanBeamsTuning } from '../rules/titanTypes';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Beam strength 0..(1 + rainBoost) for a lit lamp: by Sun elevation (off by day, full at night) and rain 0..1. */
export function beamStrength(sunElevationDeg: number, storm: number, t: TitanBeamsTuning): number {
  const night = 1 - smoothstep(t.fullDeg, t.offDeg, sunElevationDeg);
  return (t.dayStrength + (1 - t.dayStrength) * night) * (1 + t.rainBoost * clamp01(storm));
}

/** Light bar centers on the rover (chassis frame), as roverModel.ts places them (front corners, on the box). */
export function lampMounts(body: { lengthM: number; widthM: number; heightM: number }): THREE.Vector3[] {
  const ht = body.heightM;
  const y = -ht / 2 + 0.08 + (ht * 0.78) / 2 + 0.02; // boxY + 0.02 in roverModel.ts
  const x = body.lengthM / 2 + 0.04;
  return [-1, 1].map((s) => new THREE.Vector3(x, y, s * body.widthM * 0.3));
}

const BEAM_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const BEAM_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform mat4 worldToBeam; // beam frame: apex at the origin, axis +x
uniform vec4 ground; // world plane under the rover: dot(n, p) + w > 0 above ground
uniform vec3 color; // linear, strength folded in
uniform float cosOuter;
uniform float cosInner;
uniform vec3 core; // a brighter core along the axis: cos(outer), cos(inner), share
uniform float tanAngle;
uniform float lengthM;
uniform float nearFade;
uniform float nearM;
uniform float fogDensity;
uniform int samples;
varying vec3 vWorld;

float scatter( vec3 q ) {
  float d = length( q );
  if ( q.x <= 0.0 || d >= lengthM ) return 0.0;
  float c = q.x / d;
  float spot = mix( smoothstep( cosOuter, cosInner, c ), smoothstep( core.x, core.y, c ), core.z );
  float fade = 1.0 - d / lengthM;
  return spot * fade * sqrt( fade ) * nearM / max( d, nearM ) * smoothstep( 0.0, nearFade, d );
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 rd = normalize( vWorld - cameraPosition );
  float t0 = distance( vWorld, cameraPosition );
  vec3 o = ( worldToBeam * vec4( vWorld, 1.0 ) ).xyz;
  vec3 d = normalize( mat3( worldToBeam ) * rd );
  // Where the view ray leaves the cone: the far root of y^2 + z^2 = k^2 x^2 (x > 0), or the end cap.
  float k2 = tanAngle * tanAngle;
  float A = d.y * d.y + d.z * d.z - k2 * d.x * d.x;
  float B = 2.0 * ( o.y * d.y + o.z * d.z - k2 * o.x * d.x );
  float C = o.y * o.y + o.z * o.z - k2 * o.x * o.x;
  float tEnd = lengthM * 2.0;
  float disc = B * B - 4.0 * A * C;
  if ( disc >= 0.0 && abs( A ) > 1e-5 ) {
    float s = sqrt( disc );
    float r1 = ( -B - s ) / ( 2.0 * A );
    float r2 = ( -B + s ) / ( 2.0 * A );
    if ( r1 > 1e-3 && o.x + d.x * r1 > 0.0 ) tEnd = min( tEnd, r1 );
    if ( r2 > 1e-3 && o.x + d.x * r2 > 0.0 ) tEnd = min( tEnd, r2 );
  }
  if ( d.x > 1e-5 ) tEnd = min( tEnd, max( 0.0, ( lengthM - o.x ) / d.x ) );
  float dn = dot( ground.xyz, rd );
  if ( dn < -1e-5 ) tEnd = min( tEnd, max( 0.0, -( dot( ground.xyz, vWorld ) + ground.w ) / dn ) );
  float ds = tEnd / float( samples );
  float jitter = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
  float sum = 0.0;
  for ( int i = 0; i < 48; i++ ) {
    if ( i >= samples ) break;
    float t = ( float( i ) + jitter ) * ds;
    sum += scatter( o + d * t ) * exp( -fogDensity * ( t0 + t ) );
  }
  gl_FragColor = vec4( color * sum * ds, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const POINT_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 color;
uniform float sharpness;
varying float vBright;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float a = exp( -dot( c, c ) * sharpness );
  gl_FragColor = vec4( color * vBright * a, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const GLINT_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 color;
varying float vBright;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float a = exp( -c.x * c.x * 60.0 - c.y * c.y * 9.0 ); // a short vertical streak: a falling drop catching the light
  gl_FragColor = vec4( color * vBright * a, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const HALO_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float sizeM;
uniform float viewH;
varying float vBright;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = sizeM * projectionMatrix[1][1] * 0.5 * viewH / max( -mv.z, 0.5 );
  vBright = 1.0;
  #include <logdepthbuf_vertex>
}
`;

const GLINT_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float phase;
uniform vec3 boxMin;
uniform vec3 boxSize;
uniform vec3 drift; // the rover's travel (chassis frame), so the drops stay put in the world
uniform float time;
uniform vec3 lampA;
uniform vec3 lampB;
uniform vec3 lampDir;
uniform float verticalScale;
uniform float cosOuter;
uniform float cosInner;
uniform float lengthM;
uniform float sizePx;
uniform float pixelRatio;
uniform float twinkleHz;
varying float vBright;
float lit( vec3 p, vec3 lamp ) {
  vec3 v = p - lamp;
  v.y /= verticalScale; // the beams are flatter than wide
  float d = max( length( v ), 1e-3 );
  float f = max( 0.0, 1.0 - d / lengthM );
  return smoothstep( cosOuter, cosInner, dot( v / d, lampDir ) ) * f * 4.0 / max( d, 4.0 );
}
void main() {
  vec3 p = boxMin + mod( position - drift - boxMin, boxSize );
  float twinkle = pow( 0.5 + 0.5 * sin( time * twinkleHz * 6.2832 + phase * 6.2832 ), 6.0 );
  vBright = ( lit( p, lampA ) + lit( p, lampB ) ) * ( 0.25 + 0.75 * twinkle );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = sizePx * pixelRatio * clamp( 10.0 / max( -mv.z, 0.1 ), 0.5, 2.5 );
  #include <logdepthbuf_vertex>
}
`;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
} as const;

/** Floodlight beams, housing halos and glinting raindrops on the Titan rover. */
export class TitanBeams {
  private readonly beams: THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>[] = [];
  private readonly halo: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly glints: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private readonly color: THREE.Color;
  private readonly lengthM: number;
  private on = 0; // eased lamp state 0..1
  private time = 0;
  private readonly drift = new THREE.Vector3();
  private readonly lastPos = new THREE.Vector3();
  private hasLast = false;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly size = new THREE.Vector2();

  /**
   * @param lamp the rover's floodlight (a child of `rover`); its intensity says whether it is on
   * @param rangeM the lights part's range (the floodlight distance)
   * @param heightAt terrain height, to clip the beams at the ground
   */
  constructor(
    private readonly rover: THREE.Object3D,
    private readonly lamp: THREE.SpotLight,
    rangeM: number,
    floodlight: { color: string; angle: number },
    private readonly t: TitanBeamsTuning,
    body: { lengthM: number; widthM: number; heightM: number },
    private readonly heightAt: (x: number, z: number) => number,
  ) {
    this.color = new THREE.Color(floodlight.color); // linear (three's color management)
    this.lengthM = rangeM * t.lengthScale;
    const angle = floodlight.angle * t.angleScale;
    const cosOuter = Math.cos(angle);
    const cosInner = Math.cos(angle * (1 - t.penumbra));
    const dir = lamp.target.position.clone().sub(lamp.position).normalize(); // chassis frame
    const mounts = lampMounts(body);

    // Cones: apex at the origin, axis +x (ConeGeometry has its apex at +y/2, base at -y/2).
    const geometry = new THREE.ConeGeometry(Math.tan(angle) * this.lengthM, this.lengthM, 32, 1, false);
    geometry.translate(0, -this.lengthM / 2, 0);
    geometry.rotateZ(Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms: {
        worldToBeam: { value: new THREE.Matrix4() },
        ground: { value: new THREE.Vector4(0, 1, 0, 1e6) },
        color: { value: new THREE.Color() },
        cosOuter: { value: cosOuter },
        cosInner: { value: cosInner },
        core: { value: new THREE.Vector3(Math.cos(angle * t.core.angleShare), Math.cos(angle * t.core.angleShare * 0.25), t.core.share) },
        tanAngle: { value: Math.tan(angle) },
        lengthM: { value: this.lengthM },
        nearFade: { value: t.nearFadeM },
        nearM: { value: t.nearM },
        fogDensity: { value: 0 },
        samples: { value: Math.max(4, Math.min(48, Math.round(t.samples))) },
      },
      side: THREE.FrontSide,
      ...additive,
    });
    for (const [i, m] of mounts.entries()) {
      // Each beam has its own frame matrix; the rest of the uniforms are shared.
      const mat = material.clone();
      for (const key of Object.keys(material.uniforms)) if (key !== 'worldToBeam') mat.uniforms[key] = material.uniforms[key]!;
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.copy(m);
      // Toed out a little (so the two beams read apart from behind) and flatter than wide, like headlights.
      const toe = ((i === 0 ? 1 : -1) * t.toeOutDeg * Math.PI) / 180; // mounts[0] is on the -z side
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), toe));
      mesh.scale.set(1, t.verticalScale, 1);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 2;
      rover.add(mesh);
      this.beams.push(mesh);
    }
    material.dispose();

    // Halos: one soft glow just in front of each housing.
    const haloGeo = new THREE.BufferGeometry().setFromPoints(mounts.map((m) => m.clone().addScaledVector(dir, 0.06)));
    this.halo = new THREE.Points(
      haloGeo,
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERTEX,
        fragmentShader: POINT_FRAGMENT,
        uniforms: { sizeM: { value: t.halo.sizeM }, viewH: { value: 720 }, color: { value: new THREE.Color() }, sharpness: { value: 18 } },
        ...additive,
      }),
    );
    this.halo.frustumCulled = false;
    this.halo.visible = false;
    this.halo.renderOrder = 3;
    this.halo.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(this.size);
      this.halo.material.uniforms.viewH!.value = this.size.y;
    };
    rover.add(this.halo);

    // Raindrops glinting in the beams: a box ahead of the lights, wrapped as they fall and as the rover moves.
    const n = Math.max(0, Math.floor(t.glints.count));
    if (n > 0) {
      const reach = this.lengthM * 0.6;
      const half = Math.tan(angle) * reach + body.widthM * 0.3;
      const boxMin = new THREE.Vector3(mounts[0]!.x + 0.5, -2, -half);
      const boxSize = new THREE.Vector3(reach, 5, half * 2);
      const pos = new Float32Array(n * 3);
      const phase = new Float32Array(n);
      let s = 24680; // fixed layout (no Math.random)
      const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < n; i++) {
        pos.set([boxMin.x + rnd() * boxSize.x, boxMin.y + rnd() * boxSize.y, boxMin.z + rnd() * boxSize.z], i * 3);
        phase[i] = rnd();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
      const glints = new THREE.Points(
        g,
        new THREE.ShaderMaterial({
          vertexShader: GLINT_VERTEX,
          fragmentShader: GLINT_FRAGMENT,
          uniforms: {
            boxMin: { value: boxMin },
            boxSize: { value: boxSize },
            drift: { value: this.drift },
            time: { value: 0 },
            lampA: { value: mounts[0]!.clone() },
            lampB: { value: mounts[1]!.clone() },
            lampDir: { value: dir.clone() },
            verticalScale: { value: t.verticalScale },
            cosOuter: { value: cosOuter },
            cosInner: { value: cosInner },
            lengthM: { value: this.lengthM },
            sizePx: { value: t.glints.sizePx },
            pixelRatio: { value: 1 },
            twinkleHz: { value: t.glints.twinkleHz },
            color: { value: new THREE.Color() },
          },
          ...additive,
        }),
      );
      glints.frustumCulled = false;
      glints.visible = false;
      glints.renderOrder = 3;
      glints.onBeforeRender = (renderer) => {
        glints.material.uniforms.pixelRatio!.value = renderer.getPixelRatio();
      };
      rover.add(glints);
      this.glints = glints;
    }
    if (import.meta.env.DEV) (window as unknown as { __beams?: unknown }).__beams = { tuning: t, beams: this }; // tuning in the browser
  }

  /** Each frame, after the rover has moved: Sun elevation (deg), rain 0..1 and the haze density (look.fogDensity). */
  update(dt: number, sunElevationDeg: number, storm: number, fogDensity: number): void {
    const target = this.lamp.intensity > 0 ? 1 : 0;
    this.on += (target - this.on) * Math.min(1, dt / 0.25);
    if (target === 0 && this.on < 0.01) this.on = 0;
    const strength = this.on * beamStrength(sunElevationDeg, storm, this.t);
    const visible = strength > 0.002;
    for (const b of this.beams) b.visible = visible;
    this.halo.visible = visible && this.t.halo.intensity > 0;
    const rain = clamp01(storm);
    if (this.glints) this.glints.visible = visible && rain > 0.02;

    // The rover's travel in its own frame, so the glinting drops stay fixed in the world.
    const p = this.rover.position;
    if (this.hasLast) {
      this.tmp.copy(p).sub(this.lastPos).applyQuaternion(this.quat.copy(this.rover.quaternion).invert());
      if (this.tmp.lengthSq() < 100) this.drift.add(this.tmp);
    }
    this.lastPos.copy(p);
    this.hasLast = true;
    this.time += dt;
    if (!visible) return;

    const u = this.beams[0]!.material.uniforms;
    (u.color!.value as THREE.Color).copy(this.color).multiplyScalar(this.t.intensity * strength);
    u.fogDensity!.value = fogDensity;
    // Ground under the beams: a plane through the terrain at the lamp and halfway down the beam, level sideways.
    this.rover.updateWorldMatrix(true, false);
    const apex = this.tmp.set(this.lamp.position.x, 0, 0).applyMatrix4(this.rover.matrixWorld);
    const ahead = this.tmp2.set(this.lamp.position.x + this.lengthM * 0.5, 0, 0).applyMatrix4(this.rover.matrixWorld);
    const fx = ahead.x - apex.x;
    const fz = ahead.z - apex.z;
    const h0 = this.heightAt(apex.x, apex.z);
    const h1 = this.heightAt(ahead.x, ahead.z);
    const n = new THREE.Vector3(fx, h1 - h0, fz).cross(new THREE.Vector3(-fz, 0, fx)).normalize();
    if (n.y < 0) n.negate();
    const g = u.ground!.value as THREE.Vector4;
    g.set(n.x, n.y, n.z, -(n.x * apex.x + n.y * (h0 - 0.05) + n.z * apex.z));
    for (const b of this.beams) {
      b.updateWorldMatrix(false, false);
      (b.material.uniforms.worldToBeam!.value as THREE.Matrix4).copy(b.matrixWorld).invert();
    }

    (this.halo.material.uniforms.color!.value as THREE.Color).copy(this.color).multiplyScalar(this.t.halo.intensity * this.on * Math.min(1, strength));
    if (this.glints && this.glints.visible) {
      const gu = this.glints.material.uniforms;
      this.drift.y += this.t.glints.fallMps * dt;
      const box = gu.boxSize!.value as THREE.Vector3;
      this.drift.set(this.drift.x % (box.x * 64), this.drift.y % (box.y * 64), this.drift.z % (box.z * 64));
      gu.time!.value = this.time;
      (gu.color!.value as THREE.Color).copy(this.color).multiplyScalar(this.t.glints.intensity * strength * smoothstep(0.02, 0.5, rain));
    }
  }

  dispose(): void {
    for (const b of this.beams) {
      b.removeFromParent();
      b.material.dispose();
    }
    this.beams[0]?.geometry.dispose();
    for (const p of [this.halo, this.glints]) {
      if (!p) continue;
      p.removeFromParent();
      p.geometry.dispose();
      p.material.dispose();
    }
  }
}
