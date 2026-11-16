"""Mars sites features for terrain.json (requests MP1 to MP4 and MP6 of the Mars sites plan).

Called by build_terrain_mars.py; added for Chieri's review. Everything here reads the game's own Mars outputs
(heightmap.png, slope.png and soft-ground.png in the output folder, plus the frame, landing and features in
terrain.json), small windows of the HiRISE 25 cm orthomosaic, and the Mars 2020 waypoints file. A
features-only run therefore needs none of the large DTM downloads. It returns plain lists for terrain.json
`features`:

- youngCraters (MP1): craters 80 to 400 m across within 1.6 km of the landing, from the 5 m heights, with
  rim radius, depth, wall slopes, drive distances and a freshness test (boulder shadows on the rim in the
  25 cm mosaic).
- slopeTargets (MP2): 5 m cells at 10 to 18 deg (the game's slope.png) beside a cell under 8 deg, grouped
  into patches at each young crater, the two knobs and the delta foot.
- deltaFront.footNear and deltaFront.floodBoulder (MP3): the nearest 400 m of the delta's scarp-foot line and
  one spot for the flood boulder.
- perseveranceSites (MP4): Perseverance's abrasion and sampling stops within 1.6 km, placed from the
  waypoints file.
- missionLandmarks (MP6): Wright Brothers Field, from the rover's position when it set Ingenuity down.

Ids are stable as long as the inputs and these rules do not change. Young craters and knobs are named by
16-point compass direction from the landing (`young-crater-ene`, `knob-wnw`), numbered by distance when a
direction has several; the crater holding Rocky area 2 keeps the fixed id `young-crater-rocky-area-2`.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import Resampling, reproject, transform_bounds
from scipy import ndimage
from scipy.signal import fftconvolve
from skimage.graph import MCP_Geometric
from skimage.measure import approximate_polygon, find_contours, regionprops

from mars_common import (RAW, URLS, curvature_drop, fetch, gdal_env, latlon_to_local, local_crs, local_to_latlon,
                         log, remote_window, slope_deg)

RES = 5.0  # m, play-area grid
NOTE_PREFIX = "Mars sites features"

# ---- MP1: young craters ---------------------------------------------------------
CRATER_MAX_DIST = 1600.0  # m from the landing, straight line, to the crater center
CRATER_DIAMETER = (80.0, 400.0)  # m, rim crest to rim crest
CRATER_SEARCH_RADII = range(40, 201, 10)  # m: ring radii of the depression filter
CRATER_MIN_SCORE = 0.01  # ring-minus-center height / diameter of a candidate
CRATER_MIN_DEPTH = 2.5  # m, rim crest above the floor
CRATER_MIN_DD = 0.015  # depth / diameter
CRATER_MIN_RIM = 0.75  # share of azimuths where the crest stands at least half the depth above the floor
CRATER_ROUND_MAX = 1.5  # 90th / 10th percentile of the crest radius, for "fresh"
BLOCK_DARK = 0.6  # a boulder shadow is darker than this share of the local mean brightness (4 m Gaussian)
BLOCK_AREA = (0.25, 8.0)  # m^2 of a shadow: blocks about 0.5 to 3 m across
BLOCK_ELONGATION = 3.0  # longer shadows (ripple troughs, wall shade) are not blocks
BLOCK_RIM = (0.8, 1.2)  # rim zone, in crest radii
BLOCK_BACKGROUND = (2.5, 3.5)  # background ring, in crest radii
FRESH_BLOCK_RATIO = 3.0  # "fresh": rim shadows per hectare at least this many times the background ...
FRESH_BLOCK_DENSITY = 20.0  # ... and at least this many per hectare ...
FRESH_RIM_UPLIFT = 2.0  # ... and a raised rim: crest at least this many meters over the 1.8-2.5 R ring (median)
ORTHO_RES = 0.25  # m, native HiRISE orthomosaic pixel

# ---- MP2: slope targets ---------------------------------------------------------
TARGET_SLOPE = (10.0, 18.0)  # deg (game slope.png): over the arm's limit, still drivable
TARGET_LEVEL = 8.0  # deg: a target cell has a 4-neighbour (5 m away) under this
TARGET_MAX_SOFT = 0.2  # softness: targets stay off Seitah's ripples
TARGET_CRATER_MARGIN = 40.0  # m beyond a crater's rim crest
KNOB_RADIUS = 100.0  # m around a knob's summit
KNOB_CANDIDATES = [(305.0, -835.0), (620.0, 445.0)]  # the sites plan's knobs (local x, z); summits found within 60 m
TARGET_PATCHES_LISTED = 4  # largest patches listed per site

# ---- MP3: delta foot and flood boulder ------------------------------------------
FOOT_LENGTH = 400.0  # m of the scarp-foot line nearest the landing
FOOT_ZONE = 50.0  # m around it
FOOT_MIN_DIST = 1350.0  # m: the flood boulder (and the foot zone) stay outside this ring from the landing
BOULDER_DIAMETER = 2.5  # m
BOULDER_UPHILL = (12.0, 18.0)  # deg on its uphill and side faces
BOULDER_DOWNHILL = 10.0  # deg: ground under this within 3 m of the downhill face
BOULDER_DOWNHILL_REACH = 3.0  # m
BOULDER_MAX_UPSLOPE = 100.0  # m from the foot line, up the scarp

# ---- MP4: Perseverance's sample sites --------------------------------------------
SITES_MAX_DIST = 1600.0  # m from the landing
# Rock targets Perseverance abraded and sampled on the crater floor in 2021-2022, from NASA's Mars 2020 sample
# list (https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/). Positions are not taken
# from here: each comes from the waypoints file (the rover's end-of-drive position on the first sample sol).
SAMPLE_SITES = [
    {"id": "roubion", "name": "Roubion", "kind": "sample-attempt", "abrasion": "Guillaumes",
     "samples": [{"name": "Roubion", "sol": 164, "date": "2021-08-06",
                  "note": "First sample attempt: the rock crumbled and the tube held only Martian air"}]},
    {"id": "rochette", "name": "Rochette", "kind": "sample", "abrasion": "Bellegarde",
     "samples": [{"name": "Montdenier", "sol": 190, "date": "2021-09-01"},
                 {"name": "Montagnac", "sol": 196, "date": "2021-09-08"}]},
    {"id": "brac", "name": "Brac", "kind": "sample", "abrasion": "Dourbes",
     "samples": [{"name": "Salette", "sol": 262, "date": "2021-11-15"},
                 {"name": "Coulettes", "sol": 271, "date": "2021-11-24"}]},
    {"id": "issole", "name": "Issole", "kind": "sample", "abrasion": "Quartier",
     "samples": [{"name": "Robine", "sol": None, "date": "2021-12"},
                 {"name": "Malay", "sol": 337, "date": "2022-01-31"}]},
]
SAMPLE_LIST_URL = "https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/"

# ---- MP6: mission landmarks -----------------------------------------------------------
INGENUITY_DEPLOY_SOL = 43  # April 3, 2021: Ingenuity set down on Wright Brothers Field from beneath the rover

DIRS8 = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
COMPASS16 = ["n", "nne", "ne", "ene", "e", "ese", "se", "sse", "s", "ssw", "sw", "wsw", "w", "wnw", "nw", "nnw"]


def dir8(az_deg):
    return DIRS8[int(((az_deg + 22.5) % 360) // 45)]


def compass16(dx, dz):
    az = (math.degrees(math.atan2(dx, -dz)) + 360) % 360
    return COMPASS16[int(((az + 11.25) % 360) // 22.5)]


def name_by_direction(items, land, prefix, label):
    """Give each item without an 'id' a compass id and name, numbered by distance from the landing."""
    groups = {}
    for it in items:
        if not it.get("id"):
            groups.setdefault(compass16(it["x"] - land[0], it["z"] - land[1]), []).append(it)
    for key, lst in groups.items():
        lst.sort(key=lambda it: math.hypot(it["x"] - land[0], it["z"] - land[1]))
        for i, it in enumerate(lst):
            sfx = "" if i == 0 else f"-{i + 1}"
            it["id"] = f"{prefix}-{key}{sfx}"
            it["name"] = f"{key.upper()} {label}" + ("" if i == 0 else f" {i + 1}")


@dataclass
class Inputs:
    """What build_terrain_mars.py passes in (its constants, so both stay in step)."""
    out: Path  # folder with heightmap.png, slope.png, soft-ground.png
    meta: dict  # terrain.json as built (or as read back)
    origin: tuple  # (lat0, lon0), unrounded
    drive_res: int
    drive_max_slope: float
    edge_margin: float
    three_forks: tuple  # (lat, lon): the delta-front floor used for the scarp-foot contour
    foot_above_floor: float  # m: the scarp-foot contour above the Three Forks floor
    waypoints_url: str
    brac: tuple  # (lat, lon) of the Brac sample site (Simon et al. 2023), to check the waypoints against


class Grids:
    """The game's 5 m grids, decoded from the output PNGs, and the build's 10 m drive grid from the landing."""

    def __init__(self, inp: Inputs):
        self.inp = inp
        m = inp.meta
        hm = m["playArea"]["files"]["heightmap"]
        v = np.array(Image.open(inp.out / hm["file"])).astype(np.float64)
        self.ht = hm["min_m"] + v / 65535.0 * (hm["max_m"] - hm["min_m"])  # tangent-plane heights
        self.n = self.ht.shape[0]
        self.h = self.n // 2
        yy, xx = np.mgrid[0:self.n, 0:self.n]
        self.X, self.Z = (xx - self.h) * RES, (yy - self.h) * RES
        self.z = self.ht + curvature_drop(self.X, self.Z)  # elevation above the areoid
        self.sl = np.array(Image.open(inp.out / m["playArea"]["files"]["slope"]["file"])).astype(np.float64) / 4.0
        self.soft = np.array(Image.open(inp.out / m["playArea"]["files"]["softGround"]["file"])).astype(np.float64) / 255
        self.land = (float(m["landing"]["local"]["x"]), float(m["landing"]["local"]["z"]))
        self.D = np.hypot(self.X - self.land[0], self.Z - self.land[1])
        # Drive grid, exactly as build_terrain_mars.py builds it.
        k = inp.drive_res // int(RES)
        self.k = k
        z10 = ndimage.gaussian_filter(self.z, 0.5 * k)[::k, ::k]
        self.n10 = z10.shape[0]
        self.h10 = self.n10 // 2
        self.s10 = slope_deg(z10, inp.drive_res)
        cost = 1.0 + 2.0 * (self.s10 / inp.drive_max_slope) ** 2
        cost[self.s10 > inp.drive_max_slope] = np.inf
        mm = int(inp.edge_margin / inp.drive_res) // 2
        cost[:mm, :] = cost[-mm:, :] = np.inf
        cost[:, :mm] = cost[:, -mm:] = np.inf
        self.mcp = MCP_Geometric(cost)
        self.cum, _ = self.mcp.find_costs([self.rc10(*self.land)])
        self.reach10 = np.isfinite(self.cum)
        yy10, xx10 = np.mgrid[0:self.n10, 0:self.n10]
        self.X10, self.Z10 = (xx10 - self.h10) * inp.drive_res, (yy10 - self.h10) * inp.drive_res
        self.reach5 = np.kron(self.reach10, np.ones((k, k), bool))[:self.n, :self.n]

    def rc(self, x, z):
        return int(round(z / RES + self.h)), int(round(x / RES + self.h))

    def rc10(self, x, z):
        r = self.inp.drive_res
        return int(round(z / r + self.h10)), int(round(x / r + self.h10))

    def drive10(self, idx):
        """Drive length (m) from the landing to a 10 m cell, or None."""
        if not np.isfinite(self.cum[idx]):
            return None
        p = np.array(self.mcp.traceback(idx))
        return round(float(np.sum(np.hypot(*np.diff(p, axis=0).T)) * self.inp.drive_res))

    def cheapest(self, mask10):
        """The reachable 10 m cell in mask10 with the cheapest route: (drive length, (x, z)) or (None, None)."""
        cand = mask10 & self.reach10
        if not cand.any():
            return None, None
        i = np.unravel_index(np.argmin(np.where(cand, self.cum, np.inf)), cand.shape)
        return self.drive10(i), (int(self.X10[i]), int(self.Z10[i]))

    def point(self, name, x, z, source=None, **extra):
        """A Site as build_terrain_mars.py writes them (slope_deg on the 10 m drive grid)."""
        r, c = self.rc(x, z)
        x, z = float(self.X[r, c]), float(self.Z[r, c])
        lat, lon = local_to_latlon(x, z, *self.inp.origin)
        f = {"name": name,
             "local": {"x": round(x), "y": round(float(self.ht[r, c]), 2), "z": round(z)},
             "latLon": [round(float(lat), 5), round(float(lon), 5)],
             "elevation_m": round(float(self.z[r, c]), 1),
             "slope_deg": round(float(self.s10[self.rc10(x, z)]), 1),
             "distanceFromLanding_m": round(math.hypot(x - self.land[0], z - self.land[1])),
             "driveDistanceFromLanding_m": self.drive10(self.rc10(x, z))}
        if source:
            f["source"] = source
        f.update(extra)
        return f

    def ring10(self, x, z, r0, r1):
        d = np.hypot(self.X10 - x, self.Z10 - z)
        return (d >= r0) & (d <= r1)


# =============================================================================
# MP1: young craters
# =============================================================================

ANG = np.radians(np.arange(0, 360, 5.0))


def crater_candidates(g: Grids):
    """Centers of local depressions: ring-minus-center height over the diameter, best over the search radii."""
    half_w = int((CRATER_MAX_DIST + 500) / RES)
    lr, lc = g.rc(*g.land)
    r0, r1 = max(lr - half_w, 0), min(lr + half_w + 1, g.n)
    c0, c1 = max(lc - half_w, 0), min(lc + half_w + 1, g.n)
    h = g.ht[r0:r1, c0:c1]
    hs = ndimage.gaussian_filter(h, 2)
    best = np.full(h.shape, -np.inf)
    best_r = np.zeros(h.shape)
    for R in CRATER_SEARCH_RADII:
        rp = R / RES
        kk = int(np.ceil(rp * 1.15)) + 1
        yy, xx = np.mgrid[-kk:kk + 1, -kk:kk + 1]
        d = np.hypot(yy, xx)
        ker = ((d >= 0.9 * rp) & (d <= 1.1 * rp)).astype(float)
        ker /= ker.sum()
        v = (fftconvolve(h, ker, mode="same") - hs) / (2 * R)
        best_r = np.where(v > best, R, best_r)
        best = np.maximum(best, v)
    pk = (best == ndimage.maximum_filter(best, 15)) & (best >= CRATER_MIN_SCORE)
    pk &= g.D[r0:r1, c0:c1] <= CRATER_MAX_DIST + 50
    rr, cc = np.nonzero(pk)
    order = np.argsort(-best[rr, cc])
    return [(float(g.X[rr[i] + r0, cc[i] + c0]), float(g.Z[rr[i] + r0, cc[i] + c0]), float(best_r[rr[i], cc[i]]))
            for i in order]


def crest_profile(g: Grids, x, z, R):
    """Heights along 72 rays out to 3.2 R, with the plane of the 2.5-3.1 R ring removed; the crest radius on
    each ray is the highest point between 0.6 R and 1.4 R."""
    kk = R / RES
    rs = np.arange(0, 3.2 * kk)
    rr = (z / RES + g.h) + np.outer(rs, -np.cos(ANG))
    cc = (x / RES + g.h) + np.outer(rs, np.sin(ANG))
    hp = ndimage.map_coordinates(g.ht, [rr, cc], order=1, mode="nearest")
    o = (rs >= 2.5 * kk) & (rs < 3.1 * kk)
    A = np.stack([np.ones(o.sum() * len(ANG)), (rs[o][:, None] * np.cos(ANG)[None, :]).ravel(),
                  (rs[o][:, None] * np.sin(ANG)[None, :]).ravel()], 1)
    coef = np.linalg.lstsq(A, hp[o].ravel(), rcond=None)[0]
    det = hp - (coef[0] + coef[1] * rs[:, None] * np.cos(ANG)[None, :] + coef[2] * rs[:, None] * np.sin(ANG)[None, :])
    lo, hi = int(0.6 * kk), int(1.4 * kk) + 1
    ci = np.argmax(det[lo:hi], axis=0) + lo
    regional = math.degrees(math.atan(math.hypot(coef[1], coef[2]) / RES))
    return rs, rr, cc, det, ci, regional


def crater_shape(g: Grids, x0, z0, R0):
    """Refine a candidate: fit a circle to the crest points (outliers over 25% from the median radius
    dropped), four times. Returns the crater's numbers, or None if it has no raised rim."""
    x, z, R = x0, z0, R0
    for _ in range(4):
        rs, rr, cc, det, ci, regional = crest_profile(g, x, z, R)
        rad = ci * RES
        med = float(np.median(rad))
        ok = np.abs(rad - med) <= 0.25 * med
        px, pz = x + rad * np.sin(ANG), z - rad * np.cos(ANG)
        M = np.stack([px[ok], pz[ok], np.ones(ok.sum())], 1)
        a = np.linalg.lstsq(M, px[ok] ** 2 + pz[ok] ** 2, rcond=None)[0]
        x, z, R = float(a[0] / 2), float(a[1] / 2), med
        if math.hypot(x - x0, z - z0) > R0 or R < 20:
            return None
    rs, rr, cc, det, ci, regional = crest_profile(g, x, z, R)
    kk = R / RES
    crest = det[ci, np.arange(len(ANG))]
    floor = float(det[: max(2, int(0.25 * kk))].mean())
    depth = float(crest.mean() - floor)
    outer = det[(rs >= 1.8 * kk) & (rs < 2.5 * kk)].mean(axis=0)
    if depth <= 0 or float(np.median(crest - outer)) <= 0:
        return None
    rad = ci * RES
    uplift = np.convolve(np.concatenate([(crest - outer)[-3:], crest - outer, (crest - outer)[:3]]), np.ones(7) / 7, "valid")
    walls = np.array([g.sl[np.clip(np.round(rr[:ci[j] + 1, j]).astype(int), 0, g.n - 1),
                           np.clip(np.round(cc[:ci[j] + 1, j]).astype(int), 0, g.n - 1)].max()
                      for j in range(len(ANG))])
    return {"x": x, "z": z, "R": R, "D": 2 * R, "Dp10": 2 * float(np.percentile(rad, 10)),
            "Dp90": 2 * float(np.percentile(rad, 90)), "depth": depth,
            "comp": float((crest - floor >= 0.5 * depth).mean()), "rimUplift": float(np.median(crest - outer)),
            "wall": float(np.median(walls)), "wallMax": float(walls.max()), "regional": regional,
            "steepDir": dir8(math.degrees(ANG[int(np.argmax(walls))])),
            "lowDir": dir8(math.degrees(ANG[int(np.argmin(uplift))]))}


