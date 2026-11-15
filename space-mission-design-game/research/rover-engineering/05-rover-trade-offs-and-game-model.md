# Rover Trade-offs and a Game Model

This document pulls the four rover research files together for the game concept: **the player receives a mission, designs a rover, a provided spacecraft delivers it, and the player keeps the rover alive and productive on the surface.** It covers what a rover is made of, the trade-offs engineers make, what they consider at each stage, why rovers die or last, and a simplified model the game could run. Facts come from files 01 to 04, which hold the primary sources. Everything in this file is **our synthesis and analysis**.

Researched and compiled November 14, 2026.

Quick navigation: [The player's journey](#the-players-journey-mapped-to-real-missions) · [Rover anatomy](#rover-anatomy-at-a-glance) · [Trade-off catalog](#rover-trade-off-catalog) · [Engineer considerations](#what-engineers-consider) · [Why rovers die or last](#why-rovers-die-and-why-they-last) · [Game model](#a-simplified-rover-game-model) · [Fit with the challenge brief](#fit-with-the-challenge-brief) · [First-version scope](#suggested-first-version-scope) · [Open items](#open-verification-items) · [Milestones and sustainment →](06-milestones-and-sustainment.md)

## The player's journey mapped to real missions

| Game step | Real-world equivalent | What the player decides | Detail |
| --- | --- | --- | --- |
| 1. Mission card | A science goal from the decadal survey or a mission's objectives (for example, biosignatures at Jezero, water ice at the lunar south pole) | Accept a goal, requirements, budget, and destination | [04: Mission card library](04-rover-games-and-scenarios.md#b-mission-card-library) |
| 2. Delivery limits | The lander or entry system sets maximum rover mass, folded size, landing ellipse, latitude and elevation limits, and arrival season | Nothing yet; these are hard constraints | [01: What the delivery system constrains](01-rover-missions-history.md#what-the-delivery-system-constrains) |
| 3. Landing site | Site selection balances science value against safety, power, temperature, and traversability | Choose a site from 3 to 5 candidates | [03: Landing site selection](03-surface-environments-and-operations.md#landing-site-selection) |
| 4. Rover design | Subsystem sizing under mass, volume, power, and cost limits | Pick power, battery, thermal, mobility, comms, autonomy, arm, and instruments | [02](02-rover-subsystems.md) |
| 5. Delivery | Launch, cruise, and landing are handled by the spacecraft | Watch; a small, clearly framed chance of landing failure is optional | [01: Rover mission phases](01-rover-missions-history.md#rover-mission-phases) |
| 6. Egress and checkout | Deployments (mast, panels, ramp), first images, instrument checkout | Respond to deployment problems | [01: Case studies](01-rover-missions-history.md#case-studies) |
| 7. Sol loop | Daily planning: energy budget, drive, science, relay passes, sleep | Plan each sol's activities | [03: Surface operations](03-surface-environments-and-operations.md#surface-operations) |
| 8. Seasons and events | Winter, nights, dust storms, wear, faults, communication blackouts | Park, hibernate, reroute, patch, or accept risk | [03: Sustainability strategies](03-surface-environments-and-operations.md#sustainability-strategies-from-real-missions), [03: Hazards](03-surface-environments-and-operations.md#hazard-and-anomaly-catalog) |
| 9. Extended mission | Senior-review style extensions cost operations money | Keep going or end | [01: Planned vs actual lifetime](01-rover-missions-history.md#planned-vs-actual-lifetime) |
| 10. End and debrief | Cause of end and science return compared with the plan | Learn what limited the mission | [01: Why some rovers outlive plans](01-rover-missions-history.md#why-some-rovers-outlive-plans-and-others-die-young) |

## Rover anatomy at a glance

| Subsystem | Job | Main options | Key real numbers | Detail |
| --- | --- | --- | --- | --- |
| Mobility | Move safely over terrain | 4, 6, or 8 wheels; rocker-bogie or active suspension; wheel size and material; legs or flight as alternatives | Rocker-bogie climbs about one wheel diameter; 45° static stability, 30° software tilt limit; top speeds from about 1 cm/s (micro) to 4 to 5 cm/s (MER, MSL) | [02: Mobility](02-rover-subsystems.md#mobility) |
| Power | Supply energy every sol and through the night | Solar arrays plus battery, or an MMRTG plus battery | MER about 900 Wh/sol at start; MMRTG about 110 W (about 2,700 Wh/sol), 45 kg; Pragyan about 50 W | [02: Power](02-rover-subsystems.md#power) |
| Thermal | Keep electronics and batteries within limits | Warm electronics box, aerogel, heaters, radioisotope heater units (about 1 W each), RTG waste heat | Li-ion batteries operate about -20 °C to +30 °C and charge above 0 °C | [02: Thermal](02-rover-subsystems.md#thermal) |
| Communications | Send data home and receive commands | Via the lander, direct to Earth, or relay through orbiters | UHF relay passes about 10 min, 30 to 600 Mbit per pass; direct-to-Earth 160 to 800 bps on MER's high-gain antenna | [02: Communications](02-rover-subsystems.md#communications) |
| Navigation and computing | Drive safely and handle faults | Blind drive, hazard avoidance, AutoNav; rad-hard processors, vision coprocessors | Perseverance record sol drive 411.7 m (AutoNav) | [02: Navigation](02-rover-subsystems.md#navigation-autonomy-and-computing) |
| Arm and sampling | Place instruments, drill, scoop, cache samples | Arm reach and tools, drills, sample tubes | Perseverance carries 43 sample tubes; Curiosity's drill feed fault was fixed with a new technique | [02: Arm and sampling](02-rover-subsystems.md#robotic-arm-and-sampling) |
| Science payload | Make the measurements the mission exists for | Cameras, spectrometers, radar, weather, radiation, drills | Instruments are only about 3 to 8% of rover mass | [02: Science payload](02-rover-subsystems.md#science-payload) |
| Structure | Hold everything, fold into the lander, survive landing | Chassis, deployable mast and panels | Rover is about 16% (MER) to 23% (MSL) of launch mass | [02: Structure](02-rover-subsystems.md#structure-and-mass-budget) |

The most surprising fact for players: **science instruments are a small slice of the rover.** Most of the mass and cost keeps the instruments powered, warm, mobile, and in contact with Earth.

## Rover trade-off catalog

### Mission and site

| Trade | Option A | Option B | What moves | Real example |
| --- | --- | --- | --- | --- |
| Science site vs safe site | Rough, exciting terrain near the target | Flat, safe, boring terrain | Landing risk, drive distance, science value | Jezero's delta became possible only with terrain-relative navigation ([03](03-surface-environments-and-operations.md#landing-site-selection)) |
| Latitude (Mars) | Near the equator | Mid or high latitude | Winter sunlight, temperature, ice access | At 25°S, winter sunlight falls to about 35% of the best season ([03](03-surface-environments-and-operations.md#mars-specifics)) |
| Lunar site | Equatorial near side | Far side or south pole | Power, comms, temperature vs unique science or water ice | Yutu-2 needs the Queqiao relay; VIPER faces low Sun and Earth below the horizon about half of each lunar day ([03](03-surface-environments-and-operations.md#moon-specifics)) |
| Design life target | Short and cheap (one lunar day) | Long and robust (years) | Cost, mass, night survival hardware | Pragyan was designed for one lunar day; Yutu-2 ran for years ([01](01-rover-missions-history.md#planned-vs-actual-lifetime)) |
| Rover size | Micro (about 10 to 30 kg) | Large (about 900 to 1,025 kg) | Capability vs cost, delivery limits, risk | Pragyan 26 kg; Perseverance 1,025 kg ([01](01-rover-missions-history.md#master-comparison-table)) |

### Power and thermal

| Trade | Option A | Option B | What moves | Real example |
| --- | --- | --- | --- | --- |
| Power source | Solar (cheap, light) | MMRTG (steady, heavy, scarce, costly) | Dust and winter sensitivity vs mass, cost, and approval | MER vs Curiosity ([02](02-rover-subsystems.md#power)) |
| Array area | Small, fits easily | Large, more energy | Stowed volume, mass, dust exposure | Zhurong's butterfly wings ([02](02-rover-subsystems.md#power)) |
| Battery size | Small and light | Large | Night and storm survival vs mass | VIPER's 5,420 Wh battery for 50 h dark survival ([02](02-rover-subsystems.md#power)) |
| Depth of discharge | Deep daily cycling | Shallow cycling | Usable energy now vs battery life | Perseverance: up to 60% depth of discharge, about 2,010 cycles over 3 years ([02](02-rover-subsystems.md#power)) |
| Heat source | Electric heaters only | Radioisotope heater units or RTG waste heat | Energy drain at night vs cost and scarcity | MER carried 8 heater units; a lunar micro-rover cannot survive the night without nuclear heat ([02](02-rover-subsystems.md#thermal)) |
| Hibernate or stay awake | Hibernate through night, winter, or storm | Stay awake with heaters | Battery drain vs risk of never waking | Zhurong never woke (dust on panels); Opportunity's 2018 storm ([01](01-rover-missions-history.md#case-studies)) |

### Mobility and operations

| Trade | Option A | Option B | What moves | Real example |
| --- | --- | --- | --- | --- |
| Wheel size vs mass | Small wheels | Large, wide wheels | Wheel mass and stowed volume vs sinkage and obstacle height | Curiosity carries about 2.7x MER's load per unit wheel diameter ([02](02-rover-subsystems.md#mobility)) |
| Wheel toughness | Thin, light wheels | Thicker wheels, more grousers | Mass vs wear life | Curiosity wheel damage; Perseverance's redesign ([02](02-rover-subsystems.md#mobility)) |
| Drive mode | Fast blind drive | Slow autonomous drive with hazard checks | Distance per sol vs risk of getting stuck | Spirit trapped at Troy; Opportunity stuck at Purgatory for weeks ([02](02-rover-subsystems.md#mobility)) |
| Autonomy level | Ground plans everything | Onboard AutoNav and vision computing | Compute cost and power vs sols saved | Perseverance roughly 3x faster across rough terrain ([02](02-rover-subsystems.md#navigation-autonomy-and-computing)) |
| Route | Short route over sharp rock | Longer smooth route | Time vs wheel wear | Curiosity's route planning and traction control ([03](03-surface-environments-and-operations.md#sustainability-strategies-from-real-missions)) |
| Operations tempo | Aggressive: big drives, many activities | Conservative: recharge sols, light plans | Science now vs longevity | Curiosity's 2026 power-saving operations ([03](03-surface-environments-and-operations.md#sustainability-strategies-from-real-missions)) |

### Science, data, and communications

| Trade | Option A | Option B | What moves | Real example |
| --- | --- | --- | --- | --- |
| Instrument count | Many instruments | Few, focused instruments | Mass, energy, data, heater load, cost | Instruments are 3 to 8% of mass, but each one pulls support mass with it ([02](02-rover-subsystems.md#overview-and-coupling-map)) |
| Arm and drill | Simple or none | Full arm with drill and sample cache | Science value vs mass, energy, fault risk | Curiosity drill fault; Perseverance pebbles in the bit carousel ([03](03-surface-environments-and-operations.md#hazard-and-anomaly-catalog)) |
| Comms path | Via the lander (cheap) | Own direct-to-Earth or orbiter relay radio | Mass and power vs independence from the lander | Sojourner depended on its lander; Yutu-2 depends on a relay satellite ([01](01-rover-missions-history.md#case-studies)) |
| Store or send | Collect more data | Downlink-limited plans | Science counted only when it reaches Earth | About 250 to 500 Mbit per sol for Curiosity ([03](03-surface-environments-and-operations.md#surface-operations)) |
| Sample cache | Keep all samples aboard | Leave a depot | Insurance if the rover fails later | Perseverance's sample depot ([03](03-surface-environments-and-operations.md#sustainability-strategies-from-real-missions)) |

### Cost and risk

| Trade | Option A | Option B | What moves | Real example |
| --- | --- | --- | --- | --- |
| Heritage vs new design | Reuse a flown design | New design | Cost and risk vs new capability | Perseverance reused Curiosity's design ([01](01-rover-missions-history.md#case-studies)) |
| Deployables | Fixed, simple structure | Folding mast, panels, ramp | Stowed size and capability vs mechanism risk | Yutu-1's mobility and fold failure ([01](01-rover-missions-history.md#case-studies)) |
| Extended mission | Stop at the prime mission | Keep operating | Operations cost (Curiosity about $40 to $60 million per year) vs extra science | MER operations about $336 million over 15 years ([01](01-rover-missions-history.md#cost-team-and-build-time), [03](03-surface-environments-and-operations.md#surface-operations)) |
| Budget discipline | Add capability | Hold reserves | Capability vs cancellation risk | VIPER cancelled in 2024 at $609.6 million, then revived in 2025 ([01](01-rover-missions-history.md#in-development-and-cancelled)) |

## What engineers consider

**At design time**

| Question | Why it matters |
| --- | --- |
| What does the delivery system allow (mass, folded size, ellipse, latitude, season)? | Every design must fit. Curiosity's mass is one reason its landing used a sky crane rather than airbags. |
| What is the worst sol the rover must survive? | Night, winter, or a global dust storm sets battery, heater, and power sizing more than an average sol does. |
| How does dust change power over time, and is there a recovery path? | Solar rovers lose about 0.2% of output per sol typically; cleaning events are luck, not a plan. |
| Can every part survive its coldest and hottest case? | Batteries and actuators have narrow limits; lubricants stiffen in cold. |
| What happens when one part fails? | Single failures cascade: a stuck wheel can block Sun-pointing, which threatens survival. |
| Can the rover reach its science targets within its life? | Speed, autonomy, and terrain set distance per sol. |
| How does data get home, and how much per sol? | Science only counts once downlinked. |
| What is the design life, and what margin covers surprises? | Prime missions are a floor. Margins are what allowed 57x longer life for Opportunity. |

**During operations**

| Question | Why it matters |
| --- | --- |
| What is today's energy budget after survival heating? | Activities fit within what is left. |
| What is the weather forecast and season? | Storms and winter need preparation sols in advance. |
| How worn are wheels and mechanisms? | Wear accumulates; routes and tempo can slow it. |
| What is the communication schedule? | Relay passes, restricted sols, conjunction, and Earth-set windows limit commanding. |
| What is the fallback plan if a sol fails? | A safe "runout" plan protects the rover when commands do not arrive. |

## Why rovers die and why they last

**Our analysis**, from the case studies in [01](01-rover-missions-history.md#case-studies) and the strategies in [03](03-surface-environments-and-operations.md#sustainability-strategies-from-real-missions).

| Pattern | Examples | Lesson for the game |
| --- | --- | --- |
| Most surface deaths happen at night, in winter, or in dust | Spirit, Opportunity, Zhurong, Pragyan, Lunokhod 2 | Make these the main threats, not random damage |
| Failures chain across subsystems | Spirit: stuck → could not tilt toward the Sun → power loss → cold | Model coupling so one failure can cascade |
| Dust is a slow killer for solar rovers | Zhurong's wake thresholds (20, 30, 40% panel coverage); InSight's end | A visible dust meter with a no-wake threshold |
| Long lives come from margin, not luck alone | Opportunity 90 → 5,111 sols; Spirit about 24x; Sojourner about 12x | Reward margin with longevity |
| Workarounds keep rovers working | Spirit driving backward; Opportunity's flash memory workaround; Curiosity's new drilling method | Permanent faults that change play, plus recovery options |
| Short design lives can be correct | Pragyan met its one-lunar-day goal | Score against the mission's requirement, not against the longest-lived rover |
| Nuclear power changes the survival game | Curiosity and Perseverance operate year-round | RTG removes dust and winter death but costs mass, money, and scarcity |

## A simplified rover game model

**Our analysis.** Values marked "game value" are balancing choices; label them as such in the game.

### Design constraints

| Check | Rule | Source |
| --- | --- | --- |
| Delivery fit | Rover mass ≤ lander cap and stowed volume ≤ lander box (for example micro 30 kg, mid 200 kg, large 1,050 kg as game values) | [02: Game implications](02-rover-subsystems.md#game-implications) |
| Budget | Sum of component costs plus reserves ≤ mission budget; overrun above 30% triggers a cancellation review (game value inspired by VIPER) | [01: Game implications](01-rover-missions-history.md#game-implications) |
| Night survival | Battery energy ≥ heater energy for the longest dark period; otherwise the rover is a "one day rover" by design | [02: Worked sizing examples](02-rover-subsystems.md#worked-sizing-examples) |

### The sol loop

| Quantity | Simplified rule | Source |
| --- | --- | --- |
| Solar energy per sol | `E_sol = A × irradiance × efficiency × DF × cos(angle) × effective daylight hours` (Mars about 5 to 8 effective hours) | [02: Power](02-rover-subsystems.md#power) |
| Sunlight at the top of the atmosphere | Moon 1,361 W/m²; Mars 586 W/m² mean (490 to 713 through the year) | [03: Key numbers](03-surface-environments-and-operations.md#key-numbers-for-the-game) |
| Dust in the air (Mars) | Multiply by `exp(-0.372 × tau)`; typical tau about 0.5; global storm tau up to about 10.8 | [02: Power](02-rover-subsystems.md#power), [03: Mars specifics](03-surface-environments-and-operations.md#mars-specifics) |
| Dust on panels | Dust factor DF falls about 0.2% per sol (0.05 to 2%); random cleaning events raise it (usually a few percent, rarely up to about +50% in a sol) | [02: Power](02-rover-subsystems.md#power), [03: Key numbers](03-surface-environments-and-operations.md#key-numbers-for-the-game) |
| RTG energy | About 2,700 Wh/sol, declining slowly over years | [02: Key numbers](02-rover-subsystems.md#key-numbers-for-the-game) |
| Survival energy | Heaters scale with temperature and season (MER needed about 180 Wh/sol to survive) | [01: Key numbers](01-rover-missions-history.md#key-numbers-for-the-game) |
| Activity energy | What remains after survival is spent on drive, science, arm, and relay activities | [03: Game implications](03-surface-environments-and-operations.md#game-implications) |
| Battery health | Crossing the 60% depth-of-discharge line adds wear (game value for the size of the penalty) | [02: Power](02-rover-subsystems.md#power) |
| Data | `onboard data += collected − downlinked`; relay passes about 10 min each, 30 to 600 Mbit per pass; only downlinked science scores | [02: Communications](02-rover-subsystems.md#communications) |
| Distance per sol | Set by drive mode and autonomy level; blind drive is faster but adds stuck risk | [02: Navigation](02-rover-subsystems.md#navigation-autonomy-and-computing) |
| Sinkage risk | Rises with per-wheel load (`mass × g ÷ wheels`) relative to wheel size, and with sandy terrain | [02: Mobility](02-rover-subsystems.md#mobility) |
| Wear | Wheel and mechanism wear meters rise faster on sharp terrain; traction software slows it | [01: Game implications](01-rover-missions-history.md#game-implications) |
| Hibernation | Wake succeeds only if panel dust and battery temperature stay within thresholds (Zhurong-style) | [01: Key numbers](01-rover-missions-history.md#key-numbers-for-the-game), [03: Key numbers](03-surface-environments-and-operations.md#key-numbers-for-the-game) |

### Time structure

- **Mars:** one turn equals one sol. A Mars year is about 669 sols, with a dust-storm season around perihelion, solar conjunction blackouts of about two weeks every ~26 months, and restricted sols when planning runs on stale data ([03](03-surface-environments-and-operations.md#surface-operations)).
- **Moon:** a lunar day and night each last about 354 hours. Turns can cover a few hours of daylight; the night is a single survival check ([03](03-surface-environments-and-operations.md#moon-specifics)).

### Scoring and debrief

Score **productivity** (science downlinked, distance, samples) and **longevity** (sols beyond the requirement) separately, plus efficiency (science per kilogram and per unit of energy, as Lunabotics does). The debrief names the cause chain ("panel dust reached 40% during winter hibernation"), links it to the design choice that caused or could have prevented it, and shows the closest real rover ("your mission ended the way Zhurong's did") ([04: Game implications](04-rover-games-and-scenarios.md#game-implications)).

## Fit with the challenge brief

**Our analysis.** The official brief asks for spacecraft configuration, orbit choice, launch vehicle compatibility, and resources including mass, power, budget, data, communications, and time. A rover concept can meet the brief if it maps each element clearly, which matters for the Relevance criterion.

| Brief element | Rover equivalent | Gap to watch |
| --- | --- | --- |
| Spacecraft and subsystems (SPC-01 to SPC-07) | Rover subsystems: structure, power, battery, comms, computer, attitude becomes mobility and navigation | Strong match |
| Instruments (SPC-06) | Rover payload with mass, power, data, and science value | Strong match |
| Orbit choice (ORB-01 to ORB-03) | Landing site choice: latitude, terrain, comms geometry | The brief names orbits explicitly. Consider letting the player choose the relay orbiter or delivery trajectory as a light orbit element. |
| Launch vehicle compatibility (ORB-04, ORB-05) | Lander compatibility: rover mass and folded size must fit the delivery system | Consider a small choice of delivery package (lander class tied to a launch vehicle) so the compatibility check is visible |
| Resources (RES-01 to RES-07) | Mass, energy per sol, budget, data, relay passes, sols of life | Strong match; energy per sol is more intuitive than raw power |
| Simulation and post-mission analysis (CORE-04, EDU-06) | Sol-by-sol survival and an end-of-mission cause chain | Strong match |
| Collaboration (COL-01 to COL-04) | Scientist and engineer roles over one shared budget | Matches the planned two-player mode |

Framing suggestion: present the rover as "the mission's payload" and the delivery package as the spacecraft choice the mission provides, so judges can see the full mission chain even though the player focuses on the rover.

## Suggested first-version scope

Consolidated from [04](04-rover-games-and-scenarios.md#game-implications), adjusted to the single-player, solo-developer plan.

| In version 1 | Later |
| --- | --- |
| Three mission cards (a Mars tutorial, a Mars science site, a lunar far-side or equatorial mission) | Polar night, long traverses, caves, Titan flight, Phobos |
| A delivery package card with mass and size caps | Choosing among several landers and launch vehicles |
| Landing site choice from 3 candidates | Full site maps with ellipse simulation |
| About 5 subsystems with 2 or 3 options each, and live mass, energy, cost, and data bars | Free-form part placement |
| Solar or RTG, battery, heaters, dust factor, day and night energy strip | Detailed thermal modeling |
| 2D top-down tile map, turn-based sols, a command queue of 4 to 6 slots | Physics driving |
| About 8 event cards (dust storm, cleaning event, wheel damage, sand trap, memory fault, relay outage, cold snap, conjunction) | Procedural terrain |
| Debrief with cause chain, one improvement tip, and the closest real rover | Leaderboards, two-player mode |

## Open verification items

| Item | Status | Where |
| --- | --- | --- |
| MMRTG decline | The MMRTG fact sheet gives about 72 W at 17 years; a Planetary Society excerpt projects about 54 W for Curiosity's unit at 17 years | [02](02-rover-subsystems.md#power), [03](03-surface-environments-and-operations.md#surface-operations) |
| Cleaning event size | Typical gains of 2 to 10% vs a rare Spirit event of about +50% in one sol; use both as common and rare cases | [01](01-rover-missions-history.md#key-numbers-for-the-game), [03](03-surface-environments-and-operations.md#mars-specifics) |
| Yutu-2 status | LRO images suggest it stopped moving around March 2024; one encyclopedia source reports small 2025 movements; no official CNSA status found | [01](01-rover-missions-history.md#master-comparison-table), [03](03-surface-environments-and-operations.md#surface-operations) |
| CADRE launch | Delivered for IM-3; launch not confirmed as of November 2026 | [01](01-rover-missions-history.md#in-development-and-cancelled) |
| Lunokhod, Zhurong, and other Chinese and Soviet specs | Mostly secondary sources because NSSDCA pages failed | [01](01-rover-missions-history.md#master-comparison-table) |
| MER mass, solar design point, and the common $820M cost figure | Sources differ | [01](01-rover-missions-history.md#cost-team-and-build-time) |
| Curiosity load figures (45 to 70 W asleep, about 150 W awake, up to 500 W driving) | Single source | [03](03-surface-environments-and-operations.md#surface-operations) |
| Mars dust-in-air fit `exp(-0.372 × tau)` and the seasonal tau profile | Our fit to a NASA technical memo; game values for the profile | [02](02-rover-subsystems.md#power) |
| MEPAG goal wording, Endurance traverse length, Rosalind Franklin drill depth, Chang'e-7 schedule | Not confirmed against primary documents | [04](04-rover-games-and-scenarios.md#game-implications) |
| Team sizes for rover missions | No reliable figures found beyond Perseverance's robotic operations team | [01](01-rover-missions-history.md#cost-team-and-build-time), [03](03-surface-environments-and-operations.md#surface-operations) |
