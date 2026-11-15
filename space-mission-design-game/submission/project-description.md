> **Draft for team review — verify before submitting.**
> Fill in every `TODO` placeholder. Every NASA dataset and fact below was checked against the repo (`game/public/terrain/terrain.json`, `texture.json`, `game/data/events.json`, `milestones.json`, `text.json`, and `game-design.md`) on November 15, 2026. If the game changes before submission, recheck the numbers.
>
> **For the team to check:**
> - Datasets listed in `game-design.md` §9 but **not** in the current game (ShadowCam, Diviner temperature maps, Moon Mineralogy Mapper, Apollo seismometer data, SVS star maps, LROC/Chandrayaan-2 boulder counts) are deliberately left out. Diviner appears only as a cited history fact. Add any of them only if they are actually built in.
> - The repo is under the MIT License (`LICENSE`), which is OSI-approved. Make sure the published repository includes that file.
> - Rechecked after the balance pass (November 15): the Sun window, ice and pass rule are decided; the three winning designs below match `game/data/balance.json`.

# Rover Engineer: Project Description

**Challenge:** Space Mission Design Game (NASA Space Apps Challenge 2026)

**Play the game:** `TODO: GAME URL`
**Demo (30-second video or up to 7 slides):** `TODO: DEMO LINK`
**Source code (optional):** `TODO: REPOSITORY URL`

**License:** MIT (see the `LICENSE` file in the repository)

## Short version (about 100 words)

Rover Engineer is a free browser game in which high school learners design a lunar rover, buy it a launch ticket, and keep it working for one lunar day on the de Gerlache crater rim near the Moon's south pole. Every part trades mass against cost: a heavier rover needs a pricier launch tier, drives slower, uses more energy and sinks deeper in soft soil. The 8 km × 8 km map is real NASA terrain from LRO's laser altimeter, with real permanent shadows and LROC ground imagery. Solar flares come from NASA's DONKI database. A debrief explains what happened and why.

## Full version

### What it is and who it is for

Rover Engineer is a 3D browser game for high school learners. The player, a new engineer at the fictional Rover Exploration Laboratory (REL), designs a rover within a budget, buys it a spot on the next launch to the Moon, and drives it in real time through one lunar daylight period: 14 Earth days in five minutes. A short tutorial covers the first design and drive; real-history facts are optional.

### How to play

Choose a part for each of seven slots, from chassis to instrument, while a specification sheet shows mass, size, cost, speed and range. Mass and size set the launch ticket tier, and parts plus ticket must fit the budget. On the surface, recharge in sunlight, power down when a solar flare warning appears, and use the camera or drill to reach milestones, such as photographing Earth on the horizon or finding ice hidden in a dark crater. The debrief lists milestones, photos, and the cause of any failure next to a real rover that met a similar fate.

### How it answers the challenge

Rover Engineer plays one complete mission, from design and launch through surface operations to debrief, with limited money, mass and energy. A player whose balance falls below the next mission's minimum redesigns and tries again. The core lesson is that subsystems interact: mass alone affects launch price, energy per meter, speed, sinkage and chassis load. Leaving out lights and the heater can earn a cheaper ticket but closes off the dark crater. To reach Mars, the Moon mission must earn more than the rover and ticket cost, and there is more than one way to do it: a light camera scout that photographs the crater rim and Earth, a drill geologist that samples sites across the rim, or a cold-proofed ice hunter that drives into the dark crater for the highest reward and the highest risk. A rover thrown together, or one that never uses its instrument, falls short. An automated balance check keeps any single build from being best at everything.

### NASA data and what it does in the game

- **LRO LOLA 5 m elevation and slope model of the de Gerlache rim** (NASA Goddard PGDA): the drivable 8 km × 8 km terrain and its physics. Uphill driving costs energy and slopes over 20° cause damage. Moving shadows, computed from these heights, decide solar charging.
- **LOLA polar elevation models at 20 m and 80 m:** terrain out to about 200 km, so real mountains such as Malapert massif and Mons Mouton stand on the horizon and cast long shadows.
- **LOLA polar illumination, permanent-shadow and Earth-visibility maps:** chose a landing site that is flat, sunlit about 66% of the time and in view of Earth about 60%, as real sites are chosen. The permanent-shadow map sets the cold zones, which need lights and a heater, and places the hidden ice. The illumination map validated the game's shadows (mean error 1.5 percentage points).
- **LROC NAC de Gerlache Rim mosaic** (NASA/GSFC/Arizona State University): the ground texture.
- **NASA DONKI space weather database:** the 20 strongest X-class flares from 2010 to 2026. Each mission draws two, named by class and date.
- **Apollo 15 Lunar Roving Vehicle results** (NASA TR R-401): wheel sinkage, slip and getting stuck.
- **NASA sources for history facts,** including NSSDCA, LRO's Diviner and LEND instruments, LCROSS and JPL. Each source is on the credits screen.

