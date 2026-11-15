# Rover Engineer: Rover Engineering Design

The design space for the rover the player builds at the engineer's desk: every component the game could offer, the constraints that limit how they combine, and the properties they give the rover in a mission. It is written for our team, not for players.

Last updated November 15, 2026. The game rules themselves stay in [game-design.md](game-design.md), which is the source of truth. This doc is the catalog behind its [Rover design](game-design.md#7-rover-design) section: when a part or rule here is decided for a world, game-design.md records it and links back here. Real numbers come from [rover-engineering/02](research/rover-engineering/02-rover-subsystems.md) unless another source is given.

**How to read this doc.** Same convention as game-design.md: everything is **decided** unless it is marked *Proposed* (suggested, waiting for a yes or no) or *Open* (not settled yet). The first draft's open questions were all decided on November 15 (see [Decisions and later work](#11-decisions-and-later-work)). Game numbers in this doc are **indicative**: they show the intended scale against today's parts and are settled in a balance pass, then stored in `game/data/*.json`.

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
10. [Relationships and consequences](#10-relationships-and-consequences)
11. [Decisions and later work](#11-decisions-and-later-work)

## 1. Summary

| Area | Design |
| --- | --- |
| Payload bay | **Decided (November 15):** the single instrument slot becomes a payload bay that holds several instruments. The chassis sets how many mounting points the bay has (steel 3, titanium 2); each instrument takes one; an empty bay is allowed. |
| Variety | Instruments differ by **what the player does** with them (look, dig, sense while driving, touch, deploy), not by levels of the same thing. Levels exist for a few instruments and appear on later worlds. |
| Instrument costs | Instruments cost energy and time in a mission, not only cost, mass, and size at the desk. Power and battery choices then matter for science as well as for driving. |
| Mission features | Some instruments give the player live information as well as milestones: the neutron spectrometer's hydrogen meter, the spectrometer's rock readout, an Earth line-of-sight light for the retroreflector. |
| Moon payload | Six instruments: science camera, regolith drill, neutron spectrometer, X-ray spectrometer, seismometer station, laser retroreflector. Every one flew on a real lunar mission. |
| Relationships | **Decided (November 15):** parts affect each other (needs, conditions, conflicts, wear). Players discover them in the mission, an engineering notebook collects them (kept across failed runs), and a pre-launch review flags the ones already discovered. About four on the Moon, more on Mars and Titan. See [10](#10-relationships-and-consequences). |
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

## 10. Relationships and consequences

**Decided (November 15).** On a real mission the rover is not a shopping list. Each choice has consequences for other parts and for what the rover can do on the surface. This section designs how the game shows that, so the desk becomes a puzzle of connected choices, not only capability against cost, mass, and power.

**Why it belongs in the game.** The brief names the educational gap as understanding "how mission subsystems interact", and CORE-05 asks for at least one causal connection between a design choice and its consequences elsewhere in the mission ([challenge brief](challenge-brief.md#core-challenge-outcomes)). The challenge is also labeled Beginner/Youth, so the relationships must be fun to discover, not a wall of rules.

### Risks to the game

| Risk | Why it hurts |
| --- | --- |
| Silent consequences | An instrument that quietly fails, explained only at the debrief, feels unfair rather than clever. The fix is clear feedback in the mission when a consequence happens, not warnings before it (rule 1) |
| Long feedback loop | A Moon mission is 5 minutes; a consequence found at minute 4 is slow to learn from |
| One right answer | Long chains (A needs B needs C) narrow the puzzle to one build and break the "several ways to pass" rule in game-design.md |
| Overload while driving | Real-time driving already takes attention; operating chores on top of it are too much |
| Overload at the desk | Ten rules to remember is homework, not a puzzle |

### Rules for relationships

1. **Discover in the mission, never in silence.** Relationships are not announced before the player has met them. When one happens, the mission says so at once, in plain language: what is happening, the cause, and that the player can do something about it now (for example "Seismometer trace noisy: the rover is driving nearby"). The pre-launch review shows only relationships already discovered (see [Pre-launch review](#pre-launch-review)).
2. **Mild by default, but they count.** A consequence makes something slower, noisier, or riskier, and the player can respond during the mission; it rarely forbids. Consequences still matter: they can cost enough milestones to fail the Moon's pass mark, and some add damage to the rover or its parts that builds up. Hard blocks stay few and obvious (no lights, no entering permanent shadow).
3. **At least two answers.** Every relationship can be solved in more than one way (add a part, change the plan, or pick another instrument), so several builds stay viable.
4. **One cause, one signal, one explanation.** Each relationship has a single cause at the desk, a visible signal in the mission (a meter, an icon, the notice from rule 1), and a plain-language "why" in the debrief with the real mission behind it (brief items EDU-05 and EDU-06).
5. **Rationed per world.** About three or four on the Moon, more on Mars and Titan. No chain longer than two steps on the Moon.
6. **Real and checked.** Each relationship is a documented effect on a real mission. Claims that do not survive checking stay out (see [Checked claims](#checked-claims)).

### Kinds of relationship

| Kind | Meaning | Example |
| --- | --- | --- |
| Needs | One part only works, or only reaches a place, with another | Lights to enter permanent shadow; the drill needs the neutron spectrometer to find the ice |
| Conditions | A part works only, or works better, in certain conditions | Stopped and steady; Earth in view; colder detector, sharper reading |
| Conflicts | One part degrades another | A nuclear generator adds neutron noise to a neutron spectrometer |
| Shares | Parts compete for one resource | Mounting points, energy, time held still; a big lab and the wheels cannot both run |
| Wear | Using the rover changes it | Sharp rocks wear wheels (Mars) |

Shares are already in the design (mass, mounting points, energy). The new work is the other four kinds.

### Pre-launch review

Before buying the launch ticket, the desk runs a short review, as real missions hold design reviews before launch. It lists, in plain language, the relationships the current build triggers **that REL has already met in the field**, marked green (fine), yellow (a risk to plan around), or red (something will not work), the same status colors NASA's concept maturity checklists use ([challenge brief](challenge-brief.md#resources)).

**The review shows only what the notebook holds** *(decided November 15)*. It gets smarter as REL gains field experience, the way real design reviews lean on earlier missions' lessons.

| Relationship | What the review shows |
| --- | --- |
| Not yet in the notebook | Nothing. The player finds it in the mission. |
| In the notebook | The full line: what happens, why, and the answers. Example: "Yellow. Seismometer station: the rover's own driving shakes the ground. Deploy it, then drive away before the moonquake." |
| Hard blocks | Always shown, because the desk and the mission already state them. Example: "Red. No lights: the rover cannot enter permanent shadow." |

- **Why not hint at undiscovered relationships.** Most hints give the answer away: "seismometer station with a driving rover" already tells the player not to drive near it. Discovery is the fun, and the learning sticks better when the player sees it happen.
- **Why the first meeting is still fair.** Consequences are mild by default and the mission explains them as they happen (rules 1 and 2), so the player can react in the same run. The debrief explains the real basis, and the notebook entry unlocks, so the next design can plan for it.
- **Risk is a choice.** The player can launch with yellow and red items. NASA's own telescope game greys out incompatible choices instead; this game lets players learn from the result, as the brief asks ("learn from successful and unsuccessful outcomes").
- **A first build has an empty review** apart from hard blocks. That is expected: REL is new, and the review fills up with the player's own experience.

### Engineering notebook

A collection of relationships the player has met, kept across the campaign. **Decided (November 15):** unlike balance, RP, and records, the notebook is **not** rolled back by a restart: knowledge from a failed run is the point of failing, and it cannot be farmed for money. An entry unlocks the first time a relationship affects a mission, and holds the cause, what happened, how to solve it, and the real story (for example Curiosity's neutron detector and its generator). It rewards discovery, gives players a reason to try different builds, and shows judges the learning design. Real basis: NASA keeps a lessons learned system for exactly this.

### Moon relationships

| Relationship | Kind | What the player sees | Answers | Real basis |
| --- | --- | --- | --- | --- |
| The neutron spectrometer finds the ice, the drill confirms it | Needs | Hydrogen meter rises near the ice; the drill alone gets no clue | Bring both; or skip the ice and earn elsewhere | VIPER planned to prospect with its neutron spectrometer, then drill ([NASA VIPER](https://science.nasa.gov/mission/viper/rover-and-instruments)) |
| The seismometer needs quiet ground | Conditions | Its trace is noisy while the rover drives nearby; clean once the rover is far enough away | Deploy early and drive on; or deploy where the route does not return | InSight isolated its seismometer from its own tether and covered it with a wind and thermal shield to cut noise ([JPL](https://www.jpl.nasa.gov/news/insights-seismometer-now-has-a-cozy-shelter-on-mars/)) |
| Cold and dark: instruments need the heater in permanent shadow, the camera needs lights | Needs | Without the heater, instruments in the cold work slowly; without lights, photos in shadow come out black | Bring heater and lights; or keep science in sunlight | Lunar polar shadows reach about 25 to 40 K (game-design.md, [Shadowed craters](game-design.md#shadowed-craters)); VIPER needed its own lights to work in shadow ([NTRS](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)) |
| A colder X-ray detector gives sharper readings | Conditions | X-ray spectrometer readings finish faster in shadow; the one instrument that likes the cold | Plan readings in shade; or accept slower readings in sunlight | Curiosity's APXS reaches its best resolution below about −15 °C and uses a small cooler to chill its detector in daytime ([MSL APXS](https://an.rsl.wustl.edu/help/Content/About%20the%20mission/MSL/Instruments/APXS%20Alpha%20Particle%20X-ray%20Spectrometer.htm)) |

The retroreflector's need for Earth in view is a condition of a single instrument, already in its catalog entry, not a relationship between parts. Stopping to drill, touch, or deploy is a base rule for all instruments.

*Simplification:* the X-ray spectrometer's sensor head sits outside the rover's warm body (on Pragyan a small mechanism lowers it to the ground), so in the game it does not need the heater in the cold, while its electronics are assumed protected inside.

### Mars relationships

| Relationship | Kind | What the player sees | Answers | Real basis |
| --- | --- | --- | --- | --- |
| A nuclear generator (RTG) adds neutron noise | Conflicts | The hydrogen meter has a raised noise floor on an RTG rover | Solar power instead; or the active neutron spectrometer, which reads with its own pulses and subtracts the background | Jun et al. (2013) estimated about 60% of DAN's thermal neutron counts at Rocknest came from Curiosity's MMRTG, 40% from cosmic rays (JGR Planets 118:2400, doi:10.1002/2013JE004510) |
| Big labs and driving cannot run together | Shares | A lab analysis pauses driving, or waits for night | Plan analyses during stops or at night; more battery | Curiosity schedules SAM around its power budget ([NASA blog](https://science.nasa.gov/blog/sols-3900-3901-making-the-most-of-limited-power)); Sojourner could not run its APXS and radio at once ([PDS](https://pds.nasa.gov/data/mpfr-m-apxs-2-edr-v1.0/mprv_0001/document/roverdoc/uplkdocs/overview/opsvgs.htm)) |
| Scout, drill, then analyze | Needs | The lab is idle until the drill delivers a sample; the laser shows which rock is worth drilling | Bring the pair; or pick other science | Curiosity's ChemCam checks targets before drilling and the drill feeds CheMin and SAM ([NASA blog](https://science.nasa.gov/blog/sols-2887-2889-ok-chemin-now-its-your-turn/)) |
| The arm cannot reach targets on steep ground | Conditions | Contact instruments refuse targets on slopes or behind rocks | Park level beside the target; or the laser spectrometer from a distance | Perseverance's PIXL and SHERLOC must sit a few centimeters from the rock ([JPL](https://www.jpl.nasa.gov/news/nasas-perseverance-rover-scours-mars-for-science/)) |
| Sharp rocks wear the wheels | Wear | Wheel wear rises on rocky ground; worn wheels slow the rover | Thicker wheels; or longer, smoother routes | Curiosity's wheels were holed on sharp rocks and its team chose smoother routes ([JPL](https://www.jpl.nasa.gov/news/curiosity-adds-reverse-driving-for-wheel-protection/)) |
| Dust on the panels | Conditions | Energy income falls over the mission | Dust monitor and planning; or an RTG (with its neutron noise) | [02](research/rover-engineering/02-rover-subsystems.md#dust-on-the-panels-dust-factor) |

### Titan relationships

| Relationship | Kind | What the player sees | Answers | Real basis |
| --- | --- | --- | --- | --- |
| The RTG's waste heat keeps the rover warm | Needs | An RTG rover resists freezing; a rover on heaters alone drains energy | RTG; or more heaters and battery | An MMRTG gives about 2,000 W of heat with 110 W of power ([02](research/rover-engineering/02-rover-subsystems.md#overview-and-coupling-map)) |
| The mass spectrometer needs a drill sample | Needs | Idle until the drill delivers | Bring the pair | Dragonfly's DraMS analyzes collected samples |
| The RTG background on the gamma-ray and neutron spectrometer | Conflicts | Readings need longer to rise above the generator's background | Longer readings; the active pulsed source | Dragonfly's DraGNS uses a pulsed neutron generator and must account for the MMRTG background ([JHU APL](https://jhuapl.edu/destinations/instruments/dragns)) |

### Checked claims

Two claims were checked against sources on November 15 before going in:

- **Heater units and neutron noise: not used.** A light-weight radioisotope heater unit holds about 2.7 g of plutonium dioxide, against about 4.8 kg in an MMRTG. By that ratio (our estimate) a rover with 1 to 10 heater units has roughly 0.1% to 2% of an RTG's neutron output, too little to matter next to the cosmic-ray background. The noise relationship applies only to a full RTG, so it starts on Mars. Safe wording: "A small heater gives off only a few neutrons, but a big nuclear generator gives off enough to drown out a neutron detector."
- **X-ray detector and cold: used, worded carefully.** Curiosity's APXS documentation confirms a colder detector gives sharper readings and that it uses a cooler. That the team ran it overnight *for this reason* is not documented, so the game does not say so. Safe wording: "Curiosity's X-ray tool gets sharper readings when its detector is colder, so it uses a small cooler to chill the detector."

### Questions for relationships

| # | Question | Status |
| --- | --- | --- |
| R1 | Adopt relationships, the pre-launch review, and the engineering notebook? | **Decided (November 15):** yes |
| R2 | The Moon set | **Decided (November 15):** the four in [Moon relationships](#moon-relationships) |
| R3 | How strong the effects are (slowdown, noise floor, quiet distance) | **Decided (November 15):** set in the later balance patch |
| R4 | Does the review show only relationships already in the notebook? | **Decided (November 15):** yes. Undiscovered relationships are not shown; the mission explains them when they happen. Hard blocks are always shown (see [Pre-launch review](#pre-launch-review)) |
| R5 | Does a restart roll back the notebook? | **Decided (November 15):** no; the notebook survives restarts and failed runs |

## 11. Decisions and later work

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
