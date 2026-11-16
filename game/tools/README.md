# Terrain pipeline

`build_terrain.py` turns NASA LOLA data for the de Gerlache rim into the files in
`game/public/terrain/`. It runs offline; the game only loads the outputs.

## Run

```sh
cd game/tools
python3.14 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python build_terrain.py --preview /tmp/terrain-preview.png
```

The first run downloads about 140 MB into `raw/` (Site11 DEM and slope, three
60 m illumination maps) and reads windows of the 20 m and 80 m polar DEMs over
HTTP (they are cloud-optimized GeoTIFFs, so only the needed part is fetched,
about 60 MB). Later runs reuse `raw/` and take about 10 seconds. `raw/` and
`.venv/` are git-ignored.

rasterio ships wheels for Python 3.14 (with GDAL bundled), so no system GDAL is
needed.

Options: `--center X Y` forces the play-area center (polar-stereographic
meters); `--out DIR` changes the output folder.

## What it does

1. **Inputs.** Site11 5 m DEM and slope (Barker et al. 2021); LOLA 60 m average
   illumination, permanent-shadow (PSR) and Earth-visibility maps (Mazarico et
   al. 2011); 20 m and 80 m polar DEMs (Barker et al. 2023).
2. **Landing point.** Flat (mean slope ≤ 3° over 75 m, max ≤ 8° over 45 m),
   sunlit (average illumination ≥ 45%), Earth often visible (≥ 30%), and
   1.5 to 3 km from a real PSR of at least 0.1 km². The play area is centered on
   it, shifted only as needed to stay inside the Site11 tile.
3. **Features.** Drive routes are least-cost paths on a 20 m grid that avoid
   slopes over 20°. Rim viewpoints: crest points with the biggest drop within
   1 km. Rocky areas: small fresh craters. Shadowed crater: the cheapest PSR to
   reach, with an entry point and an ice spot (deepest inside the shadow).
   Crater descent: a point 150 m below the landing on the de Gerlache side.
4. **Outputs.** See `terrain.json` for every decode formula and the frame.

| File | Size | Content |
| --- | --- | --- |
| `heightmap.png` | 1601², 16-bit | Play area heights, 5 m |
| `slope.png` | 1601², 8-bit | Slope, degrees = value / 4 |
| `cold-mask.png` | 1601², 8-bit | PSR fraction × 255 (≥ 128 = permanent shadow) |
| `illumination.png` | 1601², 8-bit | Average fraction of time sunlit × 255 |
| `earth-visibility.png` | 1601², 8-bit | Average fraction of time Earth is visible × 255 |
| `distant-near.png` | 1001², 16-bit | 50 km square at 50 m (from the 20 m DEM) |
| `distant-far.png` | 1001², 16-bit | 400 km square at 400 m (from the 80 m DEM) |
| `terrain.json` | | Frame, decoding, landing, features, horizon, sources |
| `albedo.jpg` | 1601², 8-bit JPEG | Ground albedo from LROC NAC (from `build_texture.py`) |
| `texture.json` | | Albedo grid, decoding, source and credit |

## Ground texture (`build_texture.py`)

```sh
.venv/bin/python build_texture.py --preview /tmp/texture-preview.png
```

Run after `build_terrain.py` (it reads the play-area window from `terrain.json`
and the Site11 DEM from `raw/`; it never edits `terrain.json`). The first run
downloads the 176 MB LROC NAC 5 m mosaic of the de Gerlache rim
(`NAC_ROI_DEGERRIMLO1_P885S2933_5M.IMG`, PDS archive) into `raw/`; later runs
take about 20 seconds. No extra packages.

1. **Crop.** The 5 m mosaic is pixel-aligned with Site11, so the play area is a
   plain crop: pixel (col, row) sits on heightmap vertex (col, row). The script
   checks this against `heightmap.png` and reports the DEM-to-image shift that
   best explains the image shading (0 to 1 pixel here).
2. **Remove baked shading.** The mosaic mixes images with three Sun azimuths,
   all with the Sun 1 to 4° high. Around every pixel (150 m Gaussian) it fits a
   Lambert model, image ≈ gain × (DEM normal · Sun), by least squares, and
   divides it out. The result is albedo relative to the ~150 m neighbourhood.
3. **Fill.** Shadows (no signal in the image), no-data and grazing-light pixels
   get texture copied from nearby lit ground, so holes are not flat paint.
