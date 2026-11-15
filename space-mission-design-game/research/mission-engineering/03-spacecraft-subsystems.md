# Spacecraft Subsystems: Sizing and Trade-offs

This file explains how the space segment of a mission is designed: what each subsystem does, how engineers size it, and how a change in one subsystem ripples through the others. It is written for the game team, so it pairs sourced engineering facts with formulas, representative component values, and worked sizing examples that a simplified simulation can reuse.

Researched November 14, 2026. Official facts carry inline source links. Sections and table rows labeled **Analysis** are our own calculations or simplifications, not NASA guidance. Values marked *unverified* rest on a single or weak source, or sources disagree.

Quick navigation: [Overview and coupling](#overview-payload-bus-and-coupling) · [Payload](#payload-and-instruments) · [Power](#power) · [Thermal](#thermal-control) · [Structure](#structure-and-mechanisms) · [Propulsion](#propulsion) · [ADCS](#attitude-determination-and-control-adcs) · [C&DH](#command-and-data-handling-cdh) · [Telecom](#telecommunications) · [Margins](#mass-budget-and-margins) · [Reliability](#reliability-and-redundancy) · [Component catalog](#component-catalog-for-the-game) · [Worked examples](#worked-sizing-examples) · [Key numbers](#key-numbers-for-the-game) · [Game implications](#game-implications) · [Sources](#sources)

Related files: lifecycle and reviews are in [01-mission-lifecycle.md](01-mission-lifecycle.md); orbits, launch vehicles, and ground station geography are in [02-mission-design-orbits-launch.md](02-mission-design-orbits-launch.md); cost estimating and failure case studies are in [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md).

## Overview: payload, bus, and coupling

A spacecraft is split into the **payload** (the instruments that do the mission, such as a camera or radar) and the **bus** (everything that keeps the payload alive, pointed, powered, and talking to Earth). The bus subsystems are structure and mechanisms, power, thermal control, propulsion, attitude determination and control (ADCS, sometimes called GNC), command and data handling (C&DH), and telecommunications. The game feature register maps closely onto this split: SPC-01 structure, SPC-02 power, SPC-03 communications, SPC-04 computing, SPC-05 attitude control, SPC-06 instruments ([challenge brief](../../challenge-brief.md)).

The subsystems are tightly coupled. Engineers describe design as iterating around a loop until mass, power, data, and cost all close with margin. Two classic chains:

- **Bigger instrument chain:** a larger aperture gives finer resolution, which adds instrument mass and power, which needs bigger solar arrays and batteries, which adds more mass, which needs more structure and a bigger launcher, which costs more.
- **More data chain:** finer resolution or more spectral bands produce more bits, which need more onboard storage and more downlink, which needs a bigger antenna, more transmitter power, more ground passes, or a higher frequency band. More transmitter power then feeds back into the power chain.

### Coupling map

**Analysis.** Rows are the subsystem being changed; columns show what it pushes on. "+" means an increase in the row usually increases the column's requirement. This is our synthesis of the subsystem descriptions in the [NASA SmallSat State-of-the-Art report (SoA 2026)](https://www.nasa.gov/smallsat-institute/sst-soa/) and the sizing methods below.

| Change (row) → affects (column) | Mass | Power | Thermal | Pointing (ADCS) | Data / storage | Downlink | Propellant | Cost / risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Larger aperture / more bands | + | + | + | + (finer pointing, stability) | + | + | + (more mass to push) | + |
| Higher payload duty cycle | | + (energy) | + | + (more slews) | + | + | | |
| Bigger solar arrays | + | (source) | + (more heat to reject at high power) | + (inertia, flexible modes, drag) | | | + (drag makeup in LEO) | + |
| Bigger battery | + | | + (needs tight temperature range) | | | | | + |
| Higher transmitter power | + | + | + (dissipation) | | | (more rate) | | + |
| High-gain antenna instead of patch | + | | | + (must point at Earth) | | (much more rate) | | + (deployment risk) |
| More onboard storage | + (small) | + (small) | | | (capacity) | | | |
| Propulsion added | + (dry + propellant) | + (heaters, valves; electric propulsion needs kW) | + | + (thrust misalignment torques) | | | (capacity) | + (safety, handling) |
| Redundancy (two of each) | + | + (if hot spare) | + | | | | | + (cost) / - (risk) |
| Farther from Sun | + (arrays, or RTG) | - (less solar power) | + (heaters) | | | - (rate falls with distance squared) | | + |

## Payload and instruments

### Instrument families

| Family | What it measures | Typical design drivers | Pointing need |
| --- | --- | --- | --- |
| Panchromatic / RGB optical imager | Reflected sunlight, high spatial detail | Aperture, focal length, detector pixel pitch, data rate | Fine pointing and low jitter |
| Multispectral imager (5 to 15 bands) | Reflectance in separate bands (vegetation, water, land use) | Band count multiplies data | Fine |
| Hyperspectral imager (100+ bands) | Near-continuous spectrum per pixel (minerals, chemistry) | Very high data volume | Fine |
| Thermal infrared imager | Emitted heat (surface temperature, fires) | Detector cooling, sometimes a cryocooler | Fine |
| Synthetic aperture radar (SAR) | Microwave backscatter, works day or night through cloud | Very high power and data rates, large antenna | Moderate |
| Lidar / altimeter | Laser ranging (heights, topography) | Laser power, pulse rate | Fine |
| Spectrometer (UV to IR) | Composition of atmospheres or surfaces | Detector cooling, calibration | Moderate to fine |
| Magnetometer | Magnetic field vector | Magnetic cleanliness, boom to separate from bus | Knowledge, not control |
| Particle / plasma detector | Charged particles, solar wind | Field of view, radiation background | Coarse |
| Radio science | Uses the telecom link itself (gravity, occultation) | Ultra-stable oscillator, ground antenna | Earth-pointed link |
| Telescope (astronomy) | Faint distant sources | Aperture, stability, often cryogenic temperatures | Extremely fine |

### Real instrument reference values

| Instrument (mission) | Type | Mass | Power | Data rate | Key performance | Source |
| --- | --- | --- | --- | --- | --- | --- |
| OLI (Landsat 8) | Pushbroom multispectral imager | 450 kg | 375 W | 265 Mbit/s | 30 m (8 bands), 15 m pan, 185 km swath | [WMO OSCAR](https://space.oscar.wmo.int/instruments/view/oli) *unverified* (single database source) |
| TIRS-2 (Landsat 9) | Thermal IR imager | not found | not found | requirement < 15 Mbit/s, estimate 9.747 Mbit/s | 2 thermal bands | [NASA GSFC TIRS-2 presentation](https://nescacademy.nasa.gov/downloadFile/1137) *unverified* |
| MODIS (Terra/Aqua) | Scanning radiometer, 36 bands | 229 kg | 162.5 W orbit average (other sources give up to 225 W) | 6.2 Mbit/s average, 10.5 day, 3.2 night | 250 m to 1 km, 2,300 km swath at 705 km | [NASA Aqua MODIS](https://science.nasa.gov/mission/aqua/modis/); power from [Univ. of Valencia summary](https://www.uv.es/leo/sen2flex/modis.htm) *unverified* |
| VIIRS (Suomi NPP/JPSS) | Scanning radiometer, 22 bands | 275 kg | 240 W (sources range 184 to 240 W) | 5.9 Mbit/s (sources range up to ~8 average) | 750 m, 3,000 km swath, 7-year design life | [NASA LAADS VIIRS](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/viirs/); power from [WMO OSCAR](https://space.oscar.wmo.int/instruments/view/viirs) *unverified* |
| NISAR | Dual-band SAR (L 24 cm, S 9.4 cm) | not published on mission page | "substantial" | up to 26 Tbit/day collected; 3.5 Gbit/s Ka-band downlink | 12 m mesh reflector on 9 m boom, 240 km swath | [NASA NISAR satellite page](https://science.nasa.gov/mission/nisar/about-the-satellite) |
| MultiScape100 CIS (CubeSat camera) | Multispectral pushbroom, up to 7 bands | 1.82 kg (another listing gives 1.2 kg) | ~5.8 W | depends on mode | 4.75 m GSD and ~19.4 km swath at 500 km | [Simera Sense ESA presentation](https://phiweek2018.esa.int/agenda/files/presentation320.pdf); power from [SatCatalog](https://www.satcatalog.com/component/multiscape100-cis/) *unverified* |
| CubeSat 3-axis magnetometers | Magnetometer | 0.006 to 0.33 kg | 0.01 to 1.5 W | low (Hz-rate samples) | 1 to 25 nT resolution | [SoA 2026 Table 5-6](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control) |
| MIRI (JWST) | Mid-IR camera/spectrometer | | cryocooler-dependent | | detectors held below 7 K | [JPL MIRI news](https://www.jpl.nasa.gov/news/webb-telescopes-coldest-instrument-reaches-operating-temperature/) |

The spread is the lesson: a CubeSat camera is about 2 kg and 6 W, while a flagship Earth-observing imager is hundreds of kilograms and hundreds of watts. A SAR's data volume (terabits per day) dwarfs a weather radiometer's (megabits per second).

### Aperture, resolution, and data

The finest detail an optical telescope can resolve is set by diffraction:

```
θ ≈ 1.22 λ / D            (radians; λ = wavelength, D = aperture diameter)
GSD_diffraction ≈ 1.22 λ h / D   (h = altitude, nadir view)
```

**Analysis** (python3, λ = 550 nm, h = 500 km): D = 5 cm gives 6.7 m; D = 9.5 cm (fits a CubeSat) gives 3.5 m; D = 30 cm gives 1.1 m; D = 1 m gives 0.34 m. Real systems are usually a bit worse because detector pixel size, optics quality, and motion blur also matter. The game can use "aperture class" as the main resolution knob, with mass and cost rising steeply with D.

A pushbroom imager's raw data rate is:

```
R_raw = (swath / GSD) × (v_ground / GSD) × N_bands × bits_per_sample     [bit/s]
```

Halving GSD multiplies R_raw by 4. This single equation explains why better resolution floods the downlink. Lossless compression typically yields about 2:1 on imagery (*unverified* rule of thumb; we use it only in the worked examples).

### Duty cycle, calibration, pointing

- **Duty cycle:** most instruments are not on all the time. An Earth imager may only collect over land in daylight; a SAR may be limited to a fraction of each orbit by power and data. Average power and average data volume scale with duty cycle, while peak power sizes the wiring and battery discharge rate.
- **Calibration:** instruments need onboard references (lamps, solar diffusers, blackbodies) or vicarious targets, which add mass, operations time, and sometimes special attitude maneuvers.
- **Pointing:** the instrument sets the ADCS requirement. See [ADCS](#attitude-determination-and-control-adcs) for the worked link between GSD and pointing knowledge.

## Power

### Sources

| Source | How it works | Good for | Limits |
| --- | --- | --- | --- |
| Solar arrays + batteries | Photovoltaic cells charge batteries for eclipse | Nearly all Earth orbiters; over 90% of small satellites ([SoA 2026, Power](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems)) | Output falls with distance from Sun squared and with angle; degrades with radiation |
| Radioisotope thermoelectric generator (RTG) | Heat from Pu-238 decay drives thermocouples | Outer planets, dusty or dark surfaces (Curiosity, Perseverance, Dragonfly) | Low power per kg, scarce fuel, launch approval |
| Primary batteries | Non-rechargeable cells | Short missions, probes | Finite energy ([SoA 2026](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems)) |
| Fuel cells | H2 + O2 to electricity | Crewed vehicles; regenerative types in development | Not practical for small spacecraft today ([SoA 2026](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems)) |

### Solar cells

| Cell type | BOL efficiency | Notes | Source |
| --- | --- | --- | --- |
| Single-junction silicon | ~20% (AZUR Silicon S 32: 16.8%) | Cheap, used for short or cost-sensitive missions | [SoA 2026 §3.2.1, Table 3-1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Triple-junction III-V (GaInP/GaAs/Ge) | nominal ~30%, products 28 to 30.7% (e.g., Spectrolab XTJ Prime 30.7%) | Current standard for space | [SoA 2026 Table 3-1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| 4- to 5-junction / IMM | up to ~32 to 34% | State-of-the-art high end | [SoA 2026 §3.2.1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |

### Solar flux and distance

The total solar irradiance at 1 AU is about 1361 W/m² (measured 1360.8 ± 0.5 W/m² at the 2008 solar minimum by SORCE/TIM) ([Kopp and Lean 2011 record](https://espo.nasa.gov/node/30086); [Kopp TSI page](https://spot.colorado.edu/~koppg/TSI/)). Flux falls with the inverse square of distance, and power drops with the cosine of the Sun angle ([SoA 2026 §3.2.1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems)):

```
S(d) = 1361 / d_AU²    [W/m²]
P_array = S(d) × η_cell × A × packing × I_d × cos(θ) × (1 - D_yr)^years
```

**Analysis** (python3): Mars 1.524 AU gives 586 W/m² (43%); Ceres 2.77 AU gives 177 W/m² (13%); Jupiter 5.2 AU gives 50 W/m² (3.7%); Saturn 9.58 AU gives 15 W/m² (1.1%).

That is why Juno needed three arrays about 9 m long carrying 18,698 cells: they could make about 14 kW at Earth's distance but only about 500 W at Jupiter ([JPL news](https://www.jpl.nasa.gov/news/nasas-juno-spacecraft-breaks-solar-power-distance-record); the [JPL Juno facts sheet](https://www.jpl.nasa.gov/news/press_kits/juno/facts) lists about 400 W, so the exact value is *unverified*). Psyche's arrays make about 21 kW near Earth and about 2.3 kW at the asteroid ([JPL Psyche press kit](https://www.jpl.nasa.gov/press-kits/psyche/mission/spacecraft/)).

### BOL vs EOL and degradation

Arrays lose output from radiation, UV darkening of coverglass, contamination, and thermal cycling, so engineers size to **end-of-life (EOL)** ([SoA 2026 §3.2](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems)). Typical factors:

| Factor | Typical value | Source |
| --- | --- | --- |
| Triple-junction power remaining after 1 MeV electron fluence 1×10¹⁵ e/cm² (datasheet "15-year GEO" case) | 0.85 (0.94 at 1×10¹⁴, 0.65 at 1×10¹⁶) | [Spectrolab XTJ Prime datasheet](https://www.spectrolab.com/photovoltaics/XTJ-Prime_Data_Sheet.pdf) |
| Inherent degradation I_d (packing, wiring, temperature, shadowing) | 0.77 nominal | SMAD value as implemented in [MIT OCW 16.851 solution](https://ocw.mit.edu/courses/16-851-satellite-engineering-fall-2003/7555a121bb1544c25136b16869f7448c_ps2_cs_solution.pdf) *unverified* (secondary) |
| Life degradation per year | Si 3.75%, GaAs 2.75%, multijunction 0.5% (worst case) | Same MIT OCW SMAD-based code *unverified* |

**Analysis:** 0.85 after 15 years in GEO is roughly 1% per year, which is a defensible single game number for multi-junction cells in harsh orbits; 0.5% per year suits a benign LEO.

### RTGs

The Multi-Mission RTG holds 4.8 kg of plutonium dioxide producing about 2,000 W of heat, delivers 110 W electric at beginning of life (6% efficiency, 2.8 W/kg), is estimated at 72 W after 17 years, and weighs about 45 kg ([NASA MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf)).

**Analysis:** Pu-238 decay alone (87.7-year half-life) would leave 96 W after 17 years; the datasheet's 72 W also includes thermocouple degradation, an effective ~2.5% per year decline. The 2,000 W of "waste" heat is useful for keeping a rover warm.

### Batteries

| Parameter | Value | Source |
| --- | --- | --- |
| Commercial Li-ion cell specific energy | 150 to 270 Wh/kg, 3.6 V average | [SoA 2026 §3.4.1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Flown 18650 cells | 182 to 260 Wh/kg (e.g., Panasonic NCR18650B 243 Wh/kg on MarCO; LG MJ1 260 Wh/kg on PACE) | [SoA 2026 Table 3-4](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Assembled battery packs | ~57 to 250 Wh/kg, most 90 to 180 Wh/kg | [SoA 2026 Table 3-5](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Li-polymer cells | 150 to 200 Wh/kg | [SoA 2026 §3.4.1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |

Battery life depends on temperature, charge rate, and **depth of discharge (DoD)**. A LEO satellite at 500 km sees about 15 eclipses per day (analysis below), so a 3-year mission is roughly 16,700 cycles. JPL's design rule for cyclic DoD (applies to NiH2 and Li-ion) ([JPL Design Principles Rev. 11, rule 4.3.3.6.3](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx)):

| Number of cycles | Max DoD |
| --- | --- |
| < 100 | < 70% |
| 100 to 5,000 | < 60% |
| 5,000 to 30,000 | < 40% |
| > 30,000 | < 20% |

(The public copy prints the last threshold as "30,0000," which we read as 30,000.) Single or occasional events such as launch or safe hold may reach 70% DoD (rule 4.3.3.6.4).

### Sizing method (SMAD energy balance)

For a direct-energy-transfer system, the array must supply the daylight loads and recharge the battery for eclipse:

```
P_sa = ( P_e × T_e / X_e  +  P_d × T_d / X_d ) / T_d
```

P_e, P_d are eclipse and daylight loads; T_e, T_d their durations; X_e and X_d path efficiencies. SMAD values: X_e = 0.65, X_d = 0.85 for direct energy transfer; 0.60 and 0.80 for peak power tracking ([MIT OCW 16.851](https://ocw.mit.edu/courses/16-851-satellite-engineering-fall-2003/7555a121bb1544c25136b16869f7448c_ps2_cs_solution.pdf); same structure in the [Valispace EPS tutorial](https://www.valispace.com/wp-content/uploads/2018/12/EPS-sizing-tutorial-1.pdf), which uses 0.6 and 0.8).

Battery capacity:

```
C_bat [Wh] = P_e × T_e / (DoD × η_discharge)
```

### Power modes and margin

Spacecraft run in modes (launch, safe, cruise, science, downlink) with different loads. Duty cycling (for example, transmitter on only during passes) is the main tool to fit average power into a small array. JPL requires system power/energy margin over and above growth allowances of 25% at mission definition, 15% at PDR, 12% at CDR, and 10% at system integration and launch ([JPL DP Rev. 11, Table 6.3.3-1](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx)). Goddard's rules require total power margin (with respect to EOL capacity) of more than 25%, 20%, 15%, 10%, and 5% at the ends of Pre-A, A, B, C, and D ([GSFC-STD-1000 Rev G, Table 1.06-1](https://standards.nasa.gov/sites/default/files/standards/GSFC/G/0/GSFC-STD-1000Revg_signature.pdf)). An open textbook citing SMAD recommends 25% initial power margin and notes a NASA/Aerospace study found historical power growth near 40% ([Univ. of Hawaii EPET 302](https://pressbooks-dev.oer.hawaii.edu/epet302/chapter/5-4-design-process-and-drivers/)).

## Thermal control

Every watt a spacecraft uses ends up as heat, and the only way to lose heat in vacuum is radiation. Thermal design keeps every component within its allowable range in the **hot case** (max sunlight, max power, end-of-life coatings) and the **cold case** (eclipse, min power, safe mode).

| Technique | Type | What it does |
| --- | --- | --- |
| Multi-layer insulation (MLI) | Passive | Thin reflective layers block radiative heat flow ([SoA 2026 Table 7-4](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control)) |
| Radiators and coatings | Passive | Surfaces with high emissivity and low solar absorptivity dump heat |
| Heat pipes, thermal straps | Passive | Move heat from hot boxes to radiators |
| Phase-change materials, thermal switches | Passive | Buffer peaks, cut heat paths when cold ([SoA 2026 Tables 7-8, 7-9](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control)) |
| Electrical heaters | Active | Kapton film heaters, 0.4 to 1.56 W/cm² products ([SoA 2026 Table 7-11](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control)) |
| Louvers, pumped fluid loops | Active | Vary radiator effectiveness, move large heat loads ([SoA 2026 Table 7-14](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control)) |
| Cryocoolers, thermoelectric coolers | Active | Cool IR detectors; e.g., Lockheed Martin Micro1-1: 0.35 kg, 15 W input for 1 W cooling at 150 K; AIM SF070: 0.85 kg, 24 W for 0.6 W at 80 K ([SoA 2026 Table 7-12](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control)) |

**Survival heaters** cost power exactly when power is scarce (eclipse, safe mode, far from the Sun). Goddard's rule requires thermal designs with at least 5 °C margin and heater-controlled elements at no more than 70% heater duty cycle at concept stage ([GSFC-STD-1000 Rev G, rule 4.25](https://standards.nasa.gov/sites/default/files/standards/GSFC/G/0/GSFC-STD-1000Revg_signature.pdf)).

**Cryogenic instruments:** JWST's five-layer sunshield passively cools the cold side to about 40 K ([NASA: How does Webb stay cold](https://science.nasa.gov/mission/webb/science-overview/science-explainers/how-does-webb-stay-cold)), but MIRI only reached about 90 K passively and needed a two-stage cryocooler to get below 7 K ([JPL](https://www.jpl.nasa.gov/news/webb-telescopes-coldest-instrument-reaches-operating-temperature/)). Detector dark current rises roughly tenfold per degree of warming for MIRI, per the same JPL release. Game lesson: an IR instrument may bring a cryocooler that costs tens of watts and adds a life-limiting part.

## Structure and mechanisms

The primary structure carries launch loads (acceleration, vibration, acoustics, shock), provides mounting and alignment, and often doubles as a thermal path. The structure and mechanisms share is about 20% of dry mass in a SMAD guideline cited by an open textbook ([Univ. of Hawaii EPET 302](https://pressbooks-dev.oer.hawaii.edu/epet302/chapter/4-4-general-arrangement-and-design-drivers/)). Common materials are aluminum alloys, honeycomb panels, and carbon fiber composites ([SoA 2026, Structures](https://www.nasa.gov/smallsat-institute/sst-soa/structures-materials-and-mechanisms)).

### CubeSat form factors and mass classes

| Form factor | Dimensions (mm) | Max mass, CDS Rev 14.1 | Typical structure mass |
| --- | --- | --- | --- |
| 1U | 100 × 100 × 113.5 | 2.00 kg | 0.118 kg |
| 1.5U | 100 × 100 × 170.2 | 3.00 kg | 0.142 to 0.25 kg |
| 2U | 100 × 100 × 227 | 4.00 kg | 0.220 kg |
| 3U | 100 × 100 × 340.5 | 6.00 kg | 0.352 kg |
| 6U | 100 × 226.3 × 366 | 12.00 kg | 0.916 to 1.94 kg |
| 12U | 226.3 × 226.3 × 366 | 24.00 kg | 1.84 kg |

Sources: masses from [CubeSat Design Specification Rev 14.1, Table 1](https://www.nasa.gov/wp-content/uploads/2018/01/cubesatdesignspecificationrev14_12022-02-09.pdf) (heavier masses can be negotiated with the dispenser provider); dimensions and structure masses from [SoA 2026 Table 6-1](https://www.nasa.gov/smallsat-institute/sst-soa/structures-materials-and-mechanisms). **Correction to a common belief:** the 1.33 kg 1U limit is from the older CDS Rev 13 (2014 to 2015 update); Rev 14 (2020) raised it to 2.00 kg ([CDS change log](https://www.nasa.gov/wp-content/uploads/2018/01/cubesatdesignspecificationrev14_12022-02-09.pdf)).

NASA's SoA report classes small spacecraft by total mass: minisatellite 100 to 180 kg, microsatellite 10 to 100 kg, nanosatellite 1 to 10 kg, picosatellite 0.1 to 1 kg, femtosatellite 0.01 to 0.09 kg ([SoA 2026, Introduction](https://www.nasa.gov/smallsat-institute/sst-soa/introduction)). "ESPA-class" buses (named after the EELV Secondary Payload Adapter ring) offer up to several kW of peak power ([SoA 2026 Table 2-7](https://www.nasa.gov/smallsat-institute/sst-soa/platforms)).

### Deployables and their risk

Solar arrays, booms, and antennas that unfold in orbit add capability but also single-point failure risk. JPL requires mission-critical deployment systems to show at least 100% force or torque margin over the full range of motion ([JPL DP Rev. 11, rule 4.2.3.1](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx)). The cautionary tale is Galileo: its X-band high-gain antenna, designed for a 134 kbit/s downlink, failed to unfurl in 1991, leaving a low-gain antenna that could manage only about 10 bit/s from Jupiter until software, compression, coding, and ground upgrades raised effective return to roughly 1 kbit/s or more ([NASA SCaN history](https://www.nasa.gov/directorates/heo/scan/images/history/July1995_2.html); [NASA APPEL case study](https://appel.nasa.gov/wp-content/uploads/2013/04/546504main_42s_galilieo_rocky_road_jupiter.pdf); sources differ on the final rate, from 1 to 2 kbit/s up to about 4.5 kbit/s information rate, so the figure is *unverified*). Case details belong in [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md).

## Propulsion

Propulsion changes the orbit (insertion, raising, plane change), holds it against drag or perturbations (station-keeping), unloads momentum from reaction wheels, and disposes of the spacecraft at end of life. Many CubeSats carry none.

| Technology | Specific impulse (s) | Thrust range | Notes | Source |
| --- | --- | --- | --- | --- |
| Cold gas | 40 to 110 | 10 µN to 3.6 N | Simple, safe, low performance | [SoA 2026 Table 4-1](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion) |
| Hydrazine monopropellant | 180 to 285 (200 to 235 typical for ≥1 N thrusters) | 0.25 to 28 N | Huge heritage; toxic, needs protective suits for fueling | [SoA 2026 §4.6.1](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion) |
| Green monoprop and alternative bipropellants (ASCENT/AF-M315E, LMP-103S) | 150 to 310 | 50 mN to 22 N | GPIM flew five 1 N ASCENT thrusters in 2019; ASCENT gives ~50% higher density-specific impulse than hydrazine | [SoA 2026](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion); [AFRL ASCENT](https://afresearchlab.com/advanced-spacecraft-energetic-non-toxic-ascent-propellant/); [NASA GPIM](https://www.nasa.gov/missions/tech-demonstration/green-propellant-infusion-mission-gpim-overview/) |
| Solid motors | 187 to 269 | 37 to 461 N | One-shot burns | [SoA 2026 Table 4-1](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion) |
| Electrospray | 225 to 3,000 | 20 µN to 20 mN | Tiny thrust, CubeSat-scale | same |
| Gridded ion | 500 to 3,000 (small-sat units) | 0.1 to 20 mN | Dawn's NSTAR: 3,100 s, ~90 mN | same; [JPL Dawn archive](https://webarchive.library.unt.edu/web/20130218172313/http://dawn.jpl.nasa.gov/mission/ion_prop.asp) |
| Hall effect | 200 to 1,920 (small-sat units) | 0.25 to 55 mN | Psyche: four Hall thrusters, up to 240 mN, 1,085 kg xenon | same; [JPL Psyche press kit](https://www.jpl.nasa.gov/press-kits/psyche/mission/spacecraft/) |
| Pulsed plasma / vacuum arc | 87 to 3,200 | 4 to 500 µN | Very low thrust | [SoA 2026 Table 4-1](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion) |

Electric propulsion trades propellant mass for electrical power and time: thrust is millinewtons, so maneuvers take weeks to months, and the arrays must be sized for kilowatts while thrusting.

### Rocket equation

```
Δv = Isp × g0 × ln(m0 / mf)          g0 = 9.80665 m/s²
m_prop = m0 × (1 - exp(-Δv / (Isp × g0)))
```

**Analysis** (python3):

| Case | m0 | Δv | Isp | Propellant |
| --- | --- | --- | --- | --- |
| 6U cold gas, small maneuvers | 12 kg | 20 m/s | 60 s | 0.40 kg (3.3%) |
| 6U green monoprop | 12 kg | 100 m/s | 220 s | 0.54 kg (4.5%) |
| 500 kg smallsat, hydrazine | 500 kg | 150 m/s | 220 s | 33.6 kg (6.7%) |
| 500 kg smallsat, Hall | 500 kg | 1,500 m/s | 1,500 s | 48.5 kg (9.7%) |
| Same 1,500 m/s with hydrazine | 500 kg | 1,500 m/s | 220 s | 250.5 kg (50.1%) |
| Dawn-like, ion | 1,218 kg | 11,000 m/s | 3,100 s | 370 kg (30.4%) |

The last two rows show why deep-space missions with large Δv use electric propulsion. Δv budgets by orbit (drag makeup, deorbit, insertion) are in [02-mission-design-orbits-launch.md](02-mission-design-orbits-launch.md). JPL requires the propellant load to be sized for the baseline Δv at the full allowable mass, not the current estimate ([JPL DP Rev. 11, rule 6.3.2.5](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx)).

## Attitude determination and control (ADCS)

ADCS measures where the spacecraft is pointing (determination) and turns it to where it needs to point (control). Requirements come in three flavors:

- **Accuracy (control):** how close the boresight is to the target.
- **Knowledge:** how well you know where it pointed (matters for geolocating images).
- **Stability / jitter:** how much it moves during an exposure (causes blur).

### Stabilization approaches

| Approach | How | Example | Trade |
| --- | --- | --- | --- |
| Passive magnetic / gravity-gradient | Magnets or a long boom align with Earth's field or gravity gradient | Simple CubeSats | Cheap, coarse (degrees) |
| Spin stabilization | Whole spacecraft spins like a gyroscope | Juno spins 1 rpm in cruise, 2 rpm for science, 5 rpm for engine burns, and uses no reaction wheels ([JPL Juno press kit](https://www.jpl.nasa.gov/news/press_kits/juno/spacecraft)) | Robust, low power; instruments sweep the sky rather than stare |
| Three-axis (reaction wheels + magnetorquers or thrusters) | Wheels store momentum; external torque dumps it | Most imaging satellites and telescopes | Precise; wheels saturate and wear |

### Sensors and actuators

| Component | SoA performance range | Source |
| --- | --- | --- |
| Reaction wheels | 0.00023 to 0.3 N·m torque, 0.0005 to 8 N·m·s storage | [SoA 2026 Table 5-1](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control) |
| Magnetic torquers | 0.15 to 15 A·m² | same |
| Star trackers | ~8 arcsec knowledge (best units 1 to 6 arcsec) | same, Table 5-5 |
| Sun sensors | 0.1° | same |
| Earth (horizon) sensors | 0.25° | same |
| Gyros (IMU) | 0.15°/h bias stability | same |
| GPS receivers | 1.5 m position | same |
| Integrated ADCS units | 0.002° to 5° pointing | same |

**Momentum saturation:** a reaction wheel absorbs disturbance torques (drag, solar pressure, gravity gradient, magnetic) by spinning faster. At max speed it is saturated and must be desaturated using magnetorquers (common in Earth orbit) or thrusters ([SoA 2026 §5.2.2](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control)). Four-wheel skewed sets give fault tolerance on small spacecraft (same source).

**Analysis:** a secular disturbance of 5×10⁻⁷ N·m stores 0.0028 N·m·s per 94.6-minute orbit, so a 0.03 N·m·s CubeSat wheel would saturate in about 11 orbits without unloading. The game can model "momentum fill" as a slow bar that magnetorquers drain.

**Failures shape missions.** Kepler lost its second of four reaction wheels in May 2013, ending its primary mission; engineers balanced solar pressure on the arrays and used thrusters to create the K2 mission, restricted to fields along the ecliptic and limited by fuel ([Van Cleve et al. 2016, K2 performance](https://arxiv.org/pdf/1512.06162)). Hubble moved to one-gyro operation in June 2024 after a faulty gyro kept triggering safe mode, at a cost of about 12% observing efficiency ([NASA Hubble one-gyro mode](https://science.nasa.gov/mission/hubble/observatory/design/hubble-one-gyro-mode/); [STScI release](https://www.stsci.edu/contents/news-releases/2024/news-2024-023)).

### Matching pointing to the instrument

**Analysis:** one pixel of a 4.75 m GSD camera at 500 km subtends 4.75 / 500,000 = 9.5 µrad (about 2 arcsec). An integrated CubeSat ADCS with 0.003° (52 µrad) pointing ([XACT, SoA 2026 Table 5-2](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control)) would place the image within about 26 m, roughly 5 pixels, before ground control points fix it. Landsat 8 specifies attitude control error ≤ 30 µrad (3σ) ([eoPortal Landsat 8](https://www.eoportal.org/satellite-missions/landsat-8-ldcm)). A game rule of thumb: required pointing accuracy should be a few times the instrument's field of view or better; required stability during one exposure should be under one pixel.

## Command and data handling (C&DH)

C&DH is the spacecraft's brain and memory: it runs flight software, executes stored command sequences, collects telemetry, stores science data, and manages faults.

### Radiation and processor choice

Radiation causes cumulative total ionizing dose (TID, in krad) damage and single-event effects. Single-event upsets (SEUs) flip memory bits; single-event latch-ups can destroy parts ([SoA 2026 §8.2.1](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics)). Options:

| Class | Example | Performance | Radiation tolerance | Typical use | Source |
| --- | --- | --- | --- | --- | --- |
| Rad-hard processor | BAE RAD750 | 110 to 132 MHz (rad-tolerant 0.25 µm version); older 0.15 µm variant 200 MHz | 200 krad(Si) for the 0.25 µm part; 1 Mrad quoted for the older part (*unverified*) | Flagship and deep-space missions | [BAE RAD750 datasheet 2025](https://www.baesystems.com/en-us/dam/jcr:c297f318-c618-4015-9399-adf76ac5cf55/16-f78-RAD750-Component-datasheet-2025-web.2025-06-25-21-57-42.pdf) |
| COTS-based SmallSat OBC | ARM Cortex, STM32-class boards | Much faster per watt | ~20 to 40 krad typical; one board 30 krad, 100 krad targeted for high-end | LEO CubeSats | [SoA 2026 Table 8-4](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics) |

SmallSat avionics usually pair COTS processors and memory with rad-hard supporting parts, error-correcting code (ECC), watchdog timers, memory scrubbing, and redundancy ([SoA 2026 §8.2.1](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics)). The trade is performance and cost versus survivability in harsh orbits (Jupiter, MEO, long LEO missions).

### Storage sizing

```
Storage ≥ (data generated between downlinks) × (1 + margin) + backlog for missed passes
Daily balance: V_generated ≤ N_passes × t_pass × R_downlink × efficiency
```

Landsat 8, for scale, carries a solid-state recorder of about 4 Tbit at beginning of life (3.1 Tbit at end of life) and downlinks at 384 Mbit/s on X-band ([eoPortal Landsat 8](https://www.eoportal.org/satellite-missions/landsat-8-ldcm)). If data generation exceeds downlink for days, the recorder fills and science is lost. That is the core of a good data mechanic.

### Flight software, autonomy, fault protection

Flight software handles modes, command sequencing, attitude control loops, and fault protection. When a fault is detected (undervoltage, lost attitude, computer reset), **safe mode** sheds loads, points arrays at the Sun, and waits for ground commands. Battery and power margins must cover fault responses: JPL requires 10% state-of-charge margin above the minimum allowed before loads are measured and 5% after ([JPL DP Rev. 11, Table 6.3.3-2](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx)). Hubble's gyro problem showed this in practice: repeated safe-mode entries suspended science until the operating mode changed ([NASA](https://science.nasa.gov/mission/hubble/observatory/design/hubble-one-gyro-mode/)).

## Telecommunications

### Bands and hardware

| Band | Frequency | Typical use | Source |
| --- | --- | --- | --- |
| VHF / UHF | 30 to 300 MHz / 300 to 1,000 MHz | CubeSat command and telemetry, kbit/s | [SoA 2026 Table 11-2](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations) |
| S | 2 to 4 GHz | TT&C, moderate data (kbit/s to Mbit/s) | same |
| X | 8 to 12 GHz | Science downlink, deep space | same |
| Ka | 27 to 40 GHz | High-rate science (NISAR 3.5 Gbit/s) | same; [NISAR](https://science.nasa.gov/mission/nisar/about-the-satellite) |
| Optical (laser) | ~1550 nm | Very high rate; still maturing | [SoA 2026 §11.3.1](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations); DSOC reached 267 Mbit/s at ~30 million km from Psyche ([JPL DSOC](https://www.jpl.nasa.gov/missions/dsoc)) |

Antennas range from omnidirectional (dipoles, monopoles: low gain, no pointing) through patches (a few to ~10 dBi) to parabolic high-gain antennas (HGA) that must be pointed precisely at Earth. Representative CubeSat radios: UHF transceivers of 25 to 100 g at 9.6 to 38.4 kbit/s; S-band units of ~100 to 400 g up to several Mbit/s; X-band transmitters of ~300 to 800 g at 25 to 200+ Mbit/s ([SoA 2026 Table 9-3](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications)).

### Link budget formulas

```
λ = c / f
Free-space path loss:   L_fs = (4π d / λ)²          L_fs[dB] = 20 log10(4π d / λ)
Parabolic antenna gain: G = η (π D / λ)²            η ≈ 0.55 typical
EIRP [dBW] = P_tx[dBW] + G_tx[dBi] - L_line[dB]
C/N0 [dB-Hz] = EIRP - L_fs - L_other + G/T - k     k = -228.6 dBW/(K·Hz)
Eb/N0 [dB] = C/N0 - 10 log10(R_b)
Max data rate: R_b = 10^((C/N0 - Eb/N0_required - margin)/10)
```

Because L_fs grows with d², **achievable data rate falls with the square of distance** when everything else is fixed. Doubling either antenna's diameter adds 6 dB (4x rate). The SoA report says a 3 dB margin is adequate for LEO data return at 1,500 km slant range, and deep-space links may accept 1 dB or less at extreme range ([SoA 2026 §11.3.1](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)). JPL requires 3 dB over required at the end of Phase A for deep-space links ([JPL DP Rev. 11, rule 6.3.7.1](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx)); Goddard requires >3 dB for Near Earth Network links ([GSFC-STD-1000 Rev G](https://standards.nasa.gov/sites/default/files/standards/GSFC/G/0/GSFC-STD-1000Revg_signature.pdf)).

### Ground antenna reference values

| Station | Band | Gain | System noise temp | G/T | Source |
| --- | --- | --- | --- | --- | --- |
| DSN 70 m (DSS-14/43/63) | X 8,420 MHz | 74.2 to 74.7 dBi | ~17 to 19 K at zenith | ~62 dB/K (analysis) | [DSN 810-005 Module 101 Rev I](https://deepspace.jpl.nasa.gov/dsndocs/810-005/101/101I.pdf) |
| DSN 34 m BWG | X 8,425 MHz | 68.2 dBi | ~26 to 42 K depending on configuration | ~53 dB/K (analysis, 35 K) | [DSN 810-005 Module 104 Rev P](https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104P.pdf) |
| DSN 34 m BWG | Ka 32 GHz | 79.0 dBi | | | same |
| Commercial 5.4 m (AWS Ground Station) | S / X | | | 16 / 30.5 dB/K | [SoA 2026 §11](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations) |
| Commercial 3.7 m (ATLAS, Barrow) | S / X | | | 12.8 / 25.4 dB/K | same, Table 11-7 |

### Worked link examples

**Analysis** (python3; assumptions labeled; required Eb/N0 values are our assumptions for coded links, not vendor specs).

**A. 6U CubeSat, 500 km, X-band to a 5.4 m commercial station.** 2 W RF (3 dBW), 8 dBi patch, 1 dB line loss → EIRP 10 dBW. At 10° elevation the slant range is 1,695 km, so L_fs = 175.3 dB at 8.2 GHz. Other losses 2.5 dB (atmosphere, pointing, polarization). G/T = 30.5 dB/K. Result: C/N0 = 91.3 dB-Hz. With required Eb/N0 = 4.4 dB and 3 dB margin, max rate ≈ 246 Mbit/s at 10° (over 2 Gbit/s overhead). In practice the radio and the X-band spectrum allocation limit the rate first: flown CubeSat X-band transmitters run 25 to ~200 Mbit/s ([SoA 2026 Table 9-3](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications)).

**B. Same CubeSat, S-band.** 1 W, 6 dBi patch, 3.7 m station with G/T 12.8 dB/K: L_fs = 164.1 dB at 2.25 GHz, C/N0 = 80.3 dB-Hz, max ≈ 20 Mbit/s. **C. UHF:** 1 W into a dipole, a ground Yagi with assumed G/T of -15 dB/K, and 10 dB required Eb/N0 for an uncoded link gives ≈ 47 kbit/s, which matches the 9.6 to 38.4 kbit/s typical of UHF radios.

**Data volume per pass:** at 500 km, an overhead pass above a 10° mask lasts at most 7.4 minutes (analysis), and typical passes are shorter. At a fixed 50 Mbit/s and 8 minutes per pass (an optimistic round number), one pass returns 24 Gbit; four passes return 96 Gbit/day.

**D. Mars orbiter (MRO-like) to the DSN.** MRO has a 3 m HGA and 100 W X-band traveling-wave tube amplifiers ([MRO antennas, JPL archive](https://webarchive.library.unt.edu/web/20090813145340/http://mars.jpl.nasa.gov/mro/mission/sc_antennas.html)). With η = 0.55 the HGA gain is 45.9 dBi, EIRP 64.9 dBW. Using required Eb/N0 = 2.5 dB and 3 dB margin:

| Earth-Mars distance | L_fs (8.42 GHz) | Max rate to 34 m (G/T 52.8) | Max rate to 70 m (G/T 61.5) |
| --- | --- | --- | --- |
| 0.37 AU | 265.8 dB | 25.7 Mbit/s | 192 Mbit/s |
| 0.52 AU | 268.8 dB | 13.0 Mbit/s | 97 Mbit/s |
| 1.5 AU | 278.0 dB | 1.6 Mbit/s | 11.7 Mbit/s |
| 2.52 AU | 282.5 dB | 0.55 Mbit/s | 4.1 Mbit/s |

Reality check: MRO is reported at about 6 Mbit/s to a 34 m antenna at close range and about 0.6 Mbit/s at the farthest ([IEEE Spectrum](https://spectrum.ieee.org/mars-gets-broadband-connection)). Our simple model matches the far case and is optimistic by about 2x at close range, where hardware and coding limits cap real rates. The ratio between 0.52 and 2.52 AU is 23.5x, exactly the distance-squared law. The 70 m dish buys about 8.7 dB (7.5x) over the 34 m.

## Mass budget and margins

### Vocabulary

From [ANSI/AIAA S-120A-2015](https://webstore.ansi.org/standards/aiaa/ansiaiaa120a2015) as adopted in [JPL DP Rev. 11 §6.3.2](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx):

| Term | Meaning |
| --- | --- |
| Basic mass | Current best estimate of dry hardware mass, no growth included |
| Mass growth allowance (MGA) | Predicted growth based on hardware category and maturity; shrinks as designs mature |
| Predicted mass | Basic + MGA |
| Allowable mass | Limit (usually from launch vehicle capability) |
| Mass margin | Allowable - Predicted; % margin is divided by Basic mass |
| Reserve | Held by management above the project for scope changes |

MGA depends on maturity: higher for estimated or new items, lower for drawings and calculations, and near zero for measured existing hardware. A 2016 NRO/NASA comparison reproduces AIAA "estimated" MGA values of roughly 20 to 30% for electronics (by size), 25% for structure, thermal, battery, and propulsion, about 30% for solar arrays, and about 60% for harness, and notes AIAA's additional satellite-level margin of 15% ([MacKenzie, ICEAA 2016](https://www.iceaaonline.com/wp-content/uploads/2016/10/SS01-ppt-MacKenzie-Sattelite-Mass-Growth.pdf); values read from an image table, *unverified*). The same study found actual unit-level growth significantly higher than the AIAA allowances. NASA's Engineering and Safety Center recommends requiring S-120A-2015 in NASA announcements ([NESC](https://ntrs.nasa.gov/api/citations/20205003211/downloads/SAWE_NESC_MassGrowth.pdf)).

### Margin requirements by phase

| Rule set | Concept / Pre-A | Phase A / MDR | PDR (end B) | CDR (end C) | Launch |
| --- | --- | --- | --- | --- | --- |
| JPL dry mass margin (over MGA) | | 23% (MDR/PMSR) | 12% | 5% (SIR 2%) | 0% |
| JPL power/energy margin (over growth) | | 25% | 15% | 12% (SIR 10%) | 10% |
| GSFC dry mass margin (Rev I, current) | >15% before SRR | >15% at SRR | >10% | >5% (SIR >2%) | 0 (end D) |
| GSFC power margin (wrt EOL) | >25% | >20% | >15% | >10% | >5% |

Sources: [JPL DP Rev. 11 Tables 6.3.2-1 and 6.3.3-1](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx) (effective October 16, 2025; public copy "may not be current"); [GSFC-STD-1000 Rev G Table 1.06-1](https://standards.nasa.gov/sites/default/files/standards/GSFC/G/0/GSFC-STD-1000Revg_signature.pdf) for power. The mass row uses the newer GSFC-STD-1000 Rev I Table 1.06-1, as cited in [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md#technical-margins-the-engineering-version-of-reserves); the older Rev G required >25/20/15/10% mass margin by phase. **Note:** the widely quoted "30% mass margin at PDR" is not what the current JPL rule says. JPL now states unencumbered margin (12% at PDR) on top of MGA, which together approximate older totals; a Psyche team member described ~30% as the standard Phase B margin for power, mass, and cost ([Psyche blog](https://psyche.ssl.berkeley.edu/?p=1162)). Review timing is in [01-mission-lifecycle.md](01-mission-lifecycle.md).

### Typical subsystem mass fractions

SMAD suggestion as reproduced in an open textbook ([Univ. of Hawaii EPET 302](https://pressbooks-dev.oer.hawaii.edu/epet302/chapter/4-4-general-arrangement-and-design-drivers/); SMAD edition not stated, *unverified* as to which spacecraft class it represents):

| Subsystem | % of dry mass |
| --- | --- |
| Payload | 41% |
| Structure and mechanisms | 20% |
| Power (including harness) | 19% |
| Attitude determination and control | 8% |
| Command and data handling | 5% |
| Thermal control | 2% |
| Telemetry and command | 2% |
| Other (balance) | 3% |

These are planning averages. Deep-space spacecraft carry far more propellant and power mass, and CubeSat budgets vary widely.

## Reliability and redundancy

| Architecture | Description | Effect |
| --- | --- | --- |
| Single string | One of each critical box | Lowest mass and cost; any failure can end the mission |
| Block redundant | Two complete strings (A and B), switch whole side | Survives one failure per side; doubles mass of those boxes |
| Cross-strapped | Any A unit can work with any B unit | Survives more failure combinations; adds switching complexity |
| Functional redundancy | Different hardware does the job (Hubble using star trackers and magnetometers in one-gyro mode) | Graceful degradation |

**Risk class** sets how much redundancy and testing a mission buys. NASA payload classes ([NASA risk classification fact sheet](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf); NPR 8705.4A has since been superseded by [NPR 8705.4B](https://sma.nasa.gov/news/articles/newsitem/2024/12/02/npr-8705-4b-risk-classification-for-nasa-payloads-formally-released-agencywide)):

| Class | Risk tolerance | Examples |
| --- | --- | --- |
| A | Lowest; very high priority and complexity | JWST, Europa Clipper, Roman |
| B | Low; high priority and complexity | MRO, Mars Science Laboratory, Psyche, GOES-R |
| C | Moderate | TESS, SPHEREx |
| D | High tolerance; lower priority, medium to low complexity | CYGNSS, TROPICS, ESCAPADE |

**Parts grade:** NASA GSFC EEE-INST-002 defines EEE parts Levels 1 (highest reliability, most manufacturing control and testing), 2, and 3 (high risk acceptable), and NASA notes the levels are not directly tied to mission class ([NASA NEPP parts assurance](https://nepp.nasa.gov/nepag/info/parts_assurance_level.htm); [NEPP use policy](https://nepp.nasa.gov/npsl../npsl_UsePolicy.htm)). JPL requires batteries to survive a single cell failure for most project types ([JPL DP Rev. 11, rule 4.3.3.6.2](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx)).

**Heritage vs new technology:** the SoA report lists Technology Readiness Level (TRL) for every product category; components with flight heritage (TRL 7 to 9) are the safe choice, while new technology carries more mass growth and schedule risk ([SoA 2026](https://www.nasa.gov/smallsat-institute/sst-soa/)). Probabilistic risk and failure case studies are in [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md).

## Component catalog for the game

**Representative values for a simplified simulation.** Each tier lists a real or typical product so the numbers are defensible. Costs are mostly not public; tiers use relative cost units (1 = cheapest) as a game abstraction. Use [04-cost-risk-programmatics.md](04-cost-risk-programmatics.md) for dollar estimates.

### Power generation

| Tier | Option | Performance | Mass | Source / basis |
| --- | --- | --- | --- | --- |
| Simple | Body-mounted triple-junction panels | ~400 W/m² of cell at 1 AU, 30% cells | small | [SoA Table 3-1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) Pmp values ~400 to 433 W/m² |
| Small-sat | Deployable CubeSat or ESPA arrays | 6U buses up to 40 to 400 W peak; ESPA-class 440 to 4,000 W peak | | [SoA Tables 2-4, 2-7](https://www.nasa.gov/smallsat-institute/sst-soa/platforms) |
| Large | Large deployable wings | Landsat 8: 4,300 W at EOL; Psyche 21 kW at Earth | | [eoPortal](https://www.eoportal.org/satellite-missions/landsat-8-ldcm); [JPL](https://www.jpl.nasa.gov/press-kits/psyche/mission/spacecraft/) |
| Special | MMRTG | 110 W BOL, 72 W at 17 yr | 45 kg | [NASA](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf) |

### Energy storage

| Tier | Example | Specific energy | Capacity | Source |
| --- | --- | --- | --- | --- |
| Simple | ISISPACE PBP-2S1P | 156.5 Wh/kg | 6.4 Ah | [SoA Table 3-5](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Small-sat | EaglePicher NPD-002271 | 153.5 Wh/kg | 14.5 Ah | same |
| Large | Landsat 8 NiH2 | older chemistry | 125 Ah | [eoPortal](https://www.eoportal.org/satellite-missions/landsat-8-ldcm) |

### ADCS

| Tier | Example | Mass | Power | Pointing | Source |
| --- | --- | --- | --- | --- | --- |
| Simple | Magnetorquers + magnetometer + sun sensors | < 0.5 kg | < 1 W | degrees | [SoA Tables 5-4, 5-6, 5-7](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control) |
| Small-sat | BCT XACT-15 integrated unit | 0.885 kg | not listed | 0.003° / 0.007° | [SoA Table 5-2](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control) |
| Large | BCT RW16 wheels + Jena-Optronik ASTRO APS3 star tracker | 7.5 kg per wheel; 1.8 kg tracker | 204 W peak per wheel; < 6 W tracker | 2.4 arcsec knowledge | [SoA Tables 5-3, 5-5](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control) |

### Communications

| Tier | Example | Mass | Data rate | RF power | Source |
| --- | --- | --- | --- | --- | --- |
| Simple | ISISPACE TRXVU (VHF/UHF) | 75 g | 9.6 kbit/s | 27 dBm (0.5 W) | [SoA Table 9-3](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications) |
| Small-sat S-band | EnduroSat S-band Transmitter | 250 g | ≤ 20 Mbit/s | 27 to 33 dBm | same |
| Small-sat X-band | SWIFT-XTX | 300 g | 25 Mbit/s | 33 dBm (2 W) | same |
| Deep-space small-sat | Deep-space X-band transponder (Table 9-3 entry) | 3.2 kg | 100 Mbit/s | | same |
| Large | Landsat 8 X-band; NISAR Ka-band | | 384 Mbit/s; 3.5 Gbit/s | | [eoPortal](https://www.eoportal.org/satellite-missions/landsat-8-ldcm); [NISAR](https://science.nasa.gov/mission/nisar/about-the-satellite) |

### Onboard computer

| Tier | Example | Notes | Source |
| --- | --- | --- | --- |
| Simple | STM32-class CDH board | < 2 W, TID ~30 krad, LEO | [SoA Table 8-4](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics) |
| Small-sat | ARM Cortex-A72 SpaceVPX board | < 25 W, 100 krad target | same |
| Large | RAD750 | 110 to 200 MHz, rad-hard, flagship heritage | [BAE](https://www.baesystems.com/en-us/dam/jcr:c297f318-c618-4015-9399-adf76ac5cf55/16-f78-RAD750-Component-datasheet-2025-web.2025-06-25-21-57-42.pdf) |

### Propulsion

| Tier | Option | Isp | Use |
| --- | --- | --- | --- |
| Simple | None or cold gas | 40 to 110 s | Deorbit-free low orbits, small trims |
| Small-sat | Green monoprop / hydrazine | 150 to 310 s / 200 to 235 s | Orbit maintenance, 50 to 300 m/s |
| Large / deep space | Biprop or Hall/ion | 300+ s / 1,500 to 3,100 s | Insertion burns / km/s-class cruises |

Source: [SoA 2026 Table 4-1](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion).

### Instruments

| Tier | Example | Mass | Power | Data | Science value hook |
| --- | --- | --- | --- | --- | --- |
| Simple | CubeSat multispectral camera (MultiScape100) | ~1.8 kg | ~6 W | ~0.5 Gbit/s while imaging (analysis) | Regional imaging, 4.75 m |
| Small-sat | Magnetometer, particle detector | < 1 kg | < 2 W | low | Space environment, cheap and data-light |
| Large | MODIS / VIIRS-class radiometer | 229 to 275 kg | 160 to 240 W | 6 to 11 Mbit/s | Daily global coverage |
| Large | OLI-class imager | 450 kg *unverified* | 375 W *unverified* | 265 Mbit/s | 30 m global land record |
| Flagship | SAR (NISAR-class) | large | high | Tbit/day | All-weather, day-night |

## Worked sizing examples

**Analysis.** All numbers computed with python3 from the formulas above. Inputs marked "assumed" are our choices, not sourced values.

### Example 1: 6U Earth-observation CubeSat, 500 km sun-synchronous orbit, 3-year life

**Orbit** (circular, worst-case beta angle 0, cylindrical shadow): period 94.62 min, eclipse 35.75 min, sunlit 58.86 min, 15.22 orbits/day, ground speed 7.06 km/s. Real dawn-dusk SSOs have little or no eclipse; a 10:30 SSO is near this worst case (orbit details in [02-mission-design-orbits-launch.md](02-mission-design-orbits-launch.md)).

**Mass budget** (component masses from SoA tables where named; others assumed):

| Item | Mass (kg) |
| --- | --- |
| Structure, 6U frame (SoA range 0.916 to 1.94) | 1.50 |
| Deployable solar arrays (assumed) | 1.00 |
| EPS board + battery pack (assumed) | 0.50 |
| OBC (assumed) | 0.10 |
| ADCS integrated unit (XACT-15) | 0.885 |
| UHF transceiver (TRXVU) | 0.075 |
| X-band transmitter (SWIFT-XTX) | 0.30 |
| Antennas (assumed) | 0.20 |
| Camera (MultiScape100) | 1.82 |
| Harness, thermal, fasteners (assumed) | 0.60 |
| **Basic mass** | **6.98** |
| MGA at 25% (assumed flat) | 1.75 |
| **Predicted mass** | **8.73** |
| CDS 6U limit | 12.00 |
| Margin | 3.27 kg (47% of basic) |

**Power** (assumed loads): OBC 1.5 W, ADCS 3.0 W, EPS and heaters 1.0 W sunlit / 1.5 W eclipse, UHF receive 0.5 W; camera 6 W for 30 s per orbit; X-band transmitter 15 W DC for four 10-minute passes per day, spread over each orbit as an average.

| Quantity | Value |
| --- | --- |
| Daylight load P_d | 6.47 W |
| Eclipse load P_e | 6.92 W |
| Required array output at EOL, P_sa (X_e 0.65, X_d 0.85) | 14.1 W |
| Cell output, 29.5% × 1361 W/m² | 401.5 W/m² |
| After I_d 0.77 and cos 23.5° | 283.5 W/m² (BOL) |
| After 3 years at 0.5%/yr | 279.3 W/m² (EOL) |
| Sun-facing cell area needed | 0.050 m² |

0.050 m² is about 1.7 times one 10 × 30 cm face. Body-mounted cells on a nadir-pointed CubeSat are rarely all facing the Sun, which is why 6U buses usually fly deployable, Sun-tracking wings.

**Battery:** eclipse energy 4.12 Wh. Over 3 years that is 16,665 cycles, so the JPL table caps DoD below 40%; at an assumed 30% DoD and 90% discharge efficiency the battery needs 15.3 Wh, about 0.10 kg of cells at 150 Wh/kg. Packaging, safety circuits, and single-cell-failure tolerance make real packs several times heavier, which is why the budget above carries 0.5 kg.

**Data:** 4.75 m GSD, 19.4 km swath, 7 bands, 12 bits (bits assumed) gives 4,084 pixels across and 1,486 lines per second, a raw rate of **510 Mbit/s while imaging**. Imaging 30 s per orbit yields 15.3 Gbit per orbit, **233 Gbit/day raw, 116 Gbit/day at 2:1 compression**.

**Downlink:** at 50 Mbit/s and four 8-minute passes the CubeSat returns **96 Gbit/day**, less than the 116 Gbit/day produced. The design does not close. Options a player could choose: image 25 s per orbit instead of 30, buy a fifth pass (cost), raise the rate toward the radio's limit (more power), or use fewer bands. This is exactly the kind of visible trade the brief asks for.

**Pointing:** a pixel is 9.5 µrad; 0.003° pointing (52 µrad) places images within about 26 m. Acceptable for regional imaging with ground correction.

### Example 2: ~500 kg Earth-observation smallsat, 500 km SSO, 5-year life

Assumed loads: bus 350 W continuous plus a 250 W payload at 25% duty in daylight; eclipse load 330 W.

| Quantity | Value |
| --- | --- |
| P_d / P_e | 412 W / 330 W |
| P_sa (EOL) | 794 W |
| EOL output, 5 years at 0.5%/yr | 276.5 W/m² |
| Sun-facing cell area | 2.87 m² |
| Battery cycles (5 years) | 27,775 |
| Eclipse energy | 197 Wh |
| Battery at 25% DoD (assumed, below JPL's 40% cap) | 874 Wh, about 5.8 kg of cells at 150 Wh/kg |
| Propellant for 150 m/s at Isp 220 s | 33.6 kg |

**Mass allocation** using the SMAD percentages on 466 kg dry: payload 191 kg, structure 93 kg, power 89 kg, ADCS 37 kg, C&DH 23 kg, thermal 9 kg, TT&C 9 kg, other 14 kg.

**Data:** a 5 m GSD, 30 km swath, 8-band, 12-bit imager produces 813 Mbit/s raw. At 10% duty that is 7.0 Tbit/day raw, 3.5 Tbit/day compressed. To return it in 8-minute passes requires about 49 passes per day at 150 Mbit/s, 24 at 300 Mbit/s, or 9 at 800 Mbit/s. Real missions solve this with high-rate X- or Ka-band (Landsat 8: 384 Mbit/s; NISAR: 3.5 Gbit/s), many polar ground stations, lower duty cycles, and onboard storage of terabits.

## Key numbers for the game

| Quantity | Value | Units | Source |
| --- | --- | --- | --- |
| Solar irradiance at 1 AU | 1361 | W/m² | [Kopp & Lean 2011](https://espo.nasa.gov/node/30086) |
| Solar flux scaling | 1 / d² | (d in AU) | [SoA 2026 §3.2.1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Triple-junction cell efficiency (BOL) | ~30 (28 to 32) | % | [SoA 2026 Table 3-1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Silicon cell efficiency | ~17 to 20 | % | same |
| Array power remaining, 15-yr GEO | 0.85 | fraction | [Spectrolab XTJ Prime](https://www.spectrolab.com/photovoltaics/XTJ-Prime_Data_Sheet.pdf) |
| Inherent degradation I_d | 0.77 | fraction | SMAD via [MIT OCW](https://ocw.mit.edu/courses/16-851-satellite-engineering-fall-2003/7555a121bb1544c25136b16869f7448c_ps2_cs_solution.pdf) *unverified* |
| Path efficiency X_e / X_d (DET) | 0.65 / 0.85 | | same |
| MMRTG output | 110 BOL, 72 at 17 yr | W | [NASA](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf) |
| MMRTG mass | 45 | kg | same |
| Li-ion cell specific energy | 150 to 270 | Wh/kg | [SoA 2026 §3.4.1](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Battery pack specific energy | ~90 to 180 typical | Wh/kg | [SoA 2026 Table 3-5](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems) |
| Max DoD, 5,000 to 30,000 cycles | 40 | % | [JPL DP Rev. 11](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx) |
| Max DoD, > 30,000 cycles | 20 | % | same |
| Eclipses per day at 500 km | ~15.2 | per day | Analysis |
| Max eclipse at 500 km | 35.8 of 94.6 | min | Analysis |
| CubeSat max mass 1U/3U/6U/12U | 2 / 6 / 12 / 24 | kg | [CDS Rev 14.1](https://www.nasa.gov/wp-content/uploads/2018/01/cubesatdesignspecificationrev14_12022-02-09.pdf) |
| SmallSat classes | nano 1 to 10, micro 10 to 100, mini 100 to 180 | kg | [SoA 2026](https://www.nasa.gov/smallsat-institute/sst-soa/introduction) |
| Isp cold gas / hydrazine / green / Hall / ion | 40 to 110 / 200 to 235 / up to ~310 / up to ~1,900 / up to ~3,100 | s | [SoA 2026 Table 4-1](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion); [JPL Dawn](https://webarchive.library.unt.edu/web/20130218172313/http://dawn.jpl.nasa.gov/mission/ion_prop.asp) |
| Star tracker knowledge | ~1 to 30 | arcsec | [SoA 2026 Table 5-5](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control) |
| Integrated CubeSat ADCS pointing | 0.002 to 1 | deg | [SoA 2026 Table 5-2](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control) |
| UHF / S / X CubeSat radio rates | ~10 to 40 kbit/s / ~1 to 20 Mbit/s / ~25 to 200 Mbit/s | | [SoA 2026 Table 9-3](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications) |
| Boltzmann constant | -228.6 | dBW/(K·Hz) | physical constant |
| DSN 34 m / 70 m X-band gain | 68.2 / 74.5 | dBi | [DSN 810-005](https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104P.pdf) |
| Required link margin | 3 | dB | [SoA 2026 §11.3.1](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations); [JPL DP](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx) |
| Max pass at 500 km, 10° mask | ~7.4 | min | Analysis |
| JPL mass margin MDR / PDR / CDR / launch | 23 / 12 / 5 / 0 (above MGA) | % | [JPL DP Rev. 11](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx) |
| JPL power margin MDR / PDR / CDR / launch | 25 / 15 / 12 / 10 | % | same |
| GSFC dry mass margin Pre-A / A / PDR / CDR (Rev I) | >15 / >15 / >10 / >5 | % | [GSFC-STD-1000 Rev I](https://standards.nasa.gov/system/files/tmp/GSFC-STD-1000RevI_Approved_0.pdf) |
| SMAD dry-mass fractions | payload 41, structure 20, power 19, ADCS 8, C&DH 5, thermal 2, TT&C 2 | % | [Univ. of Hawaii EPET 302](https://pressbooks-dev.oer.hawaii.edu/epet302/chapter/4-4-general-arrangement-and-design-drivers/) *unverified* |

## Game implications

**Analysis and design suggestions**, not official guidance.

| Mechanic | Physics behind it | Feature IDs |
| --- | --- | --- |
| Mass ledger with "basic + growth + margin" bars that shrink as the design matures | AIAA S-120A / JPL margin glide slope | RES-01, SPC-01, RES-07 |
| Structure mass auto-scales at ~20% of dry mass; CubeSat frames hard-capped by CDS limits | SMAD fraction; CDS Table 1 | SPC-01, SPC-07 |
| Power screen computes P_sa from player loads, eclipse fraction, Sun distance (1/d²), and EOL degradation; shows array area | SMAD energy balance; inverse square | SPC-02, RES-02, EDU-03 |
| Battery DoD slider that shortens battery life when pushed past the JPL table | JPL DoD rule | SPC-02, RES-06, EDU-05 |
| Distance warning: choosing Jupiter forces huge arrays or an MMRTG (cost and scarcity) | Juno vs MMRTG numbers | SPC-02, MIS-06 |
| Instrument cards with mass, power, data rate, duty cycle, pointing need, science value | Instrument tables | SPC-06, RES-04 |
| Resolution knob: halving GSD costs ~4x data and needs bigger aperture | Diffraction and pushbroom formulas | SPC-06, RES-04, EDU-05 |
| Recorder fill meter: data in minus data down per day; overflow loses science | Storage balance | SPC-04, RES-04, RES-07 |
| Link budget made visible: antenna, power, band, ground station size, distance; rate falls with d² | Link equations | SPC-03, RES-05, EDU-03 |
| Pointing tier must match instrument; mismatch blurs images (lower science score) | Pixel angle vs ADCS accuracy | SPC-05, SPC-06, EDU-05 |
| Reaction wheel momentum bar, desaturation by magnetorquers; random "wheel failure" event with K2-style workaround | Wheel saturation; Kepler | SPC-05, RES-07 |
| Safe mode event that costs science time and needs power margin | Fault protection, SOC margin | SPC-04, RES-02 |
| Propulsion choice via rocket equation: high Isp saves mass but needs power and time | Rocket equation, electric propulsion | RES-01, RES-02, RES-06, MIS-06 |
| Simple vs advanced tiers from the component catalog | Catalog tiers | SPC-07 |
| Redundancy toggle: +mass, +cost, -failure probability; risk class presets (A to D) | Redundancy architectures, NASA classes | RES-03, MIS-06 |
| Multiple valid designs (e.g., more passes vs bigger radio vs lower duty) all close the 6U example | Worked example 1 | MIS-06, EDU-05 |

## Sources

Primary NASA, standards, and mission sources:

- NASA Small Spacecraft Systems Virtual Institute, *State-of-the-Art of Small Spacecraft Technology*, 2026 edition: [index](https://www.nasa.gov/smallsat-institute/sst-soa/), [full PDF](https://www.nasa.gov/wp-content/uploads/2026/05/soa-2026.pdf), chapters [Introduction](https://www.nasa.gov/smallsat-institute/sst-soa/introduction), [Platforms](https://www.nasa.gov/smallsat-institute/sst-soa/platforms), [Power](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems), [Propulsion](https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion), [GNC](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control), [Structures](https://www.nasa.gov/smallsat-institute/sst-soa/structures-materials-and-mechanisms), [Thermal](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control), [Avionics](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics), [Communications](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications), [Ground Data Systems](https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations)
- Cal Poly, [CubeSat Design Specification Rev 14.1 (2022)](https://www.nasa.gov/wp-content/uploads/2018/01/cubesatdesignspecificationrev14_12022-02-09.pdf)
- NASA, [MMRTG fact sheet](https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf)
- JPL, [Design Principles Rev. 11, public release (effective Oct 16, 2025)](https://d2pn8kiwq2w21t.cloudfront.net/documents/jplrules_DocID_43913_11_v3-pdf_External_Release_V4.docx)
- NASA GSFC, [GSFC-STD-1000 Rev G, Rules for the Design, Development, Verification, and Operation of Flight Systems](https://standards.nasa.gov/sites/default/files/standards/GSFC/G/0/GSFC-STD-1000Revg_signature.pdf)
- ANSI/AIAA, [S-120A-2015 Mass Properties Control for Space Systems (store listing)](https://webstore.ansi.org/standards/aiaa/ansiaiaa120a2015)
- NASA NESC, [Reliable Method to Reason About Mass Growth (2020)](https://ntrs.nasa.gov/api/citations/20205003211/downloads/SAWE_NESC_MassGrowth.pdf)
- NASA, [Launch Services Risk Classification fact sheet](https://www.nasa.gov/wp-content/uploads/2023/12/risk-classification-fact-sheet.pdf); [NPR 8705.4B release note](https://sma.nasa.gov/news/articles/newsitem/2024/12/02/npr-8705-4b-risk-classification-for-nasa-payloads-formally-released-agencywide)
- NASA NEPP, [Parts assurance levels](https://nepp.nasa.gov/nepag/info/parts_assurance_level.htm); [NPSL use policy](https://nepp.nasa.gov/npsl../npsl_UsePolicy.htm)
- JPL DESCANSO / DSN, *Telecommunications Link Design Handbook 810-005*: [Module 101 Rev I (70 m)](https://deepspace.jpl.nasa.gov/dsndocs/810-005/101/101I.pdf), [Module 103 Rev D (34 m HEF)](https://deepspace.jpl.nasa.gov/dsndocs/810-005/103/103D.pdf), [Module 104 Rev P (34 m BWG)](https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104P.pdf)
- G. Kopp, [TSI page](https://spot.colorado.edu/~koppg/TSI/); Kopp and Lean 2011, [record](https://espo.nasa.gov/node/30086)
- JPL, [Juno solar distance record](https://www.jpl.nasa.gov/news/nasas-juno-spacecraft-breaks-solar-power-distance-record); [Juno facts](https://www.jpl.nasa.gov/news/press_kits/juno/facts); [Juno spacecraft press kit](https://www.jpl.nasa.gov/news/press_kits/juno/spacecraft)
- JPL, [Psyche spacecraft press kit](https://www.jpl.nasa.gov/press-kits/psyche/mission/spacecraft/); [DSOC](https://www.jpl.nasa.gov/missions/dsoc)
- JPL, [Dawn ion propulsion (archived)](https://webarchive.library.unt.edu/web/20130218172313/http://dawn.jpl.nasa.gov/mission/ion_prop.asp)
- NASA, [GPIM overview](https://www.nasa.gov/missions/tech-demonstration/green-propellant-infusion-mission-gpim-overview/); AFRL, [ASCENT propellant](https://afresearchlab.com/advanced-spacecraft-energetic-non-toxic-ascent-propellant/)
- NASA, [How does Webb stay cold](https://science.nasa.gov/mission/webb/science-overview/science-explainers/how-does-webb-stay-cold); JPL, [MIRI reaches operating temperature](https://www.jpl.nasa.gov/news/webb-telescopes-coldest-instrument-reaches-operating-temperature/)
- NASA, [Hubble one-gyro mode](https://science.nasa.gov/mission/hubble/observatory/design/hubble-one-gyro-mode/); STScI, [2024 release](https://www.stsci.edu/contents/news-releases/2024/news-2024-023)
- Van Cleve et al. 2016, [That's How We Roll: K2 performance](https://arxiv.org/pdf/1512.06162)
- NASA SCaN, [Galileo history](https://www.nasa.gov/directorates/heo/scan/images/history/July1995_2.html); NASA APPEL, [Galileo's rocky road to Jupiter](https://appel.nasa.gov/wp-content/uploads/2013/04/546504main_42s_galilieo_rocky_road_jupiter.pdf)
- JPL, [MRO antennas (archived)](https://webarchive.library.unt.edu/web/20090813145340/http://mars.jpl.nasa.gov/mro/mission/sc_antennas.html); IEEE Spectrum, [Mars gets a broadband connection](https://spectrum.ieee.org/mars-gets-broadband-connection)
- NASA, [Aqua MODIS](https://science.nasa.gov/mission/aqua/modis/); NASA LAADS, [VIIRS](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/viirs/); NASA, [NISAR satellite](https://science.nasa.gov/mission/nisar/about-the-satellite); NASA GSFC, [TIRS-2 presentation](https://nescacademy.nasa.gov/downloadFile/1137)

Secondary and vendor sources:

- WMO OSCAR, [OLI](https://space.oscar.wmo.int/instruments/view/oli); [VIIRS](https://space.oscar.wmo.int/instruments/view/viirs)
- ESA eoPortal, [Landsat 8 / LDCM](https://www.eoportal.org/satellite-missions/landsat-8-ldcm)
- University of Valencia, [MODIS summary](https://www.uv.es/leo/sen2flex/modis.htm)
- Simera Sense, [ESA Phi-Week 2018 presentation](https://phiweek2018.esa.int/agenda/files/presentation320.pdf); SatCatalog, [MultiScape100 CIS](https://www.satcatalog.com/component/multiscape100-cis/)
- Spectrolab, [XTJ Prime datasheet](https://www.spectrolab.com/photovoltaics/XTJ-Prime_Data_Sheet.pdf)
- BAE Systems, [RAD750 component datasheet (2025)](https://www.baesystems.com/en-us/dam/jcr:c297f318-c618-4015-9399-adf76ac5cf55/16-f78-RAD750-Component-datasheet-2025-web.2025-06-25-21-57-42.pdf)
- MIT OpenCourseWare 16.851, [Satellite Engineering problem set 2 solution (SMAD-based EPS sizing code)](https://ocw.mit.edu/courses/16-851-satellite-engineering-fall-2003/7555a121bb1544c25136b16869f7448c_ps2_cs_solution.pdf)
- Valispace, [EPS sizing tutorial](https://www.valispace.com/wp-content/uploads/2018/12/EPS-sizing-tutorial-1.pdf)
- University of Hawaii, EPET 302 open textbook: [General arrangement and design drivers](https://pressbooks-dev.oer.hawaii.edu/epet302/chapter/4-4-general-arrangement-and-design-drivers/); [Power design process](https://pressbooks-dev.oer.hawaii.edu/epet302/chapter/5-4-design-process-and-drivers/)
- MacKenzie, [Satellite Mass Growth, ICEAA 2016](https://www.iceaaonline.com/wp-content/uploads/2016/10/SS01-ppt-MacKenzie-Sattelite-Mass-Growth.pdf)
- Psyche mission blog, [Phase B margins](https://psyche.ssl.berkeley.edu/?p=1162)
- Textbook reference (not accessed directly): Wertz, Everett, and Puschell, *Space Mission Engineering: The New SMAD* (2011), and Larson and Wertz, *Space Mission Analysis and Design*, 3rd ed. (1999). Values attributed to "SMAD" above come through the secondary sources listed, not from the books themselves.
