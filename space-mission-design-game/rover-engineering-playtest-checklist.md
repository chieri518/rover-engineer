# Playtest Checklist: Payload Bay and Part Relationships

A short checklist for one person playing in the browser (`cd game && npm run dev`). It covers what [the plan](rover-engineering-implementation-plan.md) built: the payload bay, six instruments, instrument energy, five lessons, the engineering notebook and the pre-launch review. What the game should do is in [game design, section 7](game-design.md#7-rover-design). Tick a box when the game does what the line says; write down anything else.

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
