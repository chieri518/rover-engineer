// The film look, applied to every frame after the scene is drawn:
//   sub-frames (linear HDR, 4x MSAA, each with its own time, sub-pixel jitter and lens position) are averaged in a
//   float accumulation buffer: real motion blur, depth of field and anti-aliasing from one mechanism;
//   bloom (three's UnrealBloomPass) on the averaged HDR;
//   grade pass: exposure, tint, lens flare, chromatic aberration, ACES filmic tone mapping, contrast, saturation;
//   downsample pass (supersampling) to the output size in linear light, then vignette, fade, sRGB, grain and dither.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** Per-frame look settings; sequences return a partial set, the rest comes from DEFAULT_POST. */
export interface PostParams {
  /** Multiplies the linear HDR image before tone mapping (1: neutral). */
  exposure: number;
  bloomStrength: number;
  bloomRadius: number;
  /** Linear HDR luminance above which pixels bloom. */
  bloomThreshold: number;
  /** Depth of field: distance in metres that stays sharp. */
  focusDistance: number;
  /** Depth of field: lens radius in metres (0: pinhole, everything sharp). Needs sub-frames to show. */
  aperture: number;
  /** Fewest sub-frames for this frame in the final render (e.g. 24 for a shallow-focus close-up). */
  minSubframes: number;
  /** 1: full picture, 0: black. */
  fade: number;
  /** Corner darkening, 0..1. */
  vignette: number;
  /** Film grain, 0..1 (1: strong). */
  grain: number;
  /** Red/blue split at the frame corners, in output pixels. */
  chromaticAberration: number;
  /** Linear multiply on the HDR image (color temperature, tint). */
  tint: [number, number, number];
  saturation: number;
  /** Contrast around mid grey after tone mapping (1: neutral). */
  contrast: number;
  /** Lifts the blacks (0: none), in display-linear units, tinted by `liftColor`. */
  lift: number;
  liftColor: [number, number, number];
  /** Lens flare from a bright source: its position in NDC (-1..1) and strength; occluded automatically when the source pixel is dark. */
  flare: { x: number; y: number; intensity: number; color?: [number, number, number] } | null;
}

export const DEFAULT_POST: PostParams = {
  exposure: 1,
  bloomStrength: 0.35,
  bloomRadius: 0.5,
  bloomThreshold: 1.2,
  focusDistance: 10,
  aperture: 0,
  minSubframes: 0,
  fade: 1,
  vignette: 0.25,
  grain: 0.25,
  chromaticAberration: 0.6,
  tint: [1, 1, 1],
  saturation: 1,
  contrast: 1,
  lift: 0,
  liftColor: [1, 1, 1],
  flare: null,
};

