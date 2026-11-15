# Cost, Risk, and Programmatics

How space missions are paid for, estimated, scheduled, risk-classified, staffed, and judged, plus what real successes and failures teach. This file gives the team sourced numbers to build the budget (RES-03), time (RES-06), random-event (EXT-05), and post-mission analysis (EDU-06, EXT-10) mechanics. Researched November 14, 2026.

Related files: the review and phase sequence lives in [01-mission-lifecycle.md](01-mission-lifecycle.md), orbit and launch vehicle selection in [02-mission-design-orbits-launch.md](02-mission-design-orbits-launch.md), and subsystem engineering in [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md). The official feature register is in [challenge brief](../../challenge-brief.md).

Quick navigation: [Where the money goes](#where-the-money-goes) · [Cost estimating](#cost-estimating) · [Reserves and confidence](#reserves-confidence-levels-and-schedule-margin) · [Cost reference points](#mission-cost-reference-points) · [Cost growth evidence](#cost-and-schedule-growth-evidence) · [Risk management](#risk-management-and-risk-classes) · [Failure statistics](#launch-and-mission-failure-statistics) · [Case studies](#case-studies-failures-recoveries-and-successes) · [Real event categories](#real-on-orbit-and-programmatic-events) · [Teams and organizations](#team-organizational-and-human-factors) · [How NASA judges value](#how-nasa-judges-value) · [Key numbers](#key-numbers-for-the-game) · [Event cards](#event-card-ideas-from-real-missions) · [Game implications](#game-implications) · [Sources](#sources)

**How to read this file.** Facts carry an inline source link. Dollar figures state their year basis where the source gives one ("FY25$" means fiscal year 2025 dollars; "then-year" means the dollars of the year spent). Items marked *unverified* rest on a single secondary source or could not be checked against a primary document. Paragraphs headed **Our analysis** are the research team's interpretation, not NASA guidance.

## Where the money goes

### NASA's standard work breakdown structure

NASA projects report cost against a standard Level 2 work breakdown structure (WBS) defined in [NPR 7120.5](https://explorers.larc.nasa.gov/2023ESE/pdf_files/NASA01.%20NPR%207120.5F%20NASA%20Space%20Flight%20Program%20and%20Project%20Management%20Requirements.pdf) and explained in the [NASA WBS Handbook](https://www.nasa.gov/wp-content/uploads/2023/08/nasa-work-breakdown-structure-handbook.pdf). The handbook calls the WBS and its dictionary "mandatory elements" of a project's management baseline. A JPL cost-estimating overview lists the elements as follows ([Saing, JPL, 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf)):

| WBS | Element | What it pays for (plain English) | Game translation |
| --- | --- | --- | --- |
| 01 | Project management | Planning, budgets, contracts, reviews | Fixed "overhead" slice |
| 02 | Systems engineering | Requirements, interfaces, margins, trade studies | Overhead; cutting it raises risk |
| 03 | Safety and mission assurance | Quality, parts screening, reliability analysis | Scales with risk class |
| 04 | Science and technology | Science team, data analysis | Science return multiplier |
| 05 | Payload | Instruments | Player-selected cards |
| 06 | Flight system (spacecraft) | Bus subsystems | Player-selected cards |
| 07 | Mission operations | Flight team after launch | Per-year cost in Phase E |
| 08 | Launch vehicle and services | Rocket, integration | Player-selected launch option |
| 09 | Ground data system | Ground software, stations, networks | Fixed plus per-contact costs |
| 10 | Systems integration and test | Assembly, environmental testing | Testing choices |
| 11 | Education and public outreach | Outreach | The JPL deck lists it as about 1% of total excluding launch |
| 12 | Technology demonstration (optional) | Hardware being flight-tested | Optional "experimental part" slot |

The JPL deck gives element 11 as "1% of total (not including LV)" ([Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf)). The exact title and use of element 12 should be checked against Figure H-2 of the current NPR 7120.5 (*unverified* here).

### Typical shares by WBS element

No single NASA publication gives an official "typical percentage" table. Two published estimates break out cost by element and point the same way. In both, payload plus spacecraft make up about two-thirds of the development cost before launch and reserves.

| WBS group | Small astrophysics mission example (FY20$M, average of 4 estimates) | Interstellar Probe concept (FY25$M, Phase A–D baseline) |
| --- | --- | --- |
| PM + SE + mission assurance (01–03) | 17.2 (about 11%) | 169 (15%) |
| Science (04) | 18.0 (about 12%) | 50 (4%) |
| Payload (05) | 50.2 (about 32%) | 361 (32%) |
| Spacecraft (06) | 50.6 (about 32%) | 388 (34%) |
| Mission ops + ground data (07, 09) | 15.1 (about 10%) | 37 (3%, pre-launch only) |
| Integration and test (10) | Mostly inside WBS 06 | 95 (8%) |
| Other | Outreach 2 | Nuclear launch approval 26 (2%) |
| Launch (08) | 50 (added on top) | Excluded |
| Reserves | 25% Phase A–D, 15% Phase E | 50% Phase A–D, 25% Phase E |
| Source | [Saing 2020, slide 31](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) | [Kha, JHU APL, 2021, slide 8](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf) |

Percentages in the first column are our arithmetic on the deck's averages, excluding launch. The deck's columns do not add perfectly because each model bundles elements differently.

### Development versus operations, and launch as a share

| Measure | Value | Source |
| --- | --- | --- |
| SMEX missions, Phase A–D vs E/F | About 90% development, about 10% operations (launch excluded) | [Saing 2020, slide 30](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) |
| JWST | Development about $8.8B; lifecycle with 5 years of operations $9.66B (2018 replan) | [Spaceflight Now, 2018](https://spaceflightnow.com/2018/06/27/webbs-launch-delayed-to-2021-at-a-cost-of-nearly-1-billion/) |
| Interstellar Probe (50-year concept) | Phase A–D $1,689M vs Phase E $1,455M (FY25$, with reserves) | [Kha 2021](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf) |
| Interstellar Probe operations rate | About $22.7M per year average, $1.83M per month in quiet cruise | [Kha 2021](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf) |
| Landsat 9 launch | About $153.8M launch cost within an $885M lifecycle baseline (about 17%) | [NASA, 2017](https://www.nasa.gov/press-release/nasa-awards-launch-services-contract-for-landsat-9-mission); [NASA Landsat, GAO summary](https://landsat.gsfc.nasa.gov/article/landsat-9-project-on-track-u-s-general-accounting-office-assesses) |
| Europa Clipper launch | About $178M Falcon Heavy contract against a $5B baseline (under 4%) | [SpaceNews, 2021](https://spacenews.com/?p=117075); [SpacePolicyOnline, 2022](https://spacepolicyonline.com/news/nasa-reveals-europa-clipper-cost-growth-mars-sample-return-replan/) |
| SMEX example launch | $50M of a $239M estimate with reserves (about 21%) | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) |

**Our analysis.** Launch is a large share for small missions and a small share for flagships. Operations are a small share for short Earth-orbit missions and can rival development for decades-long deep-space missions. A game can show this by charging launch as a lump sum and operations as a per-year drain, so long missions feel expensive in a different way from heavy ones.

## Cost estimating

### Three methods

| Method | How it works | Strength | Weakness | Source |
| --- | --- | --- | --- | --- |
| Analogy | Scale a similar past mission | Quick rough estimate | Needs a good analog; new designs have none | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) |
| Parametric | Cost estimating relationships (CERs) fitted to historical data, usually driven by mass and power | Gives statistical confidence | Unreliable outside the data range | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf); [Kha 2021](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf) |
| Grassroots (bottom-up) | Count every person-hour, part, and trip | Most defensible | Slow and costly; not for early concepts | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) |

The JPL analogy example: past SMEX spacecraft averaged about 150 kg and $50M, so a 200 kg spacecraft scales to about $67M ([Saing 2020, slide 11](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf)).

### NASA's main models

| Model | Scope | Notes | Source |
| --- | --- | --- | --- |
| NASA Instrument Cost Model (NICM) | Instruments | 250+ normalized NASA and industry instruments; supports Class D estimates; includes cost and schedule rules of thumb by instrument type | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) |
| Project Cost Estimating Capability (PCEC) | Full mission | Successor to NAFCOM; outputs to the NASA standard WBS | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf); [PCEC v2.4 briefing, 2024](https://www.nasa.gov/wp-content/uploads/2024/05/59-pcec-nasa-cost-symposium-2024-final-e.pdf) |
| Small Spacecraft Cost Model (SSCM, Aerospace Corp.) | Spacecraft up to about 1,000 kg | Estimates Phases C/D only; the user guide says add 10% for Phase B | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) |
| COMPACT | CubeSats and microsats | Analogy (k-nearest neighbors) tool built on NASA-funded CubeSat data | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) |
| MOCET | Mission operations (Phase E) | Parametric operations model used for Interstellar Probe | [Kha 2021](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf) |

The Unmanned Space Vehicle Cost Model (USCM) is a US Air Force/Space Force model for larger military spacecraft; we did not find a primary source on its current version in this pass (*unverified*).

### The mass–cost relationship and why cost-per-kg misleads

