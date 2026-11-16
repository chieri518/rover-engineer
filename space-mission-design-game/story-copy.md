# Story context: copy deck

*Draft copy, November 15, 2026.* The player-facing text for the three additions in [story-onboarding-plan.md](story-onboarding-plan.md): the Welcome to REL intro, why REL is going to each site, and the short beats between worlds and at the end. The rules are in [game-design.md](game-design.md) §3 and §11. The implementation phase copies these strings into `game/data/text.json` and the Mars and Titan overlays; after that, this file stops being updated.

## How to read this file

- **Key paths.** Each block names a suggested key path. A path with no world named goes in `data/text.json`. "Mars overlay" and "Titan overlay" mean the same path in `data/mars/text.json` or `data/titan/text.json`, which deep-merge over the base (arrays replace), as `debrief.continue` and `dashboard.body` already do. Types go in `src/rules/types.ts`.
- **Placeholders.** `{name}`, filled from `missionVars()` in `src/ui/tutorialText.ts`. Values in brackets, such as `{nextMinimum}` (780), are today's data, shown for review only. No game number is written into the copy.
- **Rules for all copy.** Scientific and formal, plain English, short sentences. No characters, no dialogue, no exclamation marks. No research points. No calendar dates except the years in sourced facts. Every real-science claim cites a source the repo already uses.

---

## 1. Welcome to REL intro

Key path: `intro` (base only). Three pages, shaped like the tutorial pages (`{ title, body[] }`). Next, Back and the page count reuse `tutorial.next`, `tutorial.back` and `tutorial.step`.

| Key | Copy |
| --- | --- |
| `intro.heading` | Welcome to REL |
| `intro.skip` | Skip intro |
| `intro.done` | Go to the design desk |

### `intro.pages[0]`: Welcome to REL

- REL, the Rover Exploration Laboratory, designs and operates small robotic rovers.
- You are REL's newest rover engineer, at mission control. For each mission you design the rover, buy its launch ticket, and drive it on the surface.
- REL is fictional. The worlds, the ground under the rover and the missions the game cites are real, from NASA data and published sources.

### `intro.pages[1]`: Every mission must pay its way

- Each mission has a budget. The rover's parts and its launch ticket are paid from it, and work on the surface earns money back.
- After the mission, the balance must reach the **pass mark**: the amount REL needs to fund the next mission. On the Moon, the budget is {budget} (750) and the pass mark is {nextMinimum} (780). If the balance falls short, REL tries the same mission again.

### `intro.pages[2]`: Three worlds ahead

- **Mission 1 · The Moon.** The de Gerlache crater rim, near the south pole. Low sunlight, long shadows, and every kilogram counts.
- **Mission 2 · Mars.** Jezero crater, an ancient lake bed. A night every sol, cold, and dust.
- **Mission 3 · Titan.** The Shangri-La dunes on Saturn's largest moon. Almost no sunlight, constant cold, and one goal: survive.
- Each mission's results fund the next.

*Dropped from the earlier draft: the "How a mission works" page. The design tutorial already explains parts, mass and the ticket, and the desk, ticket, landing and debrief screens follow in order.*

---

## 2. Why REL is going to each site

### Moon kicker

| Key | Copy |
| --- | --- |
| `story.kicker` (base) | Mission 1 · The Moon, de Gerlache rim |
| `story.kicker` (Mars overlay) | Mission 2 · Mars, Jezero crater *(moved from `campaign.kicker`, unchanged)* |
| `story.kicker` (Titan overlay) | Mission 3 · Titan, Shangri-La dunes *(moved from `campaign.kicker`, unchanged)* |

### Site context

Key path: `story.site` (base for the Moon, the same key in each overlay). Shown at the top of the design desk's notes. Sources at `story.sources`, listed in the credits under `story.sourcesLabel` (base): "Site context".

**Moon** (base):

> REL's first rover goes to the rim of de Gerlache crater, near the lunar south pole. Some crater floors near the pole never see the Sun and can be as cold as about −248 °C; in 2009, NASA's LCROSS probe struck one of them, Cabeus crater, and found water in the debris. NASA has named a region on the de Gerlache rim as a candidate landing region for its Artemis III crewed mission.

Sources (`story.sources`): NASA SVS 11230, Diviner temperatures of the lunar poles (svs.gsfc.nasa.gov/11230); Colaprete et al. (2010), Detection of water in the LCROSS ejecta plume, Science 330:463, doi:10.1126/science.1186986; NASA release 24-136, NASA provides update on Artemis III Moon landing regions (nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/). All three are already cited in `data/milestones.json`.

