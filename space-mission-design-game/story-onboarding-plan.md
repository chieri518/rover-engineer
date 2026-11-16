# Story context: plan

*November 15, 2026. Decided: see [Decisions](#decisions). The design change is in [game-design.md](game-design.md) §3 and §11; the copy is in [story-copy.md](story-copy.md).*

This plan adds a little story so a new player knows where they are and why: who they work for, why each mission must pay its way, and why REL goes to each site. It adds copy, plus one short intro screen. It does not change how the game communicates: the tutorials, HUD notices, ticket screen, landing screen layout and debrief stay as they are, and no game rules change. Per [CLAUDE.md](../CLAUDE.md), the design change went into [game-design.md](game-design.md) first.

## Why

- **Right now a player gets no premise.** The title goes straight to an empty parts screen and a tutorial. REL appears only as a label. Nothing says who the player is, why there is a budget, or that three worlds lie ahead.
- **The Moon has no mission header.** Mars and Titan open with "Mission 2 · Mars, Jezero crater" and "Mission 3 · Titan, Shangri-La dunes"; the Moon desk has nothing. The pass mark and the three-world route are explained only once the player reaches Mars.
- **Unused copy.** `text.mission.briefing` exists on every world but is never shown.
- **The brief rewards it.** MIS-01 asks to "begin with a mission objective". Our landscape research names Best Use of Storytelling as a likely award target and cites weak onboarding as the main criticism of comparable games.

## The three additions

Paths are under `game/`. All copy goes in `data/text.json` and the Mars and Titan overlays (`data/mars/text.json`, `data/titan/text.json`, deep-merged over the base), with types in `src/rules/types.ts`. Key paths are in [story-copy.md](story-copy.md).

### 1. Welcome to REL intro (the only new screen)

- Three short pages: who the player is (REL's newest rover engineer, at mission control) and what REL is (a fictional lab that designs and operates rovers and buys rides on commercial launches); why each mission must earn back its cost (budget and pass mark, in a sentence or two); the three worlds ahead, one line each. Back, Next, Skip; the last page goes to the design desk.
- **When it shows.** Every Start new campaign, before the first Moon desk. Never on Continue campaign or a round restart. This is the "tutorials seen" rule of §3 (New campaign resets, Continue skips, restart leaves alone).
- **Plugs in:** `'intro'` added to `ScreenId` in `src/flow/flow.ts`; `newCampaign()` goes to `'intro'` instead of `'design'` (the debug start `?world=` still goes straight to the desk); an `intro` screen in the `screens` map in `src/ui/screens.ts`, using the same page shape (`{ title, body[] }`) and buttons as the tutorial. Copy at `intro`, a new section of `SharedTextFile`.
- **No stored seen flag.** New campaign is the only way in, so the rule above needs no flag. If one is ever wanted (for example to resume a half-read intro on Continue), it belongs beside the tutorial flags in `src/save/tutorialSeen.ts` and is cleared by `resetTutorialSeen()`.

### 2. Why REL is going to each site

- **Moon kicker.** The Moon desk gets "Mission 1 · The Moon, de Gerlache rim", like Mars and Titan.
- **Site context.** Two or three sentences per world on why REL is going there, at the top of the design desk's notes, above the existing tutorial line and the Mars and Titan transition notes. Sources go to the credits next to the landing briefing sources.
- **Landing.** The landing screen shows the existing `mission.briefing` line under `landing.briefing`, on every world. Layout unchanged otherwise.
- **Plugs in:** `src/ui/designScreen.ts` (the kicker in `desk-head`, the context in `desk-notes`); the landing screen in `src/ui/screens.ts`; `src/ui/creditsScreen.ts` for the sources. Copy at `story.kicker`, `story.site` and `story.sources`, base for the Moon and the same keys in each overlay, plus `story.sourcesLabel` (base). The landing fills `mission.briefing` with `missionVars()`, since its Moon and Mars wording moves to `{days}` and `{sols}`.
- **Kicker key.** Do not add a `campaign` section to the base `text.json`: the desk and landing screens treat its presence as "after the Moon" and would show the Mars notes on the Moon. Move the kicker to `story.kicker` in all three files instead, and drop `kicker` from `MarsCampaignText` in `src/rules/marsTypes.ts` (and its use in `src/worlds.test.ts`).

### 3. Short beats between worlds and at the end

- **Debrief.** One or two sentences above the buttons: after a passed Moon or Mars round, what the results open up ("Continue to Mars", "Continue to Titan"); after a failed round, that the board has approved another attempt. Shown after the existing pass or fail line, which still carries the numbers. Empty strings are skipped (Titan's passed beat is empty: Campaign complete carries the end).
- **Campaign complete.** One closing paragraph under the dashboard heading, survived or lost to match the "Final mission survived" tile. Nothing when that outcome is not recorded.
- **Plugs in:** the debrief in `src/ui/screens.ts` (beside the `outcome` paragraph); `src/ui/dashboard.ts` (the `dash-head` header). Copy at `debrief.storyPassed` and `debrief.storyFailed` (base for the Moon, Mars and Titan overlays) and `dashboard.storySurvived` and `dashboard.storyLost` (base).

## Not changing

Dropped from the earlier draft of this plan:

- Mission orders as a new screen, and moving the Mars and Titan transition notes off the desk.
- A rover system log on the HUD, and log coaching in place of the Moon drive tutorial. The tutorials stay as they are.
- Restyled weather alerts for the flare, dust storm and rain. The HUD notices stay.
- The launch manifest restyle of the ticket screen, and a launch beat after the ticket.
- The landing report and mission report restyles. The landing screen and debrief keep their layouts.
- REL bulletins as screens, and a failed-round note screen.
- A guided first build (checklist) and glossary pop-ups.
- A shared document style, offices, document numbers and stamps.
- An "About REL" button on the title.
- Moving the remaining TypeScript strings to `text.json` (worth doing, but separate).

## Decisions

*Decided November 15, 2026.*

1. **Scope:** only the three additions above.
2. **No characters and no dialogue.** Tone scientific and formal, in plain English for high-school readers.
3. **No research points** in the new copy. Existing RP displays stay.
4. **Mission-relative times only.** No calendar dates in the story; sourced history facts keep their years.
5. **Real science needs a source already used in the repo.** For the Moon site, the copy says NASA named "a region on the de Gerlache rim" as an Artemis III candidate; it does not claim the play area lies inside De Gerlache Rim 2.
6. **No "Skip story" setting.** The intro has a Skip button; the other additions are a few sentences on existing screens.

## How we build it

One implementation phase with a self-contained brief and pushback invited, then a review subagent and a browser check (its own dev-server port, the save backed up): New campaign shows the intro and Skip works; Continue and a restart skip it; each world's desk shows its kicker and context; each debrief shows the right beat, passed and failed; Campaign complete shows the closing line. `npm test` and `npm run build` pass in `game/` before each small commit. A test checks that every world has its `story` keys.
