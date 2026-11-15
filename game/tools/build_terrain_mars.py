#!/usr/bin/env python3
"""Build the Mars terrain assets (Jezero crater) for Rover Engineer.

Reads the USGS Mars 2020 Terrain Relative Navigation HiRISE and CTX elevation
models, MOLA, and published feature maps, picks the landing point near
Perseverance's landing site, places the delta front, Seitah, soft ground, rocky
areas and viewpoints, and writes web-sized PNGs plus terrain.json into
game/public/terrain/mars/.

Usage (from game/tools/, inside the venv):
    python build_terrain_mars.py                     # download what is missing, build
    python build_terrain_mars.py --preview out.png   # also render a preview image

Everything is offline; the game never calls these URLs.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from pathlib import Path

import numpy as np
from matplotlib.path import Path as MplPath
from rasterio.warp import Resampling
from scipy import ndimage
from skimage.graph import MCP_Geometric
from skimage.measure import approximate_polygon, find_contours

from mars_common import (MARS_R, ORTHO_CACHE_RES, OUT, RAW, URLS, curvature_drop, fetch, gdal_env, hillshade,
                         latlon_to_local, ortho_cache, ripple_coherence,
                         local_to_latlon, log, read_shapefile, remote_window, slope_deg, to_local_grid,
                         write_png8, write_png16)

# ---- Anchors -------------------------------------------------------------------
# Perseverance's landing position (Octavia E. Butler Landing), Mars 2020 waypoints, sol 13.
OEB = (18.44463, 77.45089)
# The play area is centered 1 km west of it, so the delta front, Seitah and the
# landing all sit well inside the 8 km square.
CENTER_FROM_OEB = (-1000.0, 0.0)  # local x (east), z (south), m

# Real rover positions (Mars 2020 waypoints, end-of-drive points) used as anchors.
WAYPOINTS_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json"
HAWKSBILL_GAP = (18.4587, 77.4060)  # sols 501-502, Wildcat Ridge sample (delta front)
THREE_FORKS = (18.4530, 77.4083)  # sols 658-693, sample depot at the delta front base
ENCHANTED_LAKE = (18.4507, 77.4014)  # sols 565-592, delta front (Cape Nukshak)
SEITAH_ENTRY = (18.4327, 77.4413)  # sol 201, the rover's first look into Seitah
SEITAH_SAMPLES = (18.43397, 77.44301)  # Brac sample site inside Seitah (Simon et al. 2023, Table 2)

ZENODO = "https://zenodo.org/api/records/7545299/files"
CRUMPLER_LAYERS = ["Ripples", "Crater Ejecta Blocks", "Float-Lag", "Seitah_1"]

# ---- Output grids (all vertex-centered on the frame origin) ---------------------
PLAY_HALF, PLAY_RES = 4000, 5  # 1601 x 1601, 8 km
NEAR_HALF, NEAR_RES = 25000, 50  # 1001 x 1001, 50 km
FAR_HALF, FAR_RES = 100000, 200  # 1001 x 1001, 200 km
SLOPE_SCALE = 4  # slope.png value = degrees * 4
SOFT_SCALE = 255  # soft-ground.png value = softness * 255

# ---- Selection rules ------------------------------------------------------------
DRIVE_RES = 10  # m, drive-cost grid
DRIVE_MAX_SLOPE = 18.0  # deg at 10 m scale
LAND_MEAN_SLOPE = 3.0  # deg, mean over ~75 m
LAND_MAX_SLOPE = 8.0  # deg, max over ~45 m
LAND_FROM_OEB = (300.0, 600.0)  # m: near Perseverance's landing site, not on it
EDGE_MARGIN = 200.0  # m
EYE_HEIGHT = 1.7  # m
DELTA_ZONE_RADIUS = 150.0  # m around the scarp-foot line
DELTA_FOOT_LEVEL_ABOVE_FLOOR = 8.0  # m above the Three Forks floor: scarp-foot contour
DELTA_SCARP_HALF_LENGTH = 1300.0  # m of scarp kept on each side of Hawksbill Gap
DELTA_MIN_RELIEF = 15.0  # m of scarp within 100 m behind the foot line
SUNSET_MAX_DIST = 3500.0  # m from the landing (straight line), to keep it reachable in a mission
SUNSET_AZIMUTH = 261.0  # deg from north; sunset at 18.4 N for Ls 200 (solar declination -8.4 deg)

# Seitah outline (lat, lon), traced by this pipeline on the HiRISE DTM hillshade and
# orthomosaic (rough, ridged terrain with dark megaripples, below the Maaz scarp),
# following the Seitah unit in Farley et al. 2022 (Fig. 1) and the eolian bedform
# areas of Sun & Stack 2020 (USGS SIM 3464). Only the part inside the play area.
# The ridged, light-toned layered unit (an arc from Brac in the NE to the SW), the
# megaripple band along its eastern edge, and the darker plain it encloses north to
# Kodiak. Approximate (+-100 m).
SEITAH_OUTLINE = [
    (18.43417, 77.44306), (18.43181, 77.44378), (18.43147, 77.43844), (18.43113, 77.43488), (18.42776, 77.43311),
    (18.42270, 77.43133), (18.41764, 77.42866), (18.41342, 77.42422), (18.40836, 77.41799), (18.40330, 77.41266),
    (18.39823, 77.40821), (18.39570, 77.40110), (18.40076, 77.39577), (18.40920, 77.39754), (18.41932, 77.39932),
    (18.42776, 77.39932), (18.43366, 77.40287), (18.43535, 77.40999), (18.43704, 77.41710), (18.43822, 77.42421),
    (18.43872, 77.42777), (18.43704, 77.43311), (18.43518, 77.43844),
]
RIPPLE_COHERENCE = 0.6  # orientation coherence above which the 2.5 m image texture counts as ripples
RIPPLE_MIN_AREA = 5000.0  # m^2, smallest ripple patch kept
RIPPLE_MAX_SLOPE = 12.0  # deg at 5 m: ripple fields are flat at that scale; steeper texture is bedrock
SOFT_BUFFER = 150.0  # m: soft ground is the ripples inside Seitah's outline plus this margin
SOFT_CELL = 150.0  # m: soft ground is reported as one circle per cell of this size


def ll(lat, lon, o):
    x, z = latlon_to_local(lat, lon, *o)
    return float(x), float(z)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--preview", type=Path)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    lat0, lon0 = (float(v) for v in local_to_latlon(*CENTER_FROM_OEB, *OEB))
    O = (lat0, lon0)
    log(f"play-area origin {lat0:.5f} N {lon0:.5f} E")

    # ---- 1. Inputs ------------------------------------------------------------
    pad = 300.0
    dlat = math.degrees((PLAY_HALF + pad) / MARS_R)
    dlon = math.degrees((PLAY_HALF + pad) / (MARS_R * math.cos(math.radians(lat0))))
    eq = lambda lat, lon: (MARS_R * math.radians(lon), MARS_R * math.radians(lat))  # noqa: E731 (eqc, lat_ts 0)
    x0, y0 = eq(lat0 - dlat, lon0 - dlon)
    x1, y1 = eq(lat0 + dlat, lon0 + dlon)
    dtm1 = remote_window(URLS["hirise_dtm"], (x0, y0, x1, y1), 1, RAW / f"hirise_dtm_1m_{lat0:.4f}_{lon0:.4f}.tif", chunk_rows=1024)
    dtm8 = remote_window(URLS["hirise_dtm"], (-1e9, -1e9, 1e9, 1e9), 8, RAW / "hirise_dtm_8px.tif", chunk_rows=4096)
    ctx = fetch(URLS["ctx_dem"], RAW / "M20_JezeroCrater_CTXDEM_20m.tif")
    fl = math.degrees((FAR_HALF * 1.5) / MARS_R)
    fo = math.degrees((FAR_HALF * 1.5) / (MARS_R * math.cos(math.radians(lat0))))
    mola = remote_window(URLS["mola"], (*eq(lat0 - fl, lon0 - fo), *eq(lat0 + fl, lon0 + fo)), 1,
                         RAW / "mola_463m_jezero.tif")
    vec = {}
    for name in CRUMPLER_LAYERS:
        for ext in ("shp", "shx", "dbf", "prj"):
            fetch(f"{ZENODO}/{name.replace(' ', '%20')}.{ext}/content", RAW / "crumpler2023" / f"{name}.{ext}")
        vec[name] = read_shapefile(RAW / "crumpler2023" / f"{name}.shp")

    # ---- 2. Play area -----------------------------------------------------------
    z_w = to_local_grid(dtm1, lat0, lon0, PLAY_HALF, PLAY_RES, Resampling.average)
    if np.isnan(z_w).any():
        raise SystemExit(f"{np.isnan(z_w).mean():.1%} of the play area has no HiRISE data; move the center")
    N = z_w.shape[0]
    hN = N // 2
    sl_w = slope_deg(z_w, PLAY_RES)
    yy, xx = np.mgrid[0:N, 0:N]
    gx, gz = (xx - hN) * PLAY_RES, (yy - hN) * PLAY_RES
    ht_w = z_w - curvature_drop(gx, gz)

    def rc(x, z, res=PLAY_RES, half_n=hN):
        return int(round(z / res + half_n)), int(round(x / res + half_n))

    # ---- 3. Drive grid (10 m) ---------------------------------------------------
    k = DRIVE_RES // PLAY_RES
    z10 = ndimage.gaussian_filter(z_w, 0.5 * k)[::k, ::k]
    n10 = z10.shape[0]
    h10 = n10 // 2
    s10 = slope_deg(z10, DRIVE_RES)
    cost = 1.0 + 2.0 * (s10 / DRIVE_MAX_SLOPE) ** 2
    cost[s10 > DRIVE_MAX_SLOPE] = np.inf
    m = int(EDGE_MARGIN / DRIVE_RES) // 2
    cost[:m, :] = cost[-m:, :] = np.inf
    cost[:, :m] = cost[:, -m:] = np.inf
    yy10, xx10 = np.mgrid[0:n10, 0:n10]
    x10, z10g = (xx10 - h10) * DRIVE_RES, (yy10 - h10) * DRIVE_RES

    def rc10(x, z):
        return rc(x, z, DRIVE_RES, h10)

    def nearest_ok(x, z, ok, radius):
        r, c = rc10(x, z)
        d = np.hypot(x10 - x, z10g - z)
        cand = ok & (d <= radius)
        if not cand.any():
            return None
        i = np.unravel_index(np.argmin(np.where(cand, d, np.inf)), d.shape)
        return float(x10[i]), float(z10g[i])

    # Anchors in the local frame.
    oeb = ll(*OEB, O)
    hawks = ll(*HAWKSBILL_GAP, O)
    forks = ll(*THREE_FORKS, O)

    # Connectivity: the drivable component that holds Three Forks (crater floor at the delta).
    finite = np.isfinite(cost)
    lab, _ = ndimage.label(finite)
    floor_lab = lab[rc10(*forks)]
    reach = lab == floor_lab

    # ---- 4. Landing --------------------------------------------------------------
    mean75 = ndimage.uniform_filter(sl_w, 15)
    max45 = ndimage.maximum_filter(sl_w, 9)
    d_oeb = np.hypot(gx - oeb[0], gz - oeb[1])
    cand = (mean75 <= LAND_MEAN_SLOPE) & (max45 <= LAND_MAX_SLOPE) & (d_oeb >= LAND_FROM_OEB[0]) & (d_oeb <= LAND_FROM_OEB[1])
    cand &= np.kron(reach, np.ones((k, k), bool))[:N, :N]
    d_hawks = np.hypot(gx - hawks[0], gz - hawks[1])
    # Flattest first; among equally flat spots, the one nearer the delta (1 deg ~ 500 m).
    score = np.where(cand, mean75 + d_hawks / 500.0, np.inf)
    lr, lc = np.unravel_index(np.argmin(score), score.shape)
    land_x, land_z = float(gx[lr, lc]), float(gz[lr, lc])
    log(f"landing at local ({land_x:.0f}, {land_z:.0f}), {d_oeb[lr, lc]:.0f} m from OEB, "
        f"mean slope {mean75[lr, lc]:.2f} deg")

    mcp = MCP_Geometric(cost)
    cum, _ = mcp.find_costs([rc10(land_x, land_z)])
    reach = np.isfinite(cum)
    d_land10 = np.hypot(x10 - land_x, z10g - land_z)
    paths = {}

    def drive(x, z):
        t = rc10(x, z)
        if not np.isfinite(cum[t]):
            return None
        path = np.array(mcp.traceback(t))
        return round(float(np.sum(np.hypot(*np.diff(path, axis=0).T)) * DRIVE_RES)), path

    def site(name, x, z, source, **extra):
        r, c = rc(x, z)
        lat, lon = local_to_latlon(x, z, *O)
        dr = drive(x, z)
        if dr is not None:
            paths[name] = dr[1]
        f = {
            "name": name,
            "local": {"x": round(x), "y": round(float(ht_w[r, c]), 2), "z": round(z)},
            "latLon": [round(float(lat), 5), round(float(lon), 5)],
            "elevation_m": round(float(z_w[r, c]), 1),
            "slope_deg": round(float(s10[rc10(x, z)]), 1),
            "distanceFromLanding_m": round(math.hypot(x - land_x, z - land_z)),
            "driveDistanceFromLanding_m": None if dr is None else dr[0],
            "source": source,
        }
        f.update(extra)
        return f

    landing = site("Landing", land_x, land_z,
                   "Picked by this pipeline: flattest spot 300-600 m from Perseverance's landing site, toward the delta")
    for key in ("distanceFromLanding_m", "driveDistanceFromLanding_m"):
        landing.pop(key)
    landing["slope_deg_75m_mean"] = round(float(mean75[lr, lc]), 2)
    landing["distanceFromPerseveranceLanding_m"] = round(float(d_oeb[lr, lc]))

    # ---- 5. Distant terrain ---------------------------------------------------------
    def feather(valid, px):
        """Weight 0 outside `valid`, rising to 1 over `px` pixels inside it."""
        return np.clip(ndimage.distance_transform_edt(valid) / px, 0, 1)

    def median_offset(a, b):
        d = a - b
        d = d[np.isfinite(d)]
        return float(np.median(d)) if d.size else 0.0

    hir_n = to_local_grid(dtm8, lat0, lon0, NEAR_HALF, NEAR_RES, Resampling.average)
    ctx_n = to_local_grid(ctx, lat0, lon0, NEAR_HALF, NEAR_RES, Resampling.average)
    ctx_f = to_local_grid(ctx, lat0, lon0, FAR_HALF, FAR_RES, Resampling.average)
    mola_f = to_local_grid(mola, lat0, lon0, FAR_HALF, FAR_RES, Resampling.bilinear)
    mola_n = to_local_grid(mola, lat0, lon0, NEAR_HALF, NEAR_RES, Resampling.bilinear)
    off_ctx = median_offset(hir_n, ctx_n)  # HiRISE minus CTX, over the overlap
    off_mola = median_offset(ctx_f + off_ctx, mola_f)
    log(f"datum offsets: HiRISE - CTX {off_ctx:+.1f} m, (CTX+off) - MOLA {off_mola:+.1f} m")
    lo_n = np.where(np.isfinite(ctx_n), ctx_n + off_ctx, mola_n + off_mola)
    w = feather(np.isfinite(hir_n), 10)  # 500 m blend
    near = np.where(np.isfinite(hir_n), w * np.nan_to_num(hir_n) + (1 - w) * lo_n, lo_n)
    w = feather(np.isfinite(ctx_f), 5)  # 1 km blend
    far = np.where(np.isfinite(ctx_f), w * np.nan_to_num(ctx_f + off_ctx) + (1 - w) * (mola_f + off_mola),
                   mola_f + off_mola)
    for a in (near, far):
        if np.isnan(a).any():
            idx = ndimage.distance_transform_edt(np.isnan(a), return_distances=False, return_indices=True)
            a[:] = a[tuple(idx)]
    ny, nx = np.mgrid[0:near.shape[0], 0:near.shape[0]]
    nxl, nzl = (nx - near.shape[0] // 2) * NEAR_RES, (ny - near.shape[0] // 2) * NEAR_RES
    fy, fx = np.mgrid[0:far.shape[0], 0:far.shape[0]]
    fxl, fzl = (fx - far.shape[0] // 2) * FAR_RES, (fy - far.shape[0] // 2) * FAR_RES
    near_t = near - curvature_drop(nxl, nzl)
    far_t = far - curvature_drop(fxl, fzl)
    near_src_frac = {"hirise": float(np.isfinite(hir_n).mean()), "ctx": float((~np.isfinite(hir_n) & np.isfinite(ctx_n)).mean())}

    def horizon(x, z, az_deg):
        """Horizon elevation angle (deg) seen from (x, z) at rover camera height, per azimuth."""
        eye = float(ht_w[rc(x, z)]) + EYE_HEIGHT
        az = np.radians(np.asarray(az_deg, dtype=float))
        out = np.full(az.shape, -90.0)
        for arr, half, res, d0, d1, step in ((ht_w, PLAY_HALF, PLAY_RES, 10, 5600, 5),
                                             (near_t, NEAR_HALF, NEAR_RES, 3000, 24900, 25),
                                             (far_t, FAR_HALF, FAR_RES, 20000, 99000, 100)):
            d = np.arange(d0, d1, step, dtype=float)
            px = x + np.outer(np.sin(az), d)
            pz = z - np.outer(np.cos(az), d)
            inside = (np.abs(px) <= half) & (np.abs(pz) <= half)
            hv = ndimage.map_coordinates(arr, [(pz + half) / res, (px + half) / res], order=1, mode="nearest")
            ang = np.where(inside, np.degrees(np.arctan2(hv - eye, d[None, :])), -90)
            out = np.maximum(out, ang.max(axis=1))
        return out

    # ---- 6. Features ---------------------------------------------------------------
    def to_local_rings(polys):
        return [[np.stack(latlon_to_local(r[:, 1], r[:, 0], *O), axis=1) for r in p] for p in polys]

    def rasterize(polys_local, res=PLAY_RES, half_n=hN, n=N):
        """Polygons (local x, z rings; first ring outer, the rest holes) -> boolean grid."""
        mask = np.zeros((n, n), bool)
        for rings in polys_local:
            outer = rings[0]
            c0, c1 = np.floor(outer[:, 0].min() / res + half_n), np.ceil(outer[:, 0].max() / res + half_n)
            r0, r1 = np.floor(outer[:, 1].min() / res + half_n), np.ceil(outer[:, 1].max() / res + half_n)
            c0, r0 = int(max(c0, 0)), int(max(r0, 0))
            c1, r1 = int(min(c1, n - 1)), int(min(r1, n - 1))
            if c1 < c0 or r1 < r0:
                continue
            yy_, xx_ = np.mgrid[r0:r1 + 1, c0:c1 + 1]
            pts = np.stack([(xx_ - half_n) * res, (yy_ - half_n) * res], -1).reshape(-1, 2)
            inside = MplPath(outer).contains_points(pts)
            for hole in rings[1:]:
                inside &= ~MplPath(hole).contains_points(pts)
            mask[r0:r1 + 1, c0:c1 + 1] |= inside.reshape(yy_.shape)
        return mask

    def snap(x, z, radius, extra=None):
        ok = reach & (s10 <= 12)
        if extra is not None:
            ok &= extra
        p = nearest_ok(x, z, ok, radius)
        if p is None:
            raise SystemExit(f"no drivable spot within {radius} m of ({x:.0f}, {z:.0f})")
        return p

    def unit(dx, dz):
        n_ = math.hypot(dx, dz)
        return {"x": round(dx / n_, 3), "z": round(dz / n_, 3)}

    WP_SRC = f"Mars 2020 rover waypoints ({WAYPOINTS_URL})"

    # Perseverance's own landing site, as a landmark.
    persev = {"name": "Octavia E. Butler Landing", "local": {"x": round(oeb[0]), "z": round(oeb[1])},
              "latLon": list(OEB), "source": f"{WP_SRC}, sol 13 position; NASA gives 18.4447 N, 77.4508 E"}

    # Delta front: the scarp-foot contour of the delta's eastern front around Hawksbill Gap.
    floor_level = float(np.median(z_w[rc(*forks)[0] - 4:rc(*forks)[0] + 5, rc(*forks)[1] - 4:rc(*forks)[1] + 5]))
    foot_level = floor_level + DELTA_FOOT_LEVEL_ABOVE_FLOOR
    zs = ndimage.gaussian_filter(z_w, 3)
    best = None
    for cnt in find_contours(zs, foot_level):
        xy = np.stack([(cnt[:, 1] - hN) * PLAY_RES, (cnt[:, 0] - hN) * PLAY_RES], 1)
        d = np.hypot(xy[:, 0] - hawks[0], xy[:, 1] - hawks[1])
        if best is None or d.min() < best[1]:
            best = (xy, d.min(), int(np.argmin(d)))
    xy, dmin, i0 = best
    seg_len = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))])
    # Keep the contiguous run around Hawksbill Gap where a real scarp (>= 15 m within 100 m) rises behind
    # the contour, so the line does not wander off along the floor.
    scarp_top = ndimage.maximum_filter(zs, size=41)  # highest ground within ~100 m
    tall = np.array([scarp_top[rc(a, b)] - foot_level >= DELTA_MIN_RELIEF for a, b in xy])
    tall = ndimage.binary_closing(tall, np.ones(9, bool)) | tall  # bridge short gaps (< ~40 m)
    run_lab, _ = ndimage.label(tall)
    j0 = i0 if tall[i0] else int(np.argmin(np.where(tall, np.abs(seg_len - seg_len[i0]), np.inf)))
    keep = (run_lab == run_lab[j0]) & (np.abs(seg_len - seg_len[i0]) <= DELTA_SCARP_HALF_LENGTH)
    scarp = approximate_polygon(xy[keep], tolerance=8.0)
    log(f"delta front: foot contour {foot_level:.1f} m, {len(scarp)} vertices, {seg_len[keep][-1] - seg_len[keep][0]:.0f} m "
        f"long, {dmin:.0f} m from Hawksbill Gap")
    sx, sz = snap(*hawks, 80)
    delta_sample = site("Delta front sample", sx, sz,
                        f"Hawksbill Gap, where Perseverance drilled the Wildcat Ridge sample (sols 490-516): {WP_SRC}")
    delta_front = {
        "name": "Delta front",
        "description": "Eastern front of Jezero's western delta: layered sedimentary cliffs (sandstone and "
                       "mudstone laid down in the ancient lake) rising 30-60 m above the crater floor. "
                       "scarpLocal_xz follows the foot of the scarp (DTM contour); samplePoint is a drivable "
                       "spot at the foot.",
        "scarpLocal_xz": [[round(float(a)), round(float(b))] for a, b in scarp],
        "zoneRadius_m": DELTA_ZONE_RADIUS,
        "footContour_m": round(foot_level, 1),
        "samplePoint": delta_sample,
        "source": "Delta lobe fronts of Sun & Stack 2020 (USGS SIM 3464, doi:10.3133/sim3464; 100-200 m offsets "
                  "to the Mars 2020 base map), Hawksbill Gap / Three Forks / Enchanted Lake rover positions "
                  f"({WP_SRC}); the line itself is the HiRISE DTM contour at the scarp foot.",
    }

    # Delta viewpoint: on the floor 150-300 m in front of the scarp, within 250 m of the scarp point nearest
    # the landing (where a survey lead toward the delta front arrives), facing the steepest view of the cliffs.
    scarp_mask = np.zeros((N, N), bool)
    for (a, b) in xy[keep]:
        scarp_mask[rc(a, b)] = True
    d_scarp = ndimage.distance_transform_edt(~scarp_mask) * PLAY_RES
    d_scarp10 = d_scarp[::k, ::k]
    below = z10 < foot_level - 2
    fine = xy[keep]
    anchor = fine[int(np.argmin(np.hypot(fine[:, 0] - land_x, fine[:, 1] - land_z)))]
    cands = reach & (s10 <= 6) & (d_scarp10 >= 150) & (d_scarp10 <= 300) & below
    cands &= np.hypot(x10 - anchor[0], z10g - anchor[1]) <= 250
    cr, cc = np.nonzero(cands)
    sel = range(len(cr))
    best = None
    for i in sel:
        x, z = float(x10[cr[i], cc[i]]), float(z10g[cr[i], cc[i]])
        eye = float(z_w[rc(x, z)]) + EYE_HEIGHT
        # Strongest upward view onto the scarp: elevation angle to scarp points.
        dx, dz = scarp[:, 0] - x, scarp[:, 1] - z
        dist = np.hypot(dx, dz)
        tops = np.array([scarp_top[rc(a, b)] for a, b in scarp])
        ang = np.degrees(np.arctan2(tops - eye, dist))
        j = int(np.argmax(ang))
        if best is None or ang[j] > best[0]:
            best = (ang[j], x, z, j, float(tops[j]))
    ang, vx, vz, j, top = best
    tx, tz = float(scarp[j][0]), float(scarp[j][1])
    delta_view = site("Delta viewpoint", vx, vz,
                      "Picked by this pipeline on the HiRISE DTM: crater-floor spot facing the delta front "
                      "(Sun & Stack 2020 delta lobe front; Mars 2020 delta-front campaign area)",
                      kind="deltaLayers", lookToward=unit(tx - vx, tz - vz),
                      lookTarget={"x": round(tx), "y": round(top - float(curvature_drop(tx, tz)), 1), "z": round(tz)},
                      note=f"The scarp rises {top - float(z_w[rc(vx, vz)]):.0f} m, {ang:.1f} deg above the horizontal "
                           "from here.")

    # Seitah.
    seitah_poly = np.array([ll(a, b, O) for a, b in SEITAH_OUTLINE])
    seitah_mask = rasterize([[seitah_poly]])
    lab_s = seitah_mask[::k, ::k]
    edge = lab_s & ~ndimage.binary_erosion(lab_s)
    inner_edge = edge & reach & (s10 <= 12)
    ei = np.unravel_index(np.argmin(np.where(inner_edge, cum, np.inf)), cum.shape)
    seitah_entry = site("Seitah entry", float(x10[ei]), float(z10g[ei]),
                        "Cheapest drivable point on the Seitah outline from the landing. Perseverance's own first "
                        f"look into Seitah was at 18.4327 N, 77.4413 E (sol 201; {WP_SRC}).")
    seitah_area = float(seitah_mask.sum()) * PLAY_RES ** 2 / 1e6
    seitah = {
        "name": "Seitah",
        "description": "Seitah ('amidst the sand' in Navajo): olivine-rich igneous rock in NE-SW ridges, "
                       "with dark sand megaripples between them. Perseverance skirted it because the sand is "
                       "risky, and drove in only at its eastern edge (sols 201-340).",
        "outlineLocal_xz": [[round(float(a)), round(float(b))] for a, b in seitah_poly],
        "centroidLocal": {"x": round(float(gx[seitah_mask].mean())), "z": round(float(gz[seitah_mask].mean()))},
        "area_km2": round(seitah_area, 2),
        "entryPoint": seitah_entry,
        "source": "Outline traced by this pipeline on the HiRISE DTM and orthomosaic (ridged unit below the Maaz "
                  "scarp), following Farley et al. 2022 (Science 377, eabo2196, Fig. 1) and the eolian bedform "
                  "areas of Sun & Stack 2020 (USGS SIM 3464); Seitah outcrops and rover path from Crumpler et "
                  "al. 2023 (doi:10.1029/2022JE007444; data doi:10.5281/zenodo.7545299). Approximate (+-100 m).",
    }

    # Soft ground: sand ripples inside Seitah (plus a margin), from the image texture and the mapped ripples.
    ortho = to_local_grid(ortho_cache(lat0, lon0, PLAY_HALF), lat0, lon0, PLAY_HALF, ORTHO_CACHE_RES,
                          Resampling.average)
    ortho[ortho <= 0] = np.nan
    coh = ripple_coherence(ortho)
    coh5 = ndimage.gaussian_filter(coh[::2, ::2], 2)[:N, :N]
    rip = (coh5 > RIPPLE_COHERENCE) & (ndimage.gaussian_filter(sl_w, 1) < RIPPLE_MAX_SLOPE)
    lab_r, nr = ndimage.label(rip)
    area_r = ndimage.sum(rip, lab_r, range(1, nr + 1)) * PLAY_RES ** 2
    rip = np.isin(lab_r, np.nonzero(area_r >= RIPPLE_MIN_AREA)[0] + 1)
    mapped = rasterize(to_local_rings(vec["Ripples"]))
    near_seitah = ndimage.distance_transform_edt(~seitah_mask) * PLAY_RES <= SOFT_BUFFER
    soft_mask = (rip | mapped) & near_seitah
    soft_png = np.clip(ndimage.gaussian_filter(soft_mask.astype(float), 1.0) * 1.5, 0, 1)
    log(f"ripples: {rip.mean():.1%} of the play area by texture; soft ground (inside Seitah + {SOFT_BUFFER:.0f} m) "
        f"{soft_mask.sum() * PLAY_RES ** 2 / 1e6:.2f} km^2")
    soft_areas = []
    cell = int(SOFT_CELL / PLAY_RES)
    for r0 in range(0, N, cell):
        for c0 in range(0, N, cell):
            blk = soft_mask[r0:r0 + cell, c0:c0 + cell]
            if blk.sum() * PLAY_RES ** 2 < 0.1 * SOFT_CELL ** 2:
                continue
            rr, cc_ = np.nonzero(blk)
            cx = float(gx[r0 + int(rr.mean()), c0 + int(cc_.mean())])
            cz = float(gz[r0 + int(rr.mean()), c0 + int(cc_.mean())])
            rad = max(25.0, math.sqrt(blk.sum() * PLAY_RES ** 2 / math.pi))
            soft_areas.append({"name": f"Ripple field {len(soft_areas) + 1}", "local": {"x": round(cx), "z": round(cz)},
                               "radius_m": round(rad)})
    soft_ground = {
        "description": "Seitah's sand ripples as circles for the soft-ground rule (sinkage and slip), one per "
                       f"{SOFT_CELL:.0f} m cell with ripples (circle area = ripple area in the cell). soft-ground.png "
                       "has the same ripples at 5 m. Ripple fields outside Seitah (e.g. west of Kodiak and at the "
                       "delta front) are real but left firm in the game.",
        "areas": soft_areas,
        "source": "Ripple fields detected by this pipeline in the HiRISE 25 cm orthomosaic (oriented texture of "
                  "megaripple crests, cached at 2.5 m), plus the ripples mapped along Perseverance's traverse by "
                  "Crumpler et al. 2023 (doi:10.5281/zenodo.7545299, CC BY 4.0)",
    }

    # Rocky areas.
    blocks = np.array([latlon_to_local(p[1], p[0], *O) for p in vec["Crater Ejecta Blocks"]], float)
    bc = blocks.mean(axis=0)
    brad = float(np.percentile(np.hypot(*(blocks - bc).T), 90)) + 30
    rx, rz = snap(float(bc[0]), float(bc[1]), 150)
    rocky = [site("Rocky area 1", float(bc[0]), float(bc[1]),
                  "Crumpler et al. 2023, Crater Ejecta Blocks layer (107 mapped blocks; doi:10.5281/zenodo.7545299)",
                  radius_m=round(brad),
                  description="Field of ejecta blocks around a small crater just south of Perseverance's landing "
                              "site. Scatter boulders densest here.")]
    rocky[0]["driveDistanceFromLanding_m"] = drive(rx, rz)[0] if drive(rx, rz) else None
    # Rocky area 2: the freshest small crater on the floor away from the other sites (fresh craters
    # stand out as compact rings of steep slope; their rims and ejecta are where boulders are).
    s_sm = ndimage.gaussian_filter(sl_w, 2)
    excess = (ndimage.gaussian_filter(s_sm, 6) - ndimage.gaussian_filter(s_sm, 40))[::k, ::k]
    peaks = excess == ndimage.maximum_filter(excess, size=15)
    far_from = np.ones_like(peaks)
    for (px_, pz_), dmin_ in (((float(bc[0]), float(bc[1])), 800), (oeb, 600), ((land_x, land_z), 500),
                              ((seitah_entry["local"]["x"], seitah_entry["local"]["z"]), 800)):
        far_from &= np.hypot(x10 - px_, z10g - pz_) >= dmin_
    far_from &= (ndimage.distance_transform_edt(~seitah_mask[::k, ::k]) * DRIVE_RES >= 300)
    far_from &= d_scarp10 >= 500
    ok = peaks & far_from & (d_land10 <= 2000) & ndimage.maximum_filter(reach, size=15) & (z10 < foot_level)
    i = np.unravel_index(np.argmax(np.where(ok, excess, -np.inf)), excess.shape)
    # Crater center: the lowest point within 120 m of the slope peak; radius: where the ring-averaged slope
    # peaks (inner rim wall).
    px_, pz_ = float(x10[i]), float(z10g[i])
    near_pk = np.hypot(gx - px_, gz - pz_) <= 120
    j = np.unravel_index(np.argmin(np.where(near_pk, zs, np.inf)), zs.shape)
    cx, cz = float(gx[j]), float(gz[j])
    rr = np.hypot(gx - cx, gz - cz)
    prof = [float(s_sm[(rr >= r_) & (rr < r_ + 5)].mean()) for r_ in range(10, 300, 5)]
    rim = 10 + 5 * int(np.argmax(prof)) + 2.5
    win = np.hypot(x10 - cx, z10g - cz) <= rim + 150
    dr_ = np.unravel_index(np.argmin(np.where(win & reach, cum, np.inf)), cum.shape)
    rocky.append(site("Rocky area 2", cx, cz,
                      "Picked by this pipeline on the HiRISE DTM: the sharpest small crater on the floor away from "
                      "the other sites (fresh craters on the Jezero floor carry blocky ejecta in HiRISE images)",
                      radius_m=round(rim * 1.6),
                      description=f"Small fresh crater about {2 * rim:.0f} m across; scatter boulders on its rim and "
                                  "out to about one crater radius. Its inner wall may be too steep to drive."))
    rocky[1]["driveDistanceFromLanding_m"] = drive(float(x10[dr_]), float(z10g[dr_]))[0]
    # Sunset viewpoint: a high drivable spot in the west with the lowest horizon toward sunset.
    hi = (z10 >= ndimage.maximum_filter(z10, size=21) - 3) & reach & (s10 <= 10) & (x10 < land_x - 1500)
    hi &= d_land10 <= SUNSET_MAX_DIST
    cr, cc = np.nonzero(hi)
    order = np.argsort(-z10[cr, cc])[:60]
    az_set = np.arange(SUNSET_AZIMUTH - 8, SUNSET_AZIMUTH + 9, 2)
    best = None
    for i in order:
        x, z = float(x10[cr[i], cc[i]]), float(z10g[cr[i], cc[i]])
        hz = float(horizon(x, z, az_set).max())
        if best is None or hz < best[0]:
            best = (hz, x, z)
    hz, sx_, sz_ = best
    a = math.radians(SUNSET_AZIMUTH)
    sunset = site("West viewpoint", sx_, sz_,
                  "Picked by this pipeline on the HiRISE DTM: high drivable ground on the delta with the lowest "
                  "horizon toward the sunset",
                  kind="sunset", lookToward={"x": round(math.sin(a), 3), "z": round(-math.cos(a), 3)},
                  note=f"Faces azimuth {SUNSET_AZIMUTH:.0f} deg (sunset at Ls 200); the horizon there (the western "
                       f"crater rim) is {hz:.1f} deg high.")

    for f in (delta_sample, delta_view, seitah_entry, *rocky, sunset):
        log(f"{f['name']:<20} straight {f['distanceFromLanding_m']:>5} m, drive {f['driveDistanceFromLanding_m']} m")

    # Horizon from the landing, 1 deg steps.
    hz_land = horizon(land_x, land_z, np.arange(360))

    # ---- 7. Write images -----------------------------------------------------------
    o = args.out
    hlo, hhi = write_png16(o / "heightmap.png", ht_w)
    write_png8(o / "slope.png", sl_w * SLOPE_SCALE)
    write_png8(o / "soft-ground.png", soft_png * SOFT_SCALE)
    nlo, nhi = write_png16(o / "distant-near.png", near_t)
    flo, fhi = write_png16(o / "distant-far.png", far_t)
    sizes = {f.name: f.stat().st_size for f in sorted(o.glob("*.png"))}

    def decode(lo, hi):
        return {"encoding": "uint16 grayscale PNG", "min_m": lo, "max_m": hi,
                "formula": "height_m = min_m + value / 65535 * (max_m - min_m)"}

    def ring_meta(name, file, lo, hi, half, res, n, source):
        return {"name": name, "file": file, **decode(lo, hi), "size_m": 2 * half, "pixel_m": res, "samples": n,
                "boundsLocal": {"xMin": -half, "xMax": half, "zMin": -half, "zMax": half},
                "pixelToLocal": f"x = (col - {n // 2}) * {res}, z = (row - {n // 2}) * {res}",
                "hole": "Covers the inner grid too; skip or sink the part inside it.", "source": source}

    meta = {
        "version": 1,
        "generated": dt.date.today().isoformat(),
        "generator": "game/tools/build_terrain_mars.py",
        "site": "Jezero crater floor, Mars, east of the western delta (USGS Mars 2020 TRN HiRISE DTM)",
        "frame": {
            "description": "Local right-handed, y-up frame in meters (Three.js convention). Origin = play-area "
                           "center. +x = east, +z = south, +y = up. Image columns go with +x, rows with +z; "
                           "row 0 is the northern edge. Grid north is true north.",
            "originLatLon": [round(lat0, 6), round(lon0, 6)],
            "projection": f"Azimuthal equidistant on the Mars sphere R = {MARS_R:.0f} m (the sphere of every "
                          "input product), centered on the origin. Latitudes are planetocentric, longitudes east. "
                          "Scale error < 0.001% inside the play area, < 0.1% at 100 km.",
            "toLatLon": "spherical azimuthal equidistant inverse with x east, y north = -z",
            "heights": "All heightmaps store TANGENT-PLANE heights: elevation above the Mars areoid (MOLA "
                       "geoid, as in the source DTMs) minus the curvature drop r^2 / (2R), r = horizontal distance "
                       "from the origin. The drop is 2.4 m at 4 km, 92 m at 25 km, 1.47 km at 100 km.",
            "azimuthConvention": "azimuth_deg is measured from north (local -z), turning toward east (+x). "
                                 "Direction vector = (x: sin(az), z: -cos(az)).",
        },
        "sunAndEarth": {
            "siteLatitude_deg": round(lat0, 4),
            "siteLongitude_deg": round(lon0, 4),
            "note": "Mars: Sun only (no Earth block). Sunset azimuth at Ls 200 is about "
                    f"{SUNSET_AZIMUTH:.0f} deg (solar declination -8.4 deg).",
        },
        "playArea": {
            "size_m": 2 * PLAY_HALF, "pixel_m": PLAY_RES, "samples": N,
            "boundsLocal": {"xMin": -PLAY_HALF, "xMax": PLAY_HALF, "zMin": -PLAY_HALF, "zMax": PLAY_HALF},
            "pixelToLocal": f"sample (col, row) -> x = (col - {hN}) * {PLAY_RES}, z = (row - {hN}) * {PLAY_RES} "
                            "(vertex-centered grid)",
            "files": {
                "heightmap": {"file": "heightmap.png", **decode(hlo, hhi),
                              "source": "USGS Mars 2020 TRN HiRISE 1 m DTM, area-averaged to 5 m"},
                "slope": {"file": "slope.png", "encoding": "uint8 grayscale PNG",
                          "formula": f"slope_deg = value / {SLOPE_SCALE}",
                          "source": "Computed from the 5 m heights (central differences)"},
                "softGround": {"file": "soft-ground.png", "encoding": "uint8 grayscale PNG",
                               "formula": "softness = value / 255 (0 normal ground, 1 sand ripples)",
                               "source": "Seitah ripple mask (see features.softGround), softened over one pixel"},
            },
            "elevationRange_m": [round(float(z_w.min()), 1), round(float(z_w.max()), 1)],
        },
        "distantTerrain": [
            ring_meta("near ring", "distant-near.png", nlo, nhi, NEAR_HALF, NEAR_RES, near_t.shape[0],
                      f"HiRISE 1 m DTM area-averaged ({near_src_frac['hirise']:.0%} of the ring), then the JPL "
                      f"CTX 20 m DEM ({near_src_frac['ctx']:.0%}), blended over 500 m; CTX shifted "
                      f"{off_ctx:+.1f} m to match HiRISE"),
            ring_meta("far ring", "distant-far.png", flo, fhi, FAR_HALF, FAR_RES, far_t.shape[0],
                      "JPL CTX 20 m DEM area-averaged to 200 m, then MOLA 463 m (bilinear) outside it, "
                      f"blended over 1 km; MOLA shifted {off_mola:+.1f} m to match"),
        ],
        "landing": landing,
        "features": {
            "deltaFront": delta_front,
            "seitah": seitah,
            "softGround": soft_ground,
            "rockyAreas": rocky,
            "viewpoints": [delta_view, sunset],
            "perseveranceLanding": persev,
            "notes": [
                f"Drive distances are least-cost routes on a {DRIVE_RES} m grid avoiding slopes over "
                f"{DRIVE_MAX_SLOPE:.0f} deg; straight-line distances are also given.",
                "Names are ASCII; display names (Seitah with accents, etc.) live in the game's text data.",
                "The landing is near Perseverance's 2021 landing site but not on it; the real site is "
                "features.perseveranceLanding.",
                "Seitah's outline is approximate (+-100 m): no machine-readable map of the unit exists, so it was "
                "traced on the HiRISE data following published maps.",
                "Soft ground is limited to Seitah's ripples (inside its outline plus "
                f"{SOFT_BUFFER:.0f} m); the ripple detection is automatic and may miss small ripple patches or "
                "include some finely layered rock.",
            ],
        },
        "horizonFromLanding": {
            "eyeHeight_m": EYE_HEIGHT,
            "elevation_deg_by_azimuth": [round(float(v), 2) for v in hz_land],
            "note": "Index = azimuth in degrees (see frame.azimuthConvention). Includes curvature.",
        },
        "files_bytes": sizes,
        "sources": SOURCES,
        "credits": CREDITS,
    }
    (o / "terrain.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    log(f"wrote {o}: " + ", ".join(f"{k} {v / 1e6:.2f} MB" for k, v in sizes.items()))

    if args.preview:
        render_preview(args.preview, ht_w, sl_w, soft_png, meta, paths, k, h10)
        log(f"preview: {args.preview}")


SOURCES = [
    {"dataset": "Mars 2020 TRN HiRISE DTM mosaic, 1 m/px "
                "(JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40)",
     "url": URLS["hirise_dtm"],
     "citation": "Fergason, R.L., Galuszka, D.M., Hare, T.M. (2020), High-Resolution Imaging Science Experiment "
                 "Digital Terrain Model Mosaic for Mars 2020 Terrain Relative Navigation, U.S. Geological Survey "
                 "data release, doi:10.5066/P9REJ9JN",
     "provider": "USGS Astrogeology Science Center / NASA-JPL (public domain)"},
    {"dataset": "Jezero crater CTX DEM, 20 m/px (M20_JezeroCrater_CTXDEM_20m, Mars 2020 science investigation map)",
     "url": URLS["ctx_dem"],
     "citation": "Mangold, N., et al. (2021), Perseverance rover reveals an ancient delta-lake system and flood "
                 "deposits at Jezero crater, Mars, Science 374, 711-717, doi:10.1126/science.abl4051 (PDS4 "
                 "mars2020_ctx_basemap_2021)",
     "provider": "NASA-JPL / USGS Astrogeology (public domain)"},
    {"dataset": "Mars MGS MOLA DEM 463 m (Mars_MGS_MOLA_DEM_mosaic_global_463m)",
     "url": URLS["mola"],
     "citation": "Smith, D.E., et al. (2001), Mars Orbiter Laser Altimeter: Experiment summary after the first "
                 "year of global mapping of Mars, J. Geophys. Res. 106(E10), 23689-23722",
     "provider": "NASA Goddard / USGS Astrogeology (public domain)"},
    {"dataset": "In situ geologic map along Perseverance's traverse: ripples, ejecta blocks, float lag, Seitah outcrops",
     "url": "https://doi.org/10.5281/zenodo.7545299",
     "citation": "Crumpler, L.S., et al. (2023), In situ geologic context mapping transect on the floor of Jezero "
                 "crater from Mars 2020 Perseverance rover observations, J. Geophys. Res. Planets 128, "
                 "e2022JE007444. GIS data: Crumpler, L. (2023), Zenodo, CC BY 4.0",
     "provider": "Zenodo (CC BY 4.0)"},
    {"dataset": "Geologic map of Jezero crater and the Nili Planum region (delta lobe fronts, eolian bedforms)",
     "url": "https://doi.org/10.3133/sim3464",
     "citation": "Sun, V.Z., and Stack, K.M. (2020), Geologic map of Jezero crater and the Nili Planum region, "
                 "Mars: U.S. Geological Survey Scientific Investigations Map 3464, scale 1:75,000",
     "provider": "USGS (public domain); used for reference only"},
    {"dataset": "Mars 2020 rover waypoints (positions of Hawksbill Gap, Three Forks, Seitah entry, landing)",
     "url": WAYPOINTS_URL,
     "citation": "NASA/JPL-Caltech, Mars 2020 'Where is the rover' map; landing site name per NASA (2021)",
     "provider": "NASA/JPL-Caltech"},
    {"dataset": "Seitah geology and location",
     "url": "https://doi.org/10.1126/science.abo2196",
     "citation": "Farley, K.A., et al. (2022), Aqueously altered igneous rocks sampled on the floor of Jezero "
                 "crater, Mars, Science 377, eabo2196",
     "provider": "AAAS / Mars 2020 team"},
]
CREDITS = [
    "Jezero terrain: HiRISE and CTX elevation models from the USGS Mars 2020 Terrain Relative Navigation "
    "products (NASA/JPL-Caltech/University of Arizona/USGS)",
    "Distant terrain beyond the crater: MOLA (NASA/GSFC/MGS)",
    "Ripples, rock fields and Seitah outcrops: Crumpler et al. 2023 (CC BY 4.0)",
    "Feature positions: Mars 2020 rover waypoints (NASA/JPL-Caltech)",
]


def render_preview(path, ht, sl, soft, meta, paths, k, h10):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    n = ht.shape[0]
    half = n // 2 * PLAY_RES
    ext = [-half, half, half, -half]
    f = meta["features"]
    fig, axes = plt.subplots(1, 2, figsize=(22, 11))
    for ax, title in zip(axes, ("hillshade + features", "slope (deg)")):
        if title.startswith("hill"):
            ax.imshow(hillshade(ht, PLAY_RES, 300, 35), extent=ext, cmap="gray")
            ax.imshow(np.ma.masked_less(soft, 0.2), extent=ext, cmap="autumn", alpha=0.6)
        else:
            im = ax.imshow(sl, extent=ext, cmap="magma", vmax=30)
            plt.colorbar(im, ax=ax, fraction=0.04)
        s = np.array(f["deltaFront"]["scarpLocal_xz"])
        ax.plot(s[:, 0], s[:, 1], "c-", lw=2)
        o_ = np.array(f["seitah"]["outlineLocal_xz"] + f["seitah"]["outlineLocal_xz"][:1])
        ax.plot(o_[:, 0], o_[:, 1], "m-", lw=1.5)
        for a in f["softGround"]["areas"]:
            ax.add_patch(plt.Circle((a["local"]["x"], a["local"]["z"]), a["radius_m"], fill=False, color="orange"))
        for a in f["rockyAreas"]:
            ax.add_patch(plt.Circle((a["local"]["x"], a["local"]["z"]), a["radius_m"], fill=False, color="lime", lw=2))
        for name, p in paths.items():
            ax.plot((p[:, 1] - h10) * DRIVE_RES, (p[:, 0] - h10) * DRIVE_RES, "y-", lw=0.8)
        pts = [meta["landing"], f["deltaFront"]["samplePoint"], f["seitah"]["entryPoint"], *f["viewpoints"],
               *f["rockyAreas"], f["perseveranceLanding"]]
        for p in pts:
            x, z = p["local"]["x"], p["local"]["z"]
            ax.plot(x, z, "r^" if p["name"] == "Landing" else "wo", ms=8, mec="k")
            ax.annotate(p["name"], (x, z), xytext=(4, 4), textcoords="offset points", color="w", fontsize=8,
                        bbox=dict(fc="k", alpha=0.5, lw=0))
            if "lookToward" in p:
                ax.arrow(x, z, p["lookToward"]["x"] * 400, p["lookToward"]["z"] * 400, color="w", width=8)
        ax.set_title(title)
        ax.set_xlim(-half, half)
        ax.set_ylim(half, -half)
    plt.tight_layout()
    plt.savefig(path, dpi=80)


if __name__ == "__main__":
    main()