def ortho_window(g: Grids, x, z, half):
    """The 25 cm HiRISE orthomosaic over a square around (x, z), on a local grid at 0.25 m (row 0 north).

    Cached in raw/mars/ortho25/ per window (tiled source, so only the window's tiles are read)."""
    lat0, lon0 = g.inp.origin
    dest = RAW / "ortho25" / f"hirise_ortho_25cm_{lat0:.4f}_{lon0:.4f}_{round(x)}_{round(z)}_{round(half)}.tif"
    if not dest.exists():
        with gdal_env(), rasterio.open("/vsicurl/" + URLS["hirise_ortho"]) as s:
            ocrs = s.crs
        b = transform_bounds(local_crs(lat0, lon0), ocrs, x - half - 20, -z - half - 20, x + half + 20,
                             -z + half + 20, densify_pts=21)
        remote_window(URLS["hirise_ortho"], b, 1, dest, dtype="uint8", chunk_rows=2048)
    n = int(round(2 * half / ORTHO_RES))
    out = np.full((n, n), np.nan, np.float32)
    tr = rasterio.transform.from_origin(x - half, -z + half, ORTHO_RES, ORTHO_RES)
    with rasterio.open(dest) as src:
        a = src.read(1).astype(np.float32)
        a[a == 0] = np.nan
        reproject(a, out, src_transform=src.transform, src_crs=src.crs, src_nodata=np.nan, dst_transform=tr,
                  dst_crs=local_crs(lat0, lon0), dst_nodata=np.nan, resampling=Resampling.bilinear)
    return out


