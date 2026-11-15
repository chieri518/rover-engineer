# Titan Build Log

Shared notes for the agents building the Titan mission ([plan](implementation-plan-titan.md)). Read this when you start and before each commit. Add an entry when you make a decision that touches another track, change an interface, or are blocked. Newest at the bottom. Keep each entry to a few lines.

Format: `- **[time] [agent]** what changed or is needed; who it affects.`

## Entries

- **[15:45] main** Plan written. Titan reuses the Moon parts and ticket tiers, and no placeholder Titan parts are added (Owner A decides them). Economy values are placeholders marked `interface`. Spine, pipeline, research and sky start now; rules, campaign and milestones start after the spine lands.
- **[15:40] pipeline + spine** Titan `terrain.json` schema agreed (spine freezes it as `TitanTerrainFeatures` in `rules/titanTypes.ts`).
  - Top level: same as Mars. `frame` (aeqd on R = 2574730 m, longitudes east), `sunAndEarth` {`siteLatitude_deg`, `siteLongitude_deg`, note}, `playArea.files` {heightmap, slope, softGround}, `distantTerrain[2]` (near 50 km @ 50 m, far 200 km @ 200 m), `landing`, `horizonFromLanding`, `files_bytes`, `sources`, `credits`. Plus `modeled: true`.
  - Site: the Mars Site shape.
  - `features`:
    - `duneCrests` {description, orientation_deg, zoneRadius_m, lines[{name, crestLocal_xz, height_m, width_m, heightRange_m}], source}
    - `interdunes` {description, corridors[{name, outlineLocal_xz (closed), centerLocal_xz, area_km2}], source}
    - `softGround` {description, maskIsAuthoritative: true, areas[{name, local{x,z}, radius_m}], source}
    - `rockyAreas` ([0] = Selk ejecta field, Site + radius_m + description)
    - `viewpoints` [Site + {kind: 'duneCrest', lookToward, note}]
    - `samplePatch` (Site + radius_m + description)
    - `crossingRoute` {name, description, fromCorridor, crestPoint, toCorridor (Sites), pathLocal_xz, maxSlope_deg, maxSoftness, source}
    - `selk` {name, description, centerLatLon, centerLocal, diameter_km, rimHeight_m, bearingFromLanding_deg, distanceFromLanding_km, source}
    - `notes`
- **[15:50] main + pipeline** Site placement: the play-area center is 85 km from Selk's center (5.162 N, 161.449 E), on the line toward Dragonfly's landing-ellipse center. That is about 30 km north of the ellipse, on Dragonfly's route. The ejecta field at the north edge is real Selk ejecta (its outer fringe). Dunes run W-E (R). Selk's rim is at its true position in the far ring: below the horizon from the landing, the skyline from the Dune sea viewpoint, and the haze decides. Design doc wording: "near Dragonfly's landing region, on its route to Selk".
- **[16:00] pipeline (T1)** Titan terrain landed (worktree-agent-ac0ebb6dee9dc9de9: `d085aa5` scripts, `0330859` outputs), 6.5 MB in `public/terrain/titan/`. It is modeled on Cassini data, seeded and reproducible.
  - Landing: local (-670, -210), mean slope 0.4°.
  - Drive distances (10 m grid, slopes ≤ 18°, mild loose-sand cost): Bright interdune patch 510 m, crossing start 1084 m, Dune 1 saddle 1600 m, Dune sea viewpoint (Dune 2 crest, +111 m) 1803 m, crossing end (north corridor) 2130 m, Selk ejecta field 3449 m.
  - Corridors: "Landing corridor", "North corridor and Selk ejecta" (the north corridor merges with the ejecta plain), "South corridor", and a small "Wedge corridor" in the Y-junction.
  - **For T6/T3:** soft-ground.png is graded and authoritative. Loose sand is 0.85, the saddle at most 0.3. With the Moon's ground tuning, a reference rover is stuck only climbing straight up loose flanks steeper than ~14°. Please sample the PNG on Titan; the 855 circles are only a fallback.
  - Heights are relative to the interdune floor (about -10 to +125 m).
  - Albedo: grayscale, mean 0.222 linear. Relative to the mean: dune 0.51, skirt 0.93, interdune 1.31, ejecta 1.36, sample patch 1.74.
