// A stand-in sequence (a lit box under a moving camera) so the whole film renders before an act is built.
import * as THREE from 'three';
import type { SequenceDef, ShotTiming } from '../timeline';

export function placeholderSequence(id: string, shots: ShotTiming[], color: number): SequenceDef {
  return {
    id,
    shots,
    async load(ctx) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(color).multiplyScalar(0.15);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 6, 3) }));
      glow.position.set(0.9, 0.6, 0);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.5;
      const sun = new THREE.DirectionalLight(0xffffff, 3);
      sun.position.set(3, 5, 2);
      scene.add(box, glow, floor, sun, new THREE.AmbientLight(0xffffff, 0.2));
      const camera = new THREE.PerspectiveCamera(40, ctx.width / ctx.height, 0.1, 100);
      return {
        update(f) {
          const i = shots.findIndex((s) => s.id === f.shot);
          box.rotation.y = f.seqT * 1.5;
          const a = f.seqT * 0.3 + i;
          camera.position.set(Math.sin(a) * 4, 1.2, Math.cos(a) * 4);
          camera.lookAt(0, 0, 0);
          return { camera, post: { focusDistance: 4, aperture: 0.02 } };
        },
        render(target, cam) {
          ctx.renderer.setRenderTarget(target);
          ctx.renderer.render(scene, cam);
        },
        dispose() {
          scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              (o.material as THREE.Material).dispose();
            }
          });
        },
      };
    },
  };
}
