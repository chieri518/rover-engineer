# Space Mission Design Game: Project Index

Everything for our entry to the 2026 [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/) challenge. Event-wide rules are in the [event guide](../space-apps-2026-event-guide.md). The workspace overview is in the [top-level README](../README.md).

**The concept in one line:** the player is a new rover engineer who designs a rover within a budget, buys it a launch ticket sized to its mass and size, then drives it in real-time 3D on the Moon, then Mars, then Titan. See the [game design](game-design.md#1-the-game-in-one-page).

## Documents

| Document | What it holds | Kind |
| --- | --- | --- |
| [game-design.md](game-design.md) | The working design: decisions, economy, milestones, rover slots, hazards, the Moon level, tech stack, open questions, build order | Living, team-owned |
| [rover-engineering-design.md](rover-engineering-design.md) | The rover design space: every component and instrument the game could offer, the constraints that tie them together, their mission properties, the payload bay, and which instruments each world offers | Living, team-owned |
| [implementation-plan.md](implementation-plan.md) | How the first version (the Moon mission) is built: scope, architecture, data files, phases with a submission cut, risks | Plan |
| [rover-engineering-implementation-plan.md](rover-engineering-implementation-plan.md) | How the payload bay, the new Moon instruments, part relationships, the engineering notebook, and the pre-launch review are built: data changes, phases, file map, tests, risks | Plan |
| [mars-rover-engineering-implementation-plan.md](mars-rover-engineering-implementation-plan.md) | Draft: how the Mars desk is built: a part catalog per world, parts that own their energy draws, the RTG and other Mars bus parts, the arm and mast, the first Mars instruments, new milestone triggers, Mars relationships, and the decisions still needed | Plan (draft) |
| [moon-sites-and-milestones-plan.md](moon-sites-and-milestones-plan.md) | New Moon sites and areas of interest, and the milestones that give all six Moon instruments something to earn: site kinds and placement, milestones with sources, the lessons spoiler guard, balance, rock types, phases, pipeline requests, decided questions | Plan |
| [rover-engineering-playtest-checklist.md](rover-engineering-playtest-checklist.md) | A short checklist for playing the payload bay, the six instruments, the five lessons, the notebook, and the pre-launch review in the browser | Checklist |
| [team-plan.md](team-plan.md) | How our two-person team splits design ownership after the first version, and what we decide together | Plan |
| [challenge-brief.md](challenge-brief.md) | The official brief, core outcomes, the optional feature register with IDs, the nine NASA resources, and notes on the two PDFs | Official material |
| [research/landscape-precedents-and-judging.md](research/landscape-precedents-and-judging.md) | Comparable games and the market gap, past Space Apps precedents, applying the judging criteria, open decisions from before the design | Analysis |

## Research folders

The game is rover-based, so **rover engineering is the main reference**. Mission engineering was researched first, for an orbital-spacecraft concept. It still covers launch, cost, risk, and lifecycle.

| Folder | Start with | Covers |
| --- | --- | --- |
| [research/rover-engineering/](research/rover-engineering/README.md) | [05 — trade-offs and game model](research/rover-engineering/05-rover-trade-offs-and-game-model.md) | 01 rover history · 02 subsystems · 03 surface environments and operations · 04 rover games and scenarios · 05 trade-offs and game model · 06 milestones and sustainment · 07 NASA data for the game |
| [research/mission-engineering/](research/mission-engineering/README.md) | [05 — trade-offs and game model](research/mission-engineering/05-trade-offs-and-game-model.md) | 01 mission lifecycle · 02 orbits and launch · 03 spacecraft subsystems · 04 cost, risk, and programmatics · 05 trade-offs and game model |

## Reference PDFs

| File | Original title | Summarized in |
| --- | --- | --- |
| [jpl-concept-maturity-levels-2013.pdf](reference-pdfs/jpl-concept-maturity-levels-2013.pdf) | *Space Mission Concept Development Using Concept Maturity Levels* (Wessen, Borden, Ziemer, Kwok; JPL, 2013) | [Challenge brief → CMLs](challenge-brief.md#resources) |
| [nasa-design-and-develop-science-missions-2025.pdf](reference-pdfs/nasa-design-and-develop-science-missions-2025.pdf) | *Design and Develop Science Missions* (NASA S3VI webinar, Julie Levri, March 26, 2025) | [Challenge brief → Design and Develop Science Missions](challenge-brief.md#resources) |

## Where to put new material

- A team decision goes in [game-design.md](game-design.md), with a status label.
- Official challenge or NASA facts go in [challenge-brief.md](challenge-brief.md).
- An event rule or deadline goes in the [event guide](../space-apps-2026-event-guide.md).
- New research goes in the folder for its topic. Update that folder's README, and link to facts instead of copying them.
- New source PDFs go in [reference-pdfs/](reference-pdfs/), named `agency-short-title-year.pdf`.
