# Implementation Plan: Mars Rover Engineering

How we build the Mars side of the engineer's desk: a Mars part catalog, a power model where the parts own their energy draws, support hardware (arm and mast), the first Mars instruments, the milestone types they need, and the Mars relationships. Written for our team. What the game does is defined in [game design](game-design.md) (source of truth) and the catalog in [rover engineering design](rover-engineering-design.md); this doc covers how we build it and in what order.

Written November 15, 2026, against `aon/merge-everything` (the merge of `chieri/mars`, `chieri/minimap` and `aon/engineer-desk`). The rules of [the first-version plan](implementation-plan.md) still apply: game numbers in `game/data/*.json`, pure rules in `game/src/rules/` with unit tests, `npm test` and `npm run build` passing before each commit.

**Status: draft.** Everything below is *Proposed* until Phase 0 records it in game-design.md. The Mars part catalog, unlock tree, ticket tiers and economy are Owner A's (game-design.md open questions 3 and 8); the night, cold, dust and events are Owner B's ([The Mars mission](game-design.md#the-mars-mission)). Items that cross the line are marked **interface**. Numbers are **indicative**: they show the scale against today's parts and are settled in the balance phase.

Quick navigation: [Why](#why-this-plan) · [Scope](#scope) · [Power model](#the-power-model-parts-own-their-draws) · [Catalog](#the-mars-catalog) · [Milestone types](#milestone-types) · [Relationships](#mars-relationships) · [Real anchors](#real-anchors) · [Phases](#phases) · [File map](#file-map) · [Tests](#tests) · [Risks](#risks) · [Decisions needed](#decisions-needed)

## Why this plan

Three things came out of merging the Mars mission with the payload bay:

1. **Mars uses the Moon's parts as they are.** The Mars bay offers all six Moon instruments, and three of them cannot work there: the laser retroreflector needs Earth in the sky, the seismometer station waits for a moonquake that never comes, and the neutron spectrometer looks for a lunar ice spot Mars does not have. The demo plan said this would last until Owner A's Mars catalog.
2. **The Moon's relationships run unfiltered on Mars.** All five are tagged `world: "moon"`, but nothing filters by world, and validation rejects any other world.
3. **The night drain is not tied to any part.** Mars charges 4 energy/s for an awake rover with lights at night, 1 without lights, and 0.2 asleep (`data/mars/tuning.json` → `night`). These stand for real components (the lights, the electronics, keep-alive while asleep), but they are world constants. The payload bay already has parts that carry their own draw (`standbyEnergy` on the neutron spectrometer), so the game now has two models for the same thing, and the largest power cost on Mars is the one the player cannot see on the desk.

Mars's lesson is **energy through day and night**. Every piece of this plan is chosen to make that lesson a decision at the desk: which power source, which heater, which lights, which instruments, and what each one costs after sunset.

## Scope

**In this plan**

- A catalog per world: each part says where it is offered. Moon-only instruments leave the Mars desk; Mars-only parts never reach the Moon desk.
- The power model: lights, electric heaters and the radioisotope generator carry their own power effects; the world keeps only the base electronics draw.
- Mars bus parts: a radioisotope generator (RTG), deployable solar arrays, an electric heater, a larger battery, and Mars wheels.
- Support hardware: a robotic arm and a mast, as new optional slots offered on Mars.
- The first Mars instruments: weather mast, ground-penetrating radar, laser spectrometer, organics spectrometer. The camera, drill, X-ray spectrometer and neutron spectrometer carry over.
- Milestone types the Mars instruments need, and the Mars milestones built on them.
- Dust on the panels and dust devils (the power side of dust), since three parts and one relationship depend on them.
- Four Mars relationships, the review and notebook for Mars, and relationships filtered by world.
- A Mars energy and balance check that covers the new parts.

**Not in this plan**

- The RP unlock tree (open question 3). The catalog is built so parts can later carry an unlock cost, but every Mars part is offered from the start until Owner A decides the tree.
- Mars ticket tiers and budget (open question 8). Mars keeps the Moon tiers.
- Communications and data as a resource (open question 6, "designed later").
- Instrument levels (multispectral camera, deep drill, active neutron spectrometer, broadband seismometer) and the remaining catalog (magnetometer, microscopic imager, penetrometer, dosimeter, dust monitor, heat flow probe, oxygen maker, coring drill and cache). They come in a second wave once the first one plays well.
- The marsquake (optional event in game-design.md) and with it the seismometer on Mars.
- Wheel wear as a system. The "sharp rocks wear the wheels" relationship needs a new wear meter; it is listed for a later wave.
- Moon balance. Nothing here changes Moon numbers, parts or milestones.

## The power model: parts own their draws

**Today (Mars):** `nightDrainPerSecond(isNight, poweredDown, hasLights, night)` picks one of three world constants. Lights are on whenever the rover is awake at night and has a lights part. Solar income stops at night; nothing else draws power except driving and instrument standby.

**Proposed:** keep one world constant for the electronics (which every rover has, whatever its parts), and move everything else onto parts.

| Draw | Where it lives | When it applies | Today's equivalent |
| --- | --- | --- | --- |
| Electronics, awake | `tuning.night.awakeDrainPerSecond` (unchanged, 1/s) | Awake at night | Same |
| Electronics, asleep | `tuning.night.sleepDrainPerSecond` (unchanged, 0.2/s) | Asleep at night | Same |
| Lights | New part effect `lightsDraw` (LED 3/s) | Awake at night with lights (the floodlights are on) | The 3/s difference between "lights on" (4) and "awake" (1) |
| Electric heater | New part effect `heaterDraw` | At night, awake **and asleep** (a survival heater keeps running) | Nothing: today's only heater draws no power |
| Instrument standby | Part effect `standbyEnergy` (exists) | Switched on and awake | Same |
| RTG income | New part effect `steadyIncome` | Always, day and night, not cut by dust, storm or shadow | Nothing |

- **Why the electronics stay a world constant.** Every rover has a computer, and no part choice changes it yet. A computer part (rover-engineering-design.md section 9) could own it later.
- **Why the draws apply only at night.** A panel's `energyIncome` is effectively net: the Moon has no idle drain, so the daytime draw is folded into the panel rating. At night, with no solar income, the hidden draw appears. The rules say so in a comment, and game-design.md says it once in plain words.
- **The Moon is unchanged.** These effects apply only on a world whose tuning has a `night` section (Mars). The Moon's LED keeps drawing nothing; a later Moon balance pass can turn it on.
- **Caps.** Instrument standby keeps its rule (it never takes the battery below the low-energy warning level, then switches off). Lights and heaters are not capped: they are what keeps the rover alive and driving, and an empty battery at night ends the mission, as today.
- **Same numbers today.** With today's parts (one LED at 3/s, the radioisotope heater units at 0), the new model gives exactly 4 / 1 / 0.2. `marsNight.test.ts` must pass unchanged after Phase 2; that is the regression check.

**Real basis.** Real rovers also spend power at night just to stay alive. Curiosity draws about 45 to 70 W asleep against at least 150 W awake (single-sourced). Opportunity needed about 120 Wh per sol to survive, and Spirit about 180 Wh. Opportunity's deep sleep switched everything off except a clock that woke the computer to check the battery. Ingenuity could not power its heaters all night in winter, so its computer froze and reset every night. See [Real anchors](#real-anchors) for sources. The game's 5:1 ratio between awake (1/s) and asleep (0.2/s) is steeper than Curiosity's roughly 2 to 3:1. That is a game choice that makes sleeping clearly worth it; the text should not claim the ratio is real.

**On the desk.** The spec sheet gains a **night budget** line for Mars: what one 15 s night costs asleep, and awake with lights, for this build (for example "Night: 3 asleep · 60 with lights · RTG +9"), next to the battery capacity. This is the single most useful number for Mars's lesson, and today the player can only find it by running out of energy.

## The Mars catalog

### How a part says where it is offered

- `Part.worlds?: WorldId[]` in `parts.json`. Absent means every world. Mars-only parts carry `["mars"]`; the reflector and seismometer station carry `["moon"]`.
- The catalog stays one file: the build preview, the rover model and the tier quote already read one list, and per-world names already come from `text.partText`.
- `loadGameData(world)` filters `parts.parts` to the world's parts; validation checks that every world still has at least one option in each required slot.
- `upgradeSavedBuild` already drops part ids the catalog no longer has, so a Moon build carried into the Mars desk loses its reflector or seismometer. The desk then shows a one-line notice ("Not offered on Mars: Laser retroreflector") instead of dropping it silently.

### Bus parts

| Part | Slot | Indicative cost / mass / size | Effects | What it teaches |
| --- | --- | --- | --- | --- |
| Radioisotope generator (RTG) | Power | 260 / 25 kg / 6 | `steadyIncome` 0.6/s day and night (about 36 per sol, a fixed panel's clear sol), `heat` 2 (waste heat), `neutronNoise` | Power that does not care about night, dust or storms, at a high price and mass, and with neutron noise |
| Deployable solar arrays | Power | 120 / 14 kg / 5 | `energyIncome` 2.6, `dustRate` ×1.5 | The most income in sunlight, the most lost to dust |

*RTG income is a balance choice, not the real ratio.* Curiosity's MMRTG gives about 2,700 Wh per sol (110 W electric at the start, about 2,000 W of heat, 45 kg). MER's folding arrays gave about 900 Wh per sol when new and about 600 after 90 sols. So a real RTG out-earns a real array by about 3 to 4 times. The game sets the RTG equal to one fixed panel's clear sol so it does not solve Mars by itself (see [Risks](#risks)); the balance phase can raise it if the RTG never gets picked. The research notes disagree on the MMRTG's numbers (110, about 114 or about 125 W at the start; 54, 72 or about 100 W years later): fact-check before any of them reaches the game's text.
| Fixed panel, solar mast | Power | Unchanged (Moon parts) | `dustRate` ×1 (fixed), ×0.8 (mast stands higher) | |
| Larger battery pack | Battery | 150 / 26 kg / 4 | `batteryCapacity` 900 | Carry the night instead of avoiding it |
| Electric heater | Heater | 25 / 2 kg / 1 | `heat` 3 while powered, `heaterDraw` 1.2/s at night | Cheap and light, but it spends the battery at night, even asleep; an empty battery means freezing too |
| Radioisotope heater units | Heater | Unchanged | `heat` 2, no draw | |
| LED floodlights | Lights | Unchanged | gains `lightsDraw` 3 (Mars only, see above) | |
| Grouser wheels | Wheels | 110 / 18 kg / 5 | Higher grip on sand (Séítah), slower than mesh | The Séítah crossing |

- The RTG has no `energyIncome`, so the low-Sun, storm, shadow and dust factors do not touch it.
- The RTG and the electric heater are both **interface** items: their numbers depend on Owner B's freeze rate (8/s at night, heater reduction 1.5 per heat unit).
- *Not in this wave:* a rocker-bogie chassis. Its benefit is climbing, and today's slope rule is a single damage threshold; it waits for a mobility pass.

### Support hardware

Two new optional slots, offered only on Mars (the Moon's slot list does not change):

| Part | Slot | Indicative cost / mass / size | Effects |
| --- | --- | --- | --- |
| No arm / Robotic arm | `arm` | 0 / 0 / 0 · 90 / 18 kg / 3 | `arm: true`; contact instruments need it |
| No mast / Remote sensing mast | `mast` | 0 / 0 / 0 · 70 / 6 kg / 2 | `mast: true`; the laser spectrometer needs it; the camera's photo zones grow (`photoRangeFactor`) |

- Instrument parts gain `needs?: ('arm' | 'mast')[]`. `payloadProblems` refuses an instrument whose support part is missing, with a desk reason ("Needs the robotic arm"); the desk greys the card the same way a full bay does.
- The X-ray spectrometer gains `needs: ["arm"]` **on Mars only**, as the catalog says (on the Moon it keeps Pragyan's built-in deploy mechanism). This is the one per-world effect; it goes in a small `parts` overlay in `data/mars/` (`effects.needs` by part id) rather than a second part.
- `BusSlot` stays the six Moon slots; `arm` and `mast` are `SupportSlot`. `Build` gets `support?: Partial<Record<SupportSlot, string>>`, so every Moon build and save is still valid as it is.

### Instruments on Mars

| Instrument | On Mars | Verb | Indicative cost / mass / size | Energy | Needs |
| --- | --- | --- | --- | --- | --- |
| Science camera | Carries over | Look | Unchanged | None | |
| Regolith drill ("rock drill" on Mars) | Carries over | Dig | Unchanged | Per sample | |
| X-ray spectrometer | Carries over | Touch | Unchanged | Per reading | Arm (Mars) |
| Neutron spectrometer | Carries over | Sense while driving | Unchanged | Standby | |
| Seismometer station | Moon only | | | | |
| Laser retroreflector | Moon only | | | | |
| **Weather mast** | New | Monitor | 60 / 5 kg / 2 | Standby, small | |
| **Ground-penetrating radar** | New | Sense while driving | 90 / 3 kg / 2 | Standby | |
| **Laser spectrometer** | New | Zap from a distance | 140 / 10 kg / 3 | Per reading, large | Mast |
| **Organics spectrometer** | New | Touch | 160 / 5 kg / 2 | Per reading, very large; long hold | Arm |

**Why these four first.**

- **Each is a new verb or a new use of the Mars map.** The radar profiles the buried delta and Séítah while driving. The laser spectrometer reads rocks it cannot drive to, such as the 48 m delta cliff from its foot. The organics spectrometer is slow and power-hungry, so it competes with the night for the battery. The weather mast reads the coming storm.
- **They use what Mars already has.** The delta front, Séítah, the viewpoints, the dust storm and the night are built; no new terrain is needed.
- **They pull the power lesson.** The organics spectrometer's energy cost is the biggest single cost on the desk; the weather mast trades a small standby draw for an earlier storm warning; the radar and the neutron spectrometer both want standby while driving.
- **They use the arm and the mast,** so the support hardware is a real choice from the first Mars build.

**Neutron spectrometer on Mars.** It stays, as the RTG's neutron noise needs it (see [Mars relationships](#mars-relationships)). Without a lunar ice spot it reads a background everywhere; Mars hydrogen content (hydrated minerals in the delta) is **interface** content for Owner B: either a hydrogen-rich delta zone in `terrain.json` features, or the neutron spectrometer leaves the Mars desk too.

### Mission features

| Feature | Instrument | What the player sees |
| --- | --- | --- |
| Storm watch | Weather mast | While on, the storm forecast comes earlier (`stormEarlyWarningSeconds`) and the HUD shows a pressure and dust trend |
| Subsurface strip | Ground-penetrating radar | A strip under the meters that draws the buried layers along the path just driven; a straight, steady drive gives a clean profile |
| Target reticle | Laser spectrometer | A target marker on a rock within range (`reachM`, several times the X-ray's) in front of the rover; a reading reports the rock as the X-ray does |
| Long hold | Organics spectrometer | A hold measured in tens of seconds, with a progress bar and its energy drawn as it runs; it pauses if the rover powers down |

The rock readout for Mars rocks reuses the X-ray placeholder system (`instruments.xray.rocks` per world), with Mars rock types in `data/mars/tuning.json` and names in `data/mars/text.json`. Which rocks lie where is Owner B's map content, as on the Moon.

## Milestone types

Most Mars milestones fit triggers that exist (`zone`, `photo`, `drill`, `distance`, `explore`, `night-distance`, `storm-survive`). The new instruments need three new types. All three are generic, so later instruments reuse them instead of each adding its own.

| Trigger | Shape | Fires when | Used by |
| --- | --- | --- | --- |
| `reading` | `{ type: 'reading', instrument, zone?, target?, sites? }` | A use of that instrument finishes (the `instrument-done` notice) inside the zone, or on that target kind, with optional staged sites as the drill | X-ray, laser and organics readings |
| `transect` | `{ type: 'transect', instrument, zone, meters }` | The instrument was switched on for an unbroken drive of at least `meters` that crosses the zone | Radar across the delta front or Séítah; neutron spectrometer later |
| `record` | `{ type: 'record', instrument, event }` | The instrument was on (or deployed) when the event happened, and the rover was not powered down | Weather mast through the dust storm; later the seismometer through a marsquake |

`MilestoneRequirements` already has `instrument`; it gains `support?: SupportSlot[]` so a milestone can say "needs the arm" in the debrief's missed list.

### Mars milestones in this plan

New, all *Proposed*, rewards **interface** (Owner A):

| Milestone | Category | Trigger | Equipment | Real basis (to fact-check) |
| --- | --- | --- | --- | --- |
| Sand crossing | Capability: difficulty | `zone`, Séítah, `cross` (exists) | None | Designed already in game-design.md; Spirit at Troy |
| Signs of an ancient lake | Record: first discovery | `drill` in `delta-front` (exists) | Drill | Designed already; Wildcat Ridge |
| Delta stratigraphy | Scientific: historical formation | `transect`, radar, `delta-front`, 150 m | Radar | Perseverance's RIMFAX profiles of the delta |
| Rock from afar | Scientific: new information | `reading`, laser, `target: "cliff"` at the delta-layers zone | Laser, mast | SuperCam reads targets several meters away |
| Organic molecules | Record: first discovery | `reading`, organics, `delta-front` | Organics, arm | SHERLOC detections in Jezero rocks |
| Storm log | Scientific: new information | `record`, weather mast, `duststorm` | Weather mast | MEDA and REMS weather records |
| Dust devil | Pretty picture | `photo`, `target: "dustdevil"` | Camera | Designed already; needs the dust devil event (Phase 5) |

The existing Mars milestones (Touchdown, Odometer, Mapper, Night drive, Storm survivor, Delta layers, Core sample, Blue sunset) do not change.

## Mars relationships

Four for this wave, from rover-engineering-design.md's Mars table plus one the new power model makes possible. Each is solvable at least two ways (rule 3) and has one desk cause, one mission signal and one plain explanation (rule 4).

| Relationship | Kind | Fires when | What the player sees | Answers | Real basis |
| --- | --- | --- | --- | --- | --- |
| The RTG adds neutron noise | Conflicts | The neutron spectrometer is on, on an RTG rover | The hydrogen meter's floor is raised and jitters | Solar power; or leave the neutron spectrometer home | Jun et al. (2013), DAN background at Rocknest (in the design doc) |
| Dust on the panels | Conditions | Solar income has fallen by a set share to dust | The energy income line shows a dust factor | An RTG; the mast's higher panel; a route past dust devils | rover-engineering/02, dust factor (in the design doc) |
| An electric heater spends the night | Shares | The electric heater's draw empties more than a set share of the battery in one night | A notice at dawn with the night's heater cost | Radioisotope heater units or an RTG; a larger battery | Ingenuity could not power its heaters through winter nights, so its computer froze and reset each night; Opportunity needed about 120 Wh per sol just to survive (see [Real anchors](#real-anchors)) |
| The arm cannot reach on a slope | Conditions | A contact reading is refused because the ground is steeper than the arm's limit | A refusal notice that names the slope | Park on level ground; the laser spectrometer from a distance | Perseverance's PIXL and SHERLOC must sit close to the rock (in the design doc) |

- `Relationship.world` widens to `WorldId`; the mission, the review and the notebook show only the current world's relationships; the notebook lists each world under its own heading with its own count.
- A Moon lesson that also happens on Mars (no lights, so no driving at night) gets its own Mars entry rather than reusing the Moon id: the cause is the same part, but the place and the real basis differ.
- Moved to a later wave: big labs and driving cannot run together (the organics spectrometer's hold already stops the rover), scout-drill-analyze (needs a lab instrument), sharp rocks wear the wheels (needs wear).

## Real anchors

Real values from our research notes, so indicative numbers can be checked against reality in the balance phase. File names: [02](research/rover-engineering/02-rover-subsystems.md) rover subsystems, [03](research/rover-engineering/03-surface-environments-and-operations.md) surface environments and operations, [01](research/rover-engineering/01-rover-missions-history.md) mission history. Each note holds the original source link; anything marked *unverified* there stays unverified here and is checked before it reaches `text.json`.

| Part or rule | Real value | Notes |
| --- | --- | --- |
| Solar arrays | MER: folding arrays, 1.3 m², up to 140 W, about 900 Wh/sol new, about 600 after 90 sols. Zhurong needed about 140 W from its arrays to wake | 02, Surface power sources compared; Energy budget per sol |
| RTG | MMRTG: 110 W electric at the start, about 2,000 W heat, 45 kg, about 2,700 Wh/sol. The waste heat runs a fluid loop that keeps the electronics warm at night | 02, Surface power sources compared; Heat sources. Output figures disagree across 01, 02 and 03 |
| Battery | Perseverance: two 43 Ah strings, 2,408 Wh, 29 kg. MER: two 8 Ah packs that must stay above −20 °C to discharge and 0 °C to charge | 02, Batteries |
| Night survival | Opportunity's floor about 120 Wh/sol; Spirit's about 180 Wh. Curiosity 45 to 70 W asleep, 150 W or more awake (single-sourced). Opportunity's deep sleep kept only a wake-up clock running | 03, Data and energy budgets; 02, Power modes; 01, Spirit |
| Heaters | A radioisotope heater unit gives about 1 W of heat (MER carried 8). MER's warm electronics box used aerogel, electric heaters and heater units; nights reached −105 °C there | 02, The warm electronics box |
| Lights | **No real Mars rover drives at night or carries floodlights.** Real sols end in sleep. The only rover lights in the notes are VIPER's, on the Moon | 03, typical sol plan; 02, VIPER |
| Dust on panels | About 0.2% of output lost per sol typically (0.05% to 2% observed); Pathfinder 0.28% per day. Zhurong: 20% cover caused problems, above 40% it never woke | 02, Dust on the panels; 01, Zhurong |
| Dust devils | Spirit gained about 50% in one day (from 40% down to 7% reduced) and once doubled to over 800 Wh | 03, Dust devils and cleaning events |
| Dust storm | 2018: Opportunity fell from about 645 to 22 Wh in nine days at tau 10.8; recharging needs tau below about 2 | 03, Dust storms; 02, Sunlight on Mars |
| Wheels | Curiosity: 50 cm aluminum, 24 chevron grousers, holed by sharp rocks from 2013 (traction control cut the load on the leading wheels by 20%). Perseverance: 48 grousers, skin twice as thick | 02, Wheels and grousers |
| Soft sand | Opportunity at Purgatory: wheels dug in over 10 cm, five weeks to escape. Spirit at Troy: stuck for good from 2009 | 02, Terramechanics; 03 |
| Arm | Curiosity: 2.1 to 2.2 m, 33 kg turret. Perseverance: 2.1 m, 45 kg turret. No arm power figure in the notes | 02, Arms |
| Mast | Nothing in the notes for a Mars mast | |

What this changes in the plan:

- **Dust is compressed, like time.** At the real 0.2% per sol, ten sols would lose 2%, too little to feel. The game's rate is a game-feel choice, as the 3× faster night is; the text says dust settles steadily, not how fast.
- **Night driving with lights is a game choice, not history.** game-design.md already decided the lights-on-or-sleep choice. Mission history text and the night tutorial must not say real Mars rovers drive at night; they can say real rovers sleep through it, and that VIPER carried headlights for dark lunar craters.
- **The arm is heavier than first sketched,** so its indicative mass is 18 kg (the real turrets alone are 33 to 45 kg; the game scales every part down).

## Phases

Each phase ends with tests and the build passing, a browser check on both worlds, and a commit. Mechanics settled during a phase go back into game-design.md as "decided during implementation".

### Phase 0: Design first

- Owner A and Owner B agree on this plan's *Proposed* items, at least the [decisions needed](#decisions-needed).
- game-design.md: the Mars parts (open question 8 answered for this wave), the power model in [How the Mars rules work](game-design.md#how-the-mars-rules-work-decided-during-implementation-m3), the new milestones in [Mars milestones](game-design.md#mars-milestones).
- rover-engineering-design.md: section 8 marks which instruments are built for Mars; section 9 records the bus parts; section 10 records the four Mars relationships.

**Done when:** both docs say *Decided* for everything Phases 1 to 4 build.

### Phase 1: A catalog per world

Small, and it settles two open items from the merge on its own, so it can ship before the rest.

- `Part.worlds` in types and data; `loadGameData(world)` filters; validation per world.
- Reflector and seismometer station marked `["moon"]`.
- Desk notice for parts dropped from a carried-over build.
- `Relationship.world: WorldId`; `relationshipProblems` accepts every world id; the mission, review and notebook filter by the current world.
- Tests: a Mars catalog without the Moon-only parts; a Moon build carried to Mars loses them with a notice; Moon relationships never fire on Mars.

**Done when:** the Mars desk offers four instruments, a Moon save with a reflector opens on Mars without it, and no Moon lesson fires on Mars.

### Phase 2: Parts own their draws

- `PartEffects`: `lightsDraw`, `heaterDraw`, `steadyIncome`, `dustRate`.
- `rules/energy.ts`: `nightDraw(parts, state, night)` replaces `nightDrainPerSecond`; `MissionSetup` carries the summed draws (computed once in `missionSetup`, and again by `deployPart`).
- `rules/mission.ts`: the energy step adds `steadyIncome` (not scaled by sunlight, storm or dust) and subtracts the part draws at night; standby keeps its cap.
- `rules/cold.ts`: the electric heater's `heat` counts only while its draw is paid (battery above zero).
- LED gets `lightsDraw: 3` (applied only where `tuning.night` exists).
- Desk: the night budget line on the spec sheet.

**Done when:** `marsNight.test.ts` passes unchanged with today's parts, and new tests cover an RTG rover at night, an electric heater asleep, and the Moon unaffected.

### Phase 3: Mars bus parts and support hardware

- `parts.json`: the RTG, deployable arrays, larger battery, electric heater, grouser wheels, arm and mast parts, each `worlds: ["mars"]`.
- `SupportSlot`, `Build.support`, `parts.supportSlots` per world (Mars overlay); `selectedParts`, `isCompleteBuild`, `missingSlots`, the quote and the tier check include support parts.
- `needs` on instrument parts; `payloadProblems` and the desk enforce it; the Mars X-ray overlay.
- Build preview and rover model: the RTG fins at the back, the deployable arrays as wings, the mast with a head, the arm folded at the front.
- Balance model: `allBuilds` per world, with support slots.

**Done when:** a Mars rover can be built with each new part, the spec sheet's night budget changes with the power source and heater, and the Moon desk is unchanged.

### Phase 4: The first Mars instruments

All behavior in `rules/instruments.ts`; the mission screen only measures and draws, as for the Moon instruments.

| Instrument | Rule | Mission screen |
| --- | --- | --- |
| Weather mast | `stormForecastAt(storm, mastOnSince, tuning)`: the forecast moves earlier while the mast has been on for a while | A switch; a small trend readout; the forecast notice credits the mast |
| Ground-penetrating radar | `radarTrack(prev, sample)`: builds the profile along a steady drive, broken by sharp turns or stops; layer content from the zone under the rover | A switch; the subsurface strip under the meters |
| Laser spectrometer | `laserTarget(p, heading, targets, tuning)`: the nearest target in a cone ahead within reach (boulders and the cliff zone's edge) | A target marker; a short hold; the rock readout |
| Organics spectrometer | Uses `startInstrumentUse` with a long `useSeconds` and energy charged per second of the hold; refused on slopes over the arm's limit | A progress bar; the result notice |

- The instrument log in the debrief gains the four.
- Mission history facts and sources for each, fact-checked before they go into `text.json`.

**Done when:** each works in the browser on a rover that carries it, refuses clearly when it cannot be used (no arm, no mast, slope, energy), and has unit tests.

### Phase 5: Dust on the panels and dust devils (Owner B)

Designed in game-design.md (*Proposed* there) and listed as "next after the demo" in the Mars plan; needed here because the arrays, the mast and the RTG differ by dust.

- `tuning.dust`: a share of solar income lost per sol, times the power part's `dustRate`; the storm adds more.
- Dust devils: a rare event that resets the dust factor, drawn as a moving column the camera can photograph.
- HUD: the energy income line shows the dust factor.

**Done when:** a solar rover ends the mission with visibly less income than it started with, an RTG rover does not, and a dust devil can clean the panels and be photographed.

### Phase 6: Milestones and relationships

- `reading`, `transect` and `record` triggers in `rules/milestones.ts`, with `MarsMilestoneTrigger` widened; validation checks their instrument ids and zones.
- The seven milestones above in `data/mars/milestones.json`.
- The four relationships in `relationships.json` with `world: "mars"`, their checks in `rules/relationships.ts`, build predicates for the review, and notebook text.
- Debrief: the missed-milestones list names a missing support part ("needs the robotic arm").

**Done when:** every new milestone can be earned on purpose in the browser, each relationship can be triggered and shows its notice once, and the review shows a Mars lesson only after it was met on Mars.

### Phase 7: Balance, text and playtest

- A Mars energy check that covers the new parts, extending `marsNight.test.ts` (or a Mars `winPaths`): the cheap build, an RTG build, an arrays-and-big-battery build, and an organics build, each over the storm seeds.
- Targets: several builds pass Mars (the Moon's "several ways to pass" rule); an RTG is never the only way; an electric heater build can survive if it sleeps; no build passes while idling at the lander.
- Tutorial: a Mars design page for power at night (the night budget line, RTG versus arrays, the two heaters) and a support hardware paragraph; drive tutorial lines for the four instruments.
- Credits: sources for the new parts, instruments and relationships.
- A Mars playtest checklist, as for the Moon.

**Done when:** the balance targets hold in tests, the playtest checklist is run, and game-design.md marks each piece built.

### Shipping

Phase 1 can ship alone. Phases 2 and 3 ship together (the power parts are the point of the power model). Phases 4 to 6 ship together, so new instruments arrive with their milestones and relationships; Phase 5 can go before them if Owner B has time.

## File map

| Area | Files |
| --- | --- |
| Types | `rules/types.ts` (`Part.worlds`, `PartEffects` power and support fields, `SupportSlot`, `Build.support`, `Relationship.world`, `MilestoneRequirements.support`), `rules/marsTypes.ts` (new triggers, `DustTuning`) |
| Data | `data/parts.json`, `data/mars/parts.json` (new: per-world effect overlay), `data/mars/tuning.json` (`dust`, instruments), `data/mars/milestones.json`, `data/mars/events.json` (dust devils), `data/relationships.json`, `data/mars/text.json`; `src/gameData.ts` filters and merges parts per world |
| Rules | `rules/payload.ts` (`needs`, world filter in `upgradeSavedBuild`), `rules/rover.ts`, `rules/quote.ts`, `rules/energy.ts`, `rules/cold.ts`, `rules/mission.ts`, `rules/instruments.ts`, `rules/milestones.ts`, `rules/relationships.ts`, `rules/validate.ts`, `rules/balance.ts`, `rules/winPaths.ts` |
| Desk | `ui/designScreen.ts` (support slots, night budget, dropped-part notice), `ui/buildPreview.ts`, `rover/roverModel.ts`, `ui/ticketScreen.ts` (review per world), `ui/tutorialText.ts` |
| Mission | `ui/missionScreen.ts`, `ui/hud.ts` (radar strip, storm trend, dust factor, long-hold bar), `ui/marsMission.ts`, `world/` (dust devil) |
| Screens | `ui/screens.ts` (debrief log, notebook per world), `ui/notebook.ts`, `ui/creditsScreen.ts` |

## Tests

- **Regression:** `marsNight.test.ts` unchanged after Phase 2; every Moon test unchanged throughout (the Moon desk, quote, balance and relationships must not move).
- **New:** per-world catalog and save carry-over; part draws (lights, electric heater asleep, RTG income at night and in the storm); support needs; each new instrument rule; the three trigger types; the four relationships and their build predicates; dust and dust devils; the Mars balance check.

## Risks

| Risk | Why | Mitigation |
| --- | --- | --- |
| The RTG solves Mars by itself | Steady power removes the night puzzle | High cost and mass, a heavier ticket, neutron noise, and an income no higher than a panel's clear sol; balance target "an RTG is never the only way" |
| Support slots touch the build shape again | `Build` is used everywhere | Optional `support` field, so Moon builds and saves are untouched; same approach as Phase 1 of the payload bay plan |
| Mars desk overload | Eight slots, ten instruments, two heaters, three power sources | The night budget line does the explaining; the review only shows what was met; instruments stay at four new ones |
| Instruments without content | The neutron spectrometer has no Mars hydrogen target; the laser needs targets | Decide Mars hydrogen with Owner B before Phase 4, or take the neutron spectrometer off the Mars desk |
| Real numbers that do not hold up | Some anchors are unchecked, and the notes disagree on the MMRTG | Every fact and source is checked before it reaches `text.json`, as for the Moon |
| Teaching something false about the night | Real Mars rovers sleep at night and carry no floodlights | Keep the lights-on choice as a stated game choice; history text says real rovers sleep |
| Balance model build count | Support slots and more instruments multiply builds | Enumerate per world and only valid support and bay combinations; sample if slow |

## Decisions needed

| # | Question | Proposal | Owner |
| --- | --- | --- | --- |
| M1 | Parts own their draws (lights, electric heater, RTG), the world keeps the electronics draw | Yes, Mars only for now | Interface |
| M2 | Seismometer station and retroreflector off the Mars desk | Yes, until a marsquake exists | Owner A |
| M3 | Mars hydrogen for the neutron spectrometer | A hydrated-mineral zone at the delta, or the instrument leaves the Mars desk | Owner B |
| M4 | The first four Mars instruments | Weather mast, radar, laser spectrometer, organics spectrometer | Owner A |
| M5 | Arm and mast as optional slots offered only on Mars | Yes | Owner A |
| M6 | The X-ray spectrometer needs the arm on Mars | Yes, as the catalog says | Owner A |
| M7 | The three new trigger types | `reading`, `transect`, `record` | Interface |
| M8 | Dust on the panels and dust devils in this plan | Yes, Phase 5 | Owner B |
| M9 | Mars relationships in this wave | The four above | Interface |
| M10 | Unlocks | All Mars parts offered from the start until the unlock tree is decided | Owner A |
