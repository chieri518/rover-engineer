# Implementation Plan: Titan Mission (demo build)

How we build the first playable Titan mission for the demo on November 15, 2026. What Titan does is defined in [game design → The Titan mission](game-design.md#the-titan-mission); this doc covers how we build it, in what order, and how the work is split between agents. Branch: `chieri/titan` (from `chieri/mars`). Written November 15, 2026 by Owner B. Target: playable and verified by 19:30.

Quick navigation: [Scope](#scope) · [Architecture](#architecture) · [Phases](#phases) · [Agents](#agents-and-coordination) · [Timeline](#timeline) · [Cut order](#if-time-runs-short) · [Risks](#risks)

## Scope

**In the demo build**

- The campaign continues after Mars: Mars debrief → "Continue to Titan" → Titan design screen (balance carried over) → ticket → landing briefing → 15-minute Titan mission → debrief with the Dragonfly reveal → **Campaign complete** (replaces "Titan: coming soon").
- Terrain modeled on Cassini data: an 8 km × 8 km play area at 5 m in the Shangri-La dunes (linear dunes, soft dark sand, firm bright interdune corridors), Selk crater's rim on the horizon, a generated ground texture. Credits say "modeled on".
- One Titan day: 450 s of day, 450 s of night, mission starts 150 s after sunrise and ends 150 s after the next dawn. Real Sun path for the site's latitude and season.
- Titan sky and light: dim, soft, hazy orange-brown, short visibility, faint Sun, near-black night, floodlights.
- Power: Titan solar factor near zero (battery-only with the Moon parts); a constant-power part effect is supported in the rules but **no part uses it** (Owner A).
- Night: the Mars rules (lights on, awake, sleep); **sleep fast-forwards the clock 4× at night**.
- Cold: always on; heater and the rover's own electronics (awake, more when driving) slow freezing; asleep only the heater does.
- One methane rainstorm: forecast 60 s ahead, about 60 s long, visibility down, photos blocked, faster cooling.
- Titan milestones: Touchdown, Odometer, Mapper, Dune crossing, Night drive, Dawn, Storm survivor, Dune sea (camera), Organic sands sample (drill), Crater ejecta (drill), Clean run.
- Titan text: tutorials, briefing, milestone facts (fact-checked), debrief comparison with Dragonfly, credits.

**Not in the demo build**

- **Any Titan part or ticket tier** (waits for Owner A; Titan reuses the Moon parts and tiers, and no placeholder parts are added).
- Communications delay, flight or a vehicle choice, methane lakes, cryovolcanoes.
- A Titan `winPaths` model (a battery-only check test stands in, like `marsNight.test.ts`).
- Titan money, RP and the final mark are placeholders marked `interface`, as on Mars.

## Architecture

The world spine from Mars already exists (`src/worlds.ts`, `data/<world>/` overlays deep-merged by `rules/merge.ts`, per-world terrain base, `rules/marsTypes.ts`). Titan reuses it; the changes:

| Piece | Change |
| --- | --- |
| Worlds | `MissionId` gains `'titan'`; `WORLDS.titan` with `terrainBase: 'terrain/titan/'` (placeholder first), `sky: 'titan'`, `earthInSky: false`. |
| Campaign | `MISSION_ORDER` becomes `moon → mars → titan → <end marker>`; the end marker (for example `'complete'`) shows "Campaign complete". `worldOfStep(end)` = titan. Old saves at the `'titan'` end marker move to the Titan design screen (`normalizeCampaign`). |
| Data | `game/data/titan/`: `tuning.json`, `events.json`, `milestones.json`, `text.json`, all keys present with placeholders marked `_placeholder` / `_interface`. Parts and tiers stay shared. |
| Types | Titan-only types in `rules/titanTypes.ts`, one section per owning track. Mars and Moon-only fields stay optional. Events allow `rainstorm`. |
| Time | Prefer reusing the sol clock (`rules/sol.ts`) with 1 sol of 900 s (450 day, 450 night, start 150 s in) if it generalizes cleanly; the rules track decides. |
| Terrain | `game/public/terrain/titan/` from the pipeline, same file names and `terrain.json` shape as Mars (heightmap, slope, soft-ground, albedo, distant rings), Titan features. Placeholder at `terrain/titan-placeholder/` until it lands. |

Moon and Mars must play exactly as before. All existing tests stay green; Titan gets its own tests.

## Phases

### T0: Spine · now, one agent (main checkout)

Everything in the architecture table except the pipeline output: worlds, campaign end marker, data stubs, `titanTypes.ts`, a placeholder Titan terrain in the final format (agree the `terrain.json` features schema with the pipeline agent first), Titan gravity (1.35 m/s²) and `gravityScale`, `?world=titan` debug start. Leaves the sky as the Mars model until T2 lands.

**Done when:** `?world=titan` loads the placeholder and drives; Mars → Continue → Titan design screen; Moon and Mars unchanged; `npm test` and `npm run build` pass. Post the world API to the build log.

### T1: Titan terrain pipeline · now, parallel (worktree)

New `tools/build_terrain_titan.py` and `tools/build_texture_titan.py` (Moon and Mars scripts untouched). Procedural, seeded and reproducible, parameterized from published Shangri-La dune measurements (from the research track) with every parameter cited. Output: heightmap, slope, soft-ground mask (dune sand), albedo (dark dunes, bright interdunes), distant rings with Selk's rim, `terrain.json`, `texture.json` with sources and credits ("modeled on"). Features: landing on a firm interdune corridor, dune crest lines, a dune-crest viewpoint (Dune sea), a crossing route, an interdune sample patch, a Selk ejecta field (rocky area) near the map edge, and drive distances to each.

**Done when:** `public/terrain/titan/` holds the files and the drive distances are reported.

### R: Titan research and fact-check · now, parallel

New `research/rover-engineering/09-titan-surface-data.md`: dune dimensions and orientation, Selk position and size, Dragonfly landing region and power and thermal design, surface light level and sky color, temperature, gravity, atmosphere, the season at the site in 2034, methane storms (Cassini 2010), Huygens surface. Every fact cited. Sends dune and Selk numbers to the pipeline agent as soon as they are found; then fact-checks every `(to fact-check)` item in `game-design.md` and the facts T4 and T5 write into `data/titan/*.json`.

### T2: Titan sky and light · now (new files), wired after T0

`world/` rendering only: `titanSky.ts`, `titanLook.ts` (+ tests, like `marsSky.ts` and `marsLook.ts`): hazy orange-brown sky by Sun elevation, soft dim light with weak shadows, distance fog, near-black night, faint Sun disc, no Earth or Saturn, rain haze (`setStorm`-like intensity). Kept readable for the demo. Wiring into the scene (`sky: 'titan'`) after T0 lands.

### T3: Titan rules · after T0, parallel

Pure `rules/` with unit tests: the one-day clock and real Titan Sun; the Titan solar factor; a constant-power part effect (no part uses it); always-on cold with heater, awake and driving heat, sleep cools; the sleep fast-forward rule (clock rate while asleep at night); the methane rainstorm (schedule, forecast, intensity, effects; generalize `storm.ts` if clean); a battery-only check test (`titanEnergy.test.ts`): big battery + sleep survives, small battery driving with lights all night runs out, no heater freezes.

### T4: Campaign, flow and screens · after T0, parallel

Mars debrief → "Continue to Titan"; Titan design and ticket notes (Moon parts, "solar: almost no power"); Titan tutorials; landing briefing; Titan debrief with the Dragonfly comparison; **Campaign complete** screen replacing coming soon; Titan restart snapshot; save normalization; credits; all text in `data/titan/text.json`.

### T5: Titan milestones and survey · after T0, parallel

`data/titan/milestones.json` and the rules they need (dune crossing, dawn, storm survivor for the rainstorm, Dune sea photo from a crest, staged organic samples, Crater ejecta first drill), survey leads, minimap drawing of dunes and the ejecta field. Facts sourced; R fact-checks them.

### T6: Integration · after T2 to T5, one agent

`ui/missionScreen.ts`, `ui/hud.ts` and a `ui/titanMission.ts` (like `marsMission.ts`): wire the clock, sleep fast-forward, cold, rainstorm and forecast, Titan zones and milestones, the real terrain. Tune `gravityScale` and visibility on the real terrain.

### T7: Verification · last, Sonnet

Headless-browser runs: Moon → Mars → Titan campaign; a big-battery Titan build that sleeps survives to dawn; lights all night with a small battery runs out; no heater freezes; the rainstorm arrives with its forecast; milestones fire; the campaign complete screen shows; Moon and Mars unchanged. Screenshot sweep of morning, dusk, night with lights, rain, dawn. Results summarized, not pasted. Then **T8**, a fix agent for what T7 finds.

## Agents and coordination

| Agent | Phase | Starts | Model, effort | Checkout |
| --- | --- | --- | --- | --- |
| Spine | T0 | Now | Opus, high | main |
| Pipeline | T1 | Now | Opus, high | worktree |
| Research | R | Now | Sonnet, default | main (research doc only) |
| Sky and light | T2 | Now | Opus, high | worktree |
| Rules | T3 | After T0 | Opus, high | worktree |
| Campaign and screens | T4 | After T0 | Opus, high | worktree |
| Milestones and survey | T5 | After T0 | Opus, high | worktree |
| Integration | T6 | After T2 to T5 | Opus, high | main |
| Verification | T7 | Last | Sonnet, default | main |
| Fixes | T8 | After T7 | Sonnet, default | main |

- **Clean context.** Each agent gets this plan, the design doc and its phase, not other agents' reasoning. Agents may start their own subagents for verification runs, research and fact-checking (and pass on the model and effort rules: Opus high for implementation, Sonnet or Haiku default for routine work and lookups), keeping results to a short summary.
- **Staying in sync.** Decisions that touch another track and interface changes go to [titan-build-log.md](titan-build-log.md); message the affected agent directly (the main session sends a roster of agent names). Read the log at start and before each commit. Worktree agents commit their log entries in their worktree copy; the main session merges them as a union.
- **Files.** Shared files (`types.ts`, `testData.ts`, `worlds.ts`, `campaign.ts`, shared `data/*.json`) are changed only by the spine agent; later tracks add new files or edit their own section of `data/titan/*.json` and `titanTypes.ts`. The main session merges each worktree into `chieri/titan`.
- **Pushback.** Agents report design gaps instead of guessing. Small gaps: decide, log in `game-design.md`, report. Anything that changes gameplay or a decided item goes to the main session.
- **Commits.** Small commits with short plain messages on `chieri/titan`; `npm test` and `npm run build` pass before each. Local only, not pushed. Browser-test agents delete their temporary Chrome profiles.

## Timeline

| Time | Work |
| --- | --- |
| 15:45 to 16:30 | T0 spine, T1 pipeline, R research, T2 sky (new files) |
| 16:30 to 17:45 | T3 rules, T4 campaign, T5 milestones in parallel; T2 wired; T1 lands |
| 17:45 to 18:30 | T6 integration |
| 18:30 to 19:30 | T7 verification, T8 fixes |

## If time runs short

Cut in this order, keeping the Mars → Titan → Campaign complete loop intact:

1. Rain visuals (keep the storm's effect on cold and photos).
2. Distant terrain beyond the play area (fog line instead; Titan's haze hides it anyway).
3. Dune sea, Dune crossing and Storm survivor milestones.
4. The real Titan Sun path (a simple rise-and-set arc).
5. The methane rainstorm.
6. Sleep fast-forward.

Never cut: the dune terrain modeled on Cassini data, battery-only power, always-on cold with "sleep cools", the long night with lights or sleep, the Dragonfly debrief, and the campaign moving from Mars to Titan to Campaign complete.

## Risks

| Risk | Mitigation |
| --- | --- |
| Battery-only with Moon parts is too hard or too easy | Titan drains and freeze rates are tuned against the Moon batteries (400, 600) by `titanEnergy.test.ts`; numbers marked placeholders |
| Dim Titan light reads as a broken render in the demo | Keep readability over realism; screenshot sweep in T7 |
| Shared files edited by several agents | Spine owns them; new files per track; worktrees merged by the main session |
| Mars or Moon regressions from the end-marker change | All existing tests stay; T7 replays the full campaign |
| The 4× sleep clock interacts with physics and events | Clock rate only changes while asleep at night (rover parked); T3 tests, T6 wires |
| Procedural terrain looks fake | Parameters from published measurements; credits say "modeled on" |
