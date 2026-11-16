import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import partsFile from '../../data/parts.json';
import tuningFile from '../../data/tuning.json';
import type { Part, PartsFile, RoverHandling } from '../rules/types';
import { buildRoverModel, roverLook, type ModelGroup } from './roverModel';

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
      frame: null, wheels: null, power: null, battery: null, lights: false, heater: false, arm: false, mast: false, instruments: [],
    });
  });

  it('fills only the chosen slots of a draft build', () => {
    expect(roverLook([part('wheels-mesh'), part('power-solar-mast')])).toEqual({
      frame: null, wheels: 'mesh', power: 'mast', battery: null, lights: false, heater: false, arm: false, mast: false, instruments: [],
    });
  });

  it('fills every field for a complete build', () => {
    const look = roverLook(['chassis-steel', 'wheels-solid', 'power-fixed-panel', 'battery-nih2', 'lights-led', 'heater-rhu', 'instrument-drill'].map(part));
    expect(look).toEqual({
      frame: 'steel', wheels: 'solid', power: 'panel', battery: 'cylinders', lights: true, heater: true, arm: false, mast: false, instruments: ['drill'],
    });
  });

  it('lists every instrument in the bay, in bay order', () => {
    expect(roverLook([part('chassis-steel'), part('instrument-drill'), part('instrument-camera')]).instruments).toEqual(['drill', 'camera']);
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
    expect(Object.keys(model.slots).sort()).toEqual<ModelGroup[]>(['heater', 'power']);
    expect(model.wheels).toHaveLength(4);
    for (const group of Object.values(model.slots)) expect(group.parent).toBe(model.body);
  });

  it('draws the camera and the drill together, each as its own group', () => {
    const both = buildRoverModel(handling, connectY, roverLook([part('chassis-steel'), part('instrument-camera'), part('instrument-drill')]), { bySlot: true });
    expect(Object.keys(both.slots).sort()).toEqual<ModelGroup[]>(['camera', 'chassis', 'drill']);
    const drillOnly = buildRoverModel(handling, connectY, roverLook([part('instrument-drill')]), { bySlot: true });
    const cameraOnly = buildRoverModel(handling, connectY, roverLook([part('instrument-camera')]), { bySlot: true });
    // With a camera mast aboard, the drill leaves out its own short navigation camera.
    expect(meshCount(both.slots.drill!)).toBeLessThan(meshCount(drillOnly.slots.drill!));
    expect(meshCount(both.slots.camera!)).toBe(meshCount(cameraOnly.slots.camera!));
  });

  it('keeps one mesh per material without bySlot', () => {
    const all = ['chassis-titanium', 'wheels-mesh', 'power-solar-mast', 'battery-li-ion', 'lights-led', 'heater-rhu', 'instrument-camera'].map(part);
    const merged = buildRoverModel(handling, connectY, roverLook(all));
    expect(merged.slots).toEqual({});
    expect(merged.body.children.every((c) => c instanceof THREE.Mesh)).toBe(true);
    const grouped = buildRoverModel(handling, connectY, roverLook(all), { bySlot: true });
    expect(meshCount(grouped.body)).toBeGreaterThanOrEqual(meshCount(merged.body));
  });

  it('draws each new instrument in its own group', () => {
    for (const id of ['neutron', 'xray', 'seismometer', 'reflector'] as const) {
      const model = buildRoverModel(handling, connectY, roverLook([part(`instrument-${id}`)]), { bySlot: true });
      expect(Object.keys(model.slots)).toEqual([id]);
      expect(meshCount(model.slots[id]!)).toBeGreaterThan(0);
    }
  });

  it('builds any three instruments of the six', () => {
    const ids = ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'] as const;
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++) {
      const picked = [ids[a]!, ids[b]!, ids[c]!];
      const look = roverLook([part('chassis-steel'), part('wheels-solid'), ...picked.map((i) => part(`instrument-${i}`))]);
      const model = buildRoverModel(handling, connectY, look, { bySlot: true });
      for (const i of picked) expect(model.slots[i]).toBeDefined();
    }
  });
});

