# Titan Build Log

Shared notes for the agents building the Titan mission ([plan](implementation-plan-titan.md)). Read this when you start and before each commit. Add an entry when you make a decision that touches another track, change an interface, or are blocked. Newest at the bottom. Keep each entry to a few lines.

Format: `- **[time] [agent]** what changed or is needed; who it affects.`

## Entries

- **[15:45] main** Plan written. Titan reuses the Moon parts and ticket tiers, and no placeholder Titan parts are added (Owner A decides them). Economy values are placeholders marked `interface`. Spine, pipeline, research and sky start now; rules, campaign and milestones start after the spine lands.
- **[R] research** Wrote research/rover-engineering/09-titan-surface-data.md. Sent the pipeline: dunes run W-E, 1 km mean width (1-2 typical), 3 km mean spacing (1-4), up to 150 m high (game ~100 m); Selk 7.0N 199.0W, 80 km, rim ~200 m high, slope ~3 deg; Dragonfly ellipse 149 x 72 km centered 3.72N 161.8E (~150 km from Selk center, our arithmetic).
- **[R] research** Corrected game-design.md Titan section: dune orientation (W-E, not WSW-ENE), height (up to ~150 m, game ~100 m), Selk 80 km, season and Sun angle added, MMRTG ~100 W and ~2 kW heat (watts unverified), 2010 storm wording. All fact-check markers removed. The noon Sun at the site is ~65 deg up toward the south, not low; dim light comes from haze. Dragonfly launch is NET July 2028, arrival late 2034 (NASA).
- **[16:05] spine + pipeline** Titan `terrain.json` schema agreed (the pipeline's version of the spine's draft). Frozen as `TitanTerrainFeatures` in `game/src/rules/titanTypes.ts`. The top level is the Mars shape: frame (azimuthal equidistant, R = 2574730 m), `sunAndEarth {siteLatitude_deg, siteLongitude_deg, note}`, `playArea.files` {heightmap, slope, softGround = soft-ground.png}, `distantTerrain[2]` (50 km at 50 m, 200 km at 200 m, with Selk's rim), `landing` (Site fields plus source), `horizonFromLanding`, `files_bytes`, `sources`, `credits`, and texture.json for the albedo. Heights are relative to a local datum. A Site has the Mars fields. Features:
  - `duneCrests {description, orientation_deg, zoneRadius_m, source, lines[{name, crestLocal_xz, height_m, width_m}]}`
  - `interdunes {description, corridors[{name, outlineLocal_xz (closed), centerLocal_xz}]}`, required (Dune crossing)
  - `softGround {description, maskIsAuthoritative: true, areas[circles]}`
  - `rockyAreas[]` (Site + radius_m, slopeExcess_deg?, description?): [0] is the Selk ejecta field
  - `viewpoints[Site + {kind: 'duneCrest', lookToward, lookTarget?}]`
  - `samplePatch` (Site + radius_m, description)
  - `crossingRoute {name, description, fromCorridor, crestPoint, toCorridor (Sites), pathLocal_xz, maxSlope_deg, source}`
  - `selk {name, description, centerLatLon, centerLocal, diameter_km, rimHeight_m, bearingFromLanding_deg, distanceFromLanding_km, source}`, a landmark only
  - `notes[]`
  Sand softness is graded. soft-ground.png is authoritative; the circles cover only softness ≥ 0.6, so the existing circle code works. **T3/T6:** sample soft-ground.png on Titan (a sampler next to `TerrainMasks.slopeAt`). Nothing loads soft-ground.png yet.
- **[15:51] spine** T0 landed. Commits: "Add a placeholder Titan terrain and the script that makes it", "Add Titan as a playable world after Mars". World API for every track:
  - **`src/worlds.ts`:** `WorldId = MissionId = 'moon'|'mars'|'titan'`. `WORLDS.titan = {terrainBase: TITAN_TERRAIN_BASE, sky: 'titan', earthInSky: false}`, and `WorldDef.sky` is `'moon'|'mars'|'titan'`.
    - **Integration (T6):** switch `TITAN_TERRAIN_BASE` from `terrain/titan-placeholder/` to `terrain/titan/` (one line). The placeholder comes from `game/scripts/make-titan-placeholder.mjs`.
    - `worldOfStep('complete') = 'titan'`. `?world=titan` is a throwaway debug start on the Titan design screen.
  - **Campaign (`rules/campaign.ts`):** `CampaignStep = MissionId | 'complete'`. `MISSION_ORDER = moon, mars, titan, complete`, and `isPlayable(step)` is `step !== 'complete'`.
    - `finishMission`: a passed Mars round goes to `titan` and takes the Titan restart snapshot. A passed Titan round goes to `complete`, which shows the existing `comingSoon` screen with Titan text (heading "Campaign complete"). **T4** renames or rebuilds that screen.
    - `normalizeCampaign`: an old save at the old `titan` end marker is now the Titan round. A playable round without a snapshot gets one.
    - `budget.minimumBudget`: `titan` = 800 (the Mars pass mark, unchanged). New `complete` = 0 is a placeholder for the Titan final mark, so a Titan round fails only if the balance goes negative. **T4 and Owner A** decide the final mark.
    - `flow.debugStart` uses `MISSION_ORDER`. Tutorials seen are per world, now including `titan` (`save/tutorialSeen.ts`).
  - **Data:** `loadGameData('titan')` is shared data with `data/titan/*.json` deep-merged over it, as on Mars. Parts and tiers are shared (no Titan parts). Titan milestones replace the list. The text overlay merges over the shared (Moon) text, not over Mars.
    - `data/titan/tuning.json`:
      - `mission` {900, gameDays 1, gravity 1.35}
      - `rover.gravityScale` 4.8 (×1.35 = 6.48, the Moon's ground gravity), `airGravityScale` 16
      - `sun`: fallback, the lunar model fixed near noon
      - `cold.zones` []
      - **T3:** `sol` (SolTuning: 1 × 900 s, 450/450, `startSecondsIntoDay` 150, Ls 300), `night` (NightTuning stubs), `sleep.nightClockRate` 4, `titanPower.solarFactor` 0.001, `titanCold {freezeRatePerSecond, awakeHeat, drivingHeat}`
      - **T2:** `look` {} (TitanLookTuning)
      - **T5:** `survey.leads` [{ejecta: rockyAreas.0}], `milestones` {}
    - `data/titan/events.json`: flare and quake are null. **T3:** `rainstorm` (RainstormSpec: windows [[240,600]], warning 60, duration 60, ramp 10, freezeFactor 1.5, visibilityFactor 0.3, blocksPhotos).
    - `data/titan/milestones.json`: the 11 design milestones with ids `titan-touchdown`, `titan-odometer`, `titan-mapper`, `dune-crossing`, `titan-night-drive`, `titan-dawn`, `titan-storm-survivor`, `dune-sea`, `organic-sands`, `crater-ejecta`, `titan-clean-run`. Facts are placeholders.
      - Triggers not built yet: `dune-crossing` and `dawn` (TitanMilestoneTrigger), `night-distance` and `storm-survive` (Mars), photo zone `dune-crest-viewpoint`, drill zone `ejecta-field`.
      - TitanZoneId is `dune-crest|dune-crest-viewpoint|interdune-sample|ejecta-field`. **T5** owns all of this.
    - `data/titan/text.json`: minimal Titan wording. It covers landing, ticket, mission, hud, warnings, debrief (`continue` "Finish the campaign"), comingSoon, a one-page tutorial each, credits fallbacks, survey, instruments, `partText` (solar "almost no power"), and `campaign` (MarsCampaignText shape: kicker "Mission 3 · Titan, Shangri-La dunes"; the lines are in `newOnMars`).
      - It also adds Titan sections `day`, `rain`, `cold` (**T6**) and `titanCampaign` (**T4**), marked `[placeholder]`.
      - Shared text: `worlds.titan` is "Titan: Shangri-La dunes". Mars `debrief.continue` is "Continue to Titan".
  - **Types (`rules/titanTypes.ts`):** one section per track: terrain features (T1), `TitanSleepTuning`, `TitanPowerTuning`, `TitanColdTuning`, `RainstormSpec` (T3), `TitanMilestoneTrigger`, `TitanZoneId`, `TitanMilestoneTuning` (T5), `TitanLookTuning` (T2), `TitanTextSections`, `TitanCampaignText` (T4, T6).
    - In `types.ts`: `Tuning` gains optional `sleep`, `titanPower`, `titanCold`, `look`; `EventsFile.rainstorm?`; `TextFile` also includes `Partial<TitanTextSections>`; `MilestoneTrigger` includes the Titan triggers. `validate.ts` checks the rainstorm windows. Tracks own their sections from here.
  - **Code:** `moonScene.ts` draws every non-Moon sky with the Mars look (`sky !== 'moon'`), so Titan shows the Mars look until **T2** wires `sky === 'titan'`. `missionScreen.ts` is unchanged: `MarsMission` runs only for `sky === 'mars'`, so the Titan mission currently plays with Moon systems (lunar Sun at noon, no cold zones, no night). **T6** adds `ui/titanMission.ts`.
- **[15:51] spine** Browser check (headless): `?world=titan` requests only `terrain/titan-placeholder/` files, drives, and has no console errors. Mars requests only `terrain/mars/` and the Moon only `terrain/`; both drive. Mars pass → "Continue to Titan" → Titan design screen. Titan pass → "Finish the campaign" → "Campaign complete". An old save at mission `titan` → Continue → Titan design screen.
  - Placeholder terrain: 4 dunes about 60 m high, 2.4 km apart, at 77°; 3 corridors; 89 soft circles. Landing (250, −60). Sample patch 0.66 km E. Crossing saddle 1.2 km N (max 4°). Dune crest viewpoint 1.4 km S. Selk ejecta field (−1799, 2878), 3.6 km SW. Selk is 90 km NE (placeholder positions).
- **[16:20] sky (T2)** Titan sky and light landed (worktree-agent-ab79eaab8977e0e86: "Add the Titan sky and light model", "Draw Titan with its haze sky, dim light, fog and rain"). For **Integration (T6)**, `world/moonScene.ts`, nothing new to learn from Mars:
  - `startMoonScene({ ..., sunAt })`: pass T3's Titan Sun function (`(s) => titanSunAt(s, …)`) and use the same one for the sunlight test and photos. Until then the scene uses whatever Sun the data gives (T0's overlay).
  - `scene.setStorm(intensity 0..1)` every frame with T3's rain intensity (eased over ~2 s in the scene). It darkens the scene, hides the Sun, closes the fog to ~250 m at peak and draws rain streaks.
  - Floodlights: `setFloodlights(lightsOn)` as on Mars (Titan lamp from data).
  - Everything else keys off `WORLDS.titan.sky === 'titan'` plus the Sun's elevation. If `tuning.look` is missing, Titan falls back to the Mars model.
- **[16:20] sky (T2)** Data: `data/titan/tuning.json` `look` (type `TitanLookTuning` in `rules/titanTypes.ts`, T2 section). It holds colors (hex), light, eye adaptation, glow, Sun disc, fog (`fog.clearDensity` 3.5e-4/m, so 95% hidden at ~5 km; `fog.rainDensity` 7e-3/m, ~250 m), rain gloom and streaks, ground tint, floodlight, rover-shadow blur and sun-mask bands. **Rendering visibility in rain comes from `look.fog`, not `events.rainstorm.visibilityFactor`**: the renderer ignores that field (T3 may drop it or keep it for notices). Decided in rendering: noon reference 65° (research), light ~85% diffuse (weak, soft rover shadows), day dimmer than a clear Mars noon (test: 35–90%), near-black night with no stars, Earth or Saturn. Ground: the pipeline's grayscale albedo (dunes ~0.55×, interdunes ~1.45× the mean) at contrast 0.75 on `#7a6a58`, with dark sand slightly cooler. Dev hooks as on Mars: `__moon.setSun(az, el)`, `__moon.setStorm(k)`, `__moon.lamp(on)`, `__moon.look()`.
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
- **[16:10] pipeline (T1)** Titan sites moved closer for the battery-only budget (T3: about 1.55 km per mission for a big-battery build). Commit `84c4f48` (on top of chieri/titan fcc19e7). **The landing and every site position changed**; the schema is unchanged.
  - Geography: the placement is still honest. Dune 1 is now the last, smaller dune before Selk's ejecta (about 50 m high, 0.75 km wide) and bends about 11° to run along the ejecta edge. The landing sits in the corridor just south of it.
  - Landing: local (-1280, -1050), 5.1854 N 161.4208 E, mean slope 0.5°.
  - Drive distances: crossing start 148 m, Bright interdune patch 510 m, Dune 1 saddle 558 m, crossing end 958 m, Dune sea viewpoint 982 m, Selk ejecta field 1258 m.
  - The Dune sea viewpoint is now on Dune 1's crest (56 m up, 2 m from the crest line), looking south over the field. The Selk ejecta field (still `rockyAreas[0]`) has radius 200 m.
  - Crossing start and end are at least 70 m inside their corridor masks and are checked to be ≥ 30 m inside the outlines (T5): 75 m and 94 m.
  - The crossing route reaches 6.9° and softness 0.23 at most; the viewpoint route's slip is at most 0.16.
  - Albedo mean is now 0.214. Relative to the mean: dune 0.53, interdune 1.27, ejecta 1.41, patch 1.79.
