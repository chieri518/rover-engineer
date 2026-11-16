# Playtest Checklist: Mars Rover Engineering, Sites and Milestones

A short checklist for one person playing Mars in the browser (`cd game && npm run dev`). It covers what the [Mars rover engineering plan](mars-rover-engineering-implementation-plan.md) and the [Mars sites and milestones plan](mars-sites-and-milestones-plan.md) built in Mars steps 1 to 8: the Mars desk (support slots, the night budget line, the new parts), the four Mars instruments, the new sites, the twenty new milestones, the four Mars lessons, the generous balance, and a restart. What the game should do is in [game design, The Mars mission](game-design.md#the-mars-mission). The Moon's own checklist is [rover-engineering-playtest-checklist.md](rover-engineering-playtest-checklist.md). Tick a box when the game does what the line says; write down anything else.

Keys: W A S D drive, Space brake, P power down (sleep), number keys 1 to 3 use instruments in bay order, N notebook. Use a fresh campaign unless a line says otherwise.

**Getting to Mars quickly (development build only).** Open the dev server with `?world=mars` (a throwaway campaign on Mars that does not touch the save; add `&sim=4` to run the simulation four times faster). In the console: set the build with `__game.build = { ..., support: { arm: 'arm-robotic', mast: 'mast-remote' } }` or use the desk, then `__game.go('mission')`. Useful hooks: `__mission.stormSoon()` (the storm forecast starts now), `__moon.spawnDevil(100)` (a dust devil passes 100 m away), `__moon.teleport(x, z, headingDeg)`, `__moon.setSimSpeed(4)`, `__mission.survey()` and `__mission.discover(name)`. Positions below are local x, z in meters (the lander is at about 835, −490; +x east, +z south). A real playtest drives; teleports are for checking a line quickly.

**Where things are** (straight-line distance and direction from the lander): Rocky area 2 0.45 km WNW (an old crater with a rim), S crater 0.57 km S, WSW crater 0.58 km WSW, SW crater 0.64 km SW, Rocky area 1 0.70 km S, SSE crater 0.84 km SSE, the hydrated ground about 0.95 km S (hidden), the Séítah knob 0.96 km SSW, East crater 1.0 km ENE, the ESE crater 1.0 km ESE, the Séítah edge (Brac) 1.15 km SSW, the delta foot and the flood boulder 1.5 km WNW, the delta viewpoint 1.4 km WNW.

## 1. The Mars desk

- [ ] **Continue to Mars.** After a passed Moon round the design screen reads "Mission 2 · Mars, Jezero crater", with the balance carried over and the Titan pass mark ($800k).
- [ ] **Not offered on Mars.** A Moon build with the seismometer or the reflector loses them on Mars, and one line names them ("Not offered on Mars: ..."). The line goes away once a Mars rover is bought.
- [ ] **New parts.** The desk offers the RTG, deployable solar arrays, the larger battery, the electric heater, grouser wheels, and eight instruments (camera, drill, neutron, X-ray, weather mast, radar, laser, organics). The RTG card says "Steady income 0.6 energy/s, day and night"; the electric heater "Heat output 3 · draws 1.2 energy/s every night". "No heater" warns that the rover freezes in its first night without another source of heat.
- [ ] **Support slots.** Arm and Mast appear after the bus slots. The build is not complete until both are chosen ("No arm" counts). Support parts take no mounting point.
- [ ] **Needs.** Without the arm, the X-ray and organics cards are greyed with "Needs the robotic arm."; without the mast, the laser card with "Needs the remote sensing mast.". Take the arm away with the X-ray in the bay: the X-ray stays, the warnings say it needs the arm, and the ticket cannot be bought until the arm is back or the X-ray is out.
- [ ] **Night budget line.** Under Battery: "Night energy (15 s): ... asleep · ... with lights". It shows a dash until power, lights and heater are chosen; "heater 18 of each" with the electric heater; "RTG +9" with the RTG; no "with lights" part without lights. It is absent on the Moon.
- [ ] **Can earn and Where lines.** Each Mars instrument card lists its Mars milestones by name ("Can earn: ...") and a short "Where:" line naming the kinds of places it is used. No card gives a reward or a how-to.
- [ ] **Tiers.** A heavy steel build with the arm, the mast and three instruments lands in the Heavy tier (100 kg, size 30, $300k); the over-the-top warning names Heavy.
- [ ] **Tutorial.** On the first Mars visit the design tutorial opens by itself: the transition, Designing for the night, Power through the night (the Night energy line, solar versus the RTG, the two heaters), Dust storm, Arm and mast. The drive tutorial: sols, lights on or sleep, cold and damage, the storm forecast, one line per carried instrument with its key, and Where to go first (Rocky area 2, the small craters, Rocky area 1; the nearest lead listed first).

## 2. The four Mars instruments and their refusals

Carry each one on a rover that can (the arm for the X-ray and organics, the mast for the laser).

- [ ] **Weather mast.** Its key switches it on (0.05 energy/s) and off. The readout under the meters shows pressure and dust with trend arrows. Left on and awake for 10 s or more before the forecast, the storm forecast comes up to 30 s earlier and credits the mast. Powered down (P) or switched off, its count starts again. At 20% battery it switches itself off.
- [ ] **Radar.** Its key switches it on (0.1 energy/s). The strip under the meters draws a profile column every 2 m driven, with the layer kind (crater floor, Séítah, delta front, boulder field). A sharp turn or 3 s standing still breaks the strip; a gentle curve does not.
- [ ] **Laser.** Facing a boulder or the delta cliff within 12 m (a cone ahead), the HUD shows "Laser target: ..., n m" and a marker over the target. Stop and press its key: 2 s hold, 8 energy, a rock reading (or "fine layers of sedimentary rock" for the cliff). Refused with nothing ahead ("nothing to read ahead"), while moving, powered down, or without the energy.
- [ ] **Organics.** Stop beside a boulder (within 4.5 m) and press its key: a 20 s hold with a progress bar, charged 1.5 per second as it runs (30 in all). Refused away from a boulder, on ground over 10°, or when the battery cannot hold the whole 30. If another drain empties the battery mid-reading, it stops with a notice and finds nothing.
- [ ] **X-ray on Mars.** Needs the arm; reads a boulder within 4.5 m (3 m on the Moon); refused with "no boulder within reach" away from boulders and with a notice naming the slope on ground over 10°. "New type: n of 6" for a type not read yet.
- [ ] **Neutron on Mars.** The hydrogen meter sits at its floor on the crater floor, reads higher in Séítah and on the delta foot, and rises toward the hidden hydrated ground over its last 80 m.
- [ ] **Mast photo zones.** With the mast aboard, the viewpoint photo circles on the minimap are larger.
- [ ] Mission history on: each new instrument shows one real fact on first use (MEDA, RIMFAX, SuperCam, SHERLOC; PIXL for the X-ray on Mars).

## 3. Sites, minimap and leads

- [ ] **Leads.** The briefing and the list under the minimap show four leads: Delta front, Séítah, Boulder field and Young crater (East crater), nearest first; the nearest arrow is drawn larger, each with its distance in km.
- [ ] **Near sites first.** Within a minute or two of driving, Rocky area 2 and the small craters (S, WSW, SW) are found. Each shows "Located: ..." and one line per instrument aboard that can act there; none names a slope, dust, noise, a generator or lights.
- [ ] **Each site.** Rocky area 1, Rocky area 2, East crater, the S, WSW, SW, SSE and ESE craters, the WNW knob, the Séítah knob, the Séítah edge, the delta foot (a thicker stretch of the delta line) and the flood boulder (a boulder icon) appear when found, with a legend entry per kind.
- [ ] **Hydrated ground** is never drawn until Hydrated ground fires; then a dotted "Hydrated ground" area and a legend entry appear. It never shows a check.
- [ ] **Check marks.** A site shows a check once each carried instrument has done its one thing there (one reading, a counted sample or a switched-on drive through its zone, a rim photo at craters with a rim). The flood boulder's camera counts only after the X-ray has read it.
- [ ] **Boulders.** About 30 boulders ring each young crater (60 at East crater), 40 at the Séítah edge and along the delta foot, 15 at each knob; none on the sand ripples. Some sit on slopes the arm refuses, with level ground a few meters away.
- [ ] **Power line.** A solar rover reads night, storm, shadow, low Sun or sunlight, with "dust −n%" once dust has cut income by 1%. An RTG rover reads "Steady power, day and night", never "Solar panel in sunlight".

## 4. The new milestones, earned on purpose

Mission history on, so each pop-up shows its fact. The near-lander zone is 120 m; sample and reading sites must be 150 m apart. Rewards are the step 7 values.

- [ ] **Crater wall** (camera): stand on a crater rim, 0.8 to 1.3 times its radius from the center, with the center in frame. From S crater's south rim near (880, 155) facing north, or WSW crater's east rim near (360, −245) facing west. The crater-wall hint shows on the rim. A photo from the floor or with the center out of frame does not count.
- [ ] **Dust devil** (camera): photograph a passing devil (`__moon.spawnDevil(100)` if none comes). Any devil in frame counts.
- [ ] **Dust devil pass** (weather mast): mast on, powered up, outside 120 m, when a devil passes within 150 m.
- [ ] **Storm log** (weather mast): mast on, powered up, outside 120 m, for 60 s of the storm (`__mission.stormSoon()` brings it forward). The HUD counts "Weather mast recording the storm: n of 60 s"; it pauses near the lander.
- [ ] **Night weather** (weather mast): mast on, awake (lights are not needed), outside 120 m, for 12 s of one night. Asleep pauses it; the 12 s must fall in one night.
- [ ] **Séítah core** and **Core sample** (drill): drill inside Séítah's outline, for example at (330, 600). One sample earns both.
- [ ] **Sand crossing**: drive across Séítah's ripples and out (north out of Séítah works) without getting stuck.
- [ ] **Hydrogen traverse** (neutron): on for an unbroken 100 m touching Séítah, then again touching the delta front: one stage each.
- [ ] **Hydrated ground** (neutron): from (780, 470) drive north with the spectrometer on; the meter peaks near (780, 420); 20 m through the 25 m core fires it and reveals the area.
- [ ] **Buried layers** (radar): an unbroken 150 m on touching a young crater's ring, Séítah, or the delta front; one stage per distinct place, up to 3.
- [ ] **Long profile** (radar): an unbroken 500 m outside 120 m (driving near the lander pauses the count).
- [ ] **Rock collection** (X-ray): 2, 3 and 4 Mars rock types; S crater's basalts and the Séítah edge's olivine rocks reach 4.
- [ ] **Rare rock** and **Documented sample** (X-ray, camera): read the flood boulder from its downhill side, about (−431, −1286.5): flood conglomerate, a record. Then photograph it in frame from within 15 m: Documented sample. A photo before the reading, or from farther, does not count.
- [ ] **Organic signals** (organics): finish a reading on a boulder outside 120 m; a second at another site 150 m away gives the second stage.
- [ ] **Remote reading** (laser): a laser reading of a boulder at up to 3 sites 150 m apart. The laser's rocks do not count toward the X-ray's Rock collection.
- [ ] **Signs of an ancient lake**, **Lake organics** (drill, organics): drill and read a boulder inside the delta-foot zone (within 50 m of the scarp foot's nearest 400 m). Signs of an ancient lake is a record.
- [ ] **Rock from afar** (laser): from the delta foot, face the delta cliff and read it.
- [ ] **Clean run**: a light build that takes no damage to the end (pays RP, no money).
- [ ] **The carried-over eight** still fire: Touchdown, Odometer (500 m, 1.5 km, 3 km), Mapper (2.5%), Night drive (100 m and 300 m after dark, with lights and any heat, an RTG included), Storm survivor (asleep through the storm counts), Delta layers (from the delta viewpoint), Core sample (3 sites), Blue sunset (Sun within 15° of the horizon, at least 300 m from the lander).

## 5. The four Mars lessons

Fresh campaign, so the notebook is empty. Each notice appears once per mission; no desk, site, milestone or tutorial text names the cause or the fix before it happens.

- [ ] **RTG and neutron.** RTG with the neutron spectrometer on: the meter's floor is raised and jitters, and the lesson fires. On a solar rover: no lesson. A noisy rover that drives over the hydrated ground still earns it.
- [ ] **Dust on the panels.** A solar rover: once dust has cut income past 15%, the lesson fires; the power line shows the dust share. A devil passing within 50 m resets the share. An RTG rover never gets it.
- [ ] **The arm on a slope.** X-ray or organics on ground over 10° (the knobs, East crater's rim, slope-target boulders): the refusal names the slope and the lesson fires. Moving to level ground a few meters away, the reading works.
- [ ] **No lights at night.** A rover without lights, awake at night: it cannot drive and the lesson fires. Asleep through the night: no lesson.
- [ ] **Review.** On the next ticket screen the review lists the met Mars lessons: RTG and neutron yellow (green on solar), dust yellow for any solar part (green with an RTG), the arm yellow for any contact instrument (never "Solved"), no lights red (Blocked) whatever else. A lesson not met never appears. The review never blocks the purchase.
- [ ] **Notebook.** One heading per world: "Moon lessons" with the Moon's count, "Mars lessons" with "n of 4 found". Moon lessons stay readable on Mars and never fire there.

## 6. Debrief

- [ ] **Groups.** The rover's own milestones, then one group per carried instrument, then "Instruments together" (Documented sample). Staged milestones show as one line.
- [ ] **Instrument log.** One line per Mars instrument carried: the weather mast's seconds on (and an early forecast), the radar's longest profile and the ground profiled, each laser reading, the organics readings finished.
- [ ] **Not reached** names only milestones the rover had the parts for. A missing support part would show as "Needs the robotic arm." (the desk prevents it in normal play).
- [ ] **Credits.** The Mars section lists terrain, imagery, the dust storm, the landing sources, milestone facts, Mars instrument facts (MEDA, RIMFAX, SuperCam, SHERLOC, PIXL), Mars parts (RTG, arrays, electric heater, larger battery, grouser wheels, arm), the Mars lessons' sources without naming the lessons, the debrief comparisons, and a note that the flood boulder, the hydrated ground and the rock types are placed by design. The Moon section no longer lists Mars sources.

## 7. Restart

- [ ] Fail a Mars round on purpose (idle at the lander), after finding sites and earning Rare rock or Signs of an ancient lake. Press restart.
- [ ] The balance, research points and records return to the start of the Mars round; Rare rock and Signs of an ancient lake can be earned again.
- [ ] The minimap is back to its first zoom with only the near ground; the hydrated ground and the check marks are gone; the four leads are back.
- [ ] Readings reset: "New type: n of 6" counts from 1, Rock collection from 0, the weather mast's records from 0.
- [ ] The notebook keeps the Mars lessons met in the failed round, and the review lists them.

## 8. Builds that should win or lose

Estimates from [Generous pass on Mars](game-design.md#generous-pass-on-mars-mars-step-7-november-15-2026): arrival balance B, pass mark 800, titanium, solid wheels, fixed panel, Li-ion, heater units unless stated, near route only. Play each once from B = 800 (after a scraping Moon round; the `?world=mars` debug start arrives with the Mars minimum, so add the difference before comparing); record the final balance and what cost the most time. A difference of more than about 100 is worth a note.

| Build (parts + ticket) | Route | Should |
| --- | --- | --- |
| Idle at the lander (440) | Stay | **Lose** (about 550) |
| Empty bay (440) | Drive the near sites | **Lose** (about 670) |
| Empty bay, steel, LED, both Night drive stages (465) | Drive at night | **Lose** at B = 800 (about 745); passes from B ≈ 855 (known risk) |
| Camera (490) | Rocky area 2, WSW crater rim, sunset | Win (about 860) |
| Drill (590) | Three sites near the lander | Win (about 820) |
| Camera + drill (640) | Near route | Win (about 1,010) |
| Arm + X-ray (620) | Near route | **Lose** (about 700); about 805 with Séítah's fourth type |
| Arm + X-ray + camera (670) | Near route | Win (about 990) |
| Arm + organics (670) | Two boulders at two sites | Win (about 860) |
| Mast + laser (650) | Near route | Lose narrowly (about 775) |
| Mast + laser + camera (700) | Near route | Win (about 965) |
| Weather mast (500) | Anywhere outside 120 m | Win (about 880) |
| Radar (530) | Long drives past the craters | Win (about 950) |
| Neutron (520) | Séítah, the hydrated ground | About 740 without the hidden ground, about 920 with it |
| RTG, LED, camera + drill, no heater (775) | Near route with night driving | Win (about 975) |

- [ ] Note which builds run short of energy at night or in the storm, and how long the near route takes a first-timer.
- [ ] Note whether a first-timer finds the near sites from the tutorial and the leads alone.

## 9. The Moon is still fine

- [ ] A fresh Moon campaign plays as before: no arm or mast slots, no night budget line, no "Where" lines on the cards, the Moon's six instruments, the X-ray reads within 3 m without an arm, the Moon credits list only Moon lessons' sources.
- [ ] The Moon's own checklist ([rover-engineering-playtest-checklist.md](rover-engineering-playtest-checklist.md)) sections 1 to 17 still pass.
