# Titan Surface Data

Facts for the drivable Titan mission: the Shangri-La dunes, Selk crater, where Dragonfly will land, and Titan's light, cold, air, day, season and weather. It feeds the terrain pipeline, the sky and light work, and the Titan text and milestones. It builds on [03](03-surface-environments-and-operations.md) and [08](08-moon-surface-data.md).

Researched November 15, 2026. Written for our team, not for players. Items marked *unverified* could not be confirmed from a primary source. "Our analysis" marks our own arithmetic.

Quick navigation: [Summary](#summary) · [Dunes](#shangri-la-dunes) · [Selk](#selk-crater) · [Dragonfly](#dragonfly) · [Light and sky](#light-and-sky) · [Cold, air, gravity](#temperature-atmosphere-and-gravity) · [Day and season](#day-length-and-season) · [Rain](#methane-rain-and-the-2010-storms) · [Huygens](#huygens-landing-site) · [Game implications](#what-this-means-for-the-game)

## Summary

- **The dunes are known only at radar scale.** Cassini's radar saw them at about 300 m per pixel. Nobody has a rover-scale elevation model, so the game terrain is "modeled on" published dune measurements.
- **Dunes:** run west to east, about 1 km wide (typically 1 to 2 km), 1 to 4 km apart (3 km mean), up to about 150 m high.
- **Selk** is about 80 km across at 7°N, 199°W. Its rim is low and broad (about 200 m high, slopes about 3°), not a mountain wall.
- **Dragonfly's landing area** is a 149 × 72 km ellipse southeast of Selk in the dunes. Its center is about 150 km from Selk's center (our analysis).
- **Light** at the surface is very dim, darker than Earth just after sunset. **Temperature** is about 94 K (−179 °C). **Gravity** is 1.35 m/s². **Air** is about 1.5 bar, mostly nitrogen with a few percent methane.
- **A Titan day** is 15.945 Earth days. Dragonfly arrives in late 2034, in northern winter; the Sun is south of the equator then, about 20°S (our analysis).
- **Methane rain** darkened more than 500,000 km² of equatorial ground after clouds in late 2010.

## Shangri-La dunes

Titan's dunes are long, straight, linear dunes in a belt around the equator. Shangri-La is one large dune region (a "sand sea") on the equator.

| Property | Value | Source |
| --- | --- | --- |
| Orientation | West to east (parallel to lines of latitude). Near Selk they are mostly east–west, taper out and re-emerge south of the crater; a second, crossing set lies west of Selk | [Radebaugh et al. 2008](https://pirlwww.lpl.arizona.edu/~jani/radebaugh-dunestitan-icarus08.pdf); [Lorenz et al. 2021](https://ntrs.nasa.gov/api/citations/20210011126/downloads/Lorenz_2021_Planet._Sci._J._2_24.pdf), Fig. 3 |
| Width | Mean 1 km (2,315 dunes in the T3 radar swath); typical 1 to 2 km | Radebaugh et al. 2008 |
| Spacing (crest to crest) | Mean 3 km in the T3 swath; global mean about 2 km; typical 1 to 4 km; about 1 km in sand seas | Radebaugh et al. 2008 |
| Length | Mean 16 km in the T3 swath (1 to 79 km); the longest are over 100 km | Radebaugh et al. 2008 |
| Height | Up to about 150 m. Radar clinometry in Belet sand sea: 100 to 150 m (slopes about 10°); radar altimetry: 100 to 200 m. Rule of thumb: spacing is at least 10 times the height | Radebaugh et al. 2008, citing Lorenz et al. 2006 (Science 312:724) and Callahan et al. 2006 |
| Interdunes | In sand seas: radar-dark, closely spaced. Elsewhere, some interdunes are bright in radar, meaning sand-free ground (bedrock or ice). Interdune flats are the preferred landing ground | Radebaugh et al. 2008; Lorenz et al. 2021 |
| Dune plinths | Wide, shallow-slope skirts around linear dunes. They give safe access to sand without climbing the steep crest | Lorenz et al. 2021, Fig. 13 |
| Ground in the landing area | 93% of the landing ellipse is radar "dunes" terrain, 95% is dark in Cassini imaging (likely sand-covered), 100% is the infrared "brown" unit | Lorenz et al. 2021, Fig. 11 |
| Sand | Dark, organic-rich material (the organic nature is inferred from Cassini infrared and radar, not sampled) | Lorenz et al. 2021, conclusion |

Notes:

- Radebaugh's measurements come from SAR images at about 300 m resolution. Slopes and heights come from indirect radar methods, not a topographic map. That is why the game says "modeled on".
- The dunes look like the linear dunes of the Namib and Sahara (Lorenz et al. 2021, Fig. 13; Radebaugh et al. 2008).

## Selk crater

| Property | Value | Source |
| --- | --- | --- |
| Center | 7.0°N, 199.0°W (161.0°E) | [IAU Gazetteer of Planetary Nomenclature, Selk](https://planetarynames.wr.usgs.gov/Feature/14334) |
| Diameter | 80 km (IAU and Lorenz et al. 2021). Some sources say 90 km | IAU Gazetteer; Lorenz et al. 2021; [Wikipedia](https://en.wikipedia.org/wiki/Selk_(crater)) |
| Discovery | Seen as a bright spot on Cassini's first Titan flyby (2004); radar showed an 80 km crater in 2007 | Lorenz et al. 2021, section 2 |
| Rim height | About 200 m above the surroundings. Early photoclinometry (3 to 5 km high, slopes about 20°) was refuted by radar topography | Lorenz et al. 2021, section 2 (T95 SARtopo) |
| Floor | Only 100 to 200 m below the surroundings. Partly sand-covered with a few dunes | Lorenz et al. 2021 |
| Rim slope | About 3° on multi-km scales (abstract: about 2°) | Lorenz et al. 2021 |
| Condition | Intermediate age; rim heavily cut by fluvial channels; ejecta blanket still intact | Lorenz et al. 2021, section 4 |
| Ejecta | Water-ice rich (a ring of low microwave emissivity). Rough in radar around the rim | Lorenz et al. 2021, Fig. 11 |
| Why it matters | Impact melt may once have mixed liquid water with organic material | Lorenz et al. 2021; [NASA Dragonfly](https://science.nasa.gov/mission/dragonfly/) |

Our analysis: seen from 100 km away, a rim 200 m high is a low line on the horizon, hazy and faint. It does not look like a wall.

## Dragonfly

- **What it is.** A rotorcraft lander, eight 1.35 m (53 in) coaxial rotor blades. NASA: "Titan's dense, calm atmosphere and low gravity make flying the ideal way to travel to different areas" and flying avoids the "potentially rough and sandy terrain" ([NASA, spacecraft and instruments](https://science.nasa.gov/mission/dragonfly/spacecraft-and-instruments/)).
- **Schedule.** Launch no earlier than July 2028, arrival late 2034, planned 3.3-year mission ([NASA, Dragonfly](https://science.nasa.gov/mission/dragonfly/)). Earlier papers say launch 2027 and arrival 2034 (Lorenz et al. 2021); use NASA's current dates.
- **Landing region.** Phase A delivery ellipse of 148.9 × 72.0 km (wider east–west because of wind uncertainty), centered at 3.72°N, 161.8°E (the point of separation from the parachute, at about 1 km height). It is southeast of Selk, in the Shangri-La dunes, as near the crater as the safety limits allowed. The aimpoint may move a few tens of km (Lorenz et al. 2021, section 3).
- **Distance to Selk (our analysis).** From the ellipse center to Selk's center is about 3.3° of latitude (147 km) and 0.8° of longitude (36 km), so about 150 km. Minus Selk's 40 km radius, about 110 km to the rim. This agrees with NASA's statement that the primary mission covers "about 70 miles (115 km) from its initial landing site", over 20 to 30 sites. Not a published number.
- **Flights.** One flight every 1 to 2 Titan days; it can cover "tens of miles (or kilometers) in under an hour" ([NASA, spacecraft](https://science.nasa.gov/mission/dragonfly/spacecraft-and-instruments/)). Early flights are short, to scout; longer flights go toward Selk over the following two years or more (Lorenz et al. 2021, section 3).
- **Power.** An MMRTG (radioisotope generator) charges a lithium-ion battery (NASA lists a 134 ampere-hour battery) during Titan's night, which lasts about eight Earth days. The generator also gives waste heat ([NASA RPS](https://science.nasa.gov/radioisotope-power-systems-missions/); [Idaho National Laboratory](https://inl.gov/?p=2706)). INL quotes about 100 W of electricity; *unverified*: NASA's pages we reached do not state the watts. One Wikipedia mirror says 70 W (a target). Say "about 100 W, less than a hair dryer". It takes kilowatts to fly, so the battery stores energy between flights.
- **Thermal design.** The MMRTG makes about 2 kW of heat ([NASA TFAWS 2023](https://tfaws.nasa.gov/wp-content/uploads/TFAWS23-AT-14-Presentation.pdf), *unverified* beyond that single slide). A pumped fluid loop carries this waste heat through the body, which is insulated, to keep electronics and instruments warm (NASA EDL paper, [Wright et al. 2026](https://ntrs.nasa.gov/api/citations/20250011718/downloads/2026_SciTech_Dragonfly_EDL_Wright%20Paper_v2.pdf)). The game's heater and "sleep cools" rule are our simplification of this.
- **Why fly.** Dense air (about four times Earth's density at the surface, our analysis from 1.5 bar and 94 K) and low gravity (1.35 m/s²) make flight cheap. Hops cross dunes without driving over soft sand.

## Light and sky

- **Surface light.** Sunlight at the surface is very dim. A rendering built from Huygens DISR data compares it with Earth about 10 minutes after sunset in a clear sky, and finds Titan's daytime surface darker than that ([free-astro.org, Huygens DISR](https://free-astro.org/titan/)). The common figure "about 1/1000 of Earth daylight" is consistent with this but we did not confirm it in a primary paper (Tomasko et al. 2005, Nature 438:765): *unverified*.
- **The Sun is a faint disc, not a source of sharp shadows.** The Sun can be seen through the haze but is too faint compared with the scattered sky to light the scene (same page). Shadows are very weak. Our analysis: that supports the game's "soft light, almost no shadows".
- **Sky color.** Huygens' pictures show an orange-brown haze-filled scene. Methane absorbs strongly near the surface, so Huygens used a lamp for surface color (ESA DISR notes, [sci.esa.int](https://sci.esa.int/web/cassini-huygens/-/36529-visible-and-ir-spectrum-recorded-by-disr)).
- **Twilight.** Cassini found Titan's twilight (looking toward the Sun at a high phase angle) can outshine its daylight, because the haze scatters forward ([arXiv:1704.07460](https://arxiv.org/pdf/1704.07460)). This is seen from orbit, not at the surface.
- **Saturn** is hidden by the haze from the surface (*unverified*; widely stated, not checked in a primary source).

## Temperature, atmosphere and gravity

| Property | Value | Source |
| --- | --- | --- |
| Surface temperature | About 94 K (−179 °C). Huygens site: about −180 °C | [NASA Titan facts](https://science.nasa.gov/saturn/moons/titan/facts/); Huygens press coverage ([ScienceDaily](https://www.sciencedaily.com/releases/2005/01/050123205152.htm)) |
| Surface pressure | About 1.45 to 1.5 bar, about 60% higher than Earth's (like 15 m underwater) | NASA Titan facts |
| Composition | About 95% nitrogen, about 5% methane (NASA). Surface methane is higher than stratospheric: *unverified* exact figure | NASA Titan facts |
| Gravity | 1.35 m/s², about 1/7 of Earth's (0.138 g). The Moon is 1.62 | Dragonfly papers (Lorenz et al.); our analysis for the ratio |
| Radius | 2,575 km | [NASA NSSDC satellite fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html) |

Note: the NSSDC sheet we could read does not list gravity, pressure or temperature, so those come from the pages above.

## Day length and season

- **Day length.** Titan is tidally locked, so its day equals its orbit around Saturn: 15.945421 Earth days ([NASA NSSDC](https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html)). NASA calls it a "Tsol", "about 16 Earth days" ([NASA Dragonfly](https://science.nasa.gov/mission/dragonfly/)). About half is light, about half dark (a night of about eight Earth days).
- **Season in 2034.** Dragonfly arrives in "northern winter" (Lorenz et al. 2021, section 1, which also says polar winter would block mobility and Earth communication, which is why an equatorial site was chosen).
- **Subsolar latitude (our analysis, *unverified*).** Saturn's northern spring equinox was August 2009 and its year is 29.46 Earth years, with a tilt of 26.7°. Late 2034 is about 25.3 years after the equinox, a solar longitude (Ls) of about 309°, just after the northern winter solstice (Ls 270°, about 2032). The Sun then is about 20°S of Titan's equator. For a site at about 4°N, the noon Sun is about 65° above the horizon, tilted to the south, and the Sun arcs across the southern half of the sky. Rise and set are east and west.
- **Direction of the Sun.** Titan rotates west to east like Earth, so the Sun rises in the east (our analysis from synchronous rotation; *unverified* against a source).

## Methane rain and the 2010 storms

- **Cassini storms.** Cassini saw a large cloud system near the equator in late September and October 2010. In the weeks after, ground over more than 500,000 km² got darker. The darkening faded over about three months. The changes are most consistent with widespread methane rainfall wetting the surface ([Turtle et al. 2011, Science 331:1414](https://experts.arizona.edu/en/publications/rapid-and-extensive-surface-changes-near-titans-equator-evidence--2/); [ESA summary](https://sci.esa.int/web/cassini-huygens/-/48586-turtle-e-p-et-al-2011)). The "April showers" in the title means the season (northern spring), not the month; an earlier unusual cloud event was in April 2008 ([Planetary Society](https://www.planetary.org/articles/2970)).
- **Rain is rare.** Titan rain is thought to be seasonal and heavy but infrequent, which carves dry channels at low latitudes (Turtle et al. 2011).
- **Dragonfly's winter site** is at a time when equatorial storms are less likely than in the 2010 spring (our analysis; *unverified*). The game's one storm is a gameplay event, not a forecast.

## Huygens landing site

- ESA's Huygens probe landed on January 14, 2005 on a dark plain that looks like a dry lakebed.
- Images show more than 50 rounded rocks, about 3 mm to 15 cm across, made of water ice, on darker, finer material (Tomasko et al. 2005; [Astronomy.com summary](https://www.astronomy.com/science/huygens-lands-on-titan/)). Small pebbles (under 5 cm) seem to be sorted by flowing liquid ([ESA](https://esa.int/Science_Exploration/Space_Science/Results_from_Mars_Express_and_Huygens/Rain_winds_and_haze_during_the_descent_to_Titan)).
- The penetrometer found a surface with the consistency of loose sand, perhaps damp (liquid methane within a few cm). Warmth from the probe boiled methane out of the ground. Methane humidity at the site was about 50% (ESA).
- Our analysis: Huygens landed far from Shangri-La (exact coordinates not checked: *unverified*), not in dunes. The game uses "Huygens-like pebbles" only near the landing.

## What this means for the game

- Dune crests run west to east. At 5 m per pixel and an 8 km map, 3 to 4 dunes at 1 to 3 km spacing fit across the north–south direction. Dune height of about 100 m is a safe choice (published range 100 to 150 m).
- Selk is at the horizon about 110 to 150 km away (our analysis). It is a low rise, and haze would hide it. Do not draw a mountain.
- The Sun is high in the southern sky at noon (about 65°), not low like the Moon. The dim light comes from the haze, not from the Sun's angle.
- The sky is dim orange-brown, and shadows are weak. Night is dark; lights matter.
- Mission time: 900 s for one 15.945-day Titan day (our analysis: 1 s of game is about 25 minutes).
