# Team Plan: Working in Parallel After the First Version

How our two-person team splits **design ownership** after the first version ships, and what we decide together. Written for the two of us. The build plan for the first version is in [implementation plan](implementation-plan.md); the game itself is in [game design](game-design.md).

Written November 14, 2026. Roles are called **Owner A** and **Owner B** below; assign names when we agree.

Quick navigation: [Principle](#the-principle) · [Two areas](#the-two-areas) · [Responsibility map](#responsibility-map) · [Decide together](#decide-together) · [The interface](#the-interface-between-the-two-areas) · [Mars as the first test](#mars-as-the-first-test) · [Rhythm](#working-rhythm) · [Disagreements](#when-we-disagree)

## The principle

We both build with AI, so **writing code is not the bottleneck.** The slow parts are deciding what the game should be, judging whether it feels right, and playtesting. So we split **who decides and iterates on what**, not who writes which code. Either of us can implement anything; the owner of an area is the one who decides how it should work and judges whether it is good.

The split follows the game's two loops, because each has its own way of being tested:

| | Owner A: the engineer's desk | Owner B: the field |
| --- | --- | --- |
| The question | Is choosing a rover an interesting puzzle? | Is driving and exploring fun and real? |
| Covers | Everything before landing and after the mission (the outer loop) | Everything from landing to mission end (the inner loop) |
| How you iterate | Try builds on the design screen, compare numbers, simulate payouts | Drive the map, place things, adjust feel |
| Feedback is fast when | You can see a build's stats and price instantly | You can load the map and drive within seconds |

## The two areas

### Owner A: the engineer's desk (rover, economy, progression)

- **Parts catalog:** slots, options, what each part does, costs, masses, sizes.
- **Launch ticket:** tier limits and prices.
- **Economy:** survival payout, milestone money and RP values, death penalties, minimum budgets, starting budget.
- **Progression:** the RP unlock tree, which parts and map layers unlock when.
- **The constraint puzzles for Mars and Titan:** turning the team's list of candidate constraints into design-screen trade-offs.
- **Screens:** design screen, ticket screen, debrief, campaign and restart flow.
- **Text for those screens:** design-screen tutorial, part descriptions, debrief wording.

### Owner B: the field (worlds, missions, hazards)

- **Maps and NASA data:** sites, the terrain and texture pipeline, distant terrain.
- **Level layout:** landing point, where features, viewpoints, rocks, cold zones, and ice are placed.
- **Driving feel:** handling, camera, how parts change the way the rover drives.
- **Hazards and events:** damage sources, cold, getting stuck, flares, quakes, and later dust storms and night.
- **Time and light:** the Sun, shadows, day and night on each world.
- **Milestones:** what triggers each one and where it is on the map.
- **Mission screens:** HUD, minimap, map layers once unlocked.
- **Text for the mission:** driving tutorial, milestone pop-ups, mission history facts.

### Folder ownership

To stop two people's AI tools from editing the same files at once, each folder has an owner. Anyone can change anything, but **a change in the other person's folder gets a heads-up or a quick review first.**

| Owner A | Owner B | Shared (change together) |
| --- | --- | --- |
| `data/parts.json`, `data/tiers.json` | `tools/`, `public/terrain/` | `data/tuning.json` (see [the interface](#the-interface-between-the-two-areas)) |
| `src/rules/` economy, payout, tiers, campaign | `src/world/`, `src/rover/`, `src/events/` | `data/milestones.json` (B owns triggers, A owns rewards) |
| `src/ui/` design, ticket, debrief | `src/ui/` HUD, minimap | `data/text.json` style, `src/flow/`, `game-design.md` "Decided" items |
| `src/save/` | `data/events.json` | Project `CLAUDE.md` |

## Responsibility map

**Owns** means decides and is accountable. **Consulted** means asked before a change is final.

| Topic | Owner A | Owner B |
| --- | --- | --- |
| Part catalog and costs | Owns | Consulted on part effects that change driving |
| Ticket tiers | Owns | |
| Economy and payout values | Owns | |
| Unlock tree | Owns | Consulted on unlocks that change the field (map layers, new instruments) |
| Mars and Titan constraint puzzles | Owns | Consulted |
| Maps, sites, NASA data pipeline | | Owns |
| Level layout and milestone placement | Consulted on milestone count and pacing | Owns |
| Driving feel | | Owns |
| Hazards and events | Consulted on which parts counter them | Owns |
| Sun, time, day and night | | Owns |
| Design screen, ticket, debrief UX | Owns | |
| HUD and minimap | | Owns |
| Tutorial and in-game text | Owns design-screen text | Owns mission text |
| Interface numbers (below) | Together | Together |
| Everything in [Decide together](#decide-together) | Together | Together |

## Decide together

These should not be split, because a choice in one area changes the other, or because they define the whole game.

| Topic | Why it is joint |
| --- | --- |
| **What each world teaches** | Before any Mars or Titan work starts, we agree on that world's one new lesson and new constraint. Everything both of us builds hangs off it. |
| **The interface numbers** | They connect the rover to the map (see below). Changing one silently breaks the other person's balance. |
| **The core loop and pacing** | Mission length, how many milestones per run, how hard the campaign gets |
| **Scope and cut decisions** | What goes in the next version and what waits |
| **Changes to decided design** | Anything marked decided in `game-design.md` changes only by agreement |
| **Tone and voice** | One style guide for all text, so both areas read as one game: scientific, formal, no characters |
| **Overall look** | Art direction once, together; then each owner applies it in their area |
| **Real-science claims** | What we tell players and judges is real NASA data or history. Both check it. |
| **Playtests** | Together, and each plays the other's area with fresh eyes |
| **Pitch, video, and judging story** | The submission speaks for the whole game |

## The interface between the two areas

Most balance problems will live where the rover meets the map. These numbers belong to both of us and are changed only together. Keep them in one section of `tuning.json`, marked as shared.

| Owner A's side | Owner B's side | The question they answer together |
| --- | --- | --- |
| Base speed per wheel, how much mass slows the rover | Distances between landing point, viewpoints, boulder field, crater | How much of the map can a typical build reach in one mission? |
| Battery capacity, solar income, energy per meter | Where sunlight and shadow fall, slope of the routes | Can a rover reach the cold crater and get back out? |
| Heater strength | Freeze rate in each cold zone | How long can a heated rover stay in the dark? |
| Wheel grip, chassis max load | Soft ground and slope placement, damage per cause | Which builds get stuck or break, and where? |
| Milestone money and RP | Milestone count, placement, and difficulty | How much does a good run earn, and is the reward worth the risk? |

**Rule of thumb:** if a change would make the other person's area easier or harder, it is an interface change. Say so before committing it.

## Mars as the first test

Mars is the first version built this way. A suggested order:

1. **Together:** agree on Mars's lesson and new constraints, starting from the team's constraint list. Agree on mission length in game time (20 sols is proposed). Update `game-design.md`.
2. **In parallel:**
   - **Owner A:** the Mars part catalog, the unlock tree that spends Moon RP, the new design-screen trade-offs, Mars ticket tiers and economy.
   - **Owner B:** the Mars site and data (HiRISE and MOLA elevation, weather, dust), day and night, the lights-on or sleep choice, Mars events, Mars milestones and their placement.
3. **Together:** set the interface numbers for Mars, then a joint playtest of Moon to Mars as one campaign.
4. **In parallel again:** each owner iterates on their area from the playtest notes.

The same pattern repeats for Titan.

## Working rhythm

- **Daily, 15 minutes:** what each of us decided, anything that touches the interface, anything blocked.
- **Design doc first:** each owner keeps their sections of `game-design.md` current. Joint decisions are written up by whoever proposed them and confirmed by the other.
- **Weekly joint playtest** of the whole campaign, not just one area.
- **Git:** small commits, pull often, one branch per feature. A change outside your folders or to shared files goes through a quick review by the other person.
- **AI setup:** one shared project `CLAUDE.md` with the rules from the [implementation plan](implementation-plan.md#working-with-ai-on-this-codebase). Point your AI sessions at your own sections of `game-design.md` so they stay inside your area.

## When we disagree

1. **Inside one area:** the owner decides.
2. **On the interface or a joint topic:** talk it through. If still split, build both versions (AI makes this cheap) and let a playtest decide.
3. **If a playtest doesn't settle it:** pick the option closer to the real science. That is what the game and the judges value most.
