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
      frame: null, wheels: null, power: null, battery: null, lights: false, heater: false, heaterKind: null, arm: false, mast: false, instruments: [],
    });
  });

  it('fills only the chosen slots of a draft build', () => {
    expect(roverLook([part('wheels-mesh'), part('power-solar-mast')])).toEqual({
      frame: null, wheels: 'mesh', power: 'mast', battery: null, lights: false, heater: false, heaterKind: null, arm: false, mast: false, instruments: [],
    });
  });

  it('fills every field for a complete build', () => {
    const look = roverLook(['chassis-steel', 'wheels-solid', 'power-fixed-panel', 'battery-nih2', 'lights-led', 'heater-rhu', 'instrument-drill'].map(part));
    expect(look).toEqual({
      frame: 'steel', wheels: 'solid', power: 'panel', battery: 'cylinders', lights: true, heater: true, heaterKind: 'rhu', arm: false, mast: false, instruments: ['drill'],
    });
  });

  it('lists every instrument in the bay, in bay order', () => {
    expect(roverLook([part('chassis-steel'), part('instrument-drill'), part('instrument-camera')]).instruments).toEqual(['drill', 'camera']);
  });

  it('draws no lights or heater for the "none" options', () => {
    const look = roverLook([part('lights-none'), part('heater-none')]);
    expect(look.lights).toBe(false);
    expect(look.heater).toBe(false);
    expect(look.heaterKind).toBeNull();
  });

  it('tells the three batteries apart', () => {
    expect(['battery-nih2', 'battery-li-ion', 'battery-large'].map((id) => roverLook([part(id)]).battery)).toEqual(['cylinders', 'pack', 'large']);
  });

  it('tells the two heaters apart', () => {
    expect(roverLook([part('heater-rhu')])).toMatchObject({ heater: true, heaterKind: 'rhu' });
    expect(roverLook([part('heater-electric')])).toMatchObject({ heater: true, heaterKind: 'electric' });
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

  it('an RTG rover with no heater part keeps the blanket and draws no heater; with one, it draws that heater too', () => {
    expect(roverLook([part('power-rtg'), part('heater-none')])).toMatchObject({ heater: true, heaterKind: null });
    expect(roverLook([part('power-rtg'), part('heater-rhu')])).toMatchObject({ heater: true, heaterKind: 'rhu' });
    expect(roverLook([part('power-rtg'), part('heater-electric')])).toMatchObject({ heater: true, heaterKind: 'electric' });
    const heaterMeshes = (ids: string[]) => meshCount(buildRoverModel(handling, connectY, roverLook(ids.map(part)), { bySlot: true }).slots.heater!);
    const blanket = heaterMeshes(['power-rtg']);
    expect(heaterMeshes(['power-rtg', 'heater-rhu'])).toBeGreaterThan(blanket);
    expect(heaterMeshes(['power-rtg', 'heater-electric'])).toBeGreaterThan(blanket);
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

  it('mounts the X-ray head on the arm turret beside the organics head, or at the rear without the arm', () => {
    const model = (ids: string[]) => buildRoverModel(handling, connectY, roverLook(ids.map(part)), { bySlot: true });
    const bounds = (obj: THREE.Object3D) => new THREE.Box3().setFromObject(obj);
    const l = handling.body.lengthM;
    // Without the arm: at the back, on its own jointed arm.
    const rear = bounds(model(['instrument-xray']).slots.xray!);
    expect(rear.max.x).toBeLessThan(-l * 0.3);
    // With the arm: out in front, on the turret, and the turret's plain contact sensor gives way to it.
    const all = model(['arm-robotic', 'instrument-xray', 'instrument-organics']);
    const front = bounds(all.slots.xray!);
    expect(front.min.x).toBeGreaterThan(l / 2);
    expect(front.intersectsBox(bounds(all.slots.arm!))).toBe(true);
    const vertices = (obj: THREE.Object3D) => {
      let n = 0;
      obj.traverse((o) => {
        if (o instanceof THREE.Mesh) n += o.geometry.getAttribute('position').count;
      });
      return n;
    };
    expect(vertices(model(['arm-robotic', 'instrument-xray']).slots.arm!)).toBeLessThan(vertices(model(['arm-robotic']).slots.arm!));
    // The two heads (convex gold-blanketed bodies, and the organics context camera) do not overlap:
    // some direction across the turret keeps them at least 1 cm apart.
    const FOIL = 0xd2a243; // COLORS in roverModel.ts
    const CASING = 0xb9bdc3;
    const points = (group: THREE.Object3D, colors: number[]) => {
      const out: THREE.Vector3[] = [];
      group.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || !colors.includes((o.material as THREE.MeshLambertMaterial).color.getHex())) return;
        const pos = o.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i));
      });
      return out;
    };
    const separated = (a: THREE.Vector3[], b: THREE.Vector3[]) => {
      for (let deg = 0; deg < 360; deg++) {
        const d = new THREE.Vector3(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0);
        const aMax = Math.max(...a.map((p) => p.dot(d)));
        const bMin = Math.min(...b.map((p) => p.dot(d)));
        if (bMin - aMax >= 0.01) return true;
      }
      return false;
    };
    const xrayHead = points(all.slots.xray!, [FOIL, CASING]);
    expect(xrayHead.length).toBeGreaterThan(0);
    for (const color of [FOIL, CASING]) {
      const organics = points(all.slots.organics!, [color]);
      expect(organics.length).toBeGreaterThan(0);
      expect(separated(xrayHead, organics)).toBe(true);
    }
  });
});

describe('look-alike parts', () => {
  const group = (ids: string[], g: ModelGroup) => buildRoverModel(handling, connectY, roverLook(ids.map(part)), { bySlot: true }).slots[g]!;
  const bounds = (ids: string[], g: ModelGroup) => new THREE.Box3().setFromObject(group(ids, g));
  /** Each mesh's material color and vertex count: a rough fingerprint of what a group draws. */
  const fingerprint = (obj: THREE.Object3D) => {
    const out: string[] = [];
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh) out.push(`${(o.material as THREE.MeshLambertMaterial).color.getHexString()}:${o.geometry.getAttribute('position').count}`);
    });
    return out.sort().join(',');
  };

  it('draws the larger battery as two taller modules, apart from the lithium-ion pack', () => {
    const pack = bounds(['battery-li-ion'], 'battery');
    const large = bounds(['battery-large'], 'battery');
    expect(fingerprint(group(['battery-large'], 'battery'))).not.toBe(fingerprint(group(['battery-li-ion'], 'battery')));
    expect(large.max.y).toBeGreaterThan(pack.max.y + 0.04);
    expect(large.max.z - large.min.z).toBeGreaterThanOrEqual(pack.max.z - pack.min.z);
  });

  it('draws the two heaters differently, each within the blanket fins (clear of the frame and the wheels)', () => {
    const rhu = group(['heater-rhu'], 'heater');
    const electric = group(['heater-electric'], 'heater');
    expect(fingerprint(rhu)).not.toBe(fingerprint(electric));
    const blanket = bounds(['power-rtg'], 'heater'); // the blanket and fins alone
    for (const id of ['heater-rhu', 'heater-electric']) {
      const b = bounds([id], 'heater');
      expect(b.max.z).toBeLessThanOrEqual(blanket.max.z + 1e-6);
      expect(b.min.z).toBeGreaterThanOrEqual(blanket.min.z - 1e-6);
      expect(b.max.y).toBeLessThanOrEqual(blanket.max.y + 1e-6);
    }
  });
});
