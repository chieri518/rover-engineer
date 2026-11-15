# Trade-offs, Considerations, and a Game Model

This document pulls the four research files together. It answers two questions: what trade-offs and considerations shape a real mission from start to finish, and how could a game model them simply but defensibly. Facts here are drawn from files 01 to 04, which hold the primary sources; follow the links for citations. Everything in this file is **our synthesis and analysis**, not official NASA guidance.

Researched and compiled November 14, 2026.

Quick navigation: [A mission in one page](#a-mission-in-one-page) · [Master trade-off catalog](#master-trade-off-catalog) · [Considerations by phase](#considerations-by-phase) · [Cross-cutting principles](#cross-cutting-principles) · [A simplified game model](#a-simplified-game-model) · [Suggested first-version scope](#suggested-first-version-scope) · [Open verification items](#open-verification-items)

## A mission in one page

| Stage | What happens | The central question | Detail |
| --- | --- | --- | --- |
| 1. Need | A science community sets priorities, mainly through decadal surveys. NASA turns them into directed missions or competed Announcements of Opportunity with cost caps. | Which question is worth answering, and in which cost class? | [01: Where missions come from](01-mission-lifecycle.md#where-missions-come-from) |
| 2. Concept | Small teams sketch concepts and test feasibility. Concurrent design teams (JPL Team X, Goddard MDL) explore trades in days. | Is there at least one design that closes? | [01: Concept maturity](01-mission-lifecycle.md#concept-maturity-technology-readiness-and-concurrent-design) |
| 3. Requirements | The science traceability matrix links goals to measurements, instruments, and mission requirements. Baseline and threshold missions are defined. | What is the minimum that still counts as success? | [01: From science to requirements](01-mission-lifecycle.md#from-science-to-requirements) |
| 4. Mission design | Orbit or trajectory, launch vehicle, ground network, and operations concept are chosen together. | Where must the spacecraft be, and how does it get there and talk home? | [02](02-mission-design-orbits-launch.md) |
| 5. Spacecraft design | Payload and bus subsystems are sized against mass, power, data, pointing, and thermal budgets with margins. | Does every budget close with margin left? | [03](03-spacecraft-subsystems.md) |
| 6. Commitment | At KDP C the cost and launch date are locked, budgeted at 70% joint confidence. | Are we confident enough to promise a cost and date? | [01: Life cycle](01-mission-lifecycle.md#the-nasa-project-life-cycle), [04: Reserves](04-cost-risk-programmatics.md#reserves-confidence-levels-and-schedule-margin) |
| 7. Build and test | Hardware is built, integrated, and tested in launch-like environments. Most cost growth appears after CDR. | Have we found the flaws before flight? | [01: Build](01-mission-lifecycle.md#build-assembly-integration-and-test), [04: Cost growth](04-cost-risk-programmatics.md#cost-and-schedule-growth-evidence) |
| 8. Launch and commissioning | Launch, early operations, deployments, checkout, calibration. | Did everything survive and deploy? | [01: Launch and operations](01-mission-lifecycle.md#launch-early-operations-and-the-prime-mission) |
| 9. Operations | Science collection, downlink, processing to data products, anomalies, safe modes, and possible extensions through senior review. | Are we returning the promised science? | [02: Operations concept](02-mission-design-orbits-launch.md#operations-concept) |
| 10. End of mission | Disposal by deorbit, graveyard orbit, or planned impact, plus passivation and data archiving. | Can we end safely and legally? | [01: End of mission](01-mission-lifecycle.md#end-of-mission) |

The process is not linear. The JPL concept maturity paper stresses a loop between feasibility, trade space, and point design, and real projects loop back whenever a budget fails to close.

## Master trade-off catalog

Each row is a decision real teams face. "Real example" points to a case described in the research files.

### Science and requirements

| Trade | Option A | Option B | What moves | Real example | Detail |
| --- | --- | --- | --- | --- | --- |
| Science ambition vs cost | Many objectives, advanced instruments | Focused objectives, heritage instruments | Instrument cost and mass, development risk, schedule | Europa Clipper instrument costs grew 52% before descopes were weighed | [01](01-mission-lifecycle.md#from-science-to-requirements) |
| Baseline vs threshold | Plan only for full success | Define a threshold mission and a descope order in advance | Resilience to cuts and failures | JWST replans; descoping as a standard tool | [04](04-cost-risk-programmatics.md#cost-and-schedule-growth-evidence) |
| Resolution vs coverage vs data | Fine resolution, narrow swath | Coarse resolution, wide swath | Halving ground sample distance gives about 4x data and needs a bigger aperture | Landsat 9's 185 km swath and 16-day repeat | [02](02-mission-design-orbits-launch.md#key-relationships-and-formulas), [03](03-spacecraft-subsystems.md#payload-and-instruments) |
| Instrument duty cycle | Always on | On only over targets | Power, data volume, thermal load vs science collected | Duty cycling is the main tool for fitting small arrays | [03](03-spacecraft-subsystems.md#power) |

### Orbit, trajectory, and launch

| Trade | Option A | Option B | What moves | Real example | Detail |
| --- | --- | --- | --- | --- | --- |
| Altitude | Low (better resolution, cheaper launch, lower radiation) | High (longer lifetime, wider view, longer passes) | Drag lifetime, ground sample distance, launch mass, revisit | 6U CubeSat lifetime of about 1.8 yr at 450 km vs about 25 yr at 600 km; FACSAT-2 early reentry | [02](02-mission-design-orbits-launch.md#atmospheric-drag-and-orbital-lifetime) |
| Sun-synchronous local time | Mid-morning (good light for optical imaging) | Dawn-dusk (almost no eclipse, steady power and thermal) | Power and battery size vs image illumination | Landsat's mid-morning crossing | [02](02-mission-design-orbits-launch.md#orbit-types-and-their-trade-offs) |
| Near Earth vs deep space location | LEO (cheap, high data rate, frequent contact) | L2 or heliocentric (stable thermal, continuous view) | Launch energy, comms rate, servicing, thermal stability | JWST at L2 behind its sunshield | [02](02-mission-design-orbits-launch.md#mission-type-templates) |
| Direct trajectory vs gravity assist | Big launcher, short cruise | Smaller launcher, years of extra cruise | Launch cost vs time, operations cost, risk | Europa Clipper's Mars and Earth flybys | [02](02-mission-design-orbits-launch.md#rocket-equation-delta-v-and-transfers) |
| Rideshare vs dedicated launch | Rideshare (lowest cost per kg) | Dedicated (your orbit, your date) | Cost vs orbit choice and schedule control | Rideshare at about $7,000/kg vs a dedicated small launcher (prices *unverified*) | [02](02-mission-design-orbits-launch.md#launch-vehicles) |
| Proven vs new rocket | Certified vehicle with long record | New vehicle, cheaper or more capable | Launch failure probability vs cost | NASA risk categories need 6 or 14 consecutive successes; maiden flights fail often | [02](02-mission-design-orbits-launch.md#launch-vehicles), [04](04-cost-risk-programmatics.md#launch-and-mission-failure-statistics) |
| Launch window vs readiness | Wait until fully ready | Hold schedule to make the window | Planetary windows recur every ~26 months for Mars | Psyche's late software forced a slip | [02](02-mission-design-orbits-launch.md#rocket-equation-delta-v-and-transfers), [04](04-cost-risk-programmatics.md#real-on-orbit-and-programmatic-events) |

### Spacecraft

| Trade | Option A | Option B | What moves | Real example | Detail |
| --- | --- | --- | --- | --- | --- |
| Solar vs nuclear power | Solar arrays | Radioisotope generator (MMRTG about 110 W at start, 45 kg) | Array area grows with distance squared; RTGs are scarce and costly | Juno's very large arrays at Jupiter | [03](03-spacecraft-subsystems.md#power) |
| Battery depth of discharge | Deep discharge (smaller, lighter battery) | Shallow discharge (longer battery life) | LEO sees about 15 eclipses a day; JPL caps DoD at 40% or 20% depending on cycles | JPL Design Principles table | [03](03-spacecraft-subsystems.md#power) |
| Store vs send | Big onboard memory | Bigger radio, antenna, or more ground stations | Storage mass and cost vs downlink cost and power | 6U example makes 116 Gbit/day but sends only 96 | [03](03-spacecraft-subsystems.md#worked-sizing-examples) |
| Radio band | UHF or S (simple, robust) | X, Ka, or optical (much faster) | Rate vs power, pointing, ground cost, weather | Laser demos at 1.244 Gbps (LCRD) and 267 Mbps peak (DSOC) | [02](02-mission-design-orbits-launch.md#ground-segment-and-communications-geometry), [03](03-spacecraft-subsystems.md#telecommunications) |
| Antenna size | Small or omnidirectional | Large high-gain | Doubling diameter gives 4x rate but adds mass and pointing needs | Galileo's stuck high-gain antenna forced heavy compression | [03](03-spacecraft-subsystems.md#telecommunications), [04](04-cost-risk-programmatics.md#case-studies-failures-recoveries-and-successes) |
| Pointing precision | Coarse (magnetorquers, sun sensors) | Fine (reaction wheels, star trackers) | ADCS mass, power, cost vs image sharpness | Kepler lost wheels and became K2 | [03](03-spacecraft-subsystems.md#attitude-determination-and-control-adcs) |
| Propulsion type | None or cold gas (simple) | Chemical or electric | Electric saves propellant mass (Isp up to about 3,100 s) but needs power and time | Dawn's ion engines | [03](03-spacecraft-subsystems.md#propulsion) |
| Propellant reserve | Fly light | Carry extra for drag makeup, avoidance, disposal | Mass vs lifetime and legal disposal | Debris avoidance maneuvers; disposal rules | [02](02-mission-design-orbits-launch.md#space-environment-and-orbit-choice), [01](01-mission-lifecycle.md#end-of-mission) |
| Radiation tolerance | Commercial parts | Radiation-hardened parts | Cost and older performance vs upset resistance | RAD750-class processors vs CubeSat commercial boards | [03](03-spacecraft-subsystems.md#command-and-data-handling-cdh) |
| Autonomy | Ground in the loop | Onboard autonomy and fault protection | Software cost vs operations cost and safety under light-time delay | Mars light-time of 3 to 22 minutes | [02](02-mission-design-orbits-launch.md#operations-concept) |

### Risk, cost, and schedule

| Trade | Option A | Option B | What moves | Real example | Detail |
| --- | --- | --- | --- | --- | --- |
| Risk class | Class A (redundant, best parts, full testing) | Class D (single string, commercial parts, minimal testing) | Cost and schedule vs probability of success | NPR 8705.4B class definitions | [04](04-cost-risk-programmatics.md#risk-management-and-risk-classes) |
| Redundancy | Single string | Block or cross-strapped redundancy | Mass and cost vs tolerance to a single failure | Voyager's redundancy and margins | [03](03-spacecraft-subsystems.md#reliability-and-redundancy) |
| Heritage vs new technology | Flown designs | New technology below TRL 6 | Capability vs cost growth and delay | GAO tracks the TRL 6 by PDR rule | [01](01-mission-lifecycle.md#concept-maturity-technology-readiness-and-concurrent-design) |
| Test depth | Protoflight (cheaper, faster) | Full qualification with a test unit | Cost and time vs escaped defects | Mars Polar Lander and Genesis test escapes | [01](01-mission-lifecycle.md#build-assembly-integration-and-test), [04](04-cost-risk-programmatics.md#case-studies-failures-recoveries-and-successes) |
| Margins | Spend margin on capability | Hold margin for the unknown | Capability now vs survival later | Margin rules shrink by phase (JPL, Goddard) | [03](03-spacecraft-subsystems.md#mass-budget-and-margins) |
| Budget reserves | Low reserves, more hardware | 25 to 30% reserves at start | Capability vs ability to absorb growth averaging about 27% | NRC study of 40 missions | [04](04-cost-risk-programmatics.md#reserves-confidence-levels-and-schedule-margin) |
| Mission lifetime | Short prime mission | Long mission and extensions | Operations cost per year, propellant, part wear vs more science | Opportunity and Voyager outlived plans | [04](04-cost-risk-programmatics.md#case-studies-failures-recoveries-and-successes) |
| Partnerships | Go alone | Share cost with partners | Cost vs dependency and export-control friction | JWST and ESA's launch; Mars Sample Return's dependence on ESA | [04](04-cost-risk-programmatics.md#team-organizational-and-human-factors) |

## Considerations by phase

Questions a real team must answer at each stage. These double as candidate checklist items for a readiness-review screen in the game.

| Phase | Considerations |
| --- | --- |
| Concept | Is the science question clear and important? Which observation answers it? What cost class fits? Is there a launch opportunity? What makes this concept unique? (CML 1 asks exactly these four: objective, uniqueness, launch timeframe, cost class.) |
| Feasibility | Do first-order calculations close for mass, power, data, and delta-v? Which technologies are below TRL 6? Which orbit families could work? |
| Trade space | Which architectures were compared? How does science return change with mass, data volume, or orbit (the "science partials")? What are the cost and risk of each option? |
| Point design | Does every subsystem budget close with the required margin for this phase? Is there a master equipment list? Is the cost estimate within the cap including reserves? Is there a descope plan? |
| Commitment | Is the joint cost and schedule confidence at least 70%? Are risks on the 5x5 matrix acceptable? Is the launch vehicle certified for this risk class? |
| Build and test | Is every requirement assigned a verification method? Are interfaces checked end to end (units, connectors, polarity)? Is the test approach "test like you fly"? |
| Launch and commissioning | Are deployments verified? Is there a safe mode with enough power margin? Is the ground network scheduled? |
| Operations | Is data downlinked and processed as fast as it is collected? Are anomalies handled within power and thermal limits? Is there a case for extension? |
| End of mission | Is propellant reserved for disposal? Does the plan meet the 5-year FCC rule (LEO), the graveyard rule (GEO), or planetary protection? Is the data archived? |

## Cross-cutting principles

**Our analysis**, drawn from patterns across the four files.

1. **Everything is coupled.** One choice ripples through the whole system. A better instrument raises power, which enlarges arrays and batteries, which adds mass, which can force a bigger launcher and raise cost. File 03 has a full coupling matrix.
2. **The mass spiral.** Mass growth compounds, because added mass needs added structure, power, and propellant. This is why margins exist and why they are tracked from the first sketch.
3. **Margins glide down over time.** Large early margins shrink as the design matures, reaching near zero at launch. Spending margin early is the classic mistake.
4. **Early decisions lock in most of the outcome.** The CML paper says architects have the most influence early, yet about 75% of cost growth appears after CDR. Early trade studies are cheap insurance.
5. **There is rarely one best design.** The 6U worked example in file 03 can be closed several ways: more ground passes, a faster radio, or a lower duty cycle. This directly supports feature MIS-06.
6. **Failures usually come from process, not physics.** Most case studies in file 04 trace to skipped interface checks, untested configurations, single sensors trusted too much, or missing telemetry in critical events.
7. **Recoveries come from margin and preparation.** Galileo, Kepler/K2, and Voyager kept producing science because of spare capability, reprogrammable software, and teams that had planned for degradation.
8. **Distance changes everything.** Sunlight falls with the square of distance, data rate falls with the square of distance, and light-time grows with distance. Deep-space missions are a different game from LEO.

## A simplified game model

**Our analysis.** A minimal set of rules that respects the real relationships. Each rule lists its source file. Values marked "game value" are balancing choices and should be labeled as such in the game.

### State the player manipulates

Mission card (objective, requirements, budget cap, launch window) → instruments (mass, power, data rate, duty cycle, pointing need, science value) → orbit (altitude, type, local time) → bus tiers (power, battery, radio, antenna, ADCS, computer and storage, propulsion, structure) → risk class and test strategy → launch vehicle → reserves.

### Core relationships

| Quantity | Simplified rule | Source |
| --- | --- | --- |
| Orbital period | `T = 2π √(a³ / μ)`, with `a = 6378 km + h` and `μ = 398,600 km³/s²` | [02](02-mission-design-orbits-launch.md#key-relationships-and-formulas) |
| Eclipse fraction (worst case, circular) | `asin(R_E / a) / π` (about 35 to 36 min per orbit in LEO) | [02](02-mission-design-orbits-launch.md#key-relationships-and-formulas) |
| Solar array power needed | `P_sa = (P_e·T_e / X_e + P_d·T_d / X_d) / T_d`, with X_e = 0.65 and X_d = 0.85 | [03](03-spacecraft-subsystems.md#power) |
| Array area | `P_sa / (1361 W/m² × efficiency × degradation / d²)`, d in AU | [03](03-spacecraft-subsystems.md#power) |
| Battery capacity | `P_e · T_e / DoD` (with DoD capped at 40% in LEO-like cycling) | [03](03-spacecraft-subsystems.md#power) |
| Data generated per day | `Σ instrument rate × duty cycle × 86,400 s`, divided by compression ratio | [03](03-spacecraft-subsystems.md#payload-and-instruments) |
| Data downlinked per day | `passes/day × minutes/pass × 60 × radio rate` (about 7.4 min maximum pass at 500 km) | [02](02-mission-design-orbits-launch.md#ground-segment-and-communications-geometry) |
| Recorder balance | `storage(t+1) = storage(t) + generated − downlinked`; overflow is lost science | [03](03-spacecraft-subsystems.md#command-and-data-handling-cdh) |
| Deep-space data rate | Scales with `1 / d²` from a reference link | [03](03-spacecraft-subsystems.md#telecommunications) |
| Ground sample distance | `GSD = h × pixel pitch / focal length`, floored by `1.22 λ / D` | [02](02-mission-design-orbits-launch.md#key-relationships-and-formulas) |
| Orbital lifetime (6U-class, average solar cycle, 450 to 600 km) | `≈ 1.8 yr × exp((h − 450 km) / 57 km)` (fit to a non-peer-reviewed table) | [02](02-mission-design-orbits-launch.md#atmospheric-drag-and-orbital-lifetime) |
| Propellant mass | `m_prop = m_dry × (exp(Δv / (9.81 × Isp)) − 1)` | [02](02-mission-design-orbits-launch.md#rocket-equation-delta-v-and-transfers), [03](03-spacecraft-subsystems.md#propulsion) |
| Launch feasibility | Wet mass ≤ vehicle capacity to the chosen orbit; risk class allowed on that vehicle category | [02](02-mission-design-orbits-launch.md#launch-vehicles) |
| Margin status | Green, yellow, or red against phase thresholds (for example, Goddard mass >15% early, power >25% early, link >3 dB) | [03](03-spacecraft-subsystems.md#mass-budget-and-margins), [04](04-cost-risk-programmatics.md#reserves-confidence-levels-and-schedule-margin) |
| Cost roll-up | Hardware (about 65%) + overhead wrap (11 to 15%) + launch + operations per year + reserves (default 25 to 30%) | [04](04-cost-risk-programmatics.md#where-the-money-goes) |
| Cost growth | Hidden roll averaging about 27%, weighted toward immature parts and the post-CDR period (game value for the spread) | [04](04-cost-risk-programmatics.md#cost-and-schedule-growth-evidence) |
| Failure odds | Driven by risk class, redundancy, test depth, part maturity, and launch vehicle (game values; NASA publishes no per-class odds) | [04](04-cost-risk-programmatics.md#risk-management-and-risk-classes) |
| Science score | Science value of data actually downlinked and processed, compared against baseline and threshold requirements | [01](01-mission-lifecycle.md#from-science-to-requirements), [04](04-cost-risk-programmatics.md#how-nasa-judges-value) |

### Debrief logic

The debrief can name the **binding constraint**: the single budget that limited science most, such as downlink, power in eclipse, or storage. It then shows one "what-if" (for example, the extra data an X-band radio would have returned) and a real-mission parallel from file 04's case studies. This turns the coupling matrix into an explanation, which supports EDU-05 and EDU-06.

## Suggested first-version scope

**Our analysis**, matched to the earlier decision to start single-player with high-school players and a one- or two-person team.

| Include first | Why it earns its place |
| --- | --- |
| Instrument choice vs data and power | The clearest coupling, and the one the brief names explicitly |
| Altitude vs lifetime vs resolution | One slider teaches three effects |
| Eclipse-driven power and battery sizing | Turns orbit choice into a spacecraft consequence |
| Store vs send (recorder and downlink) | A differentiator; most comparable games skip data budgets |
| Launch vehicle capacity check, rideshare vs dedicated | Satisfies ORB-04 and ORB-05 with simple rules |
| Budget with reserves and one cost-growth event | Shows why reserves exist |
| Risk class as a master dial | One choice that sets parts, testing, rockets, and failure odds together |
| Three to five event cards from real missions | Galileo antenna, solar storm, wheel failure, budget cut, ground station outage |
| Debrief with binding constraint and a real-mission parallel | The teaching moment |

Good candidates for later: gravity assists, electric propulsion, planetary protection, light-time delay, extended missions, disposal planning, and the two-player science lead and engineering lead split.

## Open verification items

These items are flagged in the research files. Resolve or label them before quoting them in the game or the submission.

| Item | Status | Where |
| --- | --- | --- |
| Launch prices (Falcon 9, rideshare, Electron, Alpha, Vulcan, New Glenn, Ariane, Vega-C) | Public estimates from secondary sources | [02](02-mission-design-orbits-launch.md#launch-vehicles) |
| Orbital lifetime table and its exponential fit | From a 2026 preprint that is not peer reviewed | [02](02-mission-design-orbits-launch.md#atmospheric-drag-and-orbital-lifetime) |
| Lifetime of objects near 800 km | NASA's 2026 debris FAQ says "centuries"; an older NASA text said "decades" | [02](02-mission-design-orbits-launch.md#atmospheric-drag-and-orbital-lifetime) |
| Surface-to-LEO delta-v of 9.3 to 10 km/s | Single weak source | [02](02-mission-design-orbits-launch.md#rocket-equation-delta-v-and-transfers) |
| SMAD subsystem mass fractions and degradation factors | Reached through secondary teaching material, edition not stated | [03](03-spacecraft-subsystems.md#mass-budget-and-margins) |
| Instrument power and data values (OLI, MODIS, VIIRS, a CubeSat camera) | Sources disagree; ranges given | [03](03-spacecraft-subsystems.md#payload-and-instruments) |
| MRO-like link model | Matches the reported rate at far range but is about 2x optimistic at close range | [03](03-spacecraft-subsystems.md#worked-sizing-examples) |
| Margin rules | JPL's current rule is 12% mass margin at PDR on top of growth allowance, not the often-quoted 30%; Goddard's current Rev I mass margins are lower than the older Rev G values | [03](03-spacecraft-subsystems.md#mass-budget-and-margins) |
| CubeSat mass limits | Current CubeSat Design Specification Rev 14.1 allows 2.00 kg per 1U; the 1.33 kg figure is from the older Rev 13 | [03](03-spacecraft-subsystems.md#structure-and-mechanisms) |
| Cost growth of about 12% per 10% schedule slip; maiden-flight failure of about 45% | Single summary sources | [04](04-cost-risk-programmatics.md#key-numbers-for-the-game) |
| CubeSat cost formula from a draft NASA model | Units and year basis not stated on the source slide | [04](04-cost-risk-programmatics.md#cost-estimating) |
| PACE cost history, TESS orbit timing, some cost caps (EVO-1, Probe) | Single or secondary sources | [01](01-mission-lifecycle.md#worked-timelines) |
| Governing document status | NPR 7120.5F is under an interim NASA directive that could not be opened | [01](01-mission-lifecycle.md#the-nasa-project-life-cycle) |
