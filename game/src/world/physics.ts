// Rapier start-up. The WASM module loads once, on the first mission.
import RAPIER from '@dimforge/rapier3d-compat';

let ready: Promise<void> | null = null;

export async function initRapier(): Promise<typeof RAPIER> {
  ready ??= RAPIER.init();
  await ready;
  return RAPIER;
}
