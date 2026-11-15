# Rover Engineer: Rover Engineering Design

The design space for the rover the player builds at the engineer's desk: every component the game could offer, the constraints that limit how they combine, and the properties they give the rover in a mission. It is written for our team, not for players.

Last updated November 15, 2026. The game rules themselves stay in [game-design.md](game-design.md), which is the source of truth. This doc is the catalog behind its [Rover design](game-design.md#7-rover-design) section: when a part or rule here is decided for a world, game-design.md records it and links back here. Real numbers come from [rover-engineering/02](research/rover-engineering/02-rover-subsystems.md) unless another source is given.

**How to read this doc.** Same convention as game-design.md: everything is **decided** unless it is marked *Proposed* (suggested, waiting for a yes or no) or *Open* (not settled yet). The first draft's open questions were all decided on November 15 (see [Decisions and later work](#10-decisions-and-later-work)). Game numbers in this doc are **indicative**: they show the intended scale against today's parts and are settled in a balance pass, then stored in `game/data/*.json`.

**Scope.** Game design only. The technical implementation plan comes after this design is settled. New Moon milestones and map changes are also out of scope for now; milestone ideas below are listed to show what each instrument is for, not as a build list.

## Contents

1. [Summary](#1-summary)
2. [Design principles](#2-design-principles)
3. [The rover model: constraints and properties](#3-the-rover-model-constraints-and-properties)
4. [The payload bay](#4-the-payload-bay)
5. [How instruments work in a mission](#5-how-instruments-work-in-a-mission)
6. [Instrument catalog](#6-instrument-catalog)
7. [The Moon payload](#7-the-moon-payload)
8. [Instruments by world](#8-instruments-by-world)
9. [Other components: the bus](#9-other-components-the-bus)
10. [Decisions and later work](#10-decisions-and-later-work)

## 1. Summary

| Area | Design |
| --- | --- |
| Payload bay | **Decided (November 15):** the single instrument slot becomes a payload bay that holds several instruments. The chassis sets how many mounting points the bay has (steel 3, titanium 2); each instrument takes one; an empty bay is allowed. |
| Variety | Instruments differ by **what the player does** with them (look, dig, sense while driving, touch, deploy), not by levels of the same thing. Levels exist for a few instruments and appear on later worlds. |
| Instrument costs | Instruments cost energy and time in a mission, not only cost, mass, and size at the desk. Power and battery choices then matter for science as well as for driving. |
| Mission features | Some instruments give the player live information as well as milestones: the neutron spectrometer's hydrogen meter, the spectrometer's rock readout, an Earth line-of-sight light for the retroreflector. |
| Moon payload | Six instruments: science camera, regolith drill, neutron spectrometer, X-ray spectrometer, seismometer station, laser retroreflector. Every one flew on a real lunar mission. |
| Later worlds | The rest of the catalog unlocks with RP on Mars and Titan, together with support hardware (robotic arm, mast) and new constraints (data, dust, night, cold). A first version, to revisit after playtesting. |

## 2. Design principles

1. **Every part costs something at the desk and changes something in the mission.** A part that only moves a number the player never feels does not earn a place on the desk. Constraints are the costs (cost, mass, size, mounting points, energy); properties are what the rover can then do.
2. **Different instruments, different verbs.** Each instrument should give the player a different thing to do in the mission, so a rover with three instruments plays differently from one with a single instrument. This is how the Moon gets more to do without a bigger map: one rocky area can serve a camera, a drill, and a spectrometer in three different ways.
3. **Variety before levels.** A new type of instrument beats a better version of an old one. Levels are used only where real hardware actually comes in clear generations (for example a shallow drill and a 2 m drill), and they appear on later worlds.
4. **Science uses the same resources as driving.** Instruments draw energy and need the rover to stop. The player trades range against science, which ties the power source and battery to the instrument choice.
5. **Instruments combine.** Some goals are best reached with two instruments together, for example the neutron spectrometer finds where the ice is and the drill confirms it. Combinations make the bay a real planning decision.
6. **Real basis for every instrument.** Each instrument is a type that has flown or is planned on a real rover or lander, with a cited mission, and it does in the game what it does in reality, simplified. Mission history facts (optional, as in game-design.md) can explain it.
7. **The Moon stays simple.** The Moon's core tension stays mass versus cost. The bay adds one more simple rule (mounting points); arms, masts, data, and dust wait for Mars.

## 3. The rover model: constraints and properties

A rover is a set of parts. **Constraints** limit which sets the player can build and launch. **Properties** are what the mission reads from the build.

### Constraints

| Constraint | What sets it | What uses it up | What happens over the limit | World |
| --- | --- | --- | --- | --- |
| Budget | Campaign balance | Part costs plus the launch ticket | Cannot launch | Moon onward |
| Launch tier: mass | Ticket tiers (Small, Medium, Large) | Total mass of all parts | Pays the next tier; above Large cannot launch | Moon onward |
| Launch tier: size | Ticket tiers | Total size of all parts | Same as mass | Moon onward |
| Chassis load | Chassis maximum load | Total mass | Damage while driving | Moon onward |
| Mounting points | Chassis (steel 3, titanium 2) | One per instrument | Cannot fit another instrument | Moon onward |
| Energy | Battery capacity and power income | Driving, instrument use, instrument standby, (later) heaters and night | Out of energy ends the mission | Moon onward |
| Support hardware | Arm and mast parts | Contact instruments need an arm; mast instruments need a mast | Cannot fit the instrument | Mars onward |
| Data downlink | Comms part and relay passes | Data from instruments | Science waits for the next pass, or is lost | Mars onward, if game-design.md open question 6 makes data a resource (*Open* there) |
| Heat | Heater, RTG waste heat, insulation | Cold zones, night, (Titan) everywhere | Freezing | Moon (cold zones) onward; Titan everywhere |
| RP unlocks | Research points | Unlocking parts | Part not available yet | Mars onward (the Moon has no unlocks) |

### Properties

| Property | Parts that give it | What it changes in the mission |
| --- | --- | --- |
| Top speed | Wheels, reduced by total mass | How far the rover gets in the mission time |
| Energy per meter | Wheels, raised by total mass | Driving range |
| Grip | Wheels | Slip and getting stuck on soft ground |
| Energy income | Power source | Recharging in sunlight |
| Energy storage | Battery | Range between recharges; reserve for instruments |
| Light range | Lights | Entering permanent shadow |
| Heat | Heater | Time before freezing in the cold |
| Science capabilities | Instruments | Which milestones the rover can earn |
| Live readouts | Some instruments (neutron spectrometer, spectrometer, and later radar, weather station, penetrometer) | Information on the HUD that helps the player decide where to go |
| Deployables | Seismometer station, retroreflector, (later) other stations | Parts left on the surface; the rover gets lighter after deploying them |

### How parts affect each other

Mass is the main coupling on the Moon, as in game-design.md ([Mass versus cost](game-design.md#mass-versus-cost)). The bay adds two more:

```
Instrument ──► mass ──► ticket tier, speed, energy per meter, sinkage, chassis load
     │
     ├──► mounting point ──► chassis choice (steel carries more, titanium is lighter)
     │
     └──► energy use ──► power source and battery choice
```

- **More instruments, heavier rover.** Each instrument adds mass and size, so a third instrument can push a rover into a higher ticket tier, slow it down, and raise its energy use per meter. This is the real "instrument chain": Curiosity's 10 instruments weighed 75 kg against 5 kg on each MER rover, and Curiosity needed a sky crane ([02](research/rover-engineering/02-rover-subsystems.md#overview-and-coupling-map)).
- **Mounting points tie the bay to the chassis.** The cheap, heavy steel frame carries more instruments; the expensive, light titanium frame carries fewer. A player who wants a light, fast rover gives up an instrument.
- **Energy ties instruments to power.** An instrument that draws energy while switched on, or for each use, shortens the range. A rover with three instruments may want the solar mast or the larger battery.

## 4. The payload bay

**Decided (November 15):** the Moon's single instrument slot becomes a payload bay, with the rules below. Not built yet.

| Rule | Proposal |
| --- | --- |
| Mounting points | The chassis sets the bay's mounting points: steel 3, titanium 2. Each instrument takes one point. |
| Empty bay | Allowed, like "No lights" and "No heater". A rover with no instruments can still earn capability milestones, but by the balance rule it cannot pass the Moon. |
| Duplicates | One of each instrument. Two cameras do nothing a single camera cannot. |
| Desk display | The bay shows its mounting points as empty sockets. Instruments are cards with cost, mass, size, energy use, and the verb ("Sense while driving", "Touch a rock"). The spec sheet adds the instrument energy use to the range estimate. |
| Build preview | Each instrument has its own place on the 3D rover (camera on a short post, drill at the front, spectrometer on a small arm under the body, stations on the deck until deployed). |
| Empty start | The bay starts empty, like the other slots; it counts as chosen once the player has confirmed it (even with no instruments). |
| Mission controls | Each fitted instrument gets a number key (1, 2, 3) and a HUD button, replacing today's fixed C and F keys. |

**Why the chassis sets the points.** It gives the two chassis a second difference beyond cost and mass, and it is how real rovers work: the frame and deck decide where instruments can mount. Real examples range from Pragyan (26 kg, two instruments: APXS and LIBS, [ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html)) to Perseverance (seven instruments, 59 kg of payload, [02](research/rover-engineering/02-rover-subsystems.md#instrument-reference-values)).

**Ticket tiers are not retuned here.** The camera scout build weighs 75 kg today, exactly the Medium limit, so any second instrument moves it to Large. Tier limits and prices, and the mounting-point counts if needed, are left to a later balance patch that tunes play and exploration together.

## 5. How instruments work in a mission

### Ways to use an instrument (verbs)

| Verb | What the player does | Instruments (any world) |
| --- | --- | --- |
| Look | Point the rover and capture | Science camera, multispectral camera |
| Dig | Stop and drill for a few seconds | Regolith drill, deep drill, coring drill |
| Sense while driving | Switch on and drive; a live meter reads as the rover moves | Neutron spectrometer, ground-penetrating radar, magnetometer |
| Touch | Park next to a rock or patch of ground and hold still | X-ray spectrometer, microscopic imager, penetrometer, heat probe |
| Zap from a distance | Aim at a target a few meters away | Laser spectrometer |
| Deploy and leave | Stop, set a station down, drive on; it keeps working | Seismometer station, laser retroreflector, weather mast |
| Monitor | Leave it switched on; it records over the mission | Radiation dosimeter, weather station, dust monitor |
| Analyze | Feed it a sample from another instrument and wait | Mass spectrometer, organics spectrometer |
| Produce | Park and run it for a long time on lots of power | Oxygen maker (ISRU demonstration) |

### Costs in a mission

Each instrument has up to three costs, chosen to match how the real instrument works:

| Cost | Meaning | Example |
| --- | --- | --- |
| Energy per use | A one-off energy cost each time it is used | Drill: energy per sample |
| Standby energy | A steady draw while switched on; the player can switch it off | Neutron spectrometer while driving |
| Time held still | The rover must stop and stay still while it works | Spectrometer reading, drill, deploying a station |

Today the camera and drill use no energy, and the drill holds the rover still for 3 mission seconds. Adding energy costs makes the power choice part of the science plan. Real anchors: instruments draw roughly 5 to 50 W against a rover total of 50 W for Pragyan; a ground-penetrating radar draws 5 to 10 W and SHERLOC up to about 49 W ([02](research/rover-engineering/02-rover-subsystems.md#instrument-reference-values)). In game terms (a fixed panel earns 1 energy per second, full-speed driving uses about 2), a light instrument on standby should cost around a tenth of the panel's income, and a heavy one a large share.

### Mission features

Some instruments help the player plan, not only score:

| Feature | Instrument | What the player sees |
| --- | --- | --- |
| Hydrogen meter | Neutron spectrometer | A live gauge that rises near buried hydrogen, read while driving. Replaces today's drill-only hydrogen clue (see [7](#7-the-moon-payload)). |
| Rock readout | X-ray spectrometer | The rock's type and main elements after a reading (for example "anorthosite: calcium and aluminum rich"). |
| Earth line of sight | Laser retroreflector | A light that shows whether Earth is in view from where the rover stands, because Earth's lasers must reach the reflector. |
| Quake record | Seismometer station | The moonquake's trace on the HUD and in the debrief, if the station was deployed in time. |
| Ground firmness | Penetrometer (Mars) | How soft the ground is at the rover, a warning before getting stuck. |
| Subsurface profile | Ground-penetrating radar (Mars) | A strip showing buried layers under the path just driven. |
| Storm warning | Weather station (Mars) | Pressure and dust trends that warn of a dust storm. |
| Dose meter | Radiation dosimeter (Mars) | The radiation dose so far, and how much each flare added. |

## 6. Instrument catalog

Every instrument the game could offer, grouped by family. For each: what it is in reality, what it does in the game, what it could earn, and any levels. Game numbers are indicative (today's camera is 50 cost, 3 kg, size 1; the drill 90, 8 kg, size 3). The world column says where it is first offered (see [8](#8-instruments-by-world)).

### Imaging

#### Science camera *(exists)*

- **Real basis:** every rover carries cameras; Mastcam-Z on Perseverance is about 4 kg and 17.4 W ([02](research/rover-engineering/02-rover-subsystems.md#instrument-reference-values)).
- **In the game:** look. Photos at viewpoints, of crater walls, and of Earth, kept in the album.
- **Could earn:** pictures (panoramas, Earth), imaging science (crater layers).
- **Indicative numbers:** 50 cost, 3 kg, size 1. No energy cost per photo (cheap and simple stays cheap and simple).
- **Levels:** Science camera (Moon) → Multispectral camera (Mars).
- **World:** Moon.

#### Multispectral camera

- **Real basis:** cameras with filter wheels that separate rock types by color, such as Zhurong's multispectral camera and Mastcam-Z's filters ([Zhurong instruments](https://pmc.ncbi.nlm.nih.gov/articles/PMC8456422)).
- **In the game:** look, with a color overlay that marks different rock types in the view. Could also double as the camera.
- **Could earn:** mapping rock units, finding the right rock for another instrument.
- **Levels:** level 2 of the science camera.
- **World:** Mars.

#### Microscopic imager

- **Real basis:** close-up cameras on the arm, such as MER's microscopic imager and Perseverance's WATSON ([02](research/rover-engineering/02-rover-subsystems.md#arms)).
- **In the game:** touch. Hold still beside a rock to image its grains.
- **Could earn:** grain-scale features (layering, round grains that point to water on Mars).
- **Needs:** robotic arm.
- **World:** Mars.

### Drilling and sampling

#### Regolith drill *(exists)*

- **Real basis:** VIPER's TRIDENT drills to 1 m in 10 cm bites ([02](research/rover-engineering/02-rover-subsystems.md#drills-and-sampling-systems)).
- **In the game:** dig. Stop and drill; samples count away from the lander; the ice must be drilled to be found.
- **Could earn:** regolith samples, water ice.
- **Indicative numbers:** 90 cost, 8 kg, size 3, an energy cost per sample. No hydrogen clue: that moves to the neutron spectrometer (see [7](#7-the-moon-payload)).
- **Levels:** Regolith drill (Moon) → Deep drill (Mars) → Coring drill with sample cache (Mars, later).
- **World:** Moon.

#### Deep drill

- **Real basis:** Rosalind Franklin's drill reaches 2 m with extension rods ([ESA](https://exploration.esa.int/web/mars/-/45084-exomars-rover)), below the layer radiation damages.
- **In the game:** dig, in stages: each stage goes deeper and takes longer, and the player chooses when to stop.
- **Could earn:** samples from below the surface (ice, preserved organics on Mars).
- **Levels:** level 2 of the drill.
- **World:** Mars.

#### Coring drill and sample cache

- **Real basis:** Perseverance cuts cores into sealed tubes and left a depot of tubes on the surface ([02](research/rover-engineering/02-rover-subsystems.md#drills-and-sampling-systems)).
- **In the game:** dig, then choose where to cache. A cached sample keeps its value even if the rover is lost afterwards.
- **Could earn:** cached samples; a depot milestone.
- **Needs:** robotic arm.
- **World:** Mars (later).

### Sensing while driving

#### Neutron spectrometer

- **Real basis:** VIPER's Neutron Spectrometer System prospects for hydrogen while the rover drives, sensing about 1 m into the ground ([NASA VIPER](https://science.nasa.gov/mission/viper/rover-and-instruments)); LRO's LEND maps the same signal from orbit (already a history fact in the game).
- **In the game:** sense while driving. A live hydrogen meter rises as the rover nears buried hydrogen. It does not need the rover to stop.
- **Could earn:** a hydrogen survey (drive a line through a cold area), and it helps find the ice for the drill.
- **Indicative numbers:** about 80 cost, 4 kg, size 2, standby energy while switched on.
- **Levels:** Neutron spectrometer, passive (Moon) → Active neutron spectrometer (Mars; Curiosity's DAN fires its own neutron pulses and reads deeper while stopped) → Gamma-ray and neutron spectrometer (Titan; Dragonfly's DraGNS also reads elements).
- **World:** Moon.

#### Ground-penetrating radar

- **Real basis:** Yutu-2's Lunar Penetrating Radar, Zhurong's subsurface radar and Perseverance's RIMFAX (under 3 kg, 5 to 10 W, [02](research/rover-engineering/02-rover-subsystems.md#instrument-reference-values)).
- **In the game:** sense while driving. A strip shows the buried layers under the path the rover just drove; a straight, steady drive gives a clean profile.
- **Could earn:** a radar transect across a crater rim or an old lava flow; finding buried ice layers on Mars.
- **World:** Mars (it also flew on the Moon; held back so Mars has a new verb).

#### Magnetometer

- **Real basis:** Zhurong carried a magnetometer ([Zhurong instruments](https://pmc.ncbi.nlm.nih.gov/articles/PMC8456422)); Mars's southern highlands have strong magnetized crust left from its lost global field.
- **In the game:** sense while driving. A live field reading that changes across magnetized ground.
- **Could earn:** crossing a magnetic anomaly; evidence that Mars once had a magnetic field.
- **World:** Mars.

### Composition by contact or laser

#### X-ray spectrometer (APXS)

- **Real basis:** Pragyan's Alpha Particle X-ray Spectrometer, lowered to the ground by a small mechanism, measured the elements in lunar soil ([ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html)); Lunokhod and the MER rovers carried similar X-ray instruments.
- **In the game:** touch. Park next to a rock and hold still for a few seconds; the HUD shows the rock type and its main elements.
- **Could earn:** comparing different rocks (rocks in a boulder field are thrown out from different depths by the impact); finding an unusual rock.
- **Indicative numbers:** about 60 cost, 2 kg, size 1, a few seconds held still and a small energy cost per reading.
- **Needs:** on the Moon a built-in deploy mechanism, as on Pragyan; from Mars, contact instruments need the robotic arm.
- **World:** Moon.

#### Laser spectrometer (LIBS)

- **Real basis:** laser-induced breakdown spectroscopy vaporizes a pinpoint of rock and reads the light: Pragyan's LIBS (which confirmed sulfur near the south pole), and SuperCam on Perseverance, which works at up to about 7 m (about 10.6 kg, 17.9 W, [02](research/rover-engineering/02-rover-subsystems.md#instrument-reference-values)).
- **In the game:** zap from a distance. Aim at a rock within a few meters without driving up to it, faster than touching but heavier and hungrier.
- **Could earn:** the same composition science as the X-ray spectrometer, reached differently; targets the rover cannot drive to (a rock on a steep slope).
- **Needs:** mast.
- **World:** Mars.

#### Organics spectrometer

- **Real basis:** SHERLOC on Perseverance uses ultraviolet Raman and fluorescence to find organic molecules (about 4.7 kg, about 49 W, [02](research/rover-engineering/02-rover-subsystems.md#instrument-reference-values)).
- **In the game:** touch, slow and power-hungry; works best on a freshly drilled or abraded surface.
- **Could earn:** organic molecules, a candidate sign of past life (Mars record).
- **Needs:** robotic arm.
- **World:** Mars.

### Laboratories

#### Mass spectrometer

- **Real basis:** instruments that heat a sample and weigh the gases it gives off: PRIME-1's MSolo on the Moon, Curiosity's SAM (40 kg, ovens at up to 40 W), and DraMS on Dragonfly for Titan ([02](research/rover-engineering/02-rover-subsystems.md#instrument-reference-values)).
- **In the game:** analyze. Feed it a sample from the drill, then wait while it heats. Heavy, with a burst of energy per analysis.
- **Could earn:** confirming water and other volatiles in a sample; Titan's organic chemistry. Pairs with a drill.
- **Needs:** a drill (a sampling instrument) in the bay.
- **World:** Titan. (MSolo flew on the Moon in 2025; held back as a late, heavy instrument.)

#### Atmosphere sampler

- **Real basis:** gas analyzers that sample the air, such as SAM's atmosphere mode. game-design.md already decides air samples start on Mars and Titan.
- **In the game:** monitor; draws small air samples over the mission.
- **Could earn:** methane on Mars; Titan's nitrogen and methane air.
- **World:** Mars.

### Deployed stations

#### Seismometer station

- **Real basis:** Apollo crews left seismometers that recorded moonquakes for years; Chandrayaan-3's ILSA was the first MEMS seismometer on the Moon ([ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html)); InSight's SEIS recorded marsquakes.
- **In the game:** deploy and leave. Stop, set the station down, drive on. If it is deployed before the mission's moonquake, it records the quake.
- **Could earn:** recording a moonquake (the event every Moon mission already has).
- **Indicative numbers:** about 70 cost, 4 kg, size 2. Deploying takes a few seconds held still. The station's mass leaves the rover, so the rover is lighter and a little faster afterwards.
- **Levels:** Seismometer station (Moon) → Broadband seismometer (Mars, InSight-class; reads distant quakes and the planet's interior).
- **World:** Moon.

#### Laser retroreflector

- **Real basis:** passive corner-cube arrays that bounce lasers from Earth to measure the Moon's distance. Apollo 11, 14 and 15 left arrays, and Lunokhod 1 and 2 each carried a French-built one; Lunokhod 1's was found again by LRO in 2010 and is still ranged.
- **In the game:** deploy and leave. It needs no power, but it must be set down where Earth is in view, because Earth's lasers have to reach it. The HUD shows whether Earth is in view.
- **Could earn:** placing a reflector Earth can range.
- **Indicative numbers:** about 30 cost, 3 kg (Lunokhod 1's array was about 3.7 kg, *unverified*), size 1, no energy. Its mass leaves the rover when deployed.
- **World:** Moon.

#### Heat flow probe

- **Real basis:** Apollo 15 and 17 drilled heat flow probes about 2.5 m deep; Blue Ghost's LISTER reached about 1 m in 2025 (*unverified*); InSight's HP3 "mole" on Mars could not dig down in the loose soil.
- **In the game:** deploy and leave, after a long hold while it drills in. Reads how much heat flows out of the interior.
- **Could earn:** a heat flow measurement (only a handful exist on the Moon and Mars).
- **World:** Mars.

#### Weather mast

- **Real basis:** Perseverance's MEDA (about 5.5 kg, up to 17 W), Curiosity's REMS, Zhurong's weather station; Dragonfly's DraGMet on Titan.
- **In the game:** monitor (on the rover) or deploy (as a station). Shows temperature, pressure, wind, and dust trends; warns of dust storms.
- **Could earn:** logging a full day and night cycle; recording a dust devil or storm.
- **World:** Mars. Not on the Moon: it has almost no atmosphere.

### Environment monitors

#### Radiation dosimeter

- **Real basis:** Curiosity's RAD (1.7 kg) measured the dose astronauts would take on Mars; Chang'e-4's lander carried a dosimeter for the lunar surface.
- **In the game:** monitor. A dose meter on the HUD. Recording a flare's full dose means staying powered on when it hits, so the dosimeter's milestone works against Flare survivor: risk against reward.
- **Could earn:** measuring a flare; a full-mission dose record for future astronauts.
- **World:** Mars.

#### Dust monitor

- **Real basis:** dust sensors and adhesion experiments on CLPS landers; Mars rovers measure dust on their solar panels.
- **In the game:** monitor. Shows dust building on the panels, which lowers energy income on Mars.
- **Could earn:** logging a dust cleaning event.
- **World:** Mars.

#### Penetrometer

- **Real basis:** Lunokhod's PrOP penetrometer pushed a cone into the soil to measure how firm it was; Spirit was lost in soft sand at Troy in 2009.
- **In the game:** touch, or sense while driving through the wheels. Shows how soft the ground is under the rover, a warning before getting stuck.
- **Could earn:** comparing firm and soft ground.
- **World:** Mars (soft sand is Mars's signature hazard; the Moon already teaches soft ground without it).

### Resource demonstrations

#### Oxygen maker (ISRU demonstration)

- **Real basis:** MOXIE made oxygen from Mars's carbon dioxide on Perseverance (about 17.1 kg, 300 W, [02](research/rover-engineering/02-rover-subsystems.md#instrument-reference-values)).
- **In the game:** produce. Park and run it; it uses a large share of the energy for as long as it runs.
- **Could earn:** making a set amount of oxygen.
- **Needs:** big power (an RTG or a mast and a large battery).
- **World:** Mars (later).

#### Liquid sampler

- **Real basis:** *Speculative.* Titan has lakes of liquid methane and ethane; mission concepts such as Titan Mare Explorer proposed sampling them, but none has flown.
- **In the game:** touch, at a shoreline.
- **Could earn:** sampling a hydrocarbon lake (Titan record).
- **World:** Titan.

## 7. The Moon payload

**Decided (November 15):** six instruments, two of them today's. The list can be tuned later.

| Instrument | Verb | Uses what the game already has | Indicative cost / mass / size | Energy |
| --- | --- | --- | --- | --- |
| Science camera *(exists)* | Look | Viewpoints, crater wall, Earth | 50 / 3 kg / 1 | None |
| Regolith drill *(exists)* | Dig | Samples, ice spot | 90 / 8 kg / 3 | Per sample |
| Neutron spectrometer | Sense while driving | The hydrogen signal, the cold areas | 80 / 4 kg / 2 | Standby |
| X-ray spectrometer | Touch | Boulders in the rocky areas | 60 / 2 kg / 1 | Per reading |
| Seismometer station | Deploy and leave | The moonquake event | 70 / 4 kg / 2 | None after deploying |
| Laser retroreflector | Deploy and leave | Earth visibility | 30 / 3 kg / 1 | None |

**Why these six.**

- **Six different things to do.** No two share a verb except the two stations, and those differ: the seismometer is about timing (deploy before the quake), the reflector about place (Earth in view).
- **All lunar.** Each type flew on a real lunar rover or lander (Pragyan, Lunokhod, Apollo, VIPER, Chandrayaan-3), so the Moon payload is historically honest.
- **They work with the current map and events.** Boulders, cold areas, the moonquake, and Earth visibility already exist, so the instruments add things to do without needing new terrain. New milestones for them are a later step.
- **Range of prices.** The reflector is cheap and light; the drill is expensive and heavy. A tight budget still has choices.
- **Combinations.** Neutron spectrometer and drill for the ice; spectrometer and camera at a boulder field; a station dropped on the way to somewhere else.

**The hydrogen clue moves to the neutron spectrometer** *(decided November 15)*. Until now each drill sample in the dark crater reported a hydrogen signal (strong, moderate, weak; game-design.md). With the bay, the live hydrogen meter belongs only to the neutron spectrometer, as on VIPER, and the drill only confirms the ice; the drill gives no hydrogen reading of its own. An ice hunter therefore needs two mounting points and the energy for both. This changes the ice route's balance: with today's numbers and the indicative ones above, the cheapest ice build plus a neutron spectrometer reaches size 24, over the Medium limit of 23, so it would need the Large ticket and cost about 895 against a 750 budget. That is left to the later balance patch, with the tiers.

**Held back for Mars and Titan.** Ground-penetrating radar and the mass spectrometer have also flown on the Moon (Yutu-2, PRIME-1) but are kept for later worlds so each world brings new verbs; their history facts can say they also flew on the Moon.

## 8. Instruments by world

**Decided (November 15), as a first version to revisit after playtesting.** Each world adds new types first and levels second, plus the support hardware and constraints that make its instruments a harder puzzle.

| Instrument | Moon | Mars | Titan |
| --- | --- | --- | --- |
| Science camera | Available | Multispectral camera (level 2) | |
| Regolith drill | Available | Deep drill (level 2); coring drill and cache (later) | |
| Neutron spectrometer | Available | Active neutron spectrometer (level 2) | Gamma-ray and neutron spectrometer (level 3) |
| X-ray spectrometer | Available | Needs the arm | |
| Seismometer station | Available | Broadband seismometer (level 2) | Available |
| Laser retroreflector | Available | | |
| Ground-penetrating radar | | New | Available |
| Magnetometer | | New | |
| Laser spectrometer | | New (needs mast) | |
| Microscopic imager | | New (needs arm) | |
| Organics spectrometer | | New (needs arm) | Available |
| Atmosphere sampler | | New | Available |
| Weather mast | | New | Available |
| Radiation dosimeter | | New | |
| Dust monitor | | New | |
| Penetrometer | | New | Available |
| Heat flow probe | | New | |
| Oxygen maker | | Later | |
| Mass spectrometer | | | New |
| Liquid sampler | | | New (*speculative*) |

**Unlocks.** From Mars on, new instruments cost RP to unlock (game-design.md: "Locked parts first appear on Mars, greyed out with 'needs X RP'"). The thresholds belong to the unlock tree, game-design.md open question 3. One rule worth keeping: an instrument earns most of its RP on the world before it unlocks its level 2, so using the neutron spectrometer on the Moon helps unlock the active one on Mars.

## 9. Other components: the bus

The parts that keep the rover alive and moving. Moon options are today's (game-design.md, [Moon parts](game-design.md#moon-parts)); later options are a first version (decided November 15, to revisit after playtesting) and feed open question 2 in game-design.md.

| Slot | Moon | Mars | Titan | Constraints it uses | Properties it gives |
| --- | --- | --- | --- | --- | --- |
| Chassis | Steel, titanium | Add a rocker-bogie frame (climbs better, heavier) | | Cost, mass, size | Maximum load, mounting points |
| Wheels | Solid, wire mesh | Add thick aluminum wheels with grousers | Add wide flotation wheels for soft organic sand | Cost, mass, size | Speed, grip, energy per meter |
| Power | Fixed panel, solar mast | Add deployable arrays (more income, collect dust); RTG | RTG only (at Saturn's distance sunlight is about 1% of Earth's, and Titan's haze blocks most of that) | Cost, mass, size | Energy income; RTG adds steady heat |
| Battery | Nickel-hydrogen, lithium-ion | Larger packs for the night | | Cost, mass, size | Energy storage |
| Lights | None, LED floodlights | Needed to work at night | Needed in the long night | Cost, mass, size, (later) energy | Light range |
| Heater | None, radioisotope heater units | Add RTG heat loop, phase-change heat store | Needed everywhere | Cost, mass, size | Heat |
| Payload bay | Up to 3 instruments (steel 3, titanium 2) | Same, with support hardware below | Same | Mounting points | Science capabilities |
| Robotic arm | Not offered | New: needed for contact instruments | | Cost, mass, size, energy | Enables touch instruments |
| Mast | Not offered | New: needed for the laser spectrometer; raises the camera | | Cost, mass, size | Enables mast instruments; wider map reveal |
| Communications | Not offered (via the lander) | New: relay radio or direct-to-Earth antenna | | Cost, mass, size, energy | Data downlink (open question 6) |
| Computer | Not offered | New: faster computer for self-driving assists | | Cost, mass, energy | Driving aids, hazard stop |

Real anchors for each slot are in the [component catalog](research/rover-engineering/02-rover-subsystems.md#component-catalog-for-the-game) and the [coupling matrix](research/rover-engineering/02-rover-subsystems.md#coupling-matrix).

## 10. Decisions and later work

Every open question from the first draft was settled on November 15, 2026:

| # | Question | Decision |
| --- | --- | --- |
| 1 | Mounting points per chassis | Steel 3, titanium 2 |
| 2 | Retune ticket tiers for rovers with several instruments? | Not here. Left to a later balance patch that tunes play and exploration together |
| 3 | Instrument energy costs | Standby for the neutron spectrometer, per use for the drill and spectrometer, none for the camera and stations; values set in the balance patch |
| 4 | Does the drill keep a weak hydrogen clue? | No. The hydrogen meter belongs only to the neutron spectrometer |
| 5 | The Moon payload | The six in [7](#7-the-moon-payload); can be tuned later |
| 6 | Milestones for the new Moon instruments | Not in this scope. Nothing on the Moon level changes yet, including new milestones; that is a later iteration |
| 7 | Mars and Titan instruments and support hardware | As in [8](#8-instruments-by-world) and [9](#9-other-components-the-bus), a first version to revisit after playtesting; feeds game-design.md open questions 2 and 3 |

**Next:** the technical implementation plan for the payload bay and the four new Moon instruments, once this design is settled.
