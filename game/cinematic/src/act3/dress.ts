// The rover's cinematic look for Act 3, applied once to the game vehicle's model after the world starts.
// An identity stub for now: at integration this becomes Act 2's dressRover (src/rig/), so the hero rover looks the
// same in every act. Act 3's own additions (lamp glow, beams) live in fx/ and do not depend on it.
import type * as THREE from 'three';

export const dress = (_rover: THREE.Object3D): void => {};