def boulder_shadows(img):
    """Centers (row, col) of compact dark blobs in a 25 cm image: shadows of blocks about 0.5 to 3 m across."""
    I = np.nan_to_num(img, nan=float(np.nanmean(img))).astype(np.float64)
    dark = I / np.maximum(ndimage.gaussian_filter(I, 4.0 / ORTHO_RES), 1) < BLOCK_DARK
    lab, _ = ndimage.label(dark)
    pts = []
    for p in regionprops(lab):
        a = p.area * ORTHO_RES ** 2
        if not BLOCK_AREA[0] <= a <= BLOCK_AREA[1]:
            continue
        if p.axis_minor_length > 0 and p.axis_major_length / p.axis_minor_length > BLOCK_ELONGATION:
            continue
        pts.append(p.centroid)
    return np.array(pts).reshape(-1, 2)


def freshness(g: Grids, q):
    """Boulder shadows per hectare on the rim (0.8-1.2 R) and in the background ring (2.5-3.5 R)."""
    half = BLOCK_BACKGROUND[1] * q["R"] + 30
    img = ortho_window(g, q["x"], q["z"], half)
    n = img.shape[0]
    P = boulder_shadows(img)
    d = np.hypot(P[:, 1] - n / 2, P[:, 0] - n / 2) * ORTHO_RES
    yy, xx = np.ogrid[0:n, 0:n]
    dd = np.hypot(xx - n / 2, yy - n / 2) * ORTHO_RES
    valid = np.isfinite(img)

    def density(a, b):
        area = ((dd >= a * q["R"]) & (dd < b * q["R"]) & valid).sum() * ORTHO_RES ** 2 / 1e4
        return float(((d >= a * q["R"]) & (d < b * q["R"])).sum() / max(area, 1e-9))

    rim, bg = density(*BLOCK_RIM), density(*BLOCK_BACKGROUND)
    q["rimBlocks"], q["bgBlocks"] = rim, bg
    q["blockRatio"] = rim / max(bg, 1.0)
    q["fresh"] = (q["Dp90"] / max(q["Dp10"], 1) <= CRATER_ROUND_MAX and q["rimUplift"] >= FRESH_RIM_UPLIFT
                  and q["blockRatio"] >= FRESH_BLOCK_RATIO and rim >= FRESH_BLOCK_DENSITY)
    on_rim = (d >= BLOCK_RIM[0] * q["R"]) & (d < BLOCK_RIM[1] * q["R"])
    az = np.degrees(np.arctan2(P[on_rim, 1] - n / 2, -(P[on_rim, 0] - n / 2))) % 360
    counts = np.bincount(((az + 22.5) % 360 // 45).astype(int), minlength=8)
    q["blockyDir"] = DIRS8[int(np.argmax(counts))] if on_rim.any() else None


def young_craters(g: Grids):
    found = []
    for x, z, R0 in crater_candidates(g):
        q = crater_shape(g, x, z, R0)
        if q is None or any(math.hypot(q["x"] - p["x"], q["z"] - p["z"]) < 0.8 * max(q["R"], p["R"]) for p in found):
            continue
        found.append(q)
    keep = [q for q in found
            if CRATER_DIAMETER[0] <= q["D"] <= CRATER_DIAMETER[1] and q["depth"] >= CRATER_MIN_DEPTH
            and q["depth"] / q["D"] >= CRATER_MIN_DD and q["comp"] >= CRATER_MIN_RIM
            and math.hypot(q["x"] - g.land[0], q["z"] - g.land[1]) <= CRATER_MAX_DIST]
    rocky2 = next((a for a in g.inp.meta["features"].get("rockyAreas", []) if a["name"] == "Rocky area 2"), None)
    for q in keep:
        if rocky2 and math.hypot(rocky2["local"]["x"] - q["x"], rocky2["local"]["z"] - q["z"]) <= q["R"]:
            q.update(id="young-crater-rocky-area-2", name="Rocky area 2", rockyArea="Rocky area 2")
        freshness(g, q)
    name_by_direction(keep, g.land, "young-crater", "crater")
    feats = []
    for q in sorted(keep, key=lambda q: math.hypot(q["x"] - g.land[0], q["z"] - g.land[1])):
        dl, dp = g.cheapest(g.ring10(q["x"], q["z"], 0.8 * q["R"], 1.2 * q["R"]))
        f = g.point(q["name"], q["x"], q["z"])
        floor_drive = f.pop("driveDistanceFromLanding_m")
        f = {"id": q["id"], **f}
        f.update({
            "radius_m": round(q["R"]), "diameter_m": round(q["D"]),
            "diameterRange_m": [round(q["Dp10"]), round(q["Dp90"])],
            "depth_m": round(q["depth"], 1), "depthToDiameter": round(q["depth"] / q["D"], 3),
            "rimCompleteness": round(q["comp"], 2), "rimUplift_m": round(q["rimUplift"], 1),
            "innerWallSlope_deg": round(q["wall"], 1), "innerWallSlopeMax_deg": round(q["wallMax"], 1),
            "rimBoulderShadowsPerHa": round(q["rimBlocks"]), "backgroundBoulderShadowsPerHa": round(q["bgBlocks"]),
            "rimBlockRatio": round(q["blockRatio"], 1),
            "freshness": "fresh" if q["fresh"] else "subdued",
            "steepestWallSide": q["steepDir"], "lowestRimSide": q["lowDir"], "blockiestRimSide": q["blockyDir"],
            "driveDistanceFromLanding_m": dl,
            "drivePoint": {"x": dp[0], "z": dp[1]} if dp else None,
            "floorDriveDistance_m": floor_drive,
        })
        if q.get("rockyArea"):
            f["rockyArea"] = q["rockyArea"]
        feats.append(f)
    return feats


def rocky_area_2_description(craters):
    q = next((c for c in craters if c["id"] == "young-crater-rocky-area-2"), None)
    if q is None:
        return None
    lo, hi = q["diameterRange_m"]
    look = "a young crater with a blocky rim" if q["freshness"] == "fresh" else "an older crater"
    return (f"Crater about {round(q['diameter_m'], -1):.0f} m across ({round(lo, -1):.0f} to {round(hi, -1):.0f} m by "
            f"direction) and {q['depth_m']:.0f} m deep, {look}; its rim is lowest on the {q['lowestRimSide']} side. "
            f"Its inner wall is steepest ({q['innerWallSlopeMax_deg']:.0f} deg) on the {q['steepestWallSide']} side and "
            f"most rim blocks are on the {q['blockiestRimSide']} side; scatter boulders on its rim. Its inner wall may be "
            "too steep to drive.")


# =============================================================================
# MP2: slope targets
# =============================================================================


def knobs(g: Grids):
    out = []
    for x, z in KNOB_CANDIDATES:
        near = np.hypot(g.X - x, g.Z - z) <= 60
        i = np.unravel_index(np.argmax(np.where(near, g.ht, -np.inf)), g.ht.shape)
        sx, sz = float(g.X[i]), float(g.Z[i])
        d = np.hypot(g.X - sx, g.Z - sz)
        relief = float(g.ht[i] - g.ht[(d >= 100) & (d < 150)].mean())
        out.append({"x": sx, "z": sz, "relief": relief, "maxSlope": float(g.sl[d <= 60].max())})
    name_by_direction(out, g.land, "knob", "knob")
    return out


def slope_targets(g: Grids, craters, knob_list, foot_mask):
    target = (g.sl >= TARGET_SLOPE[0]) & (g.sl <= TARGET_SLOPE[1]) & (g.soft <= TARGET_MAX_SOFT) & g.reach5
    level = g.sl < TARGET_LEVEL
    nb = np.zeros_like(level)
    nb[1:, :] |= level[:-1, :]
    nb[:-1, :] |= level[1:, :]
    nb[:, 1:] |= level[:, :-1]
    nb[:, :-1] |= level[:, 1:]
    target &= nb
    sites = []
    for c in craters:
        sites.append({"site": c["id"], "kind": "youngCrater", "name": c["name"], "x": c["local"]["x"],
                      "z": c["local"]["z"], "radius": c["radius_m"] + TARGET_CRATER_MARGIN})
    for k in knob_list:
        sites.append({"site": k["id"], "kind": "knob", "name": k["name"], "x": k["x"], "z": k["z"],
                      "radius": KNOB_RADIUS, "knob": k})
    # Each cell belongs to the site it is nearest to, relative to the site's radius; the delta foot is its zone.
    rel = np.full(g.ht.shape, np.inf)
    owner = np.full(g.ht.shape, -1)
    for i, s in enumerate(sites):
        d = np.hypot(g.X - s["x"], g.Z - s["z"]) / s["radius"]
        better = (d <= 1) & (d < rel)
        rel[better], owner[better] = d[better], i
    sites.append({"site": "delta-foot", "kind": "deltaFoot", "name": "Delta foot"})
    owner[foot_mask & (owner < 0)] = len(sites) - 1
    out = []
    for i, s in enumerate(sites):
        m = target & (owner == i)
        lab, n = ndimage.label(m, structure=np.ones((3, 3)))
        patches = []
        for b in range(1, n + 1):
            p = lab == b
            rr, cc = np.nonzero(p)
            cx, cz = float(g.X[p].mean()), float(g.Z[p].mean())
            j = int(np.argmin(np.hypot(g.X[rr, cc] - cx, g.Z[rr, cc] - cz)))
            r, c = rr[j], cc[j]
            lv = [(r + dr, c + dc) for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1))
                  if 0 <= r + dr < g.n and 0 <= c + dc < g.n and level[r + dr, c + dc]]
            lr_, lc_ = min(lv, key=lambda t: g.sl[t])
            patches.append({"cells": int(p.sum()), "r": r, "c": c, "lr": lr_, "lc": lc_,
                            "mean": float(g.sl[p].mean()), "max": float(g.sl[p].max())})
        patches.sort(key=lambda p: -p["cells"])
        listed = []
        for p in patches[:TARGET_PATCHES_LISTED]:
            x, z = float(g.X[p["r"], p["c"]]), float(g.Z[p["r"], p["c"]])
            lx, lz = float(g.X[p["lr"], p["lc"]]), float(g.Z[p["lr"], p["lc"]])
            listed.append({"local": {"x": round(x), "z": round(z)}, "slope_deg": round(float(g.sl[p["r"], p["c"]]), 2),
                           "cells": p["cells"], "slopeMean_deg": round(p["mean"], 1), "slopeMax_deg": round(p["max"], 2),
                           "levelCell": {"x": round(lx), "z": round(lz), "slope_deg": round(float(g.sl[p["lr"], p["lc"]]), 2)},
                           "driveDistanceFromLanding_m": g.drive10(g.rc10(lx, lz))})
        e = {"id": f"slope-targets-{s['site']}", "site": s["site"], "siteKind": s["kind"], "name": s["name"],
             "cellCount": int(m.sum()), "patchCount": len(patches), "patches": listed}
        if s["kind"] != "deltaFoot":
            e["searchRadius_m"] = round(s["radius"])
        if s["kind"] == "knob":
            k = s["knob"]
            e["knob"] = g.point(s["name"], k["x"], k["z"], relief_m=round(k["relief"], 1),
                                flankSlopeMax_deg=round(k["maxSlope"], 2))
        out.append(e)
    return out


