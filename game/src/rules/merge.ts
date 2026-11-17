// Per-world data overlays: data/mars/*.json is deep-merged over the shared data/*.json. Pure.
//
// Rules: objects merge key by key; arrays and plain values in the overlay replace the base;
// `null` in the overlay removes the key (e.g. "flare": null: no solar flares on Mars);
// keys starting with "_" in the overlay are comments (placeholder and interface notes) and are dropped.
// Parts are shared, but a world can reword them through text.partText (withPartText), and change
// effects and offer support slots through its parts overlay (withPartsOverlay).
import type { PartsFile, PartsOverlay } from './types';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A new value: base with overlay merged over it. Neither input is changed. */
export function deepMerge<T>(base: T, overlay: unknown): T {
  if (overlay === undefined) return structuredClone(base);
  if (!isObject(overlay)) return structuredClone(overlay) as T;
  const out: Record<string, unknown> = isObject(base) ? structuredClone(base) : {};
  for (const [key, value] of Object.entries(overlay)) {
    if (key.startsWith('_')) continue;
    if (value === null) delete out[key];
    else out[key] = deepMerge(out[key], value);
  }
  return out as T;
}

/** The parts with a world's own names and descriptions (text.partText, by part id) put in. Neither input is changed. */
export function withPartText(parts: PartsFile, partText: Record<string, { name?: string; description?: string }> | undefined): PartsFile {
  if (!partText) return parts;
  return {
    ...parts,
    parts: parts.parts.map((p) => {
      const o = partText[p.id];
      return o ? { ...p, name: o.name ?? p.name, description: o.description ?? p.description } : p;
    }),
  };
}

/**
 * The parts with a world's parts overlay applied (data/mars/parts.json): its support slots, and effects
 * merged into the named parts key by key (the Mars X-ray's `needs`). Neither input is changed.
 */
export function withPartsOverlay(parts: PartsFile, overlay: PartsOverlay | undefined): PartsFile {
  if (!overlay) return parts;
  const effects = overlay.effects ?? {};
  return {
    ...parts,
    ...(overlay.supportSlots ? { supportSlots: [...overlay.supportSlots] } : {}),
    parts: parts.parts.map((p) => {
      const e = effects[p.id];
      return e ? { ...p, effects: deepMerge(p.effects, e) } : p;
    }),
  };
}
