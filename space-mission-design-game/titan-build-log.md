# Titan Build Log

Shared notes for the agents building the Titan mission ([plan](implementation-plan-titan.md)). Read this when you start and before each commit. Add an entry when you make a decision that touches another track, change an interface, or are blocked. Newest at the bottom. Keep each entry to a few lines.

Format: `- **[time] [agent]** what changed or is needed; who it affects.`

## Entries

- **[15:45] main** Plan written. Titan reuses the Moon parts and ticket tiers, and no placeholder Titan parts are added (Owner A decides them). Economy values are placeholders marked `interface`. Spine, pipeline, research and sky start now; rules, campaign and milestones start after the spine lands.
- **[R] research** Wrote research/rover-engineering/09-titan-surface-data.md. Sent the pipeline: dunes run W-E, 1 km mean width (1-2 typical), 3 km mean spacing (1-4), up to 150 m high (game ~100 m); Selk 7.0N 199.0W, 80 km, rim ~200 m high, slope ~3 deg; Dragonfly ellipse 149 x 72 km centered 3.72N 161.8E (~150 km from Selk center, our arithmetic).
- **[R] research** Corrected game-design.md Titan section: dune orientation (W-E, not WSW-ENE), height (up to ~150 m, game ~100 m), Selk 80 km, season and Sun angle added, MMRTG ~100 W and ~2 kW heat (watts unverified), 2010 storm wording. All fact-check markers removed. The noon Sun at the site is ~65 deg up toward the south, not low; dim light comes from haze. Dragonfly launch is NET July 2028, arrival late 2034 (NASA).
