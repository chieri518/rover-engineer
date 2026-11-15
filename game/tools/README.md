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
