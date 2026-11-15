// Placeholder 3D view: a grey plane under a low Sun. Phase 2 replaces this with real terrain.
import * as THREE from 'three';

export function startPlaceholderScene(container: HTMLElement): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  camera.position.set(0, 6, 14);
  camera.lookAt(0, 0, 0);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
  box.position.y = 0.5;
  box.castShadow = true;
  scene.add(box);

  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  scene.add(sun);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let frame = 0;
  const start = performance.now();
  const loop = () => {
    // The low Sun circles the horizon.
    const angle = (performance.now() - start) / 20000;
    sun.position.set(Math.cos(angle) * 50, 4, Math.sin(angle) * 50);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
}
