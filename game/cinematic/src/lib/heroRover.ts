// The rover the film shows: a handsome, capable build shared by every act (so it is the same hero throughout).
// Steel chassis (three instrument mounts), mesh wheels, the deployable solar mast, LED floodlights, the RHU heater
// (gold foil), and a camera, drill and X-ray spectrometer.
import type { Build, Part } from '../../../src/rules/types';
import { selectedParts } from '../../../src/rules/rover';
import { roverParams } from '../../../src/rules/drive';
import type { RoverParams } from '../../../src/rules/drive';
import type { GameData } from '../../../src/rules/types';

export const HERO_BUILD: Build = {
  chassis: 'chassis-steel',
  wheels: 'wheels-mesh',
  power: 'power-solar-mast',
  battery: 'battery-nih2',
  lights: 'lights-led',
  heater: 'heater-rhu',
  payload: ['instrument-camera', 'instrument-drill', 'instrument-xray'],
};

export function heroRover(data: GameData): { parts: Part[]; params: RoverParams; lightRangeM: number } {
  const parts = selectedParts(HERO_BUILD, data.parts);
  const params = roverParams(parts, data.tuning);
  const lightRangeM = parts.reduce((m, p) => Math.max(m, p.effects.lightRange ?? 0), 0);
  return { parts, params, lightRangeM };
}
