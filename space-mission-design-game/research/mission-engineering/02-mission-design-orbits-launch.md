# Mission Design: Orbits, Trajectories, Launch, Ground Segment, and Operations

This file explains how a mission team picks where a spacecraft goes, how it gets there, how it talks to the ground, and how it is flown once it arrives. Each section pairs sourced facts with formulas and reference numbers the team can turn into game rules. It is written for the developers and designers of the [Space Mission Design Game](../../challenge-brief.md), not for players.

Researched November 14, 2026. Numbers marked *unverified* rest on a single secondary source or could not be checked against a primary document. Sections labelled **Our analysis** are our own calculations or design reasoning, not official guidance. Worked examples were computed in Python with the constants given below.

Quick navigation: [Orbit types](#orbit-types-and-their-trade-offs) · [Formulas](#key-relationships-and-formulas) · [Lifetime vs altitude](#atmospheric-drag-and-orbital-lifetime) · [Delta-v and transfers](#rocket-equation-delta-v-and-transfers) · [Launch vehicles](#launch-vehicles) · [Ground segment](#ground-segment-and-communications-geometry) · [Operations](#operations-concept) · [Mission templates](#mission-type-templates) · [Space environment](#space-environment-and-orbit-choice) · [Key numbers](#key-numbers-for-the-game) · [Game implications](#game-implications) · [Sources](#sources)

Related files: the NASA lifecycle and reviews are in [01-mission-lifecycle.md](01-mission-lifecycle.md); power, thermal, link budget, propulsion sizing and attitude control are in [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md); cost models, risk and failure case studies are in [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md).

## Orbit types and their trade-offs

An orbit is the single decision that drives most other numbers in a mission: what a camera can resolve, how often it sees a target, how long the spacecraft is in shadow, how much radiation it absorbs, how long it stays up, how often it can talk to the ground, and which rockets can reach it.

### Summary table

Altitudes and periods are typical values. Periods for circular orbits are computed from Kepler's third law (see [Formulas](#key-relationships-and-formulas)) unless a source is linked.

| Orbit | Typical altitude / location | Period | Coverage and revisit | Imaging resolution | Radiation | Drag / lifetime | Eclipse (thermal/power) | Comms geometry | Launch difficulty | Examples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LEO (general) | 180 to 2,000 km ([ESA](https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits)) | ~90 to 127 min | Narrow swath, global if inclined; a single satellite revisits a spot every few days to weeks | Best (closest to target) | Low below the belts, spikes in the South Atlantic Anomaly | Strong below ~600 km; years to decades | Up to ~36 min of shade per orbit, about 15 eclipses per day | Short passes (~5 to 12 min) over each station | Easiest and cheapest | Hubble, Starlink |
| ISS orbit | 370 to 460 km, 51.6° ([NASA ISS tutorial](https://eol.jsc.nasa.gov/Tools/orbitTutorial.htm), [NASA FAQ](https://www.nasa.gov/international-space-station-frequently-asked-questions/)) | 90 to 93 min, 15.5 to 15.9 orbits/day ([NASA](https://eol.jsc.nasa.gov/Tools/orbitTutorial.htm)) | Covers latitudes up to ±51.6° only | Good | Low; SAA crossings | Needs regular reboosts | ~35 min per orbit | Uses TDRS relay plus ground stations | Easy (many rides) | ISS, CubeSats deployed from ISS |
| Sun-synchronous (SSO) | Usually 600 to 800 km ([ESA](https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits)), inclination ~97° to 99° | ~97 to 101 min | Passes over every point at the same local solar time; near-global | Good, with consistent lighting | Polar passes cross auroral zones and SAA | Moderate (decades above ~650 km) | Depends on local time; dawn-dusk orbits can be almost eclipse-free | Polar ground stations see almost every orbit | Easy; launched to high inclination from sites with a safe southward/northward corridor | Landsat 9, Terra |
| Polar (non-SSO) | 200 to 1,000 km, within ~10° of 90° ([ESA](https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits)) | ~90 to 105 min | Global coverage; local time drifts | Good | As SSO | As LEO | Varies with drift | As SSO | Slightly less payload than equatorial LEO | GRACE-FO |
| MEO | ~2,000 to 35,786 km; GPS at ~20,200 km, 55° ([NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/catalog-of-earth-satellite-orbits)) | 12 h for GPS | A few satellites cover large areas; navigation constellations | Poor for imaging | Harshest sustained dose (inside or near the belts) | Effectively permanent | Short eclipse seasons | Long contacts | Moderate; more energy than LEO | GPS, Galileo, O3b |
| GEO / GSO | 35,786 km over the equator, period 23 h 56 min 4 s ([ESA](https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits)) | 1 sidereal day | Fixed view of about 40% of Earth's surface (our calculation: Earth central angle 81.3° at 0° elevation); continuous coverage but no poles | Coarse (km scale) unless very large optics | Outer belt electrons, charging | Permanent; boosted to a graveyard orbit at end of life | Eclipses only in two seasons near the equinoxes, up to ~69 min per day (our calculation) | Continuous link to one ground station | Hard: needs GTO plus an apogee burn | GOES, TDRS, comsats |
| HEO: Molniya | 12 h, 63.4°, e = 0.722, about two thirds of the time over one hemisphere ([NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/catalog-of-earth-satellite-orbits)) | 12 h | Long dwell over high latitudes | Poor | Crosses both belts every orbit | Long | Variable | Long contacts at apogee | Moderate | Russian Molniya comsats |
| HEO: Tundra | Same idea with a 24 h period (geosynchronous but eccentric) *unverified detail* | 24 h | High-latitude dwell | Poor | Less belt crossing than Molniya | Long | Variable | Long contacts | Moderate | Sirius XM (early fleet) *unverified* |
| Sun–Earth L1 halo/Lissajous | ~1.5 million km sunward ([NOAA DSCOVR](https://www.nesdis.noaa.gov/our-satellites/currently-flying/dscovr-deep-space-climate-observatory)) | ~6 months around L1 | Continuous view of the Sun and the sunlit Earth | n/a | Interplanetary (solar particles, cosmic rays) | No drag; needs station-keeping | No eclipses if the orbit is sized to avoid them | DSN or similar; ~5 s one-way light time | Needs C3 near −0.7 km²/s² (*unverified* typical value); medium launcher | ACE, DSCOVR, SOHO, IMAP |
| Sun–Earth L2 halo | ~1.5 million km anti-sunward ([NASA Webb](https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/)) | ~6 months (168 days for Webb, [NASA](https://science.nasa.gov/asset/webb/webbs-orbit-at-sun-earth-lagrange-point-2-l2/)) | Sun, Earth and Moon all behind the spacecraft; whole sky accessible over a year | n/a | Interplanetary | Station-keeping about every three weeks for Webb ([NASA](https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/)) | Never eclipsed by design | DSN; daily contacts | As L1 | JWST, Gaia, Euclid |
| Earth-trailing heliocentric | Drifts behind Earth around the Sun; Kepler's period ~372.5 days ([NASA press kit](https://ntrs.nasa.gov/api/citations/20100002027/downloads/20100002027.pdf)) | ~1 year | Stable, quiet view of deep space | n/a | Interplanetary | No drag, no station-keeping | No eclipses | Distance grows every year, so data rate falls; Kepler was ~0.5 AU away after four years (worst case) ([NASA](https://ntrs.nasa.gov/api/citations/20100002027/downloads/20100002027.pdf)) | Just above escape (C3 slightly > 0) | Kepler, Spitzer |
| Low lunar orbit (LLO) | ~50 to 100 km above the Moon; LRO flew a 50 km mean polar orbit ([NASA NTRS](https://ntrs.nasa.gov/api/citations/20230010952/downloads/Mesarch_LROLongTermOrbit_Preprint_20230727.pdf)) | ~113 to 118 min (our calculation) | Global lunar mapping from a polar orbit | Excellent (LRO camera at 50 km) | Interplanetary, no magnetosphere | Lunar gravity lumps (mascons) distort orbits; LRO needed monthly burns at 50 km ([NASA NTRS](https://ntrs.nasa.gov/api/citations/20140008962/downloads/20140008962.pdf)) | Up to ~48 min of shade per orbit at 50 km (our calculation), plus long lunar eclipses | Earth is hidden behind the Moon for part of each orbit | Needs TLI plus lunar orbit insertion | LRO, Chandrayaan-2 |
| Lunar frozen orbit | Eccentric orbit whose shape stays stable, e.g. LRO's 40 × 180 km since 2011 ([NASA NTRS](https://ntrs.nasa.gov/api/citations/20140008962/downloads/20140008962.pdf)) | ~2 h | Good | Good | As LLO | Much less fuel than circular LLO | As LLO | As LLO | As LLO | LRO (extended mission) |
| NRHO (lunar) | Earth–Moon L2 southern halo, 9:2 resonant, period ~6.56 days; perilune radius ~3,250 to 3,400 km, apolune radius ~71,000 km ([NASA NTRS](https://ntrs.nasa.gov/citations/20220019129)) | ~6.5 days | Long view of the lunar south pole | n/a | Interplanetary | Small orbit maintenance burns at apolune | Almost no eclipses | Continuous view of Earth, which made it attractive for crew | Needs TLI plus small insertion burn | CAPSTONE (flown); Gateway (planned, see note) |
| Planetary orbiters | Mars low orbit: MRO 255 × 320 km sun-synchronous, ~3 p.m. local time ([NASA NTRS](https://ntrs.nasa.gov/citations/20080032390)) | ~113 min (our calculation) | Repeat global mapping | Very high (HiRISE) | Thin atmosphere and no global field at Mars | Mars upper atmosphere allows aerobraking | Similar to Earth LEO | Relay to rovers; 3 to 22 min one-way light time to Earth | Needs a Mars launch window and orbit insertion burn | MRO, MAVEN, Juno (Jupiter) |

**Gateway status note.** The FY2026 President's budget request proposed ending Gateway and closing out its contracts ([SpaceNews via Satellite Today](https://www.satellitetoday.com/finance/2025/05/05/trumps-proposed-nasa-budget-looks-to-cut-funding-by-24/), [SpacePolicyOnline](https://spacepolicyonline.com/news/nasa-rolls-out-new-moon-plan/)). Reporting in 2026 says NASA has moved away from building it and that both lander providers told NASA they do not prefer the NRHO ([SpacePolicyOnline](https://spacepolicyonline.com/news/nasa-rolls-out-new-moon-plan/)). The exact cancellation date and final appropriations are *unverified*. The NRHO is still a valid real orbit for the game (CAPSTONE flew it), but do not present Gateway as an active program without rechecking.

### Sun-synchronous orbits and local time

A sun-synchronous orbit uses Earth's equatorial bulge (the J2 term) to rotate the orbit plane about 0.9856° per day, the same rate Earth moves around the Sun. The satellite then crosses the equator at the same local solar time every day ([NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/catalog-of-earth-satellite-orbits)). Designers specify this as the local time of the ascending node (LTAN) or descending node (LTDN).

| Choice | Typical local time | Why choose it | Cost of the choice | Example |
| --- | --- | --- | --- | --- |
| Mid-morning | ~10:00 to 10:30 descending | Good sun angle for land imaging and fewer afternoon clouds | Normal LEO eclipses (~35 min per orbit) | Landsat 9 crosses at 10:12 a.m. ±5 min ([NASA](https://science.nasa.gov/mission/landsat-9/)); Terra at about 10:30 ([NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/catalog-of-earth-satellite-orbits)) |
| Early afternoon | ~13:30 ascending | Complements morning orbits for weather and atmosphere | Normal eclipses | Generic example used by NASA Earth Observatory |
| Dawn-dusk | ~06:00 or 18:00 | Orbit rides the day/night line, so solar panels are lit almost all year; good for radar (which brings its own illumination) and power-hungry payloads | Poor for optical imaging (long shadows) | SpaceX runs a separate "Twilight" dawn-dusk rideshare series from 2026 (*unverified*, [NewSpace Economy](https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/)) |

**Our analysis (SSO inclination check).** Using the J2 nodal-precession formula below, the required inclination is 97.4° at 500 km, 97.8° at 600 km, 98.2° at 705 km and 98.6° at 800 km. The 705 km result matches Landsat 9's published 98.2° ([USGS](https://www.usgs.gov/landsat-missions/landsat-9)).

## Key relationships and formulas

**Constants used:** μ_Earth = 398,600.4418 km³/s², R_E = 6,378 km (6,378.137 km used in code), J2 = 1.08263 × 10⁻³, g0 = 9.80665 m/s², sidereal day = 86,164 s, speed of light c = 299,792 km/s, μ_Sun = 1.32712 × 10¹¹ km³/s², μ_Moon = 4,902.8 km³/s², μ_Mars = 42,828 km³/s². These are standard values; the formulas are textbook relationships found in [Wertz, Everett and Puschell (eds.), *Space Mission Engineering: The New SMAD*, Microcosm Press, 2011](https://www.sme-smad.com/) and [Curtis, *Orbital Mechanics for Engineering Students*, 4th ed., 2020](https://www.sciencedirect.com/book/9780128240250/orbital-mechanics-for-engineering-students).

### Period and velocity

```
a      = R_E + h                         (km, circular orbit)
T      = 2π · sqrt(a³ / μ)               (s)       Kepler's third law
v_circ = sqrt(μ / a)                     (km/s)
v_esc  = sqrt(2μ / a)                    (km/s)
v (any point of an ellipse) = sqrt(μ (2/r − 1/a))    vis-viva
```

**Worked examples (our calculation):**

| Altitude h (km) | Period T (min) | v_circ (km/s) | Orbits per day |
| --- | --- | --- | --- |
| 300 | 90.5 | 7.73 | 15.9 |
| 400 | 92.6 | 7.67 | 15.5 |
| 500 | 94.6 | 7.61 | 15.2 |
| 705 (Landsat) | 98.9 | 7.50 | 14.5 |
| 1,000 | 105.1 | 7.35 | 13.7 |
| 20,200 (GPS) | 718.7 | 3.87 | 2.0 |
| 35,786 (GEO) | 1,436.1 | 3.07 | 1.0 |

These match published figures: ISS 90 to 93 min ([NASA](https://eol.jsc.nasa.gov/Tools/orbitTutorial.htm)), Landsat ~99 min ([NASA](https://science.nasa.gov/mission/landsat-9/)), GEO 3 km/s ([ESA](https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits)). Solving the period equation for one sidereal day gives h = 35,786 km, the GEO altitude.

### Eclipse fraction for a circular orbit

For a circular orbit with the Sun in the orbit plane (beta angle = 0, the worst case) and a cylindrical shadow:

```
eclipse fraction  f = asin(R_E / a) / π
eclipse time        = f · T
```

| h (km) | Fraction in shadow | Eclipse per orbit (min) |
| --- | --- | --- |
| 400 | 0.39 | 36.1 |
| 500 | 0.38 | 35.8 |
| 705 | 0.36 | 35.3 |
| 1,000 | 0.33 | 34.9 |
| 35,786 (GEO, equinox) | 0.048 | 69 |

**Our analysis.** As beta angle grows the eclipse shrinks. Above a critical beta, `β* = asin(R_E / a)` (70.2° at 400 km), the spacecraft is in sunlight for the entire orbit. Dawn-dusk SSO orbits sit near high beta most of the year. A game can use `f` directly to size batteries (see [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md)).

### Ground track, swath and revisit

```
Ground-track shift per orbit at equator  ≈ (T / 86,164 s) · 40,075 km
Full coverage needs: swath ≥ equatorial spacing of tracks over the repeat cycle
Revisit (one satellite, no pointing) ≈ repeat cycle
Revisit with N evenly phased satellites ≈ repeat cycle / N
```

**Worked example (our calculation, checked against Landsat).** At 705 km, T = 98.9 min, so successive ground tracks are about 2,760 km apart at the equator. In 16 days Landsat completes 233.0 orbits, so the tracks over one cycle are about 40,075 / 233 ≈ 172 km apart. Landsat's imager swath is 185 km ([NASA](https://science.nasa.gov/mission/landsat-9/)), slightly wider than 172 km, which gives the published ~7% sidelap at the equator ([USGS](https://www.usgs.gov/landsat-missions/landsat-9)) and full global coverage every 16 days. Landsat 8 and 9 are offset by 8 days, so together they revisit every 8 days ([USGS](https://www.usgs.gov/landsat-missions/landsat-9)).

### Ground sample distance, diffraction and field of view

```
GSD (m)            ≈ h · p / f            h altitude (m), p pixel pitch (m), f focal length (m)
Diffraction limit  θ ≈ 1.22 · λ / D       (radians), ground resolution ≈ θ · h
Swath (nadir)      ≈ 2 · h · tan(FOV/2)   (flat-Earth approximation, fine for FOV < ~20°)
Swath (pushbroom)  ≈ N_pixels · GSD
```

**Worked examples (our calculation):**

| Case | Inputs | Result |
| --- | --- | --- |
| Geometric GSD | h = 705 km, p = 10 µm, f = 1.0 m | 7.05 m |
| Diffraction, small telescope | λ = 0.5 µm, D = 0.30 m, h = 500 km | ~1.0 m best possible |
| Diffraction, CubeSat optic | λ = 0.55 µm, D = 0.10 m, h = 500 km | ~3.4 m best possible |
| Altitude trade | Same camera moved from 500 km to 700 km | GSD worse by a factor of 1.4, swath wider by 1.4 |

The real resolution is the worse of the geometric GSD and the diffraction limit (plus jitter and atmosphere). This gives a clean game trade: lower orbit improves resolution but shortens lifetime and narrows the swath.

### Ground station access and passes per day

For a station that needs the satellite at least ε degrees above the horizon:

```
sin η   = (R_E / a) · cos ε                 η = nadir angle from the satellite
λ_max   = 90° − ε − η                       Earth central angle of the visibility circle
T_pass,max ≈ T · (2 λ_max / 360°)           overhead pass, ignoring Earth rotation
slant range = R_E · sin λ_max / sin η
```

**Worked examples (our calculation):**

| h (km) | Min elevation 5° | Min elevation 10° | Slant range at 10° |
| --- | --- | --- | --- |
| 400 | 7.9 min max pass | 6.2 min | 1,440 km |
| 500 | 9.2 min | 7.4 min | 1,695 km |
| 705 | 11.7 min | 9.6 min | 2,166 km |

Average passes are shorter than the overhead maximum because most passes are off to one side. Station operators acquire satellites 5 to 10° above the horizon, and a 1,500 km slant range is a common LEO link design point ([NASA SST State of the Art, ch. 11, 2026](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)).

**Our analysis (passes per day).** A mid-latitude station sees a 500 km LEO satellite on roughly 4 to 6 usable passes per day. A high-latitude station (for example Svalbard at 78° N) sees a polar or SSO satellite on most of its ~15 daily orbits, because every polar orbit passes near the pole. A rule of thumb for the game: daily contact ≈ passes × ~7 min. One mid-latitude station gives ~30 to 40 min per day; a polar station gives ~100 min per day; a GEO satellite has 24 h.

### Light-time delay

```
one-way delay = distance / c
```

| Target | Distance | One-way delay (our calculation) |
| --- | --- | --- |
| GEO | 35,786 km (overhead) | 0.12 s |
| Moon | 363,300 to 405,500 km ([NASA NSSDC](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)) | 1.2 to 1.35 s |
| Sun–Earth L1 or L2 | ~1.5 million km | 5 s |
| Mars | 54.6 to 401.4 million km ([NASA NSSDC](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)) | 3.0 to 22.3 min |
| Jupiter | 588.5 to 968.5 million km ([NASA NSSDC](https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html)) | 32.7 to 53.8 min |

A round trip doubles these. At Mars nobody can joystick a spacecraft; it must run stored command sequences and protect itself.

## Atmospheric drag and orbital lifetime

Drag depends on the spacecraft's ballistic coefficient `B = m / (C_D · A)` (kg/m²) and on upper-atmosphere density, which rises and falls with the 11-year solar cycle. A higher B (dense, compact spacecraft) lasts longer. Lifetime is very sensitive to solar activity, so published tables only apply to the stated spacecraft and conditions.

**Reference table: total lifetime from injection, 6U CubeSat, B_eff = 72.3 kg/m²** ([Vargas Domínguez et al., arXiv:2609.24534, 2026, Table 4](https://arxiv.org/abs/2609.24534); preprint, not yet peer reviewed). F10.7 is the solar radio flux index used as a proxy for solar activity, in solar flux units (sfu).

| Injection altitude | Solar maximum (170 sfu) | Average cycle (120 sfu) | Weak cycle (95 sfu) |
| --- | --- | --- | --- |
| 450 km | 1.0 yr | 1.8 yr | 2.9 yr |
| 480 km | 1.6 yr | 3.2 yr | 5.2 yr |
| 509 km | 2.5 yr | 5.4 yr | 9.2 yr |
| 520 km | 2.9 yr | 6.5 yr | 11.3 yr |
| 550 km | 4.6 yr | 10.9 yr | 19.8 yr |
| 580 km | 7.1 yr | 18.0 yr | 34.1 yr |
| 600 km | 9.4 yr | 24.9 yr | 48.2 yr |

The same paper documents FACSAT-2, launched to ~500 km in April 2023 with a predicted life of about 15 years, which re-entered after only 926 days because Solar Cycle 25 peaked stronger than forecast ([arXiv:2609.24534](https://arxiv.org/abs/2609.24534)). That is a ready-made game event.

**Coarser bands from other sources:**

| Altitude band | Typical lifetime | Source |
| --- | --- | --- |
| Below 600 km | Several years | [NASA Orbital Debris Program Office FAQ](https://orbitaldebris.jsc.nasa.gov/faq/) |
| 400 to 600 km | Strongly solar-cycle dependent, almost always under 25 years | [McDowell, Jonathan's Space Pages](https://planet4589.org/space/stats/pml.html) |
| ~800 km | Centuries (NASA FAQ); an older NASA text said "decades" | [NASA ODPO FAQ](https://orbitaldebris.jsc.nasa.gov/faq/) |
| Above 1,000 km | 1,000 years or more | [NASA ODPO FAQ](https://orbitaldebris.jsc.nasa.gov/faq/) |

**Our analysis (game curve).** A simple game model that fits the average-cycle column within 6% between 450 and 600 km: `lifetime_years ≈ L0 · exp((h − 450 km) / H)`, with H ≈ 57 km and L0 ≈ 1.8 years for B ≈ 70 kg/m². Multiply by roughly B/70 for other spacecraft (lifetime scales about linearly with B for a given atmosphere), by ~0.4 to 0.55 at solar maximum, or by ~1.6 to 1.9 in a weak cycle (ratios taken from the table). Extrapolating above 600 km is not supported by this table. Below ~350 km, life is weeks to months without propulsion. Treat this as a teaching approximation, not a design tool; real missions use tools such as NASA DAS or ESA DRAMA.

## Rocket equation, delta-v and transfers

### Tsiolkovsky rocket equation

```
Δv = Isp · g0 · ln(m0 / mf)
m_prop = m0 · (1 − exp(−Δv / (Isp · g0)))
```

**Worked example (our calculation):** a 500 kg spacecraft with a hydrazine monopropellant thruster (Isp ≈ 220 s) needs 22.6 kg of propellant for 100 m/s. A single stage with Isp 350 s would need a mass ratio of 15.5 to reach 9.4 km/s, which is why launchers use two or more stages.

### Delta-v budget reference

| Maneuver | Typical Δv (km/s) | Basis |
| --- | --- | --- |
| Surface to LEO (including gravity, drag and steering losses) | ~9.3 to 10 | Orbital speed ~7.7 km/s plus 1.5 to 2 km/s of losses ([Wikipedia, "Gravity loss"](https://en.wikipedia.org/wiki/Gravity_loss); *unverified*, flagged "citation needed" there) |
| Earth rotation bonus, eastward launch | +0.465 · cos(latitude) | 0.41 at Cape Canaveral (28.5°), 0.46 at Kourou (5.2°) (our calculation) |
| LEO 300 km to GTO (perigee burn) | 2.43 | Hohmann, our calculation |
| GTO to GEO, from 28.5° inclination | 1.83 | Combined circularize and plane change, our calculation |
| GTO to GEO, from 5.2° (Kourou) | 1.48 | Our calculation |
| GTO to GEO, from 0° | 1.47 | Our calculation |
| LEO 300 km to TLI (C3 ≈ −2 km²/s²) | 3.1 | Our calculation; ULA defines TLI as C3 = −2 km²/s² ([ULA Vulcan](https://www.ulalaunch.com/rockets/vulcan-centaur)) |
| LEO to Earth escape (C3 = 0) | 3.2 | Our calculation |
| LEO to trans-Mars (C3 ≈ 9 to 11 km²/s²) | 3.6 to 3.7 | Our calculation using 2026 optimal C3 of 9.1 to 11.1 km²/s² ([NASA Mars Mission Design Handbook](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20100037210.pdf)) |
| LEO to direct Jupiter Hohmann (C3 ≈ 77) | 6.3 | Our calculation; this is why real Jupiter missions use gravity assists |
| Lunar orbit insertion and Mars orbit insertion | ~0.8 to 1.0 (typical, depends on target orbit) | *unverified* typical range |
| LEO station-keeping (drag makeup) | ~0.03 to 0.07 over 2.5 to 5 years for a 6U at 500 km | [arXiv:2609.24534](https://arxiv.org/abs/2609.24534) |
| Plane change in LEO, 10° | 1.34 | `Δv = 2 v sin(Δi/2)`, our calculation |

### Hohmann transfer

```
a_t   = (r1 + r2) / 2
Δv1   = sqrt(μ (2/r1 − 1/a_t)) − sqrt(μ/r1)
Δv2   = sqrt(μ/r2) − sqrt(μ (2/r2 − 1/a_t))
TOF   = π · sqrt(a_t³ / μ)
```

**Worked examples (our calculation):** LEO 300 km to GEO takes 5.3 h and 2.43 + 1.47 = 3.90 km/s without a plane change. Earth to Mars (circular, coplanar planets) takes 259 days with a departure v∞ of 2.94 km/s (C3 = 8.7 km²/s²), close to the handbook's best real opportunities. Earth to Jupiter takes 2.7 years and needs C3 ≈ 77 km²/s².

### C3, launch windows and synodic periods

- **C3** is the characteristic energy, `C3 = v∞²` (km²/s²), the square of the speed left over after escaping Earth. Negative C3 means still bound to Earth (lunar trajectories, C3 ≈ −2), zero is escape, positive goes interplanetary. Launch vehicles publish payload-versus-C3 curves.
- **Synodic period** sets how often a window repeats: `1/S = |1/T_Earth − 1/T_planet|`. For Mars, S = 780 days (our calculation; NASA lists 779.94 days, [NSSDC](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)), so efficient Mars launches come about every 26 months ([NASA](https://mars.nasa.gov/mars2020/timeline/launch/launch-windows/)). Jupiter's synodic period is 399 days ([NSSDC](https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html)).
- A Mars **launch period** is a few weeks long; missing it means a ~26-month delay, which is a strong game consequence.

### Gravity assists

A flyby lets a spacecraft trade momentum with a planet. Relative to the planet its speed in and out is the same, but relative to the Sun its speed and direction change, at no propellant cost. Europa Clipper flew 884 km above Mars on March 1, 2025, and swings past Earth at about 3,200 km in December 2026, which together let it reach Jupiter on April 11, 2030 ([JPL](https://www.jpl.nasa.gov/news/nasas-europa-clipper-uses-mars-to-go-the-distance/), [NASA timeline](https://science.nasa.gov/mission/europa-clipper/mission-timeline/)). The cost is time and tighter launch windows.

### Launch site latitude and inclination

**Our analysis (standard relationships).** A rocket launched due east reaches an inclination equal to the site's latitude, the minimum possible without a plane change. Going to a lower inclination costs `Δv = 2 v sin(Δi/2)`, which is very expensive in LEO (a 28.5° change at 7.67 km/s costs 3.8 km/s) and much cheaper at GEO apogee speeds (1.5 km/s at 3.07 km/s). This is why GEO satellites do the plane change at apogee, and why near-equatorial sites like Kourou (5.2°) deliver more mass to GEO. Polar and SSO launches go north or south and get no rotation bonus.

## Launch vehicles

### How selection works

| Factor | What the team checks |
| --- | --- |
| Performance | Mass the vehicle can deliver to the exact orbit (altitude, inclination) or C3 |
| Fairing volume | Spacecraft must fit, stowed, inside the fairing; Vulcan's is 5.4 m diameter, Firefly Alpha's 2.2 m ([ULA](https://www.ulalaunch.com/rockets/vulcan-centaur), [Firefly](https://fireflyspace.com/alpha/)) |
| Environment | Vibration, acoustic, shock and acceleration loads the spacecraft must survive (owned by [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md)) |
| Reliability and certification | For NASA missions, the vehicle's risk category must match the payload's risk class |
| Cost and availability | Price, manifest slots, launch site, schedule risk |
| Rideshare vs dedicated | Rideshare is cheap but the orbit and date are set by the primary or the provider |

**NASA Launch Services Program risk categories** ([NPD 8610.7D](https://soma.larc.nasa.gov/simplex/pdf_files/NPD-8610-7D__main.pdf)):

| Category | Risk | Flight history required | Payload classes allowed (NPR 8705.4) |
| --- | --- | --- | --- |
| 1 | High | None; may use a vehicle's first flight | Class D |
| 2 | Medium | Limited history, e.g. 6 consecutive successful flights (Alternative 1) | Class C and D, sometimes B |
| 3 | Low | Robust history, e.g. 14 consecutive successful flights (Alternative 1) | Class A, B, C and D |

### Reference table (2025 to 2026)

Prices are **public estimates**, not quotes. Government missions pay more because they include mission assurance and integration. Performance is to the orbit stated by the provider; "n/p" means not published in a source we could verify.

| Vehicle | LEO | SSO | GTO | TLI / escape | Approx. price (date, status) |
| --- | --- | --- | --- | --- | --- |
| Rocket Lab Electron | 300 kg ([Rocket Lab](https://rocketlabcorp.com/launch/electron/)) | ~200 kg to 500 km SSO ([Rocket Lab update](https://rocketlabcorp.com/updates/rocket-lab-increases-electron-payload-capacity-enabling-interplanetary-missions-and-reusability/)) | n/a | Small lunar/interplanetary with Photon kick stage | ~$7.5 M list; ~$8.4 M average revenue per launch (2024 to 2025, *unverified*, [Orbital Radar](https://orbitalradar.com/launch-vehicles/electron), [Kulu IAC 2025](https://www.newspace.im/assets/Small-Launchers-2025_Erik-Kulu_IAC2025.pdf)) |
| Firefly Alpha | 1,030 kg to 300 km | 630 kg to 500 km ([Firefly](https://fireflyspace.com/alpha/)) | n/a | n/a | $19 M dedicated per Alpha Payload User's Guide 5.2 (July 2025); older figure $15 M (*unverified*, reported via search of [Firefly PUG 5.2](https://fireflyspace.com/wp-content/uploads/2025/07/Alpha-PUG-5.2.pdf)) |
| SpaceX Falcon 9 | 22,800 kg expendable; ~17,500 kg with droneship recovery (*unverified*, secondary sources) | n/p | 8,300 kg expendable; up to 5.5 t at list price ([KeepTrack](https://keeptrack.space/deep-dive/how-much-does-a-falcon-9-launch-cost)) | n/p | $74 M list in 2026, up from ~$70 M (reported, *unverified*, [KeepTrack](https://keeptrack.space/deep-dive/how-much-does-a-falcon-9-launch-cost), Ars Technica Rocket Report, March 2026) |
| SpaceX Falcon Heavy | 63,800 kg | n/p | 26,700 kg | 16,800 kg to Mars ([SpaceX](https://spacex.com/vehicles/falcon-heavy)) | ~$97 M (*unverified*, [NewSpace Economy](https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/)) |
| SpaceX rideshare (Transporter, Bandwagon) | Mid-inclination on request | Main product | On request | On request | $350,000 for up to 50 kg to SSO plus $7,000/kg (2026); was $5,500/kg, then $6,500/kg in 2025 ([Payload](https://payloadspace.com/spacex-increases-rideshare-prices), [NewSpace Economy](https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/); secondary, *unverified* against SpaceX) |
| ULA Vulcan Centaur | VC0 10,800 kg to 200 km/28.7°; VC6 27,200 kg | LEO-Polar 200 km: 8,500 (VC0) to 23,900 kg (VC6) | 3,500 (VC0) to 14,500 kg (VC6) | TLI 2,300 to 11,500 kg ([ULA](https://www.ulalaunch.com/rockets/vulcan-centaur)) | ~$110 M catalogue; government missions ~$100 to 150 M (*unverified*, [SpaceNexus](https://spacenexus.us/compare/vulcan-centaur-vs-falcon-9)) |
| Blue Origin New Glenn (7×2) | 45 t | n/p | >13 t ([Blue Origin](https://www.blueorigin.com/new-glenn)) | n/p | No published price; NASA paid $18 M for the ESCAPADE launch (a special case); estimates $68 to 110 M (*unverified*, [Payload](https://payloadspace.com/new-glenn-launches-escapade-a-nasa-mission-to-mars/)) |
| Ariane 62 | 10,350 kg to 200 km/5.2° | n/p | ~4,500 kg | n/p | ESA paid €82 M for Sentinel-1D (Nov 2025) ([European Spaceflight](https://europeanspaceflight.com/?p=6303)); 2018 target ~€70 to 75 M |
| Ariane 64 | 21,650 kg | n/p | 11,500 kg ([ArianeGroup](https://ariane.group/?p=10428), [AIAA guide](https://aiaa.org/vehicle-guide/vehicles/ariane/performance)) | n/p | ~€115 M (2018 estimate, *unverified*) |
| Vega-C | n/p | ~2,350 kg to 700 km SSO (*unverified*) | n/a | n/a | ~€40 M (*unverified*) |
| ISRO PSLV-XL | n/p | 1,750 kg to 600 km SSPO; 1,425 kg to sub-GTO ([ISRO](https://www.isro.gov.in/PSLV_CON.html)) | Sub-GTO only | n/a | Not published |
| NASA SLS Block 1 | n/a | n/a | n/a | >27 t to the Moon ([NASA fact sheet, Dec 2025](https://www.nasa.gov/wp-content/uploads/2026/01/sls-5640-sls-fact-sheet-dec2025-508.pdf)) | NASA OIG: ~$4.1 B per SLS/Orion launch for Artemis I to IV, later ≥$4.2 B; includes Orion and ground systems ([NASA OIG IG-22-003](https://oig.nasa.gov/docs/IG-22-003.pdf)) |
| SpaceX Starship (test) | First orbital flight and payload deployment on Flight 14, Sep 28, 2026 (26 Starlink V3, ~44 t extrapolated); Flight 15 on Nov 13, 2026 reached orbit, booster lost ([Wikipedia list](https://en.wikipedia.org/wiki/List_of_Starship_launches), [CNN](https://www.cnn.com/2026/11/13/science/live-news/spacex-starship-flight-15-ship-catch)) | n/p | n/p | Requires orbital refuelling for deep space | Not commercially priced; still in test (*unverified* capacity) |

**Our analysis (price per kg, for game balancing).** Falcon 9 rideshare at ~$7,000/kg is the cheapest public per-kg price. A dedicated Electron at ~$7.5 M for ~200 kg to SSO is ~$37,500/kg, but the customer picks the orbit and date. A 10 kg CubeSat on rideshare still pays the 50 kg minimum, so it effectively pays $35,000/kg ([NewSpace Economy](https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/)). Small university CubeSats can also apply to NASA's CubeSat Launch Initiative for a free ride ([NASA CSLI](https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/)), deployed from standard dispensers.

## Ground segment and communications geometry

Link budgets are in [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md). This section is about which antennas exist, when a spacecraft can see them, and how contact time is shared.

### Networks

| Network | What it is | Key facts |
| --- | --- | --- |
| NASA Near Space Network (NSN) | Government and commercial stations plus relay satellites for missions out to ~2 million km | Formed October 2020; serves out to 2 million km; returns ~30 TB per day on average ([NASA SST SOA ch. 11, 2026](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)). NASA already buys ~60% of required passes from commercial and university partners ([SpaceOps 2023](https://publications.spaceops.org/2023/download_by_id.php?id=0359)) |
| TDRS (relay in GEO) | Tracking and Data Relay Satellites | Stopped accepting new missions November 8, 2024; existing users such as ISS and Hubble continue until the mid-2030s; NASA aims for commercial relay services by 2031 ([NASA](https://www.nasa.gov/missions/tdrs/nasa-to-embrace-commercial-sector-fly-out-legacy-relay-fleet/)) |
| NASA Deep Space Network (DSN) | Goldstone (California), Madrid (Spain), Canberra (Australia), ~120° apart in longitude so a deep-space craft always sees one site ([NASA](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/dsn-complexes/)) | Each site has one 70 m antenna and several 34 m beam-waveguide antennas; arraying 34 m dishes can stand in for a 70 m ([NASA](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/dsn-complexes/), [NASA OIG IG-23-016](https://oig.nasa.gov/wp-content/uploads/2023/12/ig-23-016.pdf)). The OIG found the DSN oversubscribed |
| KSAT | Commercial (Norway); Svalbard polar site | 100+ KSATlite antennas at 15+ sites; 1.5 million passes in 2023 ([NASA SST SOA](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)) |
| AWS Ground Station | Ground-station-as-a-service | 5.4 m antennas; bookings can change up to 15 min before a pass ([NASA SST SOA](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)) |
| SSC, Viasat, ATLAS, Leaf Space | Other commercial providers | ATLAS: 34 stations, 51 antennas; Viasat 7.3 m and 5.4 m antennas ([NASA SST SOA](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)) |

### Frequency bands

| Band | Typical use | Notes |
| --- | --- | --- |
| UHF (~400 MHz) | CubeSat telemetry, Mars surface-to-orbiter relay | Low data rate, simple antennas |
| S-band | Telemetry, tracking and command; uplink 2,025 to 2,110 MHz, downlink 2,200 to 2,290 MHz ([NASA SST SOA](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)) | Robust, moderate rates |
| X-band | Science downlink; 8,025 to 8,400 MHz for near-Earth ([NASA SST SOA](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)) | Workhorse for Earth observation and deep space |
| Ka-band | High-rate downlink, 25.5 to 27 GHz near-Earth ([NASA SST SOA](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)) | Very high rates, rain fade |
| Optical (laser) | Demonstrations moving to service | LCRD/ILLUMA-T: 1.244 Gbps from the ISS through a GEO relay, first light Dec 5, 2023 ([NASA NTRS](https://ntrs.nasa.gov/citations/20250000325)). DSOC on Psyche: 267 Mbps peak, 25 Mbps from ~140 million miles, final pass Sep 2, 2025 at 218 million miles ([NASA](https://www.nasa.gov/missions/psyche-mission/nasas-optical-comms-demo-transmits-data-over-140-million-miles/)) |

### Contact time and latency

**Our analysis.** Values in this table come from the pass formula above and general geometry, not from a single published source.

| Orbit | Typical contact per station per day | Data latency (time from collection to ground) | Comment |
| --- | --- | --- | --- |
| LEO, one mid-latitude station | ~30 to 40 min over 4 to 6 passes | Up to ~12 h if the right station is not in view | Main bottleneck for data-heavy payloads |
| LEO SSO, polar station | ~90 to 110 min | ~1 orbit (~100 min) | Why KSAT's Svalbard is valuable |
| LEO with GEO relay (TDRS, LCRD) | Most of the orbit | Near real-time | Costs relay hardware and service time |
| GEO | 24 h | Real-time | No scheduling problem |
| L1, L2, deep space | One DSN pass of hours per day, shared | Seconds to an hour of light time plus scheduling | DSN time is a contested resource |

## Operations concept

### Mission phases

| Phase | What happens | Duration (typical) | Team intensity |
| --- | --- | --- | --- |
| Launch | Countdown, ascent, separation | Minutes to hours | Peak |
| LEOP (launch and early orbit phase) | First signal, solar array deploy, sun pointing, health checks, orbit determination; extra station time and staff are scheduled ([NASA SST SOA](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)) | Days | Peak, 24/7 |
| Transfer or cruise | Orbit raising, trajectory correction burns, gravity assists | Days (LEO) to years (Jupiter) | Low with bursts |
| Commissioning | Instrument switch-on, calibration, deployments | Weeks to ~6 months (Webb took about six months, *unverified* here) | High |
| Science (prime) operations | Planned observations and data return | Months to years | Steady, routine |
| Extended mission | Continued operations after prime goals, reviewed and funded in cycles | Years | Lower staffing |
| Disposal | Deorbit, move to graveyard orbit, or passivation | Days to months | Moderate |

The lifecycle phases and reviews that bracket these are in [01-mission-lifecycle.md](01-mission-lifecycle.md).

### Command and telemetry flow

**Our analysis (standard architecture).** The mission operations center (MOC) plans activities, builds and checks command loads, and monitors spacecraft health. Commands go from the MOC to a ground station, then up to the spacecraft during a scheduled pass. Telemetry (health data) and science data come down during passes, are stored by the station, and are forwarded to the MOC and to a science operations center (SOC) that processes and archives data. Stations store data for 5 to 30 days ([NASA SST SOA](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)). Typical roles: flight director, spacecraft engineers per subsystem, flight dynamics (orbit determination and maneuver planning), ground system and scheduling, and instrument teams.

### Autonomy, safe mode and cost

| Topic | Key points |
| --- | --- |
| Ground in the loop | Practical in LEO and GEO where light time is under a second, but limited by pass gaps |
| Onboard autonomy | Required when delay or gaps are long (Mars, Jupiter): stored sequences, onboard fault protection |
| Safe mode | When the spacecraft detects a fault it turns off non-essential loads, points arrays at the Sun, and waits for the ground. Hubble entered safe mode several times in 2021 and was recovered by ground teams ([NASA](https://nasa.gov/solar-system/nasa-returns-hubble-to-full-science-operations)) |
| Routine protective modes | Hubble turns off its science instruments in the South Atlantic Anomaly, which it crosses on about 10 orbits a day ([NASA](https://science.nasa.gov/mission/hubble/observatory/hubble-vs-webb/)) |
| Ops cost drivers | Team size and shifts (24/7 vs business hours), number and price of station contacts, DSN time, mission length, and how much autonomy reduces staffing. Cost models are in [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md) |

## Mission-type templates

| Mission | Orbit / trajectory | Why chosen | Key trade that drove it |
| --- | --- | --- | --- |
| Earth observation: Landsat 9 | 705 km SSO, 98.2°, 10:12 a.m. descending node, 16-day repeat, 185 km swath; launched on Atlas V 401, Sep 27, 2021 ([USGS](https://www.usgs.gov/landsat-missions/landsat-9), [NASA](https://science.nasa.gov/mission/landsat-9/)) | Same lighting every pass for 50-year continuity; global coverage | Resolution (30 m) vs swath vs revisit; paired with Landsat 8 for 8-day revisit; up to 750 scenes per day ([USGS](https://www.usgs.gov/landsat-missions/landsat-9)) |
| Space weather at L1: ACE, DSCOVR, IMAP | Sun–Earth L1 halo/Lissajous, ~1.5 million km sunward | Samples solar wind about an hour before it reaches Earth; DSCOVR gives 15 to 60 min storm warning ([NOAA](https://www.nesdis.noaa.gov/our-satellites/currently-flying/dscovr-deep-space-climate-observatory)) | Warning time vs distance; DSCOVR took over the operational L1 role from ACE in July 2016. IMAP launched Sep 24, 2025 on Falcon 9 with Carruthers and NOAA SWFO-L1 as rideshares ([NASA](https://science.nasa.gov/science-research/heliophysics/upcoming-launch-to-boost-nasas-study-of-suns-influence-across-space/)) |
| Astrophysics at L2: JWST | Halo orbit around Sun–Earth L2, ~1.5 million km, ~6-month period | Keeps Sun, Earth and Moon on one side behind the sunshield; no eclipses, stable cold temperatures ([NASA](https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/)) | Thermal stability and sky access vs distance (no servicing, DSN-only comms, station-keeping about every three weeks) |
| Lunar: LRO | 50 km mean polar orbit for over 2 years, then 40 × 180 km frozen orbit from Dec 2011 ([NASA NTRS](https://ntrs.nasa.gov/api/citations/20230010952/downloads/Mesarch_LROLongTermOrbit_Preprint_20230727.pdf)) | Low altitude for high-resolution global mapping | Resolution vs propellant: monthly station-keeping used ~7 kg each, so the team moved to a frozen orbit to save fuel ([NASA NTRS](https://ntrs.nasa.gov/api/citations/20140008962/downloads/20140008962.pdf)) |
| Mars orbiter: MRO | 255 × 320 km sun-synchronous, ~3 p.m. local time, reached by six months of aerobraking ([NASA NTRS](https://ntrs.nasa.gov/citations/20080032390), [NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2005-029A)) | Consistent lighting for imaging; also serves as a relay for landers | Propellant vs time: aerobraking replaced a large insertion burn but added months and risk |
| Outer planets: Europa Clipper | Launched Oct 14, 2024 on Falcon Heavy; Mars assist Mar 1, 2025; Earth assist Dec 2026; Jupiter orbit Apr 11, 2030; ~49 Europa flybys from 2031 (*flyby count unverified here*) ([JPL](https://www.jpl.nasa.gov/news/nasas-europa-clipper-uses-mars-to-go-the-distance/), [NASA](https://science.nasa.gov/mission/europa-clipper/mission-timeline/)) | Gravity assists replace the ~77 km²/s² C3 a direct trajectory would need | Launch cost and mass vs cruise time; Jupiter orbit with repeated flybys instead of orbiting Europa keeps radiation dose down |

## Space environment and orbit choice

| Hazard | Where it matters | Effect on design | Source |
| --- | --- | --- | --- |
| Atomic oxygen | Most abundant species between ~180 and 650 km | Erodes polymers such as Kapton (erosion yield 3.0 × 10⁻²⁴ cm³/atom); needs oxide coatings | [NASA NTRS (Banks et al.)](https://ntrs.nasa.gov/api/citations/20040087142/downloads/20040087142.pdf) |
| Van Allen belts | Inner belt peaks ~1,000 to 6,000 km, outer belt ~13,000 to 60,000 km (*unverified* ranges); MEO and GTO cross them | Highest total ionizing dose; needs radiation-hardened parts or shielding | Qualitative ranking from [NASA KSC reliability practice 1258](https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1258.pdf) |
| South Atlantic Anomaly | Weak spot in Earth's field over South America and the South Atlantic where the inner belt dips closer to the atmosphere | Bit flips, detector noise; instruments often switched off during crossings | [NASA](https://science.nasa.gov/earth/earth-observatory/a-fire-in-the-middle-of-the-atlantic-ocean-144141/), [NASA ICON](https://www.nasa.gov/missions/icon/nasa-researchers-track-slowly-splitting-dent-in-earths-magnetic-field/) |
| Total ionizing dose (TID) | LEO below ~500 km: ~100 to 1,000 rad(Si)/yr typical from trapped particles; MEO much higher; GEO intermediate; deep space dominated by solar events and cosmic rays | Sets parts grade and shielding mass | [NASA KSC 1258](https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1258.pdf); MEO/GEO ranking *unverified* numerically |
| Debris | ~550 km now has debris objects in the same order of magnitude as active satellites; about a quarter of constellation payloads fly below 500 km ([ESA Space Environment Report 2025](https://www.esa.int/Space_Safety/Space_Debris/ESA_Space_Environment_Report_2025)); 750 to 1,000 km holds long-lived fragments from the 2007 Fengyun-1C test and 2009 Iridium–Cosmos collision (*unverified* peak altitude) | Collision avoidance maneuvers; disposal rules push missions to deorbit within 25 years (US) or 5 years (FCC rule for LEO licenses, [FCC 22-74](https://docs.fcc.gov/public/attachments/FCC-22-74A1_Rcd.pdf); details in [01-mission-lifecycle.md](01-mission-lifecycle.md#end-of-mission)) | ESA, NASA ODPO |
| Charging | GEO and outer belt | Surface and internal charging can cause arcs | General; see [03-spacecraft-subsystems.md](03-spacecraft-subsystems.md) |

**Our analysis (orbit choice summary).** Lower LEO (300 to 450 km) self-cleans debris and has low radiation and great resolution but short life. Mid LEO (500 to 600 km) is the most crowded band. High LEO (700 to 1,000 km) gives long life and wide swaths but more radiation and lasting debris risk. MEO is the radiation worst case. GEO has continuous comms but costs much more Δv. L1, L2 and heliocentric orbits escape the belts, eclipses and drag but require deep-space comms.

## Key numbers for the game

| Quantity | Value | Units | Source |
| --- | --- | --- | --- |
| μ_Earth | 398,600.4418 | km³/s² | Standard |
| Earth equatorial radius | 6,378 | km | Standard |
| LEO lower practical limit | ~180 | km | [ESA](https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits) |
| ISS orbit | 370 to 460, 51.6° | km | [NASA](https://eol.jsc.nasa.gov/Tools/orbitTutorial.htm) |
| Period at 400 / 705 km | 92.6 / 98.9 | min | Our calculation |
| Max eclipse at 400 / 705 km | 36 / 35 | min per orbit | Our calculation |
| GEO altitude / period | 35,786 / 23 h 56 min | km / time | [ESA](https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits) |
| GPS altitude | ~20,200 | km | [NASA Earth Observatory](https://science.nasa.gov/earth/earth-observatory/catalog-of-earth-satellite-orbits) |
| L1 / L2 distance | ~1.5 million | km | [NOAA](https://www.nesdis.noaa.gov/our-satellites/currently-flying/dscovr-deep-space-climate-observatory), [NASA](https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/) |
| Landsat 9 | 705 km, 98.2°, 16-day repeat, 185 km swath | various | [USGS](https://www.usgs.gov/landsat-missions/landsat-9), [NASA](https://science.nasa.gov/mission/landsat-9/) |
| Max LEO pass at 500 km, 10° mask | 7.4 | min | Our calculation |
| Lifetime at 450 / 550 / 600 km (6U, average cycle) | 1.8 / 10.9 / 24.9 | years | [arXiv:2609.24534](https://arxiv.org/abs/2609.24534) |
| Surface to LEO Δv | ~9.3 to 10 | km/s | *unverified* ([Wikipedia](https://en.wikipedia.org/wiki/Gravity_loss)) |
| LEO to GTO / GTO to GEO (28.5°) | 2.43 / 1.83 | km/s | Our calculation |
| LEO to TLI / escape / Mars | 3.1 / 3.2 / ~3.6 | km/s | Our calculation |
| Mars synodic period | 780 (~26 months) | days | [NSSDC](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| Earth–Mars Hohmann transfer | ~259 | days | Our calculation |
| One-way light time Moon / Mars / Jupiter | 1.3 s / 3 to 22 min / 33 to 54 min | time | Our calculation from NSSDC distances |
| Falcon 9 rideshare | $350k per 50 kg + $7,000/kg | USD (2026) | *unverified* secondary |
| Falcon 9 dedicated | ~$74 M | USD (2026) | *unverified* secondary |
| Electron dedicated | ~$7.5 M for ~200 kg to SSO | USD | *unverified* secondary |
| SLS/Orion per launch | ~$4.1 B | USD | [NASA OIG](https://oig.nasa.gov/docs/IG-22-003.pdf) |
| LSP Category 3 certification | 14 consecutive successes (one alternative) | flights | [NPD 8610.7D](https://soma.larc.nasa.gov/simplex/pdf_files/NPD-8610-7D__main.pdf) |
| DSN sites | 3, ~120° apart; one 70 m + several 34 m each | sites, antennas | [NASA](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/dsn-complexes/) |
| Optical comms demos | 1.244 Gbps (LCRD/ILLUMA-T), 267 Mbps peak (DSOC) | bit/s | [NASA NTRS](https://ntrs.nasa.gov/citations/20250000325), [NASA](https://www.nasa.gov/missions/psyche-mission/nasas-optical-comms-demo-transmits-data-over-140-million-miles/) |

## Game implications

**Our analysis.** These are suggestions for turning the material into mechanics, mapped to the feature IDs in [challenge brief](../../challenge-brief.md).

| Concept | Possible mechanic | Feature IDs |
| --- | --- | --- |
| Orbit menu with trade-offs | Offer 6 to 8 orbit cards (LEO 400, SSO 705 mid-morning, SSO dawn-dusk, MEO, GEO, L1, L2, lunar, Mars) showing period, eclipse, revisit, radiation, lifetime and comms as icon bars | ORB-01, EDU-03 |
| Altitude slider | Live update of period (Kepler), GSD (`h·p/f`), swath and revisit as the player drags altitude; show the diffraction floor | ORB-02, EDU-03, EXT-07 |
| Lifetime vs altitude | Use the exponential fit or the table; random "solar maximum" event that halves remaining life (FACSAT-2 story) | ORB-03, RES-06 |
| Eclipse and power | Feed eclipse fraction `asin(R_E/a)/π` into the power model; dawn-dusk SSO removes most eclipses but hurts optical imaging | ORB-03, RES-02 (with 03 file) |
| Ground station passes | Daily downlink = passes × pass length × data rate; buying a polar station or relay service costs money but multiplies contact time | RES-05, RES-04, RES-03 |
| Light-time delay | At Mars or Jupiter, commands take minutes; players must queue sequences and rely on safe mode | RES-05, EXT-04 |
| Launch vehicle check | Compare spacecraft wet mass with the vehicle's mass to the chosen orbit or C3; reject if over capacity or fairing too small | ORB-04, ORB-05, RES-01 |
| Rideshare vs dedicated | Rideshare is cheap per kg but forces SSO and a fixed date; dedicated costs more but gives any orbit and date | ORB-04, RES-03, RES-06 |
| Risk categories | Higher-class (flagship) payloads may only launch on Category 3 vehicles; new rockets are cheaper but higher failure chance | ORB-04, EXT-02 |
| Delta-v budget | Show a Δv bar: launch to LEO, then transfers (GTO, TLI, Mars); rocket equation turns Δv into propellant mass | RES-01, EDU-03 |
| Launch windows | Mars missions must launch inside a window every ~26 months; missing it adds a 26-month delay and cost | RES-06, EXT-04 |
| Gravity assists | Optional trajectory that cuts launch mass but adds years of cruise (Europa Clipper template) | EXT-04, RES-06 |
| Mission templates | Ready-made scenarios: Landsat-style EO, L1 space weather, L2 telescope, LRO-style lunar mapper, MRO-style Mars orbiter, Europa Clipper-style outer planets | EXT-04, MIS-01 |
| Space environment | Radiation and debris risk score per orbit; SAA crossings cause instrument downtime; atomic oxygen degrades surfaces in low LEO | ORB-03, RES-06 |
| Operations phases | Simulation timeline with LEOP, commissioning, science, extended, disposal; safe-mode events pause science | RES-06, EXT-10 |
| Visual orbit view | 3D globe with ground track, swath and station visibility circles | EXT-07, ORB-02 |

## Sources

Standard texts
- Wertz, J. R., Everett, D. F., Puschell, J. J. (eds.). *Space Mission Engineering: The New SMAD*. Microcosm Press, 2011. https://www.sme-smad.com/
- Curtis, H. D. *Orbital Mechanics for Engineering Students*, 4th ed. Elsevier, 2020. https://www.sciencedirect.com/book/9780128240250/orbital-mechanics-for-engineering-students

NASA, NOAA, ESA and official documents
- ESA, Types of orbits: https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits
- NASA Earth Observatory, Catalog of Earth Satellite Orbits: https://science.nasa.gov/earth/earth-observatory/catalog-of-earth-satellite-orbits
- NASA, Space Station Orbit Tutorial: https://eol.jsc.nasa.gov/Tools/orbitTutorial.htm
- NASA, ISS FAQ: https://www.nasa.gov/international-space-station-frequently-asked-questions/
- USGS, Landsat 9: https://www.usgs.gov/landsat-missions/landsat-9
- NASA Science, Landsat 9: https://science.nasa.gov/mission/landsat-9/
- NASA NSSDC fact sheets (Moon, Mars, Jupiter): https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- NASA NSSDC, MRO: https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2005-029A
- NASA NTRS, Overview of the MRO Science Mission: https://ntrs.nasa.gov/citations/20080032390
- NASA NTRS, LRO long-term orbit operations (2023): https://ntrs.nasa.gov/api/citations/20230010952/downloads/Mesarch_LROLongTermOrbit_Preprint_20230727.pdf
- NASA NTRS, LRO orbit determination accuracy analysis: https://ntrs.nasa.gov/api/citations/20140008962/downloads/20140008962.pdf
- NASA NTRS, Perturbations and recovery in the Gateway NRHO: https://ntrs.nasa.gov/citations/20220019129
- NASA, Webb telescope overview: https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/
- NASA, Webb's orbit at L2: https://science.nasa.gov/asset/webb/webbs-orbit-at-sun-earth-lagrange-point-2-l2/
- NASA, Kepler press kit (2009): https://ntrs.nasa.gov/api/citations/20100002027/downloads/20100002027.pdf
- NOAA NESDIS, DSCOVR: https://www.nesdis.noaa.gov/our-satellites/currently-flying/dscovr-deep-space-climate-observatory
- NASA, IMAP and rideshare launch: https://science.nasa.gov/science-research/heliophysics/upcoming-launch-to-boost-nasas-study-of-suns-influence-across-space/
- JPL, Europa Clipper uses Mars: https://www.jpl.nasa.gov/news/nasas-europa-clipper-uses-mars-to-go-the-distance/
- NASA, Europa Clipper mission timeline: https://science.nasa.gov/mission/europa-clipper/mission-timeline/
- NASA, Mars 2020 launch windows: https://mars.nasa.gov/mars2020/timeline/launch/launch-windows/
- NASA, Earth-to-Mars Mission Design Handbook 2026 to 2045: https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20100037210.pdf
- NASA NPD 8610.7D, Launch Services Risk Mitigation Policy: https://soma.larc.nasa.gov/simplex/pdf_files/NPD-8610-7D__main.pdf
- NASA, CubeSat Launch Initiative: https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/
- NASA, SLS fact sheet (Dec 2025): https://www.nasa.gov/wp-content/uploads/2026/01/sls-5640-sls-fact-sheet-dec2025-508.pdf
- NASA OIG, IG-22-003 NASA's Management of the Artemis Missions: https://oig.nasa.gov/docs/IG-22-003.pdf
- NASA OIG, IG-23-016 Audit of NASA's Deep Space Network: https://oig.nasa.gov/wp-content/uploads/2023/12/ig-23-016.pdf
- NASA, Where is the DSN located: https://www.nasa.gov/directorates/somd/space-communications-navigation-program/dsn-complexes/
- NASA, State of the Art of Small Spacecraft Technology, ch. 11 Ground Data Systems and Mission Operations (2026): https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations
- NASA, TDRS fly-out and commercial transition: https://www.nasa.gov/missions/tdrs/nasa-to-embrace-commercial-sector-fly-out-legacy-relay-fleet/
- SpaceOps 2023, NASA direct-to-Earth commercial strategy paper: https://publications.spaceops.org/2023/download_by_id.php?id=0359
- NASA NTRS, ILLUMA-T experimental results: https://ntrs.nasa.gov/citations/20250000325
- NASA, DSOC transmits data over 140 million miles: https://www.nasa.gov/missions/psyche-mission/nasas-optical-comms-demo-transmits-data-over-140-million-miles/
- NASA, Hubble returns to full science operations: https://nasa.gov/solar-system/nasa-returns-hubble-to-full-science-operations
- NASA, Hubble vs Webb: https://science.nasa.gov/mission/hubble/observatory/hubble-vs-webb/
- NASA Earth Observatory, South Atlantic Anomaly: https://science.nasa.gov/earth/earth-observatory/a-fire-in-the-middle-of-the-atlantic-ocean-144141/
- NASA, splitting dent in Earth's magnetic field: https://www.nasa.gov/missions/icon/nasa-researchers-track-slowly-splitting-dent-in-earths-magnetic-field/
- NASA NTRS, LEO atomic oxygen interactions with materials: https://ntrs.nasa.gov/api/citations/20040087142/downloads/20040087142.pdf
- NASA KSC, Reliability Preferred Practice 1258 (space radiation): https://extapps.ksc.nasa.gov/Reliability/Documents/Preferred_Practices/1258.pdf
- NASA Orbital Debris Program Office FAQ: https://orbitaldebris.jsc.nasa.gov/faq/
- ESA Space Environment Report 2025: https://www.esa.int/Space_Safety/Space_Debris/ESA_Space_Environment_Report_2025

Launch providers
- ULA, Vulcan Centaur: https://www.ulalaunch.com/rockets/vulcan-centaur
- Firefly, Alpha: https://fireflyspace.com/alpha/ and Alpha Payload User's Guide 5.2: https://fireflyspace.com/wp-content/uploads/2025/07/Alpha-PUG-5.2.pdf
- Rocket Lab, Electron: https://rocketlabcorp.com/launch/electron/ and capacity update: https://rocketlabcorp.com/updates/rocket-lab-increases-electron-payload-capacity-enabling-interplanetary-missions-and-reusability/
- SpaceX, Falcon Heavy: https://spacex.com/vehicles/falcon-heavy
- Blue Origin, New Glenn: https://www.blueorigin.com/new-glenn
- ArianeGroup, Number-crunching Ariane 6: https://ariane.group/?p=10428
- AIAA Vehicle Guide, Ariane performance: https://aiaa.org/vehicle-guide/vehicles/ariane/performance
- ISRO, PSLV: https://www.isro.gov.in/PSLV_CON.html

Peer-reviewed, preprints and secondary sources (lower confidence)
- Vargas Domínguez, S., Angel, M. V., Buitrago, B. N. "Premature re-entry of the FACSAT-2 nanosatellite." arXiv:2609.24534 (2026, preprint): https://arxiv.org/abs/2609.24534
- McDowell, J. Jonathan's Space Pages, orbital lifetimes: https://planet4589.org/space/stats/pml.html
- Kulu, E. Small Launchers 2025 (IAC 2025): https://www.newspace.im/assets/Small-Launchers-2025_Erik-Kulu_IAC2025.pdf
- Payload, SpaceX increases rideshare prices: https://payloadspace.com/spacex-increases-rideshare-prices
- Payload, New Glenn launches ESCAPADE: https://payloadspace.com/new-glenn-launches-escapade-a-nasa-mission-to-mars/
- NewSpace Economy, SpaceX rideshare pricing as of February 2026: https://newspaceeconomy.ca/2026/02/27/spacex-rideshare-pricing-as-of-february-2026-what-it-costs-whats-included-and-how-buyers-budget-a-mission/
- KeepTrack, Falcon 9 launch cost: https://keeptrack.space/deep-dive/how-much-does-a-falcon-9-launch-cost
- Orbital Radar, Electron: https://orbitalradar.com/launch-vehicles/electron
- SpaceNexus, Vulcan vs Falcon 9: https://spacenexus.us/compare/vulcan-centaur-vs-falcon-9
- European Spaceflight, ESA spent €82 million on Sentinel-1D launch: https://europeanspaceflight.com/?p=6303
- SpacePolicyOnline, NASA rolls out new Moon plan: https://spacepolicyonline.com/news/nasa-rolls-out-new-moon-plan/
- Satellite Today, proposed NASA budget cuts (May 2025): https://www.satellitetoday.com/finance/2025/05/05/trumps-proposed-nasa-budget-looks-to-cut-funding-by-24/
- Wikipedia, List of Starship launches: https://en.wikipedia.org/wiki/List_of_Starship_launches
- CNN, Starship Flight 15 live updates (Nov 13, 2026): https://www.cnn.com/2026/11/13/science/live-news/spacex-starship-flight-15-ship-catch
- Wikipedia, Gravity loss: https://en.wikipedia.org/wiki/Gravity_loss
