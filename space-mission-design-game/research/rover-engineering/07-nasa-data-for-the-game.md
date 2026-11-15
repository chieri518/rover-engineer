# NASA Data for the Game

Real NASA data that can make the Moon mission feel more real and more fun, what each dataset adds to play, and how hard it is to use. The team has already decided to build the Moon map from real terrain. Everything else here is a recommendation. Decisions live in [game design](../../game-design.md#nasa-data).

Researched November 14, 2026. Written for our team, not for players.

Quick navigation: [Recommended site](#recommended-site-de-gerlache-rim) · [Data catalog](#data-catalog) · [What the data adds](#what-each-dataset-adds-to-play) · [Orbital map layers](#feature-idea-orbital-map-layers) · [How to use the data](#how-to-use-the-data) · [Mars later](#data-to-research-for-mars) · [Open items](#open-verification-items) · [Sources](#sources)

## Recommended site: de Gerlache rim

**Our analysis.** The map should be a small area, about 2 km × 2 km, cut from a real south pole elevation model. The de Gerlache crater rim is the strongest candidate because several real datasets line up there:

| Why de Gerlache rim | Detail | Source |
| --- | --- | --- |
| A ready-made 5 m elevation model | NASA's LOLA team publishes 5 m per pixel elevation and slope files for "Site11: de Gerlache rim" | [PGDA LOLA 5 m DEMs](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) |
| An Artemis III candidate region | "de Gerlache Rim 2" is one of the nine regions NASA named in October 2024 (secondary source) | [Space.com, 2024](https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission) |
| Real fault scarps | A small cluster of young thrust-fault scarps lies inside the de Gerlache Rim 2 region, and the largest de Gerlache scarp may have caused one of the strongest shallow moonquakes Apollo recorded (modeled at about magnitude 5) | [Watters et al. 2024, Planetary Science Journal](https://doaj.org/article/f70d4bb2d83a4c538d8245b3c74ac96e); [Smithsonian release](https://dashboard.si.edu/es/newsdesk/releases/shrinking-moon-causes-temblors-and-faults-lunar-south-polar-region) |
| A shadowed crater next door | De Gerlache crater's floor is a permanently shadowed region, a real cold trap where water ice can survive | [PGDA illumination products](https://pgda.gsfc.nasa.gov/products/69) |

Alternatives with 5 m elevation files in the same NASA folder include the Shackleton rim (Site04), the peak near Shackleton (Site07), the connecting ridge (Site01), and Malapert massif (Site23) ([PGDA LOLA 5 m DEMs](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/)). The Site11 tile and the Artemis "de Gerlache Rim 2" region may not cover exactly the same ground, so check the overlap before claiming it in the pitch.

Suggested pitch line: *"You are driving on real Moon terrain measured by NASA's Lunar Reconnaissance Orbiter, at a site where astronauts may one day land."*

## Data catalog

Priority is our analysis for the Moon build: **Core** means build it in, **Strong** means it adds a lot for moderate effort, **Extra** means do it if time allows.

| Data | NASA source | What it gives the game | Format and effort | Priority |
| --- | --- | --- | --- | --- |
| **Terrain** | LRO laser altimeter (LOLA) south pole site models, 5 m per pixel, with ready-made slope files ([PGDA](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/), [README](https://core2.gsfc.nasa.gov/PGDA/LOLA_5mpp/README), [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)). Wider 30 m tiles also exist ([PGDA 92](https://pgda.gsfc.nasa.gov/products/92)). | The map itself, plus real slopes for "too steep" and damage zones | GeoTIFF, polar stereographic, in meters. Crop and convert to a heightmap image with a small Python script. Low effort. | **Core** (decided) |
| **Low Sun and moving shadows** | At both lunar poles the Sun is never more than 1.5° above or below the horizon; it skims the horizon instead of rising and setting, and far-off mountains cast long shadows ([NASA](https://science.nasa.gov/resource/shadows-near-the-moons-south-pole), [SVS 4893](https://svs.gsfc.nasa.gov/4893)) | Shadows sweep across the map during the mission. The Moon stays "all daylight", but safe spots move. | No file needed: a simple Sun-direction model in code. Very low effort. | **Core** |
| **Permanent shadow and sunlight maps** | LOLA polar illumination and permanently shadowed region maps ([PGDA 69](https://pgda.gsfc.nasa.gov/products/69); [Barker et al. 2023](https://ntrs.nasa.gov/citations/20230014419)); an LROC camera-based illumination map for 88–90°S ([LROC](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_PCT_SOUTH)) | Puts the cold zones exactly where they really are, and shows which ridges get the most sunlight for solar power | GeoTIFF rasters. Crop to the same area as the terrain. Low to moderate effort. | **Core** |
| **Temperatures and ice depth** | Diviner Polar Resource Product: annual average and maximum surface temperature, and depth to stable ice, for the south pole ([ODE help](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/LRO/DIVINER/PRP.htm), PDS ID LRO-L-DLRE-5-PRP-V2.0); seasonal polar maps ([Diviner team](https://www.diviner.ucla.edu/single-post/2020/07/20/new-diviner-seasonal-polar-data-products)) | How cold each zone is (how fast the rover freezes), and where ice can exist at all | A text table of points. Needs gridding onto the map. Moderate effort. | **Strong** |
| **Where ice is actually exposed** | Moon Mineralogy Mapper (M3) found surface water ice in only about 3.5% of cold traps, patchy, and some spots may hold about 30% ice by weight; most south pole ice is in craters ([JPL, 2018](https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles); [Li et al. 2018, PNAS](https://www.pubmed.gov/30126996/)) | A placement rule: most cold spots are dry, and only a few hold ice. Drilling the wrong crater finds nothing, which makes the find feel earned. | Use as a rule, not a file. The M3 pixels are about 280 m, too coarse to map directly. Very low effort. | **Strong** |
| **Moonquakes** | Apollo seismometers recorded only 28 shallow moonquakes over the whole experiment, magnitude 3 to 5 by some estimates ([PDS background](https://pds-geosciences.wustl.edu/Lunar/urn-nasa-pds-apollo_seismic_event_catalog/document/lunar_seismology_background.pdf)); full event catalog in the PDS ([catalog description](https://pds-geosciences.wustl.edu/Lunar/urn-nasa-pds-apollo_seismic_event_catalog/document/moonquake_catalog_desc.pdf)). South pole fault scarps and landslide risk, including in some shadowed regions ([Watters et al. 2024](https://doaj.org/article/f70d4bb2d83a4c538d8245b3c74ac96e)) | Quakes are rare but strong, stronger near the fault scarp, and can trigger slides on crater walls | Place the scarp on the map by hand from the paper's figure. Real Apollo recordings could drive the camera shake. Low effort (moderate for real recordings). | **Strong** |
| **Real solar flares** | NASA's space weather database DONKI lists real flares with class and time ([CCMC DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI)); its API endpoint is `api.nasa.gov/DONKI/FLR` | Each in-game flare is a real past flare, shown with its date and class: "This X-class flare really happened on …" | JSON. Download once and ship a small list with the game. Do not call the API during play: third-party reports describe outages (*unverified*). Low effort. | **Strong** |
| **Earth in the sky** | At the south pole, Earth is below the horizon about half of each lunar day ([NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)); NASA visualization of Earth and Sun seen from the south pole ([SVS 4944](https://svs.gsfc.nasa.gov/4944)) | Earth hangs low on the horizon and bobs up and down. The "Earth on the horizon" photo is only possible while Earth is up. | A simple model in code. Low effort. | **Strong** |
| **Star field** | NASA SVS Deep Star Maps 2020: about 1.7 billion stars from Hipparcos-2, Tycho-2, and Gaia DR2; the 4K version is about 34 MB ([SVS 4851](https://svs.gsfc.nasa.gov/4851)) | A real night sky above the airless Moon | EXR image. Convert to a smaller JPG sky texture. Very low effort. | **Strong** |
| **Rocks** | Diviner rock abundance: typically under 1%, higher on fresh crater ejecta and crater walls ([Bandfield et al. 2011](https://gemelli.spacescience.org/jbandfield/publications/bandfield_diviner_ra.pdf); [GDR L3](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/LRO/DIVINER/GDR_L3.htm)) | A placement rule for boulder fields: dense around fresh craters and on crater walls, sparse elsewhere | Use as a rule; the gridded map is coarse for a 2 km area. Very low effort. | **Extra** |
| **Whole-Moon globe** | NASA SVS CGI Moon Kit: LROC color map and LOLA height map, finest version about 470 m per pixel at the equator (our calculation from 64 pixels per degree) ([SVS 4720](https://svs.gsfc.nasa.gov/4720)) | The Moon seen from orbit on the mission screen or during landing | Image textures. Too coarse for driving. Very low effort. | **Extra** |
| **3D models and textures** | NASA 3D Resources, free and without copyright, subject to NASA's usage guidelines ([GitHub](https://github.com/nasa/NASA-3D-Resources), [site](https://nasa3d.arc.nasa.gov/)) | Spacecraft, landing site, and Moon models for menus or Easter eggs | glTF or OBJ. Check each model's license notes. Low effort. | **Extra** |
| **Regolith strength** | Apollo 15 Lunar Roving Vehicle mobility studies, including soil density and strength estimates ([NASA TR R-401 PDF](https://www.nasa.gov/wp-content/uploads/static/history/alsj/19730008090_1973008090.pdf)) | Grounds the "getting stuck" rule: heavier rovers sink deeper in soft soil | Reading only, no file. *Values not yet extracted.* | **Extra** |

Numbers already sourced in [03](03-surface-environments-and-operations.md#key-numbers-for-the-game), such as shadowed-crater temperatures of about 33 to 38 K, Moon gravity of 1.62 m/s², and the 1.3 s signal delay, can be used alongside these.

## What each dataset adds to play

**Our analysis.** The best data changes what the player does, not only how the game looks.

| The player notices | Because of | What it changes in play |
| --- | --- | --- |
| Shadows creep across the map | Low polar Sun | A sunny charging spot can fall into shadow. Players learn to plan around light. |
| Some craters are dangerously cold, some only chilly | Diviner temperatures | Heater choice matters, and the cold zone has a real gradient |
| Most craters have no ice | M3 findings | Players learn that ice is rare and patchy, the same lesson VIPER was built to test |
| Quakes hit harder near the cliff | Watters et al. fault scarps | A real hazard zone to avoid or risk |
| The flare warning names a real flare | DONKI | The event feels real, and it teaches that solar flares are frequent |
| Earth sinks below the horizon | Polar geometry | The Earth photo is a timing puzzle. Later, it could become a contact blackout. |
| A real star sky | SVS star maps | Atmosphere and presentation |

**Teaching moment.** Real cameras in bright sunlight usually show no stars because the exposure is set for the bright ground, which is why many Apollo surface photos have black, starless skies (our analysis; common photography explanation). The game could show stars only when the rover is in shadow or with lights off.

## Feature idea: orbital map layers

**Our analysis.** Give the mission control screen a minimap with switchable layers, each labeled with the instrument that measured it:

| Layer | Instrument |
| --- | --- |
| Elevation and slope | LRO LOLA |
| Sunlight and permanent shadow | LRO LOLA and LROC |
| Surface temperature and ice depth | LRO Diviner |

This is how real teams plan: VIPER's traverse planning combined orbital light, temperature, and terrain data ([NTRS VIPER](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)). It also makes the NASA data visible to judges, who check that NASA resources have a real role.

## How to use the data

**Our analysis.**

1. **Process everything offline.** A Python script crops each dataset to the same 2 km square and saves small files the game loads: a heightmap PNG, a shadow mask PNG, a temperature grid, and a flare list in JSON.
2. **Never call live APIs during play.** It keeps the game fast and avoids API keys and outages.
3. **Keep a credits file.** Record each dataset, its instrument, and its citation. It doubles as the evidence list for judging and the in-game "data sources" screen.
4. **Follow NASA's media guidelines.** NASA data and most imagery are free to use, but do not use NASA logos or imply endorsement.

## Data to research for Mars

Not researched in depth yet. Starting points when the Mars design begins:

- Mars terrain from HiRISE stereo elevation models (about 1 m) and global MOLA elevation.
- Mars weather from rover stations (Curiosity's REMS, Perseverance's MEDA) for day and night temperatures.
- Dust storm opacity measured by the rovers, which drives solar power ([03](03-surface-environments-and-operations.md#dust-storms-optical-depth-and-solar-power)).
- Marsquakes recorded by InSight.

## Open verification items

- Whether the Site11 "de Gerlache rim" elevation tile overlaps the Artemis "de Gerlache Rim 2" region and the fault scarp cluster.
- The exact file names in the PGDA folder (the README and the page use different naming).
- The current Artemis III candidate list. The October 2024 list of nine regions is the latest official list found; no confirmed 2026 update was found.
- Whether the DONKI API is currently reliable.
- The resolution of the Diviner Polar Resource Product over a 2 km area.
- Soil strength values from NASA TR R-401.

## Sources

- [PGDA: South Pole Landing Site LOLA DEMs (5 m)](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) and [README](https://core2.gsfc.nasa.gov/PGDA/LOLA_5mpp/README)
- [PGDA 78: High-Resolution LOLA Topography for Lunar South Pole Sites](https://pgda.gsfc.nasa.gov/products/78)
- [PGDA 92: Large-scale Lunar Elevation Models (30 m tiles)](https://pgda.gsfc.nasa.gov/products/92)
- [PGDA 69: Lunar Polar Illumination](https://pgda.gsfc.nasa.gov/products/69)
- [Barker et al. 2021, improved LOLA elevation models (NTRS)](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf)
- [Barker et al. 2023, south pole topography and PSRs (NTRS)](https://ntrs.nasa.gov/citations/20230014419)
- [LROC WAC south pole illumination map](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_PCT_SOUTH)
- [NASA: Shadows near the Moon's South Pole](https://science.nasa.gov/resource/shadows-near-the-moons-south-pole) and [SVS 4893](https://svs.gsfc.nasa.gov/4893)
- [NASA SVS 4944: Earth and Sun from the Moon's South Pole](https://svs.gsfc.nasa.gov/4944)
- [Diviner Polar Resource Product (ODE help)](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/LRO/DIVINER/PRP.htm), [Diviner data page](https://www.diviner.ucla.edu/data), [seasonal polar products](https://www.diviner.ucla.edu/single-post/2020/07/20/new-diviner-seasonal-polar-data-products)
- [Bandfield et al. 2011, Diviner rock abundance](https://gemelli.spacescience.org/jbandfield/publications/bandfield_diviner_ra.pdf) and [Diviner GDR L3](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/LRO/DIVINER/GDR_L3.htm)
- [JPL: Ice confirmed at the Moon's poles (2018)](https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles) and [Li et al. 2018, PNAS](https://www.pubmed.gov/30126996/)
- [PDS: Lunar seismology background](https://pds-geosciences.wustl.edu/Lunar/urn-nasa-pds-apollo_seismic_event_catalog/document/lunar_seismology_background.pdf) and [moonquake catalog description](https://pds-geosciences.wustl.edu/Lunar/urn-nasa-pds-apollo_seismic_event_catalog/document/moonquake_catalog_desc.pdf)
- [Watters et al. 2024, The Planetary Science Journal](https://doaj.org/article/f70d4bb2d83a4c538d8245b3c74ac96e) and [Smithsonian release](https://dashboard.si.edu/es/newsdesk/releases/shrinking-moon-causes-temblors-and-faults-lunar-south-polar-region)
- [CCMC DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI)
- [NASA SVS 4851: Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851)
- [NASA SVS 4720: CGI Moon Kit](https://svs.gsfc.nasa.gov/4720)
- [NASA 3D Resources (GitHub)](https://github.com/nasa/NASA-3D-Resources)
- [NASA TR R-401: LRV mobility performance, Apollo 15 (PDF)](https://www.nasa.gov/wp-content/uploads/static/history/alsj/19730008090_1973008090.pdf)
- [NTRS: VIPER mission planning (2022)](https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf)
- [Space.com: NASA announces 9 possible Artemis III landing regions (2024)](https://www.space.com/space-exploration/artemis/nasa-announces-9-possible-moon-landing-sites-for-artemis-3-lunar-mission)
