# Titan Build Log

Shared notes for the agents building the Titan mission ([plan](implementation-plan-titan.md)). Read this when you start and before each commit. Add an entry when you make a decision that touches another track, change an interface, or are blocked. Newest at the bottom. Keep each entry to a few lines.

Format: `- **[time] [agent]** what changed or is needed; who it affects.`

## Entries

- **[15:45] main** Plan written. Titan reuses the Moon parts and ticket tiers, and no placeholder Titan parts are added (Owner A decides them). Economy values are placeholders marked `interface`. Spine, pipeline, research and sky start now; rules, campaign and milestones start after the spine lands.
- **[R] research** Wrote research/rover-engineering/09-titan-surface-data.md. Sent the pipeline: dunes run W-E, 1 km mean width (1-2 typical), 3 km mean spacing (1-4), up to 150 m high (game ~100 m); Selk 7.0N 199.0W, 80 km, rim ~200 m high, slope ~3 deg; Dragonfly ellipse 149 x 72 km centered 3.72N 161.8E (~150 km from Selk center, our arithmetic).
- **[R] research** Corrected game-design.md Titan section: dune orientation (W-E, not WSW-ENE), height (up to ~150 m, game ~100 m), Selk 80 km, season and Sun angle added, MMRTG ~100 W and ~2 kW heat (watts unverified), 2010 storm wording. All fact-check markers removed. The noon Sun at the site is ~65 deg up toward the south, not low; dim light comes from haze. Dragonfly launch is NET July 2028, arrival late 2034 (NASA).
- **[16:20] sky (T2)** Titan sky and light landed (worktree-agent-ab79eaab8977e0e86: "Add the Titan sky and light model", "Draw Titan with its haze sky, dim light, fog and rain"). For **Integration (T6)**, `world/moonScene.ts`, nothing new to learn from Mars:
  - `startMoonScene({ ..., sunAt })`: pass T3's Titan Sun function (`(s) => titanSunAt(s, …)`) and use the same one for the sunlight test and photos. Until then the scene uses whatever Sun the data gives (T0's overlay).
  - `scene.setStorm(intensity 0..1)` every frame with T3's rain intensity (eased over ~2 s in the scene). It darkens the scene, hides the Sun, closes the fog to ~250 m at peak and draws rain streaks.
  - Floodlights: `setFloodlights(lightsOn)` as on Mars (Titan lamp from data).
  - Everything else keys off `WORLDS.titan.sky === 'titan'` plus the Sun's elevation. If `tuning.look` is missing, Titan falls back to the Mars model.
- **[16:20] sky (T2)** Data: `data/titan/tuning.json` `look` (type `TitanLookTuning` in `rules/titanTypes.ts`, T2 section). It holds colors (hex), light, eye adaptation, glow, Sun disc, fog (`fog.clearDensity` 3.5e-4/m, so 95% hidden at ~5 km; `fog.rainDensity` 7e-3/m, ~250 m), rain gloom and streaks, ground tint, floodlight, rover-shadow blur and sun-mask bands. **Rendering visibility in rain comes from `look.fog`, not `events.rainstorm.visibilityFactor`**: the renderer ignores that field (T3 may drop it or keep it for notices). Decided in rendering: noon reference 65° (research), light ~85% diffuse (weak, soft rover shadows), day dimmer than a clear Mars noon (test: 35–90%), near-black night with no stars, Earth or Saturn. Ground: the pipeline's grayscale albedo (dunes ~0.55×, interdunes ~1.45× the mean) at contrast 0.75 on `#7a6a58`, with dark sand slightly cooler. Dev hooks as on Mars: `__moon.setSun(az, el)`, `__moon.setStorm(k)`, `__moon.lamp(on)`, `__moon.look()`.
