# Plan: Mars Sites and Instrument Milestones

This plan adds new areas of interest on the Jezero map, and milestones that give every Mars instrument something to earn. It is the Mars counterpart of the [Moon sites and milestones plan](moon-sites-and-milestones-plan.md) and is written for our team. The design comes first ([Goals](#1-goals-and-principles) to [Rock types](#5-rock-types)), then the build plan ([Phases](#6-implementation-phases)).

Written November 15, 2026, against `aon/moon-milestones` (at `7ddec31`). Game rules stay in [game-design.md](game-design.md), the source of truth. The Mars desk (parts, triggers, relationships) is in the [Mars rover engineering plan](mars-rover-engineering-implementation-plan.md), and this plan respects its [hand-off constraints C1 to C12](mars-rover-engineering-implementation-plan.md#constraints-the-sites-plan-must-respect). The repo rules still apply:

- game numbers go in `game/data/*.json`;
- pure rules go in `game/src/rules/`, with unit tests;
- `npm test` and `npm run build` pass before each commit;
- design changes go into game-design.md before code;
- nobody hand-edits `game/tools/` or `game/public/terrain/`.

**Status: draft.** Everything here is *Proposed* until Phase 0 records it in game-design.md. The plan assumes the Mars plan's *proposed* answers to M11 to M19 (see [What this plan depends on](#what-this-plan-depends-on)). **Owner B owns level layout and milestone placement** ([team-plan.md](team-plan.md)), so every placement here is a proposal to Owner B. [Changes to the built Mars world](#changes-to-the-built-mars-world) lists what this plan would change in the Mars world Owner B has built. Coordinates come from a quick offline scan of the game's own Mars layers ([How placement uses the terrain layers](#how-placement-uses-the-terrain-layers)), and the pipeline confirms them. Rewards are starting values, and the balance model sets the final ones.

Quick navigation: [Goals](#1-goals-and-principles) · [Sites](#2-sites-and-areas-of-interest) · [Milestones](#3-milestones) · [Balance](#4-balance) · [Rock types](#5-rock-types) · [Phases](#6-implementation-phases) · [Open questions](#7-open-questions) · [Sources](#sources-and-what-is-not-verified)

## 1. Goals and principles

**The problem.** Mars has eight milestones today. Two are scientific, and both are far. Delta layers is 1.48 km away, and the drill can earn Core sample anywhere. Six instruments on the coming Mars desk earn nothing: the X-ray spectrometer, the neutron spectrometer, the weather mast, the radar and the laser and organics spectrometers. Arrival balances run from 780 to 950. A good run needs about 650 to 700 in milestone money to clear the Titan mark of 800 from the bottom of that range. Today's best camera or drill run earns about 430.

1. **Density over distance** (C5). Every instrument gets a target within about 1.5 km of the landing, and most get one within 1 km. There are three clusters in three directions. The delta front stays the one far destination: its nearest edge is 1.34 km away, and Hawksbill Gap is 2.5 km away.
2. **Variety of verbs.** Each instrument has its own reason to stop. Each cluster offers at least four instruments something to do. A radar rover, an organics rover and a weather rover should play differently on the same ground.
3. **Approachable for kids.** Sites have plain names ("East crater", "Delta foot"). Discovery notices say what the instruments aboard can do there. Progress shows as counts ("3 of 6 rock types"). There are no new keys or modes.
4. **Real science, honestly placed.** Mars gives us more real anchors than the Moon. The Séítah entry *is* Brac, where Perseverance sampled Séítah's olivine rock, and RIMFAX really imaged the crater floor's buried layers. Two things are placed by design: the hydrated ground and the flood boulder. The fact text says so, and so does this doc (C12).
5. **Lessons are discovered, never given away** (C8). Milestones put the player where a Mars lesson can happen. No milestone, site name, notice or lead names a lesson's cause or its fix ([spoiler guard](#milestones-and-the-relationship-lessons)).
6. **Several ways to pass, still.** These must fail:
   - idling;
   - wandering;
   - an empty bay;
   - carrying instruments without using them.

   Several builds must pass, on different routes and from the bottom of the arrival range (C2, C3).

## 2. Sites and areas of interest

### The map today, and the gap

These are the sites in `terrain.json` today, with drive distances from the landing at (835, −490):

| Site | Drive | Direction |
| --- | --- | --- |
| Rocky area 2 (fresh crater) | 224 m | WNW |
| Rocky area 1 (block field) | 744 m | SSE |
| Séítah entry | 1,230 m | SSW |
| Delta viewpoint | 1,482 m | WNW |
| Delta front sample point | 2,501 m | WNW |
| West sunset viewpoint | 3,616 m | WNW |

Perseverance's landing site is a landmark 517 m SSE.

**The gaps:**

- **Nothing to the east.**
- **No contact targets except boulders at the two rocky areas,** and every rock reads the Moon's rock list.
- **No slope targets for the arm lesson** (C7).
- **No hydrogen for the neutron spectrometer** (`tuning.milestones._note`: "No hydrogen signal").
- **Nothing for the weather mast that the storm alone does not give.**

### New site kinds

| Kind | What it is | Real basis | Instruments it serves | Count |
| --- | --- | --- | --- | --- |
| **Young crater** | A small fresh crater (100 to 350 m across) with a ring of blocky ejecta. Rocky area 2 is one already | Fresh craters on the Jezero floor carry blocky ejecta in HiRISE images (pipeline note in `terrain.json`). Craters dig up rock from about a tenth of their width down (Melosh 1989) | Radar (buried layers), X-ray and organics (ejecta boulders), laser, camera (the crater wall) | Rocky area 2, East crater, 2 small ones |
| **Séítah edge** | Séítah's north boundary nearest the landing, at the Brac sample site, with olivine boulders on firm ground beside the ripples | Perseverance sampled Séítah's olivine cumulate at Brac (Liu et al. 2022). RIMFAX imaged layers beneath the floor near Séítah (Hamran et al. 2022) | X-ray, organics, drill (Séítah core), radar, neutron | 1 (the existing entry) |
| **Delta foot** | The nearest 400 m of the delta scarp's foot, where blocks fallen from the delta lie on firm ground. A 50 m zone, not the 150 m `delta-front` zone | The delta's layers were laid down in the lake (Mangold et al. 2021). Perseverance cored delta mudstone at the delta front in 2022 (JPL) | Drill, organics, X-ray, laser (the cliff), radar, neutron | 1 |
| **Flood boulder** | One large boulder (2.5 m) at the delta foot, on the lower scarp slope. It reads a rock found nowhere else | Boulders up to about 1.5 m in the delta's top layers record floods (Mangold et al. 2021). *Placed by design*: no such boulder was observed at this spot | X-ray (rare rock), camera | 1 |
| **Hydrated ground** | A small buried patch where the neutron meter reads higher than anywhere else. It is never marked until found | Crater-floor rocks hold water-made salts and carbonate (Scheller et al. 2022; Tice et al. 2022). Curiosity's neutron instrument saw hydrogen vary along its drives (Litvak et al. 2014). *Placed by design* | Neutron | 1 |
| **Slope targets** | Boulders on ground steeper than the arm's limit but still drivable, each beside level ground | Perseverance's PIXL and SHERLOC must sit close to the rock (Mars plan) | X-ray and organics (C7), laser | 4 groups |

Things that are not sites:

- **Weather.** The weather mast's milestones come from events: the storm, the night and dust devils. They are not places.
- **Wright Brothers Field.** Ingenuity's airfield is near Perseverance's landing site, but there is nothing on the ground to see or measure. It stays a line in the landing briefing, if anywhere ([MS12](#7-open-questions)).

### Where they go: three clusters

Directions are game compass points from the landing (azimuth from local −z toward +x). Distances are straight-line. Drive distances come from the pipeline (MP5).

| Cluster | Site | Kind | Candidate (local x, z) | From the landing | Notes |
| --- | --- | --- | --- | --- | --- |
| **Delta route** (WNW) | Rocky area 2 | Young crater (existing) | (430, −755) | 484 m WNW | Measured about 300 m across and 14 m deep, not the 255 m in `terrain.json`. Its NW inner wall reaches 25°. The near rim is about 335 m out, so it is clear of the 200 m zone |
| | NW wall slope targets | Slope targets | NW inner wall, azimuth 290 to 320° from the crater's center; the knob at (305, −835) | 450 to 630 m WNW | Inner wall: 48% under 8°, 43% at 8 to 15°, 9% steeper. Level rim ground lies within a few meters |
| | Delta foot + flood boulder | Delta foot | Foot at (−449, −1,252); the 50 m zone along the nearest 400 m of the foot | 1,493 m WNW | Slope 11.5° at the foot, then 13° to 17° in the first 100 m up the scarp. The boulder goes on that lower slope (MP3) |
| | Delta viewpoint | Existing | (−290, −1,270) | 1,369 m WNW | Unchanged. It is inside today's 150 m `delta-front` zone |
| **South cluster** | Small crater S | Young crater | (870, 70) | 561 m S | 140 m across, 3 m deep. On the way to Rocky area 1 |
| | Rocky area 1 | Rocky area (existing) | (972, 199) | 703 m SSE | 96% of it under 8°. These are the level contact targets that "park level" needs |
| | Small crater SSE | Young crater | (1,115, 295) | 833 m SSE | 100 m across, 3 m deep |
| | **Hydrated ground** | Hydrated ground | Near (780, 420), the designer's choice | About 910 m S | Firm, level ground between Rocky area 1 and Séítah. Never drawn until found |
| | Séítah knob | Slope targets | (620, 445) | 959 m SSW | +6.5 m, with flanks up to 16°. Séítah's own edge has nothing steeper than 16.5° |
| | Séítah entry (Brac) | Séítah edge (existing entry) | (550, 620); Brac is at (557, 632) | 1,146 m SSW | Brac is 14 m from the game's entry. 42% of the ground within 150 m inside the outline is soft |
| **East** | **East crater** | Young crater | (1,815, −720) | 1,007 m ENE | About 340 m across and 20 m deep, with walls to 24° and rim knobs at (1,845, −555) and (1,860, −875). The pipeline checks how fresh it is (MP1) |
| | Small crater ESE | Young crater | (1,760, −195) | 971 m ESE | 200 m across, 5 m deep |

**Three clusters, three characters:**

- **The delta route** is the long, rich trip. It has Delta layers and the delta's rocks and is the only place with the rare rock. Rocky area 2 is the first stop.
- **The south cluster** is dense and level. It has five stops within 1.15 km and holds the hydrated ground and the Séítah samples.
- **East crater** is the deep, steep one. It has a crater wall to photograph, steep rim knobs, and buried ejecta for the radar.

The three clusters are 1 to 2 km apart. A run does one cluster well, or one plus Rocky area 2.

**What each instrument can do in each cluster.** The X-ray and organics spectrometers need the arm on Mars (Mars plan M6), and the laser needs the mast.

| Instrument | Delta route | South cluster | East crater |
| --- | --- | --- | --- |
| Camera | Crater wall (Rocky area 2), Delta layers, Blue sunset | Blue sunset | Crater wall, Blue sunset |
| Drill | Core sample, Signs of an ancient lake | Core sample ×3, Séítah core | Core sample |
| X-ray | Rocky area 2 (with olivine from depth), delta mudstone, the flood boulder | Rocky area 1 (salts), Séítah (olivine, carbonate) | East crater suite |
| Organics | Rocky area 2, delta foot (Lake organics) | Rocky area 1, Séítah | East crater, small crater |
| Laser | Rocky area 2, knob, delta foot, the cliff | Rocky area 1, Séítah knob, Séítah | East crater, small crater |
| Radar | Rocky area 2 ejecta, delta front | Two small craters, Rocky area 1, Séítah | East crater, small crater |
| Neutron | Delta front | Hydrated ground, Séítah | None |
| Weather mast | Anywhere outside the near-lander zone | Same | Same |

East crater gives the neutron spectrometer nothing, on purpose: one cluster that a neutron rover skips keeps the routes different.

### On the map and minimap

The exploring minimap keeps its rules ([Minimap and exploration](game-design.md#minimap-and-exploration)): a site stays hidden until the reveal circle touches it, then it is drawn with a "Located" notice.

| Kind | Before discovery | When discovered | After discovery |
| --- | --- | --- | --- |
| Young crater | Hidden (fog) | A ring icon. The notice names it and, only for instruments aboard, what they can do there ("East crater: a fresh crater with blocky ejecta. X-ray spectrometer: read the rocks.") | Ring; a small check once every milestone this rover can earn there is earned |
| Delta foot | Part of the existing delta-front line | A thicker stretch of the delta line. The notice: "Delta foot: blocks fallen from the delta." plus instrument lines | Check, as above |
| Flood boulder | Hidden | A boulder icon | Check when read or photographed, whichever the rover can do |
| Hydrated ground | **Never drawn until found.** Only the neutron meter finds it: it rises as the rover nears | When Hydrated ground fires: a dotted area labelled "Hydrated ground" | Stays drawn |
| Slope targets | Not drawn separately (they are boulders at the sites above) | | |

- **A fourth survey lead.** Owner B's three leads stay (delta, Séítah, rocks). A fourth, "Young crater" (HiRISE images), points at East crater, about 1 km ENE, so the east is not empty for first-time players ([MS6](#7-open-questions)). Rocky area 2 needs no lead: its rim is 335 m out, so it is found in the first minute.
- **Site notices are instrument-aware but lesson-blind.** They never say "slope", "level", "flat", "dust", "noise" or "generator" (C8).
- **The map resets each try,** as on the Moon.

### How placement uses the terrain layers

A short script over `game/public/terrain/mars/` checked what each layer can support (scratch analysis, not committed):

| Layer | Resolution | What it gives placement | Limits found |
| --- | --- | --- | --- |
| `heightmap.png` | 5 m | Young craters (closed depressions with rims): Rocky area 2, East crater (1,815, −720), and small ones at (870, 70), (1,115, 295), (1,760, −195) and (310, 70). Also the delta foot, the knobs, and drive routes | Crater detection is crude, with diameters ±20%. Freshness (blocky ejecta) needs the 25 cm HiRISE mosaic (MP1). The floor is shallow: only Rocky area 2 and East crater are over 10 m deep |
| `slope.png` | 5 m | Slope targets in the 10 to 18° band, between the arm limit and the 18° steep-slope warning (damage starts at 20°). Level ground for "park level" | The floor is over 90% under 8°. **Séítah's near edge has no ground over 16.5°**, so C7's slope targets cannot go at Séítah. They go at Rocky area 2's NW wall, the knob at (305, −835), East crater's rim, the Séítah knob (620, 445) and the delta foot |
| `soft-ground.png` | 5 m | Soft ground only in and around Séítah (42% of the ground within 150 m inside the edge) | Contact targets at Séítah go on firm ground beside the ripples, so a reading never needs a sand crossing |
| `terrain.json` features | | The delta scarp line (its nearest 150 m zone edge is 1,343 m away), the Séítah outline, the rocky areas, Perseverance's landing | Rocky area 2's `radius_m` (204) covers its ejecta. The crater itself is about 300 m across (MP1) |

The neutron's "hydrated ground" and the rare boulder are design choices, not terrain features. They go in a Mars `sites.json` overlay, as the Moon's do. No new image layers are needed.

## 3. Milestones

### New milestones

There are **nineteen new milestones**. Every Mars instrument gets at least one (C4), and one of them is a combo. Three come from game-design.md's *Proposed* Mars list: Sand crossing, Signs of an ancient lake and Dust devil. Rewards use the existing units ([§6](game-design.md#6-economy-and-milestones)), sized for Mars spending (C2; see [§4](#4-balance)). "Outside the near-lander zone" means the existing 200 m zone (C9).

| Milestone | Category | Instrument(s) | Site / condition | Money / RP | Real science (source) |
| --- | --- | --- | --- | --- | --- |
| **Crater wall** | Scientific: historical formation | Camera | Photograph a young crater's far inner wall from its rim (crater center in frame, rover within 0.8 to 1.3 × its radius) | 70 / 15 | Crater walls are natural cross-sections: Opportunity spent about two years at Victoria crater studying the layers in its walls (Squyres et al. 2009, *to check*) |
| **Dust devil** | Pretty picture | Camera | Photograph a passing dust devil in frame. Needs dust devils (Mars plan Phase 5) | 60 / 5 | At Jezero, Perseverance's weather sensors counted about four whirlwinds per sol, and over a quarter of them were dusty (Newman et al. 2022). *Not* Spirit's panel cleaning (C8) |
| **Séítah core** | Scientific: new material | Drill | A drill sample inside Séítah's outline, 200 m from the lander (Core sample's rule) | 120 / 25 | Perseverance sampled Séítah's olivine-rich rock at Brac, an olivine cumulate that formed at the base of a magma body (Liu et al. 2022; Farley et al. 2022) |
| **Signs of an ancient lake** | Record: first discovery | Drill | The first sample in the 50 m delta-foot zone | 120 / 30, once per campaign | The delta's fine layers formed in Jezero's lake. Perseverance cored delta mudstone at the delta front in 2022 (JPL) |
| **Rock collection** | Scientific: new information | X-ray | Read 2, 3 and 4 different Mars rock types (one stage each) | 70 / 10 per stage | PIXL mapped the chemistry of crater-floor rocks and found olivine cumulate in Séítah (Liu et al. 2022) and water-made carbonate and salts in it (Tice et al. 2022) |
| **Rare rock** | Record: first discovery | X-ray | Read the flood boulder (flood conglomerate, found nowhere else) | 120 / 30, once per campaign | Boulders up to about 1.5 m in the delta's top layers record floods into the lake (Mangold et al. 2021). *Placed by design*: a block fallen from those layers |
| **Documented sample** | Scientific: new information | Camera + X-ray | Photograph a boulder the X-ray spectrometer has read this mission, from within 15 m (the Moon's photo target) | 50 / 10 | Perseverance photographs the rocks it studies with its arm camera, WATSON (*to check*; the Moon's version cites Apollo) |
| **Organic signals** | Scientific: new material | Organics | A finished organics reading on a boulder at 2 different sites, outside the near-lander zone (one stage each) | 140 / 30 per stage | SHERLOC detected signals consistent with organic molecules in all ten crater-floor targets it studied, in Máaz and Séítah. A non-biological origin is not ruled out (Sharma et al. 2023) |
| **Lake organics** | Scientific: new material | Organics | A finished organics reading on a boulder in the delta-foot zone | 160 / 40 | Delta rocks at Wildcat Ridge gave SHERLOC its strongest organic signals so far (JPL, 2022). Wording: "signals consistent with", never "found organic molecules" |
| **Remote reading** | Scientific: new information | Laser | A laser reading of a boulder at 3 different sites (one stage each) | 70 / 10 per stage | SuperCam's laser analyzes rocks up to about 7 m away (CNES), and its microphone hears each zap, which tells about the rock's hardness (Maurice et al. 2022) |
| **Rock from afar** | Scientific: historical formation | Laser | A laser reading of the delta cliff from the delta foot (the Mars plan's `cliff` target) | 120 / 25 | Same sources. The draft's candidate, unchanged |
| **Buried layers** | Scientific: new information | Radar | The radar switched on for an unbroken 150 m drive that touches a young crater's ejecta, Séítah or the delta front. One stage per distinct zone instance, up to 3 | 90 / 20 per stage | RIMFAX imaged layers beneath Jezero's floor, dipping up to about 15° and seen to about 15 m deep, along the rover's first 3 km (Hamran et al. 2022) |
| **Long profile** | Scientific: new information | Radar | The radar switched on for an unbroken 500 m drive, outside the near-lander zone | 100 / 15 | Same source: a profile is built drive by drive |
| **Hydrated ground** | Scientific: strange formation | Neutron | Switched on through the hidden 25 m core of the hydrated ground ([C6](#how-the-neutron-milestone-can-be-lost)) | 180 / 30 | Curiosity's DAN saw water-equivalent hydrogen vary by a few percent over a few meters (Litvak et al. 2014). Crater-floor rocks hold water-made salts (Scheller et al. 2022). *Placed by design* |
| **Hydrogen traverse** | Scientific: new information | Neutron | Switched on for an unbroken 100 m drive that touches Séítah or the delta front. One stage each | 100 / 15 per stage | Mars Odyssey's neutron spectrometer found 2 to 10% water-equivalent hydrogen in places near the equator (Feldman et al. 2004). Séítah's and the delta's readings are a game simplification |
| **Storm log** | Scientific: new information | Weather mast | Switched on, powered up and outside the near-lander zone for 60 s of the dust storm (`record` + `seconds`, Mars plan M16) | 160 / 25 | The Mars plan's candidate. MEDA recorded a regional dust storm over Jezero in January 2022 (Lemmon et al. 2022, *to check*) |
| **Night weather** | Scientific: new information | Weather mast | Switched on, awake and outside the near-lander zone for 12 s of one night (`record`, event `night`, `seconds` 12) | 110 / 15 | MEDA measures temperature, pressure, wind and dust through the night as well as by day. Jezero nights fall below −80 °C (NASA MEDA reports; the exact source is *to check*) |
| **Dust devil pass** | Scientific: new information | Weather mast | Switched on, powered up and outside the near-lander zone when a dust devil passes within 150 m (`record`, event `dustdevil`). Needs Phase 5 | 60 / 10 | Perseverance's microphone recorded the first sound of a Martian dust devil passing over it, on sol 215 (Murdoch et al. 2022) |
| **Sand crossing** | Capability: difficulty | None | As game-design.md proposes: cross Séítah's ripples without getting stuck. Owner B's rule | 40 / 3 | Spirit was stuck in sand at Troy in 2009 (in game-design.md) |

**Changed existing milestones** (balance, [§4](#4-balance); the rewards assume [MS1](#7-open-questions)):

- Blue sunset 70 → **100**.
- Night drive 50 → **30** per stage.
- Delta layers stays 100.
- Core sample stays 60 per site. A sample that earns Séítah core or Signs of an ancient lake still counts as a Core sample site: one drill action can earn both, as on the Moon.
- **Clean run** (proposed) is dropped. An idle rover earns it, and it would add to the idle and empty-bay money that C3 must keep down.

**What each instrument now earns:**

| Instrument | Before | After |
| --- | --- | --- |
| Camera | Delta layers, Blue sunset | + Crater wall, Dust devil, Documented sample (with X-ray) |
| Drill | Core sample ×3 | + Séítah core, Signs of an ancient lake |
| X-ray (arm) | Nothing | Rock collection ×3, Rare rock, Documented sample (with camera) |
| Organics (arm) | Nothing | Organic signals ×2, Lake organics |
| Laser (mast) | Nothing | Remote reading ×3, Rock from afar |
| Radar | Nothing | Buried layers ×3, Long profile |
| Neutron | Nothing | Hydrated ground, Hydrogen traverse ×2 |
| Weather mast | Nothing | Storm log, Night weather, Dust devil pass |
| Arm, mast | Through their instruments | Unchanged (intended) |

**Why these and not others:**

- **One combo only, and it teaches nothing.** Documented sample (camera + X-ray) reuses the Moon's photo target. There is no laser + contact combo, and no neutron + solar combo (C11).
- **The weather mast gets a plannable milestone.** Dust devils are random, so a weather rover cannot count on Dust devil pass. Night weather is always there, and it ties the mast to Mars's lesson: staying awake at night costs battery (1/s plus the mast's standby).
- **Organics earns at two sites, not five.** Each reading is a long hold that costs much energy, so two readings are a full mission's work. That is the energy lesson (Mars plan, "Long hold").
- **Lake organics and Rare rock live only at the delta foot.** The far destination should hold the rarest things. The near clusters still pay every instrument enough to pass ([§4](#4-balance)).
- **Signs of an ancient lake gets its own 50 m zone.** Today's `delta-front` zone reaches 150 m from the scarp's foot, into crater-floor ground, and a "lake" sample drilled 150 m out on igneous floor would teach the wrong thing (the reason Core sample was renamed). See [MS5](#7-open-questions).
- **Left out:**
  - a Wright Brothers Field photo (nothing to see; MS12);
  - a sand-ripple photo (no source found that Perseverance photographed Séítah's megaripples);
  - a "hydrogen + drill" combo (it would blur Hydrated ground);
  - Clean run (see above);
  - anything at Hawksbill Gap or the sunset viewpoint (too far, and they are optional already).

### How the milestones work (rules)

The plan uses the shared triggers (C1). The Moon builds them first (Moon plan M6). They are typed in `rules/types.ts` today, and their rules come in the Moon's Phase 3. Mars adds only the Mars plan's extensions, plus new zone ids.

| Trigger | Shape | Mars milestones |
| --- | --- | --- |
| `transect` | `{ type, instrument, zone, meters, sites? }` (Moon) | Buried layers (`young-crater` \| `seitah` \| `delta-front`, 150 m, 3 sites), Long profile (no zone, 500 m, outside `near-lander`), Hydrated ground (`hydrogen-anomaly`, 20 m), Hydrogen traverse (`seitah` \| `delta-front`, 100 m, 2 sites) |
| `reading` | `{ type, instrument, zone?, target?, sites?, rocks?, rock? }` (Moon) | Rock collection (`rocks: [2, 3, 4]`), Rare rock (`rock: "flood-conglomerate"`), Organic signals (`sites: 2`, by `Boulder.site`), Lake organics (`zone: "delta-foot"`), Remote reading (`sites: 3`), Rock from afar (`target: "cliff"`) |
| `record` + `seconds` | Mars plan M16 | Storm log (`duststorm`, 60 s), Night weather (`night`, 12 s), Dust devil pass (`dustdevil`, 0 s) |
| `photo` (exists) | New target `crater-wall`; the Moon's `read-boulder` | Crater wall, Documented sample, Dust devil (target `dustdevil`, Phase 5) |
| `drill` (exists) | Zones `seitah` (exists) and `delta-foot` (new) | Séítah core, Signs of an ancient lake |
| `zone` cross (exists) | | Sand crossing (Owner B's rule) |

- **Zone ids.** These Mars ids are new: `delta-foot` (within `deltaFootRadiusM`, 50 m, of the nearest 400 m of the scarp foot) and the flood boulder. These are reused from the Moon's `ZONE_IDS`: `young-crater` (ejecta rings at 1.5 × radius, built from the pipeline's craters and the rocky areas) and `hydrogen-anomaly` (the hidden patch). Validation checks trigger zones per world (Mars plan).
- **Two decisions to share with the Moon's Phase 3,** for `transect` and `reading`:
  - `transect` with no `zone` means anywhere outside `near-lander`.
  - `reading.sites` counts distinct `Boulder.site` values.
- **Rock types depend on the site** (see [§5](#5-rock-types)). The readout adds "New type: 3 of 6" when a reading counts.
- **Contact readings and slopes.** The X-ray and organics spectrometers refuse to read when the ground under the rover is steeper than the arm's limit. That rule is the Mars plan's (Phase 4) and is not in code yet. This plan assumes **10°** ([MS2](#7-open-questions)): the arm lesson then has a 10° to 18° band of drivable ground in which it can happen.
- **The hydrogen meter on Mars.** The base reads `neutron.background` (10%) everywhere. Séítah and the delta foot read a little higher (15%, a game simplification). The hydrated ground reads `anomalyPeak` (45%) at its center, falling to the background at `anomalyRangeM` (80 m). These are the Moon's rule and keys, with Mars values in `data/mars/tuning.json`.
- **Desk cards and the debrief** work as on the Moon (Moon M11, M14). Cards list each instrument's milestones by name. The debrief has a "Not reached" list, and for a missing support part it names the instrument's `needs` (Mars plan M18).

#### How the neutron milestone can be lost

C6 asks that the RTG's neutron noise can cost a neutron milestone. Hydrated ground is built so it can:

- its core is small (25 m);
- it is never drawn;
- only the meter's rise over the last 80 m leads to it.

The RTG relationship raises the meter's floor and makes it jitter (Mars plan). If the jitter is at least as large as the anomaly's rise 30 m from the core, a noisy rover cannot follow the gradient, and finds the core only by luck. **This is a search cost, not a rule.** A noisy rover that drives over the core still earns it. If playtests show RTG rovers finding it anyway, add a small `transect` extension, `dwellS`: seconds switched on inside the zone, multiplied by the rover's noise factor. That is real counting statistics: more background means longer counts (Jun et al. 2013). See [MS4](#7-open-questions).

### Milestones and the relationship lessons

The Mars lessons are the Mars plan's ([Spoiler guard](mars-rover-engineering-implementation-plan.md#spoiler-guard-revised)). This plan adds none. Each row says where the new map makes the lesson happen, and what keeps it unspoken until then.

| Lesson | Where the new map makes it happen | What makes it matter now | Spoiler guard |
| --- | --- | --- | --- |
| The arm cannot reach on a slope | Rocky area 2's NW inner wall (the first site out), the knob beside it, East crater's rim, the Séítah knob, and the flood boulder on the delta foot's slope. Each has level ground within reach (Rocky area 1 is almost all level) | Rock collection, Rare rock and Organic signals send arm rovers to those boulders. The rare boulder can be read from its downhill side, so "park level" works (C7) | No site notice or milestone text says "slope", "level", "flat" or "steep". The laser's texts ("Remote reading", "Rock from afar") never mention the arm. There is no laser + contact combo (C11) |
| The RTG adds neutron noise | Hydrated ground, found by following the meter | It is worth 180, and noise hides the meter's rise ([above](#how-the-neutron-milestone-can-be-lost)) | Neutron texts say "switched on", "survey", "locate" and never mention power. No milestone needs solar power and the neutron spectrometer together (C11). The grep test checks "noise", "generator" and "RTG" in neutron texts |
| Dust on the panels | Every solar rover. The south cluster is dense enough to finish early, and the delta route is long, so it rewards early long drives (one of the revised answers) | Late milestones (Storm log, Night weather, a delta arrival late in the mission) need late income | Dust devil's fact is Newman et al. 2022 (whirlwind counts). Dust devil pass's fact is the microphone recording. **Neither mentions panels or cleaning.** Spirit's cleaning stays in the notebook entry (C8) |
| An electric heater spends the night | Night weather keeps a rover awake through a night | A night awake costs 15 or more, on top of the heater | Night weather's text says "record the night's weather" and never mentions heaters or the battery. If M15 drops this lesson, the row goes |
| No lights, no night driving | Unchanged (a hard block) | Night weather needs no lights: a rover can stay awake parked | The guard does not apply. Night weather's notice must not imply that lights are needed |

## 4. Balance

### Method

These are hand estimates, as the Moon's were before `winPaths`:

> Final = B − (parts + ticket) + 50 survival + milestone money.

- Parts are priced at the Mars plan's M11 prices, with the Moon tiers (M12).
- Each archetype must pass from **B = 780** by at least 50 (C2). The empty bay and idling must fail from **B = 950** by at least 50 (C3).
- Routes assume the rover sleeps at night and drives about 1.6 to 2.0 km, which is within the cheap build's 2 km in `marsNight.test.ts`.
- Dust devil milestones are left out (random, and they wait on Phase 5).
- A Mars `winPaths` must confirm every row (Phase 6, MP5). Mars has none yet.

### The pass test, and why this plan recommends a relative one

Mars has no fixed budget, so the test has to hold across a 170-wide arrival range. Let *cap* be the capability money (milestones any rover can earn).

1. **Under the fixed 800 mark (M13 as proposed):**
   - The cheapest empty bay (steel, solid, panel, Li-ion, heater units: 410) must earn at most 160 at B = 950.
   - Touchdown (80) and Storm survivor (60), which even an idle rover earns, already take 140 of that.
   - A reward set does exist ("set A": Touchdown 40, Odometer 15 per stage, Mapper 20, Night drive 20 per stage, Storm survivor 30, Sand crossing 20). But it cuts Owner B's capability rewards by about 60%, and makes Night drive, Mars's lesson payoff, worth almost nothing.
   - Each archetype route then earns about 140 less, so with the instrument rewards below **only the delta routes pass.** Every south and east route fails by 20 to 240, which breaks C5's density goal.
   - Raising every instrument route by about 140 would fix that, but it makes the delta routes pass by 250 to 400.
2. **Under a relative test (M13's own fallback),** Mars passes if the final is at least 800 **and** at least the arrival balance. In plain words: "Mars must pay for itself."
   - The archetype's worst case is unchanged (B = 780: milestone money ≥ spend + 20).
   - The empty bay now fails because it loses money, not because capability pays little. It must earn at most spend − 100: 310 for the cheapest empty bay, 485 for a fast one.
   - Owner B's capability rewards can stay as built, except Night drive (50 → 30 per stage).

**Proposed ([MS1](#7-open-questions)): adopt the relative test.** M13 says to switch when no reward set satisfies both ends with a 50 margin. Here, the only set that does so also gives up C5. The tables below use the relative test ("set B": today's capability rewards with Night drive at 30) and show the set A final alongside.

### Sample builds and routes

Builds are titanium, solid wheels, fixed panel, Li-ion and heater units unless stated. A typical route's capability money is 260 in set B (Touchdown 80, Odometer ×2 60, Mapper 60, Storm survivor 60) and 120 in set A.

| Build (extra parts; ticket) | Spend | Route | Main milestones | Final at B = 780, set B (margin) | Set A | Without using its instruments (B = 780) |
| --- | --- | --- | --- | --- | --- | --- |
| **Camera scout**: camera (58 kg / 17; Small) | 490 | Delta route: Rocky area 2 rim → delta viewpoint, sunset on the way | Crater wall, Delta layers, Blue sunset | 870 (+70) | 730, fails | 600, fails |
| **Field geologist**: camera + drill (66 kg / 20; Medium) | 640 | Delta route, 3 samples 200 m apart | Core sample ×3, Signs of an ancient lake, camera as above | 1,020 (+220) | 880 | 450, fails |
| | | South: Rocky area 1 → Séítah knob → Brac | Core sample ×3, Séítah core, Blue sunset | 850 (+50) | 710, fails | |
| **Rock hound**: arm + X-ray + camera (68 kg / 20; Medium) | 670 | Delta route | Rock collection ×2 (3 types), Rare rock, Documented sample, camera | 1,000 (+200) | 860 | 420, fails |
| | | South | Rock collection ×3 (4 types), Documented sample, Blue sunset | 780 (fails by 20) | 640 | |
| **Steel geologist**: steel, arm + X-ray + drill (87 kg / 22; Large) | 700 | South | Rock collection ×3, Core sample ×3, Séítah core | 900 (+100) | 760, fails | 390, fails |
| **Organics hunter**: arm + organics (67 kg / 20; Medium) | 670 | Delta route: Rocky area 2 → delta foot | Organic signals ×2, Lake organics | 860 (+60) | 720, fails | 420, fails |
| **Remote geologist**: mast + laser + camera (68 kg / 20; Medium) | 700 | Delta route | Remote reading ×3, Rock from afar, camera | 990 (+190) | 850 | 390, fails |
| **Weather watcher**: weather mast + camera (63 kg / 19; Medium) | 610 | South (any route outside 200 m) | Storm log, Night weather, Blue sunset | 850 (+50); 970 with dust devils | 710, fails | 480, fails |
| **Radar surveyor**: radar + camera (61 kg / 19; Medium) | 640 | South: craters, Rocky area 1, Séítah edge | Buried layers ×3, Long profile, Blue sunset | 920 (+120) | 780, fails | 450, fails |
| | | East: East crater, small crater | Buried layers ×2, Long profile, Crater wall, Blue sunset | 900 (+100) | 760, fails | |
| **Neutron prospector**: neutron (59 kg / 18; Small) | 520 | South: Rocky area 1 → hydrated ground → Séítah | Hydrated ground, Hydrogen traverse ×1 | 850 (+50) | 710, fails | 570, fails |
| **RTG geologist**: RTG, no heater (M17), LED, camera + drill (71 kg / 21; Medium) | 775 | Delta route, with night driving | Night drive ×2, Odometer ×3, the field geologist's set | 975 (+175) | 800 (0) | 405, fails |
| Empty bay: steel, solid, panel, Li-ion, heater units (Medium) | 410 | Best capability route, about 2 km | Touchdown, Odometer ×2, Mapper, Storm survivor | At B = 950: **850, fails by 100** (relative test) | At B = 950: 710, fails | |
| Empty bay + LED (steel; Medium) | 445 | As above, with night driving | + Night drive ×2 | At B = 950: 875, fails by 75 | 715, fails | |
| Fast empty bay: titanium, mesh, LED (50 kg / 19; Small) | 585 | About 3 km, through Séítah | + Odometer ×3, Sand crossing | At B = 950: 805, fails by 145 | 610, fails | |
| Idle, any build | 410+ | | Touchdown, Storm survivor | At B = 950: at most 730, fails | | |

**What this shows:**

- **Every instrument has a passing archetype from B = 780** under set B (C2, C4), and every archetype fails without using its instruments.
- **Three routes pass.** The delta route is richest (the far destination). The south cluster passes for the drill, radar, neutron, weather and steel X-ray builds. East crater passes for the radar.
- **The organics hunter and the camera scout depend on the delta.** That fits: the organics are the slow, power-hungry instrument, and Delta layers is the iconic photo. Both margins are thin (+60, +70), and the organics hunter's energy needs checking (Phase 6).
- **The south Rock hound misses by 20.** The X-ray's near route passes only with the drill (Steel geologist) or from B ≥ 800. A fifth rock type in the south (a carbonate boulder at the Séítah knob, for example) would fix it if wanted.
- **The delta routes pass by 175 to 220.** That is the "too many builds pass" risk, as on the Moon; see the targets below.
- **The RTG passes,** but only with two instruments and night driving, and it breaks even under set A. The Mars plan's risk "the RTG is never picked" stays open.

### The empty-bay and idle check

Under the relative test, an empty bay fails at every arrival balance, because its net gain on Mars is −100 to −145. Under the fixed test it fails only with set A's capability cuts. Idling earns at most 140 and fails under either.

### Targets for the balance tests

These go into a Mars `winPaths` (Phase 6):

- Each archetype above passes by at least 50 from B = 780, on at least one route.
- Each fails without its instruments, at both ends of the range.
- The empty bay and idling fail by at least 50 at B = 950.
- At B = 860, fewer than 40% of affordable builds pass with their best route. This is looser than the Moon's 35%, because Mars has twice as many instruments.

If the last target breaks, lower the delta-only rewards first (Rare rock, Lake organics, Rock from afar, Signs of an ancient lake), then the others evenly. Do not lower the near rewards that the south and east archetypes depend on.

### Which numbers go where

| File | What changes |
| --- | --- |
| `game/data/mars/milestones.json` | 19 new milestones (triggers, rewards, summaries, facts, sources); Blue sunset 100; Night drive 30; the Core sample fact (see [Changes](#changes-to-the-built-mars-world)) |
| `game/data/mars/tuning.json` | `milestones`: `deltaFootRadiusM` 50, `youngCraterEjectaFactor` 1.5, `craterWallRimBand` [0.8, 1.3], `documentedSampleRangeM` 15, `dustDevilSenseM` 150. `instruments.neutron`: `background` 0.1, `unitShares` (Séítah 0.15, delta foot 0.15), `anomalyPeak` 0.45, `anomalyRangeM` 80, `anomalyCoreM` 25. `instruments.xray.suites` and `rocks` (Mars, see §5). `boulders`: per-site counts (§5). `survey.leads`: adds `youngCrater` |
| `game/data/mars/sites.json` (new overlay) | Design choices on top of pipeline features: which crater is "East crater", the hydrated ground's position, the flood boulder, the rock suite of each site, display names |
| `game/data/mars/text.json` | Site names and notices, the lead, Mars rock names, readouts, debrief lines, desk card lines, credits |
| `game/data/tuning.json` → `budget` | The relative Titan test, if MS1 is accepted (Owner A) |
| Mars balance data (new) | Nodes, legs (MP5) and archetype plans for a Mars `winPaths` |
| `game/public/terrain/mars/terrain.json` | Pipeline output only (MP1 to MP4) |

## 5. Rock types

Mars has no rock list yet: `rockTypeFor` reads the Moon's. Six Mars types are proposed, each with a plain readout, plus per-site suites. These use the same mechanism as the Moon's (`instruments.xray.suites` keyed by site, `Boulder.site`). Laser readings use the same types. The organics spectrometer reads no rock type.

| Rock type | Readout | Where it is read | Support |
| --- | --- | --- | --- |
| Máaz basalt | Iron-rich lava rock: pyroxene and feldspar | The common rock: every crater-floor site | Máaz is lava, the chemical complement of Séítah (Farley et al. 2022). Its basaltic composition is from Udry et al. 2023 and Horgan et al. 2023 (*to check*) |
| Salt-veined basalt | Lava rock with salts in its pores, left by water | Rocky area 1, East crater, small craters | Sulfate and perchlorate salts from later brines in crater-floor rocks (Scheller et al. 2022) |
| Olivine cumulate | Packed green olivine crystals, rich in magnesium | Séítah edge; Rocky area 2 (*by design*, see below) | Séítah is an olivine cumulate (Liu et al. 2022) |
| Carbonate-bearing olivine rock | Olivine partly changed to carbonate by water | Séítah edge, Séítah knob | PIXL found carbonate, sulfate and chloride in Séítah's olivine (Tice et al. 2022) |
| Lake mudstone | Fine layers of mud laid down in still water | Delta foot | The delta's fine-grained layers formed in the lake (Mangold et al. 2021; JPL, Wildcat Ridge) |
| **Flood conglomerate** (rare) | Rounded pebbles and cobbles cemented together, carried by a flood | The flood boulder only | Boulder-bearing top layers record floods (Mangold et al. 2021). *Placed by design* |

**Site suites.** Each boulder reads the same rock every run, picked by weight and seeded by its position (the Moon's rule).

| Site | Suite (weight) | Types a full visit finds |
| --- | --- | --- |
| Rocky area 1 | Máaz basalt 5, salt-veined basalt 5 | 2 |
| Rocky area 2 | Máaz basalt 5, olivine cumulate 5 | 2 |
| East crater, small craters | Salt-veined basalt 6, Máaz basalt 4 | 2 |
| Séítah edge, Séítah knob | Olivine cumulate 6, carbonate-bearing olivine rock 4 | 2 |
| Delta foot | Lake mudstone 7, Máaz basalt 3 | 2 |
| Flood boulder | Flood conglomerate (fixed) | 1 (rare) |

- **Olivine at Rocky area 2 is a design choice.** RIMFAX saw layers dipping away from Séítah beneath the floor (Hamran et al. 2022), and a 300 m crater digs up rock from about 30 m down (Melosh 1989). The game lets Rocky area 2's ejecta hold olivine rock, so a near X-ray rover finds 3 types within 0.7 km. The fact text says "inspired by" ([MS9](#7-open-questions)).
- Rock collection's top stage (4 types) needs Séítah, or the delta plus Rocky area 2.

**Map impact:**

- **Boulders at the new sites.** `scatterBoulders` today scatters 160 boulders per rocky area and nothing else. It gains:
  - young craters (30 each; 60 for East crater), spread at 1.1 × radius;
  - the Séítah edge (40, firm ground only);
  - the delta foot (40 along the zone);
  - the two knobs (15 each);
  - the flood boulder (2.5 m).

  Boulders get their `site` (the field exists in the type but is never set today). Boulders skip soft ground.
- **Slope targets are boulders on 10 to 18° ground.** `scatterBoulders` biases a share of the young-crater and knob boulders onto those cells (from `slope.png`), with level ground within reach (MP2).
- **No new world graphic.** The flood boulder is a larger boulder. There is no track decal, unlike the Moon's rolled boulder.
- **The pipeline does not need a rock map.** The suites are design, anchored to the published units (Máaz, Séítah, the delta).

## 6. Implementation phases

Each phase ends with tests and the build passing, a browser check on both worlds, and a commit of only its own paths. Mechanics settled during a phase go into game-design.md as "decided during implementation".

### What this plan depends on

| Mars plan item | Proposed answer | What here depends on it |
| --- | --- | --- |
| M3 | The neutron spectrometer stays if it has a target | Hydrated ground and Hydrogen traverse. If M3 drops it, both go and the neutron prospector goes |
| M6 | The X-ray spectrometer needs the arm on Mars | The Rock hound's spend; the arm lesson's targets |
| M11 | Repricing: arm, mast, RTG, organics, laser, larger battery | Every spend in [§4](#sample-builds-and-routes). At draft prices the arm and laser builds cannot pass |
| M12 | Moon tiers | Every ticket. All builds here are under 90 kg and size 26 (C10) |
| **M13** | Fixed test, relative if no reward set works | **[MS1](#7-open-questions):** this plan invokes the fallback. Capability rewards depend on the answer |
| M14 | Reworded answers ("park level beside the target") | The rare boulder's level side; Rocky area 1 as level ground |
| M15 | Drop the electric heater lesson | One spoiler-guard row |
| **M16** | `record.seconds` for instruments aboard | Storm log, Night weather, Dust devil pass: all three weather mast milestones |
| M17 | Any `heat` meets the heater requirement | The RTG geologist's Night drive (no heater part) |
| M18 | Derive "needs the arm" from `needs` | The debrief's "Not reached" list |
| M19 | Later stations follow the Moon's rule | Nothing here: no Mars station |
| Mars plan Phase 4 | The arm's slope refusal | The arm lesson (MS2's 10°) |
| Mars plan Phase 5 | Dust devils exist | Dust devil, Dust devil pass ([MS8](#7-open-questions)) |
| Moon plan Phase 3 | The shared trigger rules | Every new trigger here |

### Changes to the built Mars world

Owner B built the Mars world and owns placement. This plan would change:

| What | Today | Proposed | Why |
| --- | --- | --- | --- |
| Blue sunset | 70 | 100 | Camera money near the lander (C2) |
| Night drive | 50 per stage | 30 per stage | The empty bay with lights must fail (C3, relative test) |
| Capability rewards | Touchdown 80, Odometer 30, Mapper 60, Storm survivor 60 | Unchanged under MS1; cut about 60% if MS1 is rejected (set A) | C3 |
| Core sample's fact | Wildcat Ridge, and "detected the mission's most abundant organic molecules" | A crater-floor fact (the first sample attempt in August 2021, when the rock crumbled; NASA) | Wildcat Ridge moves to Signs of an ancient lake and Lake organics. The Mars plan's wording rule says "signals consistent with", never "detected organic molecules" |
| Night drive's fact | "lows near −83 °C" from "NASA's First Weather Report" | Check the source | The fact check found the −83 °C low in a later MEDA report, while the first report showed about −20 to −26 °C. Not verified against NASA's page |
| Rocky area 2 | `radius_m` 204, "about 255 m across" | Ask the pipeline to re-measure (MP1) | Measured about 300 m across and 14 m deep, not round |
| Signs of an ancient lake (proposed) | The `delta-front` zone (150 m) | A 50 m `delta-foot` zone | The 150 m zone includes igneous crater floor |
| Clean run (proposed) | In game-design.md | Dropped | Idle rovers earn it (C3) |
| Survey leads | Delta, Séítah, rocks | + "Young crater" to East crater | Something to the east |
| Boulders | Rocky areas only | + young craters, Séítah edge, delta foot, knobs, the flood boulder | Contact targets in every cluster |

Owner B's Mars milestones and rules otherwise stay as built: their zones, the sunset band, the 200 m sample rule, Night drive's requirements and Storm survivor.

### Phase 0: Design first

- Decide the [open questions](#7-open-questions) with Owner B (placement) and Owner A (MS1, rewards).
- The Mars plan's Phase 0 decides M11 to M19. This plan's numbers move with them.
- Record in game-design.md:
  - the Mars milestones table and "How the Mars milestones work" (new milestones, changed rewards, zones, the arm limit);
  - Site: Jezero (new site kinds, the fourth lead);
  - Balance (the relative test if accepted; archetypes as targets).
- Record in rover-engineering-design.md: Mars rock types; what each Mars instrument earns.

**Done when:** both docs say *Decided* for everything Phases 2 to 6 build, and Owner B has accepted the placements.

### Phase 1: Pipeline requests (Mars terrain pipeline owner)

These are requests to `game/tools/build_terrain_mars.py`, as additions to Mars `terrain.json` `features`. No new image layers.

| # | Request | Output |
| --- | --- | --- |
| MP1 | **Young craters.** Please list the craters 80 to 400 m across within 1.6 km of the landing, with center, rim radius, depth, max wall slope and drive distance. Freshness should be checked as blocky ejecta in the 25 cm HiRISE mosaic. Candidates: East crater (1,815, −720), (870, 70), (1,115, 295), (1,760, −195), (310, 70). Please re-measure Rocky area 2: we measure 290 to 310 m across, 14 m deep and not round, against the 255 m in `terrain.json` | `features.youngCraters[]`; Rocky area 2's description, if it changes |
| MP2 | **Slope target cells.** Please find cells with 10 to 18° slope that lie within 5 m of ground under 8°, at the young craters, the knobs (305, −835) and (620, 445), and the delta foot. They are listed as patches per site | `features.slopeTargets[]` |
| MP3 | **Delta foot.** Please give the nearest 400 m of the scarp-foot line to the landing, and one spot for the flood boulder. The ground must be 12 to 18° on its uphill and side faces, under 10° within 3 m of its downhill face, and outside the 1,350 m ring, so the delta stays the far destination | `features.deltaFront.footNear`, `features.deltaFront.floodBoulder` |
| MP4 | **Perseverance's sample sites within 1.6 km.** Please list the abrasion and sampling waypoints from the M20 waypoints file, with sol, name and position. We found Brac at (557, 632) and would like the others confirmed (the first sample attempt, August 2021; Issole) | `features.perseveranceSites[]`, as landmarks and fact anchors |
| MP5 | **Route legs for Mars.** Please measure drive legs between the landing, Rocky area 2, the knob, the delta viewpoint, the delta foot, the two south craters, Rocky area 1, the hydrated ground (once chosen), the Séítah knob, Brac, East crater and the ESE crater, on the 10 m grid with slopes up to 18°. Please commit the tool under `game/tools/` (the Moon plan's P5 asks the same) | Nodes and legs for a Mars balance model |
| MP6 | **Optional: Wright Brothers Field and the Mars 2020 backshell and parachute,** positions from the Ingenuity flight log, if MS12 wants them for the briefing | Coordinates, or "outside the play area" |

**Parallel:** MP1 to MP4 can run alongside Phases 2 and 3, which use stub features in `testData.ts`. MP5 needs MP1 to MP3 and the hydrated ground's position. MP6 is independent.

**Done when:** `terrain.json` has the new feature lists, the candidates in [§2](#where-they-go-three-clusters) are confirmed or replaced, and the legs exist.

### Phase 2: Data and types

- `rules/marsTypes.ts`: `MarsZoneId` gains `delta-foot`. Plus feature types for MP1 to MP4, Mars rock ids, and a `SitesFile` overlay for Mars (the Moon's type).
- `data/mars/milestones.json`, `tuning.json`, `sites.json` (new), `text.json`, including facts with sources, checked again before they go in.
- `rules/validate.ts`: Mars trigger zones, instrument ids (Mars catalog), rock ids, and `sites.json` references.
- `data.test.ts`: the Mars milestone count (8 → 27) and the new checks.

**Parallel:** with Phase 1. Must land before Phase 3. Needs the Mars plan's Phase 1 (catalog per world) so instrument ids validate.

**Done when:** Mars data loads and validates, and the game runs with the new milestones present but not yet firing.

### Phase 3: Pure rules with tests

| Rule | File | Tests |
| --- | --- | --- |
| Mars zones: `young-crater`, `delta-foot`, `hydrogen-anomaly`, the flood boulder | `rules/milestones.ts` `buildZones`, `rules/survey.ts` `buildSites` | Zone membership at the edges; the 50 m foot against the 150 m front |
| `transect` with no zone (outside `near-lander`); `reading.sites` by `Boulder.site` | `rules/milestones.ts` (shared, agreed with the Moon's owner) | Long profile counts only outside 200 m; two readings at one site make one stage |
| `photo` target `crater-wall` | `rules/milestones.ts` | Rim band, center in frame |
| Hydrogen reading on Mars: unit shares, the anomaly and its core | `rules/instruments.ts` `hydrogenReading` | Reading at the core, at 80 m, in Séítah; with the RTG's raised floor and jitter |
| Mars rock suites; the flood boulder | `rules/instruments.ts` `rockTypeFor`, `rules/boulders.ts` | The same boulder gives the same rock; each site gives only its suite; the flood boulder is fixed |
| Boulders at the new sites; slope bias; no boulders on soft ground | `rules/boulders.ts` `scatterBoulders` | Counts per site; a share on 10 to 18° cells |
| Survey: new site kinds, the fourth lead, hydrated ground hidden until found | `rules/survey.ts` | The reveal circle never discovers the hydrated ground |

**Parallel:** zones, instruments and boulders can be three tasks. **Not parallel with the Moon plan's Phase 3:** the triggers are shared, so they are built once, Moon first. `record.seconds` comes from the Mars plan's Phase 6.

**Done when:** `npm test` covers every new Mars milestone with a firing and a non-firing case, and every Moon test passes unchanged.

### Phase 4: World and site placement

- Boulders at the new sites, with the flood boulder larger (`world/boulders.ts`).
- The mission screen feeds the triggers:
  - radar and neutron standby distance through zones;
  - X-ray, laser and organics readings with site and rock;
  - weather-mast seconds during the storm and the night;
  - photo targets in frame.
- The arm's slope refusal (Mars plan Phase 4) is in place before contact targets are tested.

**Parallel:** needs Phase 1 (real positions), Phase 3, and the Mars plan's Phases 3 and 4 (arm, mast and instruments exist).

**Done when:** in the browser every new site is where `terrain.json` says, slope-target boulders sit on ground the arm refuses with level ground beside them, and the hydrated ground can be found with the meter.

### Phase 5: HUD, minimap and debrief

- Minimap: young crater rings, the delta foot stretch, the flood boulder icon, "Hydrated ground" after it is found, site check marks, the fourth lead, legend entries.
- HUD: the "New type: n of 6" line; site discovery notices with instrument lines; the weather mast's "recording" state during the storm and the night.
- Desk: Mars instrument cards list their milestones.
- Debrief: the new milestones and the "Not reached" list.
- Text: facts and sources for every new milestone, fact-checked before they go in; credits.

**Parallel:** minimap, HUD and debrief are separate tasks after Phase 3. Text can start in Phase 2.

**Done when:** a first-time player can find and earn each new milestone from the map and the notices alone, and no Mars text fails the [guard](#milestones-and-the-relationship-lessons). A grep test checks each lesson's key words in the new texts.

### Phase 6: Balance and browser check

- A Mars balance model: either `winPaths` per world, or a Mars energy-and-route check built on `marsNight.test.ts`, with the MP5 legs ([MS13](#7-open-questions)).
- Targets as in [§4](#targets-for-the-balance-tests); retune rewards in `data/mars/milestones.json` until they hold.
- Browser autopilot runs from an unexplored map at B = 780 and B = 950: idle, empty bay, and each archetype in §4.

**Done when:** the model and browser agree within about 50 per run, and game-design.md has the result tables.

### Phase 7: Playtest and docs

- A Mars playtest checklist (the Mars plan's Phase 7) covers each new milestone, each site, the arm lesson at Rocky area 2, and a restart.
- game-design.md marks each piece built.

**Shipping:** Phases 2 to 5 ship with the Mars plan's Phases 4 to 6 (new instruments arrive with their milestones), and Phase 6 must finish before the merge to `main`.

### Risks

| Risk | Why | Mitigation |
| --- | --- | --- |
| MS1 is rejected | The fixed test forces set A's capability cuts and pushes most archetypes to the delta | Raise every instrument route by about 140 and accept the delta's large margins; or give Mars its own budget rule (Owner A) |
| Too many builds pass | The delta route pays two-instrument builds 175 to 220 over | The 40% target; lower the delta-only rewards first |
| The arm lesson never happens | Players read on level ground by chance | Rocky area 2 is the first site out and its rim approach is the steep side. Slope bias in the scatter |
| The arm lesson blocks the rare rock | A flood boulder that the arm can reach from no side | MP3's level downhill face; a test that the boulder is readable from level ground |
| RTG noise costs nothing | A noisy rover can still drive over the core | Small hidden core; jitter tuned against the gradient; the `dwellS` fallback (MS4) |
| Dust devils are too rare to plan for | Random events | They are bonuses in the balance; MS8 sets a rate so a whole mission usually has one |
| Designed placements read as real | Hydrated ground, flood boulder, olivine at Rocky area 2 | "Inspired by" in the facts; this doc marks them *placed by design* |
| 27 Mars milestones overwhelm a child | Long debrief | Cards list only carried instruments' milestones; the debrief groups by instrument; staged ones show as one line |
| Organics runs out of energy | Two long holds plus a 1.8 km route | Phase 6 energy check; if it fails, Organic signals drops to one stage at a higher reward |

## 7. Open questions

All of these are proposed, not decided.

| # | Question | Proposed answer |
| --- | --- | --- |
| MS1 | Titan pass test: keep the fixed 800 mark (and cut capability rewards about 60%), or switch to M13's relative fallback? | Switch: Mars passes at a final of at least 800 and at least the arrival balance ("Mars must pay for itself"). Capability rewards stay, except Night drive at 30. Owner A decides |
| MS2 | The arm's slope limit for contact readings (Mars plan Phase 4) | 10°: the arm lesson then has a drivable 10 to 18° band, and Rocky area 2's inner wall is about half under 8° and half over |
| MS3 | The rare rock | One flood boulder at the delta foot, flood conglomerate, *placed by design*, readable from its downhill side |
| MS4 | How the RTG noise can cost the neutron milestone (C6) | A small hidden core (25 m), with jitter at least the anomaly's rise at 30 m. Add `transect.dwellS` only if playtests show noisy rovers still find it |
| MS5 | Signs of an ancient lake's zone | A new 50 m `delta-foot` zone, not the 150 m `delta-front` zone |
| MS6 | East crater as a site, with a fourth lead | Yes, if MP1 confirms it is fresh; otherwise use the ESE crater and no lead |
| MS7 | Clean run (proposed in game-design.md) | Drop it: idle rovers earn it |
| MS8 | Dust devil rate (Phase 5) | Frequent enough that most missions show one within 300 m: real Jezero has about four vortices per sol. The milestones stay out of the balance until Phase 5 |
| MS9 | Olivine rock in Rocky area 2's suite | Yes, *placed by design*, inspired by RIMFAX's dipping layers and crater excavation |
| MS10 | Mars rock types | The six in §5, with plain readouts |
| MS11 | Combos | Only Documented sample (camera + X-ray). No laser + contact, no neutron + solar |
| MS12 | Wright Brothers Field and other mission landmarks | No milestone (nothing to see). Optionally a briefing line if MP6 gives a position. Brac is named in Séítah core's fact |
| MS13 | Mars balance model | Extend `winPaths` per world before Phase 6, with the MP5 legs and the Mars night energy; `marsNight.test.ts` stays the regression check |
| MS14 | Does Night weather count for a parked, awake rover with no lights? | Yes: awake is enough (1/s plus standby). Lights are not needed, so the no-lights block is not spoiled |
| MS15 | Should the Rock hound's south route pass from B = 780? | Not required. If wanted, add carbonate-bearing olivine rock to the Séítah knob as a fifth type there |

## Sources and what is not verified

These were checked on November 15, 2026, mostly from abstracts, publisher pages, NASA pages and search summaries (marked). Every fact is checked again before it reaches `text.json`.

| Claim | Source | Status |
| --- | --- | --- |
| Séítah is an olivine cumulate, Máaz the lava that complements it | Farley et al. (2022), Science 377, eabo2196 | Abstract; the DOI (10.1126/science.abo2196) is inferred from the article id |
| Máaz is basaltic to basaltic-andesite | Udry et al. (2023); Horgan et al. (2023), JGR Planets | Search summaries; not read |
| Séítah olivine cumulate, PIXL, Brac and Issole | Liu et al. (2022), Science 377:1513, doi:10.1126/science.abo2756 | Verified (abstract) |
| Carbonate, sulfate and chloride in Séítah's olivine | Tice et al. (2022), Science Advances 8(47), doi:10.1126/sciadv.abp9084 | Verified (abstract). Carbonate origin unresolved |
| Salts from brines in crater-floor rocks; aromatic organic signals | Scheller et al. (2022), Science 378:1105 | Abstract; DOI not found |
| Organic signals in all ten crater-floor targets, abiotic not ruled out | Sharma et al. (2023), Nature 619, doi:10.1038/s41586-023-06143-z | Verified (abstract) |
| RIMFAX layers beneath the floor, dipping up to about 15°, to about 15 m, over about 3 km | Hamran et al. (2022), Science Advances, doi:10.1126/sciadv.abp8564 | Partly (press). "Dip under Máaz" is **not** supported; layers dip away from Séítah |
| Boulders up to about 1.5 m in the delta's top layers record floods | Mangold et al. (2021), Science 374, doi:10.1126/science.abl4051 | Press and secondary sources |
| Wildcat Ridge: delta mudstone cored 2022; strongest organic signals | NASA JPL (2022), cited in Owner B's Core sample fact | Not re-checked this pass |
| First sample attempt (August 2021) came back empty; the rock was too crumbly | NASA, "Assessing Perseverance's first sample attempt" | Partly. The names "Roubion" (attempt) and "Montdenier" or "Rochette" (first core) are not confirmed and not used |
| Brac's position | Pipeline's `SEITAH_SAMPLES` (Simon et al. 2023, Table 2), converted to local | From the pipeline's own constant |
| About four vortices per sol at Jezero, over a quarter dusty | Newman et al. (2022), Science Advances, doi:10.1126/sciadv.abn3783 | Verified (abstract). Hueso et al. (2023) gives about 4.9 per sol; its DOI was not found |
| First sound of a Martian dust devil, sol 215 | Murdoch et al. (2022), Nature Communications 13:7505, doi:10.1038/s41467-022-35100-z | Verified |
| SuperCam's laser reach of about 7 m; the microphone hears the zaps | CNES SuperCam page (Mars plan); Maurice et al. (2022), Nature, doi:10.1038/s41586-022-04679-0 | Reach checked in the Mars plan; the microphone and hardness claim is partly checked (coverage) |
| DAN: water-equivalent hydrogen varies by 2 to 3% over a 15 m traverse | Litvak et al. (2014), JGR Planets 119:1259, doi:10.1002/2013JE004556; Starr et al. (2015), Icarus | Partly (abstracts). "Fracture halos" not found and not used |
| Odyssey: 2 to 10% water-equivalent hydrogen near the equator | Feldman et al. (2004), JGR 109, E09006 | Partly (abstract) |
| RTG background in DAN's counts | Jun et al. (2013), JGR Planets 118:2400 | In the Mars plan; not re-checked |
| Craters excavate from about a tenth of their diameter | Melosh (1989), *Impact Cratering* | Partly: the secondary citation was seen, not the page |
| Opportunity studied Victoria crater's wall layers | Squyres et al. (2009), Science 324 | **Not verified** |
| WATSON photographs the rocks Perseverance studies | | **Not verified** |
| MEDA recorded a regional dust storm in January 2022 | Lemmon et al. (2022), GRL | **Not verified** |
| Jezero night lows near −83 °C | NASA MEDA reports | **Attribution wrong** in Owner B's Night drive fact (a later report, not the first). Not checked against NASA's page |
| Perseverance photographed Séítah's megaripples, or avoided Séítah's sand | | **Not found** (NASA says it drove through deliberately). Not used |
| Wright Brothers Field's position | | **Not found.** Not used (MS12, MP6) |
| Duplicate cores: one kept, one at the Three Forks depot | NASA, Three Forks pages | Partly: pairings are not always one-to-one. Not used |

**Not verified at all:**

- my terrain measurements (a crude crater finder and slope bands over the game's own 5 m layers);
- whether East crater and the small craters are fresh (no HiRISE check);
- every drive distance (straight lines only, until MP5);
- the route energy for the organics hunter;
- the hand balance estimates, which no Mars `winPaths` has checked.
