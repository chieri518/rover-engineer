# Implementation Plan: Mars Mission (demo build)

How we build the first playable Mars mission, for the demo on November 15, 2026. What Mars does is defined in [game design → The Mars mission](game-design.md#the-mars-mission). This doc covers how we build it, in what order, and how the work is split between agents. Branch: `chieri/mars`. Written November 15, 2026 by Owner B.

Quick navigation: [Scope](#scope) · [Architecture](#architecture-the-world-spine) · [Phases](#phases) · [Agents and coordination](#agents-and-coordination) · [Cut order](#if-time-runs-short) · [Risks](#risks)

## Scope

**In the demo build**

- The campaign continues after the Moon: Moon debrief → Mars design screen (balance carried over) → ticket → landing → 10-minute Mars mission → debrief → "Titan: coming soon".
- Real Jezero crater terrain from the USGS Mars 2020 HiRISE 1 m elevation model: 8 km × 8 km play area at 5 m, distant terrain out to the crater rim, HiRISE ground texture.
- 10 sols of 60 s (45 s day, 15 s night), with a real Sun path for Jezero's latitude and the chosen season (Ls about 200).
- Mars sky and light: butterscotch daytime sky, blue sunset, dark sky with stars at night, no Earth in view.
- Night: lights on (battery drain, no solar), sleep (the existing P power-down, slow drain, wakes at dawn), and no driving at night without lights.
- Cold: the freeze meter rises everywhere at night, slowed by the heater; milder during the storm.
- One dust storm per mission: forecast a sol ahead, solar income about a third for about 2 sols, haze visuals.
- Mars milestones: Touchdown, Odometer, Night drive, Storm survivor, Delta layers (camera), Lake sediment sample (drill, up to three sites), Blue sunset (camera). Mapper reused if free.
- Mars survey leads, fog, and site discovery (reuse of the Moon minimap).
- Mars text: briefing, landing survey, milestone pop-ups with fact-checked facts, debrief, credits for the Mars datasets.

**Not in the demo build**

- Dust settling on the panels and dust devils, the marsquake, Sand crossing, Signs of an ancient lake, Dust devil photo. Next after the demo.
- Communications as a resource (decided, designed later).
- **Owner A's area:** Mars part catalog, unlock tree, Mars ticket tiers, Mars economy. The demo **reuses the Moon parts and ticket tiers**. Mars money and RP rewards, the Titan pass mark and the Mars survival payout are placeholders marked `interface` in the data, for Owner A to set.
- A Mars balance model like `winPaths` (a smaller night-energy check stands in; see Phase M3).

## Architecture: the world spine

Today the code knows one world. `MissionId = 'moon' | 'mars'` exists, but every data file is one global object, every terrain path is hard-coded to `terrain/`, and `finishMission` never moves the campaign to the next mission. The spine adds a world concept with the smallest change that keeps the Moon untouched:

| Piece | Change |
| --- | --- |
| World registry | `src/worlds.ts`: per world, its terrain base (`terrain/` or `terrain/mars/`), sky model, and presentation (photometry, colors, gravity). `MissionId` stays the world id. |
| Data | Shared files stay where they are. Mars-only data goes in `game/data/mars/`: `tuning.json` (deep-merged over the shared tuning: `mission`, `sun`, `cold`, `survey`, `milestones`, `explore`, `minimap`, Mars `night` and `dust` sections), `events.json`, `milestones.json`, `text.json` (overlay). `loadGameData(world)` returns the same `GameData` shape. |
| Types | Mars types in new files (`rules/marsTypes.ts` or similar), so parallel tracks do not all edit `types.ts`. Moon-only feature fields become optional so Mars features are additive. Events allow `duststorm`; flares and quakes become optional per world. |
| Terrain loading | `loadTerrain`, `loadTerrainMasks`, `loadAlbedo` and the credits screen take the world's terrain base; caches keyed by world. |
| Campaign | `finishMission` advances to `nextMission`; `MISSION_ORDER` gains a `titan` end marker that shows "Titan: coming soon". A Mars restart restores the Mars round snapshot. |
| Pipeline output | `game/public/terrain/mars/` with the same file names and `terrain.json` shape as the Moon, plus Mars features (`deltaFront`, `seitah`, `rockyAreas`, viewpoints, `softGround`). Raw downloads in `game/tools/raw/mars/` (git-ignored). |

The Moon must play exactly as before. The existing 20 test files stay green; Mars gets its own tests.

## Phases

### Phase M0: World spine · first, one agent

Everything in the table above except the pipeline. Also: stub Mars data files with every key present (placeholder values marked as such), a placeholder Mars terrain (a flat or procedural tile in the final format) so the rendering and integration tracks can run before the real terrain lands, and the shared Mars types each track will code against.

**Done when:** a debug start (`?world=mars` or a campaign that has finished the Moon) loads the placeholder Mars world and drives on it; the Moon is unchanged; `npm test` and `npm run build` pass.

### Phase M1: Jezero terrain pipeline · starts now, in parallel with M0

New scripts `tools/build_terrain_mars.py` and `tools/build_texture_mars.py`; the Moon scripts are not touched (shared helpers may be copied).

- Read only the needed window of the 1.8 GB HiRISE DTM (rasterio over `/vsicurl/` or HTTP range reads; download in full only if that fails). 8 km × 8 km at 5 m around the landing point; heightmap, slope.
- Distant terrain: the rest of the HiRISE model, then the CTX 20 m model and MOLA, to the crater rim.
- Ground texture from the HiRISE 25 cm orthomosaic, resampled to 5 m; grayscale is fine (the shader tints it).
- Landing point: flat and within reach of the delta front and Séítah, near 18.4447°N, 77.4508°E, not on Perseverance's spot.
- Features from the real terrain: the delta front (with a viewpoint facing its layers), Séítah outline and its sand-ripple soft ground, two rocky areas, a western viewpoint for sunsets. Real feature positions come from published maps; every coordinate gets a cited source.
- `terrain.json` and `texture.json` in the Moon shape, with sources and credits; drive distances from the landing to each site.

**Done when:** `public/terrain/mars/` holds the files, and the distances to the delta front and Séítah are reported.

### Phase M2: Mars sky and light · after M0, parallel

`world/` rendering only: sky color by Sun elevation (butterscotch day, blue around the setting Sun, dark with stars at night), Mars ground photometry and color in place of the lunar model, light and ambient intensity following Sun elevation, a faster sun-mask refresh (the Sun moves about 4°/s), floodlights at night (already wired), dust storm haze. No Earth.

### Phase M3: Mars rules · after M0, parallel

Pure `rules/` with unit tests:

- The sol clock: 60 s sols, 45 s day and 15 s night, mapped to real local solar time; sol number for the HUD.
- The real Sun azimuth and elevation at Jezero for Ls about 200 (hour angle and solar declination), behind the existing `SkyDirection` interface.
- Night energy: lights-on drain, sleep drain, no solar at night.
- No driving at night without lights.
- Night-wide freezing, heater, slower during the storm.
- The dust storm: forecast time, start, duration, solar factor, milder nights.
- A night-energy check: a test that the default sensible builds survive 10 sols when the player sleeps, and that lights-on all night drains a small battery. This stands in for a full Mars `winPaths`.

### Phase M4: Campaign, flow and screens · after M0, parallel

Moon debrief → Mars design screen, Mars ticket and landing briefing, Mars debrief → "Titan: coming soon"; Mars restart snapshot; save format; Mars tutorial page for the night choice; all Mars text in `data/mars/text.json`; Mars dataset credits.

### Phase M5: Mars milestones and survey · after M0, parallel

Mars milestone triggers in `data/mars/milestones.json` and the rules they need (night drive distance, storm survivor, sunset photo by Sun elevation and camera heading, delta layers zone, staged samples), Mars survey leads, minimap sized for Mars. Every history fact sourced and fact-checked.

### Phase M6: Integration · after M2 to M5, one agent

`ui/missionScreen.ts` and `ui/hud.ts`: wire the sol clock, night choice notice, sleep, storm forecast and HUD state, Mars zones, and the real Jezero terrain once M1 lands. Swap the placeholder terrain for the real one.

### Phase M7: Verification · last

Headless-browser runs of the whole campaign, Moon to Mars: a sensible Mars build that sleeps at night survives; one that drives all night runs out; no-heater freezes the first night; the storm arrives with its forecast; milestones fire; the Moon still plays as before. Screenshot sweep of day, sunset, night, storm. Results summarized, not pasted.

## Agents and coordination

| Agent | Phase | Starts | Model, effort |
| --- | --- | --- | --- |
| Pipeline | M1 | Now | Opus, high |
| Spine | M0 | Now | Opus, high |
| Sky and light | M2 | After M0 | Opus, high |
| Rules | M3 | After M0 | Opus, high |
| Campaign and screens | M4 | After M0 | Opus, high |
| Milestones and survey | M5 | After M0 | Opus, high |
| Integration | M6 | After M2 to M5 | Opus, high |
| Verification | M7 | Last | Sonnet, default |

- **Clean context.** Each agent gets this plan, the design doc, and its own phase, not the other agents' reasoning, so it can judge the design with fresh eyes. Agents may start their own subagents for verification runs, research, and fact-checking, and keep the results to a short summary.
- **Staying in sync.** Agents post decisions that touch another track, and interface changes, to [mars-build-log.md](mars-build-log.md), and message the affected agent directly. Each agent reads the log when it starts and before each commit.
- **Files.** Each parallel agent works in its own git worktree, on files its phase owns. Shared files (`types.ts`, `testData.ts`, `text.json`, `tuning.json`) are changed only by the spine agent; later tracks add new files or edit their own section of `data/mars/*.json`. The main session merges each worktree into `chieri/mars`.
- **Pushback.** Agents report design gaps instead of guessing. Small gaps: decide, log in `game-design.md`, report. Anything that changes gameplay or a decided item goes to the main session, which asks Owner B when it cannot answer.
- **Commits.** Small commits with short plain messages on `chieri/mars`; `npm test` and `npm run build` pass before each. Local only, not pushed, until Owner B says so.

## If time runs short

Cut in this order, keeping the Moon → Mars loop intact:

1. Dust storm haze visuals (keep the storm's effect on power).
2. Distant terrain beyond the HiRISE model (use a fog line).
3. Storm survivor and Blue sunset milestones.
4. The real Sun path (use a simple rise-and-set arc).
5. The dust storm.

Never cut: real Jezero terrain, day and night with the lights-on or sleep choice, night cold, and the campaign moving from the Moon to Mars.

## Risks

| Risk | Mitigation |
| --- | --- |
| 1.8 GB DTM download, disk space | Windowed remote reads; download in full only if needed. Delete raw files the game does not use. Delete temporary Chrome profiles after browser tests. |
| Shared files edited by several agents | One owner (spine) for shared files; new files per track; worktrees merged by the main session |
| The sun mask lags a fast Sun | Faster refresh for Mars; at 15 s nights the Sun moves about 4°/s |
| Gravity scale is written relative to lunar gravity | The spine makes it per world |
| Moon regressions | All existing tests stay; the verification run replays the Moon |
| Placeholder Mars economy | Clearly marked `interface`; Owner A sets it |