# =============================================================================
# MP3: delta foot and flood boulder
# =============================================================================


def seg_dist(px, pz, line):
    """Distance from points to a polyline [[x, z], ...]."""
    line = np.asarray(line, float)
    best = np.full(np.shape(px), np.inf)
    for (ax, az), (bx, bz) in zip(line[:-1], line[1:]):
        dx, dz = bx - ax, bz - az
        t = np.clip(((px - ax) * dx + (pz - az) * dz) / max(dx * dx + dz * dz, 1e-9), 0, 1)
        best = np.minimum(best, np.hypot(px - (ax + t * dx), pz - (az + t * dz)))
    return best


def delta_foot(g: Grids):
    df = g.inp.meta["features"]["deltaFront"]
    scarp = np.array(df["scarpLocal_xz"], float)
    fx, fz = latlon_to_local(*g.inp.three_forks, *g.inp.origin)
    r, c = g.rc(float(fx), float(fz))
    foot_level = float(np.median(g.z[r - 4:r + 5, c - 4:c + 5])) + g.inp.foot_above_floor
    if abs(foot_level - df["footContour_m"]) > 0.06:
        raise SystemExit(f"scarp-foot level {foot_level:.2f} m does not match terrain.json's {df['footContour_m']}")
    zs = ndimage.gaussian_filter(g.z, 3)
    best = None
    for cnt in find_contours(zs, foot_level):
        xy = np.stack([(cnt[:, 1] - g.h) * RES, (cnt[:, 0] - g.h) * RES], 1)
        on = seg_dist(xy[:, 0], xy[:, 1], scarp) <= 20.0  # the part the delta-front line was simplified from
        lab, n = ndimage.label(on)
        for b in range(1, n + 1):
            run = xy[lab == b]
            length = float(np.sum(np.hypot(*np.diff(run, axis=0).T)))
            if best is None or length > best[0]:
                best = (length, run)
    line = best[1]
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(line, axis=0).T))])
    dl = np.hypot(line[:, 0] - g.land[0], line[:, 1] - g.land[1])
    i0 = int(np.argmin(dl))
    a, b = i0, i0
    while s[b] - s[a] < FOOT_LENGTH and (a > 0 or b < len(line) - 1):  # grow toward the nearer neighbour
        if b == len(line) - 1 or (a > 0 and dl[a - 1] <= dl[b + 1]):
            a -= 1
        else:
            b += 1
    near = line[a:b + 1]
    simple = approximate_polygon(near, tolerance=2.0)
    zone = seg_dist(g.X, g.Z, near) <= FOOT_ZONE
    zone10 = seg_dist(g.X10, g.Z10, near) <= FOOT_ZONE
    dlz, dpz = g.cheapest(zone10)
    nx, nz = near[int(np.argmin(np.hypot(near[:, 0] - g.land[0], near[:, 1] - g.land[1])))]
    foot = {
        "name": "Delta foot",
        "description": f"The nearest {FOOT_LENGTH:.0f} m of the delta front's scarp-foot line to the landing, with a "
                       f"{FOOT_ZONE:.0f} m zone around it. Blocks fallen from the delta's layers lie at the foot.",
        "lineLocal_xz": [[round(float(p[0])), round(float(p[1]))] for p in simple],
        "length_m": round(float(s[b] - s[a])),
        "zoneRadius_m": FOOT_ZONE,
        "nearestPoint": g.point("Delta foot nearest point", float(nx), float(nz)),
        "lineDistanceFromLanding_m": [round(float(dl[a:b + 1].min())), round(float(dl[a:b + 1].max()))],
        "zoneMinDistanceFromLanding_m": round(float(g.D[zone].min())),
        "driveDistanceFromLanding_m": dlz,
        "drivePoint": {"x": dpz[0], "z": dpz[1]} if dpz else None,
        "source": "This pipeline: the HiRISE DTM contour at the scarp foot (deltaFront.footContour_m, on the game's "
                  "5 m heights), the part nearest the landing",
    }
    return foot, near, zone, foot_level, zs


