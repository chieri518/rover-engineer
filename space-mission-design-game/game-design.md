# Rover Engineer: Game Design

The working design for **Rover Engineer**, our entry to the Space Mission Design Game challenge. It is written for our team, not for players.

Last updated November 15, 2026 (all six phases of the payload bay and relationships plan built). The official brief is in [challenge brief](challenge-brief.md). The catalog of rover components, instruments, and how they constrain each other is in [rover engineering design](rover-engineering-design.md). Background research is in [landscape research](research/landscape-precedents-and-judging.md), [mission-engineering/](research/mission-engineering/README.md), and [rover-engineering/](research/rover-engineering/README.md).

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
| Rover | Six part slots and a payload bay for instruments, each configurable, limited by budget. Moon trade-off: mass versus cost. |
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
| 1 | **Balance numbers.** Money, RP, milestone rewards, death penalties, part costs, masses, and sizes, launch ticket tier prices and limits, minimum budgets, base speed per wheel type and how much mass slows the rover, Odometer distances | The Moon pass rule and money were set in the November 15 balance pass ([Balance: several ways to pass](#balance-several-ways-to-pass)). Keep tuning in playtests. |

**Decided November 15, 2026** (formerly open questions 1a to 1c):

- **1a Sun window:** start azimuth 75° and subsolar latitude −1.54°, both real geometry. This keeps the route and rim viewpoints lit until about 220 to 250 s and removes the Sun passing behind Earth. The rover starts facing azimuth 0° (toward Earth and the dark crater route), where 99% of the ground ahead is lit at the start. See [Sun and shadows](#sun-and-shadows).
- **1b Water ice reach:** the smaller drill (size 3, 8 kg, cost 90) stays. The ice is one optional way to pass the Moon, never required; see [Balance: several ways to pass](#balance-several-ways-to-pass).
- **1c Clue for finding the ice:** the hydrogen signal stays (`milestones.hydrogenSignal`). *Superseded later on November 15 (built in Phase 3):* with the payload bay, the hydrogen clue moves from the drill to a new neutron spectrometer's live meter, and the drill gives no reading; see [rover engineering design](rover-engineering-design.md#7-the-moon-payload).

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
- A restart returns everything to a snapshot taken at the start of the round: balance, RP, and records. This keeps the code simple and stops players replaying a round to farm records. *(Decided November 15; built in Phase 5:)* the engineering notebook is the exception and survives restarts, so what the player learned in a failed run carries over; see [rover engineering design](rover-engineering-design.md#engineering-notebook). A new campaign starts with an empty notebook.

## 4. Mission: the inner loop

```
Drive ──► Reach milestones ──► Earn RP and money
  │
  └─ while managing: energy · damage · cold · soft ground · random events
```

- **Driving uses energy.** Heavier rovers use more energy per meter.
- **Speed depends on the configuration.** The wheels set a base speed, and a heavier rover is slower. A heavy rover reaches fewer places in the mission time.
- **Speed is compressed like time.** 14 days pass in 5 minutes, so driving is sped up too: roughly 4 to 6 times real rover speeds (about 6 m/s for a heavy build, about 13 m/s for a light one on wire-mesh wheels). A light build can just reach the dark crater; a heavy one cannot. To keep the rover grounded at these speeds, it falls about 4 times faster than real lunar gravity (a game-feel choice made during implementation). Measured before the balance pass: a light build (12 m/s) reached the dark crater entry in about 240 s; a heavy one (6 m/s) ends about 1 km short. *Balance pass (November 15):* wire-mesh wheels now model 3.3 m/s of real driving (11.9 km/h, inside the Apollo LRV's 9 to 13 km/h), so a light build drives 13.2 m/s; this keeps the dark crater reachable with good, not perfect, driving. On the design screen, an optional info pop-up next to the speed readout explains real drive speeds, like the optional history facts.
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

### Balance: several ways to pass

*Decided November 15, 2026 (balance pass).*

**Design rule.** No single right answer. Passing the Moon must need real milestone money that only an intentionally designed rover, driven along a route that suits it, can earn. Several different designs pass, each by doing a different job. Idling, surviving without a plan, a short trip near the lander, or bringing an instrument and not using it fails. The ice is the highest-reward, highest-risk path, never the only one. It is the first level, so a well-planned rover keeps room for one or two mistakes.

**Pass rule (unchanged in shape).** After the Moon mission the balance must reach the Mars minimum budget. Starting budget 750; the parts and the ticket are paid first; then money = survival payout + milestone money − death penalty. Before this pass, the Mars minimum was 300 and the cheapest rover ended at about 730 by doing nothing, so every build passed.

| Number | Before | Now |
| --- | --- | --- |
| Mars minimum budget (the pass mark) | 300 | **780** (the Moon must pay for itself). Confirmed for now (November 15); the team will revisit it when designing the Mars mission, based on what Mars rovers cost. |
| Survival payout | 250 | **50** |
| Touchdown | 150 | **50** |
| Odometer (per stage: 500 m, 1 km, 2 km) | 30 | 30 |
| Mapper | 50 | **60** |
| Crater descent | 60 | 60 |
| Boulder field | 50 | **100** |
| Into the dark | 80 | **150** |
| Flare survivor | 40 | **30** |
| Clean run | 60 | **50** |
| Crater layers | 20 | **80** |
| Regolith sample | 20, once | **100 per site, up to 3 sites** |
| Water ice | 200 | **350** |
| Earth on the horizon | 25 | **100** |
| Rim panorama | 20 | **70** |
| Wire-mesh wheels, real speed | 3.0 m/s | **3.3 m/s** (13.2 m/s in game) |

Moon minimum (520), starting budget (750), part costs, ticket tiers, death penalties and RP are unchanged. The restart loop is unchanged: a restart restores the round snapshot (750), which is above the Moon minimum. Instruments now earn real money, so the camera's pictures and the drill's samples pay more than the categories table above suggests ("mainly RP", "a little money"). Survival alone is worth little; staying alive matters because dying forfeits it and costs a penalty on top.

**How it was checked.** `src/rules/winPaths.ts` (pure, unit-tested) drives every build along route plans with the real mission rules: energy, solar income from the real lit share of each leg over time, cold, overload, soft-ground slip at boulder fields, and two flares (the player powers down for 8 s each). Drive legs between the milestone sites were measured once on the real terrain (least-cost routes on a 10 m grid, slopes up to 18°) and are stored with the plans in `game/data/balance.json`, which the game does not load. "Reasonable play" means driving at 90% of top speed, recharging in sunlight before a leg the battery cannot cover with a 10% reserve, and touching a rock when crossing a boulder field (so no Clean run there; real drives often keep it). `winPaths.test.ts` holds the targets: idling fails for every build by more than 100; wandering, or one or two short stops near the lander, fails for every build; at least three archetypes with different parts and routes, using both instruments, pass with a margin of at least 50; each archetype fails if it skips its instrument; fewer than 35% of affordable builds can pass even with their best route; the cheapest build fails on every route; more than five builds pass without the ice.

**Archetypes** (model estimate; pass mark 780):

| Archetype | Build | Cost + ticket | Route | Milestones | Final | Without using the instrument |
| --- | --- | --- | --- | --- | --- | --- |
| Camera scout | steel, mesh, fixed panel, NiH2, no lights, no heater, camera | 330 + Medium 120 = 450 | Down the de Gerlache wall (photo), straight up to Rocky area 1, across it, Rim viewpoint 1 (photo), wait there for Earth (photo after 238 s) | Crater layers, Crater descent, Boulder field, Rim panorama, Earth, Mapper, Odometer ×3, Flare survivor | 990 (+210) | 740 (fails) |
| Drill geologist | steel, mesh, fixed panel, Li-ion, no lights, no heater, drill | 430 + Medium 120 = 550 | North: Rocky area 1 (sample), across it, Rim viewpoint 1 (sample), Rim viewpoint 2 (sample) | Regolith ×3, Boulder field, Mapper, Odometer ×3, Flare survivor | 880 (+100) | 580 (fails) |
| Ice hunter | titanium, mesh, fixed panel, Li-ion, lights, heater, drill | 615 + Medium 120 = 735 | Straight to the dark crater, sample at the edge, find and drill the ice (about 293 s) | Water ice, Regolith ×2, Mapper, Odometer ×3, Clean run, Flare survivor | 895 (+115); 545 if the ice is not found | 345 (fails) |

Other designs also pass in the model, for example a camera build on titanium and mesh wheels doing the scout route, or a drill build with a NiH2 battery sampling the crater wall, the boulder field and the rim. 33 of 115 affordable builds can pass with their best route (17 of 63 camera builds, 16 of 52 drill builds); none pass by idling, wandering or a short trip.

**Browser check** (headless Chrome, real game flow, an autopilot following the measured routes, honest play; run before the final number pass, so the finals below are re-priced with the final money from the milestones each run actually earned):

| Run | Build | Result in the browser | Final with final numbers |
| --- | --- | --- | --- |
| Idle | cheapest parts, camera | survived at the lander: Touchdown, Flare survivor, Clean run | 510, fails |
| Camera scout | as above | survived; Crater layers, Crater descent, Rim panorama, Earth (at 280 s), Odometer ×3, Clean run, Flare survivor; Boulder field only once the crossing point was fixed (see below) | 820 without Boulder field, 980 with it: passes |
| Drill geologist | as above, north route | survived; Regolith ×3, Odometer ×2, Clean run, Flare survivor; Boulder field once the crossing point was fixed; then "Mars: coming soon" | 740 without Boulder field (fails), 870 with it: passes |
| Drill geologist (crater wall variant) | steel, mesh, panel, NiH2, drill | survived; Regolith ×3, Crater descent, Odometer ×3, Clean run, Flare survivor | 810, passes |
| Light sampler | titanium, solid, panel, Li-ion, drill | survived; Regolith ×3, Odometer ×2, Clean run, Flare survivor | 820, passes (the model says 770: it assumes two sites and a rock touch) |
| Ice hunter | as above | survived with 1% battery and 21 damage; ice drilled at 276 s, Into the dark too | 895, passes |
| Random A (the old default build: titanium, solid, panel, Li-ion, lights, heater, camera) | wandered with photos | survived; Rim panorama, Crater layers, Odometer ×2, Clean run, Flare survivor | 555, fails |
| Random B (cheapest parts) | wandered | stuck in soft ground at a boulder field at 127 s | 373, fails |

The browser runs found one model error, now fixed: the boulder-field crossing point on the north side sat short of the 90° the Boulder field rule needs (a route leaves the circle early, on a chord). The crossing point is now 112° round from the entry, which passed in the browser, and the model only credits a crossing whose end points are at least 105° apart (a test checks the archetype routes). For players this is the existing rule: cross the boulder field to its far side, not just clip its edge.

**Builds without a plan** (best route in the model). Examples that fail, and why:

| Build | Cost + ticket | Best final | Why it fails |
| --- | --- | --- | --- |
| Cheapest parts (steel, solid, panel, NiH2, none, none, camera) | 220 + Large 200 = 420 | 740 | Heavy on solid wheels: digs in on soft boulder-field ground, too slow for the wall and the rim in one mission; the Large ticket eats the savings |
| Titanium, solid, panel, Li-ion, lights, heater, camera (the old default build) | 465 + Medium 120 = 585 | 575 | Pays for lights and a heater it cannot use (too slow to reach the dark crater), small battery |
| Steel, mesh, mast, Li-ion, lights, heater, camera | 575 + Medium 120 = 695 | 745 | Does the full scout route but carries about 250 of parts it does not need (lights, heater, mast, lithium-ion) |
| Titanium, solid, panel, NiH2, lights, heater, drill | 445 + Large 200 = 645 | 465 | Overloads the titanium frame (damage while driving), slow, Large ticket |
| Any build that stays at the lander | | at most 530 | Survival, Touchdown, Flare survivor and Clean run are worth 180 together |

**Limits of the estimate.** The ice route needs good driving (about 90% of top speed for 3.3 km) and the hydrogen clue to find the spot; the model assumes the spot is found. Boulder-field crossings assume one rock touch. Mapper uses the playtest rate of about 0.77% of the map per km of new ground.

## 7. Rover design

### Moon parts

The Moon parts table: six slots with two options each, plus the payload bay with six instrument options (built, Phases 1 to 3). The slots are listed in the table below; the instruments, with their costs, masses and sizes, are in the second table. For lights and heater, one option is **None**: skipping them saves cost, mass, and size (maybe a cheaper ticket) but closes off the dark crater. All Moon parts are available from the start, so budget, mass, and size are the only limits. Locked parts first appear on Mars, greyed out with "needs X RP".

**Empty start** *(decided November 15)*. In a new campaign the design screen starts with all slots and the payload bay empty, so there is no default build to copy. The rover can go to the launch ticket only once every slot has a part and the bay is confirmed; "No lights", "No heater" and "No instruments" count as choices. While slots are empty, the specification sheet shows the totals of the parts chosen so far, a dash for driving numbers that need a missing part, and a warning listing the empty slots. A restart keeps the last design, so the player can adjust it.

| Slot | What it affects |
| --- | --- |
| Chassis | The frame that carries everything. Each option has a cost, a mass, and a maximum load. Example: a steel frame is cheap and heavy; a titanium frame is expensive and light. A frame carrying more than its maximum load takes damage. |
| Wheels | Grip, chance of getting stuck, base speed, energy per meter |
| Power source | Energy income |
| Battery | Energy storage |
| Lights | None, or floodlights. Needed to drive into permanent shadow: without them the rover stops at its edge. |
| Heater | None, or radioisotope heater units. Slows freezing in the cold. |
| Payload bay | Any mix of the instruments, one of each, or none. Decides which milestones the rover can complete. The chassis sets the bay's mounting points (steel 3, titanium 2), one per instrument. **Built (Phases 1 to 3):** the bay, instrument operating costs, and the six Moon instruments (science camera, regolith drill, neutron spectrometer, X-ray spectrometer, seismometer station, laser retroreflector); see [rover engineering design](rover-engineering-design.md#7-the-moon-payload). The new four earn no milestones yet. |

**Moon instrument options** *(built, Phases 1 to 3)*. The bay takes any mix of these, one of each, up to the chassis's mounting points. Numbers are in `game/data/parts.json`; mission behavior is described below.

| Instrument | Verb | Cost / mass / size | Energy |
| --- | --- | --- | --- |
| Science camera | Look | 50 / 3 kg / 1 | None |
| Regolith drill | Dig | 90 / 8 kg / 3 | 10 per sample |
| Neutron spectrometer | Sense while driving | 80 / 4 kg / 2 | 0.1 per second while on |
| X-ray spectrometer | Touch | 60 / 2 kg / 1 | 3 per reading |
| Seismometer station | Deploy and leave | 70 / 4 kg / 2 | None |
| Laser retroreflector | Deploy and leave | 30 / 3 kg / 1 | None |

**Payload bay on the desk** *(decided during implementation, Phase 1; built)*:

- The bay's order is the order the player added the instruments; each card shows its mission key ("Key 1"), and the mission uses the same order for keys 1 to 3 and the HUD buttons.
- **Instrument controls (built, Phase 1):** number keys 1 to 3 in bay order and one HUD button per instrument are the only way to use an instrument. The old fixed keys C (camera) and F (drill) are gone, so every instrument works the same way.
- A full bay disables the cards not yet in it. Before a chassis is chosen, the bay takes as many instruments as the roomiest chassis.
- Choosing a chassis with fewer mounting points drops the instruments added last, with a notice under the bay saying which.
- "No instruments" confirms an empty bay. Taking the last instrument out also leaves a confirmed empty bay *(changed in Phase 2, lead decision)*: the player has touched the bay, so that is a choice. An unconfirmed bay means only that the bay was never touched.
- A save from before the payload bay keeps its instrument: it becomes the bay's only instrument.
- A saved design keeps only the parts the catalog still has *(Phase 2)*: a slot whose part was renamed or removed is empty again, and unknown or repeated instruments leave the bay. If that empties a bay that held instruments, the bay is unconfirmed, so the player chooses again.

**Instrument operating costs** *(decided during implementation, Phase 2; built)*. Each instrument part can have an energy per use, a standby energy, and a time the rover holds still (`energyPerUse`, `standbyEnergy`, `useSeconds` in `parts.json`; rules in `rules/mission.ts`):

- The drill uses 10 energy per sample and holds the rover still for 3 s; the camera uses no energy and is instant. The neutron spectrometer draws 0.1 energy/s while on; the X-ray spectrometer uses 3 energy and 4 s per reading; the two stations take 3 s to set down and no energy.
- The energy per use is taken when the use starts. A use is refused, with a notice, if it would empty the battery, so an instrument never ends the mission by itself.
- A powered-down rover cannot use its instruments, the camera included (before Phase 2 the camera worked while powered down). Only a held use needs the rover stopped; a photo can still be taken while the drill works, but a second held use waits for the first.
- An instrument with a standby draw is a switch: its key or button turns it on or off; it starts off; it draws energy every second while on, except while the rover is powered down.
- **Standby never ends the mission** *(Phase 3, lead decision)*. A standby draw never takes the battery below the low-energy warning (20% of capacity, `energy.lowWarningShare`): at that level the switched-on instruments switch off by themselves, with a notice, and switching one on at or below it is refused. Switching on while powered down is allowed; it draws nothing until power-up.
- **A held use pauses while powered down** *(Phase 3, lead decision)*: its countdown stops and resumes on power-up, so powering down for a flare in the middle of a drill sample does not lose the sample.
- In a cold zone, a rover without a heater holds still longer: the hold time is multiplied by `instruments.coldSlowdown` in `tuning.json` (2 for now, to be set in the balance patch), with a notice. Phase 4 explains this as the "Cold and dark" relationship (built: see below; named "In the cold, instruments need the heater" since Phase 5). A part marked `coldTolerant` (the X-ray spectrometer) is exempt.
- Each instrument's mode follows from its part: a standby draw makes a switch, `deploy` makes a station, anything else is a use. A switch cannot also have a use cost, a hold time, or deploy (data validation).
- The desk shows each instrument's costs on its card, and the specification sheet has an "Instrument energy" line for the bay under the range estimate.

**The four new Moon instruments** *(decided during implementation, Phase 3; built)*. Rules in `game/src/rules/instruments.ts` and `rules/mission.ts`; numbers in `tuning.json` → `instruments` and in `parts.json`. None earns money or RP yet; the desk card of each says so (derived: the line shows while no milestone requires the instrument, and goes away once one does), and so does the design tutorial's Payload bay page. The debrief's **Instrument log** has one line for each of these four that the rover **carried**, and none for those it did not carry: the highest hydrogen reading (or "not switched on"), one line per rock read (or "no rocks were read"), the seismometer's record and its quality ("not set down" if the station never went down; "set down, but no moonquake came" if the mission ended first), and "placed" or "not placed" for the reflector.

- **Keys and buttons stay in bay order.** A deployed station keeps its key and its button, which reads "Deployed" and is disabled; pressing its key says it is already on the ground.
- **Neutron spectrometer** (switch, 0.1 energy/s). While it is on and the rover is powered up, a Hydrogen meter (0 to 100%) shows under the cold meter; it is hidden and draws nothing while powered down, and stays on through a power-down. The reading:
  - ordinary ground: the noise floor (5%);
  - any permanent shadow (the dark crater, the cold patch in Rocky area 1): at least the cold background (20%);
  - inside the dark crater: rising toward the hidden ice spot, from 0 at 300 m to 100% at its center (`neutron.iceRangeM`). A rover entering at the near edge reads about 50 to 65%.
  - The reading wobbles by up to 3% so the meter looks live. The ice signal needs permanent shadow, so sunlit ground near the crater shows nothing.
  - *(Phase 4)* The meter reads at once when it turns on (no stale or empty reading), then about five times a second.
  - Inside the dark crater, a rover with a neutron spectrometer and no drill sees the hint "Watch the hydrogen meter".
- **The drill gives no hydrogen reading** (built). The drill's hydrogen signal, its tuning flags (`hydrogenSignal`, `hydrogenStrongWithinM`, `hydrogenModerateWithinM`) and the LEND fact on the first reading are removed; the drill only confirms the ice. The LEND fact is not used elsewhere for now; the neutron spectrometer's fact is VIPER's.
- **X-ray spectrometer** (use: 3 energy, 4 s held). Only with a boulder within 3 m of the rover's center, measured to the boulder's surface (`xray.reachM`); elsewhere it is refused with a notice. A hint shows when a boulder is in reach. The reading shows the rock type and its main elements. Each boulder always reads the same rock (placeholder list; see [rover engineering design](rover-engineering-design.md#rock-types-placeholder)); reading the same boulder again says so and is logged once.
  - **Faster in shadow:** below 50% sunlight at the rover (`instruments.shadowSunlight`, the same line as the HUD's "panel in shadow"), the hold is halved (`shadowHoldFactor` 0.5 on the part), with a notice.
  - **The target is locked when the reading starts** *(Phase 4)*: the reading reports the boulder that was in reach at the start, even if the rover was nudged while it worked; if no boulder was recorded, a notice says the reading was lost.
  - **Cold tolerant:** the cold slowdown does not apply (`coldTolerant` on the part), so in permanent shadow without a heater the reading still takes 2 s.
- **Seismometer station** (deploy, 3 s held). Its 4 kg leave the rover when set down: the rover is lighter and a little faster, and its model drops the station, which stays on the ground beside it. At the moonquake, a station on the ground records it and the HUD shows the trace:
  - **clean** if the rover did not drive within 150 m of it (`seismometer.quietDistanceM`) during the 20 s before the quake (`recordWindowSeconds`), counted from when it was set down if later;
  - **noisy** otherwise (a parked rover nearby is quiet);
  - set down after the quake: the notice says there is nothing to record. One record per mission.
  - *(Phase 4)* A station that finishes setting down in the same step as the quake counts as down in time. The set-down notice no longer warns about driving nearby: the "seismometer needs quiet" relationship explains it when it happens (rule 1 of the relationships), and the drive tutorial's seismometer line drops the same warning. The tutorial line gives a timing clue instead, with no lesson in it: the moonquake can come at any time after the first few days, so set the station down early (the game has no clock; the player reads time from the Sun). *(Phase 5)* It happens when the moonquake record comes out noisy, not while the rover drives nearby (see below).
- **Laser retroreflector** (deploy, 3 s held, no energy). It can be set down only where Earth's center is above the terrain horizon from the rover (the same horizon test as the Earth photo, without the camera frame check); otherwise it is refused with a notice. While it is aboard, an "Earth in view / Earth hidden" light shows under the meters. Its 3 kg leave the rover.
- **Mission history:** with the setting on, each new instrument shows one real fact the first time it is used (the neutron spectrometer when first switched on); the credits list the sources. *(Phase 4)* The Apollo seismometer fact now says "more than 11,000 seismic events" (the exact count was not confirmed in the cited report).
- **Station placement:** a station is set down 1.6 m to the rover's left (`instruments.stationOffsetM`).
- **Launch limits:** with six instruments, about 11% of all builds cannot launch (full steel bays with the drill and the bulky parts); the data test's target is now "more than 85% can launch" (was 90%).

**Relationships between parts** *(decided November 15; the Moon set built in Phase 4; the notebook and the review built in Phase 5)*. Parts affect each other and the mission beyond mass and cost: some need another part, work only in certain conditions, interfere with each other, or wear out. Players discover these in the mission, which explains each one as it happens; an engineering notebook collects them across the campaign, and a pre-launch review at the desk flags the ones already discovered. Design and the per-world lists are in [rover engineering design](rover-engineering-design.md#10-relationships-and-consequences).

**Relationships in the mission** *(decided during implementation, Phase 4; built)*. Text and review colors are in `game/data/relationships.json`; when each one happens is code in `game/src/rules/relationships.ts`, keyed by id.

| Relationship | Happens when | Notes |
| --- | --- | --- |
| The neutron spectrometer finds the ice, the drill confirms it | A drill sample finishes inside the dark crater (the shadowed-crater zone), finds **no** ice, on a rover that does **not carry** a neutron spectrometer | One carried but switched off does not count: the rover has the answer aboard. *(Phase 5, lead decision)* A lucky sample that finds the ice does not count: it teaches nothing about searching |
| The seismometer needs quiet ground | *(Phase 5, lead decision)* The moonquake record comes out **noisy** (the rover drove within 150 m of the station while it listened) | The lesson follows the consequence, so a player who drives near the station but moves away in time is not told off. Its notice replaces the short "trace is noisy" line the first time, and names how close the rover came and the quiet distance |
| Cold and dark: in the cold, instruments need the heater | A held use is slowed by the cold (no heater) | *(Phase 5, lead decision)* The lights variant (a photo in permanent shadow without lights) is removed: it could not happen, because a rover without lights stops at the edge of permanent shadow. The entry is now named "In the cold, instruments need the heater" |
| A colder X-ray detector gives sharper readings | An X-ray reading is faster because the rover is in shadow (below 50% sunlight) | Green in the review: the one relationship that helps |
| No lights, no permanent shadow | *(Phase 5, lead decision)* A rover without lights is stopped at the edge of permanent shadow (the existing stop, driving or pushing toward it) | A hard block: red in the review, always shown there for a rover without lights. Since Phase 5 it is also discovered like the others, so it has a notice, a debrief lesson, a notebook entry and a fact (VIPER, NASA's first rover with headlights) |

- **Each notice shows once per mission**, the first time the relationship happens, in its own place under the standing warnings *(Phase 5)*: other notices never push it out, and two lessons at once queue, each shown for its full time (9 s). Later uses get the short line ("working slowly in the cold", "reading finishes sooner", "trace is noisy"), so the player still sees the hold time or the record.
- **The review text has no color word**: the review draws the color from the entry's `review` field.
- **Debrief: "What the rover taught us"** lists each relationship met, in the order met: what happened and why, then the ways to solve it; the real fact and its source only with Mission history on. The relationships met are on the mission result and enter the engineering notebook when the mission ends.
- **Real basis used:** VIPER's neutron spectrometer (the drill step of VIPER's plan is not claimed); Chandrayaan-3's ILSA recording its own rover (ISRO); LRO Diviner's shadow temperatures for cold and dark; VIPER as NASA's first rover with headlights, built to explore dark craters (NASA Science VIPER page, checked in Phase 5) for no lights; Curiosity's APXS cooler (without "in daytime", which was not confirmed).
- **The Diviner fact** *(Phase 5 fact check)*: "as cold as -414 °F (about -248 °C, or 25 K)", from NASA SVS 11230, which gives the Fahrenheit figure; the Celsius and kelvin values are conversions. Paige et al. (2010) is no longer cited for it: its abstract does not give 25 K (it gives about 38 K at the LCROSS site). The "Into the dark" milestone fact uses the same wording and source.

**Engineering notebook and pre-launch review** *(decided during implementation, Phase 5; built)*. Rules in `game/src/rules/relationships.ts` and `rules/campaign.ts`; text in `text.json` → `notebook` and `review`.

- **The notebook** is the campaign's list of relationship ids discovered, in the order discovered (`CampaignState.notebook`). A relationship enters it the moment it is first met in a mission, and a mission's end adds any not yet there, failed or not; a restart keeps it (it is not in the restart snapshot); a new campaign starts it empty. A save from before the notebook loads with an empty one.
- **Opening it:** a "Notebook" button on the title screen (only when a campaign exists), on the desk next to Help, and on the mission HUD next to Help. In the mission the **N** key opens and closes it too, and Escape closes it. It is an overlay that pauses the mission, as the drive tutorial does. The end-of-mission panel has a Notebook button too, so the lessons just met can be read before the debrief; opening it clears the unread dot.
- **In the mission,** a relationship met for the first time enters the notebook overlay at once, marked "New"; the HUD button shows a dot until the notebook is opened. It is also added to the campaign notebook and the campaign save is written at that moment, so a reload or crash mid-run keeps it; only the notebook changes (balance, RP, records and the restart snapshot are not touched), and the mission's end adds the ids again without repeats. The HUD's lesson notices pause while the notebook or the tutorial has the mission paused. While the notebook is open it takes the keyboard: driving keys do nothing and are not held when it closes.
- **An entry** shows the relationship's name, what happens and why, the ways to solve it, and the real fact and its source. The fact shows in the notebook whatever the Mission history setting: the notebook is the reference page. Undiscovered lessons show only as a count ("2 of 5 Moon lessons found"), never by name. The Moon has 5 lessons: the four relationships and no lights.
- **The pre-launch review** is a section of the launch ticket screen, above the purchase. It lists, in data order, the relationships in the notebook that the current build triggers, each marked Fine (green) or Risk (yellow), with the color in words as well (red is only the no-lights hard block, marked Blocked, and its line says the rover stops at the edge of permanent shadow and cannot enter, since a rover that never plans to go there is not broken); plus the no-lights hard block for a rover without lights, discovered or not ("Always checked"). A rover without lights gets only that red line: neither the neutron/drill nor the cold-and-dark line can happen without entering permanent shadow, so they say nothing for it. Nothing undiscovered appears, and a first build shows hard blocks only. It never blocks the purchase.
- **What triggers each line** (a build check per relationship, keyed by id like the mission's checks):

| Relationship | The build triggers it when | Shown as |
| --- | --- | --- |
| Neutron spectrometer finds, drill confirms | The drill is aboard | Yellow without a neutron spectrometer; green ("Solved") with one |
| The seismometer needs quiet ground | The seismometer station is aboard | Yellow |
| Cold and dark | An instrument the cold can slow is aboard: one that holds the rover still and is not cold tolerant (the drill and the two stations; not the camera, which is instant, the neutron spectrometer, a switch, or the X-ray spectrometer) | Yellow without a heater; green ("Solved") with one |
| A colder X-ray detector | The X-ray spectrometer is aboard | Green |
| No lights, no permanent shadow | No lights | Red, always shown |

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
| Regolith sample | Scientific: new information | Drill soil samples at up to three sites, each at least 200 m from the lander and from each other (one reward per site) | Drill |
| Water ice | Scientific: new material, and Record: first discovery | Find and drill the small ice spot inside the dark crater (not marked on the map) | Drill, lights, heater |
| Earth on the horizon | Pretty picture | Photograph a sunlit Earth (at least a quarter lit) from the surface, at least 300 m from the lander. Earth is only visible from the north side of the rim. | Camera |
| Rim panorama | Pretty picture | Photograph the view from a crater rim | Camera |

- The Moon's science choice is the **payload bay**: any mix of up to three (steel) or two (titanium) of the six Moon instruments, or none. The camera earns pictures and imaging science; the drill earns samples and the water ice. *(The four new instruments are built (Phase 3) and record into the debrief's instrument log; their milestones come later, see [rover engineering design](rover-engineering-design.md#7-the-moon-payload).)*
- The Moon has almost no atmosphere, so air samples start on Mars and Titan.

#### How the milestones work *(decided during implementation, Phase 5)*

Rules in `game/src/rules/milestones.ts`; triggers, rewards and text in `game/data/milestones.json`; zone sizes in the `milestones` section of `tuning.json`. Zones come from the `terrain.json` features.

- **Required parts are enforced.** A trigger on a rover without the parts (for example the dark crater without a heater) is not credited, and a notice says which part was missing.
- **Crater descent.** The rover counts as inside when it is more than 150 m below the landing point on the de Gerlache side of the rim (the side the rim viewpoints face), and back out once it climbs above 100 m below landing. The north flank toward the dark crater also drops far below the landing point and does not count.
- **Boulder field.** Each rocky area is a circle of 1.1 times its radius (where the boulders lie). Crossing means leaving at least 90° around the center from where the rover entered; turning back out the same side does not count. A rover that leaves a field short of that angle gets a "Partial crossing" notice, once per field and only until the milestone is earned; `milestones.partialCrossingHint` in tuning switches it off.
- **Into the dark** counts only for the dark crater (its permanent-shadow outline), not the small cold patch in Rocky area 1.
- **Camera (its number key or HUD button; C before the payload bay).** Viewpoint zones are 60 m circles: the two rim viewpoints (Rim panorama) and the de Gerlache wall descent point on the inner wall (Crater layers). The Earth photo has no zone: it counts wherever Earth's center is above the real terrain horizon as seen from the camera and inside the frame, so it works only from the north side of the rim and only facing Earth. Earth must also be at least 25% lit (its phase, from the angle between the Sun and Earth; `earthPhotoMinLit` in tuning). With the decided Sun path (start 75°, subsolar latitude −1.54°), Earth is at least a quarter lit only in the first 26 s, a 37% to 25% crescent, and from about 238 s to the end, up to 55%: about 90 s in all. With the old start (17.4°), the window ran from about 137 s to the end. The photo also counts only at least 300 m from the landing point (`earthPhotoMinDistanceM`, decided November 15), because Earth is in view from the landing at the start and the photo should not be free. It can be earned in the late window at both rim viewpoints and anywhere on the north side 300 m or more from the lander (offline horizon test), so a camera build can plan for it. A photo of a darker Earth, or one taken too close to the lander, goes into the album, with a notice that says why it does not count. A photo is a real capture of the view. Photos can be taken anywhere for the album (up to 12 per mission) but earn milestones only at viewpoints or with Earth in view. The album is shown in the debrief and is not saved between sessions.
- **Drill (its number key or HUD button; F before the payload bay).** The rover must be stopped; drilling takes 3 mission seconds, during which it holds still, and uses 10 energy per sample (the drill part's `useSeconds` and `energyPerUse`, Phase 2). A sample counts only at least 200 m from the landing point (`sampleMinDistanceM`), where the lander's engine plume did not disturb the ground, so there is no free sample at the start. *Balance pass (November 15):* Regolith sample is staged like the Odometer: one reward per sample site, up to three sites, each at least 200 m from the others (`sampleSpacingM`; `sites` on the trigger in `milestones.json`, 1 restores the single sample). A sample at an earlier site still goes in, with a notice that a new site must be 200 m away. This makes the drill a reason to travel, as the camera's viewpoints are.
- **Water ice is found by searching** *(team decision, fix pass)*. The minimap marks the dark crater (the permanent-shadow region), not the ice. The ice spot is a 50 m circle (under 1% of the crater) placed by the terrain pipeline about 100 m inside the shadow edge, on the side facing the landing. It is fully permanently shadowed in the LOLA maps and in the game's own shadow test. A sample there earns Water ice. Anywhere else in the crater the drill reports "No water ice detected at this site." Inside the crater, a drill rover sees a hint to test-drill, never the spot itself. Reaching it needs about 3.2 km of driving.
- **Hydrogen signal** *(decided November 15; replaced in Phase 3)*. Until Phase 3 each drill sample inside the dark crater reported a hydrogen signal (strong within 100 m of the ice, moderate within 250 m, weak farther). It is removed: the clue is now the neutron spectrometer's live meter (see [Moon parts](#moon-parts)), and the drill gives no reading of its own.
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

The Moon build (v1) uses the data below. Sources, formats, and processing are in [rover-engineering/07](research/rover-engineering/07-nasa-data-for-the-game.md) and, for the surface itself, [rover-engineering/08](research/rover-engineering/08-moon-surface-data.md); exact dataset names are in `game/public/terrain/terrain.json` and `texture.json`.

| Data | NASA source | What it changes in play |
| --- | --- | --- |
| Terrain and slopes | LRO laser altimeter (LOLA) 5 m/px site DEM and slope, Site11 (de Gerlache rim) | The map itself; steep slopes cause damage; shadows are computed from the heights |
| Distant terrain | LOLA south polar DEMs, 20 m and 80 m/px (LDEM_80S_20MPP_ADJ, LDEM_80S_80MPP_ADJ), averaged to 50 m and 400 m rings | Real distant mountains on the horizon, such as Malapert massif and Mons Mouton |
| Illumination and permanent shadow | LOLA polar illumination, permanent shadow and Earth visibility maps (85°S, 60 m/px) | Landing site choice; cold zones sit where they really are; the ice spot |
| Ground imagery | LROC NAC de Gerlache Rim low-Sun controlled mosaic, 5 m/px (NAC_ROI_DEGERRIMLO1_P885S2933_5M) | Real ground texture and a real image for the map screen |
| Soil | Apollo 15 Lunar Roving Vehicle measurements (NASA TR R-401) | Sinkage, slip, and slope limits behind "getting stuck" |
| Solar flares | NASA's DONKI space weather database (X-class flares) | Each flare is a real past flare, named with its date and class |
| History facts | NASA and other published sources, cited per fact in `milestones.json` and `text.json` | Optional facts and the credits screen |

Not data files: low Sun and moving shadows and Earth bobbing near the horizon come from polar geometry. The star field is **procedural** (drawn by the game at run time), not NASA SVS star maps. Boulders and fine ground detail are also generated by the game.

**Planned / not in v1.** These were considered and are not used in this build; add them only if they are built in: ShadowCam imagery of the permanently shadowed crater floor; LRO Diviner temperature maps (Diviner appears only as a cited history fact); Moon Mineralogy Mapper (M3) ice-exposure data; Apollo seismometer data for moonquakes; LROC and Chandrayaan-2 boulder counts; NASA SVS Deep Star Maps.

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
| Look *(decided November 15)* | "Mission control" screens: Chakra Petch for headings and labels, IBM Plex Sans for body text, IBM Plex Mono for numbers and readouts (self-hosted). Deep-space navy background and panels with thin cyan-tinted borders and corner brackets; amber is the main accent (primary buttons, money, highlights), cyan the secondary (HUD info and hints); orange-red still means warning and green means good. The title screen shows a live 3D cover: the game's rover on regolith under a low raking Sun with long shadows and Earth low on the horizon, as at the south pole site, with a slow orbiting camera (held still for reduced motion; a plain star background if WebGL is unavailable). The 3D mission view is unchanged. |
| Build preview *(decided November 15)* | The design screen shows the rover being assembled in 3D, live, as in a vehicle editor: part list on the left, a large viewport in the middle, the specification sheet on the right (on narrow screens the viewport becomes a strip above the parts and the sheet). The rover stands on a lit turntable in a dark assembly bay with a faint cyan grid. Only chosen parts appear; empty slots show nothing, and parts chosen before the chassis float where they would mount. A new or changed part drops into place with a brief cyan flash. The turntable turns slowly and the player can drag to rotate it; there are no labels. Reduced motion: no turning by itself and instant swaps. Without WebGL the viewport is hidden and the desk works as before. Presentation only: the preview uses the same model as the mission, and the complete rover looks the same in both. |
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
| Use of NASA data | Real LOLA terrain and sunlight maps, LROC imagery, Apollo 15 soil data, DONKI solar flares, and more; see [NASA data](#9-nasa-data) |
| Educational value | Mechanics built on real science (day lengths, low polar Sun, rare ice, soil limits), plus optional real-history facts such as Pragyan's one-day mission and VIPER and the ice |

How this maps to the judging criteria: [landscape research](research/landscape-precedents-and-judging.md#applying-the-judging-criteria).
