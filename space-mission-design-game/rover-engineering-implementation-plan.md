# Implementation Plan: Payload Bay and Part Relationships

How we build the rover engineering changes decided on November 15, 2026: the payload bay, instrument operating costs, the four new Moon instruments, part relationships, the engineering notebook, and the pre-launch review. Written for our team. What the game does is defined in [rover engineering design](rover-engineering-design.md) and [game design](game-design.md); this doc covers how we build it and in what order.

Written November 15, 2026, against branch `v1-moon` (commit `e7f3bcb`). The structure and rules of [the first-version plan](implementation-plan.md) still apply: game numbers in `game/data/*.json`, pure rules in `game/src/rules/` with unit tests, `npm test` and `npm run build` passing before each commit.

Quick navigation: [Scope](#scope) · [Data changes](#data-changes) · [Phases](#phases) · [File map](#file-map) · [Tests](#tests) · [Risks](#risks) · [Decisions](#decisions)

## Scope

**In this plan**

- The payload bay: the instrument slot becomes a bay with mounting points set by the chassis (steel 3, titanium 2), holding any mix of instruments, or none.
- Instrument operating costs: energy per use, standby energy, and time held still, as part data.
- Four new Moon instruments with their mission behavior and readouts: neutron spectrometer, X-ray spectrometer, seismometer station, laser retroreflector.
- The hydrogen clue moves from the drill to the neutron spectrometer's live meter.
- The four Moon relationships, explained in the mission when they happen and in the debrief.
- The engineering notebook (kept across restarts) and the pre-launch review (shows only discovered relationships and hard blocks).

**Not in this plan**

- New milestones for the new instruments, and any change to the Moon map, zones, or points of interest. The new instruments work and report in the mission and the debrief, but earn no money or RP yet.
- Ticket tier retuning and the balance pass; numbers below are the design doc's indicative values.
- Mars and Titan parts, support hardware (arm, mast, comms, computer), and Mars and Titan relationships.

## Data changes

All numbers stay in JSON. Types for every file are in `game/src/rules/types.ts`.

### Build shape

Today a build is one part id per slot (`Build = Record<Slot, string>`). The bay holds a list:

```ts
export type BusSlot = 'chassis' | 'wheels' | 'power' | 'battery' | 'lights' | 'heater';
export type Build = Record<BusSlot, string> & { payload: string[] }; // payload: instrument part ids, in bay order
export type DraftBuild = Partial<Record<BusSlot, string>> & { payload?: string[] }; // undefined = bay not confirmed yet
```

- Instrument parts keep `"slot": "instrument"` in `parts.json` as their catalog category; `parts.slots` lists only the six bus slots.
- `payload: []` is a confirmed empty bay; `payload: undefined` means the player has not touched the bay yet (the empty-start rule).
- The order of `payload` is the order on the desk, which is also the order of the mission keys 1, 2, 3.

### `parts.json`

| Change | Values (indicative) |
| --- | --- |
| Chassis `mountingPoints` | steel 3, titanium 2 |
| Instrument effect `instrument` widens | `camera`, `drill`, `neutron`, `xray`, `seismometer`, `reflector` |
| Instrument effect `energyPerUse` | drill 10 per sample, X-ray 3 per reading; camera, stations 0 |
| Instrument effect `standbyEnergy` | neutron spectrometer 0.1 per second while switched on |
| Instrument effect `useSeconds` (time held still) | drill 3 (moves here from `tuning.milestones.drillSeconds`), X-ray 4, seismometer 3, reflector 3 |
| Instrument effect `deploy: true` | seismometer, reflector: the part leaves the rover when used |
| New parts | neutron spectrometer 80 / 4 kg / size 2; X-ray spectrometer 60 / 2 kg / size 1; seismometer station 70 / 4 kg / size 2; laser retroreflector 30 / 3 kg / size 1 |

### `tuning.json`

- New `instruments` section:
  - `neutron`: meter ranges to the ice spot, a background level in other cold areas, and a noise floor.
  - `xray`: reach to a boulder, and the reading-time factor in shadow (the cold relationship).
  - `seismometer`: recording window before the quake, and the quiet distance.
  - `reflector`: no numbers yet beyond `useSeconds` in parts.
  - `coldSlowdown`: the factor for instruments used in a cold zone without a heater.
- Remove `milestones.hydrogenSignal`, `hydrogenStrongWithinM`, `hydrogenModerateWithinM` (the drill clue) and `milestones.drillSeconds` (moved to the drill part).

### `relationships.json` (new)

One entry per relationship, so text and numbers live in one reviewed place:

```json
{
  "id": "seismometer-quiet",
  "world": "moon",
  "kind": "conditions",
  "parts": ["seismometer"],
  "review": "yellow",
  "notice": "Seismometer trace noisy: the rover is driving nearby. Move away for a clean record.",
  "reviewText": "Seismometer station: the rover's own driving shakes the ground. Deploy it, then drive away before the moonquake.",
  "debrief": "...",
  "fact": "...",
  "source": "..."
}
```

- `kind` is one of needs, conditions, conflicts, wear (the design doc's kinds).
- The rules that decide *when* each relationship happens are code in `rules/relationships.ts`, keyed by id. A generic rule language is not worth it for four relationships.
- Hard blocks (no lights, so no entering permanent shadow) are entries with `"review": "red"` and `"hardBlock": true`; the review always shows them.

### `text.json`

New keys for the bay, the four instruments (controls, readouts, refusals), the notebook screen, the review, and the debrief's relationships section. The `drill.hydrogen*` keys move to a `neutron` group; the credits label `drillHydrogenLabel` is renamed.

### Campaign save

- `CampaignState.notebook: string[]`: relationship ids discovered. It is **not** part of `snapshot`, so `restartRound` keeps it.
- `looksLikeCampaign` accepts saves without `notebook` (older saves) and fills in `[]`. The storage key stays `rover-engineer.campaign.v1`.

## Phases

Each phase ends with tests and the build passing, a browser check, and a commit. Mechanics settled during a phase go back into game-design.md as "decided during implementation", as in the first version.

### Phase 1: Payload bay with today's instruments

- Types and data: `BusSlot`, the new `Build` shape, `mountingPoints` on both chassis.
- Rules (`rules/rover.ts`, new `rules/payload.ts`):
  - `selectedParts` returns the bus parts plus the payload parts, so `roverTotals`, `driveStats`, `meetsRequirements` and the tier quote keep working on a flat part list.
  - `mountingPoints(parts)`, `payloadProblems(build, catalog)`: unknown ids, non-instrument parts, duplicates, more instruments than points.
  - `isCompleteBuild` also needs a confirmed bay; `missingSlots` reports the bay.
  - `quoteBuild` blocks launch when the bay is over capacity (a new reason next to "over the top tier").
- Validation (`rules/validate.ts`): every chassis has `mountingPoints`; every instrument part has an `instrument` effect. Also add the zone id check flagged in the codebase review: a milestone trigger naming an unknown zone fails validation instead of silently never firing.
- Desk (`ui/designScreen.ts`): the bay as a fieldset of instrument cards with checkboxes and an "n of m mounting points" counter; cards disable when the bay is full; a "No instruments" button confirms an empty bay. Changing chassis to one with fewer points drops the last-added instruments with a notice.
- Preview and model (`rover/roverModel.ts`, `ui/buildPreview.ts`, `ui/titleCover.ts`): `RoverLook.instrument` becomes `instruments: Instrument[]`; camera and drill can both be drawn, each in its own mount position.
- Mission (`ui/missionScreen.ts`): instruments are used with keys 1 to 3 (bay order) and HUD buttons, replacing the fixed C and F keys. Camera and drill behave exactly as today.
- Balance model (`rules/balance.ts`, `rules/winPaths.ts`, `data/balance.json`): archetype builds get `payload` lists; `allBuilds` enumerates payload subsets that fit; plan stops list which instruments to use (`"use": ["camera", "drill"]`).

**Done when:** a steel rover can carry the camera and the drill together, take a photo and a sample in the same mission, and both milestones credit; a titanium rover refuses a third instrument.

### Phase 2: Instrument operating costs

- `rules/mission.ts`:
  - `MissionState` gains `standbyOn: Instrument[]` and the energy step subtracts each switched-on instrument's `standbyEnergy` per second (not while powered down).
  - A pure `startInstrumentUse(state, part, sample, setup)` checks power, speed, and energy for `energyPerUse`, and returns the hold time (`useSeconds`, times `coldSlowdown` in a cold zone without heat).
- The mission screen calls these rules instead of its own drill checks; the drill's 3 s hold comes from the part.
- Desk spec sheet: an instrument energy line (per use and standby) under the range estimate.

**Done when:** a drill sample visibly costs energy, the hold time comes from `parts.json`, and the rules tests cover standby, per-use cost, and refusing a use on too little energy.

### Phase 3: The four new Moon instruments

All behavior is pure rules in a new `rules/instruments.ts`; the mission screen only measures and draws.

| Instrument | Rule | Mission screen |
| --- | --- | --- |
| Neutron spectrometer | `hydrogenReading(p, zones, tuning)`: a 0 to 1 value, highest near the ice spot, a low background in other cold areas, a noise floor everywhere | A switch (standby on or off) and a live meter on the HUD. The drill's hydrogen line is removed from its notice. |
| X-ray spectrometer | `xrayTarget(p, boulders, tuning)`: the nearest boulder within reach, or none; a reading returns a rock type, picked deterministically from the boulder's id and a weighted list in tuning | Stop beside a boulder, use, hold; the notice shows the rock type and its main elements. Refused away from boulders. |
| Seismometer station | `seismometerRecord(deployedAt, roverTrack, quake, tuning)`: no record if deployed after the quake; a clean or noisy trace depending on the rover's distance during the recording window | Use to deploy; a small station appears on the ground; at the quake the HUD shows the trace. |
| Laser retroreflector | Deploy only where Earth is above the terrain horizon, using the existing `horizonMarginTan` test from the rover's position (no camera frame check) | An "Earth in view" light while it is aboard; refused with a notice when Earth is hidden. |

- **Deployables:** using a station removes its part from the rover. `rules/mission.ts` gets `deployPart(setup, part, allParts, tuning)`, which recomputes `stats` (mass, speed, energy per meter, sinkage) from the remaining parts; the rover model drops the part and the world places a static station mesh.
- **Rock types:** the weighted list is placeholder content (south polar highland rocks, such as anorthosite, impact melt breccia, regolith breccia). Which rocks lie where is Moon-level content and comes with the milestones later. *(Decided November 15:)* document the placeholder in rover-engineering-design.md, with notes for the later map work: how rock types are assigned today, what a real assignment would need from the map (for example rock types per rocky area or by distance from a crater, and whether the terrain pipeline should export them), and how that would change the X-ray spectrometer's readings and any future milestones.
- **Debrief:** an "Instrument log" section lists what the new instruments recorded (rock types read, the quake record and its quality, reflector placed). It earns nothing yet.
- **Mission history:** one fact per new instrument the first time it is used, from `text.json`, with sources, as for the hydrogen fact today.

**Done when:** each new instrument works in the browser on a rover that carries it, refuses clearly when it cannot be used, and its rules have unit tests; the drill alone gives no hydrogen reading.

### Phase 4: Relationships in the mission and the debrief

- `rules/relationships.ts`: for each Moon relationship, a pure check that turns what happened this step into a `RelationshipEvent { id }`:

| Relationship | Fires when |
| --- | --- |
| Neutron spectrometer finds, drill confirms | The rover drills in the dark crater without a neutron spectrometer aboard (the notice says the drill alone cannot tell how close the ice is) |
| Seismometer needs quiet | The rover drives within the quiet distance of a deployed, recording station |
| Cold and dark | An instrument use is slowed in a cold zone without a heater, or a photo is taken in permanent shadow without lights |
| Colder X-ray detector, sharper reading | An X-ray reading finishes faster because the rover is in shadow |

- The mission screen shows each relationship's notice the first time it fires in a mission, and records which relationships happened for the debrief and the notebook.
- Debrief: a "What the rover taught us" section with each relationship met: what happened, why, and the answers; the real fact and source only when Mission history is on.

**Done when:** each of the four relationships can be triggered on purpose in the browser, shows its notice once, and appears in the debrief; each check has unit tests.

### Phase 5: Engineering notebook and pre-launch review

- Campaign rules (`rules/campaign.ts`): `finishMission` adds the mission's relationship ids to `notebook` (the mission screen shows them in its overlay before that); `restartRound` keeps it; tests cover both.
- Notebook screen: a list of discovered relationships (cause, what happened, answers, real story), opened from the desk, the title screen, and during the mission. Undiscovered entries show as a count only ("3 of 4 Moon lessons found"), with no names.
- In the mission: a HUD button (and a key) opens the notebook as an overlay and pauses the mission, as the drive tutorial does. A relationship discovered in this mission is added at once, so the player can read it right after its notice; the button shows a marker while there is an unread entry. The campaign save is still written only when the mission ends.
- Pre-launch review (`ui/ticketScreen.ts`, pure `reviewItems(build, notebook, data)` in `rules/relationships.ts`): before the ticket purchase, lists the build's relationships that are in the notebook, with green, yellow, or red marks, plus hard blocks. A first build shows hard blocks only. The player can always continue.

**Done when:** a relationship met in a mission appears in the notebook during that mission and in the next review for a build that triggers it, survives a restart, and never appears in the review before it is discovered.

**Built (November 15).** Lead decisions taken with it: the cold-and-dark lights variant removed (unreachable), no lights discovered at the shadow edge as a lesson of its own, the seismometer lesson fired by a noisy record, the neutron lesson not fired by a lucky ice find, relationship notices in their own HUD slot, a build check per relationship for the review (`BUILD_PREDICATES`), and N as the notebook key. Details in game-design.md, section 7.

### Phase 6: Text, tutorial, and playtest

- Tutorial pages for the bay (design) and for number-key instrument use (drive); per-instrument lines replace the camera and drill lines.
- Credits: sources for the new instruments' facts and the relationships.
- Playtest checklist: an empty bay, a full steel bay, a titanium bay, each new instrument, each relationship, a restart with the notebook kept, an old save without a notebook.
- Update game-design.md: the Moon parts table, the instrument controls, and the removal of the drill's hydrogen clue, each marked built.

## File map

| Area | Files |
| --- | --- |
| Types | `rules/types.ts` (`BusSlot`, `Build`, `DraftBuild`, `PartEffects`, `Instrument`, `Tuning.instruments`, `RelationshipsFile`, `TextFile` keys, `MilestoneRequirements`, `PlanStop.use`) |
| Data | `data/parts.json`, `data/tuning.json`, `data/relationships.json` (new), `data/text.json`, `data/balance.json`; `src/gameData.ts` loads the new file |
| Rules | `rules/rover.ts`, `rules/payload.ts` (new), `rules/quote.ts`, `rules/mission.ts`, `rules/instruments.ts` (new), `rules/relationships.ts` (new), `rules/milestones.ts` (drop `hydrogenSignal`; `Missed.missing` uses `Instrument`), `rules/campaign.ts`, `rules/validate.ts`, `rules/balance.ts`, `rules/winPaths.ts` |
| Save | `save/campaignSave.ts` (notebook default) |
| Desk | `ui/designScreen.ts`, `ui/buildPreview.ts`, `ui/ticketScreen.ts` (review), `ui/tutorialText.ts` |
| Mission | `ui/missionScreen.ts`, `ui/hud.ts` (instrument buttons, hydrogen meter, seismometer trace, Earth light, notebook button), `rover/roverModel.ts`, a station mesh in `world/` |
| Screens | `ui/screens.ts` (debrief sections, notebook screen), `ui/creditsScreen.ts` |

## Tests

- **Update:** `data.test.ts` (six bus slots with two options each, six instrument options, chassis mounting points, the new milestone count stays 13), `rover.test.ts`, `quote.test.ts`, `milestones.test.ts` (no hydrogen on the drill), `balance.test.ts` and `winPaths.test.ts` (payload builds; the archetype targets should still hold, since new instruments earn nothing and only add mass), `roverModel.test.ts`, `campaignSave.test.ts`, `testData.ts`.
- **New:** `payload.test.ts`, `instruments.test.ts`, `relationships.test.ts`, mission tests for standby and per-use energy and for deploying, campaign tests for the notebook.

## Risks

| Risk | Why | Mitigation |
| --- | --- | --- |
| The Build shape change touches everything | `Build` is used by the desk, quote, mission, balance model, preview, and tests | Do it first, in Phase 1, before any new behavior; keep `selectedParts` returning a flat list so most callers do not change |
| Balance model build count grows | Payload subsets multiply the builds `allBuilds` enumerates (up to 42 bays per bus build instead of 2) | Enumerate only bays that fit the chassis; if the tests slow down, sample bays with new instruments instead of enumerating them |
| Ice hunter archetype is now optimistic | The model already assumes the ice is found; without the drill's clue, a drill-only rover finding it is less likely | Record it in the balance limits; the ice route is re-checked in the later balance patch with the neutron spectrometer |
| Instruments that earn nothing feel pointless | Milestones for the new instruments come later | The instrument log and the relationships give them visible results; keep the release note honest that rewards come next |
| Old saves | Saves without `notebook` | Default to `[]`; covered by a save test |

## Decisions

Decided November 15, 2026:

| # | Question | Decision |
| --- | --- | --- |
| I1 | Keep C and F as extra keys for the camera and drill? | No: number keys and HUD buttons only, so every instrument works the same way |
| I2 | Where the notebook opens | From the desk, the title screen, and during the mission (an overlay that pauses the mission), so a new discovery can be read right away |
| I3 | Should the debrief instrument log wait for milestones? | No: show it from Phase 3, so the new instruments have visible results |
| I4 | Ship phases separately or together? | Phases 1 and 2 can ship alone (camera plus drill on one rover is already new play); Phases 3 to 5 ship together, so new instruments arrive with their relationships |