def flood_boulder(g: Grids, near, foot_level, zs):
    """A spot on the lower scarp slope where a 2.5 m boulder has 12-18 deg ground on its uphill and side faces
    and ground under 10 deg within 3 m of its downhill face, outside the 1,350 m ring. Slopes are read as the
    game does (nearest 5 m sample of slope.png)."""
    xs = np.arange(near[:, 0].min() - BOULDER_MAX_UPSLOPE, near[:, 0].max() + BOULDER_MAX_UPSLOPE, 1.0)
    zz = np.arange(near[:, 1].min() - BOULDER_MAX_UPSLOPE, near[:, 1].max() + BOULDER_MAX_UPSLOPE, 1.0)
    PX, PZ = [a.ravel() for a in np.meshgrid(xs, zz)]
    keep = (seg_dist(PX, PZ, near) <= BOULDER_MAX_UPSLOPE) & (np.hypot(PX - g.land[0], PZ - g.land[1]) >= FOOT_MIN_DIST)
    PX, PZ = PX[keep], PZ[keep]
    fr, fc = PZ / RES + g.h, PX / RES + g.h
    above = ndimage.map_coordinates(zs, [fr, fc], order=1) >= foot_level  # on the scarp, not the floor
    PX, PZ, fr, fc = PX[above], PZ[above], fr[above], fc[above]
    hs = ndimage.gaussian_filter(g.ht, 1)
    gy, gx = np.gradient(hs, RES)
    ux = -ndimage.map_coordinates(gx, [fr, fc], order=1)  # downhill direction
    uz = -ndimage.map_coordinates(gy, [fr, fc], order=1)
    nrm = np.maximum(np.hypot(ux, uz), 1e-9)
    ux, uz = ux / nrm, uz / nrm

    def slope_at(x, z):
        r = np.clip(np.round(z / RES + g.h).astype(int), 0, g.n - 1)
        c = np.clip(np.round(x / RES + g.h).astype(int), 0, g.n - 1)
        return g.sl[r, c]

    rb = BOULDER_DIAMETER / 2
    ok = np.ones(len(PX), bool)
    faces = {}
    for name, (dx, dz) in (("uphill", (-ux, -uz)), ("left", (uz, -ux)), ("right", (-uz, ux))):
        vals = np.stack([slope_at(PX + dx * (rb + d), PZ + dz * (rb + d)) for d in (0.0, 1.0, 2.0)])
        ok &= (vals >= BOULDER_UPHILL[0]).all(0) & (vals <= BOULDER_UPHILL[1]).all(0)
        faces[name] = vals.mean(0)
    ds = np.arange(0.5, BOULDER_DOWNHILL_REACH + 0.01, 0.5)
    down = np.stack([slope_at(PX + ux * (rb + d), PZ + uz * (rb + d)) for d in ds])
    has_level = down < BOULDER_DOWNHILL
    ok &= has_level.any(0)
    first = np.argmax(has_level, 0)
    park_x = PX + ux * (rb + ds[first] + 1.0)  # a rover's reading spot, a meter past the level edge
    park_z = PZ + uz * (rb + ds[first] + 1.0)
    pr = np.clip(np.round(park_z / RES + g.h).astype(int), 0, g.n - 1)
    pc = np.clip(np.round(park_x / RES + g.h).astype(int), 0, g.n - 1)
    ok &= g.reach5[pr, pc] & (g.soft[pr, pc] <= TARGET_MAX_SOFT) & (g.sl[pr, pc] < BOULDER_DOWNHILL)
    if not ok.any():
        return None
    idx = np.nonzero(ok)[0]
    r10 = np.clip(np.round(park_z[idx] / g.inp.drive_res + g.h10).astype(int), 0, g.n10 - 1)
    c10 = np.clip(np.round(park_x[idx] / g.inp.drive_res + g.h10).astype(int), 0, g.n10 - 1)
    # Cheapest to reach; then the uphill face nearest 15 deg; then nearest the landing.
    key = np.lexsort((np.hypot(PX[idx] - g.land[0], PZ[idx] - g.land[1]), np.abs(faces["uphill"][idx] - 15.0),
                      np.round(g.cum[r10, c10])))
    i = idx[key[0]]
    x, z = float(PX[i]), float(PZ[i])
    r, c = g.rc(x, z)
    lat, lon = local_to_latlon(x, z, *g.inp.origin)
    return {
        "name": "Flood boulder",
        "local": {"x": round(x, 1), "y": round(float(ndimage.map_coordinates(g.ht, [[z / RES + g.h], [x / RES + g.h]],
                                                                              order=1)[0]), 2), "z": round(z, 1)},
        "latLon": [round(float(lat), 6), round(float(lon), 6)],
        "diameter_m": BOULDER_DIAMETER,
        "slope_deg": round(float(g.sl[r, c]), 2),
        "downhill": {"x": round(float(ux[i]), 3), "z": round(float(uz[i]), 3)},
        "faceSlopes_deg": {"uphill": round(float(faces["uphill"][i]), 2), "left": round(float(faces["left"][i]), 2),
                           "right": round(float(faces["right"][i]), 2),
                           "downhillWithin3m": round(float(down[:, i].min()), 2)},
        "readingSpot": {"x": round(float(park_x[i]), 1), "z": round(float(park_z[i]), 1),
                        "slope_deg": round(float(g.sl[pr[i], pc[i]]), 2)},
        "distanceFromLanding_m": round(math.hypot(x - g.land[0], z - g.land[1])),
        "distanceFromFootLine_m": round(float(seg_dist(np.array([x]), np.array([z]), near)[0])),
        "driveDistanceFromLanding_m": g.drive10((int(r10[key[0]]), int(c10[key[0]]))),
        "source": "Placed by design (no such boulder was observed here); the spot is picked by this pipeline on the "
                  "game's slope.png (nearest 5 m sample, as the game reads it)",
    }


