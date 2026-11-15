# Mission Lifecycle: From Idea to End of Mission

This file explains how a NASA science mission moves from a scientific question to a decommissioned spacecraft. It covers where missions come from, the formal phases, reviews, and decision gates, how science goals become requirements, how hardware is built and tested, how missions are operated and extended, and how they end. It is written for the game team, so each section ends in facts we can turn into mechanics.

Researched November 14, 2026. Part of the mission-engineering reference set: [02-mission-design-orbits-launch.md](02-mission-design-orbits-launch.md) · [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md) · [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md) · [Official challenge](../../challenge-brief.md) · [Research and planning](../landscape-precedents-and-judging.md)

Quick navigation: [At a glance](#the-lifecycle-at-a-glance) · [Origins](#where-missions-come-from) · [Phases and gates](#the-nasa-project-life-cycle) · [Reviews](#life-cycle-reviews) · [Maturity](#concept-maturity-technology-readiness-and-concurrent-design) · [Requirements](#from-science-to-requirements) · [Build and test](#build-assembly-integration-and-test) · [Operations](#launch-early-operations-and-the-prime-mission) · [End of mission](#end-of-mission) · [Planetary protection](#planetary-protection) · [Worked timelines](#worked-timelines) · [CubeSats](#how-the-cubesat-lifecycle-differs) · [Key numbers](#key-numbers-for-the-game) · [Game implications](#game-implications) · [Sources](#sources)

**How to read this file.** Sections without a label report official rules or documented facts, each with an inline source. Sections marked **Analysis** are our interpretation for game design. Items marked *unverified* rest on a single or weak source. Dollar figures are in the fiscal-year dollars stated by the source; they are not inflation-adjusted to a common year.

**Document status.** The governing life cycle document is [NPR 7120.5F](https://nodis3.gsfc.nasa.gov/displayDir.cfm?t=NPR&c=7120&s=5F) (effective August 3, 2021, now with Change 4 and an expiration date of February 3, 2027). Its NODIS page says that the interim directive NID 7120.148 "contains the most recent requirements" and should be used. We could not open NID 7120.148 on NODIS, so the details below come from NPR 7120.5F. The systems engineering companion is [NPR 7123.1D](https://nodis3.gsfc.nasa.gov/displayDir.cfm?t=NPR&c=7123&s=1D) (effective July 5, 2023, with Change 2).

## The lifecycle at a glance

NASA splits every space flight project into two big parts. **Formulation** covers Pre-Phase A, Phase A, and Phase B. **Implementation** covers Phases C, D, E, and F ([NASA SE Handbook, Section 3.0](https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/); [NPR 7120.5F, Chapter 2](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)).

| Part | Phase | Name | Purpose in one line | Gate that ends it |
| --- | --- | --- | --- | --- |
| Pre-formulation | Pre-Phase A | Concept Studies | Generate mission ideas and judge if any are feasible. | MCR, then KDP A |
| Formulation | A | Concept and Technology Development | Confirm the concept is feasible and desirable; baseline top-level requirements. | SRR, MDR/SDR, then KDP B |
| Formulation | B | Preliminary Design and Technology Completion | Finish technology development; reach a baselined preliminary design. | PDR, then KDP C |
| Implementation | C | Final Design and Fabrication | Complete detailed design, build hardware, write software. | CDR, SIR, then KDP D |
| Implementation | D | System Assembly, Integration and Test, Launch and Checkout | Integrate, verify, launch, and check out the system. | ORR, FRR/MRR, launch, PLAR, then KDP E |
| Implementation | E | Operations and Sustainment | Conduct the prime mission (and any extensions). | DR, then KDP F |
| Implementation | F | Closeout | Decommission, dispose, archive data, capture lessons learned. | DRR, disposal event |

Source for purposes and gates: [SE Handbook 3.0](https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/) and [NPR 7120.5F Table 2-5](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2).

One rule matters for a game timeline. Each phase transition happens right after its KDP is approved, except the move from Phase D to E. That transition happens only after on-orbit checkout and initial operations ([NPR 7120.5F, 2.2.7 and 2.3.5](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)). Launch is inside Phase D, not the start of Phase E.

The webinar in our resource list uses a simpler spine: Identify Need and Goals, Define Concept, Define Requirements, Design, Build and Verify, Implement ([local copy](../../reference-pdfs/nasa-design-and-develop-science-missions-2025.pdf); summarized in [challenge brief](../../challenge-brief.md#mission-engineering-references)). It maps onto the formal phases as Pre-Phase A, Phase A, Phases A to B, Phases B to C, Phases C to D, and Phase E.

## Where missions come from

### Strategy: decadal surveys and agency plans

NASA's science priorities come from a requirements chain. At the top are NASA strategic goals in the NASA Strategic Plan. Below them sit Mission Directorate requirements, then program requirements, project requirements, and system requirements ([NPR 7120.5F, Table 1-1](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter1)).

The science community's input arrives mainly through **decadal surveys** from the National Academies. Each one ranks science questions and mission concepts for a ten-year period. For example, the 2022 planetary decadal survey, *Origins, Worlds, and Life*, ranked a Uranus Orbiter and Probe as the top new flagship. It estimated the cost at $4.2 billion (FY2025 dollars) ([National Academies news release](https://www.nationalacademies.org/news/2022/04/report-identifies-priority-planetary-science-missions-planetary-defense-efforts-and-strategic-investments-for-the-next-decade); [AIP FYI summary](https://ww2.aip.org/fyi/2022/2022-planetary-science-decadal-survey-recommendations-major-missions)). The same survey recommended raising the New Frontiers cap to $1.65 billion and the Discovery cap to $800 million, both on a life-cycle basis excluding launch ([AIP FYI](https://ww2.aip.org/fyi/2022/2022-planetary-science-decadal-survey-recommendations-major-missions); [Planetary Society](https://planetary.org/articles/the-2022-planetary-decadal-released)). Those are recommendations, not current caps.

### Directed versus competed missions

NPR 7120.5F says projects are either assigned directly to a NASA Center by the Mission Directorate, or selected through a competition such as an Announcement of Opportunity (AO) ([NPR 7120.5F, 2.1.3.2](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)).

| Type | Who defines the mission | Who leads | Typical size | Examples |
| --- | --- | --- | --- | --- |
| Directed (strategic) | NASA Headquarters, guided by the decadal survey | A NASA Center or JPL | Large; flagships and some Earth missions | Europa Clipper, JWST, PACE |
| Competed (PI-led) | A Principal Investigator (PI) proposes it in response to an AO | The PI's team, under a cost cap | Small to medium | Discovery, New Frontiers, Explorers, Earth Venture |

PACE illustrates a hybrid. NASA describes it as "Systematic, Directed, and Cost-Capped": Headquarters directed it to Goddard in December 2014, set threshold requirements and a budget cap, and the project used a Design-to-Cost process ([PACE mission overview, NTRS](https://ntrs.nasa.gov/citations/20240011592)).

### The two-step AO competition

NASA's Science Mission Directorate (SMD) uses a standard AO template. It describes a two-step competitive process: select some Step 1 proposals for Phase A concept studies, then down-select one or more for flight ([SMD Standard AO template](https://soma.larc.nasa.gov/StandardAO/pdf_files/StandardAOTemplate181023f.pdf)).

| Step | What happens | Output | Notes |
| --- | --- | --- | --- |
| AO release | NASA publishes science goals, cost cap, rules. | Solicitation on NSPIRES | Draft AOs often come first for comment. |
| Step 1 proposal | PI team submits a full mission proposal. | Proposal with STM, design, cost, schedule | Evaluated on Science Merit (Form A), Science Implementation Merit (Form B), and Technical, Management, and Cost (TMC) Feasibility (Form C) ([Zurbuchen 2019](https://science.nasa.gov/wp-content/uploads/2023/05/06_05_2019_Zurbuchen_WritingSuccessfulProposals_FINAL.pdf)). |
| Step 1 selection | NASA funds a few teams for concept studies. | Phase A contracts | More than 80% of submitted mission proposals fail at Step 1 ([Zurbuchen 2019](https://science.nasa.gov/wp-content/uploads/2023/05/06_05_2019_Zurbuchen_WritingSuccessfulProposals_FINAL.pdf)). |
| Concept study (Phase A) | Teams mature the design and cost. | Concept Study Report (CSR) | The 2025 Astrophysics SMEX planned "nine-month, $3.0M/each Phase A concept studies", with down-selection targeted for fall 2027 ([2025 SMEX AO page](https://science.nasa.gov/astrophysics/programs/physics-of-the-cosmos/community/2025-astrophysics-small-explorer-announcement-of-opportunity)). |
| Step 2 down-select | NASA evaluates CSRs and picks winners. | Selection for Phase B | Not every AO has a Step 2; Earth Venture Instrument is one exception ([Zurbuchen 2019](https://science.nasa.gov/wp-content/uploads/2023/05/06_05_2019_Zurbuchen_WritingSuccessfulProposals_FINAL.pdf)). |

Competition is stiff. SMD data on 394 Step 1 proposals from 1996 to 2017 show an overall selection rate of 17%. Low-cost AOs selected 17%, medium-cost 16%, and high-cost 28% ([Zurbuchen 2019, slide 27](https://science.nasa.gov/wp-content/uploads/2023/05/06_05_2019_Zurbuchen_WritingSuccessfulProposals_FINAL.pdf)). PIs came from universities (48%), NASA Centers and JPL (32%), non-profits (14%), for-profits (3%), and other agencies (3%) (same source).

One NASA page says the next Astrophysics SMEX AO will not include competitive Phase A studies, so two-step selection is not universal (*unverified*, single search-result snippet from [NASA SARA solicitations page](https://science.nasa.gov/researchers/sara/grant-solicitations)).

### Mission lines and cost caps

Caps change with each AO. Always record the fiscal year and what the cap excludes.

| Program line | Division | Current or most recent cap | What the cap covers | Source |
| --- | --- | --- | --- | --- |
| Astrophysics Pioneers | Astrophysics | $20M | Excludes launch. SmallSats, balloons, ISS or lunar payloads. | [NASA Small Satellite Town Hall 2022](https://www.nasa.gov/wp-content/uploads/2022/08/04.brandt-nasa_small_satellite_town_hall_2022_tjb_0.pdf) |
| Small Explorer (SMEX), 2025 AO | Astrophysics | $170M (FY25) | PI-Managed Mission Cost for Phases A to F, excluding NASA-provided launch | [2025 SMEX AO page](https://science.nasa.gov/astrophysics/programs/physics-of-the-cosmos/community/2025-astrophysics-small-explorer-announcement-of-opportunity) |
| SMEX, planned 2026 AO | Astrophysics | $190M (FY26) | Raised from $170M in the draft AO | [NASA SARA solicitations page](https://science.nasa.gov/researchers/sara/grant-solicitations) |
| Medium Explorer (MIDEX), 2021 AO | Astrophysics | $300M (FY22) | Excludes standard launch services and contributions | [2021 Astro MIDEX Evaluation Plan](https://explorers.larc.nasa.gov/2021APMIDEX/MIDEX/pdf_files/2021_Astro_MIDEX_Evaluation_Plan_Final_12May2022_rev4.pdf) |
| Discovery, 2019 AO | Planetary | $500M (FY19) | Phases A to D; excludes launch, Phases E to F, contributions | [Discovery 2019 PMPO overview](https://discovery.larc.nasa.gov/pdf_files/2019AO/02_PMPO%20Overview%20Presentation%20for%20Discovery%202019.pdf) |
| New Frontiers 5 (AO not yet final) | Planetary | $900M (FY22) | Phases A to D PI-Managed Mission Cost, with exclusions | [NF5 community announcement](https://astrobiology.nasa.gov/news/second-community-announcement-advance-notice-regarding-new-frontiers-5-nf5-announcement-of-opportunity/); [NF5 page](https://newfrontiers.larc.nasa.gov/NF5) |
| Earth Venture Mission (EVM-3) | Earth Science | $190M (FY22) | Includes launch; excludes contributions | [EVM-3 Q&A](https://essp.larc.nasa.gov/EVM-3/evm-3_qas.html) |
| Earth Venture Instrument (EVI-6) | Earth Science | $37M (FY24) | Class D instruments and CubeSats only | [National Academies, Earth Venture lessons learned](https://nap.nationalacademies.org/read/26499/chapter/5) |
| Earth Venture Orbital (EVO-1) | Earth Science | $35M to $115M range | New structure replacing EVI/EVM/EVC | [EVO-1 FAQ](https://essp.larc.nasa.gov/EVO-1/faq.html) (*unverified* against final AO) |
| CubeSat Launch Initiative (CSLI) | Cross-agency | No cap; NASA pays the launch | Free ride for U.S. educational and non-profit CubeSats | [NASA CSLI page](https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/) |
| Flagship (directed) | Any | No AO cap; set at KDP C as the ABC | Full life-cycle cost | Examples: Europa Clipper about $5.2B ([JPL](https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/)); JWST $9.7B ([GAO-21-406](https://gao.gov/products/gao-21-406)) |

NF5 status: NASA's page estimates the final AO release no earlier than 2026 ([NF5 page](https://newfrontiers.larc.nasa.gov/NF5)). Discovery history: the cap was about $330M for years, rising to $425M by 2006 and $450M (FY15) in the 2014 AO ([National Academies 2006](https://www.nap.edu/read/11530/chapter/4); [Discovery 2014 Q&A](https://discovery.larc.nasa.gov/pdf_files/QA_v07.pdf)). The 2019 Discovery AO selected two Venus missions, VERITAS and DAVINCI, on June 2, 2021, with about $500M each for development ([JPL release](https://www.jpl.nasa.gov/news/nasa-selects-2-missions-to-study-lost-habitable-world-of-venus/)). Astrophysics Probe-class missions (around $1B) also exist but we did not verify the cap (*unverified*). For how caps, reserves, and overruns work, see [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md).

## The NASA project life cycle

### Decision authority, categories, and KDPs

A **Key Decision Point (KDP)** is "the event where the Decision Authority determines the readiness of a program or project to progress to the next phase of the life cycle and establishes the content, cost, and schedule commitments for the ensuing phase(s)" ([NPR 7120.5F, 2.2.7](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)). Before each KDP, an independent Standing Review Board (SRB) runs a life-cycle review (LCR) and briefs the management councils (2.3.5). The decision is recorded in a signed **Decision Memorandum** that includes a Management Agreement, which NASA calls "a contract between the Agency and the program or project manager" (2.4.1.2).

Projects are placed in Categories 1 to 3 by life-cycle cost and priority ([NPR 7120.5F, Table 2-1](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)):

| Priority | LCC under $365M | $365M to $2B | Over $2B, or significant radioactive material, or human space flight |
| --- | --- | --- | --- |
| High | Category 2 | Category 2 | Category 1 |
| Medium | Category 3 | Category 2 | Category 1 |
| Low | Category 3 | Category 2 | Category 1 |

For Category 1, the Decision Authority is the NASA Associate Administrator. For Categories 2 and 3, it is the Mission Directorate Associate Administrator, who may delegate KDP decisions to a Center Director (2.3.1).

Separately, payloads get a **risk classification** from Class A (lowest risk tolerance) to Class D (highest) under [NPR 8705.4B](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf) (effective November 1, 2024). Class affects test rigor and which rockets are allowed ([NASA risk classification fact sheet](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf)). PACE, for example, is Class C ([PACE overview](https://ntrs.nasa.gov/citations/20240011592)). Details are in [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md).

### Phase by phase: purpose and products

| Phase | Key activities | Typical products at the end | Source |
| --- | --- | --- | --- |
| Pre-Phase A | Capture stakeholder needs, goals, objectives; explore many concepts. | Preliminary ConOps, preliminary Systems Engineering Management Plan (SEMP), rough cost, schedule, risk; MCR package | [SE Handbook 3.0](https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/) |
| A | Trade studies; choose architecture; plan technology maturation. | Baselined top-level requirements, mission architecture, work breakdown structure, preliminary verification and validation (V&V) plan, cost estimate | Same |
| B | Mature technologies; flow requirements down; preliminary design. | System and subsystem specifications, preliminary design, baselined plans, cost and schedule baseline | Same |
| C | Detailed design; build and code. | Detailed designs, interface documents, integration and V&V procedures, fabricated hardware, safety data package | Same |
| D | Assemble, integrate, test, ship, launch, check out. | Verified system, V&V report, operations manuals, trained operators, launch readiness | Same |
| E | Operate; sustain; fix anomalies; propose extensions. | Science data, anomaly reports, extension proposals, lessons learned | Same |
| F | Decommission and dispose; archive. | Disposal, archived data, final mission report | Same |

### Agency Baseline Commitment and confidence levels

At KDP C, the project's life-cycle cost estimate and other parameters go into the Decision Memorandum and become the **Agency Baseline Commitment (ABC)**. NASA measures its performance against the ABC during Implementation. For projects of $250M or more, the ABC is NASA's external commitment to the Office of Management and Budget and Congress ([NPR 7120.5F, 2.4.1.5](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)).

| Rule | Value | Source |
| --- | --- | --- |
| Projects of $1B or more must produce a joint cost and schedule confidence level (JCL). | Required | [NPR 7120.5F, 2.4.3](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2) |
| Budget basis at KDP B and KDP C | 70% JCL, or as approved by the Decision Authority | 2.4.4 |
| Rebaseline trigger | Development cost exceeds the ABC by 30% or more | 2.4.1.8 |
| Projects from $250M to $1B | Cost and schedule ranges from probabilistic analysis; JCL optional | 2.4.3 |

PACE baselined at a 65% cost confidence under Design-to-Cost ([PACE overview](https://ntrs.nasa.gov/citations/20240011592)), which shows the Decision Authority can approve less than 70%.

## Life-cycle reviews

The table below follows [NPR 7120.5F Table 2-5](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2) for objectives and [NPR 7123.1D Appendix G](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixG) for entrance and success criteria.

| Review | Phase | Gate | What it checks | Expected state or key products |
| --- | --- | --- | --- | --- |
| MCR (Mission Concept Review) | End of Pre-Phase A | KDP A | Is the concept feasible and does it meet a real need? | Stakeholder expectations, goals and objectives, alternative concepts, measures of effectiveness, rough cost and schedule, preliminary descope options, technology readiness assessment, preliminary SEMP |
| SRR (System Requirements Review) | A | Feeds KDP B | Are the functional and performance requirements responsive to program requirements and achievable? | Baselined requirements, preliminary project plan |
| MDR/SDR (Mission or System Definition Review) | End of A | KDP B | Is the architecture credible within resources? Are requirements allocated to every element? | Architecture, allocated requirements; the mission "can likely be achieved within available resources with acceptable risk" |
| PDR (Preliminary Design Review) | End of B | KDP C | Does the preliminary design meet all requirements with acceptable risk, cost, and schedule? Are the baselines complete? | Preliminary design, cost and schedule baselines, final technology readiness assessment; leads to the ABC |
| CDR (Critical Design Review) | C | KDP D (with SIR) | Is the design mature enough for full-scale fabrication, assembly, integration, and test, with margins? | Final design; project ready for AI&T within the ABC |
| PRR (Production Readiness Review) | C | Optional | Can the developer produce multiple copies? | Used when building several similar units |
| SIR (System Integration Review) | End of C | KDP D | Are parts, facilities, people, and procedures ready to start integration? | Integration plans and readiness |
| TRR (Test Readiness Review) | D | None | Is a specific test ready to run? | Test procedures, facilities |
| SAR (System Acceptance Review) | D | None | Is the end item ready to ship to the launch site? | Acceptance data package ([NPR 7120.5F, Table 2-6](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)) |
| ORR (Operational Readiness Review) | D | KDP E (with FRR) | Are flight and ground systems, people, and procedures ready to operate? | Operations readiness |
| MRR/FRR (Mission or Flight Readiness Review) | D | KDP E | Is the whole system ready for a safe and successful launch and flight? | Launch readiness |
| LRR (Launch Readiness Review) | D | None | Final launch readiness of project, ground, hardware, and software | Go for launch (Table 2-6) |
| PLAR (Post-Launch Assessment Review) | After launch | Non-KDP | Is the spacecraft ready for routine operations after deployment and checkout? | Ready to begin Phase E |
| CERR (Critical Event Readiness Review) | E | Non-KDP | Is the team ready for a critical event such as orbit insertion or a landing? | Ready for the event |
| PFAR (Post-Flight Assessment Review) | E | Non-KDP | Human space flight only: were objectives met and anomalies captured? | Anomaly list and actions |
| DR (Decommissioning Review) | End of E | KDP F | Is the project ready to decommission safely and deliver remaining products? | Decommissioning plan |
| DRR (Disposal Readiness Review) | F | Non-KDP | Is the team ready for the disposal event itself? | Ready for disposal |

All "what it checks" text is condensed from the two NPR tables cited above.

### How long does each phase take?

**Analysis.** NASA does not set fixed durations. The table below uses the documented milestones of three missions in the [worked timelines](#worked-timelines).

| Phase span | Europa Clipper (flagship) | PACE (directed Earth, Class C) | IXPE (SMEX) |
| --- | --- | --- | --- |
| Pre-Phase A | About 3 years (FY2012 study to June 2015) | Jan 2015 to about mid-2016 | Within the proposal and Step 1 period |
| Phase A | 20 months (June 2015 to Feb 2017) | About 1 year *(dates read from a chart, unverified)* | Concept study before Jan 2017 selection |
| Phase B | 30 months (Feb 2017 to Aug 2019, stretched by PDR issues) | About 2 years | Not found |
| Phases C and D to launch | About 5 years (Aug 2019 to Oct 2024) | About 4.5 years to Feb 2024, including COVID-19 impact | Total selection to launch: about 4.9 years |
| Idea to launch | About 12 years | About 9 years | About 5 years from selection |
| Prime mission | About 4 years at Jupiter (2030 to 2034) | 3 years | 2 years |

Sources: [NASA OIG IG-19-019](https://oig.nasa.gov/docs/IG-19-019.pdf), [JPL quick facts](https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/), [PACE overview](https://ntrs.nasa.gov/citations/20240011592), [IXPE About](https://ixpe.msfc.nasa.gov/about/index.html).

## Concept maturity, technology readiness, and concurrent design

### Concept Maturity Levels (CML)

JPL's CML scale is summarized in [challenge brief](../../challenge-brief.md#mission-engineering-references) from the [local PDF](../../reference-pdfs/jpl-concept-maturity-levels-2013.pdf). In short, CML 1 to 4 run from "Cocktail Napkin" to "Point Design", and CML 5 to 9 track the formal life cycle up to PDR and CDR. **Analysis.** The useful link for us is that CML 1 to 4 happen mostly in Pre-Phase A, and the MCR expects roughly CML 4 maturity: a feasible concept with a rough cost and alternatives considered ([NPR 7123.1D, Table G-3](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixG)). The CML paper's 80% green-checklist rule is a ready-made model for a game readiness gate.

### Technology Readiness Levels (TRL)

The authoritative definitions are in [NPR 7123.1D, Appendix E](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixE). That appendix says it takes precedence over other NASA TRL definitions.

| TRL | Definition (NPR 7123.1D) | Plain meaning |
| --- | --- | --- |
| 1 | Basic principles observed and reported | A paper describes the effect. |
| 2 | Technology concept and/or application formulated | Someone proposes a use; no proof yet. |
| 3 | Analytical and experimental proof-of-concept of critical function | A lab test shows the key idea works. |
| 4 | Component and/or breadboard validation in a laboratory environment | A rough version works on a bench. |
| 5 | Component and/or brassboard validated in a relevant environment | A better version works in realistic conditions. |
| 6 | System/sub-system model or prototype demonstration in a relevant environment | A high-fidelity prototype works in a relevant environment. |
| 7 | System prototype demonstration in an operational environment | The prototype works in space (or the real platform). |
| 8 | Actual system completed and "flight qualified" through test and demonstration | Final hardware passes qualification. Example: Cassini before launch. |
| 9 | Actual system flight proven through successful mission operations | It has flown successfully. Example: Hubble. |

**TRL 6 by PDR.** NASA AOs require that any technology below TRL 6 at proposal has a plan to reach TRL 6 no later than PDR ([Explorers Program TRL 6 guidance](https://explorers.larc.nasa.gov/APSMEX25/SMEX/pdf_files/Prog7a_SystemLevelTRL6-%20Examples_12302024.pdf)). The SE Handbook places the final technology maturity assessment just before PDR ([SE Handbook Appendix G](https://www.nasa.gov/seh/appendix-g-technology-assessmentinsertion)). GAO treats TRL 6 at PDR as a best practice. In 2024, nine of eleven major projects that reported critical technologies met it ([GAO-24-106767](https://www.gao.gov/products/GAO-24-106767)). Note that a set of TRL 6 subsystems does not automatically make a TRL 6 system ([Explorers TRL 6 guidance](https://explorers.larc.nasa.gov/APSMEX25/SMEX/pdf_files/Prog7a_SystemLevelTRL6-%20Examples_12302024.pdf)).

### Concurrent engineering teams

| Team | Home | What it does | Source |
| --- | --- | --- | --- |
| A-Team | JPL Innovation Foundry | Workshop-style architecture studies at the earliest concept stage; precedes Team X | [Foundry Furnace paper, NTRS](https://ntrs.nasa.gov/citations/20190025644) |
| Team X | JPL | Discipline experts "work concurrently and collaboratively over several days" to reach a feasible point design with a cost estimate, using linked spreadsheets | Same |
| Team Xc | JPL | Team X variant for CubeSat, NanoSat, and SmallSat concepts | Same |
| Mission Design Lab (MDL) | NASA Goddard Integrated Design Center | Conceptual end-to-end mission design and analysis | [GSFC IDC](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/) |
| Instrument Design Lab (IDL) | NASA Goddard Integrated Design Center | Conceptual instrument design: requirements, trades, interfaces, mass estimates | Same |

The JPL Innovation Foundry was created in 2011 to help teams mature concepts from early ideas up to PDR ([JPL Innovation Foundry, NTRS](https://ntrs.nasa.gov/citations/20150005555)). The Goddard IDC dates from 1997 ([GSFC IDC](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/)). **Analysis.** In co-op play, a "concurrent design session" where each player owns one discipline (power, comms, budget) is a faithful model of Team X and MDL (COL-02).

## From science to requirements

### The Science Traceability Matrix (STM)

The STM is a required proposal element. NASA calls it "the backbone of the Science and Science Implementation sections". It shows how science goals "trace" (flow down) to instrument and mission requirements ([PI Launchpad STM session, 2019](https://science.nasa.gov/wp-content/uploads/2023/04/Launchpad_Session3_STM_18Nov2019_smf_final.pdf)).

| Column | Question it answers | Example (our illustration, not from a real STM) |
| --- | --- | --- |
| NASA science goal | Which strategic goal does this serve? | Understand how Earth's oceans support life |
| Science objective | What specific question will we answer? | Measure global phytoplankton distribution every two days |
| Measurement requirement | What physical quantity must be measured, how well? | Ocean color spectra across many bands, at about 1 km resolution |
| Instrument requirement | What must the instrument achieve? | Signal-to-noise ratio and band coverage that meet the measurement |
| Mission requirement | What must the spacecraft, orbit, and ground system provide? | Sun-synchronous orbit, pointing, downlink volume, three-year lifetime |

The example is loosely modeled on PACE, which flies a sun-synchronous orbit at about 676.5 km with two-day global coverage ([PACE overview](https://ntrs.nasa.gov/citations/20240011592)).

### Requirement levels

NPR 7120.5F defines a programmatic hierarchy: NASA strategic goals, Mission Directorate requirements (in the Program Commitment Agreement), program requirements (Program Plan), project requirements (Project Plan), and system requirements ([NPR 7120.5F, Table 1-1](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter1)).

**Analysis.** Projects commonly number these levels. The mapping below is common practice, not an NPR rule.

| Level | Typical owner | Content | Example |
| --- | --- | --- | --- |
| L1 | NASA Headquarters (program-level requirements on the project) | Science objectives, mission success criteria, cost and launch commitments | "Measure X for at least 3 years." |
| L2 | Project | Mission and system requirements | Orbit, data volume, lifetime |
| L3 | Segment or subsystem lead | Spacecraft, instrument, ground system requirements | Battery capacity, pointing accuracy |
| L4 | Component lead | Box-level requirements | A reaction wheel's torque |

The CML paper notes that missing Level 1 requirements, an STM, or a Master Equipment List is a serious gap regardless of checklist score (summarized in [challenge brief](../../challenge-brief.md#mission-engineering-references)).

### Baseline, threshold, and descopes

| Term | NASA definition | Source |
| --- | --- | --- |
| Baseline Science Mission | "If fully implemented, would achieve full science objectives" | [Zurbuchen 2019, slide 16](https://science.nasa.gov/wp-content/uploads/2023/05/06_05_2019_Zurbuchen_WritingSuccessfulProposals_FINAL.pdf) |
| Threshold Science Mission | "Reduced version that would achieve minimum science acceptable" | Same |
| Descope | Reducing scope "by eliminating instruments or degrading their performance requirements" to save time and money | Same |

NASA says the difference between baseline and threshold "provides resiliency in the face of cost and schedule pressures" (same source). Proposals are scored partly on the "scientific value of the Threshold Science Mission" (same source). The MCR already asks for preliminary descope options ([NPR 7123.1D, Table G-3](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixG)). Europa Clipper shows why: initial instrument cost estimates grew 52% (from $325M to $493M) between May 2015 and June 2016, and NASA agreed to a cost-monitoring process that could trigger a descope review ([NASA OIG IG-19-019](https://oig.nasa.gov/docs/IG-19-019.pdf); [AIP FYI](https://www.aip.org/fyi/2019/audit-throws-cold-water-congress-europa-ambitions)).

### Verification methods and "test like you fly"

Verification proves that a system meets its requirements, using one of four methods: test, analysis, inspection, or demonstration ([SE Handbook 5.3](https://www.nasa.gov/seh/5-3-product-verification)).

| Method | What it means | Example |
| --- | --- | --- |
| Test | Measure performance under controlled conditions | Vibrate the spacecraft on a shaker table |
| Analysis | Use models and calculation | Thermal model predicts temperatures in orbit |
| Inspection | Look at, measure, or weigh | Weigh an empty container to check a 250 g limit (from the [webinar](../../reference-pdfs/nasa-design-and-develop-science-missions-2025.pdf)) |
| Demonstration | Operate it and observe the result, without detailed measurement | Show a deployable boom unfolds |

Validation is different. It asks whether the system does what the stakeholders actually need, and it has its own process in the SE engine, Product Validation ([NPR 7123.1D, Chapter 3](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=Chapter3)).

"Test like you fly" is the practice of testing hardware in its flight configuration, with flight sequences and environments, wherever practical. The term comes from aerospace industry practice ([Aerospace Corporation Mission Assurance Baseline](https://mab.aerospace.org/lvl2/4_2_4.2-5)). We did not find the exact phrase in the NASA SE Handbook (*unverified* as a NASA term).

### The systems engineering engine and ConOps

NPR 7123.1D defines 17 common technical processes ([NPR 7123.1D, Chapter 3](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=Chapter3); [SE Handbook 2.1](https://www.nasa.gov/reference/2-1-the-common-technical-processes-and-the-se-engine/)).

| Group | Processes |
| --- | --- |
| System Design (1 to 4) | Stakeholder Expectations Definition; Technical Requirements Definition; Logical Decomposition; Design Solution Definition |
| Product Realization (5 to 9) | Product Implementation; Product Integration; Product Verification; Product Validation; Product Transition |
| Technical Management (10 to 17) | Technical Planning; Requirements Management; Interface Management; Technical Risk Management; Configuration Management; Technical Data Management; Technical Assessment; Decision Analysis |

The SE Handbook says processes 1 to 9 are the execution tasks, and processes 10 to 17 are crosscutting tools ([SE Handbook 2.1](https://www.nasa.gov/reference/2-1-the-common-technical-processes-and-the-se-engine/)). The engine is applied repeatedly at each level and in each phase.

A **Concept of Operations (ConOps)** describes how the system will be used, from launch through disposal, from the operators' and users' viewpoint. A preliminary ConOps is a Pre-Phase A product ([SE Handbook 3.0](https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/)). The SE Handbook's Appendix S gives an outline, as the webinar notes ([local copy](../../reference-pdfs/nasa-design-and-develop-science-missions-2025.pdf)). The webinar also splits a mission into launch, space, ground, and user segments.

## Build: assembly, integration, and test

### Environmental testing

Spacecraft are tested to show they survive launch and space. Test levels and philosophies come from standards such as Goddard's GEVS (GSFC-STD-7000). This section covers the process only; subsystem design is in [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md).

| Test | What it simulates | Why |
| --- | --- | --- |
| Random vibration | Launch vehicle vibration through the structure | Finds loose parts, cracked joints, weak solder |
| Acoustic | Rocket noise in the fairing | Large, light surfaces (solar arrays, antennas) respond to sound |
| Shock | Pyrotechnic separation and deployment events | Brief, intense loads can break electronics |
| Thermal vacuum (TVAC) | Vacuum and hot and cold extremes of orbit | Proves thermal design and finds failures at temperature |
| Electromagnetic interference and compatibility (EMI/EMC) | Electrical noise between parts | Proves instruments and radios do not disturb each other |
| Mass properties and deployments | Mass, center of gravity, moving parts | Confirms launch vehicle interface and mechanisms |

CubeSat 101 lists vibration, thermal vacuum bakeout, shock, and EMC as typical CubeSat tests ([CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf)). The specific dB levels and temperature margins vary by standard and project (see [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md)).

### Qualification, acceptance, and protoflight

| Approach | Hardware | Test levels | Source |
| --- | --- | --- | --- |
| Qualification (prototype) | A dedicated test unit, not flown | Qualification levels, longer durations to cover fatigue | [KSC Preferred Practice 1419](https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1419.pdf) |
| Acceptance | Flight unit of a design already qualified | Maximum expected flight levels | Same |
| Protoflight | Flight hardware of a new design | "Design qualification test levels and flight acceptance test durations" | Same |

At Goddard, protoflight vibroacoustic levels are "the maximum expected flight levels (limit levels) plus 3 dB" ([KSC Preferred Practice 1419](https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1419.pdf)). A NASA Office of the Chief Engineer study found that from 2004 to 2014, 6% of protoflight missions and 6% of full-qualification missions had a publicly disclosed failure. It concluded protoflight "does not increase the mission risk of in-flight failure" by itself ([NASA Protoflight Research Initiative, NTRS](https://ntrs.nasa.gov/citations/20150014585)).

### Integration flow and launch campaign

**Analysis** (general sequence, assembled from the SE Handbook phase products and the PACE and CubeSat examples):

1. Build and test components; deliver them with acceptance data.
2. Integrate subsystems and instruments onto the spacecraft bus (after SIR).
3. Run functional tests, then the environmental test campaign (each test after a TRR).
4. Repeat comprehensive functional tests after each environment to catch damage.
5. Hold the SAR and ship to the launch site.
6. At the launch site: post-ship checks, fueling, encapsulation in the fairing, mating to the rocket.
7. ORR, FRR or MRR, LRR, then launch.

PACE's mission elements show the launch-site role: SpaceX provided launch services via NASA's Launch Services Program, and Astrotech provided payload processing ([PACE overview](https://ntrs.nasa.gov/citations/20240011592)). For CubeSats, integration into the dispenser takes about a day, and the dispenser joins the rocket typically 2 weeks to 4 months before launch ([CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf)). Launch vehicle choice is covered in [02-mission-design-orbits-launch.md](02-mission-design-orbits-launch.md).

## Launch, early operations, and the prime mission

### LEOP and commissioning

Launch and early operations (LEOP) start at liftoff. The team acquires signal, checks spacecraft health, deploys solar arrays and antennas, and reaches the operational orbit. Commissioning then turns on and calibrates instruments. The PLAR closes this period and confirms readiness for routine operations ([NPR 7123.1D, G.15](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixG)).

| Mission | Launch | Commissioning outcome | Source |
| --- | --- | --- | --- |
| JWST | Dec 25, 2021 | About six months of mirror alignment and instrument calibration; first full image set released July 12, 2022 | [NASA Webb](https://science.nasa.gov/mission/webb/); [NASA release](https://www.nasa.gov/news-release/nasa-reveals-webb-telescopes-first-images-of-unseen-universe/) |
| TESS | Apr 18, 2018 | Reached final orbit about 42 days after launch; first survey observation July 2018 | [Wikipedia summary](https://www.Wikipedia.org/wiki/TESS) (*unverified*, not a NASA source) |
| CubeSats | Varies | Identifying which tracked object is yours can take several weeks | [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) |

### Mission operations and ground data systems

**Analysis** (based on the SE Handbook Phase E description and the webinar's segment model). The ground segment includes a mission operations center that plans activities and sends commands, ground stations or networks (NASA's Near Space Network and Deep Space Network), and a science operations and data processing center. Ground-network time is not free: in Explorer AOs, Near Space Network direct-to-Earth services are charged against the cost cap ([2025 SMEX AO page](https://science.nasa.gov/astrophysics/programs/physics-of-the-cosmos/community/2025-astrophysics-small-explorer-announcement-of-opportunity)). Link budgets and data rates are covered in [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md).

### Data processing levels

NASA Earth science uses these levels ([NASA Earthdata](https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/data-processing-levels)):

| Level | Definition | Plain meaning |
| --- | --- | --- |
| L0 | "Reconstructed, unprocessed instrument and payload data at full resolution" | Raw data with communication artifacts removed |
| L1A | L0 data "time-referenced, and annotated with ancillary information" | Raw data plus timing and calibration information |
| L1B | L1A processed into instrument (physical) units | Calibrated measurements |
| L2 | "Derived geophysical variables at the same resolution and location as L1 source data" | A science quantity, such as chlorophyll, per pixel |
| L3 | "Variables mapped on uniform space-time grid scales" | Global maps and averages |
| L4 | Model output or analysis results from lower-level data | Combined or model-based products |

Archives: Earth science data go to 11 Distributed Active Archive Centers (DAACs) listed by [NASA Earthdata](https://www.earthdata.nasa.gov/centers). Planetary data go to the Planetary Data System (PDS), a federation of nine teams, including six science discipline nodes ([PDS About](https://pds.nasa.gov/home/about/)).

### Senior reviews and extended missions

After the prime mission, a mission can propose to keep operating. NASA's Astrophysics Division holds a triennial **Senior Review** of missions that have finished their prime missions and proposed extended operations ([2025 Astrophysics Senior Review](https://science.nasa.gov/astrophysics/resources/documents/2025-senior-review-of-operating-missions)). Planetary missions are also reviewed on a three-year cadence. The Planetary Science Division may extend a mission as proposed, extend it in modified form, or terminate it ([Planetary Mission Senior Reviews](https://science.nasa.gov/solar-system/documents/senior-review)). In 2025, NASA said it expected to continue at least five of the eight astrophysics missions under the FY2026 budget request ([2025 Astrophysics Senior Review](https://science.nasa.gov/astrophysics/resources/documents/2025-senior-review-of-operating-missions)). TESS finished its two-year primary mission and then two extended missions, the second ending around September 2025 ([NASA TESS](https://science.nasa.gov/mission/tess/)).

## End of mission

### Decommissioning and disposal rules

| Regime | Rule | Source |
| --- | --- | --- |
| LEO, NASA and U.S. government | Remain in orbit no more than 25 years after end of mission (first set in NASA Safety Standard 1740.14, 1995) | [NASA Orbital Debris Program Office, small satellite intro (2025)](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf) |
| LEO, FCC-licensed satellites | Deorbit "as soon as practicable but no later than five years after mission completion"; applies below 2,000 km; adopted September 29, 2022, with a two-year transition | [FCC 22-74 Second Report and Order](https://docs.fcc.gov/public/attachments/FCC-22-74A1_Rcd.pdf); [Federal Register, Aug 9, 2024](https://www.federalregister.gov/documents/2024/08/09/2024-17093/space-innovation-mitigation-of-orbital-debris-in-the-new-space-age) |
| Reentry safety | If an uncontrolled reentry poses a human casualty risk above 1 in 10,000, a controlled reentry is required | [NASA ODPO intro](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf) |
| Disposal reliability | Probability of successful disposal at least 0.9, goal 0.99 | Same (U.S. Government Orbital Debris Mitigation Standard Practices) |
| GEO | Boost to a graveyard orbit above GEO. IADC minimum perigee increase: 235 km + 1000 × CR × A/m (CR is solar radiation pressure coefficient; A/m is area-to-mass ratio) | [ESA Space Debris Conference paper on IADC guidelines](https://conference.sdo.esoc.esa.int/proceedings/sdc4/paper/35/SDC4-paper35.pdf); [ITU-R S.1003](https://itu.int/dms_pubrec/itu-r/rec/s/R-REC-S.1003-2-201012-I!!MSW-E.docx) |
| Disposal options | Direct reentry or Earth escape; atmospheric reentry; storage between LEO and GEO; storage above GEO; long-term reentry; retrieval | [NASA ODPO intro](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf) |

NASA's own requirements are in [NASA-STD-8719.14C](https://www.nasa.gov/wp-content/uploads/2018/01/process_for_limiting_orbital_debris.pdf) (approved November 5, 2021) under NPR 8715.6. These rules have no automatic exclusion for small satellites ([NASA ODPO intro](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf)). CubeSat developers document compliance in an Orbital Debris Assessment Report (ODAR) ([CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf)).

### Passivation

Passivation means removing stored energy at end of mission so the spacecraft cannot explode later. Examples are draining propellant, venting pressurant, and disconnecting batteries from charging. Section 4.4-2 of NASA-STD-8719.14C targets explosions from causes such as battery overcharging, tank overpressure, debris impact, or solar heating ([NASA passivation briefing](https://nasa.gov/wp-content/uploads/2023/10/odar-and-passivation.pdf)). The U.S. standard practice says all stored energy sources "should be depleted or safed when they are no longer required" ([NASA ODPO intro](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf)).

### Planetary missions: the deliberate crash

Far from Earth, the concern shifts from debris to contamination. Cassini ended on September 15, 2017, with a planned plunge into Saturn. Low on propellant, it was destroyed so it could never crash into Enceladus or Titan, moons that could host life ([ESA](https://www.esa.int/Science_Exploration/Space_Science/Cassini-Huygens/Countdown_to_Cassini_s_Grand_Finale)). The final orbits, called the Grand Finale, also returned new science from between the planet and its rings (same source). PACE, in Earth orbit, plans a controlled reentry after its mission ([PACE overview](https://ntrs.nasa.gov/citations/20240011592)).

## Planetary protection

NASA's requirements are in NPR 8715.24 (effective July 28, 2022), aligned with COSPAR policy ([NPR 8715.24 PDF](https://nodis3.gsfc.nasa.gov/npg_img/N_PR_8715_0024_/N_PR_8715_0024_.pdf); [NASA briefing, Seasly 2023](https://ntrs.nasa.gov/api/citations/20230013059/downloads/Seasly%202023%20What%20You%20Need%20to%20Know.pdf); [COSPAR policy](https://cosparhq.cnes.fr/assets/uploads/2021/07/PPPolicy_2021_3-June.pdf)).

| Category | Mission type | Example target or mission | Burden |
| --- | --- | --- | --- |
| I | Any mission to a target of no interest for life's origins | Example: the Sun or Mercury *(COSPAR examples; unverified here)* | None |
| II | Low chance that contamination harms future study | OSIRIS-REx outbound | Documentation |
| III | Flyby or orbiter of a body of biological interest | Mars or Europa orbiters | Cleanliness, trajectory biasing, impact limits |
| IV | Lander or probe to such a body | Mars landers (subcategories IVa, IVb, IVc) | Bioburden limits, sterilization |
| V unrestricted | Earth return from a body judged safe | OSIRIS-REx sample return | Outbound category rules only |
| V restricted | Earth return from a body that might host life | Mars Sample Return lander concept (IVb plus V restricted) | Containment of unsterilized samples |

Examples for II, IV, and V are from the [Seasly 2023 NASA briefing](https://ntrs.nasa.gov/api/citations/20230013059/downloads/Seasly%202023%20What%20You%20Need%20to%20Know.pdf). **Analysis.** For the game, the category is a cost and schedule multiplier: Category IV and V missions need clean rooms and extra verification.

## Worked timelines

### 1. MinXSS-1 (3U CubeSat, university, CSLI and ELaNa)

| Date | Event | Source |
| --- | --- | --- |
| Dec 6, 2015 | Launched to the ISS on an Atlas V | [Nanosats.eu](https://www.nanosats.eu/sat/minxss) (*unverified* secondary source) |
| May 16, 2016 | Deployed from the ISS on the ELaNa IX mission | [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) |
| 2016 to 2017 | Studied solar soft X-rays; downlinked about 1 MB per day (about 1% data capture) | [MinXSS-2 overview, arXiv](https://arxiv.org/abs/1905.01345) |
| Originally planned | 3 months of science | [LASP MinXSS blog](https://lasp.colorado.edu/minxss/2017/02/16/9-months-operating-on-orbit-anticipate-de-orbit-in-late-may/) |
| May 6, 2017 | Reentered after about one year in orbit | [arXiv](https://arxiv.org/abs/1905.01345); [LASP](https://lasp.colorado.edu/minxss/2017/05/08/minxss-1-deorbited/) |

Notable: about five months between launch and deployment, which shows the ISS-deploy waiting time. The mission ended by natural decay, with no disposal maneuver. We did not find its cost.

### 2. IXPE (Small Explorer, astrophysics)

| Date | Event | Source |
| --- | --- | --- |
| Jan 3, 2017 | Selected as a SMEX | [IXPE About](https://ixpe.msfc.nasa.gov/about/index.html) |
| Dec 9, 2021 | Launched into a 600 km, about 0° inclination orbit | Same |
| 2022 to 2023 | Two-year prime mission | Same |

Cost: $188M, including launch vehicle, operations, and post-launch data analysis. Team: NASA Marshall (PI and mirrors), Ball Aerospace (spacecraft and integration), Italian Space Agency (detectors) (same source). Notable: about five years from selection to launch, and an international partner providing a key instrument.

### 3. TESS (Medium Explorer, astrophysics)

| Date | Event | Source |
| --- | --- | --- |
| Apr 5, 2013 | Selected; funded with up to $200M, excluding launch | [MIT News](https://news.mit.edu/2013/nasa-selects-tess-for-mission-0405); [Spaceflight Now](https://spaceflightnow.com/news/n1304/08explorer/) |
| Apr 18, 2018 | Launched | [NASA TESS](https://science.nasa.gov/mission/tess/) |
| 2018 to 2020 | Two-year primary mission | Same |
| To about Sept 2025 | Second extended mission ends; still operating in extended mission | Same |

Notable: a mission that met its prime goals and has been extended twice through senior review.

### 4. PACE (directed, cost-capped Earth science, Class C)

| Date | Event | Source |
| --- | --- | --- |
| Oct 2012 | Science Definition Team report sets science objectives | [PACE overview, NTRS](https://ntrs.nasa.gov/citations/20240011592) |
| Dec 2014 | Directed to NASA Goddard with a Design-to-Cost mandate | Same |
| Jan 2015 | Kickoff at Headquarters; Pre-Phase A begins | Same |
| 2015 to 2016 | 17 months of formulation trades; more than 50 studies | Same |
| 2016 to 2019 | Phases A and B, then KDP C codifies baseline capabilities at 65% cost confidence | Same |
| 2020 to 2022 | COVID-19 impact; replan; ABC launch date May 2024, Management Agreement Feb 2024 | Same |
| Feb 8, 2024 | Launched on a Falcon 9 | [PopSci](https://popsci.com/science/nasas-pace-satellite-launch) |
| 2024 to 2027 | 3-year Phase E, 10 years of fuel, controlled reentry planned | [PACE overview](https://ntrs.nasa.gov/citations/20240011592) |

Cost: capped at $805M in 2014, about $948M by launch ([PopSci](https://popsci.com/science/nasas-pace-satellite-launch); *unverified* against GAO). Notable: the project launched ahead of its ABC date by managing to an internal date three months earlier. This is a clean example of schedule reserve.

### 5. Europa Clipper (directed flagship, planetary)

| Date | Event | Source |
| --- | --- | --- |
| FY2012 | JPL Europa Study Report (Pre-Phase A) | [NASA OIG IG-19-019](https://oig.nasa.gov/docs/IG-19-019.pdf) |
| July 2014 to May 2015 | Instrument AO released; nine instruments selected | Same |
| June 2015 | Enters Phase A (Formulation) | Same |
| Feb 2017 | KDP B; enters Phase B with a target launch of June 2022 | Same |
| Aug 2018 | PDR; technical issues delay KDP C | Same |
| Aug 2019 | KDP C; ABC set around a 2025 launch, about $4.25B baseline life-cycle cost | [NASA OIG follow-up](https://oig.nasa.gov/docs/Follow-uptoMay2019AuditofEuropaMission-CongressionalLaunchVehicleMandate.pdf); [SpacePolicyOnline](https://spacepolicyonline.com/news/nasa-ig-urges-congress-to-remove-requirement-to-launch-europa-clipper-on-sls) |
| Oct 14, 2024 | Launched on a Falcon Heavy | [JPL quick facts](https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/) |
| Apr 2030 | Jupiter orbit insertion after a 5.5-year cruise | Same |
| Early 2031 | Europa flybys begin | Same |
| June 2034 | Prime mission ends | Same |

Cost: about $5.2B across the full mission life from 2015 to 2034 ([JPL quick facts](https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/)). Notable: a congressional mandate to use the Space Launch System kept the launch vehicle undecided before KDP C ([NASA OIG follow-up](https://oig.nasa.gov/docs/Follow-uptoMay2019AuditofEuropaMission-CongressionalLaunchVehicleMandate.pdf)). An external constraint changed the baseline.

### 6. JWST (brief: what overruns look like)

GAO reports a $9.7B life-cycle cost including operations ([GAO-21-406](https://gao.gov/products/gao-21-406)). In 2011, the project was rebaselined with a 78% life-cycle cost increase to $8.8B and a 52-month launch delay to October 2018 ([GAO-14-72](https://www.gao.gov/products/GAO-14-72)). It actually launched on December 25, 2021 ([NASA Webb](https://science.nasa.gov/mission/webb/)). Failure and overrun analysis belongs in [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md).

## How the CubeSat lifecycle differs

CSLI gives U.S. educational institutions and non-profits (including museums and science centers) a free launch. In exchange, NASA asks for a report on the results ([CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf)). Calls open once a year, typically in August, with proposals due in November. CSLI has launched over 150 CubeSats ([NASA CSLI page](https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/), updated October 14, 2026).

CubeSat 101's phase list and durations ([CubeSat 101, Chapter 2](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf)):

| # | Phase | Typical duration |
| --- | --- | --- |
| 1 | Concept development | 1 to 6 months |
| 2 | Securing funding | 1 to 12 months |
| 3 | Merit and feasibility reviews | 1 to 2 months |
| 4 | CubeSat design | 1 to 6 months |
| 5 | Proposal to the CSLI call | 3 to 4 months |
| 6 | Selection and manifesting | 1 to 36 months |
| 7 | Mission coordination | 9 to 18 months |
| 8 | Regulatory licensing (FCC, NOAA) | 4 to 6 months |
| 9 | Flight documentation | 10 to 12 months |
| 10 | Ground station development and test | 2 to 12 months |
| 11 | Hardware fabrication and test | 2 to 12 months |
| 12 | Mission readiness review | Half a day |
| 13 | CubeSat-to-dispenser integration | 1 day |
| 14 | Dispenser-to-rocket integration | 1 day |
| 15 | Launch | 1 day |
| 16 | Mission operations | Variable, up to 20 years |

Key facts from the same guide: a CubeSat can be built in as little as 9 months but typically takes 18 to 24 months. After delivery, waiting for launch takes "a few months to a few years". Rockets usually need the CubeSat 4 weeks to 6 months before launch. A 1U is a 10 cm cube of about 1 to 1.33 kg.

| Aspect | Large NASA mission | CubeSat via CSLI |
| --- | --- | --- |
| Governance | NPR 7120.5F phases, KDPs, independent SRB | Lighter reviews; integrator's schedule drives deliverables |
| Risk class | Often A to C | Usually Class D or not classified |
| Launch | Dedicated or primary payload; chosen by the project | Rideshare; the launch is assigned, and orbit flexibility shortens the wait |
| Timeline control | Project owns the launch date | The ride sets the date; a delay can mean being removed from the manifest |
| Testing | Full qualification or protoflight campaign | Vibration, thermal vacuum bakeout, and dispenser fit checks to the launch provider's levels |
| End of mission | Planned disposal maneuver or controlled reentry | Usually natural decay from low orbit; ODAR still required |

## Key numbers for the game

| Quantity | Value | Unit | Source |
| --- | --- | --- | --- |
| Pioneers cap | 20 | $M, excluding launch | [NASA SmallSat Town Hall 2022](https://www.nasa.gov/wp-content/uploads/2022/08/04.brandt-nasa_small_satellite_town_hall_2022_tjb_0.pdf) |
| SMEX cap (2025 AO) | 170 | $M FY25, Phases A to F, excluding launch | [2025 SMEX AO page](https://science.nasa.gov/astrophysics/programs/physics-of-the-cosmos/community/2025-astrophysics-small-explorer-announcement-of-opportunity) |
| MIDEX cap (2021 AO) | 300 | $M FY22, excluding launch | [MIDEX evaluation plan](https://explorers.larc.nasa.gov/2021APMIDEX/MIDEX/pdf_files/2021_Astro_MIDEX_Evaluation_Plan_Final_12May2022_rev4.pdf) |
| Earth Venture Mission cap (EVM-3) | 190 | $M FY22, including launch | [EVM-3 Q&A](https://essp.larc.nasa.gov/EVM-3/evm-3_qas.html) |
| Discovery cap (2019 AO) | 500 | $M FY19, Phases A to D | [Discovery 2019 PMPO](https://discovery.larc.nasa.gov/pdf_files/2019AO/02_PMPO%20Overview%20Presentation%20for%20Discovery%202019.pdf) |
| New Frontiers 5 cap | 900 | $M FY22, Phases A to D | [NF5 announcement](https://astrobiology.nasa.gov/news/second-community-announcement-advance-notice-regarding-new-frontiers-5-nf5-announcement-of-opportunity/) |
| Flagship examples | 5.2 (Clipper), 9.7 (JWST) | $B life-cycle | [JPL](https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/); [GAO-21-406](https://gao.gov/products/gao-21-406) |
| Step 1 selection rate | 17 | % of proposals (1996 to 2017) | [Zurbuchen 2019](https://science.nasa.gov/wp-content/uploads/2023/05/06_05_2019_Zurbuchen_WritingSuccessfulProposals_FINAL.pdf) |
| Category 1 threshold | over 2 | $B life-cycle cost | [NPR 7120.5F Table 2-1](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2) |
| JCL required at | 1 | $B or more life-cycle cost | Same, 2.4.3 |
| Budget confidence at KDP B and C | 70 | % JCL (default) | Same, 2.4.4 |
| Rebaseline trigger | 30 | % development cost growth over ABC | Same, 2.4.1.8 |
| Technology maturity at PDR | 6 | TRL | [Explorers TRL 6 guidance](https://explorers.larc.nasa.gov/APSMEX25/SMEX/pdf_files/Prog7a_SystemLevelTRL6-%20Examples_12302024.pdf) |
| Protoflight vibroacoustic margin | +3 | dB over maximum expected flight level | [KSC PP-1419](https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1419.pdf) |
| Idea to launch, flagship | about 12 | years (Europa Clipper) | [OIG IG-19-019](https://oig.nasa.gov/docs/IG-19-019.pdf); [JPL](https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/) |
| Kickoff to launch, directed Earth mission | about 9 | years (PACE) | [PACE overview](https://ntrs.nasa.gov/citations/20240011592) |
| Selection to launch, SMEX | about 5 | years (IXPE) | [IXPE](https://ixpe.msfc.nasa.gov/about/index.html) |
| CubeSat build time | 9 minimum, 18 to 24 typical | months | [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) |
| Commissioning, large observatory | about 6 | months (JWST) | [NASA Webb](https://science.nasa.gov/mission/webb/) |
| Typical prime mission | 2 to 4 | years (IXPE, TESS, PACE, Clipper) | Timelines above |
| Senior review cadence | 3 | years | [Astrophysics Senior Review](https://science.nasa.gov/astrophysics/resources/documents/2025-senior-review-of-operating-missions) |
| LEO disposal, NASA guideline | 25 | years after end of mission | [NASA ODPO](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf) |
| LEO disposal, FCC rule | 5 | years after mission completion (below 2,000 km) | [FCC 22-74](https://docs.fcc.gov/public/attachments/FCC-22-74A1_Rcd.pdf) |
| Controlled reentry trigger | 1 in 10,000 | human casualty risk | [NASA ODPO](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf) |
| GEO graveyard minimum raise | 235 + 1000 × CR × A/m | km above GEO | [IADC via ESA paper](https://conference.sdo.esoc.esa.int/proceedings/sdc4/paper/35/SDC4-paper35.pdf) |
| Disposal success probability | at least 0.9 (goal 0.99) | probability | [NASA ODPO](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf) |

## Game implications

**Analysis.** Feature IDs refer to the register in [challenge brief](../../challenge-brief.md). These are options, not decisions.

| Concept | Possible mechanic | Feature IDs |
| --- | --- | --- |
| Decadal priorities and AOs | Start each scenario with an "AO card": a science goal, a cost cap, a launch window, and a mission class (CubeSat, SMEX, MIDEX, Discovery, Flagship). | MIS-01, EXT-04 |
| Two-step selection | A short proposal stage scored on science, implementation, and feasibility (the three NASA forms). Only strong proposals proceed to a concept study. | MIS-01, EDU-06 |
| STM | A visual chain the player fills in: goal, objective, measurement, instrument, mission. Broken links show in red. | MIS-02, CORE-05, EDU-05 |
| Baseline versus threshold | Player sets two science targets. The final score compares results with both, so a reduced mission can still "pass". | MIS-02, EXT-01 |
| Descope options | When budget or schedule runs short, offer pre-chosen descopes (drop an instrument, shorten lifetime). Planning them early reduces penalty. | EXT-05, RES-03 |
| KDPs and reviews | Phase gates with a checklist. Pass at about 80% green, inspired by the CML paper. Failing a review costs time and money. | CORE-04, RES-06 |
| ABC at KDP C | Cost and launch date lock at KDP C. Later growth above 30% triggers a "rebaseline" event with a score penalty. | RES-03, RES-06, EXT-05 |
| TRL 6 by PDR | New-technology parts carry a TRL. Below 6 at PDR means extra cost and delay risk; heritage parts are cheaper but less capable. | SPC-07, MIS-06 |
| Concurrent design | In co-op, each player owns a discipline in a timed design session, as in Team X or the Goddard MDL. | COL-01, COL-02, COL-03 |
| Verification methods | Each requirement needs a chosen verification method. Skipping tests saves money but raises in-flight failure odds. | MIS-02, CORE-05 |
| Protoflight versus qualification | A test strategy choice: protoflight is cheaper and faster; full qualification costs a spare unit. | RES-03, EXT-05 |
| Launch campaign and commissioning | A short phase where deployments can fail and instruments need calibration time before science starts. | CORE-04, EXT-05 |
| Data levels | Downlinked raw data become science products only after processing. The score counts L2 and higher products. | RES-04, RES-05 |
| Senior review | After the prime mission, the player can propose an extension. Approval depends on science return and remaining fuel and health. | RES-06, EXT-01 |
| Disposal rules | The mission must end with a legal disposal: 5-year deorbit for LEO, graveyard for GEO, or a planned impact for planetary protection. Reserve propellant for it. | RES-01, EDU-03, EXT-10 |
| Planetary protection category | Choosing a life-bearing target raises cost and schedule; landing raises them more. | MIS-06, RES-03 |
| Real-mission timelines | The end report compares the player's timeline with IXPE, PACE, or Europa Clipper. | EXT-10, EDU-06 |
| CubeSat mode | Beginner difficulty: CSLI-style free launch but a fixed date and orbit, short build, natural decay ending. | EXT-04, SPC-07, EDU-01 |

## Sources

Policy and process
- [NPR 7120.5F main page (NODIS)](https://nodis3.gsfc.nasa.gov/displayDir.cfm?t=NPR&c=7120&s=5F)
- [NPR 7120.5F Chapter 1](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter1)
- [NPR 7120.5F Chapter 2](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)
- [NPR 7123.1D main page (NODIS)](https://nodis3.gsfc.nasa.gov/displayDir.cfm?t=NPR&c=7123&s=1D)
- [NPR 7123.1D Chapter 3](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=Chapter3)
- [NPR 7123.1D Appendix E (TRL)](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixE)
- [NPR 7123.1D Appendix G (reviews)](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7123_001D_&page_name=AppendixG)
- [NASA SE Handbook 3.0, Program/Project Life Cycle](https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/)
- [NASA SE Handbook 2.1, SE Engine](https://www.nasa.gov/reference/2-1-the-common-technical-processes-and-the-se-engine/)
- [NASA SE Handbook 5.3, Product Verification](https://www.nasa.gov/seh/5-3-product-verification)
- [NASA SE Handbook Appendix G, Technology Assessment](https://www.nasa.gov/seh/appendix-g-technology-assessmentinsertion)
- [NPR 8705.4B Risk Classification](https://explorers.larc.nasa.gov/APSMEX26/SMEX/pdf_files/N_PR_8705_004B_.pdf)
- [NASA risk classification fact sheet](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf)
- [NPR 8715.24 Planetary Protection](https://nodis3.gsfc.nasa.gov/npg_img/N_PR_8715_0024_/N_PR_8715_0024_.pdf)
- [Seasly 2023, planetary protection briefing (NTRS)](https://ntrs.nasa.gov/api/citations/20230013059/downloads/Seasly%202023%20What%20You%20Need%20to%20Know.pdf)
- [COSPAR Planetary Protection Policy 2021](https://cosparhq.cnes.fr/assets/uploads/2021/07/PPPolicy_2021_3-June.pdf)

Selection, programs, and caps
- [SMD Standard AO template](https://soma.larc.nasa.gov/StandardAO/pdf_files/StandardAOTemplate181023f.pdf)
- [Zurbuchen 2019, Writing Successful Proposals](https://science.nasa.gov/wp-content/uploads/2023/05/06_05_2019_Zurbuchen_WritingSuccessfulProposals_FINAL.pdf)
- [PI Launchpad STM session 2019](https://science.nasa.gov/wp-content/uploads/2023/04/Launchpad_Session3_STM_18Nov2019_smf_final.pdf)
- [2025 Astrophysics SMEX AO page](https://science.nasa.gov/astrophysics/programs/physics-of-the-cosmos/community/2025-astrophysics-small-explorer-announcement-of-opportunity)
- [NASA SARA grant solicitations page](https://science.nasa.gov/researchers/sara/grant-solicitations)
- [2021 Astro MIDEX Evaluation Plan](https://explorers.larc.nasa.gov/2021APMIDEX/MIDEX/pdf_files/2021_Astro_MIDEX_Evaluation_Plan_Final_12May2022_rev4.pdf)
- [Explorers Program system-level TRL 6 guidance](https://explorers.larc.nasa.gov/APSMEX25/SMEX/pdf_files/Prog7a_SystemLevelTRL6-%20Examples_12302024.pdf)
- [NASA Small Satellite Town Hall 2022 (Pioneers)](https://www.nasa.gov/wp-content/uploads/2022/08/04.brandt-nasa_small_satellite_town_hall_2022_tjb_0.pdf)
- [Discovery 2019 PMPO overview](https://discovery.larc.nasa.gov/pdf_files/2019AO/02_PMPO%20Overview%20Presentation%20for%20Discovery%202019.pdf)
- [Discovery 2014 Q&A](https://discovery.larc.nasa.gov/pdf_files/QA_v07.pdf)
- [National Academies 2006, PI-Led Missions](https://www.nap.edu/read/11530/chapter/4)
- [New Frontiers 5 page](https://newfrontiers.larc.nasa.gov/NF5)
- [NF5 second community announcement](https://astrobiology.nasa.gov/news/second-community-announcement-advance-notice-regarding-new-frontiers-5-nf5-announcement-of-opportunity/)
- [EVM-3 Q&A](https://essp.larc.nasa.gov/EVM-3/evm-3_qas.html)
- [EVO-1 FAQ](https://essp.larc.nasa.gov/EVO-1/faq.html)
- [National Academies, Earth Venture lessons learned (2022)](https://nap.nationalacademies.org/read/26499/chapter/5)
- [National Academies 2022 planetary decadal release](https://www.nationalacademies.org/news/2022/04/report-identifies-priority-planetary-science-missions-planetary-defense-efforts-and-strategic-investments-for-the-next-decade)
- [AIP FYI, 2022 planetary decadal](https://ww2.aip.org/fyi/2022/2022-planetary-science-decadal-survey-recommendations-major-missions)
- [Planetary Society, 2022 decadal](https://planetary.org/articles/the-2022-planetary-decadal-released)
- [JPL release, VERITAS and DAVINCI selection](https://www.jpl.nasa.gov/news/nasa-selects-2-missions-to-study-lost-habitable-world-of-venus/)
- [NASA CubeSat Launch Initiative](https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/)
- [CubeSat 101 (October 2017)](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf)

Design teams and testing
- [JPL Foundry Furnace paper (NTRS)](https://ntrs.nasa.gov/citations/20190025644)
- [JPL Innovation Foundry (NTRS)](https://ntrs.nasa.gov/citations/20150005555)
- [GSFC Integrated Design Center](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/)
- [KSC Preferred Practice 1419, vibroacoustic qualification](https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1419.pdf)
- [NASA Protoflight Research Initiative (NTRS)](https://ntrs.nasa.gov/citations/20150014585)
- [Aerospace Corporation Mission Assurance Baseline](https://mab.aerospace.org/lvl2/4_2_4.2-5)

Operations, data, end of mission
- [NASA Earthdata, data processing levels](https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/data-processing-levels)
- [NASA Earthdata, data centers](https://www.earthdata.nasa.gov/centers)
- [Planetary Data System, About](https://pds.nasa.gov/home/about/)
- [2025 Astrophysics Senior Review](https://science.nasa.gov/astrophysics/resources/documents/2025-senior-review-of-operating-missions)
- [Planetary Mission Senior Reviews](https://science.nasa.gov/solar-system/documents/senior-review)
- [NASA ODPO small satellite orbital debris intro, 2025 (NTRS)](https://ntrs.nasa.gov/api/citations/20250007454/downloads/20250801_smallsat_OD_intro_final_rev2.pdf)
- [NASA ODAR and passivation briefing](https://nasa.gov/wp-content/uploads/2023/10/odar-and-passivation.pdf)
- [NASA-STD-8719.14, Process for Limiting Orbital Debris](https://www.nasa.gov/wp-content/uploads/2018/01/process_for_limiting_orbital_debris.pdf)
- [FCC 22-74 Second Report and Order](https://docs.fcc.gov/public/attachments/FCC-22-74A1_Rcd.pdf)
- [Federal Register, Aug 9, 2024, FCC debris rule effective date](https://www.federalregister.gov/documents/2024/08/09/2024-17093/space-innovation-mitigation-of-orbital-debris-in-the-new-space-age)
- [ESA Space Debris Conference paper on IADC guidelines](https://conference.sdo.esoc.esa.int/proceedings/sdc4/paper/35/SDC4-paper35.pdf)
- [ITU-R S.1003-2](https://itu.int/dms_pubrec/itu-r/rec/s/R-REC-S.1003-2-201012-I!!MSW-E.docx)
- [ESA, Countdown to Cassini's Grand Finale](https://www.esa.int/Science_Exploration/Space_Science/Cassini-Huygens/Countdown_to_Cassini_s_Grand_Finale)

Mission examples
- [MinXSS-2 overview (arXiv)](https://arxiv.org/abs/1905.01345)
- [LASP MinXSS, 9 months on orbit](https://lasp.colorado.edu/minxss/2017/02/16/9-months-operating-on-orbit-anticipate-de-orbit-in-late-may/)
- [LASP MinXSS-1 deorbited](https://lasp.colorado.edu/minxss/2017/05/08/minxss-1-deorbited/)
- [Nanosats.eu, MinXSS](https://www.nanosats.eu/sat/minxss)
- [IXPE About](https://ixpe.msfc.nasa.gov/about/index.html)
- [MIT News, TESS selection](https://news.mit.edu/2013/nasa-selects-tess-for-mission-0405)
- [Spaceflight Now, Explorer selections 2013](https://spaceflightnow.com/news/n1304/08explorer/)
- [NASA TESS mission page](https://science.nasa.gov/mission/tess/)
- [Wikipedia, TESS](https://www.Wikipedia.org/wiki/TESS)
- [PACE mission overview, SPIE 2024 (NTRS)](https://ntrs.nasa.gov/citations/20240011592)
- [PopSci, PACE launch](https://popsci.com/science/nasas-pace-satellite-launch)
- [JPL Europa Clipper quick facts](https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/)
- [NASA OIG IG-19-019, Management of NASA's Europa Mission](https://oig.nasa.gov/docs/IG-19-019.pdf)
- [NASA OIG follow-up, Europa launch vehicle mandate](https://oig.nasa.gov/docs/Follow-uptoMay2019AuditofEuropaMission-CongressionalLaunchVehicleMandate.pdf)
- [SpacePolicyOnline, Europa Clipper baseline](https://spacepolicyonline.com/news/nasa-ig-urges-congress-to-remove-requirement-to-launch-europa-clipper-on-sls)
- [AIP FYI, 2019 Europa audit](https://www.aip.org/fyi/2019/audit-throws-cold-water-congress-europa-ambitions)
- [GAO-24-106767, NASA Assessments of Major Projects 2024](https://www.gao.gov/products/GAO-24-106767)
- [GAO-21-406, JWST](https://gao.gov/products/gao-21-406)
- [GAO-14-72, JWST](https://www.gao.gov/products/GAO-14-72)
- [NASA Webb mission page](https://science.nasa.gov/mission/webb/)
- [NASA release, Webb first images](https://www.nasa.gov/news-release/nasa-reveals-webb-telescopes-first-images-of-unseen-universe/)

Local project files
- [Design and Develop Science Missions webinar (local PDF)](../../reference-pdfs/nasa-design-and-develop-science-missions-2025.pdf)
- [Space Mission Concept Development Using Concept Maturity Levels (local PDF)](../../reference-pdfs/jpl-concept-maturity-levels-2013.pdf)
