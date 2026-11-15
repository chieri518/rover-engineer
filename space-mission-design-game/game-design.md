# Rover Engineer: Game Design

The working design for **Rover Engineer**, our entry to the Space Mission Design Game challenge. It is written for our team, not for players.

Last updated November 15, 2026. The official brief is in [challenge brief](challenge-brief.md). Background research is in [landscape research](research/landscape-precedents-and-judging.md), [mission-engineering/](research/mission-engineering/README.md), and [rover-engineering/](research/rover-engineering/README.md).

**How to read this doc.** Everything is **decided** unless it is marked *Proposed* (suggested, waiting for a yes or no) or *Open* (not settled yet). All open items are collected in [Open questions](#2-open-questions).

**Mars draft (November 15, 2026, Owner B):** the Mars lesson, site (Jezero crater), time (10 sols, 60 s each), night, cold, events, and milestones are drafted in [The Mars mission](#the-mars-mission). Items the team plan says to decide together are marked for Owner A to confirm.

**Recent changes (November 15, 2026, playtest fixes):** the minimap starts zoomed in and widens as the rover explores, hides unexplored ground and undiscovered sites, and points to orbital survey leads; the map resets on every try; the rover no longer flies over bumps (time-lapse gravity while its wheels are in the air).

**Earlier changes (November 14, 2026):** mission play times shortened to 5 / 10 / 15 minutes; the Moon map is now bigger than one mission can cover; game name, agency, and tone chosen; Moon site (de Gerlache rim), play area size, landing point, NASA datasets, minimap, optional history facts, and mass-based speed decided; no clock; seventh part slot (chassis); launch ticket tiers.

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
| 1 | **Balance numbers.** Money, RP, milestone rewards, death penalties, part costs, masses, and sizes, launch ticket tier prices and limits, minimum budgets, base speed per wheel type and how much mass slows the rover, Odometer distances | The Moon pass rule and money were set in the November 15 balance pass ([Balance: several ways to pass](#balance-several-ways-to-pass)). Keep tuning in playtests. |

**Decided November 15, 2026** (formerly open questions 1a to 1c):

- **1a Sun window:** start azimuth 75° and subsolar latitude −1.54°, both real geometry. This keeps the route and rim viewpoints lit until about 220 to 250 s and removes the Sun passing behind Earth. The rover starts facing azimuth 0° (toward Earth and the dark crater route), where 99% of the ground ahead is lit at the start. See [Sun and shadows](#sun-and-shadows).
- **1b Water ice reach:** the smaller drill (size 3, 8 kg, cost 90) stays. The ice is one optional way to pass the Moon, never required; see [Balance: several ways to pass](#balance-several-ways-to-pass).
- **1c Clue for finding the ice:** the hydrogen signal stays (`milestones.hydrogenSignal`).

### Later: Mars and Titan

| # | Question | Notes |
| --- | --- | --- |
| 2 | Mars and Titan constraints | Mars: energy through day and night, decided by Owner B (Owner A to confirm); see [The Mars mission](#the-mars-mission). Titan: open. |
| 3 | The RP unlock tree | Which parts and map layers unlock, at which thresholds (Owner A) |
| 4 | Mars and Titan random events | Mars: *Proposed:* dust storm and dust devils, marsquake optional. Titan: not discussed. |
| 5 | Mission length in game time | Mars: 10 sols at 60 s each, decided by Owner B (Owner A to confirm). Titan: *Proposed:* 1 Titan day. |
| 6 | Data and communications as a resource? | **Decided:** not on the Moon; a real constraint on Mars, designed later and not in the first Mars build. At the south pole Earth dips below the horizon, which could later become a contact blackout. |
| 7 | Two-player mode | Later |
| 8 | Mars parts, ticket tiers, budget | Owner A: the Mars part catalog (power source, heater, air-sample instrument?), Mars ticket tiers, whether 780 stays the pass mark, and whether Mars ends on "Titan: coming soon" |

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
- **Speed is compressed like time.** 14 days pass in 5 minutes, so driving is sped up too: roughly 4 to 6 times real rover speeds (about 6 m/s for a heavy build, about 13 m/s for a light one on wire-mesh wheels). A light build can just reach the dark crater; a heavy one cannot. To keep the rover grounded at these speeds, it falls about 4 times faster than real lunar gravity (a game-feel choice made during implementation), and 16 times faster while its wheels are off the ground (see [Ride over bumps](#ride-over-bumps)). Measured before the balance pass: a light build (12 m/s) reached the dark crater entry in about 240 s; a heavy one (6 m/s) ends about 1 km short. *Balance pass (November 15):* wire-mesh wheels now model 3.3 m/s of real driving (11.9 km/h, inside the Apollo LRV's 9 to 13 km/h), so a light build drives 13.2 m/s; this keeps the dark crater reachable with good, not perfect, driving. On the design screen, an optional info pop-up next to the speed readout explains real drive speeds, like the optional history facts.
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

#### Ride over bumps

*Decided November 15, 2026 (playtest fix).* At the compressed speeds, crests and boulders threw a light rover into the air. In a physics-only test (the game's own vehicle, terrain and boulders, driven at full throttle over 18 km: the archetype routes, crossings of both rocky areas, and straight drives from the lander), a mesh-wheel build at 13.2 m/s spent 13.7 s in the air, with hops up to 1.6 s long and 2.7 m high.

- **Fix: time-lapse gravity in the air.** A true time-lapse of a real drive at 4 times the speed scales accelerations by 16. On the ground gravity stays at 4 times lunar (`rover.gravityScale`): at 16 the rover could not climb more than about 5°, and grip, slopes and getting stuck would all change. While wheels are off the ground, the rover falls at 16 times lunar gravity (`rover.airGravityScale`, applied in proportion to the share of wheels off the ground), so a hop is as short and low as the same bump would give a real rover at real speed. On the ground nothing changes: top speeds, slopes, grip, climbing, getting stuck and rollover behave as before.
- **Measured on the same 18 km:** time in the air 13.7 s to 2.5 s, longest hop 1.57 s to 0.37 s, highest 2.7 m to 1.0 m. Average speed and the archetype route times are unchanged (the ice route takes 261 s either way). No rollovers and no new places to get stuck. The heavy build (6.8 m/s) spent 1.3 s in the air before and none now.
- **Options tried and rejected:** more gravity on the ground (at 6 times lunar the light rover tilted to 74° on a boulder field, next to the 75° rollover limit, and climbing gets harder); stiffer or more strongly damped suspension (little effect on hops); smoothing the terrain collider (the physics would no longer match the visible ground and the heights the milestones use). An upper limit on upward speed was not needed.
- **Side effect:** a light rover can no longer jump out of the steep inner wall of Rocky area 1's crater on momentum; like heavier builds, it leaves by a gentler side. The archetype routes do not cross the crater's middle.
- **Real basis:** the Apollo Lunar Roving Vehicle did leave the ground briefly over bumps at its 10 to 13 km/h, and the Apollo 16 "Grand Prix" film shows its wheels in the air. The game's remaining hops are of that kind: brief and low.

Real causes of rover loss and survival tactics: [rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#hazard-and-anomaly-catalog) and [rover-engineering/06](research/rover-engineering/06-milestones-and-sustainment.md#how-rover-missions-are-sustained).

## 5. Time on each world

Missions get longer with each destination, and the player should feel that time passes differently on each world.

| Mission | Play time | Game time covered | One local day equals | Day and night |
| --- | --- | --- | --- | --- |
| Moon | 5 min | 14 Earth days (one lunar daylight period) | about 21 s per Earth day | All daylight |
| Mars | 10 min | 10 sols (about 10.3 Earth days); Owner A to confirm | 60 s per sol: 45 s of day, 15 s of night | Day and night every sol; night is time-lapsed three times faster than day |
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

| Archetype | Build | Cost + ticket | Route | Survey leads that start it | Milestones | Final | Without using the instrument |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Camera scout | steel, mesh, fixed panel, NiH2, no lights, no heater, camera | 330 + Medium 120 = 450 | Down the de Gerlache wall (photo), straight up to Rocky area 1, across it, Rim viewpoint 1 (photo), wait there for Earth (photo after 238 s) | Layered wall exposure, then Boulder field (Rim viewpoint 1 appears while crossing) | Crater layers, Crater descent, Boulder field, Rim panorama, Earth, Mapper, Odometer ×3, Flare survivor | 990 (+210) | 740 (fails) |
| Drill geologist | steel, mesh, fixed panel, Li-ion, no lights, no heater, drill | 430 + Medium 120 = 550 | North: Rocky area 1 (sample), across it, Rim viewpoint 1 (sample), Rim viewpoint 2 (sample) | Boulder field (any third site 200 m on counts; Rim viewpoint 2 is found by driving) | Regolith ×3, Boulder field, Mapper, Odometer ×3, Flare survivor | 880 (+100) | 580 (fails) |
| Ice hunter | titanium, mesh, fixed panel, Li-ion, lights, heater, drill | 615 + Medium 120 = 735 | Straight to the dark crater, sample at the edge, find and drill the ice (about 293 s) | Permanent shadow | Water ice, Regolith ×2, Mapper, Odometer ×3, Clean run, Flare survivor | 895 (+115); 545 if the ice is not found | 345 (fails) |

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

**Browser re-check after the playtest fixes** (November 15: exploring minimap with fog and survey leads, and time-lapse gravity in the air; headless Chrome, real game flow, the same autopilot, starting each time from an unexplored map):

| Run | Result in the browser | Final | How the route is found on the fogged map |
| --- | --- | --- | --- |
| Camera scout | survived; Crater layers, Crater descent, Rim panorama, Earth, Odometer ×3, Clean run, Flare survivor (this route's crossing does not count as Boulder field) | 880, passes | Wall: lead 1. Boulder field: lead 2. Rim viewpoint 1 appears on the map while driving to the field. |
| Drill geologist (wide crossing) | survived; Regolith ×3, Boulder field, Odometer ×2, Clean run, Flare survivor | 870, passes | Boulder field: lead 2, found at 9 s. Rim viewpoint 1 found at 24 s. Rim viewpoint 2 has no lead and showed up about 250 m before arrival. |
| Drill geologist (older north route) | survived; no Boulder field (the autopilot's crossing is not credited, as before the fixes) | 740, fails | |
| Ice hunter, two runs | survived both; crater edge at 259 s and 264 s, ice drilled at 285 s and 291 s, 16 and 36 energy left; the second run missed Into the dark | 895 and 845, both pass | Permanent shadow: lead 3 the whole way; the crater was found about 200 m before its edge. |
| Idle | survived at the lander | 510, fails | |
| Random wanderer (titanium, solid, panel, Li-ion, lights, heater, camera) | survived; Rim panorama, Crater layers, Odometer ×2, Clean run, Flare survivor | 555, fails | |

- The ice stays the tight path: the two runs differed by 5 s and 50 money.
- The camera scout's first runs ended at 710: the autopilot stopped to recharge at 12% energy when it reached Rim viewpoint 1 at about 285 s and missed both photos. A player takes the photos first; the run that did so passed with 880. No money was retuned.
- Hops in these runs: at most one hop of 0.26 m per run, 0.1 s long. No rollovers, no rover stuck.
- Map reset confirmed: the wanderer found 3 sites on its first try. After Restart round, the second try started with no sites found and all three leads open.

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

Seven slots, two options each. For lights and heater, one option is **None**: skipping them saves cost, mass, and size (maybe a cheaper ticket) but closes off the dark crater. All Moon parts are available from the start, so budget, mass, and size are the only limits. Locked parts first appear on Mars, greyed out with "needs X RP".

**Empty start** *(decided November 15)*. In a new campaign the design screen starts with all seven slots empty, so there is no default build to copy. The rover can go to the launch ticket only once every slot has a part; "No lights" and "No heater" count as choices. While slots are empty, the specification sheet shows the totals of the parts chosen so far, a dash for driving numbers that need a missing part, and a warning listing the empty slots. A restart keeps the last design, so the player can adjust it.

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
| Minimap | Simple, and built for exploring: it starts zoomed in on the lander and widens as the rover explores; unexplored ground is hidden and sites appear only once discovered; orbital survey leads give bearings, not markers. See [Minimap and exploration](#minimap-and-exploration). Orbital data layers unlock later with RP. |

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

### Minimap and exploration

*Decided November 15, 2026 (playtest fix).* The first minimap showed the whole 8 km area under a light fog, with every crater and viewpoint marked from the start, so players saw every site at once and had little reason to explore. Now the map grows with the rover's own survey.

- **Zoom.** The map starts zoomed in on the lander, about 700 m across (`minimap.startSpanM`). It widens smoothly to fit everything explored so far, and each discovered site whole (the dark crater is larger than the reveal circle), plus a 100 m margin (`minimap.marginM`), so the rover always has some ground around it. It never zooms back in during a mission; a long drive north ends with a map a few kilometers across.
- **Fog.** Unexplored ground is hidden. The rover reveals a circle around itself on the same 20 m grid the Mapper milestone counts (`explore`), so Mapper is unchanged. *Reveal radius kept at 250 m* (`explore.revealRadiusM`): every site is hidden at the start (the nearest, Rim viewpoint 1 and Rocky area 1, are about 490 m away), the ground ahead still shows at driving speed, and Mapper's 1.8% and the balance model stay valid.
- **Sites appear when discovered.** Viewpoints, rocky areas (boulder fields), the de Gerlache wall descent point and the dark crater's outline are drawn only once the rover's reveal circle touches them: the 60 m viewpoint or wall zone, the boulder spread (1.1 times the crater radius), or the crater's permanent-shadow outline. A notice names each newly found site. The lander is always shown. The ice spot is never marked.
- **Bearings, not markers: orbital survey leads.** The landing briefing lists three leads from orbital data, each a rough direction and distance from the lander. Real missions plan their drives on orbital maps the same way; NASA planned VIPER's routes on Lunar Reconnaissance Orbiter elevation and illumination data.
  - While a lead's area is undiscovered, an arrow on the minimap's edge points from the rover toward the area's center, and a list under the minimap gives its current direction and distance. Once the rover discovers the area, the arrow goes and the site itself appears.
  - Leads point to areas, not exact spots: the direction is one of 16 compass points and the distance is rounded (to 0.1 km below 1 km, to 0.5 km above) and measured to the near edge of the area.
  - Each winning archetype has a starting direction:

| Lead | Orbital source | Area | From the lander | Starts |
| --- | --- | --- | --- | --- |
| Layered wall exposure | LROC images | de Gerlache wall descent | about 0.7 km south-southwest | Camera scout: Crater layers, Crater descent |
| Boulder field | LROC images | Rocky area 1 | about 0.3 km west-northwest | Drill geologist and camera scout: Boulder field, samples. Rim viewpoint 1 is about 280 m beyond the field's center, so it shows up while crossing. |
| Permanent shadow | LOLA illumination maps | the dark crater | about 3 km north | Ice hunter |

  - Rim viewpoint 2 and Rocky area 2 have no lead; they are found by driving. The leads, the rounding and the area sizes are in `survey` in `tuning.json`; their text is in `text.json` → `survey`.
- **Map memory: reset each try.** Every mission starts with an unexplored map, including a restart after a failed round. The explored area and discovered sites are not saved, which matches the restart snapshot rule: a restarted round starts as new. The leads stay the same on every try.

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

- The Moon has one instrument slot, so **camera or drill** is the Moon's science choice. The camera earns pictures and imaging science; the drill earns samples and the water ice.
- The Moon has almost no atmosphere, so air samples start on Mars and Titan.

#### How the milestones work *(decided during implementation, Phase 5)*

Rules in `game/src/rules/milestones.ts`; triggers, rewards and text in `game/data/milestones.json`; zone sizes in the `milestones` section of `tuning.json`. Zones come from the `terrain.json` features.

- **Required parts are enforced.** A trigger on a rover without the parts (for example the dark crater without a heater) is not credited, and a notice says which part was missing.
- **Crater descent.** The rover counts as inside when it is more than 150 m below the landing point on the de Gerlache side of the rim (the side the rim viewpoints face), and back out once it climbs above 100 m below landing. The north flank toward the dark crater also drops far below the landing point and does not count.
- **Boulder field.** Each rocky area is a circle of 1.1 times its radius (where the boulders lie). Crossing means leaving at least 90° around the center from where the rover entered; turning back out the same side does not count. A rover that leaves a field short of that angle gets a "Partial crossing" notice, once per field and only until the milestone is earned; `milestones.partialCrossingHint` in tuning switches it off.
- **Into the dark** counts only for the dark crater (its permanent-shadow outline), not the small cold patch in Rocky area 1.
- **Camera (C key).** Viewpoint zones are 60 m circles: the two rim viewpoints (Rim panorama) and the de Gerlache wall descent point on the inner wall (Crater layers). The Earth photo has no zone: it counts wherever Earth's center is above the real terrain horizon as seen from the camera and inside the frame, so it works only from the north side of the rim and only facing Earth. Earth must also be at least 25% lit (its phase, from the angle between the Sun and Earth; `earthPhotoMinLit` in tuning). With the decided Sun path (start 75°, subsolar latitude −1.54°), Earth is at least a quarter lit only in the first 26 s, a 37% to 25% crescent, and from about 238 s to the end, up to 55%: about 90 s in all. With the old start (17.4°), the window ran from about 137 s to the end. The photo also counts only at least 300 m from the landing point (`earthPhotoMinDistanceM`, decided November 15), because Earth is in view from the landing at the start and the photo should not be free. It can be earned in the late window at both rim viewpoints and anywhere on the north side 300 m or more from the lander (offline horizon test), so a camera build can plan for it. A photo of a darker Earth, or one taken too close to the lander, goes into the album, with a notice that says why it does not count. A photo is a real capture of the view. Photos can be taken anywhere for the album (up to 12 per mission) but earn milestones only at viewpoints or with Earth in view. The album is shown in the debrief and is not saved between sessions.
- **Drill (F key).** The rover must be stopped; drilling takes 3 mission seconds, during which it holds still. A sample counts only at least 200 m from the landing point (`sampleMinDistanceM`), where the lander's engine plume did not disturb the ground, so there is no free sample at the start. *Balance pass (November 15):* Regolith sample is staged like the Odometer: one reward per sample site, up to three sites, each at least 200 m from the others (`sampleSpacingM`; `sites` on the trigger in `milestones.json`, 1 restores the single sample). A sample at an earlier site still goes in, with a notice that a new site must be 200 m away. This makes the drill a reason to travel, as the camera's viewpoints are.
- **Water ice is found by searching** *(team decision, fix pass)*. The minimap marks the dark crater (the permanent-shadow region), not the ice. The ice spot is a 50 m circle (under 1% of the crater) placed by the terrain pipeline about 100 m inside the shadow edge, on the side facing the landing. It is fully permanently shadowed in the LOLA maps and in the game's own shadow test. A sample there earns Water ice. Anywhere else in the crater the drill reports "No water ice detected at this site." Inside the crater, a drill rover sees a hint to test-drill, never the spot itself. Reaching it needs about 3.2 km of driving.
- **Hydrogen signal** *(decided November 15)*. Each drill sample inside the dark crater adds a reading to its notice:
  - "Hydrogen signal: strong" within 100 m of the ice spot's center, "moderate" within 250 m, "weak" farther away. A rover entering at the near edge reads "moderate".
  - Samples outside the crater give no reading. The numbers are `hydrogenStrongWithinM` and `hydrogenModerateWithinM` in tuning, and `hydrogenSignal: false` turns the clue off.
  - With Mission history on, the first reading of a mission adds one real fact (`text.json` → `drill`): LRO's LEND neutron detector maps polar hydrogen from orbit the same way.
- **Reaching the ice** *(measured before the November 15 balance pass)*. The cheapest ice build costs 735 on the Medium ticket: titanium, mesh wheels, fixed panel, lithium-ion, lights, heater, drill. It is also the only one under the 750 budget that reaches the ice.
  - Flat-speed simulation on the real route (3.3 km): arrives at 275 s, drill done at 278 s, 5% energy left.
  - Real browser drive: ice zone at 277 s, drilled at 287 s, survived with 47 energy, after a flare and a moonquake.
  - The ice is reachable, with about 20 s to search. With the old Sun start (17.4°), the same build runs out of energy at about 250 s.
- **Mapper** is 1.8% of the map, counted on the explored grid; the minimap's zoom and fog are display only (see [Minimap and exploration](#minimap-and-exploration)). Measured in playtests with full-throttle drives: a light build drove 3.2 km and revealed 2.8% (Mapper at about 2.2 km); the default build drove 2.0 km before its battery ran out and revealed 1.84%. The share grows about 0.77% per km of new ground.
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

- **Mars** adds day and night, which brings in the lights-on or sleep choice. See [The Mars mission](#the-mars-mission).
- **Titan** is always cold.
- Each world has its own random events.

### The Mars mission

*Owner B draft, November 15, 2026.* Items marked decided were decided by Owner B on November 15. The lesson and the mission length are joint decisions in [team-plan.md](team-plan.md#decide-together), so Owner A still needs to confirm them. *Proposed* items are suggestions. Mars parts, unlock tree, ticket tiers and budget belong to Owner A (question 8). Rewards and rates marked "interface" are set together.

**Lesson: energy through day and night.** *Decided (Owner A to confirm).* The Moon teaches mass versus cost. Mars adds a sunlight budget that changes every sol: the Sun sets, nights are cold, and dust dims the panels. Every Mars constraint hangs off this lesson: the night (lights on or sleep), the night cold (the heater), dust and dust storms (solar income), and, through Owner A's part list, solar panels versus a radioisotope power source. Mass versus cost still applies.

| Element | Design |
| --- | --- |
| Length | 10 minutes of play covering 10 sols |
| Site | Jezero crater floor, east of the ancient river delta |
| Day and night | 45 s of day and 15 s of night every sol |
| Cold | Every night, everywhere on the map |
| Events | *Proposed:* one dust storm, dust devils |
| Core puzzle | Getting through the night: battery, power source, heater, lights |
| Communications | A real Mars constraint, designed later; not in the first Mars build |

#### Site: Jezero crater

*Decided:* one fixed site, the one with the clearest and widest data. That is Jezero, where Perseverance landed in 2021.

- **Why Jezero.** USGS made a single seamless 1 m HiRISE elevation model of the landing area for Mars 2020's Terrain Relative Navigation: about 21 km × 21 km (21,400 × 21,488 px, 1.8 GB), all from HiRISE stereo and tied to MOLA. It comes with a 25 cm HiRISE image mosaic and a 20 m CTX elevation model around it. All are public domain and on the [USGS Mars 2020 TRN data release](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic). Gale's merged 1 m elevation model covers a bigger box (about 57 km × 33 km), but it uses HiRISE only where stereo exists and fills the rest with CTX, HRSC and MOLA, so detail is uneven.
- **Detailed play area.** *Proposed:* 8 km × 8 km at 5 m, resampled from the 1 m model. This is the Moon's size and format, so the terrain pipeline and the loader carry over.
- **Distant terrain.** The rest of the HiRISE model, then CTX 20 m, then MOLA, so the rim of the 45 km crater rings the horizon. From rover camera height the Mars horizon is about 3.4 km away.
- **Ground imagery.** The HiRISE 25 cm mosaic, resampled.
- **Landing point.** *Proposed:* a flat spot on the crater floor near Perseverance's 2021 landing site (Octavia E. Butler Landing, 18.4447°N, 77.4508°E), picked by the pipeline from the real slope map, with the delta front and Séítah inside the play area. REL lands near the site, not on it.
- **Sites to place** (*Proposed*; the pipeline measures the distances): the delta front, whose layered cliffs record an ancient lake; Séítah, a ridged rock unit with sand ripples (soft ground); and rocky areas on the crater floor (boulder fields, as on the Moon).
- **Soft ground.** The sand ripples use the Moon's sinkage and slip rules. Spirit was stuck in sand at "Troy" in 2009 ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#terrain-sand-rocks-slopes)).
- **Season.** *Proposed:* early northern autumn (Ls about 200), the start of the dust storm season, so a storm is realistic. At 18°N, day and night are close to equal then.

#### Time: 10 sols in 10 minutes

*Decided (Owner A to confirm the length).* This replaces the earlier proposal of 20 sols at 30 s: 20 nights of 15 s would ask the lights-on-or-sleep question every 30 seconds.

- **60 s per sol:** 45 s of day (dawn to dusk), then 15 s of night. Night is time-lapsed three times faster than day. Like the Moon's speed compression, this is a game-feel choice: real rovers sleep through most of the night. Night adds up to 150 s per mission.
- **The player sits through the night.** There is no skip.
- **No clock,** as on the Moon. The Sun follows the real path for Jezero's latitude and the chosen season.

#### Night: lights on or sleep

*Decided:* the player sits through each night and chooses between:

- **Lights on:** keep driving and earning, but the lights and heater drain the battery fast and there is no solar income.
- **Sleep:** *Proposed:* the same power-down toggle (P) the Moon uses for flares. Energy drains slowly and no milestones are earned. The rover wakes at dawn by itself.
- **No lights:** *Proposed:* the rover cannot drive at night. It can only sleep or sit still, the same rule as the Moon's permanent-shadow edge.
- At dusk a notice reads: "Sunset. Lights on to keep driving, or sleep until dawn." An empty battery at night ends the mission as out of energy, the Moon rule.

#### Cold at night

*Decided:* the heater matters on Mars. Nights reach about −70 to −90 °C ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#atmosphere-temperature-and-wind)).

- *Proposed:* every night, the freeze meter rises everywhere on the map (the Moon's cold-zone rule, applied map-wide) and recovers by day. An unheated rover freezes before its first dawn; a heater slows freezing enough to last the night. So a heater is effectively needed on Mars, and the trade becomes which heater: for example, radioisotope units (mass and cost) or an electric heater that draws on the battery at night (Owner A).
- *Proposed:* freezing is slower during the dust storm, because airborne dust keeps nights milder (JPL, 2018 storm).
- Interface: the freeze rate per night (Owner B) against heater strength and draw (Owner A).

#### Dust and events

All *Proposed*. Solar flares and moonquakes stay on the Moon.

| Event | What happens | Player response | Real basis |
| --- | --- | --- | --- |
| Dust on the panels | Solar income falls a little every sol as dust settles (compressed, as time is) | Plan for less power later, or rely on a radioisotope source | Dust settles steadily on real panels ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#dust-devils-and-cleaning-events)) |
| Dust storm | One regional storm per mission, announced a sol ahead by an orbital weather report. For about 2 sols solar income falls to about a third, nights are milder, and more dust settles. | Charge up beforehand, sleep through it, drive less | 2018: Opportunity's power fell from 645 Wh to 22 Wh per sol in 10 days. MRO's MARCI camera maps Mars weather daily. |
| Dust devil | A random devil sweeps past and cleans the panels | A free power boost; a camera can photograph it | Spirit's power jumped about 50% in one day in 2005 |
| Marsquake (optional) | The Moon's quake rule reused | As on the Moon | InSight recorded marsquakes, including a magnitude 4.7 in 2022 |

#### How the Mars rules work *(decided during implementation, M3)*

The rules are in `game/src/rules/` (`sol.ts`, `marsSun.ts`, `storm.ts`, and the Mars parts of `energy.ts`, `cold.ts`, `mission.ts`). The numbers are in `game/data/mars/tuning.json` (`sol`, `night`) and `events.json` (`duststorm`). All numbers are placeholders, tuned against the Moon parts.

- **Sol clock and Sun.** The mission starts at sunrise on sol 1. The Sun follows real local solar time at Jezero:
  - Solar declination is sin δ = sin 25.19° × sin Ls (Mars24). It is −8.4° at Ls 200, and the season moves on 0.6° of Ls per sol.
  - The Sun rises at azimuth about 99°, is due south at 63° elevation at noon, and sets at about 261°.
  - Within each day and each night, the clock eases the Sun's speed: about a quarter of its mean day speed at the horizon, faster at noon and midnight. So 0 to 10° of elevation lasts about 5.5 s at sunset, and twilight (0 to −8°) about 3.5 s. This gives the blue sunset look and photo time. Day stays 45 s and night 15 s.
- **Solar income on Mars:**
  - The Moon's shadow test (sunlight).
  - Times a low-Sun factor: full rate with the Sun at 15° or higher, sin(el) / sin 15° below that. A fixed panel earns about 36 per clear sol.
  - Times the storm factor.
  - Nothing at night.
- **Night energy.** Battery drain per second of night, on top of driving:
  - 4 awake with lights on (lights and electronics). A parked night costs 60.
  - 1 awake without lights (electronics only; the rover cannot drive).
  - 0.2 asleep: P powers down, as on the Moon.
  - Sleep ends at dawn by itself. An empty battery ends the mission as out of energy. The radioisotope heater draws no power. An electric heater that draws power at night would come with Owner A's Mars parts.
- **No lights, no night driving.** A rover without lights cannot drive at night (`night.driveWithoutLights` false).
- **Night cold:**
  - The freeze meter rises 8 per second everywhere at night. Without a heater, the rover freezes 12.5 s into its first 15 s night, even asleep.
  - The radioisotope heater takes off 1.5 per heat unit (the Moon value), so it rises 5 per second and reaches 75 of 100 by dawn.
  - It recovers 6 per second by day.
  - During the storm, freezing is multiplied by down to 0.5.
- **Dust storm:**
  - It starts at a random time in sols 4 to 7 (180 to 360 s), is forecast 60 s (one sol) ahead and lasts 120 s (two sols).
  - It builds up and dies down over 10 s.
  - At full strength, solar income is ×0.33 and night freezing ×0.5.
  - Real basis: in the 2018 global storm, Opportunity's power fell from about 645 to 22 Wh per sol, and the dust absorbed heat and narrowed its temperature swings (Planetary Society, JPL).
- **Night-energy check** (`marsNight.test.ts`, stands in for a Mars `winPaths`). Over 8 storm seeds:
  - A cheap build (fixed panel, small battery) survives all 10 sols when it sleeps at night and drives by day above a 30% reserve, covering about 2 km. A big-battery build also survives, and so does a light build (mast, mesh wheels), at about 5 km.
  - The cheap build runs out by sol 4 if it drives with lights every night, and by sol 6 if it only parks with lights on.
  - One night of driving with lights is affordable.
  - With the Moon parts, the heater is effectively required. The heater choice becomes real only with Owner A's Mars catalog.

#### Mars milestones

All *Proposed*. Rewards are interface numbers. Every real fact gets fact-checked before it goes into `text.json`.

| Milestone | Category | How to earn it | Equipment |
| --- | --- | --- | --- |
| Touchdown | Record: first touch | Land on Mars for the first time | None |
| Odometer | Capability: coverage | Drive set distances | None |
| Mapper | Capability: coverage | Reveal a set share of the map | None |
| Sand crossing | Capability: difficulty | Cross Séítah's sand ripples without getting stuck | None |
| Night drive | Capability: robustness | Drive a set distance at night | Lights, heater |
| Storm survivor | Capability: robustness | Still be running when the dust storm clears | None |
| Clean run | Capability: robustness | Finish all 10 sols without damage | None |
| Delta layers | Scientific: historical formation | Image the layered delta front | Camera |
| Lake sediment sample | Scientific: new information | Drill samples at up to three sites, at least 200 m apart (Moon rule) | Drill |
| Signs of an ancient lake | Record: first discovery | The first sample drilled at the delta front | Drill |
| Blue sunset | Pretty picture | Photograph the Sun setting (Martian sunsets look blue; Curiosity, 2015) | Camera |
| Dust devil | Pretty picture | Photograph a passing dust devil | Camera |

- Air samples start on Mars (Moon milestones), but they need an instrument from Owner A's catalog, so they wait for question 8.
- Survey leads, fog and discovery work as on the Moon ([Minimap and exploration](#minimap-and-exploration)). New leads would point to the delta front, Séítah and a rocky area.

#### Communications

*Decided:* data and communications are a real constraint on Mars: delay to Earth, bandwidth through relay orbiter passes, and possibly science that counts only once it is sent home. It is a design decision for now and is not built in the first Mars version.

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
