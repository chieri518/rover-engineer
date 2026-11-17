// A lunar environment for reflections (PMREM): black sky, and below the horizon the sunlit regolith,
// brighter away from the Sun (lunar backscatter) and along the horizon. Pass the result as `envMap` to
// the cinematic materials (dressRover, the lander); scale it with their indirect-light multiplier.
import * as THREE from 'three';

export interface LunarEnvOptions {
  /** Unit vector toward the Sun (world). */
  sun: THREE.Vector3;
  /** Linear radiance of the regolith seen straight down (HDR units of the scene: ~0.06 under a 2° Sun). */
  ground?: number;
}

export function lunarEnvironment(renderer: THREE.WebGLRenderer, opts: LunarEnvOptions): THREE.WebGLRenderTarget {
  const scene = new THREE.Scene();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      sunDir: { value: opts.sun.clone().normalize() },
      ground: { value: opts.ground ?? 0.06 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize( position ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir; uniform float ground; varying vec3 vDir;
      void main() {
        vec3 d = normalize( vDir );
        vec3 c = vec3( 0.0 );
        if ( d.y < 0.0 ) {
          float phase = acos( clamp( dot( sunDir, -d ), -1.0, 1.0 ) );
          float bright = 1.3 - 0.85 * phase / 3.14159265;
          float horizon = 1.0 + 0.8 * smoothstep( -0.12, 0.0, d.y );
          c = vec3( 1.0, 0.97, 0.92 ) * ground * bright * horizon;
        }
        // Soft edge at the horizon (distant terrain).
        c *= smoothstep( 0.02, -0.01, d.y );
        gl_FragColor = vec4( c, 1.0 );
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), material));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0, 0.1, 100);
  pmrem.dispose();
  material.dispose();
  (scene.children[0] as THREE.Mesh).geometry.dispose();
  return target;
}