export function resolvePost(p: Partial<PostParams>): PostParams {
  return { ...DEFAULT_POST, ...p };
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const ACCUM_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform float weight; varying vec2 vUv;
void main() { vec4 c = texture2D(tSrc, vUv); gl_FragColor = vec4(max(c.rgb, 0.0) * weight, weight); }`;

const GRADE_FRAG = /* glsl */ `
uniform sampler2D tHdr;
uniform vec2 resolution;
uniform float exposure, saturation, contrast, ca, lift;
uniform vec3 tint, liftColor;
uniform vec3 flarePos; // x, y in uv, z intensity
uniform vec3 flareColor;
varying vec2 vUv;

vec3 acesFitted(vec3 color) {
  // Stephen Hill's ACES fit (as three's ACESFilmicToneMapping, without its exposure scale).
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color = ACESInputMat * color;
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  color = ACESOutputMat * (a / b);
  return clamp(color, 0.0, 1.0);
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 flare(vec2 uv) {
  if (flarePos.z <= 0.0) return vec3(0.0);
  vec2 s = flarePos.xy;
  // Occlusion: how bright the source is in the image (5 taps around it).
  vec2 px = 3.0 / resolution;
  float L = 0.0;
  L += luma(texture2D(tHdr, s).rgb);
  L += luma(texture2D(tHdr, s + vec2(px.x, 0.0)).rgb);
  L += luma(texture2D(tHdr, s - vec2(px.x, 0.0)).rgb);
  L += luma(texture2D(tHdr, s + vec2(0.0, px.y)).rgb);
  L += luma(texture2D(tHdr, s - vec2(0.0, px.y)).rgb);
  float vis = smoothstep(1.0, 6.0, L / 5.0);
  if (vis <= 0.0) return vec3(0.0);
  float aspect = resolution.x / resolution.y;
  vec2 c = vec2(0.5);
  vec2 d = s - c;
  vec3 col = vec3(0.0);
  // Ghosts along the line through the frame centre.
  const int N = 6;
  float ks[6]; ks[0] = -0.35; ks[1] = -0.62; ks[2] = -1.05; ks[3] = 0.42; ks[4] = -1.5; ks[5] = 0.18;
  float rs[6]; rs[0] = 0.030; rs[1] = 0.055; rs[2] = 0.11; rs[3] = 0.02; rs[4] = 0.17; rs[5] = 0.012;
  vec3 tints[6];
  tints[0] = vec3(0.4, 0.7, 1.0); tints[1] = vec3(1.0, 0.6, 0.3); tints[2] = vec3(0.4, 1.0, 0.6);
  tints[3] = vec3(1.0, 0.85, 0.6); tints[4] = vec3(0.6, 0.5, 1.0); tints[5] = vec3(1.0, 1.0, 1.0);
  for (int i = 0; i < N; i++) {
    vec2 g = c + d * ks[i];
    vec2 q = (uv - g) * vec2(aspect, 1.0);
    float r = length(q);
    float disc = smoothstep(rs[i], rs[i] * 0.6, r);
    float ring = smoothstep(rs[i] * 0.12, 0.0, abs(r - rs[i] * 0.95)) * 0.5;
    col += tints[i] * (disc * 0.05 + ring * 0.04);
  }
  // Halo ring and soft glow around the source, and a faint horizontal streak.
  vec2 q = (uv - s) * vec2(aspect, 1.0);
  float r = length(q);
  col += vec3(0.7, 0.85, 1.0) * smoothstep(0.012, 0.0, abs(r - 0.32)) * 0.05;
  col += flareColor * exp(-r * 9.0) * 0.25;
  col += flareColor * exp(-abs(q.y) * 220.0) * exp(-abs(q.x) * 2.2) * 0.35;
  return col * flareColor * flarePos.z * vis;
}

void main() {
  vec2 uv = vUv;
  vec2 dc = uv - 0.5;
  // Chromatic aberration grows toward the corners.
  vec2 off = dc * dot(dc, dc) * 4.0 * ca / resolution * 2.0;
  vec3 hdr;
  hdr.r = texture2D(tHdr, uv - off).r;
  hdr.g = texture2D(tHdr, uv).g;
  hdr.b = texture2D(tHdr, uv + off).b;
  hdr += flare(uv);
  hdr *= tint * exposure;
  vec3 c = acesFitted(hdr);
  // Contrast around mid grey (in a perceptual-ish space), then saturation.
  vec3 p = pow(c, vec3(1.0 / 2.2));
  p = clamp((p - 0.5) * contrast + 0.5, 0.0, 1.0);
  c = pow(p, vec3(2.2));
  float l = luma(c);
  c = max(mix(vec3(l), c, saturation), 0.0);
  c += lift * liftColor * (1.0 - c);
  gl_FragColor = vec4(c, 1.0);
}`;

const FINISH_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 srcSize, outSize;
uniform float ss, fade, vignette, grain, frame;
varying vec2 vUv;

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
vec3 srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // Downsample in linear light with a tent filter as wide as the supersampling factor.
  vec3 sum = vec3(0.0); float wsum = 0.0;
  vec2 texel = 1.0 / srcSize;
  float rad = max(ss * 0.75, 0.5);
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 o = vec2(float(i), float(j)) * 0.5 * rad;
    float w = max(0.0, 1.0 - length(o) / (rad * 1.25));
    sum += texture2D(tSrc, vUv + o * texel).rgb * w; wsum += w;
  }
  vec3 c = sum / max(wsum, 1e-5);
  vec2 dc = (vUv - 0.5) * vec2(outSize.x / outSize.y, 1.0);
  float v = 1.0 - vignette * smoothstep(0.35, 1.15, length(dc) * 1.1);
  c *= v * fade;
  vec3 s = srgb(clamp(c, 0.0, 1.0));
  // Film grain: strongest in the mid tones, a little softer than one pixel.
  vec2 gp = floor(gl_FragCoord.xy);
  float n = hash(vec3(gp, frame)) + hash(vec3(gp + vec2(0.5, 0.0), frame + 17.0)) - 1.0;
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  s += n * grain * 0.06 * (0.35 + lum * (1.0 - lum) * 2.6);
  // Dither against banding in dark gradients (space, shadows).
  s += (hash(vec3(gp, frame + 3.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

export class PostChain {
  readonly scene: THREE.WebGLRenderTarget; // what sequences draw into: linear HDR, MSAA, with depth
  private readonly accum: THREE.WebGLRenderTarget;
  private readonly graded: THREE.WebGLRenderTarget;
  readonly output: THREE.WebGLRenderTarget; // RGBA8 sRGB at output size
  private readonly bloom: UnrealBloomPass;
  private readonly accumQuad: FullScreenQuad;
  private readonly gradeQuad: FullScreenQuad;
  private readonly finishQuad: FullScreenQuad;
  private readonly blitQuad: FullScreenQuad;
  private readonly accumMat: THREE.ShaderMaterial;
  private readonly gradeMat: THREE.ShaderMaterial;
  private readonly finishMat: THREE.ShaderMaterial;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    readonly internal: { width: number; height: number },
    readonly out: { width: number; height: number },
    msaa: number,
  ) {
    const { width: w, height: h } = internal;
    this.scene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa, depthBuffer: true });
    this.accum = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, depthBuffer: false });
    this.graded = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.output = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.5, 1.2);
    this.accumMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: ACCUM_FRAG,
      uniforms: { tSrc: { value: null }, weight: { value: 1 } },
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
    });
    this.gradeMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: GRADE_FRAG,
      uniforms: {
        tHdr: { value: null },
        resolution: { value: new THREE.Vector2(w, h) },
        exposure: { value: 1 },
        saturation: { value: 1 },
        contrast: { value: 1 },
        ca: { value: 0 },
        lift: { value: 0 },
        tint: { value: new THREE.Vector3(1, 1, 1) },
        liftColor: { value: new THREE.Vector3(1, 1, 1) },
        flarePos: { value: new THREE.Vector3() },
        flareColor: { value: new THREE.Vector3(1, 1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.finishMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FINISH_FRAG,
      uniforms: {
        tSrc: { value: this.graded.texture },
        srcSize: { value: new THREE.Vector2(w, h) },
        outSize: { value: new THREE.Vector2(out.width, out.height) },
        ss: { value: w / out.width },
        fade: { value: 1 },
        vignette: { value: 0 },
        grain: { value: 0 },
        frame: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.accumQuad = new FullScreenQuad(this.accumMat);
    this.gradeQuad = new FullScreenQuad(this.gradeMat);
    this.finishQuad = new FullScreenQuad(this.finishMat);
    // A raw copy (a ShaderMaterial gets no output color conversion; the frame is already sRGB).
    this.blitQuad = new FullScreenQuad(new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main() { gl_FragColor = texture2D(t, vUv); }',
      uniforms: { t: { value: this.output.texture } },
      depthTest: false,
      depthWrite: false,
    }));
  }

  /** Start a new output frame: clear the accumulation buffer. */
  begin(): void {
    const r = this.renderer;
    r.setRenderTarget(this.accum);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
  }

  /** Prepare the scene target for a sequence to draw into (cleared to black). */
  clearScene(): void {
    const r = this.renderer;
    r.setRenderTarget(this.scene);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
  }

  /** Add the scene target to the accumulation with this weight (weights of a frame sum to 1). */
  accumulate(weight: number): void {
    const r = this.renderer;
    this.accumMat.uniforms.tSrc!.value = this.scene.texture;
    this.accumMat.uniforms.weight!.value = weight;
    r.setRenderTarget(this.accum);
    this.accumQuad.render(r);
  }

  /** Bloom, grade, tone map, downsample and finish into `output`. */
  finish(p: PostParams, frameIndex: number): void {
    const r = this.renderer;
    const prevToneMapping = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    if (p.bloomStrength > 0) {
      this.bloom.strength = p.bloomStrength;
      this.bloom.radius = p.bloomRadius;
      this.bloom.threshold = p.bloomThreshold;
      this.bloom.render(r, this.graded /* unused write buffer */, this.accum, 0, false);
    }
    const g = this.gradeMat.uniforms;
    g.tHdr!.value = this.accum.texture;
    g.exposure!.value = p.exposure;
    g.saturation!.value = p.saturation;
    g.contrast!.value = p.contrast;
    g.ca!.value = p.chromaticAberration * (this.internal.width / this.out.width);
    g.lift!.value = p.lift;
    (g.tint!.value as THREE.Vector3).set(...p.tint);
    (g.liftColor!.value as THREE.Vector3).set(...p.liftColor);
    if (p.flare && p.flare.intensity > 0) {
      (g.flarePos!.value as THREE.Vector3).set(p.flare.x * 0.5 + 0.5, p.flare.y * 0.5 + 0.5, p.flare.intensity);
      (g.flareColor!.value as THREE.Vector3).set(...(p.flare.color ?? [1, 0.92, 0.8]));
    } else (g.flarePos!.value as THREE.Vector3).set(0, 0, 0);
    r.setRenderTarget(this.graded);
    this.gradeQuad.render(r);
    const f = this.finishMat.uniforms;
    f.fade!.value = p.fade;
    f.vignette!.value = p.vignette;
    f.grain!.value = p.grain;
    f.frame!.value = frameIndex % 1000;
    r.setRenderTarget(this.output);
    this.finishQuad.render(r);
    r.toneMapping = prevToneMapping;
  }

  /** Read the finished frame (RGBA8, bottom row first). */
  read(into: Uint8Array): void {
    this.renderer.readRenderTargetPixels(this.output, 0, 0, this.out.width, this.out.height, into);
  }

  /** Show the finished frame on the canvas (live mode). */
  blitToCanvas(): void {
    const r = this.renderer;
    const prev = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(null);
    this.blitQuad.render(r);
    r.toneMapping = prev;
  }

  dispose(): void {
    for (const t of [this.scene, this.accum, this.graded, this.output]) t.dispose();
    this.bloom.dispose();
    for (const q of [this.accumQuad, this.gradeQuad, this.finishQuad, this.blitQuad]) q.dispose();
  }
}
