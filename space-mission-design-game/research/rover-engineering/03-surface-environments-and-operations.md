# Surface Environments, Landing Sites, and Rover Operations

This file covers what a rover faces after it lands: the environment at each candidate destination, how real teams choose where to land, how a rover is driven day by day, and the tricks that have kept rovers alive for years. It is written so the team can simulate a believable surface (day and night, seasons, dust, radiation, communications) and a believable operations loop (plan, uplink, execute, downlink, recover from faults).

Researched November 14, 2026. Status of active missions is given as of that date.

Quick navigation: [Destinations compared](#destination-environment-comparison) · [Mars in detail](#mars-specifics) · [Moon in detail](#moon-specifics) · [Other worlds](#other-destinations-briefly) · [Landing site selection](#landing-site-selection) · [Surface operations](#surface-operations) · [Sustainability strategies](#sustainability-strategies-from-real-missions) · [Hazard and anomaly catalog](#hazard-and-anomaly-catalog) · [Key numbers](#key-numbers-for-the-game) · [Game implications](#game-implications) · [Sources](#sources)

Related files: mission history and case-study narratives are in [01-rover-missions-history.md](01-rover-missions-history.md); subsystem engineering and sizing are in [02-rover-subsystems.md](02-rover-subsystems.md); game scenarios are in [04-rover-games-and-scenarios.md](04-rover-games-and-scenarios.md). General light-time formulas and ground networks are in [../mission-engineering/02-mission-design-orbits-launch.md](../mission-engineering/02-mission-design-orbits-launch.md#light-time-delay); planetary protection categories are in [../mission-engineering/01-mission-lifecycle.md](../mission-engineering/01-mission-lifecycle.md#planetary-protection).

---

## Destination environment comparison

The table below is the master reference. Every figure links to its source. Values marked "Our analysis" are computed by us from the cited fact-sheet numbers (for example, light-time = distance divided by the speed of light).

### Physical and orbital environment

| Destination | Surface gravity | Length of solar day | Surface temperature range | Atmosphere and pressure | Sunlight at top of atmosphere |
| --- | --- | --- | --- | --- | --- |
| Moon, equatorial | 1.62 m/s² ([NSSDCA Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)) | 29.53 Earth days synodic, so about 14.8 days of light then 14.8 days of night ([NSSDCA Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)) | 95 K to 390 K (about -178 °C to +117 °C) ([NSSDCA Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)) | Essentially vacuum, 3 x 10⁻¹⁵ bar at night ([NSSDCA Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)) | 1,361 W/m², same as Earth orbit ([NSSDCA Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)) |
| Moon, mid-latitude (Chang'e 4 at ~45°S, Von Kármán) | 1.62 m/s² | Same 29.5-day cycle | Colder than equator at noon; rovers still nap at local noon to avoid overheating ([Space.com](https://www.space.com/42921-china-far-side-moon-mission-standby-mode.html)) | Vacuum | 1,361 W/m² but at a lower Sun angle |
| Moon, south polar (lit ridges) | 1.62 m/s² | Sun circles near the horizon; lighting depends on local topography rather than a clean day/night ([NASA VIPER planning, NTRS](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)) | Very cold; shadows move at about rover speed ([NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)) | Vacuum | 1,361 W/m² on surfaces facing the Sun; near-horizontal Sun means vertical panels |
| Moon, permanently shadowed regions (PSRs) | 1.62 m/s² | Never sees direct Sun | About 33 K to 38 K measured by LRO Diviner (Cabeus PSR average 37 K) ([EurekAlert / UCLA, 2009](https://www.eurekalert.org/news-releases/648084); [Paige et al. 2010, USGS record](https://pubs.usgs.gov/publication/70036393)) | Vacuum | Zero direct sunlight; solar power impossible inside |
| Mars, equatorial (Gale ~5°S, Meridiani ~2°S) | 3.73 m/s² mean ([NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)) | 24.6597 h, which is 24 h 39 m 35 s ([NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)) | Gale air: daily highs near 0 °C, lows near -70 °C in early mission ([NASA PIA16913](https://www.jpl.nasa.gov/images/pia16913-steady-temperatures-at-mars-gale-crater/)) | CO₂ 95.1%; 6.36 mbar at mean radius, varies 4.0 to 8.7 mbar with season ([NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)) | 586.2 W/m² mean; Our analysis from the orbit gives about 490 W/m² at aphelion and 713 W/m² at perihelion |
| Mars, mid-latitude (Utopia ~25°N, Viking 1 ~22°N) | 3.73 m/s² | 24 h 39 m 35 s | Viking 1 site: 184 K to 242 K (-89 °C to -31 °C) daily range ([NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)) | 6.9 to 9 mbar at Viking 1 site ([NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)) | Same orbit values; winter insolation drops sharply (see Mars section) |
| Venus | 8.87 m/s² ([NSSDCA Venus](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html)) | 2,802 h (about 117 Earth days) ([NSSDCA Venus](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html)) | 737 K (464 °C) average, almost no day/night difference ([NSSDCA Venus](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html)) | CO₂ 96.5%, 92 bar ([NSSDCA Venus](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html)) | 2,601 W/m² above clouds; very little reaches the surface |
| Titan | About one-seventh of Earth's ([JHU APL](https://www.jhuapl.edu/news/news-releases/170823-dragonfly-dual-quadcopter-aims-to-explore-titan-saturn-moon)) | One "Tsol" is about 16 Earth days ([NASA Dragonfly](https://science.nasa.gov/mission/dragonfly/)) | About 94 K (-179 °C) ([NASA Dragonfly Final EA](https://www.nasa.gov/wp-content/uploads/2024/01/dragonfly-final-ea-july-2022.pdf?emrc=e26d84)) | Nitrogen, about 1.45 to 1.5 bar, four times denser than Earth air ([JHU APL](https://www.jhuapl.edu/news/news-releases/170823-dragonfly-dual-quadcopter-aims-to-explore-titan-saturn-moon); pressure from [OpenStax Astronomy 2e](https://openstax.org/books/astronomy-2e/pages/12-3-titan-and-triton)) | Too dim and hazy for solar power, hence an MMRTG ([NASA Dragonfly spacecraft](https://science.nasa.gov/mission/dragonfly/spacecraft-and-instruments/)) |
| Europa (concept only) | About 1.3 m/s² *unverified* | About 3.55 Earth days (tidally locked) *unverified* | Roughly 96 K to 130 K at the equator depending on source ([Ashkenazy 2016, arXiv](https://arxiv.org/pdf/1608.07372v5)) | Essentially vacuum | About 1/27 of Earth's (Our analysis from Jupiter at 5.2 AU) |
| Phobos (MMX / IDEFIX) | Less than one-thousandth of Earth's ([DLR](https://www.dlr.de/en/latest/news/2026/off-to-the-moons-of-mars-mmx-mission-and-idefix-rover-ready-for-launch)); Our analysis from mass and radius gives about 0.006 m/s² | 7.65 h (synchronous with its 0.31891-day orbit) ([NSSDCA Mars, satellites](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)) | -170 °C to +70 °C ([DLR](https://www.dlr.de/en/latest/news/2026/off-to-the-moons-of-mars-mmx-mission-and-idefix-rover-ready-for-launch)) | Vacuum | Same as Mars orbit, about 490 to 713 W/m², plus eclipses by Mars |
| Mercury (not feasible for rovers today) | 3.70 m/s² ([NSSDCA Mercury](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html)) | 4,222.6 h (about 176 Earth days) ([NSSDCA Mercury](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html)) | 590 K to 725 K on the sunward side ([NSSDCA Mercury](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html)); very cold at night | Exosphere, below 5 x 10⁻¹⁵ bar | 9,082.7 W/m² ([NSSDCA Mercury](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html)) |

### Radiation, communications, and hazards

| Destination | Surface radiation dose | One-way light-time (Our analysis) | Earth visibility and relay | Seasons | Main surface hazards |
| --- | --- | --- | --- | --- | --- |
| Moon (any latitude) | About 1,369 µSv/day (1.37 mSv/day) total dose equivalent measured by Chang'e 4 LND, January to February 2019 ([Zhang et al. 2020, reported by Sci.News](https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html)) | About 1.3 s (384,400 km mean) ([NSSDCA Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)) | Near side: Earth always in sky. Far side: never, needs a relay such as Queqiao at Earth-Moon L2 ([National Geographic](https://www.nationalgeographic.com/science/article/china-change-4-historic-landing-moon-far-side-explained)). South pole: Earth below the horizon about half of each lunar day ([NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)) | Negligible (6.68° obliquity to its orbit, [NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)); the 14-day night dominates | 14-day night cold, noon heat, abrasive and clingy dust, solar particle events, steep crater walls |
| Mars | About 0.67 mSv/day from galactic cosmic rays, Curiosity RAD, August 2012 to June 2013, versus 1.8 mSv/day in cruise ([SwRI release on Hassler et al., Science](https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars)) | About 3.0 min (54.6 million km) to 22.3 min (401.4 million km) ([NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)) | Direct-to-Earth possible, but most data goes through relay orbiters; solar conjunction blocks contact for about two weeks every ~26 months | Yes: 25.19° obliquity and eccentric orbit ([NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)); Mars year 687 Earth days | Dust storms, dust on panels, cold nights and winters, sand traps, sharp rocks, slopes |
| Venus | Atmosphere shields the surface (Our analysis, 92-bar column) | About 2.1 to 14.5 min (38.2 to 261 million km) ([NSSDCA Venus](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html)) | Needs an orbiter relay; slow rotation means long passes | Effectively none | 464 °C heat, 92 bar pressure, corrosive chemistry |
| Titan | Low at surface under thick atmosphere (Our analysis) | Roughly 70 to 90 min (Our analysis, Saturn at about 8 to 11 AU from Earth) | Direct-to-Earth from the lander (Dragonfly plan) *unverified* | Saturn year about 29.5 Earth years *unverified* | Cryogenic cold, methane rain and lakes, sand dunes |
| Europa | About 5.4 Sv/day often quoted, a long-standing literature estimate ([Ashkenazy 2016 and related summaries](https://arxiv.org/pdf/1608.07372v5)) *unverified* | Roughly 35 to 52 min (Our analysis, Jupiter at about 4.2 to 6.2 AU) | Relay or direct; concept studies assume short missions | Small | Intense radiation, cryogenic cold, unknown surface texture |
| Phobos | Not measured; no atmosphere | Same as Mars, 3 to 22 min | Via the MMX mothership | Mars seasons, frequent eclipses | Micro-gravity: wheels can lift off, a rover can bounce |
| Mercury | High (close to Sun) | About 4.4 to 12.2 min *unverified* | Very hard; near the Sun as seen from Earth | Extreme day/night | Heat, solar flux, the delta-v needed to land |

**Our analysis:** The two numbers that most shape a rover's daily life are the length of the solar day and the distance to Earth. A Mars sol (24.66 h) is close enough to an Earth day that a team can plan once per sol. A lunar day lasts two Earth weeks, so lunar rovers work in near real time for many Earth days, then must survive two weeks of darkness. Light-time sets how "remote" the control feels: about 1.3 s for the Moon allows joystick-like teleoperation, while 3 to 22 minutes for Mars forces daily plans and onboard autonomy.

---

## Mars specifics

### Atmosphere, temperature, and wind

| Property | Value | Source |
| --- | --- | --- |
| Mean surface pressure | 6.36 mbar at mean radius; 4.0 to 8.7 mbar by season | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Composition | CO₂ 95.1%, N₂ 2.59%, Ar 1.94% | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Average temperature | About 214 K (-59 °C) | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Daily range, Viking 1 site | -89 °C to -31 °C | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Daily range, Gale crater air (early mission) | About 0 °C highs, -70 °C lows; afternoon air up to about 6 °C | [NASA PIA16913](https://www.jpl.nasa.gov/images/pia16913-steady-temperatures-at-mars-gale-crater/) |
| Ground temperature effect of terrain | Bedrock (high thermal inertia) warms and cools more slowly than sand | [NASA PIA16913](https://www.jpl.nasa.gov/images/pia16913-steady-temperatures-at-mars-gale-crater/) |
| Wind speeds (Viking) | 2 to 7 m/s summer, 5 to 10 m/s fall, 17 to 30 m/s in a dust storm | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Scale height | 11.0 km | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |

Thin air matters in two opposite ways. It is too thin to hold much heat, so nights are very cold and heaters must run. But it is thick enough to carry dust, which both dims the Sun and coats solar panels. Dust storms also act like a blanket: during the 2018 storm JPL noted that airborne dust "limits the extreme temperature swings" ([JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/)).

### Seasons and the Ls convention

| Item | Value | Source |
| --- | --- | --- |
| Mars year | 686.98 Earth days sidereal | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Obliquity | 25.19° (Earth 23.44°) | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Eccentricity | 0.0935 (Earth 0.0167) | [NSSDCA Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Solar longitude (Ls) | Season angle: Ls 0° northern spring equinox, 90° northern summer solstice, 180° northern autumn, 270° northern winter | [Planetary Society Mars calendar](https://www.planetary.org/articles/mars-calendar); [LMD Paris](https://www-mars.lmd.jussieu.fr/mars/time/solar_longitude.html) |
| Aphelion / perihelion | Aphelion near Ls 70°; perihelion near Ls 251° | [LMD Paris](https://www-mars.lmd.jussieu.fr/mars/time/solar_longitude.html) |
| Martian "months" | 30° of Ls each, lasting 46 to 67 sols because of the eccentric orbit | [LMD Paris](https://www-mars.lmd.jussieu.fr/mars/time/solar_longitude.html) |
| Dust storm season | Centered on perihelion; starts around Ls 180° by some definitions, around Ls 260° by others | [LMD Paris](https://www-mars.lmd.jussieu.fr/mars/time/solar_longitude.html); [Planetary Society](https://www.planetary.org/articles/mars-calendar) |

Because perihelion falls near southern summer, southern summers are short and hot and southern winters are long and cold. This is why Spirit (14.6°S) struggled more in winter than Opportunity (about 2°S).

### Winter sunlight by latitude (Our analysis)

We computed the 24-hour average sunlight on a flat surface at the top of the Martian atmosphere, using the orbit and obliquity from the [NSSDCA Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) and perihelion at Ls 251°. Real surface values are lower because dust absorbs and scatters light, but the pattern is the point: latitude and season can halve the energy.

| Latitude (example site) | Ls 0° (N spring) | Ls 90° (N summer, near aphelion) | Ls 180° (N autumn) | Ls 270° (N winter, near perihelion) | Worst / best ratio |
| --- | --- | --- | --- | --- | --- |
| 25°N (Zhurong, Utopia) | 162 W/m² | 177 | 183 | 125 | 0.68 |
| 18°N (Perseverance, Jezero) | 170 | 170 | 192 | 149 | 0.78 |
| 0° (equator) | 179 | 143 | 202 | 204 | 0.70 |
| 2°S (Opportunity, Meridiani) | 178 | 139 | 201 | 209 | 0.67 |
| 15°S (Spirit, Gusev) | 172 | 112 | 195 | 237 | 0.47 |
| 25°S | 162 | 88 | 183 | 252 | 0.35 |
| 45°S | 126 | 38 | 143 | 266 | 0.14 |

**Our analysis:** Two lessons for the game. First, the southern hemisphere suffers twice in winter (low Sun and far from the Sun), so a southern site needs either a bigger array, a radioisotope generator, or a tilt strategy. Second, tilting a panel toward the winter Sun is worth a lot: Spirit's team parked on north-facing slopes of 11° to nearly 30° to survive (see [Sustainability strategies](#sustainability-strategies-from-real-missions)).

### Dust storms, optical depth, and solar power

Atmospheric opacity is measured as optical depth, called tau (τ). Direct sunlight falls roughly as e^(-τ / cos z), where z is the Sun's angle from straight up, but scattered light partly makes up for it, so total power drops less steeply than direct sunlight.

| Storm class | What it means | Real examples | Source |
| --- | --- | --- | --- |
| Local | Small storms, common every year | Many per year | [NASA, 10 things](https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/) |
| Regional | Covers large areas for weeks; can still trigger safe modes | InSight entered safe mode during a regional storm in January 2022 | [JPL](https://www.jpl.nasa.gov/news/nasas-insight-enters-safe-mode-during-regional-mars-dust-storm/) |
| Global (planet-encircling) | Hides much of the planet for weeks to months; does not happen every year | 1971 (Mariner 9), 1977, 1982, 1994, 2001, 2007, 2018 | [NASA, 10 things](https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/) |

**The 2018 storm as a reference event:**

| Date (2018) | Observation | Source |
| --- | --- | --- |
| May 30 | Storm first detected by Mars Reconnaissance Orbiter | [JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/) |
| June 1 | Opportunity producing about 645 Wh per sol | [Planetary Society](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep) |
| June 8 | Storm over 18 million km² | [JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/) |
| June 10 | Tau 10.8, a record for Mars surface measurements (previous rover high about 5 to 5.5 in 2007); Opportunity energy down to 22 Wh; rover temperature about -29 °C | [Planetary Society](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep); [JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/) |
| June 12 | Storm about 35 million km², a quarter of the planet; Opportunity silent | [JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/) |
| June 20 | Storm officially planet-encircling | [NASA, 10 things](https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/) |
| February 13, 2019 | NASA declares Opportunity's mission complete after more than 835 to 1,000 recovery commands | [Astronomy](https://www.astronomy.com/space-exploration/nasa-declares-mission-complete-for-opportunity-rover/) |

**Our analysis:** In 10 days, power fell from 645 Wh to 22 Wh, a 97% drop. A game dust storm should be able to do this, but it should also come with warning (orbital weather reports, rising tau over days) so the player can respond.

### Dust devils and cleaning events

Dust settles on solar panels steadily, but wind gusts and dust devils sometimes sweep it off. On Spirit around sol 420 (March 2005), power jumped about 50% in one day; the team said solar power went from 40% reduced to only 7% reduced, likely from a passing dust devil ([Spaceflight Now](https://spaceflightnow.com/mars/mera/050314dustdevil.html); [Planetary Society](https://www.planetary.org/articles/03-25-mer-update)). Opportunity had a similar cleaning a few months earlier ([Spaceflight Now](https://spaceflightnow.com/mars/mera/050314dustdevil.html)). Cleaning events are random and cannot be planned, which is why missions like InSight and Zhurong, which did not get them often enough, ran out of power.

### Terrain: sand, rocks, slopes

| Terrain type | Risk | Real example | Source |
| --- | --- | --- | --- |
| Loose sand under a crust | Wheels break through and dig in | Spirit stuck at "Troy" from April 2009 | [Space.com](https://www.space.com/7590-attempt-free-mars-rover-snagged-wheel-stall.html) |
| Wind-sculpted rocks (ventifacts) fixed in the ground | Puncture thin aluminum wheels | Curiosity wheel holes from late 2013 | [Space.com](https://www.space.com/26643-mars-rover-curiosity-wheel-damage.html); [Universe Today](https://www.universetoday.com/articles/holy-wheels-sharp-rocks-force-nasas-curiosity-rover-to-seek-smoother-pathway-to-mount-sharp) |
| Steep, loose slopes | High slip, drives fault out | Perseverance on Summerland Trail at 15° to 20°, above 50% slip limits needed | [Maimone et al. 2026, JPL](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Slopes above 20° | First autonomous climbs of this kind | Perseverance on the Jezero crater rim, 2024 to 2025 | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Boulder fields | Slow progress and longer paths | Snowdrift Peak: 759 m driven vs 520 m straight line | [Universe Today](https://www.universetoday.com/articles/nasas-perseverance-rover-is-setting-records-on-mars) |

### CO₂ frost and planetary protection "special regions"

At higher latitudes, winter nights are cold enough for carbon dioxide and water frost to form on the ground and on hardware. Viking Lander 2 at about 48°N saw seasonal frost *unverified*. For a game, frost is a reasonable winter penalty at mid and high latitudes. Separately, places where liquid water might exist (Mars "special regions") have stricter cleanliness rules; see [../mission-engineering/01-mission-lifecycle.md](../mission-engineering/01-mission-lifecycle.md#planetary-protection).

---

## Moon specifics

### Day, night, and survival

The Moon turns once per 29.53 Earth days relative to the Sun ([NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)), so most sites have about 14 Earth days of light followed by about 14 of darkness. Equatorial temperatures swing from about 95 K to 390 K ([NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)).

| Survival approach | Who used it | How it worked | Source |
| --- | --- | --- | --- |
| Radioisotope heat plus sleep | Lunokhod rovers, Yutu-2 | Sleep through the night with nuclear heat keeping electronics warm *unverified for Yutu-2 heat source* | [Planetary Society Chang'e 4](https://www.planetary.org/space-missions/change-4) |
| Noon nap | Yutu-2 | Power down near local noon to avoid overheating, then resume | [Space.com](https://www.space.com/42921-china-far-side-moon-mission-standby-mode.html) |
| Design for one lunar day only | Pragyan (Chandrayaan-3) | Mission life of one lunar day (14 Earth days); attempted wake-up after night failed | [The Week](https://www.theweek.in/news/sci-tech/2023/09/03/chandrayaan-3-pragyaan-goes-into-sleep-mode-as-isro-hopes-for-a-successful-awakening.html); [Madhyamam](https://english.madhyamam.com/science/chandrayaan-3s-rover-and-lander-remain-in-sleep-mode-no-signals-so-far-1206512) |
| Safe havens with short darkness | VIPER (planned) | Find spots where darkness lasts no more than 50 hours while Earth is below the horizon | [NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |

### Regolith and dust

Lunar dust is a known mission killer. NASA's review of Apollo found nine kinds of dust problems: vision obscuration, false instrument readings, dust coating and contamination, loss of traction, clogging of mechanisms, abrasion, thermal control problems, seal failures, and inhalation and irritation ([Gaier 2005, NASA/TM-2005-213610](https://ntrs.nasa.gov/citations/20050160460)). The report notes that simple fixes helped only with minor problems and that ground tests underestimated how bad the dust would be. On every Apollo mission, environmental, gas, and sample seals were compromised ([Gaier, NASA presentation](https://www.nasa.gov/wp-content/uploads/2019/04/06_2_jgaier_whatdoweneedtoknowv1_pres.pdf)).

The clearest rover lesson is Lunokhod 2. In May 1973, early in its fifth lunar day, the rover's open lid touched a crater wall and picked up soil; when the lid closed, the dust fell onto the radiator, which then could not shed heat, and the rover overheated and died ([Planetary Society](https://planetary.org/articles/2392); account attributed to Alexander Basilevsky, details vary between sources). It had driven about 39 km ([NASA Perseverance record blog](https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/)).

**Our analysis:** On the Moon dust does not get cleaned off by wind. Any dust that lands on a radiator or panel stays there. In the game, a lunar dust "hit" should be permanent unless the design includes a mitigation.

### The south pole: low Sun, long shadows, ice, and Earth below the horizon

The south pole matters because permanently shadowed craters can trap water ice. Lunar Prospector mapped hydrogen from orbit and LCROSS in 2009 found 4% to 6% water by weight at Cabeus ([NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)). This is why NASA designed VIPER to measure water and other volatiles directly and map where they are.

VIPER's mission planning paper describes the polar problem precisely ([Shirley and Balaban 2022, NTRS](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)):

| VIPER planning fact | Value |
| --- | --- |
| Power | Solar |
| Dark survivability in minimal power mode | 50 hours |
| Working time in shadow with the drill | About 9 hours |
| Communications | Line-of-sight direct-to-Earth radio, teleoperated |
| Earth visibility near the south pole | Earth below the horizon for about half of each lunar day |
| Driving | 20 km goal; 10 cm/s when moving but about 1 cm/s average because it waits about 90% of the time |
| Slope limit | 15° |
| Obstacles | Can negotiate 10 cm |
| Mission duration | 100+ Earth days |
| Site requirements | Volatiles, sunlight, traversable terrain, direct-to-Earth communications (all four required) |
| Working days available by candidate site | Nobile 45, Haworth Lower 20, Haworth Upper 12, De Gerlache 12, Slater 8, Shackleton Ridge 7 |

The paper explains that "sun and radio shadows move at speeds similar to VIPER's average speed," so traverses must be timed to stay in sunlight and in radio view ([NTRS](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)). The very low Sun also makes the terrain hard to see: lit and shadowed areas are so high in contrast that contours disappear in the dark, so VIPER was given LED headlights ([NASA](https://www.nasa.gov/humans-in-space/viper-rover-will-get-driving-headlights/)). At the pole, the Sun never gets more than about 1.5° above the horizon on flat ground *unverified* (it is set by the Moon's small tilt to the ecliptic).

**VIPER status (November 2026):** NASA cancelled VIPER in 2024, then revived it. In 2025 NASA awarded Blue Origin a CLPS task order (reported as $190 million) to deliver VIPER on a Blue Moon MK1 lander, planned for late 2027 ([SatNews](https://satnews.com/2025/12/17/nasa-solidifies-lunar-strategy-with-blue-origin-viper-delivery-task-order/); [AIAA](https://aiaa.org/?p=29588)). A 2026 NASA slide deck lists an August 2027 launch ([NTRS](https://ntrs.nasa.gov/api/citations/20260002876/downloads/viper-2026-04-29_v2.pdf)). Whether the revived mission still targets Nobile is *unverified*.

### Near side, far side, and relays

| Site type | Earth contact | Example |
| --- | --- | --- |
| Near side, low latitude | Earth always above horizon; direct links work continuously during operations | Lunokhod 1 and 2, Chang'e 3 |
| Far side | Earth never visible; needs a relay | Chang'e 4 used Queqiao, in a halo orbit around Earth-Moon L2 about 65,000 to 85,000 km from the Moon ([National Geographic](https://www.nationalgeographic.com/science/article/china-change-4-historic-landing-moon-far-side-explained)) |
| Near south pole | Earth near the horizon; blocked by terrain and below horizon about half the lunar day | Chandrayaan-3 at 69.37°S; VIPER planning ([NTRS](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)) |

---

## Other destinations briefly

| Destination | Status in 2026 | Why rovers are hard there | Source |
| --- | --- | --- | --- |
| Venus | No rover has operated. Venera 13 (1982) survived 127 minutes on the surface against a 32-minute design life. NASA Glenn's LLISSE targets up to 60 days on the surface using high-temperature electronics that need no cooling; HOTTech funds components (electronics, memory, batteries, solar cells, motors). No flight date found. | 464 °C and 92 bar destroy normal electronics and batteries; solar cells get little light | [Guinness World Records](https://www.guinnessworldrecords.com/world-records/78367-longest-time-survived-on-venus-by-a-spacecraft); [NASA NTRS LLISSE](https://ntrs.nasa.gov/api/citations/20190029198/downloads/20190029198.pdf); [NASA NTRS Venus overview](https://ntrs.nasa.gov/api/citations/20230004306/downloads/HiTech%20Venus%20Overview%20v1.pdf) |
| Titan | Dragonfly rotorcraft lander, launch no earlier than July 2028, arrival late 2034, planned 3.3-year mission, flights every 1 to 2 Tsols, several miles per flight. MMRTG gives about 120 W electrical at fueling. | Too dim for solar; cryogenic cold; flying is easier than driving in thick air and low gravity | [NASA Dragonfly](https://science.nasa.gov/mission/dragonfly/); [NASA Dragonfly Final EA](https://www.nasa.gov/wp-content/uploads/2024/01/dragonfly-final-ea-july-2022.pdf?emrc=e26d84) |
| Europa | Concept only. The 2016 Science Definition Team lander concept was battery powered with a 20+ day surface mission and 1.5 Mrad radiation exposure. | Radiation, cold, unknown surface texture, long cruise | [NASA Europa Lander SDT briefing](https://solarsystem.nasa.gov/docs/10_Europa%20Lander%20Study_L.%20Prockter.pdf) |
| Enceladus | Concept only (an orbiter-lander was a top recommendation of the 2022 decadal survey) *unverified* | Extreme distance, cold, plume region | Not researched in depth |
| Phobos | MMX launched on H3 from Tanegashima on October 20, 2026 (JST). The 25 kg CNES/DLR rover IDEFIX will be dropped from about 40 m, right itself, and explore for about 100 days, landing planned in 2029. | Microgravity: driving on a body with less than 1/1000 g; -170 °C to +70 °C | [ESA](https://www.esa.int/ESA_Multimedia/Images/2026/10/MMX_lifts_off_to_Mars_s_moon_Phobos); [Space.com](https://www.space.com/space-exploration/launches-spacecraft/japan-launches-historic-mmx-sample-return-mission-to-mars-moon-phobos); [DLR](https://www.dlr.de/en/latest/news/2026/off-to-the-moons-of-mars-mmx-mission-and-idefix-rover-ready-for-launch) |
| Mercury | Not feasible for a rover with current technology (Our analysis) | 6.7 times Earth's sunlight, 590 to 725 K dayside, 176-day solar day, and a very high landing energy cost | [NSSDCA Mercury](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html) |

---

## Landing site selection

### The central trade

Every site selection balances **science** (is there something worth studying within driving range?) against **engineering safety and sustainability** (can the lander touch down safely and can the rover survive and drive?). The process usually takes years: DLR described Mars 2020's site selection as five years of work ([DLR](https://www.dlr.de/en/latest/news/2020/03/20200929_topography-of-jezero-crater)).

| Factor | Why it matters | Typical constraint (example) | Source |
| --- | --- | --- | --- |
| Latitude | Solar power and temperature | MER 10°N to 15°S; MSL ±30° | [Golombek et al. 2003, USGS](https://www.usgs.gov/publications/selection-mars-exploration-rover-landing-sites); [Golombek et al. 2012](https://authors.library.caltech.edu/35374) |
| Elevation (Mars) | More air above the site means more braking during entry | MER below -1.3 km; MSL below -1 km | [Golombek et al. 2003](https://www.usgs.gov/publications/selection-mars-exploration-rover-landing-sites); [Golombek et al. 2012](https://authors.library.caltech.edu/35374) |
| Landing ellipse size | The whole ellipse must be safe, so a big ellipse rules out rough, interesting places | Viking about 280 x 100 km, MER about 150 x 20 km, Curiosity 20 x 7 km, Perseverance 7.7 x 6.6 km | [Wikipedia list](https://en.wikipedia.org/wiki/List_of_landing_ellipses_on_extraterrestrial_bodies) (older values approximate); [NASA PIA16039](https://www.jpl.nasa.gov/images/pia16039-landing-accuracy-on-mars-a-historical-perspective/); [NASA PIA24349](https://www.jpl.nasa.gov/images/pia24349-zeroing-in-on-the-target/) |
| Slopes | Tip-over at touchdown, radar confusion, drive limits | MER under 5° at 100 m scale *unverified*; MSL under 30° at 2 to 5 m baselines; Chandrayaan-3 lander spec 12° *unverified* | [MER workshop report](https://marsoweb.nas.nasa.gov/landingsites/mer2003/doc/pasadena_02/workshop_report.html); [USGS MSL summary](https://www.usgs.gov/publications/selection-mars-science-laboratory-landing-site) |
| Rock abundance | Rocks can hit the belly pan or block driving | MSL "moderate rock abundance" | [USGS MSL summary](https://www.usgs.gov/publications/selection-mars-science-laboratory-landing-site) |
| Thermal inertia and dust cover | Very dusty, low-thermal-inertia areas may be too soft to drive and too dusty for radar | MER and MSL required radar-reflective, trafficable surfaces | [USGS MSL summary](https://www.usgs.gov/publications/selection-mars-science-laboratory-landing-site) |
| Rover lifetime temperature | Colder sites drain batteries | MER required temperatures above about -97 °C | [MER workshop report](https://marsoweb.nas.nasa.gov/landingsites/mer2003/doc/pasadena_02/workshop_report.html) |
| Traversability to targets | The best rock may be outside the ellipse ("go to" science) | Gale: land on plains, drive to Mount Sharp | [NASA Gale](https://science.nasa.gov/resource/gale-crater-exploring-the-mars-science-laboratory-landing-site) |
| Communications geometry | Line of sight to Earth or relay | VIPER needed direct-to-Earth view; Chang'e 4 needed Queqiao | [NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [National Geographic](https://www.nationalgeographic.com/science/article/china-change-4-historic-landing-moon-far-side-explained) |
| Planetary protection | Special regions need extra cleaning or are off-limits | See mission-engineering file | [../mission-engineering/01](../mission-engineering/01-mission-lifecycle.md#planetary-protection) |

### Case studies of the selection process

| Mission and site | Process | Key criteria and outcome | Source |
| --- | --- | --- | --- |
| MER: Gusev crater (Spirit) and Meridiani Planum (Opportunity), 2004 | Engineering constraints mapped first, then science and safety evaluation; about 155 candidates narrowed to two | Latitude 10°N to 15°S for solar power; elevation below -1.3 km; slopes, rocks, radar reflectivity, temperature | [Golombek et al. 2003 (USGS)](https://www.usgs.gov/publications/selection-mars-exploration-rover-landing-sites); [Spaceflight Now](https://spaceflightnow.com/news/n0304/11mersites/) |
| MSL: Gale crater (Curiosity), 2012 | More than 50 candidate 25 x 20 km ellipses narrowed to four finalists (Eberswalde, Gale, Holden, Mawrth) over multiple open workshops | Latitude ±30° for rover and instrument thermal management; elevation below -1 km; slopes, rock abundance, relief, trafficable surface. Gale won for diversity and habitability potential | [Golombek et al. 2012](https://authors.library.caltech.edu/35374); [USGS](https://www.usgs.gov/publications/selection-mars-science-laboratory-landing-site) |
| Mars 2020: Jezero crater (Perseverance), 2021 | Workshops narrowed to Jezero, NE Syrtis, and Columbia Hills; NASA chose Jezero in November 2018 | For the first time, elevation and latitude constraints did not have a major influence, because Range Trigger and Terrain-Relative Navigation shrank the ellipse to 7.7 x 6.6 km and let the lander avoid hazards. Jezero floor sits about 2,600 m below datum | [Grant et al. 2018 (Caltech)](https://authors.library.caltech.edu/87552); [EPSC 2018](https://meetingorganizer.copernicus.org/EPSC2018/EPSC2018-578.pdf); [NASA PIA24349](https://www.jpl.nasa.gov/images/pia24349-zeroing-in-on-the-target/); [JPL PIA26476](https://www.jpl.nasa.gov/images/pia26476-jezero-crater-elevation-graph/) |
| Tianwen-1: Utopia Planitia (Zhurong), 2021 | Two 150 x 60 km candidate areas chosen pre-launch (southern Utopia primary, western Elysium Mons alternate); final ellipse 56 x 22 km after hazard mapping with orbiter images | Slopes, crater density, cone density, rock abundance; Utopia favored for evidence of an ancient northern ocean. Landed at 25.066°N, 109.925°E, elevation -4,099.4 m | [Wu et al. 2022, JGR Planets](https://ui.adsabs.harvard.edu/abs/2022JGRE..12707137W) |
| Chang'e 4: Von Kármán crater, lunar far side, 2019 | Target within the South Pole-Aitken basin; site not formally announced until landing day | Von Kármán (186 km) surrounded by mountains up to 10 km high; usable landing area only one-eighth of Chang'e 3's; near-vertical descent; relay via Queqiao | [National Geographic](https://www.nationalgeographic.com/science/article/china-change-4-historic-landing-moon-far-side-explained) |
| Chandrayaan-3: near south pole, 69.37°S, 2023 | Moving-window search for hazard-free 4 x 2.4 km areas between 60°S and 70°S on the near side; 20 candidates, 8 characterized with Chandrayaan-2's high-resolution camera | Topography, slope, illumination, hazard avoidance; primary site had slopes under 4° over about 78% of the area; landed about 350 m from target | [Swarajya](https://swarajyamag.com/science/explained-what-went-into-finding-the-best-spot-for-chandrayan-3-landing-on-the-moon); [arXiv 2308.10712](https://arxiv.org/pdf/2308.10712); [Current Science](https://i-scholar.in/index.php/CURS/article/download/224034/207446) |
| VIPER: west of Nobile crater, lunar south pole (selected 2023) | Lighting and Earth-visibility computed for every 20 m pixel over six months; candidates scored by working days available | Volatiles, sunlight, traversable terrain, direct-to-Earth comms. Nobile gave 45 working days, about 93 km² of study area, 16 to 24 km of planned driving, at least six science sites | [NTRS](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [NASA](https://www.nasa.gov/news-release/nasas-artemis-rover-to-land-near-nobile-region-of-moons-south-pole) |

**Our analysis:** The history shows a clear trend. Better landing precision (smaller ellipses, terrain-relative navigation) has steadily moved site selection away from "where is it safe to land?" toward "where is the science, and can we drive to it?" That is a good progression for a game: early-tech landers force bland, safe sites; better precision unlocks riskier, richer sites.

---

## Surface operations

### How a Mars rover day works

Rovers on Mars are not driven with a joystick. The team sends a full plan for one or more sols, the rover executes it on its own, and the results come back through relay orbiters. The daily process is called **tactical** planning and was patterned on MER operations ([MSL science operations page](https://webarchive.library.unt.edu/web/20130214172824/http://msl-scicorner.jpl.nasa.gov/scienceoperations)). **Strategic** planning looks weeks to months ahead (routes, campaigns, sampling plans) ([Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf)).

| Step | What happens | Source |
| --- | --- | --- |
| 1. Downlink arrives | Data from the previous sol arrives via an orbiter pass, often in the Mars night (for example, an MRO pass around 2 a.m. local Mars time carries the decisional data) | [NASA Curiosity blog](https://science.nasa.gov/blog/msl-update-2077/) *exact page unverified* |
| 2. Assess | Engineers check rover health, position, and images; scientists decide targets | [MSL science planning](https://webarchive.library.unt.edu/web/20130215012759/http://msl-scicorner.jpl.nasa.gov/scienceplanning) |
| 3. Plan | Science team (led by a chair of the Science Operations Working Group) and engineers build the activity plan; rover planners write drive and arm sequences | [MSL science operations](https://webarchive.library.unt.edu/web/20130214172824/http://msl-scicorner.jpl.nasa.gov/scienceoperations) |
| 4. Review and uplink | Products are verified and sent in the Mars morning communication window; if planning runs late, the team must wait for the next Mars morning | [MSL science operations](https://webarchive.library.unt.edu/web/20130214172824/http://msl-scicorner.jpl.nasa.gov/scienceoperations) |
| 5. Execute | Rover runs the plan on its own: morning science block, drive or arm work, imaging, relay passes | [NASA Curiosity blog, sols 5056 to 5062](https://science.nasa.gov/blog/curiosity-blog-sols-5056-5062-charging-back-up/) |
| 6. Sleep and recharge | Rover naps to recharge batteries; ends early if it finishes early | [JPL](https://www.jpl.nasa.gov/news/marking-13-years-on-mars-nasas-curiosity-picks-up-new-skills/) |

### A typical sol plan (Curiosity-style, simplified)

| Local Mars time (approximate) | Activity | Notes |
| --- | --- | --- |
| Morning | Wake, receive uplink, heaters warm motors | Perseverance waits until motors are warm enough before driving ([Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf)) |
| Late morning | Morning science block: remote sensing (ChemCam, Mastcam), atmospheric tau measurements | Standard block each sol ([NASA blog](https://science.nasa.gov/blog/curiosity-blog-sols-5056-5062-charging-back-up/)) |
| Midday | Contact science (arm) or drive | Driving toward the Sun stops by mid-afternoon because of camera glare ([NASA Perseverance blog](https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/)) |
| Afternoon | Post-drive imaging so planners can see where the rover ended | Needed for the next plan |
| Afternoon pass | Relay to an orbiter | Can now overlap with driving or arm work to save energy ([JPL](https://www.jpl.nasa.gov/news/marking-13-years-on-mars-nasas-curiosity-picks-up-new-skills/)) |
| Evening / twilight | Twilight imaging, dust devil watches | [NASA blog](https://science.nasa.gov/blog/curiosity-blog-sols-5056-5062-charging-back-up/) |
| Night | Sleep; optional overnight relay pass | Battery recharges from the MMRTG |

### Mars time, restricted sols, and solidays

| Concept | What it is | Source |
| --- | --- | --- |
| Mars time | Early in a mission the team lives on the Mars clock, so each workday starts about 40 minutes later than the day before; used by Pathfinder, MER, Phoenix, MSL | [NBC News](https://www.nbcnews.com/id/wbna3881401); [Smithsonian](https://www.smithsonianmag.com/smithsonian-institution/think-mountain-times-confusing-try-living-martian-time-180967799/) |
| Duration of Mars time | MER: about the 90-sol prime mission. Curiosity's team switched back to Earth time in November 2012, about three months after landing | [Smithsonian](https://www.smithsonianmag.com/smithsonian-institution/think-mountain-times-confusing-try-living-martian-time-180967799/); [Space.com](https://space.com/18381-curiosity-mission-control-mars-time.html) |
| Restricted sols | When Earth office hours and Mars data timing do not line up, fresh data arrives too late to plan with, so the team plans with older data and lower-risk activities | [MSL science operations](https://webarchive.library.unt.edu/web/20130214172824/http://msl-scicorner.jpl.nasa.gov/scienceoperations); [USGS Curiosity blog](https://www.usgs.gov/centers/astrogeology-science-center/news/curiosity-blog-sols-3853-3856-time-try-a-new-route) |
| Soliday | Every ~38 Earth days the team skips one sol of planning so Earth and Mars schedules re-sync; then a week or two of "unrestricted" planning follows | [NASA Curiosity blog](https://science.nasa.gov/blog/sols-4039-4040-a-soliday-before-the-holidays) |
| Multi-sol plans | Weekends and holidays get 2 to 4 sol plans (for example, a 3-sol plan built on Oct. 30, 2026) | [NASA blog](https://science.nasa.gov/blog/curiosity-blog-sols-5056-5062-charging-back-up/) |
| Runout plan | If a plan cannot be built or an anomaly occurs, the rover runs a safe fallback ("runout") plan | [USGS Curiosity blog](https://www.usgs.gov/centers/astrogeology-science-center/news/curiosity-blog-sols-3853-3856-time-try-a-new-route) |
| Tactical timeline | Mars time and extra staffing let the timeline stretch from 8 hours to 12 to 16 hours in two shifts; later it was compressed from more than 16 hours to 12 | [MSL science operations](https://webarchive.library.unt.edu/web/20130214172824/http://msl-scicorner.jpl.nasa.gov/scienceoperations); [Space.com](https://space.com/18381-curiosity-mission-control-mars-time.html) |

### Data and energy budgets per sol

| Budget | Value | Source |
| --- | --- | --- |
| Curiosity design relay minimum | About 250 megabits per sol using two UHF passes | [MSL team Q&A](https://lr.eu.psf.lt/r/IAmA/comments/ybmmh/we_are_engineers_and_scientists_on_the_mars/c5u2y5p) *unverified (team Q&A, secondary host)* |
| Curiosity historical average | About 500 megabits per sol via MRO and Odyssey | [NASA Curiosity blog "Lots of bits"](https://science.nasa.gov/blog/sols-2159-2162-lots-of-bits/) |
| Rover-to-orbiter link rate | Up to 2 Mbps | [NASA Mars Relay Network](https://science.nasa.gov/mars/mars-relay-network-update/) |
| Opportunity daily energy (healthy, dusty year) | About 645 Wh on June 1, 2018 | [Planetary Society](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep) |
| Opportunity survival threshold | 22 Wh was "almost 100 Wh below" the level needed for survival, so roughly 120 Wh | [Planetary Society](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep) |
| Spirit after a cleaning event | Daily supply doubled to more than 800 Wh | [Planetary Society](https://www.planetary.org/articles/03-25-mer-update) |
| Curiosity MMRTG output | About 110 W when fueled; 114 W at landing; projected 54 W at 17 years after fueling | [Planetary Society excerpt](https://www.planetary.org/articles/0514-book-excerpt-curiosity-mmrtg) |
| Curiosity loads | 45 to 70 W asleep; at least 150 W awake; up to 500 W driving (batteries cover peaks) | [Planetary Society excerpt](https://www.planetary.org/articles/0514-book-excerpt-curiosity-mmrtg) *loads single-sourced* |

The key point for simulation is that a radioisotope rover is limited by **energy per sol** (the generator trickle-charges batteries), while a solar rover is limited by **sunlight per sol** that changes with season, dust, and tilt. Detailed sizing is in [02-rover-subsystems.md](02-rover-subsystems.md).

### Driving: distances and records

| Record or figure | Value | Source |
| --- | --- | --- |
| Opportunity single-sol record (held about 17 years) | 220 m on sol 410 (March 20, 2005); a 2026 JPL paper gives 219 m | [JPL](https://www.jpl.nasa.gov/news/mars-rovers-break-driving-records-examine-salty-soil/); [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Perseverance single-sol record | 347.7 m on sol 753 (April 2, 2023), then 411.7 m on sol 1540 (June 19, 2025); exceeded Opportunity's record on 37 sols by August 2025 | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Longest Perseverance drive without human review | 699.9 m | [Universe Today](https://www.universetoday.com/articles/nasas-perseverance-rover-is-setting-records-on-mars) |
| Perseverance share driven autonomously | More than 90% (Opportunity and Spirit about 5%) | [NASA blog](https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/) |
| Off-world distance record | Perseverance 45.22 km on Oct. 11, 2026 (sol 2,006), passing Opportunity's 45.16 km; Curiosity over 38.07 km; Lunokhod 2 about 39 km | [NASA blog](https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/) |
| Original Perseverance driving plan | No more than about 20 km (12.4 miles) | [NASA blog](https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/) |
| Lunar examples | Pragyan about 101 to 103 m in one lunar day; Yutu-2 1,613 m by September 2024 | [The Week](https://www.theweek.in/news/sci-tech/2023/09/02/chandrayaan-3-isro-shares-map-of-pragyans-100-metre-route-on-lunar-surface.html); [Wikipedia Yutu-2](https://en.wikipedia.org/wiki/Yutu-2) *unverified* |

**Our analysis:** Average Mars drive distance is far below the records because most sols are spent on science, recharging, or waiting. Perseverance covered 45 km in about 2,006 sols, an average of about 22 m per sol including non-driving sols.

### Solar conjunction

About every 26 months Mars passes behind the Sun as seen from Earth (synodic period 779.94 days, [NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)). Hot ionized gas from the solar corona can corrupt radio signals, so teams stop sending commands for about two weeks and the rovers run pre-loaded, low-risk plans ([AccuWeather / NASA](https://www.accuweather.com/en/space-news/sun-temporarily-halts-communications-between-nasa-and-mars-missions/1596259)).

| Conjunction | Command moratorium | Source |
| --- | --- | --- |
| 2023 | November 11 to 25, 2023 | [TweakTown](https://www.tweaktown.com/news/94376/nasa-has-stopped-sending-commands-to-its-mars-rover-and-helicopter/index.html) |
| 2025 to 2026 | Reported as about December 29, 2025 to January 9, 2026 *unverified* | [Telangana Today](https://telanganatoday.com/mars-solar-conjunction-nasa-rovers-orbiters-continue-science-operations) |
| Next | Around early 2028 (Our analysis: previous + 780 days) | [NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |

### Lunar operations

| Mission | Operating rhythm | Source |
| --- | --- | --- |
| Yutu-2 (Chang'e 4, far side, landed January 3, 2019) | Works during the lunar day with a noon nap, sleeps through each lunar night; relay through Queqiao. By the 23rd lunar day (October 2020) it had become the longest-working lunar rover | [Space.com](https://www.space.com/42921-china-far-side-moon-mission-standby-mode.html); [China Daily HK](https://chinadailyhk.com/article/147320) |
| Yutu-2 status 2026 | LRO images suggested it stopped moving around March 2024; one encyclopedia source reports small movements by September 2025; no official CNSA status found | [Planetary Society](https://www.planetary.org/space-missions/change-4); [Wikipedia](https://en.wikipedia.org/wiki/Yutu-2) *unverified* |
| Pragyan (Chandrayaan-3, landed August 23, 2023) | One lunar day; traversed about 100 m; parked and put to sleep on September 2, 2023 with payloads off; no signal after sunrise | [Al Jazeera](https://www.aljazeera.com/news/2023/9/4/indias-moon-rover-completes-walk-put-into-sleep-mode); [Madhyamam](https://english.madhyamam.com/science/chandrayaan-3s-rover-and-lander-remain-in-sleep-mode-no-signals-so-far-1206512) |
| VIPER (planned) | Teleoperated in near real time; drives during Earth-view and Sun windows; hibernates when Earth is down | [NTRS](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |

### Team size and cost

| Item | Value | Source |
| --- | --- | --- |
| Perseverance Robotic Operations team | Up to 60 engineers controlling mobility, arm, sampling, and mechanisms | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Staff loss in 2025 | 25 members left (53.2% of the RO team) from attrition, layoffs, and budget cuts; only 40% replaced because of FY26 budget cuts | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Natural disaster | Eaton fire, January 2025: JPL closed and Perseverance operations suspended for 12 days; 17.6% of the RO team still displaced when operations resumed | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Curiosity operations cost | About $60 million per year (2014); $51.1 million in 2019; FY2021 request $40 million | [Spaceflight Now](https://www.spaceflightnow.com/news/n1403/18seniorreview/); [SpaceNews](https://spacenews.com/?p=99518) |
| Comparison | A simpler orbiter like LRO about $9 million per year | [Planetary Society](https://www.planetary.org/articles/0415-nasas-burden-of-success-and-the-future-of-opportunity) |

**Our analysis:** Operations is an ongoing cost that grows with complexity, not a one-time cost. A rover that needs many people every sol is expensive to keep alive, which is one reason autonomy (AutoNav, onboard scheduling) matters.

---

## Sustainability strategies from real missions

| Strategy | Mission | What was done | Result | Source |
| --- | --- | --- | --- | --- |
| Winter parking on north-facing slopes | Spirit (2006) | Diverted to "Low Ridge Haven" with an 11° northward tilt | Survived its first hard winter | [Astronomy](https://www.astronomy.com/space-exploration/will-winter-kill-the-mars-rovers/) |
| Steeper winter tilt | Spirit (2007 to 2008) | Parked on the north edge of Home Plate, arrays tilted 29.9°, about the maximum while still using the arm | Survived a second dusty winter | [Planetary Society](https://www.planetary.org/articles/02-29-mer-update); [PIA10129](https://photojournal.jpl.nasa.gov/catalog/PIA10129) |
| Winter workplace | Opportunity (2012) | Parked at "Greeley Haven" on Cape York with about 15° north tilt; did science in place | Left on May 8, 2012 after its fifth winter | [JPL PIA15119](https://www.jpl.nasa.gov/images/pia15119-greeley-haven-site-for-opportunitys-fifth-martian-winter/); [Planetary Society](https://www.planetary.org/articles/03-mer-update) |
| Drive backward, drag a dead wheel | Spirit (from 2006) | Right front wheel failed (actuator failed on sol 779); team drove backward dragging it | Kept exploring for three more years | [Space.com](https://www.space.com/7590-attempt-free-mars-rover-snagged-wheel-stall.html); [NTRS](https://ntrs.nasa.gov/citations/20160001767) |
| Become a stationary platform | Spirit (2010) | After failing to escape Troy, declared a stationary science platform in January 2010 | Last contact March 22, 2010; mission ended May 25, 2011 | [JPL](https://jpl.nasa.gov/news/nasas-spirit-rover-completes-mission-on-mars) |
| Work around bad flash memory ("amnesia") | Opportunity (2014 to 2015) | Reformatted flash; ran from volatile RAM only (data lost overnight); later masked off faulty bank 7 | Kept operating; flash use partly restored later | [JPL](https://www.jpl.nasa.gov/news/nasa-reformats-memory-of-longest-running-mars-rover/); [JPL](https://www.jpl.nasa.gov/news/rover-amnesia-event-follows-latest-memory-reformatting/); [Planetary Society](https://www.planetary.org/articles/02-mer-update-opportunity-discovers-new-rock-type) |
| Traction control software | Curiosity (2017) | Algorithm estimates wheel-terrain contact and adjusts wheel speeds; leading wheel load cut 20%, middle 11%; approved June 2017 | On by default since | [JPL](https://www.jpl.nasa.gov/news/an-algorithm-helps-protect-mars-curiositys-wheels/); [JPL Robotics, IEEE 2018](https://www-robotics.jpl.nasa.gov/media/documents/2018-ieee-aerospace-trctl.pdf) |
| Route planning to protect wheels | Curiosity (from 2014) | Shorter drives in bad terrain, routes through sand valleys, regular wheel imaging | 2017 study predicted 10+ km more wheel life with careful planning | [JPL](https://www.jpl.nasa.gov/news/curiosity-mars-rover-checking-possible-smoother-route/); [CS Monitor](https://www.csmonitor.com/Science/2017/0324/What-can-NASA-do-to-save-Curiosity-s-wheels) |
| New drilling technique | Curiosity (2018) | Drill feed fault (December 2016) fixed by "feed extended drilling," pushing the bit past the stabilizers using the arm | First sample since October 2016 at "Duluth," May 20, 2018; lost use of the CHIMRA sieve | [NASA PIA22326](https://www.jpl.nasa.gov/images/pia22326-curiosity-successfully-drills-duluth/); [Discover](https://www.discovermagazine.com/the-sciences/nasa-hacked-a-fix-for-mars-rovers-broken-drill) |
| Power-saving operations | Curiosity (2021 to 2026) | Run 2 or 3 activities at once (drive while relaying), sleep early when finished, cut idle time between drive segments, schedule power-hungry work in warm seasons, light "recharge" plans before drilling | Kept productivity high as MMRTG output declines; 47th drill hole in 2026 | [JPL](https://www.jpl.nasa.gov/news/marking-13-years-on-mars-nasas-curiosity-picks-up-new-skills/); [NASA blog](https://science.nasa.gov/blog/curiosity-blog-sols-5056-5062-charging-back-up/) |
| Sample depot as insurance | Perseverance (2022 to 2023) | Dropped 10 duplicate tubes at "Three Forks," 5 to 15 m apart, finishing January 29, 2023 | A backup cache if the rover fails | [Spaceflight Now](https://spaceflightnow.com/2023/02/14/mars-rover-completes-first-sample-storage-depot/); [ESA](https://www.esa.int/ESA_Multimedia/Images/2023/01/First_martian_sample_depot_complete) |
| Sample dump capability | Perseverance (2025) | With 8 tubes left, added ability to dump a core and reuse the tube if a better target appears | Released May 2, 2025 | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Slip tables and cross-slope driving | Perseverance (2024 to 2025) | Allowed autonomous driving above 50% slip; drove backward and cross-slope on loose hills | Climbed the Jezero rim | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Planned dormancy | Zhurong (2022) | Entered dormancy May 2022 for winter, planned wake December 2022; wake needed cabin above -15 °C and at least 140 W | Never woke; chief designer blamed dust; above 40% dust coverage it would never wake. It had worked 358 days and driven 1,921 m | [Live Science](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up); [Universe Today](https://www.universetoday.com/articles/china-finally-tells-us-whats-going-on-with-its-mars-rover) |
| Wind-assisted panel cleaning | InSight (lander, 2021) | Arm scoop trickled sand next to a panel so wind-blown grains knocked dust off; shaking panels with motors had failed | Gained about 30 Wh per sol; mission still ended from dust in December 2022 *end date unverified here* | [JPL](https://www.jpl.nasa.gov/news/nasas-insight-mars-lander-gets-a-power-boost) |
| Winter survival with brownouts | Ingenuity (2022 to 2023) | Could not power heaters all night in winter, so its computer froze and reset each night; team redesigned winter operations | Flew 72 flights; ended January 2024 after rotor blade damage | [JPL](https://www.jpl.nasa.gov/news/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/) |
| Sleep through storms | Opportunity (2018) | Low-power fault mode: everything off except a clock that wakes the computer to check battery | Did not recover after the 2018 global storm | [JPL](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/) |

### How missions end

| Ending type | Example | Source |
| --- | --- | --- |
| Power loss from dust storm | Opportunity: silent June 10, 2018; mission complete February 13, 2019, after 15 years against a 90-day design | [Astronomy](https://www.astronomy.com/space-exploration/nasa-declares-mission-complete-for-opportunity-rover/) |
| Stuck plus winter | Spirit: trapped in sand, could not tilt for winter, froze | [JPL](https://jpl.nasa.gov/news/nasas-spirit-rover-completes-mission-on-mars) |
| Dust on panels during dormancy | Zhurong | [Live Science](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up) |
| Overheating from dust on radiator | Lunokhod 2 | [Planetary Society](https://planetary.org/articles/2392) |
| Failure to survive lunar night | Pragyan (by design, one day) | [Madhyamam](https://english.madhyamam.com/science/chandrayaan-3s-rover-and-lander-remain-in-sleep-mode-no-signals-so-far-1206512) |
| Mechanical damage | Ingenuity rotor blades | [JPL](https://www.jpl.nasa.gov/news/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/) |
| Budget | Extended missions must win NASA senior reviews; budgets have been cut | [Planetary Society](https://www.planetary.org/articles/0903-planetary-missions-survive-senior-review); [SpaceNews](https://spacenews.com/?p=99518) |

**Active as of November 2026:** Curiosity is operating past sol 5,060 ([NASA raw image page, sol 5062](https://science.nasa.gov/mission/msl-curiosity/science-updates/)); Perseverance holds the off-world distance record and is in its first extended mission, which runs to about the end of 2028 ([NASA blog](https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/)). Yutu-2 status is unclear (see above).

---

## Hazard and anomaly catalog

| Hazard | Real example | What happened | Response | Source |
| --- | --- | --- | --- | --- |
| Sand trap / embedding | Spirit at Troy, 2009 | Wheels broke through a crust into loose sand and sank deeper with each try | Months of extraction attempts; then stationary platform | [Space.com](https://www.space.com/7590-attempt-free-mars-rover-snagged-wheel-stall.html); [JPL](https://jpl.nasa.gov/news/nasas-spirit-rover-completes-mission-on-mars) |
| Wheel actuator failure | Spirit right front wheel, 2006; right rear stall, November 2009 | Motor stopped | Drive backward dragging the wheel | [Space.com](https://www.space.com/7590-attempt-free-mars-rover-snagged-wheel-stall.html); [NTRS](https://ntrs.nasa.gov/citations/20160001767) |
| Wheel punctures | Curiosity from 2013 | Fixed sharp rocks; rear wheels pushed front wheels into rocks | Traction control, route planning, wheel imaging | [Space.com](https://www.space.com/26643-mars-rover-curiosity-wheel-damage.html); [JPL](https://www.jpl.nasa.gov/news/an-algorithm-helps-protect-mars-curiositys-wheels/) |
| Steering motor faults | Perseverance after Summerland Trail | High current faults from a software parameter change | Flight parameter fix | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| High slip on slopes | Perseverance, Jezero rim | Drives faulted out on loose 15° to 20° hill | Slip tables, alternate routes, backward driving | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Drill mechanism fault | Curiosity, December 2016 | Drill feed problem | Feed extended drilling (2018) | [NASA PIA22326](https://www.jpl.nasa.gov/images/pia22326-curiosity-successfully-drills-duluth/) |
| Debris in sampling system | Perseverance, December 29, 2021 (sol 306) | Pebbles from the cored rock blocked the bit from seating in the carousel | Waited, imaged, ran percussion and carousel rotation tests in January 2022; two pebbles ejected, remaining ones judged harmless | [NASA](https://science.nasa.gov/missions/mars-2020-perseverance/assessing-perseverances-seventh-sample-collection/); [JPL PIA25067](https://www.jpl.nasa.gov/images/pia25067-perseverances-bit-carousel/) |
| Flash memory faults | Opportunity, 2014 to 2015 | Amnesia events, resets | RAM-only mode, masking a bad bank | [JPL](https://www.jpl.nasa.gov/news/opportunity-working-in-no-flash-mode-for-now/) |
| Computer resets from cold | Ingenuity, winter 2022 | Heaters off overnight, computer froze and reset | Redesigned winter operations | [JPL](https://www.jpl.nasa.gov/news/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/) |
| Safe mode in dust storm | InSight, January 2022 | Low power from regional storm | Waited for skies to clear | [JPL](https://www.jpl.nasa.gov/news/nasas-insight-enters-safe-mode-during-regional-mars-dust-storm/) |
| Global dust storm | Opportunity, 2018 | Power fell 645 Wh to 22 Wh in about 10 days | Low-power fault mode; never recovered | [Planetary Society](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep) |
| Dust accumulation | Zhurong; InSight | Panels too dusty to restart or sustain | Cleaning tricks (InSight); none possible on Zhurong | [Live Science](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up); [JPL](https://www.jpl.nasa.gov/news/nasas-insight-mars-lander-gets-a-power-boost) |
| Dust on radiator | Lunokhod 2, 1973 | Overheating | None | [Planetary Society](https://planetary.org/articles/2392) |
| Extreme cold | Spirit, 2010 winter | No energy for heaters; coldest internal temperatures of the mission | Lost | [JPL](https://jpl.nasa.gov/news/nasas-spirit-rover-completes-mission-on-mars) |
| Declining power source | Curiosity MMRTG | Output roughly halves over 17 years | Multitasking, early naps, recharge sols | [Planetary Society excerpt](https://www.planetary.org/articles/0514-book-excerpt-curiosity-mmrtg); [JPL](https://www.jpl.nasa.gov/news/marking-13-years-on-mars-nasas-curiosity-picks-up-new-skills/) |
| Comms blackout: conjunction | All Mars missions, every ~26 months | No commands for about 2 weeks | Pre-planned safe activities | [AccuWeather](https://www.accuweather.com/en/space-news/sun-temporarily-halts-communications-between-nasa-and-mars-missions/1596259) |
| Comms blackout: Earth below horizon | Lunar south pole | No direct link half of each lunar day | Hibernate in safe havens | [NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf) |
| Ground team disruption | Perseverance, January 2025 | Wildfire closed JPL; 12 days without operations | Rover waited safely | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Sun glare | Perseverance | Cameras blinded driving toward the Sun in late afternoon | Park by mid-afternoon; plan drive direction | [NASA blog](https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/) |
| Radiation single-event upsets | General hazard for rover electronics | Bit flips can cause resets | Error-correcting memory, radiation-hardened processors (see 02 file) | No specific surface case researched; treat as *unverified* example |

---

## Key numbers for the game

| Parameter | Moon | Mars | Source |
| --- | --- | --- | --- |
| Gravity | 1.62 m/s² | 3.73 m/s² | NSSDCA [Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html), [Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Solar day | 29.53 Earth days | 24 h 39 m 35 s | NSSDCA |
| Year / seasons | No real seasons | 687 Earth days; obliquity 25.19° | NSSDCA |
| Sunlight at top of atmosphere | 1,361 W/m² | 586 W/m² mean (490 to 713) | NSSDCA; Our analysis |
| Temperature (equator) | 95 K to 390 K | about -70 °C to 0 °C air at Gale | NSSDCA; [NASA PIA16913](https://www.jpl.nasa.gov/images/pia16913-steady-temperatures-at-mars-gale-crater/) |
| PSR temperature | about 33 to 38 K | n/a | [Diviner](https://www.eurekalert.org/news-releases/648084) |
| Pressure | vacuum | 6.36 mbar (4.0 to 8.7) | NSSDCA |
| Radiation | 1.37 mSv/day | 0.67 mSv/day | [Chang'e 4 LND](https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html); [Curiosity RAD](https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars) |
| One-way light-time | 1.3 s | 3 to 22 min | Our analysis |
| Comms gaps | Far side always; pole about half of each lunar day | Conjunction about 2 weeks every ~26 months | [NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Data per sol (Mars relay) | n/a | 250 Mbit minimum design, about 500 Mbit average (Curiosity) | [NASA blog](https://science.nasa.gov/blog/sols-2159-2162-lots-of-bits/) |
| Solar rover energy (MER) | n/a | about 645 Wh/sol healthy; about 120 Wh/sol survival; 22 Wh at tau 10.8 | [Planetary Society](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep) |
| Dust cleaning event | none (no wind) | up to about +50% power in one sol | [Spaceflight Now](https://spaceflightnow.com/mars/mera/050314dustdevil.html) |
| MMRTG decline | n/a | 114 W at landing to about 54 W at 17 years | [Planetary Society](https://www.planetary.org/articles/0514-book-excerpt-curiosity-mmrtg) |
| Max single-sol drive | about 100 m in a whole mission for Pragyan | 411.7 m (record); about 22 m average per sol for Perseverance | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf); Our analysis |
| Slope limit (example) | VIPER 15° | Perseverance climbed above 20° | [NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Dark survival (example) | VIPER 50 h | Zhurong needed above -15 °C and 140 W to wake | [NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf); [Live Science](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up) |
| Landing ellipse | Chandrayaan-3 4 x 2.4 km | Viking about 280 x 100 km; Perseverance 7.7 x 6.6 km | See [Landing site selection](#landing-site-selection) |
| Ops team | n/a | up to 60 engineers in Perseverance robotic ops alone | [Maimone et al. 2026](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf) |
| Ops cost | n/a | about $40 to $60 million per year (Curiosity) | [Spaceflight Now](https://www.spaceflightnow.com/news/n1403/18seniorreview/); [SpaceNews](https://spacenews.com/?p=99518) |
| Design life vs actual | Pragyan 1 lunar day (as designed) | MER 90 sols vs Opportunity 15 years | [Astronomy](https://www.astronomy.com/space-exploration/nasa-declares-mission-complete-for-opportunity-rover/) |

---

## Game implications

Everything in this section is **our analysis**: suggestions for turning the environment and operations facts above into mechanics for a "design a rover, then keep it alive" game. The numbers are drawn from the tables above and can be simplified freely.

### 1. Landing-site choice as the first big decision

- Offer 3 to 5 candidate sites per mission, each with a card showing latitude, elevation (for Mars), ellipse risk, slope and rock hazard, dust level, distance to the science target, and comms quality.
- Tie the site menu to the lander's precision. An old-style lander (large ellipse) only allows flat, boring sites; a "terrain-relative navigation" lander unlocks sites next to cliffs and deltas, mirroring the Viking to Perseverance progression.
- Make latitude matter through the winter sunlight table: a 25°S site gets about one-third of its summer sunlight in winter, while an equatorial site keeps about two-thirds.
- On the Moon, show the trade explicitly: equatorial (easy power and comms, two-week night), far side (needs a relay, unique science), south pole (water ice, but low Sun, moving shadows, Earth below the horizon half the time).

### 2. The sol loop

- One turn equals one sol on Mars, or a few Earth hours of a lunar day on the Moon.
- Each sol the player gets an energy budget (from solar or RTG), a data budget (relay passes), and a short list of activity cards: drive, image, contact science, drill, relay, heat, sleep.
- Light-time and planning delay: on Mars the player plans the next sol in advance and the rover executes alone; results arrive next turn. On the Moon the player can steer more directly, but the lunar night forces a long sleep.
- Add "restricted sols" as a periodic modifier: on those turns, the player must plan without the latest data, so risky activities (long drives, drilling) carry a higher failure chance. A "soliday" every few weeks resets the schedule.
- Add a "runout plan" fallback that the rover executes automatically if the player skips a turn or a fault occurs.

### 3. Seasons and weather

- Run a Mars year of about 669 sols divided into 12 "months" by Ls, with the dust-storm season centered on perihelion (Ls 180° to 330°).
- Dust storms escalate over several sols: local, then regional, possibly global. Provide an orbital weather forecast that warns of rising tau a few sols ahead, so the player can prepare (charge batteries, park, cut activity).
- Use the Opportunity curve as the worst case: a global storm can drop solar energy by more than 95% within about 10 sols.
- Dust slowly accumulates on panels each sol; random cleaning events can restore a large share of power. On the Moon, dust is permanent.
- Winter: heaters cost more energy, solar input drops, and frost can appear at mid-latitudes.

### 4. Survival actions the player can choose

| Player action | Real basis | Game effect |
| --- | --- | --- |
| Park on a Sun-facing slope | Spirit, Opportunity winter havens | Big boost to winter solar energy; rover cannot drive while parked |
| Hibernate / low-power mode | Opportunity 2018; Zhurong; Yutu-2 nights | Minimal drain; risk of not waking if battery too low or panels too dusty |
| Noon nap (Moon) | Yutu-2 | Avoid overheating penalty at lunar noon |
| Recharge sols | Curiosity 2026 | Light plan to bank energy before a big activity |
| Multitask | Curiosity 2025 | Combine relay with driving to save energy (unlock via a software upgrade) |
| Drive backward / adapt to a broken wheel | Spirit | Keeps rover mobile at reduced speed |
| Avoid sharp-rock terrain | Curiosity | Longer route but slower wheel wear |
| Leave a sample cache | Perseverance | Insurance points if the rover later fails |
| Software patch | Curiosity traction control; Opportunity flash workaround | Spend team time to fix a fault class |

### 5. Faults and anomalies

- Draw fault events from the [Hazard and anomaly catalog](#hazard-and-anomaly-catalog): wheel stall, sand trap, memory fault, debris in the sampler, safe mode, cold reset.
- Each fault offers 2 or 3 recovery options with time and risk costs, modeled on real responses (wait and image, try a new technique, drive backward, declare a stationary platform).
- Some faults should be permanent and change how the rover is played (Curiosity's drill now works differently; Spirit drives backward), which feels more real than full repairs.

### 6. Communications and blackout events

- Solar conjunction every ~26 months on Mars: two weeks with no commands, so the player pre-loads a safe plan.
- Lunar far side requires a relay; lunar south pole has a recurring "Earth set" window.
- Optional: a ground-side disruption event (budget cut, team loss) that reduces planning capacity, based on the real 2025 Perseverance staffing and wildfire impacts.

### 7. Scoring sustainability

- Score both **productivity** (science points per sol, distance, samples) and **longevity** (sols survived beyond the design life).
- Show the real benchmarks at the end: MER design life 90 sols vs Opportunity 15 years; Pragyan 1 lunar day; Yutu-2 more than 5 years. Beating the design life should feel like a major achievement.
- Include an "end of mission" screen that names the cause (dust storm, winter, stuck, dust on radiator, budget), each linked to a real rover that ended the same way.

---

## Sources

**Fact sheets and NASA data**
- [NSSDCA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)
- [NSSDCA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)
- [NSSDCA Venus Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html)
- [NSSDCA Mercury Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html)
- [NASA PIA16913: Steady temperatures at Gale crater](https://www.jpl.nasa.gov/images/pia16913-steady-temperatures-at-mars-gale-crater/)
- [NASA: 10 things to know about the massive dust storm on Mars](https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/)
- [NASA Mars Relay Network update](https://science.nasa.gov/mars/mars-relay-network-update/)

**Radiation**
- [SwRI: first radiation measurements from the surface of Mars (Hassler et al., Science)](https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars)
- [Sci.News: Chang'e 4 lunar surface dose rates (Zhang et al. 2020, Science Advances)](https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html)

**Moon**
- [Shirley and Balaban 2022, An Overview of Mission Planning for the VIPER Rover, NTRS](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)
- [NASA: VIPER to land near Nobile region](https://www.nasa.gov/news-release/nasas-artemis-rover-to-land-near-nobile-region-of-moons-south-pole)
- [NASA: VIPER will get driving headlights](https://www.nasa.gov/humans-in-space/viper-rover-will-get-driving-headlights/)
- [NASA VIPER 2026 slides, NTRS](https://ntrs.nasa.gov/api/citations/20260002876/downloads/viper-2026-04-29_v2.pdf)
- [SatNews: Blue Origin VIPER delivery task order](https://satnews.com/2025/12/17/nasa-solidifies-lunar-strategy-with-blue-origin-viper-delivery-task-order/)
- [AIAA: Blue Origin to land VIPER in 2027](https://aiaa.org/?p=29588)
- [EurekAlert / UCLA: Diviner coldest temperatures](https://www.eurekalert.org/news-releases/648084)
- [Paige et al. 2010, Diviner cold traps (USGS record)](https://pubs.usgs.gov/publication/70036393)
- [Gaier 2005, The Effects of Lunar Dust on EVA Systems During the Apollo Missions, NTRS](https://ntrs.nasa.gov/citations/20050160460)
- [Gaier, NASA presentation on lunar dust](https://www.nasa.gov/wp-content/uploads/2019/04/06_2_jgaier_whatdoweneedtoknowv1_pres.pdf)
- [Planetary Society: Lunokhod 2 located](https://planetary.org/articles/2392)
- [Planetary Society: Chang'e-4 mission page](https://www.planetary.org/space-missions/change-4)
- [National Geographic: Chang'e 4 landing explained](https://www.nationalgeographic.com/science/article/china-change-4-historic-landing-moon-far-side-explained)
- [Space.com: Yutu-2 noon nap](https://www.space.com/42921-china-far-side-moon-mission-standby-mode.html)
- [China Daily HK: lander and rover dormant after 23rd lunar day](https://chinadailyhk.com/article/147320)
- [Wikipedia: Yutu-2 (status, unverified)](https://en.wikipedia.org/wiki/Yutu-2)
- [Swarajya: Chandrayaan-3 site selection](https://swarajyamag.com/science/explained-what-went-into-finding-the-best-spot-for-chandrayan-3-landing-on-the-moon)
- [arXiv 2308.10712: Chandrayaan-3 alternate landing site](https://arxiv.org/pdf/2308.10712)
- [Current Science: Chandrayaan-3 landing site](https://i-scholar.in/index.php/CURS/article/download/224034/207446)
- [Al Jazeera: Pragyan put in sleep mode](https://www.aljazeera.com/news/2023/9/4/indias-moon-rover-completes-walk-put-into-sleep-mode)
- [The Week: Pragyan sleep mode](https://www.theweek.in/news/sci-tech/2023/09/03/chandrayaan-3-pragyaan-goes-into-sleep-mode-as-isro-hopes-for-a-successful-awakening.html)
- [The Week: Pragyan 100 m route](https://www.theweek.in/news/sci-tech/2023/09/02/chandrayaan-3-isro-shares-map-of-pragyans-100-metre-route-on-lunar-surface.html)
- [Madhyamam: no signals after lunar night](https://english.madhyamam.com/science/chandrayaan-3s-rover-and-lander-remain-in-sleep-mode-no-signals-so-far-1206512)

**Mars landing sites**
- [Golombek et al. 2003, Selection of the MER landing sites (USGS)](https://www.usgs.gov/publications/selection-mars-exploration-rover-landing-sites)
- [MER landing site workshop report](https://marsoweb.nas.nasa.gov/landingsites/mer2003/doc/pasadena_02/workshop_report.html)
- [Spaceflight Now: MER landing sites selected](https://spaceflightnow.com/news/n0304/11mersites/)
- [Golombek et al. 2012, Selection of the MSL landing site (Caltech)](https://authors.library.caltech.edu/35374)
- [USGS: Selection of the MSL landing site](https://www.usgs.gov/publications/selection-mars-science-laboratory-landing-site)
- [NASA: Gale crater landing site](https://science.nasa.gov/resource/gale-crater-exploring-the-mars-science-laboratory-landing-site)
- [Grant et al. 2018, science process for the 2020 rover landing site (Caltech)](https://authors.library.caltech.edu/87552)
- [EPSC 2018 abstract: Mars 2020 final sites](https://meetingorganizer.copernicus.org/EPSC2018/EPSC2018-578.pdf)
- [NASA PIA24349: Zeroing in on the target](https://www.jpl.nasa.gov/images/pia24349-zeroing-in-on-the-target/)
- [NASA PIA16039: Landing accuracy on Mars, a historical perspective](https://www.jpl.nasa.gov/images/pia16039-landing-accuracy-on-mars-a-historical-perspective/)
- [JPL PIA26476: Jezero crater elevation graph](https://www.jpl.nasa.gov/images/pia26476-jezero-crater-elevation-graph/)
- [DLR: topography of Jezero crater](https://www.dlr.de/en/latest/news/2020/03/20200929_topography-of-jezero-crater)
- [Wikipedia: list of landing ellipses (approximate older values)](https://en.wikipedia.org/wiki/List_of_landing_ellipses_on_extraterrestrial_bodies)
- [Wu et al. 2022, Landing site selection and characterization of Tianwen-1, JGR Planets](https://ui.adsabs.harvard.edu/abs/2022JGRE..12707137W)

**Mars seasons and storms**
- [Planetary Society: Mars calendar](https://www.planetary.org/articles/mars-calendar)
- [LMD Paris: Martian seasons and solar longitude](https://www-mars.lmd.jussieu.fr/mars/time/solar_longitude.html)
- [JPL: Opportunity hunkers down during dust storm](https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/)
- [Planetary Society: Opportunity pummeled by dust storm](https://www.planetary.org/articles/06-mer-update-opportunity-dust-storm-sleep)
- [Astronomy: NASA declares mission complete for Opportunity](https://www.astronomy.com/space-exploration/nasa-declares-mission-complete-for-opportunity-rover/)
- [Spaceflight Now: Spirit dust devil cleaning](https://spaceflightnow.com/mars/mera/050314dustdevil.html)
- [Planetary Society: MER update March 2005](https://www.planetary.org/articles/03-25-mer-update)
- [JPL: InSight enters safe mode during regional dust storm](https://www.jpl.nasa.gov/news/nasas-insight-enters-safe-mode-during-regional-mars-dust-storm/)

**Operations**
- [MSL science operations (archived)](https://webarchive.library.unt.edu/web/20130214172824/http://msl-scicorner.jpl.nasa.gov/scienceoperations)
- [MSL science planning (archived)](https://webarchive.library.unt.edu/web/20130215012759/http://msl-scicorner.jpl.nasa.gov/scienceplanning)
- [NASA Curiosity blog: a soliday before the holidays](https://science.nasa.gov/blog/sols-4039-4040-a-soliday-before-the-holidays)
- [NASA Curiosity blog: MSL update](https://science.nasa.gov/blog/msl-update-2077/)
- [USGS Curiosity blog sols 3853 to 3856](https://www.usgs.gov/centers/astrogeology-science-center/news/curiosity-blog-sols-3853-3856-time-try-a-new-route)
- [NASA Curiosity blog sols 5056 to 5062: Charging back up](https://science.nasa.gov/blog/curiosity-blog-sols-5056-5062-charging-back-up/)
- [NASA Curiosity blog: Lots of bits](https://science.nasa.gov/blog/sols-2159-2162-lots-of-bits/)
- [NASA Curiosity science updates](https://science.nasa.gov/mission/msl-curiosity/science-updates/)
- [MSL team Q&A on data volume (secondary host)](https://lr.eu.psf.lt/r/IAmA/comments/ybmmh/we_are_engineers_and_scientists_on_the_mars/c5u2y5p)
- [NBC News: team living on Martian time](https://www.nbcnews.com/id/wbna3881401)
- [Smithsonian: living on Martian time](https://www.smithsonianmag.com/smithsonian-institution/think-mountain-times-confusing-try-living-martian-time-180967799/)
- [Space.com: Curiosity team switches back to Earth time](https://space.com/18381-curiosity-mission-control-mars-time.html)
- [Maimone et al. 2026, Roving on the Edge, JPL / AAS](https://robotics.jpl.nasa.gov/media/documents/2026_RO_AAS_final.pdf)
- [NASA: Perseverance sets off-world record for total distance driven](https://science.nasa.gov/blogs/perseverance-mars-rover/2026/10/12/nasas-perseverance-sets-off-world-record-for-total-distance-driven/)
- [Universe Today: Perseverance setting records](https://www.universetoday.com/articles/nasas-perseverance-rover-is-setting-records-on-mars)
- [JPL: Mars rovers break driving records](https://www.jpl.nasa.gov/news/mars-rovers-break-driving-records-examine-salty-soil/)
- [AccuWeather: Sun halts communications with Mars missions](https://www.accuweather.com/en/space-news/sun-temporarily-halts-communications-between-nasa-and-mars-missions/1596259)
- [TweakTown: 2023 command pause](https://www.tweaktown.com/news/94376/nasa-has-stopped-sending-commands-to-its-mars-rover-and-helicopter/index.html)
- [Telangana Today: 2026 solar conjunction](https://telanganatoday.com/mars-solar-conjunction-nasa-rovers-orbiters-continue-science-operations)
- [Spaceflight Now: 2014 senior review](https://www.spaceflightnow.com/news/n1403/18seniorreview/)
- [SpaceNews: FY2021 Curiosity budget](https://spacenews.com/?p=99518)
- [Planetary Society: burden of success](https://www.planetary.org/articles/0415-nasas-burden-of-success-and-the-future-of-opportunity)
- [Planetary Society: senior review](https://www.planetary.org/articles/0903-planetary-missions-survive-senior-review)

**Sustainability and anomalies**
- [Astronomy: Will winter kill the Mars rovers?](https://www.astronomy.com/space-exploration/will-winter-kill-the-mars-rovers/)
- [Planetary Society: MER update February 2008](https://www.planetary.org/articles/02-29-mer-update)
- [NASA PIA10129: Spirit nears north-tilting winter haven](https://photojournal.jpl.nasa.gov/catalog/PIA10129)
- [JPL PIA15119: Greeley Haven](https://www.jpl.nasa.gov/images/pia15119-greeley-haven-site-for-opportunitys-fifth-martian-winter/)
- [Planetary Society: Opportunity works through winter 2012](https://www.planetary.org/articles/03-mer-update)
- [Space.com: Spirit wheel stall at Troy](https://www.space.com/7590-attempt-free-mars-rover-snagged-wheel-stall.html)
- [NTRS: Spirit mobility paper](https://ntrs.nasa.gov/citations/20160001767)
- [JPL: Spirit completes mission](https://jpl.nasa.gov/news/nasas-spirit-rover-completes-mission-on-mars)
- [JPL: NASA reformats memory of longest-running Mars rover](https://www.jpl.nasa.gov/news/nasa-reformats-memory-of-longest-running-mars-rover/)
- [JPL: Rover amnesia event follows reformatting](https://www.jpl.nasa.gov/news/rover-amnesia-event-follows-latest-memory-reformatting/)
- [JPL: Opportunity working in no-flash mode](https://www.jpl.nasa.gov/news/opportunity-working-in-no-flash-mode-for-now/)
- [Planetary Society: Opportunity updates flight software](https://www.planetary.org/articles/02-mer-update-opportunity-discovers-new-rock-type)
- [JPL: An algorithm helps protect Curiosity's wheels](https://www.jpl.nasa.gov/news/an-algorithm-helps-protect-mars-curiositys-wheels/)
- [JPL Robotics: Traction control design, IEEE Aerospace 2018](https://www-robotics.jpl.nasa.gov/media/documents/2018-ieee-aerospace-trctl.pdf)
- [Space.com: Curiosity wheel damage](https://www.space.com/26643-mars-rover-curiosity-wheel-damage.html)
- [Universe Today: sharp rocks force Curiosity to seek smoother path](https://www.universetoday.com/articles/holy-wheels-sharp-rocks-force-nasas-curiosity-rover-to-seek-smoother-pathway-to-mount-sharp)
- [JPL: Curiosity checking possible smoother route](https://www.jpl.nasa.gov/news/curiosity-mars-rover-checking-possible-smoother-route/)
- [CS Monitor: saving Curiosity's wheels](https://www.csmonitor.com/Science/2017/0324/What-can-NASA-do-to-save-Curiosity-s-wheels)
- [NASA PIA22326: Curiosity successfully drills Duluth](https://www.jpl.nasa.gov/images/pia22326-curiosity-successfully-drills-duluth/)
- [Discover: NASA hacked a fix for the drill](https://www.discovermagazine.com/the-sciences/nasa-hacked-a-fix-for-mars-rovers-broken-drill)
- [Planetary Society: Curiosity's MMRTG (book excerpt)](https://www.planetary.org/articles/0514-book-excerpt-curiosity-mmrtg)
- [JPL: Marking 13 years on Mars, Curiosity picks up new skills](https://www.jpl.nasa.gov/news/marking-13-years-on-mars-nasas-curiosity-picks-up-new-skills/)
- [Spaceflight Now: Perseverance completes sample depot](https://spaceflightnow.com/2023/02/14/mars-rover-completes-first-sample-storage-depot/)
- [ESA: First martian sample depot complete](https://www.esa.int/ESA_Multimedia/Images/2023/01/First_martian_sample_depot_complete)
- [NASA: Assessing Perseverance's seventh sample collection](https://science.nasa.gov/missions/mars-2020-perseverance/assessing-perseverances-seventh-sample-collection/)
- [JPL PIA25067: Perseverance's bit carousel](https://www.jpl.nasa.gov/images/pia25067-perseverances-bit-carousel/)
- [Live Science: China admits Zhurong may never wake](https://www.livescience.com/space/space-exploration/china-finally-admits-its-hibernating-mars-rover-may-never-wake-up)
- [Universe Today: China explains Zhurong status](https://www.universetoday.com/articles/china-finally-tells-us-whats-going-on-with-its-mars-rover)
- [JPL: InSight gets a power boost](https://www.jpl.nasa.gov/news/nasas-insight-mars-lander-gets-a-power-boost)
- [JPL: Ingenuity mission ends](https://www.jpl.nasa.gov/news/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/)

**Other destinations**
- [Guinness World Records: longest time survived on Venus](https://www.guinnessworldrecords.com/world-records/78367-longest-time-survived-on-venus-by-a-spacecraft)
- [NASA NTRS: LLISSE](https://ntrs.nasa.gov/api/citations/20190029198/downloads/20190029198.pdf)
- [NASA NTRS: High-temperature Venus technology overview](https://ntrs.nasa.gov/api/citations/20230004306/downloads/HiTech%20Venus%20Overview%20v1.pdf)
- [NASA Dragonfly mission page](https://science.nasa.gov/mission/dragonfly/)
- [NASA Dragonfly spacecraft and instruments](https://science.nasa.gov/mission/dragonfly/spacecraft-and-instruments/)
- [NASA Dragonfly Final Environmental Assessment](https://www.nasa.gov/wp-content/uploads/2024/01/dragonfly-final-ea-july-2022.pdf?emrc=e26d84)
- [JHU APL: Dragonfly dual-quadcopter](https://www.jhuapl.edu/news/news-releases/170823-dragonfly-dual-quadcopter-aims-to-explore-titan-saturn-moon)
- [OpenStax Astronomy 2e: Titan and Triton](https://openstax.org/books/astronomy-2e/pages/12-3-titan-and-triton)
- [NASA Europa Lander Study briefing (Prockter)](https://solarsystem.nasa.gov/docs/10_Europa%20Lander%20Study_L.%20Prockter.pdf)
- [Ashkenazy 2016, Europa surface temperature (arXiv)](https://arxiv.org/pdf/1608.07372v5)
- [ESA: MMX lifts off to Phobos](https://www.esa.int/ESA_Multimedia/Images/2026/10/MMX_lifts_off_to_Mars_s_moon_Phobos)
- [Space.com: Japan launches MMX](https://www.space.com/space-exploration/launches-spacecraft/japan-launches-historic-mmx-sample-return-mission-to-mars-moon-phobos)
- [DLR: MMX and IDEFIX ready for launch](https://www.dlr.de/en/latest/news/2026/off-to-the-moons-of-mars-mmx-mission-and-idefix-rover-ready-for-launch)
