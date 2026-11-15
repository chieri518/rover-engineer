# Planetary Rover Missions: History, Lifetimes, and Why They Ended

This file covers every significant planetary rover flown, lost, cancelled, or in development: what each was designed to do, what actually happened, and above all why each one stopped. Its goal is to give the team a sourced sense of how long rovers really last, what kills them, and what the delivery system (the lander or spacecraft) forces on the rover designer. Subsystem engineering, surface environments, and game scenarios are covered in sibling files.

Researched November 14, 2026.

Quick navigation: [Master comparison table](#master-comparison-table) · [Planned vs actual lifetime](#planned-vs-actual-lifetime) · [Case studies](#case-studies) · [Smaller and recent rovers](#smaller-and-recent-rovers) · [In development and cancelled](#in-development-and-cancelled) · [Why some rovers outlive plans](#why-some-rovers-outlive-plans-and-others-die-young) · [Rover mission phases](#rover-mission-phases) · [What the delivery system constrains](#what-the-delivery-system-constrains) · [Cost, team, and build time](#cost-team-and-build-time) · [Key numbers for the game](#key-numbers-for-the-game) · [Game implications](#game-implications) · [Sources](#sources)

Related files: subsystem details are in [02-rover-subsystems.md](02-rover-subsystems.md). Planetary environments, landing site selection, and surface operations planning are in [03-surface-environments-and-operations.md](03-surface-environments-and-operations.md). Game and scenario ideas are in [04-rover-games-and-scenarios.md](04-rover-games-and-scenarios.md). General NASA lifecycle, launch, cost, and risk are in [../mission-engineering/01-mission-lifecycle.md](../mission-engineering/01-mission-lifecycle.md), [../mission-engineering/02-mission-design-orbits-launch.md](../mission-engineering/02-mission-design-orbits-launch.md), and [../mission-engineering/04-cost-risk-programmatics.md](../mission-engineering/04-cost-risk-programmatics.md).

How to read the sources: links are reference-style (for example [p26]) and resolve to the full list in [Sources](#sources). Items marked *unverified* come from a single secondary source, an encyclopedia mirror, or sources that disagree. Mission status is as of November 2026 unless stated.

## Master comparison table

The table is split in two for readability. Part A covers identity, dates, and site. Part B covers hardware, lifetime, and outcome.

### Part A: identity, dates, destination

| Rover | Country / agency | Launch | Landing / deploy | Destination and site |
| --- | --- | --- | --- | --- |
| Lunokhod 1 (Luna 17) | USSR | Nov 10, 1970 [luno1] | Nov 17, 1970 [luno1] | Moon, western Mare Imbrium [luno1] |
| Lunokhod 2 (Luna 21) | USSR | Jan 1973 [lroc2] | Jan 15, 1973 [lroc2] | Moon, Le Monnier crater, eastern Mare Serenitatis [lroc2] |
| Apollo LRV (crewed) | USA / NASA | 1971 to 1972 (Apollo 15, 16, 17) [lrv] | Same | Moon, three Apollo sites [lrv] |
| Sojourner (Mars Pathfinder) | USA / NASA JPL | Dec 4, 1996 [mpf] | Landed Jul 4, 1997; rolled off Jul 5 to 6, 1997 [mpf] [mpfssdc] | Mars, Ares Vallis, 19.33 N 33.55 W [mpfssdc] |
| Spirit (MER-A) | USA / NASA JPL | Jun 10, 2003 [merjpl] | Jan 3, 2004 (US time) [spiritend] | Mars, Gusev Crater [oppend] |
| Opportunity (MER-B) | USA / NASA JPL | Jul 7, 2003 (US time) [merjpl] | Jan 24, 2004 (US time) [oppend] | Mars, Meridiani Planum [oppend] |
| Curiosity (MSL) | USA / NASA JPL | Nov 26, 2011 [msl] | Aug 6, 2012 [msl] | Mars, Gale Crater [msl] |
| Perseverance (Mars 2020) | USA / NASA JPL | Jul 30, 2020 [m20] | Feb 18, 2021 [m20] | Mars, Jezero Crater [m20] |
| Ingenuity (helicopter) | USA / NASA JPL | With Perseverance | First flight Apr 2021 [ingdist2] | Mars, Jezero Crater [m20] |
| Yutu (Chang'e 3) | China / CNSA | Dec 2013 | Dec 14, 2013 [ce3] | Moon, Mare Imbrium (planned Sinus Iridum) [ce3] |
| Yutu-2 (Chang'e 4) | China / CNSA | Dec 2018 | Jan 3, 2019 [ce4] | Moon far side, Von Karman crater, 45.5 S 177.6 W [ce4] |
| Zhurong (Tianwen-1) | China / CNSA | Jul 2020 | May 14 to 15, 2021 (time zone) [zhurong] | Mars, southern Utopia Planitia [zhurong] |
| Pragyan (Chandrayaan-3) | India / ISRO | Jul 14, 2023 [ch3] | Aug 23, 2023 [ch3] | Moon, near south pole, "Statio Shiv Shakti" about 69.37 S [ch3site] |
| Rashid (Emirates Lunar Mission) | UAE / MBRSC on ispace Hakuto-R M1 | Dec 2022 | Lost Apr 25, 2023 before landing [rashid] | Moon, Atlas crater, edge of Mare Frigoris [rashid] |
| LEV-1 and LEV-2 "SORA-Q" (SLIM) | Japan / JAXA | Sep 2023 | Jan 19 to 20, 2024 (deployed during descent) [slim] | Moon, near Shioli crater [slim] |
| Chang'e 6 mini rover "Jinchan" | China / CNSA | May 2024 | Jun 2024 [ce6] | Moon far side, Apollo basin [ce6] |
| Tenacious (ispace M2 "Resilience") | Japan / Luxembourg, ispace | Jan 2025 [tenmass] | Lost Jun 6, 2025 (JST) during landing [ten] | Moon, Mare Frigoris; crash at 60.44 N 4.6 W [ten] |
| MAPP (Lunar Outpost, on IM-2 Athena) | USA, commercial | Feb 2025 | Lander tipped Mar 6, 2025; rover never deployed [im2] [mapp] | Moon, near Mons Mouton, south polar region [im2] |
| CADRE (3 rovers) | USA / NASA JPL on IM-3 | Not launched as of research date (*unverified*) | Targeted 2026 [cadre] | Moon, Reiner Gamma [cadre] |
| VIPER | USA / NASA Ames | Cancelled Jul 17, 2024; revived Sep 2025 [viper] [viperbo] | Delivery targeted late 2027 on Blue Moon MK1 [viperbo] | Moon, south polar region [viperbo] |
| Rosalind Franklin (ExoMars) | ESA, with NASA contributions | Late 2028 planned [rfm] | 2030 planned [rfm] | Mars, Oxia Planum [rfm] |
| Dragonfly (rotorcraft) | USA / NASA, JHU APL | Jul 5 to 25, 2028 window [dflyfh] | 2034 [dfly] | Titan, Shangri-La dunes, Selk crater [dfly] [dflywiki] |
| MSR Sample Fetch Rover | NASA / ESA concept | Removed from plan Jul 27, 2022 [msrheli] | Never built | Mars, Jezero |

### Part B: hardware, lifetime, outcome

| Rover | Mass | Power | Mobility | Planned life | Actual life | Distance | End cause | Key firsts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lunokhod 1 | 756 kg (*unverified*, single source) [luno1] | Solar by day; polonium-210 heater at night [luno1] | 8 wheels | 3 lunar days [luno1] | 11 lunar days, about 11 months [luno1] | 10.54 km [luno1] | Not fully documented; heater isotope decay is often cited (*unverified*) | First robotic rover on another world |
| Lunokhod 2 | 840 kg [luno2wiki] (*unverified*) | Solar plus isotope heater | 8 wheels, about 1 or 2 km/h settings (*unverified*) [luno2wiki] | About 3 months (*unverified*) | About 4 months (Jan to May 1973) [lroc2] | 37 km [lroc2] or 39 km [p26] | Dust on lid dumped onto radiator, overheating (presented as likely) [lroc2]; a declassified report reportedly points to communications hardware [smith] | Longest off-world traverse until Opportunity passed it (2014, *unverified*) |
| Apollo LRV (x3) | 210 kg, 490 kg payload [lrv] | Two 36 V silver-zinc non-rechargeable batteries, 121 Ah [lrv] | 4 wheels, each with its own motor [lrv] | One 3-day mission each [lrv] | As planned | 27.8, 26.7, 35.9 km [lrv] | Planned: left on Moon | First crewed off-world vehicle |
| Sojourner | 10.6 kg [mpf] | Solar about 15 W peak (*unverified*) [sojwiki], non-rechargeable battery | 6 wheels, rocker-bogie | 7 sols [sojpia] | 83 sols [p26] [sojpia] | About 100 m [p26] | Lander contact lost Sep 27, 1997, cause unknown; rover relayed through lander [mpfssdc] | First Mars rover; first airbag Mars landing [mpf] |
| Spirit | 174 to 185 kg (sources differ) (*unverified*) | Solar, designed 140 W for up to 4 h per sol [merpower] | 6 wheels | 90 sols [p26] | Last contact sol 2208, Mar 22, 2010 [spiritend] [troy] | 7.7 km [p26] | Trapped in sand at "Troy" (2009), could not tilt solar panels for winter, got too cold [spiritend] [troy] | Drove on 5 wheels for 3+ years |
| Opportunity | Same as Spirit | Same as Spirit | 6 wheels | 90 sols, 1,000 m [oppend] | 5,111 sols [p26] | 45.16 km [p26] | 2018 global dust storm; last contact Jun 10, 2018; declared Feb 13, 2019 [oppend] | Off-world marathon (2015); 32 degree slope record [oppend] [p26] |
| Curiosity | 899 kg [msl] | MMRTG, about 125 W at start, about 100 W after 14 years [mmrtgdoe] | 6 aluminum wheels, rocker-bogie | 1 Mars year (687 days) [curiprime] (*unverified*) | Active; sol 5,000 reached Aug 29, 2026 [curio5000] (*unverified*) | More than 38.07 km (Oct 2026) [p26] | Active | Sky crane landing; first nuclear-powered Mars rover |
| Perseverance | 1,025 kg [m20comp] | MMRTG, about 110 W at launch, declining a few percent per year [m20comp] | 6 wheels, 152 m/h top speed [m20comp] | 1 Mars year (about 687 days) [m20press] | Active; extended through about end of 2028 [p26] | 45.22 km on sol 2,006 (Oct 11, 2026) [p26] | Active | Sample caching; terrain-relative navigation; off-world distance record [p26] |
| Ingenuity | 1.8 kg [ingdist] | Solar-charged battery | 2 coaxial rotors | 5 flights in 30 days [ing] | 72 flights, almost 1,000 sols [ing] | About 17 to 18 km flown [ingdist] [ingdist2] | Rotor blade damage on flight 72, Jan 18, 2024 [ingdist2] | First powered controlled flight on another planet [m20] |
| Yutu | About 140 kg [ce6sp] | Solar, 2 panels [ce3] | 6 wheels | 3 months [ce3] | Immobile after Jan 2014; silent mid-2016 (about 31 months) [ce3] | 114.8 m [ce3] (*unverified* precision) | Drive control circuit fault; could not fold mast and panels before night [yutu1ut] | China's first rover |
| Yutu-2 | About 140 kg [ce6sp] | Solar, plus radioisotope heat source (*unverified*) | 6 wheels | 3 lunar days [ce4design] | Operated 5+ years; stationary since about Mar 2024 per LRO images [yutu2btb]; small moves in 2025 reported (*unverified*) | 1,003.9 m by Jan 2022 [yutu2km]; about 1.6 km by 2024 (*unverified*) | Unclear; likely aging and loss of mobility (*unverified*) | First rover on the lunar far side |
| Zhurong | 240 kg (*unverified*) [zhurongdb] | Solar | 6 wheels | 90 sols [zhurong] | About 358 days active, hibernated May 2022 [livesci] | 1,921 m [livesci] | Dust on solar panels: could not generate enough power to wake [huff] | China's first Mars rover |
| Pragyan | 26 kg [ch3] | Solar, 50 W [ch3] | 6 wheels | 1 lunar day (about 14 Earth days) [ch3] | About 10 days of driving; asleep Sep 2, 2023, never woke [ch3sleep] [ch3nowake] | 101.4 m (ISRO path map, via secondary) [pragwiki] | Planned sleep through lunar night; electronics did not survive or did not wake | First rover near the lunar south pole |
| Rashid | 10 kg [rashid] | Solar | 4 wheels | 14 days [rashid] | 0 (lost with lander) | 0 | Lander crashed; altitude sensor confused by crater rim (secondary) [rashid] | First Arab lunar rover attempt |
| LEV-1 / LEV-2 | 2.1 kg / 238 g [slim] [slim2] | Batteries / solar (*unverified*) | Hopping / transforming sphere | Short demo | Worked during short demo [slim] | Meters | Planned short life | First images of a lander by autonomous mini rovers; LEV-1 direct-to-Earth link [slim] |
| Chang'e 6 "Jinchan" | About 5 kg [ce6sp] | Not published | Wheeled | Short demo | Photo taken autonomously [ce6] | Meters | Not reported | AI-composed photo of lander on far side [ce6] |
| Tenacious | About 5 kg [tenmass] | Solar (*unverified*) | 4 wheels | Short demo | 0 | 0 | Lander laser rangefinder delayed, lander crashed [ten] | First European-built lunar rover attempt [tenmass] |
| MAPP | 5 to 10 kg (*unverified*) | Solar | 4 wheels | Days | 0 on surface; powered on inside lander [mapp] | 0 | Lander on its side; rover could not get out [mapp] | First US commercial lunar rover attempt |
| CADRE | Each about carry-on suitcase size [cadre] | Solar [cadre] | 4 wheels [cadre] | About 14 Earth days [cadre] | Not flown | n/a | n/a | Multi-robot cooperative autonomy |
| VIPER | About 430 kg (*unverified*) | Solar | 4 wheels | 100 days [viperbo] | Not flown | n/a | Cancelled for cost (2024), revived (2025) | First rover to map polar water ice, if flown |
| Rosalind Franklin | About 300 to 310 kg (*unverified*) [rfmwiki] | Solar, plus NASA radioisotope heater units [rfmnasa] | 6 wheels | At least 7 months (*unverified*) [rfmwiki] | Not flown | n/a | n/a | 2 m drill [rfmesa] |
| Dragonfly | About 450 kg in 2019 design (*unverified*) [dflywiki] | MMRTG [dflywiki] | 8 rotors (octocopter) [dflywiki] | About 3.3 years [dfly] | Not flown | Several miles per flight [dfly] | n/a | First rotorcraft lander on another world |

Costs are in the [Cost, team, and build time](#cost-team-and-build-time) section.

## Planned vs actual lifetime

This table is chart-ready. "Ratio" is actual divided by planned, using the same unit. For the Moon, one lunar day is about 29.5 Earth days, with about 14 days of sunlight. Our arithmetic is labelled.

| Rover | Planned | Actual | Unit | Ratio (our arithmetic) | Source |
| --- | --- | --- | --- | --- | --- |
| Lunokhod 1 | 3 | 11 | lunar days | 3.7x | [luno1] |
| Lunokhod 2 | about 3 (*unverified*) | about 4 | months | about 1.3x | [lroc2] |
| Sojourner | 7 | 83 | sols | 11.9x | [sojpia] [p26] |
| Spirit | 90 | 2,208 (last contact) | sols | 24.5x | [p26] [troy] |
| Opportunity | 90 | 5,111 | sols | 56.8x (NASA says "60 times") | [p26] [oppend] |
| Curiosity | 669 (1 Mars year, *unverified*) | 5,000+ and active | sols | 7.5x and counting | [curiprime] [curio5000] |
| Perseverance | about 669 (1 Mars year) | 2,006+ and active | sols | 3.0x and counting | [m20press] [p26] |
| Ingenuity | 30 days, 5 flights | about 1,000 sols, 72 flights | days / flights | 33x time, 14.4x flights; NASA: "33 times longer" | [ing] |
| Yutu | 3 | about 31 | months | about 10x | [ce3] |
| Yutu-2 | 3 | about 62 (moving until about Mar 2024) | lunar days / months | about 20x | [ce4design] [yutu2btb] |
| Zhurong | 90 | about 347 to 358 (sols vs Earth days differ by source) | sols / days | about 3.9x | [zhurong] [livesci] |
| Pragyan | 1 | 1 (about 10 days of operations) | lunar day | 1.0x | [ch3] [ch3sleep] |
| Rashid, Tenacious, MAPP | days to 2 weeks | 0 on surface | days | 0x | [rashid] [ten] [mapp] |

Distance can also be compared to plan: Opportunity was planned to drive 1,000 m and drove 45.16 km, about 45 times its goal ([oppend], [p26]). Perseverance's original driving goal was "no more than 12.4 miles" (about 20 km), which it passed by more than double ([p26]). Pragyan was designed to cover about 500 m and drove about 101 m (*unverified*, [pragwiki]).

## Case studies

### Lunokhod 2 (USSR, 1973)

- **Design drivers.** An 840 kg, eight-wheeled, remote-driven rover. It was solar powered by day and survived the 14-day lunar night with an isotope heater, the same design used on Lunokhod 1 ([luno1], [luno2wiki]). A hinged lid carried the solar array and closed over the instrument bay at night ([luno1]).
- **What happened.** It landed in Le Monnier crater on January 15, 1973 and drove south across the crater floor ([lroc2]). Its odometer reached 37 km per LROC, or 39 km in NASA's 2026 comparison ([lroc2], [p26]). That was the off-world distance record until Opportunity passed it in 2014 (*unverified* date).
- **Why it ended.** LROC's account: on May 9 the open lid touched a crater wall and picked up regolith. When the lid closed, the soil fell onto the radiators. When the lid reopened, the radiators could not shed heat and the rover overheated and failed. The mission officially ended June 4, 1973 ([lroc2]). A Smithsonian Air and Space article reports a newly declassified Soviet report that instead points to aging communications transmitters ([smith]; we could not open the article directly, so this rests on the search summary, *unverified*).
- **Lesson.** One operational accident with dust, in a design where the thermal radiator depends on a moving lid, ended the mission. Dust and thermal coupling is a recurring killer.

### Sojourner (NASA, 1997)

- **Design drivers.** Mars Pathfinder was a "faster, better, cheaper" technology demonstration under a congressional cost cap ([mpffact]). Sojourner was a 10.6 kg, 30 cm tall micro rover ([mpf]). It had no direct link to Earth: it talked to the lander, which relayed to Earth. That kept the rover tiny but tied its life to the lander.
- **EDL.** The lander used direct entry, a parachute, and 5.8 m airbags. It hit at 14 m/s and bounced about 15 times, up to 15 m high, before rolling to a stop about 1 km away ([mpf]).
- **What happened.** Sojourner rolled down a ramp tilted 20 degrees on sol 2 ([mpf]). It was planned for 7 sols and worked 83 ([sojpia], [p26]), covering about 100 m ([p26]). The mission returned more than 16,500 lander images and 550 rover images ([mpf]).
- **Why it ended.** The lander's final transmission was September 27, 1997, and contact was lost for unknown reasons ([mpfssdc]). With no relay, the rover could no longer be commanded.
- **Lesson.** A relay dependency is a single point of failure. In game terms, "comms through the lander" is cheap but fragile.

### Spirit (NASA MER-A, 2004 to 2010)

- **Design drivers.** The twin MER rovers were solar powered. Arrays were designed to give about 140 W for up to four hours per sol, roughly 560 Wh per sol, though early output was higher ([merpower], *unverified* for exact figures). The prime mission was only 90 sols, sized partly on the expectation that dust would steadily cut solar power ([p26]).
- **Anomaly 1: right front wheel.** That wheel's motor drew unusually high current from mid-2004. Engineers drove backward to redistribute lubricant, which helped for a while. The motor stalled on sol 779 (March 13, 2006) and was declared permanently failed in April 2006 ([merwheel]). Spirit drove the rest of its life on five wheels, usually backward, dragging the dead wheel. The dragged wheel churned up bright soil that turned out to be nearly pure silica, a major science result (*unverified* here; often reported).
- **Winter strategy.** Spirit was in Gusev Crater, south of the equator. Each Martian winter the team parked it on north-facing slopes to tilt its panels toward the Sun ([cleanspirit]).
- **Anomaly 2: trapped at Troy.** On about May 1, 2009, Spirit broke through a crust into soft sand at a site called "Troy," west of "Home Plate" ([troy]). Months of testing on Earth and extraction drives from November 2009 failed. On January 26, 2010, NASA redefined it as a stationary research platform ([troy]).
- **Why it ended.** Stuck on flat ground, it could not tilt its panels for winter. Power fell too low for its survival heaters, and NASA said it probably got colder inside than in any of its six previous Mars years ([spiritend]). Last contact was March 22, 2010 (sol 2208). NASA ended recovery attempts on May 25, 2011 ([spiritend], [troy]).
- **Distance.** 7.7 km ([p26]).
- **Lesson.** Spirit's death chain: mobility loss, then power loss (no tilt), then thermal loss. Subsystems are coupled.

### Opportunity (NASA MER-B, 2004 to 2018)

- **Design drivers.** Identical to Spirit, but landed at Meridiani Planum near the equator, which gave better year-round sunlight. Planned for 90 sols and 1,000 m ([oppend]).
- **Cleaning events.** In late 2004 the team saw unexplained overnight power jumps of 2 to 5 percent, later traced to wind or dust devils cleaning the panels ([clean]). Later events gave gains up to about 10 percent; one in March 2014 lifted daily energy to 574 Wh, and another to 615 Wh ([clean2]). For scale, on Spirit a 2009 cleaning raised supply from about 210 to 240 Wh per sol, against about 180 Wh needed just to survive and communicate, which roughly doubled the energy left for driving and science ([cleanspirit]).
- **Anomaly: flash memory "amnesia."** By 2014, resets tied to aging flash memory were frequent. A reformat on September 4, 2014 helped only briefly ([flash2]). After a December 2014 reformat failed, the team ran the rover in "no flash" mode, storing data only in volatile RAM. Anything not sent home before the rover slept was lost ([flash]). Operations continued.
- **Other survival.** It survived a two-month dust storm in 2007 ([oppend]). It set a one-day driving record of 220 m (March 20, 2005) and climbed slopes up to 32 degrees ([oppend]). It completed the first off-world marathon in 2015 ([p26]).
- **Why it ended.** A planet-encircling dust storm in June 2018 blocked sunlight. Last contact was June 10, 2018. The team sent more than 1,000 recovery commands over eight months, and NASA declared the mission over on February 13, 2019 ([oppend]).
- **Totals.** 5,111 sols and 45.16 km ([p26]), more than 217,000 images ([oppend]).
- **Lesson.** Solar rovers on Mars live or die by dust: slow accumulation, lucky cleaning, and rare global storms.

### Curiosity (NASA MSL, 2012 to present)

- **Design drivers.** A mobile laboratory with heavy instruments (drill, chemistry lab, laser spectrometer). The science payload drove the mass to 899 kg ([msl]). A radioisotope power system (MMRTG) gives steady power day and night, in any season, and its waste heat keeps the rover warm. The MMRTG provides about 125 W at the start of mission, falling to about 100 W after 14 years ([mmrtgdoe]).
- **Why the sky crane.** JPL says airbags "simply weren't feasible for a rover as big and heavy as Curiosity" at about 900 kg ([skycrane]). Airbags also limited site choice: for MER, "we barely found three places on Mars that we could safely consider," because rocks or slopes could puncture the bags ([skycrane]). The sky crane lowered the rover on nylon ropes from a rocket-powered descent stage, landing it directly on its wheels, and gave a smaller landing ellipse ([skycrane]). This also removed the need for a separate egress ramp.
- **Why the RTG instead of solar.** *Our analysis:* a rover of this mass would need very large arrays, would face the same dust decline as MER, and would lose capability in winter. An MMRTG removes all three problems at the price of nuclear launch approval, plutonium-238 supply, and a fixed, low, slowly falling power level.
- **Schedule and cost growth.** Actuator motor problems forced a slip from the 2009 to the 2011 launch window, because Mars windows come only about every 26 months. That added about $400 million ([msldelay]). Life-cycle cost reached about $2.5 billion ([mslig]).
- **Anomaly: wheel damage.** In 2013 the team saw wheel wear and punctures from sharp rocks, faster than expected ([traction]). Responses: careful route planning, frequent wheel imaging, and a traction control algorithm uploaded in March 2017 and approved June 8, 2017. It adjusts each wheel's speed so climbing wheels are not pushed into rocks. In tests it cut load on leading wheels by 20 percent and middle wheels by 11 percent ([traction]). JPL estimated the wheels still had years of life.
- **Status.** Active. It passed 1 km of elevation gain on Mount Sharp on August 26, 2026 ([msl]), and more than 38.07 km driven ([p26]).
- **Lesson.** Wear items (wheels) and slowly decaying power define a long-lived RTG rover's life. Software and operations changes can extend hardware life.

### Perseverance and Ingenuity (NASA Mars 2020, 2021 to present)

- **Heritage reuse.** Perseverance "is based on the Mars Science Laboratory's Curiosity rover configuration, with an added science and technology toolbox," mainly the sampling and caching system ([m20comp]). NASA originally estimated it at about $1.5 billion, 40 percent less than MSL, by reusing the design and spare hardware ([m20cost2]). The deputy chief engineer said the biggest savings came from reusing "the design and the operation," with some spares used (for example, the descent stage structure) and some not (a spare heat shield had a problem, so a new one was built) ([m20heritage]). Development and launch were later estimated at about $2.1 billion ([m20cost2]).
- **Changes from Curiosity.** Heavier at 1,025 kg ([m20comp]). Terrain-relative navigation shrank the landing ellipse to about 7.7 by 6.6 km ([ellipse]). Wheels were redesigned (*unverified* detail). AutoNav now handles more than 90 percent of driving, against about 5 percent for Spirit and Opportunity ([p26]).
- **Performance.** Top speed 152 m/h on flat ground, using less than 200 W for driving ([m20comp]). Up to 412 m in one sol ([p26]). 45.22 km by sol 2,006, a new off-world record, and 29 samples collected ([p26]). The first extended mission began October 2026 and runs to about the end of 2028 ([p26]).
- **Ingenuity.** A 1.8 kg helicopter carried under the rover ([ingdist]). It was planned for five flights in 30 days ([ing]). It flew 72 times over almost 1,000 sols, about 129 minutes total, and about 17 to 18 km ([ing], [ingdist], [ingdist2]). On flight 72 (January 18, 2024) it lost contact about 1 m above the ground. Images showed at least one rotor blade damaged, and it could no longer fly ([ingdist2]). It cost about $80 million to build and $5 million to operate in its planned month ([ingcost]).
- **Lesson.** Reusing a proven design saved cost and risk, even though total cost still reached about $2.7 billion ([m20cost]). Ingenuity shows a cheap add-on can deliver large value when operated beyond its plan.

### Yutu-2 (China, Chang'e 4, 2019 to about 2024)

- **Design drivers.** The lunar far side never faces Earth, so a lander there cannot talk home directly. China first launched the Queqiao relay satellite into a halo orbit around the Earth-Moon L2 point in May 2018 ([ce4]). Chang'e 4 then landed in Von Karman crater on January 3, 2019, and released Yutu-2 within hours ([ce4]).
- **Night survival.** Like Yutu, it powers down through each two-week lunar night and wakes at sunrise. It reached its design life of three lunar days in early 2019 ([ce4design]).
- **What happened.** It passed 1,003.9 m in January 2022, in its 38th lunar day ([yutu2km]). In December 2019 it broke Lunokhod 1's lunar longevity record ([yutu2still]). LRO images analyzed in early 2025 showed it had not moved since about March 2024 ([yutu2btb]). Later reports of small moves in 2025 rest on encyclopedia mirrors (*unverified*). CNSA has not announced an end of mission that we could find.
- **Lesson.** The delivery architecture (relay satellite first) is a hard prerequisite for some sites. A small solar rover with disciplined sleep cycles can last years on the Moon.

### Yutu (China, Chang'e 3, 2013 to 2016): the cautionary twin

Yutu landed December 14, 2013, at Mare Imbrium rather than the planned Sinus Iridum ([ce3]). It was designed for three months ([ce3]). Before its second lunar night in January 2014, a control circuit fault in the drive unit prevented it from entering normal dormancy, so it could not fold its mast and solar panels to protect electronics through the cold ([yutu1ut]). It survived but never drove again, after about 114 m. It kept sending data as a stationary platform until mid-2016, about 31 months ([ce3]). Lesson: night protection depended on a mechanism working at the right time.

### Zhurong (China, Tianwen-1, 2021 to 2022)

- **Design drivers.** A solar-powered six-wheeled rover delivered by a lander with a ramp, after the Tianwen-1 orbiter carried it to Mars ([zhurong]). Primary mission three Earth months (90 sols) ([zhurong]).
- **What happened.** It drove south from its landing site in Utopia Planitia, logging 1,921 m in about 358 days ([livesci]).
- **Why it ended.** In May 2022 it entered planned hibernation for northern winter, with a regional dust storm also reported (*unverified*) ([zhurong], [spacehib]). It was expected to wake around December 2022 but stayed silent. NASA orbiter images later showed it had not moved ([livesci]). In April 2023 chief designer Zhang Rongqiao said dust buildup on the solar panels was the likely cause. Reported thresholds: 20 percent dust coverage causes problems, 30 percent needs the strongest light to wake, and above 40 percent it would never wake ([huff]).
- **Lesson.** A planned hibernation is a gamble on power at wake-up. Without a cleaning mechanism or margin, dust accumulated during sleep can be fatal.

### Pragyan (India, Chandrayaan-3, 2023)

- **Design drivers.** A 26 kg, 50 W solar rover with a one-lunar-day design life ([ch3]). It rode inside the Vikram lander and rolled down a ramp. *Our analysis:* with no radioisotope heater and no night survival requirement, the rover could be small and cheap, but it was effectively single-use.
- **What happened.** Vikram landed on August 23, 2023, near 69.37 S, the first landing near the lunar south pole ([ch3], [ch3site]). Pragyan drove about 101 m (ISRO's path map, via secondary reporting) ([pragwiki]).
- **Why it ended.** ISRO put the rover to sleep on September 2, 2023, with batteries charged and its panel aimed at the expected sunrise ([ch3sleep]). No signal came at sunrise around September 22, despite repeated attempts ([ch3nowake]). ISRO's chairman said it was "OK if it does not wake up because the rover has done what it was expected to do" ([ch3sleep2]).
- **Lesson.** Designing to a short lifetime is a legitimate, cheap choice. "Sleep and hope" without designing for the night rarely works.

## Smaller and recent rovers

| Rover | What it shows the team |
| --- | --- |
| Apollo LRV | A crewed, foldable 210 kg car with non-rechargeable batteries. Folded into the lunar module bay and unfolded with pulleys and tapes ([lrv]). Shows stowage and deployment as a design driver, and that a short mission can use primary (non-rechargeable) batteries. |
| Rashid (UAE) | 10 kg, designed for 14 days ([rashid]). Lost with the ispace lander in April 2023 ([rashid]). Shows that the rover team carries the delivery risk even when they do not build the lander. |
| SLIM LEV-1 and LEV-2 (Japan) | LEV-1 (2.1 kg, hopping) talked directly to Earth. LEV-2 (SORA-Q, 238 g) transformed from a sphere into a two-wheeled rover. They were released just before touchdown and returned the first image of SLIM, which had landed upside down ([slim], [slim2]). Shows very small, ejectable rovers as a low-cost add-on. |
| Chang'e 6 "Jinchan" (China) | About 5 kg ([ce6sp]). Drove off by itself, picked an angle, and photographed the lander using onboard AI ([ce6]). Shows autonomy as a substitute for operator time. |
| Tenacious (ispace Europe) | About 5 kg, 54 cm long ([tenmass]). Lost June 2025 when the Resilience lander's new laser rangefinder was slow to give valid readings, so the lander could not slow down enough ([ten]). |
| MAPP (Lunar Outpost) | Powered on and "ready to drive" inside the Athena lander, but Athena landed on its side in a shadowed crater about 250 m from its target, so the rover could not get out ([mapp], [im2]). Shows the egress step as a failure point. |

## In development and cancelled

| Mission | Status as of November 2026 | Notes |
| --- | --- | --- |
| CADRE (NASA JPL) | Three rovers delivered to Intuitive Machines in February 2025 for IM-3 ([cadrepack]). JPL lists it as "Future," arriving in 2026 ([cadre]). We found no confirmation of launch as of November 2026 (*unverified*). | Carry-on size, solar, four wheels, stereo cameras and ground-penetrating radar, about 14 Earth days of operations at Reiner Gamma ([cadre]). |
| VIPER (NASA Ames) | Cancelled July 17, 2024 after projected cost grew to $609.6 million, over 30 percent above its $433.5 million commitment; about $450 million had been spent ([viper]). On September 19, 2025, NASA awarded Blue Origin a CLPS task order (CS-7, up to $190 million) to deliver VIPER on a Blue Moon MK1 lander in late 2027 ([viperbo]). The base award covers accommodation design; the delivery option depends on review of MK1's first flight ([viperbo]). As of October 2026 MK1 had finished thermal vacuum testing but had not yet flown a landing (*unverified*, [mk1], [mk1b]). | 100-day polar water mission ([viperbo]). A good real case of "the rover was built, but the delivery system and money were not ready." |
| Rosalind Franklin (ESA ExoMars) | On schedule for launch in late 2028 and landing at Oxia Planum in 2030 ([rfm]). NASA announced on April 16, 2026 that it would implement its contributions: Falcon Heavy launch, braking engines for the landing platform, and radioisotope heater units ([rfmnasa]). The NASA element was listed among proposed cuts in the FY2027 budget request ([rfmnasa]). | Originally planned for 2020 with Russia, then 2022; cooperation with Russia was suspended in 2022 ([rfmplan]). Its key capability is a drill reaching 2 m ([rfmesa]). |
| Dragonfly (NASA New Frontiers, APL) | Launch window July 5 to 25, 2028 on Falcon Heavy; arrival at Titan 2034 ([dflyfh], [dfly]). Total life-cycle cost $3.35 billion, about double its early cap ([dflyaip]). In full assembly and test in 2026 ([dflyasm], *unverified*). | MMRTG-powered octocopter, flies about once every 1 to 2 Titan days (a Titan day is about 16 Earth days), about 3.3-year mission ([dfly], [dflywiki]). |
| MSR Sample Fetch Rover | Removed from the Mars Sample Return plan on July 27, 2022. Perseverance became the primary sample courier, with two Ingenuity-class helicopters as backup ([msrheli]). The FY2026 appropriations law (January 2026) gave MSR $0 and said it "does not support the existing Mars Sample Return (MSR) program" ([msrdead]). | A rover cancelled because an existing rover was expected to live long enough to do its job. |

## Why some rovers outlive plans and others die young

### What the record shows

| Pattern | Examples | Evidence |
| --- | --- | --- |
| Conservative prime mission based on worst-case dust | Spirit 24x, Opportunity 57x | 90-sol prime assumed steady dust loss; cleaning events then restored power ([clean], [cleanspirit]) |
| Steady power source, no seasonal limit | Curiosity, Perseverance | MMRTG gives power day and night; 14-year design life on Perseverance's unit ([m20comp]) |
| Short planned life to save cost | Pragyan, Sojourner, Rashid | One lunar day or 7 sols ([ch3], [sojpia]) |
| Night or winter survival as the killer | Spirit, Zhurong, Pragyan, Yutu | Spirit too cold ([spiritend]); Zhurong dust on panels during hibernation ([huff]); Pragyan no wake ([ch3nowake]); Yutu could not fold for night ([yutu1ut]) |
| Global environment event | Opportunity | 2018 global dust storm ([oppend]) |
| Mobility failure cascading to power | Spirit, Yutu | Spirit trapped and unable to tilt ([troy]); Yutu immobile ([ce3]) |
| Wear on moving parts | Curiosity wheels, Ingenuity rotor | [traction], [ingdist2] |
| Electronics aging | Opportunity flash, Lunokhod 2 transmitters (*unverified*) | [flash], [smith] |
| Single point of failure in the link | Sojourner | Lander comms lost ([mpfssdc]) |
| Delivery failure (rover never had a chance) | Rashid, Tenacious, MAPP | [rashid], [ten], [mapp] |

### Our analysis

1. **Requirements are written to a guaranteed minimum.** NASA prime missions are sized so that success is very likely with predicted wear and margins. Hardware is designed to that floor with margin on top, so when the environment is kinder than the worst case (Opportunity's equatorial site and cleaning winds), life stretches far beyond plan. A 90-sol plan does not mean a 90-sol rover.
2. **Margins compound.** Power margin plus thermal margin plus wear margin plus a team that keeps adapting (driving backward, RAM-only mode, traction software) produced the 20x to 60x outliers. Each workaround depended on some spare capability being there.
3. **The killers are usually environmental and seasonal, not random part failures.** Of the rovers that reached the surface and died, most died at a night, winter, or dust event (Spirit, Opportunity, Zhurong, Pragyan, Lunokhod 2). This suggests the game's "sustainability" pressure should center on cycles: day and night, seasons, dust.
4. **Coupling turns a small problem into death.** Spirit's chain (stuck, cannot tilt, low power, too cold) and Lunokhod 2's chain (dust on lid, dust on radiator, overheating) show that failures cross subsystem lines.
5. **Small, cheap, short-lived rovers are a valid design point.** Pragyan met its goals at a fraction of NASA flagship cost. The trade is that there is no chance of a long extended mission.
6. **Long life has costs too.** Extended missions need ongoing operations funding. MER's 15 years of operations cost about $336 million on top of about $744 million for development and launch ([mercost]).

## Rover mission phases

The general NASA life cycle and operations phases are in [../mission-engineering/01-mission-lifecycle.md](../mission-engineering/01-mission-lifecycle.md). This section covers what is specific to rovers. In the game concept, the player owns the rover, and the provided spacecraft handles cruise and landing.

| Phase | What happens | How it constrains the rover | Real examples |
| --- | --- | --- | --- |
| Launch and cruise | Rover is stowed inside the aeroshell or lander. Spacecraft handles navigation, power, and thermal. | Rover must survive launch loads and months of cruise while stowed. RTG rovers need heat rejection during cruise. | Mars cruise about 7 months for MER ([oppend]) |
| Entry, descent, landing (EDL) | Heat shield, parachute (Mars), then airbags, sky crane, or legged lander with engines. | Sets maximum rover mass, stowed shape, landing accuracy, and site hazards (see next section). | Airbags: Pathfinder, MER ([mpf]). Sky crane: Curiosity, Perseverance ([skycrane]). Legged lander plus ramp: Lunokhods, Yutu, Zhurong, Pragyan |
| Deployment and egress | Unfold mast, wheels, solar panels, antenna; drive off a ramp or petal, or start directly on wheels. | Every hinge and pin puller is a failure point. Ramp angle and lander tilt limit egress. | Sojourner took a 20 degree ramp ([mpf]). MAPP could not leave a toppled lander ([mapp]) |
| Commissioning / checkout | Health checks, first images, instrument and mobility tests, short drives. | Uses early power and time. Problems found here may become permanent constraints. | Perseverance dropped part of its belly pan soon after landing ([m20comp]) |
| Prime mission | Achieve the minimum mission success criteria in the planned lifetime. | Driven by the requirements the rover was built to. | 90 sols for MER; 1 Mars year for Perseverance ([m20press]) |
| Extended missions | Re-approved in blocks if the rover is healthy and the science is worth the operations cost. | Rover must have margin left. Teams change operations to protect worn parts. | Perseverance's first extension to about 2028 ([p26]) |
| End of mission | Failure, loss of contact, or a decision to stop. Some rovers become stationary platforms. | Planned end (Apollo LRV, Pragyan) or unplanned (Spirit, Opportunity, Zhurong). | Spirit declared a stationary platform in 2010 ([troy]) |

## What the delivery system constrains

In the game concept, the player does not design the lander, but the lander sets hard limits on the rover. The table summarizes the main EDL families.

| Delivery method | Rover mass range flown | Strengths | Limits it puts on the rover | Examples |
| --- | --- | --- | --- | --- |
| Airbags inside a tetrahedral lander (Mars) | About 10 to 185 kg | Simple, proven, tolerant of some error | Small and light; must fold inside the petals; large landing ellipse; few safe sites; needs egress off petals | Pathfinder ellipse about 200 by 70 km ([ellipse2]); MER had "barely three" safe sites ([skycrane]) |
| Sky crane (Mars) | 899 to 1,025 kg | Heavy rovers; lands directly on wheels; precision | Very complex and expensive; rover suspension must take touchdown load; still needs a large aeroshell | Curiosity, Perseverance ([skycrane], [m20comp]) |
| Legged lander with ramp (Moon, Mars) | About 26 to 840 kg | Works without atmosphere; lander can stay as a science station or relay | Must fit lander deck; ramp and deploy mechanisms; egress fails if lander tilts | Lunokhod, Yutu, Zhurong, Pragyan; MAPP failed when lander tipped ([mapp]) |
| Ejected mini rover from lander | 0.2 to 5 kg | Very cheap add-on | Tiny payload; short life; depends on lander for comms or has a weak direct link | SLIM LEV-1/LEV-2, Chang'e 6 Jinchan ([slim], [ce6]) |
| Commercial lunar delivery (CLPS and others) | About 2 to 430 kg | Lower cost per mission; frequent flights | Delivery risk is high: several recent commercial landers crashed or tipped | IM-2, ispace M1 and M2 ([im2], [rashid], [ten]) |

**What the rover designer receives from the delivery system** (our synthesis, drawn from the cases above):

| Constraint | Why it matters | Real anchor |
| --- | --- | --- |
| Maximum rover mass | Sets size of instruments, batteries, power source | Airbag limit pushed Curiosity to sky crane ([skycrane]) |
| Stowed envelope (volume and shape) | Rover must fold; more hinges mean more risk | Apollo LRV folded into a lunar module bay ([lrv]) |
| Landing ellipse size | Bigger ellipse means flatter, safer, often less interesting sites, and longer drives to targets | 200 by 70 km (Pathfinder) to 7.7 by 6.6 km (Perseverance) ([ellipse2], [ellipse]) |
| Latitude and elevation limits | Solar rovers need sunlight; parachute systems need enough atmosphere above the site (low elevation) | Opportunity's equatorial site helped it survive; Spirit needed tilted parking ([cleanspirit]) |
| Landing season and local time | Arriving before winter or a dust season cuts solar life | Zhurong hibernated within a year ([zhurong]) |
| Arrival date and launch window | Mars windows every about 26 months; a slip costs two years | MSL slipped from 2009 to 2011 ([msldelay]) |
| Communications path | Direct to Earth, via lander, via orbiter, or via relay satellite | Sojourner via lander ([mpfssdc]); Yutu-2 via Queqiao ([ce4]) |
| Egress method | Ramp, petals, or direct to wheels | MAPP stuck inside tipped lander ([mapp]) |

Details on the environments and site selection behind these limits are in [03-surface-environments-and-operations.md](03-surface-environments-and-operations.md).

## Cost, team, and build time

Costs mix different bases (development only vs full life cycle including launch and operations). Always check the basis before comparing. NASA cost classes and reserves are explained in [../mission-engineering/04-cost-risk-programmatics.md](../mission-engineering/04-cost-risk-programmatics.md).

| Mission | Cost | Basis and year | Build time | Source |
| --- | --- | --- | --- | --- |
| Mars Pathfinder (incl. Sojourner) | About $265 million total; rover about $25 million | Includes launch and operations; then-year dollars | About 3 years development | [mpfssdc], [mpffact] |
| MER (Spirit and Opportunity) | About $744 million development and launch, plus $336 million for 15 years of operations, about $1.08 billion total | Planetary Society compilation | About 3 years (2000 to 2003) (*unverified*) | [mercost] |
| MER (alternative figure) | About $820 million for build, launch, and 90-sol prime | Commonly cited (*unverified*) | | [mercost] |
| MSL (Curiosity) | About $2.5 billion life cycle (up from about $1.6 billion baseline) | NASA OIG, 2011 | Launch slipped 2009 to 2011, adding about $400 million | [mslig], [msldelay] |
| Mars 2020 (Perseverance) | About $2.725 billion (about $2.9 billion in 2020 dollars) | Development, launch, and 2-year prime ops | About 7.5 years from 2012 announcement to 2020 launch (*unverified*) | [m20cost] |
| Ingenuity | About $80 million build plus $5 million ops | Add-on to Mars 2020 | | [ingcost] |
| Chandrayaan-3 (lander, rover, propulsion module) | About Rs 615 crore, roughly $75 million | Reported mission cost (*unverified*) | | [ch3cost] |
| VIPER | $609.6 million projected at cancellation (commitment $433.5 million), not counting the $323 million Astrobotic lander contract | NASA to Congress, 2024 | | [viper] |
| VIPER delivery (Blue Origin) | Up to $190 million | CLPS task order, 2025 | | [viperbo] |
| Dragonfly | $3.35 billion | Life cycle, including launch and operations | Selected 2019, launch 2028 | [dflyaip] |

**Team size.** Public, comparable team-size numbers are rare. We did not find reliable official figures for most rovers, so we do not list them. *Our analysis:* for game purposes, cost and build time are better-documented proxies for team effort than headcount.

### Our analysis of the cost pattern

- **Cost scales with mass and capability far more than with lifetime.** Pragyan (26 kg) sat inside a mission of about $75 million. Curiosity (899 kg) cost about $2.5 billion. Opportunity's extra 14 years of operations cost much less than building it.
- **Heritage is the strongest cost lever.** Mars 2020 reused Curiosity's design and some spares. Although it ended up near MSL's cost in then-year dollars, NASA expected a much higher cost for a new design ([m20cost2]).
- **Delays are expensive because windows are rare.** MSL's two-year slip cost about $400 million ([msldelay]).
- **Cancellation risk is real and often comes from cost growth.** VIPER passed the 30 percent overrun line that triggers a NASA termination review ([viper]); MSR was defunded ([msrdead]).

## Key numbers for the game

| Quantity | Value | Unit | Source |
| --- | --- | --- | --- |
| Opportunity planned vs actual life | 90 vs 5,111 | sols | [p26] |
| Spirit planned vs actual life | 90 vs 2,208 (last contact) | sols | [p26], [troy] |
| Sojourner planned vs actual | 7 vs 83 | sols | [sojpia], [p26] |
| Zhurong planned vs actual | 90 sols vs about 358 days | sols / days | [zhurong], [livesci] |
| Pragyan design life | 1 | lunar day (about 14 Earth days of light) | [ch3] |
| Ingenuity planned vs actual | 5 vs 72 | flights | [ing] |
| Off-world distance record | 45.22 (Perseverance, Oct 2026) | km | [p26] |
| Opportunity distance | 45.16 | km | [p26] |
| Curiosity distance | more than 38.07 | km | [p26] |
| Lunokhod 2 distance | 37 to 39 | km | [lroc2], [p26] |
| Rover mass range | 0.238 (SORA-Q) to 1,025 (Perseverance) | kg | [slim2], [m20comp] |
| Pragyan mass and power | 26 and 50 | kg and W | [ch3] |
| MER solar design point | about 140 W for up to 4 h per sol (*unverified*) | W, h/sol | [merpower] |
| MER survival energy need | about 180 | Wh per sol | [cleanspirit] |
| Cleaning event gain | 2 to 10 | percent of power | [clean], [clean2] |
| Zhurong dust thresholds | 20 (trouble), 30 (needs strongest light), 40 (never wakes) | percent panel coverage | [huff] |
| MMRTG output | about 110 to 125 at start, about 100 after 14 years | W | [m20comp], [mmrtgdoe] |
| MMRTG design life | 14 | years | [m20comp] |
| Perseverance top speed | 152 | m/h | [m20comp] |
| Perseverance best single sol drive | 412 | m | [p26] |
| Curiosity traction control load cut | 20 (leading) and 11 (middle) | percent | [traction] |
| Landing ellipse | 200 x 70 (Pathfinder) to 7.7 x 6.6 (Perseverance) | km | [ellipse2], [ellipse] |
| Mars launch window spacing | about 26 | months | [msldelay] |
| MSL slip cost | about 400 | million USD | [msldelay] |
| Pathfinder total cost | about 265 | million USD (then-year) | [mpfssdc] |
| MSL life-cycle cost | about 2.5 | billion USD | [mslig] |
| Mars 2020 cost | about 2.7 | billion USD | [m20cost] |
| VIPER cost at cancellation | 609.6 | million USD | [viper] |
| Opportunity recovery effort | more than 1,000 commands over 8 months | commands | [oppend] |

## Game implications

These map findings to possible mechanics for a design-a-rover-and-keep-it-alive game. They are *our analysis*. Scenario design itself lives in [04-rover-games-and-scenarios.md](04-rover-games-and-scenarios.md).

| Finding | Possible mechanic | Real anchor |
| --- | --- | --- |
| Delivery system sets hard limits | Mission card gives a lander with max rover mass, stowed box size, ellipse, latitude, and arrival season. Design is rejected if it does not fit. | Airbag limit forcing sky crane ([skycrane]) |
| Planned life is a floor, not a forecast | Player sets a "prime mission" target. Score full success at that target, then bonus points for every extra sol survived. | Opportunity 90 vs 5,111 sols ([p26]) |
| Solar vs radioisotope trade | Solar: cheap, light, power falls with dust and winter. RTG: steady low power, heavy, costly, needs approval, slow decay. | MER vs MSL ([merpower], [mmrtgdoe]) |
| Dust accumulates and sometimes clears | Each sol removes a small percent of solar output; random wind "cleaning events" restore 2 to 10 percent. | [clean], [clean2] |
| Global dust storms | Rare event that cuts sunlight for weeks; solar rovers need battery and heater margin or die. | Opportunity 2018 ([oppend]) |
| Hibernation is a gamble | Player can choose to hibernate through winter or night; wake-up succeeds only if panel dust stays under a threshold. | Zhurong thresholds 20/30/40 percent ([huff]) |
| Night survival needs design | Lunar missions longer than 14 days require a heater source or rated cold electronics; otherwise wake-up chance is low. | Pragyan did not wake; Yutu-2 survived years ([ch3nowake], [ce4design]) |
| Coupled failures | Losing mobility removes the option to tilt toward the Sun, which then threatens thermal survival. | Spirit at Troy ([troy], [spiritend]) |
| Wear items | Wheels and rotors have a wear meter that rises faster on sharp terrain. Player can buy "traction software" to slow it, or drive around rough ground at a time cost. | Curiosity wheels ([traction]), Ingenuity rotor ([ingdist2]) |
| Operational workarounds | Unlock repair actions when something fails: drive backward, switch to RAM-only mode, drive on five wheels. Each has a cost. | Spirit wheel ([merwheel]), Opportunity flash ([flash]) |
| Mechanisms are risk | Each deployable (mast, panel, ramp) adds a small failure chance at deployment or night fold. | Yutu fold failure ([yutu1ut]), MAPP egress ([mapp]) |
| Comms path choice | Via lander: cheap, but if the lander dies, so does the mission. Direct to Earth: heavier. Relay required for far side. | Sojourner ([mpfssdc]), Yutu-2 and Queqiao ([ce4]) |
| Delivery risk exists but is not the player's fault | Small chance of a "landing failure" outcome, framed as a lesson, with a retry. | Rashid, Tenacious, MAPP |
| Heritage lowers cost and risk | Reusing a previous design unlocks discounts and reliability but limits new features. | Mars 2020 from MSL ([m20comp], [m20heritage]) |
| Extended missions cost money | After prime, each extension block costs operations budget; the player decides whether to keep going. | MER ops about $336 million over 15 years ([mercost]) |
| Autonomy saves time | Higher autonomy level gives more distance per sol at higher upfront cost. | Perseverance AutoNav over 90 percent, up to 412 m per sol ([p26]) |
| Cancellation risk from overrun | If design cost exceeds budget by more than 30 percent, trigger a review event that can cancel the mission. | VIPER ([viper]) |

## Sources

Reference keys used in this file. Where a key cites a secondary or encyclopedia source, the related claim is marked *unverified* in the text.

- **p26**: NASA Science, "NASA's Perseverance Sets Off-World Record for Total Distance Driven," Oct 12, 2026. [link][p26]
- **lrv**: NASA NSSDCA, "The Apollo Lunar Roving Vehicle." [link][lrv]
- **luno1**: Space.com, "Lunokhod 1: 1st Successful Lunar Rover." [link][luno1]
- **luno2wiki**: Wikipedia, "Lunokhod 2" (secondary). [link][luno2wiki]
- **lroc2**: LROC (Arizona State University), "Lunokhod 2 Revisited." [link][lroc2]
- **smith**: Smithsonian Air and Space, "The Day a Soviet Moon Rover Refused to Stop" (not opened directly). [link][smith]
- **mpf**: NASA Science, Mars Pathfinder mission page. [link][mpf]
- **mpfssdc**: NASA NSSDCA Master Catalog, Mars Pathfinder (1996-068A). [link][mpfssdc]
- **mpffact**: NASA JPL Mars Pathfinder fact sheet (archived). [link][mpffact]
- **sojpia**: NASA JPL, PIA00611 "Pathfinder's Rover, Airbags, and Martian Terrain." [link][sojpia]
- **sojwiki**: Wikipedia, "Sojourner (rover)" (secondary). [link][sojwiki]
- **merjpl**: NASA JPL, 2003 Mars Exploration Rovers mission page (archived 2004). [link][merjpl]
- **merpower**: PBS NOVA, "Rovers" fact page (secondary). [link][merpower]
- **mercost**: The Planetary Society, "Cost of the Mars Exploration Rovers." [link][mercost]
- **merwheel**: Mars Daily, "Spirit Team Gives Up On Front Wheel" (2006). [link][merwheel]
- **troy**: Astronomy, "Scientists declare Spirit a stationary research platform" (2010). [link][troy]
- **spiritend**: NASA JPL, "NASA Concludes Attempts to Contact Mars Rover Spirit" (2011). [link][spiritend]
- **oppend**: NASA JPL, "NASA's Opportunity Rover Mission on Mars Comes to End" (2019). [link][oppend]
- **clean**: NBC News, "Mars rovers get mystery power boost" (2004). [link][clean]
- **clean2**: Universe Today, "Opportunity Rover Gets Power Boost from Wind Event on Mars" (2014). [link][clean2]
- **cleanspirit**: Universe Today, "Cleaning Event Boosts Spirit's Power Levels" (2009). [link][cleanspirit]
- **flash**: NASA JPL, "Opportunity Working in 'No Flash' Mode for Now." [link][flash]
- **flash2**: NASA JPL, "Memory Reformat Planned for Opportunity Mars Rover" (2014). [link][flash2]
- **msl**: NASA Science, Mars Science Laboratory: Curiosity mission page. [link][msl]
- **mmrtgdoe**: US Department of Energy, "Powering Curiosity: Multi-Mission Radioisotope Thermoelectric Generators." [link][mmrtgdoe]
- **skycrane**: NASA JPL, "Here's How Curiosity's Sky Crane Changed the Way NASA Explores Mars" (2024). [link][skycrane]
- **traction**: NASA JPL, "An Algorithm Helps Protect Mars Curiosity's Wheels" (2017). [link][traction]
- **mslig**: NASA Office of Inspector General, IG-11-019, Mars Science Laboratory audit (2011). [link][mslig]
- **msldelay**: Spaceflight Now (CBS News), "NASA delays Mars Science Laboratory to 2011" (2008). [link][msldelay]
- **curiprime**: Spaceflight101, "MSL Rover Overview" (secondary). [link][curiprime]
- **curio5000**: Nature World News, "Curiosity rover logs 5,000 Martian days" (Sep 2026, secondary). [link][curio5000]
- **m20**: NASA Science, Mars 2020 Perseverance mission page. [link][m20]
- **m20comp**: NASA Science, Perseverance rover components. [link][m20comp]
- **m20press**: NASA JPL, Mars 2020 landing press kit, mission overview. [link][m20press]
- **m20cost**: The Planetary Society, "The Cost of Perseverance, in Context." [link][m20cost]
- **m20cost2**: Space.com, "Mars 2020 Rover Mission to Cost More Than $2 Billion" (2016). [link][m20cost2]
- **m20heritage**: Tech Briefs, Mars 2020 deputy chief engineer interview on heritage. [link][m20heritage]
- **ellipse**: NASA Science photojournal, "Zeroing in on the Target" (Perseverance ellipse). [link][ellipse]
- **ellipse2**: NASA Science photojournal, "Mars Probe Landing Ellipses." [link][ellipse2]
- **ing**: Science News, "NASA's Ingenuity helicopter officially ends its mission on Mars" (2024). [link][ing]
- **ingdist**: NBC News, "NASA's little helicopter on Mars has logged its last flight" (2024). [link][ingdist]
- **ingdist2**: CBS News, "NASA Mars helicopter Ingenuity ends marathon mission after rotor damage" (2024). [link][ingdist2]
- **ingcost**: The Planetary Society, "Ingenuity, NASA's Mars Helicopter." [link][ingcost]
- **ce3**: Wikipedia, "Chang'e 3" (secondary). [link][ce3]
- **yutu1ut**: Universe Today, "China's Yutu Moon Rover Unable to Properly Maneuver Solar Panels" (2014). [link][yutu1ut]
- **ce4**: The Planetary Society, "Chang'e-4 and Yutu-2." [link][ce4]
- **ce4design**: Space.com, "Chang'e 4 Spacecraft Enter 3rd Lunar Night, Yutu 2 Hits Design Lifetime" (2019). [link][ce4design]
- **yutu2km**: China Daily (Xinhua), "China's lunar rover travels over 1 km on the moon" (Jan 2022). [link][yutu2km]
- **yutu2still**: Space.com, "China's Yutu 2 rover still going strong after nearly 6 years" (2024). [link][yutu2still]
- **yutu2btb**: Behind the Black, "Is China's Yutu-2 lunar rover dead?" (Jan 2025, secondary, citing LRO image analysis). [link][yutu2btb]
- **ce6**: China Aerospace Science and Technology Corp. (Xinhua), Chang'e-6 mini rover image report (2024). [link][ce6]
- **ce6sp**: Space.com, "How China's Chang'e 6 minirover snapped its epic photo on the moon's far side" (2024). [link][ce6sp]
- **zhurong**: The Planetary Society, "Tianwen-1 and Zhurong." [link][zhurong]
- **zhurongdb**: Orbital Radar, Zhurong data page (secondary). [link][zhurongdb]
- **livesci**: Live Science, "China finally admits its hibernating Mars rover may never wake up" (2023). [link][livesci]
- **huff**: HuffPost UK, report on Zhang Rongqiao CCTV interview (2023). [link][huff]
- **spacehib**: Space.com, "China's Mars rover is hibernating through the harsh Red Planet winter" (2022). [link][spacehib]
- **ch3**: ISRO, Chandrayaan-3 landing brochure. [link][ch3]
- **ch3site**: Space Odyssey Hub, Chandrayaan-3 landing (secondary, site coordinates). [link][ch3site]
- **ch3sleep**: All India Radio News, "ISRO to wake up Chandrayaan-3's rover Pragyan on 22nd" (2023). [link][ch3sleep]
- **ch3sleep2**: The Statesman, "Pragyan rover put to sleep as lunar day ends" (2023). [link][ch3sleep2]
- **ch3nowake**: Deccan Herald (PTI), "No signal yet from Vikram, Pragyan: ISRO" (2023). [link][ch3nowake]
- **ch3cost**: Republic World, "Chandrayaan-3 budget" (secondary). [link][ch3cost]
- **pragwiki**: Wikipedia, "Pragyan (Chandrayaan-3)" (secondary). [link][pragwiki]
- **rashid**: Scientific American, "Japanese Moon Landing Attempt Falls Short as Spacecraft Goes Silent" (2023). [link][rashid]
- **slim**: JAXA press release, SLIM landing results and LEV-1/LEV-2 (Jan 25, 2024). [link][slim]
- **slim2**: JAXA ISAS, SLIM press briefing (Dec 26, 2024). [link][slim2]
- **ten**: SpacePolicyOnline, "Hardware Failure Doomed ispace's Mission 2" (2025). [link][ten]
- **tenmass**: ispace, "ispace-EUROPE announces completion of first European lunar micro rover" (2024). [link][tenmass]
- **im2**: Spaceflight Now, "Intuitive Machines' IM-2 Moon mission ends with lander on its side" (2025). [link][im2]
- **mapp**: Space.com, "Private mini rover aboard sideways Athena moon lander was ready to roll" (2025). [link][mapp]
- **cadre**: NASA JPL, CADRE mission page. [link][cadre]
- **cadrepack**: NASA JPL, "NASA's Mini Rover Team Is Packed for Lunar Journey" (2025). [link][cadrepack]
- **viper**: SpacePolicyOnline, "NASA Provides More Details to Congress about VIPER Decision" (2024). [link][viper]
- **viperbo**: NASA, "NASA Selects Blue Origin to Deliver VIPER Rover to Moon's South Pole" (Sep 2025). [link][viperbo]
- **mk1**: Space.com, "Moon lander preps for the lunar surface" (May 2026). [link][mk1]
- **mk1b**: New Space Economy, "What is Blue Origin's Blue Moon lunar lander" (Oct 2026, secondary). [link][mk1b]
- **rfm**: Europlanet Science Congress 2026 abstract EPSC2026-411, Rosalind Franklin mission status. [link][rfm]
- **rfmnasa**: European Spaceflight, "ESA's Mars Rover to Launch Aboard SpaceX Falcon Heavy in 2028" (2026). [link][rfmnasa]
- **rfmesa**: ESA, "ExoMars rover testing moves ahead and deep down." [link][rfmesa]
- **rfmplan**: The Planetary Society, "ExoMars Rosalind Franklin rover." [link][rfmplan]
- **rfmwiki**: Wikipedia, "Rosalind Franklin (rover)" (secondary). [link][rfmwiki]
- **dfly**: NASA Science, Dragonfly mission page. [link][dfly]
- **dflyfh**: Space.com, "SpaceX Falcon Heavy rocket will launch NASA's Dragonfly mission in 2028." [link][dflyfh]
- **dflyaip**: AIP FYI, "Dragonfly Rotorcraft Mission Proceeds Despite Cost Doubling" (2024). [link][dflyaip]
- **dflyasm**: DroneXL, "NASA Dragonfly enters full assembly phase" (Mar 2026, secondary). [link][dflyasm]
- **dflywiki**: Wikipedia, "Dragonfly (Titan space probe)" (secondary). [link][dflywiki]
- **msrheli**: The Planetary Society, "NASA's Mars Sample Return will use helicopters" (Aug 2022). [link][msrheli]
- **msrdead**: The Register, "Congress throws NASA a lifeline, leaves Mars sample mission to die in the dust" (Jan 2026). [link][msrdead]

[p26]: https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/
[lrv]: https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html
[luno1]: https://www.space.com/35090-lunokhod-1.html
[luno2wiki]: https://en.wikipedia.org/wiki/Lunokhod_2
[lroc2]: https://lroc.im-ldi.com/images/699
[smith]: https://www.smithsonianmag.com/air-space-magazine/time-soviet-moon-rover-refused-stop-180967884/
[mpf]: https://science.nasa.gov/mission/mars-pathfinder/
[mpfssdc]: https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1996-068A
[mpffact]: https://webarchive.library.unt.edu/web/20090813031850/http:/jpl.nasa.gov/news/fact_sheets/mpf.pdf
[sojpia]: https://www.jpl.nasa.gov/images/pia00611-pathfinders-rover-airbags-martian-terrain
[sojwiki]: https://en.wikipedia.org/wiki/Sojourner_(rover)
[merjpl]: https://webharvest.gov/peth04/20041016114037/http://www.jpl.nasa.gov/missions/current/marsexplorationrovers.html
[merpower]: https://dipsy.pbs.org/wgbh/nova/mars/rove-nf.html
[mercost]: https://planetary.org/space-policy/cost-of-the-mars-exploration-rovers
[merwheel]: https://www.marsdaily.com/reports/Spirit_Team_Gives_Up_On_Front_Wheel.html
[troy]: https://www.astronomy.com/space-exploration/scientists-declare-spirit-a-stationary-research-platform/
[spiritend]: https://www.jpl.nasa.gov/news/nasa-concludes-attempts-to-contact-mars-rover-spirit/
[oppend]: https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/
[clean]: https://www.nbcnews.com/id/wbna6413598
[clean2]: https://www.universetoday.com/110800/opportunity-rover-gets-power-boost-from-wind-event-on-mars
[cleanspirit]: https://www.universetoday.com/articles/cleaning-event-boosts-spirits-power-levels-oppy-back-on-the-road
[flash]: https://www.jpl.nasa.gov/news/opportunity-working-in-no-flash-mode-for-now/
[flash2]: https://www.jpl.nasa.gov/news/memory-reformat-planned-for-opportunity-mars-rover/
[msl]: https://science.nasa.gov/mission/msl-curiosity/
[mmrtgdoe]: https://www.energy.gov/ne/articles/powering-curiosity-multi-mission-radioisotope-thermoelectric-generators
[skycrane]: https://www.jpl.nasa.gov/news/heres-how-curiositys-sky-crane-changed-the-way-nasa-explores-mars/
[traction]: https://www.jpl.nasa.gov/news/an-algorithm-helps-protect-mars-curiositys-wheels/
[mslig]: https://www.oversight.gov/sites/default/files/oig-reports/IG-11-019.pdf
[msldelay]: https://spaceflightnow.com/news/n0812/04msl/index2.html
[curiprime]: https://spaceflight101.com/msl/?p=316
[curio5000]: https://www.natureworldnews.com/articles/73269/20260910/curiosity-rover-logs-5000-martian-days-still-climbing-mount-sharp-worn-wheels-14-years-after.htm
[m20]: https://science.nasa.gov/mission/mars-2020-perseverance/
[m20comp]: https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/
[m20press]: https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission
[m20cost]: https://www.planetary.org/articles/cost-of-perseverance-in-context
[m20cost2]: https://www.space.com/33514-mars-2020-rover-cost-over-2-billion.html
[m20heritage]: https://www.techbriefs.com/component/content/article/tb/stories/blog/37151
[ellipse]: https://science.nasa.gov/photojournal/zeroing-in-on-the-target
[ellipse2]: https://science.nasa.gov/photojournal/mars-probe-landing-ellipses
[ing]: https://www.sciencenews.org/article/nasa-mars-ingenuity-helicopter-ends-mission
[ingdist]: https://www.nbcnews.com/science/space/nasas-little-helicopter-mars-logged-last-flight-rcna135757
[ingdist2]: https://www.cbsnews.com/news/nasa-mars-helicopter-ingenuity-ends-marathon-mission-rotor-damage
[ingcost]: https://www.planetary.org/space-missions/ingenuity
[ce3]: https://en.wikipedia.org/wiki/Chang%27e_3
[yutu1ut]: https://www.universetoday.com/articles/chinas-yutu-moon-rover-unable-to-properly-maneuver-solar-panels
[ce4]: https://www.planetary.org/space-missions/change-4
[ce4design]: https://www.space.com/change-4-moon-spacecraft-third-lunar-night.html
[yutu2km]: https://www.chinadaily.com.cn/a/202201/08/WS61d95724a310cdd39bc7fe7d.html
[yutu2still]: https://space.com/china-yutu-2-rover-moon-far-side-2024-video
[yutu2btb]: https://behindtheblack.com/behind-the-black/points-of-information/is-chinas-yutu-2-lunar-rover-dead
[ce6]: https://english.spacechina.com/n17212/c4144426/content.html
[ce6sp]: https://www.space.com/how-change-6-moon-rover-snapped-lander-photo
[zhurong]: https://www.planetary.org/space-missions/tianwen-1
[zhurongdb]: https://orbitalradar.com/mars-rovers/zhurong
[livesci]: https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up
[huff]: https://huffingtonpost.co.uk/entry/china-mars-rover-hibernating_uk_6447d4bee4b011a819c3a9d3
[spacehib]: https://www.space.com/zhurong-china-mars-rover-hibernating-winter
[ch3]: https://www.isro.gov.in/NSPD2024/assets/pdf/CH3%20Landing%20Brochure-Pagewise.pdf
[ch3site]: https://spaceodysseyhub.com/missions/chandrayaan-3
[ch3sleep]: https://www.newsonair.gov.in/isro-to-wake-up-chandrayan-3s-rover-pragyan-on-22nd-of-this-month-after-it-was-put-to-sleep-following-completion-of-all-its-assignments-on-lunar-surface/
[ch3sleep2]: https://www.thestatesman.com/india/pragyan-rover-put-to-sleep-as-lunar-day-ends-will-it-awaken-again-1503218360.html
[ch3nowake]: https://www.deccanherald.com/science/space/no-signal-yet-from-vikram-pragyan-isro-2697635
[ch3cost]: https://www.republicworld.com/science/space/chandrayaan-3-budget-how-much-did-indias-3rd-moonshot-cost-articleshow
[pragwiki]: https://en.wikipedia.org/wiki/Pragyan_(Chandrayaan-3)
[rashid]: https://www.scientificamerican.com/article/japanese-moon-landing-attempt-falls-short-as-spacecraft-goes-silent/
[slim]: https://global.jaxa.jp/press/2024/01/20240125-2_e.html
[slim2]: https://www.isas.jaxa.jp/en/topics/files/SLIM-press-briefing-20241226.pdf
[ten]: https://spacepolicyonline.com/news/hardware-failure-doomed-ispaces-mission-2/
[tenmass]: https://ispace-inc.com/wp-content/uploads/2024/07/EN_20240725_Rover-Completion.pdf
[im2]: https://spaceflightnow.com/2025/03/07/intuitive-machines-im-2-mission-ends-with-lander-on-its-side-on-the-moon/
[mapp]: https://www.space.com/the-universe/moon/private-mini-rover-aboard-sideways-athena-moon-lander-was-ready-to-roll-but-it-couldnt-get-out
[cadre]: https://www.jpl.nasa.gov/missions/cadre
[cadrepack]: https://www.jpl.nasa.gov/news/nasas-mini-rover-team-is-packed-for-lunar-journey/
[viper]: https://spacepolicyonline.com/news/nasa-provides-more-details-to-congress-about-viper-decision/
[viperbo]: https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/
[mk1]: https://www.space.com/space-exploration/private-spaceflight/moon-lander-preps-for-the-lunar-surface-space-photo-of-the-day-for-may-6-2026
[mk1b]: https://newspaceeconomy.ca/2026/10/11/what-is-blue-origins-blue-moon-lunar-lander-and-how-will-it-support-nasas-artemis-program/
[rfm]: https://meetingorganizer.copernicus.org/EPSC2026/EPSC2026-411.html
[rfmnasa]: https://europeanspaceflight.com/?p=6343
[rfmesa]: https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/ExoMars_rover_testing_moves_ahead_and_deep_down
[rfmplan]: https://www.planetary.org/space-missions/exomars-rover
[rfmwiki]: https://en.wikipedia.org/wiki/Rosalind_Franklin_(rover)
[dfly]: https://science.nasa.gov/mission/dragonfly/
[dflyfh]: https://www.space.com/space-exploration/missions/spacex-falcon-heavy-rocket-will-launch-nasas-epic-dragonfly-mission-to-saturns-huge-moon-titan-in-2028
[dflyaip]: https://www.aip.org/fyi/dragonfly-rotorcraft-mission-proceeds-despite-cost-doubling
[dflyasm]: https://dronexl.co/2026/03/05/nasa-dragonfly-enters-full-assembly-phase
[dflywiki]: https://en.wikipedia.org/wiki/Dragonfly_(Titan_space_probe)
[msrheli]: https://www.planetary.org/articles/nasa-mars-sample-return-helicopters
[msrdead]: https://www.theregister.com/2026/01/16/nasa_science_budget/
