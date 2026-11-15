# Moon Surface Data

Data for building the drivable Moon surface: elevation for the play area and the distant terrain, imagery for textures, rocks and craters for obstacles, and soil numbers for driving and getting stuck. This builds on [07](07-nasa-data-for-the-game.md), which covers sunlight, temperatures, ice, moonquakes, flares, and the sky. Decisions live in [game design](../../game-design.md#map).

Researched November 14, 2026. Written for our team, not for players. Items marked *unverified* could not be confirmed from a primary source.

Quick navigation: [Summary](#summary) · [Site check](#site-check-de-gerlache-rim) · [Elevation](#elevation) · [Imagery](#surface-imagery-for-textures) · [Rocks and craters](#rocks-and-craters) · [Soil and driving](#soil-and-driving) · [Other layers](#other-layers) · [Recommended stack](#recommended-stack) · [Credits and licenses](#credits-and-licenses) · [Sources](#sources)

## Summary

- **The 8 km play area fits.** NASA's 5 m elevation tile for the de Gerlache rim covers **16 km × 16 km**. We confirmed this from the file's own header (3,200 × 3,200 pixels at 5 m).
- **A sharper version exists.** A 2025 NASA product refines the same area with camera images (shape-from-shading), giving crisper craters on the same 5 m grid. Its license is CC-BY 4.0.
- **The horizon can be real.** NASA's polar elevation maps at 20 m and 80 m per pixel cover hundreds of kilometers, so real distant mountains such as Malapert and Mons Mouton can appear on the horizon.
- **Real images of the shadowed crater floor.** LROC has a 1 m image mosaic of the de Gerlache rim, and ShadowCam has photographed the inside of the permanently shadowed de Gerlache crater.
- **Real soil numbers.** We extracted Apollo 15 rover data for soil density, strength, wheel sinkage, slip, and slope limits, enough to ground the "getting stuck" rule.

## Site check: de Gerlache rim

| Question | Answer |
| --- | --- |
| Does the 5 m data cover an 8 km × 8 km area? | Yes. The Site11 tile is 16 km × 16 km, centered at about 88.7°S, 68°W on the northeast rim of de Gerlache crater (confirmed from the file header) |
| Does it match the Artemis III candidate region? | Partly. A 2025 NASA region named "de Gerlache Rim" almost exactly matches the tile. The separate "de Gerlache Rim 2" region overlaps only the tile's outer edge (our geometry from published bounding boxes). |
| What can we say in the pitch? | "de Gerlache Rim", not "Rim 2". Check the current Artemis list before claiming "where astronauts may land". |
| Alternatives | Shackleton rim (Site04) and connecting ridge (Site01) are also 16 km × 16 km; Malapert massif (Site23) is 21 km × 21 km |

## Elevation

| Dataset | Resolution | Coverage | What it is for | License and effort |
| --- | --- | --- | --- | --- |
| **LOLA site model, Site11 de Gerlache rim** ([file](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site11/Site11_final_adj_5mpp_surf.tif), [folder](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/)) | 5 m | 16 × 16 km, 41 MB | Play area heightmap (fallback). Matching slope file: `Site11_final_adj_5mpp_slp.tif` | NASA, no license stated (*unverified*); cite Barker et al. 2021. Low effort. |
| **Shape-from-shading models, Bertone et al. 2025** ([Zenodo](https://zenodo.org/records/17954508), [PGDA 104](https://pgda.gsfc.nasa.gov/products/104)) | 5 m grid, sharper detail | 13 Artemis regions including de Gerlache Rim (about 20 km box). Each download is 1.3 to 2.2 GB and includes hillshade, slope, and roughness maps. | **Play area heightmap (recommended):** same area as Site11 with crisper craters | CC-BY 4.0. Medium effort (large download). |
| **LOLA polar elevation maps, Barker et al. 2023** ([folder](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/), [PGDA 90](https://pgda.gsfc.nasa.gov/products/90)) | 10, 20, 40, 80 m | 20 m version about 608 km across; 80 m version 181 MB | **Distant terrain:** 20 m out to about 30 km, 80 m out to about 150 km | NASA; cite Barker 2023. Low effort: the files are cloud-optimized, so a script can download just the window we need. |
| LOLA 87°S mosaic ([file](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp.tif)) | 5 m | 87–90°S, about 150 km across, 3.3 GB | A seamless 5 m apron around the play area, if needed | NASA. Medium effort. |
| LROC camera stereo models ([Shackleton rim](https://data.lroc.im-ldi.com/lroc/dtm_detail/182)) | 2 m | About 5 × 5 km each (*our estimate*), Shackleton rim, connecting ridge, and Malapert only | Not for de Gerlache. Could be a 2 m core if the site became Shackleton. | Public domain. Medium effort; holes where shadows hide the ground. |

No public 1 to 2 m elevation model of the de Gerlache rim was found.

## Surface imagery for textures

| Dataset | Resolution | Coverage | Use | Notes |
| --- | --- | --- | --- | --- |
| **LROC mosaic of de Gerlache rim** ([product](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_DEGERRIMLO1)) | 1 m (also 5 m and 20 m) | About 37 × 31 km, covers the whole Site11 tile. 144 images from 2009 to 2013. | Ground color and detail texture; a real image for the map screen | Shadows from the low Sun are baked into the images, so lighten or blend them before using as a texture |
| LROC south pole mosaic ([product](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_POLE_SOUTH)) | 1 m | 85.5–90°S | Downsample for the distant terrain texture | |
| **ShadowCam mosaics of de Gerlache crater** ([archive](https://pds.shadowcam.im-ldi.com/derived/umosaic/)) | About 1.7 m | 12 mosaics of the permanently shadowed crater floor (a 5 m version is 243 MB). Also Shackleton and Malapert. Latest release May 22, 2026. | **Real view inside the shadowed crater** for the "Into the dark" zone | ShadowCam flies on Korea's Danuri orbiter and sees by faint reflected light. Sunlit areas are overexposed by design. Positions accurate to about 60 m. License not stated (*unverified*, likely public domain like other PDS data). |
| LOLA surface brightness map | 1 km | 50–90°S | Overall color tint only | Too coarse for anything else |

## Rocks and craters

The elevation data shows craters down to tens of meters. Smaller craters and boulders have to be placed by rules based on real statistics.

| Source | What it gives |
| --- | --- |
| [Boazman et al. 2022](https://boris.unibe.ch/179288) | Boulders, rocky craters, and outcrops mapped near Shackleton. Boulders become rarer with distance from a fresh crater rim. Catalog released under CC-BY. |
| Chandrayaan-2 high-resolution camera (ISRO), Shackleton–de Gerlache ridge (LPSC 2024) | Over 5,000 boulders counted, from 0.65 to 7.9 m; more than 99% are under 4 m |
| [Robbins 2018 crater database](https://astrogeology.usgs.gov/search/map/moon_crater_database_v1_robbins) | Large named and mapped craters (complete only to about 1 to 2 km, *unverified*). Gives just a few craters inside 8 km. |
| Global boulder maps (Bickel and others) | Cover only 60°S to 60°N, so not our site |

**Placement rules for the game** (based on Gault 1970 and Minton et al. 2019 crater statistics, and the boulder counts above):

- Small craters: roughly 200 to 800 craters of 10 m or larger per km², and many more small ones. Fewer craters per km² is fine for gameplay.
- Boulders: dense on fresh crater rims and walls, sparse elsewhere (rock cover under 1% on average, per Diviner).
- Almost all boulders are under 4 m across.

## Soil and driving

Values extracted from the Apollo 15 Lunar Roving Vehicle report, NASA TR R-401 (Costes et al. 1972, [NTRS PDF](https://ntrs.nasa.gov/api/citations/19730008090/downloads/19730008090.pdf)), plus Carrier's soil profile.

| Property | Real value | Game use |
| --- | --- | --- |
| Soil density | About 1.0 to 1.3 g/cm³ at the surface, over 1.5 at 10 to 20 cm, up to about 1.9 below 1 m | Surface soil is fluffy; deeper soil is firm |
| Cohesion | Most probably 0.1 to 1.0 kPa near the surface; over 3 kPa below 50 cm | Soft top layer |
| Friction angle | 30° to 50°, nearing 55° at depth | Grip |
| Ground pressure | An LRV wheel pressed about 7 kN/m², the same as an astronaut's boot | Baseline for "light enough" |
| Wheel sinkage | Typically 1.25 cm. 5 to 7 cm on the soft rims of small fresh craters. About 13 cm when wheels spun in place. | Default sinkage, soft-rim zones, and the getting-stuck state |
| Slip | Under about 20% slip, drivers did not notice it | Above about 20% slip, the rover starts digging in |
| Slopes | Apollo 15 drove 10° to 12° slopes; the design limit was about 20° to 25° | Climbing limit about 20°; steeper causes sliding or damage |
| Obstacles | Limits: a 30 cm step and a 70 cm crevasse | Rocks taller than this block the rover |
| Speed | Comfortable driving speed 6 to 7 km/h | Reference for game speed (the game runs faster) |
| Energy | Energy use changed only 11 to 16% per km across very different soil conditions | Soil type should not dominate energy use; mass and slope matter more |

Soil on slopes is looser and weaker than on flat ground. No published VIPER mobility numbers were found (*unverified*).

## Other layers

| Layer | Source | Resolution | Possible use |
| --- | --- | --- | --- |
| Surface roughness | [PGDA 90](https://pgda.gsfc.nasa.gov/products/90) roughness maps | Down to 50 m | Rough ground slows the rover and shakes the camera |
| Slope | PGDA site and polar slope files | 5 to 20 m | Too-steep and tip-over zones |
| Hydrogen (sign of water) | LRO LEND neutron detector ([PDS](https://pds-geosciences.wustl.edu/missions/lro/lend.htm)); about 105 ppm by weight poleward of 80°S, about 140 ppm poleward of 88°S | About 10 km | A fact for the ice milestone, or a later unlockable layer |
| Hydrogen, older map | Lunar Prospector neutron maps ([PDS](https://pds-geosciences.wustl.edu/missions/lunarp/reduced_special.html)) | Tens of km | Context only |
| Shadowed region names and outlines | [LROC PSR Atlas](https://lroc.im-ldi.com/atlases/psr) | n/a | Names and outlines for the cold zones |

## Recommended stack

**Our analysis.** All processing happens offline in a Python script; the game ships small files.

| Part of the map | Use | Fallback |
| --- | --- | --- |
| 8 km play area (height) | Bertone 2025 de Gerlache Rim model, cropped to 8 km | Site11 5 m tile |
| Slopes | Slope file from the same product | Computed from the heightmap |
| Distant terrain | 20 m polar map out to about 30 km, then 80 m out to about 150 km, so real mountains show on the horizon | 80 m only |
| Ground texture | LROC 1 m de Gerlache mosaic with shadows lightened, plus repeating grey regolith detail | Procedural texture only |
| Shadowed crater floor | ShadowCam de Gerlache mosaics | Dark procedural texture |
| Small craters and boulders | Placed by the rules above | Hand-placed |
| Soil | Default sinkage 1 to 2 cm, 5 to 7 cm on fresh crater rims, stuck above about 20% slip; weaker soil on slopes; climbing limit about 20° | Simple fixed values |

## Credits and licenses

- Credit LROC images "NASA/GSFC/Arizona State University". Data from the official archives (PDS) is public domain. Non-archive LROC images need permission for commercial use ([LROC terms](https://lroc.im-ldi.com/about/terms)).
- The Bertone 2025 models are CC-BY 4.0: credit the authors.
- Cite Barker et al. 2021 and 2023 for the LOLA elevation data.
- Add all of these to the in-game data sources screen.

## Open verification items

- Licenses for the PGDA LOLA files and ShadowCam mosaics (no license stated; likely public domain).
- The current Artemis III candidate list.
- The size of the LROC 2 m stereo models (estimated from file sizes).
- Lunar Sourcebook soil values by depth, quoted from memory by the research agent.

## Sources

- [PGDA LOLA 5 m site models](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) and [README](https://core2.gsfc.nasa.gov/PGDA/LOLA_5mpp/README); Site11 GeoTIFF header (read November 14, 2026)
- [PGDA 90: LOLA polar elevation, slope, and roughness](https://pgda.gsfc.nasa.gov/products/90) and [20 m folder](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/)
- [PGDA 104](https://pgda.gsfc.nasa.gov/products/104) and [Bertone et al. 2025 on Zenodo](https://zenodo.org/records/17954508)
- [LROC: de Gerlache rim mosaic](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_DEGERRIMLO1), [south pole mosaic](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_POLE_SOUTH), [stereo models](https://data.lroc.im-ldi.com/lroc/dtm_detail/182), [terms](https://lroc.im-ldi.com/about/terms), [PSR Atlas](https://lroc.im-ldi.com/atlases/psr)
- [ShadowCam derived products (PDS)](https://pds.shadowcam.im-ldi.com/derived/umosaic/)
- [NASA TR R-401, Costes et al. 1972 (NTRS)](https://ntrs.nasa.gov/api/citations/19730008090/downloads/19730008090.pdf)
- [Boazman et al. 2022](https://boris.unibe.ch/179288)
- [Robbins 2018 crater database](https://astrogeology.usgs.gov/search/map/moon_crater_database_v1_robbins)
- Minton et al. 2019, Icarus (crater equilibrium); Gault 1970
- [LRO LEND (PDS)](https://pds-geosciences.wustl.edu/missions/lro/lend.htm); Sanin et al. 2017
- [Lunar Prospector reduced data (PDS)](https://pds-geosciences.wustl.edu/missions/lunarp/reduced_special.html)
