import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { loadGameData } from '../gameData';
import { cachedThumb, renderPartThumbs, thumbSubject } from './partThumbs';

const mars = loadGameData('mars');
const handling = mars.tuning.rover;
const marsParts = mars.parts.parts;
const NONE = ['lights-none', 'heater-none', 'arm-none', 'mast-none'];

const meshCount = (obj: THREE.Object3D) => {
  let n = 0;
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) n++;
  });
  return n;
};

describe('part thumbnails', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves with no images, without throwing, where there is no DOM', async () => {
    const onThumb = vi.fn();
    const thumbs = await renderPartThumbs(marsParts, handling, { onThumb });
    expect(thumbs.size).toBe(0);
    expect(onThumb).not.toHaveBeenCalled();
    expect(cachedThumb('chassis-steel')).toBeUndefined();
  });

  it('resolves with no images when WebGL cannot start', async () => {
    const canvas = { getContext: () => null, addEventListener: () => {}, removeEventListener: () => {}, style: {} };
    vi.stubGlobal('document', { createElement: () => canvas, createElementNS: () => canvas });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const thumbs = await renderPartThumbs(marsParts.slice(0, 3), handling);
    expect(thumbs.size).toBe(0);
  });

  it('draws every Mars part on its own, except the "none" parts', () => {
    for (const part of marsParts) {
      const subject = thumbSubject(part, handling);
      if (NONE.includes(part.id)) {
        expect(subject, part.id).toBeNull();
        continue;
      }
      expect(subject, part.id).not.toBeNull();
      expect(meshCount(subject!.object), part.id).toBeGreaterThan(0);
      subject!.dispose();
    }
  });

  it('shows the drill tower without the navigation camera it brings to the deck', () => {
    const drill = marsParts.find((p) => p.id === 'instrument-drill')!;
    const subject = thumbSubject(drill, handling)!;
    const box = new THREE.Box3().setFromObject(subject.object);
    // The navigation camera stands well back on the deck; the tower is at the front.
    expect(box.min.x).toBeGreaterThan(0);
    subject.dispose();
  });

  it('shows one floodlight of the pair', () => {
    const lights = marsParts.find((p) => p.id === 'lights-led')!;
    const subject = thumbSubject(lights, handling)!;
    const box = new THREE.Box3().setFromObject(subject.object);
    expect(box.min.z).toBeGreaterThan(0);
    subject.dispose();
  });
});
