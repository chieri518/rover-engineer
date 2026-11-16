# Playtest Checklist: Payload Bay, Part Relationships and Moon Sites

A short checklist for one person playing in the browser (`cd game && npm run dev`). Sections 1 to 7 cover what [the plan](rover-engineering-implementation-plan.md) built: the payload bay, six instruments, instrument energy, five lessons, the engineering notebook and the pre-launch review. Sections 8 to 16 cover what the [Moon sites and milestones plan](moon-sites-and-milestones-plan.md) built: the new sites, the twelve new milestones, the lessons met through the new sites, a restart, and builds that should win or lose. What the game should do is in [game design, section 7](game-design.md#7-rover-design). Tick a box when the game does what the line says; write down anything else.

Keys: W A S D drive, Space brake, P power down, number keys 1 to 3 use instruments in bay order, N notebook. Use a fresh campaign unless a line says otherwise ("Start new campaign" on the title screen). Cheap ways to reach places: the dark crater is north of the landing point, about 3 km away; the Moon mission lasts 5 minutes.

## 1. The bay on the desk

- [ ] **Empty bay.** New campaign: the bay is empty and the rover cannot go to the ticket screen. Press "No instruments": the warning about the bay goes away. Finish the other slots, buy a ticket and launch. The HUD has no instrument buttons. Number keys do nothing.
- [ ] **Full steel bay.** Pick the steel chassis: "0 of 3 mounting points used". Add three instruments: the other cards turn off. Take one out: they come back. Each card shows "Key 1", "Key 2"... in the order added.
- [ ] **Titanium bay and the chassis switch.** Pick titanium: 2 points. With three instruments in the bay, switch from steel to titanium: the last one added is removed, and a notice says which. With titanium chosen first, a third instrument cannot be added.
- [ ] Taking out the last instrument leaves a confirmed empty bay (no warning about the bay).
- [ ] The cards and the spec sheet show instrument energy: the drill 10 per use, the X-ray 3 per use, the neutron spectrometer 0.1 per second.

## 2. The six instruments

For each one, build a rover that carries it (steel, three instruments at most), launch, and try to use it. Then try it where it should refuse.

- [ ] **Camera.** Key or button takes a photo at once, with no energy cost. It counts at a viewpoint. Refused while powered down (P).
- [ ] **Drill.** Stop, press its key: the rover holds still for 3 s, energy drops by 10. Refused while moving, and when the battery is too low for it.
- [ ] **Neutron spectrometer.** Starts off. Its key switches it on: the Hydrogen meter appears and the battery drains slowly. The meter rises toward the ice in the dark crater. Off again: the meter goes away.
- [ ] **X-ray spectrometer.** Beside a boulder in a rocky area: stop, use, wait 4 s: a rock type and its elements show. Away from boulders: refused with a notice. Reading the same boulder again says so.
- [ ] **Seismometer station.** Stop, use: after 3 s a small station is on the ground beside the rover and its button reads "Deployed". At the moonquake the HUD shows a trace. Pressing its key again says it is already down.
- [ ] **Laser retroreflector.** Where Earth is in view (the Earth light is on): stop, use: it is set down. Where Earth is hidden (for example inside the dark crater): refused with a notice.
- [ ] Mission history on: each new instrument shows one real fact the first time it is used. With it off: no facts.

## 3. Energy, standby and weight

- [ ] Each drill sample and X-ray reading costs its energy; a use is refused when it would empty the battery.
- [ ] Neutron spectrometer on, battery falling: at 20% it switches itself off with a notice, and switching it on at or below 20% is refused.
- [ ] Power down (P) with the spectrometer on: no drain, the meter hides; power up: it carries on.
- [ ] Power down during a drill sample: the countdown stops, and it finishes after power-up.
- [ ] **Deploying makes the rover lighter.** Note the speed and the model before and after setting down a station: the rover is a little faster, and its model loses the part.

## 4. The five lessons

Each lesson's notice appears once per mission, in its own place under the warnings. Use a fresh campaign so the notebook is empty.

- [ ] **Neutron spectrometer finds, drill confirms.** Carry the drill and no neutron spectrometer. Drill in the dark crater away from the ice spot: "No water ice" and the lesson notice. (Section 5 covers the lucky find.)
- [ ] **The seismometer needs quiet ground.** Set the station down, then keep driving within 150 m of it until the moonquake: a noisy record and the lesson. Driving near it but moving away in time must not fire it.
- [ ] **In the cold, instruments need the heater.** No heater. Enter permanent shadow and use the drill (or a station): the hold takes longer and the lesson appears. With a heater: no lesson, normal time.
- [ ] **A colder X-ray detector.** Read a boulder while the HUD shows shadow: the reading is faster and the lesson appears. In sunlight: normal time, no lesson.
- [ ] **No lights, no permanent shadow.** No lights. Drive at the edge of the dark crater: the rover stops at the edge and the lesson appears.
- [ ] **A lucky ice find.** Carry the drill, no neutron spectrometer, and drill on the ice spot: water ice found, and no neutron/drill lesson.
- [ ] **Two lessons at once** (for example a noisy quake and a drill without a neutron spectrometer close together): the second notice waits for the first to finish and then shows for its full time.

## 5. Pre-launch review

- [ ] First campaign, before any lesson: the ticket screen shows the review with no lessons, only the no-lights block (red, "Always checked") if the rover has no lights.
- [ ] After the lessons are learned and the mission is over, build a rover that would trigger them again: the review lists those lessons, each marked Fine or Risk (the color in words as well). A rover without lights shows only the red no-lights line (Blocked), whatever else it carries.
- [ ] A lesson that has not been found never appears in the review, whatever the build.
- [ ] Neutron spectrometer plus drill: the neutron/drill line shows green "Solved". Drill only: yellow. A heater with a drill or station: the cold line shows "Solved"; without a heater: yellow.
- [ ] The review never blocks the purchase.

## 6. Notebook

- [ ] The Notebook button is on the title screen (once a campaign exists), on the desk next to Help, and on the mission HUD.
- [ ] A fresh campaign: "0 of 5 Moon lessons found" and no names.
- [ ] In the mission, when a lesson fires: the button shows a dot. N (or the button) opens the notebook, the mission is paused (the clock and the rover stop), the new entry is marked "New", and the dot goes away. N or Escape closes it and the mission resumes. On the end panel, the Notebook button opens it too (the dot clears).
- [ ] Undiscovered lessons show only in the count, never by name.
- [ ] End the mission, then restart the round ("restart"): the notebook still has the lessons. Start a new campaign: it is empty.
- [ ] **Old save.** In the browser console, remove `notebook` from the `rover-engineer.campaign.v1` entry in local storage and reload: the game loads with an empty notebook and no error.
- [ ] The four new instrument cards on the desk say "Records to the instrument log. Earns no milestones yet."; the camera and drill cards do not. The X-ray card does not say anything about cold.
- [ ] With an empty bay, the drive tutorial has no "number key" line. A player with an old save sees both tutorials once more (storage key `.v2`).
- [ ] The drive tutorial and the design tutorial mention the notebook, the bay and the review, but do not say what any lesson is.

## 7. Debrief

- [ ] The **Instrument log** has one line for each new instrument that was carried, and nothing for those not carried: neutron (highest hydrogen reading, or "not switched on"), X-ray (a line per rock, or "no rocks were read"), seismometer (clean, noisy, set down after the quake, "set down, but no moonquake came", or "not set down"), reflector (placed, or "not placed"). A station never set down must not say "no moonquake recorded". The log is absent when no new instrument was carried.
- [ ] **What the rover taught us** lists each lesson met, in the order met, with what happened and the ways to solve it.
- [ ] Mission history on: each lesson also shows its real fact and source. Mission history off: the facts and sources are missing there, but still in the notebook.
- [ ] Credits screen: the "Engineering lessons" section lists the sources without naming the lessons.

## 8. Finding the sites (minimap, notices, leads)

Use a fresh campaign and a rover that carries the instruments each line names. Hold off on a long drive: every site below is within about 1.2 km of the lander, except the dark crater. Distances and directions are from the lander. Do not read the plan first: the point is whether a first-time player can find each site from the minimap and the notices alone.

- [ ] **Briefing leads.** The landing briefing and the list under the minimap show four leads: Layered wall exposure, Boulder field, Permanent shadow and Young crater (about 0.5 km east-northeast). Each has an arrow on the minimap's edge. Drive toward Young crater: the arrow and the list line go away when East crater is found.
- [ ] **Start state.** At the start only the lander and NW crater are on the map (NW crater is about 250 m out, inside the first reveal circle). Every other site is hidden. Cold traps, the rolled boulder and "Hydrogen-rich ground" are not drawn and not in the legend.
- [ ] **Site notices.** Each site that is found shows "Located: {name}, {what it is}", then one line for each instrument aboard that can act there, and stays up about 8 s (twice the usual 4 s). With the camera and the X-ray spectrometer aboard, young craters and rocky areas also give a Documented sample line. A rover that can do nothing at a site gets only the first line.
- [ ] **Notices read well when several sites are found at once.** Drive between NW crater and Rocky area 1, or along the East cluster, so two or three sites are found within seconds. The notices queue one after another, each shown for its full time, none lost or cut off. Write down any that are missing.
- [ ] **Legend.** An entry for a kind of site appears only once a site of that kind is on the map. "All earned here" appears once a check mark is drawn.
- [ ] **Check marks.** A site shows a small check only when every milestone this rover can earn there is earned. A rover that can do nothing at a site never shows a check there.
- [ ] **The ice spot** and the dark crater's inside are still unmarked. Earning Ice deposit located marks nothing.

## 9. Young craters: NW, East and SE

Carry the X-ray spectrometer and the drill (steel, bay of three). Mission history on, so each milestone shows its fact.

- [ ] **NW crater** (about 250 m north-northwest, found at the start; old and worn). Its notice says it is old and worn, with boulders scattered around it. It never says fresh or bright ejecta.
- [ ] **East crater** (about 0.5 km east-northeast) and **SE crater** (about 1.2 km east-southeast, the farthest of the three). Notices say young, with fresh boulders. No text says "bright ejecta".
- [ ] **Boulders.** About 30 boulders ring each young crater; NW crater's are sparser. Drive up to one and read it with the X-ray spectrometer (see section 10).
- [ ] **Fresh ejecta sample.** Stop within 1.5 times a young crater's radius of its center (the floor counts), at least 200 m from the lander, and drill: the milestone fires. A drill within 200 m of the lander (the nearer part of NW crater's ring) does not count. One sample can also earn a Regolith sample site.
- [ ] **Rim viewpoint 1** (inside Rocky area 1's 300 m ring): a drill sample there also earns Fresh ejecta sample. Expected, not a bug.
- [ ] After the reading, sample and (with a camera) a Documented sample photo, the site shows its check.

## 10. X-ray spectrometer: rock types, Rock collection, Rare rock

- [ ] **Each site gives its own rocks.** Read two or three boulders at each of Rocky area 1, East crater and NW crater. Rocky area 1 gives impact melt breccia and ferroan anorthosite; East crater noritic anorthosite and ferroan anorthosite; NW and SE regolith breccia and ferroan anorthosite; Rocky area 2 noritic anorthosite and regolith breccia. The same boulder always gives the same rock.
- [ ] **"New type: n of 5"** is a second line of the reading notice, only for a rock type not read yet this mission, counting up 1, 2, 3, 4 of 5. A second boulder of a type already read gives no such line. Reading the same boulder again says so.
- [ ] **Rock collection.** Stages at 2, 3 and 4 different types, each paying once. The pop-up on the first stage shows its fact and source (mission history on).
- [ ] **Rare rock** (see section 11): magnesian norite is the fifth type and counts toward the "of 5".
- [ ] A reading near the lander: the X-ray works, and nothing about distance from the lander applies (only the drill and the stations have that rule).

## 11. East crater and the rolled boulder

The rolled boulder sits at the foot of East crater's steepest wall, on the floor, with its track running up the slope behind it from the north wall top. It is approached from East crater's floor, from the north.

- [ ] **Track readable from 100 m.** From 100 m away on the lander side, the track is a visible, slightly brighter groove of oval imprints, in sun or in shade. Note if it only reads close up.
- [ ] **Minimap track.** After East crater is found, the minimap shows a boulder icon with a short line up the slope. The line reads across East crater's ring at the default zoom.
- [ ] **Approach.** Drive onto East crater's floor from the north (down the lower, gentler side), not down the steep wall. The wall is 30 to 39 degrees: expect damage or a stuck rover if you go straight down.
- [ ] **Rare rock.** With the X-ray spectrometer, stop within reach of the boulder and read it: "magnesian norite", a milestone pop-up, and a "New type" line. It pays once per campaign (a record): on a later round it shows in the debrief without a reward.
- [ ] **Boulder track.** With the camera, frame the boulder within 80 m and take a photo: Boulder track fires. This also works from East crater's rim (about 45 m away). The photo may be dark; it still counts.
- [ ] **Documented sample.** With the camera and the X-ray spectrometer both aboard, read a boulder, then photograph it in frame from within 15 m: it fires. Photographing it before reading, or from farther than 15 m, does not. A rover with only one of the two gets the missed-part notice naming the other.
- [ ] One photo can earn both Boulder track and Documented sample if the rolled boulder was read first.
- [ ] The rolled boulder's check appears only when everything this rover can do there is done (read, and photographed within 80 m).
- [ ] The reflector cannot be set down on East crater's floor (Earth is hidden): refused with a notice. The seismometer can be.

## 12. Cold traps, the hidden hydrogen and the dark crater

Carry the neutron spectrometer. Switch it on with its key before the drive.

- [ ] **Hydrogen meter.** Away from every site it sits at the noise floor. Near a cold trap it rises over a short ramp (about 25 m) to the cold level; the meter rises before the rover reaches the trap's edge.
- [ ] **Cold trap survey.** Rocky area 1's cold patch, East cold trap (about 0.6 km east-southeast) and South cold trap (about 0.9 km south-southwest): with the spectrometer on, drive an unbroken 50 m that touches the trap's zone (its outline plus 25 m), or through it. One stage per trap, up to 3. Switching the spectrometer off by hand, then on again, starts the 50 m again. A power-down for a flare pauses the count; so does the automatic switch-off at 20% battery, and switching on again continues it.
- [ ] **Notices.** A cold trap's notice says it is a small patch of ground where hydrogen may collect, plus the neutron line. It does not mention shadow, cold or light.
- [ ] **Hidden hydrogen** (between Rocky area 1 and Rim viewpoint 1, about 0.5 km north-west, on a poorly lit slope). It is never found by driving alone. Follow the meter: it rises above the cold traps' level as you near it, from about 150 m away. Drive 30 m touching the zone (35 m wide): the milestone fires, a dotted area labelled "Hydrogen-rich ground" appears on the minimap, and a legend entry appears with it. It stays drawn.
- [ ] **Rocky area 1's cold patch.** The ground beside it is 15 to 25 degrees steep: expect slope damage warnings or slowing. Note whether a player can tell from the HUD.
- [ ] **A rover without lights** is stopped at the edge of each cold trap, with the lights lesson. Surveying from the edge still works (the zone has a 25 m margin).
- [ ] **A rover without a heater** that drives into a cold trap and holds still is slowed (the cold lesson), as for Rocky area 1's patch.
- [ ] **Ice deposit located.** Dark crater, lights and neutron spectrometer aboard: the meter reaches 70% within about 90 m of the ice spot; drive 20 m in that area with the spectrometer on: the milestone fires, and no mark appears on the map. The desk and the how-to text name only the neutron spectrometer, never lights.
- [ ] **Dark prospector on steel** (steel, mesh, panel, Li-ion, lights, heater, neutron): straight to the dark crater, it arrives at about 280 s with under 20% battery and cannot switch the spectrometer back on in the dark. Expected: the route fails. Write down the arrival time and battery.
- [ ] The dark crater counts as a cold trap for the survey: a stage is earned there (it is the biggest cold trap).

## 13. Stations: seismometer, reflector, Science station

Carry the seismometer and the reflector (and the X-ray spectrometer as a third).

- [ ] **Too close to the lander.** Stop within 200 m of the lander. The seismometer's HUD hint reads "too close to the lander to count"; the first press of its key shows a confirm line and does nothing else. Press again within 5 s: it is set down, with a "works, but earns no milestones here" notice. Wait more than 5 s before the second press: the first is forgotten and asks again.
- [ ] **Refusals come first.** Moving, powered down, or (for the reflector) no Earth: the refusal shows before any confirm is asked. The reflector with no Earth gets no too-close hint.
- [ ] **Reflector light, three states.** "Earth in view" (more than 200 m out, Earth up), "Earth hidden" (for example in a crater), and "Earth in view, too close to the lander" (within 200 m).
- [ ] **Edge case.** At almost exactly 200 m from the lander the confirm may not appear, and the station lands 1.6 m to the rover's left: the notice says if it counts. Write down anything confusing.
- [ ] **Laser ranging site.** More than 200 m out, Earth in view (the bench between the lander and the East cluster works), stop and set the reflector down: the milestone fires.
- [ ] **Moonquake record.** Seismometer more than 200 m out, set down before the moonquake (about 110 to 225 s): the HUD trace shows at the quake and the milestone fires, whether the trace is clean or noisy and whether the rover is powered down or not.
- [ ] **Clean seismogram.** Drive away from the station, farther than the quiet distance, before the quake: the record is clean and the second milestone fires. Stay within 150 m until the quake: noisy, the first milestone only, the lesson fires (section 14).
- [ ] **Science station.** Set both stations down more than 200 m out and within 100 m of each other, with Earth in view at the reflector: the milestone fires when the second one goes down, in either order. It is a record, once per campaign. A rover carrying only one station never gets it.
- [ ] **A station set down inside 200 m** blocks that station's milestones for the whole mission, even if you drive away. It still records into the instrument log.

## 14. Lessons met through the new sites

Fresh campaign. None of these lessons may be named, hinted or solved by any site notice, desk card or milestone text.

- [ ] **Neutron finds, drill confirms.** Carry the drill without the neutron spectrometer; drill in the dark crater away from the ice: "No water ice" and the lesson. The new young-crater and cold-trap notices never say to bring both.
- [ ] **Seismometer needs quiet ground.** Set the station out near the East cluster, then keep driving within 150 m of it through the quake: noisy record and the lesson. The Clean seismogram's how-to text says only "record" and "clean".
- [ ] **Cold needs the heater.** Hold still in a cold trap (East, South or Rocky area 1's patch) without a heater: the hold takes longer and the lesson appears. With a heater: normal.
- [ ] **X-ray detector.** Read a boulder in shadow (East crater's floor, or the rolled boulder): faster, with the lesson. In sunlight: normal. Check it fires at the new boulders, not only Rocky area 1's.
- [ ] **No lights.** Drive a lightless rover to a cold trap's edge: it stops and the lesson fires.
- [ ] **No spoilers.** Read every notice, legend line, desk card, how-to and tutorial line met in sections 8 to 13: none names a lesson's cause or fix (no "drive away", "quiet", "heater", "shadow", "lights" beyond the dark crater's map name and the Earth light).

## 15. Desk, debrief and notebook with the new milestones

- [ ] **Desk cards** list the milestones each instrument can earn, by name only, and the combos (Documented sample on camera and X-ray; Science station on both stations). The new instruments no longer say "Earns no milestones yet" on the Moon.
- [ ] **Debrief groups.** The rover's own milestones first, then one group per carried instrument in bay order, then "Instruments together" for combos. A staged milestone is one line ("Odometer: 2 of 3"). Empty groups are left out.
- [ ] **Instrument log.** Each instrument's last line ends with "Earned: ...", and the X-ray adds "Rock collection: n of 5 rock types".
- [ ] **Not reached.** A list of milestones the rover carried the parts for and did not earn: names only, in the same order. It leaves out capability milestones that need no parts, records already held this campaign, and any staged milestone with a stage earned. Check it with a rover that earns nothing at the sites.
- [ ] **Mission history off:** facts and sources are missing from pop-ups and the debrief; the milestone names are still there.
- [ ] **Notebook with several headings.** Open it (N): one heading per world, Moon first. Moon lessons met through the new sites appear under the Moon.
- [ ] **Credits** say the rolled boulder and its track, the hydrogen-rich ground and each site's rock types are placed by design, inspired by real findings. No fact claims bright ejecta for NW or East crater.

## 16. Restart

- [ ] Fail a round on purpose (idle at the lander until the end) after discovering sites, using the stations and earning at least one record (Rare rock or Science station if possible). Press restart.
- [ ] **The map resets.** The minimap is back to its first zoom, with only the lander and NW crater. Every other site is hidden again, including "Hydrogen-rich ground" and the check marks. The four leads are back and show the same directions and distances.
- [ ] **Records reset.** Rare rock and Science station can be earned again in the restarted round (the records list is restored from the round snapshot). Touchdown, Water ice and the other records behave the same.
- [ ] **Stations, readings and explored area reset.** Both stations can be set down again; the X-ray's "New type: n of 5" counts from 1; Rock collection starts at 0 types; Mapper starts at 0%.
- [ ] **The notebook is kept.** Lessons met in the failed round are still in it, and the review on the ticket screen still lists them.
- [ ] Start a new campaign instead of restarting: the notebook is empty too.

## 17. Builds that should win or lose

Estimates are from [game design, Balance with the Moon sites and milestones](game-design.md#balance-with-the-moon-sites-and-milestones): 750 budget, pass mark 780, balance tuned by hand. Play each one once, record the final balance and what cost the most time. Estimates err generous on purpose. A difference of more than about 100 from the estimate is worth a note.

| Build (parts + ticket) | Route | Should |
| --- | --- | --- |
| Idle, any build | Stay at the lander | **Lose** (at most about 580) |
| Empty bay: steel, mesh, panel, NiH2 (400) | Wall, boulder field, rim | **Lose** (about 690 to 730) |
| Reflector only (430) | As the empty bay, reflector on the rim | **Lose** (about 720) |
| Camera scout (450) | Wall, boulder field, Rim viewpoint 1, Earth | Win about 890 to 940 if it reaches the rim in time; about 770 (lose) if not |
| Drill geologist (550) | Rocky area 1, both rims | Win (about 820) |
| Ice hunter (735) | The dark crater | Win (about 825 to 875) |
| Rock hound: Ti, mesh, panel, Li-ion, camera + X-ray (600) | East crater and the rolled boulder, NW crater, Rim viewpoint 1 | Win (about 820 to 920), but a longer route runs out of time |
| Station keeper: steel, mesh, panel, Li-ion, seismometer + reflector + X-ray (620) | Both stations on the East bench, East crater, NW crater, boulder field | Win (about 820 to 870) |
| Near prospector: Ti, mesh, panel, Li-ion, neutron + X-ray (630) | NW crater, Rocky area 1's cold patch and the hidden hydrogen, East crater, East cold trap | Win (about 790 to 870); steep ground by the cold patch can cost a minute |
| X-ray only, light: Ti, solid, panel, Li-ion, X-ray (440) | Two young craters and the rolled boulder | Win (about 830) |
| Dark prospector: steel, mesh, panel, Li-ion, lights, heater, neutron (635) | Straight to the dark crater | **Lose** on steel (about 375 to 425: arrives late with a flat battery); about 825 only if it reaches the ice signal with energy to spare |

- [ ] A drill win ends with the "Continue to Mars" button and the Mars minimum budget in the debrief.
- [ ] Routes that stay near the lander do not reach Mapper (about 1.3% of the map instead of 1.8%): note the final Mapper share.
- [ ] The rocky1East to rocky1North crossing often shows "Partial crossing". Entering Rocky area 1 from the south gets the milestone; note whether the notice is enough to tell a player what to do.
- [ ] A Camera scout on the long wall route may not reach the rim in time for Earth and the panorama: note the clock when it arrives.