*The Artemis sentence says "a region on the de Gerlache rim" on purpose: it does not claim the play area lies inside De Gerlache Rim 2.*

**Mars** (overlay):

> Mission 2 goes to Jezero crater on Mars. About 3.5 billion years ago the crater held a lake, fed by a river that built a delta at its edge. NASA's Perseverance rover landed here in 2021 and has drilled rock cores from that delta.

Sources: NASA JPL, Mars 2020 Landing Press Kit: Landing Site (jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/landing_site/), already in `mars/text.json` `campaign.sources`; NASA JPL, NASA's Perseverance Rover Investigates Geologically Rich Mars Terrain (jpl.nasa.gov/news/nasas-perseverance-rover-investigates-geologically-rich-mars-terrain/), already in `mars/milestones.json`.

**Titan** (overlay):

> The program's last rover goes to the Shangri-La dunes on Titan, Saturn's largest moon. The dune sand is thought to be organic material, and nobody has sampled it yet. Nearby Selk crater may once have held liquid water mixed with organic material, and NASA's Dragonfly mission is headed for this region.

Sources: Lorenz et al. (2021), Planet. Sci. J. 2:24, doi:10.3847/PSJ/abd08f; NASA Science, Dragonfly (science.nasa.gov/mission/dragonfly/). Both already in `titan/milestones.json` and `titan/text.json`.

*How Dragonfly travels stays out: the Titan debrief teaches it.*

### Landing line

No new copy. The landing screen shows the existing `mission.briefing` under `landing.briefing`. Two small edits so no game number is written into the copy, filled with `missionVars()`:

| Key | Today | Change to |
| --- | --- | --- |
| `mission.briefing` (base) | Fourteen days of daylight. The Sun stays low and circles the horizon. | {days} days of daylight. The Sun stays low and circles the horizon. |
| `mission.briefing` (Mars overlay) | Ten sols at Jezero crater. The Sun sets every sol: lights on to keep driving, or sleep until dawn. | {sols} sols at Jezero crater. The Sun sets every sol: lights on to keep driving, or sleep until dawn. |

Titan's `mission.briefing` has no number and stays.

---

## 3. Beats between worlds and at the end

### Debrief

Key paths: `debrief.storyPassed` and `debrief.storyFailed` (base for the Moon, the same keys in each overlay). Shown after the existing pass or fail line, above the buttons. An empty string is not shown.

| World | `storyPassed` | `storyFailed` |
| --- | --- | --- |
| Moon (base) | The board has reviewed the lunar results and approved REL's second mission: a rover for Jezero crater on Mars. Mars adds what the Moon did not have: a night every sol, cold everywhere, and dust. | On these results, REL cannot fund the next mission. The board has approved another attempt at the de Gerlache rim, and the engineering notebook keeps what this rover learned. |
| Mars (overlay) | The Jezero results fund the program's last mission: a rover for the Shangri-La dunes on Titan, Saturn's largest moon. Titan takes away the sunlight. The battery is the budget, and the cold never lets up. | On these results, REL cannot fund the mission to Titan. The board has approved another attempt at Jezero crater, and the engineering notebook keeps what this rover learned. |
| Titan (overlay) | *(empty: Campaign complete carries the end)* | The rover did not survive the Titan day. The board leaves the choice to mission control: another attempt, or closing the program here. |

### Campaign complete

Key paths: `dashboard.storySurvived` and `dashboard.storyLost` (base). Shown under the dashboard heading and body; the one shown matches the "Final mission survived" tile. Nothing is shown when that outcome is not recorded.

| Key | Copy |
| --- | --- |
| `dashboard.storySurvived` | REL's three-world program is complete, and its last rover survived the Titan day. Each world asked for a different rover: on the Moon every kilogram counted, on Mars the nights were cold, and on Titan the battery carried the rover with almost no sunlight. |
| `dashboard.storyLost` | REL's three-world program is closed, with Titan marked not survived. Each world asked for a different rover: on the Moon every kilogram counted, on Mars the nights were cold, and on Titan there was almost no sunlight and no let-up from the cold. |

---

## Data the UI will need

| Need | Used by | Suggestion |
| --- | --- | --- |
| `{budget}`, the starting budget | Intro page 2 | `tuning.budget.startingBudget` added to `missionVars()` as a money string |
| `{days}`, `{sols}` in `mission.briefing` | Landing line | Already in `missionVars()`; the landing screen fills `mission.briefing` with it |
