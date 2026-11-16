# Rover Engineer: Game Design

The working design for **Rover Engineer**, our entry to the Space Mission Design Game challenge. It is written for our team, not for players.

Last updated November 15, 2026 (story context decided: a Welcome to REL intro, per-world site context and short campaign beats, [§3](#3-campaign-the-outer-loop) and [§11](#11-identity-and-presentation); earlier the same day, all six phases of the payload bay and relationships plan were built). The official brief is in [challenge brief](challenge-brief.md). The catalog of rover components, instruments, and how they constrain each other is in [rover engineering design](rover-engineering-design.md). Background research is in [landscape research](research/landscape-precedents-and-judging.md), [mission-engineering/](research/mission-engineering/README.md), and [rover-engineering/](research/rover-engineering/README.md).

**How to read this doc.** Everything is **decided** unless it is marked *Proposed* (suggested, waiting for a yes or no) or *Open* (not settled yet). All open items are collected in [Open questions](#2-open-questions).

**Titan draft (November 15, 2026, Owner B):** the Titan lesson (a steady power budget in the deep cold), site (Shangri-La dunes near Selk), time (one Titan day in 15 minutes), cold, rainstorm, milestones and campaign end are drafted in [The Titan mission](#the-titan-mission). Titan parts wait for Owner A.

**Mars draft (November 15, 2026, Owner B):** the Mars lesson, site (Jezero crater), time (10 sols, 60 s each), night, cold, events, and milestones are drafted in [The Mars mission](#the-mars-mission). Items the team plan says to decide together are marked for Owner A to confirm.

**Moon sites and milestones (November 15, 2026, decided; built: data, rules, world placement, HUD and debrief (Phases 2 to 5), balance tuned by hand (Phase 6)):** 12 new Moon milestones so that every Moon instrument earns something (two of them combos), Boulder field and Mapper repriced, new sites near the lander (three young craters, cold traps, a rolled boulder, a hidden hydrogen spot), a fourth survey lead, rock suites by site, and three new archetypes as balance targets. Recorded in Phase 0 of the [Moon sites and milestones plan](moon-sites-and-milestones-plan.md), whose open questions M1 to M15 the team decided as proposed. Small details settled while writing them down are marked "decided in Phase 0". Rewards and distances in these sections are **starting values for the balance model**; Phase 6 sets the final ones.

**Mars engineering, sites and milestones (November 15, 2026, decided in Phase 0; built in Mars steps 1 to 8, November 15 and 16, on `aon/mars-engineering`; the Owner B items stay provisional, for Chieri's review; a [Mars playtest checklist](mars-playtest-checklist.md) is ready to run):** a Mars part catalog (each part says which worlds offer it), a power model in which the lights, the electric heater and the RTG own their draws, support hardware (robotic arm and mast), four new Mars instruments and a night budget line on the desk, four Mars lessons, 20 new Mars milestones so that every Mars instrument earns something, new sites in three clusters on the Jezero map, and six Mars rock types. Recorded in Phase 0 of the [Mars rover engineering plan](mars-rover-engineering-implementation-plan.md) (its decisions are cited here as **Mars M1 to M19**, to keep them apart from the Moon plan's M1 to M15) and the [Mars sites and milestones plan](mars-sites-and-milestones-plan.md) (MS1 to MS15). All numbers are **indicative starting values**: Mars rewards, budget requirements and the pass test are left to a later balance patch (Mars M13, MS1), and Mars has no `winPaths` model (MS13). The user decided that we build the Owner B items ourselves: dust and dust devils, Mars hydrogen, site placement and the Mars terrain pipeline requests, and changes to the built Mars milestones are marked **provisional, for Chieri's review**. The Mars ticket tiers are *Decided* (the user approved the draft on November 15, Mars M12).

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
| 2 | Mars and Titan constraints | Mars: energy through day and night, decided by Owner B and confirmed for Owner A in Phase 0 of the Mars plans (November 15), which build the Mars desk on it; see [The Mars mission](#the-mars-mission). Titan: a steady power budget in the deep cold, decided by Owner B (Owner A to confirm); see [The Titan mission](#the-titan-mission). |
| 3 | The RP unlock tree | Which parts and map layers unlock, at which thresholds (Owner A). Until it is decided, every Mars part is offered from the start (Mars M10). |
| 4 | Mars and Titan random events | Mars: **decided** (November 15): one dust storm (built), dust on the panels and dust devils (provisional, for Chieri's review; see [Dust and events](#dust-and-events)); the marsquake waits for a later wave. Titan: *Proposed:* one methane rainstorm. |
| 5 | Mission length in game time | Mars: 10 sols at 60 s each, decided by Owner B and confirmed for Owner A in Phase 0 of the Mars plans. Titan: 1 Titan day in 15 min, decided by Owner B (Owner A to confirm). |
| 6 | Data and communications as a resource? | **Decided:** not on the Moon; a real constraint on Mars, designed later and not in the first Mars build. At the south pole Earth dips below the horizon, which could later become a contact blackout. |
| 7 | Two-player mode | Later |
| 8 | Mars parts, ticket tiers, budget | **Parts decided for the first Mars wave** (November 15; see [Mars rover design](#mars-rover-design)); no air-sample instrument in it. **Ticket tiers:** Mars gets its own (Mars M12), *Decided* November 15 ([Mars ticket tiers](#mars-ticket-tiers-decided)): the Moon's three plus Heavy. **Budget:** the Mars minimum stays 780 and the Titan pass mark stays 800 until the balance patch (MS1). After Mars the campaign goes on to Titan. Owner A: the Titan part catalog (radioisotope power source, insulation, organics instrument?). The demo plays Titan with the Moon parts (the Moon's catalog and ticket tiers, none of the Mars-only parts) until Owner A decides. |

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
- **New campaign vs Continue** *(decided November 15)*. Start new campaign (the title, and the button on Campaign complete) resets everything: progress, balance, records, round stats, the notebook, the design on the desk, and the "tutorials seen" flags of every world, so a player who starts over after a full run sees all tutorials again. Continue campaign keeps all of it, skips tutorials already seen, and resumes at the current mission. A round restart (any world) is not a new campaign and does not reset tutorials. Settings are kept.

**Welcome to REL intro** *(decided November 15, 2026)*. Start new campaign opens a short intro before the first Moon design desk: who the player is, what REL is, why each mission must earn back its cost, and the three worlds ahead. It is skippable, and it is the only new screen; the loop and its rules are unchanged. It follows the "tutorials seen" rules: every Start new campaign shows it, and Continue campaign and a round restart never do. Plan: [story-onboarding-plan.md](story-onboarding-plan.md). Copy: [story-copy.md](story-copy.md). *Decided during implementation:* the intro is laid out as the tutorial card (same look, its own screen, not a modal over the desk), and `**text**` in its copy is shown bold; with the mission kicker moved to `story.kicker`, the Moon landing screen shows "Mission 1 · The Moon, de Gerlache rim" too, like Mars and Titan.

## 4. Mission: the inner loop

```
Drive ──► Reach milestones ──► Earn RP and money
  │
  └─ while managing: energy · damage · cold · soft ground · random events
```

- **Driving uses energy.** Heavier rovers use more energy per meter.
- **Speed depends on the configuration.** The wheels set a base speed, and a heavier rover is slower. A heavy rover reaches fewer places in the mission time.
- **Speed is compressed like time.** 14 days pass in 5 minutes, so driving is sped up too: roughly 4 to 6 times real rover speeds (about 6 m/s for a heavy build, about 13 m/s for a light one on wire-mesh wheels). A light build can just reach the dark crater; a heavy one cannot. To keep the rover grounded at these speeds, it falls about 4 times faster than real lunar gravity (a game-feel choice made during implementation), and 16 times faster while its wheels are off the ground (see [Ride over bumps](#ride-over-bumps)). Measured before the balance pass: a light build (12 m/s) reached the dark crater entry in about 240 s; a heavy one (6 m/s) ends about 1 km short. *Balance pass (November 15):* wire-mesh wheels now model 3.3 m/s of real driving (11.9 km/h, inside the Apollo LRV's 9 to 13 km/h), so a light build drives 13.2 m/s; this keeps the dark crater reachable with good, not perfect, driving. On the design screen, an optional info pop-up next to the speed readout explains real drive speeds, like the optional history facts. *Generous pass (November 15, after the user's playtest):* compression 4 → 6, so a light build drives about 19.8 m/s and the slowest about 11; see [Generous pass](#generous-pass-november-15-2026-after-the-users-playtest).
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
- **Damage.** A hard impact (a sudden change in the rover's velocity of 3 m/s or more, such as hitting a boulder) does 8 plus 4 per extra m/s. Driving on ground steeper than 20° (`slope.png`) does 4 per second. An overloaded frame does 0.05 per kg over its maximum load per second while driving. Each moonquake does 10. A flare that hits an unprotected rover does 20 plus 2.5 per X above X1 (`events.json`): about 26 for an X3.3 flare and 41 for an X9.3. Boulders are scattered in the two rocky areas (small fresh craters). *(Decided November 15, not built yet:)* also at the three young craters, plus the one rolled boulder; see [Map](#map).
- **Rollover** is a tilt beyond 75° held for 0.6 s.
- **Cold.** Cold zones are the permanent-shadow patches of the dark crater and of the small cold patch in Rocky area 1; other tiny shadowed spots are left out. *(Decided November 15; built in Phase 4:)* the East and South cold traps join them (see [Rules for the new milestones](#rules-for-the-new-milestones)). Inside, the freeze meter rises 4 per second (full after 25 s), slowed by 1.5 per heat unit of the heater (radioisotope units: full after 100 s). Outside it recovers 6 per second.
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
| Titan | 15 min | 1 Titan day (about 16 Earth days) | The whole day: 450 s of light, then 450 s of dark; the mission starts 150 s after sunrise | Always cold; one long day and one long night |

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

Amounts are game values for balancing, not real costs. The game does not show a note saying so (removed November 15).

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

*Decided November 15, 2026 (balance pass).* This section is the Moon's. Mars balance (hand estimates against the Titan mark, no `winPaths`) is in [Balance on Mars](#balance-on-mars).

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

*(Decided November 15, Moon sites and milestones; in the data since Phase 3:)* Mapper 60 → **40** and Boulder field 100 → **60**, now that instruments earn their own way; see [Balance with the Moon sites and milestones](#balance-with-the-moon-sites-and-milestones).

Moon minimum (520), starting budget (750), part costs, ticket tiers, death penalties and RP are unchanged. The restart loop is unchanged: a restart restores the round snapshot (750), which is above the Moon minimum. Instruments now earn real money, so the camera's pictures and the drill's samples pay more than the categories table above suggests ("mainly RP", "a little money"). Survival alone is worth little; staying alive matters because dying forfeits it and costs a penalty on top.

**How it was checked** *(the model is retired since Phase 6 of the Moon sites plan; balance is now tuned by hand, see [Balance with the Moon sites and milestones](#balance-with-the-moon-sites-and-milestones))*. `src/rules/winPaths.ts` (pure, unit-tested) drives every build along route plans with the real mission rules: energy, solar income from the real lit share of each leg over time, cold, overload, soft-ground slip at boulder fields, and two flares (the player powers down for 8 s each). Drive legs between the milestone sites were measured once on the real terrain (least-cost routes on a 10 m grid, slopes up to 18°) and are stored with the plans in `game/data/balance.json`, which the game does not load. "Reasonable play" means driving at 90% of top speed, recharging in sunlight before a leg the battery cannot cover with a 10% reserve, and touching a rock when crossing a boulder field (so no Clean run there; real drives often keep it). `winPaths.test.ts` holds the targets: idling fails for every build by more than 100; wandering, or one or two short stops near the lander, fails for every build; at least three archetypes with different parts and routes, using both instruments, pass with a margin of at least 50; each archetype fails if it skips its instrument; fewer than 35% of affordable builds can pass even with their best route; the cheapest build fails on every route; more than five builds pass without the ice.

**Archetypes** (model estimate; pass mark 780; *before the Moon sites repricing*: for the current targets see [Balance with the Moon sites and milestones](#balance-with-the-moon-sites-and-milestones)):

| Archetype | Build | Cost + ticket | Route | Survey leads that start it | Milestones | Final | Without using the instrument |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Camera scout | steel, mesh, fixed panel, NiH2, no lights, no heater, camera | 330 + Medium 120 = 450 | Down the de Gerlache wall (photo), straight up to Rocky area 1, across it, Rim viewpoint 1 (photo), wait there for Earth (photo after 238 s) | Layered wall exposure, then Boulder field (Rim viewpoint 1 appears while crossing) | Crater layers, Crater descent, Boulder field, Rim panorama, Earth, Mapper, Odometer ×3, Flare survivor | 990 (+210) | 740 (fails) |
| Drill geologist | steel, mesh, fixed panel, Li-ion, no lights, no heater, drill | 430 + Medium 120 = 550 | North: Rocky area 1 (sample), across it, Rim viewpoint 1 (sample), Rim viewpoint 2 (sample) | Boulder field (any third site 200 m on counts; Rim viewpoint 2 is found by driving) | Regolith ×3, Boulder field, Mapper, Odometer ×3, Flare survivor | 880 (+100) | 580 (fails) |
| Ice hunter | titanium, mesh, fixed panel, Li-ion, lights, heater, drill | 615 + Medium 120 = 735 | Straight to the dark crater, sample at the edge, find and drill the ice (about 293 s) | Permanent shadow | Water ice, Regolith ×2, Mapper, Odometer ×3, Clean run, Flare survivor | 895 (+115); 545 if the ice is not found | 345 (fails) |

Other designs also pass in the model, for example a camera build on titanium and mesh wheels doing the scout route, or a drill build with a NiH2 battery sampling the crater wall, the boulder field and the rim. 33 of 115 affordable builds can pass with their best route (17 of 63 camera builds, 16 of 52 drill builds); none pass by idling, wandering or a short trip.

**Browser check** (*before the Moon sites repricing*; headless Chrome, real game flow, an autopilot following the measured routes, honest play; run before the final number pass, so the finals below are re-priced with the final money from the milestones each run actually earned):

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

**Browser re-check after the playtest fixes** (*before the Moon sites repricing*; November 15: exploring minimap with fog and survey leads, and time-lapse gravity in the air; headless Chrome, real game flow, the same autopilot, starting each time from an unexplored map):

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

**Builds without a plan** (best route in the model; *before the Moon sites repricing*). Examples that fail, and why:

| Build | Cost + ticket | Best final | Why it fails |
| --- | --- | --- | --- |
| Cheapest parts (steel, solid, panel, NiH2, none, none, camera) | 220 + Large 200 = 420 | 740 | Heavy on solid wheels: digs in on soft boulder-field ground, too slow for the wall and the rim in one mission; the Large ticket eats the savings |
| Titanium, solid, panel, Li-ion, lights, heater, camera (the old default build) | 465 + Medium 120 = 585 | 575 | Pays for lights and a heater it cannot use (too slow to reach the dark crater), small battery |
| Steel, mesh, mast, Li-ion, lights, heater, camera | 575 + Medium 120 = 695 | 745 | Does the full scout route but carries about 250 of parts it does not need (lights, heater, mast, lithium-ion) |
| Titanium, solid, panel, NiH2, lights, heater, drill | 445 + Large 200 = 645 | 465 | Overloads the titanium frame (damage while driving), slow, Large ticket |
| Any build that stays at the lander | | at most 530 | Survival, Touchdown, Flare survivor and Clean run are worth 180 together |

**Limits of the estimate.** The ice route needs good driving (about 90% of top speed for 3.3 km) and the hydrogen clue to find the spot; the model assumes the spot is found. Boulder-field crossings assume one rock touch. Mapper uses the playtest rate of about 0.77% of the map per km of new ground.

#### Balance with the Moon sites and milestones

*Decided during implementation (Phase 6 of the Moon sites plan, November 15, 2026): tuned by hand.* The user asked to drop the balance model and tune individual values: the goal for now is a reasonable starting point where several builds and routes win and move on to Mars, and idling or an empty bay loses. **The `winPaths` model is retired** (`rules/winPaths.ts`, its tests and `data/balance.json` are deleted; `rules/balance.ts` stays, it is the parts evaluator the catalog tests use). Balance is tuned over time in later patches, from playtests.

**Values.** Boulder field 60 and Mapper 40 (M3). New milestones at their starting values, except **Rock collection 40 → 60 per stage**: in the browser runs each X-ray reading took 9 to 15 s (driving up to a boulder, stopping, the hold), and players read several boulders to find a new type, so the X-ray builds fell 60 to 120 short.

| Milestone | Money / RP |
| --- | --- |
| Cold trap survey | 50 / 8 per stage, up to 3 |
| Hidden hydrogen | 100 / 20 |
| Ice deposit located | 200 / 30 |
| Rock collection | **60** / 8 per stage (2, 3 and 4 types) |
| Rare rock | 100 / 30, once per campaign (record) |
| Boulder track | 40 / 10 |
| Documented sample | 40 / 10 |
| Fresh ejecta sample | 50 / 15 |
| Moonquake record | 80 / 20 |
| Clean seismogram | 40 / 10 |
| Laser ranging site | 50 / 15 |
| Science station | 50 / 10, once per campaign (record) |

*The values and estimates below are superseded by the [Generous pass](#generous-pass-november-15-2026-after-the-users-playtest); the ways to win and lose still hold, except that more builds now win.*

**Rough estimates** (simple arithmetic: 750 − (parts + ticket) + 50 survival + the milestones a build can reasonably earn; pass mark 780). "Browser" is the November 15 autopilot run (headless Chrome, unexplored map, real time) repriced with these values. Mapper is left out of every route that stays near the lander: the browser runs showed clustered routes reveal only about 1.3% of the map.

| Build (parts + ticket) | Route | Milestones counted | Estimate | Browser |
| --- | --- | --- | --- | --- |
| Idle, any build | Stays at the lander | Touchdown, Flare survivor, Clean run | at most about 580: **loses** | 480 (camera scout build; confirmed again in a Phase 6 sanity run) |
| Empty bay: steel, mesh, panel, NiH2 (400) | Wall, boulder field, rim | Crater descent, Boulder field, Odometer ×3, Flare survivor | about 690 to 730: **loses** | 690 |
| Reflector only (430) | As the empty bay, reflector on the rim | + Laser ranging site | about 720: **loses** | |
| Camera scout (450) | Wall, boulder field, Rim viewpoint 1, Earth | Crater layers, Crater descent, Boulder field, Rim panorama, Earth, Odometer ×3, Clean run | 890 to 940 if it reaches the rim in time; about 770 if not | 940; 770 in a Phase 6 sanity run that was still short of the rim at 300 s |
| Drill geologist (550) | Rocky area 1, both rims | Regolith ×3, Fresh ejecta, Odometer ×3, Clean run or Boulder field | about 820: wins | 820; 790 in a Phase 6 sanity run (Rocky area 1, both rims), which moved the campaign on to Mars |
| Ice hunter (735) | The dark crater | Water ice, Regolith ×2, Odometer ×3, Mapper (Clean run if no damage) | 825 to 875: wins | 825 |
| Rock hound: Ti, mesh, panel, Li-ion, camera + X-ray (600) | East crater and the rolled boulder, NW crater, Rim viewpoint 1 | Rock collection ×3, Rare rock, Boulder track, Documented sample, Rim panorama, Odometer ×2, Clean run (+ Earth 100 if at the rim after 238 s) | 820 to 920: wins | 640 on a longer route that ran out of time (see below) |
| Station keeper: steel, mesh, panel, Li-ion, seismometer + reflector + X-ray (620) | Both stations on the East bench, East crater, NW crater, boulder field | Science station, Laser ranging, Moonquake record, Clean seismogram, Rock collection ×3, Rare rock, Odometer ×2 (+ Clean run) | 820 to 870: wins | 820 |
| Near prospector: Ti, mesh, panel, Li-ion, neutron + X-ray (630) | NW crater, Rocky area 1's cold patch and the hidden hydrogen, East crater, East cold trap | Cold trap survey ×2, Hidden hydrogen, Rock collection ×3, Rare rock, Odometer ×2 (+ Clean run) | 790 to 870: wins | 740 (stuck on a steep slope for a minute) |
| X-ray only, light: Ti, solid, panel, Li-ion, X-ray (440) | Two young craters and the rolled boulder | Rock collection ×3, Rare rock, Odometer ×2, Clean run | about 830: wins | |
| Dark prospector: steel, mesh, panel, Li-ion, lights, heater, neutron (635) | Straight to the dark crater | Ice deposit located, Into the dark, Cold trap survey, Odometer ×3, Mapper, Clean run | about 825 if it reaches the ice signal with energy to spare; about 425 if not | 375: reached the edge at 279 s with the battery under 20%, so the spectrometer could not be switched on |

- **Ways to win:** camera, drill (near or the ice), X-ray (with the camera, the stations, the neutron spectrometer, or alone), the stations with the X-ray spectrometer, the neutron spectrometer with the X-ray spectrometer. **Ways to lose:** idling, an empty bay, a single cheap instrument used once, a far route that runs out of time or energy.
- **Erring generous** (the user's call): a light X-ray build and some short trips with three instruments near the lander can now pass. Accepted for now.
- **Browser lessons for the next balance patch:** X-ray readings and boulder approaches cost about 10 s each; the rolled boulder sits at the foot of a 30 to 39° wall and must be approached from East crater's floor (from the north); the ground beside Rocky area 1's cold patch is 15 to 25° steep; clustered routes do not reach Mapper; the rocky1East to rocky1North crossing often ends as a "Partial crossing" unless the rover enters the field from the south.

**Open issues from earlier phases, decided simply (Phase 6):**
- **The low-energy switch-off pauses a transect, like a power-down** (rule change; was "starts the count again"). Switching the spectrometer on again continues the count; switching it off by hand still ends it. This makes the dark-crater neutron route possible for a rover that can switch on again, though a steel rover still reaches the crater edge too late and too low on energy.
- **A drill sample at Rim viewpoint 1 also earns Fresh ejecta sample** (it lies inside Rocky area 1's 300 m ejecta ring): accepted, one more way to win.
- **NW crater is discovered at the start** (its boulder spread is inside the 250 m reveal circle of the landing): accepted; it gives a first target close to the lander. Every other site starts hidden.
- Everything else stays as it is: the 35 m hidden hydrogen zone (the browser Near prospector earned Hidden hydrogen), the Station keeper's Clean seismogram (clean in all four browser runs, quakes at 110 to 225 s), the dark crater counted as a cold trap for the survey (in the code since Phase 3).

#### Generous pass (November 15, 2026, after the user's playtest)

The user's playtest: milestones were too hard to earn; the rover could not get anywhere in time, sites were too far and hard to find, and one milestone left the player far below the Mars mark. Decided: **lean generous.** The goal is a quick "good enough", not a fine balance.

**Player model** for every estimate: a first-time player averages **half of top speed**, drives routes about **1.5 times** the straight line, loses some time looking for sites, and does not know the map. With a typical mesh build (about 18 to 20 m/s top) that is about 9 m/s, about 2 km of driving after stops, so sites within about 1.3 km in a straight line are in reach. A solid-wheel build (about 11 to 12 m/s) reaches about 0.9 km.

| Value | Before | Now |
| --- | --- | --- |
| Speed compression (`speed.compression`; real speeds unchanged, mesh still 3.3 m/s) | 4 | **6** (mesh top 13.2 → 19.8 m/s) |
| Mass speed loss per kg above 60 kg | 0.01 | **0.006** |
| Air gravity (`rover.airGravityScale`, compression squared) | 16 | **36** |
| Acceleration / braking | 2.5 / 4 m/s² | **3.5 / 6** |
| Drive energy per meter: solid / mesh / grouser | 0.24 / 0.18 / 0.22 | **0.16 / 0.12 / 0.15** |
| Reveal radius / minimap start span | 250 / 700 m | **400 / 1000 m** |
| Near-lander zone (samples, stations) / sample spacing | 200 / 200 m | **120 / 150 m** |
| Earth photo minimum distance | 300 m | **150 m** |
| Photo zone (viewpoints, wall) / ice spot radius | 60 / 50 m | **90 / 70 m** |
| Crater descent depth / exit depth | 150 / 100 m | **120 / 80 m** |
| Mapper share | 1.8% | **2.5%** (the wider circle reveals more; about 1.4 km of new ground) |
| Single science, picture and record rewards | | **doubled**: Crater layers 160, Earth 200, Rim panorama 140, Water ice 700, Hidden hydrogen 200, Ice deposit 400, Rare rock 200, Boulder track 80, Documented sample 80, Fresh ejecta 100, Moonquake record 160, Clean seismogram 80, Laser ranging 100, Science station 100 |
| Staged science rewards (per stage) | 100 / 60 / 50 | **1.5×**: Regolith sample 150, Rock collection 90, Cold trap survey 75 |

Unchanged: capability milestones (Odometer, Mapper's money, Crater descent, Boulder field, Into the dark), Touchdown, Flare survivor, Clean run, survival payout, RP, costs, tickets and the 780 mark. Driving only and idling therefore stay weak; instruments carry the win. Hidden hydrogen and the other pipeline sites did not move.

**Estimates** (750 − parts and ticket + 50 survival + 50 Touchdown + 30 Flare survivor + what this player earns near the lander; pass mark 780):

| Build (parts + ticket) | Realistic milestones | Final |
| --- | --- | --- |
| Idle (camera scout build, 450) | Touchdown, Flare survivor, Clean run | about 480: **loses** |
| Empty bay: steel, mesh, panel, NiH2 (400) | Boulder field, Crater descent, Odometer ×2 to 3, Clean run | about 650 to 760: **loses or scrapes** |
| Camera: steel, mesh, panel, NiH2 (450) | Rim panorama, Earth, Crater layers, Odometer ×2 | about 990; 830 without Crater layers: wins |
| Drill: steel, mesh, panel, Li-ion (550) | Regolith ×3, Fresh ejecta, Odometer ×2 | about 890: wins |
| X-ray only: steel, mesh, panel, Li-ion (460) | Rock collection ×2, Rare rock, Odometer ×2 | about 810; 900 with a third rock type: wins |
| Camera + X-ray: Ti, mesh, panel, Li-ion (600) | Rock collection ×2, Rare rock, Documented sample, Boulder track, Odometer ×2 | about 880: wins |
| Station keeper: seismometer, reflector, X-ray (about 620) | Both stations, Moonquake, Clean seismogram, Rock collection ×2, Odometer ×2 | about 890: wins |
| Neutron + X-ray: Ti, mesh, panel, Li-ion (630) | Hidden hydrogen, Cold trap ×2, Rock collection ×2, Odometer ×2 | about 790; 990 with Rare rock: wins |
| Ice hunter (735) | Water ice, Into the dark, Regolith ×2, Odometer ×3 | about 1,390 if it finds the ice; about 540 if not |

- **Physics.** 1.5 times is the cap: the time-lapse rule (air gravity = compression squared) is kept, and at 2 times (26 m/s) air gravity would be 64. Boulder hits hurt more at speed (8 + 4 per m/s above 3), so fast players should slow down in boulder fields.
- **Mars and Titan share** the wheels, compression, mass loss, acceleration and braking, the reveal radius, and the near-lander zone and sample spacing (each world inherits the `tuning` and `milestones` keys it does not override). Neither is retuned here; Titan's battery-only drive budget (about 1.5 km per mission) was measured with the old wheel energy, so the cheaper driving stretches it.
- **Browser check:** two short runs with a dev fast-forward (`?sim=k`); the browser tool could not hold keys reliably and the pane was hidden, so neither is a valid playtest. The one leg driven reached 18.8 m/s on a 270 m run and held course; a camera and X-ray build earned Documented sample at Rocky area 1. A real playtest is still needed.

**The ice with both instruments does not fit the Moon budget** *(decided, M1)*. The neutron/drill relationship's first answer used to be "bring both", but no version of that build fits the 750 budget, and no tier tweak alone fixes it:

| Ice build | Cost | Mass / size | Ticket | Total |
| --- | --- | --- | --- | --- |
| Ice hunter (drill) | 615 | 58 kg / 22 | Medium 120 | 735 |
| + neutron as it is (80 / 4 kg / 2) | 695 | 62 kg / 24 | Large 200 | 895 |
| + neutron at 60 / 3 kg / 1 | 675 | 61 kg / 23 | Medium 120 | 795 |
| Steel or NiH2 variants | 605 to 635 | 75 to 76 kg | Large, or too slow | 805 and up |

Every version is at least 45 over budget. Decided: **accept it for the Moon.** Ice deposit located gives the neutron spectrometer its own answer in the dark crater, Water ice still needs the drill, and the lesson's answers are reworded (see [Relationships in the mission](#moon-parts)). Rejected: raising the starting budget to about 800 (re-runs the whole balance and shifts Mars) and cutting the neutron spectrometer to about 15 cost (not honest pricing). **The exact numbers (budget, part prices, rewards) can be revisited in a later balance patch** to reach different gameplay outcomes, for example making the two-instrument ice route affordable.

## 7. Rover design

### Moon parts

The Moon parts table: six slots with two options each, plus the payload bay with six instrument options (built, Phases 1 to 3). The slots are listed in the table below; the instruments, with their costs, masses and sizes, are in the second table. For lights and heater, one option is **None**: skipping them saves cost, mass, and size (maybe a cheaper ticket) but closes off the dark crater. *(Superseded November 16: see [Payload: instruments and systems](#payload-instruments-and-systems).)* All Moon parts are available from the start, so budget, mass, and size are the only limits. Locked parts first appear on Mars, greyed out with "needs X RP".

**Empty start** *(decided November 15)*. In a new campaign the design screen starts with all slots and the payload bay empty, so there is no default build to copy. The rover can go to the launch ticket only once every slot has a part and the bay is confirmed; "No lights", "No heater" and "No instruments" count as choices. *(Superseded November 16: see [Payload: instruments and systems](#payload-instruments-and-systems).)* While slots are empty, the specification sheet shows the totals of the parts chosen so far, a dash for driving numbers that need a missing part, and a warning listing the empty slots. A restart keeps the last design, so the player can adjust it.

| Slot | What it affects |
| --- | --- |
| Chassis | The frame that carries everything. Each option has a cost, a mass, and a maximum load. Example: a steel frame is cheap and heavy; a titanium frame is expensive and light. A frame carrying more than its maximum load takes damage. |
| Wheels | Grip, chance of getting stuck, base speed, energy per meter |
| Power source | Energy income |
| Battery | Energy storage |
| Lights | None, or floodlights. Needed to drive into permanent shadow: without them the rover stops at its edge. |
| Heater | None, or radioisotope heater units. Slows freezing in the cold. |
| Payload bay | Any mix of the instruments, one of each, or none. Decides which milestones the rover can complete. The chassis sets the bay's mounting points (steel 3, titanium 2), one per instrument. *(Since November 16: steel 5, titanium 4, shared with the lights, heater, arm and mast; see [Payload: instruments and systems](#payload-instruments-and-systems).)* **Built (Phases 1 to 3):** the bay, instrument operating costs, and the six Moon instruments (science camera, regolith drill, neutron spectrometer, X-ray spectrometer, seismometer station, laser retroreflector); see [rover engineering design](rover-engineering-design.md#7-the-moon-payload). *(Decided November 15, not built yet:)* every instrument now has milestones; see [Moon milestones](#moon-milestones). |

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

**The four new Moon instruments** *(decided during implementation, Phase 3; built)*. Rules in `game/src/rules/instruments.ts` and `rules/mission.ts`; numbers in `tuning.json` → `instruments` and in `parts.json`. None earns money or RP yet; the desk card of each says so (derived: the line shows while no milestone requires the instrument, and goes away once one does), and so does the design tutorial's Payload bay page. *(Decided November 15, M14, not built yet:)* each of the six now has milestones ([Moon milestones](#moon-milestones)), so the "earns no milestones yet" line goes away by itself, and the tutorial sentence that says some instruments earn none goes too. Instead **each desk card lists the milestones its instrument can earn, by name only** (combos on both cards, for example Documented sample on the camera's and the X-ray spectrometer's), with no rewards and no hints at how. The debrief's instrument log links to them ("Rock collection: 4 of 5 types"). The debrief's **Instrument log** has one line for each of these four that the rover **carried**, and none for those it did not carry: the highest hydrogen reading (or "not switched on"), one line per rock read (or "no rocks were read"), the seismometer's record and its quality ("not set down" if the station never went down; "set down, but no moonquake came" if the mission ended first), and "placed" or "not placed" for the reflector.

- **Keys and buttons stay in bay order.** A deployed station keeps its key and its button, which reads "Deployed" and is disabled; pressing its key says it is already on the ground.
- **Neutron spectrometer** (switch, 0.1 energy/s). While it is on and the rover is powered up, a Hydrogen meter (0 to 100%) shows under the cold meter; it is hidden and draws nothing while powered down, and stays on through a power-down. The reading:
  - ordinary ground: the noise floor (5%);
  - any permanent shadow (the dark crater, the cold patch in Rocky area 1): at least the cold background (20%);
  - inside the dark crater: rising toward the hidden ice spot, from 0 at 300 m to 100% at its center (`neutron.iceRangeM`). A rover entering at the near edge reads about 50 to 65%.
  - The reading wobbles by up to 3% so the meter looks live. The ice signal needs permanent shadow, so sunlit ground near the crater shows nothing.
  - *(Phase 4)* The meter reads at once when it turns on (no stale or empty reading), then about five times a second.
  - Inside the dark crater, a rover with a neutron spectrometer and no drill sees the hint "Watch the hydrogen meter".
  - *(Decided November 15; built in Phases 3 and 4:)* an edge ramp at cold traps and a hidden hydrogen anomaly; see [Rules for the new milestones](#rules-for-the-new-milestones).
- **The drill gives no hydrogen reading** (built). The drill's hydrogen signal, its tuning flags (`hydrogenSignal`, `hydrogenStrongWithinM`, `hydrogenModerateWithinM`) and the LEND fact on the first reading are removed; the drill only confirms the ice. The LEND fact is not used elsewhere for now; the neutron spectrometer's fact is VIPER's.
- **X-ray spectrometer** (use: 3 energy, 4 s held). Only with a boulder within 3 m of the rover's center, measured to the boulder's surface (`xray.reachM`); elsewhere it is refused with a notice. A hint shows when a boulder is in reach. The reading shows the rock type and its main elements. Each boulder always reads the same rock (placeholder list built in Phase 3; *decided November 15, not built yet:* rock suites by site and a rare magnesian norite boulder, see [rover engineering design](rover-engineering-design.md#rock-types-by-site)); reading the same boulder again says so and is logged once. *(Decided, not built:)* when a reading adds a type not yet read this mission, the readout adds "New type: 3 of 5".
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
- **Neutron/drill answers reworded** *(decided November 15, M1; text changed in Phase 2 of the Moon sites plan, as below)*. The ice with both instruments does not fit the Moon budget ([Balance with the Moon sites and milestones](#balance-with-the-moon-sites-and-milestones)), so "bring both" can no longer be the first answer as it stands. New wording for the entry's `answers` and the last sentence of its `reviewText` in `relationships.json` (a Phase 2 data change):
  - Answers: "Bring the neutron spectrometer to locate the ice and the drill to confirm it." / "On a tight budget, choose one of the two, or earn points with other instruments."
  - Review text, last sentence: "Bring the neutron spectrometer to locate the ice and the drill to confirm it; on a tight budget, choose one, or earn points elsewhere."
  - The notice, debrief text and "Solved" line stay. The fact changes to VIPER "is designed to" (M15), as for the neutron spectrometer's first-use fact in `text.json`.
- **Real basis used:** VIPER's neutron spectrometer, as designed (VIPER has not flown, M15; the drill step of VIPER's plan is not claimed); Chandrayaan-3's ILSA recording its own rover (ISRO); LRO Diviner's shadow temperatures for cold and dark; VIPER as NASA's first rover with headlights, designed to explore dark craters (it has not flown, M15) (NASA Science VIPER page, checked in Phase 5) for no lights; Curiosity's APXS cooler (without "in daytime", which was not confirmed).
- **The Diviner fact** *(Phase 5 fact check)*: "as cold as -414 °F (about -248 °C, or 25 K)", from NASA SVS 11230, which gives the Fahrenheit figure; the Celsius and kelvin values are conversions. Paige et al. (2010) is no longer cited for it: its abstract does not give 25 K (it gives about 38 K at the LCROSS site). The "Into the dark" milestone fact uses the same wording and source.

**Engineering notebook and pre-launch review** *(decided during implementation, Phase 5; built)*. Rules in `game/src/rules/relationships.ts` and `rules/campaign.ts`; text in `text.json` → `notebook` and `review`.

- **The notebook** is the campaign's list of relationship ids discovered, in the order discovered (`CampaignState.notebook`). A relationship enters it the moment it is first met in a mission, and a mission's end adds any not yet there, failed or not; a restart keeps it (it is not in the restart snapshot); a new campaign starts it empty. A save from before the notebook loads with an empty one.
- **Opening it:** a "Notebook" button on the desk next to Help, and on the mission HUD next to Help. In the mission the **N** key opens and closes it too, and Escape closes it. It is an overlay that pauses the mission, as the drive tutorial does. The end-of-mission panel has a Notebook button too, so the lessons just met can be read before the debrief; opening it clears the unread dot.
- **In the mission,** a relationship met for the first time enters the notebook overlay at once, marked "New"; the HUD button shows a dot until the notebook is opened. It is also added to the campaign notebook and the campaign save is written at that moment, so a reload or crash mid-run keeps it; only the notebook changes (balance, RP, records and the restart snapshot are not touched), and the mission's end adds the ids again without repeats. The HUD's lesson notices pause while the notebook or the tutorial has the mission paused. While the notebook is open it takes the keyboard: driving keys do nothing and are not held when it closes.
- **An entry** shows the relationship's name, what happens and why, the ways to solve it, and the real fact and its source. The fact shows in the notebook whatever the Mission history setting: the notebook is the reference page. Undiscovered lessons show only as a count ("2 of 5 found" under the Moon heading), never by name; the notebook has one heading per world (see [A catalog per world](#mars-rover-design)). The Moon has 5 lessons: the four relationships and no lights.
- **The pre-launch review** is a section of the launch ticket screen, above the purchase. It lists, in data order, the relationships in the notebook that the current build triggers, each marked Fine (green) or Risk (yellow), with the color in words as well (red is only the no-lights hard block, marked Blocked, and its line says the rover stops at the edge of permanent shadow and cannot enter, since a rover that never plans to go there is not broken); plus the no-lights hard block for a rover without lights, discovered or not ("Always checked"). A rover without lights gets only that red line: neither the neutron/drill nor the cold-and-dark line can happen without entering permanent shadow, so they say nothing for it. Nothing undiscovered appears, and a first build shows hard blocks only. It never blocks the purchase.
- **What triggers each line** (a build check per relationship, keyed by id like the mission's checks):

| Relationship | The build triggers it when | Shown as |
| --- | --- | --- |
| Neutron spectrometer finds, drill confirms | The drill is aboard | Yellow without a neutron spectrometer; green ("Solved") with one |
| The seismometer needs quiet ground | The seismometer station is aboard | Yellow |
| Cold and dark | An instrument the cold can slow is aboard: one that holds the rover still and is not cold tolerant (the drill and the two stations; not the camera, which is instant, the neutron spectrometer, a switch, or the X-ray spectrometer) | Yellow without a heater; green ("Solved") with one |
| A colder X-ray detector | The X-ray spectrometer is aboard | Green |
| No lights, no permanent shadow | No lights | Red, always shown |

### Payload: instruments and systems

*Decided November 16, 2026, by the user. Replaces the lights and heater slots of the Moon table above, the "None" options, the bay's instruments-only limit, and the Mars rule that support hardware takes no mounting point. The user knows this is a gameplay and balance change.*

**The rule.**

- **The payload bay holds instruments and systems.** Systems are the lights, a heater, and, on worlds that offer them, the robotic arm and the remote sensing mast (Mars). They go in the bay and compete with the instruments for mounting points.
- **Each payload item takes one mounting point**, instrument or system.
- **At most one heater:** radioisotope heater units or, on Mars, the electric heater. Fitting one replaces the other. There is one lights part, so at most one lights.
- **The arm and the mast are offered only where the world offers them** (Mars). Elsewhere they are not shown at all.
- **Leaving a part off is just not fitting it.** There are no "No lights", "No heater", "No arm", "No mast" or "No instruments" choices on the desk any more.
- **The required bus is the chassis, wheels, power and battery,** one of each. The rover can go to the launch ticket once those four are chosen (and the rest of the existing checks pass); the bay may be empty.
- Everything else about the bay stays: one of each instrument, the needs (an instrument that needs the arm or the mast is refused until it is fitted, and one left in the bay after its support is taken off blocks the launch with the existing warning), the mission keys (instruments only, in the order fitted; systems have no key), and the over-capacity warning.
- What the systems do does not change: a rover without lights fitted still stops at permanent shadow (the hard block), the heater and an RTG's waste heat work as before, milestone requirements still read whether lights or a heater are fitted, and the lessons and the review read the same parts.

**Numbers** (starting values, balanced by hand, generous and quick; no model):

| Chassis | Mounting points before | Now |
| --- | --- | --- |
| Steel | 3 (instruments only) | **5** |
| Titanium | 2 (instruments only) | **4** |

The raise keeps a Moon build's instrument count when it fits both lights and a heater: titanium with lights and heater units still carries two instruments, steel three.

**Arithmetic check** (parts + ticket; Mars finals use the [generous pass on Mars](#generous-pass-on-mars-mars-step-7-november-15-2026) player model at B = 800):

| Build | Points used | Parts + ticket | Result |
| --- | --- | --- | --- |
| Moon: titanium, mesh, panel, Li-ion, lights, heater units, camera + X-ray | 4 of 4 | as before | Same instruments as before: unchanged |
| Moon: steel, lights, heater units, three instruments | 5 of 5 | as before | Unchanged |
| Moon: empty bay (steel, mesh, panel, NiH2) | 0 of 5 | 400 | Unchanged: about 650 to 760, **loses or scrapes** |
| Moon: idle camera scout | 1 of 4 | 450 | Unchanged: about 480, **loses** |
| Mars, first-timer: steel, solid, panel, Li-ion, heater units, arm, X-ray + camera | 4 of 5 | 460 + Large 200 = 660 | 800 − 660 + 310 + 550 = about 1,000: **wins** |
| Mars: rock hound (titanium, heater units, arm, X-ray + camera) | 4 of 4 | 670 | about 990: **wins** (unchanged) |
| Mars: RTG geologist (titanium, RTG, lights, no heater, camera + drill) | 3 of 4 | 775 | about 975: **wins** (unchanged) |
| Mars: camera + drill with heater units (titanium) | 3 of 4 | 640 | about 1,010: **wins** (unchanged) |
| Mars: remote geologist (titanium, heater units, mast, laser + camera) | 4 of 4 | 700 | about 965: **wins** (unchanged) |
| Mars: empty bay with lights and heater (steel), both Night drive stages | 2 of 5 | 445 | Unchanged: 765, **loses** at B = 800 (the known risk at B ≈ 835 stays) |
| Mars: titanium, lights, heater units, arm, X-ray + camera | 5 of 4 | | **Does not fit**: take the lights off or move to steel. This is the intended trade-off |
| Mars: steel, lights, heater, arm + mast, laser + X-ray + camera (the old Heavy example) | 7 of 5 | | **Does not fit any more** |

- **Mars:** every winning row of the generous pass on Mars still fits, because none of them fits lights, a heater and support hardware and two instruments on titanium. The arm and the mast now cost a mounting point, so on titanium a contact or remote instrument with its support and a heater leaves room for one more instrument; steel leaves two.
- **Moon builds are unchanged in practice** for a player who fits the lights and a heater. *New:* a Moon rover that leaves both off has two more points, so titanium can carry four instruments and steel five. Within the 750 budget and the tiers, a scan of the Moon catalog finds 237 such builds that did not exist before (the cheapest: steel or titanium, solid wheels, panel, Li-ion, camera, X-ray, seismometer and reflector, about 640 to 650 with the ticket). They cannot enter permanent shadow (no lights) and work slowly in the cold (no heater). This makes the Moon a little more generous, which suits the generous rule; flagged for the user.
- **Mars** gains 261 such builds within B = 800, but a Mars rover with neither a heater nor an RTG freezes in its first night, so few of them are real choices.

*Lead decisions for the build (November 16):*

- **No bay confirmation.** With "No instruments" gone, an empty bay needs no confirmation: a build is complete when the four bus parts are chosen. The old "unconfirmed bay" state is read as an empty bay.
- **A smaller chassis drops instruments first.** Choosing a chassis with fewer points drops the instruments fitted last, with the existing notice. Systems are never dropped this way: the four systems together take at most four points, which every chassis has.
- **Carry-over and saves.** A carried build loses the parts its new world does not offer (the arm and the mast leave on Titan, the Moon-only stations on Mars), with the existing notice. A save from before this change loads as it is: its "None" choices read as not fitted, and a build now over capacity (for example an old Mars steel rover with lights, heater, arm, mast and three instruments) loads with the over-capacity warning, so the player takes something out.
- *Decided during implementation:* **not fitted is an empty slot.** A system left off is absent from the build; the "None" parts stay in `parts.json` (old saves, the relationships' part lists, tests) but are never shown on the desk, and the rules read a "None" part and an empty slot alike as not fitted. A save's "None" choices load as empty slots, and a "None" part is never named in the not-offered notice.
- *Decided during implementation:* **the heater swap needs no free point.** Fitting the other heater replaces the fitted one even in a full bay. Before a chassis is chosen the bay takes as many items as the roomiest chassis (5), systems included, as it did for instruments.
- *Decided during implementation:* **taking the arm or the mast off keeps its instrument in the bay,** with the existing needs warning blocking the launch, so the player decides what goes.
- *Decided during implementation:* the Mars night energy line needs only the power source (it waited for the lights and heater slots), and the Titan debrief's Dragonfly row reads "No heater" for a rover flown without one.

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
- **Mars has its own tiers** *(decided November 15, Mars M12; the user approved the tiers on November 15)*. The draft keeps the Moon's three and adds a fourth, Heavy, for the support hardware and three-instrument steel rovers Mars allows; see [Mars ticket tiers](#mars-ticket-tiers-decided).
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
- **Small cold patch:** a tiny real cold spot inside the nearby rocky area also uses the freeze rule. It is an early, low-risk taste of the cold. *(Decided during implementation.)* *(November 15; built in Phase 4:)* it is also one of the cold trap sites below, with the pipeline's outline.
- **New sites near the lander** *(decided November 15, 2026, Moon sites and milestones plan, M4; built in Phases 1, 4 and 5)*. Reaching the ice took nearly the whole mission and four instruments had nothing to do, so the map gets more to do **near** the lander, not farther away. Every new site is within about 1 km of the lander, most within 650 m; the dark crater stays the one far destination.

| Kind | What it is | Real basis | Instruments it serves | Count |
| --- | --- | --- | --- | --- |
| Young crater | A small fresh crater (40 to 120 m across) ringed by boulders and bright ejecta | Fresh craters are ringed by boulders and bright, little-weathered ejecta (Grier et al. 2001, JGR 106, doi:10.1029/1999JE001160) | X-ray (its own rock suite), drill (fresh ejecta), camera | 3 |
| Cold trap | A small permanently shadowed patch from the LOLA 60 m permanent-shadow map | Small cold traps are common and may hold ice (Hayne, Aharonson & Schorghofer 2021, Nature Astronomy 5:169, doi:10.1038/s41550-020-1198-9) | Neutron (survey), and the cold rules for everything else | East and South, plus Rocky area 1's cold patch |
| Rolled boulder | One large boulder (about 3.5 m) at the foot of a steep wall, with a track up the slope behind it. *Placed by design* | LRO images show more than 136,000 boulders that rolled downslope (Bickel et al. 2020, Nature Communications 11:2862, doi:10.1038/s41467-020-16653-3) | X-ray (the rare rock), camera | 1 |
| Hidden hydrogen | A sunlit but poorly lit slope where the hydrogen meter reads higher than in the cold traps. Never marked until found. *Placed by design* | LEND found hydrogen-rich areas that do not line up with permanent shadow (Mitrofanov et al. 2010, Science 330:483, doi:10.1126/science.1185696) | Neutron | 1 |
| Ice signal | The area around the existing hidden ice spot where the meter reads at least 70% | VIPER's neutron spectrometer is designed to prospect for hydrogen while driving | Neutron | 1 (the existing spot) |

  Candidate places (from a quick look at the terrain layers; the pipeline confirms them, requests P1 to P5 in the plan). *Phase 4:* every place now comes from the pipeline's lists; the measured positions and what changed are in [World and site placement](#rules-for-the-new-milestones) (Phase 4, below the balance model). Directions are compass points from the lander; distances are straight lines.

| Ring | Site | Kind | From the lander | Notes |
| --- | --- | --- | --- | --- |
| Home (under 650 m) | NW crater | Young crater | 244 m NNW | On the way to Rocky area 1 |
| | Rocky area 1 and its cold patch | Rocky area + cold trap | 492 m WNW (341 m drive) | Existing |
| | Hidden hydrogen | Hidden hydrogen | about 534 m NW | Shaded slope between Rocky area 1 and Rim viewpoint 1 (average sunlight 5 to 9%, not permanent shadow) |
| | East crater and the rolled boulder | Young crater + rolled boulder | 509 m ENE | The boulder sits on the floor below the steepest inner wall |
| | East cold trap | Cold trap | 615 m ESE | About one 60 m pixel of the LOLA map |
| Middle (0.65 to 1.6 km) | South cold trap | Cold trap | 930 m SSW | 240 m from the wall descent point |
| | SE crater *(replaces West crater, Phase 4)* | Young crater | 1.16 km ESE | The West candidate has no rim (pipeline Phase 1) |
| Far | Dark crater and the ice signal | Existing | 2.9 km N | The ice signal is a zone around the existing ice spot |

  - **Two clusters.** The East cluster (East crater, rolled boulder, East cold trap and the Earth-facing bench between them and the lander) and the West cluster (NW crater, Rocky area 1 and its cold patch, hidden hydrogen, Rim viewpoint 1) each hold something for every instrument. They are about 900 m apart through the lander, so a run can do both and still reach a rim photo, or do one and head for the wall or the dark crater.
  - **Left out:** the North cold trap near the dark crater route (2.65 km NNE) unless the pipeline shows a real route passes within 100 m of it (M13); a fault scarp viewpoint unless the pipeline shows the de Gerlache scarp in view from the play area (M12); a "peak of light" site (within 1 km the brightest ground is the landing's 66%).
  - **Earth in view is not a site.** Earth is in view from about half the ground within 1.5 km of the lander, because the north flank falls away. That is the landing site's selection criterion working, so it stays (M2); the stations' 200 m lander rule and the reflector milestone's low price handle it.
  - **Honest placement.** The rolled boulder, the hidden hydrogen and the magnesian norite are placed by design. Their fact texts say "inspired by" real findings, never that they were observed at this spot. The East and South cold traps are at the LOLA map's resolution limit, so fact text speaks of small cold traps in general and gives them no size.
- **Edge:** a "leaving the planned operating area" notice stops the rover at the boundary. Real missions also plan an operating zone.
- **Why this works:** the Moon is small, so from rover camera height (about 1.7 m) the horizon is only about 2.4 km away. Only high ground shows beyond it, so a large detailed area plus coarse distant terrain looks like one continuous surface.

### Minimap and exploration

*Decided November 15, 2026 (playtest fix).* The first minimap showed the whole 8 km area under a light fog, with every crater and viewpoint marked from the start, so players saw every site at once and had little reason to explore. Now the map grows with the rover's own survey.

- **Zoom.** The map starts zoomed in on the lander, about 700 m across (`minimap.startSpanM`). It widens smoothly to fit everything explored so far, and each discovered site whole (the dark crater is larger than the reveal circle), plus a 100 m margin (`minimap.marginM`), so the rover always has some ground around it. It never zooms back in during a mission; a long drive north ends with a map a few kilometers across.
- **Fog.** Unexplored ground is hidden. The rover reveals a circle around itself on the same 20 m grid the Mapper milestone counts (`explore`), so Mapper is unchanged. *Generous pass (November 15): reveal radius 250 → 400 m, start span 700 → 1000 m; Rocky area 1 and NW crater are found at the start, so the boulder field lead is already done when the mission starts.* Before that, *reveal radius kept at 250 m* (`explore.revealRadiusM`): every site is hidden at the start except NW crater (about 250 m out, found at the start; accepted in Phase 6) (the nearest, Rim viewpoint 1 and Rocky area 1, are about 490 m away), the ground ahead still shows at driving speed, and Mapper's 1.8% and the balance model stay valid.
- **Sites appear when discovered.** Viewpoints, rocky areas (boulder fields), the de Gerlache wall descent point and the dark crater's outline are drawn only once the rover's reveal circle touches them: the 60 m viewpoint or wall zone, the boulder spread (1.1 times the crater radius), or the crater's permanent-shadow outline. A notice names each newly found site. The lander is always shown. The ice spot is never marked.
- **New site kinds on the minimap** *(decided November 15; built in Phase 5, see [HUD, minimap and debrief](#rules-for-the-new-milestones))*. The same rules: hidden until the reveal circle touches a site, then drawn with a "Located" notice, except the two hydrogen sites, which only the neutron spectrometer can find.

| Kind | Before discovery | When discovered | After discovery |
| --- | --- | --- | --- |
| Young crater | Hidden (fog) | Ring icon; the notice names it and, for instruments aboard only, what they can do there ("East crater: fresh boulders and ejecta. X-ray spectrometer: read the rocks.") | Ring; a small check once every milestone this rover can earn there is earned |
| Cold trap | Hidden | Its outline, a small dashed patch in its own style; notice "Cold trap: a small patch of ground where hydrogen may collect." plus a neutron line if one is aboard (no word about shadow, light, cold or temperature beyond the name, per the spoiler guard; reworded after the Phase 5 review) | Outline; a check once surveyed |
| Rolled boulder | Hidden | Boulder icon with a short track line up the slope | A check once read and photographed (whichever this rover can) |
| Hidden hydrogen | **Never drawn until found.** The reveal circle does not discover it; only the neutron meter's rise does | When Hidden hydrogen is earned: a dotted area labeled "Hydrogen-rich ground" | Stays drawn |
| Ice signal | Never drawn | Not drawn: earning it would show where the ice is, which is the meter's job. The ice spot stays unmarked | |

  - **Site notices are instrument-aware but lesson-blind.** They say what the carried instruments can do there, never what might go wrong (no "watch the cold", no "drive away from the station").
  - The dark crater keeps its existing outline; surveying it adds no new mark *(decided in Phase 0)*.
- **Bearings, not markers: orbital survey leads.** The landing briefing lists four leads from orbital data (see the table), each a rough direction and distance from the lander. Real missions plan their drives on orbital maps the same way; NASA planned VIPER's routes on Lunar Reconnaissance Orbiter elevation and illumination data.
  - While a lead's area is undiscovered, an arrow on the minimap's edge points from the rover toward the area's center, and a list under the minimap gives its current direction and distance. Once the rover discovers the area, the arrow goes and the site itself appears.
  - Leads point to areas, not exact spots: the direction is one of 16 compass points and the distance is rounded (to 0.1 km below 1 km, to 0.5 km above) and measured to the near edge of the area.
  - Each winning archetype has a starting direction:

| Lead | Orbital source | Area | From the lander | Starts |
| --- | --- | --- | --- | --- |
| Layered wall exposure | LROC images | de Gerlache wall descent | about 0.7 km south-southwest | Camera scout: Crater layers, Crater descent |
| Boulder field | LROC images | Rocky area 1 | about 0.3 km west-northwest | Drill geologist and camera scout: Boulder field, samples. Rim viewpoint 1 is about 280 m beyond the field's center, so it shows up while crossing. |
| Permanent shadow | LOLA illumination maps | the dark crater | about 3 km north | Ice hunter |
| Young crater *(decided November 15, M7; built in Phase 5)* | LROC images | East crater | about 0.5 km east-northeast | Rock hound, Station keeper, Near prospector: pulls first-time players to the East cluster, as the boulder field lead pulls them to Rocky area 1 |

  - Rim viewpoint 2 and Rocky area 2 have no lead; they are found by driving. *(Decided November 15:)* nor do the cold traps and the other young craters: Rocky area 1's cold patch is inside the boulder field lead's area, and the others are found by driving or by the hydrogen meter's rise near them. The leads, the rounding and the area sizes are in `survey` in `tuning.json`; their text is in `text.json` → `survey`.
- **Map memory: reset each try.** Every mission starts with an unexplored map, including a restart after a failed round (the new sites too, including "Hydrogen-rich ground"). The explored area and discovered sites are not saved, which matches the restart snapshot rule: a restarted round starts as new. The leads stay the same on every try.

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

**Twelve new milestones** *(decided November 15, 2026, Moon sites and milestones plan, M1 to M15; built in Phases 2 to 6)*. With them the Moon has 25 milestones, and every instrument earns at least one. Rewards are in [Balance with the Moon sites and milestones](#balance-with-the-moon-sites-and-milestones); rules in [Rules for the new milestones](#rules-for-the-new-milestones). Two existing ones are repriced there: Boulder field 60, Mapper 40.

| Milestone | Category | How to earn it | Equipment |
| --- | --- | --- | --- |
| Cold trap survey | Scientific: new information | With the neutron spectrometer switched on, drive an unbroken 50 m that passes within 25 m of a cold trap, or through it. One stage per cold trap, up to 3 | Neutron spectrometer |
| Hidden hydrogen | Scientific: strange formation | With the neutron spectrometer on, drive through the hidden hydrogen spot, where the meter peaks higher than in the cold traps. *Placed by design* | Neutron spectrometer |
| Ice deposit located | Scientific: new material | With the neutron spectrometer on, drive inside the dark crater where the meter reads at least 70% (within about 90 m of the ice spot) | Neutron spectrometer, lights (design requirement only: the in-game how-to-earn text and desk card name only the neutron spectrometer, never lights, so the "No lights" lesson is not given away) |
| Rock collection | Scientific: new information | Read 2, 3 and 4 different rock types with the X-ray spectrometer (one stage each) | X-ray spectrometer |
| Rare rock | Record: first discovery | Read the rolled boulder (magnesian norite, found nowhere else). Once per campaign. *Placed by design* | X-ray spectrometer |
| Boulder track | Scientific: strange formation | Photograph the rolled boulder in frame from within 80 m | Camera |
| Documented sample | Scientific: new information | Photograph a boulder the X-ray spectrometer has read this mission, in frame, from within 15 m | Camera + X-ray spectrometer (combo) |
| Fresh ejecta sample | Scientific: new information | Drill a sample inside a young crater's or rocky area's ejecta ring (1.5 times its radius) | Drill |
| Moonquake record | Scientific: new information | The seismometer station, set down more than 200 m from the lander, records the moonquake (clean or noisy) | Seismometer station |
| Clean seismogram | Scientific: new information | That record is clean (the HUD's existing quality word) | Seismometer station |
| Laser ranging site | Scientific: new information | Set the reflector down where Earth is in view, more than 200 m from the lander | Laser retroreflector |
| Science station | Record: key milestone | Both stations on the ground within 100 m of each other, more than 200 m from the lander, Earth in view at the reflector. Once per campaign | Seismometer station + laser retroreflector (combo) |

- The Moon's science choice is the **payload bay**: any mix of up to three (steel) or two (titanium) of the six Moon instruments, or none. The camera earns pictures and imaging science; the drill earns samples and the water ice. *(The four new instruments are built (Phase 3) and record into the debrief's instrument log. Their milestones are decided above; since Phase 4 the mission feeds every new trigger, so they earn in the game (the HUD hints, minimap marks and debrief lines come in Phase 5); see [rover engineering design](rover-engineering-design.md#7-the-moon-payload).)*
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
- **Mapper** is 1.8% of the map, counted on the explored grid; the minimap's zoom and fog are display only (see [Minimap and exploration](#minimap-and-exploration)). Measured in playtests with full-throttle drives: a light build drove 3.2 km and revealed 2.8% (Mapper at about 2.2 km); the default build drove 2.0 km before its battery ran out and revealed 1.84%. The share grows about 0.77% per km of new ground.
- **Clean run** ignores moonquake damage, because every mission has one quake and nothing can prevent its damage. Any other damage (impacts, slopes, overload, flares) loses it. The milestone notice says so.
- **Records** (Touchdown, Water ice; Rare rock and Science station, built in Phase 3) pay once per campaign. A record already held still shows in the debrief, without a reward. A restart restores the records list from the round snapshot, so records from a failed round can be earned again.
- **Mission history setting** (title screen → Settings; on by default, saved in the browser). When on, each milestone pop-up shows its real fact (staged milestones on the first stage only), the debrief lists the facts, and the debrief compares the rover's fate with a real rover's. Every fact has a source in `milestones.json` or `text.json`; the debrief shows the comparison's source.
- **Rollover** is reported as "Destroyed by rollover", with its own real-rover comparison (no planetary rover is known to have been lost to a rollover).
- **Earth's look.** Earth's phase follows the angle between the Sun and Earth, which is real geometry.
  - With the decided Sun path (start 75°, subsolar latitude −1.54°), Earth starts as a 37% crescent. It is nearly dark (new Earth, 1% lit) when the Sun passes 1.5° beside it at about 132 s, then fills again to 55% at the end.
  - The Sun no longer passes behind Earth (see [Sun and shadows](#sun-and-shadows)).

#### Rules for the new milestones

*Decided November 15, 2026 (Moon sites and milestones plan); built in Phases 2 to 6.* Rules are in `game/src/rules/milestones.ts`, `instruments.ts` and `survey.ts`; triggers, rewards and facts in `milestones.json`; distances in `tuning.json`; which crater holds the rolled boulder, which low-light slope is the hidden hydrogen, each site's rock suite and display names in a new `game/data/sites.json`. Numbers below are starting values for the balance model. "Near the lander" is the existing 200 m zone around the landing point (`sampleMinDistanceM`, reused as `stationMinDistanceM`; M9).

**Triggers.** Three generic triggers are shared with the Mars plan ([Milestone types](mars-rover-engineering-implementation-plan.md#milestone-types)) with Moon extensions (marked), plus one new trigger. The Moon builds them first; Mars reuses them (M6).

| Trigger | Shape | Fires when | Moon milestones |
| --- | --- | --- | --- |
| `transect` | `{ type, instrument, zone, meters, sites? }` | The instrument was switched on for an unbroken drive of at least `meters` that touches the zone. *Moon extension:* `sites` stages one per distinct zone instance | Cold trap survey (`cold-trap`, 50 m, 3 sites), Hidden hydrogen (`hydrogen-anomaly`, 30 m), Ice deposit located (`ice-signal`, 20 m) |
| `reading` | `{ type, instrument, zone?, target?, sites?, rocks?, rock? }` | A use of the instrument finishes. *Moon extensions:* `rocks: number[]` stages by distinct rock types read this mission; `rock` needs that rock type | Rock collection (`rocks: [2, 3, 4]`), Rare rock (`rock: "magnesian-norite"`) |
| `record` | `{ type, instrument, event, quality? }` | The instrument was deployed when the event came. *Moon extensions:* `quality` needs that record quality; the station must have been set down outside the near-lander zone | Moonquake record, Clean seismogram (`quality: "clean"`) |
| `deploy` (new) | `{ type, instrument, needs?: 'earth', near?: { instrument, withinM } }` | A station is set down outside the near-lander zone, with Earth in view if asked, and within `withinM` of the other station if asked | Laser ranging site, Science station (`near`: `stationPairMaxM` 100) |
| `photo` (exists) | New targets `rolled-boulder` (in frame within `boulderTrackPhotoRangeM` 80) and `read-boulder` (a boulder read this mission, in frame within `documentedSampleRangeM` 15) | | Boulder track, Documented sample |
| `drill` (exists) | New zone `young-crater`: within `youngCraterEjectaFactor` (1.5) times the radius of a young crater or rocky area | | Fresh ejecta sample |

- **Combos need every listed instrument.** `MilestoneRequirements` gains `instruments?: Instrument[]` (all required); `instrument` stays for single ones. A combo that fires on a rover missing one is not credited, with the existing missed-part notice naming it.
- **Stations and the lander: warned before, not after** (M9). Stations cannot be picked up again, so within 200 m of the landing point a station's HUD hint reads "Too close to the lander to count", and the first press of its key or button asks for a second press to set it down anyway (decided in Phase 0: the second press must come within 5 s, `instruments.stationConfirmSeconds`, or the first press is forgotten). The reflector's Earth light gains a third state, "Earth in view · too close to the lander". A station set down inside still works as today (the seismometer records, both go in the instrument log) but earns none of the station milestones.
- **The record does not care about the rover's power** *(decided in Phase 0)*. A deployed station records the moonquake whether or not the rover is powered down at that moment (the Mars plan's `record` asks the rover not to be powered down, which suits instruments aboard the rover, not stations on the ground).
- **Cold trap survey.** A cold trap's zone is its permanent-shadow outline plus a 25 m edge (`coldTrapEdgeM`), so a rover without lights can survey from the edge. *Decided in Phase 0:* "unbroken" means the meters count only while the spectrometer is on and the rover powered up; switching it off by hand starts the count again; a power-down (for a flare) pauses it, and so does the low-energy switch-off since Phase 6 (switching on again continues the count); the drive may touch the zone anywhere along its 50 m, and the stage is credited as soon as both are true. *Decided in Phase 0, flagged for the balance model:* the dark crater counts as a cold trap for the survey (it is the biggest one on the map), since the Dark prospector's estimate assumes one stage there; without it that route ends at 775 and fails. The North cold trap stays out unless the pipeline shows a real route near it (M13).
- **Hidden hydrogen.** A 60 m circle (35 m since Phase 4, see World and site placement) around a low-light slope's center that `sites.json` picks from the pipeline's low-light patches (request P4); a 30 m switched-on drive touching it earns the milestone. The reveal circle never discovers it; it is drawn only once earned.
- **Ice deposit located.** The zone is the part of the dark crater where the meter's ice signal reaches 70% (`neutron.iceSignalShare`), which with `iceRangeM` 300 is within about 90 m of the ice spot; a 20 m switched-on drive touching it earns the milestone. It needs the neutron spectrometer and lights (decided in Phase 0: no heater, because the zone starts about 10 m inside the shadow edge and a short visit does not freeze an unheated rover). It is separate from Water ice, which still needs the drill. Earning it marks nothing on the map.
- **The hydrogen meter learns two things.** Near a cold trap it rises over a short edge ramp (`neutron.edgeRampM`, 25 m) from the noise floor to the cold background (20%). The hidden hydrogen spot reads `neutron.anomalyPeak` at its center and `neutron.anomalyEdge` at the edge of its zone, then falls to the noise floor at `anomalyRangeM` (values below). *Decided in Phase 0:* both fall off in a straight line, like the ice signal; the edge ramp applies outside every cold zone, the dark crater included; inside the dark crater the reading is unchanged; where several apply, the meter shows the highest. This is a game simplification: a real rover-mounted detector senses only about its own footprint. *Decided during implementation (Phase 2):* the Phase 0 numbers (45% at the center falling to the noise floor at 80 m) read only about 15% at the 60 m zone edge, below the cold traps' 20%, which broke "reads 40 to 50% in the zone, higher than in the cold traps". The anomaly now falls in two straight segments: **50% at the center, 40% at the zone edge** (`hydrogenZoneRadiusM` 60 in `tuning.milestones`, 35 since Phase 4; the meter reads the edge from the zone itself), then to the 5% noise floor at **150 m**. So the whole zone reads 40 to 50%, the meter reads above the cold traps' 20% out to about 111 m, and its rise shows from about 150 m, a little short of Rocky area 1's center (about 175 m away) and Rim viewpoint 1 (about 136 m away, where it reads about 10%).
- **Cold traps join the cold rules.** Their names go into `tuning.cold.zones`, so they freeze an unheated rover, stop a rover without lights at their edge, and slow held uses without a heater, like Rocky area 1's patch today.
- **Rock types depend on the site** ([rover engineering design](rover-engineering-design.md#rock-types-by-site)). Rock collection counts distinct types read this mission; the X-ray readout adds "New type: 3 of 5" when one counts. Rare rock is a record.
- **Photo milestones.** Boulder track and Documented sample use the Earth photo's frame test (`photoFrameMargin`) on the boulder's center (decided in Phase 0). One photo can earn both, as one photo can earn Rim panorama and Earth.
- **Fresh ejecta sample.** Any drill sample within 1.5 times a young crater's or rocky area's radius of its center, the crater floor included (decided in Phase 0). The usual drill rule still applies: only samples at least 200 m from the landing point count, so the part of NW crater's ring nearer the lander does not count. One drill action can earn both Fresh ejecta and a Regolith site.
- **Science station** fires when the second station goes down. Both must be outside the near-lander zone, within 100 m of each other, with Earth in view at the reflector (already required to set it down). It is a record, once per campaign; it is the Apollo 11 package and should feel like a one-time event.
- **Desk cards** list each instrument's milestones by name (M14; see [Moon parts](#moon-parts)).
- **Debrief: "Not reached"** (M11). With 25 Moon milestones, the debrief adds a short list of milestones the rover carried the parts for and did not earn, names only. *Decided in Phase 0:* only milestones that need at least one instrument count (capability milestones need no parts and would always be listed); the rover must have carried every part the milestone requires; records already held this campaign are left out; a staged milestone is listed only if none of its stages was earned. The debrief groups milestones by instrument and shows staged ones as one line with a count.
- **No lesson is spoiled.** The five Moon lessons stay as they are. No milestone, site name, notice, lead or desk line names a lesson's cause or its fix: no milestone needs the neutron spectrometer and the drill together (Water ice already rewards the pair), the seismometer texts say only "record" and "clean", no milestone needs a use inside the cold or mentions shadow, temperature or lights. The survey text says "pass near or through". A test greps the new texts for each lesson's key words.

**Data and types** *(decided during implementation, Phase 2 of the Moon sites plan)*. The twelve milestones, the tuning values and `sites.json` are in the data files and validated; they load but do not fire until Phase 3 adds the trigger rules.

- **Where the text lives.** Each milestone's name, pop-up summary, fact and source stay in `milestones.json`, as for the first thirteen; a new `howTo` field there holds the short how-to-earn line (all 25 Moon milestones), so Mars, which replaces the whole list, needs no matching text. `text.json` gets only the new rock name (magnesian norite). Site notices, the fourth lead's text and desk card lines come in Phase 5.
- **Trigger shapes in `rules/types.ts`.** `transect { instrument, zone, meters, sites? }`, `reading { instrument, zone?, target?, sites?, rocks?, rock? }`, `record { instrument, event: 'quake' | 'duststorm', quality? }`, `deploy { instrument, needs?: 'earth', near?: { instrument, withinM } }`, and photo targets `earth`, `sunset`, `rolled-boulder`, `read-boulder`. New zone ids: `cold-trap`, `young-crater`, `hydrogen-anomaly`, `ice-signal`.
- **Science station** is a `deploy` trigger on the reflector (`needs: 'earth'`) with `near: { instrument: 'seismometer', withinM: 100 }`, requiring both stations (`requires.instruments`). It fires when the second of the two goes down, in either order. The 100 m lives on the trigger, so there is no separate `stationPairMaxM` in tuning.
- **Stations and the lander** use the existing `near-lander` zone (`sampleMinDistanceM`, 200 m); there is no separate `stationMinDistanceM` key that could drift from it. The second press must come within `instruments.stationConfirmSeconds` (5 s).
- **Ice deposit located** requires lights in its data (`requires.slots: ["lights"]`); its how-to text names only the neutron spectrometer.
- **Combos.** `requires.instruments` lists every instrument a combo needs. Eligibility (`meetsRequirements`), the missed-part notice and the desk card's "earns no milestones yet" check read it as well as `requires.instrument`. A trigger's own instrument must be among the milestone's required instruments (validated).
- **Staged counts.** A `transect` with `sites` has one stage per site; a `reading` with `rocks` one stage per entry (Rock collection: 3).
- **Rock suites.** `instruments.xray.suites` holds the weighted suites by suite id (`rocky-area-1`, `east-crater`, `regolith-crater`, `rocky-area-2`, `rolled-boulder`); each site in `sites.json` names its suite. The old `instruments.xray.rocks` list stays as the fallback for a boulder with no site (Mars's rocky areas today) until Phase 3 picks rocks by site. `Boulder.site` is optional until Phase 4 fills it.
- **Zone and meter numbers** in `tuning.json`: `milestones.coldTrapEdgeM` 25, `youngCraterEjectaFactor` 1.5, `boulderTrackPhotoRangeM` 80, `documentedSampleRangeM` 15, `hydrogenZoneRadiusM` 60 (35 since Phase 4); `instruments.neutron.edgeRampM` 25, `anomalyPeak` 0.5, `anomalyEdge` 0.4, `anomalyRangeM` 150, `iceSignalShare` 0.7; `boulders.perYoungCrater` 30, `rolledBoulderDiameterM` 3.5. Validation checks that the anomaly reads above the cold background at its zone edge and reaches past the zone, and that the ice signal share lies above the cold background.
- **Cold traps in the cold rules.** `cold.zones` adds "East cold trap" and "South cold trap" (the sites' names). Each cold zone must name a `terrain.json` feature or a cold trap in `sites.json` (validated). Since Phase 4 the cold mask finds them through `sites.json`, so they freeze an unheated rover.
- **The fourth survey lead** ("Young crater") *(built in Phase 5: East crater is a minimap site now)*.

**`sites.json` and provisional positions** *(decided during implementation, Phase 2)*. `game/data/sites.json` lists every Moon site a new milestone uses, typed `SitesFile` in `rules/types.ts`. Each entry has an `id`, a `kind` (`young-crater`, `rocky-area`, `cold-trap`, `rolled-boulder`, `hidden-hydrogen`), a display `name` (also how `cold.zones` names it), and where it is, in one of three ways:

| Way | Field | When |
| --- | --- | --- |
| An existing `terrain.json` feature | `feature`: a feature key (`shadowedCrater`) or name (`Rocky area 1`) | Rocky areas 1 and 2, Rocky area 1's cold patch, the dark crater (a cold trap for the survey, decided in Phase 0) |
| A pipeline feature from Phase 1 | `pipeline: { list, id }`, `list` one of `coldTraps`, `youngCraters`, `boulderTrackCandidates`, `lowLightPatches` | Once the pipeline has produced the lists |
| A candidate position | `provisional: true`, `local: { x, z }`, and `radiusM` for craters and cold traps | Now, for the five new places: the plan's candidates |

- **Provisional values.** Positions are the plan's candidates (§2, "Where they go"). Radii: young craters from their depth with the fresh-crater depth-to-diameter ratio of about 0.2 (East 28 m, NW 20 m, West 23 m); cold traps from their area in the LOLA map (about 2,200 m², 26 m). The rolled boulder sits at East crater's center until P3 gives the foot of its steepest wall; the hidden hydrogen is the center of the candidate slope. The pipeline confirms or replaces each one, and a later step swaps `provisional` for a `pipeline` reference.
- **Validation.** Every entry needs a `feature`, a `pipeline` reference, or `provisional: true` with `local`. In the data test, against the real `terrain.json`: a `feature` must exist; a `pipeline` reference must name an `id` in its list when the list exists, and an entry whose list is missing must still be provisional. A provisional entry is accepted even once the list exists, so a new `terrain.json` never stops the game from loading; swapping it is a data task.
- **Mars** gets an empty site list (`src/gameData.ts`), so none of the Moon's sites reach it.

**Rules** *(decided during implementation, Phase 3 of the Moon sites plan)*. The twelve milestones' trigger rules are built and unit-tested in `rules/`; Phase 4 wires the mission screen to them.

- **Where each site is** (`rules/sites.ts`). A site resolves from its pipeline feature once the pipeline has produced it, else its own `local` position, else the `terrain.json` feature it names. Rocky area 1's cold patch keeps `feature: "Rocky area 1"` (the cold mask finds it from there) and gains a `local` and `radiusM`: a circle of the patch's own area (52,600 m², 129 m) at its centroid, measured from `cold-mask.png`, until the pipeline's `coldTraps` outline replaces it.
- **Zones.** One zone per site, keyed `<zone id>:<site id>`; staged transects count distinct keys. A cold trap's zone is its outline (the dark crater's polygon, or a circle) plus `coldTrapEdgeM`. The young-crater zone covers the young craters and both rocky areas. The ice signal zone is a circle of (1 − `iceSignalShare`) × `iceRangeM` (90 m) around the ice spot; a test checks it lies inside the dark crater. *Flagged:* a rocky area's ring is 1.5 × 200 m = 300 m, so Rim viewpoint 1 (283 m from Rocky area 1's center) lies in it, and a drill sample there earns Fresh ejecta sample too.
- **Transects.** Each standby instrument counts the meters the odometer adds while it is switched on and the rover powered up, and remembers the zones touched since the count began. A power-down pauses the count; switching off by hand ends it (the low-energy switch-off ended it too until Phase 6; it now pauses it, `StepInput.autoOff`). A milestone counts as soon as the count reaches its meters and a zone of its kind was touched.
- **Readings.** The mission passes each finished X-ray reading with its rock type and boulder. Rock collection counts distinct rock types this mission. `reading.target` is typed: `boulder`, or `cliff` (the Mars plan's laser target). A reading with `sites` counts a new site only `sampleSpacingM` from earlier ones, as the drill does.
- **Boulder photos.** The mission passes the boulders inside the camera frame (its frame test). Boulder track needs the rolled boulder among them within 80 m; Documented sample needs a boulder read this mission within 15 m.
- **Records.** The near-lander rule applies to a station on the ground: the record call carries where it was set down. An instrument aboard (Mars) passes no position, and no near-lander rule applies.
- **Deploys.** Each station's Earth state is taken when it is set down (the reflector cannot be set down without Earth anyway). The pair checks both stations: both must be outside the near-lander zone and within 100 m of each other. A rover missing one station gets the missed-part notice if the pair ever fires.
- **The hydrogen meter** takes its edge ramp from the cold-trap zones' own outlines, so the provisional circles count. Inside a cold-trap outline the meter reads at least the cold background, even where the cold mask disagrees.
- **Cold zones resolve in the rules.** `rules/sites.ts` `coldZoneAnchor` finds each `cold.zones` name: a `terrain.json` feature, else a cold trap in `sites.json`, provisional ones included. `siteTerrainProblems` reports a name that resolves to nothing. `world/terrainMasks.ts` uses it; since Phase 4 its `sites` argument is required and the callers pass `data.sites.sites`.
- **Survey.** Young craters, cold traps (not the dark crater, which keeps its own outline), the rolled boulder and the hidden hydrogen are survey sites. A young crater is found at its boulder spread (`boulderCrossRadiusFactor` × radius). The hidden hydrogen is `hidden`: the reveal circle never finds it, and `revealSite` marks it once Hidden hydrogen is earned.
- **Boulders and rocks.** `scatterSiteBoulders` puts 30 boulders at each young crater and the one rolled boulder on its own seed (`seed + 1`), so the rocky areas' boulders do not move. `rockTypeFor` reads a boulder's site suite and falls back to the old list.
- **Station checks** (`rules/instruments.ts`, for the Phase 5 HUD): `stationTooClose`, `stationHint` (no Earth refuses outright, before the too-close warning), `reflectorEarthLight` (its three states) and `stationPress` (the second press within `stationConfirmSeconds`, inclusive).

**Balance model** *(decided during implementation, Phase 3; retired in Phase 6, kept here as history)*. `winPaths` credited the new triggers. Route nodes gain `zones` (the site zones they lie in; a test checks them against `buildZones` on the real terrain), `rocks` (one rock type per X-ray reading there) and `rolledBoulderM`. Legs gain `zones` (the zones the route touches). `play.quakeSeconds` is 165, the middle of the moonquake window. Stations, readings and boulder photos go through the mission's own `MilestoneTracker`; the seismometer runs `stepSeismometer`, with the rover placed on a straight line between the leg's nodes. A transect touches the zones of the node where it is switched on, and the zones of each leg and node it arrives at. The repricing (Boulder field 60, Mapper 40) landed with the Fresh ejecta credit.

| Target | Result (Phase 3, existing legs) |
| --- | --- |
| Camera scout 930 | **930**, holds |
| Drill geologist 870 (Fresh ejecta at Rocky area 1) | **870**, holds |
| Ice hunter 875 | **875**, holds |
| Empty bay fails by 50 | best empty bay **730**, holds (now a test) |
| Fewer than 35% of affordable builds pass | **86 of 1,414** (6%) on the existing plans, which use only the camera and the drill |
| Empty bay + reflector 750 | **700** on the existing plans: no plan sets the reflector down yet. Waits for Phase 6 |
| Rock hound, Station keeper, Near prospector | Wait for the new sites' nodes and legs (Phase 6) |
| Dark prospector 825 (example) | **Does not hold on the measured legs.** On steel it reaches the crater edge at about 297 s. A titanium version arrives at about 275 s just above the low-energy level, so the low-energy switch-off turns the spectrometer off on the way in, and the count starts again. Phase 6 must check the neutron ice route; one option is to keep the switch-off from ending a transect. |

**World and site placement** *(decided during implementation, Phase 4 of the Moon sites plan)*. The mission screen feeds every new trigger; the sites are placed from the pipeline's `terrain.json` lists (Phase 1).

- **Sites from the pipeline.** Every new place in `sites.json` is now a `pipeline: { list, id }` reference; none is provisional.

  | Site | Pipeline feature | Measured | What changed |
  | --- | --- | --- | --- |
  | NW crater | `young-crater-nw` | (−850, −220), 150 m across, 8.6 m deep, ejecta darker than its surroundings (0.96) | Radius 75 m, not 20. It is **worn, not young**: no fact may claim fresh or bright ejecta for it. It keeps its kind (`young-crater`) for the rules: its boulders, ejecta ring and rock suite |
  | East crater | `young-crater-east` | (−240, −130), fresh (inner wall to 39°), rim radius 45 m, ejecta not clearly brighter (1.01) | Radius 45 m, not 28. No fact may claim bright ejecta for it |
  | SE crater | `young-crater-se` | (200, 685), 1.16 km out, fresh, the brightest ejecta (1.09), radius 40 m | **Replaces West crater** (id `se-crater`), whose candidate has no rim. The candidate at (380, −320) is dropped |
  | Rolled boulder | `boulder-track-1` | Foot (−240, −125) on East crater's floor; wall top (−220, −35), a 92 m run, 32 m drop | The boulder sits at the foot; its track runs from the wall top (`ResolvedSite.track`) |
  | Hidden hydrogen | `low-light-nw` | Inner point (−1105, −400), about 25 m to the patch edge, 39 m to Rocky area 1's cold patch | Centred on the patch's **inner point** (the point farthest inside), not its centroid, which lies 28 m from the cold patch near the crescent's edge. **Zone radius 35 m, not 60** (`hydrogenZoneRadiusM`): a 60 m circle would reach 21 m into Rocky area 1's permanent shadow, against "sunlit but poorly lit, not permanent shadow", and part of it would be closed to a rover without lights. At 35 m the zone stays on lit ground; the meter still reads 40 to 50% in it, above the cold traps' 20% out to about 100 m, and its rise shows from 150 m |
  | Rocky area 1 cold patch | `cold-trap-rocky-area-1` | 52,600 m² outline | The outline replaces the 129 m stand-in circle |
  | East cold trap | `cold-trap-east` | (−130, 120), one 60 m LOLA pixel | Outline from the pipeline |
  | South cold trap | `cold-trap-south` | (−970, 900), one 60 m LOLA pixel; only about 900 m² never lit on the game's 5 m heights | **Kept** as a game site: it is a LOLA permanent-shadow pixel, and the fact text speaks of small cold traps in general, never of its size |

- **Cold zones.** `loadTerrainMasks` requires the sites (the review found an optional argument let a caller silently drop the new traps) and caches by world, cold zone names and cold-trap sites. The East and South traps flood-fill 2,200 m² each from `cold-mask.png`; they freeze an unheated rover and stop a rover without lights at their edge, like Rocky area 1's patch.
- **Boulders.** The mission builds one list and the world draws exactly it: the rocky areas' boulders (each now tagged with its rocky-area site, so it reads that site's rock suite), then `scatterSiteBoulders` (30 per young crater over 1.1 × its radius, and the 3.5 m rolled boulder). NW crater's boulders are sparse over its 82 m spread, as fits a worn crater. *Also fixed:* the mission used to scatter its X-ray targets over `softAreas`, which on Mars are the sand-ripple fields, while the world drew the rocky areas' boulders.
- **The track** is the game's first terrain decal (`world/boulderTrack.ts`): a 2.8 m ribbon draped on the 5 m terrain from the wall top to 2.5 m short of the boulder, a procedural chain of oval imprints, lit by the same Sun masks as the ground. It is meant to read a little brighter than the regolith; in the browser check it reads as a dark dotted chain, still clearly visible from 100 m in sunlight (its tone, `BRIGHTEN`, is a Phase 5 polish item). With the real Sun path the boulder and track sit in shadow.
- **Photos need no light** *(Phase 4)*. No photo milestone checks sunlight (as before for the rim and Earth photos). A boulder is in a photo when its top is inside the frame (`photoFrameMargin`) and the terrain does not hide it from the camera (a line-of-sight test). With the game's Sun path the rolled boulder and East crater's floor stay in shadow the whole mission, so the photo may be dark, but it counts. **Boulder track is earnable from East crater's rim** (the boulder is about 45 m from it, within 80 m), and also from the floor: East crater is ordinary shadow, not a cold zone, so a rover without lights is not stopped there.
- **Stations and Earth** *(Phase 4)*. Crater floors never see Earth, so the reflector cannot be set down on one (it is refused, as anywhere without Earth); the seismometer can. Laser ranging site and Science station need Earth-facing ground, such as the bench between the lander and the East cluster; the rules need no change. The deploy records where the station went down and whether Earth was above the horizon at the rover then; the record carries the station's place. Only the first deploy of each station counts (stations cannot be picked up), so a station set down inside the near-lander zone blocks that station's milestones for the mission.
- **Not in Phase 4.** The second-press confirm near the lander, the "too close" hint and the reflector light's third state (Phase 5: the triggers do not need them; a station set down near the lander simply earns nothing). The survey sites for the new places, the hidden hydrogen's reveal, the fourth lead and site notices (Phase 5 minimap): the minimap still shows only the old sites. Balance legs for the new nodes (Phase 6). *Left to Phase 6:* a rocky area's ejecta ring (1.5 × 200 m) still reaches Rim viewpoint 1, so a drill sample there earns Fresh ejecta sample; shrinking it changes the Drill geologist's plan, so it belongs with the balance pass.

**HUD, minimap and debrief** *(decided during implementation, Phase 5 of the Moon sites plan)*.

- **Site checks** (`rules/siteChecks.ts`). Several milestones are not tied to one site (Fresh ejecta pays once anywhere, Rock collection counts types across sites), so a site's check counts what the rover did there, for the instruments it carries: a young crater or rocky area, every rock type its boulders hold read there (X-ray) and a counted drill sample inside its ejecta ring (drill); a cold trap, surveyed (a switched-on drive of 50 m that touched it, the tracker's transect rule, also after the third stage); the rolled boulder, read (X-ray) and in a photo within 80 m (camera). A rover that can do nothing at a site never shows a check; the hidden hydrogen and the dark crater have none.
- **Rocky areas** are terrain.json features; they take their sites.json id by name, which gives them a site note and a check.
- **Site notices**: "Located: {name}, {note}", then one line per instrument aboard that can act there (bay order), plus the Documented sample line at young craters and rocky areas when the camera and the X-ray spectrometer are both aboard. One line per sentence, shown 8 s instead of 4. NW crater's note says it is old and worn (it is, Phase 4); East and SE say fresh boulders, never bright ejecta. Sites with no note (viewpoints, the dark crater, Mars) keep the plain "Located" line.
- **Legend**: each new entry appears once a site of its kind is on the map, and "All earned here" once a check is drawn (a "Hydrogen-rich ground" entry from the start would hint at the hidden site).
- **Stations near the lander**: the hint shows after the X-ray boulder hint and before the camera hints. Other refusals (moving, powered down, no Earth) are shown before the confirmation is asked, so a second press is never asked for a press that would fail. A reflector without Earth in view gets no too-close hint (its light already says Earth is hidden). A station set down inside gets a "works, but earns no milestones here" notice after its set-down notice. The confirm reads the rover's position; the milestones read the station's (`stationOffsetM`, 1.6 m to the left), so at the 200 m edge a station can go down unconfirmed and still be inside: the notice says so.
- **X-ray**: "New type: n of 5" is a second line of the reading notice, shown for a rock type not read before this mission; 5 is the distinct rocks across the suites.
- **Desk cards** list every milestone whose required instruments include the card's (combos on both), names only. An instrument that earns none keeps "Earns no milestones yet" (the four new instruments on Mars).
- **Debrief groups**: the rover's own milestones first, then one group per carried instrument in bay order (headed by its part name), then "Instruments together" (combos); empty groups are left out; a staged milestone is one line, "Odometer: 2 of 3". The instrument log appends "Earned: ..." to each instrument's last line, and the X-ray adds "Rock collection: n of 5 rock types" once a rock is read. "Not reached" is one flat list in the same order, using the launch build and the records held before the mission.
- **How-to lines** in `milestones.json` hold no numbers: `milestoneHowTo` fills them from the triggers and tuning (a test checks no digit is left). They are not shown in the game yet (M11 and M14 say names only).
- **Spoiler guard test** (`ui/spoilerGuard.test.ts`): every Phase 5 text (notices, lead, HUD lines, legend, desk card names, debrief lines, the tutorial's station lines, the new milestones' how-to lines) is checked for each lesson's key words. Exceptions: the dark crater's map name and "Earth light".
- **The track** is drawn with a multiplicative blend over the ground on screen (`boulderTrack.brighten` 1.25) plus a faint additive glow (`glow` 0.14), so it reads as a continuous, slightly brighter groove lit or in shade. The photo line-of-sight numbers are `milestones.photoLos*`.
- **Flagged:** NW crater is found at the start (its boulder spread is within the 250 m reveal circle of the landing), against "every site hidden at the start"; accepted in Phase 6. The cold trap check copies the tracker's transect rule; a public tracker query would remove the copy.

**Why these, and what was left out.** Clean seismogram is its own milestone, not a stage of Moonquake record, so a noisy record still earns the first one and the lesson explains the gap (M10). There is no neutron-plus-drill combo: it would spell out the "neutron finds, drill confirms" lesson, and Water ice already rewards the pair (M8). Left out: a second Earth photo, a lander portrait (free near the start), drilling in the small cold traps (it would blur the ice story), and a fault scarp photo (only if the pipeline shows the de Gerlache scarp in view, M12).

**Mars extensions** *(decided November 15, 2026, Phase 0 of the Mars plans: Mars M7, M16, M17, M18; built in Mars steps 2 (M17), 4b (types) and 5a (rules); the near-lander zone is now 120 m and site spacing 150 m, from the Moon's generous pass)*. Mars reuses the shared triggers above, one implementation in `rules/milestones.ts`, and adds only these optional fields and values, so every Moon milestone stays valid. Its milestones are in [New Mars milestones](#new-mars-milestones).

| Extension | Why Mars needs it | Rule |
| --- | --- | --- |
| `record.seconds` (Mars M16) | A weather mast rides on the rover, and a dust storm or a night lasts many seconds, not one moment | The instrument was switched on, the rover powered up and **outside the near-lander zone**, for at least that many seconds while the event was active. A power-down pauses the count, as for `transect`. Stations keep the Moon rule (any power state) |
| `RecordEvent` gains `night` and `dustdevil` | Night weather and Dust devil pass | `night`: while it is night (`solClock().isNight`). `dustdevil`: a dust devil passes within `dustDevilSenseM` (150 m) of the rover; `seconds` 0 means at that moment |
| `transect` without `zone` *(decided in Phase 0)* | Long profile is a long drive anywhere | The count runs only while the rover is outside the near-lander zone; the type's `zone` becomes optional. Moon transects all name a zone and do not change |
| `PhotoTarget` gains `crater-wall` and `dustdevil` | Crater wall, Dust devil | `crater-wall`: a young crater's center in frame, the rover between 0.8 and 1.3 times its radius from the center (`craterWallRimBand`). `dustdevil`: a dust devil in frame (Phase 5) |
| A heater requirement met by any heat (Mars M17) | An RTG rover with "No heater" is warm but would fail Night drive's `slots: ["heater"]` | `requires.slots: ["heater"]` counts as met when the rover's total `heat` is above zero. No Moon rover has heat without a heater part, so the Moon does not change |
| Mars zone ids | The new Mars sites | `MarsZoneId` gains `delta-foot`; Mars reuses the Moon's `young-crater` and `hydrogen-anomaly` ids. Validation checks trigger zones per world |
| No `requires.support` (Mars M18) | "Needs the robotic arm" in the debrief | It comes from the instrument's `needs`: an instrument cannot be in the bay without its support part, so there is no second field to keep in step |

- **`reading.sites` stays the Moon's built rule** *(decided in Phase 0)*: a reading counts a new site only at least `sampleSpacingM` (200 m) from earlier ones, as the drill does. The sites plan proposed counting distinct `Boulder.site` values instead; no Moon milestone uses `sites` yet, but the rule is built and shared, and the drill's 200 m rule is one players already know. Remote reading and Organic signals therefore stage on readings 200 m apart.
- **Near the lander.** No Mars instrument milestone counts within the 200 m zone: stations by the Moon's rule, instruments aboard by `record.seconds`, and transects without a zone by the rule above (Mars M19 for later stations).

**Real basis of the new milestones** (checked November 15 against the sources below, some from publisher abstracts; every fact is checked again before it goes into `text.json`):

| Milestone | Real basis |
| --- | --- |
| Cold trap survey | Lunar Prospector's neutron spectrometer found extra hydrogen at both poles (Feldman et al. 1998, Science 281:1496, doi:10.1126/science.281.5382.1496; hydrogen, not proven water); small cold traps are common and may hold ice (Hayne et al. 2021) |
| Hidden hydrogen | LRO's LEND found hydrogen-rich areas near the south pole that do not match the permanently shadowed regions (Mitrofanov et al. 2010). *Placed by design* |
| Ice deposit located | VIPER's neutron spectrometer is designed to find hydrogen in the top meter of soil while driving ([NASA VIPER](https://science.nasa.gov/mission/viper/rover-and-instruments); the depth is from NASA presentations). VIPER has not flown: cancelled in 2024, NASA now plans to deliver it on a Blue Origin lander (NASA release, September 2025) |
| Rock collection | Chandrayaan-3's X-ray spectrometer measured south polar soil as mostly ferroan anorthosite with a magnesium-rich part (Vadawale et al. 2024, Nature 633, 327–331, doi:10.1038/s41586-024-07870-7) |
| Rare rock | Same study: the magnesium-rich material may come from deeper down; rocks that roll down a wall bring material from upslope (Bickel et al. 2020). *Placed by design* |
| Boulder track | More than 136,000 rockfalls mapped in LRO images, most set off by impacts (Bickel et al. 2020) |
| Documented sample | Apollo crews photographed rocks where they lay before collecting them (USGS Apollo 14 and 17 reports; NASA TR R-353, Apollo 12) |
| Fresh ejecta sample | Fresh crater material is less weathered by space and looks brighter (Grier et al. 2001) |
| Moonquake record | The Apollo seismic network recorded moonquakes for years; a strong 1973 shallow moonquake may have come from a fault near de Gerlache crater (Watters et al. 2024, Planetary Science Journal 5:22, doi:10.3847/PSJ/ad1332; where the fault lies relative to the play area is not checked) |
| Clean seismogram | Apollo 17's seismometers picked up many small quakes as the ground heated and cooled (Civilini, Weber & Husker 2023, JGR Planets, doi:10.1029/2022JE007704; worded to avoid the paper's lander signals) |
| Laser ranging site | Apollo's reflectors are still ranged from Earth (Murphy et al. 2010, Icarus 208:31, doi:10.1016/j.icarus.2010.02.015); in December 2023 LRO ranged the small reflector on India's Vikram lander (news coverage citing NASA; "first ever" not claimed) |
| Science station | Apollo 11 left a seismometer and a laser reflector side by side, the Early Apollo Scientific Experiments Package (ALSJ crew handbook) |


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
- **Titan** is always cold and has no useful sunlight. See [The Titan mission](#the-titan-mission).
- Each world has its own random events.

### The Mars mission

*Owner B draft, November 15, 2026.* Items marked decided were decided by Owner B on November 15. The lesson and the mission length are joint decisions in [team-plan.md](team-plan.md#decide-together), so Owner A still needs to confirm them. *Proposed* items are suggestions. Mars parts, unlock tree, ticket tiers and budget belong to Owner A (question 8). Rewards and rates marked "interface" are set together.

*Mars plans, November 15, 2026 (decided in Phase 0; built in Mars steps 1 to 8, November 15 and 16, 2026, on `aon/mars-engineering`; the Owner B items stay provisional, for Chieri's review).* The [Mars rover engineering plan](mars-rover-engineering-implementation-plan.md) and the [Mars sites and milestones plan](mars-sites-and-milestones-plan.md) answer question 8 for the first Mars wave and add the sites and milestones below: [Mars rover design](#mars-rover-design), [New sites and areas of interest](#new-sites-and-areas-of-interest), [New Mars milestones](#new-mars-milestones), [Mars rock types](#mars-rock-types) and [Balance on Mars](#balance-on-mars). Both plans build on Owner B's lesson and mission length, so Phase 0 records them as confirmed for Owner A. Items in Owner B's area are marked **provisional, for Chieri's review**: the user decided we build them ourselves and Chieri reviews them.

**Lesson: energy through day and night.** *Decided; confirmed for Owner A in Phase 0 of the Mars plans.* The Moon teaches mass versus cost. Mars adds a sunlight budget that changes every sol: the Sun sets, nights are cold, and dust dims the panels. Every Mars constraint hangs off this lesson: the night (lights on or sleep), the night cold (the heater), dust and dust storms (solar income), and, through Owner A's part list, solar panels versus a radioisotope power source. Mass versus cost still applies.

| Element | Design |
| --- | --- |
| Length | 10 minutes of play covering 10 sols |
| Site | Jezero crater floor, east of the ancient river delta |
| Day and night | 45 s of day and 15 s of night every sol |
| Cold | Every night, everywhere on the map |
| Events | One dust storm (built); dust on the panels and dust devils (decided November 15, provisional, for Chieri's review) |
| Core puzzle | Getting through the night: battery, power source (panels, arrays or an RTG), heater, lights, and which instruments to run after sunset. The night budget line on the desk shows the cost |
| Communications | A real Mars constraint, designed later; not in the first Mars build |

#### Site: Jezero crater

*Decided:* one fixed site, the one with the clearest and widest data. That is Jezero, where Perseverance landed in 2021.

- **Why Jezero.** USGS made a single seamless 1 m HiRISE elevation model of the landing area for Mars 2020's Terrain Relative Navigation: about 21 km × 21 km (21,400 × 21,488 px, 1.8 GB), all from HiRISE stereo and tied to MOLA. It comes with a 25 cm HiRISE image mosaic and a 20 m CTX elevation model around it. All are public domain and on the [USGS Mars 2020 TRN data release](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic). Gale's merged 1 m elevation model covers a bigger box (about 57 km × 33 km), but it uses HiRISE only where stereo exists and fills the rest with CTX, HRSC and MOLA, so detail is uneven.
- **Detailed play area.** *Proposed:* 8 km × 8 km at 5 m, resampled from the 1 m model. This is the Moon's size and format, so the terrain pipeline and the loader carry over.
- **Distant terrain.** The rest of the HiRISE model, then CTX 20 m, then MOLA, so the rim of the 45 km crater rings the horizon. From rover camera height the Mars horizon is about 3.4 km away.
- **Ground imagery.** The HiRISE 25 cm mosaic, resampled.
- **Landing point.** *Decided (pipeline, November 15):* 18.4529°N, 77.44796°E on the crater floor, 517 m north-northwest of Perseverance's 2021 landing site (Octavia E. Butler Landing, 18.4447°N, 77.4508°E), with a mean slope of 1.3°. REL lands near the site, not on it, and Perseverance's site is a landmark on the map.
- **Sites** *(decided, pipeline)*. Drive distances from the landing, on a 10 m grid with slopes up to 18°:

| Site | What it is | Drive | Source |
| --- | --- | --- | --- |
| Rocky area 2 | A crater about 345 m across and 15.5 m deep; worn (subdued), not fresh (*corrected in Mars step 4b:* the pipeline's freshness test, Mars step 1) | 224 m | The elevation data |
| Rocky area 1 (survey lead) | A block field just south of Perseverance's site | 744 m | Published maps |
| Séítah entry | A ridged rock unit with sand ripples | 1,230 m | Traced on HiRISE, guided by published maps (±100 m) |
| Delta viewpoint (Delta layers) | Faces a 48 m cliff of the delta front | 1,482 m | Delta front at the foot of the cliff in the HiRISE model |
| Delta front sample point | At Hawksbill Gap | 2,501 m | Published maps |
| West sunset viewpoint | On the delta top, facing the setting Sun (azimuth 261°) | 3,616 m | The elevation data |

- **Soft ground** *(decided, pipeline)*. Only Séítah and a 150 m margin around it (0.86 km²), from ripples detected in the HiRISE image and those mapped by Crumpler et al. (2023). Real ripple fields elsewhere, such as at the delta front, stay firm ground for now. The ripples use the Moon's sinkage and slip rules. Spirit was stuck in sand at "Troy" in 2009 ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#terrain-sand-rocks-slopes)).
- **Western horizon.** From near the landing, the crater rim stands about 5° high in the west, so the Sun sets behind it. The Blue sunset photo counts anywhere at least 300 m from the lander, so the far sunset viewpoint is optional.
- **Season.** *Proposed:* early northern autumn (Ls about 200), the start of the dust storm season, so a storm is realistic. At 18°N, day and night are close to equal then.

##### New sites and areas of interest

*Decided November 15, 2026, in Phase 0 of the [Mars sites and milestones plan](mars-sites-and-milestones-plan.md#2-sites-and-areas-of-interest); provisional, for Chieri's review (level layout and placement are Owner B's). Built in Mars steps 4b to 6 (data, boulders and survey, world, minimap); Mars step 7 added the WSW and SW craters near the landing.* The map had nothing to the east, no contact targets except the two rocky areas' boulders, no slopes for the arm lesson and no hydrogen for the neutron spectrometer. The new sites give every Mars instrument a target within about 1.5 km of the landing, most within 1 km (density over distance), in three clusters in three directions. Positions are candidates from a quick offline scan of the game's own 5 m Mars layers; the pipeline confirms or replaces them (requests below).

| Kind | What it is | Real basis | Instruments it serves |
| --- | --- | --- | --- |
| Young crater | A small fresh crater (100 to 350 m across) with a blocky rim (*decided during implementation, Mars step 1:* the pipeline found blocky rims and sand-filled floors, and no crater within 1.6 km keeps a blocky ejecta blanket). East crater is one; Rocky area 2 is not fresh by that test | Fresh craters on the Jezero floor carry blocky ejecta in HiRISE images; craters dig up rock from about a tenth of their width down (Melosh 1989, *partly checked*) | Radar, X-ray, organics, laser, camera (the crater wall) |
| Séítah edge | Séítah's north boundary at the Brac sample site, with olivine boulders on firm ground beside the ripples | Perseverance sampled Séítah's olivine cumulate at Brac (Liu et al. 2022) | X-ray, organics, drill, radar, neutron |
| Delta foot | The nearest 400 m of the delta scarp's foot, where blocks fallen from the delta lie on firm ground; a 50 m zone (`delta-foot`), not the 150 m `delta-front` zone | The delta's layers were laid down in the lake (Mangold et al. 2021); Perseverance cored delta mudstone there in 2022 | Drill, organics, X-ray, laser (the cliff), radar, neutron |
| Flood boulder | One 2.5 m boulder on the delta foot's lower slope, readable from its level downhill side; the only flood conglomerate | Boulders up to about 1.5 m in the delta's top layers record floods (Mangold et al. 2021). *Placed by design* | X-ray (rare rock), camera |
| Hydrated ground | A small buried patch where the neutron meter reads highest; never drawn until found | Crater-floor rocks hold water-made salts and carbonate (Scheller et al. 2022; Tice et al. 2022). *Placed by design* | Neutron |
| Slope targets | Boulders on 10 to 18° ground (steeper than the arm's limit, still drivable), each with level ground within a few meters | Perseverance's PIXL and SHERLOC must sit close to the rock | X-ray and organics (the arm lesson), laser |

*Decided during implementation (Mars step 1; pipeline MP1 to MP4 and MP6 built in `game/tools/mars_sites.py`, provisional, for Chieri's review):* a Mars young crater is fresh when its rim is round, raised and blocky (boulder shadows in the 25 cm HiRISE mosaic). Of 22 craters 80 to 400 m across within 1.6 km, two pass: East crater (1,820, −720; 330 m across, 19 m deep) and a crater northeast at (1,640, −1,445), not in the plan (Chieri to decide whether it joins the east cluster). Rocky area 2 (345 m across, 15.5 m deep) and the other plan candidates are not fresh; (310, 70) is dropped. The knobs are at (305, −825) and (635, 445); the delta foot's nearest 400 m runs from (−425, −1,285) to (−634, −940), with the flood boulder at (−435, −1,290); Perseverance's sites in the area are Brac, Roubion (the first sample attempt, sol 164), Issole and Rochette, and Wright Brothers Field is at (1,008, −18). Sample names and sols are not fact-checked yet.

| Cluster | Sites (candidate local x, z; distance from the landing) | Character |
| --- | --- | --- |
| **Delta route** (WNW) | Rocky area 2 (430, −755; 484 m; measured about 300 m across and 14 m deep, near rim 335 m out); its NW inner wall and the knob at (305, −835) as slope targets; the delta foot (−449, −1,252; 1,493 m) with the flood boulder; the delta viewpoint (unchanged) | The long, rich trip: Delta layers, the delta's rocks and the only rare rock |
| **South cluster** | Small crater S (870, 70; 561 m); Rocky area 1 (703 m; 96% under 8°, the level contact targets); small crater SSE (1,115, 295; 833 m); the hydrated ground near (780, 420; about 910 m; designer's choice on firm, level ground); the Séítah knob (620, 445; 959 m) as slope targets; the Séítah entry at Brac (550, 620; 1,146 m) | Dense and level: five stops within 1.15 km, the hydrated ground and the Séítah samples |
| **East** | East crater (1,815, −720; 1,007 m; about 340 m across, 20 m deep, walls to 24°, rim knobs); small crater ESE (1,760, −195; 971 m) | Deep and steep: a crater wall to photograph, steep rim knobs, buried ejecta. It gives the neutron spectrometer nothing, on purpose |

- **The clusters are 1 to 2 km apart.** A run does one cluster well, or one plus Rocky area 2. The delta front stays the one far destination: its nearest edge is 1.34 km away, Hawksbill Gap 2.5 km. Séítah's near edge has no ground steeper than 16.5°, so the slope targets go at Rocky area 2, the two knobs, East crater's rim and the delta foot.
- **On the minimap** (the Moon's rules: hidden until the reveal circle touches a site, then drawn with a "Located" notice). Young craters show as a ring; the delta foot as a thicker stretch of the delta line; the flood boulder as a boulder icon; a site gets a small check once every milestone this rover can earn there is earned. The hydrated ground is **never drawn until found**: only the neutron meter leads to it, and it is drawn as a dotted "Hydrated ground" area once its milestone fires. Slope targets are boulders at the sites above, not separate marks.
- **A fourth survey lead,** "Young crater" (HiRISE images), points at East crater, so the east is not empty for first-time players (MS6: if the pipeline finds East crater is not fresh, use the ESE crater and no lead). The three built leads stay. Rocky area 2 needs no lead: its rim is found in the first minute.
- **Site notices are instrument-aware but lesson-blind:** they name the site and, only for instruments aboard, what they can do there ("East crater: a fresh crater with blocky ejecta. X-ray spectrometer: read the rocks."), and never say "slope", "level", "flat", "steep", "dust", "noise" or "generator".
- **Boulders at the new sites.** Today 160 boulders per rocky area and nothing else. Added: 30 per young crater (60 at East crater) spread at 1.1 times the radius, 40 at the Séítah edge (firm ground only), 40 along the delta foot, 15 at each knob, and the flood boulder. Boulders get their `site` and skip soft ground. A share of the young-crater and knob boulders sits on 10 to 18° cells with level ground within reach (the slope targets).
- **Design choices go in a Mars `sites.json` overlay** (the Moon's `SitesFile` shape): which crater is East crater, the hydrated ground's position, the flood boulder, each site's rock suite and display names. No new image layers. Not sites: weather (the weather mast's milestones come from events) and Wright Brothers Field (nothing on the ground to see; at most a briefing line, MS12).
- **Pipeline requests** (Mars terrain pipeline, additions to `terrain.json` `features`): MP1 young craters 80 to 400 m within 1.6 km, freshness checked on the 25 cm mosaic, and Rocky area 2 re-measured; MP2 slope-target cells (10 to 18° within 5 m of ground under 8°); MP3 the nearest 400 m of the delta foot and a spot for the flood boulder (12 to 18° uphill, under 10° within 3 m downhill, outside the 1,350 m ring); MP4 Perseverance's abrasion and sample sites within 1.6 km as landmarks; MP5 drive legs between the new nodes for the hand estimates (no Mars `winPaths`); MP6 optional, Wright Brothers Field and the backshell.

#### Time: 10 sols in 10 minutes

*Decided; the length is confirmed for Owner A in Phase 0 of the Mars plans.* This replaces the earlier proposal of 20 sols at 30 s: 20 nights of 15 s would ask the lights-on-or-sleep question every 30 seconds.

- **60 s per sol:** 45 s of day (dawn to dusk), then 15 s of night. Night is time-lapsed three times faster than day. Like the Moon's speed compression, this is a game-feel choice: real rovers sleep through most of the night. Night adds up to 150 s per mission.
- **The player sits through the night.** There is no skip.
- **No clock,** as on the Moon. The Sun follows the real path for Jezero's latitude and the chosen season.
- **The mission starts in the morning.** *Decided (main, fix pass, November 15):* the first sol starts with the Sun about 15° up, 7.25 s after sunrise, because a start at sunrise read dark and gloomy for the first seconds. Every sol still has 45 s of day and 15 s of night. Sol 1 is 7.25 s shorter, and the mission still lasts 10 minutes, so it ends 7.25 s after the dawn that follows the tenth night. Sol numbers change at dawn.

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
- *Decided November 15 (Mars plans):* the heater choice on Mars is three-way: radioisotope heater units (heat 2, no draw, 60 / 3 kg), the electric heater (heat 3 while its 1.2/s draw is paid, 25 / 2 kg) or an RTG's waste heat (heat 2, counts as a heater, Mars M17). See [Mars rover design](#mars-rover-design). The electric heater's heat counts only while the battery can pay its draw, so an empty battery means freezing too.
- *Decided during implementation (Mars step 2; built in `rules/cold.ts` `heatNow`; provisional, for Chieri's review):* "paid" means the battery is above zero. The heat that stops is the heat of the parts that draw for it (`heaterDraw` above 0); heater units' and an RTG's heat always count. An empty battery also ends the mission as out of energy, so today this only matters within the step that empties it; the rule is there so the freeze meter and the HUD's freeze rate agree if that ever changes.

#### Dust and events

The dust storm is built (see [How the Mars rules work](#how-the-mars-rules-work-decided-during-implementation-m3)). Dust on the panels and dust devils are *decided November 15 (Mars M8, MS8), provisional, for Chieri's review*, and built (rules in Mars steps 1c and 2, the column in 6a, the photo and the weather mast's pass in 5a and 6b, the power line's dust share in 6c); the marsquake waits for a later wave. Solar flares and moonquakes stay on the Moon.

| Event | What happens | Player response | Real basis |
| --- | --- | --- | --- |
| Dust on the panels | Solar income falls a little every sol as dust settles (compressed, as time is) | Plan for less power later, or rely on a radioisotope source | Dust settles steadily on real panels ([rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#dust-devils-and-cleaning-events)) |
| Dust storm | One regional storm per mission, announced a sol ahead by an orbital weather report. For about 2 sols solar income falls to about a third, nights are milder, and more dust settles. | Charge up beforehand, sleep through it, drive less | 2018: Opportunity's power fell from about 645 Wh to about 22 Wh per sol in about a week (June 1 to about 8), at a record dust opacity of 10.8; contact was lost by June 10 (Planetary Society; corrected from "in 10 days" in Phase 0 of the Mars plans, for Chieri's review). MRO's MARCI camera maps Mars weather daily. |
| Dust devil | A random devil sweeps past and cleans the panels | A free power boost; a camera can photograph it, and a weather mast can record it | A cleaning event around sol 420 (March 2005) sharply raised Spirit's solar output. Sources disagree on the gain, so the text names no percentage (corrected in Phase 0, for Chieri's review) |
| Marsquake (later wave) | The Moon's quake rule reused | As on the Moon | InSight recorded marsquakes, including a magnitude 4.7 in 2022 |

**How dust works** *(decided November 15, Mars M8 and MS8; provisional, for Chieri's review; numbers are starting values for the Mars balance phase)*:

- **Dust settles every sol.** Each solar power part loses a share of its income per sol, `tuning.dust.perSol` (starting value 3%) times the part's `dustRate`: fixed panel ×1, solar mast ×0.8 (it stands higher), deployable arrays ×1.5. During the dust storm dust settles three times as fast. The RTG has no `energyIncome`, so dust never touches it. The rate is compressed like time: the real rate is about 0.2% of output per sol, too little to feel in ten sols, so the text says dust settles steadily, never how fast.
- **The HUD's energy income line shows the dust factor.** The desk shows no `dustRate`: part descriptions say "more income" and "stands higher", never "less dust" (the dust lesson's spoiler guard).
- **Dust devils** are a random event drawn as a moving dust column. Most missions show at least one within 300 m of the rover (MS8; starting value: on average one every 3 sols; real Jezero has about four whirlwinds per sol, Newman et al. 2022). A dust devil that passes within `dustDevilCleanM` (starting value 50 m) of the rover resets its dust factor to clean. The camera can photograph one (Dust devil) and a switched-on weather mast can record one passing within 150 m (Dust devil pass).
- **The dust lesson** happens when dust has cut solar income by a set share (starting value 15%); see [Mars rover design](#mars-rover-design).
- *Decided during implementation (Mars step 1; rules built in `rules/dust.ts`, not wired into the mission yet; provisional, for Chieri's review):*
  - Dust settles all the time, day and night, as a straight-line share of the clean income (not compounding); the storm's ×3 follows the storm's intensity.
  - The dust factor never falls below `tuning.dust.minFactor` (starting value 0.25): dimmed panels keep working. With one storm and no cleaning, the arrays end near 0.37 and a fixed panel near 0.58, so the floor is a safety guard.
  - A rover's dust rate is its solar parts' `dustRate`, weighted by their income; a solar part without one counts ×1.
  - A dust devil that passes within `dustDevilCleanM` (50 m) resets the dust factor to 1. `dustDevilCleanM` and `dustDevilSenseM` (150 m) live in `tuning.dust`.
  - Dust devils form by day only, 8 to 24 s after sunrise, and last 20 s at 4 m/s. Each run of 3 sols gets one devil on a random sol of the run (3 per mission, a fourth one time in three). Each passes the point where the rover was when it formed, halfway through its life, at a random distance up to 300 m (uniform), so a rover that stands still is cleaned by about one devil in six, about 45% of missions.
  - Open for Chieri: devils can form during the storm (real ones are rarer then); and a devil is visible and slow, so a player can drive to it, which makes "a route past dust devils" (Mars M14) partly a plan rather than luck.
- *Decided during implementation (Mars step 2; wired into the energy step in `rules/mission.ts`; provisional, for Chieri's review):*
  - **The dust factor** lives in the Mars mission state (`MissionState.mars.dustFactor`). A step's solar income uses the factor at the start of the step, then dust settles (or a devil cleans). It multiplies `energyIncome` only: steady income (an RTG) never. The storm's ×3 follows the storm's intensity at the start of the step. Dust settles on every rover, but a rover without solar income has a dust rate of 0, so its factor stays 1.
  - **The HUD gets the factor separately:** `MarsStatus.dustFactor`, not folded into `solarFactor` (low Sun × storm), so the dust factor on the energy line (step 6c) can show it alone. *(Built in step 6c: the power line's "dust −n%".)*
  - **Every solar part says its dust rate.** On a world with `tuning.dust`, validation requires a `dustRate` on every part with `energyIncome`, and refuses a `dustRate` on a part without it. The fixed panel (1) and the solar mast (0.8) carry theirs in the shared `parts.json` (the Moon has no dust, so it ignores them). `roverDustRate` keeps its ×1 for a solar part without a rate, which only test fixtures can reach now.
  - **Dust devils are scheduled from their own stream:** `marsSetup` seeds it with one draw from the mission's generator after the storm, so every seed keeps its storm. The schedule is in `MarsSetup.devils`.
  - **Placement and cleaning are wired.** The mission screen gives the rules step the rover's position (`MissionSample.position`); a devil whose forming time falls in a step is placed relative to that position, and one passing within `dustDevilCleanM` along the step (both moving in straight lines) resets the factor to 1. The placed devils stay in `MissionState.mars.devils`, for the renderer (6a) and the Dust devil milestones (5a/6b). A step without a position places no devil, so the night-energy check (`marsNight.test.ts`) runs with dust but without devils.
  - **No cleaning notice yet.** A clean happens silently until the HUD shows the dust factor; the notice ("A dust devil cleaned the panels") and the column belong to steps 6b and 6c.
  - *Decided during implementation (Mars step 8):* **no cleaning notice.** The column (6a) and the power line's dust share (6c) are built; the share dropping back is the signal. A notice that the panels were cleaned would name the dust lesson's answer, which the spoiler guard bans ("clean" near panels), so none was added.

#### How the Mars rules work *(decided during implementation, M3)*

The rules are in `game/src/rules/` (`sol.ts`, `marsSun.ts`, `storm.ts`, and the Mars parts of `energy.ts`, `cold.ts`, `mission.ts`). The numbers are in `game/data/mars/tuning.json` (`sol`, `night`) and `events.json` (`duststorm`). All numbers are placeholders, tuned against the Moon parts.

- **Sol clock and Sun.** The clock starts at sunrise on sol 1, and the mission starts 7.25 s later, with the Sun about 15° up (`sol.startSecondsIntoDay`, see [Time](#time-10-sols-in-10-minutes)). The Sun follows real local solar time at Jezero:
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
  - Sleep ends at dawn by itself. An empty battery ends the mission as out of energy. The radioisotope heater draws no power. *(Built in Mars step 2:)* the lights' 3/s is the LED part's `lightsDraw`, and an electric heater part (step 3) will draw 1.2/s every night, asleep too; see the power model below.
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
  - With the Moon parts, the heater is effectively required. The heater choice becomes real only with Owner A's Mars catalog (decided November 15: see [Mars rover design](#mars-rover-design)). *(Decided, Mars plans:)* the check grows to cover an RTG build, an arrays-and-larger-battery build and an organics build, each over the storm seeds; it stays the Mars regression and energy check, since Mars has no `winPaths` (MS13).
- **Parts own their power draws** *(decided November 15, 2026, Mars M1; built in Mars step 2, provisional, for Chieri's review)*. The night drain stops being three world constants: the world keeps only the electronics draw, which every rover has whatever its parts, and everything else moves onto parts. These effects apply only on a world whose tuning has a `night` section (Mars); the Moon's LED keeps drawing nothing.

| Draw | Where it lives | When it applies |
| --- | --- | --- |
| Electronics, awake | `night.awakeDrainPerSecond`, 1/s (unchanged) | Awake at night |
| Electronics, asleep | `night.sleepDrainPerSecond`, 0.2/s (unchanged) | Asleep at night |
| Lights | Part effect `lightsDraw` (LED floodlights 3/s) | Awake at night on a rover with lights (the floodlights are on) |
| Electric heater | Part effect `heaterDraw` (1.2/s) | Every second of night, awake **and asleep** (a survival heater keeps running) |
| Instrument standby | Part effect `standbyEnergy` (exists) | Switched on and powered up, day or night |
| RTG income | Part effect `steadyIncome` (0.6/s) | Always, day and night; never scaled by sunlight, the low Sun, the storm or dust |

  - **Same numbers today.** With today's parts (LED 3/s, heater units 0) the model gives exactly 4 / 1 / 0.2, so `marsNight.test.ts` must pass unchanged; `night.lightsDrainPerSecond` goes away.
  - **Why only at night.** A panel's `energyIncome` is effectively net: the daytime draw is folded into its rating (the Moon has no idle drain). At night, with no solar income, the hidden draw appears. The rules say so in a comment.
  - **Caps.** Standby keeps its rule (never below the low-energy warning, then it switches off). Lights and heaters are not capped: they keep the rover driving and alive, and an empty battery at night ends the mission, as today. The electric heater's heat counts only while its draw is paid.
  - *Decided during implementation (Mars step 2):*
    - `PartEffects` gains `lightsDraw`, `heaterDraw`, `steadyIncome` and `dustRate`. `missionSetup` sums them once into `MissionSetup.power` (with the electric heat and the rover's dust rate), and `deployPart` sums them again. `rules/energy.ts` `nightDraw` replaces `nightDrainPerSecond`: electronics (awake or asleep) + the lights while awake on a rover with lights + the heater draw.
    - **Steady income is Mars-only for now, like the draws:** it applies only where `tuning.night` exists, as this section says of all these effects. No Moon part has one; a Moon RTG would need the Moon balance pass that turns the draws on there.
    - **The lights draw when they are on:** awake at night on a rover with lights (`lightRange` above 0), the same rule as the floodlights in the scene. A rover without lights draws only the electronics.
    - **The heater requirement met by any heat (Mars M17)** is built in `rules/rover.ts` `meetsRequirements`, which the milestone tracker and the debrief's missed-part list use, so it needed no change in `rules/milestones.ts`. No Moon rover has heat without a heater part, so the Moon does not change.
  - **Real basis.** Real rovers spend power at night just to stay alive: Opportunity needed about 120 Wh per sol and Spirit about 180 Wh; Curiosity is said to draw about 45 to 70 W asleep and 150 W or more awake (single-sourced, unverified). The game's 5:1 ratio between awake and asleep is steeper than Curiosity's reported 2 to 3:1. That is a game choice that makes sleeping clearly worth it, and the text does not claim the ratio is real.

#### Mars rover design

*Decided November 15, 2026, in Phase 0 of the [Mars rover engineering plan](mars-rover-engineering-implementation-plan.md) (Mars M1 to M19). Built in Mars steps 1 to 3 (the catalog per world, the power model, the parts, support hardware and tiers), step 4a (the four Mars instruments' behavior, the arm's slope refusal and the mast's wider photo zones), step 5 (the RTG's neutron noise, the Mars lessons), step 6 (desk cards, debrief, mission wiring) and step 8 (the tutorial pages on power at night and on the arm and mast, and credits for the new parts).* This answers open question 8 for the first Mars wave. Costs, masses and sizes are the Mars M11 prices: indicative, and revisable in a later balance patch. Energy numbers the plan did not give are **starting values set in Phase 0**, tuned in the Mars balance phase. The RTG's heat and the electric heater are interface numbers: they depend on Owner B's freeze rate (8/s at night, 1.5 off per heat unit).

**One catalog, offered per world** (Mars M2, M5, M10).

- Each part may say which worlds offer it (`Part.worlds` in `parts.json`; absent means every world). The laser retroreflector and the seismometer station are Moon only, since Mars has no Earth in the sky and no marsquake yet. Every new part in this section is Mars only, so the Moon desk does not change.
- `loadGameData(world)` filters the catalog, and validation checks that each world has at least one option in every required slot.
- A Moon build carried to Mars loses the parts Mars does not offer, and the desk says so in one line ("Not offered on Mars: Laser retroreflector") instead of dropping them silently.
- Every Mars part is offered from the start until the unlock tree is decided (question 3).
- Relationships carry a world (`Relationship.world` takes any world id). The mission and the review use only the current world's. The notebook lists each world under its own heading with its own count, so the Moon's lessons stay readable on Mars (decided November 15, 2026; see below).
- *Decided during implementation (Mars step 1; built):*
  - **Data.** A world's `GameData.parts` is what that world offers; `GameData.allParts` keeps every world's parts (with that world's wording from `text.partText`), so the desk can name a part a carried build loses and validation can check references. `GameData.world` says which world the data is for. `relationships.json` stays one list for every world; the mission and the review filter it by `GameData.world`, and the notebook groups it by world.
  - **Validation.** Each part's `worlds` is a non-empty list of known world ids, part ids are unique across the whole catalog, every world has at least one part in each bus slot, and each relationship's parts are offered on its world.
  - **The dropped-part notice** shows on the desk while the carried design names parts the world does not offer: the build on the desk, or the last rover bought (`lastBuild`, so a reload shows it too). It goes away once a rover is bought on that world. Names use the world's wording. If the drop empties a bay that held something, the bay is left unconfirmed so the player chooses again (the existing save rule). The line is `text.design.notOffered`, reworded per world in the world's text overlay.
  - **No Moon lesson on Mars.** A Moon relationship's event is dropped on Mars before it is met, so it gives no notice, debrief lesson or notebook entry. Where the Moon's slowdown or speedup still happens on Mars (the cold slowing a held use, the X-ray reading faster in shadow), the short line shows every time instead.
  - **The notebook: all worlds, one heading per world** *(decided November 15, 2026, by the user; replaces the step 1 interim "current world only")*. The notebook shows one section per world, in campaign order, from the Moon through the current world (plus any later world that already holds a lesson): a heading ("Moon lessons", "Mars lessons"), that world's count ("2 of 5 found"), and its entries. Lessons learned on the Moon stay readable on Mars; they still never fire, enter the debrief or show in the review there. A world with no lessons in the data yet (Mars until its relationships land) shows its heading with no count. A world with none found yet says so under its heading once any lesson is found; before any is found, the notebook shows only the empty line under the headings. Rules: `rules/relationships.ts` `notebookWorlds`; text: `text.json` → `notebook.worlds`, `count`, `worldEmpty`.

**Bus parts on Mars.** The Moon's bus parts carry over, and these are added:

| Part | Slot | Cost / mass / size | Effects | What it teaches |
| --- | --- | --- | --- | --- |
| Radioisotope generator (RTG) | Power | 200 / 15 kg / 5 | `steadyIncome` 0.6/s day and night (about 36 per sol, a fixed panel's clear sol); `heat` 2 (waste heat); neutron noise | Power that does not care about night, dust or storms, at a high price and mass |
| Deployable solar arrays | Power | 120 / 14 kg / 5 | `energyIncome` 2.6; `dustRate` 1.5 | The most income in sunlight, the most lost to dust |
| Larger battery pack | Battery | 150 / 12 kg / 3 | `batteryCapacity` 900 | Carry the night instead of sleeping through it |
| Electric heater | Heater | 25 / 2 kg / 1 | `heat` 3 while its draw is paid; `heaterDraw` 1.2/s every night, asleep too | Cheap and light, but it spends the battery every night |
| Grouser wheels | Wheels | 110 / 18 kg / 5 | More grip on Séítah's sand, slower than wire mesh (starting values: base speed 2.6 m/s, grip 0.95, 0.22 energy/m) | The Séítah crossing |

- **Moon parts on Mars.** The fixed panel has `dustRate` 1 and the solar mast 0.8 (it stands higher). The LED floodlights gain `lightsDraw` 3/s, on Mars only. The radioisotope heater units are unchanged (heat 2, no draw).
- **The RTG's waste heat counts as a heater** (Mars M17). Heat is summed over all parts, so an RTG rover with "No heater" freezes no faster than one with heater units, and saves 60. Any total heat above zero meets a milestone's heater requirement (Night drive). That is real: the MMRTG's heat runs a fluid loop that keeps Curiosity's electronics warm.
- **The RTG's income is a balance choice, not the real ratio.** A real MMRTG gives about 2,700 Wh per sol (roughly 110 to 120 W electric at the start, about 2,000 W of heat, about 45 kg), three to four times a new MER array. The game sets it to one fixed panel's clear sol so it does not solve Mars by itself; the balance phase can raise it if the RTG is never picked. Text quotes a range, never one figure.
- **Not in this wave:** a rocker-bogie chassis (waits for a mobility pass), a phase-change heat store, communications and computer parts.

**Support hardware** (Mars M5, M6, M18). Two new optional slots, offered only on Mars; the Moon's slot list does not change.

| Part | Slot | Cost / mass / size | Effects |
| --- | --- | --- | --- |
| No arm / Robotic arm | `arm` | 0 / 0 / 0 · 60 / 8 kg / 2 | Contact instruments need it |
| No mast / Remote sensing mast | `mast` | 0 / 0 / 0 · 50 / 4 kg / 1 | The laser spectrometer needs it; the camera's photo zones grow (`photoRangeFactor`, starting value 1.5) |

- Instrument parts gain `needs` (`arm`, `mast`). The desk refuses an instrument whose support part is missing, with a reason ("Needs the robotic arm"), and greys its card as a full bay does.
- **The X-ray spectrometer needs the arm on Mars only** (Mars M6). On the Moon it keeps Pragyan's built-in deploy mechanism. This one per-world effect lives in a small overlay, `data/mars/parts.json`, not in a second part. With the arm, the X-ray costs about 120 and 10 kg on Mars.
- Support parts take no mounting point (the bay's limit is for instruments only). *(Superseded November 16: see [Payload: instruments and systems](#payload-instruments-and-systems).)* `Build.support` is optional, so every Moon build and save stays valid.
- Milestones have no support requirement of their own (Mars M18): the debrief's "needs the robotic arm" comes from the instrument's `needs`.
- **Real basis.** Curiosity's and Perseverance's arms are about 2.1 to 2.2 m long, with turrets of 33 kg and 45 kg. The game scales every part down (the Moon's drill is 8 kg).

**Instruments on Mars** (Mars M3, M4). The Mars bay offers eight instruments: four carried over and four new.

| Instrument | On Mars | Verb | Cost / mass / size | Energy (new ones: starting values) | Needs |
| --- | --- | --- | --- | --- | --- |
| Science camera | Carries over | Look | 50 / 3 kg / 1 | None | |
| Regolith drill ("rock drill" on Mars) | Carries over | Dig | 90 / 8 kg / 3 | 10 per sample | |
| X-ray spectrometer | Carries over | Touch | 60 / 2 kg / 1 | 3 per reading | Arm |
| Neutron spectrometer | Carries over: it has Mars hydrogen to find (Mars M3, provisional, for Chieri's review) | Sense while driving | 80 / 4 kg / 2 | 0.1/s while on | |
| Weather mast | New | Monitor | 60 / 5 kg / 2 | 0.05/s while on | |
| Ground-penetrating radar | New | Sense while driving | 90 / 3 kg / 2 | 0.1/s while on | |
| Laser spectrometer | New | Zap from a distance | 100 / 6 kg / 2 | 8 per reading, 2 s held | Mast |
| Organics spectrometer | New | Touch, slowly | 110 / 4 kg / 2 | 1.5 per second of a 20 s hold (30 per reading, the biggest single cost on the desk) | Arm |

- **Weather mast** (a switch): once it has been on for a while, the storm forecast comes earlier (`stormEarlyWarningSeconds`, starting value 30 s, so 90 s ahead instead of 60), the forecast notice credits the mast, and the HUD shows a pressure and dust trend. This touches Owner B's storm forecast: provisional, for Chieri's review. Real: Perseverance's MEDA and Curiosity's REMS keep weather records.
- **Ground-penetrating radar** (a switch): a strip under the meters draws the buried layers along the path just driven, with layer content from the zone under the rover. A straight, steady drive gives a clean profile; sharp turns and stops break it. Real: RIMFAX imaged layers beneath Jezero's crater floor (Hamran et al. 2022). Text does not say "the delta" until that is checked.
- **Laser spectrometer:** a target marker on the nearest boulder, or the delta cliff, in a cone ahead within `reachM` (starting value 12 m, four times the X-ray's 3 m); a short hold; the reading reports the rock as the X-ray does, with the same rock types. Real: SuperCam's laser analyzes rocks up to about 7 m away (CNES).
- **Organics spectrometer:** a long hold with a progress bar, its energy drawn as it runs. It pauses while the rover is powered down, as held uses do. It reads no rock type. Real: SHERLOC detected signals consistent with organic molecules in Jezero rocks; it identified no specific compounds, and non-biological sources are not ruled out (Sharma et al. 2023). Text never says "found organic molecules" or "signs of life".
- **Contact readings and slopes** (MS2): the X-ray and organics spectrometers refuse to read when the ground under the rover is steeper than **10°**, with a notice that names the slope. Ground stays drivable to 18° (the steep-slope warning; damage starts at 20°), so the arm lesson has a 10 to 18° band in which it can happen.
- The debrief's instrument log gains the four. Each new instrument gets a mission history fact, fact-checked before it goes into `text.json`.
- **Not in this wave:** instrument levels (multispectral camera, deep drill, active neutron spectrometer, broadband seismometer) and the rest of the catalog (magnetometer, microscopic imager, penetrometer, dosimeter, dust monitor, heat flow probe, oxygen maker, coring drill and cache). They come once the first wave plays well.

*Decided during implementation (Mars step 3; built):*

- **Data.** Every Mars part is in `data/parts.json` with `worlds: ["mars"]` and its Mars wording there (ids `power-rtg`, `power-arrays`, `battery-large`, `heater-electric`, `wheels-grouser`, `arm-none`, `arm-robotic`, `mast-none`, `mast-remote`, `instrument-weather`, `instrument-radar`, `instrument-laser`, `instrument-organics`). `data/mars/parts.json` is the parts overlay: `supportSlots: ["arm", "mast"]` and effects by part id (the X-ray's `needs: ["arm"]`). The robotic arm and the mast carry `arm: true` and `mast: true`; "No arm" and "No mast" carry nothing. The RTG carries a `neutronNoise: true` flag that nothing reads until step 5b, and the desk never shows it. Support slot names and the "Needs the robotic arm" wording are in `data/mars/text.json` (`slots`, `support`).
- **Support slots are a choice like the lights.** On Mars the desk shows Arm and Mast after the bus slots, and a build is complete only when both are chosen ("No arm" counts), so `missingSlots` names them. Support parts come after the bus parts and before the bay in the part list, and take no mounting point. *(Superseded November 16: see [Payload: instruments and systems](#payload-instruments-and-systems).)*
- **Needs on the desk.** An instrument whose support part is missing (or not chosen yet) has its card greyed with the reason as for a full bay, and every instrument with `needs` says so on its card ("Needs the robotic arm."). If the arm is taken away while the X-ray is in the bay, the X-ray stays in the bay (so the player can put the arm back), the warnings say "X-ray spectrometer needs the robotic arm. Choose it, or take the instrument out of the bay.", and the build cannot continue to the ticket (the ticket screen gives the same line).
- **Desk numbers.** The RTG's card shows "Steady income 0.6 energy/s, day and night", the electric heater's "Heat output 3 · draws 1.2 energy/s every night". On Mars "No heater" reads "Without another source of heat the rover freezes in its first night", since an RTG keeps it warm.
- **The four Mars instruments as data until step 4a** (superseded: see step 4a below). The weather mast (0.05/s) and the radar (0.1/s) are switches; the laser spectrometer is an 8-energy reading with a 2 s hold; the organics spectrometer is charged its 30 at the start of a 20 s hold until step 4a charges 1.5 per second of the hold. A rover carrying them launches and runs; their readings give no result yet, and the mission's controls line says "no results yet in this version". On Mars the card line is "Earns no milestones yet." (the shared line also promises an instrument log entry, which the new instruments do not write yet). The mast's `photoRangeFactor` waits for step 4a. *Flagged:* if step 3 ships before step 4a, players can pay energy for readings that do nothing; the controls line says so.
- **Grouser wheels and the electric heater** use the starting values above (grouser 2.6 m/s, grip 0.95, 0.22 energy/m; heater heat 3, 1.2/s), and the RTG heat 2: provisional, for Chieri's review (Owner B items B11, B12).
- **Build preview and rover model.** The RTG is a finned cylinder leaning out behind the rover, the arrays are two wings beyond the wheels, the mast has a white head with a large lens near the front left, the arm folds across the front right with its turret pointing down, and grouser wheels have tall cleats. The four Mars instruments have simple placeholder looks. The gold blanket shows for any part with heat (heater units, the electric heater, or an RTG's waste heat).
- **Validation.** The world's support slots are known, listed once and each has a part; only an arm-slot part may be an arm (and a mast a mast); each instrument's `needs` names a support slot the world offers and some part there provides it (so the Moon X-ray can never carry a need). From the step 2 review: a world with a night or dust devils must have `tuning.dust`; `lightsDraw`, `heaterDraw` and `steadyIncome` are finite and not negative; a part with `heaterDraw` must give heat.
- **Build enumeration** (`rules/builds.ts` `allBuildsWithSupport`): per world; on Mars each bay gets the support hardware it needs and nothing more, so Mars has 28,080 builds. Of the 21,060 with a heater or an RTG, 86.8% can launch under the Mars tiers and 53.4% would under the Moon's (Phase 0 counted 25,758 builds at 86% and 52%; the shares agree). The data test reports these shares and checks that every sample build below can launch.
- **The Mars affordability data test checks only that the reference builds and relationship answers can launch; spends and launch shares are reported, not asserted** (the user retired the winPaths balance model; Mars balance is by hand).

*Decided during implementation (Mars step 4a; built):*

- **Where the rules are.** `rules/instruments.ts`: `stormForecastAt`, `stormHaze`, `weatherReading`, `weatherReadout` (weather mast), `radarTrack`, `radarLayer` (radar), `laserTarget` (laser), `withMastPhotoRange` (mast). `rules/mission.ts`: the arm's slope refusal, the remote target refusal, the organics charge as it runs, and the forecast's timing (`MarsState.weatherSince`, `forecastAt`, `forecastByMast`; `marsWeatherSky`, `weatherMastOnSince`). Numbers in `data/mars/tuning.json` `instruments` (`arm`, `mast`, `weather`, `radar`, `laser`, `chargedWhileHeld`); the Moon has none of these keys, so nothing changes there. Text in `data/mars/text.json` `instrumentText`.
- **Contact and remote instruments come from `needs`.** An instrument whose `needs` include the arm (the X-ray and organics spectrometers on Mars) is a contact instrument: it reads the boulder within the X-ray's reach (3 m; 4.5 m on Mars since the step 6 review), refused without one, and refused on ground steeper than `instruments.arm.slopeLimitDeg` (10°) with a notice naming the slope (the slope under the rover, as the steep-slope warning reads it). One whose `needs` include the mast (the laser) reads a target ahead and is refused without one. The order of refusals: no boulder, then slope, then no target, then energy. *Provisional, for Chieri's review (Owner B item B13).*
- **Weather mast** (*provisional, for Chieri's review, Owner B item B9*): the mast counts as on while it is switched on and the rover is powered up; a power-down (sleep) or switching it off starts the count again. Once it has been on for `warmupSeconds` (starting value 10 s), the forecast comes up to `stormEarlyWarningSeconds` (30 s) before the orbital report, at the later of those two times; the notice credits the mast and gives the lead in sols. The forecast comes once either way, and the HUD's storm phase reads "forecast" from then on. The readout under the meters, while the mast is on and powered up, shows pressure (a daily cycle around 720 Pa, ±5%, peak in the morning) and dust opacity (0.5 on a clear sol, rising by 0.4 over the 90 s before the storm, 2.5 at full storm), each with a trend arrow against 5 s before. These readout numbers are game values in a realistic range, not measurements; the game text claims none of them.
- **Radar:** a profile column every 2 m driven, with the layer kind of the zone under the rover (delta front, Séítah, a boulder field or young crater's ring, else crater floor). A heading change above 30° within one column, or standing still for 3 s, breaks the profile; a gentle curve or a short pause does not. The strip under the meters shows the last 80 columns, with a gap at each break. **The milestone transects do not use these breaks:** the radar feeds the shared `transect` trigger as the neutron spectrometer does (switched on, unbroken by a switch-off; a power-down or the low-energy switch-off pauses it), as the brief for step 4a asked. *Flagged for the sites plan:* if Buried layers or Long profile should need a profile unbroken by turns and stops, the tracker needs a way to end a run (step 5a).
- **Laser:** the target is the nearest boulder (surface distance) or point of the delta cliff within `reachM` (12 m) in a cone of `coneDeg` (starting value 15°) either side of the rover's heading. A boulder counts when any of its disc is in the cone. The cliff is the delta front's scarp-foot line (`deltaFront.scarpLocal_xz`), searched every half meter. The target is locked when the reading starts. The HUD shows a reticle at the center of the view and a "Laser target" line; a marker on the target in the 3D world waited for the world wiring (*built in step 6a*). A boulder reading reports the rock type as the X-ray does (`rockTypeFor`, so Moon rock names on Mars until step 5b's Mars suites); the cliff reading reports fine layered sedimentary rock.
- **Organics spectrometer:** held 20 s, charged 1.5 per second of the hold as it runs (`energyPerUse` spread over the actual hold, for instruments listed in `instruments.chargedWhileHeld`), nothing up front. *(Step 4 review:)* a hold the cold slows or the shadow speeds up still costs 30 in all, and its progress bar measures the actual hold. It starts only when the battery holds the whole 30, as any use. If the battery cannot pay for the next step of the hold (another drain took it), the reading stops with a notice and finds nothing; it never ends the mission by itself. It pauses while powered down. A progress bar shows the hold. It reads no rock type.
- **Shared triggers.** The radar's switched-on drives feed `transect` (instrument `radar`); a finished laser reading calls `reading` with `instrument: 'laser'` and target `boulder` or `cliff`; a finished organics reading calls `reading` with `instrument: 'organics'` and target `boulder`. Both pass the rover's position (for zone triggers such as Rock from afar's delta foot). **They pass no rock type and no boulder index yet:** the tracker keeps the rock types read and the boulders read in one set for all instruments, so a laser reading would count toward the X-ray's Rock collection and Documented sample. *Flagged for step 5a:* make those sets per instrument, then pass the laser's rock and boulder (and `Boulder.site` for Remote reading's sites). *(Built in step 5a: rock types and read boulders count per instrument.)*
- **The mast's photo zones:** on a rover with a mast, the viewpoint photo zones (and their minimap circles) are `photoZoneRadiusM` × `instruments.mast.photoRangeFactor` (1.5). Boulder photo ranges are unchanged.
- **Part effects or tuning.** `photoRangeFactor` and the organics running charge are in Mars tuning, not part effects as this section first wrote, since step 4a did not edit `data/parts.json`; moving them onto the mast and organics parts is a small follow-up if wanted.
- **Debrief instrument log** gains a line per Mars instrument carried: the weather mast's seconds on (and whether it forecast the storm early), the radar's longest unbroken profile and the ground it profiled, each laser reading, and the count of finished organics readings. The Mars desk card line goes back to the shared "Records to the instrument log. Earns no milestones yet." (true again: every Mars instrument now writes the log; milestones arrive in step 4b and later). The controls lines no longer say "no results yet".
- **Mission history facts** (shown on first use): MEDA's weather sensors (Rodriguez-Manfredi et al. 2021, Space Science Reviews, checked against search summaries in step 4a), RIMFAX's inclined layers beneath the crater floor (Hamran et al. 2022, checked against the UCLA news release; the depth is left out because sources differ, about 15 m in our notes and about 20 m in the release), SuperCam's laser reading rocks up to about 7 m away (CNES; not checked again in step 4a), and SHERLOC's "signals consistent with organic molecules" with no specific compounds identified and non-biological sources not ruled out (Sharma et al. 2023, Nature 619:724-732, citation checked). Curiosity's REMS is left out of the weather fact: not checked.

**The night budget line** (Mars M15). On Mars the specification sheet shows what one 15 s night costs this build, asleep and awake with lights, next to the battery capacity, for example "Night: 3 asleep · 60 with lights · RTG +9". It includes the electric heater's draw: the heater is a plain part cost, so the line gives nothing away. It is the most useful number for Mars's lesson, which today the player finds only by running out of energy.

- *Decided during implementation (Mars step 2; built):* the row sits under Battery: "Night energy (15 s): 3 asleep · 60 with lights", with "heater 18 of each" when the build has an electric heater and "RTG +9" when it has steady income. "With lights" is a parked night with the floodlights on (driving costs more on top); a build without lights shows only the asleep cost. The totals include the heater, which is also named on its own. The row shows a dash until power, lights and heater are chosen, and is absent on the Moon. The numbers come from `rules/energy.ts` `nightBudget` and the words from `data/mars/text.json` `nightBudget`.

##### Mars ticket tiers (decided)

*Decided November 15, 2026: drafted in Phase 0 (Mars M12 decided that Mars gets its own tiers) and approved by the user as drafted. Owner A's area. Built in Mars step 3: `data/mars/tiers.json`; the Mars desk's over-the-top warning names Heavy.* Prices stay indicative, like every Mars number, until the balance patch.

| Tier | Mass up to | Size up to | Price | Compared with the Moon |
| --- | --- | --- | --- | --- |
| Small | 60 kg | 20 | 60 | Same |
| Medium | 75 kg | 23 | 120 | Same |
| Large | 90 kg | 26 | 200 | Same |
| **Heavy** | **100 kg** | **30** | **300** | New |

- **Why the first three stay.** Every sample build in both Mars plans lands in the tier the plans assumed, at the same price, so the hand estimates stay valid while Mars rewards and the pass test are deferred (Mars M13, MS1). The jump from Small to Medium at 60 kg is exactly where Mars's new parts push a lean rover: lights, an RTG, the arm or the mast each move the camera scout (58 kg) into Medium.
- **Why a Heavy tier.** The Moon tiers' problem on Mars is the ceiling. Two support slots and eight instruments make heavier rovers possible: of the 25,758 valid Mars builds (support hardware only when an instrument needs it, a heater unless an RTG), only 52% fit under 90 kg and size 26, against the Moon's data test of more than 85%. With Heavy, 86% can launch.
- **Why 100 kg and 300.** 100 kg is the steel frame's maximum load, so any rover that launches on steel is not overloaded. The price continues the Moon's rising steps (+60, +80, then +100). Real basis: Mars landers carry far heavier rovers than lunar landers do (Perseverance is about 1,025 kg, Pragyan 26 kg).
- **Heavy is not a balance path.** Heavy builds are three-instrument steel rovers with support hardware, spending about 900 or more with the ticket, above most arrival balances. The tier lets the desk accept them instead of refusing them; the price says why not.
- **Considered and not adopted:** a Mars-scaled Small of 65 kg. It would move six one-instrument builds (arm and X-ray, mast and laser, RTG with camera and lights, the weather watcher, the radar surveyor, camera with lights) from Medium to Small, 60 cheaper each, so more builds pass (the 40% target below). It stays on file for the balance patch.
- **In data:** `game/data/mars/tiers.json`, merged over the shared tiers like the other Mars overlays. The design and ticket screens stop saying the tiers are the Moon's.

**Where the sample builds land** (titanium, solid wheels, fixed panel, lithium-ion, heater units, no lights, unless stated):

| Build | Mass / size | Tier | Parts + ticket = total |
| --- | --- | --- | --- |
| Camera scout: camera | 58 kg / 17 | Small | 430 + 60 = 490 |
| Neutron prospector: neutron | 59 kg / 18 | Small | 460 + 60 = 520 |
| Fast empty bay: mesh wheels, lights | 50 kg / 19 | Small | 525 + 60 = 585 |
| Electric heater, larger battery, lights, camera | 66 kg / 19 | Medium | 480 + 120 = 600 |
| Weather watcher: weather mast + camera | 63 kg / 19 | Medium | 490 + 120 = 610 |
| Arm + X-ray | 65 kg / 19 | Medium | 500 + 120 = 620 |
| Field geologist: camera + drill | 66 kg / 20 | Medium | 520 + 120 = 640 |
| Radar surveyor: radar + camera | 61 kg / 19 | Medium | 520 + 120 = 640 |
| Mast + laser | 65 kg / 19 | Medium | 530 + 120 = 650 |
| Rock hound: arm + X-ray + camera | 68 kg / 20 | Medium | 550 + 120 = 670 |
| Organics hunter: arm + organics | 67 kg / 20 | Medium | 550 + 120 = 670 |
| RTG, lights, no heater, camera | 63 kg / 18 | Medium | 565 + 120 = 685 |
| Remote geologist: mast + laser + camera | 68 kg / 20 | Medium | 580 + 120 = 700 |
| RTG geologist: RTG, lights, no heater, camera + drill | 71 kg / 21 | Medium | 655 + 120 = 775 |
| Empty bay (steel) | 69 kg / 16 | Medium | 290 + 120 = 410 |
| Empty bay + lights (steel) | 72 kg / 17 | Medium | 325 + 120 = 445 |
| Steel, RTG, lights, no heater, camera | 77 kg / 18 | Large | 475 + 200 = 675 |
| Steel geologist: steel, arm + X-ray + drill | 87 kg / 22 | Large | 500 + 200 = 700 |
| Steel, arm + X-ray + mast + laser | 89 kg / 22 | Large | 560 + 200 = 760 |
| Steel, arm + X-ray + organics + drill | 91 kg / 24 | Heavy (cannot launch on the Moon tiers) | 610 + 300 = 910 |
| Steel, lights, arm + mast, laser + X-ray + camera | 95 kg / 24 | Heavy (cannot launch on the Moon tiers) | 645 + 300 = 945 |

**Mars lessons** (Mars M9, M14, M15). Four lessons: three relationships and the no-lights hard block. Each has one desk cause, one mission signal and one plain explanation, and at least two answers. The answers are the plan's originals (Mars M14).

| Lesson | Kind | Happens when | What the player sees | Answers | Real basis |
| --- | --- | --- | --- | --- | --- |
| The RTG adds neutron noise | Conflicts | The neutron spectrometer is on, on an RTG rover | The hydrogen meter's floor is raised and jitters | Solar power; or leave the neutron spectrometer home | Jun et al. (2013), JGR Planets 118:2400: about 60% of DAN's thermal neutron counts at Rocknest came from Curiosity's MMRTG |
| Dust on the panels | Conditions | Dust has cut solar income by a set share (starting value 15%) | The energy income line shows the dust factor | An RTG; the mast's higher panel; a route past dust devils | Dust settles steadily on real panels; Spirit's cleaning event (notebook entry only) |
| The arm cannot reach on a slope | Conditions | A contact reading is refused because the ground is steeper than 10° | A refusal notice that names the slope | Park on level ground; or the laser spectrometer from a distance | Perseverance's PIXL and SHERLOC must sit close to the rock |
| No lights, no night driving (Mars entry) | Needs (hard block) | A rover without lights at dusk | It cannot drive at night; Night drive cannot be earned | Fit lights; or sleep through the night | Real Mars rovers sleep through the night; NASA's VIPER, a Moon rover, was designed with headlights for dark craters (it has not flown). Text never says a Mars rover drives at night or carries floodlights |

- **The electric heater lesson is dropped** (Mars M15). At 1.2/s the heater costs 18 per night, about 4.5% of a 400 battery; the night budget line shows it, and it has no notice or review entry. A cold-battery relationship can replace it in a later wave.
- **The no-lights entry is its own Mars entry,** not the Moon's id: the cause is the same part, but the place and the real basis differ. It is always shown in the review, as on the Moon.
- **Known issues for the balance patch** (Mars M14): an RTG as the dust answer is expensive (the RTG, camera and lights build spends 685); "a route past dust devils" is luck, not a plan; the laser as the arm's answer means buying a second build; and the RTG-plus-neutron cause (about 680 with the ticket) is a build few players will make.
- **Moved to a later wave:** big labs and driving cannot run together (the organics hold already stops the rover), scout-drill-analyze (needs a lab instrument), sharp rocks wear the wheels (needs a wear meter).
- **Spoiler guard** (the Moon's rule, "No lesson is spoiled"). No milestone, site name, notice, lead, desk line or tutorial line names a lesson's cause or fix before it happens. The RTG's desk card says nothing about neutrons, and the neutron card nothing about power sources; neutron milestone texts say "switched on", "survey" or "locate", and the grep test adds "noise", "generator" and "RTG" for neutron texts. The desk shows no `dustRate`, and the Dust devil milestone's fact is not Spirit's cleaning (that story stays in the notebook). The arm's card never mentions slopes or level ground; contact-reading texts never say "level", "flat" or "steep"; laser texts never compare the laser with the arm. The no-lights block is stated openly; Night weather's notice must not imply that lights are needed.
- **Combos are allowed** (MS11). No milestone is visible before it is reached: desk cards list names only, and the debrief's "Not reached" list comes after the mission. So a combo's part pairing cannot give a lesson away, and the draft's ban on laser-plus-contact and neutron-plus-solar combos is lifted. Combos are added only where they make good science, and their wording still never spells out a lesson.
- **Stations** (Mars M19). No Mars station ships in this wave. Later ones (a broadband seismometer, the heat flow probe, a deployable weather station) follow the Moon's near-lander rule: the 200 m zone, the warning and second press, `record` and `deploy` outside the zone, and a record whatever the rover's power state. No Mars `deploy` uses `needs: 'earth'`.

#### Mars milestones

Owner B's first Mars list. The demo built eight of these (see below); *decided November 15 (Mars sites plan):* Sand crossing, Clean run, Signs of an ancient lake and Dust devil join 16 more in [New Mars milestones](#new-mars-milestones). Rewards are interface numbers. Every real fact gets fact-checked before it goes into `text.json`.

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
| Core sample | Scientific: new information | Drill samples at up to three sites, at least 200 m apart (Moon rule) | Drill |
| Signs of an ancient lake | Record: first discovery | The first sample drilled at the delta front | Drill |
| Blue sunset | Pretty picture | Photograph the Sun setting (Martian sunsets look blue; Curiosity, 2015) | Camera |
| Dust devil | Pretty picture | Photograph a passing dust devil | Camera |

- Air samples start on Mars (Moon milestones), but they need an instrument from Owner A's catalog. *(Decided November 15:)* no air-sample instrument is in the first Mars wave, so they wait.
- Survey leads, fog and discovery work as on the Moon ([Minimap and exploration](#minimap-and-exploration)). New leads would point to the delta front, Séítah and a rocky area.

##### How the Mars milestones work *(decided during implementation, Phase M5, November 15)*

The demo builds Touchdown, Odometer, Mapper, Night drive, Storm survivor, Delta layers, Core sample and Blue sunset. Rules in `game/src/rules/milestones.ts`; triggers, rewards and facts in `game/data/mars/milestones.json`; zone sizes and the sunset band in the `milestones` section of `data/mars/tuning.json`. Money and RP are placeholders (`interface`, Owner A), sized so a run that drives, photographs or drills earns several times what a rover idling at the lander earns.

- **Core sample, renamed from Lake sediment sample** *(approved by the main session)*. Perseverance found that Jezero's crater floor, where the rover lands and drives, is igneous rock; only the delta rocks are lake sediment (JPL, 2022). A drill-anywhere milestone named for lake sediment would teach the wrong thing. The rule is unchanged: up to three sites, at least 200 m from the lander and from each other. Its fact is about Wildcat Ridge, the delta mudstone Perseverance cored in July 2022.
- **Zones** come from the Mars `terrain.json` features: the delta front (within `zoneRadius_m` of its scarp line), Séítah's outline, and 60 m circles around the delta-layers and sunset viewpoints. The Moon's zones, the Earth photo and the ice are absent on Mars.
- **Night drive** counts only the distance driven while it is night, in two stages (100 m and 300 m). A full night of driving covers roughly 150 m. Lights and a heater are required.
- **Storm survivor** is earned when the dust storm clears while the mission is still running. A rover that sleeps through the storm earns it too, because surviving the storm is the point.
- **Blue sunset** needs no zone. It counts when the setting Sun (after local noon) is 0° to 15° above the horizon, in the camera frame and not hidden by terrain, and the rover is at least 300 m from the lander. The Sun sets in view of the lander every sol, so, like the Moon's Earth photo, the photo is not free at the start. The band is in data so playtests can tune it. The western sunset viewpoint is simply a good place to take it. Notices say why a photo does not count (Sun too high, too close to the lander).
  - *Widened from 10° to 15° at integration (M6), on the real terrain.* The crater rim stands about 4.9° high in the west, at the sunset azimuth, as seen from the landing. With a 10° band, the Sun was in the band and above the rim for only about 2.2 s per dusk. With 15° it is about 4 s. From the delta top in the west the rim is lower, so the window is longer there.
- **Odometer** stages are 500 m, 1.5 km and 3 km; **Mapper** is 2.5% of the map. Mars runs last 10 minutes against the Moon's 5.
- **Survey leads:** the delta front (aimed at the scarp's nearest point, because the front runs for kilometers), Séítah, and the first rocky area in `terrain.json`. The minimap draws the delta front as a line, Séítah as a dashed outline, and Perseverance's landing site as a landmark once discovered; Mars has no cold-zone legend. Lead text is in `data/mars/text.json` → `survey`.

##### New Mars milestones

*Decided November 15, 2026, in Phase 0 of the [Mars sites and milestones plan](mars-sites-and-milestones-plan.md#3-milestones) (MS1 to MS15). Built in Mars steps 4b (data), 5 (rules), 6 (mission, HUD, desk, debrief) and 7 (rewards by hand); Mars step 8 gave all 28 a how-to line. Triggers and placement are Owner B's area: provisional, for Chieri's review.* Twenty new milestones, so every instrument on the Mars desk earns at least one; Mars goes from 8 milestones to 28. Four come from the proposed list above (Sand crossing, Clean run, Signs of an ancient lake, Dust devil). Rewards are **starting values** sized for Mars spending; the balance patch sets the final ones (MS1). "Outside the near-lander zone" is the existing 200 m zone.

| Milestone | Category | Instrument | How to earn it | Money / RP |
| --- | --- | --- | --- | --- |
| Crater wall | Scientific: historical formation | Camera | Photograph a young crater's far inner wall from its rim: the crater's center in frame, the rover 0.8 to 1.3 times the radius from it | 70 / 15 |
| Dust devil | Pretty picture | Camera | Photograph a passing dust devil (needs dust devils) | 60 / 5 |
| Séítah core | Scientific: new material | Drill | A drill sample inside Séítah's outline, by Core sample's 200 m rule | 120 / 25 |
| Signs of an ancient lake | Record: first discovery | Drill | The first sample in the 50 m delta-foot zone; once per campaign | 120 / 30 |
| Rock collection | Scientific: new information | X-ray | Read 2, 3 and 4 different Mars rock types (one stage each) | 70 / 10 per stage |
| Rare rock | Record: first discovery | X-ray | Read the flood boulder (flood conglomerate); once per campaign | 120 / 30 |
| Documented sample | Scientific: new information | Camera + X-ray (combo) | Photograph a boulder the X-ray spectrometer read this mission, in frame, from within 15 m (the Moon's `read-boulder` target) | 50 / 10 |
| Organic signals | Scientific: new material | Organics | A finished organics reading on a boulder outside the near-lander zone, at 2 sites at least 200 m apart (one stage each) | 140 / 30 per stage |
| Lake organics | Scientific: new material | Organics | A finished organics reading on a boulder in the delta-foot zone | 160 / 40 |
| Remote reading | Scientific: new information | Laser | A laser reading of a boulder at 3 sites at least 200 m apart (one stage each) | 70 / 10 per stage |
| Rock from afar | Scientific: historical formation | Laser | A laser reading of the delta cliff from the delta-foot zone (`target: "cliff"`) | 120 / 25 |
| Buried layers | Scientific: new information | Radar | Switched on for an unbroken 150 m drive that touches a young crater's ejecta, Séítah or the delta front; one stage per distinct zone instance, up to 3 | 90 / 20 per stage |
| Long profile | Scientific: new information | Radar | Switched on for an unbroken 500 m drive outside the near-lander zone | 100 / 15 |
| Hydrated ground | Scientific: strange formation | Neutron | Switched on for an unbroken 20 m drive that touches the hidden 25 m core of the hydrated ground | 180 / 30 |
| Hydrogen traverse | Scientific: new information | Neutron | Switched on for an unbroken 100 m drive that touches Séítah or the delta front; one stage each | 100 / 15 per stage |
| Storm log | Scientific: new information | Weather mast | Switched on, powered up and outside the near-lander zone for 60 s of the dust storm | 160 / 25 |
| Night weather | Scientific: new information | Weather mast | Switched on, awake and outside the near-lander zone for 12 s of one night; awake is enough, no lights needed (MS14) | 110 / 15 |
| Dust devil pass | Scientific: new information | Weather mast | Switched on, powered up and outside the near-lander zone when a dust devil passes within 150 m (needs dust devils) | 60 / 10 |
| Sand crossing | Capability: difficulty | None | Cross Séítah's sand ripples without getting stuck. Owner B's rule; starting proposal: the existing `zone` crossing test on Séítah's outline | 40 / 3 |
| Clean run | Capability: robustness | None | Finish all 10 sols without damage (the Moon's rule, MS7); idle rovers earn it too | 0 / 10 *(decided in Phase 0: no money until the balance patch tunes it, so it adds nothing to the idle and empty-bay money that is already a noted risk)* |

**Changes to the built Mars milestones** *(decided November 15; provisional, for Chieri's review)*:

- **Blue sunset** 70 → **100** (camera money near the lander).
- **Night drive** stays **50** per stage. The 30 proposed under a relative pass test is deferred to the balance patch (MS1). Its heater requirement is met by any heat (Mars M17), so an RTG rover with no heater part can earn it.
- **Delta layers** stays 100. **Core sample** stays 60 per site; a sample that earns Séítah core or Signs of an ancient lake still counts as a Core sample site, so one drill action can earn both, as on the Moon.
- **Signs of an ancient lake** uses the new 50 m `delta-foot` zone, not the 150 m `delta-front` zone, which reaches into igneous crater floor (MS5).
- **Core sample's fact** changes: Wildcat Ridge and its organics move to Signs of an ancient lake and Lake organics, and Core sample gets a crater-floor fact (Perseverance's first sample attempt in August 2021 came back empty because the rock crumbled; NASA). The built text says Wildcat Ridge "detected" organic molecules; the wording rule is "signals consistent with".
- **Night drive's fact:** the −83 °C low comes from a later MEDA report (sols 43 and 44, April 3 and 4, 2021), not the first readings (about −20 to −26 °C). *Checked in Mars step 4b:* NASA's "First Weather Report from Jezero Crater on Mars" page reports that later MEDA report too (a high of −22 °C, a low of −83 °C), so the source stands; the fact now names the sols.
- **Rocky area 2:** the pipeline re-measures it (we measure about 300 m across, 14 m deep and not round, against the 255 m in `terrain.json`).
- **Survey leads:** a fourth, "Young crater", to East crater (MS6). **Boulders** at the new sites ([New sites](#new-sites-and-areas-of-interest)).
- Everything else stays as built: the zones, the sunset band, the 200 m sample rule, Night drive's stages and Storm survivor. Capability rewards stay as built until the balance patch (MS1).

**What each instrument now earns:**

| Instrument | Before | After |
| --- | --- | --- |
| Camera | Delta layers, Blue sunset | + Crater wall, Dust devil, Documented sample (with the X-ray) |
| Drill | Core sample ×3 | + Séítah core, Signs of an ancient lake |
| X-ray (with the arm) | Nothing | Rock collection ×3, Rare rock, Documented sample (with the camera) |
| Organics (with the arm) | Nothing | Organic signals ×2, Lake organics |
| Laser (with the mast) | Nothing | Remote reading ×3, Rock from afar |
| Radar | Nothing | Buried layers ×3, Long profile |
| Neutron | Nothing | Hydrated ground, Hydrogen traverse ×2 |
| Weather mast | Nothing | Storm log, Night weather, Dust devil pass |
| Arm, mast | Through their instruments | Unchanged (intended) |

**How the new Mars milestones work.** Rules will be in `rules/milestones.ts`, `instruments.ts`, `survey.ts` and `boulders.ts`; triggers, rewards and facts in `data/mars/milestones.json`; zone sizes and meter values in `data/mars/tuning.json`; the design choices in `data/mars/sites.json`. They use the Moon's shared triggers with the [Mars extensions](#rules-for-the-new-milestones):

| Trigger | Mars milestones |
| --- | --- |
| `transect` | Buried layers (`young-crater`, `seitah` or `delta-front`, 150 m, 3 sites), Long profile (no zone, 500 m), Hydrated ground (`hydrogen-anomaly`, 20 m), Hydrogen traverse (`seitah` or `delta-front`, 100 m, 2 sites) |
| `reading` | Rock collection (`rocks: [2, 3, 4]`), Rare rock (`rock: "flood-conglomerate"`), Organic signals (`sites: 2`), Lake organics (`zone: "delta-foot"`), Remote reading (`sites: 3`), Rock from afar (`zone: "delta-foot"`, `target: "cliff"`) |
| `record` + `seconds` | Storm log (`duststorm`, 60 s), Night weather (`night`, 12 s), Dust devil pass (`dustdevil`, 0 s) |
| `photo` | Crater wall (`crater-wall`), Documented sample (`read-boulder`), Dust devil (`dustdevil`) |
| `drill` | Séítah core (`seitah`), Signs of an ancient lake (`delta-foot`) |
| `zone` crossing | Sand crossing (Owner B's rule) |

- **Zones.** `delta-foot`: within `deltaFootRadiusM` (50 m) of the nearest 400 m of the scarp foot. `young-crater`: within `youngCraterEjectaFactor` (1.5) times the radius of a young crater or rocky area (the Moon's id and rule). `hydrogen-anomaly`: the hidden core, using the Moon's `hydrogenZoneRadiusM` key set to 25 m on Mars *(decided in Phase 0, instead of a new `anomalyCoreM` key)*. The flood boulder is a `sites.json` site.
- **The hydrogen meter on Mars** uses the Moon's rule and keys with Mars values (provisional, for Chieri's review): the noise floor is 10% everywhere; Séítah and the delta foot read 15% (a game simplification; new `unitReadings` by zone); the hydrated ground reads `anomalyPeak` 45% at its center and `anomalyEdge` 34% at the core's edge (one straight line, *decided in Phase 0*), falling to the floor at `anomalyRangeM` 80 m. Mars has no cold traps and no ice signal.
- **How the RTG noise can cost Hydrated ground** (C6, MS4). The core is small (25 m), never drawn, and only the meter's rise over the last 80 m leads to it. On an RTG rover the meter's floor is raised and it jitters by at least the anomaly's rise over 30 m (starting values, *decided in Phase 0*: floor +15%, jitter ±13%), so a noisy rover cannot follow the gradient and finds the core only by luck. This is a search cost, not a rule: a noisy rover that drives over the core still earns it. If playtests show RTG rovers finding it anyway, add `transect.dwellS` (seconds switched on inside the zone, times the rover's noise factor), which is real counting statistics (Jun et al. 2013).
- **Readings.** Each finished X-ray and laser reading passes its rock type and boulder; the organics reading passes its boulder and site. The readout adds "New type: 3 of 6" when a reading adds a type. Lake organics and an Organic signals stage can come from the same reading, as one drill action can earn two milestones.
- **Contact targets on slopes** (C7). Rock collection, Rare rock and Organic signals send arm rovers to boulders on 10 to 18° ground at Rocky area 2's NW wall (the first site out), the knob beside it, East crater's rim, the Séítah knob and the flood boulder. Each has level ground within reach, and Rocky area 1 is almost all level, so "park level" always works. The flood boulder can be read from its level downhill side.
- **Dust devil milestones** are left out of the balance (MS8). *(Dust devils are built; both milestones fire since steps 5a and 6b.)*
- **Desk cards and the debrief** work as on the Moon: cards list each instrument's milestones by name; the debrief groups milestones by instrument, shows staged ones as one line, and has a "Not reached" list that names a missing support part from the instrument's `needs`.
- **Why these and not others.** One combo for now, Documented sample (MS11). Night weather gives the weather mast a milestone a player can plan for, since dust devils are random. Organics earns at two sites, not five: each reading is a long, costly hold. Lake organics and Rare rock live only at the delta foot, so the far destination holds the rarest things. Left out: a Wright Brothers Field photo (nothing to see, MS12), a sand-ripple photo (no source found), a hydrogen-plus-drill combo (it would blur Hydrated ground), anything at Hawksbill Gap or the sunset viewpoint (too far).

**Real basis of the new Mars milestones** (checked November 15, mostly from abstracts and NASA pages; every fact is checked again before it goes into `text.json`):

| Milestone | Real basis |
| --- | --- |
| Crater wall | Crater walls are natural cross-sections: Opportunity studied the layers in Victoria crater's walls, which preserve ancient wind-blown dunes (Squyres et al. 2009, Science 324:1058, doi:10.1126/science.1170355; abstract checked in Mars step 4b; "about two years" from news coverage) |
| Dust devil | Perseverance's weather sensors counted about four whirlwinds per sol at Jezero, over a quarter of them dusty (Newman et al. 2022). Not Spirit's panel cleaning |
| Séítah core | Perseverance sampled Séítah's olivine-rich rock at Brac, an olivine cumulate (Liu et al. 2022; Farley et al. 2022) |
| Signs of an ancient lake | The delta's fine layers formed in Jezero's lake; Perseverance cored delta mudstone at Wildcat Ridge in 2022 (JPL) |
| Rock collection | PIXL mapped crater-floor rocks and found olivine cumulate in Séítah (Liu et al. 2022) and water-made carbonate and salts in it (Tice et al. 2022) |
| Rare rock | Boulders up to about 1.5 m in the delta's top layers record floods (Mangold et al. 2021). *Placed by design* |
| Documented sample | WATSON, a close-up camera on Perseverance's arm (part of SHERLOC), images the texture of the rock patches the rover studies (NASA and JPL image pages for Bellegarde and Dourbes; checked in Mars step 4b) |
| Organic signals | SHERLOC detected signals consistent with organic molecules in all ten crater-floor targets it studied; a non-biological origin is not ruled out (Sharma et al. 2023) |
| Lake organics | Wildcat Ridge gave SHERLOC its strongest organic signals so far (JPL, 2022). Wording: "signals consistent with" |
| Remote reading, Rock from afar | SuperCam's laser analyzes rocks up to about 7 m away (CNES); its microphone hears each zap (Maurice et al. 2022, partly checked) |
| Buried layers, Long profile | RIMFAX imaged layers beneath Jezero's floor, dipping up to about 15° and seen to about 15 m deep, along the rover's first 3 km (Hamran et al. 2022) |
| Hydrated ground | Curiosity's DAN saw water-equivalent hydrogen vary over a few meters (Litvak et al. 2014); crater-floor rocks hold water-made salts (Scheller et al. 2022). *Placed by design* |
| Hydrogen traverse | Mars Odyssey found 2 to 10% water-equivalent hydrogen in places near the equator (Feldman et al. 2004); Séítah's and the delta's readings are a game simplification |
| Storm log | A regional dust storm passed over Perseverance in January 2022; its weather station logged winds up to 20 m/s before the wind sensor was damaged (Lemmon et al. 2022, GRL 49, e2022GL100126; abstract checked in Mars step 4b) |
| Night weather | MEDA measures the air around the clock; on sols 43 and 44 (April 2021) it logged a low of −83 °C at Jezero (NASA, "First Weather Report from Jezero Crater on Mars"; checked in Mars step 4b) |
| Dust devil pass | Perseverance's microphone recorded the first sound of a Martian dust devil, on sol 215 (Murdoch et al. 2022) |
| Sand crossing | Spirit was stuck in sand at Troy in 2009 |

**Data and types** *(decided during implementation, Mars step 4b; provisional, for Chieri's review)*. The twenty new milestones, the Mars sites, the tuning and the rock texts are in the data files and validated; Mars has 28 milestones. The trigger rules come in Mars step 5 (5a triggers and zones, 5b the hydrogen meter and rock suites, 5c boulders and survey); until then the new triggers that need new rules simply never fire, and the ones the built rules already cover fire by their decided rule.

- **Trigger shapes** (`rules/types.ts`). `transect` gains `zones?: string[]` (any of several zones, for Buried layers and Hydrogen traverse) beside the single `zone`, and with neither counts anywhere outside the near-lander zone (Long profile): a list in `zone` itself would have changed the type every Moon rule and test reads. `record` gains `seconds?`; `RecordEvent` gains `night` and `dustdevil`; `PhotoTarget` gains `crater-wall` and `dustdevil`.
- **Ids.** Mars zone ids are a list of their own, `MARS_ZONE_IDS` in `rules/marsTypes.ts` (the four built, `delta-foot`, and the shared `near-lander`, `boulder-field`, `young-crater`, `hydrogen-anomaly`); validation checks each world's triggers against its own list, so a Moon zone on Mars or `delta-foot` on the Moon is reported. Mars rock ids are `MARS_ROCK_IDS`; a Mars suite naming any other rock is reported. Milestones that exist on both worlds have Mars ids (`mars-rock-collection`, `mars-rare-rock`, `mars-documented-sample`, `mars-clean-run`), because records are kept per campaign. Signs of an ancient lake is `ancient-lake`.
- **Mars sites** (`data/mars/sites.json`, the Moon's `SitesFile` type, replacing the Moon's file whole). Rocky areas 1 and 2 are terrain features (`rocky-area`); East crater and the S, SSE and ESE craters are pipeline `youngCraters` items; the WNW knob, the Séítah knob, the Séítah edge, the delta foot and the flood boulder keep a `local` stand-in copied from the terrain feature named by a new `terrain` path (for example `deltaFront.floodBoulder`), which the data test checks against `terrain.json`; the hydrated ground is the one provisional design choice. New site kinds: `knob`, `seitah-edge`, `delta-foot`, `flood-boulder`; the hydrated ground reuses the Moon's `hidden-hydrogen` kind, so its zone, its hidden survey site and its reveal work as on the Moon. Loading the sites already puts 30 boulders at each young crater (Mars rocks), their ejecta zones, the young craters on the minimap and the fourth lead in the game; step 5c adds the other kinds' boulders and survey sites.
- **Tuning** (`data/mars/tuning.json`). `milestones`: `deltaFootRadiusM` 50, `craterWallRimBand` [0.8, 1.3], `hydrogenZoneRadiusM` 25, and `youngCraterEjectaFactor` 1.5 and `documentedSampleRangeM` 15 repeated from the Moon so a Moon change does not move Mars. `instruments.neutron`: `noiseFloor` 0.10, `anomalyPeak` 0.45, `anomalyEdge` 0.34, `anomalyRangeM` 80, `unitReadings` { `seitah` 0.15, `delta-foot` 0.15 } by zone id, `rtgFloorRise` 0.15, `rtgJitter` 0.13. `instruments.xray`: the six Mars suites and a Máaz basalt fallback. `boulders`: `perSiteKind` (knob 15, Séítah edge 40, delta foot 40), `perSite` (East crater 60), `floodBoulderDiameterM` 2.5, `slopeTargetShare` 0.25. `survey.leads` adds `youngCrater` → `east-crater`. The plan's `unitShares` and `anomalyCoreM` are not used (Phase 0 chose the Moon's keys).
- **Inherited from the Moon.** Mars does not set `sampleMinDistanceM` or `sampleSpacingM`, so the Moon's generous pass moved Mars too: the near-lander zone is now **120 m** (was 200) and sample and reading sites are **150 m** apart (was 200); `photoZoneRadiusM` is 90. Every "200 m" in the Mars milestone text above now reads 120 m in the game (the how-to lines fill the number from the data). Left as is until the Mars balance step decides.
- **Choices made here** (provisional, for Chieri's review):
  - *East crater and the fourth lead (MS6).* The pipeline found East crater fresh (`young-crater-ene`), so it is a site and the "Young crater" lead points at it; the ESE crater stays a small crater.
  - *The NE crater* (`young-crater-ne`, also fresh, 1.25 km out, not in the plan) **does not join the east cluster** for now: the conservative choice, open for Chieri.
  - *Rocky area 2 is not fresh.* `terrain.json` (pipeline-owned) still calls it "the sharpest small crater … fresh craters … carry blocky ejecta" in its `source`; the game's own texts no longer call it fresh: its site note says "an old crater", the Mars rocky-area note replaces the Moon's "a fresh crater ringed by boulders", and the Sites table above is corrected. The pipeline's `source` string is for the pipeline owner to reword.
  - *Small craters:* the plan's three (S, SSE, ESE). The pipeline's WSW (584 m) and SW (636 m) craters are nearer but are left out (*superseded in Mars step 7:* both are now sites, under the generous rule); adding them is the generous option if playtests want more young craters near the lander.
  - *The WNW knob's rocks:* it lies inside Rocky area 2's boulder spread; the plan's suite table gives it none, so it takes the crater-floor suite (salt-veined basalt 6, Máaz basalt 4). With Rocky area 2's olivine, an X-ray rover finds three types within about 0.6 km.
  - *Site extents:* WNW knob 60 m, Séítah knob 45 m (their slope-target patches), Séítah edge 150 m around the game's entry point (about 60% firm ground; Brac itself is on ripples), the delta foot from its foot line.
  - *The hydrated ground* stays at the plan's candidate (780, 420): firm and level (under 6.5° within 25 m, no ripples), 912 m out and about 20 m off the straight line from Rocky area 1 to Brac, so a rover driving the south cluster passes inside the meter's 80 m rise. Moving it nearer the lander would take it off that route.
  - *Slope-target share* 0.25 (the plans give no number).
- **What fires before step 5.** Never yet: Crater wall and Dust devil (new photo targets), Long profile, Buried layers and Hydrogen traverse (no zone or a zone list), Storm log, Night weather and Dust devil pass (no `record` call for the mast yet), and the three delta-foot milestones (the zone is built in 5a). Already by their decided rule, through the built triggers: Sand crossing (the `zone` crossing on Séítah's outline; a polygon has no center, so any exit counts as a crossing, which is generous), Clean run, Séítah core, Rock collection (Mars rocks), Documented sample, Hydrated ground (the 25 m core), Organic signals and Remote reading. *Flagged for 5a:* `reading` does not check the near-lander zone, which the design asks for Organic signals; no boulder lies within 120 m of the lander, so it cannot fire there today.
- **Facts.** Every new milestone cites its source. Checked in this step: the Night drive and Night weather low (NASA), the first sample attempt (JPL), Victoria crater (Squyres et al. 2009, abstract), WATSON (NASA and JPL image pages), the January 2022 storm (Lemmon et al. 2022, abstract), Spirit at Troy (JPL, January 2010). *Still partly checked:* Rare rock's 1.5 m flood boulders (Mangold et al. 2021, press), Rock from afar's microphone and rock hardness (Maurice et al. 2022), Hydrated ground (Litvak et al. 2014, abstract), Hydrogen traverse (Feldman et al. 2004, abstract; DOI not found, so none is cited).

**Rules for the new milestones** *(decided during implementation, Mars step 5; provisional, for Chieri's review)*. Built as pure rules in step 5 (5a triggers and zones in `rules/milestones.ts`, 5b the hydrogen meter and rock suites in `rules/instruments.ts`, 5c boulders and survey in `rules/boulders.ts`, `sites.ts`, `survey.ts`, 5d the relationships in `rules/relationships.ts`); the mission wiring is step 6. Every new Mars milestone has a firing and a non-firing test; the Moon is unchanged.

- **Delta foot:** a path within `deltaFootRadiusM` of `deltaFront.footNear` (the nearest 400 m of the scarp foot); without that line, a circle around the delta-foot site.
- **Crater wall** targets the young craters and Rocky area 2, which the pipeline lists as a crater with a rim (pipeline center and rim-crest radius). Rocky area 1 is a boulder field, not a target.
- **The flood boulder needs no zone:** Rare rock fires on the rock type alone.
- **Long profile** counts only meters driven outside the near-lander zone; driving near the lander pauses the count rather than breaking the run.
- **Staged readings** (Organic signals, Remote reading) never count a site inside the near-lander zone (the drill's rule). No Moon milestone uses staged readings.
- **Rock types and read boulders count per instrument,** so a laser reading never counts toward the X-ray's Rock collection, Rare rock or Documented sample. Documented sample uses boulders read by an instrument the milestone requires.
- **Timed records** (Storm log, Night weather, Dust devil pass): the count pauses while the mast is off, the rover powered down or asleep, the low-energy switch-off on, or the rover near the lander. It restarts only when the event ends, so Night weather needs its 12 s within one night. An untimed `record()` never fires a timed record.
- **Dust devil photo:** any devil in frame counts (generous); an optional `milestones.dustDevilPhotoRangeM` would limit the range.
- **Validation:** timed records name a switched instrument and untimed ones a station; record events and photo targets must exist on the world; a staged transect names a zone; a trigger naming `delta-foot` needs `deltaFootRadiusM`; the Moon rejects Mars-only zones.
- **The hydrogen meter, RTG noise** (B3): on a rover with a `neutronNoise` part (the RTG) the floor becomes `noiseFloor + rtgFloorRise` and the wobble ± `rtgJitter`. Signals above the raised floor read as before; weaker ones (Séítah's 15%, the anomaly's outer slope beyond about 46 m) are hidden under it. Nothing reads the meter for a milestone, so a noisy rover that drives over the core still earns Hydrated ground (a search cost). Any zone whose id is a key in `unitReadings` reads at least that value inside it. *Noted:* the meter reads 15% on the delta foot, while Hydrogen traverse counts the larger delta front (generous); left as is.
- **Boulders** (B4): a site's `terrain` path gives its center ahead of its `local` stand-in. `slopeTargetShare` of the young craters' and knobs' boulders sit on the slope-target cell's half nearest its level cell, so a rover parked anywhere in the level cell reaches them. Delta-foot boulders lie along the foot line, so a rover reading one from its far side stands inside the zone. The flood boulder (2.5 m) is fixed, with no other boulder within 3.85 m of it or its reading spot. No site boulder on soft ground or over `maxSlopeDeg` (18°); a boulder with no firm spot in 24 seeded tries is left out (none on the real sites). Rocky areas are unchanged, so Rocky area 2's NW wall has no slope-target boulders; the WNW knob inside its spread has them. *Flagged:* one ESE crater slope cell reads exactly 10.0°, which the arm (refusing above 10°) accepts; boulders may overlap where a patch takes several.
- **The hydrated ground is revealed only when Hydrated ground fires** (the conservative option): neither the reveal circle nor the meter alone reveals it.
- **Mars relationships** (step 5d; the original answers, M14): `rtg-neutron` (`onNeutronMeter`: the neutron spectrometer on and reading on a noisy rover; review yellow for neutron on an RTG, green on solar), `dust-panels` (`onDust`: the dust factor past `dust.lessonLoss`; review yellow for any solar part including the solar mast, which slows dust but still gathers it, green for an RTG), `arm-slope` (`onUseRefused('slope')`; review yellow for any contact instrument, never shown as solved: parking level is a plan, not a part) and `no-lights-night` (a hard block, as on the Moon). *Provisional, for Chieri's review:* the Mars no-lights lesson fires when night stops an awake rover without lights, not at dusk on a sleeping rover; the dust lesson is solved only by an RTG.
- **Dust devils in the storm** (open for Chieri): kept as built: devils can form during the storm (the conservative choice: no change to Owner B's built schedule).

**World, HUD, minimap, desk and debrief** *(decided during implementation, Mars step 6; provisional, for Chieri's review where it touches placement, dust devils or site checks)*.

- **World (6a):** `world/boulderList.ts` `worldBoulders` places Mars boulders with `soft-ground.png` and the slope (none on ripples or over `maxSlopeDeg`); the Moon gets no masks, so its boulders are identical. The flood boulder is drawn rounder and paler (water-worn conglomerate). Dust devils are translucent turning columns, not fogged, so they stay visible a few hundred meters off. A devil counts as in frame if any of three points up its column is in frame and not hidden by terrain. `groundInFrame` (Crater wall) is projection only: terrain does not hide the crater center, which is generous from outside the rim. A small marker shows over the laser's target.
- **Site checks (6c):** a Mars site is checked once each carried instrument has done its one thing there: one reading per reading instrument (not every rock type), a counted sample or a switched-on drive through the site's zone, a rim photo at craters with a rim; the flood boulder's camera counts only with the X-ray aboard. The hydrated ground never shows a check.
- **HUD (6c):** the power line is truthful: an RTG rover reads "Steady power, day and night"; a solar rover reads night, storm, shadow, low Sun or sunlight, with the dust share once it reaches 1% (the dust lesson's own designed signal, B1). The weather mast shows its recording count toward Storm log and Night weather; readings say "New type: n of 6" per instrument; a crater-wall hint shows on a rim with the camera aboard.
- **Leads (6c, generous rule):** the minimap's lead arrows show distances, the nearest lead is drawn larger, and the lead list runs nearest first. Site notices name no lesson word.
- **Desk (6d):** every Mars instrument card lists its milestones ("Can earn"); the interim "earns no milestones yet" line and key are gone. *Generous rule (lead's decision):* each Mars instrument card also has a short "Where" line (`design.instrumentWhere` in `data/mars/text.json`) naming the kinds of places it is used, with no lesson words; the Moon has none.
- **Debrief (6d):** "Not reached" names a support part the rover lacked (M18) from the instrument's `needs`. The desk blocks launch without it, so in normal play it never shows; it is kept and tested for safety.
- **Mission wiring (6b):** the flood boulder's site check counts its photo only once the X-ray has read it, matching Documented sample. On Mars, a photo that earns a milestone with no named place reads "added to the album"; new captions "Inner wall of {name}" and "Dust devil crossing the crater floor". A rover with no solar income hears a dawn line without the panel (`night.dawnNoSolar`). Leads with distances and the new site checks are Mars only.
- **Step 6 review fixes:** the storm forecast, start and clearing notices (and the weather mast's forecast) have no-solar variants, so an RTG rover is not told its solar income falls. The X-ray has a Mars fact (PIXL, Liu et al. 2022). The Moon's "faster in the shade" line no longer shows on Mars (the shorter hold in shade itself is shared and stays). *Generous rule:* the contact reach (X-ray and organics) is **4.5 m on Mars** (3 m on the Moon), so the flood boulder can be read from the pipeline's reading spot, about 4 m from its surface, and first-time players park less precisely.
- **Spoiler guard (6d):** the Mars block checks the merged Mars text minus Moon-only paths for the four lessons' key words; the X-ray slope refusal (a mission signal) and the HUD's dust share are exempt; slope words are banned in milestone, site, arm and reading-instrument texts, and elsewhere only in a sentence about the arm or a reading. Remote reading's fact drops "without touching the rock" (it compared the laser with the arm).

##### Mars rock types

*Decided November 15, 2026 (MS9, MS10); built in Mars steps 4b and 5b (`data/mars/tuning.json` suites, `data/mars/text.json` names, `rockTypeFor` per world).* Before then Mars had no rock list: `rockTypeFor` read the Moon's. Six Mars types, each with a plain readout, and suites by site, using the Moon's mechanism (`instruments.xray.suites` keyed by site, `Boulder.site`, in `data/mars/tuning.json`; names in `data/mars/text.json`). Laser readings use the same types; the organics spectrometer reads none. Each boulder reads the same rock every run, picked by weight and seeded by its position. Weights are starting values.

| Rock type | Readout | Where it is read | Support |
| --- | --- | --- | --- |
| Máaz basalt | Iron-rich lava rock: pyroxene and feldspar | The common rock: every crater-floor site | Máaz is lava, the complement of Séítah (Farley et al. 2022); its basaltic composition is from Udry et al. 2023 and Horgan et al. 2023 (*to check*) |
| Salt-veined basalt | Lava rock with salts in its pores, left by water | Rocky area 1, East crater, the small craters | Sulfate and perchlorate salts from later brines in crater-floor rocks (Scheller et al. 2022) |
| Olivine cumulate | Packed green olivine crystals, rich in magnesium | Séítah edge; Rocky area 2 (*by design*) | Séítah is an olivine cumulate (Liu et al. 2022) |
| Carbonate-bearing olivine rock | Olivine partly changed to carbonate by water | Séítah edge, Séítah knob | PIXL found carbonate, sulfate and chloride in Séítah's olivine (Tice et al. 2022) |
| Lake mudstone | Fine layers of mud laid down in still water | Delta foot | The delta's fine-grained layers formed in the lake (Mangold et al. 2021; JPL, Wildcat Ridge) |
| **Flood conglomerate** (rare) | Rounded pebbles and cobbles cemented together, carried by a flood | The flood boulder only | Boulder-bearing top layers record floods (Mangold et al. 2021). *Placed by design* |

| Site | Suite (weight) | Types a full visit finds |
| --- | --- | --- |
| Rocky area 1 | Máaz basalt 5, salt-veined basalt 5 | 2 |
| Rocky area 2 | Máaz basalt 5, olivine cumulate 5 | 2 |
| East crater, small craters | Salt-veined basalt 6, Máaz basalt 4 | 2 |
| Séítah edge, Séítah knob | Olivine cumulate 6, carbonate-bearing olivine rock 4 | 2 |
| Delta foot | Lake mudstone 7, Máaz basalt 3 | 2 |
| Flood boulder | Flood conglomerate (fixed) | 1 (rare) |

- **Olivine at Rocky area 2 is a design choice** (MS9): RIMFAX saw layers dipping away from Séítah beneath the floor, and a 300 m crater digs up rock from about 30 m down, so the game lets Rocky area 2's ejecta hold olivine rock and a near X-ray rover finds 3 types within 0.7 km. The fact text says "inspired by".
- Rock collection's top stage (4 types) needs Séítah, or the delta plus Rocky area 2. A south X-ray route without the drill misses the pass by about 20 from B = 780; that is accepted (MS15). If wanted, carbonate-bearing olivine rock at the Séítah knob as a fifth type there would fix it.

##### Balance on Mars

*Decided November 15, 2026 (Mars M13, MS1, MS13); targets, not results.* Mars has no fixed budget: the player arrives with the Moon's final balance B, at least 780 and about 825 to 950 for a good Moon run, and must end Mars at the Titan mark of 800. So final = B − (parts + ticket) + 50 survival + milestone money.

- **The pass test stays as built for now** (MS1): the fixed 800 Titan mark and today's capability rewards. The options for the balance patch stay on file: a relative test ("Mars must pay for itself": final at least 800 **and** at least B), or cutting capability rewards about 60% ("set A"), which would leave only the delta routes passing and break the density goal.
- **Hand estimates and playtests only** (MS13): no Mars `winPaths` model. `marsNight.test.ts` stays the energy check, extended with the MP5 route legs; browser autopilot runs check the estimates.
- **Ticket prices** are the Moon tiers, which the decided [Mars ticket tiers](#mars-ticket-tiers-decided) keep for every build below.

**Archetypes, as targets** (hand estimates from the sites plan, B = 780, today's capability rewards; titanium, solid wheels, fixed panel, lithium-ion, heater units unless stated; dust devil milestones left out):

| Archetype (parts + ticket) | Route | Main milestones | Target final (margin) | Without using its instruments |
| --- | --- | --- | --- | --- |
| Camera scout (490) | Delta route: Rocky area 2 rim → delta viewpoint, sunset on the way | Crater wall, Delta layers, Blue sunset | 870 (+70) | 600, fails |
| Field geologist: camera + drill (640) | Delta route, 3 samples | Core sample ×3, Signs of an ancient lake, the camera's | 1,020 (+220) | 450, fails |
| | South: Rocky area 1 → Séítah knob → Brac | Core sample ×3, Séítah core, Blue sunset | 850 (+50) | |
| Rock hound: arm + X-ray + camera (670) | Delta route | Rock collection ×2, Rare rock, Documented sample, the camera's | 1,000 (+200) | 420, fails |
| Steel geologist: steel, arm + X-ray + drill (700) | South | Rock collection ×3, Core sample ×3, Séítah core | 900 (+100) | 390, fails |
| Organics hunter: arm + organics (670) | Delta route: Rocky area 2 → delta foot | Organic signals ×2, Lake organics | 860 (+60); its energy needs checking | 420, fails |
| Remote geologist: mast + laser + camera (700) | Delta route | Remote reading ×3, Rock from afar, the camera's | 990 (+190) | 390, fails |
| Weather watcher: weather mast + camera (610) | South, anywhere outside 200 m | Storm log, Night weather, Blue sunset | 850 (+50); 970 with dust devils | 480, fails |
| Radar surveyor: radar + camera (640) | South craters, Rocky area 1, Séítah edge | Buried layers ×3, Long profile, Blue sunset | 920 (+120) | 450, fails |
| | East: East crater, small crater | Buried layers ×2, Long profile, Crater wall, Blue sunset | 900 (+100) | |
| Neutron prospector: neutron (520) | South: Rocky area 1 → hydrated ground → Séítah | Hydrated ground, Hydrogen traverse ×1 | 850 (+50) | 570, fails |
| RTG geologist: RTG, no heater, lights, camera + drill (775) | Delta route with night driving | Night drive ×2, Odometer ×3, the field geologist's | 1,015 (+215) at today's Night drive (50) | 405, fails |

- **Every instrument has a passing archetype from B = 780,** and every archetype fails without using its instruments. Three routes pass: the delta route is richest, the south cluster passes for the drill, radar, neutron, weather and steel X-ray builds, and East crater for the radar.
- **The empty bay passes from a good Moon result** under the fixed mark: a steel empty bay (410) earning Touchdown, Odometer ×2, Mapper and Storm survivor ends at B − 100 and passes from B = 900; with lights and both Night drive stages (445) it ends at B − 35 and passes from about B = 835. Idling earns at most 140 and fails. This is a **noted risk for the balance patch** (Mars M13); Clean run pays no money until then for that reason.
- **Targets for the hand estimates and playtests:** each archetype passes by at least 50 from B = 780 on at least one route; each fails without its instruments at both ends of the range; at B = 860, fewer than 40% of affordable builds pass with their best route (looser than the Moon's 35%: Mars has twice the instruments). For the balance patch: the empty bay and idling fail by at least 50 at B = 950. If the 40% target breaks, lower the delta-only rewards first (Rare rock, Lake organics, Rock from afar, Signs of an ancient lake), not the near rewards the south and east archetypes depend on.
- **The RTG passes** only with two instruments and night driving, so the risk that the RTG is never picked stays open.

##### Generous pass on Mars (Mars step 7, November 15, 2026)

*Hand-tuned, a quick "good enough" (the user's generous rule); no balance model (MS13). The fixed 800 Titan mark, the capability rewards (MS1) and Clean run's 0 money stay. Provisional, for the balance patch; site additions provisional, for Chieri's review.*

**Player model** (as the Moon's generous pass): a first-time player drives at about half top speed, routes about 1.5 times the straight line, loses time searching and does not know the map. On Mars that is 10 sols of 60 s with 15 s nights, so about 450 s of daylight; at 6 to 9 m/s with about 40% lost to stops, holds and searching, a first-timer drives about 1.6 to 2.4 km, which reaches sites within about 0.9 km of the landing (and Séítah, 1.1 km, with intent). The delta foot (1.5 km) is for players who head straight there, and is not counted below.

**What is near the landing:** Rocky area 2 (0.45 km), S crater (0.57), WSW crater (0.58), SW crater (0.64), Rocky area 1 (0.70), SSE crater (0.84); the weather mast, Long profile and Core sample work anywhere outside the near-lander zone (120 m).

| Change | Before | Now |
| --- | --- | --- |
| Staged science (per stage), ×1.5 or more | Core sample 60, Rock collection 70, Organic signals 140, Remote reading 70, Buried layers 90, Hydrogen traverse 100 | **100, 105, 210, 105, 135, 150** |
| Near picture and combo rewards, doubled | Crater wall 70, Dust devil 60, Documented sample 50 | **140, 120, 100** |
| Sites near the landing | S, SSE, ESE small craters | **+ WSW crater (584 m) and SW crater (636 m)** as young-crater sites: boulders, a crater-floor rock suite, radar rings and Crater wall targets near the landing |
| Contact reach on Mars (step 6 review) | 3 m | **4.5 m** |

Unchanged: the far single rewards (Delta layers, Signs of an ancient lake, Rare rock, Lake organics, Rock from afar, Hydrated ground), the weather mast's records (Storm log 160, Night weather 110: they work anywhere outside 120 m, so doubling them would let a parked rover win big), Blue sunset 100, capability rewards, survival 50, prices and tiers.

**Estimates** (final = B − parts and ticket + 50 survival + milestones; an active first-timer also earns Touchdown 80, Storm survivor 60, Odometer ×2 60 and Mapper 60, so 310 with survival; an idle rover 190; titanium, solid wheels, fixed panel, Li-ion, heater units, near route only, no dust devils):

| Build (parts + ticket) | Near-route science | Final at B = 800 | At B = 900 |
| --- | --- | --- | --- |
| Idle at the lander (440) | none | 550: **loses** | 650: loses |
| Empty bay (440) | none | 670: **loses** | 770: loses |
| Empty bay, steel, Li-ion, LED, both Night drive stages (445) | Night drive 100 | 765: **loses** | 865: passes (known risk, M13) |
| Camera (490) | Blue sunset, Crater wall: 240 | 860: **wins** | 960 |
| Drill (590) | Core sample ×3: 300 | 820: **wins** | 920 |
| Camera + drill (640) | 540 | 1,010: **wins** | 1,110 |
| Arm + X-ray (620) | Rock collection ×2: 210 | 700: loses; 805 with Séítah's fourth type | 800: scrapes |
| Arm + X-ray + camera (670) | 210 + Documented 100 + camera 240 | 990: **wins** | 1,090 |
| Arm + organics (670) | Organic signals ×2: 420 | 860: **wins** | 960 |
| Mast + laser (650) | Remote reading ×3: 315 | 775: loses narrowly | 875: wins |
| Mast + laser + camera (700) | 555 | 965: **wins** | 1,065 |
| Weather mast (500) | Storm log, Night weather: 270 | 880: **wins** | 980 |
| Radar (530) | Long profile, Buried layers ×2: 370 | 950: **wins** | 1,050 |
| Neutron (520) | Hydrogen traverse in Séítah 150; + Hydrated ground 180 | 740 without the hidden ground; 920 with it | 840 / 1,020 |
| RTG, LED, camera + drill, no heater (775) | 540 + Night drive 100 | 975: **wins** | 1,075 |

- **Several builds win** from a scraping Moon result (B = 800) on the near route alone: the camera, the drill, the camera and drill, the X-ray with the camera, the organics, the laser with the camera, the weather mast, the radar and the RTG geologist. The single X-ray, the single laser and the neutron spectrometer need a farther site (Séítah, or the hidden ground) or a better Moon result.
- **Idle and empty bay lose** at B = 800 and 900. *Known risk (M13, MS1, deferred by the user):* under the fixed mark an idle rover passes from B ≈ 1,050 and an empty bay with lights that drives both nights from B ≈ 835; only a capability cut or a relative pass test fixes this, and both wait for the balance patch.
- **Not modelled:** dust devils (bonus), the delta foot's big rewards, damage.
- **Browser check** (one run, B = 800, the camera and drill build, 640): teleports between Rocky area 2, WSW crater and S crater with the clock advanced as a first-timer would drive (1.5 times the straight line at 6 m/s). Earned Touchdown, Storm survivor, Clean run, Crater wall (from WSW crater's rim) and Core sample ×3: final **790**, exactly the estimate's 1,010 less the three rewards teleporting cannot earn (Odometer ×2 and Mapper, 120) and the sunset it skipped (100). A player who drives the route earns those, so the row stands; a first-timer who misses both the sunset and the driving rewards scrapes just under the mark.

##### Tutorial, how-to lines, credits and checklist *(decided during implementation, Mars step 8)*

Built: the Mars tutorial pages (see [Campaign and screens](#campaign-and-screens-decided-during-implementation-phase-m4)), how-to lines for the eight Mars milestones carried over from the demo, the Mars credits, and the [Mars playtest checklist](mars-playtest-checklist.md). Every new text passes the spoiler guard (`ui/spoilerGuard.test.ts`). Small choices made here:

- **The drive tutorial names the near sites** (generous rule: a first-timer does not know where to go): Rocky area 2 about half a kilometer west-northwest, the small young craters about 0.6 km south, west-southwest and southwest, Rocky area 1 about 0.7 km south, and the farther sites at 1 to 1.5 km. These rounded distances and directions are written in `data/mars/text.json` by hand from the pipeline's positions, so they need updating if a site moves. The map page says the nearest lead is drawn larger and listed first.
- **Instrument lines say where, never why.** The neutron line says to drive through Séítah or along the delta front and watch the meter (nothing about power sources); the X-ray and organics lines say "beside a boulder" (nothing about the ground); the laser line names its target (nothing about the arm); the weather mast's line says "while the rover is awake" for the night (nothing about lights). The drill line uses the near-lander distance and the spacing from the data, which on Mars differ (120 m and 150 m), where the Moon's line repeats the spacing.
- **The power page** says the RTG earns no more in a sol than a fixed panel on a clear sol (true of the data: 0.6/s for 60 s against about 36), and that a rover with an RTG needs no other heater. It says nothing of dust on any panel, only the storm.
- **How-to lines for the carried-over eight.** Night drive reads "Drive {distances} after dark, over the mission's nights." with no word about lights (the hard block is the desk's to state). Blue sunset fills its distance and its band from `tuning.milestones` (`sunsetPhotoMinDistanceM`, `sunsetMaxElevationDeg`), new variables in `milestoneHowTo`. Storm survivor says a rover asleep through the storm counts. *Noted:* no screen shows how-to lines today (the desk lists names only, M14); they are kept for the debrief or a later help screen, and the spoiler guard checks them.
- **Credits.** Mars parts are credited only where a source is already cited in this document, the Mars engineering plan's Real anchors or the research notes: the RTG (NASA's MMRTG fact sheet; US DOE, "Powering Curiosity"), the deployable arrays and the electric heater (the MER launch press kit), the larger battery, the grouser wheels and the arm (the Mars 2020 landing press kit). The remote sensing mast has no checked source, so it has no entry. No part entry names a lesson. The Moon's credits used to list every world's relationship sources, Mars's included; they now list only the Moon's.

#### Communications

*Decided:* data and communications are a real constraint on Mars: delay to Earth, bandwidth through relay orbiter passes, and possibly science that counts only once it is sent home. It is a design decision for now and is not built in the first Mars version.

#### Campaign and screens *(decided during implementation, Phase M4)*

- **Moon to Mars.** The Moon debrief's button reads "Continue to Mars" and states the Mars minimum budget. The Mars design screen shows "Mission 2 · Mars, Jezero crater", the balance carried over, the Titan pass mark, and that parts and ticket tiers are the Moon's in this version. The ticket screen repeats the tier note. *(Decided November 15, not built:)* the note changes when the Mars catalog (Mars plan Phase 1) and the Mars tiers (Phase 3) land. *(Mars step 1, built:)* with the Mars catalog, the design screen and the design tutorial say the parts are the Moon's without the two Moon-only instruments, and that the ticket tiers are still the Moon's; the ticket screen's tier note is unchanged until the Mars tiers land. *(Mars step 3, built:)* the design screen and the design tutorial now say Mars has its own parts (the Moon's without the two Moon-only instruments, plus the new power, battery, heater, wheels, arm, mast and four instruments) and its own ticket tiers with a Heavy tier; the ticket screen says "Launches to Mars have their own ticket tiers: the Moon's three, and a Heavy tier for rovers up to 100 kg."
- **Mars tutorials.** Mars has its own design tutorial (the transition, designing for the night, the dust storm) and drive tutorial (sols, lights on or sleep, night cold, the storm forecast, instrument and map). Each opens by itself on the first Mars visit, even if the Moon tutorials were seen; tutorials seen are saved per world. *(Mars step 8, built:)* the design tutorial adds "Power through the night" (the Night energy line, solar versus the RTG, the two heaters) and "Arm and mast" (which instruments need which, no mounting point, the mast's wider photo zones); the drive tutorial has a line for each of the eight Mars instruments and a "Where to go first" page.
- **Landing briefing.** Jezero crater and its ancient lake (sourced), the distance and direction to Perseverance's landing site (computed from the terrain data), and a "New on Mars" list: sols, the night choice, night cold, the dust storm forecast.
- **Titan: coming soon.** After a passed Mars round: banked RP, balance, records held, and a campaign record table with one row per passed mission (outcome, net change, RP, milestones). A failed Mars round (balance below the Titan pass mark) restarts from the Mars snapshot.
- **Titan pass mark.** *Decided November 15 by Owner B: a fixed placeholder of 800 (`budget.minimumBudget.titan`, was 0); Owner A to revisit. Kept at 800 until the balance patch (MS1, November 15); see [Balance on Mars](#balance-on-mars).* From the current Mars rewards: a rover that idles at the lander and survives earns about 190, so it ends at about 770 at most from a 1,000 arrival and fails; a frozen run fails; a good camera or drill run (about 470 to 490) passes from a typical Moon result (about 820 to 990 on arrival, 450 to 550 spent on rover and ticket).
- **Title screen.** The kicker reads "Campaign · The Moon, then Mars" (since T4: "Campaign · The Moon, Mars and Titan"); the cover and its caption stay the Moon's.
- **Credits.** The credits list every world, each with its own terrain, imagery, events, milestone facts and debrief comparisons, whichever world the campaign is on. *(Mars step 8, built:)* each world also lists its own instrument facts (Mars only those that differ from the Moon's: MEDA, RIMFAX, SuperCam, SHERLOC, PIXL), the sources behind its own lessons (the Moon section no longer lists Mars's), and on Mars the real basis of the new parts and a placed-by-design note.

### The Titan mission

*Owner B draft, November 15, 2026.* Items marked decided were decided by Owner B on November 15 (Owner A to confirm the joint ones: lesson and length). *Proposed* items are suggestions the build uses until someone says no. Facts marked *(to fact-check)* are checked by the research track before they reach `text.json`. **Titan parts wait for Owner A** (question 8): the demo plays Titan with the Moon parts and ticket tiers, and no placeholder parts are added. Rewards and rates marked "interface" are set together, as on Mars.

**Lesson: a steady power budget in the deep cold.** *Decided (Owner A to confirm).* The Moon teaches mass versus cost; Mars adds a sunlight budget that changes every sol. Titan takes the Sun away. Sunlight at the surface is far too weak for solar panels (Dragonfly carries an MMRTG for this reason), so energy is a fixed budget the player cannot refill faster by driving into the light. Every powered choice (driving, lights, staying awake) draws on that budget, and the cold punishes saving energy by sleeping: the rover's electronics keep it warm only while they run. Mass versus cost still applies.

- **With the Moon parts (demo).** Solar panels earn almost nothing, so Titan plays as a battery-only mission: the battery choice and how the player spends it decide the run. The design screen and briefing say so plainly ("Solar panels: almost no power at Titan").
- **With Owner A's catalog (later).** A radioisotope power source (small, constant income, waste heat that warms the rover) turns the fixed budget into a steady trickle, and the trade becomes power source versus battery versus heater. The rules accept a constant-power part effect so this slots in without rework.

| Element | Design |
| --- | --- |
| Length | 15 minutes of play covering one Titan day (about 16 Earth days) |
| Site | Interdune corridor in the Shangri-La dune field, near Selk crater, where Dragonfly is going |
| Day and night | One long day and one long night: about 5 min of day, 7.5 min of night, then dawn |
| Power | No useful solar; a fixed battery budget (demo) |
| Cold | Always, day and night; sleeping lets the rover cool |
| Events | *Proposed:* one methane rainstorm |
| Core puzzle | Spending a fixed energy budget across one long night without freezing |
| Ending | The last mission: the campaign ends, and the debrief reveals that the real Titan mission flies |

#### Site: Shangri-La dunes near Selk crater

*Decided:* near Dragonfly's landing region, on its route to Selk. Dragonfly will land in the interdune areas of the Shangri-La dune field and fly toward Selk, an impact crater about 80 km across at 7°N, 199°W, where liquid water may once have mixed with organics ([research 09](research/rover-engineering/09-titan-surface-data.md)). Dragonfly's landing area is a 149 × 72 km ellipse southeast of Selk, and NASA plans about 115 km of travel from the landing site.

- **Terrain modeled on real data.** *Decided:* Titan has no rover-scale elevation model. Cassini's radar mapped the dunes and Selk at hundreds of meters per pixel, and its altimetry and stereo topography are sparse. The play area is generated from published measurements of the Shangri-La dunes (linear dunes running west to east, about 1 to 2 km wide, 1 to 4 km apart and up to about 150 m high, separated by flat interdune corridors; the game uses about 100 m; [research 09](research/rover-engineering/09-titan-surface-data.md)), and Selk's rim is placed on the horizon from Cassini maps. The rim is low and broad (about 200 m high, slopes about 3°), so it is a faint line in the haze, not a wall. The credits and the briefing say "modeled on Cassini data", never "real elevation".
- **Play area.** *Proposed:* 8 km × 8 km at 5 m, the Moon and Mars format, so the loader carries over. A few dunes cross the map; the rover lands on a firm interdune corridor and can follow it or climb over a dune.
- **Ground.** Dune sand is dark and soft (the Moon's sinkage and slip rules, from a soft-ground mask like Séítah's); interdune ground is brighter and firm. The ground texture is generated to match Cassini's radar and infrared look (dark dunes, bright interdunes), with Huygens-like pebbles near the landing.
- **Sites** *(Proposed, the pipeline sets real positions)*: the landing corridor, a dune crest viewpoint over the dune field, a dune-crossing route, a bright interdune patch to sample, and a field of Selk ejecta blocks at the edge of the map (the rocky area and the farthest goal).
- **Where the play area is** *(decided, pipeline and main, November 15)*. Centered at 5.162°N, 161.449°E (198.551°W), 85 km from Selk's center, on the line from Selk to the center of Dragonfly's landing ellipse (3.72°N, 161.8°E, 149 × 72 km; Lorenz et al. 2021). That is about 30 km north of the ellipse, on the route Dragonfly will fly. Selk's rim is about 45 km away to the north-northwest. Its ejecta blanket reaches about one crater radius beyond the rim, so its outer edge crosses the north of the map, and the dunes end against it. Inside the ellipse, the block field would have to be invented. Titan's curvature hides Selk's rim from the landing (2.7° below the horizon). From the dune crest viewpoint the rim is the skyline, and the haze hides it anyway.
- **As built** *(pipeline, November 15; sites moved closer the same day for the battery-only budget of about 1.5 km per mission)*.
  - **Dunes.** They run west to east (Radebaugh et al. 2008), 2.2 to 3.3 km apart. Dunes 2 and 3 have crests 85 to 110 m high on bases 1.3 to 1.4 km wide, with wide, low plinths around them, and a branch joins Dune 2 in a Y-junction. That is at the low end of Cassini's 100 to 150 m, so the flanks stay drivable: at most 17° at 5 m, and about 12° on most flanks.
  - **Dune 1.** The last dune before Selk's ejecta is smaller: about 50 m high and 0.75 km wide. It bends to about 80° to run along the ejecta edge, and dunes do divert along obstacles.
  - **Corridors.** Flat, firm interdune corridors 1 to 1.5 km wide lie between the dunes.
  - **Landing.** Local (-1280, -1050), 5.1854°N, 161.4208°E, in the corridor just south of Dune 1, with a mean slope of 0.5°.

  Drive distances from the landing, on a 10 m grid with slopes up to 18° and a mild cost for loose sand:

| Site | What it is | Drive |
| --- | --- | --- |
| Dune crossing: start | Foot of Dune 1's saddle, in the landing corridor | 148 m |
| Bright interdune patch (sample) | Sand-free bright flat, radius 90 m, in the landing corridor | 510 m |
| Dune 1 saddle | 24 m high, firmer sand, max slope 7° on the route | 558 m |
| Dune crossing: end | North of Dune 1, at the edge of Selk's ejecta, 94 m inside the north corridor outline | 958 m |
| Dune sea viewpoint | Dune 1 crest, 56 m above the landing, looking south over the dune field | 982 m |
| Selk ejecta field (rocky area, survey lead) | Blocks at the outer edge of Selk's ejecta, radius 200 m, about 42 km from the rim | 1,258 m |

- **Soft ground** *(as built)*. The soft-ground mask is graded and is the authoritative one: loose crest and upper-flank sand 0.85, lower flanks 0.3 to 0.6, plinths, interdunes and ejecta 0, and Dune 1's saddle at most 0.25. Under the Moon's ground rules, a 60 kg reference rover slips 0.16 on flat loose sand, so it gets stuck (0.2) only when it climbs straight up a loose flank steeper than about 14°. The crossing route stays at or below 0.08 and the route to the viewpoint at 0.16. Heavier rovers or weaker wheels sink more. Circles covering the loose sand are also given for the circle rule. Reading the mask directly is better (Integration).
- **Gravity** is about one-seventh of Earth's (1.35 m/s²), a little less than the Moon's 1.62 m/s² ([research 09](research/rover-engineering/09-titan-surface-data.md)).

#### Time: one Titan day in 15 minutes

*Decided:* 15 minutes covering one Titan day, as proposed in [Time on each world](#5-time-on-each-world). A Titan day is about 15.9 Earth days, roughly half light and half dark.

- **450 s of day, then 450 s of night**, a single cycle.
- **The mission starts in the morning.** *Proposed:* 150 s after sunrise, matching the Mars start. The player gets about 5 minutes of day, then one 7.5-minute night, then dawn returns for the last 2.5 minutes. Surviving the night to see dawn is the mission's climax.
- **No clock.** The Sun is a dim disc behind the haze and follows a real path for the site's latitude and season (Dragonfly arrives in late 2034, in northern winter, when the Sun is about 20° south of Titan's equator, so the noon Sun at the site is about 65° up and to the south; [research 09](research/rover-engineering/09-titan-surface-data.md), our calculation).

#### Light and sky

*Proposed:* daylight at Titan's surface is very dim (darker than Earth just after sunset; often quoted as about a thousandth of Earth's daylight; [research 09](research/rover-engineering/09-titan-surface-data.md)) and scattered by thick orange haze, so there are almost no sharp shadows. The game keeps it readable: a hazy orange-brown sky, soft light, short visibility, a faint Sun. Night is close to black; Saturn is hidden by the haze. Lights are what let the rover see at night.

*How it is drawn (decided during implementation, T2):* about 85% of the light is diffuse sky light, so rover shadows are faint and soft. A capped eye adaptation keeps the day dimmer than a clear Mars noon but readable. The sky goes from orange-brown by day to a darker, redder dusk and a long twilight, then a night with no stars. The haze hides 95% of the terrain by about 5 km. During the methane rain the scene darkens, the Sun disappears, visibility closes in to about 250 m, and rain streaks fall. Dark dune sand and brighter interdunes come from the generated ground texture. All of these values are in `data/titan/tuning.json` (`look`).

##### Demo visuals *(decided November 15 by Owner B; presentation only, no gameplay change)*

Five additions to make Titan read as Titan on video. None of them changes the rules: traction, visibility for milestones, energy and cold stay as they are.

- **Methane raindrops:** large drops falling slowly. In Titan's thick air and low gravity, raindrops can grow to about 9.5 mm across (Earth's largest are about 6.5 mm) and fall at about 1.6 m/s, about 6 times slower than Earth's (9.2 m/s) (Lorenz 1993, *Planetary and Space Science* 41:647). The game draws them larger than life so they read on screen.
- **Wet ground:** during the rain the ground darkens and takes a faint sheen, then dries over a few minutes. Cassini saw a large area darken after the 2010 equatorial storm, most likely from rain.
- **Methane clouds:** a faint, slow-drifting streaky cloud layer, with soft cloud shadows moving over the dunes. Cassini and Huygens observed methane clouds; their exact look here is a game rendering.
- **Ice pebbles and sand ripples:** rounded water-ice pebbles (about 5 to 15 cm) scattered on the firm interdune ground, densest near the landing, as Huygens photographed in 2005; fine ripples on the dune flanks.
- **Headlight beams:** at night the floodlights show as beams in the thick, hazy air, and raindrops glint in them.
- **Dusk sky:** the sky darkens overhead toward dusk and the glow around the setting Sun brightens, so the sunset reads as the turning point of the mission.

#### Power and night

*Proposed*, all numbers placeholders tuned against the Moon parts and checked by a battery-only test, as `marsNight.test.ts` checks Mars:

- **Solar income** is the Moon panel rate times a tiny Titan factor (effectively zero), plus nothing at night.
- **Night** uses the Mars night rules: lights on to keep driving (higher drain), awake without lights (electronics only, no driving), or sleep (P, slow drain, wakes at dawn).
- **Sleeping fast-forwards time.** *Proposed:* while asleep at night, the clock runs 4× faster, so a player who sleeps through the whole night waits under 2 minutes instead of 7.5. Battery drain and cooling still follow game time. The mission still covers one Titan day; it just takes less wall time for a sleeper.
- **The balance target:** a big-battery build that drives sensibly by day and sleeps at night survives; driving with lights all night empties a small battery; a careful lights-on night is possible with the big battery and little day driving.

#### Cold: always on

*Decided:* Titan is always cold, about 94 K (−179 °C), day and night.

- *Proposed:* the cold never lets up: a constant base freeze rate pushes on the rover everywhere, all mission.
- Heat sources cut the rate: the radioisotope heater (Moon part), and the rover's own electronics while it is awake. Driving warms a little more than sitting awake. Awake with a heater, the heat outweighs the cold and the meter stays at 0 (intended: staying awake keeps the rover warm). Asleep, in the rain, or without a heater, the rover cools and the meter climbs. The player text says this, not that the meter "rises all mission" *(Phase T8)*.
- **Sleep cools the rover.** Asleep, only the heater fights the cold, so a long sleep brings the rover close to freezing. Without a heater, a sleeping rover freezes before dawn and an awake one freezes within the mission. This is the Titan trade: sleep saves energy and costs warmth; staying awake keeps warm and costs energy. With the heater, a sleeper survives the night with little margin.
- Real basis: Dragonfly keeps warm with the waste heat of its MMRTG inside an insulated body, which gives about 2 kW of heat and about 100 W of electricity ([research 09](research/rover-engineering/09-titan-surface-data.md); the exact watts are *unverified*).

#### Events

*Proposed:* solar flares, moonquakes and dust storms stay on their worlds.

| Event | What happens | Player response | Real basis |
| --- | --- | --- | --- |
| Methane rainstorm | One per mission, forecast 60 s ahead by the lander's weather station. For about 60 s, visibility closes in, photos do not count, and the cold rises faster. | Park, or keep driving blind on a known route; sleep through it (and get colder) | Cassini saw a large equatorial cloud system in late 2010, and more than 500,000 km² of ground darkened afterward, most likely from methane rain ([research 09](research/rover-engineering/09-titan-surface-data.md)) |

#### How the Titan rules work *(decided during implementation, T3)*

The rules are in `game/src/rules/titan.ts`, plus the Titan parts of `mission.ts`, `sol.ts` and `storm.ts`. The numbers are in `game/data/titan/tuning.json` (`sol`, `night`, `sleep`, `titanPower`, `titanCold`) and `events.json` (`rainstorm`). All numbers are placeholders, tuned against the Moon parts.

- **Day clock and Sun.** Titan reuses the Mars sol clock with a single sol of 900 s: 450 s of day, then 450 s of night.
  - The mission starts 150 s after sunrise. Night falls at 300 s, dawn comes at 750 s, and the mission ends at 900 s.
  - The Sun follows real local solar time at the site (5.2°N), at a steady rate.
  - The season comes from Saturn's tilt (26.73°). Late 2034 is Ls 309, so the Sun is 20.5° south of the equator.
  - The Sun starts about 51° up in the east-southeast, stands 64° up due south at noon, and sets in the west-southwest.
- **Sleep fast-forwards the night.** Asleep at night, the clock runs 4× faster, and a step that crosses dawn finishes at normal speed. A slept night takes under 2 minutes, so a sleeper plays the mission in about 9.5 minutes. Drains and cooling follow game time.
- **Power:**
  - Solar income is the Moon panel rate × 0.001 by day and nothing at night. A fixed panel earns about 0.3 over the whole day.
  - The electronics drain 0.2 per second whenever the rover is awake, day and night, because no sunlight covers them. *(Main agreed.)*
  - The lights drain 0.6 per second (lights and electronics) when awake at night. A parked lights-on night costs 270.
  - Asleep (P), the drain is 0.05 per second. A slept night costs 22.5.
  - Without lights the rover cannot drive at night. Sleep ends at dawn by itself.
- **The lander does not recharge.** A rover survives wherever it parks, as long as its energy and warmth last. Titan has no "return to base".
- **Constant power.** A part may have a `constantPower` effect: steady income day and night, awake or asleep, on any world. Its waste heat is that part's own `heat` effect. No part uses it yet; Owner A's radioisotope source will.
- **Cold, always on:**
  - The freeze meter rises 0.36 per second everywhere.
  - Heat cuts this by 0.1 per heat unit, which replaces the Moon's 1.5 on Titan, so the heater is about half the fight. The heater gives 2 units. The electronics give 2 while awake, and driving adds 1.5.
  - Asleep, only the heater counts. A negative rate means the meter recovers.
  - Without a heater, a sleeper freezes 278 s into the night and an awake parked rover freezes after about 625 s.
  - With the heater, a sleeper reaches about 72 by dawn, or about 81 if the rain falls at night. Awake with the heater, the meter recovers.
- **Methane rainstorm:**
  - It starts at a random time from 240 to 600 s, is forecast 60 s ahead and lasts 60 s.
  - It builds up and dies down over 10 s.
  - At full strength the base freeze rate is ×1.5, so every rover cools faster, even awake with the heater.
  - Photos do not count from start to end.
  - Visibility comes from the renderer (`look.fog`), so the rain has no visibility number in the rules.
- **Soft ground.** On Titan, softness comes straight from the graded `soft-ground.png` (value / 255, sampled between pixels). The terrain circles are a fallback.
- **Battery-only check** (`titanEnergy.test.ts`, stands in for a Titan `winPaths`), with the Moon parts and over 8 rain seeds:
  - Big battery (600), driving by day above a 30% reserve and sleeping at night, survives with about 1.2 km driven. The small battery (400) survives the same plan with about 0.9 km.
  - The big battery reaches a goal 1.54 km out by day (1.4 km plus 10% for dunes), sleeps there and survives with about 10 left.
  - The small battery runs out about 30 s into the night if it drives with the lights on, and before dawn if it parks with the lights on after driving by day.
  - A careful lights-on night with the big battery survives with about 54 left: 300 m by day, 300 m at night, then parked with the lights on.
  - Without a heater, a sleeper freezes before dawn and an awake rover freezes within the mission.
  - Because of this check, the ejecta field moves to about 1.2 to 1.4 km and the Dune sea viewpoint to about 1 km (main asked the pipeline). At 3.4 km the field was out of reach of any Moon build on battery alone.

#### Titan milestones

*Proposed*, rewards are interface numbers. Every fact is fact-checked before it reaches `text.json`.

| Milestone | Category | How to earn it | Equipment |
| --- | --- | --- | --- |
| Touchdown | Record: first touch | Land on Titan for the first time | None |
| Odometer | Capability: coverage | Drive set distances | None |
| Mapper | Capability: coverage | Reveal a set share of the map | None |
| Dune crossing | Capability: difficulty | Cross a dune from one interdune corridor to the next without getting stuck | None |
| Night drive | Capability: robustness | Drive a set distance during the long night | Lights, heater |
| Dawn | Capability: robustness | Still be running when the Sun rises again | None |
| Storm survivor | Capability: robustness | Still be running when the methane rain clears | None |
| Dune sea | Pretty picture | Photograph the dune field from a dune crest | Camera |
| Organic sands sample | Scientific: new information | Drill at up to three sites, 200 m apart (Moon rule) | Drill |
| Crater ejecta | Record: first discovery | Drill in the Selk ejecta field, where water and organics may have mixed | Drill |
| Clean run | Capability: robustness | Finish without damage | None |

##### How the Titan milestones work *(decided during implementation, T5)*

All 11 are built. Rules in `game/src/rules/milestones.ts` and `rules/titanMilestones.ts`; triggers, rewards and facts in `game/data/titan/milestones.json`. Zones come from the Titan `terrain.json` features and are sized by the terrain, so Titan needs no milestone tuning of its own. Money and RP are placeholders (`interface`, Owner A), sized like Mars. A rover that only survives at the lander earns about 270 with the survival payout (Touchdown, Dawn, Storm survivor, Clean run). An active camera run earns about 2.6 times that, and a drill run about 3 times. Facts were drafted from [research 09](research/rover-engineering/09-titan-surface-data.md) and fact-checked by the research track.

- **Zones.** Each dune crest is a zone: within the crest's `zoneRadius_m` of its crest line. Each interdune corridor is a zone (its outline). The dune-crest viewpoint is a 60 m circle (`photoZoneRadiusM`). The sample patch uses its own radius. The Selk ejecta field is `rockyAreas[0]`, sized like the boulder zones.
- **Dune crossing.** The rover must drive from one corridor into a different corridor, and it must be on a dune crest after leaving the first one. Corridors can join around the end of a dune, so the crest is required, and driving around a dune does not count. Getting stuck for good ends the mission, so any crossing the rover finishes was made without getting stuck.
- **Dune sea** counts anywhere on a dune crest, and at the dune-crest viewpoint. The viewpoint is a survey lead and stands on a crest, but it is only a suggestion: the crossing saddle works too. The camera's direction is not checked, as with the Moon's rim viewpoints. During the methane rain, photos still go into the album but no photo milestone counts.
- **Dawn** is earned on the step where the night ends while the mission is still running. A sleeping rover still counts as running.
- **Storm survivor** is earned when the methane rain clears while the mission is still running, as on Mars. Sleeping through the rain counts too.
- **Night drive** counts only distance driven at night, in two stages (100 m and 300 m). It needs lights and a heater, as on Mars. A lights-on night costs a lot of battery with the Moon parts, so the stages are the Mars ones.
- **Odometer** stages are 400 m, 1 km and 2 km. Titan is battery only, and a whole mission drives about 1 to 2.4 km (from the rules track's numbers). **Mapper** is 1.2% of the map, about 1.3 km of driving on new ground.
- **Organic sands sample** can be drilled anywhere at up to three sites: at least 200 m from the lander and from each other (the Moon rule). The bright interdune patch is a suggested first site, not a requirement. **Crater ejecta** is the first sample drilled in the ejecta field. That sample also counts as an Organic sands site.
- **Survey leads**, nearest first: the bright interdune patch, the dune-crest viewpoint, the Selk ejecta field, and Selk crater itself. Selk's center is tens of kilometers off the map, so it is never discovered. Its lead stays an arrow on the map's edge, with a distance to the rim. The minimap draws dune crests as lines, interdune corridors as dashed outlines, the sample patch and the ejecta field as circles. Titan has no cold-zone legend. Lead text is in `data/titan/text.json` → `survey`.

#### Campaign end

*Proposed:* Titan is the last mission.

- **Mars to Titan.** The Mars debrief's button reads "Continue to Titan"; the Titan design screen shows "Mission 3 · Titan, Shangri-La dunes", the balance carried over, and that parts and tiers are the Moon's in this version. A short Titan design tutorial and drive tutorial explain the new rules: no solar, always cold, sleep cools, one long night.
- **Landing briefing.** Titan in a few facts (thick nitrogen air, methane rain, −179 °C), the site, and "New on Titan".
- **Debrief: the real mission flies.** The Titan debrief compares the rover with Dragonfly, a nuclear-powered rotorcraft that flies between sites because Titan's thick air and low gravity make flight easier than driving. The lesson: the right vehicle depends on the world ([rover-engineering/04](research/rover-engineering/04-rover-games-and-scenarios.md), card 12).
- **Campaign complete.** Replaces "Titan: coming soon": banked RP, final balance, records held, and the campaign table with one row per mission. Superseded: see [Titan goal and the campaign dashboard](#titan-goal-and-the-campaign-dashboard-decided-november-15-by-owner-b-replaces-the-final-mark).
- **Credits** add the Titan sources (Cassini radar and maps, Huygens, Dragonfly).

##### Campaign end as built *(decided during implementation, Phase T4, Owner B to confirm)*

- **Mars to Titan.** The Titan design screen shows "Mission 3 · Titan, Shangri-La dunes", the balance carried over, the final mark, the Moon parts note, and a separate warning: "Solar panels give almost no power at Titan. In this version the rover runs on its battery alone." Power cards and the sheet show the panel's income at Titan (the Moon rate times the Titan solar factor). The ticket screen repeats the tier note and the warning.
- **Titan tutorials.** Design (3 pages): Mission 3, no useful sunlight (the battery is the budget), always cold (heater, electronics, sleep cools, lights). Drive (5 pages): one Titan day, energy and the long night (lights or sleep, sleep runs time faster), sleep saves energy but the rover cools, the methane rainstorm and its forecast, instrument and map. Numbers come from the Titan data. Each opens by itself on the first Titan visit.
- **Landing briefing.** "Titan in a few facts" (air, cold and methane rain, gravity, dim light), the site and Selk (distance and direction computed from `terrain.json` `features.selk`), "New on Titan", the survey leads and the sources.
- **Debrief.** "The real mission flies": Dragonfly in four short paragraphs (rotorcraft, why flying is easier on Titan, nuclear power and waste heat, launch no earlier than July 2028 and arrival in late 2034), a table comparing the rover flown (its wheels, battery and heater) with Dragonfly, and the lesson. It is always shown on Titan and replaces the per-outcome rover history there (that history is Moon and Mars facts). Fact-checked by research.
- **Campaign complete** (screen id `complete`): banked RP, final balance, records held, the start and final balance, the campaign table with a total row, one line per world on what it asked of the rover, and buttons for the title, the credits and a new campaign.
- **Titan final mark** *(superseded November 15: Titan passes on survival, see below)*. Kept at the placeholder 0 (`budget.minimumBudget.complete`): a Titan round fails only if the balance goes negative, and then restarts from the Titan snapshot. The "rover lost before dawn" condition is not added. Owner A sets the mark.
- **Credits.** The Titan section lists the terrain and texture sources from the pipeline's files ("modeled on Cassini data"), the landing briefing sources, the rainstorm source once it is fact-checked, and the Dragonfly debrief sources.

##### Titan goal and the campaign dashboard *(decided November 15 by Owner B; replaces the final mark)*

- **Titan's goal is to survive.** Titan is the last mission, so a Titan round passes when the rover is still running at the end of the 15 minutes (900 s of mission time; a sleeping rover counts as running). It fails if the mission ends early: out of energy, frozen, stuck or destroyed. The balance does not decide Titan: the final money mark (`budget.minimumBudget.complete`) is no longer used. Money and RP are still earned and shown.
- **A failed Titan round** shows when and how the rover was lost, and offers two choices: try Titan again from the Titan snapshot, or end the campaign and see the dashboard with Titan marked as not survived. *(Decided by main so a player is never trapped on the last mission.)*
- **Campaign dashboard.** When the player is done, the Campaign complete screen becomes a stats dashboard for the whole campaign:
  - A headline: whether the Titan rover survived, total distance driven, milestones earned out of those available, final balance, banked RP.
  - One card per mission (Moon, Mars, Titan): outcome, time survived out of the mission length, distance driven, milestones earned out of available (by category), money earned, money spent on the rover and ticket, RP, energy used and the lowest battery level, the highest cold reading, samples drilled and photos taken, the rover build (parts and payload), and for Mars and Titan the nights survived and how many were spent asleep or with lights on.
  - Charts: the balance across the campaign (start, then after each mission) and milestones by category per mission.
  - Records held, then buttons for the title, the credits and a new campaign.
  - The stats are recorded per round as each mission ends and are kept in the save, so the dashboard survives a reload.

##### Titan goal and the dashboard as built *(decided during implementation, November 15, Owner B to confirm)*

- **Pass rule.** The last mission passes when the rover survives to the end (`rules/campaign.ts` `roundPasses`); Moon and Mars keep the pass mark. `budget.minimumBudget.complete` is removed. The Titan design screen and tutorial state the survival goal instead of a final mark.
- **Failed Titan debrief.** "Rover lost at m:ss of 15:00 mission time: cause." Buttons: "Try Titan again" (Titan snapshot) and "End the campaign". Ending keeps the lost round's money, RP and records, and Titan is not marked completed.
- **Round stats** (`rules/roundStats.ts`): one `RoundStats` per mission in the save (`stats`), recorded passed or not; a retry replaces it. Energy used is the battery's total discharge (drops in charge, net of solar income in each step). A night counts as lived through at dawn, or at a survived end, and is classed by how most of it was spent: asleep, lights on, or awake in the dark. Rounds from older saves show "Not recorded".
- **Dashboard** (`ui/dashboard.ts`, text in `dashboard`): five headline tiles, a card per mission, an SVG balance line and grouped milestone bars (outline = available, fill = earned), records held, the world lessons, and the buttons. `?dashboard=demo`, `demo-lost` and `demo-old` show sample campaigns.

#### The Titan mission as played *(decided during implementation, Phase T6, Owner B to confirm)*

How the Titan rules reach the player (`game/src/ui/titanMission.ts`, small hooks in `missionScreen.ts` and `hud.ts`). The words are in `data/titan/text.json` (`day`, `rain`, `cold`).

- **Clock and Sun.** The scene, the sunlight test and photos all use the real Titan Sun. There is still no clock: the HUD line under the panel line reads only "Titan day" or "Titan night".
- **Panel line.** On Titan it reads "Solar panel: almost no power in the haze" by day and "no power at night". It never says "in sunlight".
- **Sleep fast-forward.** Asleep at night (P), the mission clock runs 4× until dawn. Physics stays on real time and the rover is parked. A banner reads "Sleeping · time runs 4× faster until dawn", and a warning says that only the heater keeps the rover warm. Asleep by day, the clock runs normally and the banner says the rover is powered down. The rover wakes by itself at dawn.
- **Night.** Lights come on whenever the rover is awake at night, and the HUD says the battery is draining fast. Without lights the rover cannot drive at night, and a standing warning offers sleep.
- **Notices.** The sunset notice offers lights or sleep, or sleep only for a rover without lights. Dawn says the rover made it through the night. None of the notices mention returning to the lander, which does not recharge on Titan.
- **Rain.** The forecast notice comes 60 s ahead, and a countdown bar ("Methane rain in N s") uses the flare warning's place, since Titan has no flares. Notices mark the start and the end of the rain. The scene's haze follows the rain intensity. A photo in the rain goes into the album with the notice that it does not count.
- **Cold.** The cold meter is always shown. The cold warning appears once the meter reads at least 1%.
- **Sunset soon** *(Phase T8)*. About 30 s before sunset (`tuning.json` → `sol.sunsetWarningSeconds`) a notice says the Sun is setting and the night is coming, so the player can head for safe ground, turn the lights on or plan to sleep. In the last 40 s or so the light visibly dims and warms as the Sun drops (`look.dusk`).
- **Soft ground.** On Titan, softness is read from the graded `soft-ground.png`, as the terrain file says (`maskIsAuthoritative`). The Moon and Mars keep their circles.
- **Night light.** `look.nightLight` is 0.07, up from 0.04. The night stays near black (the sky-light test's ceiling is about 0.072), but the rover is no longer a black silhouette and the dune skyline shows faintly.
- **Handling.** `rover.gravityScale` stays 4.8. On the real terrain, the saddle crossing (at most 7.8° and softness 0.23) runs at full speed with all wheels down. The loose face up to the Dune sea viewpoint (10 to 12.5°, softness up to 0.84) slips about 0.1 but does not dig in.

#### Spine decisions *(decided during implementation, Phase T0, Owner B to confirm)*

- **Campaign end marker.** The campaign order is Moon → Mars → Titan → `complete`. Titan is playable; `complete` is the end screen. Saves at the old `titan` end marker (after a passed Mars round) now open the Titan design screen.
- **Titan final mark** *(superseded November 15: Titan passes on survival)*. A placeholder of 0 (`budget.minimumBudget.complete`), so a Titan round fails only if the balance goes negative. The Titan entry minimum stays the Mars pass mark (800). The final-mark rule ("rover lost before dawn and the balance below a final mark") is left to the campaign track and Owner A.
- **Handling.** Titan gravity is 1.35 m/s². `rover.gravityScale` is 4.8, so ground gravity is 6.48 m/s², the Moon's tuned value, as on Mars.
- **Placeholders.** Until the sky track lands, Titan uses the Mars look. Until the rules and integration tracks land, it uses the lunar Sun model fixed near noon. The one Titan day is written in the Mars sol format (`tuning.sol`: 1 sol of 900 s, 450 s day, 450 s night, start 150 s after sunrise), and the rules track decides whether to keep it.

### Build order

1. **Moon:** being designed now.
2. **Mars:** built soon after. Moon RP unlocks Mars technology.
3. **Titan:** drafted November 15 for the demo; see [The Titan mission](#the-titan-mission).

Not planned for now: two-player mode and randomly generated maps.

## 11. Identity and presentation

| Element | Design |
| --- | --- |
| Game name | Rover Engineer |
| Agency | REL (Rover Exploration Laboratory). Fictional, with no NASA branding; real NASA missions can still be cited as facts. |
| Story premise | REL pays to secure a spot for its rover on the next launch to each destination. The bigger and heavier the rover, the higher the ticket tier it needs. |
| Player role | A new rover engineer at REL mission control |
| Tone | Scientific and formal, in plain English a high-school reader can follow |
| Characters | None. All text (tutorial, briefings, milestone pop-ups, debrief, the intro and the story lines) reads as neutral mission documentation, not dialogue. |
| Onboarding | A Welcome to REL intro, once per new campaign, gives the premise, the pass mark rule and the three worlds (see [§3](#3-campaign-the-outer-loop)). *(Decided November 15:)* each world's design desk adds two or three sentences on why REL is going to that site, the debrief adds a short story line between worlds and after a failed round, and Campaign complete adds a closing one. Tutorial text still guides the player through the design screen and the first drive. |
| Look *(decided November 15)* | "Mission control" screens: Chakra Petch for headings and labels, IBM Plex Sans for body text, IBM Plex Mono for numbers and readouts (self-hosted). Deep-space navy background and panels with thin cyan-tinted borders and corner brackets; amber is the main accent (primary buttons, money, highlights), cyan the secondary (HUD info and hints); orange-red still means warning and green means good. The title screen shows a live 3D cover: the game's rover on regolith under a low raking Sun with long shadows and Earth low on the horizon, as at the south pole site, with a slow orbiting camera (held still for reduced motion; a plain star background if WebGL is unavailable). The 3D mission view is unchanged. |
| Build preview *(decided November 15)* | The design screen shows the rover being assembled in 3D, live, as in a vehicle editor: part list on the left, a large viewport in the middle, the specification sheet on the right (on narrow screens the viewport becomes a strip above the parts and the sheet). The rover stands on a lit turntable in a dark assembly bay with a faint cyan grid. Only chosen parts appear; empty slots show nothing, and parts chosen before the chassis float where they would mount. A new or changed part drops into place with a brief cyan flash. The turntable turns slowly and the player can drag to rotate it; there are no labels. Reduced motion: no turning by itself and instant swaps. Without WebGL the viewport is hidden and the desk works as before. Presentation only: the preview uses the same model as the mission, and the complete rover looks the same in both. |
| Real facts | **Optional.** A "Mission history" setting, on by default, that players who just want to play can turn off. When on: a one-sentence real fact on each milestone pop-up, and a debrief comparing the rover's fate with a real rover's. Tutorial text is always shown. The same optional pattern is used for other extra learning, such as the real-speed pop-up on the design screen. |

### The engineer's desk as a parts editor

*Decided November 16, 2026, by the user. Replaces the part list of the build preview row above; the turntable, grid, snap-in flash and reduced-motion rules stay. Presentation only: no rule changes here (the payload rule is in [Payload: instruments and systems](#payload-instruments-and-systems)).*

The desk plays like a creature-creator parts editor: a big 3D rover in the middle, and a palette of part thumbnails grouped by category. Only that interaction pattern is borrowed; the look is the game's own (the dark-blue mission-control screens, the grid floor and turntable).

- **Layout.** The palette is on the left: a category list (Frame, Wheels, Power, Battery, Payload) and the thumbnails of the chosen category. The rover is large in the centre on the turntable. A stats panel on the right shows the budget, cost, mass and size with the ticket-tier gauges, the driving numbers, energy (with the Mars night-energy line), and the warnings. The launch-ticket button stays reachable at the bottom of the stats panel. The world story text, the not-offered notice, Help, the notebook button and the carried-over budget stay in the desk's header and notes.
- **Categories.** Frame (chassis), Wheels, Power and Battery are required: one each. Payload holds instruments and systems, in two groups, "Science instruments" and "Support and systems", with the mounting points used out of available.
- **Thumbnails.** Each part is a small rendered image of that part, built from the same 3D model as the rover, so it looks the way it will on the rover. Rendered once with one shared renderer, cached, and freed. Without WebGL each is a plain labelled tile.
- **Hover card.** Hovering a thumbnail, or focusing it with the keyboard, shows an info card: name, cost, mass, size, key effect, energy, "Can earn" and "Where" lines, and needs. The rover does not change on hover. The card's text is the old part card's text; lesson-blind rules still apply.
- **Click to fit.** Clicking a thumbnail fits it: in a required category it replaces the part; in the payload it toggles the item (a second click takes it off). Fitted thumbnails are clearly marked. Clicking a part on the 3D rover opens its category in the palette. No drag and drop: parts snap to their fixed places.
- **Blocked states** show on the thumbnail (dimmed), with the reason in the hover card: a full bay, a part that needs the arm or the mast, and a part the budget cannot cover. A part the world does not offer is not shown at all. *(Lead decision:)* a full bay and a missing need refuse the click, as the old cards did; a part that would take the build over budget is marked but can still be fitted, since the player may then trade down elsewhere (the launch stays blocked while over budget, as before).
- **Accessibility.** Thumbnails are buttons with accessible names and a pressed state; the keyboard reaches every one. On narrow screens the palette stacks above the rover, and the stats below.

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
