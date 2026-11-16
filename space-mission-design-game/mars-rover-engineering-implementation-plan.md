# Implementation Plan: Mars Rover Engineering

How we build the Mars side of the engineer's desk: a Mars part catalog, a power model where the parts own their energy draws, support hardware (arm and mast), the first Mars instruments, the milestone triggers they need, and the Mars relationships. Written for our team. What the game does is defined in [game design](game-design.md) (source of truth) and the catalog in [rover engineering design](rover-engineering-design.md); this doc covers how we build it and in what order.

Decisions recorded November 15, 2026.

Written November 15, 2026, against `aon/merge-everything` (the merge of `chieri/mars`, `chieri/minimap` and `aon/engineer-desk`). The rules of [the first-version plan](implementation-plan.md) still apply: game numbers in `game/data/*.json`, pure rules in `game/src/rules/` with unit tests, `npm test` and `npm run build` passing before each commit.

**Status: Phase 0 done (November 15, 2026)**, except Chieri's review. The Mars ticket tiers, drafted under [M12](#mars-ticket-tiers-m12-decided), were approved by the user as drafted (November 15); what still waits is Chieri's review of the [Owner B items](#items-for-chieris-review). game-design.md `d596eba` and rover-engineering-design.md `2bf2e0a` record the plan; where the text below says *Proposed*, game-design.md is now the source of truth. Earlier status: everything was *Proposed* until Phase 0, except M11 to M19, which are decided (see [Decisions needed](#decisions-needed)) and applied through the doc. The Mars part catalog, unlock tree, ticket tiers and economy are Owner A's (game-design.md open questions 3 and 8); the night, cold, dust and events are Owner B's ([The Mars mission](game-design.md#the-mars-mission)). Items that cross the line are marked **interface**. Numbers are **indicative**: they show the scale against today's parts and are settled in the balance phase; like the Moon's (Moon plan M1), they can be revisited in a later balance patch.

**Revised November 15, 2026**, applying what we learned planning the Moon's sites and milestones ([Moon plan](moon-sites-and-milestones-plan.md)). Changed sections are marked *Revised*:

- **Affordability.** Every relationship answer checked against the real part prices, ticket tiers and Mars rewards in `game/data/`. Four answers do not fit (an RTG, the laser spectrometer, the 900 battery, the arm builds). There are cost tables, the decided fixes (M11) and the findings left open for a balance patch (M13, M14) in [Affordability check](#affordability-check-revised).
- **Shared triggers.** Milestone types now reuse the Moon's `reading`, `transect`, `record` and `deploy` and `MilestoneRequirements.instruments`, as game-design.md records them. Mars adds only the extensions listed in [Milestone types](#milestone-types-revised).
- **Hand-off.** Mars sites, areas of interest and new milestones move to the coming [Mars sites and milestones plan](mars-sites-and-milestones-plan.md). This doc keeps the triggers, a minimum each instrument must earn, and the constraints that plan must respect ([Hand-off](#hand-off-to-the-mars-sites-and-milestones-plan-revised)).
- **Spoiler guard.** One row per Mars lesson. The electric heater lesson is dropped (M15): the heater is a plain part cost, and the night budget line stays.
- **Every instrument earns.** In the draft's milestones, the X-ray and neutron spectrometers earn nothing on Mars. On today's rewards an empty-bay Mars run passes from a good Moon result. Both are flagged for the sites plan.
- **Stations.** No Mars station in this wave. Later ones follow the Moon's near-lander rule.
- **Real missions.** Claims checked and reworded: night lights, Ingenuity, Opportunity's sleep and storm, Spirit's cleaning, the MMRTG, wheels, RIMFAX, SHERLOC. Sources are in [Real anchors](#real-anchors-revised).
- **Decisions.** M11 to M19 are decided: reprice as proposed (M11); design separate Mars ticket tiers before Phase 3 (M12); leave budget requirements and rewards to a future balance patch (M13); keep the original relationship answers (M14); drop the heater lesson (M15).

Quick navigation: [Why](#why-this-plan) · [Scope](#scope-revised) · [Power model](#the-power-model-parts-own-their-draws) · [Catalog](#the-mars-catalog) · [Affordability](#affordability-check-revised) · [Milestone types](#milestone-types-revised) · [Relationships](#mars-relationships-revised) · [Hand-off](#hand-off-to-the-mars-sites-and-milestones-plan-revised) · [Real anchors](#real-anchors-revised) · [Phases](#phases) · [File map](#file-map) · [Tests](#tests) · [Risks](#risks) · [Decisions needed](#decisions-needed)

## Why this plan

Three things came out of merging the Mars mission with the payload bay:

1. **Mars uses the Moon's parts as they are.** The Mars bay offers all six Moon instruments, and three of them cannot work there: the laser retroreflector needs Earth in the sky, the seismometer station waits for a moonquake that never comes, and the neutron spectrometer looks for a lunar ice spot Mars does not have. The demo plan said this would last until Owner A's Mars catalog.
2. **The Moon's relationships run unfiltered on Mars.** All five are tagged `world: "moon"`, but nothing filters by world, and validation rejects any other world.
3. **The night drain is not tied to any part.** Mars charges 4 energy/s for an awake rover with lights at night, 1 without lights, and 0.2 asleep (`data/mars/tuning.json` → `night`). These stand for real components (the lights, the electronics, keep-alive while asleep), but they are world constants. The payload bay already has parts that carry their own draw (`standbyEnergy` on the neutron spectrometer), so the game now has two models for the same thing, and the largest power cost on Mars is the one the player cannot see on the desk.

Mars's lesson is **energy through day and night**. Every piece of this plan is chosen to make that lesson a decision at the desk: which power source, which heater, which lights, which instruments, and what each one costs after sunset.

## Scope *(Revised)*

**In this plan**

- A catalog per world: each part says where it is offered. Moon-only instruments leave the Mars desk; Mars-only parts never reach the Moon desk.
- The power model: lights, electric heaters and the radioisotope generator carry their own power effects; the world keeps only the base electronics draw.
- Mars bus parts: a radioisotope generator (RTG), deployable solar arrays, an electric heater, a larger battery, and Mars wheels.
- Support hardware: a robotic arm and a mast, as new optional slots offered on Mars.
- The first Mars instruments: weather mast, ground-penetrating radar, laser spectrometer, organics spectrometer. The camera, drill, X-ray spectrometer and neutron spectrometer carry over.
- An affordability check: every relationship answer and every instrument archetype priced against the Mars budget.
- *Revised:* the Mars extensions to the Moon's shared milestone triggers, and a minimum each Mars instrument must earn. The milestones themselves belong to the [Mars sites and milestones plan](mars-sites-and-milestones-plan.md).
- Dust on the panels and dust devils (the power side of dust), since three parts and one relationship depend on them.
- Three Mars relationships (RTG noise, dust, the arm on a slope) and the no-lights entry, with their spoiler guard, plus the review and notebook for Mars and relationships filtered by world.
- A Mars energy and balance check that covers the new parts.

**Not in this plan**

- *Revised:* **Mars sites, areas of interest, new milestones and their rewards.** These go to `mars-sites-and-milestones-plan.md`, written next. This plan gives it the triggers and [the constraints it must respect](#hand-off-to-the-mars-sites-and-milestones-plan-revised).
- The RP unlock tree (open question 3). The catalog is built so parts can later carry an unlock cost, but every Mars part is offered from the start until Owner A decides the tree.
- Mars ticket tiers and budget (open question 8). *Decided (M12):* Mars gets its own ticket tiers, designed separately; it does not keep the Moon tiers. They are needed before Phase 3, because they decide which builds can launch. The reference builds here use the Moon tiers only as a yardstick until then.
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

**Real basis** *(Revised wording)*. Real rovers also spend power at night just to stay alive. Curiosity is said to draw about 45 to 70 W asleep and at least 150 W awake (single-sourced, unverified). Opportunity needed about 120 Wh per sol to survive, and Spirit about 180 Wh. During dust-storm dormancy, Opportunity shut down most systems but kept its mission clock running, and the clock woke the computer from time to time to check the battery. In 2022 Ingenuity's battery could not hold enough charge through some winter nights, and each power loss reset its onboard clock. See [Real anchors](#real-anchors-revised) for sources. The game's 5:1 ratio between awake (1/s) and asleep (0.2/s) is steeper than Curiosity's reported 2 to 3:1. That is a game choice that makes sleeping clearly worth it; the text should not claim the ratio is real.

**On the desk.** The spec sheet gains a **night budget** line for Mars: what one 15 s night costs asleep, and awake with lights, for this build (for example "Night: 3 asleep · 60 with lights · RTG +9"), next to the battery capacity. This is the single most useful number for Mars's lesson, and today the player can only find it by running out of energy. *Decided (M15):* the line also shows the electric heater's draw. The heater is a plain part cost, not a lesson, so there is nothing to give away.

## The Mars catalog

### How a part says where it is offered

- `Part.worlds?: WorldId[]` in `parts.json`. Absent means every world. Mars-only parts carry `["mars"]`; the reflector and seismometer station carry `["moon"]`.
- The catalog stays one file: the build preview, the rover model and the tier quote already read one list, and per-world names already come from `text.partText`.
- `loadGameData(world)` filters `parts.parts` to the world's parts; validation checks that every world still has at least one option in each required slot.
- `upgradeSavedBuild` already drops part ids the catalog no longer has, so a Moon build carried into the Mars desk loses its reflector or seismometer. The desk then shows a one-line notice ("Not offered on Mars: Laser retroreflector") instead of dropping it silently.

### Bus parts

| Part | Slot | Indicative cost / mass / size | Effects | What it teaches |
| --- | --- | --- | --- | --- |
| Radioisotope generator (RTG) | Power | 200 / 15 kg / 5 (M11, decided; draft was 260 / 25 kg / 6) | `steadyIncome` 0.6/s day and night (about 36 per sol, a fixed panel's clear sol), `heat` 2 (waste heat), `neutronNoise` | Power that does not care about night, dust or storms, at a high price and mass, and with neutron noise |
| Deployable solar arrays | Power | 120 / 14 kg / 5 | `energyIncome` 2.6, `dustRate` ×1.5 | The most income in sunlight, the most lost to dust |
| Fixed panel, solar mast | Power | Unchanged (Moon parts) | `dustRate` ×1 (fixed), ×0.8 (mast stands higher) | |
| Larger battery pack | Battery | 150 / 12 kg / 3 (M11, decided; draft was 150 / 26 kg / 4) | `batteryCapacity` 900 | Carry the night instead of avoiding it |
| Electric heater | Heater | 25 / 2 kg / 1 | `heat` 3 while powered, `heaterDraw` 1.2/s at night | Cheap and light, but it spends the battery at night, even asleep; an empty battery means freezing too |
| Radioisotope heater units | Heater | Unchanged | `heat` 2, no draw | |
| LED floodlights | Lights | Unchanged | gains `lightsDraw` 3 (Mars only, see above) | |
| Grouser wheels | Wheels | 110 / 18 kg / 5 | Higher grip on sand (Séítah), slower than mesh | The Séítah crossing |

*RTG income is a balance choice, not the real ratio.* Curiosity's MMRTG gives about 2,700 Wh per sol (roughly 110 to 120 W electric at the start, about 2,000 W of heat, about 45 kg). MER's folding arrays gave about 900 Wh per sol when new and about 600 after 90 sols. So a real RTG out-earns a real array by about 3 to 4 times. The game sets the RTG equal to one fixed panel's clear sol so it does not solve Mars by itself (see [Risks](#risks)); the balance phase can raise it if the RTG never gets picked.

- The RTG has no `energyIncome`, so the low-Sun, storm, shadow and dust factors do not touch it.
- *Revised:* **The RTG's waste heat already counts as a heater.** `missionSetup` adds up `heat` over all parts, so an RTG rover with "No heater" freezes no faster than one with heater units. That is real (the MMRTG's heat keeps Curiosity's electronics warm) and saves 60 on an RTG build. But milestones that require `slots: ["heater"]` (Night drive) would refuse it, so any total heat above zero meets the requirement (M17, decided).
- The RTG and the electric heater are both **interface** items: their numbers depend on Owner B's freeze rate (8/s at night, heater reduction 1.5 per heat unit).
- *Not in this wave:* a rocker-bogie chassis. Its benefit is climbing, and today's slope rule is a single damage threshold; it waits for a mobility pass.

### Support hardware

Two new optional slots, offered only on Mars (the Moon's slot list does not change):

| Part | Slot | Indicative cost / mass / size | Effects |
| --- | --- | --- | --- |
| No arm / Robotic arm | `arm` | 0 / 0 / 0 · 60 / 8 kg / 2 (M11, decided; draft was 90 / 18 kg / 3) | `arm: true`; contact instruments need it |
| No mast / Remote sensing mast | `mast` | 0 / 0 / 0 · 50 / 4 kg / 1 (M11, decided; draft was 70 / 6 kg / 2) | `mast: true`; the laser spectrometer needs it; the camera's photo zones grow (`photoRangeFactor`) |

- Instrument parts gain `needs?: ('arm' | 'mast')[]`. `payloadProblems` refuses an instrument whose support part is missing, with a desk reason ("Needs the robotic arm"); the desk greys the card the same way a full bay does.
- The X-ray spectrometer gains `needs: ["arm"]` **on Mars only**, as the catalog says (on the Moon it keeps Pragyan's built-in deploy mechanism). This is the one per-world effect; it goes in a small `parts` overlay in `data/mars/` (`effects.needs` by part id) rather than a second part. *Revised:* at the draft arm price this turned the X-ray into a 150 cost, 20 kg instrument on Mars; at the decided arm price (M11) it is about 120 and 10 kg. See [Affordability](#affordability-check-revised).
- `BusSlot` stays the six Moon slots; `arm` and `mast` are `SupportSlot`. `Build` gets `support?: Partial<Record<SupportSlot, string>>`, so every Moon build and save is still valid as it is.
- Support parts take no mounting point (the bay's limit is instruments only).

### Instruments on Mars

| Instrument | On Mars | Verb | Indicative cost / mass / size | Energy | Needs |
| --- | --- | --- | --- | --- | --- |
| Science camera | Carries over | Look | Unchanged | None | |
| Regolith drill ("rock drill" on Mars) | Carries over | Dig | Unchanged | Per sample | |
| X-ray spectrometer | Carries over | Touch | Unchanged | Per reading | Arm (Mars) |
| Neutron spectrometer | Carries over, if M3 gives it a target | Sense while driving | Unchanged | Standby | |
| Seismometer station | Moon only | | | | |
| Laser retroreflector | Moon only | | | | |
| **Weather mast** | New | Monitor | 60 / 5 kg / 2 | Standby, small | |
| **Ground-penetrating radar** | New | Sense while driving | 90 / 3 kg / 2 | Standby | |
| **Laser spectrometer** | New | Zap from a distance | 100 / 6 kg / 2 (M11, decided; draft was 140 / 10 kg / 3) | Per reading, large | Mast |
| **Organics spectrometer** | New | Touch | 110 / 4 kg / 2 (M11, decided; draft was 160 / 5 kg / 2) | Per reading, very large; long hold | Arm |

**Why these four first.**

- **Each is a new verb or a new use of the Mars map.** The radar profiles the buried layers while driving. The laser spectrometer reads rocks it cannot drive to, such as the 48 m delta cliff from its foot. The organics spectrometer is slow and power-hungry, so it competes with the night for the battery. The weather mast reads the coming storm.
- **They use what Mars already has.** The delta front, Séítah, the viewpoints, the dust storm and the night are built; no new terrain is needed for the instruments to work (the sites plan may add sites to give them more to do).
- **They pull the power lesson.** The organics spectrometer's energy cost is the biggest single cost on the desk; the weather mast trades a small standby draw for an earlier storm warning; the radar and the neutron spectrometer both want standby while driving.
- **They use the arm and the mast,** so the support hardware is a real choice from the first Mars build.

**Neutron spectrometer on Mars.** It stays only if it has something to find, since the RTG's neutron noise needs it (see [Mars relationships](#mars-relationships-revised)). Without a lunar ice spot it reads a background everywhere. Mars hydrogen (hydrated minerals in the delta) is **interface** content for Owner B and the sites plan: either a hydrogen-rich delta zone, or the neutron spectrometer leaves the Mars desk too. *Revised:* if it stays, its milestone must be one the RTG's noise can cost ([constraint C6](#constraints-the-sites-plan-must-respect)), or the noise lesson changes nothing.

### Mission features

| Feature | Instrument | What the player sees |
| --- | --- | --- |
| Storm watch | Weather mast | While on, the storm forecast comes earlier (`stormEarlyWarningSeconds`) and the HUD shows a pressure and dust trend |
| Subsurface strip | Ground-penetrating radar | A strip under the meters that draws the buried layers along the path just driven; a straight, steady drive gives a clean profile |
| Target reticle | Laser spectrometer | A target marker on a rock within range (`reachM`, several times the X-ray's) in front of the rover; a reading reports the rock as the X-ray does |
| Long hold | Organics spectrometer | A hold measured in tens of seconds, with a progress bar and its energy drawn as it runs; it pauses if the rover powers down |

The rock readout for Mars rocks reuses the X-ray system. *Revised:* the Moon now picks rock types from per-site suites (`instruments.xray.suites`, `Boulder.site`; [rover engineering design](rover-engineering-design.md#rock-types-by-site)), so Mars rocks use the same suites, with Mars rock types in `data/mars/tuning.json` and names in `data/mars/text.json`. Which rocks lie where is the sites plan's content.

## Affordability check *(Revised)*

The Moon taught us that a lesson's answer has to be something the player can buy. There, the ice build with both the neutron spectrometer and the drill came out at least 45 over budget. This section prices every Mars relationship answer and every instrument archetype with the real numbers in `game/data/`: parts and tiers from `parts.json` and `tiers.json`, rewards from `data/mars/milestones.json`, and the draft's indicative prices for new parts.

**How the Mars budget works.** Mars has no fixed budget. The player arrives with the Moon's final balance **B**. That is at least 780 (`minimumBudget.mars`), and the Moon balance tables put good runs at about 825 to 940. To pass, the balance after Mars must reach the Titan mark of 800:

> B − (parts + ticket) + 50 survival + milestone money ≥ 800, so **milestone money needed = spend − B + 750**.

The tables use B = 860, a middle Moon result. Spend above B cannot be bought at all, and 780 is the floor. Today's Mars milestones pay at most 740 together. An idle rover earns 140 (Touchdown and Storm survivor), and game-design.md puts a good camera or drill run at about 420 to 440 in milestone money (470 to 490 with survival). Tiers below are the Moon's, used only as a yardstick because Mars's own tiers are not designed yet (M12, decided), so every mass and size check in this section is provisional. The Moon's: Small up to 60 kg and size 20 for 60, Medium up to 75 kg and 23 for 120, Large up to 90 kg and 26 for 200. Titanium's maximum load is 72 kg.

**Reference builds** (titanium, solid wheels, fixed panel, Li-ion, heater units unless stated):

| Build | Parts | Mass / size | Ticket | Spend | Money needed (B = 860) |
| --- | --- | --- | --- | --- | --- |
| Cheapest camera rover | 430 | 58 kg / 17 | Small 60 | 490 | 380 |
| + LED (for Night drive) | 465 | 61 kg / 18 | Medium 120 | 585 | 475 |
| Camera + drill + LED | 555 | 69 kg / 21 | Medium 120 | 675 | 565 |
| Empty bay + LED | 415 | 58 kg / 17 | Small 60 | 475 | 365 |

**Each relationship's answers at the draft prices:**

| Relationship | Answer | Cheapest build that follows it | Spend | Money needed | Verdict |
| --- | --- | --- | --- | --- | --- |
| RTG neutron noise | *(the cause)* RTG + neutron spectrometer | Titanium, solid, RTG, Li-ion, no heater (RTG heat), neutron: 620, 71 kg / 19, Medium | 740 | 630 | The cause itself is barely playable, so few players will ever meet this lesson |
| | Solar power instead | Steel, solid, panel, Li-ion, heater units, neutron + camera + LED: 455, 79 kg / 20, Large | 655 | 545 | Fits |
| | Leave the neutron spectrometer home | Any build without it | Lower | | Fits |
| Dust on the panels | An RTG | Steel, solid, RTG, Li-ion, no heater, camera + LED: 535, 87 kg / 19, Large (the titanium version is 73 kg, over its 72 kg load) | 735 | 625 | **Does not fit**: it needs about 85% of all Mars money |
| | The higher solar mast | Titanium, solid, solar mast, Li-ion, heater units, camera + LED: 555, 58 kg / 20, Small | 615 | 505 | Fits, if the sites plan raises rewards a little |
| | "A route past dust devils" | Free | | | **Not an answer**: dust devils are random events, so nobody can plan a route past one |
| Electric heater spends the night | Heater units instead | Camera + LED: 585 (the 1 kg extra pushes the rover from Small into Medium; with the electric heater it is 490 Small) | 585 | 475 | Fits |
| | An RTG | As above | 735 | 625 | **Does not fit** |
| | The larger battery (900) | Titanium: 80 kg / 20, over the 72 kg load; steel, mesh, larger battery, electric heater, camera + LED: 500, 86 kg / 22, Large | 700 | 590 | **Does not fit**, and costs more than simply buying heater units |
| | *(proposed)* The nickel-hydrogen pack (600, Moon part) | Steel, solid, panel, NiH2, electric heater, camera + LED: 280, 88 kg / 19, Large | 480 | 370 | Fits |
| The arm cannot reach on a slope | *(the cause)* Arm + X-ray + camera | Steel, mesh (the titanium version is 78 kg, over its load): 600, 84 kg / 23, Large | 800 | 690 | **The cause does not fit**: it is over the 780 floor and needs 93% of all Mars money |
| | *(the cause)* Arm + organics | Steel, mesh: 650, 84 kg / 23, Large | 850 | 740 | **Does not fit**: it needs every Mars milestone |
| | Park on level ground | Free | | | Fits |
| | The laser spectrometer from a distance | Laser + mast alone (titanium, solid): 590, 71 kg / 21, Medium | 710 | 600 | **Does not fit** |
| | Laser alongside a contact instrument (arm + X-ray + mast + laser) | Steel, solid: 91 kg / 25 | | | **Cannot launch** (over 90 kg) |

**What this shows.**

1. **Mass is the real limit, not cost.** The Moon's tiers stop at 90 kg and size 26. The draft's arm (18 kg) and RTG (25 kg) each take more than a quarter of that, and titanium's 72 kg load rules out most titanium versions. Several answers fail on mass before price matters.
2. **Today's Mars rewards cannot pay for any new part.** A good run earns about 430. That covers a spend of about 540 at B = 860, and every archetype in the draft spends 600 to 850.
3. **Two answers are not answers at all:** "a route past dust devils" (luck), and the larger battery (which costs more than the heater units it is meant to replace).

**Decided fixes and open findings** (M11 to M14):

- **Lighter, cheaper support hardware and RTG (M11, decided; revisable in a later balance patch)** (the game already scales every part down): arm 60 / 8 kg / 2, mast 50 / 4 kg / 1, RTG 200 / 15 kg / 5, larger battery 150 / 12 kg / 3 (expensive and light, like Li-ion), organics spectrometer 110 / 4 kg / 2, laser spectrometer 100 / 6 kg / 2. Repriced, the same builds fit the Moon tiers (Mars's own tiers will set the real limits):

| Build (repriced) | Mass / size | Spend | Money needed (B = 860) |
| --- | --- | --- | --- |
| Arm + X-ray | 65 kg / 19, Medium | 620 | 510 |
| Arm + X-ray + camera | 68 kg / 20, Medium | 670 | 560 |
| Arm + organics | 67 kg / 20, Medium | 670 | 560 |
| Mast + laser | 65 kg / 19, Medium | 650 | 540 |
| Mast + laser + camera | 68 kg / 20, Medium | 700 | 590 |
| Arm + X-ray + mast + laser (steel) | 89 kg / 22, Large | 760 | 650 |
| RTG + camera + LED, no heater | 63 kg / 18, Medium | 685 | 575 |
| Electric heater + larger battery + camera + LED | 66 kg / 19, Medium | 600 | 490 |

- **Mars rewards (M13, left for now).** The Mars mission is twice the Moon's length, so its rewards can be larger. The sites plan's starting values aim for a good run with one of these archetypes earning about 500 to 650 in milestone money (constraint C2), so it cannot simply copy the Moon's reward scale. Exact budget requirements and rewards are tuned in future balance patches.
- **Relationship answers (M14, decided: keep the original answers, not reworded).** The affordability findings above stay as **known issues for the balance patch**: an RTG as the dust answer needs about 85% of all Mars money; "a route past dust devils" is luck, not a plan; the laser as the arm's answer does not fit; and the RTG-plus-neutron cause is barely playable. See [Mars relationships](#mars-relationships-revised).
- **Mars ticket tiers (M12, decided):** Mars does not keep the Moon tiers. Its own tiers (open question 8) must be designed **before Mars Phase 3**. The masses and sizes above are checked against the Moon tiers only as a yardstick.

#### Mars ticket tiers (M12, *Decided*)

*Drafted in Phase 0, November 15, 2026; **approved by the user as drafted** the same day. Recorded as Decided in [game-design.md](game-design.md#mars-ticket-tiers-decided).*

| Tier | Mass up to | Size up to | Price | Compared with the Moon |
| --- | --- | --- | --- | --- |
| Small | 60 kg | 20 | 60 | Same |
| Medium | 75 kg | 23 | 120 | Same |
| Large | 90 kg | 26 | 200 | Same |
| **Heavy** | **100 kg** | **30** | **300** | New |

- **Built from:** the M11 prices, the Moon tiers, both plans' sample builds and archetypes, an arrival balance of about 780 to 950, and the fixed 800 Titan mark (MS1 deferred).
- **The first three stay** because every sample build in both plans already lands where the plans assumed. Changing Small or Medium would move every hand estimate while the rewards and the pass test are deferred (M13, MS1). The 60 kg step is where Mars's new parts push a lean rover: lights, an RTG, the arm or the mast each move the camera scout (58 kg) into Medium.
- **Heavy fixes the real problem, the ceiling.** Of 25,758 valid Mars builds (support hardware only when an instrument needs it; a heater unless an RTG), 52% can launch under the Moon tiers, against the Moon data test's "more than 85%". With Heavy, 86%. 100 kg is steel's maximum load, so nothing that launches on steel is overloaded; 300 continues the +60, +80, +100 steps.
- **Heavy is not a balance path.** Heavy builds are three-instrument steel rovers with support hardware, at about 900 or more with the ticket, above most arrival balances. The desk accepts them; the price says why not. The "laser alongside a contact instrument" answer (steel, arm, X-ray, mast, laser) still fits Large at 760.
- **Considered, not adopted:** Small at 65 kg. Six one-instrument builds would drop from Medium to Small (60 cheaper each), more builds would pass, and the RTG would get cheaper. On file for the balance patch.
- **In data:** `game/data/mars/tiers.json`, merged over the shared tiers like the other Mars overlays (Phase 3).

| Build (titanium, solid, fixed panel, Li-ion, heater units unless stated) | Mass / size | Tier | Parts + ticket = total |
| --- | --- | --- | --- |
| Camera scout | 58 kg / 17 | Small | 430 + 60 = 490 |
| Neutron prospector | 59 kg / 18 | Small | 460 + 60 = 520 |
| Fast empty bay (mesh, lights) | 50 kg / 19 | Small | 525 + 60 = 585 |
| Electric heater + larger battery + camera + lights | 66 kg / 19 | Medium | 480 + 120 = 600 |
| Weather watcher (weather mast + camera) | 63 kg / 19 | Medium | 490 + 120 = 610 |
| Arm + X-ray | 65 kg / 19 | Medium | 500 + 120 = 620 |
| Field geologist (camera + drill) | 66 kg / 20 | Medium | 520 + 120 = 640 |
| Radar surveyor (radar + camera) | 61 kg / 19 | Medium | 520 + 120 = 640 |
| Mast + laser | 65 kg / 19 | Medium | 530 + 120 = 650 |
| Rock hound (arm + X-ray + camera) | 68 kg / 20 | Medium | 550 + 120 = 670 |
| Organics hunter (arm + organics) | 67 kg / 20 | Medium | 550 + 120 = 670 |
| RTG + camera + lights, no heater | 63 kg / 18 | Medium | 565 + 120 = 685 |
| Remote geologist (mast + laser + camera) | 68 kg / 20 | Medium | 580 + 120 = 700 |
| RTG geologist (RTG, lights, no heater, camera + drill) | 71 kg / 21 | Medium | 655 + 120 = 775 |
| Empty bay (steel) | 69 kg / 16 | Medium | 290 + 120 = 410 |
| Empty bay + lights (steel) | 72 kg / 17 | Medium | 325 + 120 = 445 |
| Steel RTG + camera + lights, no heater (dust answer) | 77 kg / 18 | Large | 475 + 200 = 675 |
| Steel geologist (steel, arm + X-ray + drill) | 87 kg / 22 | Large | 500 + 200 = 700 |
| Steel, arm + X-ray + mast + laser | 89 kg / 22 | Large | 560 + 200 = 760 |
| Steel, arm + X-ray + organics + drill | 91 kg / 24 | Heavy (cannot launch today) | 610 + 300 = 910 |
| Steel, lights, arm + mast, laser + X-ray + camera | 95 kg / 24 | Heavy (cannot launch today) | 645 + 300 = 945 |

**The empty bay passes on today's rewards.** A titanium empty bay with lights and heater units spends 475. It can earn Touchdown (80), two Odometer stages (60), Mapper (60), both Night drive stages (100) and Storm survivor (60), so it ends at B − 65: it fails below about B = 865 and passes from a good Moon result (Camera scout 930, Rock hound 940). The cause is the carried balance. A pass mark that is a fixed number cannot hold both ends of a 160-wide arrival range with a 50 margin. *Decided (M13): leave it for now.* Exact budget requirements and rewards are tuned in future balance patches. The empty-bay concern stays a **noted risk for that patch**: the options on file are testing the empty bay at the top of the range (B = 950) and the archetypes at the bottom (B = 780), or a Titan test relative to the arrival balance.

## Milestone types *(Revised)*

The Moon builds the shared triggers first (Moon plan M6, recorded in game-design.md, [Rules for the new milestones](game-design.md#rules-for-the-new-milestones)), and Mars Phase 6 reuses that one implementation. This section lists the shapes as decided, then the few extensions Mars needs. Where the draft differed from the Moon, the draft now follows the Moon.

| Trigger | Shape (as decided for the Moon) | Fires when | Mars use |
| --- | --- | --- | --- |
| `transect` | `{ type, instrument, zone, meters, sites? }` | The instrument was switched on for an unbroken drive of at least `meters` that **touches** the zone. Switching it off (by hand or at the low-energy level) starts the count again; a power-down pauses it. `sites` stages one per distinct zone instance | Radar profiles; the neutron spectrometer, if it stays (M3) |
| `reading` | `{ type, instrument, zone?, target?, sites?, rocks?: number[], rock? }` | A use of the instrument finishes. `rocks` stages by distinct rock types read this mission; `rock` needs that type | X-ray, laser and organics readings; a Mars rock collection |
| `record` | `{ type, instrument, event, quality? }` | The instrument was deployed when the event came; the station must have been set down outside the near-lander zone; **the rover's power state does not matter** | Stations in a later wave (a broadband seismometer through a marsquake). Needs the Mars extension below for the weather mast |
| `deploy` | `{ type, instrument, needs?: 'earth', near?: { instrument, withinM } }` | A station is set down outside the near-lander zone, with Earth in view if asked, and near another station if asked | None in this wave (no Mars station); later Mars stations |
| `photo`, `drill`, `zone`, `distance`, `explore`, `night-distance`, `storm-survive` | Exist | | As today |

- **Combos need every listed instrument:** `MilestoneRequirements.instruments?: Instrument[]` (Moon). Mars uses it as is.
- **"Touches", not "crosses".** The draft said the radar drive must cross the zone. It now follows the Moon: touching is enough. A 150 m profile that reaches the delta front is still a real profile. If the sites plan wants a true crossing (for example, all the way across Séítah), it adds an optional `cross?: true` that reuses the `zone` trigger's crossing test. It does not get its own trigger.

**Mars extensions** (each is optional, so every Moon milestone stays valid):

| Extension | Why Mars needs it | Shape (decided) |
| --- | --- | --- |
| `record` for an instrument **aboard** (a switch, like the weather mast), with a lasting event (the 120 s dust storm) | A Moon station is on the ground, so "deployed when the event came" is one moment and power does not matter. A weather mast rides on the rover, and a storm lasts two sols, nights included | `seconds?`: the instrument was switched on, the rover powered up **and outside the near-lander zone**, for at least that many seconds while the event was active (a power-down pauses the count, as for `transect`). Stations keep the Moon rule. See M16 |
| `requires.slots: ["heater"]` met by any `heat` | An RTG rover with "No heater" is warm, but would fail Night drive's requirement | Count the heater requirement as met when the rover's total `heat` is above zero. See M17 |
| Zone ids | Mars zones (`delta-front`, `seitah`, `delta-layers`, `sunset-viewpoint`, and whatever the sites plan adds) | `MarsZoneId` grows; validation checks trigger zones per world |

- *Revised:* **`MilestoneRequirements.support` is dropped** (M18). An instrument cannot be in the bay without its support part (`needs`), so "needs the robotic arm" in the debrief's missed list comes from the instrument's `needs`, with no second field to keep in step.
- **Near the lander.** The 200 m zone (`sampleMinDistanceM`) carries over to Mars for stations and for the `record` extension, so no instrument milestone can be earned by a rover waiting at the lander.

### What each Mars instrument must earn *(Revised; replaces "Mars milestones in this plan")*

The milestones themselves move to the sites plan. This plan sets only the minimum: **every instrument offered on the Mars desk earns at least one milestone that needs it**, on a route a passing build can drive (within about 1.5 km of the lander, as on the Moon). Each instrument archetype must fail without using its instruments.

| Instrument | Earns today | Draft candidate (handed to the sites plan) | Gap |
| --- | --- | --- | --- |
| Camera | Delta layers, Blue sunset | Dust devil photo (needs dust devils, Phase 5) | None |
| Drill | Core sample ×3 | Signs of an ancient lake (`drill` in `delta-front`, exists) | None. The delta front is 2.5 km away, so the sites plan should look for a nearer delta target |
| X-ray | Nothing | None in the draft | **Needs one** (for example a Mars rock collection with `rocks`), or it leaves the Mars desk |
| Neutron | Nothing | None | **Needs one, if M3 keeps it**; it must be one the RTG's noise can cost |
| Weather mast | Nothing | Storm log (`record` + `seconds`, duststorm) | It must not be earnable at the lander (the extension above handles that) |
| Radar | Nothing | Delta stratigraphy (`transect`, `delta-front`, 150 m) | None, if a delta-front target is in reach |
| Laser | Nothing | Rock from afar (`reading`, target `cliff` at the delta-layers zone) | None |
| Organics | Nothing | Organic molecules (`reading`, `delta-front`) | At 2.5 km and 49 W real power it may be out of reach; the sites plan places a target |
| Arm, mast | Through their instruments | | Support parts earn nothing alone, and that is intended |

Sand crossing (capability, `zone` cross at Séítah, exists) stays a candidate for the sites plan too. It adds to the capability money that the empty-bay check above warns about.

## Mars relationships *(Revised)*

Three for this wave, from rover-engineering-design.md's Mars table, plus the no-lights entry below. *Decided (M15):* the electric heater lesson is dropped, so Mars has four lessons: RTG noise, dust, the arm on a slope, and no lights at night. Each relationship is solvable at least two ways (rule 3) and has one desk cause, one mission signal and one plain explanation (rule 4). *Decided (M14):* the original answers are kept as drafted; where they do not fit the budget, that is a known issue for the balance patch ([Affordability](#affordability-check-revised)).

| Relationship | Kind | Fires when | What the player sees | Answers | Real basis |
| --- | --- | --- | --- | --- | --- |
| The RTG adds neutron noise | Conflicts | The neutron spectrometer is on, on an RTG rover | The hydrogen meter's floor is raised and jitters | Solar power; or leave the neutron spectrometer home | Jun et al. (2013), JGR Planets 118:2400: about 60% of DAN's thermal neutron counts at Rocknest came from Curiosity's MMRTG (in the design doc) |
| Dust on the panels | Conditions | Solar income has fallen by a set share to dust | The energy income line shows a dust factor | An RTG; the mast's higher panel; a route past dust devils | rover-engineering/02, dust factor (in the design doc) |
| The arm cannot reach on a slope | Conditions | A contact reading is refused because the ground is steeper than the arm's limit | A refusal notice that names the slope | Park on level ground; the laser spectrometer from a distance | Perseverance's PIXL and SHERLOC must sit close to the rock (in the design doc) |

- `Relationship.world` widens to `WorldId`; the mission, the review and the notebook show only the current world's relationships; the notebook lists each world under its own heading with its own count.
- The fourth Mars lesson is a Moon lesson that also happens on Mars (no lights, so no driving at night); it gets its own Mars entry rather than reusing the Moon id: the cause is the same part, but the place and the real basis differ. It is a hard block, always shown in the review, as on the Moon.
- *Decided (M15):* **The electric heater is a plain part cost, not a relationship.** At 1.2/s it costs 18 per 15 s night (about 4.5% of a 400 battery and 2% of a 900 one), and 180 over ten nights, half of a fixed panel's mission income. The night budget line shows it on the desk. It has no notice or review entry. A cold-battery relationship can replace it in a later wave.
- Moved to a later wave: big labs and driving cannot run together (the organics spectrometer's hold already stops the rover), scout-drill-analyze (needs a lab instrument), sharp rocks wear the wheels (needs wear).

### Spoiler guard *(Revised)*

No milestone, site name, notice, lead, desk line or tutorial line may name a lesson's cause or its fix before the lesson happens. This is the Moon's rule (game-design.md, "No lesson is spoiled"). Desk cards list each instrument's milestones by name only (Moon M14), and the "earns no milestones yet" line follows from that list, so it disappears by itself once an instrument has a milestone. *Decided (MS11):* no milestone is visible to the player before it is reached, and the debrief's "Not reached" list comes after the mission, so a combo's part pairing cannot give a lesson away in advance. There is therefore no ban on combos; they are added only where they make good science.

| Lesson | Where it happens | Why it matters | What keeps text from naming it |
| --- | --- | --- | --- |
| RTG neutron noise | Anywhere the neutron spectrometer is on, on an RTG rover | Only if a neutron milestone can be lost to the raised floor (C6); otherwise it is cosmetic | The RTG's desk card says nothing about neutrons, and the neutron card says nothing about power sources. Neutron milestone text says only "survey" or "locate". The grep test adds "noise", "generator" and "RTG" for neutron texts |
| Dust on the panels | Every solar rover, sol by sol; worst for the deployable arrays | Late-mission income, so late milestones and night driving | The desk shows no `dustRate`. Part descriptions say "more income" and "stands higher", never "less dust". **The Dust devil milestone's fact must not be Spirit's panel cleaning**: use another dust devil fact, and keep the cleaning story for the notebook entry. Weather mast and storm texts talk about the storm, not about panels |
| The arm cannot reach on a slope | A contact reading tried on steep ground | A lost reading and the time spent to reposition | The arm's desk card does not mention slopes or level ground. Contact-reading milestone texts do not say "level" or "flat". The laser's milestone text (for example "Rock from afar") never compares the laser with the arm. Some attractive contact targets sit on slopes, so the lesson can happen (C7) |
| No lights, no night driving (Mars entry) | Dusk, on a rover without lights | No night driving; Night drive cannot be earned | A hard block, so the desk and review state it openly, as on the Moon. The guard does not apply |

Phase 5's text review checks every new Mars text against this table, as the Moon's Phase 5 does.

### Stations and deployables *(Revised)*

No Mars station ships in this wave: the seismometer station and the reflector are Moon-only, the weather mast is a switch aboard the rover, and the heat flow probe comes later. **Decided rule for later Mars stations** (a broadband seismometer, the heat flow probe, or a deployable weather station): they follow the Moon's near-lander rule. That means the 200 m zone, the "Too close to the lander to count" hint and the second press to confirm, `record` and `deploy` outside the zone, and a station that records whatever the rover's power state. Mars has no Earth in the sky, so no Mars `deploy` uses `needs: 'earth'`.

## Hand-off to the Mars sites and milestones plan *(Revised)*

A separate plan, `mars-sites-and-milestones-plan.md`, written after this one, owns Mars sites, areas of interest, new milestones and their rewards, and Mars rock suites. This plan gives it the triggers above and the following.

### Constraints the sites plan must respect

| # | Constraint |
| --- | --- |
| C1 | **Use the shared triggers** (`reading`, `transect`, `record`, `deploy`, `instruments[]`) and only the Mars extensions in [Milestone types](#milestone-types-revised). A new trigger needs a reason no extension can meet, and must be agreed with the Moon's owner, because `milestones.ts` is shared |
| C2 | **Price for Mars spending.** Instrument archetypes spend about 600 to 760 even at the M11 prices. A good run with each must earn at least spend − B + 750 + 50 margin at B = 780, the lowest arrival. Today's rewards (at most 740, a good run about 430) are not enough |
| C3 | **The empty bay and idling fail at the top of the arrival range** (B = 950, about the best Moon result). Today an empty bay with lights ends at B − 65, so either capability rewards come down (as the Moon cut Boulder field and Mapper), new capability milestones (Sand crossing, Clean run) are priced low. *Decided (M13):* left for the balance patch; the empty-bay concern is a noted risk until then |
| C4 | **Every instrument on the Mars desk earns at least one milestone** that needs it, on a route a passing build can drive. X-ray and neutron (if M3 keeps it) have none today. An instrument with nothing to earn leaves the Mars desk instead |
| C5 | **Density over distance.** The delta front sample point is a 2.5 km drive and the cheap build covers about 2 km per mission, so instrument milestones that live only at the delta front are out of reach for most builds. Put a target for each instrument within about 1.5 km (Rocky area 2 at 224 m, Rocky area 1 at 744 m, Séítah entry at 1,230 m, delta viewpoint at 1,482 m) |
| C6 | **The RTG noise lesson must be able to cost something.** If the neutron spectrometer stays, its milestone must depend on the meter rising above its floor (a small target found by the reading, not just "switched on in the zone"), so a noisy meter can miss it |
| C7 | **The arm lesson must be able to happen.** Some contact targets that are worth reading should sit on slopes steeper than the arm's limit, and level ones must exist too, so "park level" works |
| C8 | **Spoiler guard.** Follow the [table above](#spoiler-guard-revised), especially the Dust devil fact and the arm and laser wording. Site notices are instrument-aware but lesson-blind, as on the Moon |
| C9 | **Near the lander.** No instrument milestone counts within 200 m of the lander. Stations follow the Moon's rule; aboard instruments follow the `record` extension |
| C10 | **The Mars ticket tiers set the limits** once designed (M12, decided: Mars gets its own tiers, needed before Phase 3). Until then the Moon's 90 kg and size 26 are only a yardstick. No milestone may need a build that cannot launch under them (for example, a combo of the arm, a contact instrument, the mast and the laser on steel is right at the limit) |
| C11 | **Combos are allowed** (MS11, decided). No milestone is visible before it is reached, desk cards list names only and the debrief's "Not reached" list comes after the mission, so a combo's pairing cannot give a lesson away. Add combos only where they make good science; wording still never spells out a lesson (C8) |
| C12 | **Honest placement.** Anything placed by design (a hydrated zone, a rare rock) is marked as such in the facts, as on the Moon |

### Inputs for the sites plan

- **Mars map today** (from game-design.md, [Site: Jezero crater](game-design.md#site-jezero-crater)): drive distances of Rocky area 2 (fresh crater, 224 m), Rocky area 1 (block field and survey lead, 744 m), Séítah entry (1,230 m), Delta viewpoint (1,482 m), Delta front sample point (2,501 m) and West sunset viewpoint (3,616 m). Soft ground only at Séítah.
- **Mars zones today:** `delta-front`, `seitah`, `delta-layers`, `sunset-viewpoint` (`MarsZoneId`), plus the 200 m sample spacing and the 300 m Blue sunset distance.
- **Rewards today** (`data/mars/milestones.json`): Touchdown 80, Odometer 30 per stage (500 m, 1.5 km and 3 km), Mapper 60, Night drive 50 per stage (100 m and 300 m), Storm survivor 60, Delta layers 100, Core sample 60 per site (×3), Blue sunset 70.
- **The draft's candidate milestones**, for the sites plan to keep, change or drop: Sand crossing, Signs of an ancient lake, Delta stratigraphy (radar), Rock from afar (laser), Organic molecules (organics), Storm log (weather mast), Dust devil (camera). Their real basis is in [Real anchors](#real-anchors-revised).
- **Archetypes to balance:** cheap camera, camera and drill, the RTG, the arm and X-ray, the arm and organics, the mast and laser, the weather mast, the radar, plus the empty bay and idling. Spend for each is in [Affordability](#affordability-check-revised).
- **Inputs the sites plan depends on:** M3 (Mars hydrogen, still proposed), M11 (prices, decided), M12 (Mars tiers decided but not yet designed), M13 (pass test, left for the balance patch), and Phase 5 (dust devils exist).

## Real anchors *(Revised)*

Real values from our research notes, so indicative numbers can be checked against reality in the balance phase. File names: [02](research/rover-engineering/02-rover-subsystems.md) rover subsystems, [03](research/rover-engineering/03-surface-environments-and-operations.md) surface environments and operations, [01](research/rover-engineering/01-rover-missions-history.md) mission history. Each note holds the original source link; anything marked *unverified* there stays unverified here and is checked before it reaches `text.json`. *Revised:* the rows marked "checked November 15" were checked again for this revision (sources below the table).

| Part or rule | Real value | Notes |
| --- | --- | --- |
| Solar arrays | MER: folding arrays, 1.3 m², up to 140 W, about 900 Wh/sol new, about 600 after 90 sols. Zhurong needed about 140 W from its arrays to wake | 02, Surface power sources compared; Energy budget per sol |
| RTG | MMRTG: roughly 110 to 120 W electric at the start (sources give 110, 120 and 125), about 2,000 W heat, about 45 kg (43.6 kg in NASA slides), about 2,700 Wh/sol. The waste heat runs a fluid loop that keeps the electronics warm at night | 02; checked November 15 (DOE). Quote a range, never one figure |
| Battery | Perseverance: two lithium-ion batteries of about 43 Ah each (checked November 15, JPL); the 2,408 Wh and 29 kg in the notes are unverified. MER: two 8 Ah packs that must stay above −20 °C to discharge and 0 °C to charge | 02, Batteries |
| Night survival | Opportunity's floor about 120 Wh/sol; Spirit's about 180 Wh. Curiosity 45 to 70 W asleep, 150 W or more awake (single-sourced). *Revised:* in dormancy Opportunity kept its mission clock running, and the clock woke the computer to check the battery; Spirit's hibernation also kept some survival heaters on, so "everything off except a clock" overstates it | 03, Data and energy budgets; 02, Power modes; 01, Spirit; checked November 15 (Planetary Society) |
| Ingenuity's winter | *Revised:* in 2022 the battery did not hold enough charge through some winter nights; the power loss reset the onboard clock each time. "Froze" is not the source's word | Checked November 15 against secondary coverage quoting JPL (Universe Today); no NASA primary source found yet |
| Heaters | A radioisotope heater unit gives about 1 W of heat (MER carried 8). MER's warm electronics box used aerogel, electric heaters and heater units; nights reached −105 °C there | 02, The warm electronics box |
| Lights | *Revised:* **No Mars rover carries floodlights for driving,** and real sols end in sleep. We found no source either way on whether any Mars rover has ever driven at night, so the text does not claim it. Curiosity's arm camera (MAHLI) has its own white and ultraviolet LEDs and has taken close-up pictures at night. VIPER, on the Moon, was designed with headlights; it has not flown | 03, typical sol plan; checked November 15 (JPL, 2013) |
| Dust on panels | About 0.2% of output lost per sol typically (0.05% to 2% observed); Pathfinder 0.28% per day. Zhurong: 20% cover caused problems, above 40% it never woke (unverified) | 02, Dust on the panels; 01, Zhurong |
| Dust devils | *Revised:* a cleaning event around sol 420 (March 2005) sharply raised Spirit's solar output. Sources disagree on the gain (about 50%, "over 800 Wh", 93% of original), so the text names no percentage | 03, Dust devils and cleaning events; checked November 15 (NASA Photojournal) |
| Dust storm | *Revised:* between June 1 and about June 8, 2018, Opportunity's output fell from about 645 Wh to about 22 Wh, at a record dust opacity (tau) of 10.8; contact was lost by June 10. Recharging needs tau below about 2 | 03, Dust storms; checked November 15 (Planetary Society). game-design.md says "in 10 days": flagged to its owner |
| Wheels | *Revised:* Curiosity: 50 cm aluminum wheels, holed by sharp rocks from 2013 (traction control cut the load on the leading wheels by up to 20%). The grouser count is contested (24 chevrons in NASA press material, 19 in a JPL wheel report), so the text gives no number. Perseverance: 48 gently curved grousers, skin about twice as thick | 02, Wheels and grousers; checked November 15 (JPL Mars 2020 press kit) |
| Soft sand | Opportunity at Purgatory: wheels dug in over 10 cm, five weeks to escape. Spirit at Troy: stuck for good from 2009 | 02, Terramechanics; 03 |
| Arm | Curiosity: 2.1 to 2.2 m, 33 kg turret. Perseverance: 2.1 m, 45 kg turret. No arm power figure in the notes | 02, Arms |
| Mast | Nothing in the notes for a Mars mast | |

**Real basis for the candidate milestones** (*Revised*, for the sites plan):

| Candidate | Safe wording | Status |
| --- | --- | --- |
| Delta stratigraphy (radar) | RIMFAX profiled layers beneath Jezero's crater floor (Hamran et al. 2022, Science Advances, doi:10.1126/sciadv.abp8564) | Crater floor: verified from the abstract. Profiles of the delta itself appear only in an LPSC abstract (Russell et al. 2023), *not verified*. Do not say "the delta" until checked |
| Rock from afar (laser) | SuperCam's laser analyzes rocks up to about 7 m away | Checked (CNES); its Raman range is quoted differently, so it is not used |
| Organic molecules (organics) | SHERLOC detected signals consistent with organic molecules in Jezero rocks; it identified no specific compounds, and non-biological sources are not ruled out (Sharma et al. 2023, Nature 619) | Checked from summaries. Never say "found organic molecules" or "signs of life" |
| Storm log (weather mast) | MEDA and REMS keep weather records | Unchanged |
| Signs of an ancient lake (drill) | Wildcat Ridge, the delta mudstone Perseverance cored in July 2022 | Already in game-design.md |
| Sand crossing | Spirit was stuck in sand at Troy in 2009 | Already in game-design.md |

What this changes in the plan:

- **Dust is compressed, like time.** At the real 0.2% per sol, ten sols would lose 2%, too little to feel. The game's rate is a game-feel choice, as the 3× faster night is; the text says dust settles steadily, not how fast.
- **Night driving with lights is a game choice, not history.** game-design.md already decided the lights-on-or-sleep choice. *Revised:* Mission history text and the night tutorial must not say real Mars rovers drive at night or carry floodlights. They can say real rovers sleep through the night, and that NASA's VIPER, a Moon rover, was designed with headlights for dark craters (it has not flown).
- **The arm is heavier than first sketched,** so the draft gave it 18 kg (the real turrets alone are 33 to 45 kg). *Revised:* that does not fit the Moon tiers alongside a contact instrument (see [Affordability](#affordability-check-revised)), so M11 decided 8 kg. The game scales every part down: the Moon's drill is 8 kg.

**Sources checked for this revision:** JPL, "Mars Rover Curiosity Uses Arm Camera at Night" (jpl.nasa.gov/news/mars-rover-curiosity-uses-arm-camera-at-night); Universe Today, "Ingenuity is doing surprisingly well" (quoting JPL); Planetary Society, MER update on Opportunity's dust storm sleep (planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep) and MER update 4 (planetary.org/articles/07-31-mer-update-4); NASA Photojournal, "Solar Panel Dust Accumulation and Cleanings"; US DOE, "Powering Curiosity: Multi-Mission Radioisotope Thermoelectric Generators"; JPL Mars 2020 press kit, rover and power pages; Hamran et al. (2022), Science Advances; Sharma et al. (2023), Nature 619; CNES SuperCam page. Several were read only as search summaries; each fact is checked again before it reaches `text.json`.

## Phases

Each phase ends with tests and the build passing, a browser check on both worlds, and a commit. Mechanics settled during a phase go back into game-design.md as "decided during implementation".

### Phase 0: Design first

- Owner A and Owner B agree on this plan's *Proposed* items, at least the [decisions needed](#decisions-needed).
- *Decided:* M11 to M14 are settled: reprice (M11); Mars ticket tiers to be designed (M12); budget requirements and rewards left for the balance patch (M13); original relationship answers kept (M14). **Design the Mars ticket tiers before Phase 3**, because prices and masses decide which builds can launch.
- game-design.md: the Mars parts (open question 8 answered for this wave), the power model in [How the Mars rules work](game-design.md#how-the-mars-rules-work-decided-during-implementation-m3), the Mars trigger extensions next to the Moon's in [Rules for the new milestones](game-design.md#rules-for-the-new-milestones).
- rover-engineering-design.md: section 8 marks which instruments are built for Mars; section 9 records the bus parts; section 10 records the three Mars relationships with their original answers (the heater lesson is dropped, M15).
- *Revised:* `mars-sites-and-milestones-plan.md` is written against this plan's [constraints](#constraints-the-sites-plan-must-respect), and its Phase 0 records the Mars milestones.

**Done when:** both docs say *Decided* for everything Phases 1 to 4 build.

**Status (November 15, 2026): done, except the Mars tiers and Chieri's review.** game-design.md `d596eba` records the Mars parts, the power model, the support hardware, the instruments and the night budget line, the four Mars lessons, the Mars trigger extensions next to the Moon's, and (from the sites plan) the sites, milestones, rock types and balance targets. rover-engineering-design.md `2bf2e0a` records sections 8, 9 and 10 (the heater lesson dropped, M15; the combo ban lifted, MS11). Still waiting:

- ~~**The Mars ticket tiers** (M12)~~: approved by the user as drafted, November 15 ([Decided](#mars-ticket-tiers-m12-decided)).
- **Chieri's review** of the items below. "Owner A and Owner B agree" is recorded as the user's decision, provisional pending that review.

Small details settled while writing Phase 0 down are marked "decided in Phase 0" in game-design.md:

- `reading.sites` keeps the Moon's built rule (a new site is a reading 200 m from earlier ones), not distinct `Boulder.site` values; no Moon milestone uses it yet.
- `transect.zone` becomes optional: a transect with no zone counts only outside the near-lander zone (Long profile).
- `RecordEvent` gains `night` and `dustdevil`; `PhotoTarget` gains `crater-wall` and `dustdevil`.
- The hydrated ground reuses the Moon's `hydrogenZoneRadiusM` (25 m on Mars) and `anomalyEdge` (34%, one straight line), not a new `anomalyCoreM` key.
- Starting values the plans left open: weather mast 0.05/s, radar 0.1/s, laser 8 per reading with a 2 s hold and a 12 m reach, organics 1.5/s over a 20 s hold, the mast's `photoRangeFactor` 1.5, the weather mast's 30 s earlier forecast, grouser wheels (2.6 m/s, grip 0.95, 0.22 energy/m), dust 3% per sol (×3 in the storm), a dust devil every 3 sols on average that cleans within 50 m, the dust lesson at a 15% income loss, and RTG noise (floor +15%, jitter ±13%).
- Clean run on Mars pays 0 money and 10 RP until the balance patch, so it adds nothing to the idle and empty-bay money that is already a noted risk.
- The lesson (energy through day and night) and the mission length (10 sols) are recorded as confirmed for Owner A, since both plans build on them.

#### Items for Chieri's review

The user decided we build Owner B's items ourselves; each is marked "provisional, for Chieri's review" in game-design.md.

| # | Item | Where it is recorded | Builds in |
| --- | --- | --- | --- |
| B1 | Dust on the panels: 3% per sol times each part's `dustRate`, three times faster in the storm, the HUD's dust factor, the dust lesson at 15% | game-design.md, Dust and events | Phase 5. *Pure rules built in combined step 1c (`rules/dust.ts`, `c1f6404`), with a 0.25 floor; energy wiring built in step 2 (`1a1979f`); the HUD's dust factor waits for step 6c* |
| B2 | Dust devils: about one every 3 sols (MS8), cleaning within 50 m, a moving column to photograph and record | Dust and events | Phase 5. *Schedule and pass rules built in step 1c (`c1f6404`); scheduling, placement at the rover and cleaning wired in step 2 (`1a1979f`, `86d3dcf`); the column, the notice and the photo wait for step 6; open: devils in the storm, driving to a devil* |
| B3 | Mars hydrogen (M3): the neutron spectrometer stays on Mars; the hidden hydrated ground near (780, 420) with a 25 m core; Séítah and the delta foot at 15%; the 10% floor; the RTG's raised floor and jitter | New Mars milestones | Sites plan Phases 2 to 4 |
| B4 | Site placement: the three clusters, the new site kinds, East crater and the fourth lead (MS6), the flood boulder (MS3), slope targets, boulder counts at the new sites, the Mars `sites.json` overlay, rock suites by site | New sites and areas of interest; Mars rock types | Sites plan Phases 2 and 4 |
| B5 | Mars terrain pipeline requests MP1 to MP6 to `build_terrain_mars.py` | Sites plan Phase 1 | Sites plan Phase 1. *MP1 to MP4 and MP6 built in step 1b (`mars_sites.py`, `e532e07`, `6949397`, `e3e0003`); MP5 waits for the hydrated ground. Open: a second fresh crater (NE); "blocky rim" wording; sample names not fact-checked* |
| B6 | Triggers and placement of the 20 new milestones, including Sand crossing's rule and Clean run on Mars (MS7) | New Mars milestones | Sites plan Phases 2 and 3 |
| B7 | Changes to the built milestones: Blue sunset 70 → 100; Signs of an ancient lake on the 50 m `delta-foot` zone (MS5); Night drive's heater requirement met by any heat (M17); Core sample's fact (Wildcat Ridge moves); Night drive's −83 °C source; Rocky area 2 re-measured | New Mars milestones | Sites plan Phase 2. *M17 (heater met by any heat) built in step 2, in `rules/rover.ts` `meetsRequirements`* |
| B8 | Fact corrections in the built Dust and events table: the 2018 storm "in about a week", not "in 10 days"; no percentage for Spirit's cleaning | Dust and events | Text, Phase 5 |
| B9 | The weather mast moves the storm forecast 30 s earlier | Mars rover design | Phase 4 |
| B10 | The night drain moves onto parts: `night.lightsDrainPerSecond` goes away and the LED carries `lightsDraw` 3/s (same numbers; interface, M1) | How the Mars rules work | Phase 2. *Built in step 2 (`1a1979f`); `marsNight.test.ts` unchanged* |
| B11 | The electric heater (heat 3, only while its 1.2/s draw is paid) and the RTG's heat 2, against the 8/s freeze rate (interface) | Cold at night; Mars rover design | Phases 2 and 3. *Rules built in step 2 (`heaterDraw`, `steadyIncome`, `heatNow`, tested with fixture parts); the parts arrive in step 3* |
| B12 | Grouser wheels' feel on Séítah's sand (grip 0.95, 2.6 m/s) | Mars rover design | Phase 3 |
| B13 | The arm's 10° slope limit (MS2) against the 18° steep-slope warning | Mars rover design | Phase 4 |

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
- Desk: the night budget line on the spec sheet (its heater part depends on M15).

**Done when:** `marsNight.test.ts` passes unchanged with today's parts, and new tests cover an RTG rover at night, an electric heater asleep, and the Moon unaffected.

### Phase 3: Mars bus parts and support hardware

- **Prerequisite:** the Mars ticket tiers are designed (M12).
- `parts.json`: the RTG, deployable arrays, larger battery, electric heater, grouser wheels, arm and mast parts, each `worlds: ["mars"]`, at the prices M11 decides.
- `SupportSlot`, `Build.support`, `parts.supportSlots` per world (Mars overlay); `selectedParts`, `isCompleteBuild`, `missingSlots`, the quote and the tier check include support parts.
- `needs` on instrument parts; `payloadProblems` and the desk enforce it; the Mars X-ray overlay.
- Build preview and rover model: the RTG fins at the back, the deployable arrays as wings, the mast with a head, the arm folded at the front.
- Build enumeration: `allBuilds` per world, with support slots, for the affordability data test (no Mars `winPaths` model; see MS13 in the sites plan).
- *Revised:* a data test that every reference build in [Affordability](#affordability-check-revised) can launch (under the Mars tiers, once designed), and that reports which relationship answers can be bought below 780. The known failures (M14) are listed, not asserted, until the balance patch.

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
- Mission history facts and sources for each, fact-checked before they go into `text.json` (safe wording in [Real anchors](#real-anchors-revised)).

**Done when:** each works in the browser on a rover that carries it, refuses clearly when it cannot be used (no arm, no mast, slope, energy), and has unit tests.

### Phase 5: Dust on the panels and dust devils (Owner B)

Designed in game-design.md (*Proposed* there) and listed as "next after the demo" in the Mars plan; needed here because the arrays, the mast and the RTG differ by dust.

- `tuning.dust`: a share of solar income lost per sol, times the power part's `dustRate`; the storm adds more.
- Dust devils: a rare event that resets the dust factor, drawn as a moving column the camera can photograph.
- HUD: the energy income line shows the dust factor.

**Done when:** a solar rover ends the mission with visibly less income than it started with, an RTG rover does not, and a dust devil can clean the panels and be photographed.

### Phase 6: Milestones and relationships *(Revised)*

- **No new trigger code beyond the Mars extensions.** `reading`, `transect`, `record`, `deploy` and `instruments[]` come from the Moon plan's Phase 3 (one implementation, Moon first). Mars adds `record.seconds`, the heater-by-heat requirement and Mars zone ids, with tests. `MarsMilestoneTrigger` keeps only the Mars-only types (`night-distance`, `storm-survive`).
- The Mars milestones from `mars-sites-and-milestones-plan.md` in `data/mars/milestones.json`; validation checks their instrument ids and zones per world.
- The three Mars relationships (RTG noise, dust, the arm on a slope) in `relationships.json` with `world: "mars"`, their checks in `rules/relationships.ts`, build predicates for the review, and notebook text; the original answers (M14). The no-lights entry is a hard block, as on the Moon.
- Desk cards list each Mars instrument's milestones by name (as on the Moon), from the same derivation.
- Debrief: the missed-milestones list names a missing support part from the instrument's `needs` ("needs the robotic arm").
- Spoiler check: the Moon's text grep extended with the Mars lessons' key words ([Spoiler guard](#spoiler-guard-revised)).

**Done when:** every new milestone can be earned on purpose in the browser, each relationship can be triggered and shows its notice once, the review shows a Mars lesson only after it was met on Mars, and no Mars text fails the guard.

### Phase 7: Balance, text and playtest

- A Mars energy check that covers the new parts, extending `marsNight.test.ts`. *Decided (MS13):* no Mars `winPaths` model; balance is by hand estimates and browser playtests. The check covers the cheap build, an RTG build, an arrays-and-big-battery build, and an organics build, each over the storm seeds.
- Targets (for the hand estimates and playtests): several builds pass Mars (the Moon's "several ways to pass" rule); an RTG is never the only way; an electric heater build can survive if it sleeps; no build passes while idling at the lander. *Revised:* each archetype passes from B = 780 and fails without its instruments; the empty bay fails from B = 950; every relationship answer is affordable. *Decided (M13, M14):* exact budget requirements and rewards are tuned in a future balance patch, which also takes the known affordability issues and the empty-bay risk.
- Tutorial: a Mars design page for power at night (the night budget line, RTG versus arrays, the two heaters) and a support hardware paragraph; drive tutorial lines for the four instruments.
- Credits: sources for the new parts, instruments and relationships.
- A Mars playtest checklist, as for the Moon.

**Done when:** the balance targets hold in the energy check, the hand estimates and the playtests, the playtest checklist is run, and game-design.md marks each piece built.

### Shipping

Phase 1 can ship alone. Phases 2 and 3 ship together (the power parts are the point of the power model). Phases 4 to 6 ship together, so new instruments arrive with their milestones and relationships; Phase 5 can go before them if Owner B has time. *Revised:* Phase 6 waits for the Moon's shared triggers and for the sites plan's milestones.

## File map

| Area | Files |
| --- | --- |
| Types | `rules/types.ts` (`Part.worlds`, `PartEffects` power and support fields, `SupportSlot`, `Build.support`, `Relationship.world`; the shared triggers come from the Moon plan), `rules/marsTypes.ts` (`record.seconds` if kept Mars-side, `MarsZoneId`, `DustTuning`) |
| Data | `data/parts.json`, `data/mars/parts.json` (new: per-world effect overlay), `data/mars/tuning.json` (`dust`, instruments, rock suites), `data/mars/milestones.json` (from the sites plan), `data/mars/events.json` (dust devils), `data/relationships.json`, `data/mars/text.json`; `src/gameData.ts` filters and merges parts per world |
| Rules | `rules/payload.ts` (`needs`, world filter in `upgradeSavedBuild`), `rules/rover.ts`, `rules/quote.ts`, `rules/energy.ts`, `rules/cold.ts`, `rules/mission.ts`, `rules/instruments.ts`, `rules/milestones.ts` (Mars extensions only), `rules/relationships.ts`, `rules/validate.ts`, `rules/balance.ts`, `rules/winPaths.ts` |
| Desk | `ui/designScreen.ts` (support slots, night budget, dropped-part notice, milestone names on cards), `ui/buildPreview.ts`, `rover/roverModel.ts`, `ui/ticketScreen.ts` (review per world), `ui/tutorialText.ts` |
| Mission | `ui/missionScreen.ts`, `ui/hud.ts` (radar strip, storm trend, dust factor, long-hold bar), `ui/marsMission.ts`, `world/` (dust devil) |
| Screens | `ui/screens.ts` (debrief log, notebook per world), `ui/notebook.ts`, `ui/creditsScreen.ts` |

## Tests

- **Regression:** `marsNight.test.ts` unchanged after Phase 2; every Moon test unchanged throughout (the Moon desk, quote, balance, relationships and the shared triggers must not move).
- **New:** per-world catalog and save carry-over; part draws (lights, electric heater asleep, RTG income at night and in the storm); support needs; each new instrument rule; the Mars trigger extensions (`record.seconds` with power-downs and the near-lander zone, heater met by RTG heat); the three Mars relationships and their build predicates; dust and dust devils; the Mars balance check. *Revised:* affordability (every reference build launches under the Mars tiers; answers' costs are reported, with the M14 known issues listed) and the spoiler grep for Mars texts.

## Risks

| Risk | Why | Mitigation |
| --- | --- | --- |
| The RTG solves Mars by itself | Steady power removes the night puzzle | High cost and mass, a heavier ticket, neutron noise, and an income no higher than a panel's clear sol; balance target "an RTG is never the only way" |
| *Revised:* The RTG is never picked | At the draft price it needs 85% of all Mars money | M11 price; the sites plan's rewards (C2); hand estimates and playtests show how often it passes (no Mars `winPaths`) |
| *Revised:* Answers the player cannot buy | Mars tiers are not designed yet; the carried balance is 780 to about 950; the original answers are kept (M14) | Mars tier design before Phase 3 (M12); [Affordability check](#affordability-check-revised); Phase 3 data test; known issues go to the balance patch |
| *Revised:* A capability-only Mars run passes | The carried balance shifts every Mars result by up to 160 | C3; a noted risk for the balance patch (M13, left for now) |
| Support slots touch the build shape again | `Build` is used everywhere | Optional `support` field, so Moon builds and saves are untouched; same approach as Phase 1 of the payload bay plan |
| Mars desk overload | Eight slots, ten instruments, two heaters, three power sources | The night budget line does the explaining; the review only shows what was met; instruments stay at four new ones |
| Instruments without content | The neutron and X-ray spectrometers have no Mars milestone; the laser needs targets | C4 for the sites plan; decide Mars hydrogen with Owner B before Phase 4, or take the neutron spectrometer off the Mars desk |
| *Revised:* Shared triggers diverge | Two plans, one `milestones.ts` | Mars uses the Moon's shapes and adds only the listed optional extensions |
| Real numbers that do not hold up | Some anchors are unchecked, and sources disagree on the MMRTG and Spirit's cleaning | Every fact and source is checked before it reaches `text.json`; ranges, not single figures |
| Teaching something false about the night | Real Mars rovers sleep at night and carry no floodlights | Keep the lights-on choice as a stated game choice; history text says real rovers sleep |
| Balance model build count | Support slots and more instruments multiply builds | Enumerate per world and only valid support and bay combinations; sample if slow |

## Decisions needed

| # | Question | Proposal (M11 to M19: **Decided**, November 15, 2026) | Owner |
| --- | --- | --- | --- |
| M1 | Parts own their draws (lights, electric heater, RTG), the world keeps the electronics draw | Yes, Mars only for now | Interface |
| M2 | Seismometer station and retroreflector off the Mars desk | Yes, until a marsquake exists | Owner A |
| M3 | Mars hydrogen for the neutron spectrometer | A hydrated-mineral zone at the delta, or the instrument leaves the Mars desk. *Revised:* if it stays, its milestone must be one the RTG's noise can cost (C6) | Owner B, with the sites plan |
| M4 | The first four Mars instruments | Weather mast, radar, laser spectrometer, organics spectrometer | Owner A |
| M5 | Arm and mast as optional slots offered only on Mars | Yes | Owner A |
| M6 | The X-ray spectrometer needs the arm on Mars | Yes, as the catalog says (M11's arm price is adopted) | Owner A |
| M7 | Milestone triggers | *Revised:* decided by Moon M6. Reuse the Moon's `reading`, `transect` ("touches"), `record` (stations: any power state), `deploy` and `instruments[]`; Mars adds only the extensions in M16 and M17 | Interface |
| M8 | Dust on the panels and dust devils in this plan | Yes, Phase 5 | Owner B |
| M9 | Mars relationships in this wave | Three: RTG noise, dust, the arm on a slope, with the original answers (M14), plus the no-lights entry. The heater lesson is dropped (M15) | Interface |
| M10 | Unlocks | All Mars parts offered from the start until the unlock tree is decided | Owner A |
| M11 | *New.* At the draft prices the arm builds, the RTG and the laser cannot be bought or cannot pass, and several cannot launch. Reprice? | **Decided: reprice as proposed** (indicative, revisable in a later balance patch): arm 60 / 8 kg / 2, mast 50 / 4 kg / 1, RTG 200 / 15 kg / 5, larger battery 150 / 12 kg / 3, organics 110 / 4 kg / 2, laser 100 / 6 kg / 2 | Owner A |
| M12 | *New.* Mars ticket tiers | **Decided: design separate Mars ticket tiers.** Mars does not keep the Moon tiers. Needed before Mars Phase 3. C10 now says the Mars tiers set the limits once designed. **Tiers decided November 15: the user approved the draft as written: the Moon's three plus a Heavy tier (100 kg, size 30, 300); see [Decided](#mars-ticket-tiers-m12-decided)** | Owner A |
| M13 | *New.* An empty-bay Mars run passes from a good Moon result, because the pass mark is fixed and the carried balance varies by about 160 | **Decided: leave it for now.** Exact budget requirements and rewards are tuned in future balance patches. The empty-bay concern stays a noted risk for that patch (the options: balance the empty bay at B = 950 and the archetypes at B = 780, or a relative Titan test) | Owner A, with the sites plan |
| M14 | *New.* Reword relationship answers that do not fit | **Decided: keep the original answers, not reworded.** Dust: an RTG, the mast's higher panel, a route past dust devils. Arm: park on level ground, or the laser spectrometer from a distance. The affordability findings (RTG as the dust answer does not fit, dust devils are luck, the laser does not fit) are known issues for the balance patch | Interface |
| M15 | *New.* The night budget line shows the electric heater's draw on the desk, which gives away "An electric heater spends the night" | **Decided: drop as proposed.** The heater is a plain part cost, like the reflector's need for Earth; the night budget line stays (it is Mars's main teaching tool). Mars has four lessons: RTG noise, dust, the arm on a slope, and no lights at night. A cold-battery relationship can replace it in a later wave | Interface |
| M16 | *New.* `record` for an instrument aboard the rover during a lasting event (the weather mast through the storm) | **Decided: add `record.seconds` as proposed.** Switched on, the rover powered up and outside the near-lander zone for that many seconds of the event (power-downs pause the count). Stations keep the Moon rule (any power state) | Interface |
| M17 | *New.* An RTG rover with "No heater" is warm but fails Night drive's `slots: ["heater"]` | **Decided: as proposed.** Any total `heat` above zero meets the heater requirement | Owner B |
| M18 | *New.* `MilestoneRequirements.support` from the draft | **Decided: drop `support` as proposed.** Derive "needs the arm" from the instrument's `needs` | Interface |
| M19 | *New.* Later Mars stations and the lander | **Decided: same as the Moon, as proposed.** They follow the Moon's near-lander rule (200 m, warning and second press, `record`/`deploy` outside, records whatever the power state); none ships in this wave | Interface |

## Combined phase order (both Mars plans)

*Written in Phase 0, November 15, 2026.* One order that runs this plan (phases **E1 to E7**) and the [Mars sites and milestones plan](mars-sites-and-milestones-plan.md#6-implementation-phases) (phases **S1 to S7**) together on `aon/mars-engineering`. Each step names the files it writes. **Two writers never share a file**: steps listed as parallel write disjoint files, and a data file has one writer per step. Every step ends with `npm test` and `npm run build` passing and a commit of only its own paths; a **browser check** on both worlds follows each step marked with one.

| Step | What | Plan phases | Files it writes | Parallel with | Browser check |
| --- | --- | --- | --- | --- | --- |
| 0 | Design first | E0, S0 | Docs only | | |
| 1a | A catalog per world | E1 | `rules/types.ts`, `src/gameData.ts`, `rules/payload.ts`, `rules/validate.ts`, `rules/relationships.ts`, `data/parts.json`, `data/relationships.json`, `ui/designScreen.ts`, `ui/ticketScreen.ts`, `ui/notebook.ts`, their tests | 1b, 1c | Both desks: Mars without the reflector and seismometer, the dropped-part notice; no Moon lesson on Mars |
| 1b | Pipeline requests MP1 to MP4, MP6 | S1 | `game/tools/build_terrain_mars.py`, `game/public/terrain/mars/` (pipeline owner only) | Everything until step 6 | |
| 1c | Dust rules (pure) | E5, rules half | `rules/dust.ts` (new), `rules/dust.test.ts`, `rules/marsTypes.ts`, `data/mars/tuning.json` (`dust`), `data/mars/events.json` (dust devils) | 1a, 1b | |
| 2 | Parts own their draws; dust in the energy step | E2, plus E5's energy wiring | `rules/types.ts` (`PartEffects`), `rules/energy.ts`, `rules/mission.ts`, `rules/cold.ts`, `data/parts.json` (LED), `data/mars/tuning.json` (`night`), `ui/designScreen.ts` (night budget line), tests | 1b | Mars night drains as before; the night budget line; the Moon unchanged |
| — | **Gate: the user approves the Mars ticket tiers** (M12): *passed, approved November 15* | | | | |
| 3 | Bus parts, support hardware, the four instrument parts as data, Mars tiers | E3 | `data/parts.json`, `data/mars/parts.json` (new), `data/mars/tiers.json` (new), `src/gameData.ts`, `rules/types.ts`, `rules/payload.ts`, `rules/rover.ts`, `rules/quote.ts`, `rules/tiers.ts`, `rules/validate.ts`, `rules/balance.ts`, `ui/designScreen.ts`, `ui/ticketScreen.ts`, `ui/buildPreview.ts`, `rover/roverModel.ts`, tests | 1b | A Mars rover with each new part; tier jumps; the Moon desk unchanged |
| 4a | The four Mars instruments, the arm's slope refusal | E4 | `rules/instruments.ts`, `rules/mission.ts`, `ui/missionScreen.ts`, `ui/marsMission.ts`, `ui/hud.ts`, `ui/screens.ts` (instrument log), `data/mars/tuning.json`, `data/mars/text.json`, tests | 4b, 1b | Each instrument works on a rover that carries it and refuses clearly (no arm, no mast, slope, energy) |
| 4b | Sites data and types | S2, without its tuning and text values | `rules/marsTypes.ts`, `data/mars/milestones.json`, `data/mars/sites.json` (new), `src/gameData.ts` (the sites overlay), `rules/validate.ts`, `rules/data.test.ts` | 4a, 1b | The game loads with 28 Mars milestones present, not firing |
| 5a | Trigger extensions and Mars zones | E6 (milestone half), S3 (zones) | `rules/milestones.ts`, `rules/types.ts` (trigger shapes), `rules/sites.ts`, `rules/validate.ts`, `rules/milestones.test.ts`, `rules/marsMilestones.test.ts` | 5b, 5c, 5d | |
| 5b | Hydrogen on Mars, RTG noise, Mars rock suites | S3 (instruments) | `rules/instruments.ts`, `rules/instruments.test.ts`, `data/mars/tuning.json` (all of S2's tuning values), `data/mars/text.json` (rock names) | 5a, 5c, 5d | |
| 5c | Boulders at the new sites, survey | S3 (boulders, survey) | `rules/boulders.ts`, `rules/survey.ts`, their tests | 5a, 5b, 5d | |
| 5d | The three Mars relationships and the no-lights entry | E6 (relationship half) | `rules/relationships.ts`, `data/relationships.json`, `rules/relationships.test.ts` | 5a, 5b, 5c | |
| 6a | World: new boulders, flood boulder, dust devil column | S4, E5 (visuals) | `world/boulders.ts`, `world/dustDevil.ts` (new) | 6b, 6c, 6d | Sites where `terrain.json` says; slope-target boulders the arm refuses, with level ground beside them |
| 6b | Mission wiring | S4 | `ui/missionScreen.ts`, `ui/marsMission.ts` | 6a, 6c, 6d | Each new milestone earned on purpose; the hydrated ground found with the meter; each lesson triggers once |
| 6c | HUD and minimap | S5, E5 (dust factor) | `ui/hud.ts`, `ui/minimap.ts`, `ui/style.css` | 6a, 6b, 6d | Rings, the delta foot, "Hydrated ground" after it is found, check marks, the fourth lead, the dust factor |
| 6d | Desk cards, debrief, notebook, text | S5, E6 (UI) | `ui/designScreen.ts`, `ui/screens.ts`, `ui/notebook.ts`, `data/mars/text.json`, `data/mars/milestones.json` (facts), the spoiler grep test | 6a, 6b, 6c | Cards list milestones; "Not reached" names a missing arm; no Mars text fails the guard |
| 7 | Balance and browser check | E7 (energy), S6 | `rules/marsNight.test.ts`, a Mars balance data file for the MP5 legs (new), `data/mars/milestones.json` (first reward pass) | MP5 (pipeline) must land first | Autopilot runs at B = 780 and 950: idle, empty bay, each archetype |
| 8 | Tutorial, credits, playtest checklist, docs | E7, S7 | `ui/tutorialText.ts`, `ui/creditsScreen.ts`, a Mars playtest checklist (new), game-design.md "built" marks | | The full Mars playtest checklist, and a restart |

**Sequential, and why:**

- **1a before 2 before 3:** all three write `rules/types.ts`, `data/parts.json` and `ui/designScreen.ts`. 1c must land before 2, since both write `data/mars/tuning.json`.
- **The tier gate before 3:** the tiers decide which builds launch, and Phase 3's data test checks every reference build against them.
- **3 before 4a and 4b:** 4b's milestones name the new instrument ids, which validate against the Mars catalog from 3. 4b holds back S2's tuning and text values because 4a writes those files; 5b adds them.
- **4a before 5b:** both write `rules/instruments.ts`.
- **Within step 5,** 5b writes every Mars tuning and text value that 5a and 5c need (zone sizes, meter values, boulder counts, the fourth lead), so `data/mars/tuning.json` has one writer.
- **5 before 6:** the mission screen feeds rules that must exist. 6b and 6d wait for 4a's mission and debrief edits (they share `ui/missionScreen.ts` and `ui/screens.ts`).
- **MP1 to MP4 before 6a and 6b**, for real positions; until then `sites.json` holds the provisional candidates, as the Moon did. MP5 needs MP1 to MP3 and 4b's hydrated ground position, and feeds step 7.
- **Chieri's review** should come before step 4b (placements and milestone triggers) and before step 1c (dust), since those are the Owner B items most costly to redo.

**Shared with the Moon.** `rules/milestones.ts`, `rules/types.ts`, `rules/instruments.ts`, `rules/sites.ts`, `world/boulders.ts`, `ui/missionScreen.ts` and `ui/screens.ts` are also being changed by the Moon sites plan's Phases 4 to 6 in the main checkout. Steps 4a, 5 and 6 should start only after those Moon phases land on the branch this one rebases onto, or the two branches will conflict in the files where the rules are most delicate. Steps 1 to 3 touch little the Moon is changing (`rules/types.ts`: different types) and can start now.

**Shipping** (unchanged in spirit): step 1a can ship alone; 2 and 3 ship together; 4 to 6 ship together, so instruments arrive with their milestones and relationships; 7 must finish before the merge to `main`.
