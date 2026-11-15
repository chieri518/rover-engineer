import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import partsFile from '../../data/parts.json';
import tuningFile from '../../data/tuning.json';
import type { Part, PartsFile, RoverHandling, Slot } from '../rules/types';
import { buildRoverModel, roverLook } from './roverModel';

const catalog = partsFile as PartsFile;
const handling = (tuningFile as unknown as { rover: RoverHandling }).rover;
const connectY = -handling.body.heightM / 2 + 0.12;
const part = (id: string): Part => catalog.parts.find((p) => p.id === id)!;
const meshCount = (obj: THREE.Object3D) => {
  let n = 0;
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) n++;
  });
  return n;
};

describe('rover look', () => {
  it('shows nothing for an empty build', () => {
    expect(roverLook([])).toEqual({
      frame: null, wheels: null, power: null, battery: null, lights: false, heater: false, instrument: null,
    });
  });

  it('fills only the chosen slots of a draft build', () => {
    expect(roverLook([part('wheels-mesh'), part('power-solar-mast')])).toEqual({
      frame: null, wheels: 'mesh', power: 'mast', battery: null, lights: false, heater: false, instrument: null,
    });
  });

  it('fills every field for a complete build', () => {
    const look = roverLook(['chassis-steel', 'wheels-solid', 'power-fixed-panel', 'battery-nih2', 'lights-led', 'heater-rhu', 'instrument-drill'].map(part));
    expect(look).toEqual({
      frame: 'steel', wheels: 'solid', power: 'panel', battery: 'cylinders', lights: true, heater: true, instrument: 'drill',
    });
  });

  it('draws no lights or heater for the "none" options', () => {
    const look = roverLook([part('lights-none'), part('heater-none')]);
    expect(look.lights).toBe(false);
    expect(look.heater).toBe(false);
  });
});

describe('rover model for a draft build', () => {
  it('is empty when no part is chosen', () => {
    const model = buildRoverModel(handling, connectY, roverLook([]), { bySlot: true });
    expect(meshCount(model.body)).toBe(0);
    expect(model.wheels).toHaveLength(0);
    expect(model.slots).toEqual({});
  });

  it('groups the static parts by slot, only for the chosen slots', () => {
    const model = buildRoverModel(handling, connectY, roverLook([part('power-fixed-panel'), part('heater-rhu'), part('wheels-mesh')]), { bySlot: true });
    expect(Object.keys(model.slots).sort()).toEqual<Slot[]>(['heater', 'power']);
    expect(model.wheels).toHaveLength(4);
    for (const group of Object.values(model.slots)) expect(group.parent).toBe(model.body);
  });

  it('keeps one mesh per material without bySlot', () => {
    const all = ['chassis-titanium', 'wheels-mesh', 'power-solar-mast', 'battery-li-ion', 'lights-led', 'heater-rhu', 'instrument-camera'].map(part);
    const merged = buildRoverModel(handling, connectY, roverLook(all));
    expect(merged.slots).toEqual({});
    expect(merged.body.children.every((c) => c instanceof THREE.Mesh)).toBe(true);
    const grouped = buildRoverModel(handling, connectY, roverLook(all), { bySlot: true });
    expect(meshCount(grouped.body)).toBeGreaterThanOrEqual(meshCount(merged.body));
  });
});