# =============================================================================
# MP4 and MP6: Perseverance's sites and mission landmarks
# =============================================================================


def waypoints(g: Grids):
    path = fetch(g.inp.waypoints_url, RAW / "M20_waypoints.json")
    feats = json.loads(path.read_text())["features"]
    wps = [f["properties"] for f in feats if f["properties"].get("final") == "y"]
    return sorted(wps, key=lambda p: (p["sol"], p["drive"]))


def at_sol(wps, sol):
    """The rover's last end-of-drive position on or before a sol, and the sol it next moved."""
    before = [p for p in wps if p["sol"] <= sol]
    after = [p for p in wps if p["sol"] > sol]
    return before[-1], (after[0]["sol"] if after else None)


def perseverance_sites(g: Grids, wps):
    src = f"Mars 2020 rover waypoints ({g.inp.waypoints_url}); sample names, sols and dates: NASA ({SAMPLE_LIST_URL})"
    bx, bz = latlon_to_local(*g.inp.brac, *g.inp.origin)
    out = []
    for s in SAMPLE_SITES:
        sol = next(m["sol"] for m in s["samples"] if m["sol"] is not None)
        wp, moved = at_sol(wps, sol)
        x, z = (float(v) for v in latlon_to_local(wp["lat"], wp["lon"], *g.inp.origin))
        if math.hypot(x - g.land[0], z - g.land[1]) > SITES_MAX_DIST:
            continue
        f = g.point(s["name"], x, z)
        f["local"]["x"], f["local"]["z"] = round(x), round(z)  # the waypoint itself, not the 5 m sample
        f.update({"id": s["id"], "kind": s["kind"], "abrasion": s["abrasion"], "samples": s["samples"],
                  "waypoint": {"sol": wp["sol"], "rmc": wp["RMC"]},
                  "roverStayedSols": [wp["sol"], moved - 1 if moved else None], "source": src})
        if s["id"] == "brac":
            f["checkSimon2023_m"] = round(math.hypot(x - float(bx), z - float(bz)))
        out.append({"id": f.pop("id"), **f})
    return out


