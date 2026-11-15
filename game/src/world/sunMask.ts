// Terrain shadows from a 1.5° Sun, computed on the GPU.
// For every sample of each height grid, a fragment shader marches the heights toward the Sun and
// stores how much of the Sun's disc is visible (soft edge from its 0.53° width). Shadows kilometers
// long work at any distance, at the 5 m resolution of the data. Each mask is refreshed in bands,
// one band per frame, so the cost is spread out while the Sun moves (about 0.6° per second).
import * as THREE from 'three';
import { GROUND_EYE_M, MARCH_GROWTH, MARCH_MAX_M, SUN_RADIUS_TAN, type HeightGrid, type Terrain } from './terrainData';

const MAX_STEPS = Math.ceil(Math.log(MARCH_MAX_M / 5) / Math.log(MARCH_GROWTH)) + 2;

const VERTEX = /* glsl */ `
void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D hFine;
uniform sampler2D hNear;
uniform sampler2D hFar;
uniform vec3 gridExtent;
uniform vec3 gridSpan;
uniform float regionPixel;
uniform float regionN;
uniform vec3 sun; // xy: horizontal direction (x, z); z: tangent of the elevation
uniform float maxHeight;

float heightAt( vec2 p ) {
  vec2 a = abs( p );
  float m = max( a.x, a.y );
  if ( m <= gridExtent.x ) return textureLod( hFine, 0.5 + p / gridSpan.x, 0.0 ).r;
  if ( m <= gridExtent.y ) return textureLod( hNear, 0.5 + p / gridSpan.y, 0.0 ).r;
  return textureLod( hFar, 0.5 + p / gridSpan.z, 0.0 ).r;
}

void main() {
  vec2 cell = floor( gl_FragCoord.xy );
  vec2 p = ( cell - ( regionN - 1.0 ) * 0.5 ) * regionPixel;
  float h0 = heightAt( p ) + ${GROUND_EYE_M.toFixed(2)};
  float maxTan = -1e9;
  float t = regionPixel;
  for ( int i = 0; i < ${MAX_STEPS}; i++ ) {
    vec2 q = p + sun.xy * t;
    vec2 aq = abs( q );
    if ( max( aq.x, aq.y ) > gridExtent.z ) break;
    maxTan = max( maxTan, ( heightAt( q ) - h0 ) / t );
    // Nothing farther out can rise above the Sun.
    if ( ( maxHeight - h0 ) / t < sun.z - ${SUN_RADIUS_TAN.toFixed(6)} ) break;
    t *= ${MARCH_GROWTH.toFixed(4)};
  }
  float vis = smoothstep( -${SUN_RADIUS_TAN.toFixed(6)}, ${SUN_RADIUS_TAN.toFixed(6)}, sun.z - maxTan );
  gl_FragColor = vec4( vis, 0.0, 0.0, 1.0 );
}
`;

function heightTexture(grid: HeightGrid): THREE.DataTexture {
  const tex = new THREE.DataTexture(grid.heights, grid.n, grid.n, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

interface Region {
  grid: HeightGrid;
  target: THREE.WebGLRenderTarget;
  bands: number;
}

export class SunMasks {
  readonly fine: THREE.Texture;
  readonly near: THREE.Texture;
  readonly far: THREE.Texture;
  private readonly heights: THREE.DataTexture[];
  private readonly regions: Region[];
  private readonly jobs: { region: Region; band: number }[] = [];
  private nextJob = 0;
  private readonly material: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly quad: THREE.Mesh;

  /** bands: how many frames a full refresh of each mask is spread over [fine, near, far]. */
  constructor(terrain: Terrain, bands: [number, number, number]) {
    const { fine, near, far } = terrain;
    this.heights = [heightTexture(fine), heightTexture(near), heightTexture(far)];
    const makeRegion = (grid: HeightGrid, n: number): Region => ({
      grid,
      bands: n,
      target: new THREE.WebGLRenderTarget(grid.n, grid.n, {
        format: THREE.RedFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
      }),
    });
    this.regions = [makeRegion(fine, bands[0]), makeRegion(near, bands[1]), makeRegion(far, bands[2])];
    this.fine = this.regions[0]!.target.texture;
    this.near = this.regions[1]!.target.texture;
    this.far = this.regions[2]!.target.texture;
    // Interleave so the play-area mask (what the player sees most) refreshes as often as the rings.
    const maxBands = Math.max(...bands);
    for (let b = 0; b < maxBands; b++) {
      for (const region of this.regions) if (b < region.bands) this.jobs.push({ region, band: b });
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        hFine: { value: this.heights[0] },
        hNear: { value: this.heights[1] },
        hFar: { value: this.heights[2] },
        gridExtent: { value: new THREE.Vector3(fine.extent, near.extent, far.extent) },
        gridSpan: { value: new THREE.Vector3(fine.pixel * fine.n, near.pixel * near.n, far.pixel * far.n) },
        regionPixel: { value: 1 },
        regionN: { value: 1 },
        sun: { value: new THREE.Vector3(0, -1, 0.026) },
        maxHeight: { value: terrain.maxHeight },
      },
      depthTest: false,
      depthWrite: false,
    });
    // One triangle that covers the whole target.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geometry, this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private setSun(sun: { x: number; y: number; z: number }): void {
    const horiz = Math.max(Math.hypot(sun.x, sun.z), 1e-6);
    (this.material.uniforms.sun!.value as THREE.Vector3).set(sun.x / horiz, sun.z / horiz, sun.y / horiz);
  }

  private run(renderer: THREE.WebGLRenderer, region: Region, band: number): void {
    const { grid, target } = region;
    const u = this.material.uniforms;
    u.regionPixel!.value = grid.pixel;
    u.regionN!.value = grid.n;
    const rows = Math.ceil(grid.n / region.bands);
    const y0 = band * rows;
    target.scissor.set(0, y0, grid.n, Math.min(rows, grid.n - y0));
    target.scissorTest = true;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previous);
  }

  /** Refresh every mask completely (at start, or after a time jump). */
  updateAll(renderer: THREE.WebGLRenderer, sun: { x: number; y: number; z: number }): void {
    this.setSun(sun);
    for (const job of this.jobs) this.run(renderer, job.region, job.band);
  }

  /** Refresh the next band. Call once per frame. */
  updateStep(renderer: THREE.WebGLRenderer, sun: { x: number; y: number; z: number }): void {
    this.setSun(sun);
    const job = this.jobs[this.nextJob]!;
    this.nextJob = (this.nextJob + 1) % this.jobs.length;
    this.run(renderer, job.region, job.band);
  }

  dispose(): void {
    for (const h of this.heights) h.dispose();
    for (const r of this.regions) r.target.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