describe('Mars parts in the model', () => {
  it('reads the Mars power sources, wheels and support hardware', () => {
    const look = roverLook(['wheels-grouser', 'power-rtg', 'arm-robotic', 'mast-remote'].map(part));
    expect([look.wheels, look.power, look.arm, look.mast]).toEqual(['grouser', 'rtg', true, true]);
    expect(roverLook([part('power-arrays')]).power).toBe('arrays');
    expect(roverLook([part('arm-none'), part('mast-none')])).toMatchObject({ arm: false, mast: false });
  });

  it('a warm rover wears the gold blanket whichever part gives the heat: an RTG with no heater, or the electric heater', () => {
    expect(roverLook([part('power-rtg'), part('heater-none')]).heater).toBe(true);
    expect(roverLook([part('heater-electric')]).heater).toBe(true);
    expect(roverLook([part('power-fixed-panel'), part('heater-none')]).heater).toBe(false);
  });

  it('draws the RTG, the arrays, the arm and the mast, each in its own group', () => {
    const rtg = buildRoverModel(handling, connectY, roverLook([part('power-rtg')]), { bySlot: true });
    expect(Object.keys(rtg.slots).sort()).toEqual<ModelGroup[]>(['heater', 'power']);
    const panel = buildRoverModel(handling, connectY, roverLook([part('power-fixed-panel')]), { bySlot: true });
    const arrays = buildRoverModel(handling, connectY, roverLook([part('power-arrays')]), { bySlot: true });
    const extent = (m: typeof panel) => new THREE.Box3().setFromObject(m.slots.power!).getSize(new THREE.Vector3()).z;
    expect(extent(arrays)).toBeGreaterThan(extent(panel) * 1.5); // the wings reach out beyond the deck
    for (const [id, group] of [['arm-robotic', 'arm'], ['mast-remote', 'mast']] as const) {
      const model = buildRoverModel(handling, connectY, roverLook([part(id)]), { bySlot: true });
      expect(Object.keys(model.slots)).toEqual([group]);
      expect(meshCount(model.slots[group]!)).toBeGreaterThan(0);
    }
    const none = buildRoverModel(handling, connectY, roverLook([part('arm-none'), part('mast-none')]), { bySlot: true });
    expect(none.slots).toEqual({});
  });

  it('draws the four Mars instruments, each in its own group', () => {
    const look = roverLook(['chassis-steel', 'wheels-grouser', 'power-arrays', 'arm-robotic', 'mast-remote',
      'instrument-weather', 'instrument-radar', 'instrument-laser', 'instrument-organics'].map(part));
    expect(look.instruments).toEqual(['weather', 'radar', 'laser', 'organics']);
    const model = buildRoverModel(handling, connectY, look, { bySlot: true });
    expect(model.wheels).toHaveLength(4);
    expect(Object.keys(model.slots).sort()).toEqual<ModelGroup[]>(['arm', 'chassis', 'laser', 'mast', 'organics', 'power', 'radar', 'weather']);
  });

  it('puts the laser on the mast head and the organics head on the arm, or both low without them', () => {
    const bounds = (ids: string[], group: ModelGroup) =>
      new THREE.Box3().setFromObject(buildRoverModel(handling, connectY, roverLook(ids.map(part)), { bySlot: true }).slots[group]!);
    const mast = bounds(['mast-remote'], 'mast');
    const laserOnMast = bounds(['mast-remote', 'instrument-laser'], 'laser');
    const laserOnDeck = bounds(['instrument-laser'], 'laser');
    expect(laserOnMast.getCenter(new THREE.Vector3()).y).toBeGreaterThan(mast.max.y - 0.05); // on top of the head (its cable runs down the back)
    expect(laserOnDeck.max.y).toBeLessThan(mast.min.y + 0.4);
    const organicsOnArm = bounds(['arm-robotic', 'instrument-organics'], 'organics');
    const organicsLow = bounds(['instrument-organics'], 'organics');
    expect(organicsOnArm.min.x).toBeGreaterThan(handling.body.lengthM / 2); // out in front, on the turret
    expect(organicsLow.max.y).toBeLessThan(-handling.body.heightM / 2 + 0.04); // hung under the deck plate
  });
});
