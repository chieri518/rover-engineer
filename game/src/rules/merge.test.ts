import { describe, expect, it } from 'vitest';
import { deepMerge } from './merge';

describe('deepMerge (world data overlays)', () => {
  const base = { a: 1, nested: { x: 1, y: 2, deep: { k: 'base' } }, list: [1, 2, 3], gone: { v: 1 } };

  it('merges objects key by key and replaces values and arrays', () => {
    const out = deepMerge(base, { a: 2, nested: { y: 5, deep: { k: 'over' } }, list: [9] });
    expect(out).toEqual({ a: 2, nested: { x: 1, y: 5, deep: { k: 'over' } }, list: [9], gone: { v: 1 } });
  });

  it('null removes a key; _ keys are notes and are dropped, also in new nested objects', () => {
    const out = deepMerge(base, { gone: null, _note: 'x', nested: { _placeholder: 'y' }, added: { b: 1, _c: 2 } });
    expect(out).toEqual({ a: 1, nested: base.nested, list: [1, 2, 3], added: { b: 1 } });
  });

  it('does not change its inputs', () => {
    const overlay = { nested: { y: 7 } };
    const copy = structuredClone(base);
    const out = deepMerge(base, overlay);
    out.nested.x = 99;
    expect(base).toEqual(copy);
    expect(overlay).toEqual({ nested: { y: 7 } });
  });

  it('no overlay returns an equal copy', () => {
    expect(deepMerge(base, undefined)).toEqual(base);
    expect(deepMerge(base, {})).toEqual(base);
  });
});
