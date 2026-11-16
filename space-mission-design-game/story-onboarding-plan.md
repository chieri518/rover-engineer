# Story and onboarding: plan

*November 15, 2026. Decided: see [Decisions](#decisions). The design changes are in [game-design.md](game-design.md) §3 and §11; all copy is drafted in [story-copy.md](story-copy.md).*

This plan adds a story that tells new players what the game is, walks them through the basic mechanics, and builds the world around REL and its three missions. It is a UI and copy plan. No game rules change. Per [CLAUDE.md](../CLAUDE.md), the design changes go into [game-design.md](game-design.md) first (§3 Campaign, §11 Identity and presentation), then the code.

## Why

- **Right now a player gets no premise.** The title goes straight to an empty parts screen and a four-page tutorial. REL appears only as a label. Nothing says who the player is, why there is a budget, or that three worlds lie ahead.
- **Jargon arrives before context:** ticket tiers, mounting points, RP, pass mark, relationships, flare classes. RP is shown but nothing spends it yet.
- **Mission goals come late.** The Moon has no "Mission 1" header and no objective briefing before the design screen. The pass mark and the three-world route are explained only in the Mars and Titan transition notes.
- **Launch and landing have no payoff.** The landing screen is a block of text between the ticket and the drive. The copy at `text.mission.briefing` ("Fourteen days of daylight…") exists but is never shown.
- **The brief and judging reward it.** The brief's MIS-01 asks to "begin with a mission objective" and EDU-04 asks for tutorials and indicators. Our landscape research names Best Use of Storytelling and Most Inspirational as likely award targets, and cites weak onboarding as the main criticism of comparable games.

## Approach: the story is told through mission documents

There are no characters and no dialogue. The story moves forward through the things a real mission produces: orders, manifests, reports, logs, alerts and bulletins. This keeps §11's rule ("Characters: none; text reads as neutral mission documentation") and its scientific, formal tone. What changes is that the text is **dressed as in-world documents** instead of plain UI copy.

How documents still tell a story:

- **An institution you can see.** REL shows up in letterheads, document numbers ("REL-MO-001"), stamps and sign-offs from offices ("REL Mission Operations", "REL Launch Services"), never from people.
- **Continuity.** Each world's mission order refers to the last bulletin, so the campaign reads as one program, not three levels.
- **Consequences.** Reports and bulletins change with the outcome: a survived mission, a lost rover, a failed round.
- **The rover's own record.** An automatic system log reports what the rover senses, so the drive has a running account with no narrator.
- **Real data as world-building.** Alerts, reports and stamps name their NASA sources (LRO LOLA, LROC, DONKI), so the real data is part of the fiction.

### Document types

| Document | Issued by | Where | What it carries |
| --- | --- | --- | --- |
| Onboarding packet | REL Human Resources / Mission Operations | Intro (new) | The premise, the player's role, the mission loop, the route ahead |
| Mission order | REL Mission Operations | Before each design desk (new) | Objective, site and why it matters, budget, pass mark, hazards, ways to succeed |
| Launch manifest | REL Launch Services | Ticket screen | Payload mass and size, ticket tier, price, destination: the ticket as a real document |
| Landing report | Automatic, from the lander | After landing | Site, lighting, deploy status, survey leads, data sources |
| Rover system log | Automatic, from the rover | During the drive (new) | Short timestamped lines: coaching, sensing, reactions to events |
| Space weather alert | REL Space Weather desk (an office) | Flare warnings | Flare class, date and source (NASA DONKI), in the format of a real alert |
| Mission report | REL Mission Operations | Debrief | Outcome headline, returns, lessons, the real rover with the same fate |
| REL bulletin | REL Public Affairs | Between worlds (new), campaign end | What the program achieved and what it opens up next |
| Engineering notebook | Already built | Across the campaign | What the player learned |
| Archive cards | REL archive | Milestones, debrief | The existing Mission history facts, framed as archive entries |

## Story spine

The arc follows the real path of exploration, which already matches our campaign: the Artemis-era lunar south pole, then Perseverance's Jezero crater, then Dragonfly's Titan.

| Beat | Document | What the player learns |
| --- | --- | --- |
| **Hired** | Onboarding packet | REL is a small exploration lab that buys rides on commercial launches. The player is its newest rover engineer. Every mission must earn back what it costs, or REL cannot fund the next one. |
| **First order: the Moon** | Mission order REL-MO-001 | Why the south pole: water ice in permanent shadow, low Sun, Earth on the horizon. The goal: cover the rover and the ticket with mission returns (pass mark 780). Several ways to succeed. |
| **Build** | Design desk (guided), then the launch manifest | Every part costs money and mass. Mass sets the ticket tier and slows the rover. |
| **Launch and landing** | Launch beat + landing report | The rover reaches the de Gerlache rim. The terrain is real NASA LRO data. |
| **First drive** | Rover system log, space weather alerts | Drive, recharge in sunlight, follow survey leads, power down for a flare, use the instrument. |
| **Report** | Mission report | What the mission earned, and what a real rover with the same fate taught NASA. |
| **Next order** | REL bulletin, then mission order REL-MO-002 | The Moon funds Mars, Mars funds Titan, and what changes on the new world. |
| **Epilogue** | Final REL bulletin + campaign dashboard | The real Titan mission flies (Dragonfly): the right vehicle depends on the world. |

## UI changes, in priority order

Each item lists what is new, where it plugs in, and its size. Paths are under `game/`. All new copy goes in `text.json` and the Mars and Titan overlays, with types in `src/rules/types.ts`.

### S0. Document style (small)

- One shared look for in-world documents, in `src/ui/style.css` and a small helper in `src/ui/dom.ts`: a letterhead line (REL, issuing office, document number, date in world terms), a body, and an optional stamp ("APPROVED", "FILED"). It fits the existing mission-control look (Chakra Petch headings, IBM Plex Mono for numbers, thin cyan borders).
- Every document item below uses it, so the style is decided once.

### S1. Onboarding packet (small)

- A new screen `intro` between New campaign and the design desk, shown once per campaign (a seen flag in `src/save/tutorialSeen.ts`, reset by New campaign like the tutorials). Skippable, and reachable later from the title ("About REL").
- A short packet of four pages: (1) welcome to REL and the player's role; (2) how a mission works, as a strip diagram: design, buy the ticket, land, drive, report; (3) the rule that keeps REL running: each mission must earn back its cost, with the pass mark in one sentence; (4) the program ahead: Moon, Mars, Titan, one line each.
- Plugs in: `ScreenId` in `src/flow/flow.ts`, the `screens` map in `src/ui/screens.ts`, `newCampaign()`. Copy in `text.json` → `intro`.

### S2. Mission orders (medium)

- A new screen `briefing` shown before the design desk on each world's first visit, and from a "Mission order" button on the desk afterwards. It replaces the transition notes now stacked on the Mars and Titan desks.
- Contents: document number, mission and site, the objective in one sentence, why this site matters (real science, sourced), the budget, the pass mark and what happens if it is missed, the main hazards, and "Approaches on file": three roles, not builds (for the Moon: scout with a camera, geologist with a drill, ice hunter in the dark). Ends with "Go to the design desk".
- Mars and Titan orders open by referring to the last bulletin. On Titan the objective is survival to dawn, as the rules already say.
- Plugs in: `flow.ts` (`newCampaign`, `continueCampaign`, `restartRound`), `designScreen.ts` (drop the kicker and notes that move here). Copy → `order`. Reuses the existing `text.campaign` and `text.titanCampaign` facts.

### S3. Rover system log and alerts during the drive (medium)

- A log panel on the HUD: short timestamped lines in IBM Plex Mono (`LOG · Panel output 0% · entering shadow`), in their own place so they never push out warnings or lesson notices. It uses the queue pattern of the lesson notices in `hud.ts`. The timestamp is mission-relative ("Day 3", "Sol 4") and fits the no-clock rule, since it gives no seconds.
- **First-drive coaching on the Moon** (first visit only), written as rover status lines that suggest the next move, sent when the player reaches each point, not on a timer: `LOG · Drive systems ready · W/A/S/D`, then `LOG · Battery 50% · sunlit ground recharges the panel`, then `LOG · Survey leads loaded · arrows on the map edge` (the minimap is always on the HUD; there is no map key). This replaces most of the drive tutorial's text wall (Decision 3).
- **Lines on every visit:** first milestone, Earth above the horizon, entering permanent shadow, the hydrogen count rising, low energy, a long time in the cold, the last stretch of the mission.
- **Space weather alerts:** the flare warning becomes a formatted alert naming the real flare's class, date and source (NASA DONKI). Mars and Titan get the same format for the dust storm and the methane rain forecasts.
- When each line fires is decided in a new pure module `src/rules/roverLog.ts`: mission state in, line ids out, once each per mission, with unit tests. The words go in `text.json` → `log` and `alerts`, with Mars and Titan overlays (sunset, sleep, dawn, the storm, the rain).

### S4. Launch beat, manifest and landing report (medium)

- The ticket screen is restyled as a **launch manifest**: payload mass and size, tier, price, destination, and the pre-launch review, with a stamp when bought.
- After the purchase, a short skippable beat of about 8 seconds: a launch status line, then a camera descent over the real terrain to the lander, using the existing mission scene. With reduced motion it is a still image. It reuses the 3D scene, so no new art.
- The landing screen becomes a **landing report**: site, lighting, deploy status, the unused `mission.briefing` copy, the survey leads, and a data line ("Terrain: LRO LOLA. Imagery: LROC NAC.").
- Plugs in: `ticketScreen.ts`, `buyTicket()` in `flow.ts`, the landing screen in `screens.ts`, `missionScreen.ts` for the camera path.

### S5. Mission report, bulletins and epilogue (small)

- The debrief becomes a **mission report**: a headline that depends on the outcome ("Rover survives the lunar day at de Gerlache"; "Contact lost: rover stuck in soft ground"), above the existing tables. The real-rover comparison becomes an archive card.
- **Between worlds**, an **REL bulletin** before the next mission order: what the last mission earned and what it opens up ("Lunar results secure funding for Jezero"). After a failed round, a short internal note says the board has approved a second attempt.
- The campaign-complete dashboard opens with a final bulletin that ties the three lessons together before the Dragonfly lesson.
- Copy plus small hooks in `screens.ts`, `flow.ts` and `dashboard.ts`.

### S6. Guided first build (medium to large)

- On the first Moon desk, replace the four-page design tutorial with step-by-step pointers anchored to the real controls, written as a checklist from the mission order ("Pre-launch checklist: 1. Select a chassis…"): pick a chassis, then watch the mass and ticket tier change on the sheet, then fill the payload bay, then check the budget line, then go to the ticket. Each item is checked off when the player does it. Later worlds keep their short tutorials.
- Short glossary pop-ups for RP, ticket tier, mounting points and pass mark, the first time each term appears. This also needs **Decision 2** (what RP means today).
- Plugs in: `designScreen.ts`, `src/ui/tutorial.ts` (a positioned, non-modal variant). The largest and riskiest item, since it touches the busiest screen.

### S7. Clean-ups that go with it (small)

- Move the strings still in TypeScript to `text.json`: "Begin mission", "Continue to launch ticket", "Back to design", "Specification", "Budget", "Source:".
- Add "Mission 1 · The Moon, de Gerlache rim" to the Moon desk, so all three worlds match.
- Replace the `[placeholder]` stubs in `data/titan/text.json` that a player can see.

## Suggested order

1. **Design doc.** Update game-design.md §3 (the new intro and briefing screens in the campaign loop) and §11 (Characters: none; story told through in-world documents and the rover log; the document types table). Draft all new copy in one pass so the documents read as one program.
2. **S0, S1, S2, S7**: the document style, the premise and the objectives. This fixes the biggest gap: a new player knows what the game is and what to aim for.
3. **S3**: the rover log and alerts. The most story per hour of work, and it teaches while the player drives.
4. **S5**, then **S4**.
5. **S6** last, if time allows.

## How we build it

As in earlier phases: one implementation subagent per item with a self-contained brief and pushback invited, then a review subagent and a browser check (on its own dev-server port, with the save backed up). `npm test` and `npm run build` pass in `game/` before each small commit. Trigger logic stays in `src/rules/` with tests. Every new screen is skippable, and Continue campaign skips documents already seen.

## Decisions

*Decided November 15, 2026.*

1. **Scope:** all of S0 to S7, in the order above.
2. **RP:** the new story documents do not mention RP until unlocks exist. The existing RP displays stay as they are; nothing is hidden. S6's glossary covers ticket tier, mounting points and pass mark, not RP.
3. **Tutorials:** on the first Moon drive, the rover log's coaching replaces most of the drive tutorial. A short controls page stays; the full pages stay under Help.
4. **No "Skip story" setting.** The once-per-campaign seen flags and a Skip button on each story screen are enough.
5. **Dates:** mission-relative only. Documents carry document numbers and mission time ("Day 3", "Sol 4"), no calendar dates. Space weather alerts still name the real flare's date, as a fact about the flare.
