# Game Design

The working game design for **Rover Engineer**, our Space Mission Design Game entry. It records what the team has decided so far, what is only proposed, and what is still open. It is written for our team, not for players.

Last updated November 14, 2026. This is a living document. Background research is in [landscape research](research/landscape-precedents-and-judging.md), [mission-engineering/](research/mission-engineering/README.md), and [rover-engineering/](research/rover-engineering/README.md). The official brief is in [challenge brief](challenge-brief.md).

Quick navigation: [Concept](#concept) · [Decisions](#decisions-at-a-glance) · [Outer loop](#outer-loop-the-campaign) · [Inner loop](#inner-loop-the-mission) · [Destinations and time](#destinations-and-time) · [Economy](#economy) · [Milestones](#milestones-and-rewards) · [Rover design](#rover-design) · [Hazards](#hazards-and-how-a-rover-dies) · [Moon level](#first-level-the-moon) · [NASA data](#nasa-data) · [Progression](#progression) · [Later missions](#later-missions-mars-and-titan) · [Story](#story-and-onboarding) · [Tech stack](#tech-stack) · [Fit with the brief](#fit-with-the-challenge-brief) · [Open questions](#open-questions) · [Build order](#build-order)

**Status labels used below**

- **Decided:** agreed by the team.
- **Proposed:** suggested and not yet confirmed.
- **Open:** not discussed yet, or waiting on more detail.

## Concept

The player is a new rover engineer at mission control on Earth. For each mission, they design a rover within a budget and a mass limit. A provided lander delivers it, and they drive it in real time in 3D to survive the mission and reach as many milestones as they can. Missions move from the Moon to Mars to Titan. Each destination is harder and has a different length of day.

The design screen is a **constraint puzzle**. On the Moon, the puzzle is simply mass versus cost. Later missions add more constraints, so choosing what goes on the rover and which capabilities to enable becomes a real puzzle.

## Decisions at a glance

| Area | Decision | Status |
| --- | --- | --- |
| Game name | Rover Engineer | Decided |
| Agency | REL (Rover Exploration Laboratory), a fictional agency | Decided |
| Player role | A new rover engineer at REL mission control, who designs and drives the rover | Decided |
| Onboarding | Tutorial text guides the player. There is no guide character. | Decided |
| Tone | Scientific and formal. No characters are introduced; all text reads as neutral mission documentation. | Decided |
| Control | Real-time 3D driving. The player drives the rover; there is no turn-based day planning. | Decided |
| Mission success | Survive the full mission length. Running out of energy early is allowed, but it costs money. | Decided |
| Milestones | Four categories: capability, scientific, records, and pretty pictures. See [Milestones and rewards](#milestones-and-rewards). | Decided (values open) |
| Rover design | Every component is configurable, but the budget limits what the player can afford | Decided |
| Core Moon trade-off | Mass versus cost | Decided |
| Ways to die | Damage, freezing, getting stuck, running out of energy | Decided |
| Currencies | Research points (RP) unlock technologies. Money (the budget) pays to use them: buying an unlocked part and putting it on the rover. | Decided |
| Payout | A fixed amount for surviving plus milestone rewards. Dying costs a large penalty, sized by how the rover died. | Decided |
| Map | Fixed map per destination. The Moon map is built from real NASA terrain data. | Decided |
| Random events | Yes, specific to each destination. Moon: solar flare and moonquake. | Decided |
| Mission order | Moon → Mars → Titan | Decided |
| Mission play time | Moon 10 min, Mars 20 min, Titan 30 min (driving only, not counting design time) | Decided |
| Build order | Moon first, with Mars built soon after, then Titan. The Moon is not a standalone version: RP earned there is spent on Mars. See [Build order](#build-order). | Decided |
| Tech stack | Three.js + Rapier + Vite, playable in the browser | Decided |
| Terminology | "Energy" (a battery bar), not "fuel" | Decided |
| Players | Single player first; two-player maybe later, never four | Decided (two-player open) |

## Outer loop: the campaign

```
Check budget ──► Configure rover ──► Land ──► Play mission ──► Results ──► Unlock parts ──┐
     ▲                                                                                   │
     └───────────────────────────────────────────────────────────────────────────────────┘
```

1. **Check budget.** Each mission has a minimum budget. A player whose balance is below it cannot start that mission. *Decided*
2. **Configure the rover.** Spend money on parts from the unlocked catalog, staying under the mass limit. *Decided*
3. **Land.** The lander delivers the rover to a fixed site. *Decided*
4. **Play the mission.** See the [inner loop](#inner-loop-the-mission).
5. **Results.** *Decided*
   - **Success** (survived the full length): earn the survival payout plus the milestone rewards.
   - **Failure** (rover died early): lose a large amount of money, sized by the cause of death (see [Death penalties](#death-penalties)). The negative balance carries over to the next mission.
   - Milestones reached before the rover died still pay out. *Decided*
6. **Unlock parts.** Spend or reach RP thresholds to unlock new parts. RP earned on the Moon is first used for Mars technology. See [Progression](#progression).

**Failure and retry rules**

- If losses push the balance below the next mission's minimum budget, the mission cannot go ahead and counts as failed. *Decided*
- The player then restarts that round from the design screen. *Decided*
- On a restart, everything returns to a snapshot taken at the start of that round: balance, RP, and any records earned during it. This keeps the code simple and stops players replaying a round to farm records. *Decided*

## Inner loop: the mission

The player drives the rover in real time in 3D.

```
Drive ──► Reach milestones ──► Earn RP and bonus money
  │
  └─ while managing: energy · damage · cold · soft ground · random events
```

- **Driving uses energy.** Heavier rovers use more energy per meter. *Decided*
- **Milestones** are reached by driving and by using equipped instruments. A milestone that needs an instrument cannot be completed without it. For example, a rover without a drill drives past the ice. *Decided*
- **Night (Mars and Titan only).** At night the player chooses one of two options. *Decided*
  - **Lights on:** keep exploring and earning milestones, but energy drains quickly.
  - **Sleep:** energy drains slowly, but the player earns no milestones while asleep.
- **The mission ends** when one of these happens. *Decided*
  - The full mission length is reached (success).
  - The rover runs out of energy.
  - The rover is destroyed (damage or freezing).
  - The rover gets stuck for good.

## Destinations and time

Mission length grows with each destination, and the player should feel that time passes differently on each world.

| Mission | Real play time | Game time covered | One local day equals | Day and night | Status |
| --- | --- | --- | --- | --- | --- |
| Moon | 10 min | 14 Earth days, one lunar daylight period | about 43 s per Earth day | All daylight | Decided |
| Mars | 20 min | 20 sols (about 20.5 Earth days) | 60 s per sol | Day and night every sol | Proposed timing |
| Titan | 30 min | 1 Titan day (about 16 Earth days) | The whole mission: about 15 min of light, then about 15 min of dark | Always cold; one long day and one long night | Proposed timing |

Real-world basis:

- **Moon.** A lunar day lasts 29.53 Earth days, so most sites have about 14 Earth days of light, then about 14 of dark ([NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)). ISRO designed the Pragyan rover to work for exactly one lunar daylight period, which is the same shape as our Moon mission ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#day-night-and-survival)).
- **Mars.** A sol is 24 h 39 m 35 s ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#mars-time-restricted-sols-and-solidays)).
- **Titan.** One Titan day is about 16 Earth days, and the surface is about 94 K, or −179 °C ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#physical-and-orbital-environment)).

**Showing the difference.** The HUD shows two clocks: local time (lunar day, sol, or Titan day) and Earth days passed. On Titan, the Earth counter keeps climbing while the Sun barely moves. *Proposed*

## Economy

| Currency | Earned by | Spent on | Status |
| --- | --- | --- | --- |
| Research points (RP) | Reaching milestones | Unlocking technologies: new parts and research abilities | Decided |
| Money (the budget) | The survival payout and milestone rewards. Dying subtracts a large penalty. | Using unlocked technologies: buying parts for the rover, plus the delivery fee | Decided |

In short, **RP decides what the player can build, and money decides how much of it they can afford.**

**Payout formula** *Decided* (values open)

- Money = survival payout (if the rover survived) + money from milestones − death penalty (if it died)
- RP = RP from milestones

**Scaling rates.** *Decided* (from the team's resource notes)

- **Budget** grows very slowly between missions.
- **Upgrade variety** grows very quickly.
- **Objective difficulty** grows quickly.

So early missions have few resources and simple choices, such as motor v2 or drill v2. Later missions offer more resources and a much wider choice of parts, but the constraints are tight.

All amounts in the game are game values for balancing, not real costs. The game should label them that way.

## Milestones and rewards

Milestones are what the player chases during a mission. Each one pays out RP, money, or both. The real NASA milestone types and rewards behind this design are in [rover-engineering/06](research/rover-engineering/06-milestones-and-sustainment.md#milestones-nasa-measures).

### Categories

*Decided*

| Category | Type | What counts |
| --- | --- | --- |
| **Capability** | Coverage | How far the rover drove and how much of the map it covered |
| | Difficulty | Entering a larger crater, crossing a rocky area |
| | Robustness | Surviving extreme heat, cold, or dust; finishing without damage; lasting a long time |
| **Scientific** | Historical formations | Evidence of past oceans, lakes, or other formations |
| | New types of information | Air, rock, or chemical samples; observing different wavelengths of light |
| | New materials | New materials and strange formations |
| **Records** | First touch | The first landing on a new world |
| | First discovery | The first time a type of thing is found |
| | Key milestones | Specific important capability or scientific milestones, chosen by design |
| **Pretty pictures** | Photos | Scenic shots taken with the rover's camera |

**Records** give a big budget boost. They are a pacing lever: we place them where the game should speed up. Each record can be earned only once per campaign. *Decided*

**How photos work.** The map has viewpoint zones. With the camera equipped, the player drives into a zone and presses a key, and the photo goes into an album shown at the debrief. The album also gives us material for the demo video. *Decided*

### What each category pays

*Decided*

| Category | Mainly earns | Equipment needed | Real-world parallel (Our analysis) |
| --- | --- | --- | --- |
| Capability | Money | None beyond the rover itself | A rover that proves it works earns continued funding, as with NASA's extended missions |
| Scientific | RP | The matching instrument, such as a drill or camera | Science results move knowledge and technology forward |
| Records | A big money boost | Depends on the record | Firsts draw public attention and support |
| Pretty pictures | A small amount of money | Camera | Images build public interest |

This split makes the design screen matter. A rover built only to drive earns money but almost no RP, so it never unlocks new technology. To progress, the player has to spend budget and mass on instruments. *(Our analysis)*

### Death penalties

Dying costs a big penalty, and the way the rover died sets how big. *Decided*

| Cause | Penalty | Reasoning |
| --- | --- | --- |
| Out of energy | Smallest | The rover used up what it had. The team already treats this as a tolerable outcome. |
| Stuck | Medium | A driving mistake, but the rover is intact |
| Froze | Large | The player stayed in the cold without enough heating |
| Destroyed by damage | Largest | The most preventable loss |

The penalty also shrinks the longer the rover lasted, so robustness still pays off in a failed mission. *Decided*

## Rover design

### Moon component slots

*Decided:* six slots with two options each. All Moon parts are available from the start, so budget and mass are the only limits. Locked parts first appear on Mars, greyed out with "needs X RP".

| Slot | What it affects |
| --- | --- |
| Wheels | Grip, chance of getting stuck, speed, energy per meter |
| Power source | Energy income |
| Battery | Energy storage |
| Lights | Driving in shadowed craters |
| Heater | Survival in the cold |
| Instrument | Camera or drill. Decides which milestones the rover can complete. |

### Mass versus cost: the Moon puzzle

The Moon introduces one core tension: **cheap parts are heavy, and light parts are expensive.** *Decided*

Mass has a cost in every part of the game: *Decided*

| Effect of mass | How it works |
| --- | --- |
| Delivery fee | The lander charges a fee per kilogram |
| Landing limit | The total mass cannot exceed the lander's maximum |
| Energy | A heavier rover uses more energy per meter, so its range is shorter |
| Getting stuck | A heavy rover on weak wheels sinks in soft regolith |
| Structure | A frame that is too weak for the load can take damage *(from the team's resource notes)* |

Example: a steel chassis is cheap and heavy, while a titanium chassis is expensive and light. *Proposed*

Background on real rover components and trade-offs is in [rover-engineering/02](research/rover-engineering/02-rover-subsystems.md) and [rover-engineering/05](research/rover-engineering/05-rover-trade-offs-and-game-model.md#rover-trade-off-catalog).

## Hazards and how a rover dies

| Cause | Trigger | Status |
| --- | --- | --- |
| Out of energy | The battery reaches zero | Decided |
| Damage | Hitting rocks, steep slopes, moonquakes, a frame overloaded by mass | Decided (triggers proposed) |
| Freezing | Staying in a cold zone without enough heating | Decided |
| Stuck | Soft ground combined with heavy mass or weak wheels | Decided |

Each cause has a different money penalty. See [Death penalties](#death-penalties). Real causes of rover loss and survival tactics are in [rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#hazard-and-anomaly-catalog) and [rover-engineering/06](research/rover-engineering/06-milestones-and-sustainment.md#how-rover-missions-are-sustained).

## First level: the Moon

| Element | Design | Status |
| --- | --- | --- |
| Length | 10 minutes of play covering 14 Earth days of daylight | Decided |
| Map | Fixed, about 2 km × 2 km, built from real NASA elevation data (5 m per pixel). Recommended site: the de Gerlache crater rim near the south pole. See [NASA data](#nasa-data). | Decided (site proposed) |
| Sun and shadows | At the south pole the Sun stays within 1.5° of the horizon and circles the sky once per lunar day, so it sweeps about halfway around during the mission. The Moon stays all daylight, but shadows move and sunny charging spots can fall into shadow. This matches real south pole conditions. | Decided |
| Shadowed craters | Very cold zones that hold water ice. High risk and high reward: lights and a heater are needed to enter safely, and a drill is needed to sample the ice. | Decided |
| Events | Solar flare and moonquake | Decided |
| Core puzzle | Mass versus cost | Decided |

**Shadowed craters, real basis.** Craters near the lunar poles that never see sunlight measure about 33 to 38 K, and LCROSS found 4 to 6% water by weight at Cabeus crater in 2009. This is why NASA designed the VIPER rover to look for water there ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#the-south-pole-low-sun-long-shadows-ice-and-earth-below-the-horizon)).

**Events**

| Event | What happens | Player response | Status |
| --- | --- | --- | --- |
| Solar flare | A radiation burst that threatens the electronics. A warning comes a few seconds ahead. | Power down or shelter in time. A rover still driving when the flare hits takes damage. | Decided |
| Moonquake | The ground shakes | The rover takes a small amount of damage | Decided |

### Moon milestones (examples)

*Decided* as the starting list. Distances and amounts are game values to be balanced.

| Milestone | Category | How to earn it | Equipment |
| --- | --- | --- | --- |
| Touchdown | Record: first touch | Land on the Moon for the first time | None |
| Odometer | Capability: coverage | Drive set distances, for example 500 m, 1 km, and 2 km | None |
| Mapper | Capability: coverage | Reveal a set share of the map | None |
| Crater descent | Capability: difficulty | Drive into the large crater and back out | None |
| Boulder field | Capability: difficulty | Cross the rocky area | None |
| Into the dark | Capability: robustness | Enter a shadowed crater and come back out | Lights, heater |
| Flare survivor | Capability: robustness | Get through a solar flare without damage | None |
| Clean run | Capability: robustness | Finish all 14 days without damage | None |
| Crater layers | Scientific: historical formation | Image the old layers exposed in a crater wall | Camera |
| Regolith sample | Scientific: new information | Drill a soil sample | Drill |
| Water ice | Scientific: new material, and Record: first discovery | Drill ice inside a shadowed crater | Drill, lights, heater |
| Earth on the horizon | Pretty picture | Photograph Earth from the surface | Camera |
| Rim panorama | Pretty picture | Photograph the view from a crater rim | Camera |

Notes:

- The Moon has a single instrument slot, so **camera or drill** is the Moon's science choice. The camera earns pictures and imaging science; the drill earns samples and the water ice.
- The Moon has almost no atmosphere, so air samples start on Mars and Titan. This is a small fact the game can teach.

## NASA data

Building the Moon map from real terrain is *Decided*. The other datasets below are *Proposed*, recommended in [rover-engineering/07](research/rover-engineering/07-nasa-data-for-the-game.md), which has sources, effort, and file formats.

| Data | NASA source | What it changes in play | Priority |
| --- | --- | --- | --- |
| Terrain and slopes | LRO laser altimeter (LOLA), 5 m per pixel | The map itself; steep slopes cause damage | Core (decided) |
| Low Sun and moving shadows | Polar geometry (no file needed) | Shadows sweep across the map; charging spots move | Core (decided) |
| Permanent shadow and sunlight maps | LRO LOLA and LROC | Cold zones sit where they really are | Core |
| Temperatures and ice depth | LRO Diviner | How fast the rover freezes in each zone; where ice can exist | Strong |
| Where ice is exposed | Moon Mineralogy Mapper (M3) | Ice only in a few cold spots, so drilling the wrong crater finds nothing | Strong |
| Moonquakes | Apollo seismometers and a real south pole fault scarp | Quakes are rare but hit harder near the fault | Strong |
| Solar flares | NASA's DONKI space weather database | Each flare is a real past flare, named with its date and class | Strong |
| Earth in the sky | Polar geometry | Earth bobs above and below the horizon, so the Earth photo is a timing puzzle | Strong |
| Star field | NASA SVS Deep Star Maps | A real sky above the airless Moon | Strong |

**Orbital map layers.** *Decided: unlockable.* The Moon has a very simple minimap. Switchable layers for elevation, sunlight, and temperature are unlocked with RP later (from Mars onward, since the Moon uses no unlocks), each labeled with the NASA instrument that measured it. Real teams plan rover drives with the same kinds of orbital data, and the layers make our NASA data visible to judges. Which layers unlock first, and at what RP cost, is part of the unlock tree (open question 6). *What the simple Moon minimap shows is Open.*

## Progression

- **RP unlocks parts.** When the player reaches certain RP thresholds, new parts and research abilities become available. *Decided*
- **Research needs the right equipment.** An unlocked research ability can be used only if the matching instrument is mounted on the rover. So the design screen decides which milestones are reachable in each mission. *Decided*
- **Missions get harder** as the player advances (see the scaling rates under [Economy](#economy)), and the player has to choose which branch of advancements to take. *Decided*
- **The Moon uses no unlocks.** RP earned on the Moon carries forward and is spent on Mars technology. *Decided*
- **Orbital map layers are unlockable** (elevation, sunlight, temperature). See [NASA data](#nasa-data). *Decided*
- The exact unlock tree is *Open*.

Real milestones and how NASA rewards them are in [rover-engineering/06](research/rover-engineering/06-milestones-and-sustainment.md).

## Later missions: Mars and Titan

The Moon teaches one trade-off (mass versus cost). Mars and Titan add more intricate trade-offs about what to put on the rover and which capabilities to enable, so the design screen becomes a real puzzle. The team has a list of candidate constraints to evaluate and will define these later. *Open*

What is already decided:

- **Mars** adds a day and night cycle, which brings in the lights-on or sleep choice.
- **Titan** is always cold.
- Each destination has its own random events.

## Story and onboarding

| Element | Design | Status |
| --- | --- | --- |
| Player role | A new rover engineer at REL mission control | Decided |
| Guide | No guide character. Tutorial text guides the player through the design screen and the first drive. | Decided |
| Agency | REL (Rover Exploration Laboratory). Fictional, with no NASA branding; real NASA missions can still be cited as facts. | Decided |
| Game name | Rover Engineer | Decided |
| Tone | Scientific and formal. No characters are introduced, so all text (tutorial, briefings, milestone pop-ups, debrief) reads as neutral mission documentation, not dialogue. | Decided |
| Where real facts appear | Recommended: a one-sentence real fact on each milestone pop-up, and a debrief that compares the rover's fate with a real rover's | Proposed |

## Tech stack

| Part | Choice | Why |
| --- | --- | --- |
| 3D rendering | [Three.js](https://threejs.org/) | Runs in the browser, so judges can play from a link |
| Physics and driving | [Rapier](https://rapier.rs/) | Includes a ready-made vehicle controller |
| Dev server and build | [Vite](https://vite.dev/) | Instant reload while tuning numbers |
| Design screen and HUD | HTML and CSS | The fastest way to build menus and dashboards |

*Decided.* The choice can be revisited later. A strong design doc keeps that possible.

## Fit with the challenge brief

| Brief element | How the game covers it | Status |
| --- | --- | --- |
| Spacecraft and mission design | The rover design screen within budget and mass limits | Decided |
| Launch vehicle | The lander's delivery fee per kilogram and its maximum landing mass make mass a launch cost | Decided |
| Use of NASA data | The Moon map is real LRO terrain. More datasets are proposed under [NASA data](#nasa-data). | Decided (terrain) |
| Educational value | Real facts tied to mechanics, such as Pragyan's one-day mission, VIPER and the ice, and the different day lengths | Proposed |

See [landscape research](research/landscape-precedents-and-judging.md#applying-the-judging-criteria) for how this maps to the judging criteria.

## Open questions

| # | Question | Notes |
| --- | --- | --- |
| 1 | Which proposed NASA datasets to use, and which real patch of the Moon the map is cut from (recommended: de Gerlache rim) | See [NASA data](#nasa-data) |
| 2 | What the simple Moon minimap shows | Map layers themselves are decided as unlockable; see [NASA data](#nasa-data) |
| 3 | Where real facts appear | Proposed under [Story and onboarding](#story-and-onboarding) |
| 4 | Values for money, RP, milestone rewards, death penalties, part costs and masses, the delivery fee, and the minimum budgets | Balancing during playtests |
| 5 | Mars and Titan constraints | The team has a list to evaluate |
| 6 | The RP unlock tree for Mars | Which parts unlock at which thresholds |
| 7 | Data and communications as a resource? | Recommended: none on the Moon, a real constraint on Mars. At the south pole Earth dips below the horizon, which could later become a contact blackout. |
| 8 | Mars and Titan random events | Not discussed |
| 9 | Is two-player still planned? | Later |

## Build order

1. **Moon.** Being designed now. *Decided*
2. **Mars.** Built soon after the Moon. RP earned on the Moon unlocks Mars technology. *Decided*
3. **Titan.** After Mars. *Decided*

Not planned for now: two-player mode and randomly generated maps.
