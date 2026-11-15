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