### The real science it teaches

At the south pole the Sun circles within about 1.5° of the horizon, so shadows sweep across the land and a charging spot can go dark. Permanently shadowed craters reach about 25 K and may hold water ice; LCROSS measured about 5.6% water by mass at Cabeus. The drill's hydrogen signal mirrors how LRO's LEND detector maps hydrogen from orbit. Soft regolith can trap a rover, as it did Spirit on Mars. The launch ticket follows NASA's Commercial Lunar Payload Services, which buys delivery for small payloads.

Limits we state openly: money values are game values, driving is about four times faster than real, and boulders are generated by the game, not taken from data.

### What's next

Mars, then Titan, with longer missions and new constraints. Mars adds day and night: keep the lights on or sleep. Moon research points unlock Mars parts. Titan is always cold, and its day lasts about 16 Earth days.

### Team and tools

A two-person team: `TODO: TEAM MEMBER NAMES (omit anyone under 18)`. Built with TypeScript, Three.js, Rapier and Vite, with Python for data processing. The team designed the game; Anthropic's Claude, through Claude Code, assisted with research and wrote essentially all of the code under the team's direction (see the AI disclosure).

## References

For the submission's references field. Full source lists are in `game/public/terrain/terrain.json`, `texture.json`, `game/data/events.json`, `milestones.json` and `text.json`, and on the game's credits screen.

**NASA data used in the game**

1. LOLA 5 m/px site DEM and slope, Site11 (de Gerlache rim). NASA Goddard PGDA, pgda.gsfc.nasa.gov/products/78. Barker, M.K., et al. (2021), Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions, *Planetary and Space Science*, 203, 105119, doi:10.1016/j.pss.2020.105119.
2. LOLA south polar DEMs at 20 m and 80 m/px (LDEM_80S_20MPP_ADJ, LDEM_80S_80MPP_ADJ). NASA Goddard PGDA, pgda.gsfc.nasa.gov/products/90. Barker, M.K., et al. (2023), *Planetary and Space Science*.
3. LOLA polar illumination, permanent shadow and Earth visibility maps (85°S, 60 m/px). NASA Goddard PGDA, pgda.gsfc.nasa.gov/products/69. Mazarico, E., et al. (2011), Illumination conditions of the lunar polar regions using LOLA topography, *Icarus*, 211, 1066–1081, doi:10.1016/j.icarus.2010.10.030.
4. LROC NAC de Gerlache Rim low-Sun controlled mosaic, 5 m/px (NAC_ROI_DEGERRIMLO1_P885S2933_5M). Image credit NASA/GSFC/Arizona State University; PDS archive product. Henriksen, M.R., et al. (2023), Optimized Illuminated Terrain Coverage of the Candidate Artemis III Landing Sites with LROC NAC Controlled Mosaics, European Lunar Symposium, pp. 134–135.
5. NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information), CCMC, ccmc.gsfc.nasa.gov/tools/DONKI/. Flare list downloaded November 14, 2026.
6. Costes, N.C., et al. (1972), Mobility Performance of the Lunar Roving Vehicle: Terrestrial Studies — Apollo 15 Results, NASA TR R-401, NASA Technical Reports Server.

**Sources for in-game facts:** listed per fact in `game/data/milestones.json` and `text.json` (NASA NSSDCA, NASA Science, NASA SVS, NASA Goddard, NASA JPL, the Apollo Lunar Surface Journal, NASA Astromaterials Curation, NASA release 24-136, ESA, ISRO, NASA/ASU LROC, and peer-reviewed papers including Paige et al. 2010, Colaprete et al. 2010, Mitrofanov et al. 2010, Fassett & Thomson 2014, Pajola et al. 2019, Gorkavyi et al. 2023, and Leger et al. 2005).

**Software:** three.js (MIT), Rapier / @dimforge/rapier3d-compat (Apache-2.0), fast-png (MIT), Vite (MIT), Vitest; Python: NumPy, rasterio, SciPy, scikit-image, Pillow, Matplotlib.

**Disclaimer:** REL (Rover Exploration Laboratory) is a fictional agency. Rover Engineer is an entry to the NASA Space Apps Challenge 2026 and is not affiliated with or endorsed by NASA.
