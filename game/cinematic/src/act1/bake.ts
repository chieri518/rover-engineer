// Procedural textures baked once on the GPU at load: a full-screen shader rendered into a render target that is
// then used as an ordinary (mipmapped, anisotropic) texture.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { NOISE } from './glsl';

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export interface BakeOptions {
  width: number;
  height: number;
  /** Fragment shader body: NOISE is prepended, `varying vec2 vUv` is declared; write gl_FragColor. */
  frag: string;
  uniforms?: Record<string, THREE.IUniform>;
  /** HalfFloat for colour data that must not band (albedo in linear), UnsignedByte for data maps. */
  type?: THREE.TextureDataType;
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
  mipmaps?: boolean;
  format?: THREE.PixelFormat;
}

export function bake(renderer: THREE.WebGLRenderer, o: BakeOptions): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(o.width, o.height, {
    type: o.type ?? THREE.UnsignedByteType,
    format: o.format ?? THREE.RGBAFormat,
    depthBuffer: false,
    generateMipmaps: o.mipmaps ?? true,
    minFilter: (o.mipmaps ?? true) ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: o.wrapS ?? THREE.RepeatWrapping,
    wrapT: o.wrapT ?? THREE.RepeatWrapping,
  });
  rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: `precision highp float;\nvarying vec2 vUv;\n${NOISE}\n${o.frag}`,
    uniforms: o.uniforms ?? {},
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(mat);
  const prevTarget = renderer.getRenderTarget();
  const prevTone = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt);
  quad.render(renderer);
  renderer.setRenderTarget(prevTarget);
  renderer.toneMapping = prevTone;
  quad.dispose();
  mat.dispose();
  return rt;
}

/** A tangent-space normal map (RGBA8) from a height stored in a texture channel: `strength` = height units per texel. */
export function normalFromHeight(
  renderer: THREE.WebGLRenderer,
  height: THREE.Texture,
  w: number,
  h: number,
  strength: number,
  channel: 'r' | 'g' | 'b' | 'a' = 'r',
): THREE.WebGLRenderTarget {
  return bake(renderer, {
    width: w,
    height: h,
    uniforms: { tH: { value: height }, texel: { value: new THREE.Vector2(1 / w, 1 / h) }, strength: { value: strength } },
    frag: /* glsl */ `
      uniform sampler2D tH; uniform vec2 texel; uniform float strength;
      float H(vec2 o) { return texture2D(tH, vUv + o * texel).${channel}; }
      void main() {
        float dx = (H(vec2(1, 0)) - H(vec2(-1, 0))) * 0.5 + (H(vec2(1, 1)) - H(vec2(-1, 1)) + H(vec2(1, -1)) - H(vec2(-1, -1))) * 0.25;
        float dy = (H(vec2(0, 1)) - H(vec2(0, -1))) * 0.5 + (H(vec2(1, 1)) - H(vec2(1, -1)) + H(vec2(-1, 1)) - H(vec2(-1, -1))) * 0.25;
        vec3 n = normalize(vec3(-dx * strength, -dy * strength, 1.0));
        gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
      }`,
  });
}
