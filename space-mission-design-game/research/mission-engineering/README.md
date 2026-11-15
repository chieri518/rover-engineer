# Mission Engineering Research

How real space missions are carried out from first idea to end of mission, and the trade-offs teams make along the way. This folder is background for designing the [Space Mission Design Game](../../challenge-brief.md). It is written for our team, not for players. Rover-specific research (rover design, surface survival, and operations) is in [../rover-engineering/](../rover-engineering/README.md).

Researched November 14, 2026. About 40,000 words across six files, with inline sources throughout.

## Reading order

| File | What it covers | Read it when |
| --- | --- | --- |
| [05-trade-offs-and-game-model.md](05-trade-offs-and-game-model.md) | **Start here.** A one-page mission walkthrough, a catalog of about 30 real trade-offs, considerations by phase, a simplified game model with formulas, suggested first-version scope, and open verification items | You want the big picture or need to decide what to build |
| [01-mission-lifecycle.md](01-mission-lifecycle.md) | Where missions come from (decadal surveys, competed and directed missions, cost caps), NASA's phases and reviews, technology readiness, science traceability, build and test, operations, end of mission, planetary protection, worked timelines (MinXSS, IXPE, TESS, PACE, Europa Clipper, JWST), and how CubeSats differ | You are designing mission phases, reviews, or scenario cards |
| [02-mission-design-orbits-launch.md](02-mission-design-orbits-launch.md) | 14 orbit types compared, orbital formulas with worked examples, drag lifetime, delta-v and transfers, launch vehicles with capacities and public prices, ground networks, operations concept, mission templates, space environment | You are building orbit, launch, or ground-contact mechanics |
| [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md) | The subsystem coupling matrix, instruments, power, thermal, structure, propulsion, attitude control, computing, telecom and link budgets, margins, redundancy, a three-tier component catalog, and worked sizing for a 6U CubeSat, a 500 kg smallsat, and a Mars link | You are building the spacecraft configuration screen or the simulation math |
| [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md) | Where the money goes, cost estimating, reserves and confidence levels, cost reference points, GAO cost-growth evidence, risk classes, failure statistics, 18 failure and recovery case studies, real on-orbit events, team roles, and 17 event-card ideas | You are building budget, risk, random events, or the debrief |

## Conventions

- **Sources.** Every factual number links to its source. NASA directives, GAO, NTRS, mission pages, standards, and peer-reviewed work are preferred.
- ***unverified*** marks values with a single or weak source. Do not quote these in the submission without checking them.
- **"Our analysis"** marks synthesis, calculations, and game suggestions, which are separate from official facts.
- **Feature IDs** such as MIS-01, RES-04, or EXT-05 refer to the [optional feature register](../../challenge-brief.md#optional-feature-register).
- **Game values.** NASA publishes no success odds by risk class, and many costs are not public. Any invented balancing number should be labeled as a game value in the game itself.

## Maintenance

Each file owns its topic, and the others link to it instead of repeating details. When a fact changes, update it in the owning file, then check [05](05-trade-offs-and-game-model.md) for the same number. Recheck launch prices, cost caps, and the governing NASA directives before the final submission, since they change most often.
