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
