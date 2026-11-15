# Rover Engineering Research

How planetary rovers are designed, delivered, operated, and kept alive, and the trade-offs behind each choice. This folder supports a game concept in which **the player designs a rover for a mission, a provided spacecraft delivers it, and the player keeps it alive and productive on the surface.** It is written for our team, not for players.

Researched November 14, 2026. About 48,000 words across nine files, with inline sources throughout. General mission engineering (lifecycle, orbits, launch, generic spacecraft subsystems, cost and risk) is in [../mission-engineering/](../mission-engineering/README.md).

## Reading order

| File | What it covers | Read it when |
| --- | --- | --- |
| [05-rover-trade-offs-and-game-model.md](05-rover-trade-offs-and-game-model.md) | **Start here.** The player's journey mapped to real missions, rover anatomy, a catalog of about 30 rover trade-offs, engineer considerations, why rovers die or last, a simplified sol-loop game model, how the concept fits the challenge brief, first-version scope, and open items | You want the big picture or need to decide what to build |
| [01-rover-missions-history.md](01-rover-missions-history.md) | 23 rovers compared (Lunokhod to Perseverance, Yutu-2, Zhurong, Pragyan, VIPER, Rosalind Franklin, Dragonfly and more), planned vs actual lifetimes, nine case studies, why missions ended, mission phases, what the delivery system constrains, and costs | You need real examples, end-of-mission causes, or delivery limits |
| [02-rover-subsystems.md](02-rover-subsystems.md) | The coupling map, mobility and terramechanics, solar and RTG power, batteries, thermal, comms and relay, autonomy and computing, arm and sampling, instruments, structure, dust and wear, a three-tier component catalog, and worked energy budgets | You are building the rover design screen or the energy math |
| [03-surface-environments-and-operations.md](03-surface-environments-and-operations.md) | Moon, Mars, and other destinations compared, Mars dust and seasons, the lunar night and poles, landing site selection, daily surface operations, survival strategies from real missions, and a hazard catalog | You are building the sol loop, seasons, events, or site choice |
| [04-rover-games-and-scenarios.md](04-rover-games-and-scenarios.md) | Existing rover games and classroom activities with a gap analysis, 12 mission cards based on real science goals, misconceptions, NGSS alignment, feedback design, and a solo-developer scope | You are designing mission cards, onboarding, or educational framing |
| [06-milestones-and-sustainment.md](06-milestones-and-sustainment.md) | Milestones NASA measures and how they are rewarded (extended missions, honor awards, the Collier Trophy), the eight pillars of keeping a rover mission going, and game rules: milestone rewards, sustainment rules, a rover health dashboard, and a senior review event | You are designing progression, achievements, or long-term survival rules |
| [07-nasa-data-for-the-game.md](07-nasa-data-for-the-game.md) | Real NASA datasets for the Moon mission (LRO terrain, sunlight and shadow, Diviner temperatures, M3 ice, moonquakes, DONKI solar flares, star maps), what each adds to play, effort and priority, a recommended site, and an orbital map layers idea | You are building the Moon map or choosing which NASA data to feature |
| [08-moon-surface-data.md](08-moon-surface-data.md) | Data for the drivable Moon surface: elevation for the play area and horizon, LROC and ShadowCam imagery for textures, rock and crater placement rules, and Apollo 15 soil numbers for driving and getting stuck | You are building the terrain, textures, obstacles, or driving physics |
| [09-titan-surface-data.md](09-titan-surface-data.md) | Data for the drivable Titan surface: Shangri-La dune sizes and orientation, Selk crater, Dragonfly's landing region and power, light, cold, air, day length, the 2034 season, methane rain and the Huygens site | You are building the Titan terrain, sky, rules or text |

## Conventions

- **Sources.** Every factual number links to its source. NASA, JPL, NSSDCA, NTRS, mission press kits, ESA, CNSA, ISRO, and peer-reviewed work are preferred.
- ***unverified*** marks values with a single or weak source. Check these before quoting them in the submission.
- **"Our analysis"** marks synthesis, calculations, fits, and game suggestions, which are separate from official facts.
- **Feature IDs** such as SPC-06 or RES-04 refer to the [optional feature register](../../challenge-brief.md#optional-feature-register).
- **Status dates.** Missions in progress (VIPER, CADRE, Rosalind Franklin, MMX, Dragonfly, Yutu-2) are described as of November 2026 and change often.

## Maintenance

Each file owns its topic and links to the others instead of repeating details. When a fact changes, update the owning file, then check [05](05-rover-trade-offs-and-game-model.md) for the same number.
