// Instruments set down on the ground for good: the seismometer station (a gold-foil dome on three
// feet) and the laser retroreflector (a corner-cube panel on a small stand, facing +x). Visual only.
// Same geometry as the deck-mounted versions in rover/roverModel.ts. Lambert materials, so the scene's
// lunar lighting patch applies. Origin at the ground, facing +x like the rover.
import * as THREE from 'three';
import { reflectorGeometry, seismometerGeometry } from '../rover/roverModel';

export type StationInstrument = 'seismometer' | 'reflector';

const REFLECTOR_TILT = 0.95; // radians; the same as on the deck

export function createStationMesh(instrument: StationInstrument): THREE.Group {
  const group = new THREE.Group();
  group.name = instrument;
  const part = (geometry: THREE.BufferGeometry, color: number, emissive = 0) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, emissive }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  if (instrument === 'seismometer') {
    const g = seismometerGeometry(true);
    part(g.metal, 0xb4b8be);
    part(g.foil, 0xc89a3c);
  } else {
    const g = reflectorGeometry(REFLECTOR_TILT);
    part(g.stand, 0x2f3134);
    part(g.frame, 0xe6e3da);
    part(g.cells, 0x2f3134);
  }
  return group;
}

/** Free the geometry and materials of a station mesh. */
export function disposeStationMesh(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
}
