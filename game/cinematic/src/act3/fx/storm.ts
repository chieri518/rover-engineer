// Mars: a dust-storm front (a towering, billowing wall of dust advancing over the crater floor) and the blowing dust
// ahead of it, skimming the ground, as a slice volume (volume.ts). Lit by the game's own Mars look: the Sun's color
// (self-shadowed by the wall), sky light from above and ground bounce from below.
import * as THREE from 'three';
import { SliceVolume, type SliceVolumeOptions } from './volume';

const MEDIUM = /* glsl */ `
uniform float time;
uniform float frontS;     // the front's position along windDir (m); dust lies behind it (s < frontS)
uniform vec2 windDir;     // where the storm travels (unit, xz)
uniform float windSpeed;  // m/s
uniform float groundY;
uniform float wallTop;
uniform float wallDensity;
uniform float groundDust;
uniform float airDust;    // thin dust everywhere in the air (per m)
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 bounceColor;
uniform vec3 albedo;

// Depth inside the wall (m): the face billows in and out in big cauliflower lobes that roll forward and up.
float wallDepth( vec3 p, float y, out float big ) {
  vec3 q = vec3( p.x, y, p.z ) - vec3( windDir.x, 0.0, windDir.y ) * windSpeed * time;
  big = fbm3( q * vec3( 0.016, 0.012, 0.016 ) + vec3( 0.0, -time * 0.05, 0.0 ) );
  float s = dot( p.xz, windDir );
  // The head bulges forward above the ground (a gust front), the top trails behind.
  float head = 25.0 * exp( -pow( ( y - 0.25 * wallTop ) / ( 0.3 * wallTop ), 2.0 ) ) - 0.12 * y;
  return frontS - s + ( big - 0.5 ) * 150.0 + head;
}

float wallAt( vec3 p, bool detail ) {
  float y = p.y - groundY;
  if ( y < -30.0 ) return 0.0;
  float big;
  float u = wallDepth( p, y, big );
  if ( u < -12.0 ) return 0.0;
  float top = wallTop * ( 0.45 + 1.1 * big );
  float h = 1.0 - smoothstep( top * 0.7, top, y );
  if ( h <= 0.0 ) return 0.0;
  float d = 0.8;
  float edge = u;
  if ( detail ) {
    vec3 q = vec3( p.x, y, p.z ) - vec3( windDir.x, 0.0, windDir.y ) * windSpeed * 0.85 * time;
    float n = fbm3( q * 0.06 + vec3( time * 0.2, -time * 0.35, 0.0 ) );
    edge += ( n - 0.5 ) * 30.0;
    d = 0.35 + 1.4 * n * n;
  }
  return wallDensity * smoothstep( -4.0, 14.0, edge ) * h * d;
}

float groundAt( vec3 p ) {
  float y = p.y - terrainY( p.xz );
  if ( y > 8.0 || groundDust <= 0.0 ) return 0.0;
  vec3 q = p - vec3( windDir.x, 0.0, windDir.y ) * windSpeed * 1.2 * time;
  float n = fbm3( q * vec3( 0.1, 0.5, 0.1 ) + vec3( 0.0, -time * 0.6, 0.0 ) );
  float s = dot( p.xz, windDir );
  float near = smoothstep( frontS + 180.0, frontS, s ); // ahead of the front, thinning out
  return groundDust * near * exp( -max( y, 0.0 ) / 1.3 ) * smoothstep( 0.4, 0.75, n );
}

void medium( vec3 p, vec3 rd, float dist, out vec3 L, out float ext ) {
  float dw = wallAt( p, true );
  float dg = groundAt( p );
  ext = dw + dg + airDust;
  if ( ext < 1e-7 ) { L = vec3( 0.0 ); return; }
  // Sunlight through the wall toward the Sun (two coarse samples).
  float toward = wallAt( p + sunDir * 25.0, false ) * 25.0 + wallAt( p + sunDir * 70.0, false ) * 45.0;
  float sunT = exp( -toward * 1.2 );
  float mu = dot( rd, sunDir );
  float g = 0.45;
  float hg = ( 1.0 - g * g ) / pow( 1.0 + g * g - 2.0 * g * mu, 1.5 ) / 3.0;
  float y = clamp( ( p.y - groundY ) / max( wallTop, 1.0 ), 0.0, 1.0 );
  vec3 amb = skyColor * ( 0.55 + 0.45 * y ) + bounceColor * ( 1.0 - y ) * 0.6;
  // Deep inside the wall the sky light is swallowed too.
  float inside = clamp( dw / max( wallDensity, 1e-6 ), 0.0, 1.0 );
  L = albedo * ( sunColor * sunT * ( 0.35 + hg ) + amb * ( 1.0 - 0.45 * inside ) );
}
`;

export class DustStorm {
  readonly volume: SliceVolume;
  private readonly u: Record<string, THREE.IUniform>;

  constructor(opts: { windDir: { x: number; z: number }; windSpeed: number; groundY: number; wallTop: number; ground: SliceVolumeOptions['ground'] }) {
    this.volume = new SliceVolume({
      count: 40,
      near: 0.6,
      far: 900,
      samples: 2,
      medium: MEDIUM,
      ground: opts.ground,
      uniforms: {
        time: { value: 0 },
        frontS: { value: 0 },
        windDir: { value: new THREE.Vector2(opts.windDir.x, opts.windDir.z) },
        windSpeed: { value: opts.windSpeed },
        groundY: { value: opts.groundY },
        wallTop: { value: opts.wallTop },
        wallDensity: { value: 0.03 },
        groundDust: { value: 0 },
        airDust: { value: 0 },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color() },
        skyColor: { value: new THREE.Color() },
        bounceColor: { value: new THREE.Color() },
        albedo: { value: new THREE.Color(0.62, 0.42, 0.27) },
      },
    });
    this.u = this.volume.uniforms;
  }

  get object(): THREE.Object3D {
    return this.volume.group;
  }

  /** Per sub-frame: time, where the front is, how much dust blows, and the light (from the world's look). */
  update(
    camera: THREE.PerspectiveCamera,
    t: number,
    s: { frontS: number; groundDust: number; airDust: number; wallDensity: number },
    light: { sunDir: THREE.Vector3; sun: THREE.Color; sky: THREE.Color; bounce: THREE.Color },
  ): void {
    this.u.time!.value = t;
    this.u.frontS!.value = s.frontS;
    this.u.groundDust!.value = s.groundDust;
    this.u.airDust!.value = s.airDust;
    this.u.wallDensity!.value = s.wallDensity;
    (this.u.sunDir!.value as THREE.Vector3).copy(light.sunDir);
    (this.u.sunColor!.value as THREE.Color).copy(light.sun);
    (this.u.skyColor!.value as THREE.Color).copy(light.sky);
    (this.u.bounceColor!.value as THREE.Color).copy(light.bounce);
    this.volume.update(camera, t);
  }

  dispose(): void {
    this.volume.dispose();
  }
}
