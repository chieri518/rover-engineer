# Plan: Moon Sites and Instrument Milestones

New areas of interest on the Moon map and the milestones that give all six Moon instruments something to earn. Written for our team. Design comes first ([Goals](#1-goals-and-principles) to [Rock types](#5-rock-types)); the build plan follows ([Phases](#6-implementation-phases)).

Written November 15, 2026, against `aon/moon-milestones` (from `main` at `8042a87`). Game rules stay in [game-design.md](game-design.md) (source of truth); the catalog is in [rover engineering design](rover-engineering-design.md). The repo rules still apply: game numbers in `game/data/*.json`, pure rules in `game/src/rules/` with unit tests, `npm test` and `npm run build` passing before each commit, design changes in game-design.md before code, and no hand edits to `game/tools/` or `game/public/terrain/`.

**Status: Phases 0 to 7 done (November 15, 2026); open questions decided. Phase 0 done** except the agreement with the Mars plan's owner (M6): game-design.md `f4001d2`, rover-engineering-design.md `f0ec0be`. The team accepted every proposed answer in [Open questions](#7-open-questions). Coordinates are candidates from a quick offline look at the terrain layers (see [How placement uses the terrain layers](#how-placement-uses-the-terrain-layers)); the pipeline confirms them. Rewards are starting values; the balance model sets the final ones.

Quick navigation: [Goals](#1-goals-and-principles) · [Sites](#2-sites-and-areas-of-interest) · [Milestones](#3-milestones) · [Balance](#4-balance) · [Rock types](#5-rock-types) · [Phases](#6-implementation-phases) · [Open questions](#7-open-questions) · [Sources](#sources-and-what-is-not-verified)

## 1. Goals and principles

**The problem.** Reaching the ice takes nearly the whole mission, and four of the six instruments earn nothing, so most runs pick one of three routes and the bay is a camera-or-drill choice. The fix is more to do **near** the lander, not farther to drive.

1. **Density over distance.** Every new site sits within about 1 km of the lander, most within 650 m. A good run visits more places, not farther ones. The dark crater stays the one far destination.
2. **Variety of verbs.** Each instrument gets its own reason to stop, and each cluster offers at least three verbs. A three-instrument rover should play differently from a one-instrument rover on the same ground.
3. **Approachable for kids.** Sites have plain names ("East crater", "Cold trap"), the discovery notice says what the rover's own instruments can do there, and progress shows as counts ("3 of 5 rock types"). No new keys or modes.
4. **Real science, honestly placed.** Each milestone does in the game what the instrument does in reality, with a checkable source. Where the game places something by design (the rolled boulder, the hidden hydrogen spot), the doc and the fact text say so: inspired by real findings, not observed at this spot.
5. **Lessons are discovered, never given away.** Milestones put the player where a relationship can happen; no milestone, site name, notice or lead names a lesson's cause or its solution (rules in [Milestones and the relationship lessons](#milestones-and-the-relationship-lessons)).
6. **Several ways to pass, still.** The existing balance rule holds: idling, wandering, a short trip or carrying an instrument without using it fails; several different builds pass on different routes.

## 2. Sites and areas of interest

### The map today, and the gap

Sites in `terrain.json` now: Rocky area 1 (341 m drive, west-northwest), Rim viewpoint 1 (539 m), the de Gerlache wall descent (857 m, south-southwest), Rocky area 2 (1,223 m, south), Rim viewpoint 2 (1,618 m) and the dark crater (2,924 m, north). **Nothing lies east of the lander**, though the rover's start view (azimuth 0°) puts the east on its right, and nothing on the map is for the neutron spectrometer, the stations or a rock collection.

### New site kinds

| Kind | What it is | Real basis | Instruments it serves | Count |
| --- | --- | --- | --- | --- |
| **Young crater** | A small fresh crater (40 to 120 m across) with a ring of boulders and bright ejecta | Fresh craters are ringed by boulders and bright, little-weathered ejecta (Grier et al. 2001) | X-ray (its own rock suite), drill (fresh ejecta), camera | 3 |
| **Cold trap** | A small permanently shadowed patch from the LOLA 60 m shadow map (micro cold trap), with the Rocky area 1 cold patch counted as one | Small cold traps are common and may hold ice (Hayne et al. 2021) | Neutron (survey), and the cold rules for everything else | 3 near, 1 far |
| **Rolled boulder** | One large boulder (3 to 4 m) at the foot of a steep wall, with a track up the slope behind it | LRO images show more than 136,000 boulders that rolled downslope (Bickel et al. 2020) | X-ray (rare rock), camera | 1 |
| **Hidden hydrogen** | A sunlit but poorly lit slope where the neutron meter reads higher than in the cold traps. Never marked until found | LEND found hydrogen-rich areas that do not line up with permanent shadow (Mitrofanov et al. 2010) | Neutron | 1 |
| **Ice signal** | The area around the existing hidden ice spot where the meter reads at least 70% | VIPER's neutron spectrometer prospects for hydrogen while driving | Neutron | 1 (existing spot) |

Not a site: **Earth in view.** The reflector and the Earth photo keep their line-of-sight test. Measured on the terrain, Earth is in view from about 52% of the ground within 1.5 km of the lander, and the area barely shrinks with stricter tests (Earth at least 1° clear of the horizon: 51%), because the north flank simply falls away. That is the landing site's selection criterion working, not a bug; see [M2](#7-open-questions).

### Where they go: three rings

Directions are game compass points from the lander (azimuth from local −z toward +x). Straight-line distances; drive distances come from the pipeline (P5).

| Ring | Site | Kind | Candidate (local x, z) | From the lander | Notes |
| --- | --- | --- | --- | --- | --- |
| Home (under 650 m) | **NW crater** | Young crater | (−860, −210) | 244 m NNW | About 8 m deep; on the way to Rocky area 1 |
| | Rocky area 1 + its **cold patch** | Rocky area + cold trap | (−1,170, −230) | 492 m WNW (341 m drive) | Existing. Its cold patch (0.05 km²) becomes a cold trap site |
| | **Hidden hydrogen** | Hidden hydrogen | near (−1,100, −390) | 534 m NW | Shaded north slope between Rocky area 1 and Rim viewpoint 1: average sunlight 5 to 9%, not permanent shadow, slope 12 to 14° |
| | **East crater** + **rolled boulder** | Young crater + rolled boulder | (−240, −120) | 509 m ENE | About 11 m deep, inner wall up to 39°. The boulder sits on its floor below the steepest wall |
| | **East cold trap** | Cold trap | (−132, 122) | 615 m ESE | About 50 m across, 5 m above the landing; LOLA PSR fraction 0.92 |
| Middle (0.65 to 1.6 km) | **South cold trap** | Cold trap | (−972, 902) | 930 m SSW | 240 m from the wall descent point, so a wall trip can add it |
| | **West crater** | Young crater | (−1,790, −30) | 1,055 m W | About 9 m deep |
| | Rim viewpoints 1 and 2, wall descent, Rocky area 2 | Existing | | | Unchanged |
| Far | Dark crater, **ice signal** | Existing + ice signal | | 2.9 km N | The ice signal is a zone around the existing ice spot |
| | North cold trap (optional) | Cold trap | (520, −2,330) | 2.65 km NNE | 0.03 km²; only a dark-crater route passes near it. Leave out unless P1 shows it is on a real route |

**Two dense clusters near the lander.** The **East cluster** (East crater, rolled boulder, East cold trap, and the Earth-facing bench between them and the lander) holds something for every instrument within 650 m. The **West cluster** (NW crater, Rocky area 1 and its cold patch, hidden hydrogen, Rim viewpoint 1) does the same along routes players already drive. The two are about 900 m apart through the lander, so a run can do both and still reach a rim photo, or do one and head for the wall or the dark crater.

| Instrument | East cluster | West cluster |
| --- | --- | --- |
| Camera | Rolled boulder photo, Earth from the bench | Rim panorama, Earth from Rim viewpoint 1 |
| Drill | Fresh ejecta at East crater; regolith sites | Fresh ejecta at NW crater or Rocky area 1; regolith sites |
| Neutron | East cold trap | Rocky area 1 cold patch, hidden hydrogen |
| X-ray | Noritic anorthosite, rare rock at the rolled boulder | Regolith breccia (NW crater), impact melt breccia (Rocky area 1) |
| Seismometer, reflector | The bench (Earth in view, 300 to 450 m out) | Rim viewpoint 1 or the ground north of Rocky area 1 |

### On the map and minimap

The exploring minimap's rules stay ([Minimap and exploration](game-design.md#minimap-and-exploration)): hidden until the reveal circle touches a site, then drawn with a "Located" notice.

| Kind | Before discovery | When discovered | After discovery |
| --- | --- | --- | --- |
| Young crater | Hidden (fog) | Ring icon; notice names it and, for instruments aboard only, what they can do there ("East crater: fresh boulders and ejecta. X-ray spectrometer: read the rocks.") | Ring; a small check once every milestone this rover can earn there is earned |
| Cold trap | Hidden | Its outline, a small dashed patch in its own style; notice "Cold trap: a small patch of ground where hydrogen may collect." plus the neutron line if aboard (reworded after the Phase 0 and Phase 5 reviews: no "shadow" or "very cold", per the spoiler guard) | Outline; check when surveyed |
| Rolled boulder | Hidden | Boulder icon with a short track line up the slope | Check when read and photographed (whichever the rover can) |
| Hidden hydrogen | **Never drawn until found.** Only the neutron meter can find it (it rises as the rover nears) | When the survey milestone fires: a dotted area labelled "Hydrogen-rich ground" | Stays drawn |
| Ice signal | Never drawn; the ice spot stays unmarked, as decided | Not drawn: earning it tells the player where the ice is, which is the meter's job | |

- **A fourth survey lead.** "Young crater" (LROC images), pointing at East crater, about 0.5 km east-northeast. It pulls first-time players to the East cluster, as lead 2 pulls them to Rocky area 1. Cold traps get no lead: the West one is inside lead 2's area, and the others are found by driving or by the meter's rise near them. See [M7](#7-open-questions).
- **Site notices are instrument-aware but lesson-blind.** They say what the carried instruments do there, never what might go wrong (no "watch the cold", no "drive away from the station").
- **Map reset each try** applies to the new sites too.

### How placement uses the terrain layers

What each layer can already support, checked with a short script over the files in `game/public/terrain/`:

| Layer | Resolution | What it gives placement | Limits found |
| --- | --- | --- | --- |
| `heightmap.png` | 5 m | Small craters (local depressions with steep rims): candidates at (−240, −120), (−860, −210), (−1,790, −30), (380, −320); boulder-track walls; drive routes | Crater detection here was a crude local-minimum test; the pipeline should confirm with rim shape and the LROC mosaic |
| `slope.png` | 5 m | Steep walls for the rolled boulder (over 25°), level ground for stations, route limits | |
| `cold-mask.png` | 60 m, bilinear to 5 m | Cold traps: 10 permanent-shadow patches in the play area; the nearest are Rocky area 1's (52,600 m², 405 m), East (2,200 m², 587 m), South (2,200 m², 906 m), North (27,400 m², 2.55 km) | East and South are about one 60 m source pixel each: real in the LOLA map, but at its resolution limit. Fine for a game site; the fact text should not give them a size |
| `illumination.png` | 60 m | Hidden hydrogen (non-shadow ground with average sunlight under 15%); charging spots; where the X-ray works faster | Within 1 km of the lander the brightest ground is 66% (the landing is 66%), so there is no "peak of light" site to add |
| `earth-visibility.png` | 60 m | Whether Earth is ever seen from a place | Nearly two-valued near the lander: 36% of ground never sees Earth, 46% sees it 60 to 65% of the time. It cannot rank reflector spots |

New layers are not needed. The pipeline adds feature lists to `terrain.json` (requests P1 to P4 in [Phase 1](#phase-1-pipeline-requests-data-pipeline-owner)).

## 3. Milestones

### New milestones

Twelve new milestones, at least one for every Moon instrument, two of them combos. Rewards are in the existing units ([§6](game-design.md#6-economy-and-milestones)): scientific milestones mainly RP, pictures a little money, records a big one-off boost. All distances "from the lander" use the existing 200 m `near-lander` zone unless stated.

| Milestone | Category | Instrument(s) | Site / condition | Money / RP | Real science (source) |
| --- | --- | --- | --- | --- | --- |
| **Cold trap survey** | Scientific: new information | Neutron | Neutron spectrometer switched on for an unbroken 50 m drive that passes within 25 m of a cold trap (or through it). One stage per cold trap, up to 3 | 50 / 8 per stage | Lunar Prospector's neutron spectrometer found extra hydrogen at both poles (Feldman et al. 1998); small cold traps are common and may hold ice (Hayne et al. 2021) |
| **Hidden hydrogen** | Scientific: strange formation | Neutron | Switched on through the hidden hydrogen zone (60 m circle), where the meter reads 40 to 50%, higher than in the cold traps | 100 / 20 | LEND found hydrogen-rich areas near the south pole that do not match the permanently shadowed regions (Mitrofanov et al. 2010). *Placed by design* |
| **Ice deposit located** | Scientific: new material | Neutron (needs lights) | Switched on inside the dark crater where the meter reads at least 70% (within about 90 m of the ice spot) | 200 / 30 | VIPER's neutron spectrometer was built to find hydrogen in the top meter of soil while driving (NASA VIPER). VIPER has not flown; NASA plans to deliver it on a Blue Origin lander |
| **Rock collection** | Scientific: new information | X-ray | Read 2, 3 and 4 different rock types (one stage each) | 40 / 8 per stage | Chandrayaan-3's X-ray spectrometer measured south polar soil as mostly ferroan anorthosite with a magnesium-rich part (Vadawale et al. 2024) |
| **Rare rock** | Record: first discovery | X-ray | Read the rolled boulder (magnesian norite, found nowhere else) | 100 / 30, once per campaign | Same study: the magnesium-rich material may come from deeper down. Rocks that roll down a wall bring material from upslope (Bickel et al. 2020). *Placed by design* |
| **Boulder track** | Scientific: strange formation | Camera | Photograph the rolled boulder in frame from within 80 m | 40 / 10 | Bickel et al. (2020): more than 136,000 rockfalls mapped in LRO images, most set off by impacts |
| **Documented sample** | Scientific: new information | Camera + X-ray | Photograph a boulder the X-ray spectrometer has read this mission, from within 15 m | 40 / 10 | Apollo crews photographed rocks where they lay before collecting them, so geologists knew each one's position (USGS and NASA Apollo sample reports) |
| **Fresh ejecta sample** | Scientific: new information | Drill | A drill sample inside a young crater's or rocky area's ejecta ring (1.5 × its radius) | 50 / 15 | Fresh crater material is less weathered by space and looks brighter (Grier et al. 2001) |
| **Moonquake record** | Scientific: new information | Seismometer | The station, set down outside the near-lander zone, records the moonquake (clean or noisy) | 80 / 20 | The Apollo seismic network recorded moonquakes for years; a strong 1973 shallow moonquake may have come from a fault near de Gerlache crater (Watters et al. 2024) |
| **Clean seismogram** | Scientific: new information | Seismometer | The record above is clean (the HUD's existing quality word) | 40 / 10 | Apollo 17's seismometers picked up many small quakes as the ground heated and cooled (Civilini et al. 2023) |
| **Laser ranging site** | Scientific: new information | Reflector | Set down where Earth is in view, outside the near-lander zone | 50 / 15 | Apollo's reflectors are still ranged from Earth (Murphy et al. 2010); in December 2023 LRO ranged the small reflector on India's Vikram lander |
| **Science station** | Record: key milestone | Seismometer + reflector | Both stations on the ground within 100 m of each other, outside the near-lander zone, Earth in view at the reflector | 50 / 10, once per campaign | Apollo 11 left a seismometer and a laser reflector side by side (the Early Apollo Scientific Experiments Package; ALSJ) |

**Changed existing milestones** (balance, see [§4](#4-balance)): Boulder field 100 → **60**, Mapper 60 → **40**. Regolith sample: a sample that also earns Fresh ejecta still counts as a regolith site (one drill action can earn both, as one photo can earn Rim panorama and Earth).

**What each instrument now earns.**

| Instrument | Before | After |
| --- | --- | --- |
| Camera | Crater layers, Rim panorama, Earth | + Boulder track, Documented sample (with X-ray) |
| Drill | Regolith ×3, Water ice | + Fresh ejecta sample |
| Neutron | Nothing (the meter) | Cold trap survey ×3, Hidden hydrogen, Ice deposit located |
| X-ray | Nothing (the log) | Rock collection ×3, Rare rock, Documented sample (with camera) |
| Seismometer | Nothing (the log) | Moonquake record, Clean seismogram, Science station (with reflector) |
| Reflector | Nothing | Laser ranging site, Science station (with seismometer) |

**Why these and not others.**

- **Neutron milestones all use one shape** (switched on, driving through a zone), so the meter is the finder and the survey is the verb. The hidden spot and the ice signal give the meter something to search for close by and far away.
- **Ice deposit located gives the neutron spectrometer its own dark-crater route.** The ice with both the neutron spectrometer and the drill does not fit the 750 budget (see [§4](#the-ice-with-both-instruments-does-not-fit)), so this is how the meter's best use stays reachable. Water ice still needs the drill.
- **No neutron-plus-drill combo.** Such a milestone would spell out the "neutron finds, drill confirms" lesson. Water ice already rewards the pair.
- **Clean seismogram is a separate milestone, not a stage,** so a noisy record still earns the first one and the lesson explains the gap.
- **Science station is a record** so it pays once per campaign; it is the Apollo 11 package and should feel like a one-time event.
- **Left out:** a second Earth photo, a lander portrait (free near the start), drilling in micro cold traps (would blur the ice story), a "fault scarp" photo (waits on P6, see [M12](#7-open-questions)).

### How the milestones work (rules)

The Mars plan defines three generic triggers (`reading`, `transect`, `record`; [Milestone types](mars-rover-engineering-implementation-plan.md#milestone-types)). The Moon should build them first and share them, with small extensions. None exists in code yet.

| Trigger | Shape (Mars plan + extensions in bold) | Moon milestones |
| --- | --- | --- |
| `transect` | `{ type, instrument, zone, meters, **sites?** }`: switched on for an unbroken drive of `meters` that touches the zone; **`sites` stages one per distinct zone instance** | Cold trap survey (`cold-trap`, 50 m, 3 sites), Hidden hydrogen (`hydrogen-anomaly`, 30 m), Ice deposit located (`ice-signal`, 20 m) |
| `reading` | `{ type, instrument, zone?, target?, sites?, **rocks?: number[]**, **rock?: string** }`: a use finishes; **`rocks` stages by distinct rock types read; `rock` needs that type** | Rock collection (`rocks: [2, 3, 4]`), Rare rock (`rock: "magnesian-norite"`) |
| `record` | `{ type, instrument, event, **quality?** }`: the instrument was deployed when the event came; **outside `near-lander`** | Moonquake record, Clean seismogram (`quality: "clean"`) |
| `deploy` (new) | `{ type, instrument, needs?: 'earth', near?: { instrument, withinM } }`: a station set down outside `near-lander`, with Earth in view if asked, near another station if asked | Laser ranging site, Science station |
| `photo` (exists) | New targets: `rolled-boulder` (in frame within `boulderTrackPhotoRangeM`), `read-boulder` (a boulder read this mission, within `documentedSampleRangeM`) | Boulder track, Documented sample |
| `drill` (exists) | New zone `young-crater` (ejecta rings of young craters and rocky areas) | Fresh ejecta sample |

- **Combos need every listed instrument.** `MilestoneRequirements` gains `instruments?: Instrument[]` (all required); `instrument` stays for single ones. A combo that fires on a rover missing one is not credited, with the existing notice naming the missing part.
- **"Too close to the lander" is said before, not after.** Stations cannot be picked up again, so within 200 m the station's HUD hint reads "Too close to the lander to count" and the first key press asks for a second press to set it down anyway. The reflector's "Earth in view" light gains a third state, "Earth in view · too close to the lander".
- **The hydrogen meter learns two things.** Near a cold trap it rises over a short edge ramp (`neutron.edgeRampM`, 25 m) to the cold background (20%), so a rover without lights can survey from the edge. The hidden hydrogen zone reads `neutron.anomalyPeak` (45%) at its center, falling to the noise floor at `anomalyRangeM` (80 m). This is a game simplification: a real rover-mounted detector senses only about its own footprint.
- **Cold traps join the cold rules.** Their names go into `tuning.cold.zones`, so they freeze an unheated rover, stop a rover without lights at their edge, and slow held uses without a heater, like Rocky area 1's patch today.
- **Rock types depend on the site** (see [§5](#5-rock-types)); the X-ray readout adds "New type: 3 of 5" when it counts.
- **Desk cards list what each instrument can earn,** by milestone name only, which also removes the "earns no milestones yet" line (it is already derived). See [M14](#7-open-questions).
- **Debrief: equipped but not reached.** With 25 Moon milestones, the debrief adds a short "Not reached" list: milestones the rover carried the parts for and did not earn, names only. See [M11](#7-open-questions).

### Milestones and the relationship lessons

The five Moon lessons stay as they are; this plan adds none. The new sites make each lesson more likely to happen and more worth learning, and the guard column keeps each one undiscovered until it happens.

| Lesson | Where the new map makes it happen | What makes it matter now | Spoiler guard |
| --- | --- | --- | --- |
| The neutron spectrometer finds the ice, the drill confirms it | Unchanged trigger (drilling in the dark crater without a neutron spectrometer). Cold traps near the lander let players see the meter work early, if they carry one | Ice deposit located pays the meter in the dark crater; Water ice pays the drill | No milestone needs neutron and drill together; no text says "drill where the meter peaks" |
| The seismometer needs quiet ground | A noisy record, as now | Clean seismogram is worth 40; Science station invites setting both stations down in one place and driving on | Texts say "record" and "clean", the HUD's existing words; never why. The timing clue in the tutorial stays the only hint |
| In the cold, instruments need the heater | Three cold traps within 1 km; a drill sample or station set down in one without a heater is slowed | Cold trap surveys and stations near cold traps put rovers there early in the run | No milestone needs a use inside the cold; the site notice never mentions cold |
| A colder X-ray detector gives sharper readings | Rocky area 1 and East crater's floor are shaded much of the mission (East crater center: 26% average sunlight), so readings there finish faster | Rock collection and Rare rock send X-ray rovers to those boulders | No milestone mentions shadow or temperature |
| No lights, no permanent shadow | A rover without lights stops at a cold trap's edge | The survey counts from the edge, so the stop is a lesson, not a dead end | Survey text says "pass near or through"; it never says lights |

## 4. Balance

### Method

The same as the November 15 pass: `winPaths.ts` drives each build along route plans with the real rules over measured legs. The numbers below are **hand estimates** with that model's assumptions (90% of top speed, one rock touch per boulder-field crossing, two flares with 8 s power-downs, the hidden spots found). Final = 750 − (parts + ticket) + 50 survival + milestone money; pass mark 780. Each estimate is confirmed by `winPaths` once the new legs are measured (P5), then in the browser.

### Sample builds and routes

| Build (parts; ticket) | Cost + ticket | Route | Main milestones | Final (margin) | Without using its instruments |
| --- | --- | --- | --- | --- | --- |
| **Camera scout** (existing; Medium) | 450 | Unchanged | As today, minus the Boulder field and Mapper cuts | 930 (+150) | 680, fails |
| **Drill geologist** (existing; Medium) | 550 | Unchanged north route, sample at Rocky area 1 counts as fresh ejecta | Regolith ×3, Fresh ejecta, Boulder field | 870 (+90) | 520, fails |
| **Ice hunter** (existing; Medium) | 735 | Unchanged | Water ice, Regolith ×2 | 875 (+95); 525 without the ice | 325, fails |
| **Rock hound**: titanium, mesh, panel, Li-ion, camera + X-ray (49 kg, size 19; Small) | 600 | NW crater → Rocky area 1, across → Rim viewpoint 1 (photo) → East crater, rolled boulder → East bench, Earth after 238 s; about 2.3 km | Rock collection ×3, Rare rock, Boulder track, Documented sample, Boulder field, Rim panorama, Earth | 940 (+160) | 470, fails (680 with the camera alone) |
| **Station keeper**: steel, mesh, panel, Li-ion, seismometer + reflector + X-ray (67 kg, size 21; Medium) | 620 | East bench: both stations down by about 40 s (the rover then weighs 60 kg and is faster) → East crater, rolled boulder → NW crater → Rocky area 1, across → Rim viewpoint 1; about 2.5 km | Science station, Laser ranging, Moonquake record, Clean seismogram, Rock collection ×3, Rare rock, Boulder field | 890 (+110) | 450, fails |
| **Near prospector**: titanium, mesh, panel, Li-ion, neutron + X-ray (50 kg, size 20; Small) | 630 | NW crater → Rocky area 1 cold patch edge → hidden hydrogen → East crater, rolled boulder → East cold trap; about 2.3 km | Cold trap survey ×2, Hidden hydrogen, Rock collection ×3, Rare rock, Boulder field | 860 (+80) | 450, fails |
| **Dark prospector**: steel, mesh, panel, Li-ion, lights, heater, neutron (68 kg, size 21; Medium) | 635 | Straight to the dark crater, 20 m in, out; about 3.0 km, done by about 275 s with no stop to drill | Ice deposit located, Into the dark, Cold trap survey ×1, Clean run | 825 (+45) | 575, fails |
| Empty bay: steel, mesh, panel, NiH2 (Medium) | 400 | Best capability route | Boulder field, Crater descent, Odometer, Mapper | **730 (fails by 50)**; was 790 | |
| Empty bay + reflector only (Medium) | 430 | As above, reflector on the north side | + Laser ranging | 750 (fails by 30) | |
| Idle, any build | | | | at most 510 | |

**What this shows.**

- **A neutron route exists now,** two of them: near (Near prospector) and far (Dark prospector). The far one is tight on time like the ice, and its margin is small; adding a camera on steel (Earth on the way out) would give about +80 but at about 283 s.
- **Every new archetype fails without its instruments,** and the station builds fail hard, because the stations earn most of their run.
- **The new archetypes pass by 45 to 160.** That is the same spread as today (Camera scout +210 before this plan). The risk is the share of passing builds; see below.

### The empty-bay pass

Today a steel/mesh empty bay reaches 790 on Boulder field (100), Crater descent (60), Mapper (60) and the Odometer. With instruments now able to earn their way, the two capability milestones that were raised in the balance pass to prop up the instrument archetypes come back down: **Boulder field 100 → 60, Mapper 60 → 40.** The empty bay ends at 730, failing by 50 (the model's mistake margin). Crater descent stays at 60: it is the camera scout's main capability reward, and cutting it is not needed.

### The tight ice route

Not changed. The drill-only ice route stays the highest-risk path (arrives about 276 to 291 s in browser runs). This plan relieves it in two other ways: the Dark prospector reaches the dark crater's science without the drill stop and the search, and the dense clusters mean an ice hunter who sees the run going badly can turn back to the West cluster and still earn. A larger ice spot or a shorter route was considered and rejected: the spot's size and depth are real-shadow placements, and the route is real terrain.

### The ice with both instruments does not fit

The relationship's first answer is "bring both". On the Moon budget it cannot be done, and no tier tweak alone fixes it:

| Ice build | Cost | Mass / size | Ticket | Total |
| --- | --- | --- | --- | --- |
| Ice hunter today (drill) | 615 | 58 kg / 22 | Medium 120 | 735 |
| + neutron as it is (80 / 4 kg / 2) | 695 | 62 kg / 24 | Large 200 | 895 |
| + neutron at 60 / 3 kg / 1 | 675 | 61 kg / 23 | Medium 120 | 795 |
| Steel or NiH2 variants | 605 to 635 | 75 to 76 kg | Large, or too slow | 805 and up |

Every version is at least 45 over the 750 budget. Options: (a) accept it for the Moon, with Ice deposit located as the neutron's answer and the lesson's answer text reworded; (b) raise the starting budget to about 800 and re-run the whole balance, which also shifts Mars; (c) cut the neutron spectrometer to about 15 cost, which is not honest pricing. **Decided: (a)**, see [M1](#7-open-questions). The exact numbers (budget, part prices, rewards) can be revisited in a later balance patch to reach different gameplay outcomes.

### Targets for the balance tests

The `winPaths.test.ts` targets stay, with these changes: the archetype list adds Rock hound, Station keeper and Near prospector (each must pass by at least 50 and fail without its instruments); "an empty bay fails by at least 50" becomes a target; "fewer than 35% of affordable builds pass with their best route" stays and is the main risk. If it breaks, lower the new rewards evenly (not the existing archetypes' rewards) until it holds.

### Which numbers go where

| File | What changes |
| --- | --- |
| `game/data/milestones.json` | 12 new milestones (triggers, rewards, summaries, facts, sources); Boulder field 60; Mapper 40 |
| `game/data/tuning.json` | `milestones`: `coldTrapEdgeM` 25, `youngCraterEjectaFactor` 1.5, `boulderTrackPhotoRangeM` 80, `documentedSampleRangeM` 15, `stationPairMaxM` 100, `stationMinDistanceM` (reuses `sampleMinDistanceM`, 200). `instruments.neutron`: `edgeRampM` 25, `anomalyPeak` 0.45, `anomalyRangeM` 80, `iceSignalShare` 0.7. `instruments.xray`: `rocks` becomes a per-site-kind suite (see §5). `boulders`: `perYoungCrater` 30, `rolledBoulderDiameterM` 3.5. `cold.zones`: adds the cold trap names. `survey.leads`: adds `youngCrater` |
| `game/data/sites.json` (new) | Design choices on top of pipeline features: which young crater holds the rolled boulder, which low-light slope is the hidden hydrogen, the rock suite of each site, site display names. Typed in `rules/types.ts` (`SitesFile`) |
| `game/data/text.json` | Site names and notices, the lead, rock names (adds magnesian norite), new readouts, HUD states, debrief lines, desk card lines, tutorial lines, credits |
| `game/data/relationships.json` | The neutron/drill lesson's answers text only, if M1 is accepted |
| `game/data/balance.json` | New nodes and legs (measured by P5), plans and the three archetypes |
| `game/public/terrain/terrain.json` | Pipeline output only (P1 to P4) |

## 5. Rock types

The placeholder list read the same mix everywhere, so a reading told the player nothing about place. Now each site has its own suite, and the collection needs several sites.

| Rock type | Readout | Where it is read | Support |
| --- | --- | --- | --- |
| Ferroan anorthosite | Calcium and aluminum rich; iron and titanium poor | The common rock: every site except the rolled boulder | Well supported: Chandrayaan-3's APXS found south polar soil mostly ferroan anorthosite (Vadawale et al. 2024) |
| Noritic anorthosite | Calcium and aluminum rich, with more iron and magnesium | East crater, Rocky area 2 | Supported by Apollo 16 samples and orbital spectra of the South Pole-Aitken region (Pieters et al. 1997); the Apollo 16 clast citation is still unchecked |
| Impact melt breccia | Glassy, mixed fragments, once melted by an impact | Rocky area 1 (near its rim) | Well supported in Apollo samples (65015); its occurrence at the south pole is not confirmed |
| Regolith breccia | Soil fragments pressed together into rock | NW crater, West crater, Rocky area 2 | Well supported in Apollo samples (60016) |
| **Magnesian norite** (new, rare) | Rich in magnesium and iron, poor in calcium; pyroxene-rich | The rolled boulder only | Plausible, not observed here: the magnesium-rich component in Chandrayaan-3's soil may come from deeper rock (Vadawale et al. 2024); Mg-suite norites are well known from Apollo 17 samples (citation to check) |

**Site suites** (in `tuning.json` → `instruments.xray.suites`, keyed by site; each boulder still reads the same rock every run, picked by weight and seeded by its position):

| Site | Suite (weight) | Types a full visit finds |
| --- | --- | --- |
| Rocky area 1 | Impact melt breccia 6, ferroan anorthosite 4 | 2 |
| East crater | Noritic anorthosite 6, ferroan anorthosite 4 | 2 |
| NW crater, West crater | Regolith breccia 6, ferroan anorthosite 4 | 2 |
| Rocky area 2 | Noritic anorthosite 5, regolith breccia 5 | 2 |
| Rolled boulder | Magnesian norite (fixed) | 1 (rare) |

Two types per site means Rock collection's top stage (4 types) needs three sites, but the nearest three (NW crater, Rocky area 1, East crater) are all within about 500 m of the lander. Mare basalt stays out, as before.

**Map impact.**

- **Boulders at young craters.** `scatterBoulders` gains the young craters (30 boulders each, spread 1.1 × radius) and the one rolled boulder. Soft ground stays only at the two rocky areas (a 50 m crater's soft rim would be a trap with no warning).
- **Boulders know their site,** so the X-ray reading can pick from the right suite. `Boulder` gains `site: string`.
- **The rolled boulder needs a track.** A darker groove decal on the terrain texture, up the slope behind it. This is the one new world graphic in the plan.
- **The pipeline does not need a rock map.** We still found no M3 or Diviner rock map for this site; the suites are design, anchored to crater freshness, as the placeholder notes suggested.

## 6. Implementation phases

Each phase ends with tests and the build passing, a browser check, and a commit of only its own paths. Mechanics settled during a phase go into game-design.md as "decided during implementation".

### Phase 0: Design first

- Decide the [open questions](#7-open-questions).
- game-design.md: Moon milestones table and "How the milestones work"; Map and Minimap (new site kinds, the fourth lead); Balance (new archetypes, Boulder field and Mapper, the ice-with-both note); Moon parts (the "earn no milestones yet" sentences go).
- rover-engineering-design.md: Rock types (replace the placeholder section); §7 (milestones now exist; VIPER wording, see M15); §11 decision 6 updated.
- Agree the shared trigger shapes with the Mars plan's owner (M6) before Phase 3.

**Done when:** both docs say *Decided* for everything Phases 2 to 6 build.

**Status (November 15, 2026): done, except the M6 agreement.** game-design.md `f4001d2`; rover-engineering-design.md `f0ec0be`.

- Recorded in game-design.md: the 12 milestones and the two repriced ones (Moon milestones), the triggers, the combo rule, the stations' lander rule, the cold traps in the cold rules, the meter's edge ramp and anomaly, the desk cards and the debrief's "Not reached" list ([Rules for the new milestones](game-design.md#rules-for-the-new-milestones)); the new site kinds, minimap states and the fourth lead (Map, Minimap); the archetypes as targets, the empty bay, the ice-with-both note with M1's balance-patch caveat ([Balance with the Moon sites and milestones](game-design.md#balance-with-the-moon-sites-and-milestones)); the reworded neutron/drill answers (Moon parts).
- Recorded in rover-engineering-design.md: [Rock types by site](rover-engineering-design.md#rock-types-by-site), §7 with what each instrument earns, §10's neutron/drill answers, §11 decision 6, and M15's VIPER wording throughout (also a checked-claims entry).
- **Decided in Phase 0** (marked so in game-design.md): what "unbroken" means for a transect; the dark crater counts as a cold trap for the survey (the Dark prospector's estimate needs it); Ice deposit located needs lights but no heater; the meter's ramps are linear, the edge ramp applies at every cold zone, the highest reading wins; photo targets use the Earth photo's frame test; Fresh ejecta keeps the 200 m sample rule and counts the crater floor; a deployed station records whatever the rover's power state; the station's second press within 5 s; the scope of "Not reached"; the Station keeper's Clean seismogram is credited only for a route that keeps away; the dark crater gets no new survey mark.
- **Still open for Phase 0:** M6, agreeing the shared trigger shapes with the Mars plan's owner before Phase 3.
- **Data text to change later** (not edited in Phase 0): `relationships.json` neutron-drill `answers`, `reviewText` and `fact` (Phase 2); VIPER wording in `text.json` → `instruments.neutron.fact` and `parts.json` → `instrument-neutron.description` (Phase 2 or 5); `text.json` `instrumentNoMilestones` and the design tutorial's "earn no milestones yet" sentence (Phase 5).

### Phase 1: Pipeline requests (data pipeline owner)

Additions to `terrain.json` `features` (and route measurements). No new image layers.

| # | Request | Output |
| --- | --- | --- |
| P1 | **Cold traps.** Permanent-shadow patches in the play area (LPSR 60 m, PSR ≥ 0.5) over 2,000 m², each with a name, centroid, outline, area, distance and drive distance from the landing, average illumination | `features.coldTraps[]` |
| P2 | **Young craters.** Small fresh craters 40 to 150 m across within 1.6 km (depression plus steep rim in the 5 m DEM; bright ejecta checked in the LROC NAC mosaic), with center, radius, depth, illumination, Earth visibility | `features.youngCraters[]` |
| P3 | **Rolled boulder candidates.** Points at the foot of walls steeper than 25° with a 50 to 150 m run below, within 1.2 km, preferring young craters. (Real tracks of 3 m boulders are below the 5 m mosaic's resolution, so this is a placement, not a detection) | `features.boulderTrackCandidates[]` with the wall's top point |
| P4 | **Low-light slopes.** Ground outside permanent shadow with average illumination under 15% and slope under 15°, within 1 km, as patches | `features.lowLightPatches[]` |
| P5 | **Route legs** for the new nodes, the same way as the existing ones (10 m grid, slopes to 18°, lit share every 10 s). The tool that measured `balance.json`'s legs is not in the repo; please commit it under `game/tools/` | New `nodes` and `legs` for `balance.json` |
| P6 | **The de Gerlache thrust fault scarp** (Watters et al. 2024): where it is in the local frame, and whether it is inside the 8 km area or in view from any rim point | A yes/no and coordinates (for M12) |
| P7 | **Distant peak names.** Confirm the `distantPeaks` "likely" names (Mons Mouton, Malapert); not needed for this plan's milestones, only if M12 adds a viewpoint | Names, or "unknown" |

**Parallel:** P1 to P4 can run alongside Phases 2 and 3 (those use stub features in `testData.ts`). P5 needs P1 to P4's chosen sites. P6 and P7 are independent.

**Done when:** `terrain.json` has the four feature lists, the candidates in [§2](#where-they-go-three-rings) are confirmed or replaced, and the legs are in `balance.json`.

### Phase 2: Data and types

- `rules/types.ts`: the triggers (`transect`, `reading`, `record`, `deploy` and new `photo` targets), `MilestoneRequirements.instruments`, `SitesFile`, `InstrumentTuning` additions, `Boulder.site`, rock suites.
- `data/milestones.json`, `tuning.json`, new `sites.json`, `text.json` (names and facts with sources).
- `rules/validate.ts`: trigger zone ids, instrument ids, rock ids, site references in `sites.json` exist in `terrain.json` features.
- `data.test.ts`: the milestone count (13 → 25) and the new checks.

**Parallel:** with Phase 1. Must land before Phase 3.

**Done when:** the data loads and validates; the game runs with the new milestones present but not yet firing.

### Phase 3: Pure rules with tests

| Rule | File | Tests |
| --- | --- | --- |
| The four triggers, staging by distinct zone and by distinct rock type | `rules/milestones.ts` | Each trigger fires once per stage; near-lander exclusions; combos need all instruments; a missing part gives the existing missed notice |
| Zones: `cold-trap` (outline plus edge), `young-crater` (ejecta ring), `hydrogen-anomaly`, `ice-signal`, rolled boulder | `rules/milestones.ts` `buildZones`, `rules/survey.ts` `buildSites` | Zone membership at the edges |
| Hydrogen reading: edge ramp, anomaly | `rules/instruments.ts` `hydrogenReading` | Reading at the cold trap edge, at the anomaly center, unchanged in the dark crater |
| Rock type by site suite; the rare boulder | `rules/instruments.ts` `rockTypeFor`, `rules/boulders.ts` | Same boulder same rock; each site gives only its suite |
| Station placement checks (Earth, distance, pair) | `rules/instruments.ts` | Refusal and warning states |
| Survey: new site kinds, the fourth lead, hidden-until-found | `rules/survey.ts` | The hidden hydrogen is never discovered by the reveal circle |
| Balance model credits the new triggers | `rules/winPaths.ts`, `rules/balance.ts` | Archetypes with the new uses (`xray`, deploys, neutron standby on legs) |

**Parallel:** milestones/zones, instruments and survey can be three separate tasks once Phase 2's types are in; `winPaths` waits for the triggers. **Not parallel with the Mars plan's Phase 6**: the triggers are shared, so one implementation, Moon first, and Mars reuses it.

**Done when:** `npm test` covers every new milestone with a firing and a non-firing case, and the existing tests pass unchanged except the counts and the two repriced milestones.

### Phase 4: World and site placement

- Boulders at young craters and the rolled boulder (`world/boulders.ts` from `scatterBoulders`); the rolled boulder's track decal (`world/terrainChunks.ts` or a texture overlay).
- Cold zones include the new cold traps (`world/terrainMasks.ts` reads them through `tuning.cold.zones`).
- The mission screen feeds the new triggers: neutron standby distance through zones, X-ray readings with site and rock, station deploys with Earth state and position, photo targets in frame.

**Parallel:** needs Phase 1 (real positions) and Phase 3. Boulders and the track can be one task, mission wiring another.

**Done when:** in the browser every new site is where `terrain.json` says, boulders sit on the young craters, the rolled boulder and its track are visible from 100 m, and the cold traps freeze an unheated rover.

### Phase 5: HUD, minimap and debrief

- Minimap: icons and outlines for the new kinds, the "Hydrogen-rich ground" area after it is found, the site check marks, the fourth lead, legend entries.
- HUD: the station "too close" hint and press-again confirm; the reflector light's third state; the X-ray "New type: n of 5" line; site discovery notices with instrument lines.
- Desk: instrument cards list their milestones (M14); the "earns no milestones yet" line goes away by itself; tutorial lines for the stations' distance rule.
- Debrief: new milestones in the list; the instrument log links to them ("Rock collection: 4 of 5 types"); the "Not reached" list (M11).
- Text: facts and sources for every new milestone, fact-checked before they go in; credits.

**Parallel:** minimap, HUD and debrief are separate tasks after Phase 3; text can start in Phase 2.

**Done when:** a first-time player can find and earn each new milestone from the map and the notices alone, and no text names a lesson before it happens (checked against the guard column).

### Phase 6: Balance and browser check

- `balance.json`: nodes, legs (from P5), plans and the three new archetypes.
- `winPaths.test.ts`: the targets in [§4](#targets-for-the-balance-tests); retune new rewards in `milestones.json` until they hold.
- Browser autopilot runs (headless Chrome, as in the November 15 checks), from an unexplored map: idle, empty bay, Camera scout, Drill geologist, Ice hunter, Rock hound, Station keeper, Near prospector, Dark prospector, one random wanderer. Record each final against the model.

**Done when:** the model and browser agree within about 50 per run, the empty bay fails, every archetype passes by at least 50, and game-design.md has the result tables.

**Status (November 15, 2026): done, tuned by hand instead.** The user dropped the balance model mid-phase: `winPaths.ts`, its tests and `balance.json` are deleted, and rewards are tuned by hand (Rock collection 40 → 60; the rest at their starting values), so that several builds win and move on to Mars and idling or an empty bay loses. A ten-run browser autopilot check informed the values; sanity runs on the final values confirmed a drill win that moves the campaign on to Mars (790) and an idle loss (480); a camera scout run on the long wall route ran out of time (770). Decided simply: the low-energy switch-off now pauses a transect (rule change), a drill sample at Rim viewpoint 1 also earns Fresh ejecta, and NW crater is visible at the start. Values, estimates and browser lessons are in [Balance with the Moon sites and milestones](game-design.md#balance-with-the-moon-sites-and-milestones). Balance is tuned over time in later patches.

### Phase 7: Playtest and docs

- Extend `rover-engineering-playtest-checklist.md`: each new milestone, each site, each lesson met through a new site, a restart (map and records reset, notebook kept).
- game-design.md and rover-engineering-design.md mark each piece built.

**Status (November 15, 2026): done.** Playtest checklist extended (sections 8 to 17: sites, young craters, X-ray rocks, the rolled boulder, cold traps and hydrogen, stations, lessons through the new sites, desk and debrief, restart, builds that should win or lose) `8c0b66b`; game-design.md and rover-engineering-design.md mark the Moon sites pieces built `7f18af6`. Docs only, no code changes. Earlier phases: Phase 1 `5b61185`, `6957f9b`, `d8dc8af`; Phase 2 `384102a`; Phase 3 `bbfab15`, `104ab91`; Phase 4 `d842bd7`; Phase 5 `51d527d`, `3207458`, `0e12366`; Phase 6 `c895fab`, `0a2e378`, `5a16b5e`, `6bec07c`. The browser playtest itself is for the team to run from the checklist.

**Shipping:** Phases 2 to 5 ship together (a milestone without its site, or a site without its milestone, is worse than neither). Phase 6 must finish before the merge to `main`, because the reward changes affect every build.

### Risks

| Risk | Why | Mitigation |
| --- | --- | --- |
| Too many builds pass | Dense content raises what every instrument earns | Keep the 35% target; lower new rewards evenly; the model runs every affordable build |
| A lesson gets spoiled | 12 new texts, site notices, desk card lines | The guard column is a review checklist for Phase 5; a test greps new texts for each lesson's key words (quiet, drive away, heater, shadow, lights) |
| Micro cold traps are single pixels in a 60 m map | East and South traps are at the data's resolution limit | Use them as game sites; fact text speaks of small cold traps in general, not of these two |
| Designed placements read as real findings | Rolled boulder, hidden hydrogen, magnesian norite | Fact texts say "inspired by"; this doc marks them *placed by design* |
| Shared triggers diverge between Moon and Mars | Two teams, one `milestones.ts` | One implementation (Moon first), agreed shapes in Phase 0 |
| Route legs cannot be measured | The leg tool is not in the repo | P5 asks for it; fallback: measure with a new pipeline script |
| The track decal is costly | First terrain decal in the game | Fallback: the boulder alone, with the photo target unchanged |
| 25 milestones overwhelm a child | Long debrief, many notices | Desk cards list only the carried instruments' milestones; the debrief groups by instrument; staged ones show as one line with a count |

## 7. Open questions

All decided November 15, 2026: the team accepted every proposed answer below.

| # | Question | Decided answer |
| --- | --- | --- |
| M1 | The ice with neutron and drill is at least 45 over budget. How do we handle "bring both"? | Accept it for the Moon. Add Ice deposit located (neutron, dark crater) so the meter has its own answer, and reword the lesson's answers to "Bring the neutron spectrometer to locate the ice, the drill to confirm it; on a tight budget, choose one, or earn elsewhere". The exact tuning can be revisited in a later balance patch for different gameplay outcomes |
| M2 | The reflector's Earth-in-view area is about half the map near the lander. Shrink it? | No: it is real geometry and the landing's selection criterion. Add the 200 m lander exclusion and price the reflector's milestone low (50) |
| M3 | Empty-bay pass: which rewards come down? | Boulder field 100 → 60, Mapper 60 → 40 (empty bay 730) |
| M4 | New site kinds: young craters, cold traps, a rolled boulder, hidden hydrogen. The last two are placed by design | Yes, all four, with "placed by design" honesty in the fact text |
| M5 | Rock types | Site suites with two types per site; add magnesian norite as one rare boulder |
| M6 | Share the Mars plan's triggers (`reading`, `transect`, `record`) and add `deploy` | Yes, Moon builds them first with the extensions above; Mars Phase 6 reuses them |
| M7 | A fourth survey lead to the East cluster | Yes, "Young crater", about 0.5 km east-northeast |
| M8 | Combo milestones | Two: Documented sample (camera + X-ray) and Science station (seismometer + reflector). No neutron + drill combo |
| M9 | Minimum station distance from the lander | Reuse the 200 m near-lander zone; warn before setting down inside it |
| M10 | Clean seismogram: a stage or its own milestone? | Its own milestone, so a noisy record still pays the first |
| M11 | Show milestones not reached in the debrief? | Yes, only those the rover carried the parts for, names only |
| M12 | A fault scarp viewpoint | Only if P6 shows the de Gerlache scarp in view from the play area; otherwise drop it and keep the Watters fact on Moonquake record |
| M13 | The North cold trap near the dark crater route | Leave out unless P1 shows a real route passes within 100 m of it |
| M14 | Desk cards list the milestones each instrument can earn | Yes, names only |
| M15 | Several docs say all six instruments flew on real lunar rovers or landers, including VIPER | Fix the wording: VIPER has not flown (cancelled in 2024, now planned on a Blue Origin lander); no neutron spectrometer has driven on a rover yet; they have flown in lunar orbit (Lunar Prospector, LRO's LEND). Facts say VIPER "is designed to" |

## Sources and what is not verified

Checked on November 15, 2026 against the sources below (some from publisher abstracts or search summaries, as noted). Every fact is re-checked before it reaches `text.json`, as for the Moon so far.

| Claim | Source | Status |
| --- | --- | --- |
| Small cold traps are common and may hold ice; total cold-trap area about 40,000 km² | Hayne, Aharonson & Schorghofer (2021), Nature Astronomy 5:169, doi:10.1038/s41550-020-1198-9 | Figures from abstract summaries; the 40,000 km² is all scales, not micro traps only |
| Extra hydrogen at both poles | Feldman et al. (1998), Science 281:1496, doi:10.1126/science.281.5382.1496 | Verified; hydrogen, not proven water |
| Hydrogen-rich areas not matching permanent shadow | Mitrofanov et al. (2010), Science 330:483, doi:10.1126/science.1185696 | Verified |
| VIPER's neutron spectrometer reads the top meter while driving; VIPER's status | NASA VIPER pages; NASA release, Sept 2025 (Blue Origin delivery) | Depth from NASA presentations, not the fetched NASA page; status checked |
| Rockfalls mapped in LRO images | Bickel et al. (2020), Nature Communications 11:2862, doi:10.1038/s41467-020-16653-3 | Verified: 136,610 events |
| South polar soil composition and magnesium-rich part | Vadawale et al. (2024), Nature 633, 327–331, doi:10.1038/s41586-024-07870-7 | Verified |
| Fresh ejecta is less weathered and brighter | Grier et al. (2001), JGR 106, doi:10.1029/1999JE001160 | Verified |
| Apollo documented samples | USGS Apollo 14 and 17 reports; NASA TR R-353 (Apollo 12) | Verified |
| de Gerlache thrust fault scarp, 1973 shallow moonquake | Watters et al. (2024), Planetary Science Journal 5:22, doi:10.3847/PSJ/ad1332 | Verified; location relative to our play area not checked (P6) |
| Apollo 17 seismometers and heating and cooling quakes | Civilini, Weber & Husker (2023), JGR Planets, doi:10.1029/2022JE007704 | Partly: the paper's "lander" signals are not thermal moonquakes; the safe wording above avoids them |
| Apollo reflectors still ranged, signal weakened | Murphy et al. (2010), Icarus 208:31, doi:10.1016/j.icarus.2010.02.015 | Verified; dust is a hypothesis |
| LRO ranged Vikram's reflector, December 2023 | News coverage citing NASA | NASA release not retrieved; "first ever" not confirmed and not claimed |
| Apollo 11 package: seismometer and reflector | ALSJ Apollo 11 EASEP crew handbook | Verified from an excerpt |
| Apollo stations about 100 m from the lander | ALSJ ALSEP planning notes | Partly: "about 100 m" verified; the 90 m / 300 ft figure was not found (not used) |

**Not verified at all:** Mg-suite norite citation from Apollo 17; the Apollo 16 clast study (already open); whether the south pole sits on or inside the South Pole-Aitken basin's rim (not claimed here); the `distantPeaks` names; my crater and Earth-clearance measurements (a quick script over the game's own layers, horizon limited to the play area; the pipeline should redo them).
