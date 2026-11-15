# Rover Subsystems: What a Rover Is Made Of and How It Is Sized

This file breaks a planetary rover into its subsystems (mobility, power, thermal, communications, navigation and computing, arm and sampling, science payload, structure) and explains how engineers size each one and why every choice pushes on the others. It is written for the game team: it pairs sourced numbers from real rovers (Sojourner, Spirit and Opportunity, Curiosity, Perseverance, Yutu-2, Zhurong, Pragyan, VIPER, Rosalind Franklin, CADRE) with formulas, a three-tier component catalog, and worked sizing examples that a simplified "design a rover and keep it alive" simulation can reuse.

Researched November 14, 2026. Official facts carry inline source links. Sections and rows labeled **Our analysis** are our own calculations or simplifications, not agency guidance. Values marked *unverified* rest on a single or weak source, or sources disagree.

Quick navigation: [Overview and coupling](#overview-and-coupling-map) · [Reference fleet](#reference-fleet-at-a-glance) · [Mobility](#mobility) · [Power](#power) · [Thermal](#thermal) · [Communications](#communications) · [Navigation and autonomy](#navigation-autonomy-and-computing) · [Arm and sampling](#robotic-arm-and-sampling) · [Science payload](#science-payload) · [Structure and mass](#structure-and-mass-budget) · [Dust, radiation, wear](#dust-radiation-and-wear) · [Component catalog](#component-catalog-for-the-game) · [Worked examples](#worked-sizing-examples) · [Key numbers](#key-numbers-for-the-game) · [Game implications](#game-implications) · [Sources](#sources)

Related files: mission narratives are in [01-rover-missions-history.md](01-rover-missions-history.md); planetary environments, landing sites and daily operations planning are in [03-surface-environments-and-operations.md](03-surface-environments-and-operations.md); game precedents and scenarios are in [04-rover-games-and-scenarios.md](04-rover-games-and-scenarios.md). Generic spacecraft theory (solar cell types, battery depth-of-discharge rules, link budget formulas, margins) is in [../mission-engineering/03-spacecraft-subsystems.md](../mission-engineering/03-spacecraft-subsystems.md) and is linked rather than repeated here.

## Overview and coupling map

A rover is a spacecraft on wheels. It has the same bus functions as an orbiter (power, thermal, computing, telecom, structure) but replaces propulsion and attitude control with **mobility**, adds **manipulation** (an arm, drill, or scoop), and must survive a surface environment with gravity, dust, day-night cycles, and terrain. For the game concept, the player owns everything that rolls off the lander. The delivery system (cruise, entry, landing) is provided, but its capacity sets the rover's maximum mass and stowed volume.

Engineers close a rover design the same way they close any spacecraft: iterate until mass, energy, data, and volume all fit with margin. Rover-specific chains:

- **Instrument chain:** more instruments add mass and energy demand. More mass means higher wheel loads, which needs bigger wheels, stronger actuators and a heavier chassis, which raises delivered mass. Curiosity's 10 instruments total 75 kg against 5 kg on each MER rover ([MSL landing press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)), and Curiosity needed a sky crane rather than airbags.
- **Solar chain:** solar is cheap and available, but energy falls with dust on the panels, with dust in the air (optical depth tau), with winter, and with latitude. More array area means more mass and stowed volume (the panels must fold into the lander) and a bigger battery to bridge the night.
- **RTG chain:** a radioisotope generator gives steady power day and night and about 2,000 W of "waste" heat for free ([NASA MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf)), but it weighs about 45 kg, produces only about 110 W electric, and its plutonium-238 fuel is scarce and slow to produce.
- **Autonomy chain:** a faster computer and better cameras let the rover drive farther per sol without waiting for Earth, but compute draws power and radiation-tolerant processors are slow and expensive.
- **Data chain:** more or higher-resolution instruments make more bits, which need more relay passes or a bigger antenna and transmitter, which cost energy.

### Coupling matrix

**Our analysis.** Rows are the design choice being increased; columns show what it pushes on. "+" means the column's requirement or value usually goes up. Synthesized from the subsystem sections below.

| Increase (row) → affects (column) | Rover mass | Energy per sol | Heater energy | Wheel / motor size | Data volume | Stowed volume | Cost / scarcity | Risk / failure modes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| More instruments | + | + | + (each needs warm-up) | + | + | + | + | + (more things to break) |
| Bigger solar array | + | (more supply) | | + | | + (folding panels) | + | + (deployment, dust) |
| RTG instead of solar | + (45 kg unit) | (steady supply) | - (free heat) | + | | + | ++ (Pu-238 limited) | - (no dust or winter cliff) |
| Bigger battery | + | | + (keep above about -20 °C) | + | | + | + | - (more night margin) |
| RHUs (radioisotope heaters) | + (small) | | - | | | | + (nuclear launch approval) | - |
| Bigger wheels | + | + (drive power) | + (actuator warm-up) | (is the change) | | + | + | - (climb, less sinkage) |
| More wheels (4 → 6 → 8) | + | + | + | | | + | + | - (redundancy, flotation) |
| Faster computer / AutoNav | + (small) | + | + | | + (images) | | + | - (fewer stuck events) |
| Robotic arm and drill | + | + | + | + | + | + | + | + (mechanism faults) |
| High-gain antenna for direct-to-Earth | + | + | | | (more downlink) | + | + | + (pointing mechanism) |
| Design life (sols) | + (margin, redundancy) | | + | + (wear) | + | | + | |

## Reference fleet at a glance

| Rover (landed) | Body | Mass | Wheels | Power | Top speed | Design life | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sojourner (1997) | Mars | 10.5 to 10.6 kg | 6, rocker-bogie | 0.2 m² solar, 13 W nominal, non-rechargeable LiSOCl₂ backup cells | not given | 7 sols primary | [NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=MESURPR), [NASA](https://science.nasa.gov/mission/mars-pathfinder/) |
| Spirit, Opportunity (2004) | Mars | 174 kg (170 kg in later NASA comparison) | 6, 26 cm diameter | 1.3 m² triple-junction solar, up to 140 W, about 900 Wh/sol at start; two Li-ion batteries | 5 cm/s | 90 sols | [MER launch press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Curiosity (2012) | Mars | 899 kg | 6, 50 cm aluminum | MMRTG about 110 W, about 2,700 Wh/sol; two 42 Ah Li-ion | 4 cm/s | 1 Mars year | [MSL landing press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Perseverance (2021) | Mars | 1,025 kg | 6, 52.5 cm aluminum, 48 grousers | MMRTG about 110 W; two 43 Ah Li-ion (26.5 kg); demand up to 900 W | 152 m/h (4.2 cm/s) | 1.5 Mars years | [Mars 2020 landing press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf), [NASA rover components](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) |
| Yutu-2 (2019) | Moon (far side) | 140 kg | 6 | Solar by day, RHU for lunar night | about 200 m/h *unverified* | 3 lunar days design (far exceeded) | [Space.com](https://www.space.com/change-4-moon-spacecraft-third-lunar-night.html) |
| Zhurong (2021) | Mars | 240 kg | 6, active suspension | Solar (dust-resistant array) | about 200 m/h | at least 3 months | [Spaceflight Now](https://spaceflightnow.com/2021/05/25/chinese-rover-drives-onto-surface-of-mars/) |
| Pragyan (2023) | Moon (south polar region) | 26 kg | 6 | 50 W solar; talks only to lander | about 1 cm/s *unverified* | 1 lunar day (about 14 Earth days) | [ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html) |
| VIPER (delivery planned late 2027) | Moon (south pole) | 447 kg roving, 490 kg at launch | 4, 50 cm, active suspension | 3 vertical solar panels (320 W each, 450 W corner), 5,420 Wh battery | 20 cm/s top, 10 cm/s nominal | 100-day science window | [NASA VIPER briefing (NTRS)](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf), [GeekWire](https://www.geekwire.com/2025/nasa-order-blue-origin-viper-rover-moon/) |
| Rosalind Franklin (launch planned 2028) | Mars | 310 kg launch mass | 6, wheel-walking | Solar | 50 to 100 m per sol | 2 m drill | [ESA factsheet](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Exploration/ExoMars/ExoMars_Factsheet) |
| CADRE (3 rovers, IM-3) | Moon | not published by JPL; "under 10 kg" in secondary reports *unverified* | 4 | Solar | not given | 1 lunar day | [JPL CADRE](https://www.jpl.nasa.gov/missions/cadre) |

## Mobility

### Architecture choices

| Choice | Real examples | Why | Trade |
| --- | --- | --- | --- |
| 4 wheels | VIPER, CADRE | Simpler, lighter; VIPER adds active suspension and explicit steering of +/-50° ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)) | Less redundancy; a single stuck wheel is a bigger share of traction |
| 6 wheels, rocker-bogie | Sojourner, MER, Curiosity, Perseverance, Pragyan, Yutu-2 | Keeps all wheels on the ground over a rock as big as a wheel, no springs ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)) | More actuators (Curiosity: 6 drive + 4 steering motors) |
| 6 wheels, active suspension | Zhurong, Rosalind Franklin | Can lift wheels, change ride height, and "walk" out of soft sand ([ESA](https://exploration.esa.int/web/mars/-/45084-exomars-rover); [The Innovation, 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8456422)) | More actuators, more control complexity |
| 8 wheels | Lunokhod (historical) | Flotation and redundancy | Mass; covered in [01-rover-missions-history.md](01-rover-missions-history.md) |
| Rotorcraft | Ingenuity (1.8 kg, about 350 W during an up-to-90-second flight), Dragonfly (Titan, launch no earlier than July 2028) | Range independent of terrain | Very short flight time on Mars; needs thin-air rotors spinning about 2,400 rpm ([Ingenuity press kit](https://jpl.nasa.gov/news/press_kits/mars_2020/download/ingenuity_landing_press_kit.pdf); [NASA Dragonfly](https://science.nasa.gov/mission/dragonfly/)) |

### How rocker-bogie works

On each side, a **bogie** links the middle and rear wheels at a pivot. A **rocker** connects that bogie pivot to the front wheel. The two rockers connect through a **differential** across the body, so when one side climbs, the body pitches only half as much ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)). Mass is arranged with the center of mass near the rocker pivot, which lets MER tolerate a 45° tilt in any direction without overturning, though flight software limits tilt to 30° ([MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)). Perseverance is also designed for 45° with drivers avoiding terrain over 30° ([NASA](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/)).

The rule of thumb is that a rocker-bogie rover can climb an obstacle about as tall as its wheel diameter. MER "rolls over rocks bigger than the wheel diameter of 26 centimeters" ([MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)); Perseverance is quoted at 40 cm obstacles and depressions as wide as its 52.5 cm wheel ([NASA](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/)). VIPER, with four wheels, has requirements of 15 cm obstacles and 15° slopes ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)).

Curiosity also used its mobility system as landing gear, absorbing touchdown loads directly, and every NASA rover since Sojourner can dig a trench by spinning one corner wheel while the other five hold still ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)).

### Wheels and grousers

| Rover | Wheel diameter | Material and features | Source |
| --- | --- | --- | --- |
| MER | 26 cm | Aluminum, cleats | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Curiosity | 50 cm (20 in) | Machined aluminum, chevron grousers (24), curved titanium spokes for springy support | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf), [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf) |
| Perseverance | 52.5 cm | Aluminum, 48 nearly straight grousers, skin twice as thick as Curiosity's, slightly narrower and taller; 1.65 m travel per turn | [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf), [NASA](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) |
| VIPER | 50 cm | Spoked, 2.5 cm grousers | [NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf) |

**Curiosity's wheel damage.** Curiosity's thin aluminum wheels began accumulating punctures and tears at a higher-than-designed rate from October 2013 on sharp, embedded rocks. JPL responded with a software fix, the Traction Control algorithm, which computes no-slip wheel speeds from the rover's kinematics, attitude and suspension angles so that each wheel stops pushing against the others ([JPL, IEEE Aerospace 2018](https://www-robotics.jpl.nasa.gov/media/documents/2018-ieee-aerospace-trctl.pdf)). Perseverance's wheel redesign (twice the grousers, twice the skin thickness, straighter treads) came directly from that experience ([Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf)). Curiosity's skin thickness is often quoted as 0.75 mm *unverified* (secondary source only).

### Wheel load

**Our analysis** (python3). Weight per wheel = mass × local gravity / number of wheels, with gravity 3.73 m/s² on Mars and 1.62 m/s² on the Moon ([NSSDC Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html), [NSSDC Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)) and the masses in the fleet table above.

| Rover | Weight on surface | Per wheel | Per wheel ÷ wheel diameter |
| --- | --- | --- | --- |
| Pragyan (Moon) | 42 N | 7 N | n/a |
| Yutu-2 (Moon) | 227 N | 38 N | n/a |
| VIPER (Moon, 4 wheels) | 724 N | 181 N | 362 N/m |
| MER (Mars) | 649 N | 108 N | 416 N/m |
| Zhurong (Mars) | 895 N | 149 N | n/a |
| Curiosity (Mars) | 3,353 N | 559 N | 1,118 N/m |
| Perseverance (Mars) | 3,823 N | 637 N | 1,214 N/m |

Bigger rovers did not scale their wheels as fast as their mass: Curiosity's per-wheel load per unit wheel diameter is about 2.7 times MER's. That is one reason big rovers are more sensitive to sharp rocks and soft sand.

### Terramechanics basics

The classic model used for wheel-soil interaction is the Bekker-Wong pressure-sinkage relation combined with the Janosi-Hanamoto shear relation ([Hu et al., NASA NTRS 2025](https://ntrs.nasa.gov/api/citations/20250001809/downloads/main-20250215.pdf)):

```
Pressure under the wheel:    p = (k_c / b + k_phi) × z^n          [Pa]
Shear strength of the soil:   tau_max = c + p × tan(phi)          [Pa]
Shear developed:              tau = tau_max × (1 - exp(-j / K))    [Pa]
Slip:                         s = 1 - v_actual / (omega × r)      [-]
```

z is sinkage, b is wheel width, k_c, k_phi and n are soil constants measured with a bevameter, c is cohesion, phi is internal friction angle, j is shear displacement and K the shear deformation modulus. For the game, three consequences matter:

1. **Sinkage grows with load and shrinks with wheel size.** For a rigid wheel in Bekker theory, sinkage scales roughly as `(W / (b × sqrt(D)))^(2/(2n+1))`, so for n = 1 it scales as `(W / (b × sqrt(D)))^(2/3)`. **Our analysis:** doubling rover mass at fixed wheel size increases sinkage by about 59%; doubling wheel width cuts it by about 37%.
2. **Traction comes from soil shear strength.** Mars soils measured from MER wheel trenches show friction angles of about 30° to 37° and cohesions of 0 to 2 kPa ([Sullivan et al. 2011, JGR](https://doi.org/10.1029/2010JE003625), values via abstract summary *unverified*). Apollo-era estimates put lunar soil friction angles between 30° and 50°, with cohesion rising with depth ([Connolly and Carrier, LPSC 2023](https://ntrs.nasa.gov/api/citations/20220018853/downloads/LPSC%202023%20Abstract_Connolly_Carrier_v2.pdf)).
3. **Earth tests are optimistic.** Testing a lighter "gravity-offset" rover on Earth overestimates how well it will drive in low gravity, because the soil itself is also weaker under lower gravity; this was studied for VIPER prototypes ([Hu et al. 2025](https://ntrs.nasa.gov/api/citations/20250001809/downloads/main-20250215.pdf)).

**Lessons from getting stuck** (narratives belong in [01-rover-missions-history.md](01-rover-missions-history.md)):

- Opportunity at "Purgatory" (sol 446, April 2005) had driven about 40 m of a planned 90 m drive when its wheels dug more than 10 cm into a wind ripple. Escape took nearly five weeks of tiny commanded wheel turns ([NASA photojournal PIA07922](https://photojournal.jpl.nasa.gov/catalog/PIA07922)). Lesson: slip detection should stop a drive early.
- Spirit became embedded in soft sulfate-rich soil at "Troy" in 2009, and with failing drive wheels (JPL said only four were still functioning during extraction attempts) it could not escape; NASA redefined it as a stationary platform in January 2010 ([Scientific American](https://www.scientificamerican.com/article/spirit-rover-stationary/)). Lesson: a stuck solar rover cannot tilt its panels toward the winter Sun, so a mobility failure becomes a power failure.

### Speed, drive rates, actuators

| Rover | Top speed | Average with hazard avoidance | Notes | Source |
| --- | --- | --- | --- | --- |
| MER | 5 cm/s | about one-fifth of top speed | Front and rear wheels steer | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Curiosity | 4 cm/s | less than half of top speed | Actuators "geared for torque, not speed"; designed for more than 20 km in prime mission | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Perseverance | 152 m/h (4.2 cm/s) | record 347.7 m in one sol; 699.9 m without human review | Under 200 W at slow pace | [NASA](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/), [JPL news](https://www.jpl.nasa.gov/news/autonomous-systems-help-nasas-perseverance-do-more-science-on-mars/) |
| Zhurong | about 200 m/h | "much shorter" daily | Active suspension | [Spaceflight Now](https://spaceflightnow.com/2021/05/25/chinese-rover-drives-onto-surface-of-mars/) |
| Rosalind Franklin | n/a | 50 to 100 m per sol | Wheel-walking | [ESA factsheet](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Exploration/ExoMars/ExoMars_Factsheet) |
| VIPER | 20 cm/s | 10 cm/s nominal | 6 brushless motors per motor-controller box; adjustable ground clearance 7 to 43 cm | [NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf) |

Perseverance passed 45 km of odometry in 2026 according to press reports *unverified* ([Nextgov, October 2026](https://nextgov.com/emerging-tech/2026/10/nasas-self-driving-mars-rover-sets-world-mileage-record/416718)).

**Actuator count drives mass, heater energy, and failure exposure.** Curiosity: 6 drive motors and 4 steering motors ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)), plus 5 arm joints, mast pan and tilt, high-gain antenna gimbal and sample-handling mechanisms. VIPER: each wheel module carries drive, steering and suspension actuators, controlled in groups of six ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)).

### Alternative mobility modes

| Mode | What it does | Example |
| --- | --- | --- |
| Wheel walking | Wheels pivot and move one at a time like legs to push through soft sand | Rosalind Franklin ([ESA](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Exploration/ExoMars/ExoMars_Factsheet)) |
| Inch-worming / crawling | Active suspension extends front wheels, then pulls rear wheels forward | VIPER "entrapment escapement" mode ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)) |
| Crab / omnidirectional driving | Drive sideways to keep solar panels facing the Sun | VIPER "omni-directional driving with sun on corner" ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)) |
| Body lift | Raise chassis to clear rocks or free a high-centered belly | Zhurong, VIPER |
| Flight | Scout ahead, cross impassable terrain | Ingenuity, Dragonfly |

## Power

Generic solar cell, RTG and battery theory is in [../mission-engineering/03-spacecraft-subsystems.md#power](../mission-engineering/03-spacecraft-subsystems.md#power). This section covers what is different on a planetary surface.

### Surface power sources compared

| Source | Real rover values | Strengths | Weaknesses |
| --- | --- | --- | --- |
| Solar + Li-ion (Mars) | MER: 1.3 m², up to 140 W, nearly 900 Wh/sol at start, about 600 Wh/sol after 90 sols ([MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)) | Light, no nuclear approval, cheap | Dust on panels, dust storms, winter, latitude, nights need battery and heaters |
| Solar + Li-ion (Moon) | Pragyan 50 W ([ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html)); VIPER 320 W per panel ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)) | Full 1,361 W/m² sunlight, no atmosphere | 14.8-day night; low Sun angle at poles; extreme thermal swings |
| MMRTG | 110 W at start, about 2,000 W heat, 45 kg, 4.8 kg PuO₂, 72 W estimated after 17 years ([MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf)) | Day and night, any latitude, dust-proof, free heat | Low power per kg (about 2.4 W/kg), scarce fuel, launch approval, cost |
| RHU (heat only) | About 1 W heat each, 2.7 g PuO₂; MER carried 8 ([MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)) | Tiny, passive, decades of heat | No electricity; still nuclear |

Plutonium-238 is the main RTG scarcity. NASA and DOE target an average production of 1.5 kg of plutonium oxide per year by 2026 ([NASA Glenn](https://www.nasa.gov/centers-and-facilities/glenn/nasa-one-step-closer-to-fueling-space-missions-with-plutonium-238)). **Our analysis:** one MMRTG holds 4.8 kg of PuO₂, so full-rate production fuels roughly one MMRTG every three years. In the game, an RTG should be a rare, mission-gated option, not a shop item.

### Sunlight on Mars and the Moon

| Quantity | Value | Source |
| --- | --- | --- |
| Solar irradiance at the Moon (top of "atmosphere") | 1,361 W/m² | [NSSDC Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) |
| Lunar synodic day | 29.53 Earth days (about 354 h of light, 354 h of dark at low latitude) | [NSSDC Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) |
| Mean solar irradiance at Mars, top of atmosphere | 586.2 W/m² (Appelbaum and Flood use 590 W/m²) | [NSSDC Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html), [Appelbaum and Flood 1989](https://ntrs.nasa.gov/citations/19890018252) |
| Mars at perihelion vs aphelion | 206.65 vs 249.26 million km; irradiance about 713 vs 490 W/m² | NSSDC; **Our analysis** (1,361 W/m² scaled by distance²) |
| Mars solar day (sol) | 24.6597 h | [NSSDC Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Mars obliquity | 25.19° (seasons) | [NSSDC Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Typical tau at Opportunity's site | about 0.5; 2018 storm reached 10.8; recharge needed tau below about 2.0 | [JPL news](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/) |

**Atmospheric dust (tau).** Appelbaum and Flood tabulated daily global insolation at Viking Lander 1 (22.3° N) against top-of-atmosphere values. Even on a dusty day (tau 3.25), global insolation was about 30% of a clear day, because scattered (diffuse) light still reaches the panels ([Appelbaum and Flood 1989](https://ntrs.nasa.gov/citations/19890018252)).

**Our analysis.** Fitting `T = exp(-k × tau)` to their five daily pairs (surface ÷ top-of-atmosphere: 0.87 at tau 0.4, 0.84 at 0.5, 0.81 at 0.65, 0.55 at 1.4, 0.31 at 3.25) gives k = 0.372, matching each point within about 0.04. We use this as the game's daily dust-in-air factor:

```
T_atm(tau) = exp(-0.372 × tau)      daily-averaged, horizontal panel, Mars
tau 0.5 → 0.83     tau 1 → 0.69     tau 2 → 0.48     tau 5 → 0.16     tau 10.8 → 0.02
```

### Dust on the panels (dust factor)

The MER team defined the **dust factor** as the fraction of sunlight that gets through the dust on the array: 1.0 is perfectly clean ([NASA photojournal](https://science.nasa.gov/photojournal/spirit-solar-panel-on-sol-1813-still-very-dusty)).

| Observation | Value | Source |
| --- | --- | --- |
| Pathfinder Materials Adherence Experiment | Short-circuit current fell 0.28% per day | [Jenkins, Landis et al., NTRS](https://ntrs.nasa.gov/citations/20020031145) |
| Review of lander and rover histories | About 0.2% per sol typical; observed range 0.05% to 2% per sol; MER declines episodically reversed by dust devils and gusts | [Lorenz et al. 2021](https://hal.sorbonne-universite.fr/hal-03369920v1/document) |
| Spirit, February 2009 (sol 1812 cleaning) | Dust factor 0.25 → 0.28; energy 210 → 240 Wh/sol | [NASA photojournal](https://science.nasa.gov/photojournal/spirit-solar-panel-on-sol-1813-still-very-dusty) |
| Opportunity, July 2010 (sol 2300) | Dust factor 0.700, tau 0.223, 492 Wh/sol | JPL status report via [MarsDaily](https://www.marsdaily.com/reports/Cleaning_Event_Boosts_Energy_For_Mars_Rover_Opportunity_999.html) *unverified* (reprint) |
| Zhurong, 2022 to 2023 | Entered planned hibernation May 2022; did not wake; designers blamed dust build-up; wake needed about 140 W of array output and cabin above -15 °C | [Live Science](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up) |

### Solar energy formula (game version)

**Our analysis**, built from the generic array formula in [../mission-engineering/03-spacecraft-subsystems.md](../mission-engineering/03-spacecraft-subsystems.md#solar-flux-and-distance):

```
E_sol [Wh] = A [m²] × H_toa [Wh/m²/sol] × T_atm(tau) × eta_sys × DF

H_toa  = daily top-of-atmosphere insolation on a horizontal surface at the rover's latitude and season
       = (L_day / pi) × S × (w_s × sin(lat) × sin(dec) + cos(lat) × cos(dec) × sin(w_s))
         S = 1361 / r_AU²; dec = asin(sin(25.19°) × sin(Ls)); w_s = acos(-tan(lat) × tan(dec)); L_day = 24.66 h (Mars) 
eta_sys = cell efficiency × packing × wiring × temperature × charge losses   (calibrated: 0.17 for MER, see Example 2)
DF      = dust factor, multiply by (1 - 0.002) each sol, add back on cleaning events
```

Simpler version for the UI: `E_sol = A × irradiance × efficiency × DF × cos(angle) × effective daylight hours`. For Mars, effective full-Sun hours on a horizontal panel at mid-latitudes are about H_toa ÷ irradiance, roughly 5 to 8 h per sol depending on season (**Our analysis** from the Example 2 model).

### Batteries

| Rover | Battery | Key limits | Source |
| --- | --- | --- | --- |
| Sojourner | Non-rechargeable LiSOCl₂ backup | Primary cells only | [NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=MESURPR) |
| MER | Two 8-cell, 8 Ah Li-ion in parallel (Yardney) | Must stay above -20 °C when discharging and above 0 °C when charging | [NTRS 20080015793](https://ntrs.nasa.gov/api/citations/20080015793/downloads/20080015793.pdf), [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Curiosity | Two Li-ion, about 42 Ah each; multiple charge-discharge cycles per sol | Covers peaks above MMRTG output | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Perseverance | Two 8s2p strings, 43 Ah each, 24 to 32.8 V; 2,408 Wh at 20 °C; assembly 29 kg | Operating -20 °C to +30 °C; more than 2,010 cycles over 3 years at up to 60% depth of discharge; 7-year calendar life | [JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf) |
| Ingenuity | Six Sony 18650 cells, 44.4 Wh at 25 °C, 273 g of cells | Survival range -15 °C to 25 °C | [JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf) |
| VIPER | 5,420 Wh at start of life at 0 °C | 50 h survival in low-power mode; 9 h operations inside permanently shadowed regions | [NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf) |

Battery sizing for a night (or shadow) uses the same equation as an orbiter's eclipse:

```
C_bat [Wh] = (P_night [W] × t_night [h]) / (DoD_max × eta_discharge)
Mars night ≈ 12 to 14 h (half a sol, longer in winter); lunar night ≈ 354 h at low latitude
```

DoD limits by cycle count are in [../mission-engineering/03-spacecraft-subsystems.md#batteries](../mission-engineering/03-spacecraft-subsystems.md#batteries). A Mars rover cycles once per sol (about 670 cycles per Mars year), so the 60% depth-of-discharge row applies; Perseverance's requirement uses exactly that limit ([JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf)).

### Energy budget per sol

| Rover | Energy available per sol | Source |
| --- | --- | --- |
| MER at landing | Nearly 900 Wh | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| MER after 90 sols | About 600 Wh | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Spirit, 2009, dusty winter | 210 to 240 Wh (still operating) | [NASA photojournal](https://science.nasa.gov/photojournal/spirit-solar-panel-on-sol-1813-still-very-dusty) |
| Curiosity (MMRTG) | About 2,700 Wh | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Perseverance peak demand | Up to 900 W during science activities, from batteries | [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf) |

### Power modes, sleep and hibernation

| Mode | What happens | Real example |
| --- | --- | --- |
| Nominal ops | Wake in the morning, drive and do science, relay passes, sleep at night | All rovers |
| Deep sleep / low-power fault | Everything off except a mission clock; wake periodically to check battery | Opportunity, June 2018 ([JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/)) |
| Noon nap | Stand by during peak heat at local noon | Yutu-2 ([Space.com](https://www.space.com/42921-china-far-side-moon-mission-standby-mode.html)) |
| Lunar night dormancy | Fold panels, power off, RHU keeps electronics alive | Yutu-2 ([Space.com](https://www.space.com/change-4-moon-spacecraft-third-lunar-night.html)) |
| Seasonal hibernation | Planned shutdown through winter or dust season, automatic wake on light and temperature thresholds | Zhurong ([Live Science](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up)) |
| Winter tilt | Park on a slope facing the Sun to raise array output | Spirit (see [01-rover-missions-history.md](01-rover-missions-history.md)) |

## Thermal

Generic thermal techniques (MLI, radiators, heaters, heat pipes, loops) are in [../mission-engineering/03-spacecraft-subsystems.md#thermal-control](../mission-engineering/03-spacecraft-subsystems.md#thermal-control). Surface temperature data are in [03-surface-environments-and-operations.md](03-surface-environments-and-operations.md).

### The warm electronics box

Every rover puts its batteries, computer and other cold-sensitive parts inside an insulated core. MER's **warm electronics box (WEB)** is composite honeycomb insulated with aerogel, heated by electrical heaters, 8 RHUs, and the heat from the electronics themselves. Nights can fall to -105 °C outside ([MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)). Curiosity's chassis likewise forms the shell of the warm electronics box ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)). Zhurong combined aerogel and CO₂-gas insulation ([The Innovation, 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8456422)) and a phase-change heat collector using n-undecane, which melts by day and releases heat as it freezes at night *unverified* (Xinhua-sourced press reports).

### Heat sources and costs

| Heat source | How much | Notes | Source |
| --- | --- | --- | --- |
| RHU | About 1 W each | MER had 8; Yutu-2 and its lander used RHUs for lunar night | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf), [Space.com](https://www.space.com/change-4-moon-spacecraft-third-lunar-night.html) |
| MMRTG waste heat | About 2,000 W thermal | Curiosity and Perseverance route excess heat through a pumped fluid loop to keep electronics warm at night | [MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf), [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf) |
| Electrical heaters | 1 W of heat per 1 W of battery | The energy cost of survival, highest exactly when power is lowest (winter, dust, night) | Physics |
| Battery assembly heaters | Thermostat-activated warm-up and survival heaters on Perseverance's battery | | [JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf) |

### Temperature limits

| Component | Limit | Source |
| --- | --- | --- |
| MER Li-ion battery | Above -20 °C to discharge, above 0 °C to charge | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Perseverance Li-ion battery | -20 °C to +30 °C operating (allowable flight temperature -20 °C to +35 °C) | [JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf) |
| Ingenuity battery | -15 °C to 25 °C survival; -5 °C to 25 °C to charge on the surface | Same |
| Zhurong wake condition | Cabin above -15 °C | [Live Science](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up) |
| Mars air at Gale (expected) | About -90 °C winter nights, about 0 °C warm afternoons | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Moon equator surface | 95 K to 390 K (about -178 °C to +117 °C) | [NSSDC Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) |
| Chang'e 4 site, lunar night | As low as -190 °C measured by the lander | [Space.com](https://www.space.com/change-4-moon-spacecraft-third-lunar-night.html) |

### Lunar night is the hardest thermal problem

Pragyan was designed for one lunar day only ([ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html)); it carried no nuclear heat source. Yutu-2 folds its panels and relies on an RHU to survive each 14-day night ([Space.com](https://www.space.com/change-4-moon-spacecraft-third-lunar-night.html)). CADRE is also planned for a single lunar day ([JPL](https://www.jpl.nasa.gov/missions/cadre)). Example 1 below shows why: even 3 W of survival heat for a full lunar night needs over 1 kWh of battery, more than half the mass of a 25 kg rover.

## Communications

Link budget formulas, band choice and DSN antenna performance are in [../mission-engineering/03-spacecraft-subsystems.md#telecommunications](../mission-engineering/03-spacecraft-subsystems.md#telecommunications); Earth-Mars distances and orbital geometry are in [../mission-engineering/02-mission-design-orbits-launch.md](../mission-engineering/02-mission-design-orbits-launch.md).

### Two paths home

| Path | Hardware | Rates | Typical use | Source |
| --- | --- | --- | --- | --- |
| Direct-to-Earth, X-band high-gain | Curiosity: 15 W SSPA, hexagonal 0.3 m HGA | 160 bps or more to a 34 m DSN dish, 800 bps or more to 70 m | Daily command uplink | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Direct-to-Earth, X-band high-gain (Perseverance) | 0.3 m HGA | 160/500 bps (down/up) with 34 m, 800/3,000 bps with 70 m | Commands; "limited" data return | [NASA](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) |
| Direct-to-Earth, X-band low-gain | No pointing | About 10 bps (34 m), 30 bps (70 m) | Emergency and safe mode | [NASA](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) |
| UHF relay via orbiter | Curiosity: two Electra-Lite radios, about 3 kg each; 21 W standby, 69 W transmitting | Up to about 2 Mbps to MRO, 0.25 Mbps to Odyssey | Bulk science return | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf), [DESCANSO MSL telecom](https://descanso.jpl.nasa.gov/DPSummary/Descanso14_MSL_Telecom.pdf) |
| UHF relay (MER era) | | 128 kbps to MGS and Odyssey, several minutes once or twice per sol; about half of data | | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Rover to lander only | Pragyan to Vikram lander; Sojourner to Pathfinder lander via UHF | | Micro rovers without their own Earth link | [ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html), [NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=MESURPR) |
| Lunar far-side relay | Queqiao at Earth-Moon L2, 4.2 m antenna | | Chang'e 4 lander and Yutu-2 | [CAS](https://english.cas.cn/newsroom/archive/china_archive/cn2018/201806/t20180619_194253.shtml) |
| Lunar direct-to-Earth | VIPER: X-band, gimballed HGA on a 2.3 m mast plus low-gain; no relay | 250 sps to 8 Msps transmit | All VIPER traffic | [NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf) |
| Rover mesh network | CADRE rovers to each other and to a lander base station | | Multi-rover teams | [JPL](https://www.jpl.nasa.gov/missions/cadre) |

### Relay passes and data volume

- MRO and Odyssey each fly over Curiosity at least once each afternoon and once before dawn; passes typically last about 10 minutes ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)). Near the equator MRO is above 10° elevation for about 13 minutes total per sol, split over two passes ([DESCANSO MSL telecom](https://descanso.jpl.nasa.gov/DPSummary/Descanso14_MSL_Telecom.pdf)).
- The MSL requirement was 250 Mbit per sol over relay; MRO passes deliver anywhere from 30 to 600 Mbit per pass (100 to 1,150 Mbit per sol), repeating on a 17-sol pattern ([DESCANSO MSL telecom](https://descanso.jpl.nasa.gov/DPSummary/Descanso14_MSL_Telecom.pdf)).
- Perseverance sends 99.9% of its science data through UHF relay via MRO, MAVEN and ESA's Trace Gas Orbiter ([Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf)). Rosalind Franklin will use TGO ([ESA](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Exploration/ExoMars/ExoMars_Factsheet)); Zhurong used the Tianwen-1 orbiter ([Spaceflight Now](https://spaceflightnow.com/2021/05/25/chinese-rover-drives-onto-surface-of-mars/)), and its X-band omnidirectional link could drop to 7.8125 bps ([The Innovation](https://pmc.ncbi.nlm.nih.gov/articles/PMC8456422)).

**Our analysis.**
- Comms energy is small if radios are switched off between passes: two 10-minute UHF passes at 69 W cost about 23 Wh per sol. Leaving an Electra-Lite in 21 W standby all sol would cost about 518 Wh, more than half of MER's starting daily energy. Radio scheduling matters.
- One-way light time: Moon about 1.3 s; Mars from about 3.0 min (54.6 million km, best close approach using NSSDC perihelion distance minus 1 AU) to about 22.3 min (401 million km, aphelion plus 1 AU). Combined with relay pass timing, a Mars rover normally gets one command load per sol, which is why autonomy matters.

## Navigation, autonomy and computing

### Cameras and sensors

| Item | Values | Source |
| --- | --- | --- |
| MER engineering cameras | Two stereo Hazcam pairs (front and rear, below deck), one Navcam pair on the mast | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Curiosity engineering cameras | 12 total (redundant pairs for each computer), about 250 g each; Navcam 45° field, 1,024 × 1,024 pixels, 0.82 mrad per pixel (2 cm per pixel at 25 m); stereo baseline 42 cm | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| VIPER | 2 Navcams, 4 Hazcams, 2 aft cameras, 6 hazard lights, star tracker, IMU, wheel and joint encoders | [NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf) |

Rovers need their own lights at the lunar poles (VIPER) because the Sun is always near the horizon and shadows are long.

### Driving modes

| Mode | How it works | Speed and risk |
| --- | --- | --- |
| Blind (directed) drive | Ground team plans the path from stereo images; rover executes without looking | Fastest per minute on known safe terrain, but limited to what the team could see |
| Visual odometry | Rover compares successive stereo images to measure real progress and slip | Slower; essential in sand and on slopes |
| Autonomous navigation (AutoNav) | Rover builds a 3D terrain map, picks a safe path to a goal beyond what Earth could see | MER averaged about one-fifth of top speed under hazard avoidance ([MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)); Perseverance's enhanced AutoNav crossed a 520 m straight-line route (759 m driven) in 6 drive sols, an estimated 12 sols faster than Curiosity ([JPL](https://www.jpl.nasa.gov/news/autonomous-systems-help-nasas-perseverance-do-more-science-on-mars/)) |
| Slip and embedding detection | Compare commanded and measured motion; stop if slip exceeds a limit | Prevents Purgatory-type traps; VIPER lists slip/embedding detection as a driving mode ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)) |
| Traction control | Adjust each wheel's speed to terrain contact | Reduces wheel wear (Curiosity) ([JPL](https://www-robotics.jpl.nasa.gov/media/documents/2018-ieee-aerospace-trctl.pdf)) |

### Onboard computers

| Rover | Processor | Memory | Source |
| --- | --- | --- | --- |
| Sojourner | Intel 80C85, 8-bit, about 100,000 instructions per second | Could store one image | [NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=MESURPR) |
| MER | Single RAD6000, 20 MHz (20 MIPS) | 128 MB RAM, 256 MB flash | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| Curiosity | Redundant pair of BAE RAD750, up to 200 MHz, one active, one cold spare | 256 MB DRAM, 2 GB flash, 256 kB EEPROM each | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Perseverance | Same pair, plus a third RAD750 "Vision Compute Element" with a Virtex-5 FPGA card, used for landing and then reprogrammed for faster AutoNav | Same | [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf) |

Radiation-hardened processors are 10 to 100 times slower than consumer chips of the same era; see processor trades in [../mission-engineering/03-spacecraft-subsystems.md#command-and-data-handling-cdh](../mission-engineering/03-spacecraft-subsystems.md#command-and-data-handling-cdh).

### Fault protection and safe mode

Flight software monitors health, and when something is out of limits it stops the activity, puts the rover in a safe configuration, and waits for Earth. Curiosity's spare computer can take over if the active side fails ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)). In the deepest safe state (Opportunity, June 2018) everything except a mission clock is off and the rover periodically checks whether its battery can support waking ([JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/)). For the game: safe mode costs time (sols lost), not hardware.

## Robotic arm and sampling

### Arms

| Rover | Arm length | Joints | Turret / tools | Source |
| --- | --- | --- | --- | --- |
| MER | 0.8 m | 5 | Microscopic imager, Mössbauer, APXS, rock abrasion tool (grinds a 4.5 cm diameter patch) | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf), [MSL press kit comparison](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Curiosity | 2.1 to 2.2 m | 5 (shoulder azimuth, shoulder elevation, elbow, wrist, turret) | 33 kg turret, about 60 cm across: MAHLI, APXS, drill, dust removal brush, CHIMRA scoop and sieves (1 mm and 150 µm) | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Perseverance | 2.1 m | 5 | 45 kg turret: coring drill, PIXL, SHERLOC, WATSON camera | [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf) |

### Drills and sampling systems

| System | What it does | Numbers | Source |
| --- | --- | --- | --- |
| Curiosity drill (rotary-percussive) | Powders rock for SAM and CheMin | Up to 5 cm deep, 1.6 cm hole; two spare bits on the rover front | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Curiosity drill fault and fix | Drill feed mechanism stalled December 1, 2016 (suspected debris keeping a brake engaged); team switched to "feed-extended drilling," pushing with the arm instead of the feed, and resumed in 2018 | | [JPL](https://www.jpl.nasa.gov/news/curiosity-rover-team-examining-new-drill-hiatus/), [NASA](https://science.nasa.gov/resource/curiositys-new-drilling-technique/) |
| Perseverance coring | Cuts intact cores into tubes; 9 drill bits in a carousel; 0.5 m internal sample-handling arm; 43 tubes including 5 witness tubes; 10 to 15 g per core | Bore 27 mm | [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf), [NASA](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) |
| Rosalind Franklin drill | Takes samples from 0 to 2 m depth, three extension rods | 2 m maximum | [ESA](https://exploration.esa.int/web/mars/-/45084-exomars-rover) |
| VIPER TRIDENT | Rotary-percussive drill working in 10 cm bites | 1 m | [NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf) |

**Contamination.** Perseverance's sample system is described as the most complex robotic subsystem ever built for Mars because it must also keep samples biologically clean; witness tubes record what contamination is present ([Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf)).

## Science payload

### Instrument reference values

| Instrument (rover) | Family | Mass | Power | Data | Source |
| --- | --- | --- | --- | --- | --- |
| Mastcam-Z (Perseverance) | Zoom stereo color camera | about 4 kg | about 17.4 W | about 148 Mbit per sol average | [NASA instruments](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/) |
| SuperCam (Perseverance) | Laser-induced breakdown, Raman and IR spectroscopy, microphone, at up to about 7 m | 5.6 kg head + 4.8 kg body + 0.2 kg targets | 17.9 W | about 15.5 Mbit per experiment (about 4.2 Mbit/day) | Same |
| PIXL (Perseverance) | X-ray fluorescence on the arm | 4.3 kg head + 2.6 kg electronics | about 25 W | about 16 Mbit per experiment | Same |
| SHERLOC (Perseverance) | UV Raman and fluorescence for organics | 3.11 kg turret + 1.61 kg body | 32.2 W turret + 16.6 W body | 79.7 Mbit raw | Same |
| RIMFAX (Perseverance) | Ground-penetrating radar | under 3 kg | 5 to 10 W | 5 to 10 kB per sounding | Same |
| MEDA (Perseverance) | Weather station | about 5.5 kg | up to 17 W | about 11 MB | Same |
| MOXIE (Perseverance) | Oxygen from CO₂ (ISRU demo) | about 17.1 kg | 300 W | n/a; 10 g O₂ per hour design | Same, [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf) |
| SAM (Curiosity) | Mass spectrometer, gas chromatograph, laser spectrometer | 40 kg | ovens reach about 1,000 °C at up to 40 W | | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| CheMin (Curiosity) | X-ray diffraction mineralogy | about 10 kg | | | Same |
| RAD (Curiosity) | Radiation detector | 1.7 kg | | | Same |
| Whole payload | | MER 5 kg (5 instruments); Curiosity 75 kg (10); Perseverance 59 kg (7) | | | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf), [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf) |
| Pragyan | APXS, LIBS | not given | rover total 50 W | via lander | [ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html) |
| Yutu-2 | Lunar Penetrating Radar | | | about 30 m depth at 30 cm resolution *unverified* | Wikipedia only |
| Zhurong | Navigation and multispectral cameras, subsurface radar, surface composition detector, magnetometer, weather station | | | | [The Innovation](https://pmc.ncbi.nlm.nih.gov/articles/PMC8456422) |
| VIPER | Neutron Spectrometer System (prospecting for hydrogen while driving), NIRVSS, MSolo, TRIDENT | TRIDENT about 18 kg (older estimate) *unverified* | | | [NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf) |

**Our analysis.** Instrument families for the game, with Perseverance values as anchors:

| Family | Typical mass | Typical power | Data per use | Needs |
| --- | --- | --- | --- | --- |
| Context camera (mast) | 1 to 4 kg | 5 to 20 W | tens to 150 Mbit per sol | Mast, pointing |
| Remote laser spectrometer | about 10 kg | about 20 W | about 15 Mbit per target | Mast, line of sight within about 7 m |
| Contact spectrometer (APXS, PIXL, SHERLOC) | 1 to 7 kg | 10 to 50 W | 10 to 80 Mbit | Arm |
| Ground-penetrating radar | under 3 kg | 5 to 10 W | kB per sounding, continuous while driving | Nothing extra |
| Weather station | about 5 kg | up to 17 W | MB per sol | Always on (small duty) |
| Wet-chemistry / mass spectrometer lab | 10 to 40 kg | up to hundreds of W in bursts | small | Drill or scoop, sample handling |
| ISRU demo (MOXIE-like) | about 17 kg | about 300 W | small | RTG-class power or big battery |
| Neutron spectrometer | small | small | continuous | Best while driving (prospecting) |

## Structure and mass budget

### Mass breakdown examples

| Item | Curiosity | Perseverance | MER | Source |
| --- | --- | --- | --- | --- |
| Rover total | 899 kg | 1,025 kg | 174 kg (170 kg) | press kits |
| Science instruments | 75 kg (8%) | 59 kg (6%) | 5 to 9 kg (3 to 5%) | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf), [Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf) |
| Arm turret | 30 to 33 kg | 45 kg | | same |
| Power source | MMRTG 45 kg | MMRTG 45 kg | 1.3 m² array | same |
| Batteries | | 26.5 kg cells (29 kg assembly) | | [JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf) |
| UHF radios | about 3 kg each, two | | | [DESCANSO](https://descanso.jpl.nasa.gov/DPSummary/Descanso14_MSL_Telecom.pdf) |
| Engineering cameras | 12 × 0.25 kg = 3 kg | | | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |

The instrument fraction is small (3 to 8%). Most rover mass is the machine that carries, powers, warms and moves the instruments. Perseverance is 126 kg heavier than Curiosity, mostly from the sample caching system and heavier turret ([Mars 2020 press kit](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf)).

### Rover vs. delivery mass

| Mission | Rover | Total at launch | Rover share | Source |
| --- | --- | --- | --- | --- |
| MER | 174 kg | 1,062 kg (365 kg lander, 198 kg backshell and parachute, 90 kg heat shield, 183 kg cruise stage, 52 kg propellant) | 16% | [MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf) |
| MSL | 899 kg | 3,893 kg (2,401 kg entry, descent and landing system; 539 kg cruise stage) | 23% | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf) |
| Chandrayaan-3 | 26 kg | Lander module 1,752 kg including rover | 1.5% | [ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html) |

**Our analysis.** Every extra kilogram of rover on Mars costs about 4 to 6 kg at launch. Since the game provides the lander, express this as a hard **delivery mass cap** and a **stowed volume cap** per lander class.

### Mass growth and margins

Use the margin rules in [../mission-engineering/03-spacecraft-subsystems.md#mass-budget-and-margins](../mission-engineering/03-spacecraft-subsystems.md#mass-budget-and-margins). For rovers, mass growth is typically absorbed by shrinking the payload, because the lander capacity is fixed once the delivery system is chosen.

### Stowage and deployment

Rovers must fold to fit inside the lander or aeroshell: MER's solar panels fold up and deploy to 1.3 m² ([MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)); Sojourner stowed at 180 mm height and stood at 280 mm ([NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=MESURPR)); Curiosity's mast, arm, antennas and mobility system all deploy after landing ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)); Zhurong's solar wings unfold in two stages inspired by a butterfly *unverified* (Xinhua reports); VIPER's suspension and steering have launch restraints and its gimbals use frangibolt launch locks ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)). Each deployment is a one-shot failure point. Egress (driving off the lander) is its own risk: Sojourner drove down a ramp tilted 20° ([NASA](https://science.nasa.gov/mission/mars-pathfinder/)), and VIPER egress was rehearsed from 2021 to 2024 ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)).

## Dust, radiation and wear

| Hazard | Effect | Real example | Game handle |
| --- | --- | --- | --- |
| Dust on solar arrays | Lose about 0.2% of output per sol typical (0.05% to 2% observed) | MER, Zhurong ([Lorenz et al. 2021](https://hal.sorbonne-universite.fr/hal-03369920v1/document)) | Dust factor that decays each sol; random cleaning events (Mars only) |
| Dust in the air | Daily insolation down to about 30% of clear sky at tau 3.25; near zero at tau 10.8 | Opportunity 2018 ([JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/)) | Dust-storm events using T_atm(tau) |
| Dust on optics and mechanisms | Lens contamination, sticky joints, seals | Curiosity's dust removal brush cleans rock targets and the observation tray ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)) | Small per-sol instrument degradation; "clean" action |
| Sharp rocks | Wheel punctures | Curiosity ([JPL](https://www-robotics.jpl.nasa.gov/media/documents/2018-ieee-aerospace-trctl.pdf)) | Wheel health that falls with distance on rocky terrain; thicker wheels slow wear |
| Cold actuators | Motors and gearboxes must be warmed (lubricant stiffens in the cold) before moving | Curiosity uses cold-tolerant actuators ([MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf)) | Pre-drive heater energy, higher in winter |
| Mechanism wear | Finite cycle life; single-point failures | Curiosity drill feed (2016) | Each mechanism has a failure chance per use |
| Battery aging | Capacity fade with cycles and temperature | Perseverance designed for 2,010+ cycles at 60% DoD ([JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf)) | Capacity fade per deep cycle |
| RTG decay | 110 W at start to about 72 W after 17 years | [MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf) | About 2.5% per year (**Our analysis**, matches the mission-engineering file) |
| Radiation on electronics | Bit flips and resets; total-dose damage over years. Mars surface is shielded by atmosphere far less than Earth's; the Moon has no shielding | Rad-hard RAD6000/RAD750 on NASA rovers | Random "computer reset → safe mode" events; rad-hard computer reduces chance |

## Component catalog for the game

**Our analysis.** Three tiers, anchored to real rovers. "Cost" is a relative index (micro = 1). Real anchors: the MER pair cost about $800 million ([Boeing/Spectrolab release](https://boeing.mediaroom.com/2003-01-14-Spectrolab-Solar-Cells-Power-Latest-Mars-Exporation-Vehicles)); MSL cost $2.5 billion including $1.8 billion for spacecraft and science ([MSL press kit via ASU copy](https://marsed.asu.edu/sites/default/files/pdfs_resources/MSLPressKit.pdf)). Detailed cost modeling is in [../mission-engineering/04-cost-risk-programmatics.md](../mission-engineering/04-cost-risk-programmatics.md).

### Chassis and mobility

| Tier | Anchor | Mass (chassis + mobility, game assumption) | Wheels | Max obstacle | Top speed | Typical drive per sol | Relative cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Micro (about 10 to 30 kg) | Sojourner, Pragyan, CADRE | 4 to 10 kg | 4 or 6, about 10 to 20 cm | about wheel diameter | about 1 cm/s | 5 to 50 m | 1 |
| Mid (about 150 to 300 kg) | MER, Yutu-2, Zhurong, Rosalind Franklin | 40 to 80 kg | 6, about 25 to 30 cm, rocker-bogie or active | 20 to 30 cm (Zhurong 30 cm per Xinhua *unverified*) | 5 cm/s | 50 to 100 m | 5 |
| Large (about 900 to 1,025 kg) | Curiosity, Perseverance | 250 to 350 kg | 6, 50 to 52.5 cm | 40 cm | 4 cm/s | 100 to 350 m with AutoNav | 25 |
| Option: active suspension | Zhurong, VIPER, Rosalind Franklin | +10 to 15% mobility mass (game assumption) | | +escape modes, adjustable clearance | | | +20% |
| Option: thick wheels | Perseverance | +5% mobility mass (game assumption) | | | | | +5% |

### Power generation

| Tier | Option | Mass | Output | Notes |
| --- | --- | --- | --- | --- |
| Micro | Body-mounted solar, about 0.2 to 0.3 m² | 1 to 2 kg | 13 W (Sojourner) to 50 W (Pragyan) | One lunar day, or short Mars mission |
| Mid | Deployable solar, about 1.3 m² | not published (set by game) | 140 W peak; 900 Wh/sol falling to 600 (MER) | Dust factor and season dominate |
| Mid (Moon pole) | Vertical side panels | | 320 to 450 W per panel (VIPER) | Low Sun angle needs vertical panels |
| Large | MMRTG | 45 kg | 110 W continuous (2,713 Wh/sol), 2,000 W heat | Gated by plutonium supply, launch approval |
| Add-on | RHU | small (C-cell size per MER press kit) | 1 W heat each | MER carried 8 |

### Energy storage

| Tier | Example | Capacity | Mass |
| --- | --- | --- | --- |
| Micro | Ingenuity-class 18650 pack | about 40 to 150 Wh | 0.3 to 1.5 kg |
| Mid | MER: two 8 Ah, about 28 V strings | about 450 Wh (**Our analysis**: 2 × 8 Ah × 28 V) | not published (game: about 100 Wh/kg pack) |
| Large | Perseverance: two 43 Ah strings | 2,408 Wh at 20 °C | 26.5 to 29 kg |
| Lunar large | VIPER | 5,420 Wh at 0 °C | not given |

### Thermal

| Tier | Option | Mass | Effect |
| --- | --- | --- | --- |
| All | Aerogel-insulated warm box | game assumption | Reduces heater power |
| All | RHUs | small | 1 W each, free forever, nuclear approval |
| Large | RTG fluid loop | included with RTG | Uses RTG waste heat, almost no heater energy |
| Mid (Mars) | Phase-change heat store | a few kg | Zhurong-style day-to-night heat shift |

### Communications

| Tier | Option | Rate | Power |
| --- | --- | --- | --- |
| Micro | UHF to lander only | lander-limited | a few W |
| Mid | UHF relay radio | 128 kbps (MER era) to 2 Mbps (Electra-class) | 69 W transmit, 21 W standby (Electra-Lite) |
| Mid / Large | X-band HGA + LGA direct-to-Earth | 160 to 800 bps down; LGA about 10 to 30 bps | 63 W SSPA exciter on |
| Lunar | X-band direct-to-Earth with gimballed HGA | up to 8 Msps | not given |

### Computing and autonomy

| Tier | Option | Capability |
| --- | --- | --- |
| Micro | Low-power microcontroller | Short blind moves, hazard stop (Sojourner) |
| Mid | RAD6000-class, 20 MHz | Visual odometry, slow hazard avoidance (about 20% of top speed) |
| Large | RAD750 pair, 200 MHz | Redundant, AutoNav |
| Upgrade | Vision compute element (FPGA) | Drive while thinking; about 3x faster across rough terrain (Perseverance) |

### Instruments

Use the instrument family table above. Rules of thumb: mast instruments need a mast, contact instruments need an arm, lab instruments need a drill or scoop and sample handling.

## Worked sizing examples

All three are **Our analysis**, computed with python3. Assumptions are flagged; sourced inputs are linked in the sections above.

### Example 1: 25 kg solar lunar micro-rover, one lunar day

**Inputs.** Site latitude 20° (assumed); daylight 354 h (half of 29.53 days); 1,361 W/m²; triple-junction cells 28% efficient; inherent losses 0.77 (both from [../mission-engineering/03-spacecraft-subsystems.md](../mission-engineering/03-spacecraft-subsystems.md#power)); dust factor 0.95 for lunar dust kicked up by driving (assumed); array 0.30 m².

**Generation.**

| Panel layout | Peak power | Energy over the lunar day |
| --- | --- | --- |
| Horizontal, fixed on top deck | 79 W | 17.7 kWh |
| Vertical, turned to face the Sun | 84 W | 21.1 kWh |

The horizontal panel exceeds 50 W for about 199 h and 30 W for about 266 h of the 354 h day. Peak power is Pragyan-like (50 W) ([ISRO](https://www.isro.gov.in/Chandrayaan3_Details.html)).

**Loads (assumed).** 8 W housekeeping all the time; per Earth day: 4 h driving (+25 W), 2 h science (+10 W), 2 h radio to the lander (+12 W). Total about 336 Wh per Earth day, about 5.0 kWh over the lunar day.

**Results.**

- Energy is not the constraint in daylight: generation is about 3.5 times the load. The real limits are **peak power** (cannot run drive + science + radio at once near dawn and dusk), **heat at local noon** (Yutu-2 takes a noon nap ([Space.com](https://www.space.com/42921-china-far-side-moon-mission-standby-mode.html))), and **comms through the lander**.
- Battery for a 3 h drive through shadow at 33 W: 99 Wh, or 165 Wh nameplate at 60% DoD, about 1.2 to 1.8 kg at 90 to 140 Wh/kg pack level.
- Distance: 4 h per day at 1 cm/s for 12 working days is about 1.7 km of wheel travel; real rovers achieve far less because of stops for imaging and planning.
- **Night survival is out of reach without nuclear heat.** Keeping electronics warm for 354 h:

| Survival heater | Night energy | Battery pack at 100 Wh/kg, 70% DoD |
| --- | --- | --- |
| 3 W | 1,063 Wh | 15.2 kg |
| 5 W | 1,772 Wh | 25.3 kg |
| 10 W | 3,544 Wh | 50.6 kg |

A 25 kg rover cannot carry that. This is why Pragyan and CADRE are single-day missions and Yutu-2 carries an RHU. At the lunar south pole (VIPER's target), the Sun stays within a few degrees of the horizon, so a horizontal panel catches only about 10% of the light that a vertical one does; VIPER mounts its arrays on three sides ([NTRS](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)).

### Example 2: 185 kg solar Mars rover at about 15° S over one Mars year

**Inputs.** MER-like rover, array 1.3 m², latitude 14.6° S (Spirit's Gusev site), landing at Ls 328°. Top-of-atmosphere daily insolation from the orbit formula above (NSSDC orbit values, perihelion at Ls 251°). Seasonal tau assumed: 0.5 in the clear season, rising smoothly to 0.9 in the dusty perihelion season. T_atm = exp(-0.372 × tau). Dust factor starts at 1.0, drops 0.2% per sol ([Lorenz et al. 2021](https://hal.sorbonne-universite.fr/hal-03369920v1/document)). One cleaning event at sol 300 adds +0.15 (assumed). System efficiency **calibrated** so sol 1 gives 900 Wh ([MER press kit](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)): eta_sys = 0.170.

**Validation.** The model predicts 595 Wh on sol 90, matching the press-kit statement that output falls to about 600 Wh/sol by the end of the 90-sol mission because of dust and season.

| Sol | Ls | tau | Top-of-atmosphere (Wh/m²) | Dust factor | Energy (Wh/sol) |
| --- | --- | --- | --- | --- | --- |
| 1 | 328 | 0.58 | 5,047 | 1.000 | 900 |
| 30 | 344 | 0.50 | 4,672 | 0.944 | 811 |
| 90 | 15 | 0.50 | 3,866 | 0.837 | 595 |
| 150 | 43 | 0.50 | 3,202 | 0.742 | 437 |
| 250 | 88 (southern winter) | 0.50 | 2,773 | 0.607 | 310 |
| 299 | 111 | 0.50 | 2,972 | 0.551 | 301 (year minimum about 300) |
| 300 (cleaning) | 111 | 0.50 | 2,979 | 0.700 | 383 |
| 400 | 162 | 0.51 | 4,262 | 0.573 | 447 |
| 500 | 221 | 0.85 | 5,710 | 0.469 | 432 |
| 550 | 254 (perihelion, dusty) | 0.90 | 5,885 | 0.424 | 396 |
| 669 | 328 (one year later) | 0.59 | 5,055 | 0.334 | 301 |

**What it shows.**
- Without the cleaning event, sol 669 drops to 236 Wh (dust factor 0.26), close to Spirit's real 210 to 240 Wh/sol in its dusty fourth year ([NASA photojournal](https://science.nasa.gov/photojournal/spirit-solar-panel-on-sol-1813-still-very-dusty)).
- Winter (around sol 250 to 300) and accumulated dust together cut energy to a third of landing day.
- A global dust storm on sol 90 conditions: tau 2 gives 340 Wh, tau 5 gives 112 Wh, tau 10.8 gives 13 Wh. At tau 10.8 the rover cannot even run survival heaters; this is the Opportunity 2018 scenario ([JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/)).
- Battery: two 8 Ah strings at about 28 V hold about 450 Wh, so at 60% DoD about 270 Wh is usable for the night. If night survival (heaters, clock, battery warming) needs about 150 to 250 Wh (assumed), a 300 Wh sol leaves only 50 to 150 Wh for driving and science.

### Example 3: RTG Mars rover energy budget per sol

**Inputs.** MMRTG at 110 W at start, 72 W after 17 years ([MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf)); sol 24.66 h; Perseverance battery 2,408 Wh ([JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf)).

| Supply | Wh/sol |
| --- | --- |
| 110 W (start of mission) | 2,713 (MSL press kit rounds to about 2,700) |
| 100 W | 2,466 |
| 72 W (about year 17) | 1,775 |

| Load (unit power sourced where linked; durations assumed) | Power | Time | Wh/sol |
| --- | --- | --- | --- |
| Avionics and housekeeping awake (assumed 60 W) | 60 W | 8 h | 480 |
| Sleep / standby (assumed 25 W) | 25 W | 16.7 h | 416 |
| Drive (Perseverance: under 200 W at slow pace) | 200 W | 2 h | 400 |
| Arm and instruments (assumed) | 100 W | 2 h | 200 |
| UHF relay, two 10-minute passes (Electra-Lite 69 W) | 69 W | 0.33 h | 23 |
| X-band uplink window (SSPA exciter on, 62.9 W) | 63 W | 0.25 h | 16 |
| Heaters beyond RTG waste heat (assumed) | 20 W | 6 h | 120 |
| **Total** | | | **1,655** |

**Results.**
- At 110 W the margin is about 1,057 Wh per sol, enough for a 1 h MOXIE run (300 W, 300 Wh) plus extra driving. At 72 W the margin falls to about 120 Wh: an old RTG rover must cut its driving or science.
- Peaks are handled by the battery. A 30-minute burst at 900 W (Perseverance's stated peak demand) draws about 395 Wh beyond the RTG, only 16% of the battery, and recharges in about 4.6 h at 85 W net. The RTG rover is energy-steady but **power-limited**: it can do almost anything, just not much of it at once.
- No dust-factor or winter term appears anywhere in this budget. That is the core RTG advantage.

## Key numbers for the game

| Parameter | Value | Source |
| --- | --- | --- |
| Mars gravity / Moon gravity | 3.73 / 1.62 m/s² | NSSDC |
| Sol length | 24.66 h | NSSDC |
| Lunar day / night | about 354 h each | NSSDC (29.53-day synodic period) |
| Mars top-of-atmosphere irradiance | 586 W/m² mean, about 490 to 713 W/m² | NSSDC; **Our analysis** |
| Moon irradiance | 1,361 W/m² | NSSDC |
| Mars daily dust-in-air factor | exp(-0.372 × tau); typical tau 0.5 | **Our analysis** fit to Appelbaum and Flood; JPL |
| Dust on panels | -0.2% per sol typical (0.05 to 2%); Pathfinder 0.28%/day | Lorenz et al.; Jenkins et al. |
| Solar recharge threshold in a storm | tau below about 2 | JPL |
| MER energy | 900 Wh/sol at start, 600 after 90 sols, 210 to 240 in a dusty 4th winter | MER press kit; NASA |
| MMRTG | 110 W start, 72 W at 17 years, 45 kg, 2,000 W heat | MMRTG fact sheet |
| RTG energy per sol | about 2,700 Wh | MSL press kit |
| RHU | about 1 W heat each | MER press kit |
| Li-ion battery temperature | -20 °C to +30 °C operating; charge above 0 °C (MER) | JPL battery paper; MER press kit |
| Battery depth of discharge per sol | 60% max for about 670+ cycles | JPL battery paper |
| Rocker-bogie obstacle | about one wheel diameter | MER, MSL press kits |
| Tilt limits | 45° static stability, 30° software limit | MER press kit; NASA |
| Top speeds | 1 cm/s (micro) to 4 to 5 cm/s (MER, MSL); VIPER 20 cm/s | press kits; NTRS |
| Record sol drive | 347.7 m (Perseverance AutoNav) | JPL |
| UHF relay pass | about 10 min; 2 Mbps max to MRO; 30 to 600 Mbit per pass | MSL press kit; DESCANSO |
| Direct-to-Earth | 160 to 800 bps (HGA); about 10 to 30 bps (LGA) | NASA |
| Instrument share of rover mass | 3 to 8% | press kits |
| Light time | Moon 1.3 s; Mars about 3 to 22 min one way | **Our analysis** |

## Game implications

**Our analysis.** How these engineering facts map onto a "design a rover, then keep it alive" game.

1. **Design phase as a budget puzzle.** Give each mission a lander with a **delivery mass cap** and **stowed volume cap** (for example micro 30 kg, mid 200 kg, large 1,050 kg). Components draw mass, volume, cost and power. Make the instrument share realistic (3 to 8% of total), so players discover that most of the rover is support systems.
2. **Power source is the defining choice.** Solar is cheap and available but brings a dust factor that decays about 0.2% per sol, seasonal swings, and storms; RTG is steady (2,700 Wh/sol, gentle 2.5% per year decline) and warms the rover for free, but is heavy, expensive, and gated (one per campaign or only for "flagship" missions, matching plutonium scarcity).
3. **Daily loop on a sol clock.** Each sol: compute E_sol from the formula, subtract survival (heaters scaled by temperature), then let the player spend the rest on drive, science and comms. Show the battery as a gauge with a 60% DoD "red line" that harms battery life if crossed.
4. **Night and winter as survival checks.** If the battery cannot cover the night heater load, a component (battery first) takes damage. On the Moon, without an RHU or RTG, the first night ends the mission; make that explicit at design time ("one lunar day rover").
5. **Dust events.** Random dust storms raise tau for many sols (use T_atm = exp(-0.372 × tau)); random cleaning events restore +0.05 to +0.15 dust factor on Mars only. A player-triggered "hibernate" mode trades lost sols for survival, with a wake threshold (Zhurong-like: enough array power and warm enough cabin).
6. **Mobility risk from physics.** Per-wheel load (mass × g ÷ wheels) against wheel size sets a sinkage risk in sand; slip detection and AutoNav reduce the chance of getting stuck; active suspension or wheel-walking unlock an "escape" action. Rocky terrain wears wheels (Curiosity), thicker wheels wear slower.
7. **Comms as a scheduled resource.** Data piles up onboard until a relay pass (two short windows per sol on Mars) or a direct-to-Earth window. Radios cost energy only when on. Micro rovers talk only to their lander and must stay within range.
8. **Autonomy pays in sols.** Better computing and cameras convert the same energy into more distance per sol (MER about 20% of top speed under hazard avoidance; Perseverance's vision processor roughly 3x faster across rough terrain), and reduce stuck events.
9. **Arm, drill and samples as high-value, high-risk actions.** Drilling costs energy and has a fault chance; a fault can be worked around with a new technique after lost sols (Curiosity's feed-extended drilling), which is a good "engineering recovery" story beat.
10. **Teach coupling with feedback.** When a player adds an instrument, show the ripple: +mass, +energy per use, +data, +heater load, and whether wheels and lander cap still close. The coupling matrix above is a ready-made tooltip source.

## Sources

**NASA, JPL and DOE**
- JPL, [Mars Exploration Rover Launch Press Kit (June 2003)](https://www.jpl.nasa.gov/news/press_kits/merlaunch.pdf)
- JPL, [Mars Science Laboratory Landing Press Kit (July 2012)](https://www.jpl.nasa.gov/news/press_kits/MSLLanding.pdf); ASU-hosted copy for cost figures: [MSLPressKit.pdf](https://marsed.asu.edu/sites/default/files/pdfs_resources/MSLPressKit.pdf)
- JPL, [Mars 2020 Perseverance Landing Press Kit (January 2021)](https://www.jpl.nasa.gov/news/press_kits/mars_2020/download/mars_2020_landing_press_kit.pdf)
- JPL, [Ingenuity Mars Helicopter Landing Press Kit](https://jpl.nasa.gov/news/press_kits/mars_2020/download/ingenuity_landing_press_kit.pdf)
- NASA, [Perseverance rover components](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/)
- NASA, [Perseverance science instruments](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/)
- NASA, [Curiosity mission page](https://science.nasa.gov/mission/msl-curiosity/)
- NASA, [Mars Pathfinder mission page](https://science.nasa.gov/mission/mars-pathfinder/)
- NASA NSSDC, [Mars Pathfinder Rover (Sojourner)](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=MESURPR)
- NASA NSSDC, [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) and [Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)
- Makovsky, Ilott and Taylor, [Mars Science Laboratory Telecommunications System Design, DESCANSO Article 14](https://descanso.jpl.nasa.gov/DPSummary/Descanso14_MSL_Telecom.pdf)
- West, Smart and Herman (JPL), [Battery System Design, Testing, and Operation for the Mars Perseverance Rover and Ingenuity Helicopter](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf)
- NASA NTRS, [MER lithium-ion battery performance (20080015793)](https://ntrs.nasa.gov/api/citations/20080015793/downloads/20080015793.pdf)
- NASA/DOE, [MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf)
- NASA Glenn, [NASA one step closer to fueling space missions with plutonium-238](https://www.nasa.gov/centers-and-facilities/glenn/nasa-one-step-closer-to-fueling-space-missions-with-plutonium-238)
- Appelbaum and Flood, [Solar Radiation on Mars, NASA TM-102299 (1989)](https://ntrs.nasa.gov/citations/19890018252)
- Jenkins, Landis et al., [A Dust Characterization Experiment for Solar Cells Operating on Mars (NTRS)](https://ntrs.nasa.gov/citations/20020031145)
- NASA photojournal, [Spirit solar panel on sol 1813, still very dusty](https://science.nasa.gov/photojournal/spirit-solar-panel-on-sol-1813-still-very-dusty)
- NASA photojournal, [PIA07922: Opportunity's sol 446 position](https://photojournal.jpl.nasa.gov/catalog/PIA07922)
- JPL, [Opportunity hunkers down during dust storm (2018)](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/)
- JPL Robotics, [Traction control for Curiosity, IEEE Aerospace 2018](https://www-robotics.jpl.nasa.gov/media/documents/2018-ieee-aerospace-trctl.pdf)
- JPL, [Curiosity rover team examining new drill hiatus](https://www.jpl.nasa.gov/news/curiosity-rover-team-examining-new-drill-hiatus/); NASA, [Curiosity's new drilling technique](https://science.nasa.gov/resource/curiositys-new-drilling-technique/)
- JPL, [Autonomous systems help NASA's Perseverance do more science on Mars](https://www.jpl.nasa.gov/news/autonomous-systems-help-nasas-perseverance-do-more-science-on-mars/)
- Bluethmann (NASA), [VIPER Rover Overview and Mobility and Hardware, LSIC 2024 (NTRS)](https://ntrs.nasa.gov/api/citations/20240013903/downloads/LSIC_2024-Tech%20Infusion_Panel-VIPER_Mob-HW.pdf)
- Hu et al., [A study demonstrating that using gravitational offset to prepare extraterrestrial mobility missions is misleading (NTRS 2025)](https://ntrs.nasa.gov/api/citations/20250001809/downloads/main-20250215.pdf)
- Connolly and Carrier, [LPSC 2023 abstract on lunar soil strength (NTRS)](https://ntrs.nasa.gov/api/citations/20220018853/downloads/LPSC%202023%20Abstract_Connolly_Carrier_v2.pdf)
- JPL, [CADRE mission page](https://www.jpl.nasa.gov/missions/cadre)
- NASA, [Dragonfly mission page](https://science.nasa.gov/mission/dragonfly/)

**ESA, ISRO, CNSA-related**
- ESA, [ExoMars factsheet](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Exploration/ExoMars/ExoMars_Factsheet) and [ExoMars rover page](https://exploration.esa.int/web/mars/-/45084-exomars-rover)
- ISRO, [Chandrayaan-3 details](https://www.isro.gov.in/Chandrayaan3_Details.html)
- Chinese Academy of Sciences, [Queqiao relay satellite news (2018)](https://english.cas.cn/newsroom/archive/china_archive/cn2018/201806/t20180619_194253.shtml)
- [China's first Mars exploration mission (The Innovation, 2021, PMC8456422)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8456422)

**Peer-reviewed and other**
- Lorenz et al., [Lander and rover histories of dust accumulation on and removal from solar arrays on Mars (2021)](https://hal.sorbonne-universite.fr/hal-03369920v1/document)
- Sullivan et al., [Cohesions, friction angles, and other physical properties of Martian regolith from MER wheel trenches and wheel scuffs, JGR 2011](https://doi.org/10.1029/2010JE003625)
- Boeing/Spectrolab, [Spectrolab solar cells power latest Mars exploration vehicles (2003)](https://boeing.mediaroom.com/2003-01-14-Spectrolab-Solar-Cells-Power-Latest-Mars-Exporation-Vehicles)

**News (secondary, used where no official page was found)**
- Space.com, [Chang'e 4 enters third lunar night, Yutu-2 hits design lifetime](https://www.space.com/change-4-moon-spacecraft-third-lunar-night.html) and [Yutu-2 noon nap](https://www.space.com/42921-china-far-side-moon-mission-standby-mode.html)
- Spaceflight Now, [Chinese rover drives onto surface of Mars (2021)](https://spaceflightnow.com/2021/05/25/chinese-rover-drives-onto-surface-of-mars/)
- Live Science, [China admits its hibernating Mars rover may never wake up (2023)](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up)
- GeekWire, [NASA orders Blue Origin to deliver VIPER (2025)](https://www.geekwire.com/2025/nasa-order-blue-origin-viper-rover-moon/)
- Scientific American, [Spirit rover declared stationary (2010)](https://www.scientificamerican.com/article/spirit-rover-stationary/)
- MarsDaily (JPL status reprint), [Cleaning event boosts energy for Opportunity](https://www.marsdaily.com/reports/Cleaning_Event_Boosts_Energy_For_Mars_Rover_Opportunity_999.html)
- Nextgov, [Perseverance off-world mileage record (October 2026)](https://nextgov.com/emerging-tech/2026/10/nasas-self-driving-mars-rover-sets-world-mileage-record/416718)
