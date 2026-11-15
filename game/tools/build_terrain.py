#!/usr/bin/env python3
"""Build the Moon terrain assets for Rover Engineer.

Reads NASA LOLA elevation and illumination products for the de Gerlache rim
(lunar south pole), picks the 8 km x 8 km play area, the landing point and the
suggested feature locations, and writes web-sized PNGs plus terrain.json into
game/public/terrain/.

Usage (from game/tools/, inside the venv):
    python build_terrain.py                      # download if needed, build
    python build_terrain.py --preview out.png    # also render a preview image
    python build_terrain.py --center -41000 17000  # force the window center (polar-stereo m)

Everything is offline; the game never calls these URLs.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.crs import CRS
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject
from rasterio.windows import from_bounds
from scipy import ndimage
from skimage.graph import MCP_Geometric

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = HERE.parent / "public" / "terrain"

MOON_R = 1737400.0  # reference sphere used by every LOLA product below (m)
PS_CRS = CRS.from_proj4(
    "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
)

PGDA = "https://pgda.gsfc.nasa.gov/data"
URLS = {
    "site_dem": f"{PGDA}/LOLA_5mpp/Site11/Site11_final_adj_5mpp_surf.tif",
    "site_slope": f"{PGDA}/LOLA_5mpp/Site11/Site11_final_adj_5mpp_slp.tif",
    "psr": f"{PGDA}/MoonIllumination/LPSR_85S_060M_201608.TIF",
    "illum": f"{PGDA}/MoonIllumination/AVGVISIB_85S_060M_201608.TIF",
    "earth": f"{PGDA}/MoonIllumination/AVGVISIB_85S_060M_201608_EARTH.TIF",
    # Cloud-optimized: only a window is read over HTTP.
    "dem20": f"{PGDA}/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
    "dem80": f"{PGDA}/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF",
}

# ---- Output grids (all centered on the frame origin, axis-aligned) ----------
PLAY_HALF, PLAY_RES = 4000, 5  # 1601 x 1601 vertices, 8 km
NEAR_HALF, NEAR_RES = 25000, 50  # 1001 x 1001, 50 km, from the 20 m map
FAR_HALF, FAR_RES = 200000, 400  # 1001 x 1001, 400 km, from the 80 m map
SLOPE_SCALE = 4  # slope.png value = round(degrees * 4); degrees = value / 4

# ---- Selection rules ---------------------------------------------------------
LAND_MEAN_SLOPE = 3.0  # deg, mean over ~75 m
LAND_MAX_SLOPE = 8.0  # deg, max over ~45 m (5 m slopes are noisy)
LAND_MIN_ILLUM = 0.45  # average fraction of time the Sun is visible
LAND_MIN_EARTH = 0.30  # average fraction of time Earth is visible
PSR_MIN_AREA = 0.10e6  # m^2, ignore tiny PSR specks
PSR_TARGET = (1500.0, 3000.0)  # m, landing -> nearest real PSR edge
MAX_CENTER_OFFSET = 750.0  # m, landing may sit this far from window center
DRIVE_MAX_SLOPE = 20.0  # deg at 20 m scale; Apollo LRV-based climbing limit
EDGE_MARGIN = 200.0  # m, keep features this far inside the play area
ICE_DEPTH = (100.0, 200.0)  # m inside the PSR edge for the ice spot: near the edge facing landing, still deep shadow
ICE_MAX_SLOPE = 12.0  # deg at 20 m scale, flat enough to stop and drill
ICE_MIN_PSR = 0.9  # PSR fraction over the whole 20 m cell (cold-mask)
ICE_MAX_ILLUM = 0.005  # average illumination over the whole 20 m cell
EYE_HEIGHT = 1.7  # m, rover camera for the horizon profile

# de Gerlache crater center from the IAU gazetteer (88.5 S, 87.1 W), used only
# to tell "into the big crater" from "away from it".
DE_GERLACHE_LATLON = (-88.5, -87.1)
# Approximate summit regions, only for labelling distant peaks (name match if
# within 40 km). Mons Mouton ~84.6 S 31 E (IAU; IM-2 landed on it at 84.8 S 29.2 E);
# Malapert massif ~86 S 0 E.
LANDMARKS = {"Mons Mouton (Leibnitz Beta plateau)": (-84.6, 31.0), "Malapert massif": (-86.0, 0.0)}


# =============================================================================
# Helpers
# =============================================================================


def log(*a):
    print("[terrain]", *a, flush=True)


def fetch(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    log(f"downloading {url}")
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "rover-engineer-terrain-build"})
    with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    tmp.rename(dest)
    return dest


def remote_window(url: str, bounds, decimate: int, dest: Path) -> Path:
    """Read a window of a remote cloud-optimized GeoTIFF and cache it locally."""
    if dest.exists():
        return dest
    log(f"windowed read of {url.rsplit('/', 1)[-1]} {bounds} (decimate {decimate})")
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="4"):
        with rasterio.open("/vsicurl/" + url) as src:
            win = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
            h, w = int(win.height) // decimate, int(win.width) // decimate
            arr = src.read(1, window=win, out_shape=(h, w), resampling=Resampling.average)
            tr = src.window_transform(win) * rasterio.Affine.scale(win.width / w, win.height / h)
    prof = dict(driver="GTiff", dtype="float32", count=1, width=w, height=h, crs=PS_CRS,
                transform=tr, nodata=np.nan, tiled=True, blockxsize=256, blockysize=256,
                compress="deflate")
    with rasterio.open(dest, "w", **prof) as o:
        o.write(arr.astype(np.float32), 1)
    return dest


def resample_to(src_path: Path, dst_transform, shape, resampling=Resampling.bilinear,
                scaled=True) -> np.ndarray:
    """Resample a polar-stereo raster onto another polar-stereo grid."""
    with rasterio.open(src_path) as src:
        a = src.read(1).astype(np.float64)
        nod = src.nodata
        if nod is not None and not np.isnan(nod):
            a[a == nod] = np.nan
        if scaled:
            a = a * src.scales[0] + src.offsets[0]
        out = np.full(shape, np.nan)
        reproject(a, out, src_transform=src.transform, src_crs=PS_CRS, src_nodata=np.nan,
                  dst_transform=dst_transform, dst_crs=PS_CRS, dst_nodata=np.nan,
                  resampling=resampling)
    return out


def ps_to_latlon(X, Y):
    rho = math.hypot(X, Y)
    colat = 2 * math.degrees(math.atan(rho / (2 * MOON_R)))
    return -(90 - colat), math.degrees(math.atan2(X, Y))


def latlon_to_ps(lat, lon):
    rho = 2 * MOON_R * math.tan(math.radians(90 + lat) / 2)
    return rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))


def curvature_drop(x, z):
    """Height of the sphere below the tangent plane at the frame origin."""
    return (x * x + z * z) / (2 * MOON_R)


def write_png16(path: Path, h: np.ndarray):
    lo, hi = float(np.nanmin(h)), float(np.nanmax(h))
    lo, hi = math.floor(lo), math.ceil(hi)
    v = np.round((h - lo) / (hi - lo) * 65535).astype(np.uint16)
    Image.fromarray(v).save(path, optimize=True)
    return lo, hi


def write_png8(path: Path, v: np.ndarray):
    Image.fromarray(np.clip(np.round(v), 0, 255).astype(np.uint8)).save(path, optimize=True)


def slope_deg(z: np.ndarray, res: float) -> np.ndarray:
    gy, gx = np.gradient(z, res)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def hillshade(z, res, az=315.0, alt=35.0):
    gy, gx = np.gradient(z, res)
    s = np.arctan(np.hypot(gx, gy))
    asp = np.arctan2(-gx, gy)
    a, e = np.radians(az), np.radians(alt)
    return np.clip(np.sin(e) * np.cos(s) + np.cos(e) * np.sin(s) * np.cos(a - asp), 0, 1)


# =============================================================================
# Build
# =============================================================================


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--center", nargs=2, type=float, metavar=("X", "Y"),
                    help="force window center (polar-stereographic meters)")
    ap.add_argument("--preview", type=Path, help="write a preview PNG here (needs matplotlib)")
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    # ---- 1. Inputs -----------------------------------------------------------
    p = {k: fetch(URLS[k], RAW / URLS[k].rsplit("/", 1)[-1])
         for k in ("site_dem", "site_slope", "psr", "illum", "earth")}

    with rasterio.open(p["site_dem"]) as d:
        Z = d.read(1).astype(np.float64)
        T = d.transform
        tile_bounds = d.bounds
    with rasterio.open(p["site_slope"]) as d:
        SL = d.read(1).astype(np.float64)
    H, W = Z.shape
    assert T.a == 5 and T.e == -5, "expected the 5 m Site11 grid"
    PSR = resample_to(p["psr"], T, Z.shape)  # 0..1 (1 = permanently shadowed)
    ILL = resample_to(p["illum"], T, Z.shape)  # average fraction of time sunlit
    EAR = resample_to(p["earth"], T, Z.shape)  # average fraction of time Earth visible
    log(f"Site11 tile {W}x{H}, elev {np.nanmin(Z):.0f}..{np.nanmax(Z):.0f} m")

    def rc_to_ps(r, c):
        return T.c + (c + 0.5) * T.a, T.f + (r + 0.5) * T.e

    def ps_to_rc(X, Y):
        return int(round((T.f - Y) / 5 - 0.5)), int(round((X - T.c) / 5 - 0.5))

    # Real PSR blobs (connected, large enough to drive into).
    lab, n = ndimage.label(PSR >= 0.5, structure=np.ones((3, 3)))
    areas = ndimage.sum(np.ones_like(Z), lab, index=np.arange(1, n + 1)) * 25.0
    big = np.isin(lab, np.nonzero(areas >= PSR_MIN_AREA)[0] + 1)
    dist_psr = ndimage.distance_transform_edt(~big) * 5.0
    log(f"PSR blobs: {n}, >= {PSR_MIN_AREA/1e6:.2f} km^2: {(areas >= PSR_MIN_AREA).sum()}")

    # ---- 2. Landing point and window ------------------------------------------
    half_px = PLAY_HALF // PLAY_RES  # 800
    if args.center:
        r0, c0 = ps_to_rc(*args.center)
        land_rc = None
    else:
        mean_sl = ndimage.uniform_filter(SL, 15)
        max_sl = ndimage.maximum_filter(SL, 9)
        ok = ((mean_sl <= LAND_MEAN_SLOPE) & (max_sl <= LAND_MAX_SLOPE)
              & (ILL >= LAND_MIN_ILLUM) & (EAR >= LAND_MIN_EARTH)
              & (dist_psr >= PSR_TARGET[0]) & (dist_psr <= PSR_TARGET[1]))
        rr, cc = np.nonzero(ok)
        # window center = landing clamped so the window stays inside the tile
        rc_c = np.clip(rr, half_px, H - 1 - half_px)
        cc_c = np.clip(cc, half_px, W - 1 - half_px)
        off = np.hypot(rr - rc_c, cc - cc_c) * 5.0
        keep = off <= MAX_CENTER_OFFSET
        rr, cc, rc_c, cc_c, off = rr[keep], cc[keep], rc_c[keep], cc_c[keep], off[keep]
        if rr.size == 0:
            sys.exit("no landing cell satisfies the rules; relax them or pass --center")
        mid = (PSR_TARGET[0] + PSR_TARGET[1]) / 2
        score = (ILL[rr, cc] + 0.5 * EAR[rr, cc] - 0.15 * mean_sl[rr, cc] / LAND_MEAN_SLOPE
                 - np.abs(dist_psr[rr, cc] - mid) / 3000.0 - off / 4000.0)
        i = int(np.argmax(score))
        land_rc = (int(rr[i]), int(cc[i]))
        r0, c0 = int(rc_c[i]), int(cc_c[i])
        log(f"{keep.sum()} landing candidates; best score {score[i]:.3f}")
    r0 = int(np.clip(r0, half_px, H - 1 - half_px))
    c0 = int(np.clip(c0, half_px, W - 1 - half_px))
    X0, Y0 = rc_to_ps(r0, c0)
    rs, cs = slice(r0 - half_px, r0 + half_px + 1), slice(c0 - half_px, c0 + half_px + 1)
    z_w, sl_w, psr_w, ill_w, ear_w = Z[rs, cs], SL[rs, cs], PSR[rs, cs], ILL[rs, cs], EAR[rs, cs]
    big_w = big[rs, cs]
    N = z_w.shape[0]
    assert z_w.shape == (2 * half_px + 1,) * 2
    log(f"window center PS ({X0:.1f}, {Y0:.1f})")

    # local frame helpers: x = X - X0, z = -(Y - Y0); window pixel (r, c) -> x=(c-800)*5, z=(r-800)*5
    def wrc_to_xz(r, c):
        return (c - half_px) * PLAY_RES, (r - half_px) * PLAY_RES

    def xz_to_ps(x, z):
        return X0 + x, Y0 - z

    if land_rc is None:  # forced center: best flat sunlit cell within 750 m of center
        mean_sl = ndimage.uniform_filter(sl_w, 15)
        cand = (mean_sl <= LAND_MEAN_SLOPE) & (ndimage.maximum_filter(sl_w, 9) <= LAND_MAX_SLOPE)
        yy, xx = np.mgrid[0:N, 0:N]
        cand &= np.hypot(yy - half_px, xx - half_px) * 5 <= MAX_CENTER_OFFSET
        sc = np.where(cand, ill_w + 0.5 * ear_w, -1)
        lr, lc = np.unravel_index(np.argmax(sc), sc.shape)
    else:
        lr, lc = land_rc[0] - rs.start, land_rc[1] - cs.start

    # Curvature-corrected heights in the local tangent plane at the origin.
    yy, xx = np.mgrid[0:N, 0:N]
    lx_grid, lz_grid = (xx - half_px) * PLAY_RES, (yy - half_px) * PLAY_RES
    ht_w = z_w - curvature_drop(lx_grid, lz_grid)

    # ---- 3. Drive-cost grid (20 m) and features -------------------------------
    k = 4  # 5 m -> 20 m
    n20 = (N - 1) // k
    z20 = z_w[: n20 * k, : n20 * k].reshape(n20, k, n20, k).mean(axis=(1, 3))
    s20 = slope_deg(z20, 20.0)
    cost = 1.0 + 2.0 * (s20 / DRIVE_MAX_SLOPE) ** 2
    cost[s20 > DRIVE_MAX_SLOPE] = np.inf
    cost[[0, -1], :] = np.inf
    cost[:, [0, -1]] = np.inf
    mcp = MCP_Geometric(cost)
    start20 = (min(lr // k, n20 - 1), min(lc // k, n20 - 1))
    cum, _ = mcp.find_costs([start20])

    def drive(r, c):
        """Shortest drivable route length (m) from the landing point at 20 m scale."""
        t = (min(r // k, n20 - 1), min(c // k, n20 - 1))
        if not np.isfinite(cum[t]):
            return None, None
        path = np.array(mcp.traceback(t))
        length = float(np.sum(np.hypot(*np.diff(path, axis=0).T)) * 20.0)
        return round(length), path

    land_x, land_z = wrc_to_xz(lr, lc)
    yy20, xx20 = np.mgrid[0:n20, 0:n20]
    d20 = np.hypot(yy20 * k + k / 2 - lr, xx20 * k + k / 2 - lc) * PLAY_RES
    margin = int(EDGE_MARGIN / 20)
    inner = np.zeros((n20, n20), bool)
    inner[margin:-margin, margin:-margin] = True
    reach = np.isfinite(cum) & inner

    def pick(score, mask, count, sep):
        s = np.where(mask, score, -np.inf)
        picks = []
        for _ in range(count):
            i = np.unravel_index(np.argmax(s), s.shape)
            if not np.isfinite(s[i]):
                break
            picks.append(i)
            s[np.hypot(yy20 - i[0], xx20 - i[1]) * 20 < sep] = -np.inf
        return picks

    paths = {}

    def feature(name, r20, c20, drive_rc=None, **extra):
        r, c = r20 * k + k // 2, c20 * k + k // 2
        x, z = wrc_to_xz(r, c)
        X, Y = xz_to_ps(x, z)
        lat, lon = ps_to_latlon(X, Y)
        dr = drive_rc if drive_rc is not None else (r20, c20)
        dl, path = drive(dr[0] * k + k // 2, dr[1] * k + k // 2)
        if path is not None:
            paths[name] = path
        f = {
            "name": name,
            "local": {"x": x, "z": z, "y": round(float(ht_w[r, c]), 2)},
            "polarStereo": {"X": round(X, 1), "Y": round(Y, 1)},
            "latLon": [round(lat, 5), round(lon, 4)],
            "elevation_m": round(float(z_w[r, c]), 1),
            "distanceFromLanding_m": round(math.hypot(x - land_x, z - land_z)),
            "driveDistanceFromLanding_m": dl,
            "slope_deg": round(float(s20[r20, c20]), 1),
            "avgIllumination": round(float(ill_w[r, c]), 3),
            "earthVisibility": round(float(ear_w[r, c]), 3),
        }
        f.update(extra)
        return f

    gx, gy = latlon_to_ps(*DE_GERLACHE_LATLON)
    dg_dir = np.array([gx - X0, -(gy - Y0)])  # local (x, z) toward de Gerlache center
    dg_dir /= np.linalg.norm(dg_dir)
    rel = np.stack([xx20 * k + k / 2 - lc, yy20 * k + k / 2 - lr]) * PLAY_RES
    toward = (rel[0] * dg_dir[0] + rel[1] * dg_dir[1]) > 0  # de Gerlache side of the landing

    # Rim viewpoints: drivable spots on the crest (within 25 m of the local high
    # ground) with the biggest drop within 1 km, i.e. the edge of the view into
    # the crater.
    relief = z20 - ndimage.minimum_filter(z20, size=101)
    crest = z20 >= ndimage.maximum_filter(z20, size=31) - 25
    vp = pick(relief, reach & crest & (s20 <= 12) & (d20 >= 250) & (d20 <= 1500), 2, 1000)
    rim_viewpoints = []
    for i, (a, b) in enumerate(vp):
        rim_viewpoints.append(feature(f"Rim viewpoint {i + 1}", a, b, relief1km_m=round(float(relief[a, b])),
                                      lookToward={"x": round(float(dg_dir[0]), 3), "z": round(float(dg_dir[1]), 3),
                                                  "note": "toward the de Gerlache crater interior"}))

    # Rocky areas: small fresh craters (100-400 m) stand out as compact patches
    # of steep slope against the regional slope. Boulders are densest on and just
    # outside such rims. The 5 m slope has a fine "orange peel" texture from the
    # DEM, so it is smoothed first.
    s_sm = ndimage.gaussian_filter(sl_w, 4)
    excess = ndimage.gaussian_filter(s_sm, 15) - ndimage.gaussian_filter(s_sm, 60)
    ex20 = excess[: n20 * k, : n20 * k].reshape(n20, k, n20, k).mean(axis=(1, 3))
    near_reach = ndimage.maximum_filter(reach, size=15)  # a drivable cell within ~150 m
    peaks = ex20 == ndimage.maximum_filter(ex20, size=15)
    ro = pick(ex20, peaks & near_reach & (ex20 >= 4) & (d20 >= 300) & (d20 <= 1800), 2, 800)
    rocky = []
    for i, (a, b) in enumerate(ro):
        win = np.zeros_like(reach)
        win[max(a - 7, 0):a + 8, max(b - 7, 0):b + 8] = True
        dr = np.unravel_index(np.argmin(np.where(win & reach, cum, np.inf)), cum.shape)
        rocky.append(feature(f"Rocky area {i + 1}", a, b, drive_rc=dr, radius_m=200,
                             slopeExcess_deg=round(float(ex20[a, b]), 1),
                             description="Small fresh crater; scatter boulders on its rim and out to about "
                                         "one crater radius. Its inner wall may be too steep to drive."))

    # Shadowed crater: the real PSR blob that is cheapest to reach.
    lab_w, nw = ndimage.label(big_w, structure=np.ones((3, 3)))
    psr_features = []
    for b in range(1, nw + 1):
        m = lab_w == b
        m20 = m[: n20 * k, : n20 * k].reshape(n20, k, n20, k).mean(axis=(1, 3)) >= 0.5
        if m20.sum() < 4:
            continue
        edge20 = m20 & ~ndimage.binary_erosion(m20)
        ring = ndimage.binary_dilation(edge20, iterations=2) & ~m20  # just outside the shadow
        cand = ring & np.isfinite(cum) & inner
        if not cand.any():
            continue
        e = np.unravel_index(np.argmin(np.where(cand, cum, np.inf)), cum.shape)
        depth = ndimage.distance_transform_edt(m)  # px from the PSR edge
        blocks = lambda a: a[: n20 * k, : n20 * k].reshape(n20, k, n20, k)  # noqa: E731
        depth20 = blocks(depth).max(axis=(1, 3))
        # Ice spot: the cheapest-to-reach drivable cell 100-200 m inside the shadow edge (so on the side
        # facing the landing), wholly permanently shadowed. Most of the crater stays dry; the game hides
        # the exact spot and the player searches by drilling. Fallback: the deepest drivable cell.
        dmin, dmax = blocks(depth).min(axis=(1, 3)) * PLAY_RES, depth20 * PLAY_RES
        ice_c = (m20 & np.isfinite(cum) & (s20 <= ICE_MAX_SLOPE) & (dmin >= ICE_DEPTH[0]) & (dmax <= ICE_DEPTH[1])
                 & (np.nan_to_num(blocks(psr_w)).min(axis=(1, 3)) >= ICE_MIN_PSR)
                 & (np.nan_to_num(blocks(ill_w), nan=1).max(axis=(1, 3)) <= ICE_MAX_ILLUM))
        if ice_c.any():
            ice = np.unravel_index(np.argmin(np.where(ice_c, cum, np.inf)), cum.shape)
        else:
            deep_c = m20 & np.isfinite(cum) & (s20 <= 15)
            ice = (np.unravel_index(np.argmax(np.where(deep_c, depth20 * 1000 - cum, -np.inf)), cum.shape)
                   if deep_c.any() else None)
        area = float(m.sum() * 25.0)
        psr_features.append((cum[e], b, area, e, ice, depth))
    psr_features.sort(key=lambda f: (f[0], f[1]))
    shadow = None
    if psr_features:
        _, b, area, e, ice, depth = psr_features[0]
        m = lab_w == b
        rows, cols = np.nonzero(m)
        cx, cz = wrc_to_xz(rows.mean(), cols.mean())
        outline = []
        # coarse outline polygon (local x, z), for the minimap and zone triggers
        from skimage import measure
        cs_ = measure.find_contours(psr_w, 0.5, mask=ndimage.binary_dilation(m, iterations=3))
        if cs_:
            cmax = max(cs_, key=len)
            step = max(1, len(cmax) // 64)
            outline = [[round((c - half_px) * PLAY_RES), round((r - half_px) * PLAY_RES)] for r, c in cmax[::step]]
        shadow = {
            "description": "Permanently shadowed region (LOLA PSR map, Mazarico et al. 2011) in an unnamed, "
                           "degraded crater on the outer (northern) flank of the de Gerlache rim",
            "area_km2": round(area / 1e6, 3),
            "centroidLocal": {"x": round(cx), "z": round(cz)},
            "outlineLocal_xz": outline,
            "entryPoint": feature("Shadowed crater entry", *e),
            "iceCandidate": feature(
                "Ice candidate", *ice,
                depthInsideShadow_m=round(float(depth[ice[0] * k + k // 2, ice[1] * k + k // 2]) * PLAY_RES),
                note="Game ice spot: 100-200 m inside the permanent-shadow edge on the side facing the landing, "
                     "fully shadowed. Not shown on the minimap; players find it by drilling.",
            ) if ice is not None else None,
        }

    # Crater descent: drivable point on the de Gerlache side >= 150 m below landing.
    land_elev = float(z_w[lr, lc])
    deep = reach & toward & (z20 <= land_elev - 150)
    descent = None
    if deep.any():
        e = np.unravel_index(np.argmin(np.where(deep, cum, np.inf)), cum.shape)
        descent = feature("de Gerlache wall descent", *e, triggerBelowElevation_m=round(land_elev - 150))
    lowest_reach = float(np.min(np.where(reach & toward, z20, np.inf)))
    side = toward & inner
    steep_frac = float((s20[side] > DRIVE_MAX_SLOPE).mean())

    # How far is the big de Gerlache PSR (crater floor) from the landing point?
    land_X, land_Y = X0 + (lc - half_px) * PLAY_RES, Y0 - (lr - half_px) * PLAY_RES
    with rasterio.open(p["psr"]) as d:
        b = (gx - 25000, gy - 25000, gx + 25000, gy + 25000)
        w = from_bounds(*b, transform=d.transform).round_offsets().round_lengths()
        pm = d.read(1, window=w) > 0
        wt = d.window_transform(w)
    plab, pn = ndimage.label(pm, structure=np.ones((3, 3)))
    biggest = np.argmax(ndimage.sum(pm, plab, index=np.arange(1, pn + 1))) + 1
    pr, pc = np.nonzero(plab == biggest)
    pX, pY = wt.c + (pc + 0.5) * wt.a, wt.f + (pr + 0.5) * wt.e
    dgi = int(np.argmin(np.hypot(pX - land_X, pY - land_Y)))
    dg_psr = {"area_km2": round(len(pr) * 3600 / 1e6, 1),
              "nearestPointPolarStereo": {"X": round(float(pX[dgi])), "Y": round(float(pY[dgi]))},
              "nearestPointLocal": {"x": round(float(pX[dgi] - X0)), "z": round(float(Y0 - pY[dgi]))},
              "distanceFromLanding_m": round(float(np.hypot(pX[dgi] - land_X, pY[dgi] - land_Y))),
              "insidePlayArea": bool(abs(pX[dgi] - X0) <= PLAY_HALF and abs(Y0 - pY[dgi]) <= PLAY_HALF),
              "note": "Largest LOLA permanent-shadow region within 25 km of the de Gerlache crater center "
                      "(the crater floor). Visible from the rim but outside the play area."}
    log(f"de Gerlache floor PSR: {dg_psr['area_km2']} km^2, nearest {dg_psr['distanceFromLanding_m']} m from landing")

    landing = feature("Landing", lr // k, lc // k)
    landing.update({"local": {"x": land_x, "z": land_z, "y": round(float(ht_w[lr, lc]), 2)},
                    "elevation_m": round(land_elev, 1),
                    "distanceToNearestPSR_m": round(float(dist_psr[lr + rs.start, lc + cs.start])),
                    "slope_deg_75m_mean": round(float(ndimage.uniform_filter(sl_w, 15)[lr, lc]), 2),
                    "avgIllumination": round(float(ill_w[lr, lc]), 3),
                    "earthVisibility": round(float(ear_w[lr, lc]), 3)})
    landing.pop("driveDistanceFromLanding_m")
    landing.pop("distanceFromLanding_m")
    landing["polarStereo"] = dict(zip("XY", map(lambda v: round(v, 1), xz_to_ps(land_x, land_z))))
    landing["latLon"] = [round(v, 5) for v in ps_to_latlon(*xz_to_ps(land_x, land_z))]

    # ---- 4. Distant terrain ---------------------------------------------------
    def ring(key, half, res, decimate, cache):
        pad = 4 * res
        b = (X0 - half - pad, Y0 - half - pad, X0 + half + pad, Y0 + half + pad)
        src = remote_window(URLS[key], b, decimate, RAW / cache)
        n = 2 * half // res + 1
        tr = from_origin(X0 - half - res / 2, Y0 + half + res / 2, res, res)
        h = resample_to(src, tr, (n, n), Resampling.average, scaled=False)
        yy_, xx_ = np.mgrid[0:n, 0:n]
        return h, (xx_ - n // 2) * res, (yy_ - n // 2) * res

    tag = f"{int(X0)}_{int(Y0)}"
    near, nx, nz = ring("dem20", NEAR_HALF, NEAR_RES, 1, f"dem20_win_{tag}.tif")
    far, fx, fz = ring("dem80", FAR_HALF, FAR_RES, 2, f"dem80_win_{tag}.tif")
    # Datum check: Site11 vs the 20 m polar map over the play area.
    inside = (np.abs(nx) <= PLAY_HALF) & (np.abs(nz) <= PLAY_HALF)
    site_on_near = z_w[:: NEAR_RES // PLAY_RES, :: NEAR_RES // PLAY_RES]
    near_in = near[inside].reshape(site_on_near.shape)
    offset = float(np.nanmedian(site_on_near - near_in))
    log(f"Site11 minus 20 m map over the play area: median {offset:+.2f} m "
        f"(p5 {np.nanpercentile(site_on_near - near_in, 5):+.1f}, p95 {np.nanpercentile(site_on_near - near_in, 95):+.1f})")
    if np.isnan(near).any() or np.isnan(far).any():
        log("warning: NaNs in distant terrain, filling with nearest")
        for a in (near, far):
            m = np.isnan(a)
            if m.any():
                idx = ndimage.distance_transform_edt(m, return_distances=False, return_indices=True)
                a[:] = a[tuple(idx)]
    near_t = near + offset - curvature_drop(nx, nz)
    far_t = far + offset - curvature_drop(fx, fz)

    # Horizon profile from the landing point (rover camera height), 1 deg steps.
    eye = float(ht_w[lr, lc]) + EYE_HEIGHT
    az = np.radians(np.arange(360))
    horizon = np.full(360, -90.0)
    for arr, half, res, d0, d1, step in ((ht_w, PLAY_HALF, PLAY_RES, 10, 3990, 5),
                                         (near_t, NEAR_HALF, NEAR_RES, 4000, 24900, 25),
                                         (far_t, FAR_HALF, FAR_RES, 24000, 199000, 200)):
        d = np.arange(d0, d1, step, dtype=float)
        px = land_x + np.outer(np.sin(az), d)
        pz = land_z - np.outer(np.cos(az), d)
        n = arr.shape[0]
        ci = (px + half) / res
        ri = (pz + half) / res
        hv = ndimage.map_coordinates(arr, [ri.ravel(), ci.ravel()], order=1, mode="nearest").reshape(px.shape)
        ang = np.degrees(np.arctan2(hv - eye, d[None, :]))
        horizon = np.maximum(horizon, ang.max(axis=1))
    far_peaks = []
    fz_s = ndimage.maximum_filter(far_t, size=25)
    pk = (far_t == fz_s) & (np.hypot(fx, fz) > 30000)
    for r, c in sorted(zip(*np.nonzero(pk)), key=lambda t: -far[t])[:6]:
        x, z = float(fx[r, c]), float(fz[r, c])
        X, Y = xz_to_ps(x, z)
        dx, dz = x - land_x, z - land_z
        dist = math.hypot(dx, dz)
        azd = (math.degrees(math.atan2(dx, -dz)) + 360) % 360
        el = math.degrees(math.atan2(float(far_t[r, c]) - eye, dist))
        far_peaks.append({"local": {"x": round(x), "z": round(z)}, "polarStereo": {"X": round(X), "Y": round(Y)},
                          "latLon": [round(v, 3) for v in ps_to_latlon(X, Y)],
                          "elevation_m": round(float(far[r, c])), "distanceFromLanding_km": round(dist / 1000, 1),
                          "azimuth_deg": round(azd, 1), "elevationAngleFromLanding_deg": round(el, 2),
                          "visibleFromLanding": bool(el >= horizon[int(round(azd)) % 360] - 0.05)})
        for nm, ll in LANDMARKS.items():
            lx_, ly_ = latlon_to_ps(*ll)
            if math.hypot(X - lx_, Y - ly_) < 40000:
                far_peaks[-1]["likelyName"] = nm

    # ---- 5. Write images ------------------------------------------------------
    o = args.out
    hlo, hhi = write_png16(o / "heightmap.png", ht_w)
    write_png8(o / "slope.png", sl_w * SLOPE_SCALE)
    write_png8(o / "cold-mask.png", np.nan_to_num(psr_w) * 255)
    write_png8(o / "illumination.png", np.nan_to_num(ill_w) * 255)
    write_png8(o / "earth-visibility.png", np.nan_to_num(ear_w) * 255)
    nlo, nhi = write_png16(o / "distant-near.png", near_t)
    flo, fhi = write_png16(o / "distant-far.png", far_t)

    # ---- 6. terrain.json ------------------------------------------------------
    o_lat, o_lon = ps_to_latlon(X0, Y0)
    pole_dir = np.array([-X0, Y0]) / math.hypot(X0, Y0)  # local (x, z) toward (0, 0)
    colat = 90 + o_lat
    sizes = {f.name: f.stat().st_size for f in sorted(o.glob("*.png"))}

    def decode(lo, hi):
        return {"encoding": "uint16 grayscale PNG", "min_m": lo, "max_m": hi,
                "formula": "height_m = min_m + value / 65535 * (max_m - min_m)"}

    meta = {
        "version": 1,
        "generated": dt.date.today().isoformat(),
        "generator": "game/tools/build_terrain.py",
        "site": "de Gerlache crater rim, lunar south pole (NASA PGDA LOLA Site11)",
        "frame": {
            "description": "Local right-handed, y-up frame in meters (Three.js convention). Origin = play-area "
                           "center (a Site11 pixel center). +x = polar-stereographic +X (grid east); +z = "
                           "polar-stereographic -Y (grid south), so image rows increase with +z and image columns "
                           "with +x. +y = up (radial).",
            "originPolarStereo": {"X": X0, "Y": Y0},
            "originLatLon": [round(o_lat, 6), round(o_lon, 5)],
            "projection": "South polar stereographic, lat_0=-90, lon_0=0, true scale at the pole, sphere R=1737400 m "
                          "(scale error < 0.02% inside 8 km, < 0.4% at 200 km; ignored)",
            "toPolarStereo": "X = originX + x ; Y = originY - z",
            "fromPolarStereo": "x = X - originX ; z = originY - Y",
            "heights": "All heightmaps store TANGENT-PLANE heights: LOLA elevation above the 1737.4 km sphere minus "
                       "the curvature drop r^2 / (2R), r = horizontal distance from the origin. A flat-world "
                       "renderer then shows the real horizon (about 2.4 km away for a 1.7 m camera on flat ground). "
                       "To recover LOLA elevation: elevation = height + (x^2 + z^2) / (2 * 1737400).",
            "towardPole": {"x": round(float(pole_dir[0]), 4), "z": round(float(pole_dir[1]), 4),
                           "distance_km": round(math.hypot(X0, Y0) / 1000, 2),
                           "note": "The south pole (and Shackleton crater) lies this way."},
            "azimuthConvention": "azimuth_deg is measured from local -z, turning toward +x (clockwise seen from above). "
                                 "Direction vector = (x: sin(az), z: -cos(az)). For a body at infinity (Sun, Earth) "
                                 "the azimuth equals its sub-point longitude (deg east) to within ~0.1 deg here.",
        },
        "sunAndEarth": {
            "siteLatitude_deg": round(o_lat, 4), "siteLongitude_deg": round(o_lon, 4),
            "elevationFormula": "sin(el) = sin(siteLat) * sin(subLat) + cos(siteLat) * cos(subLat) * cos(subLon - siteLon)",
            "sun": f"Azimuth = subsolar longitude; it decreases about 12.19 deg per Earth day, so the Sun circles "
                   f"counterclockwise seen from above (-z -> -x -> +z -> +x). Subsolar latitude stays within +/-1.54 deg, "
                   f"so the Sun's elevation here is about -subLat + {colat:.2f} * cos(az - ({o_lon:.1f})) deg: highest "
                   f"when it is opposite the pole direction (az {o_lon % 360:.0f}), lowest toward the pole.",
            "earth": {"direction": {"x": 0.0, "z": -1.0},
                      "azimuth_deg": 0.0,
                      "note": f"Earth sits near longitude 0, i.e. toward local -z, swinging about +/-8 deg in azimuth "
                              f"(libration). Its elevation is about {colat * math.cos(math.radians(o_lon)):+.1f} deg "
                              f"+/- 6.7 deg, so it bobs above and below the horizon over a month. Horizon height "
                              f"toward -z from the landing point: {horizon[0]:+.2f} deg."},
        },
        "playArea": {
            "size_m": 2 * PLAY_HALF, "pixel_m": PLAY_RES, "samples": N,
            "boundsLocal": {"xMin": -PLAY_HALF, "xMax": PLAY_HALF, "zMin": -PLAY_HALF, "zMax": PLAY_HALF},
            "boundsPolarStereo": {"Xmin": X0 - PLAY_HALF, "Xmax": X0 + PLAY_HALF,
                                  "Ymin": Y0 - PLAY_HALF, "Ymax": Y0 + PLAY_HALF},
            "pixelToLocal": "sample (col, row) -> x = (col - 800) * 5, z = (row - 800) * 5 (vertex-centered grid)",
            "files": {
                "heightmap": {"file": "heightmap.png", **decode(hlo, hhi)},
                "slope": {"file": "slope.png", "encoding": "uint8 grayscale PNG",
                          "formula": f"slope_deg = value / {SLOPE_SCALE}", "source": "PGDA Site11 slope product (5 m)"},
                "coldMask": {"file": "cold-mask.png", "encoding": "uint8 grayscale PNG",
                             "formula": "psr_fraction = value / 255; value >= 128 means permanently shadowed",
                             "source": "LOLA permanent-shadow map LPSR_85S_060M (60 m), bilinear to 5 m"},
                "illumination": {"file": "illumination.png", "encoding": "uint8 grayscale PNG",
                                 "formula": "fraction_of_time_sunlit = value / 255 (average over 18.6 years)",
                                 "source": "LOLA average illumination AVGVISIB_85S_060M (60 m), bilinear to 5 m"},
                "earthVisibility": {"file": "earth-visibility.png", "encoding": "uint8 grayscale PNG",
                                    "formula": "fraction_of_time_Earth_visible = value / 255",
                                    "source": "LOLA average Earth visibility AVGVISIB_85S_060M_EARTH (60 m)"},
            },
            "elevationRange_m": [round(float(z_w.min()), 1), round(float(z_w.max()), 1)],
        },
        "distantTerrain": [
            {"name": "near ring", "file": "distant-near.png", **decode(nlo, nhi),
             "size_m": 2 * NEAR_HALF, "pixel_m": NEAR_RES, "samples": near_t.shape[0],
             "boundsLocal": {"xMin": -NEAR_HALF, "xMax": NEAR_HALF, "zMin": -NEAR_HALF, "zMax": NEAR_HALF},
             "pixelToLocal": f"x = (col - {near_t.shape[0] // 2}) * {NEAR_RES}, z = (row - {near_t.shape[0] // 2}) * {NEAR_RES}",
             "hole": "Covers the play area too; skip or sink the part inside playArea.boundsLocal.",
             "source": "LOLA 20 m polar DEM (LDEM_80S_20MPP_ADJ), area-averaged to 50 m",
             "datumOffsetApplied_m": round(offset, 2)},
            {"name": "far ring", "file": "distant-far.png", **decode(flo, fhi),
             "size_m": 2 * FAR_HALF, "pixel_m": FAR_RES, "samples": far_t.shape[0],
             "boundsLocal": {"xMin": -FAR_HALF, "xMax": FAR_HALF, "zMin": -FAR_HALF, "zMax": FAR_HALF},
             "pixelToLocal": f"x = (col - {far_t.shape[0] // 2}) * {FAR_RES}, z = (row - {far_t.shape[0] // 2}) * {FAR_RES}",
             "hole": "Covers the near ring too; skip or sink the part inside the near ring's bounds.",
             "source": "LOLA 80 m polar DEM (LDEM_80S_80MPP_ADJ), area-averaged to 400 m",
             "datumOffsetApplied_m": round(offset, 2)},
        ],
        "landing": landing,
        "features": {
            "rimViewpoints": rim_viewpoints,
            "rockyAreas": rocky,
            "shadowedCrater": shadow,
            "craterDescent": descent,
            "deGerlacheFloorPSR": dg_psr,
            "notes": [
                "Drive distances are least-cost routes on a 20 m grid avoiding slopes over "
                f"{DRIVE_MAX_SLOPE:.0f} deg; straight-line distances are also given.",
                "Rocky areas are small fresh craters (compact steep patches against the regional slope); "
                "driveDistance is to the nearest drivable point within ~150 m. Place boulders densest there.",
                "Small PSRs (< 0.1 km^2, mostly inside fresh craters) are also in cold-mask.png; one sits in "
                "Rocky area 1 if that crater is close to the landing point. Drop them from the cold zone if "
                "the freeze mechanic should only apply in the big shadowed crater.",
                f"On the de Gerlache side of the play area {steep_frac:.0%} of the ground is steeper than "
                f"{DRIVE_MAX_SLOPE:.0f} deg at 20 m scale, but routes exist: the lowest drivable point on that side "
                f"is at {lowest_reach:.0f} m (landing is {land_elev:.0f} m).",
                f"The de Gerlache crater floor PSR is NOT inside the play area: its nearest point is "
                f"{dg_psr['distanceFromLanding_m'] / 1000:.1f} km from the landing point. The shadowed crater used "
                "here is a smaller real PSR on the rim's outer flank.",
            ],
        },
        "horizonFromLanding": {
            "eyeHeight_m": EYE_HEIGHT,
            "elevation_deg_by_azimuth": [round(float(v), 2) for v in horizon],
            "note": "Index = azimuth in degrees (see frame.azimuthConvention). Includes curvature; "
                    "compare with the Sun/Earth elevation to know if they are above the local horizon.",
        },
        "distantPeaks": far_peaks,
        "files_bytes": sizes,
        "sources": [
            {"dataset": "LOLA 5 m/px site DEM and slope, Site11 (de Gerlache rim)",
             "url": URLS["site_dem"],
             "citation": "Barker, M.K., et al. (2021), Improved LOLA elevation maps for south pole landing sites: "
                         "Error estimates and their impact on illumination conditions, Planetary and Space Science, "
                         "203, 105119, doi:10.1016/j.pss.2020.105119",
             "provider": "NASA Goddard PGDA (pgda.gsfc.nasa.gov/products/78)"},
            {"dataset": "LOLA south polar DEMs at 20 m and 80 m/px",
             "url": [URLS["dem20"], URLS["dem80"]],
             "citation": "Barker, M.K., et al. (2023), Improved LOLA elevation maps for south pole landing sites, "
                         "Planetary and Space Science (PGDA product 90)",
             "provider": "NASA Goddard PGDA (pgda.gsfc.nasa.gov/products/90)"},
            {"dataset": "LOLA polar illumination, permanent shadow and Earth visibility maps (85S, 60 m/px)",
             "url": [URLS["psr"], URLS["illum"], URLS["earth"]],
             "citation": "Mazarico, E., et al. (2011), Illumination conditions of the lunar polar regions using LOLA "
                         "topography, Icarus, 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030",
             "provider": "NASA Goddard PGDA (pgda.gsfc.nasa.gov/products/69) / PDS LOLA"},
        ],
        "credits": [
            "Terrain: NASA LRO Lunar Orbiter Laser Altimeter (LOLA) elevation models, NASA Goddard PGDA; "
            "Barker et al. 2021, 2023.",
            "Sunlight, permanent shadow and Earth visibility: NASA LRO LOLA polar illumination maps; Mazarico et al. 2011.",
        ],
    }
    with open(o / "terrain.json", "w") as f:
        json.dump(meta, f, indent=2, default=lambda v: v.item() if hasattr(v, "item") else str(v))
        f.write("\n")
    for name, sz in sizes.items():
        log(f"{name:24s} {sz / 1e6:6.2f} MB")
    log(f"landing local ({land_x}, {land_z}) PS {landing['polarStereo']} elev {land_elev:.0f} m")

    if args.preview:
        render_preview(args.preview, Z, T, tile_bounds, PSR, X0, Y0, z_w, psr_w, ill_w, meta, paths, k,
                       far_t, near_t)
        log(f"preview -> {args.preview}")


def render_preview(path, Z, T, tb, PSR, X0, Y0, z_w, psr_w, ill_w, meta, paths, k, far_t, near_t):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(1, 3, figsize=(30, 10.5), gridspec_kw={"width_ratios": [1, 1, 1]})
    h = PLAY_HALF
    # Panel 1: whole Site11 tile in local coordinates
    ext = [tb.left - X0, tb.right - X0, Y0 - tb.top, Y0 - tb.bottom]  # x, z (z down)
    a = ax[0]
    a.imshow(hillshade(Z[::2, ::2], 10), cmap="gray", extent=[ext[0], ext[1], ext[3], ext[2]])
    a.contour(np.linspace(ext[0], ext[1], Z.shape[1] // 4), np.linspace(ext[2], ext[3], Z.shape[0] // 4),
              PSR[::4, ::4], levels=[0.5], colors="cyan", linewidths=1)
    a.plot([-h, h, h, -h, -h], [-h, -h, h, h, -h], "r-", lw=2)
    a.set_xlim(ext[0], ext[1]); a.set_ylim(ext[3], ext[2])
    a.set_title("Site11 tile (16 km), local x/z m; red = play area, cyan = PSR")
    # Panel 2: play area close-up
    a = ax[1]
    a.imshow(hillshade(z_w, 5), cmap="gray", extent=[-h, h, h, -h])
    a.imshow(np.ma.masked_less(ill_w, 0.45), cmap="autumn", alpha=0.25, extent=[-h, h, h, -h], vmin=0.45, vmax=0.8)
    xs = np.linspace(-h, h, z_w.shape[0])
    a.contour(xs, xs, psr_w, levels=[0.5], colors="cyan", linewidths=1.5)
    cs = a.contour(xs[::4], xs[::4], z_w[::4, ::4], levels=range(-1000, 2000, 100), colors="yellow",
                   linewidths=0.3, alpha=0.6)
    a.clabel(cs, fontsize=6, fmt="%d")
    for name, pth in paths.items():
        if name == "Landing":
            continue
        a.plot((pth[:, 1] * k + k / 2 - 800) * 5, (pth[:, 0] * k + k / 2 - 800) * 5, "-", lw=1, color="w", alpha=0.7)
    L = meta["landing"]["local"]
    a.plot(L["x"], L["z"], "r*", ms=22, mec="k")
    f = meta["features"]
    marks = [(v, "lime", "^") for v in f["rimViewpoints"]] + [(v, "orange", "s") for v in f["rockyAreas"]]
    if f["shadowedCrater"]:
        marks.append((f["shadowedCrater"]["entryPoint"], "cyan", "o"))
        if f["shadowedCrater"]["iceCandidate"]:
            marks.append((f["shadowedCrater"]["iceCandidate"], "deepskyblue", "D"))
    if f["craterDescent"]:
        marks.append((f["craterDescent"], "magenta", "v"))
    for v, col, mk in marks:
        a.plot(v["local"]["x"], v["local"]["z"], mk, color=col, ms=12, mec="k")
        a.annotate(f"{v['name']}\n{v['distanceFromLanding_m']} m / drive {v['driveDistanceFromLanding_m']} m",
                   (v["local"]["x"], v["local"]["z"]), xytext=(8, 8), textcoords="offset points", color=col,
                   fontsize=8, bbox=dict(fc="k", alpha=0.5, lw=0))
    td = meta["frame"]["towardPole"]
    a.annotate("", xy=(-3000 + 800 * td["x"], -3300 + 800 * td["z"]), xytext=(-3000, -3300),
               arrowprops=dict(color="w", width=2))
    a.text(-3000, -3500, "pole", color="w")
    a.annotate("", xy=(-2000, -3300 - 800), xytext=(-2000, -3300), arrowprops=dict(color="deepskyblue", width=2))
    a.text(-2000, -3500 + 100, " Earth", color="deepskyblue")
    a.set_xlim(-h, h); a.set_ylim(h, -h)
    a.set_title("Play area 8 km: star landing, cyan PSR, orange tint = avg illum >= 0.45, white = drive routes")
    # Panel 3: far ring
    a = ax[2]
    F = FAR_HALF
    a.imshow(hillshade(far_t, FAR_RES, alt=20), cmap="gray", extent=[-F, F, F, -F])
    N_ = NEAR_HALF
    a.plot([-N_, N_, N_, -N_, -N_], [-N_, -N_, N_, N_, -N_], "y-")
    a.plot(0, 0, "r*", ms=12)
    for pk in meta["distantPeaks"]:
        a.plot(pk["local"]["x"], pk["local"]["z"], "c^")
        a.annotate(f"{pk['elevation_m']} m, {pk['distanceFromLanding_km']} km\naz {pk['azimuth_deg']}"
                   f"{' visible' if pk['visibleFromLanding'] else ''}", (pk["local"]["x"], pk["local"]["z"]),
                   color="c", fontsize=8)
    a.set_title("Far ring 400 km (yellow = near ring 50 km)")
    plt.tight_layout()
    plt.savefig(path, dpi=60)


if __name__ == "__main__":
    main()
