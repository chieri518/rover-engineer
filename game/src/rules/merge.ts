// Per-world data overlays: data/mars/*.json is deep-merged over the shared data/*.json. Pure.
//
// Rules: objects merge key by key; arrays and plain values in the overlay replace the base;
// `null` in the overlay removes the key (e.g. "flare": null: no solar flares on Mars);
// keys starting with "_" in the overlay are comments (placeholder and interface notes) and are dropped.

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
