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

## Moon sites features (added for review by the pipeline owner)

Added for the Moon sites and milestones plan (requests P1 to P5 in
`space-mission-design-game/moon-sites-and-milestones-plan.md`). Additive: no image changes, and every
value that was already in `terrain.json` stays the same.

```sh
.venv/bin/python build_terrain.py --site-features-only   # refresh only the four lists below
.venv/bin/python measure_legs.py --check --out out/moon-site-legs.json
```

`--site-features-only` runs the usual build but writes only the four Moon sites lists (and their notes)
into the existing `terrain.json`. A full build produces the same lists. `moon_sites.py` does the work.
It reads `albedo.jpg` from the output folder if it exists, for the ejecta brightness.

| List | Rule | Count |
| --- | --- | --- |
| `coldTraps` (P1) | PSR fraction ≥ 0.5 (60 m map, bilinear to 5 m), ≥ 2,000 m². For patches under 0.1 km², `horizonCheck5m` repeats the test on the game's 5 m heights: the whole Sun disc is hidden at every azimuth for the highest Sun of the 18.6-year cycle. It samples every 10 m over the patch and 40 m around it: `permanentShadowArea_m2` counts all of that, `insidePatch_m2` only the patch | 9 |
| `youngCraters` (P2) | 40 to 150 m across, within 1.6 km, from the 5 m DEM: rim radius where the azimuth-averaged profile peaks (this ignores the regional slope), depth ≥ 2.5 m, depth/diameter ≥ 0.04, rim on ≥ 75% of azimuths. `fresh`: depth/diameter ≥ 0.08 and an inner wall ≥ 30°. `ejectaAlbedoRatio`: `albedo.jpg` ring R to 2R over ring 2.5R to 4R | 8 (2 fresh) |
| `boulderTrackCandidates` (P3) | Steepest-descent runs from walls steeper than 25° to where the slope drops under 12°, run 50 to 150 m (20 m inside young craters), foot within 1.2 km, young craters first. Placements, not detections | 5 |
| `lowLightPatches` (P4) | Average illumination < 15%, PSR < 0.5, slope < 15° (heights smoothed over ~20 m), within 1 km, ≥ 2,000 m². `innerPoint` is the point farthest inside | 1 |

Ids: `cold-trap-rocky-area-1` and `cold-trap-shadowed-crater` are fixed (each goes to the one patch that
overlaps Rocky area 1's circle or the shadowed crater's outline most); the others are named by 8-point
compass direction from the landing (`young-crater-east`, `cold-trap-south`), numbered by distance when a
direction has several (fresh craters first). The compass is the local frame's: "north" is local −z
(polar-stereographic +Y, toward longitude 0 and Earth), not geographic north, which at the pole is every
direction. `game/data/sites.json` refers to these ids, so a rule change that renames one needs that file
updated too. NaN (no data) in the LOLA maps is skipped, not read as 0; there is none in this play area. Each entry with a route has `drivePoint`
and `driveDistanceFromLanding_m` (the 20 m routes used by the other features).

**`measure_legs.py` (P5)** measures balance legs between nodes from the game's own outputs
(`heightmap.png`, the distant rings, `cold-mask.png`, `terrain.json`) and `game/data/tuning.json`'s Sun
path, so it needs no raw data. It uses 10 m least-cost routes (2 × 2 block-averaged heights, cost
1 + 0.5 (slope/18°)², over 18° forbidden, permanent shadow forbidden except to or from the dark crater,
cells within 200 m of the edge forbidden) and the game's shadow test every 10 s. Each 10 m cell is treated
as sitting at the grid position of its block's first 5 m sample, 2.5 m (in x and z) from the block's true
center, and its cold flag samples `cold-mask.png` at that same 5 m pixel (2r, 2c). The offset is kept
because it reproduces `balance.json` best, as in `build_terrain.py`'s 20 m grid. `--check` re-measures `balance.json`'s 90 legs (the original tool is
not in the repo; the cost weight 0.5 was chosen to match them). `--out` writes the new nodes in
`NEW_NODES`, every leg that touches one, and each cold trap's closest approach to an existing leg, to
`out/moon-site-legs.json`. It never edits `balance.json`.

`--check` result: distances within 0.7% on average (5.2% at most), climb and descent within 9 m, cold
meters within 3.8 m on average, leg light shares within 0.019 on average, node light shares and heights
exact. One node differs: `balance.json` says Earth is in view at `rocky1North`, but from 1 m up (the HUD's
test) a ridge hides it by 2.3° (it shows from 2 m up), so the original tool probably used a higher eye or
a nearby point.

`eastBench` in `NEW_NODES` is hand-picked by a stated rule (see the comment there): the most Earth-clear
cell 300 to 450 m east of the landing with a mean slope under 5° over 45 m.

Points to review:

- The East and South cold traps are each one 60 m source pixel (fraction 0.92). The 5 m horizon test
  confirms East (about 7,400 m² in shadow) and finds South marginal (about 900 m²).
- Python 3.13 here instead of 3.14: a plain rebuild differs from the committed outputs by 1/255 in 7
  pixels of `illumination.png` and `earth-visibility.png`, and by 1 m in 16 vertices of the shadowed crater
  outline, plus the date and two file sizes in `terrain.json` (resampling float noise). That is why `--site-features-only` exists; those files were not rebuilt.
- The 1.54° subsolar latitude and 0.267° Sun radius in `moon_sites.py` are physical constants (the
  Moon's axial tilt to the ecliptic, as in the LOLA PSR maps; the Sun's angular radius as in
  `terrainData.ts`), not read from `tuning.json`; it warns if `tuning.json`'s mission Sun leaves ±1.54°.
- `moon_sites.py` borrows the height sampler and shadow march from `measure_legs.py` (the port of
  `terrainData.ts`).

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
