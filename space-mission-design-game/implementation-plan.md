# Implementation Plan: First Version

How we build the first playable version of **Rover Engineer**: the Moon mission with the full campaign loop. Written for our two-person team. What the game does is defined in [game design](game-design.md); this doc covers how we build it and in what order.

Written November 14, 2026. **Submission closes November 15 at 11:59 pm** (local event time; see the [event guide](../space-apps-2026-event-guide.md#2026-focus-and-key-dates)). Every phase below is marked with whether it must be in the submitted build.

Quick navigation: [Scope](#scope) · [Architecture](#architecture) · [Data files](#data-files-the-contract) · [Phases](#phases) · [Cut order](#if-time-runs-short) · [Risks](#risks) · [Working with AI](#working-with-ai-on-this-codebase)

## Scope

**In the first version**

- Title screen, design screen, launch ticket, landing, the 5-minute Moon mission, debrief.
- Seven part slots with two options each, mass and size, three ticket tiers.
- Real de Gerlache rim terrain, about 8 km × 8 km, plus distant terrain on the horizon.
- Low Sun circling the horizon, moving shadows, a cold shadowed crater.
- Energy, damage, freezing, getting stuck. Solar flares and moonquakes.
- The 13 Moon milestones, the photo album, money and RP payout, death penalties.
- Campaign save with the restart snapshot (balance, RP, records).
- Simple minimap. "Mission history" setting (on by default). Tutorial text. Data credits screen.

**Not in the first version**

- Mars and Titan. The campaign ends after the Moon with a "Mars: coming soon" screen that shows the RP the player has banked.
- The unlock tree and orbital map layers (they start on Mars).
- Two-player mode, sound design beyond basic effects, mobile controls.

## Architecture

| Part | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript | *Our recommendation.* Types catch mistakes in AI-written code early and make the data files self-describing. |
| Rendering | Three.js | Decided in the design doc |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | Heightfield collider for terrain; ray-cast vehicle controller for the rover |
| Build | Vite | Static build, deployable anywhere |
| UI | Plain HTML and CSS over the canvas | Design screen, HUD, debrief |
| Tests | Vitest | For the game rules only (energy, mass, tiers, payout), not rendering |
| Data pipeline | Python with `rasterio` and `numpy` | Offline only. The game never calls a live API. |
| Hosting | Any static host (GitHub Pages, Vercel, Netlify) | Judges play from a link |

### Code layout

```
game/
├── src/
│   ├── main.ts            Entry point
│   ├── flow/              Screen flow: title → design → ticket → landing → mission → debrief
│   ├── rules/             Pure game rules, no Three.js: energy, mass, size, tiers, damage,
│   │                      cold, payout, milestones, campaign state. Unit-tested.
│   ├── world/             Terrain chunks, distant terrain, Sun and shadows, sky, cold zones
│   ├── rover/             Rapier vehicle, part effects on handling, camera
│   ├── events/            Solar flare, moonquake
│   ├── ui/                Design screen, HUD, minimap, debrief, settings, credits
│   └── save/              Campaign save and the restart snapshot (localStorage)
├── data/                  Game data as JSON (see below)
├── public/terrain/        Heightmaps, masks, and textures produced by the pipeline
└── tools/                 Python data pipeline
```

**The key rule: game rules live in `rules/` and know nothing about rendering.** The mission loop reads the rover's state, calls the rules, and draws the result. This keeps balance changes cheap, makes the rules testable, and gives AI tools a small, clear place to edit.

### Screen flow

```
Title ──► Design rover ──► Launch ticket ──► Landing ──► Mission (5 min) ──► Debrief
  ▲            ▲                                                               │
  │            └──── restart round (snapshot restored) ◄── balance below Mars minimum ──┤
  └──────────── "Mars: coming soon" ◄── survived, or died with enough money left ─────┘
```

## Data files: the contract

All game numbers live in JSON files in `data/`, not in code. This is what lets either of us tune the game, by hand or with AI, without touching the systems.

| File | Holds |
| --- | --- |
| `parts.json` | Every part: slot, name, cost, mass, size, and its effects (base speed, grip, energy income, battery capacity, heat, max load, light range, instrument) |
| `tiers.json` | The three ticket tiers: mass limit, size limit, price |
| `milestones.json` | Each milestone: id, category, trigger (distance, zone, photo, drill, survive), required parts, money, RP, fact text |
| `tuning.json` | Mission length, how mass slows the rover and raises energy use, damage per cause, freeze rate, sinkage and slip limits, death penalties, survival payout, minimum budget, starting budget |
| `events.json` | Flare and quake timing windows, warning time, damage, real flare list (date and class) |
| `text.json` | Tutorial, briefing, debrief, and history text, so the writing is reviewed in one place |

Example part entry:

```json
{
  "id": "chassis-titanium",
  "slot": "chassis",
  "name": "Titanium frame",
  "cost": 120,
  "mass": 18,
  "size": 4,
  "effects": { "maxLoad": 140 }
}
```

All numbers start as placeholders and are tuned in playtests. **Starting balance target:** a mid-priced rover reaches about two of the three headline areas (rim viewpoint, boulder field, shadowed crater) in one 5-minute mission.

## Phases

Phases are in build order. "Submission" means it must be in the build we submit on November 15.

### Phase 0: Skeleton · Submission

- Vite + TypeScript + Three.js + Rapier project in `game/`, deployed to a static host from day one.
- Screen flow with placeholder screens.
- `rules/` with the first tests passing.
- A project `CLAUDE.md` (see [Working with AI](#working-with-ai-on-this-codebase)).

**Done when:** the deployed link opens and clicks through every screen.

### Phase 1: Terrain pipeline · Submission

- `tools/build_terrain.py`:
  - Read an 8 km × 8 km window from the NASA Site11 5 m elevation file ([08](research/rover-engineering/08-moon-surface-data.md#elevation)).
  - Export a 16-bit heightmap PNG and a slope map.
  - Read the 80 m polar map for the distant ring and export a low-resolution heightmap.
- Pick the landing point automatically: a flat, sunlit cell near the center of the play area.
- Mark the shadowed crater zone from the permanent-shadow map, or by hand from the elevation if the mask takes too long.
- Use the simple Site11 tile first. Swap in the sharper Bertone 2025 model (a 1.3 to 2.2 GB download) only if time allows.

**Done when:** `public/terrain/` holds the heightmap, slope map, distant ring, and a JSON file with the landing point and zone outlines.

### Phase 2: Drivable Moon · Submission

- Load the terrain as chunks: full detail near the rover, lower detail farther away, distant ring beyond.
- A Rapier heightfield collider for the chunks around the rover.
- Rover vehicle with lunar gravity (1.62 m/s²), keyboard driving, chase camera.
- Sun at about 1.5° elevation, circling about 170° over the mission. Directional light and shadows.
- Black sky with stars, Earth low on the horizon.
- The "leaving the planned operating area" boundary.

**Done when:** you can drive from the landing point to the crater rim with shadows moving.

### Phase 3: Design screen and launch ticket · Submission

- Seven slots, two options each, from `parts.json`.
- A live readout of cost, mass, size, and the resulting ticket tier and price.
- Warnings: over the top tier, over the budget, chassis overloaded.
- Ticket purchase deducts money; the rover's parts set its handling and stats.

**Done when:** different builds visibly drive differently (a heavy rover is slower and drains energy faster).

### Phase 4: Mission systems · Submission

- Mission timer: 5 minutes covering 14 days. No clock on the HUD: time shows only through the Sun and shadows.
- Energy: solar income depends on sunlight (zero in shadow); driving cost grows with mass and slope.
- Damage meter: rocks, steep slopes, quakes, flares, overloaded chassis, each from `tuning.json`.
- Cold: a freeze meter inside the shadowed zone, slowed by the heater.
- Stuck: soft ground plus mass and weak wheels raise slip; high slip for too long means stuck for good.
- Solar flare (warning, then damage if still driving) and moonquake.
- Mission end conditions and cause of death.
- HUD: energy, damage, cold, simple minimap.

**Done when:** each of the four deaths can happen, and surviving 5 minutes ends the mission.

### Phase 5: Milestones, debrief, campaign · Submission

- Milestone triggers from `milestones.json`, with pop-ups (history fact only if the setting is on).
- Camera: viewpoint zones and a key press; the photo album.
- Drill: sample anywhere, ice only in the right spot in the shadowed crater.
- Debrief: milestones, money and RP earned, penalty and cause, album, and (if the setting is on) a real-rover comparison.
- Campaign save, minimum budget check, restart snapshot.
- "Mars: coming soon" screen with banked RP.

**Done when:** a full loop works: design → mission → debrief → restart or finish.

### Phase 6: Onboarding and presentation · Submission

- Tutorial text for the design screen and the first drive.
- Settings: Mission history on or off.
- Credits screen listing every NASA dataset with citations ([08 credits](research/rover-engineering/08-moon-surface-data.md#credits-and-licenses)).
- Visual pass: ground texture from the LROC mosaic, rover model, landing animation.

### Phase 7: Submission package · Submission

- The 30-second video or up to 7 slides ([event guide](../space-apps-2026-event-guide.md#submission-package)).
- Project description in English and the AI disclosure: AI-generated code and assets must be acknowledged, generated images and video watermarked, and no NASA branding in generated content.
- Final test of the public link in a private browser window.

### Phase 8: After submission

- Swap in the sharper terrain model and ShadowCam crater texture.
- Diviner temperatures for a real cold gradient, real flare list, Earth photo timing.
- Balance pass from playtests.
- Then Mars, following the [team plan](team-plan.md).

## If time runs short

Cut in this order, keeping the full loop intact:

1. The landing animation (the rover just appears).
2. The LROC ground texture (use a procedural grey texture).
3. The distant ring (use a fog line at the horizon).
4. Moving shadows (a fixed low Sun). Keep the Sun moving if at all possible: it is how players read time.
5. Moonquakes (keep flares).
6. Drill ice placement (drilling anywhere in the crater finds ice).

Never cut: the design screen with the ticket tiers, real NASA terrain, the debrief with payout, and the credits. These carry the judging criteria.

## Risks

| Risk | Why | Mitigation |
| --- | --- | --- |
| Shadows from a very low Sun | At 1.5° elevation shadows are kilometers long, and standard shadow maps struggle over 8 km | Cascaded shadow maps near the rover, plus a pre-baked shadow texture for the far terrain. Fallback: bake shadows at a few Sun positions and blend. |
| Physics on large terrain | One heightfield of 1,600 × 1,600 is heavy | Colliders only for the chunks around the rover |
| Download size | Heightmap plus textures could be large | 16-bit PNG for heights, compressed textures, distant ring at low resolution |
| Raw data size | The full Bertone model is 1.3 to 2.2 GB | Start with the 41 MB Site11 tile |
| Vehicle feel | Ray-cast vehicles feel floaty in low gravity | Tune suspension early, in Phase 2, not at the end |
| AI tools overwriting each other | Two people with AI tools editing the same files | Split by folder (see the [team plan](team-plan.md)); small commits; pull often |

## Working with AI on this codebase

- **A project `CLAUDE.md`** at the repo root that points to `game-design.md` as the source of truth and states the rules: game numbers go in `data/`, rules in `rules/` stay free of Three.js, run the tests before committing.
- **The design doc is the spec.** When a design decision changes, update `game-design.md` first, then the code.
- **Small, testable steps.** Ask for one phase item at a time and check it in the browser before moving on.
- **Tune numbers in JSON, not in prompts.** Changing `tuning.json` is faster and safer than asking an AI to "make it slower".