def mission_landmarks(g: Grids, wps):
    wp, moved = at_sol(wps, INGENUITY_DEPLOY_SOL)
    x, z = (float(v) for v in latlon_to_local(wp["lat"], wp["lon"], *g.inp.origin))
    f = g.point("Wright Brothers Field", x, z)
    f["local"]["x"], f["local"]["z"] = round(x), round(z)
    f.update({"id": "wright-brothers-field", "kind": "airfield",
              "waypoint": {"sol": wp["sol"], "rmc": wp["RMC"]},
              "note": f"The rover's position on sol {INGENUITY_DEPLOY_SOL} (April 3, 2021), when it set Ingenuity "
                      "down on the airfield from beneath its belly; Ingenuity's first flights took off within a few "
                      "meters of here. Approximate (+-10 m): not from the Ingenuity flight log.",
              "source": f"Mars 2020 rover waypoints ({g.inp.waypoints_url})"})
    return [{"id": f.pop("id"), **f}]


# =============================================================================


def site_features(inp: Inputs):
    """Returns (new feature lists, deltaFront additions, Rocky area 2's new description or None, notes)."""
    g = Grids(inp)
    craters = young_craters(g)
    foot, near, zone, foot_level, zs = delta_foot(g)
    boulder = flood_boulder(g, near, foot_level, zs)
    kn = knobs(g)
    targets = slope_targets(g, craters, kn, zone)
    wps = waypoints(g)
    sites = perseverance_sites(g, wps)
    marks = mission_landmarks(g, wps)
    fresh = [c["id"] for c in craters if c["freshness"] == "fresh"]
    log(f"Mars sites: {len(craters)} young craters ({len(fresh)} fresh: {', '.join(fresh)}), "
        f"{sum(t['patchCount'] for t in targets)} slope-target patches at {len(targets)} sites, delta foot "
        f"{foot['length_m']} m, flood boulder {'found' if boulder else 'NOT FOUND'}, {len(sites)} Perseverance sites")
    notes = [
        f"{NOTE_PREFIX} (youngCraters, slopeTargets, deltaFront.footNear, deltaFront.floodBoulder, perseveranceSites, "
        "missionLandmarks) come from game/tools/mars_sites.py, for Chieri's review. They read the game's own 5 m "
        "heights and slope.png, so a features-only run gives the same lists.",
        f"youngCraters: rim crest fitted per direction on the 5 m heights; {CRATER_DIAMETER[0]:.0f} to "
        f"{CRATER_DIAMETER[1]:.0f} m across, depth >= {CRATER_MIN_DEPTH} m and >= {CRATER_MIN_DD} x diameter, crest on "
        f">= {CRATER_MIN_RIM:.0%} of directions, center within {CRATER_MAX_DIST:.0f} m. freshness 'fresh': round "
        f"(90th/10th percentile crest radius <= {CRATER_ROUND_MAX}) and boulder shadows (compact blobs darker than "
        f"{BLOCK_DARK} x the local mean, {BLOCK_AREA[0]} to {BLOCK_AREA[1]:.0f} m^2, in the 25 cm HiRISE mosaic) on the "
        f"rim ({BLOCK_RIM[0]}-{BLOCK_RIM[1]} R) at >= {FRESH_BLOCK_DENSITY:.0f}/ha and >= {FRESH_BLOCK_RATIO:.0f} x the "
        f"{BLOCK_BACKGROUND[0]}-{BLOCK_BACKGROUND[1]} R ring, and a raised rim (rimUplift_m >= {FRESH_RIM_UPLIFT:.0f}). Every crater here has a sand-filled floor and none keeps "
        "a blocky ejecta blanket beyond its rim: 'fresh' means a sharp, round, blocky rim. driveDistanceFromLanding_m "
        "and drivePoint are for the cheapest rim cell; floorDriveDistance_m is to the center (null if the floor "
        "cannot be reached under 18 deg).",
        f"slopeTargets: 5 m cells at {TARGET_SLOPE[0]:.0f}-{TARGET_SLOPE[1]:.0f} deg in slope.png with a 4-neighbour "
        f"under {TARGET_LEVEL:.0f} deg, reachable and off the ripples, grouped (8-connected) per site: young craters "
        f"(rim radius + {TARGET_CRATER_MARGIN:.0f} m), the two knobs ({KNOB_RADIUS:.0f} m) and the delta foot zone; a "
        f"cell belongs to its nearest site. The {TARGET_PATCHES_LISTED} largest patches per site are listed; local is "
        "the target cell nearest the patch center (cells x 25 m^2 is its area), levelCell its level neighbour, and "
        "driveDistanceFromLanding_m the route to that level cell.",
        f"deltaFront.footNear: the nearest {FOOT_LENGTH:.0f} m of the scarp-foot contour, {FOOT_ZONE:.0f} m zone. "
        "deltaFront.floodBoulder is placed by design: a spot on the lower scarp slope where a "
        f"{BOULDER_DIAMETER} m boulder has {BOULDER_UPHILL[0]:.0f}-{BOULDER_UPHILL[1]:.0f} deg ground on its uphill and "
        f"side faces and ground under {BOULDER_DOWNHILL:.0f} deg within {BOULDER_DOWNHILL_REACH:.0f} m of its downhill "
        f"face (readingSpot), outside {FOOT_MIN_DIST:.0f} m from the landing.",
        f"perseveranceSites: rocks Perseverance abraded and sampled within {SITES_MAX_DIST:.0f} m, at the rover's "
        "end-of-drive waypoint for the sample sol (roverStayedSols: from that waypoint until it next moved). Names, "
        "sols and dates are from NASA's sample list and must be fact-checked again before they reach game text.",
        "missionLandmarks: Wright Brothers Field from the waypoints (approximate). The Mars 2020 backshell, parachute "
        "and descent stage are not placed: their positions need sources this pipeline does not use (HiRISE "
        "images or the Ingenuity flight log).",
    ]
    lists = {"youngCraters": craters, "slopeTargets": targets, "perseveranceSites": sites, "missionLandmarks": marks}
    delta = {"footNear": foot, "floodBoulder": boulder}
    return lists, delta, rocky_area_2_description(craters), notes


def apply(meta: dict, inp_kwargs: dict):
    """Run site_features on a terrain.json dict and add the results to it in place (only new keys, plus Rocky
    area 2's description)."""
    lists, delta, desc, notes = site_features(Inputs(meta=meta, **inp_kwargs))
    f = meta["features"]
    f["notes"] = [n for n in f["notes"] if not n.startswith(NOTE_PREFIX) and n.split(":")[0] not in
                  ("youngCraters", "slopeTargets", "deltaFront.footNear", "perseveranceSites", "missionLandmarks")]
    f["notes"] += notes
    f["deltaFront"].update(delta)
    f.update(lists)
    if desc:
        for a in f["rockyAreas"]:
            if a["name"] == "Rocky area 2":
                a["description"] = desc
    return meta