4. **Encode.** Linear albedo = 0.22 × ratio, stored as sRGB 8-bit grayscale
   JPEG (`albedo.jpg`, about 0.75 MB). `texture.json` has the grid, UVs, value
   decoding, source, credit and the method's limits.

Limits: brightness differences over more than ~300 m are flattened (in this
mosaic they are mostly exposure differences); craters smaller than ~20 m keep
their baked bright/dark crescents; filled areas (about 20%, including every
permanently shadowed floor) are plausible, not real. The 1 m version of the
mosaic (1.5 GB, row-interleaved, not cloud-optimized) is not used: an 8 km
texture at 1 m would be far over a web budget.

## Conventions

- Local frame: meters, y up. `x = X − originX`, `z = originY − Y` (X, Y are
  south polar stereographic). Image columns go with +x, rows with +z.
- Heights are **tangent-plane heights**: LOLA elevation minus the curvature drop
  r²/2R from the origin. A flat-world renderer then gets the real horizon
  distance. The drop is 4.6 m at 4 km, 180 m at 25 km and 11.5 km at 200 km.
- Every grid is vertex-centered on the origin: sample (col, row) sits at
  `x = (col − n//2) × pixel_m`, `z = (row − n//2) × pixel_m`.
- **16-bit PNGs cannot be read through a browser canvas** (it reduces them to 8
  bits). Decode them with a PNG library such as `fast-png` in the game.

## Mars: Jezero crater (`build_terrain_mars.py`, `build_texture_mars.py`)

```sh
.venv/bin/python build_terrain_mars.py --preview /tmp/mars-preview.png
.venv/bin/python build_texture_mars.py --preview /tmp/mars-texture.png
```

The outputs go to `game/public/terrain/mars/` in the Moon's format: the same
`terrain.json` shape, plus Mars features (the schema is in the Mars build log).
Shared helpers are in `mars_common.py`; the Moon scripts are not used. No extra
packages are needed.

The first run reads windows of the USGS Mars 2020 TRN products over HTTP and
caches them in `raw/mars/`, about 230 MB on disk:

- the HiRISE 1 m DTM: an 8.6 km window (about 750 MB transferred, because the
  file is stored in full-width strips) plus one decimated pass over the whole
  file (1.8 GB transferred);
- the HiRISE 25 cm orthomosaic: an 8.3 km window cached at 2.5 m (about 500 MB of
  tiles, about 10 minutes);
- the JPL CTX 20 m DEM (90 MB), a MOLA 463 m window, and the Crumpler et al.
  2023 shapefiles from Zenodo.

Later runs take about a minute.

1. **Frame.** Azimuthal equidistant on the Mars sphere (R = 3396190 m, the sphere
   of every product), centered 1 km west of Perseverance's landing site. x points
   east and z south. Heights are above the areoid, minus the curvature drop, as on
   the Moon.
2. **Landing.** The flattest spot (mean slope over 75 m, at most 8° over 45 m)
   300 to 600 m from Perseverance's landing site. Ties go to the spot nearer the
   delta.
3. **Features.** Drive routes are least-cost paths on a 10 m grid that avoid
   slopes over 18°.
   - **Delta front:** the line is the HiRISE contour at the foot of the scarp
     (8 m above the Three Forks floor) around Hawksbill Gap, kept where a scarp
     of at least 15 m rises behind it. The sample spot is Hawksbill Gap (rover
     waypoint). The viewpoint is the floor spot 200 to 400 m out with the
     steepest view up the cliffs.
   - **Séítah:** no machine-readable map of it exists, so its outline was traced
     by hand on the HiRISE data and is stored as lat/lon in the script.
   - **Soft ground:** ripple fields found in the 2.5 m orthomosaic by orientation
     coherence (megaripple crests), plus Crumpler's mapped ripples. Only those
     inside Séítah plus 150 m are kept, reported as one circle per 150 m cell.
   - **Rocky areas:** Crumpler's mapped ejecta blocks, and the sharpest small
     crater on the floor away from the other sites.
   - **West viewpoint:** the high drivable spot within 3.5 km with the lowest
     horizon toward the Ls 200 sunset (azimuth 261°).
4. **Distant terrain.** The near ring blends HiRISE (the 8 m pass) into the CTX
   DEM; the far ring blends CTX into MOLA. Datum offsets between the models are
   measured and applied (under 7 m).
