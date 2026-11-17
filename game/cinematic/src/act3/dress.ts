// The rover's cinematic look for Act 3: Act 2's dressRover (src/rig/), so the hero rover looks the same in every act.
// Applied once to the game vehicle's model after the world starts and the clip has set its Sun. The rover is awake
// here: status LEDs on; the floodlight lenses glow with the beam (the clips switch it with offline.setLamp).
// Act 3's own additions (lamp housing glow, beams) live in fx/.
import * as THREE from 'three';
import type { CinematicWorld } from '../lib/world';
import type { SequenceContext } from '../timeline';
import { dressRover, type RoverDress } from '../rig/dress';
import { lunarEnvironment } from '../rig/env';

/** Lamp setting (offline.setLamp) at which the lenses glow fully. */
const FULL_LENS_GLOW_AT = 0.3;

export function dress(w: CinematicWorld, ctx: SequenceContext): { dress: RoverDress; dispose(): void } {
  const o = w.offline;
  // Reflections: the lunar black-sky environment on the Moon; Mars and Titan rely on their sky (hemisphere) light.
  const env = w.data.tuning.look?.colors || o.skyLight instanceof THREE.HemisphereLight
    ? null
    : lunarEnvironment(ctx.renderer, { sun: o.sunLight.position.clone().sub(o.sunLight.target.position).normalize(), ground: 0.07 });
  const d = dressRover(o.rover.object, { handling: w.data.tuning.rover, offline: o, envMap: env?.texture ?? null });
  d.setLeds(1);
  d.setIndirect(1);
  d.setLamps(0);
  const setLamp = o.setLamp.bind(o);
  o.setLamp = (k: number) => {
    setLamp(k);
    d.setLamps(Math.min(1, Math.max(0, k) / FULL_LENS_GLOW_AT));
  };
  return {
    dress: d,
    dispose() {
      d.dispose();
      env?.dispose();
    },
  };
}
