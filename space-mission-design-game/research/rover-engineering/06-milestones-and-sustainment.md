# Milestones, Rewards, and Sustaining a Rover Mission

This document covers two related topics for the rover game. First, the milestones NASA measures and how people and missions are rewarded for reaching them. Second, how rover missions are kept going for years after landing, and which of those real practices can become game mechanics and rules. It builds on files 01 to 05 and on [../mission-engineering/](../mission-engineering/README.md), linking to them for details.

Researched November 14, 2026.

Quick navigation: [Milestones NASA measures](#milestones-nasa-measures) · [How achievement is rewarded](#how-achievement-is-rewarded) · [How rover missions are sustained](#how-rover-missions-are-sustained) · [Milestone mechanics](#milestone-and-reward-mechanics) · [Sustainment rules](#sustainment-rules-for-the-game) · [Senior review event](#the-senior-review-event) · [Key numbers](#key-numbers-for-the-game) · [Sources](#sources)

## Milestones NASA measures

NASA tracks progress at several levels. A rover mission passes through all of them.

| Milestone type | What is measured | Rover examples | Who judges | Detail |
| --- | --- | --- | --- | --- |
| **Programmatic gates** | Readiness to move to the next phase: reviews (PDR, CDR) and Key Decision Points; locking cost and launch date at KDP C | Mars 2020 passing its reviews on Curiosity heritage | NASA decision authorities and independent review boards | [mission-engineering 01: Life-cycle reviews](../mission-engineering/01-mission-lifecycle.md#life-cycle-reviews) |
| **Mission success criteria** | Whether Level 1 science requirements were met, as a full "baseline" mission or a minimum "threshold" mission | MER's 90-sol prime mission requirements | Science mission directorate, against the requirements written before launch | [mission-engineering 01: From science to requirements](../mission-engineering/01-mission-lifecycle.md#from-science-to-requirements) |
| **Operational events** | Launch, landing, egress, first image, commissioning complete, prime mission complete | Curiosity's sky-crane landing in 2012; Pragyan rolling off Vikram's ramp in 2023 | Mission team | [01: Rover mission phases](01-rover-missions-history.md#rover-mission-phases) |
| **Science results** | Discoveries, samples, data products, papers | Opportunity's evidence of past water; Curiosity's habitable lake at Gale; Perseverance's sample collection | Science community, peer review | [01: Case studies](01-rover-missions-history.md#case-studies) |
| **Records and firsts** | Being first or best at something measurable | First far-side rover (Yutu-2); first powered flight on another planet (Ingenuity); off-world distance record of 45.22 km (Perseverance, October 2026) | Public, press, history | [01: Key numbers](01-rover-missions-history.md#key-numbers-for-the-game) |
| **Longevity** | Time operated beyond the design life | Opportunity: 5,111 sols against 90 planned | Senior review panels, public | [01: Planned vs actual lifetime](01-rover-missions-history.md#planned-vs-actual-lifetime) |
| **Cost and schedule performance** | Staying within the committed budget and launch date | MSL's 26-month slip cost about $400 million; VIPER was cancelled in 2024 over cost growth, then revived in 2025 | GAO, NASA OIG, Congress | [mission-engineering 04: Cost growth](../mission-engineering/04-cost-risk-programmatics.md#cost-and-schedule-growth-evidence) |

## How achievement is rewarded

| Reward | What it recognizes | Real example | Source |
| --- | --- | --- | --- |
| **Continued funding (extended missions)** | Science value, rover health, and cost of continuing | Curiosity is in its fifth extended mission after repeated Planetary Mission Senior Reviews; the 2025 review covered MSL, MRO, Odyssey, Juno, LRO, and MAVEN | [NASA Curiosity mission page](https://science.nasa.gov/mission/msl-curiosity/), [PMSR 2025 report](https://assets.science.nasa.gov/content/dam/science/psd/resources/senior-review/2025/PMSR25_Final_Report_Package_June9_2025_Tagged.pdf) |
| **Senior review rating** | Panels rate proposals; "excellent" is the highest rating a Planetary Mission Senior Review panel can give | MAVEN's 2022 extension cited its excellent rating | [LASP, 2022](https://lasp.colorado.edu/maven/2022/04/25/nasa-extends-maven-mars-mission-citing-excellence-in-science-and-mission-operations/) |
| **NASA Honor Awards** | Individuals and teams. The Distinguished Service Medal is NASA's highest honor for individual contributions; Group Achievement Awards recognize teams | Mission teams appear on the annual agency honor awards lists | [NASA 2025 Agency Honor Awards program](https://www.nasa.gov/wp-content/uploads/2025/08/aha-event-program.pdf) |
| **Aerospace prizes** | The Robert J. Collier Trophy, awarded by the National Aeronautic Association for the greatest achievement in aeronautics or astronautics in America | The NASA/JPL Mars Science Laboratory/Curiosity project team received the 2012 Collier Trophy for landing Curiosity | [JPL](https://www.jpl.nasa.gov/news/nasa-curiosity-rover-wins-prestigious-awards/), [AOPA](https://www.aopa.org/news-and-media/all-news/2013/march/14/mars-exploration-earns-nasa-jpl-a-collier-trophy) |
| **Heritage and reuse** | A working design becomes the low-risk basis for the next mission | Perseverance reused Curiosity's design | [01: Case studies](01-rover-missions-history.md#case-studies) |
| **Credibility for the next mission** | On-budget, on-time teams and centers are trusted with new work | GAO's yearly assessments track cost and schedule performance across NASA's portfolio | [mission-engineering 04](../mission-engineering/04-cost-risk-programmatics.md#cost-and-schedule-growth-evidence) |

**Our analysis.** In NASA's system, the most important reward for an operating rover is not a medal. It is **another few years of operations funding**, granted because the rover is still healthy and still producing science worth its cost.

## How rover missions are sustained

Keeping a rover going for years depends on eight things. The first four happen on the rover; the last four happen on Earth or in orbit, outside the rover's control.

| Pillar | What it means | Real practice | Detail |
| --- | --- | --- | --- |
| **1. Energy** | Fit each sol's activities into the energy available after survival needs | MER winter parking on Sun-facing slopes; Curiosity's 2025 to 2026 power-saving methods (running tasks at the same time, sleeping early, light "recharge" sols) as its MMRTG output declines | [03: Sustainability strategies](03-surface-environments-and-operations.md#sustainability-strategies-from-real-missions), [JPL, 2025](https://www.jpl.nasa.gov/news/marking-13-years-on-mars-nasas-curiosity-picks-up-new-skills/) |
| **2. Thermal survival** | Keep batteries and electronics within limits through nights, winters, and storms | Hibernation (Opportunity 2018, Zhurong, Yutu-2 every lunar night) | [03: Moon specifics](03-surface-environments-and-operations.md#moon-specifics) |
| **3. Hardware health** | Slow wear and work around failures | Curiosity's traction control (2017) cut wheel loads; Spirit drove backward on five wheels; Curiosity's drill was fixed with a new technique | [01: Case studies](01-rover-missions-history.md#case-studies), [02: Mobility](02-rover-subsystems.md#mobility) |
| **4. Software** | Upload new flight software to add abilities or fix problems | Curiosity's April 2023 update added mobility commands that reduce steering, which speeds driving and reduces wheel wear. Science paused April 3 to 7 to install it, and the rover could revert automatically if anything went wrong. Opportunity's flash memory problems were worked around in software. | [JPL, 2023](https://www.jpl.nasa.gov/news/nasas-curiosity-mars-rover-gets-a-major-software-upgrade), [01](01-rover-missions-history.md#case-studies) |
| **5. Communications infrastructure** | Relay orbiters carry nearly all rover data and are aging | Perseverance sends 99.9% of its science data through relay orbiters. MAVEN lost contact in December 2025 and was reportedly declared over in June 2026; Odyssey is low on fuel; NASA reportedly selected Blue Origin in September 2026 for a Mars telecommunications orbiter (*unverified*, secondary sources) | [02: Communications](02-rover-subsystems.md#communications), [The Conversation](https://theconversation.com/nasas-mars-orbiter-fleet-is-getting-old-heres-how-that-could-affect-future-exploration-292555), [Museum of Science](https://www.mos.org/article/space-news-deep-dive-mixed-maven), [Hackaday, 2026](https://hackaday.com/2026/09/24/after-decades-nasa-may-finally-replace-mars-relays/) |
| **6. Operations team and money** | Operations cost money every year, and staff can be cut | Curiosity operations cost about $40 to $60 million per year; MER operations cost about $336 million over 15 years; Perseverance's robotic operations staff was cut 53.2% in 2025 | [03: Surface operations](03-surface-environments-and-operations.md#surface-operations), [01: Cost](01-rover-missions-history.md#cost-team-and-build-time) |
| **7. Science renewal** | Extended missions need new, worthwhile goals | Curiosity climbing Mount Sharp through younger rock layers; Perseverance moving from the Jezero delta to the crater rim | [01: Case studies](01-rover-missions-history.md#case-studies) |
| **8. Programmatic review** | Extensions are granted for about three years at a time through senior review, judged on science merit, technical status, and budget | Planetary reviews are held every few years; heliophysics criteria include science merit, technical status, and budget | [mission-engineering 01](../mission-engineering/01-mission-lifecycle.md#launch-early-operations-and-the-prime-mission), [mission-engineering 04](../mission-engineering/04-cost-risk-programmatics.md#how-nasa-judges-value) |

**Our analysis: lessons for the game**

- **Sustainment is mostly decisions, not hardware.** After landing, the hardware is fixed. What extends life is how the team spends energy, routes drives, schedules rest, and patches software.
- **The rover depends on things it does not control.** Relay orbiters, budgets, and staffing can change mid-mission. These make good events because the player must adapt rather than prevent them.
- **Longevity has to be earned twice.** The rover must stay healthy, and the mission must keep convincing reviewers it is worth the money.

## Milestone and reward mechanics

**Our analysis.** These map the real milestone types onto the game's two currencies (science points for the advancement tree, mission budget for building).

| Real milestone | Game milestone | Reward |
| --- | --- | --- |
| Passing a review gate | Pre-launch review passes with at least 80% green | Launch allowed; small budget bonus for a clean pass |
| Landing and first image | Rover lands, deploys, and sends its first image | Badge; unlocks the sol loop |
| Threshold mission success | Minimum science requirement met | Mission counts as a success; base science points |
| Baseline mission success | Full science requirement met | Extra science points |
| Science result | First drill sample, first detection of a target mineral, objective-specific finds | Science points plus a discovery card that explains the real science |
| Record or first | Longest drive in a sol, first far-side operation, most samples cached | Badge; permanent profile record |
| Longevity | Every block of sols survived beyond the design life | Bonus science points; eligibility for a senior review extension |
| Cost and schedule | Mission finished under budget | Budget carry-over bonus for the next mission (small, so budget still scales slowly) |
| Heritage | Reusing a part that has already flown successfully | Cheaper and more reliable next time (heritage discount) |
| Collier-style honor | Rare achievements, such as completing a hard tier with all objectives | Cosmetic trophy and a short real-history note |

## Sustainment rules for the game

**Our analysis.** Each rule mirrors one of the eight pillars. Numbers are placeholders for balancing.

| Pillar | Rule | Player levers |
| --- | --- | --- |
| Energy | Each sol, energy = generation − survival heating; activities spend what is left. Solar output falls with dust and season; RTG output falls slowly every year. | Recharge sols, parking on Sun-facing slopes, task bundling (unlockable software) |
| Thermal | End-of-sol survival check. Failing damages the battery first, then electronics. | Heaters, insulation, heater units, hibernation |
| Hardware health | Wear meters for wheels, motors, drill, and battery. Wear rises with load, rough terrain, and deep battery discharge. At 100% a part fails. | Route choice, slower driving, traction software, workarounds after failure (drive backward, new drilling method) |
| Software | Patches unlocked on the advancement tree can be uploaded mid-mission. Installing pauses science for a few sols, with a small chance of rollback. | When to install: during a quiet season or before a hard traverse |
| Communications infrastructure | Relay passes per sol are set by the orbiter fleet. Events can retire an orbiter (fewer passes) or add a new one (more passes). | Onboard storage, data compression, prioritizing which data to send |
| Operations budget | Each sol after landing costs operations budget. Running low reduces command slots per sol (smaller team). | Efficient plans, finishing objectives sooner, winning extensions |
| Science renewal | After the prime mission, new objectives appear further away or deeper. Repeating old science earns less. | Travel to new terrain; balance distance against wear |
| Programmatic review | A senior review event after the prime mission and at intervals after (see below) | Keep the rover healthy and productive |

### Rover health dashboard

The sustainment rules suggest five tracked meters, visible every sol:

| Meter | Rises or falls with | Failure consequence |
| --- | --- | --- |
| Energy margin | Generation, dust, season, RTG decay | Forced hibernation |
| Battery health | Deep discharges, cold | Smaller usable battery; failed night checks |
| Wheel and motor wear | Distance, load, terrain | Slower driving, then a stuck wheel |
| Dust on panels (solar only) | Time, storms; cleaning events reduce it | Lower energy; no wake above a threshold |
| Operations budget | Sols elapsed, team size | Fewer command slots; end of mission at zero |

## The senior review event

**Our analysis**, modeled on NASA's real extended-mission reviews.

**When:** at the end of the prime mission, then every set number of sols.

**Scorecard (three criteria, mirroring science merit, technical status, and budget):**

| Criterion | Measured by |
| --- | --- |
| Science merit | Science points earned in the last period and new objectives available |
| Technical status | Rover health meters |
| Budget | Remaining operations budget against the cost of the next period |

**Outcomes:**

| Rating | Effect |
| --- | --- |
| Excellent | Extension granted with full operations budget and a bonus objective |
| Good | Extension granted with a reduced budget (fewer command slots) |
| Poor | Mission ends with a final debrief. Science already sent home still counts. |

This turns longevity into a deliberate choice. Players who drive the rover hard may score big early but fail the technical review. Players who are too cautious may fail the science review.

## Key numbers for the game

| Quantity | Value | Source |
| --- | --- | --- |
| Senior review cadence | About every 3 years for an extension | [mission-engineering 01](../mission-engineering/01-mission-lifecycle.md#key-numbers-for-the-game) |
| Curiosity extended missions | Fifth extended mission (as of 2025) | [NASA](https://science.nasa.gov/mission/msl-curiosity/) |
| Curiosity operations cost | About $40 to $60 million per year | [03](03-surface-environments-and-operations.md#key-numbers-for-the-game) |
| MER operations cost | About $336 million over 15 years | [01](01-rover-missions-history.md#cost-team-and-build-time) |
| Perseverance robotic operations staffing cut | 53.2% (2025) | [03](03-surface-environments-and-operations.md#surface-operations) |
| Curiosity 2023 software update pause | 5 days (April 3 to 7) | [JPL](https://www.jpl.nasa.gov/news/nasas-curiosity-mars-rover-gets-a-major-software-upgrade) |
| Share of Perseverance science data sent by relay | 99.9% | [02](02-rover-subsystems.md#communications) |
| Opportunity design life vs actual | 90 vs 5,111 sols | [01](01-rover-missions-history.md#key-numbers-for-the-game) |
| Off-world distance record | 45.22 km (Perseverance, October 2026) | [01](01-rover-missions-history.md#key-numbers-for-the-game) |

## Sources

- [NASA, Curiosity mission page](https://science.nasa.gov/mission/msl-curiosity/)
- [NASA, Planetary Mission Senior Review 2025 final report package](https://assets.science.nasa.gov/content/dam/science/psd/resources/senior-review/2025/PMSR25_Final_Report_Package_June9_2025_Tagged.pdf)
- [LASP, NASA extends MAVEN Mars mission (2022)](https://lasp.colorado.edu/maven/2022/04/25/nasa-extends-maven-mars-mission-citing-excellence-in-science-and-mission-operations/)
- [NASA, 2025 Agency Honor Awards program](https://www.nasa.gov/wp-content/uploads/2025/08/aha-event-program.pdf)
- [JPL, NASA Curiosity rover wins prestigious awards](https://www.jpl.nasa.gov/news/nasa-curiosity-rover-wins-prestigious-awards/)
- [AOPA, Mars exploration earns NASA JPL a Collier Trophy (2013)](https://www.aopa.org/news-and-media/all-news/2013/march/14/mars-exploration-earns-nasa-jpl-a-collier-trophy)
- [JPL, NASA's Curiosity Mars rover gets a major software upgrade (2023)](https://www.jpl.nasa.gov/news/nasas-curiosity-mars-rover-gets-a-major-software-upgrade)
- [JPL, Marking 13 years on Mars, NASA's Curiosity picks up new skills (2025)](https://www.jpl.nasa.gov/news/marking-13-years-on-mars-nasas-curiosity-picks-up-new-skills/)
- [The Conversation, NASA's Mars orbiter fleet is getting old](https://theconversation.com/nasas-mars-orbiter-fleet-is-getting-old-heres-how-that-could-affect-future-exploration-292555)
- [Museum of Science, Space News Deep Dive: Mixed-Up MAVEN](https://www.mos.org/article/space-news-deep-dive-mixed-maven) (secondary)
- [Hackaday, After decades, NASA may finally replace Mars relays (2026)](https://hackaday.com/2026/09/24/after-decades-nasa-may-finally-replace-mars-relays/) (secondary)
- Other facts are cited in the linked files: [01](01-rover-missions-history.md), [02](02-rover-subsystems.md), [03](03-surface-environments-and-operations.md), [mission-engineering 01](../mission-engineering/01-mission-lifecycle.md), and [mission-engineering 04](../mission-engineering/04-cost-risk-programmatics.md).
