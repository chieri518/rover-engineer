# Rover Engineer: Game Design

The working design for **Rover Engineer**, our entry to the Space Mission Design Game challenge. It is written for our team, not for players.

Last updated November 14, 2026. The official brief is in [challenge brief](challenge-brief.md). Background research is in [landscape research](research/landscape-precedents-and-judging.md), [mission-engineering/](research/mission-engineering/README.md), and [rover-engineering/](research/rover-engineering/README.md).

**How to read this doc.** Everything is **decided** unless it is marked *Proposed* (suggested, waiting for a yes or no) or *Open* (not settled yet). All open items are collected in [Open questions](#2-open-questions).

**Recent changes (November 14, 2026):** mission play times shortened to 5 / 10 / 15 minutes; the Moon map is now bigger than one mission can cover; game name, agency, and tone chosen; Moon site (de Gerlache rim), play area size, landing point, NASA datasets, minimap, optional history facts, and mass-based speed decided; no clock; seventh part slot (chassis); launch ticket tiers.

## Contents

1. [The game in one page](#1-the-game-in-one-page)
2. [Open questions](#2-open-questions)
3. [Campaign: the outer loop](#3-campaign-the-outer-loop)
4. [Mission: the inner loop](#4-mission-the-inner-loop)
5. [Time on each world](#5-time-on-each-world)
6. [Economy and milestones](#6-economy-and-milestones)
7. [Rover design](#7-rover-design)
8. [The Moon mission](#8-the-moon-mission)
9. [NASA data](#9-nasa-data)
10. [Progression and later missions](#10-progression-and-later-missions)
11. [Identity and presentation](#11-identity-and-presentation)
12. [Tech stack and fit with the brief](#12-tech-stack-and-fit-with-the-brief)

## 1. The game in one page

The player is a new rover engineer at **REL (Rover Exploration Laboratory)** mission control. For each mission they design a rover within a budget, buy it a spot on the next launch to the destination, and drive it in real time in 3D once it lands. The goal is to survive the mission and reach as many milestones as they can. Missions go from the Moon to Mars to Titan, and each one is harder and has a different length of day.

The design screen is a **constraint puzzle**. On the Moon it is simply mass versus cost. Mars and Titan add more constraints, so choosing what goes on the rover becomes a real puzzle.

| Area | Decision |
| --- | --- |
| Missions | Moon → Mars → Titan. Built in that order, with Mars soon after the Moon. |
| Play time | Moon 5 min, Mars 10 min, Titan 15 min of driving (design time not counted) |
| Control | Real-time 3D driving. No turn-based day planning. |
| Success | Survive the full mission. Running out of energy early is allowed but costs money. |
| Ways to die | Out of energy, damage, freezing, getting stuck |
| Currencies | Research points (RP) unlock parts. Money buys them. |
| Rewards | Milestones in four categories: capability, scientific, records, pretty pictures |
| Rover | Seven part slots, each configurable, limited by budget. Moon trade-off: mass versus cost. |
| Launch | REL buys the rover a launch ticket. Heavier or bigger rovers need a pricier tier. |
| Map | Fixed per destination. The Moon map is real NASA terrain at the de Gerlache crater rim near the south pole, about 8 km × 8 km plus distant terrain, bigger than one mission can cover. |
| Events | Specific to each world. Moon: solar flares and moonquakes. |
| Players | Single player. Two-player maybe later, never four. |
| Tech | Three.js + Rapier + Vite, playable in the browser |
| Terms | "Energy" (a battery bar), not "fuel" |

## 2. Open questions

### Needed to build the Moon mission

| # | Question | Current proposal |
| --- | --- | --- |
| 1 | **Balance numbers.** Money, RP, milestone rewards, death penalties, part costs, masses, and sizes, launch ticket tier prices and limits, minimum budgets, base speed per wheel type and how much mass slows the rover, Odometer distances | Tune in playtests. The 5-minute mission limits how far a rover can drive. |

**Decided November 15, 2026** (formerly open questions 1a to 1c):

- **1a Sun window:** start azimuth 75° and subsolar latitude −1.54°, both real geometry. This keeps the route and rim viewpoints lit until about 220 to 250 s and removes the Sun passing behind Earth. The rover starts facing azimuth 0° (toward Earth and the dark crater route), where 99% of the ground ahead is lit at the start. See [Sun and shadows](#sun-and-shadows).
- **1b Water ice reach:** the smaller drill (size 3, 8 kg, cost 90) stays. The ice is one optional way to pass the Moon, never required; see [Balance: several ways to pass](#balance-several-ways-to-pass).
- **1c Clue for finding the ice:** the hydrogen signal stays (`milestones.hydrogenSignal`).

### Later: Mars and Titan

| # | Question | Notes |
| --- | --- | --- |
| 2 | Mars and Titan constraints | The team has a list to evaluate |
| 3 | The RP unlock tree | Which parts and map layers unlock, at which thresholds |
| 4 | Mars and Titan random events | Not discussed |
| 5 | Mission length in game time | *Proposed:* Mars 20 sols, Titan 1 Titan day |
| 6 | Data and communications as a resource? | *Proposed:* not on the Moon, a real constraint on Mars. At the south pole Earth dips below the horizon, which could later become a contact blackout. |
| 7 | Two-player mode | Later |

## 3. Campaign: the outer loop

```
Check budget ──► Configure rover ──► Buy launch ticket ──► Land ──► Play mission ──► Results ──► Unlock parts ──┐
     ▲                                                                                                        │
     └────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Check budget.** Each mission has a minimum budget. A player below it cannot start the mission.
2. **Configure the rover.** Buy parts from the unlocked catalog.
3. **Buy a launch ticket.** The rover's mass and size decide which ticket tier it needs. See [Launch ticket](#launch-ticket).
4. **Land.** The lander delivers the rover to a fixed site.
5. **Play the mission.** See [the inner loop](#4-mission-the-inner-loop).
6. **Results.**
   - **Survived:** earn the survival payout plus milestone rewards.
   - **Died early:** lose money, sized by the cause of death. Milestones reached before death still pay out. The balance, even if negative, carries over.
7. **Unlock parts.** RP unlocks new parts. RP earned on the Moon is spent on Mars technology.

**Failure and restart**

- If losses push the balance below the next mission's minimum, the mission counts as failed.
- The player then restarts that round from the design screen.
- A restart returns everything to a snapshot taken at the start of the round: balance, RP, and records. This keeps the code simple and stops players replaying a round to farm records.

## 4. Mission: the inner loop

```
Drive ──► Reach milestones ──► Earn RP and money
  │
  └─ while managing: energy · damage · cold · soft ground · random events
```

- **Driving uses energy.** Heavier rovers use more energy per meter.
- **Speed depends on the configuration.** The wheels set a base speed, and a heavier rover is slower. A heavy rover reaches fewer places in the mission time.
- **Speed is compressed like time.** 14 days pass in 5 minutes, so driving is sped up too: roughly 4 to 6 times real rover speeds (about 6 m/s for a heavy build, about 12 m/s for a light one, to be tuned). A light build can just reach the dark crater; a heavy one cannot. To keep the rover grounded at these speeds, it falls about 4 times faster than real lunar gravity (a game-feel choice made during implementation). Measured: a light build (12 m/s) reaches the dark crater entry in about 240 s; a heavy one (6 m/s) ends about 1 km short. On the design screen, an optional info pop-up next to the speed readout explains real drive speeds, like the optional history facts.
- **Milestones** come from driving and from using equipped instruments. A rover without a drill drives past the ice.
- **Night (Mars and Titan only).** The player chooses:
  - **Lights on:** keep exploring, but energy drains fast.
  - **Sleep:** energy drains slowly, but no milestones.
- **The mission ends** when the full length is reached (success), or the rover runs out of energy, is destroyed, freezes, or gets stuck for good.

### Hazards and penalties

Dying costs money, and the cause sets how much. The penalty also shrinks the longer the rover lasted, so robustness still pays in a failed mission.

| Cause | Trigger | Penalty | Reasoning |
| --- | --- | --- | --- |
| Out of energy | The battery reaches zero | Smallest | The rover used up what it had. A tolerable outcome. |
| Stuck | Soft ground combined with heavy mass or weak wheels | Medium | A driving mistake, but the rover is intact |
| Froze | Staying in a cold zone without enough heating | Large | The player stayed in the cold too long |
| Destroyed | Damage builds up until the rover breaks, or the rover rolls over. See [Damage](#damage) below. | Largest | The most preventable loss |

#### Damage

The rover has a damage meter. These all cause damage, and **the amount depends on the cause**:

- Hitting rocks
- **Rolling over ends the mission at once** and counts as destroyed. A flipped rover is lost, as it would be in reality.
- Driving on slopes that are too steep
- Moonquakes
- Solar flares, if the rover is still driving when one hits
- A frame overloaded by mass

How much each cause does is a balance number (open question 1).

#### How the mission systems work *(decided during implementation, Phase 4)*

The rules live in `game/src/rules/` and every number in `game/data/tuning.json` and `events.json`.

- **Energy.** The battery starts full. Driving costs energy per meter (the wheels' rate, raised by mass above the reference), plus 5% per degree of uphill grade; downhill costs the flat rate. Solar income is the power source's full-sun rate times the share of the Sun's disc visible from the rover (the same terrain-shadow test that draws the shadows), so it is zero in shadow. The design screen shows the drive energy per km and the flat range on a full battery. Zero energy ends the mission.
  - *Balance pass (Phase 5):* driving at full speed always uses more than a panel earns. Wheels cost 0.24 (solid) or 0.18 (mesh) energy per meter, plus 1% per kg above 60 kg. A fixed panel earns 1 per second in full sun and a solar mast 2; batteries store 400 (lithium-ion) or 600 (nickel-hydrogen). The default build uses about 2.1 per second at full speed against 1 from its panel, so it must stop in sunlight to recharge. With a mast, it about breaks even.
  - *Shadow test check:* averaged over a full lunar day, the game's terrain-shadow test reproduces NASA's LOLA average-illumination map (mean error 1.5 points over 150 random spots; landing 67% against 66%).
- **Damage.** A hard impact (a sudden change in the rover's velocity of 3 m/s or more, such as hitting a boulder) does 8 plus 4 per extra m/s. Driving on ground steeper than 20° (`slope.png`) does 4 per second. An overloaded frame does 0.05 per kg over its maximum load per second while driving. Each moonquake does 10. A flare that hits an unprotected rover does 20 plus 2.5 per X above X1 (`events.json`): about 26 for an X3.3 flare and 41 for an X9.3. Boulders are scattered in the two rocky areas (small fresh craters).
- **Rollover** is a tilt beyond 75° held for 0.6 s.
- **Cold.** Cold zones are the permanent-shadow patches of the dark crater and of the small cold patch in Rocky area 1; other tiny shadowed spots are left out. Inside, the freeze meter rises 4 per second (full after 25 s), slowed by 1.5 per heat unit of the heater (radioisotope units: full after 100 s). Outside it recovers 6 per second.
- **No lights.** A rover without lights stops automatically at the edge of permanent shadow, with the notice "Permanent shadow ahead. Without lights the rover cannot enter." It can turn or reverse away.
- **Soft ground and getting stuck.** Ground is soft inside the rocky areas (fresh crater rims), fading out to 1.5 times their radius. Sinkage follows Apollo 15: about 1.5 cm on normal ground and 6 cm on soft rims for a 60 kg rover on solid wheels, scaled up with mass and down with wheel grip. Slip is 3% per cm of sinkage, plus 1% per degree of uphill grade above 10°. Above 20% slip the wheels dig in: pushing the throttle with slip above the limit for 5 s in total leaves the rover stuck for good; easing off recovers. Slip also slows the rover.
- **Flares.** Two per mission, at random times in set windows, each a real past X-class flare from NASA DONKI named by class and date. The warning shows 6 s ahead. The rover is protected if it is powered down (the HUD toggle or P) or in shadow when the flare hits. Powered down, the rover cannot drive but its panel still charges.
- **Moonquakes.** One per mission at a random time; the camera shakes. There is no fault location in the terrain data yet, so quakes do the same damage everywhere.

Real causes of rover loss and survival tactics: [rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#hazard-and-anomaly-catalog) and [rover-engineering/06](research/rover-engineering/06-milestones-and-sustainment.md#how-rover-missions-are-sustained).

## 5. Time on each world

Missions get longer with each destination, and the player should feel that time passes differently on each world.

| Mission | Play time | Game time covered | One local day equals | Day and night |
| --- | --- | --- | --- | --- |
| Moon | 5 min | 14 Earth days (one lunar daylight period) | about 21 s per Earth day | All daylight |
| Mars | 10 min | *Proposed:* 20 sols (about 20.5 Earth days) | 30 s per sol | Day and night every sol |
| Titan | 15 min | *Proposed:* 1 Titan day (about 16 Earth days) | The whole mission: about 7.5 min of light, then 7.5 min of dark | Always cold; one long day and one long night |

**Real basis**

- **Moon.** A lunar day lasts 29.53 Earth days, so most sites get about 14 Earth days of light, then 14 of dark ([NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)). ISRO's Pragyan rover was designed for exactly one lunar daylight period, the same shape as our Moon mission ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#day-night-and-survival)).
- **Mars.** A sol is 24 h 39 m 35 s ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#mars-time-restricted-sols-and-solidays)).
- **Titan.** One Titan day is about 16 Earth days, and the surface is about 94 K, or −179 °C ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#physical-and-orbital-environment)).

**No clock.** The HUD has no clock. Players read the passing of time from the sunlight: on the Moon, the low Sun circling the horizon and the shadows sweeping across the map; on Mars, day and night; on Titan, the one long day fading into the one long night.

## 6. Economy and milestones

### Currencies

| Currency | Earned by | Spent on |
| --- | --- | --- |
| Research points (RP) | Milestones | Unlocking new parts and research abilities |
| Money (the budget) | Survival payout and milestone rewards, minus death penalties | Buying unlocked parts and the launch ticket |

**RP decides what the player can build; money decides how much of it they can afford.**

- Money = survival payout (if survived) + milestone money − death penalty (if died)
- RP = RP from milestones

**Scaling.** Budget grows very slowly between missions, the variety of parts grows very quickly, and objective difficulty grows quickly. Early missions offer few resources and simple choices; later ones offer many parts under tight constraints.

All amounts are game values for balancing, not real costs, and the game labels them that way.

### Milestone categories

The real NASA milestone types and rewards behind this design are in [rover-engineering/06](research/rover-engineering/06-milestones-and-sustainment.md#milestones-nasa-measures).

| Category | What counts | Mainly earns | Equipment |
| --- | --- | --- | --- |
| **Capability** | Coverage (distance, area), difficulty (large craters, rocky areas), robustness (extreme cold or dust, no damage, lasting long) | Money | None beyond the rover |
| **Scientific** | Historical formations, new types of information (samples, other wavelengths of light), new materials and strange formations | RP | The matching instrument |
| **Records** | First landing on a world, first discovery of a type of thing, key milestones chosen by design | A big money boost | Depends on the record |
| **Pretty pictures** | Scenic photos | A little money | Camera |

- **Why this split:** a rover built only to drive earns money but almost no RP, so it never unlocks anything. To progress, the player has to spend budget and mass on instruments.
- **Records** are a pacing lever: we place them where the game should speed up. Each can be earned once per campaign.
- **Photos:** the map has viewpoint zones. With a camera equipped, the player drives into a zone and presses a key. Photos go into an album shown at the debrief, which also gives us demo video material.

## 7. Rover design

### Moon parts

Seven slots, two options each. For lights and heater, one option is **None**: skipping them saves cost, mass, and size (maybe a cheaper ticket) but closes off the dark crater. All Moon parts are available from the start, so budget, mass, and size are the only limits. Locked parts first appear on Mars, greyed out with "needs X RP".

| Slot | What it affects |
| --- | --- |
| Chassis | The frame that carries everything. Each option has a cost, a mass, and a maximum load. Example: a steel frame is cheap and heavy; a titanium frame is expensive and light. A frame carrying more than its maximum load takes damage. |
| Wheels | Grip, chance of getting stuck, base speed, energy per meter |
| Power source | Energy income |
| Battery | Energy storage |
| Lights | None, or floodlights. Needed to drive into permanent shadow: without them the rover stops at its edge. |
| Heater | None, or radioisotope heater units. Slows freezing in the cold. |
| Instrument | Camera or drill. Decides which milestones the rover can complete. |

### Mass versus cost

The Moon's one core tension: **cheap parts are heavy, and light parts are expensive.** Mass costs the player in five ways:

| Effect of mass | How it works |
| --- | --- |
| Launch ticket | A heavier rover needs a higher, more expensive ticket tier. Above the top tier it cannot launch. |
| Energy | A heavier rover uses more energy per meter, so its range is shorter |
| Speed | A heavier rover drives slower, so it reaches fewer milestones in the mission time |
| Getting stuck | A heavy rover on weak wheels sinks in soft regolith |
| Structure | A chassis carrying more than its maximum load takes damage |

### Launch ticket

REL does not build its own rockets or landers. For each mission it pays to **secure a spot for the rover on the next launch** to the destination. The ticket price depends on the rover's tier:

| Tier | Fits a rover up to | Price |
| --- | --- | --- |
| Small | A low mass and a small size | Lowest |
| Medium | A higher mass and size | Higher |
| Large | The largest mass and size the lander can carry | Highest |

- **The rover's tier is the smallest one that fits both its mass and its size.** Exceeding either limit pushes it up a tier.
- **A rover too big or heavy for the top tier cannot launch,** so the top tier replaces the old maximum landing mass.
- **Tier jumps make the puzzle.** A rover just over a tier limit pays a much higher price, so players trim parts to fit a cheaper ticket, or decide the extra capability is worth the jump.
- **Size:** each part has a size as well as a mass, and the rover's size is the total of its parts. Large solar panels, big wheels, and the drill are bulky; a battery or heater is compact.
- **Three tiers** to start.
- Tier limits and prices are balance numbers (open question 1).

**Real basis.** NASA's [Commercial Lunar Payload Services](https://www.nasa.gov/commercial-lunar-payload-services/) works this way: instead of building its own landers, NASA pays commercial companies to carry its instruments and small rovers to the Moon. Rideshare launches also sell spots by mass and size.

Background on real rover parts and trade-offs: [rover-engineering/02](research/rover-engineering/02-rover-subsystems.md) and [rover-engineering/05](research/rover-engineering/05-rover-trade-offs-and-game-model.md#rover-trade-off-catalog).

## 8. The Moon mission

| Element | Design |
| --- | --- |
| Length | 5 minutes of play covering 14 Earth days of daylight |
| Map | Real NASA terrain, bigger than one mission can cover. See [Map](#map). |
| Sun and shadows | All daylight, but the Sun stays low and shadows sweep across the map |
| Shadowed craters | Very cold zones that may hold water ice. High risk, high reward. |
| Events | Solar flares and moonquakes |
| Core puzzle | Mass versus cost |
| Minimap | Very simple: the rover's position, the area explored so far, and markers for craters and viewpoint zones. Orbital data layers unlock later with RP. |

### Map

The map is **bigger than one mission can cover**, so the player feels they could keep exploring the Moon's surface. The site, the play area size, and the landing point are decided. The data sources follow the recommended stack in [rover-engineering/08](research/rover-engineering/08-moon-surface-data.md#recommended-stack).

- **Site:** the de Gerlache crater rim near the south pole. NASA's 5 m elevation tile there covers 16 km × 16 km. The main de Gerlache crater floor is permanently shadowed but about 10 km from any good rim landing spot, so it is scenery seen from the rim, not a destination. A real fault scarp linked to a strong moonquake, and it matches the 2025 "de Gerlache Rim" Artemis candidate region.
- **Detailed play area:** about 8 km × 8 km at 5 m per pixel (a 1,600 × 1,600 heightmap), loaded in pieces around the rover. A 5-minute mission covers only part of it. Recommended source: NASA's 2025 sharpened model of the de Gerlache rim.
- **Distant terrain:** NASA's 20 m polar elevation map out to about 30 km, then 80 m out to about 150 km, so real mountains such as Malapert and Mons Mouton show on the horizon and the player never sees the end of the world.
- **Ground and obstacles:** textures from LROC's 1 m image mosaic of the site. Small craters and boulders are placed by rules from real crater and boulder counts (almost all boulders under 4 m).
- **Soil:** based on Apollo 15 rover data. Wheels normally sink 1 to 2 cm, 5 to 7 cm on soft fresh crater rims; above about 20% wheel slip the rover digs in and can get stuck; slopes above about 20° are too steep.
- **Shadowed crater:** a smaller real permanently shadowed crater on the rim's north flank (0.87 km², about 2% average sunlight, flat floor), about 2.9 km drive from landing. It is the game's dark crater and holds a small hidden ice spot. Chosen by the team after the terrain data showed the main floor is out of reach.
- **Landing point:** a flat, sunlit spot on the crater rim near the middle of the play area, with Earth in view (88.52°S, 67.96°W; sunlit about 66% of the time, Earth visible about 60%). These are the same kinds of criteria real landing sites are chosen by. The exact spot is picked when processing the data, using the real slope and sunlight maps. *(Our recommendation, accepted by the team.)*
  - **Distances (drive):** rim viewpoint 0.5 km, rocky area 0.3 km, descent into de Gerlache's inner wall 0.9 km, second viewpoint and rocky area about 1.2 to 1.6 km, shadowed crater entry 2.9 km, ice spot about 3.2 km (hidden, see below). In one 5-minute mission the player can reach some of these, but not all, so choosing a route is part of the puzzle. Exact distances are tuned once rover speeds are set.
  - **The lander stays on the map** as a landmark the player can navigate by.
- **Small cold patch:** a tiny real cold spot inside the nearby rocky area also uses the freeze rule. It is an early, low-risk taste of the cold. *(Decided during implementation.)*
- **Edge:** a "leaving the planned operating area" notice stops the rover at the boundary. Real missions also plan an operating zone.
- **Why this works:** the Moon is small, so from rover camera height (about 1.7 m) the horizon is only about 2.4 km away. Only high ground shows beyond it, so a large detailed area plus coarse distant terrain looks like one continuous surface.

### Sun and shadows

At the south pole the Sun stays within 1.5° of the horizon and circles the sky once per lunar day, so it sweeps about halfway around during the mission. The Moon stays all daylight, but shadows move, and a sunny charging spot can fall into shadow. This matches real south pole conditions.

*Measured on the real terrain (fix pass):* with the first Sun path (start azimuth 17.4°, subsolar latitude −0.52°), the landing point stayed sunlit for the whole mission, but once the Sun swung west past about azimuth 300° (about 145 s, day 6.8) it sat behind the rim as seen from the north flank, and the whole route to the dark crater and both rim viewpoints were in shadow until the end. This is real geometry, not a rendering error.

**Decided (November 15): start azimuth 75°, subsolar latitude −1.54°.** The mission starts about 4.7 Earth days earlier in the lunar day, so the Sun sweeps from azimuth 75° to 264°, and the subsolar latitude is at the far end of its real ±1.54° range, which lifts the Sun by about 1° (elevation 0.4° at the start, up to 3.0°). Sunlit share over the mission, offline shadow test, sampled every 5 s (route: 10 m grid, slopes up to 18°):

| Place | Start 17.4°, −0.52° | Start 75°, −0.52° | **Decided: 75°, −1.54°** |
| --- | --- | --- | --- |
| Landing | 100% | 100% | **100%** |
| Rim viewpoint 1 | 47% | 80% | **89%** (dark only 255 to 285 s) |
| Rim viewpoint 2 | 55% | 89% | **93%** (dark only from 285 s) |
| Route to the dark crater (share of the route lit) | 42% | 71% | **77%** (over 90% until 210 s) |
| de Gerlache wall descent (Crater layers) | 48% | 15% | **16%** (lit only from 255 s) |
| A light build (12 m/s) driving the crater route | 47% | 69% | **72%** (lit until 215 s) |

- **Rims and route.** The route stays over 90% lit until about 210 s and drops below a third after 250 s, when the north flank goes dark.
- **Opening view.** The rover starts facing azimuth 0° (`rover.startHeadingDeg`), toward Earth on the horizon, the rim viewpoints and the dark crater route, with the lander and its ramp behind it. 99% of the ground 40 to 500 m ahead is lit at the start (azimuth 197°, the old heading, faced the shadowed de Gerlache side: 1% lit).
- **No eclipse.** With subsolar latitude −0.52° the Sun passed 0.5° from Earth's center at about 132 s and was hidden behind Earth for about 4 s. That needs a full Moon lined up with the orbit's nodes and should not happen in an arbitrary mission. At −1.54° the closest pass is 1.5°, clear of Earth's disc (radius about 0.95°) and the Sun's (0.27°).
- **Cost of this choice.** The inner-wall descent point (Crater layers) is mostly in shadow: it is lit only in the last 45 s. A photo there still counts in the dark.

### Shadowed craters

Very cold zones. Lights and a heater are needed to enter safely, and a drill is needed to sample ice. Real basis: LRO's Diviner instrument measured about 25 to 40 K in craters near the poles that never see sunlight, and in 2009 the LCROSS impact plume at Cabeus crater indicated about 5.6% (± 2.9%) water by mass, one reason NASA designed the VIPER rover to look for polar ice ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#the-south-pole-low-sun-long-shadows-ice-and-earth-below-the-horizon)).

### Events

| Event | What happens | Player response |
| --- | --- | --- |
| Solar flare | A radiation burst that threatens the electronics, with a warning a few seconds ahead. Each one is a real past flare from NASA DONKI, named by class and date. | Power down or shelter in shadow in time. A rover that is powered on in sunlight when it hits takes damage, more for stronger flare classes. |
| Moonquake | The ground shakes | The rover takes damage. Quakes hit equally everywhere: the real fault scarp lies outside the play area. |

### Moon milestones

The starting list. Distances and amounts are game values to balance.

| Milestone | Category | How to earn it | Equipment |
| --- | --- | --- | --- |
| Touchdown | Record: first touch | Land on the Moon for the first time | None |
| Odometer | Capability: coverage | Drive set distances, for example 500 m, 1 km, and 2 km | None |
| Mapper | Capability: coverage | Reveal a set share of the map | None |
| Crater descent | Capability: difficulty | Drive down de Gerlache's inner wall (at least 150 m below landing) and back out. Not the dark crater. | None |
| Boulder field | Capability: difficulty | Cross the rocky area | None |
| Into the dark | Capability: robustness | Enter a shadowed crater and come back out | Lights, heater |
| Flare survivor | Capability: robustness | Get through a solar flare without damage | None |
| Clean run | Capability: robustness | Finish all 14 days without damage | None |
| Crater layers | Scientific: historical formation | Image the old layers exposed in a crater wall | Camera |
| Regolith sample | Scientific: new information | Drill a soil sample at least 200 m from the lander | Drill |
| Water ice | Scientific: new material, and Record: first discovery | Find and drill the small ice spot inside the dark crater (not marked on the map) | Drill, lights, heater |
| Earth on the horizon | Pretty picture | Photograph a sunlit Earth (at least a quarter lit) from the surface. Earth is only visible from the north side of the rim. | Camera |
| Rim panorama | Pretty picture | Photograph the view from a crater rim | Camera |

- The Moon has one instrument slot, so **camera or drill** is the Moon's science choice. The camera earns pictures and imaging science; the drill earns samples and the water ice.
- The Moon has almost no atmosphere, so air samples start on Mars and Titan.

#### How the milestones work *(decided during implementation, Phase 5)*

Rules in `game/src/rules/milestones.ts`; triggers, rewards and text in `game/data/milestones.json`; zone sizes in the `milestones` section of `tuning.json`. Zones come from the `terrain.json` features.

- **Required parts are enforced.** A trigger on a rover without the parts (for example the dark crater without a heater) is not credited, and a notice says which part was missing.
- **Crater descent.** The rover counts as inside when it is more than 150 m below the landing point on the de Gerlache side of the rim (the side the rim viewpoints face), and back out once it climbs above 100 m below landing. The north flank toward the dark crater also drops far below the landing point and does not count.
- **Boulder field.** Each rocky area is a circle of 1.1 times its radius (where the boulders lie). Crossing means leaving at least 90° around the center from where the rover entered; turning back out the same side does not count.
- **Into the dark** counts only for the dark crater (its permanent-shadow outline), not the small cold patch in Rocky area 1.
- **Camera (C key).** Viewpoint zones are 60 m circles: the two rim viewpoints (Rim panorama) and the de Gerlache wall descent point on the inner wall (Crater layers). The Earth photo has no zone: it counts wherever Earth's center is above the real terrain horizon as seen from the camera and inside the frame, so it works only from the north side of the rim and only facing Earth. Earth must also be at least 25% lit (its phase, from the angle between the Sun and Earth; `earthPhotoMinLit` in tuning). With the decided Sun path (start 75°, subsolar latitude −1.54°), Earth is at least a quarter lit only in the first 26 s, a 37% to 25% crescent, and from about 238 s to the end, up to 55%: about 90 s in all. With the old start (17.4°), the window ran from about 137 s to the end. A photo of a darker Earth goes into the album, with a notice that it does not count. A photo is a real capture of the view. Photos can be taken anywhere for the album (up to 12 per mission) but earn milestones only at viewpoints or with Earth in view. The album is shown in the debrief and is not saved between sessions.
- **Drill (F key).** The rover must be stopped; drilling takes 3 mission seconds, during which it holds still. A sample counts only at least 200 m from the landing point (`sampleMinDistanceM`), where the lander's engine plume did not disturb the ground, so there is no free sample at the start. Any counted sample earns Regolith sample.
- **Water ice is found by searching** *(team decision, fix pass)*. The minimap marks the dark crater (the permanent-shadow region), not the ice. The ice spot is a 50 m circle (under 1% of the crater) placed by the terrain pipeline about 100 m inside the shadow edge, on the side facing the landing. It is fully permanently shadowed in the LOLA maps and in the game's own shadow test. A sample there earns Water ice. Anywhere else in the crater the drill reports "No water ice detected at this site." Inside the crater, a drill rover sees a hint to test-drill, never the spot itself. Reaching it needs about 3.2 km of driving.
- **Hydrogen signal** *(decided November 15)*. Each drill sample inside the dark crater adds a reading to its notice:
  - "Hydrogen signal: strong" within 100 m of the ice spot's center, "moderate" within 250 m, "weak" farther away. A rover entering at the near edge reads "moderate".
  - Samples outside the crater give no reading. The numbers are `hydrogenStrongWithinM` and `hydrogenModerateWithinM` in tuning, and `hydrogenSignal: false` turns the clue off.
  - With Mission history on, the first reading of a mission adds one real fact (`text.json` → `drill`): LRO's LEND neutron detector maps polar hydrogen from orbit the same way.
- **Reaching the ice** *(measured before the November 15 balance pass)*. The cheapest ice build costs 735 on the Medium ticket: titanium, mesh wheels, fixed panel, lithium-ion, lights, heater, drill. It is also the only one under the 750 budget that reaches the ice.
  - Flat-speed simulation on the real route (3.3 km): arrives at 275 s, drill done at 278 s, 5% energy left.
  - Real browser drive: ice zone at 277 s, drilled at 287 s, survived with 47 energy, after a flare and a moonquake.
  - The ice is reachable, with about 20 s to search. With the old Sun start (17.4°), the same build runs out of energy at about 250 s.
- **Mapper** is 1.8% of the map. Measured in playtests with full-throttle drives: a light build drove 3.2 km and revealed 2.8% (Mapper at about 2.2 km); the default build drove 2.0 km before its battery ran out and revealed 1.84%. The share grows about 0.77% per km of new ground.
- **Clean run** ignores moonquake damage, because every mission has one quake and nothing can prevent its damage. Any other damage (impacts, slopes, overload, flares) loses it. The milestone notice says so.
- **Records** (Touchdown, Water ice) pay once per campaign. A record already held still shows in the debrief, without a reward. A restart restores the records list from the round snapshot, so records from a failed round can be earned again.
- **Mission history setting** (title screen → Settings; on by default, saved in the browser). When on, each milestone pop-up shows its real fact (staged milestones on the first stage only), the debrief lists the facts, and the debrief compares the rover's fate with a real rover's. Every fact has a source in `milestones.json` or `text.json`; the debrief shows the comparison's source.
- **Rollover** is reported as "Destroyed by rollover", with its own real-rover comparison (no planetary rover is known to have been lost to a rollover).
- **Earth's look.** Earth's phase follows the angle between the Sun and Earth, which is real geometry.
  - With the decided Sun path (start 75°, subsolar latitude −1.54°), Earth starts as a 37% crescent. It is nearly dark (new Earth, 1% lit) when the Sun passes 1.5° beside it at about 132 s, then fills again to 55% at the end.
  - The Sun no longer passes behind Earth (see [Sun and shadows](#sun-and-shadows)).

## 9. NASA data

All datasets below are decided. The priority column is build order: **Core** goes in first, **Strong** follows. Sources, formats, and effort are in [rover-engineering/07](research/rover-engineering/07-nasa-data-for-the-game.md) and, for the surface itself, [rover-engineering/08](research/rover-engineering/08-moon-surface-data.md).

| Data | NASA source | What it changes in play | Priority |
| --- | --- | --- | --- |
| Terrain and slopes | LRO laser altimeter (LOLA), 5 m per pixel, sharpened with LROC images (2025); 20 m and 80 m maps for the horizon | The map itself; steep slopes cause damage; real distant mountains | Core (decided) |
| Ground imagery | LROC 1 m mosaic of de Gerlache rim | Real ground texture and a real image for the map screen | Core |
| Inside the shadowed crater | ShadowCam (NASA camera on Korea's Danuri orbiter) | Real imagery of the permanently shadowed crater floor | Strong |
| Soil | Apollo 15 Lunar Roving Vehicle measurements | Sinkage, slip, and slope limits behind "getting stuck" | Strong |
| Boulders and small craters | LROC and Chandrayaan-2 boulder counts; crater statistics | Where obstacles are placed and how big they are | Strong |
| Low Sun and moving shadows | Polar geometry (no file needed) | Shadows sweep across the map; charging spots move | Core (decided) |
| Permanent shadow and sunlight maps | LRO LOLA and LROC | Cold zones sit where they really are | Core |
| Temperatures and ice depth | LRO Diviner | How fast the rover freezes in each zone; where ice can exist | Strong |
| Where ice is exposed | Moon Mineralogy Mapper (M3) | Ice only in a few cold spots, so drilling the wrong crater finds nothing | Strong |
| Moonquakes | Apollo seismometers; south pole fault scarps (outside the play area) | Rare quakes that damage the rover; the facts explain the real cause | Strong |
| Solar flares | NASA's DONKI space weather database | Each flare is a real past flare, named with its date and class | Strong |
| Earth in the sky | Polar geometry | Earth bobs above and below the horizon, so the Earth photo is a timing puzzle | Strong |
| Star field | NASA SVS Deep Star Maps | A real sky above the airless Moon | Strong |

**Orbital map layers.** Switchable minimap layers for elevation, sunlight, and temperature, each labeled with the NASA instrument that measured it. They are unlocked with RP from Mars onward (the Moon has no unlocks). Real teams plan drives with the same orbital data, and the layers make our NASA data visible to judges.

## 10. Progression and later missions

### Progression

- **RP unlocks parts.** Reaching RP thresholds makes new parts, research abilities, and orbital map layers available.
- **Research needs the right equipment.** An unlocked ability works only if the matching instrument is on the rover, so the design screen decides which milestones are reachable.
- **Missions get harder,** and the player chooses which branch of advancements to take.
- **The Moon has no unlocks.** Its RP carries forward to Mars.
- The unlock tree itself is *Open* (question 3).

### Mars and Titan

The Moon teaches one trade-off. Mars and Titan add more intricate ones about what to put on the rover and which capabilities to enable. The team has a list of candidate constraints to evaluate (question 2). Already decided:

- **Mars** adds day and night, which brings in the lights-on or sleep choice.
- **Titan** is always cold.
- Each world has its own random events.

### Build order

1. **Moon:** being designed now.
2. **Mars:** built soon after. Moon RP unlocks Mars technology.
3. **Titan:** after Mars.

Not planned for now: two-player mode and randomly generated maps.

## 11. Identity and presentation

| Element | Design |
| --- | --- |
| Game name | Rover Engineer |
| Agency | REL (Rover Exploration Laboratory). Fictional, with no NASA branding; real NASA missions can still be cited as facts. |
| Story premise | REL pays to secure a spot for its rover on the next launch to each destination. The bigger and heavier the rover, the higher the ticket tier it needs. |
| Player role | A new rover engineer at REL mission control |
| Tone | Scientific and formal |
| Characters | None. All text (tutorial, briefings, milestone pop-ups, debrief) reads as neutral mission documentation, not dialogue. |
| Onboarding | Tutorial text guides the player through the design screen and the first drive |
| Real facts | **Optional.** A "Mission history" setting, on by default, that players who just want to play can turn off. When on: a one-sentence real fact on each milestone pop-up, and a debrief comparing the rover's fate with a real rover's. Tutorial text is always shown. The same optional pattern is used for other extra learning, such as the real-speed pop-up on the design screen. |

## 12. Tech stack and fit with the brief

| Part | Choice | Why |
| --- | --- | --- |
| 3D rendering | [Three.js](https://threejs.org/) | Runs in the browser, so judges can play from a link |
| Physics and driving | [Rapier](https://rapier.rs/) | Includes a ready-made vehicle controller |
| Dev server and build | [Vite](https://vite.dev/) | Instant reload while tuning numbers |
| Design screen and HUD | HTML and CSS | The fastest way to build menus and dashboards |

The stack can be revisited later; a strong design doc keeps that possible.

| Brief element | How the game covers it |
| --- | --- |
| Spacecraft and mission design | The rover design screen, within the budget and the launch ticket tiers |
| Launch vehicle | The launch ticket: a heavier or bigger rover needs a more expensive tier, and the top tier is the lander's limit. This makes mass and size a launch cost, as for real payloads. |
| Use of NASA data | Real LRO terrain, LROC and ShadowCam imagery, Apollo soil data, and more; see [NASA data](#9-nasa-data) |
| Educational value | Mechanics built on real science (day lengths, low polar Sun, rare ice, soil limits), plus optional real-history facts such as Pragyan's one-day mission and VIPER and the ice |

How this maps to the judging criteria: [landscape research](research/landscape-precedents-and-judging.md#applying-the-judging-criteria).