5. **Texture.** The orthomosaic is resampled onto the play grid. Only the
   shading relative to flat ground is divided out (local Lambert fit over
   400 m), so real albedo differences stay. Grayscale JPEG, mean linear albedo
   0.25.

| File | Size | Content |
| --- | --- | --- |
| `heightmap.png` | 1601², 16-bit | Play area heights, 5 m |
| `slope.png` | 1601², 8-bit | Slope, degrees = value / 4 |
| `soft-ground.png` | 1601², 8-bit | Séítah ripples, softness = value / 255 |
| `distant-near.png` | 1001², 16-bit | 50 km square at 50 m |
| `distant-far.png` | 1001², 16-bit | 200 km square at 200 m |
| `albedo.jpg` | 1601², 8-bit JPEG | HiRISE orthomosaic, shading removed |
| `terrain.json`, `texture.json` | | Frame, decoding, landing, features, sources |

## Titan: Shangri-La dunes near Selk (`build_terrain_titan.py`, `build_texture_titan.py`)

```sh
.venv/bin/python build_terrain_titan.py --preview /tmp/titan-preview.png
.venv/bin/python build_texture_titan.py --preview /tmp/titan-texture.png
```

Titan has no rover-scale elevation model, so this terrain is **modeled on
Cassini data, not measured**. A seeded generator (identical output on every run,
about 30 s, nothing downloaded) builds it from published measurements. Every
parameter cites its source in the script and in `terrain.json` `sources`.
Credits say "modeled on Cassini data", never "real elevation". Shared helpers
are in `titan_common.py`; the Moon and Mars scripts are not used. The outputs go
to `game/public/terrain/titan/` in the Mars file set, plus Titan features (the
schema is in the Titan build log).

1. **Frame.** Azimuthal equidistant on the Titan sphere (R = 2574.73 km), with
   longitudes east. The center is 85 km from Selk's center (IAU: 7.0 N, 161.0 E,
   80 km), on the line toward Dragonfly's landing-ellipse center (Lorenz et al.
   2021). That is about 30 km north of the ellipse, on Dragonfly's route to Selk.
   Heights are meters above the interdune floor at the origin, minus the
   curvature drop.
2. **Dunes.** Linear dunes run west to east (Radebaugh et al. 2008), 2.2 to
   3.3 km apart. Crests stand 85 to 110 m high on bases 1.3 to 1.4 km wide, with
   wide, low plinths around them. A branch joins Dune 2 in a Y-junction. Dune 1,
   the last dune before Selk's ejecta, is smaller (about 50 m high, 0.75 km
   wide) and bends to run along the ejecta edge. Its low, firmer saddle is the
   crossing route. The landing sits just south of Dune 1, so every site is
   within about 1.3 km of driving (the battery-only budget).
3. **Soft ground.** `soft-ground.png` is graded: loose crest and upper-flank sand
   0.85, lower flanks 0.3 to 0.6, plinths, interdunes and ejecta 0. Under the
   Moon's ground rules, a reference rover gets stuck only if it climbs straight
   up a loose flank steeper than about 14°. Circles covering the loose sand are
   written too, for the circle-based rule.
4. **Selk.** The edge of Selk's ejecta (about one crater radius beyond the rim)
   crosses the north of the map, and the dunes fade out into it. The far ring
   shows Selk at its true position (rim +200 m, floor -150 m).
5. **Texture.** Grayscale albedo, not shaded: dark dunes, bright interdunes,
   mottled ejecta with bright blocks, a bright sample patch, and Huygens-like
   pebble speckle around the landing.
6. **Intermediate.** `raw/titan/units.npz` (git-ignored) carries the dune and
   ejecta units from the terrain script to the texture script.

| File | Size | Content |
| --- | --- | --- |
| `heightmap.png` | 1601², 16-bit | Play area heights, 5 m |
| `slope.png` | 1601², 8-bit | Slope, degrees = value / 4 |
| `soft-ground.png` | 1601², 8-bit | Dune sand, softness = value / 255 (graded) |
| `distant-near.png` | 1001², 16-bit | 50 km square at 50 m (generated dunes, Selk ejecta) |
| `distant-far.png` | 1001², 16-bit | 200 km square at 200 m (with Selk crater) |
| `albedo.jpg` | 1601², 8-bit JPEG | Generated ground albedo |
| `terrain.json`, `texture.json` | | Frame, decoding, landing, features, sources |