Parametric models tie cost to mass because heavier spacecraft usually do more. The relationship is loose. A draft COMPACT CubeSat CER fitted cost to mass as cost = 491 × mass^1.102, with an adjusted R² of only 46%. An alternative draft that used size class and developer type fit no better (adjusted R² 47%). It gave roughly $1.1M for a small university or commercial CubeSat, $4.1M for a small NASA/JPL CubeSat, and $11.8M for a 6U NASA/JPL CubeSat ([Saing 2020, slides 46–47](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf); slide units read as thousands of dollars, year basis not stated, *unverified*). The deck labels both "not ready for use in proposal development." Its first recommendation is "Not all costs scale with size of the spacecraft," and it calls the idea that cost scales with flight-system size a "common misconception" ([Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf)). The National Research Council found instrument cost correlates better with a multivariable "level of difficulty" measure than with mass, and found little correlation between instrument mass growth and cost growth ([NRC 2010, via NASA APPEL](https://appel.nasa.gov/?p=240679)).

**Our analysis.** Cost per kilogram misleads because:

- the same mass can be simple structure or a cryogenic detector;
- fixed costs (management, testing, operations team) do not shrink with mass;
- developer experience changes cost by a factor of several, as the COMPACT draft shows.

A game should price parts by capability, maturity, and risk class, not by mass alone.

### Concurrent engineering estimates

JPL's Team X, founded in 1995, puts subsystem experts in one room for several days to produce a point design and cost estimate. A 2002 validation of about 10 studies found estimates fell within ±30% of actuals, with half within ±10% ([JPL/NTRS summaries, as reported](https://ntrs.nasa.gov/citations/20190025644); *unverified* for the exact counts). JPL says such pre-Phase A estimates should be read as "indicative rather than predictive" (same source).

## Reserves, confidence levels, and schedule margin

### Cost reserves (unallocated future expenses)

| Guidance | Value | Source |
| --- | --- | --- |
| JPL design practice (2009): budget reserve as percent of cost-to-go | 30% at proposal (pre-A to A and A to B), 25% at PDR, 20% at CDR, 20% at start of system integration and test, 10% at shipment to launch site | [Gavin, JPL, NASA PM Challenge 2009](https://www.slideshare.net/slideshow/gavintom/13669302) |
| JPL small-mission estimating example | 25% Phase A–D, 15% Phase E | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) |
| Decadal-survey mission study ground rules (Rev. 4) | 50% Phase A–D (excluding launch), 25% Phase E (excluding DSN) | [Kha 2021](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf) |
| Evidence on whether reserves work | The NRC found "no discernible correlation" between planned reserve level and actual cost performance | [NRC 2010, ch. 6](https://nap.nationalacademies.org/read/12946/chapter/8) |

The current GSFC Gold Rules (GSFC-STD-1000 Rev I) cover technical margins, not budget reserves; budget reserve and funded schedule margin sit in a separate GSFC procedure (GPR 7120.7) that we could not retrieve ([GSFC-STD-1000 Rev I](https://standards.nasa.gov/system/files/tmp/GSFC-STD-1000RevI_Approved_0.pdf)).

### Technical margins (the engineering version of reserves)

GSFC's mission-level margin rules show how margins shrink as the design matures ([GSFC-STD-1000 Rev I, Table 1.06-1](https://standards.nasa.gov/system/files/tmp/GSFC-STD-1000RevI_Approved_0.pdf)):

| Resource | Pre-Phase A | Phase A | Phase B | Phase C | Phase D |
| --- | --- | --- | --- | --- | --- |
| Mass | >15% at all times before SRR | >15% at SRR | >10% at PDR | >5% at CDR, >2% at SIR | 0 |
| Power (vs end-of-life capacity) | >25% | >20% | >15% | >10% | >5% |
| RF link (NASA network direct-to-Earth) | >3 dB | >3 dB | >3 dB | >1 dB | >1 dB |

Details for these budgets belong to [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md).

### Joint cost and schedule confidence level (JCL)

| Rule | Value | Source |
| --- | --- | --- |
| Budget at Key Decision Point C (start of implementation) | 70% joint cost and schedule confidence, or as approved by the decision authority | [NASA NPR 7120.5E briefing, GSFC 2011](https://webarchive.library.unt.edu/web/20130213220144/http:/fpd.gsfc.nasa.gov/NPR71205/01-NPR_7120_Rev_E_Briefing_Nov-10-11_GSFC_Nov%2018.pdf); [NID 7120.122](https://nodis3.gsfc.nasa.gov/OPD_Docs/NID_7120_122_.pdf) |
| Minimum funding | Not less than the 50% confidence level | NASA slide decks only (*unverified* against current NPR text) |
| Budgeting below 70% | Must be justified in the KDP-B decision memorandum | [NID 7120.122](https://nodis3.gsfc.nasa.gov/OPD_Docs/NID_7120_122_.pdf) |
| Applies to | Projects with lifecycle cost over $250M | [NASA JCL FAQ](https://www.nasa.gov/pdf/394931main_JCL_FAQ_10_12_09.pdf) (*unverified* threshold wording) |

A JCL is a probability: a 70% JCL means a 70% chance of finishing at or under the committed cost and date at the same time. The JWST Independent Review Board set the March 2021 launch date at 80% confidence, which, as its chair noted, still left a 20% chance of another delay ([Spaceflight Now, 2018](https://spaceflightnow.com/2018/06/27/webbs-launch-delayed-to-2021-at-a-cost-of-nearly-1-billion/)). JWST in fact launched in December 2021.

### Schedule margin rules of thumb

| Guidance | Value | Source |
| --- | --- | --- |
| JPL schedule margin rates (2009) | 1 week per month, 1 month per year, 2 months per year, tied to different development stages (start of implementation to delivery to system integration and test, and during test) | [Gavin 2009](https://www.slideshare.net/slideshow/gavintom/13669302) (stage mapping *unverified* because slide columns did not extract cleanly) |
| General industry rule | 1 month per year | [Bitten et al., Aerospace Corp., 2008, as summarized](https://newfrontiers.larc.nasa.gov/NF3/PDF_FILES/ConceptualDesignOptimismSSCAG_SCAF_EACEMay2008.pdf) |
| NASA/JPL guidance cited by Aerospace Corp. | 1.8 months per year | Same source |
| Telescope missions | 4 of 6 exceeded common schedule reserve guidelines | Same source |

## Mission cost reference points

### NASA mission classes and cost caps

| Class | Cost or cap | Basis and scope | Example | Source |
| --- | --- | --- | --- | --- |
| CSLI CubeSat | Builder pays development; NASA provides the ride | About 160 CubeSats launched from 45 states, DC, and Puerto Rico | University CubeSats | [NASA, 2024](https://www.nasa.gov/news-release/nasa-seeks-student-missions-to-send-to-space-in-2026-beyond/) |
| CubeSat (COMPACT draft) | About $1.1M (university/commercial <6U) to $11.8M (NASA/JPL 6U) | Draft CER, year unknown | MarCO, ASTERIA | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) (*unverified* units) |
| SIMPLEx-1 CubeSat | About $5.6M maximum budget | Planetary CubeSat | LunaH-Map | [Wikipedia summary](https://en.wikipedia.org/wiki/Small_Innovative_Missions_for_Planetary_Exploration) (*unverified*) |
| Astrophysics Pioneers | $20M cap, excluding launch | NASA pays launch | Pandora, Aspera | [SpaceNews, 2021](https://spacenews.com/?p=109994) |
| SIMPLEx-2 | $55M cap, excluding launch; up to 180 kg | About one-tenth of Discovery | Janus, Lunar Trailblazer, ESCAPADE | [Spaceflight Now, 2019](https://spaceflightnow.com/2019/08/05/nasas-first-interplanetary-smallsats-may-struggle-to-stay-under-cost-caps/) |
| Small Explorer (SMEX) | $170M (FY25$), raised to $190M (FY26$) for the 2026 astrophysics AO; Phases A–F, excluding NASA-provided launch | Class C or D | IXPE | [NASA PCOS, 2024](https://pcos.gsfc.nasa.gov/news/2024/91_2025_Astrophysics_Small_Explorer_AO.php); [APSMEX26 Evaluation Plan](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/APSMEX26%20Evaluation%20Plan.pdf) |
| Medium Explorer (MIDEX) | $300M (FY22$) for the 2021 astrophysics AO, excluding launch | See [01-mission-lifecycle.md](01-mission-lifecycle.md#where-missions-come-from) | TESS, SPHEREx | [2021 Astro MIDEX Evaluation Plan](https://explorers.larc.nasa.gov/2021APMIDEX/MIDEX/pdf_files/2021_Astro_MIDEX_Evaluation_Plan_Final_12May2022_rev4.pdf) |
| Discovery | About $500M, excluding launch and operations | Planetary | Psyche, Lucy | [Planetary Society](https://www.planetary.org/articles/what-are-competed-planetary-missions) |
| New Frontiers | About $900M, excluding launch and operations | Planetary | Dragonfly | [Planetary Society](https://www.planetary.org/articles/what-are-competed-planetary-missions) |
| Landsat 9 | $885M lifecycle baseline | Directed Earth science with USGS | Launched September 27, 2021 | [CRS R46560](https://www.everycrsreport.com/reports/R46560.html); [NASA](https://science.nasa.gov/mission/landsat-9) |
| Psyche (Discovery) | $985M lifecycle before its delay; later reported at $1.13B by GAO | Includes launch and operations | Launched October 2023 | [Spaceflight Now, 2022](https://spaceflightnow.com/2022/06/27/after-software-delays-nasa-gives-up-on-launching-psyche-asteroid-mission-this-year/); [The Register, 2023](https://www.theregister.com/2023/06/07/nasa_asteroid_psyche_mission/) |
| Europa Clipper (flagship) | $4.25B, raised to $5B in 2022 | Agency baseline commitment | Launched October 2024 | [SpacePolicyOnline, 2022](https://spacepolicyonline.com/news/nasa-reveals-europa-clipper-cost-growth-mars-sample-return-replan/) |
| JWST (flagship) | $9.66B lifecycle (2018 replan); GAO: $9.7B, nearly double the 2009 figure | Includes 5 years of operations | Launched December 2021 | [GAO-21-406](https://www.gao.gov/products/GAO-21-406) |
| Mars Sample Return (campaign) | IRB: $8.0–9.6B (2023); NASA: up to $11B with return in 2040 (2024) | Not funded in FY2026 | Cancelled in practice | [Payload, 2023](https://payloadspace.com/independent-review-board-finds-mars-sample-return-unrealistic/); [Space.com, 2024](https://www.space.com/nasa-revamp-mars-sample-return-plan) |

### Commercial contrast

| Item | Value | Source |
| --- | --- | --- |
| SpaceX rideshare to sun-synchronous orbit | About $350,000 for up to 50 kg, then about $7,000/kg (2026) | [NewSpace Economy, 2026](https://newspaceeconomy.ca/?p=214492) (*unverified*, not a SpaceX price sheet) |
| Rideshare price trend | About $5,000/kg at program start, $6,500/kg by 2023 | [NewSpace Economy, 2026](https://newspaceeconomy.ca/2026/10/20/how-has-the-spacex-transporter-program-reshaped-satellite-earth-observation/) (*unverified*) |
| Commercial constellation mindset | Mission success is judged on the aggregate fleet, with proprietary practices | [Swartwout, NEPP 2017](https://nepp.nasa.gov/docs/etw/2017/28-JUN-WED/0900%20-%20swartwout%20etw%202017.pdf) |

**Our analysis.** Commercial Earth observation companies accept losing individual satellites because they build many cheap ones and replace them. Landsat 9 is a single, long-lived, carefully calibrated instrument. Both are rational choices for different objectives. This is a good teaching contrast for MIS-06 ("no single perfect design").

## Cost and schedule growth evidence

### GAO annual assessments (latest)

| Measure | GAO-26-108556 (July 2026) | GAO-25-107591 (July 2025) |
| --- | --- | --- |
| Major projects (over $250M) | 36 | 38 |
| Portfolio lifecycle cost | At least $70B | About $74B |
| Projects in development with baselines | 18 | 18 |
| Projects with cost overruns in the past year | 3, totaling $501.4M | 4, over $500M |
| Projects with schedule delays in the past year | 2, totaling 2 months | 3 |
| Cumulative cost overrun | Grew from $4.4B to nearly $4.7B | Not stated as a single figure |
| Cumulative schedule delay | Grew from 13.1 to 14 years | Not stated |
| Concentration | Orion accounts for over half of the annual and almost 75% of the cumulative overruns | Three Artemis projects account for nearly $7B, almost half of overruns across 53 projects tracked since 2009 |
| Long-run record | Not restated | 30 of 53 projects that completed development since 2009 stayed under the 15% overrun reporting threshold |
| Workforce | NASA cut about 4,000 civil servants (nearly 22%) in 2025; 25 of 36 projects reported effects | Not applicable |

Sources: [GAO-26-108556](https://www.gao.gov/products/gao-26-108556); [GAO-25-107591](https://www.gao.gov/products/gao-25-107591).

### Why costs grow: the research consensus

The National Research Council's 2010 study *Controlling Cost Growth of NASA Earth and Space Science Missions* is the best single summary ([NRC 2010, ch. 3](https://www.nationalacademies.org/read/12946/chapter/3)):

| Finding | Value |
| --- | --- |
| Range of average cost growth in past studies | 23% to 77%; average of 51% across 10 primary references |
| Aerospace Corp. 40-mission study | 27% average cost growth (and 22% schedule growth per [Bitten et al. 2008](https://newfrontiers.larc.nasa.gov/NF3/PDF_FILES/ConceptualDesignOptimismSSCAG_SCAF_EACEMay2008.pdf)) |
| Cost growth vs schedule growth | Correlated (R² = 0.64) |
| Distribution | 19 of 40 missions under 15% growth; 8 between 15% and 30%; 13 over 30% |
| Concentration | 11 missions (28%) caused about 80% of total absolute growth |
| Timing | About 75% of growth occurs after critical design review |
| Four most-cited causes | Overly optimistic initial estimates; project instability and funding problems; instrument and technology development problems; launch service issues |

Bitten and colleagues found roughly a 12% cost increase for every 10% of schedule growth ([Bitten et al. 2008, as summarized](https://newfrontiers.larc.nasa.gov/NF3/PDF_FILES/ConceptualDesignOptimismSSCAG_SCAF_EACEMay2008.pdf); *unverified* exact coefficient). NASA's Inspector General described a "Hubble psychology": later technical success at much greater cost "reaffirms a mindset that project costs and adherence to schedule are secondary considerations" ([NASA OIG IG-12-021](https://oig.nasa.gov/docs/IG-12-021.pdf)).

### The James Webb replans

| Date | Event | Source |
| --- | --- | --- |
| 2009 baseline to 2021 | Cost nearly doubled to $9.7B | [GAO-21-406](https://www.gao.gov/products/GAO-21-406) |
| 2018 | Independent Review Board (chair Tom Young) named five causes of a 29-month delay: human errors, embedded problems, lack of experience with new technology such as the sunshield, excessive optimism, and system complexity | [Spaceflight Now, 2018](https://spaceflightnow.com/2018/06/27/webbs-launch-delayed-to-2021-at-a-cost-of-nearly-1-billion/); [NASA IRB report](https://www.nasa.gov/wp-content/uploads/2015/01/webb_irb_report_and_response_0.pdf) |
| 2018 | Lifecycle cost reset to $9.66B; launch target March 30, 2021 | Same |
| December 2021 | Launch | [GAO-21-406](https://www.gao.gov/products/GAO-21-406) |

### Descoping and rescoping as tools

| Example | What changed | Source |
| --- | --- | --- |
| Baseline vs threshold mission | Proposals define a full "baseline" mission and a minimum "threshold" mission; the gap absorbs cost and schedule pressure, for example by dropping instruments | [NASA PI Launchpad, 2023](https://science.nasa.gov/wp-content/uploads/2023/04/PILaunchpad_GertsenIntro.pdf) |
| Mars Sample Return | Two-lander replan in 2022; cost rose to up to $11B; NASA sought options under $7B in 2024; not funded in FY2026 | [SpacePolicyOnline, 2022](https://spacepolicyonline.com/news/nasa-reveals-europa-clipper-cost-growth-mars-sample-return-replan/); [Space.com, 2024](https://www.space.com/nasa-revamp-mars-sample-return-plan); [The Register, 2026](https://www.theregister.com/2026/01/16/nasa_science_budget/) |
| Psyche ripple effect | Psyche's delay pushed the VERITAS Venus mission to no earlier than 2031 | [Space.com](https://www.space.com/nasa-problems-psyche-venus-probe-veritas-launch-delay) |
| Voyager | Teams agreed years in advance on the order in which instruments switch off as power fades | [The Register, 2025](https://www.theregister.com/2025/03/06/voyager_power_down/) |

## Risk management and risk classes

### Risk-informed decision making

[NPR 8000.4C](https://soma.larc.nasa.gov/STP/DYNAMIC/pdf_files/NPR%208000.4C%20AgencyRiskMngmt.pdf) (effective April 19, 2022) splits risk management into two processes: Risk-Informed Decision Making (RIDM), used when choosing between options, and Continuous Risk Management (CRM), used to track risks once a path is chosen. The working tool is the 5×5 matrix: rows score likelihood, columns score consequence, and consequences are rated across safety, performance, cost, and schedule ([NASA IV&V S3001 risk guideline](https://www.nasa.gov/wp-content/uploads/2015/10/s3001_guidelines_for_risk_management_-_ver_g_-_10-25-2017.pdf)). Detailed guidance is in the [NASA Risk Management Handbook, SP-2011-3422](https://appel.nasa.gov/wp-content/uploads/2024/10/Quick-Webinar-Risk-Management-October-2024.pdf).

| | Consequence 1 (minimal) | 2 | 3 | 4 | 5 (mission loss) |
| --- | --- | --- | --- | --- | --- |
| **Likelihood 5 (near certain)** | Medium | High | High | High | High |
| **4** | Low | Medium | High | High | High |
| **3** | Low | Medium | Medium | High | High |
| **2** | Low | Low | Medium | Medium | High |
| **1 (remote)** | Low | Low | Low | Low | Medium |

The cell colors above are illustrative; each project sets its own scoring thresholds (*our simplification*).

### Payload risk classes A–D

The current directive is [NPR 8705.4B](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf), effective November 1, 2024, through October 31, 2032. It replaced 4A and moved toward objectives rather than prescriptive rules ([NASA OSMA, 2024](https://sma.nasa.gov/news/articles/newsitem/2024/12/02/npr-8705-4b-risk-classification-for-nasa-payloads-formally-released-agencywide)). The mission directorate assigns the class no later than the KDP-B decision memo.

| Consideration (NPR 8705.4B Table C-1) | Class A | Class B | Class C | Class D |
| --- | --- | --- | --- | --- |
| Risk tolerance | Lowest, driven by technical objectives | Low | Moderate | High, driven more by programmatic constraints |
| Priority | Very high | High | Medium | Low |
| Primary mission lifetime | Over 5 years | 3–5 years | 1–3 years | Under 1 year |
| Complexity | Very high | High | Medium | Medium to low |
| Lifecycle cost | High | Medium to high | Medium | Medium to low |
| Examples (NASA LSP) | JWST, Europa Clipper, Roman | MRO, MSL, Psyche, GOES-R | TESS, SPHEREx | CYGNSS, TROPICS, ESCAPADE |
| Allowed rockets (NASA LSP) | Category 3 (about 95% demonstrated reliability) | Category 2 or 3 | Category 2 or 3 | Category 1 (new) or uncertified |

Sources: [NPR 8705.4B](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf); [NASA Launch Services Risk Classification Fact Sheet](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf). The fact sheet defines Category 2 rockets as having about 89% demonstrated reliability and Category 3 about 95%.

The directive says these factors are weighed together. A 10-year mission might still be Class C, and a 2-month mission might be Class A ([NPR 8705.4B, C.2](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf)).

### What changes between classes

| Area | Class A | Class B | Class C | Class D | Source |
| --- | --- | --- | --- | --- | --- |
| Fault tolerance | Covers all critical items whose failure would fail mission objectives | Covers mission success criteria and safety-critical risks | At project discretion for mission success | Only items that could injure people or damage other assets | [NPR 8705.4A App. D](https://essp.larc.nasa.gov/EVI-6/pdf_files/NPR_8705_4A.pdf) |
| Electronic parts | Level 1 | Level 2 | Level 3 | Level 4 | Same |
| Test program | Qualification and flight acceptance units | Mixed qualification, acceptance, protoflight | Mixed | Protoflight; testing at higher assembly level acceptable | Same |

Class A to D is a continuum, and projects may "mix and match" from different classes as long as they meet the overall intent ([NPR 8705.4B, D.2](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf)).

### Class D, CubeSats, and "do no harm"

NASA can place high-risk Class D payloads on a reliable rocket as rideshares, provided "they're configured to do no harm, so they don't interfere in any way with the primary payload" ([NASA LSP fact sheet](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf)). Lower-oversight VADR launch contracts are only open to Class D or unclassified missions (same source). NPR 8705.4B lets a directorate designate a mission riskier than Class D or leave it unclassified ([NPR 8705.4B, 3.1.5](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf)). Aerospace Corp. has published guidelines for risk classes and do-no-harm requirements ([ATR-2023-01889](https://aerospace.org/sites/default/files/2024-06/ATR-2023-01889%20-%20Mission%20Assurance%20Guidelines%20for%20Mission%20Risk%20Classes%20and%20Do%20No%20Harm%20%28DNH%29%20for%20Space%20Vehicles.pdf)).

**Our analysis: the cost–schedule–risk triangle.** A project can buy down risk with money (redundancy, better parts, more tests) or with time (more test cycles). If cost and schedule are both capped, risk is what grows. Margins are the cheapest risk control because they are decided on paper early. The GSFC table above shows margins being "spent" as the design matures. For the game: the risk class should be a top-level choice that multiplies part cost, test time, and failure probability together.

We found no NASA-published probability-of-success numbers by risk class. The game's success probabilities should be labelled as invented for gameplay.

## Launch and mission failure statistics

### Launch reliability

| Measure | Value | Source |
| --- | --- | --- |
| Global orbital launches, 2025 | 325, a record; SpaceX flew 165 (about 51%) | [Via Satellite on BryceTech, 2026](https://www.satellitetoday.com/launch/2026/04/10/brycetech-report-shows-spacex-accounted-for-50-of-launches-in-2025) |
| 2025 failures | Counts range from 5 to 12 depending on how Starship tests are treated (about 96–98% success) | [Jonathan's Space Pages](https://planet4589.org/stats/launches.html); [KeepTrack](https://keeptrack.space/launches) (*unverified* single count) |
| NASA rocket risk categories | Category 2: about 89% demonstrated reliability; Category 3: about 95% | [NASA LSP fact sheet](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf) |
| Maiden flights | About 45% failed (Seradata database, as of 2025); 11.7% failure rate across first five flights for vehicles since 2010 | [Seradata via search summary](https://www.seradata.com/maiden-flights-are-becoming-more-reliable-2/) (*unverified*) |
| New vehicles, historical | New launch vehicles fail far more often in early flights than risk assessments predicted | [Cross and Vesely, NASA, 2018](https://ntrs.nasa.gov/api/citations/20180006947/downloads/20180006947.pdf) |
| First launches, 1980–2002 | 33% of first launches failed even for experienced companies; failure rates normalized only after about 8 launches | [The Space Review, 2006](https://thespacereview.com/article/616/1) |

### CubeSat and small-satellite mission success

| Measure | Value | Source |
| --- | --- | --- |
| CubeSats launched through mid-2014 (178 studied) | 18% never contacted the ground (dead on arrival); about 60% still working after 2 years | [Langer, via The Space Review, 2016](https://thespacereview.com/article/3047/1); [Langer and Bouwmeester, SmallSat 2016](https://digitalcommons.usu.edu/smallsat/2016/TS10AdvTech2/4) |
| Cause of failures after 30+ days | Electrical power caused nearly half | [The Space Review, 2016](https://thespacereview.com/article/3047/1) |
| University smallsats, 2000–2015 (244 studied) | About 1/8 lost to launch failures; of those reaching orbit, nearly 30% dead on arrival and 15% early failures; only about 1/4 completed full missions | [Swartwout, via The Space Review, 2016](https://thespacereview.com/article/3047/1) |
| Experience effect | Flagship universities: about 1/4 dead on arrival or early failures. Independent universities with 3 or fewer smallsats: more than 3/5 | Same |
| First spacecraft | First-time builders had roughly a 50/50 chance of success | [Smithsonian Air & Space](https://www.smithsonianmag.com/air-space-magazine/cubesats-are-great-even-if-they-die-you-180952745/) |
| One-time builders | 80 of 132 universities that had flown smallsats had flown only once | [The Space Review, 2016](https://thespacereview.com/article/3047/1) |
| Swartwout's stated causes (hobbyist teams) | Too little time on integration and test; workmanship; terrestrial skills not translating to space | [Swartwout, NEPP 2017](https://nepp.nasa.gov/docs/etw/2017/28-JUN-WED/0900%20-%20swartwout%20etw%202017.pdf) |

### Typical anomaly categories

| Category | Real example in this file | Typical effect |
| --- | --- | --- |
| Power | CubeSat EPS failures; Voyager RTG decline | Instruments switched off, mission shortened |
| Attitude control | Kepler reaction wheels; Hitomi | Pointing loss, breakup in the worst case |
| Communications | Galileo high-gain antenna | Data rate cut by orders of magnitude |
| Software and fault protection | Mars Polar Lander; Schiaparelli; Beresheet; Phobos-Grunt | Loss during critical events |
| Propulsion | Mars Observer; Lunar Flashlight; LunaH-Map | Failure to reach target orbit |
| Ground process and human error | Mars Climate Orbiter; Genesis; Hubble | Undetected until too late |
| Environment | Starlink storm loss; JWST micrometeoroid; Voyager memory chip | Unplanned degradation |

## Case studies: failures, recoveries, and successes

Each case lists the trade-off or process that failed and the lesson. Mission-loss reports are collected in the [NASA Lessons Learned Information System (LLIS)](https://llis.nasa.gov/).

| Mission (year) | What happened | Root cause | Trade-off or process that failed | Lesson |
| --- | --- | --- | --- | --- |
| Mars Climate Orbiter (1999) | Arrived far too low and was lost at about 57 km altitude | Ground software file "Small Forces" produced thruster data in English units where metric was expected | Interface verification; navigation anomalies not escalated | Check units at every interface; listen to small anomalies ([MIB Phase I report](https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf)) |
| Mars Polar Lander (1999) | Lost during landing | Most probable: leg deployment created a spurious touchdown signal; software shut the engine off at about 40 m | Test was run with miswired sensors and not repeated | "Test as you fly"; retest after fixes ([MPIAT testimony](https://spaceref.com/?p=28393); [AmericaSpace, 2019](https://www.americaspace.com/2019/01/06/could-not-have-survived-20-years-since-nasas-ill-fated-mars-polar-lander/)) |
| Mars Observer (1993) | Contact lost before Mars orbit insertion | Most probable: rupture on the propellant pressurization side; transmitter was off, so no data | Telemetry turned off during a critical event | Keep telemetry during critical events ([AIP FYI, 1994](https://ww2.aip.org/fyi/1994/final-report-issued-mars-observer-loss)) |
| CONTOUR (2002) | Lost during its solid rocket motor burn | Most likely structural failure from plume heating | No telemetry or optical coverage planned for the burn | Same lesson as Mars Observer; investigators had to "leave no stone unturned" ([CONTOUR MIB report](https://discovery.larc.nasa.gov/PDF_FILES/Contour_Mishap_Investigation.pdf); [Spaceflight Now](https://spaceflightnow.com/news/n0310/15contour/)) |
| Genesis (2004) | Sample capsule parachute never opened; capsule crashed in Utah | G-switch sensors installed inverted because of a design error | Design reviews, verification, and Red Team all missed it; the board criticized "faster, better, cheaper" shortcuts | A single overlooked check defeated several safety nets ([Universe Today](https://www.universetoday.com/73/genesis-accident-report-released/)) |
| Hubble (1990) | Blurred images from spherical aberration | Primary mirror ground to the wrong shape because a null corrector test lens was spaced 1.3 mm wrong | A second test that showed the flaw was overruled | Cross-check critical tests; servicing missions later fixed it ([NASA](https://www.nasa.gov/content/hubbles-mirror-flaw); [Allen Report](https://research.ssl.berkeley.edu/%7Emlampton/AllenReportHST.pdf)) |
| Galileo (1991 onward) | High-gain antenna never fully opened | Antenna deployment failure in flight | Single communications path for science data | Recovered with data compression, new coding, antenna arraying, and tape-recorder buffering, raising the low-gain link from 10 bit/s to about 1–2 kbit/s effective ([NASA APPEL](https://appel.nasa.gov/2011/05/13/galileos-rocky-road-to-jupiter/)) |
| OCO (2009) and Glory (2011) | Both lost when the Taurus XL fairing failed to separate | Supplier falsified aluminum extrusion test results for nearly two decades | Supply chain quality | NASA put losses above $700M; supplier pleaded guilty and paid about $46M; OCO-2 was rebuilt and flew in 2014 ([SpaceNews](https://spacenews.com/?p=88281); [Popular Science](https://www.popsci.com/nasa-aluminum-fraud/)) |
| Hitomi (2016) | Japanese X-ray observatory broke apart weeks after launch | False rotation reading, star tracker set too strict, then thrusters with a wrong software setting spun it faster | One attitude sensor could overrule all others; untested parameter upload | Avoid single points of failure in software; review uploads ([Scientific American](https://www.scientificamerican.com/blog/guest-blog/what-killed-japan-s-hitomi-x-ray-satellite/); [The Register](https://www.theregister.co.uk/2016/06/01/jaxas_litany_of_errors_spun_hitomi_to_pieces/)) |
| Schiaparelli (2016) | ESA lander crashed at about 540 km/h | About one second of IMU saturation made software think it was below ground; parachute released early, thrusters fired 3 s instead of 30 | Saturation flag handling; parachute dynamics modeling | Model worst cases; add redundancy ([Spaceflight Now, 2017](https://spaceflightnow.com/2017/05/24/probe-into-crash-of-esa-mars-lander-recommends-more-checks-on-exomars-descent-craft/)) |
| Beresheet (2019) | Private Israeli lander crashed on the Moon | An IMU failed; a ground command to restart it triggered a computer reset that shut the main engine | Real-time decision under pressure; redundancy existed but the fix created a new failure | Know how recovery commands interact ([Planetary Society](https://www.planetary.org/articles/software-command-doomed-beresheet); [Times of Israel](https://www.timesofisrael.com/5-6-attempts-to-restart-israeli-moon-landers-engine-failed-investigation-finds/)) |
| Phobos-Grunt (2011) | Russian Mars probe stranded in Earth orbit | Programming error rebooted both computer channels at once; components not qualified for spaceflight | Parts quality and software verification | Qualified parts matter ([Space.com](https://www.space.com/14539-russian-mars-probe-failure-investigation-computer-crash.html)) |
| Lunar Flashlight (2023) | CubeSat could not reach lunar orbit | Three of four thrusters underperformed from obstructed fuel lines, likely debris | Propulsion contamination control on a low-cost mission | New flight computer and other tech still worked: partial success ([Spaceflight Now, 2023](https://spaceflightnow.com/2023/05/16/nasas-lunar-flashlight-cubesat-mission-ends-before-entering-orbit-around-moon/)) |
| LunaH-Map (2022–2023) | CubeSat failed to enter lunar orbit | Propulsion problem (stuck thruster valve reported) | Low-cost propulsion | Class D accepts this risk ([SIMPLEx summary](https://en.wikipedia.org/wiki/Small_Innovative_Missions_for_Planetary_Exploration), *unverified* detail) |
| Kepler to K2 (2013–2014) | Second of four reaction wheels failed; precise pointing lost | Wheel wear | Hardware lifetime | Engineers used sunlight pressure as a "third wheel" and created K2, observing new fields for about 80 days each ([NASA ExEP, 2014](https://exoplanets.nasa.gov/exep/newsletters/issue14/k2update/)) |
| Ingenuity (2021–2024) | Mars helicopter planned for up to 5 flights in 30 days flew 72 times over 3 years | Ended by rotor damage on flight 72 | Success: tech demo with margin | Margins and a capable team extend value ([NASASpaceflight](https://nasaspaceflight.com/2024/01/ingenuity-final-flight)) |
| Opportunity (2004–2019) | Designed for 90 days; operated over 14 years | Silenced by a planet-wide dust storm in 2018 | Success with solar-power exposure | Robust design and adaptive operations ([JPL](https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/)) |
| Voyager 1 and 2 (1977 onward) | Still operating; instruments switched off one by one as power fades | RTG output declines each year | Success; planned shutdown order | Pre-agreed graceful degradation ([The Register, 2025](https://www.theregister.com/2025/03/06/voyager_power_down/)) |

**Our analysis.** Three patterns repeat:

- **Losses in critical events (landing, burns, orbit insertion) often leave no data.** Mars Observer and CONTOUR both taught "keep telemetry on."
- **Most root causes are process escapes, not exotic physics:** units, a wiring error in a test, an inverted sensor, an unverified parameter.
- **Recoveries come from margin plus people:** Galileo, Kepler, and Voyager all survived because teams had options left.

## Real on-orbit and programmatic events

| Category | Real example | Numbers | Source |
| --- | --- | --- | --- |
| Solar storm, drag | February 2022: 49 Starlink satellites launched into low orbit hit by a geomagnetic storm | SpaceX said up to 40 would reenter; a NOAA-linked study counted 38 lost | [Space.com](https://www.space.com/spacex-starlink-satellites-lost-geomagnetic-storm); [CIRES](https://cires.colorado.edu/news/minor-geomagnetic-storm-big-impact-february-2022-starlink-satellite-loss) |
| Micrometeoroid | JWST segment C3, May 22–24, 2022 | Segment wavefront error rose from 56 to 258 nm rms; corrected to 178 nm rms; larger than prelaunch expectations | [JWST commissioning report, arXiv:2207.05632](https://arxiv.org/abs/2207.05632) |
| Electronics failure or upset | Voyager 1, November 2023 | One failed memory chip (about 3% of flight data computer memory) garbled data; engineering data restored April 20, 2024 by moving code | [Live Science](https://www.livescience.com/space/space-exploration/nasa-engineers-discover-why-voyager-1-is-sending-a-stream-of-gibberish-from-outside-our-solar-system) |
| Component degradation | Kepler wheels; Voyager RTGs | 2 of 4 wheels lost; Voyager instruments switched off in 2025 | [NASA ExEP](https://exoplanets.nasa.gov/exep/newsletters/issue14/k2update/); [The Register](https://www.theregister.com/2025/03/06/voyager_power_down/) |
| Debris avoidance (crewed) | ISS, November 19, 2024 | 39th debris avoidance maneuver since 1998; 32 as of December 2022 | [Live Science](https://www.livescience.com/space/space-exploration/iss-dodges-its-39th-piece-of-potentially-hazardous-space-junk-experts-say-it-wont-be-the-last); [Space.com](https://www.space.com/international-space-station-space-dodge-debris-how-often) |
| Debris avoidance (constellation) | Starlink FCC reports | 148,696 maneuvers June–November 2025; 207,152 December 2025–May 2026 | [Space.com](https://space.com/space-exploration/satellites/every-spacex-starlink-satellite-has-to-dodge-a-collision-almost-weekly-and-experts-fear-the-worst) (*unverified* exact counts from secondary coverage) |
| Ground station outage | DSS-43, Canberra, 2020 | The only dish able to command Voyager 2 was offline for upgrades from March 2020; Voyager 2 could still be heard but not commanded | [JPL, 2020](https://www.jpl.nasa.gov/news/nasa-contacts-voyager-2-using-upgraded-deep-space-network-dish/) |
| Launch delay (software) | Psyche, 2022 | Guidance flight software delivered 8 months late; 2022 window missed; review blamed JPL staffing strain | [AIP FYI, 2022](https://www.aip.org/fyi/2022/psyche-delay-compels-jpl-reckon-overstretched-staff); [SpaceNews](https://spacenews.com/?p=133825) |
| Budget cut | FY2026 President's request | Proposed a 47% cut to NASA science and cancellation of over 40 missions; Congress enacted $7.25B for science in January 2026 | [Eos](https://eos.org/research-and-developments/science-escapes-largest-cuts-in-latest-budget-bills); [Planetary Society](https://www.planetary.org/articles/advocacy-success-fy2026-nasa-budget) |
| Workforce loss | NASA, 2025 | About 4,000 civil servants (nearly 22%) left; 25 of 36 major projects reported effects | [GAO-26-108556](https://www.gao.gov/products/gao-26-108556) |
| Supplier fraud | OCO and Glory | Over $700M in losses | [SpaceNews](https://spacenews.com/?p=88281) |

## Team, organizational, and human factors

### Roles on a mission team

| Role | Responsibility | Typical tension | Game role (COL-02) |
| --- | --- | --- | --- |
| Principal Investigator (PI) | Owns the science and, for competed missions, the whole mission within the cost cap | Wants maximum science | Science lead |
| Project Manager (PM) | Cost, schedule, contracts, reserves | Protects reserves and dates | Mission manager |
| Project Scientist | Represents science inside the project | Balances PI goals against engineering limits | Science lead (helper) |
| Project Systems Engineer | Requirements, interfaces, margins | Says no to mass and power growth | Spacecraft designer |
| Subsystem leads (power, comms, ADCS, etc.) | Design each subsystem | Each wants margin | Spacecraft designer, comms officer |
| Safety and Mission Assurance | Parts, quality, test independence | Adds cost and time | Could be a shared "reviewer" mechanic |
| Mission Operations | Plans and flies the spacecraft | Wants simple, robust operations | Operations or comms officer |

The baseline/threshold structure in competed missions forces the science and engineering sides to negotiate what can be dropped before any problem appears ([NASA PI Launchpad](https://science.nasa.gov/wp-content/uploads/2023/04/PILaunchpad_GertsenIntro.pdf)). A descope plan lists items that can be removed without falling below minimum acceptable science (same source).

### Organizational lessons

| Lesson | Evidence | Source |
| --- | --- | --- |
| Organizational causes, not just hardware | The Columbia board found both Challenger and Columbia were lost partly because of NASA's organizational system, with causes "rooted in the Space Shuttle Program's history and culture" | [CAIB summary, NASA SP-2006-4702](https://www.theblackvault.com/documents/space/nasa/sp-2006-4702-Section5.pdf); [AIChE case history](https://www.aiche.org/sites/default/files/docs/embedded-pdf/Columbia_Case_History.pdf) |
| Normalization of deviance | Foam strikes became seen as routine before Columbia | Same |
| Staffing strain | Psyche's review linked its problems to JPL having its broadest and most demanding workload ever | [AIP FYI, 2022](https://www.aip.org/fyi/2022/psyche-delay-compels-jpl-reckon-overstretched-staff) |
| Faster, better, cheaper limits | Genesis board blamed shortcuts of that era | [Universe Today](https://www.universetoday.com/73/genesis-accident-report-released/) |
| Learning curve | Repeat CubeSat builders do better than first-timers | [The Space Review](https://thespacereview.com/article/3047/1) |

### Export control and international partnerships

| Topic | Fact | Source |
| --- | --- | --- |
| ITAR to EAR reform | 2014 rules moved most commercial spacecraft and parts from the State Department's USML Category XV to the Commerce Control List (ECCN 9A515); military-function spacecraft, sophisticated sensors, and most crewed spacecraft stayed under ITAR | [Federal Register, May 13, 2014](https://www.govinfo.gov/content/pkg/FR-2014-05-13/html/2014-10807.htm) |
| JWST partnership | ESA funded and managed NIRSpec, contributed about half of MIRI through member states, and provided the Ariane 5 launch; European scientists get at least 15% of observing time | [ESA Webb factsheet](https://www.esa.int/Science_Exploration/Space_Science/Webb/Webb_factsheet); [ESA, Europe's role](https://esa.int/Science_Exploration/Space_Science/Webb/Europe_s_role_in_Webb) |
| Mars Sample Return | Both 2024 NASA options depended on ESA's Earth Return Orbiter | [Space.com, 2024](https://www.space.com/nasa-revamp-mars-sample-return-plan) |
| Student missions | CSLI selects CubeSats from schools and nonprofits; builders fund their own hardware | [NASA, 2024](https://www.nasa.gov/news-release/nasa-seeks-student-missions-to-send-to-space-in-2026-beyond/) |

**Our analysis.** International partnership reduces each agency's cost but adds interfaces and dependency risk: one partner's budget cut can stall the whole mission. That makes a good multiplayer mechanic (COL-03).

## How NASA judges value

| Mechanism | What it measures | Source |
| --- | --- | --- |
| Baseline science mission | Full objectives if fully implemented | [NASA PI Launchpad](https://science.nasa.gov/wp-content/uploads/2023/04/PILaunchpad_GertsenIntro.pdf) |
| Threshold science mission | Minimum acceptable science; below this the mission is a failure for its sponsor | Same |
| Senior Review | Extended missions compete for continued funding every two to three years on scientific merit and feasibility; astrophysics and planetary in even years, Earth science and heliophysics in odd years | [NASA OIG IG-15-001](https://oig.nasa.gov/docs/IG-15-001.pdf); [NASEM 2016](https://www.nationalacademies.org/read/23624/chapter/2) |
| Heliophysics criteria (2023) | Lettered criteria and factors including science merit, technical status, and budget requests over or under the guideline | [2023 Heliophysics Senior Review](https://science.nasa.gov/wp-content/uploads/2023/09/final-2023-senior-review-report-tagged.pdf) |
| Extension funding | The OIG found 10 of 22 projects (45%) received more funding after moving into extended operations | [NASA OIG IG-15-001](https://oig.nasa.gov/docs/IG-15-001.pdf) |
| Cost performance | GAO tracks overruns against the 15% reporting threshold | [GAO-25-107591](https://www.gao.gov/products/gao-25-107591) |

**Our analysis.** NASA does not use a single "science per dollar" formula. Value combines meeting baseline or threshold requirements, science quality judged by peers, and cost discipline. A game score can mirror this with separate bars for science achieved against baseline and threshold, budget used, and schedule.

## Key numbers for the game

| Parameter | Real value | Source | Suggested game use |
| --- | --- | --- | --- |
| Payload + spacecraft share of development | About 2/3 | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf); [Kha 2021](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf) | Hardware cards sum to about 65% of budget |
| PM/SE/mission assurance "wrap" | 11–15% | Same | Automatic overhead |
| Operations share (small Earth mission) | About 10% | [Saing 2020](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf) | Per-year ops cost |
| Launch share | About 4% (flagship) to 21% (small) | Landsat 9, Europa Clipper, SMEX example above | Launch is a big decision for small missions |
| Cost reserve at start | 25–30% (50% for decadal concepts) | [Gavin 2009](https://www.slideshare.net/slideshow/gavintom/13669302); [Kha 2021](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf) | Default reserve slider |
| Schedule margin | About 1–2 months per year | [Gavin 2009](https://www.slideshare.net/slideshow/gavintom/13669302); [Bitten 2008](https://newfrontiers.larc.nasa.gov/NF3/PDF_FILES/ConceptualDesignOptimismSSCAG_SCAF_EACEMay2008.pdf) | Time buffer |
| JCL at commitment | 70% | [NID 7120.122](https://nodis3.gsfc.nasa.gov/OPD_Docs/NID_7120_122_.pdf) | "Confidence meter" |
| Average cost growth | 27% (40 missions); 23–77% across studies | [NRC 2010](https://www.nationalacademies.org/read/12946/chapter/3) | Hidden growth roll |
| Growth after CDR | About 75% of total growth | Same | Late surprises |
| Cost growth per schedule growth | About 12% cost per 10% schedule | [Bitten 2008](https://newfrontiers.larc.nasa.gov/NF3/PDF_FILES/ConceptualDesignOptimismSSCAG_SCAF_EACEMay2008.pdf) (*unverified*) | Delay costs money |
| Mass margin at concept | Over 15% | [GSFC-STD-1000 Rev I](https://standards.nasa.gov/system/files/tmp/GSFC-STD-1000RevI_Approved_0.pdf) | Margin warning threshold |
| Power margin at concept | Over 25% | Same | Margin warning threshold |
| Link margin | 3 dB | Same | Comms warning |
| Risk class lifetimes | A over 5 yr; B 3–5; C 1–3; D under 1 | [NPR 8705.4B](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf) | Class selection |
| Rocket reliability categories | 89% (Cat 2), 95% (Cat 3) | [NASA LSP](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf) | Launch success roll |
| Maiden flight failure | About 45% | [Seradata](https://www.seradata.com/maiden-flights-are-becoming-more-reliable-2/) (*unverified*) | Cheap new rocket option |
| CubeSat dead on arrival | 18% (2014 data); nearly 30% for university smallsats reaching orbit | [The Space Review](https://thespacereview.com/article/3047/1) | Infant mortality roll |
| First-time team success | About 50% | [Smithsonian](https://www.smithsonianmag.com/air-space-magazine/cubesats-are-great-even-if-they-die-you-180952745/) | Experience modifier |
| SMEX cap | $190M (FY26$) | [APSMEX26](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/APSMEX26%20Evaluation%20Plan.pdf) | Mid-size budget tier |
| Pioneers / SIMPLEx caps | $20M / $55M | [SpaceNews](https://spacenews.com/?p=109994); [Spaceflight Now](https://spaceflightnow.com/2019/08/05/nasas-first-interplanetary-smallsats-may-struggle-to-stay-under-cost-caps/) | Small budget tiers |
| Discovery / New Frontiers caps | About $500M / $900M | [Planetary Society](https://www.planetary.org/articles/what-are-competed-planetary-missions) | Large budget tiers |
| Flagship | $5B (Europa Clipper) to $9.7B (JWST) | Above | "Boss level" scenario |

## Event card ideas from real missions

| Event | Real example | Effect in game | Possible player response |
| --- | --- | --- | --- |
| Geomagnetic storm | Starlink, February 2022 ([Space.com](https://www.space.com/spacex-starlink-satellites-lost-geomagnetic-storm)) | Low orbits lose altitude; risk of reentry | Raise orbit (spend propellant); safe mode; accept loss |
| Micrometeoroid hit | JWST C3 ([arXiv](https://arxiv.org/abs/2207.05632)) | Instrument performance drops by a percentage | Recalibrate (time cost); accept lower science |
| Memory chip failure / upset | Voyager 1, 2023 ([Live Science](https://www.livescience.com/space/space-exploration/nasa-engineers-discover-why-voyager-1-is-sending-a-stream-of-gibberish-from-outside-our-solar-system)) | Data stream garbled for several turns | Spend ops budget on a software patch; redundant computer avoids it |
| Reaction wheel failure | Kepler ([NASA ExEP](https://exoplanets.nasa.gov/exep/newsletters/issue14/k2update/)) | Pointing degraded | Switch to spare wheel; invent a new mode (K2-style) with reduced science |
| Antenna will not deploy | Galileo ([NASA APPEL](https://appel.nasa.gov/2011/05/13/galileos-rocky-road-to-jupiter/)) | Downlink rate cut sharply | Compress data, buy more ground station time, prioritize targets |
| Power decline | Voyager RTGs ([The Register](https://www.theregister.com/2025/03/06/voyager_power_down/)) | Available power falls each year | Switch off instruments in a pre-planned order |
| Dust or shadowing | Opportunity, 2018 ([JPL](https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/)) | Solar output collapses | Hibernate; battery margin decides survival |
| Debris conjunction | ISS 39th maneuver ([Live Science](https://www.livescience.com/space/space-exploration/iss-dodges-its-39th-piece-of-potentially-hazardous-space-junk-experts-say-it-wont-be-the-last)) | Collision probability warning | Maneuver (propellant cost) or accept small risk |
| Ground station offline | DSS-43, 2020 ([JPL](https://www.jpl.nasa.gov/news/nasa-contacts-voyager-2-using-upgraded-deep-space-network-dish/)) | No commanding for several turns | Onboard autonomy and data storage carry the mission |
| Software late | Psyche, 2022 ([AIP](https://www.aip.org/fyi/2022/psyche-delay-compels-jpl-reckon-overstretched-staff)) | Launch window missed unless schedule margin covers it | Spend schedule margin; pay for extra staff; slip a year |
| Budget cut | FY2026 request ([Eos](https://eos.org/research-and-developments/science-escapes-largest-cuts-in-latest-budget-bills)) | Budget reduced mid-development | Descope to threshold mission; use reserves |
| Partner withdraws | MSR dependence on ESA ([Space.com](https://www.space.com/nasa-revamp-mars-sample-return-plan)) | Contributed element missing | Pay to replace it or drop that objective |
| Supplier defect | Taurus XL fairing ([SpaceNews](https://spacenews.com/?p=88281)) | Launch failure chance raised for one vehicle | Pay for extra inspection; switch rockets |
| Units mismatch | Mars Climate Orbiter ([LLIS](https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf)) | Navigation error, triggered only if "interface review" was skipped | Fund systems engineering reviews |
| Test escape | Mars Polar Lander, Genesis | Hidden flaw activates in a critical event | Choose "test as you fly" (costs time) |
| Maiden-flight rocket | New vehicles ([Seradata](https://www.seradata.com/maiden-flights-are-becoming-more-reliable-2/)) | Cheap launch with high failure chance | Accept for Class D; avoid for Class A |
| Mission outlives plan | Ingenuity, Opportunity | Bonus science years if margins remain | Request extension (Senior Review) |

## Game implications

**Our analysis.** These map the findings to mechanics and the feature IDs in [challenge brief](../../challenge-brief.md).

| Feature ID | Mechanic suggested by the evidence |
| --- | --- |
| RES-03 Budget | Split budget into hardware (about 65%), overhead wrap (about 12–15%), launch, reserves (default 25–30%), and per-year operations. Apply a hidden cost-growth roll centered near 27%, weighted toward the post-CDR phase and toward immature parts. Show the JCL-style confidence meter. |
| RES-06 Time | Development schedule with margin of 1–2 months per year; each 10% slip adds about 12% cost. Launch windows (planetary) make slips costly. Phase E length drives operations cost. |
| EXT-01 Mission success and science | Score against baseline and threshold science. Below threshold counts as failure even if the spacecraft works. Extended-mission bonus via a Senior Review event. |
| EXT-02 Resource efficiency | Reward finishing with reserves and margins intact. Use GSFC margin thresholds as yellow and red warnings. Avoid pure cost-per-kg scoring. |
| EXT-05 Random events | Use the event table above. Weight probabilities by risk class, part quality, testing, and orbit. Label probabilities as gameplay values, since NASA publishes no per-class success odds. |
| EXT-10 Mission reports | Generate a mishap-board-style debrief: what happened, root cause, which trade-off or process failed, lesson, with a real-mission parallel (for example "your skipped interface review is how Mars Climate Orbiter was lost"). |
| EDU-05 Explain why | Tie each failure to a choice: no telemetry in a critical burn (Mars Observer, CONTOUR); skipped retest (Mars Polar Lander); single sensor trusted (Hitomi). |
| EDU-06 Post-mission analysis | Show the cost–schedule–risk triangle at the end: what the player bought down and what they left open. |
| COL-02 Roles | PI/science lead, project manager, systems engineer/spacecraft designer, operations/comms officer, matching real mission roles. |
| COL-03 Negotiation | Baseline vs threshold descope decisions require agreement; the PM controls reserves, and the science lead controls objectives. Partner contributions reduce cost but add dependency events. |
| COL-04 Reward coordination | Bonus when the team pre-agrees a descope order (Voyager-style) or holds a review before launch, since real recoveries came from prepared teams. |

Additional design notes:

- **Risk class as a master dial.** Choosing Class A to D should set default part quality, test depth, allowed rockets, and failure odds together. This teaches the real NASA logic in one choice.
- **Experience modifier.** The first-flight versus repeat-builder statistics support a mechanic where replaying a scenario lowers failure odds slightly. This reinforces EDU-07 (revise and resimulate).
- **Keep the numbers honest.** Display real anchor numbers (caps, growth rates, success rates) in tooltips with sources, and label invented gameplay values as such.

## Sources

Primary NASA, GAO, and directive sources:

- [GAO-26-108556, NASA: Assessments of Major Projects (2026)](https://www.gao.gov/products/gao-26-108556)
- [GAO-25-107591, NASA: Assessments of Major Projects (2025)](https://www.gao.gov/products/gao-25-107591)
- [GAO-21-406, James Webb Space Telescope](https://www.gao.gov/products/GAO-21-406)
- [NPR 8705.4B, Risk Classification for NASA Payloads (2024)](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf)
- [NPR 8705.4A (2021)](https://essp.larc.nasa.gov/EVI-6/pdf_files/NPR_8705_4A.pdf)
- [NASA OSMA, NPR 8705.4B release notice](https://sma.nasa.gov/news/articles/newsitem/2024/12/02/npr-8705-4b-risk-classification-for-nasa-payloads-formally-released-agencywide)
- [NPR 8000.4C, Agency Risk Management](https://soma.larc.nasa.gov/STP/DYNAMIC/pdf_files/NPR%208000.4C%20AgencyRiskMngmt.pdf)
- [NASA IV&V S3001 risk management guideline](https://www.nasa.gov/wp-content/uploads/2015/10/s3001_guidelines_for_risk_management_-_ver_g_-_10-25-2017.pdf)
- [NASA risk management webinar, 2024](https://appel.nasa.gov/wp-content/uploads/2024/10/Quick-Webinar-Risk-Management-October-2024.pdf)
- [NPR 7120.5F](https://explorers.larc.nasa.gov/2023ESE/pdf_files/NASA01.%20NPR%207120.5F%20NASA%20Space%20Flight%20Program%20and%20Project%20Management%20Requirements.pdf)
- [NID 7120.122, JCL at KDP-B](https://nodis3.gsfc.nasa.gov/OPD_Docs/NID_7120_122_.pdf)
- [NPR 7120.5E briefing, GSFC 2011](https://webarchive.library.unt.edu/web/20130213220144/http:/fpd.gsfc.nasa.gov/NPR71205/01-NPR_7120_Rev_E_Briefing_Nov-10-11_GSFC_Nov%2018.pdf)
- [NASA JCL FAQ](https://www.nasa.gov/pdf/394931main_JCL_FAQ_10_12_09.pdf)
- [NASA WBS Handbook](https://www.nasa.gov/wp-content/uploads/2023/08/nasa-work-breakdown-structure-handbook.pdf)
- [GSFC-STD-1000 Rev I, GOLD Rules](https://standards.nasa.gov/system/files/tmp/GSFC-STD-1000RevI_Approved_0.pdf)
- [NASA Launch Services Risk Classification Fact Sheet](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf)
- [NASA OIG IG-12-021](https://oig.nasa.gov/docs/IG-12-021.pdf)
- [NASA OIG IG-15-001, Senior Review](https://oig.nasa.gov/docs/IG-15-001.pdf)
- [2023 Heliophysics Senior Review report](https://science.nasa.gov/wp-content/uploads/2023/09/final-2023-senior-review-report-tagged.pdf)
- [NASA PI Launchpad, AO overview](https://science.nasa.gov/wp-content/uploads/2023/04/PILaunchpad_GertsenIntro.pdf)
- [NASA PCOS, 2025 SMEX AO notice](https://pcos.gsfc.nasa.gov/news/2024/91_2025_Astrophysics_Small_Explorer_AO.php)
- [APSMEX26 Evaluation Plan](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/APSMEX26%20Evaluation%20Plan.pdf)
- [NASA, CSLI call for 2026](https://www.nasa.gov/news-release/nasa-seeks-student-missions-to-send-to-space-in-2026-beyond/)
- [NASA, Landsat 9 launch contract](https://www.nasa.gov/press-release/nasa-awards-launch-services-contract-for-landsat-9-mission)
- [NASA Landsat, GAO assessment summary](https://landsat.gsfc.nasa.gov/article/landsat-9-project-on-track-u-s-general-accounting-office-assesses)
- [NASA Science, Landsat 9](https://science.nasa.gov/mission/landsat-9)
- [CRS R46560, Landsat 9](https://www.everycrsreport.com/reports/R46560.html)
- [NASA JWST IRB report and response (2018)](https://www.nasa.gov/wp-content/uploads/2015/01/webb_irb_report_and_response_0.pdf)
- [NASA Lessons Learned Information System](https://llis.nasa.gov/)

Cost estimating and cost growth:

- [Saing, JPL, NASA and Smallsat Cost Estimation Overview (2020)](https://www.nasa.gov/wp-content/uploads/2020/05/saing_nasa_and_smallsat_cost_estimation_overview_and_model_tools_s3vi_webinar_series_10_jun_2020.pdf)
- [Kha, JHU APL, Interstellar Probe cost (2021)](https://interstellarprobe.jhuapl.edu/uploadedDocs/presentations/630-5.2%20-%20Kha_Interstellar_Probe_Workshop_Cost%20Draft4.pdf)
- [PCEC v2.4, NASA Cost Symposium 2024](https://www.nasa.gov/wp-content/uploads/2024/05/59-pcec-nasa-cost-symposium-2024-final-e.pdf)
- [NRC 2010, Controlling Cost Growth, ch. 3](https://www.nationalacademies.org/read/12946/chapter/3) and [ch. 6](https://nap.nationalacademies.org/read/12946/chapter/8)
- [NASA APPEL summary of NRC study](https://appel.nasa.gov/?p=240679)
- [Bitten et al., Aerospace Corp., Conceptual Design Optimism (2008)](https://newfrontiers.larc.nasa.gov/NF3/PDF_FILES/ConceptualDesignOptimismSSCAG_SCAF_EACEMay2008.pdf)
- [Gavin, JPL Design and Flight Project Practices (2009)](https://www.slideshare.net/slideshow/gavintom/13669302)
- [Team X summary, NTRS](https://ntrs.nasa.gov/citations/20190025644)

Failure statistics and launch data:

- [The Space Review, CubeSats: faster and cheaper, but better? (2016)](https://thespacereview.com/article/3047/1)
- [Langer and Bouwmeester, Reliability of CubeSats, SmallSat 2016](https://digitalcommons.usu.edu/smallsat/2016/TS10AdvTech2/4)
- [Swartwout, CubeSats and Mission Success, NEPP 2017](https://nepp.nasa.gov/docs/etw/2017/28-JUN-WED/0900%20-%20swartwout%20etw%202017.pdf)
- [Smithsonian Air & Space, CubeSats are great even if they die](https://www.smithsonianmag.com/air-space-magazine/cubesats-are-great-even-if-they-die-you-180952745/)
- [Cross and Vesely, NASA, new launch vehicle failure probability (2018)](https://ntrs.nasa.gov/api/citations/20180006947/downloads/20180006947.pdf)
- [The Space Review, launch vehicle first-flight failures](https://thespacereview.com/article/616/1)
- [Seradata, maiden flights](https://www.seradata.com/maiden-flights-are-becoming-more-reliable-2/)
- [Via Satellite, BryceTech 2025 launches](https://www.satellitetoday.com/launch/2026/04/10/brycetech-report-shows-spacex-accounted-for-50-of-launches-in-2025)
- [Jonathan's Space Pages, launch statistics](https://planet4589.org/stats/launches.html)
- [KeepTrack launch history](https://keeptrack.space/launches)

Case studies and events:

- [Mars Climate Orbiter MIB Phase I report](https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf)
- [MPIAT testimony (Mars Polar Lander)](https://spaceref.com/?p=28393); [AmericaSpace, 2019](https://www.americaspace.com/2019/01/06/could-not-have-survived-20-years-since-nasas-ill-fated-mars-polar-lander/)
- [AIP FYI, Mars Observer final report (1994)](https://ww2.aip.org/fyi/1994/final-report-issued-mars-observer-loss)
- [CONTOUR MIB report](https://discovery.larc.nasa.gov/PDF_FILES/Contour_Mishap_Investigation.pdf); [Spaceflight Now](https://spaceflightnow.com/news/n0310/15contour/)
- [Universe Today, Genesis report](https://www.universetoday.com/73/genesis-accident-report-released/)
- [NASA, Hubble's mirror flaw](https://www.nasa.gov/content/hubbles-mirror-flaw); [Allen Report](https://research.ssl.berkeley.edu/%7Emlampton/AllenReportHST.pdf)
- [NASA APPEL, Galileo's rocky road to Jupiter](https://appel.nasa.gov/2011/05/13/galileos-rocky-road-to-jupiter/)
- [SpaceNews, Taurus XL aluminum fraud](https://spacenews.com/?p=88281); [Popular Science](https://www.popsci.com/nasa-aluminum-fraud/)
- [Scientific American, Hitomi](https://www.scientificamerican.com/blog/guest-blog/what-killed-japan-s-hitomi-x-ray-satellite/); [The Register, Hitomi](https://www.theregister.co.uk/2016/06/01/jaxas_litany_of_errors_spun_hitomi_to_pieces/)
- [Spaceflight Now, Schiaparelli inquiry (2017)](https://spaceflightnow.com/2017/05/24/probe-into-crash-of-esa-mars-lander-recommends-more-checks-on-exomars-descent-craft/)
- [Planetary Society, Beresheet](https://www.planetary.org/articles/software-command-doomed-beresheet); [Times of Israel](https://www.timesofisrael.com/5-6-attempts-to-restart-israeli-moon-landers-engine-failed-investigation-finds/)
- [Space.com, Phobos-Grunt](https://www.space.com/14539-russian-mars-probe-failure-investigation-computer-crash.html)
- [Spaceflight Now, Lunar Flashlight (2023)](https://spaceflightnow.com/2023/05/16/nasas-lunar-flashlight-cubesat-mission-ends-before-entering-orbit-around-moon/)
- [SIMPLEx program summary](https://en.wikipedia.org/wiki/Small_Innovative_Missions_for_Planetary_Exploration); [Spaceflight Now, SIMPLEx caps (2019)](https://spaceflightnow.com/2019/08/05/nasas-first-interplanetary-smallsats-may-struggle-to-stay-under-cost-caps/)
- [NASA ExEP, K2 update (2014)](https://exoplanets.nasa.gov/exep/newsletters/issue14/k2update/)
- [NASASpaceflight, Ingenuity final flight](https://nasaspaceflight.com/2024/01/ingenuity-final-flight)
- [JPL, Opportunity mission end](https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/)
- [The Register, Voyager power down (2025)](https://www.theregister.com/2025/03/06/voyager_power_down/)
- [Live Science, Voyager 1 memory chip](https://www.livescience.com/space/space-exploration/nasa-engineers-discover-why-voyager-1-is-sending-a-stream-of-gibberish-from-outside-our-solar-system)
- [JPL, DSS-43 and Voyager 2 (2020)](https://www.jpl.nasa.gov/news/nasa-contacts-voyager-2-using-upgraded-deep-space-network-dish/)
- [Space.com, Starlink storm loss](https://www.space.com/spacex-starlink-satellites-lost-geomagnetic-storm); [CIRES](https://cires.colorado.edu/news/minor-geomagnetic-storm-big-impact-february-2022-starlink-satellite-loss)
- [JWST science performance from commissioning, arXiv:2207.05632](https://arxiv.org/abs/2207.05632)
- [Live Science, ISS 39th debris maneuver](https://www.livescience.com/space/space-exploration/iss-dodges-its-39th-piece-of-potentially-hazardous-space-junk-experts-say-it-wont-be-the-last); [Space.com, ISS dodging frequency](https://www.space.com/international-space-station-space-dodge-debris-how-often)
- [Space.com, Starlink collision avoidance](https://space.com/space-exploration/satellites/every-spacex-starlink-satellite-has-to-dodge-a-collision-almost-weekly-and-experts-fear-the-worst)
- [AIP FYI, Psyche delay and JPL staffing (2022)](https://www.aip.org/fyi/2022/psyche-delay-compels-jpl-reckon-overstretched-staff); [SpaceNews, Psyche](https://spacenews.com/?p=133825); [Spaceflight Now, Psyche](https://spaceflightnow.com/2022/06/27/after-software-delays-nasa-gives-up-on-launching-psyche-asteroid-mission-this-year/); [The Register, Psyche cost](https://www.theregister.com/2023/06/07/nasa_asteroid_psyche_mission/); [Space.com, VERITAS delay](https://www.space.com/nasa-problems-psyche-venus-probe-veritas-launch-delay)

Programmatics, budgets, and partnerships:

- [SpacePolicyOnline, Europa Clipper cost growth and MSR replan (2022)](https://spacepolicyonline.com/news/nasa-reveals-europa-clipper-cost-growth-mars-sample-return-replan/)
- [SpaceNews, Europa Clipper launch contract](https://spacenews.com/?p=117075)
- [Payload, MSR Independent Review Board (2023)](https://payloadspace.com/independent-review-board-finds-mars-sample-return-unrealistic/)
- [Space.com, MSR overhaul (2024)](https://www.space.com/nasa-revamp-mars-sample-return-plan)
- [The Register, FY2026 science budget (2026)](https://www.theregister.com/2026/01/16/nasa_science_budget/)
- [Eos, FY2026 budget bills](https://eos.org/research-and-developments/science-escapes-largest-cuts-in-latest-budget-bills)
- [Planetary Society, FY2026 budget](https://www.planetary.org/articles/advocacy-success-fy2026-nasa-budget)
- [Planetary Society, competed planetary missions](https://www.planetary.org/articles/what-are-competed-planetary-missions)
- [SpaceNews, Astrophysics Pioneers (2021)](https://spacenews.com/?p=109994)
- [NewSpace Economy, rideshare pricing (2026)](https://newspaceeconomy.ca/?p=214492) and [Transporter history](https://newspaceeconomy.ca/2026/10/20/how-has-the-spacex-transporter-program-reshaped-satellite-earth-observation/)
- [ESA Webb factsheet](https://www.esa.int/Science_Exploration/Space_Science/Webb/Webb_factsheet); [ESA, Europe's role in Webb](https://esa.int/Science_Exploration/Space_Science/Webb/Europe_s_role_in_Webb)
- [Federal Register, satellite export control rule (2014)](https://www.govinfo.gov/content/pkg/FR-2014-05-13/html/2014-10807.htm)
- [NASA SP-2006-4702 section on Columbia](https://www.theblackvault.com/documents/space/nasa/sp-2006-4702-Section5.pdf); [AIChE Columbia case history](https://www.aiche.org/sites/default/files/docs/embedded-pdf/Columbia_Case_History.pdf)
- [NASEM 2016, Extending Science (Senior Review)](https://www.nationalacademies.org/read/23624/chapter/2)
- [Aerospace Corp., Mission Assurance Guidelines for Risk Classes and Do No Harm](https://aerospace.org/sites/default/files/2024-06/ATR-2023-01889%20-%20Mission%20Assurance%20Guidelines%20for%20Mission%20Risk%20Classes%20and%20Do%20No%20Harm%20%28DNH%29%20for%20Space%20Vehicles.pdf)
