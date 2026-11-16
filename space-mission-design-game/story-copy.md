# Story and onboarding: copy deck

*Draft copy, November 15, 2026.* All new player-facing text for items S0 to S7 of [story-onboarding-plan.md](story-onboarding-plan.md), written in one pass so the documents read as one program. The rules for it are in [game-design.md](game-design.md) §3 ([Story documents in the loop](game-design.md#3-campaign-the-outer-loop)) and §11 ([Story through documents](game-design.md#story-through-documents)). This file is the source for the strings; the implementation phases copy them into `game/data/text.json` and the Mars and Titan overlays, then this file stops being updated.

## How to read this file

- **Key paths.** Each block names a suggested JSON key path. A path with no world prefix goes in `data/text.json`. "Mars overlay" and "Titan overlay" mean the same path in `data/mars/text.json` or `data/titan/text.json`, which deep-merge over the base (arrays replace). So the Moon's copy is the base, and the other worlds override the same keys. Types go in `src/rules/types.ts`.
- **Placeholders.** `{name}` as in `text.json`. Existing ones come from `missionVars()` in `src/ui/tutorialText.ts` (`{minutes}`, `{days}`, `{maxSlope}`, `{warningSeconds}`, `{sols}`, `{stormLeadSols}`, `{stormSols}`, `{stormSolarPercent}`, `{nightMinutes}`, `{nightClockRate}`, `{rainWarningSeconds}`, `{rainSeconds}`, `{balance}`, `{nextMinimum}`, `{tiers}`, `{bayMin}`, `{bayMax}`). New ones are listed in [Data the UI will need](#data-the-ui-will-need).
- **Numbers.** No game number is written into the copy. Values in brackets after a placeholder, such as `{nextMinimum}` (780), are today's data values, shown for review only.
- **Rules for all copy.** Scientific and formal, plain English, short sentences. No exclamation marks, no jokes. No characters and no dialogue: documents are signed by REL offices. No mention of research points (decision 2). Mission-relative times only; the only calendar dates are a real flare's date and the years in sourced history facts. Every real-science claim names a source; anything not yet checked is marked *(to fact-check)*.

### Offices and document numbers

| Office | Issues |
| --- | --- |
| REL Mission Operations | Onboarding packet (REL-OP-000), mission orders (REL-MO-001 to 003), mission reports (REL-MR-001 to 003), the failed-round note (REL-MO-N) |
| REL Launch Services | Launch manifests (REL-LM-001 to 003) |
| Automatic, lander | Landing reports (REL-LR-001 to 003) |
| Automatic, rover | Rover system log |
| REL Weather Desk | Weather alerts (REL-WX) |
| REL Public Affairs | Bulletins (REL-PA-001 to 003) |
| REL Archive | Archive cards |

The number is the mission number (001 Moon, 002 Mars, 003 Titan). A retry reuses its world's numbers.

---

## S0. Document style

Key path: `doc`

| Key | Copy |
| --- | --- |
| `doc.agency` | REL · Rover Exploration Laboratory |
| `doc.numberLabel` | Document |
| `doc.issuedBy` | Issued by {office} |
| `doc.phase.prelaunch` | Mission {n} · Pre-launch |
| `doc.phase.surface` | Mission {n} · {stamp} |
| `doc.phase.end` | Mission {n} · End of mission |
| `doc.phase.between` | Between Mission {n} and Mission {next} |
| `doc.phase.onboarding` | Before Mission 1 |
| `doc.skip` | Skip |
| `doc.stamps.approved` | APPROVED |
| `doc.stamps.filed` | FILED |
| `doc.stamps.purchased` | TICKET PURCHASED |
| `doc.stamps.cleared` | CLEARED FOR LAUNCH |
| `doc.stamps.notAccepted` | NOT ACCEPTED |
| `doc.stamps.passed` | PASS MARK MET |
| `doc.stamps.failed` | BELOW PASS MARK |
| `doc.stamps.survived` | SURVIVED |
| `doc.stamps.notSurvived` | NOT SURVIVED |
| `doc.offices.ops` | REL Mission Operations |
| `doc.offices.launch` | REL Launch Services |
| `doc.offices.lander` | Automatic report, lander |
| `doc.offices.rover` | Automatic record, rover |
| `doc.offices.weather` | REL Weather Desk |
| `doc.offices.public` | REL Public Affairs |
| `doc.offices.archive` | REL Archive |

`{stamp}` in `doc.phase.surface` is the log timestamp (below): "Day 3", "Sol 4" or "Earth day 9".

---

## S1. Onboarding packet

Key path: `intro`. Document REL-OP-000, issued by REL Mission Operations, phase "Before Mission 1".

| Key | Copy |
| --- | --- |
| `intro.heading` | Onboarding packet |
| `intro.number` | REL-OP-000 |
| `intro.next` | Next |
| `intro.back` | Back |
| `intro.skip` | Skip |
| `intro.done` | Read the first mission order |
| `intro.step` | Page {n} of {total} |
| `title.about` | About REL |
| `title.aboutHint` | Reopen the onboarding packet |

### `intro.pages[0]`: Welcome to REL

**Title:** Welcome to REL

- REL, the Rover Exploration Laboratory, designs and operates small robotic rovers. REL does not build rockets. For each mission it buys space for its rover on a commercial launch.
- You join REL as its newest rover engineer, at mission control. For each mission you design the rover, buy its launch ticket, and drive it on the surface once it lands.
- REL is fictional. The worlds, the terrain under the rover and the missions these documents cite are real, from NASA data and published sources.

### `intro.pages[1]`: How a mission works

**Title:** How a mission works

Shown as a strip of six steps, each with one line (`intro.pages[1].steps`):

| Step | Line |
| --- | --- |
| Mission order | The objective, the site, the budget and the hazards. |
| Design | Choose the parts. Every part costs money and adds mass. |
| Launch ticket | Mass and size set the ticket tier and its price. |
| Landing | The lander sets the rover down at a fixed site. |
| Drive | Drive in real time. Reach milestones, and keep the rover alive. |
| Mission report | What the mission returned, and what it cost. |

**Body:** Each world repeats these steps. What changes is the world.

### `intro.pages[2]`: The rule that keeps REL running

**Title:** The rule that keeps REL running

- Each mission has a budget. The rover's parts and its launch ticket are paid from it.
- Work on the surface pays it back: each milestone reached has a reward, and a rover that lasts the full mission earns a payout. A lost rover costs a penalty.
- After the mission, the balance must reach the **pass mark**: the amount REL needs to fund the next mission. If it falls short, the board orders another attempt at the same site, starting again from the balance at the start of that round.
- On Mission 1 the budget is {budget} (750) and the pass mark is {nextMinimum} (780). The mission must earn back more than it costs.
- The last mission is judged on survival alone. Its order explains.

### `intro.pages[3]`: The program ahead

**Title:** The program ahead

| World | Line |
| --- | --- |
| Mission 1 · The Moon | The de Gerlache crater rim, near the lunar south pole. One long lunar day of low sunlight. The puzzle: mass against cost. |
| Mission 2 · Mars | Jezero crater, an ancient lake bed. Day and night every sol, cold nights and dust. |
| Mission 3 · Titan | The Shangri-La dunes on Saturn's largest moon. Almost no sunlight and constant cold. |

**Body:** Each mission's results fund the next. The first mission order follows.

---

## S2. Mission orders

### Shared labels

Key path: `order.labels` (base only).

| Key | Copy |
| --- | --- |
| `order.labels.heading` | Mission order |
| `order.labels.mission` | Mission |
| `order.labels.site` | Site |
| `order.labels.length` | Length |
| `order.labels.objective` | Objective |
| `order.labels.why` | Why this site |
| `order.labels.budget` | Budget |
| `order.labels.passMark` | Pass mark |
| `order.labels.ifMissed` | If the pass mark is missed |
| `order.labels.hazards` | Hazards |
| `order.labels.approaches` | Approaches on file |
| `order.labels.approachesNote` | REL planning studies. Other designs can work. |
| `order.labels.sources` | Sources |
| `order.labels.toDesk` | Go to the design desk |
| `order.labels.reopen` | Mission order |
| `order.labels.reopenHint` | Reopen the mission order |

Each world's content is at `order` in its own file: the Moon in the base, Mars and Titan in their overlays. Arrays (`why`, `hazards`, `approaches`) replace.

### REL-MO-001: The Moon

Key path: `order` (base). Phase "Mission 1 · Pre-launch".

| Key | Copy |
| --- | --- |
| `order.number` | REL-MO-001 |
| `order.opening` | REL Mission Operations orders the program's first rover mission. |
| `order.mission` | Mission 1 · The Moon |
| `order.site` | The de Gerlache crater rim, near the lunar south pole |
| `order.length` | {days} days of lunar daylight (14) |
| `order.objective` | Operate a rover on the de Gerlache rim for {days} days of lunar daylight, and return enough to cover the rover and its launch ticket. |
| `order.budget` | {budget} (750). The rover's parts and its launch ticket are paid from it. |
| `order.passMark` | {nextMinimum} (780). After the mission, the balance must reach this amount to fund Mission 2. |
| `order.ifMissed` | The board orders another attempt at the same site. The balance and the records held return to their values at the start of the round. The engineering notebook is kept. |

**`order.why`** (each item: a short bold lead, a body, and its source in `order.whySources`, same order):

1. **Ice in the cold traps.** Some crater floors near the south pole never see the Sun. NASA's LRO Diviner instrument measured some of them as cold as about 25 K (−248 °C). In 2009, NASA's LCROSS impact at Cabeus crater found water in the plume, about 5.6% by mass.
   Source: NASA SVS 11230, Diviner temperatures of the lunar poles (svs.gsfc.nasa.gov/11230); Colaprete et al. (2010), Science 330:463, doi:10.1126/science.1186986. (Both already cited in `milestones.json`.)
2. **A low Sun.** At the pole the Sun circles close to the horizon. Shadows are long, and they move across the ground at about the speed of a rover.
   Source: Shirley and Balaban (2022), VIPER mission planning, SpaceOps, NTRS 20220008301 (ntrs.nasa.gov/citations/20220008301). (Cited in [rover-engineering/03](research/rover-engineering/03-surface-environments-and-operations.md#the-south-pole-low-sun-long-shadows-ice-and-earth-below-the-horizon).)
3. **Earth on the horizon.** From the south pole, Earth sits near the horizon, and the terrain can hide it.
   Source: Gorkavyi et al. (2023), Atmos. Meas. Tech. 16:1527, doi:10.5194/amt-16-1527-2023; NASA SVS 4944. (Cited in `milestones.json`.)
4. **A candidate for crewed landings.** In 2024, NASA named De Gerlache Rim 2 as one of nine candidate regions for the Artemis III crewed landing. *(to fact-check: that the game's play area lies inside the De Gerlache Rim 2 region; if not, say "a region on the de Gerlache rim".)*
   Source: NASA release 24-136 (nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/). (Cited in `milestones.json`.)
5. **Real ground.** The terrain under the rover is NASA LRO data: LOLA elevation and LROC images.
   Source: the credits' terrain and imagery entries.

**`order.hazards`:**

- Low, moving sunlight. The solar panel charges only in sunlight, and a sunny spot can fall into shadow.
- Permanent shadow. It is very cold. Lights are required to enter; a heater slows freezing.
- Soft ground in the boulder fields. A heavy rover or weak wheels can dig in and stay stuck.
- Slopes steeper than {maxSlope}° (20) and hard impacts damage the rover. A rollover ends the mission.
- Solar flares, with a warning {warningSeconds} s (6) ahead: power down or move into shadow. One moonquake.

**`order.approaches`** (roles, not builds):

| Role | Line |
| --- | --- |
| Scout | A camera rover. Photographs the layered crater wall, the views from the rim, and Earth on the horizon. |
| Geologist | A drill rover. Samples the regolith at sites far from the lander and from each other. |
| Ice hunter | Goes into the permanent shadow to search for the ice. It needs lights to enter, a heater to stay, and a drill to sample. The highest return, with the least margin. |

### REL-MO-002: Mars

Key path: `order` (Mars overlay). Phase "Mission 2 · Pre-launch".

| Key | Copy |
| --- | --- |
| `order.number` | REL-MO-002 |
| `order.opening` | Following bulletin REL-PA-001, the board has funded a second rover mission. Mars adds what the Moon did not have: nights, cold everywhere, and dust. |
| `order.mission` | Mission 2 · Mars |
| `order.site` | The floor of Jezero crater, east of an ancient river delta |
| `order.length` | {sols} sols (10) |
| `order.objective` | Operate a rover on the floor of Jezero crater for {sols} sols, through every night, and return enough to fund Mission 3. |
| `order.budget` | Balance carried over from the Moon: {balance}. Parts and launch ticket tiers are the Moon's in this version. |
| `order.passMark` | {nextMinimum} (800). After the mission, the balance must reach this amount to fund Mission 3. |
| `order.ifMissed` | The board orders another attempt at Jezero. The balance and the records held return to their values at the start of the Mars round. The engineering notebook is kept. |

**`order.why`:**

1. **A lake that dried up.** Jezero crater is about 45 km wide. About 3.5 billion years ago it held a lake, fed by a river.
   Source: NASA JPL, Mars 2020 Landing Press Kit: Landing Site. (Already cited in `mars/text.json` `campaign.sources`.)
2. **A delta at the lake's edge.** The river built a delta, first described from orbit in 2005. Perseverance's images of its layers confirmed that the lake was there.
   Source: Fassett and Head (2005), GRL 32, doi:10.1029/2005GL023456; Mangold et al. (2021), Science 374, doi:10.1126/science.abl4051. (Cited in `mars/text.json` `survey._sources` and `mars/milestones.json`.)
3. **Where the evidence is kept.** NASA's Perseverance rover landed here in 2021. The crater floor turned out to be volcanic rock. The lake's mud is in the delta, where Perseverance drilled the "Wildcat Ridge" core in 2022.
   Source: NASA JPL, NASA's Perseverance Rover Investigates Geologically Rich Mars Terrain. (Cited in `mars/milestones.json`.)
4. **Real ground.** The terrain is the USGS elevation model made from HiRISE images for Perseverance's landing.
   Source: USGS Mars 2020 Terrain Relative Navigation data release (credits).

**`order.hazards`:**

- Night every sol. Lights let the rover keep driving, at a high battery cost; or it sleeps until dawn. Without lights it cannot drive at night.
- Night cold, everywhere on the map. A heater slows freezing.
- One regional dust storm, forecast about {stormLeadSols} sol (1) ahead. For about {stormSols} sols (2), solar income falls to about {stormSolarPercent}% (33).
- Séítah's sand ripples are soft ground.

**`order.approaches`:**

| Role | Line |
| --- | --- |
| Delta imager | A camera rover. Photographs the layers of the delta front, and a sunset away from the lander. |
| Core sampler | A drill rover. Drills rock cores at sites far from the lander and from each other. |
| Night operator | Lights and a heater. Keeps driving through the nights and rides out the dust storm. |

### REL-MO-003: Titan

Key path: `order` (Titan overlay). Phase "Mission 3 · Pre-launch".

| Key | Copy |
| --- | --- |
| `order.number` | REL-MO-003 |
| `order.opening` | Following bulletin REL-PA-002, the board has funded the program's last mission. On Titan, the measure changes: this rover must survive. |
| `order.mission` | Mission 3 · Titan |
| `order.site` | A firm interdune corridor in the Shangri-La dune field, near Selk crater |
| `order.length` | One Titan day, about 16 Earth days |
| `order.objective` | Keep the rover running through one full Titan day: the rest of this day, the long night, and the dawn that follows. |
| `order.budget` | Balance carried over from Mars: {balance}. Parts and launch ticket tiers are the Moon's in this version. |
| `order.passMark` | None. This mission is judged on survival: the rover must still be running at the end of the {minutes}-minute mission (15). A sleeping rover counts as running. The balance does not decide it. |
| `order.ifMissed` | If the rover is lost, Titan can be tried again from the start of the Titan round, or the program can close with Titan marked not survived. |

`order.labels.passMark` reads "Pass mark" on all worlds; on Titan the value says "None" and why. *(The Titan overlay may override the label as "Goal" if the lead prefers.)*

**`order.why`:**

1. **Organic sand.** Titan's dark dune sand is thought to be organic material, not rock like most sand on Earth. No one has sampled it yet.
   Source: Lorenz et al. (2021), Planet. Sci. J. 2:24, doi:10.3847/PSJ/abd08f; Radebaugh et al. (2008), Icarus 194:690. (Cited in `titan/milestones.json`.)
2. **Selk crater.** An impact crater about 80 km across. The impact may have melted ice into liquid water that mixed with organic material.
   Source: Lorenz et al. (2021); NASA Science, Dragonfly (science.nasa.gov/mission/dragonfly/). (Cited in `titan/milestones.json`.)
3. **Where NASA is going.** NASA's Dragonfly mission is headed for this region, near Selk.
   Source: NASA Science, Dragonfly. (Cited in `titan/text.json`.) *How Dragonfly travels is left to the debrief, which teaches it.*
4. **Deep cold, little light.** It is about −179 °C, day and night. An orange haze lets little sunlight reach the ground.
   Source: NASA Science, Titan: Facts (science.nasa.gov/saturn/moons/titan/facts/). (Cited in `titan/text.json`.)
5. **Modeled ground.** The dunes are generated from Cassini radar measurements of their size and spacing. They are not real elevation data.
   Source: the credits' Titan terrain entry.

**`order.hazards`:**

- Almost no solar power. The battery is the energy budget for the whole mission.
- Constant cold. Awake, the electronics and a heater keep the rover warm. Asleep, in the rain, or without a heater, it cools.
- One long night of about {nightMinutes} minutes (7.5). Lights let the rover drive; or it sleeps, and time passes {nightClockRate} times (4) faster until dawn.
- One methane rainstorm, forecast about {rainWarningSeconds} s (60) ahead. Photographs do not count in the rain, and the rover cools faster.
- Dark dune sand is soft. The bright interdune corridors are firm.

**`order.approaches`:**

| Role | Line |
| --- | --- |
| Endurance | The most stored energy and steady heat. Sleeps through the long night. Low returns, the best chance to survive. |
| Night operator | Lights and a large battery. Keeps working through the night, at a steep energy cost. |
| Surveyor | Reaches the dune crest with a camera, or the Selk ejecta field with a drill, before nightfall, then rests. |

---

## S3. Rover system log and weather alerts

### Format

- A line reads `LOG · <status> · <hint>`, under 70 characters, with its timestamp beside it in the log panel.
- Timestamps (`log.stamp`): Moon `Day {day}` (1 to 14); Mars `Sol {sol}` (1 to 10); Titan `Earth day {day}` (1 to 16, Earth days since landing, because the mission is a single Titan day). Whole days only, so the log is not a clock.
- Each line fires at most once per mission, when its trigger first holds. Thresholds that are not already in data go in `tuning.json` → `roverLog` (see [Data the UI will need](#data-the-ui-will-need)).
- Lines about a part the rover does not carry do not fire (no hydrogen line without the neutron spectrometer, no camera hint without a camera).

| Key | Copy |
| --- | --- |
| `log.heading` | Rover system log |
| `log.prefix` | LOG |
| `log.stamp` | Day {day} (Mars overlay: `Sol {sol}`; Titan overlay: `Earth day {day}`) |

### Moon: first-drive coaching

Key path: `log.coach` (base only). Fires on the first Moon drive only, when the Moon drive tutorial has not been seen (game-design.md §3). Replaces most of the drive tutorial; the short controls page stays.

| Key | Line | Trigger |
| --- | --- | --- |
| `log.coach.drive` | LOG · Drive systems ready · W A S D or arrows to drive | Mission start, once the rover is on the ground |
| `log.coach.brake` | LOG · Moving · Space to brake | The rover first moves |
| `log.coach.leads` | LOG · Survey leads loaded · arrows on the map edge | The rover has driven 50 m |
| `log.coach.battery` | LOG · Battery {pct}% · stop in sunlight to recharge | Battery first falls to 50% |
| `log.coach.payload` | LOG · Payload ready · keys 1 to {count} use instruments | First time the rover stops 100 m or more from the lander, with an instrument aboard |
| `log.coach.flare` | LOG · Flare inbound · press P to power down | The first flare warning starts |
| `log.coach.powerUp` | LOG · Flare passed · press P to power up | The first flare passes while the rover is powered down |
| `log.coach.notebook` | LOG · Notebook entry written · press N to read | The first engineering notebook entry of the mission |

### Moon: every visit

Key path: `log` (base).

| Key | Line | Trigger |
| --- | --- | --- |
| `log.firstMilestone` | LOG · First milestone recorded · {name} | The first milestone of the mission |
| `log.earth` | LOG · Earth above the horizon · camera ready | Earth first in view and photo-ready: lit enough, and far enough from the lander, for the photo to count; camera aboard |
| `log.shadow` | LOG · Panel output 0% · entering permanent shadow | The rover first enters permanent shadow |
| `log.hydrogen` | LOG · Hydrogen counts rising · buried ice may be near | Neutron spectrometer on, and its meter first passes half scale |
| `log.lowEnergy` | LOG · Battery {pct}% · find sunlight or power down | The low-battery warning first shows |
| `log.cold` | LOG · Cold {pct}% · leave the shadow to warm up | The cold meter first passes 50% |
| `log.damage` | LOG · Damage {pct}% · avoid rocks and steep ground | The damage meter first passes 50% |
| `log.lastStretch` | LOG · Day {day} of {days} · final stretch of daylight | The last day of the mission begins |

### Mars: every visit

Key path: `log` (Mars overlay). The Moon lines `log.earth`, `log.shadow`, `log.hydrogen` and `log.cold` do not fire on Mars; the Mars overlay sets them to empty strings, which the log skips.

| Key | Line | Trigger |
| --- | --- | --- |
| `log.firstMilestone` | LOG · First milestone recorded · {name} | The first milestone of the mission |
| `log.sunset` | LOG · Sunset · panel off, lights on or sleep | Each sunset is a notice already; the log line fires at the first sunset only |
| `log.sleep` | LOG · Entering sleep · wake at dawn | The rover first powers down at night |
| `log.dawn` | LOG · Dawn · panel charging, first night survived | The first dawn |
| `log.nightCold` | LOG · Cold {pct}% · freezing at night, dawn warms the rover | The cold meter first passes 50% at night |
| `log.stormForecast` | LOG · Storm forecast received · charge up now | The dust storm forecast arrives |
| `log.storm` | LOG · Dust storm · panel output down to {stormSolarPercent}% | The storm reaches full strength |
| `log.stormClear` | LOG · Storm cleared · full panel output | The storm ends |
| `log.sand` | LOG · Wheel slip rising · sand ripples, ease off | The first slip warning in Séítah |
| `log.perseverance` | LOG · Perseverance landing site located · see map | The rover first discovers Perseverance's landing site |
| `log.lowEnergy` | LOG · Battery {pct}% · recharge by day or sleep | The low-battery warning first shows |
| `log.damage` | LOG · Damage {pct}% · avoid rocks and steep ground | The damage meter first passes 50% |
| `log.lastStretch` | LOG · Sol {sol} of {sols} · final sol | The last sol begins |

### Titan: every visit

Key path: `log` (Titan overlay). The Moon-only lines are empty, as on Mars.

| Key | Line | Trigger |
| --- | --- | --- |
| `log.start` | LOG · Panel output near zero · battery is the budget | Mission start |
| `log.firstMilestone` | LOG · First milestone recorded · {name} | The first milestone of the mission |
| `log.sand` | LOG · Wheel slip rising · dark sand is soft, ease off | The first slip warning |
| `log.sunsetSoon` | LOG · Light falling · long night begins soon | The sunset-soon notice |
| `log.sunset` | LOG · Sunset · lights on or sleep until dawn | Sunset |
| `log.sleep` | LOG · Sleep mode · time runs {nightClockRate}× until dawn | The rover first sleeps at night |
| `log.sleepCold` | LOG · Cold {pct}% · power up to warm the electronics | The cold meter first passes 50% while asleep |
| `log.rainForecast` | LOG · Rain forecast received · park on known ground | The rain forecast arrives |
| `log.rain` | LOG · Methane rain · cooling faster, photos paused | The rain starts |
| `log.rainClear` | LOG · Rain cleared · visibility returning | The rain ends |
| `log.lowEnergy` | LOG · Battery {pct}% · no recharge here, sleep to save energy | The low-battery warning first shows |
| `log.damage` | LOG · Damage {pct}% · avoid rocks and steep ground | The damage meter first passes 50% |
| `log.dawn` | LOG · Dawn · night survived, battery {pct}% | Dawn |
| `log.lastStretch` | LOG · Dawn holding · keep the rover running to the end | 30 s after dawn, if the rover is still running |

### Weather alerts

Key path: `alerts`. Issued by REL Weather Desk. Each alert has a full form (a notice, formatted as a document) and a short form (the countdown bar). The short forms replace `warnings.flareWarning`'s place in the bar; the existing Mars `storm.*` and Titan `rain.*` notices stay for start and end.

**Solar flare** (base):

| Key | Copy |
| --- | --- |
| `alerts.flare.title` | Space weather alert · Solar flare |
| `alerts.flare.event` | Class {class} solar flare, as recorded on {date} |
| `alerts.flare.source` | Source: NASA DONKI space weather database |
| `alerts.flare.impact` | Arrival in {seconds} s |
| `alerts.flare.action` | Power down (P) or move into shadow. |
| `alerts.flare.bar` | Flare {class} · arrival in {seconds} s |

`{date}` is the flare's date from `events.json` (for example 2017-09-06), the one calendar date the copy allows.

**Dust storm** (Mars overlay, `alerts.storm`):

| Key | Copy |
| --- | --- |
| `alerts.storm.title` | Weather alert · Dust storm forecast |
| `alerts.storm.event` | A regional dust storm reaches the site in about {stormLeadSols} sol |
| `alerts.storm.source` | Basis: orbital weather maps, modeled on MRO's MARCI camera |
| `alerts.storm.impact` | Lasts about {stormSols} sols. Solar income falls to about {stormSolarPercent}%. |
| `alerts.storm.action` | Charge the battery, drive less, or sleep through it. |
| `alerts.storm.bar` | Dust storm in {seconds} s |

**Methane rain** (Titan overlay, `alerts.rain`):

| Key | Copy |
| --- | --- |
| `alerts.rain.title` | Weather alert · Methane rain forecast |
| `alerts.rain.event` | A methane rainstorm reaches the site in about {rainWarningSeconds} s |
| `alerts.rain.source` | Basis: the lander's weather station |
| `alerts.rain.impact` | Lasts about {rainSeconds} s. Photographs will not count, and the rover cools faster. |
| `alerts.rain.action` | Park on known ground, or keep to a route already driven. |
| `alerts.rain.bar` | Methane rain in {seconds} s |

The Titan bar keeps the existing `rain.forecastBar` wording; `alerts.rain.bar` can simply point to it.

---

## S4. Launch manifest, launch beat and landing report

### Launch manifest

Key path: `manifest` (base), with the destination in each overlay. Document REL-LM-00{n}, issued by REL Launch Services, phase "Mission {n} · Pre-launch".

| Key | Copy |
| --- | --- |
| `manifest.heading` | Launch manifest |
| `manifest.number` | REL-LM-001 (Mars overlay: REL-LM-002; Titan overlay: REL-LM-003) |
| `manifest.payload` | Payload |
| `manifest.payloadValue` | REL rover, Mission {n} |
| `manifest.destination` | Destination |
| `manifest.destinationValue` | Lunar south pole, de Gerlache crater rim (Mars overlay: Mars, the floor of Jezero crater; Titan overlay: Titan, the Shangri-La dunes) |
| `manifest.launch` | Launch |
| `manifest.launchValue` | Next commercial launch with space for the payload |
| `manifest.mass` | Payload mass |
| `manifest.size` | Payload size |
| `manifest.tier` | Ticket tier |
| `manifest.limits` | Tier limits |
| `manifest.limitsValue` | Up to {mass} kg and size {size} |
| `manifest.price` | Ticket price |
| `manifest.balanceAfter` | Balance after the ticket |
| `manifest.buy` | Buy the ticket and launch |
| `manifest.back` | Back to design |
| `manifest.notAccepted` | The payload exceeds the {tier} tier limits. Launch Services cannot accept it. |

Stamps (from `doc.stamps`): none before purchase; "TICKET PURCHASED" and "CLEARED FOR LAUNCH" after; "NOT ACCEPTED" when no tier fits. The existing `ticket.*` explanations (why this tier, the tier rule) and the pre-launch review stay below the manifest fields.

### Launch beat

Key path: `launch` (base, with `launch.lines` replaced in each overlay). About 8 s; one line every 1.5 s or so. Skippable. With reduced motion, a still image with the last line as its caption.

| Key | Copy |
| --- | --- |
| `launch.skip` | Skip to landing |
| `launch.still` | Touchdown. The landing report follows. |

**`launch.lines`**, Moon (base):

1. Launch · Lift-off
2. Cruise · On course for the Moon
3. Lunar orbit · Lander separated from the launch stage
4. Descent · Powered descent to the de Gerlache rim
5. Touchdown · Lander safe on the crater rim

Mars (overlay):

1. Launch · Lift-off
2. Cruise · On course for Mars
3. Arrival · Entry into the Martian atmosphere
4. Descent · Parachute, then powered descent
5. Touchdown · Lander safe on the floor of Jezero crater

Titan (overlay):

1. Launch · Lift-off
2. Cruise · Long cruise to Saturn
3. Arrival · Entry into Titan's atmosphere
4. Descent · Parachute descent through the haze
5. Touchdown · Lander safe in an interdune corridor

*These describe REL's fictional lander and claim nothing about a real mission. "Long cruise" stays vague on purpose: no cruise time is stated.*

### Landing report

Key path: `landingReport` (base labels and Moon values; overlays replace the values). Document REL-LR-00{n}, an automatic report from the lander, phase "Mission {n} · {stamp}" with the first timestamp (Day 1, Sol 1, Earth day 1).

| Key | Copy |
| --- | --- |
| `landingReport.heading` | Landing report |
| `landingReport.number` | REL-LR-001 (overlays: 002, 003) |
| `landingReport.site` | Site |
| `landingReport.light` | Light |
| `landingReport.earth` | Earth |
| `landingReport.deploy` | Deploy |
| `landingReport.summary` | Mission |
| `landingReport.data` | Data |
| `landingReport.begin` | Begin the drive |

| Field | Moon (base) | Mars (overlay) | Titan (overlay) |
| --- | --- | --- | --- |
| `siteValue` | The de Gerlache crater rim, near the lunar south pole | The floor of Jezero crater, near Perseverance's landing site | A firm interdune corridor in the Shangri-La dunes |
| `lightValue` | Sunlit. The Sun is low and circles the horizon. | Morning of Sol 1. The Sun is low in the sky. | Morning. The Sun is a faint disc behind the haze. |
| `earthValue` | In view, low on the horizon. | *(field hidden)* | *(field hidden)* |
| `deployValue` | Rover deployed from the lander. Systems ready. | Rover deployed from the lander. Systems ready. | Rover deployed from the lander. Systems ready. |
| `summary` | The existing `mission.briefing` | The existing Mars `landing.briefing` | The existing Titan `mission.briefing` |
| `dataValue` | Terrain: NASA LRO LOLA. Imagery: LROC NAC. | Terrain and imagery: USGS Mars 2020 elevation model and mosaic, from MRO HiRISE. | Terrain: generated, modeled on Cassini radar. Light: Huygens DISR data. |

Below the fields, the landing report keeps the existing sections: the orbital survey leads (`survey.*`), Perseverance's distance on Mars (`campaign.perseverance`), "New on Mars" and "New on Titan" (`campaign.newOnMars`), and "Titan in a few facts" (`titanCampaign.facts`) with Selk.

*Mars's "Morning of Sol 1. The Sun is low in the sky" matches the start rule (Sun about 15° up). Titan's "Morning" matches the start 150 s after sunrise.*

---

## S5. Mission report, bulletins and epilogue

### Mission report

Key path: `report` (base labels and Moon headlines; overlays replace headlines). Document REL-MR-00{n}, issued by REL Mission Operations, phase "Mission {n} · End of mission". The existing debrief tables follow the headline unchanged.

| Key | Copy |
| --- | --- |
| `report.heading` | Mission report |
| `report.number` | REL-MR-001 (overlays: 002, 003) |
| `report.archiveHeading` | REL Archive · A real rover with the same fate |
| `report.archiveNote` | Shown with the Mission history setting on. |

The archive card holds the existing `history.*` text and `historySources.*` source. On Titan it holds the existing Dragonfly section instead.

**Headlines** (`report.headline.<outcome>`). `{day}` and `{sol}` are the timestamp at the loss. On Titan, `{phase}` is one of `report.phase.*` (Titan overlay): "before nightfall", "in the long night", "after dawn".

| Outcome | Moon (base) | Mars (overlay) | Titan (overlay) |
| --- | --- | --- | --- |
| `survived` | Rover completes the lunar day at the de Gerlache rim | Rover completes ten sols at Jezero crater | Rover survives the Titan night in the Shangri-La dunes |
| `energy` | Rover out of energy on Day {day} | Rover out of energy on Sol {sol} | Rover out of energy {phase} |
| `stuck` | Rover immobile in soft regolith on Day {day} | Rover stuck in sand on Sol {sol} | Rover stuck in dune sand {phase} |
| `froze` | Rover lost to the cold in permanent shadow | Rover froze in the night of Sol {sol} | Rover froze {phase} |
| `destroyed` | Rover lost to damage on Day {day} | Rover lost to damage on Sol {sol} | Rover lost to damage {phase} |
| `rollover` | Rover lost in a rollover on Day {day} | Rover lost in a rollover on Sol {sol} | Rover lost in a rollover {phase} |

"Ten sols" in the Mars headline should be `{sols} sols` if the sol count may change.

**Stamp:** Moon and Mars, "PASS MARK MET" or "BELOW PASS MARK"; Titan, "SURVIVED" or "NOT SURVIVED". The existing `debrief.passedRound` and `debrief.failedRound` lines stay under the stamp.

### REL bulletins

Key path: `bulletin` (base). Issued by REL Public Affairs. Shown after a passed round, before the next mission order. `{earned}` is the money earned in the round, `{spent}` the rover plus ticket, `{balance}` the balance after, `{passMark}` the pass mark just met.

**REL-PA-001, Moon to Mars** (`bulletin.moonToMars`), phase "Between Mission 1 and Mission 2":

- **Headline:** Lunar results secure funding for Jezero
- **Outcome line** (`outcomeSurvived` / `outcomeLost`): "REL's first rover completed the lunar day at the de Gerlache crater rim." / "REL's first rover was lost on Day {day}, but its results cover the cost of the mission."
- **Body:**
  - The mission returned {earned} against a cost of {spent}. The balance stands at {balance}, above the pass mark of {passMark}.
  - The board has approved Mission 2: a rover for the floor of Jezero crater on Mars, where a lake once stood.
  - Mars brings what the Moon did not have: a night every sol, cold everywhere, and dust. Mission order REL-MO-002 follows.
- **Button:** Read the mission order

**REL-PA-002, Mars to Titan** (`bulletin.marsToTitan`), phase "Between Mission 2 and Mission 3":

- **Headline:** Jezero results open the way to Titan
- **Outcome line:** "REL's Mars rover completed ten sols at Jezero crater." / "REL's Mars rover was lost on Sol {sol}, but its results cover the cost of the mission."
- **Body:**
  - The mission returned {earned} against a cost of {spent}. The balance stands at {balance}, above the pass mark of {passMark}.
  - The board has approved the program's last mission: a rover for the Shangri-La dunes on Titan, Saturn's largest moon.
  - Titan takes away the sunlight. The battery is the budget, and the cold never lets up. Mission order REL-MO-003 follows.
- **Button:** Read the mission order

**Failed-round note** (`bulletin.failed`), REL-MO-N, an internal note from REL Mission Operations (not Public Affairs), phase "Mission {n} · End of mission". Shown on every restart after a failed Moon or Mars round.

- **Headline:** Another attempt approved
- **Body:**
  - Mission {n} closed with a balance of {balance}, below the pass mark of {passMark}.
  - The board has approved another attempt at the same site. The balance returns to {roundStart}, its value at the start of the round, and the records held return with it.
  - The engineering notebook is kept. What the last rover taught us stays on file.
- **Button:** Back to the design desk

**Failed Titan note** (Titan overlay, `bulletin.failed`):

- **Headline:** Titan rover lost
- **Body:**
  - The Titan rover was lost {phase}: {cause}.
  - The board has approved another attempt, from the balance at the start of the Titan round. The program can also close here, with Titan marked not survived.
  - The engineering notebook is kept.
- **Buttons:** the existing "Try Titan again" and "End the campaign".

**REL-PA-003, final bulletin** (`bulletin.final`), opens the campaign dashboard above the headline tiles. Phase "Program complete".

Survived (`bulletin.final.survived`):

- **Headline:** REL completes its three-world program
- **Body:**
  - REL's Titan rover survived the long night in the Shangri-La dunes. It was the last mission of the program.
  - On the Moon, every kilogram counted toward the launch ticket. On Mars, the sunlight changed every sol, and the nights were cold. On Titan, there was almost no sunlight at all, and the battery and the heater carried the rover through the night.
  - Each world asked for a different rover. NASA's Dragonfly will fly at Titan for the same reason: the right vehicle depends on the world.
  - Source: NASA Science, Dragonfly (science.nasa.gov/mission/dragonfly/).

Not survived (`bulletin.final.lost`):

- **Headline:** REL closes its program after Titan
- **Body:**
  - REL's Titan rover was lost {phase}. The program closes with Titan marked not survived.
  - On the Moon, every kilogram counted toward the launch ticket. On Mars, the sunlight changed every sol, and the nights were cold. On Titan, there was almost no sunlight and no let-up from the cold.
  - Each world asked for a different rover. NASA's Dragonfly will fly at Titan for the same reason: the right vehicle depends on the world.
  - Source: NASA Science, Dragonfly.

The dashboard's existing "What each world asked of the rover" list stays below; the bulletin is its short introduction.

---

## S6. Guided first build

### Pre-launch checklist

Key path: `checklist` (base; first Moon desk only). Non-modal pointers anchored to the controls; each item is checked when the player does it.

| Key | Copy |
| --- | --- |
| `checklist.heading` | Pre-launch checklist · REL-MO-001 |
| `checklist.done` | Checklist complete. The launch ticket is next. |
| `checklist.hide` | Hide checklist |
| `checklist.show` | Show checklist |

**`checklist.steps`:**

1. **Select a chassis.** The frame sets the maximum load and the number of mounting points.
2. **Check the specification sheet.** Mass and size set the ticket tier. Watch both change as parts are added.
3. **Fill the other slots.** Wheels, power source, battery, lights and heater. "No lights" and "No heater" count as choices.
4. **Fill the payload bay.** Choose instruments for the mounting points, or "No instruments". Match them to an approach in the mission order.
5. **Check the budget line.** The parts and the ticket must fit within the budget.
6. **Go to the launch ticket.**

*Step 3 is added to the plan's list: the rover cannot launch until every slot is chosen.*

### Glossary

Key path: `glossary` (base). Pop-ups shown the first time each term appears. No entry for research points (decision 2).

| Key | Term | Definition |
| --- | --- | --- |
| `glossary.ticketTier` | Ticket tier | The size of the rover's spot on the launch. The tier is the smallest one that fits both the rover's mass and its size: {tiers}. A heavier or bigger rover needs a pricier tier. |
| `glossary.mountingPoints` | Mounting points | Places on the chassis where instruments attach. Each instrument takes one. The chassis sets how many there are: {bayMin} or {bayMax}. |
| `glossary.passMark` | Pass mark | The balance REL needs after this mission to fund the next one: {nextMinimum}. Below it, the round is played again. |

On Titan, `glossary.passMark` (Titan overlay) reads: "The last mission has no pass mark. It is judged on survival: the rover must still be running at the end."

---

## S7. Clean-ups

### Moon desk kicker

| Key | Copy |
| --- | --- |
| `campaign.kicker` (base) | Mission 1 · The Moon, de Gerlache crater rim |

This matches "Mission 2 · Mars, Jezero crater" and "Mission 3 · Titan, Shangri-La dunes". The Moon has no `campaign` section in the base `text.json` yet; adding one with only `kicker` is the smallest change (the Mars type has more fields, so the Moon may need its own small type).

### Strings moving from TypeScript to `text.json`

Wording unchanged; key paths suggested.

| Key | Copy |
| --- | --- |
| `landing.begin` | Begin mission *(replaced by `landingReport.begin` once S4 lands)* |
| `design.toTicket` | Continue to launch ticket |
| `ticket.back` | Back to design |
| `design.specHeading` | Specification |
| `design.budgetLabel` | Budget |
| `common.sourceLabel` | Source: |

### Titan `[placeholder]` stubs

None left. A search of `data/titan/text.json` finds `[placeholder]` only in the `_placeholder` note, which can go. Titan `campaign.perseverance` is an empty string by design.

---

## Data the UI will need

New placeholders or values that no data file has yet:

| Need | Used by | Suggestion |
| --- | --- | --- |
| `{budget}` (the starting budget) | Onboarding page 3, REL-MO-001 | `tuning.budget.startingBudget` added to `missionVars()` |
| `{day}`, `{sol}` at a given moment | Log stamps, report headlines, bulletins | From mission time and `mission.gameDays` / `sol` |
| Titan Earth-day count for the stamp (16) | Titan `Earth day {day}` | `titan/tuning.json` → `roverLog.stampEarthDays` |
| `{phase}` on Titan at the loss | Titan headlines and notes | From the loss time and `sol` (before sunset, night, after dawn) |
| `{earned}`, `{spent}`, `{roundStart}` | Bulletins, failed-round note | `RoundStats` already has earned and spent; the round snapshot has the start balance |
| `{pct}`, `{count}`, `{name}` | Log lines | Live mission state |
| Log thresholds: coaching battery share (0.5), coaching distances (50 m, 100 m), cold and damage line share (0.5), hydrogen line share (0.5), Titan last-stretch delay (30 s) | `src/rules/roverLog.ts` | `tuning.json` → `roverLog`, per world |
| Seen flags: `intro`, `order` per world, `bulletin` per transition | §3 seen rules | Next to the tutorial flags in `src/save/tutorialSeen.ts` |

## Decisions made while drafting

- **The map has no key.** The plan's coaching line said "open the map (M)", but the minimap is always on the HUD and no M key exists. The line now points to the arrows on the map edge. The plan is corrected.
- **One office per document.** The plan listed "REL Human Resources / Mission Operations" for the packet; it is REL Mission Operations alone, to keep the offices few.
- **One weather office.** Flare, dust storm and rain alerts all come from "REL Weather Desk". The flare alert is titled "Space weather alert"; the Mars and Titan ones "Weather alert".
- **Titan timestamps count Earth days** ("Earth day 9"), since the mission is one Titan day and "Day 1" would never change. Titan report headlines use the phase instead ("in the long night").
- **Per-world copy uses the overlay pattern** (same key in each world's file), not `log.moon.*` namespaces, so the existing deep merge does the work.
- **Bulletins live in the base file**, since they sit between worlds; only the failed Titan note is in the Titan overlay.
- **The final bulletin introduces the dashboard's lesson list.** The plan said "before the Dragonfly lesson", but the Dragonfly section is in the Titan debrief, which comes first. The bulletin names Dragonfly once and points to the lesson.
- **Mission orders do not reveal that Dragonfly flies.** The Titan debrief teaches it.
- **The failed-round note is from Mission Operations**, as an internal note, not a public bulletin.
- **Checklist step 3 added** (fill the other slots), since the rover cannot launch with empty slots.
