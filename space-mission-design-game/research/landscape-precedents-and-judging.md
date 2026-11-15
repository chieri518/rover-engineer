# Space Mission Design Game: Research and Planning

Our analysis for the [Space Mission Design Game](../challenge-brief.md) challenge, researched November 14, 2026. Everything here is planning analysis, not official NASA guidance. The official brief, feature register (IDs such as MIS-01 or RES-07), and resources are in [challenge brief](../challenge-brief.md); event-wide rules and judging are in [event guide](../../space-apps-2026-event-guide.md).

Quick navigation: [Comparable games](#comparable-games-and-tools) · [Past precedents](#past-space-apps-precedents) · [Judging evidence](#applying-the-judging-criteria) · [Open decisions](#open-decisions) · [Research notes](#research-notes) · [Game design →](../game-design.md) · [Mission engineering research →](mission-engineering/README.md) · [Rover engineering research →](rover-engineering/README.md) · [← Official challenge](../challenge-brief.md)

## Comparable games and tools

**Planning analysis, researched November 14, 2026.** This section supports the Creativity criterion's "documented comparison with existing learning games." Prices, release status, and third-party content can change, so recheck before citing any of it in the submission. Items marked *unverified* rest on a single weak source.

Feature key: **Obj** objective · **Sub** bus subsystem trades · **Pay** payload · **Orb** orbit choice · **LV** launch vehicle · **$** budget · **Data** data/downlink · **T** time · **Sim** simulation · **PMA** post-mission analysis · **MP** multiplayer roles · **RE** random events.

### Comparison

| Product | Format / audience | Covers | Strengths | Weaknesses for this challenge |
| --- | --- | --- | --- | --- |
| [Kerbal Space Program](https://www.kerbalspaceprogram.com) (2015) | Paid PC and console game; teens to adults | LV, Orb, Sim; partial Pay, $, Obj, Data in career mode (contracts, funds, CommNet) | The benchmark for intuition about orbits and rocketry, used informally in classrooms. Player counts hit a 10-year peak during Artemis II in 2026. | Steep learning curve, with effort going into piloting rather than design. No requirements flow-down, power/data budgets, or cost-vs-science trade. The funds economy is easy to break, and there are no co-op roles. |
| [Kerbal Space Program 2](https://en.wikipedia.org/wiki/Kerbal_Space_Program_2) | Early Access since 2023 | Same as KSP | — | Developer Intercept Games was reportedly closed in 2024. This is a warning about over-scoped simulation. |
| [Juno: New Origins](https://store.steampowered.com/app/870200/) (formerly SimpleRockets 2) | PC and mobile; low cost | LV, Orb, Sim; partial Obj | Runs on mobile, has procedural parts, and includes the Vizzy visual-programming tie-in | Rocket-centric, with no systems-engineering budgets or science-operations model |
| [Spaceflight Simulator](https://store.steampowered.com/app/1718870) | Free on mobile (paid on Steam); kids and teens | LV, Orb | Very approachable 2D orbits | No payload, power, data, budget, objectives, or analysis |
| [Mars Horizon](https://store.steampowered.com/app/765810/) (2020, Auroch Digital, with ESA and UK Space Agency input) | Paid PC and console game | Obj, $, LV and Pay through a tech tree, T, abstracted Sim, RE | Agency management with an ESA-informed feel. Its mission mini-game spends **navigation, comms, power, and data** against quotas, with heat, radiation, and drift events. This is the closest commercial analogue to the brief's resource layer. | Engineering is abstracted (no real mass/power values, no orbit trade). Reviews are mixed (Metacritic ~71), and play is competitive rather than role-based co-op. A sequel focused on astrobiology was announced for 2026; its release is *unverified*. |
| [Buzz Aldrin's Space Program Manager](https://store.steampowered.com/app/308270/) (2014) | Paid PC and iPad game | $, T, Obj, RE, program-level LV | Historical grounding and deep management | Hard to learn ("the lack of an in-game tutorial is crushing," per [TouchArcade](https://toucharcade.com/2015/03/24/buzz-aldrins-space-program-manager-for-ipad-review-almost-to-infinity-and-beyond)); no spacecraft subsystem design |
| [NASA Build It Yourself: Satellite!](https://science.nasa.gov/mission/webb/game-build-it-yourself/) (official resource) | Free in the browser; 3 levels | Obj, Pay, short Sim, PMA (compares the design with real missions) | Science goal → instrument chain. Non-viable options are greyed out. The "your design resembles mission X" payoff works well. | No mass, power, budget, bus, orbit, or launch-vehicle trades. Very short. Minimum screen of 1024 × 768 and limited accessibility. |
| [NASA Space Place CubeSat Builder](https://spaceplace.nasa.gov/cubesat-builder-game/en/) | Free in the browser; children | T, light Pay | Polished, and depicts real integration-and-test steps | A timed assembly game with no mission-level reasoning or budgets |
| [JPL Marsbound! Mission to the Red Planet](https://www.jpl.nasa.gov/edu/teach/activity/marsbound/) ([cards](https://www.jpl.nasa.gov/edu/pdfs/marsbound-cards.pdf), [full guide](https://www.jpl.nasa.gov/edu/pdfs/marsbound-fullguide.pdf)) | Free printable card activity; grades 3–12; 1–2 hours | Obj (science question), Sub (power options such as solar + battery, fuel cell, RTG; comms; computing; landing), Pay, LV (booster cards set mass limits), $ (teacher-set), RE (special-event cards), team review | **The closest match to the brief's systems-engineering loop.** Mass, power, and cost are explicit primary constraints. The build order runs objectives → instruments → vehicle parts → rocket by total mass → budget check. | Paper only, so bookkeeping is manual. No orbit mechanics, data volume or downlink, mission timeline, or defined roles. Mars only. |
| [JPL NASA Space Voyagers: The Game](https://www.jpl.nasa.gov/edu/learn/project/nasa-space-voyagers-the-game/) ([instructions](https://www.jpl.nasa.gov/edu/pdfs/spacevoyagers_instructions.pdf)) | Free print-and-play strategy card game; grades 6–12 | Obj, Pay, $ (resource cards buy spacecraft cards), RE (space events), MP | Played "individually or collaboratively by teams of up to four," the same group size as the brief. Its 49-card starter pack shows thematic hazards working at small scale. | Engineering is abstract: no subsystems, orbit, launch vehicle, power, or data |
| UNSW Canberra satellite mission design card activity (school outreach) | 30-minute card activity | Pay + Orb → derived bus requirements → subsystem selection → validation rules | Shows that "payload + orbit generate requirements" works as a core mechanic | Card contents and current availability are *unverified* (the host could not be reached) |
| Professional tools: [GMAT](https://software.nasa.gov/software/GSC-19468-1), Ansys/AGI STK, [Orbiter](https://www.orbiterwiki.org/wiki/Orbiter), NASA's Eyes on the Solar System, [NASA Mission Viz](https://nasa.github.io/mission-viz/) | Free or licensed analysis and visualization software | Orb, Sim, visualization | Can serve as fidelity references or validation baselines, and as inspiration for the visualization | No gameplay, scoring, or learning scaffolding. Too steep for the target learners. |

Not relevant after checking: ESA's *Mission X* is an astronaut fitness program, not mission design. ESA offers courses and competitions (CubeSat design weeks, Fly Your Satellite, CanSat) rather than a public satellite-builder game.

### Market gap

Existing products fall into three groups, and none covers the brief's full chain:

1. **Physics sandboxes** (KSP, Juno, Spaceflight Simulator, Orbiter) have rich launch and orbit simulation but skip requirements, payload operations, power and data budgets, and cost.
2. **Agency managers** (Mars Horizon, Buzz Aldrin) have budget, time, and random events but abstract the engineering.
3. **NASA/JPL learning games and activities** (Build It Yourself, CubeSat Builder, Marsbound, Space Voyagers) teach well but are either brief or paper-based.

This matches the brief's own diagnosis that "existing tools often focus on individual topics." The open position is a free browser game for beginner-to-intermediate players that covers objective → requirements → subsystems → payload → orbit → launch vehicle → resource budgets → visual simulation → explanatory debrief, with optional co-op roles. **Data volume and downlink budgets** are missing from nearly every comparable product, which makes them a strong point of difference.

### Design lessons

| Lesson | Evidence | Related IDs ([register](../challenge-brief.md#optional-feature-register)) |
| --- | --- | --- |
| Start from the science question, and close by comparing the design with a real NASA mission. | Build It Yourself, Marsbound, the CML 1 definition | MIS-01, EDU-06 |
| Let payload and orbit generate the bus requirements, so the flow-down is visible without jargon. | UNSW activity, CML 2 key performance parameters | MIS-02, ORB-02/03 |
| Show live budgets with hard limits and margins. Grey out or flag infeasible options instead of letting the player fail silently. | Marsbound worksheets, Build It Yourself, CML 4 "margins and reserves" | RES-07, ORB-05 |
| Score efficiency (for example, science per cost) and risk, not only pass or fail. | Marsbound's cost-per-science scoring *(scoring details unverified)* | EXT-01/02 |
| Keep the simulation short, visual, and abstracted; avoid piloting. | KSP's learning curve, KSP 2's scope failure, Mars Horizon's quota phases | CORE-04, EXT-05 |
| Make the debrief the teaching moment: which subsystem limited science, and what one more watt or kilogram would have bought (science partials). | Rare among comparable games; CML paper | EDU-05/06, EXT-10 |
| Give co-op roles a shared constraint pool, so each role's choices compete for the same mass, power, and budget. | Space Voyagers (up to four), CML independent-review guidance | COL-01–04 |
| Include onboarding and difficulty presets, starting with a guided scenario. | Criticism of Buzz Aldrin's onboarding; Marsbound's teacher-set budgets | EDU-01/04, EXT-04 |

## Past Space Apps precedents

**Planning analysis, researched November 14, 2026.** The 2018–2022 project pages were read on the archived Space Apps sites, and the award lists come from NASA's winner announcements. The 2023–2025 finalist and honorable-mention lists render client-side and were **not** retrieved; open the [2025 Global Finalists](https://www.spaceappschallenge.org/2025/awards/global-finalists/) page and its 2023/2024 equivalents in a browser to fill that gap. Event-wide winner patterns are in [the event reference](../../space-apps-2026-event-guide.md#lessons-from-past-winners).

### Related past challenges

| Year | Challenge | Relation to the 2026 brief |
| --- | --- | --- |
| 2021 | [The Trail to Mars: Can You Keep Your Crew Alive?](https://2021.spaceappschallenge.org/challenges/statements/the-trail-to-mars-can-you-keep-your-crew-alive/details) | **The closest precedent.** An educational game for ages 10–14 about a round trip to Mars, with ongoing and occasional risks, solar particle events, crew composition, mission length, and adjustable parameters. About 216 teams took part. |
| 2021 | [Planetary Lander Video Game](https://2021.spaceappschallenge.org/challenges/statements/planetary-lander-video-game) | A game about the descent and landing phase of a mission |
| 2021 | [Space Quest: The Game](https://2021.spaceappschallenge.org/challenges/statements/space-quest-the-game) | A space-agency game about missions and resources |
| 2018 | [Virtual Space Exploration](https://2018.spaceappschallenge.org/challenges/universe-beauty-and-wonder/virtual-space-exploration) | Its winner, a VR game, took Best Mission Concept |
| 2022 | [Outfitting a Mars Habitat](https://2022.spaceappschallenge.org/challenges/2022-challenges/mars-habitat) | Design under scarce resources; produced two Global Winners |
| 2023 | [Visualize a Space Mission Using Virtual Reality](https://www.spaceappschallenge.org/2023/challenges/visualize-a-space-mission-using-virtual-reality/) | Listed in the 2026 resources; an end-to-end mission explanation in 3D. Its winners were not researched. |
| 2023 | [Titan City, 3023](https://www.spaceappschallenge.org/2023/challenges/titan-city-3023/) | Many entries were colony and mission games; no global award is known |
| 2025 | Commercializing Low Earth Orbit | Mission economics and trade-offs; three Global Winners (below) |

### Relevant winning and finalist projects

| Project | Year / recognition | What it did | Takeaway |
| --- | --- | --- | --- |
| [Space Travelers](https://2021.spaceappschallenge.org/challenges/statements/the-trail-to-mars-can-you-keep-your-crew-alive/teams/space-travelers-1/project) (Guayaquil) | 2021 Global Winner, Best Storytelling (Trail to Mars) | Four player stats (health, food, physical state, happiness) mapped to NASA's five spaceflight hazards. Ship rooms restore stats, a random radiation-storm event draws on a NASA podcast, Mars mini-games follow, and science facts appear in the game itself. **Delivered only as a clickable Adobe XD prototype** plus a [video](https://www.youtube.com/watch?v=KD9mvQXZgHM). | Mechanics traced to documented NASA risks and a clear narrative arc can win without a full build. |
| [The Edge of Phobos](https://2021.spaceappschallenge.org/challenges/statements/the-trail-to-mars-can-you-keep-your-crew-alive/teams/lmc/project) (LMC, Ottawa) | 2021 Global Finalist | A branching Twine text adventure with original art and music; ignoring a hazard has consequences | Simple technology was enough when the consequences were meaningful |
| [Cosmos Unity Landing Simulator](https://2021.spaceappschallenge.org/challenges/statements/planetary-lander-video-game/teams/cosmos-unity/project) (Istanbul) | 2021 Global Finalist | Unity/C# on GitHub Pages: patched-conic orbits, a lander modeled on Perseverance, NASA Moon textures. **The score combines fuel saved and science data collected.** | An explicit resource-versus-science score |
| [Space Quest: The Card Game](https://2021.spaceappschallenge.org/challenges/statements/space-quest-the-game/teams/smk-pujut-educators/project) (SMK Pujut Educators, Miri) | 2021 Global Finalist | 4–6 players act as space agencies, managing funds and resources, with cooperation and sabotage cards. Aimed at underprivileged students. | A low-cost format plus a clear audience |
| [WanderSpace](https://2018.spaceappschallenge.org/challenges/universe-beauty-and-wonder/virtual-space-exploration/teams/that-vr-team/project) (that-vr-team, Sydney) | 2018 Best Mission Concept | A collaborative VR game for children built on planetary data (gravity and atmosphere on Earth, the Moon, and Mars), with a product roadmap and a plan to trial it in schools | Best Mission Concept has rewarded a game before. A vision beyond the event helped. |
| [tAMing particles](https://2022.spaceappschallenge.org/challenges/2022-challenges/mars-habitat/teams/taming-particles/project) (Vilnius) | 2022 Best Use of Technology | Interchangeable parts that combine into many tools to save scarce material; the demo was a Canva deck | Scarcity trade-off as the central idea |
| ASTROGENESIS (Peru) | 2023 Best Mission Concept | An interactive "space travel agency" for planning trips to planets and moons ([news coverage](https://andina.pe/agencia/noticia-nasa-premia-a-jovenes-peruanos-crear-una-agencia-viajes-espaciales-963669.aspx)) | Mission planning made consumer-friendly |
| Astro Sweepers / Photonics Odyssey / Gaia+LEO | 2025 Galactic Impact / Most Inspirational / Global Connection (Commercializing LEO) | Debris-risk index; satellite internet as infrastructure; co-design of orbital and ground data centers | Large real-world problems with quantified impact |

Other game winners: TeamVoyagers (2023 Storytelling, water-cycle web game), Space Quest Maidens (2023 Most Inspirational), TerraTales (2024 Storytelling, includes an eco-game), and Zumorroda-X (2025 Art & Technology, farming mini-games). Source: NASA's [2023](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/) and [2025](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/) announcements.

Best Mission Concept winners by year, for calibration: 2018 WanderSpace (VR game) · 2019 Spot Fire v2.0 · 2020 "Can You Hear Me Now?" (communications) · 2021 Mohakash (regolith tool attachment) · 2022 Mars 3D Home (3D-printed habitat items) · 2023 ASTROGENESIS · 2024 AsturExplorers (Landsat Connect) · 2025 PureFlow (habitat layout).

### Recent winners worth comparing (2023–2025)

These 2023–2025 Global Winners are not games about mission design, but each is a useful comparison for our entry.

| Winner | Recognized work | Useful comparison |
| --- | --- | --- |
| PureFlow — 2025, Best Mission Concept | Interactive habitat design and testing | Making engineering configuration and evaluation understandable |
| HerCode Space — 2025, Storytelling | Illustrated space-weather education | Defining a specific learning audience |
| Innovisionaries — 2024, Most Inspirational | Sustainability city-building game | Connecting resource decisions with a learning purpose |
| LunarTech Ensemble — 2023, Science | Lunar seismic visualization and an immersive game | Combining scientific information with an accessible experience |

Sources: [NASA’s 2025 winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/), [2024 winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/), and [2023 winners](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/).

### Patterns across these precedents (analysis)

1. **Every mechanic traces to a documented NASA constraint or hazard.** This supports both Validity and Relevance.
2. **A scarce-resource score** (fuel, budget, mass, crew health) makes trade-offs measurable.
3. **A clear audience and narrative arc,** often middle school, is common. This helps explain why game entries frequently win Storytelling and Most Inspirational rather than Best Use of Science.
4. **A coherent, polished slice can beat breadth.** Prototypes in Adobe XD, Twine, and Canva reached global recognition.
5. **NASA sources are cited inside the experience itself,** not only on the project page.
6. **A vision beyond the event,** such as school pilots or adjustable parameters for educators, appears repeatedly.

Plausible award targets for this challenge: **Best Mission Concept**, **Most Inspirational**, **Best Use of Storytelling**, and, if co-op play is strong, **Global Connection**. This is analysis, not a prediction.

## Applying the judging criteria

**Planning recommendations.** The [official rubric](../../space-apps-2026-event-guide.md#official-evaluation-criteria) is maintained in the event reference. Use the following evidence to assess the game; an internal score is not a NASA ranking formula.

| Criterion | Challenge-specific evidence to seek |
| --- | --- |
| Impact | A clearly identified learner and a demonstrated improvement in understanding an engineering trade-off. |
| Creativity | A documented comparison with existing learning games, explaining our distinct contribution. |
| Validity | Traceable scientific assumptions, consistent units, reproducible outcomes, and honest model limits. |
| Relevance | A complete connection between mission choices and outcomes, with NASA resources influencing actual behavior. |
| Presentation | A short, legible demonstration of a decision, its consequence, and what the player learns. |

For precedents, see the [event-wide past-winner patterns](../../space-apps-2026-event-guide.md#lessons-from-past-winners) and the [challenge-relevant precedents above](#past-space-apps-precedents). Visual polish supports communication; scientific claims still need evidence, and calculations need explanations a learner can understand.

### Scientific evidence and documentation

The following are recommended documentation practices, not challenge-mandated file formats.

| Record | Information to capture |
| --- | --- |
| Source register | Official URL, document/product version, retrieval date, relevant section or variable, citation, and reuse terms |
| Model assumptions | What is simulated, simplified, held constant, or omitted, and why the simplification is appropriate |
| Parameter definitions | Name, units, supported range, source, uncertainty, and whether measured, derived, estimated, or invented for game balance |
| Rule traceability | Player input → model rule → changed mission state → explanation shown to the player |
| Validation evidence | Reference calculation or expected behavior, observed result, tolerance, and unresolved limitations |
| Claim ledger | Each project claim, its supporting result, and where judges can inspect that evidence |

Keep power and energy distinct, and distinguish data volume from transmission rate. Record time units explicitly. If a value is an educational abstraction or a balancing choice, label it accordingly rather than presenting it as NASA engineering data.

A resource should have an identifiable contribution to rules, constraints, content, or validation. Record that contribution so the submission can explain its use precisely. NASA imagery used as decoration alone does not demonstrate the scientific basis of gameplay.

Choose validation appropriate to the mechanic: check units, coordinates, coverage, and interpretation for scientific visualizations; compare predictions with a suitable baseline and held-out data; test consequential feasibility constraints for mission concepts. For education, define what the player should learn and demonstrate how the interaction supports that goal.

## Open decisions

| Decision | What needs defining |
| --- | --- |
| Intended learner | Age/experience, learning setting, and the specific concept to teach |
| Mission scope | Mission objective, scenario, and the start/end of one playable session |
| Experience | Platform, input method, session length, and accessibility needs |
| Simulation fidelity | Which relationships need calculation and which can use explicit simplifications |
| Evidence | Sources that can support the chosen mechanics and claims |
| Collaboration | Whether shared play adds enough learning value to justify implementation work |
| Demonstration | The clearest observable learning moment and the evidence supporting it |

Decisions made since are recorded in [game design](../game-design.md). Only the challenge selection is settled. Choose a scope that can deliver one credible user journey during the event, then assign ownership for science/data, implementation, user experience, and communication. One person may cover multiple roles.

## Research notes

Comparable games were surveyed by web search and by checking product and NASA/JPL pages. The Marsbound and Space Voyagers details were confirmed against JPL's materials. Past precedents come from NASA's winner announcements and the archived 2018–2022 Space Apps project pages. The 2023–2025 finalist lists were not retrievable because they render client-side. Prices, release status, and third-party pages change, so recheck anything cited in the submission.

Feature IDs cited here (for example, EDU-05 or COL-01) are defined in the [feature register](../challenge-brief.md#optional-feature-register).
