#!/usr/bin/env python3
"""Build the Titan terrain assets (Shangri-La dunes near Selk crater) for Rover Engineer.

Titan has no rover-scale elevation model: Cassini's radar mapped the dunes and
Selk at hundreds of meters per pixel, and its altimetry and stereo topography
are sparse. So this terrain is MODELED ON Cassini data, not measured: a seeded,
reproducible generator places linear dunes, flat interdune corridors and Selk's
ejecta with the dimensions published from Cassini (every parameter below cites
its source; terrain.json repeats them). The game must say "modeled on Cassini
data", never "real elevation".

Writes web-sized PNGs plus terrain.json into game/public/terrain/titan/ in the
Mars file set, and an intermediate units file (raw/titan/units.npz, git-ignored)
for build_texture_titan.py.

Usage (from game/tools/, inside the venv):
    python build_terrain_titan.py                     # build (nothing is downloaded)
    python build_terrain_titan.py --preview out.png   # also render a preview image
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from matplotlib.path import Path as MplPath
from scipy import ndimage
from skimage.graph import MCP_Geometric
from skimage.measure import approximate_polygon, find_contours

from titan_common import (OUT, RAW, TITAN_R, curvature_drop, hillshade, latlon_to_local, local_to_latlon, log,
                          slope_deg, smooth_noise, smoothstep, write_png8, write_png16)

SEED = 2034  # Dragonfly's arrival year; any change of seed changes the whole terrain

# ---- Anchors (published positions) ---------------------------------------------
# Selk crater: IAU Gazetteer of Planetary Nomenclature, feature 14334: 7.0 N, 199.0 W (= 161.0 E), 80 km.
SELK_LATLON = (7.0, 161.0)
SELK_DIAMETER_KM = 80.0
SELK_RIM_HEIGHT_M = 200.0  # rim above the surroundings (Lorenz et al. 2021, T95 SARTopo)
SELK_FLOOR_DEPTH_M = 150.0  # floor below the surroundings, 100-200 m (Lorenz et al. 2021)
# Dragonfly delivery ellipse center (Lorenz et al. 2021): 3.72 N, 161.8 E; 148.9 x 72.0 km.
DRAGONFLY_ELLIPSE = (3.72, 161.8)
# Play-area center: this far from Selk's center on the line toward the ellipse center
# (between the ellipse and Selk, on Dragonfly's route; decided with the main session, Nov 15).
CENTER_FROM_SELK_M = 85000.0
# Selk's continuous ejecta reaches about one crater radius beyond the rim (typical of complex craters,
# Melosh 1989). Its edge is put through this local point, just north of Dune 1 at the crossing, so the
# ejecta field is a short drive from the landing (battery-only budget, ~1.5 km per mission; T3); the edge
# is then about 82.6 km from Selk's center = 1.07 radii beyond the rim.
EJECTA_EDGE_POINT = (-1300.0, -1990.0)
EJECTA_EDGE_WIDTH = 250.0  # m, half-width of the dune-to-ejecta transition

# ---- Grids ----------------------------------------------------------------------
PLAY_HALF, PLAY_RES = 4000.0, 5.0
NEAR_HALF, NEAR_RES = 25000.0, 50.0
FAR_HALF, FAR_RES = 100000.0, 200.0
SLOPE_SCALE = 4
SOFT_SCALE = 255
DRIVE_RES = 10
DRIVE_MAX_SLOPE = 18.0
EDGE_MARGIN = 200.0
EYE_HEIGHT = 1.7
CREST_ZONE_RADIUS = 70.0  # m around a crest line counts as "on the crest" (Dune sea photo)
SOFT_CELL = 150.0  # m: the circle cover of soft sand, one circle per cell (as Mars)

# ---- Dune parameters (Cassini) ---------------------------------------------------
# Radebaugh et al. 2008: Titan's linear dunes run west-east, mean width 1 km (typically 1-2 km),
# crest spacing 1-4 km (mean ~3 km in the T3 swath, ~2 km globally), heights 100-150 m by radar
# clinometry (flank slopes ~10 deg), mean length 16 km. Lorenz et al. 2021: the dunes near the
# Dragonfly site are flanked by wide, shallow plinths, and the interdunes are flat and sand-free.
# Play dunes use: base width (core) 1.3 km, crest height 75-100 m, spacing 2.6-2.8 km.
CORE_PLINTH_RATIO = 1.8  # plinth half-width as a multiple of the core half-width
PLINTH_SHARE = 0.10  # plinth height as a share of the crest height
# Peak softness of loose crest sand. With the Moon's ground tuning, 0.85 gives a reference rover 16% slip
# on flat loose sand, 20% (the stuck limit) climbing straight up a 14 deg loose flank: careful or diagonal
# climbs work, careless straight ones bog down.
LOOSE_SAND = 0.85
UNION_K = 30.0  # m: blend width where two dunes merge
VIEW_MAX_SLIP = 0.18  # the Dune sea viewpoint must be reachable with wheel slip below this (Moon limit 0.2)
VIEW_DRIVE_M = (850, 1050)
CORRIDOR_INSET_M = 70.0  # crossing start and end lie at least this far inside their corridor mask  # drive distance to the Dune sea viewpoint (battery-only budget, T3)


@dataclass
class Dune:
    name: str
    z0: float  # crest z at x = 0 (local, m)
    H: float  # crest height (m)
    W: float  # core half-width (m): the dune core is 2W wide at its base
    xa: float  # west end of the crest line
    xb: float  # east end
    tip: float = 1500.0  # height tapers to 0 over this length at each end
    slope: float = 0.0  # dz/dx of the mean crest line (0 = due west-east)
    meander: list = field(default_factory=list)  # [(amplitude m, wavelength m, phase)]
    hmod: list = field(default_factory=list)  # [(fraction, wavelength m, phase)]
    wmod: tuple = (0.0, 5000.0, 0.0)
    saddle: tuple | None = None  # (x, depth fraction, width m): a low, firmer saddle
    soft_max: float = LOOSE_SAND

    def crest(self, x):
        z = self.z0 + self.slope * x
        dz = np.full_like(np.asarray(x, dtype=float), self.slope)
        for a, lam, ph in self.meander:
            k = 2 * math.pi / lam
            z = z + a * np.sin(k * x + ph)
            dz = dz + a * k * np.cos(k * x + ph)
        return z, dz

    def height(self, x):
        h = np.full_like(np.asarray(x, dtype=float), self.H)
        for f, lam, ph in self.hmod:
            h = h * (1 + f * np.sin(2 * math.pi * x / lam + ph))
        h = h * smoothstep(self.xa, self.xa + self.tip, x) * smoothstep(self.xb, self.xb - self.tip, x)
        return h * self.saddle_factor(x)

    def saddle_factor(self, x):
        if not self.saddle:
            return 1.0
        xs, depth, w = self.saddle
        return 1 - depth * np.exp(-(((x - xs) / w) ** 2))

    def width(self, x):
        a, lam, ph = self.wmod
        return self.W * (1 + a * np.sin(2 * math.pi * x / lam + ph))

    def eval(self, X, Z):
        """Height, core fraction (0..1, 1 at the crest) and sand softness on a grid."""
        x = X[0] if X.ndim == 2 else X
        cz, dz = self.crest(x)
        H, W = self.height(x), self.width(x)
        cosa = 1 / np.sqrt(1 + dz * dz)
        u = (Z - cz) * cosa / W
        au = np.abs(u)
        core = np.where(au < 1, 0.8 * (1 - u * u) ** 2 + 0.2 * (1 - np.minimum(au, 1)) ** 2, 0.0)
        up = u / CORE_PLINTH_RATIO
        plinth = np.where(np.abs(up) < 1, PLINTH_SHARE * (1 - up * up) ** 2, 0.0)
        h = H * (core + plinth)
        # Loose sand on the upper flanks and crest, firmer lower flanks, firm plinths (Lorenz et al. 2021).
        sf = self.saddle_factor(x)
        soft_scale = self.soft_max * (1 - 0.65 * (1 - sf) / max(1e-6, (self.saddle or (0, 1, 1))[1]))
        soft = smoothstep(0.12, 0.6, core) * np.clip(soft_scale, 0, 1) * smoothstep(8, 30, H)
        return h, core * smoothstep(5, 25, H), soft


def play_dunes():
    """The dunes that cross the play area (hand-placed rows, Cassini dimensions)."""
    return [
        # D1: the last dune before Selk's ejecta, smaller than the others: dunes taper toward Selk
        # (Radebaugh et al. 2008; Lorenz et al. 2021). It bends about 11 deg to run along the ejecta edge
        # (dunes divert along obstacles). A low saddle at x = -1300 is the crossing route (linear dunes
        # have low, firmer saddles and junctions along their crests). Its crest is the Dune sea viewpoint.
        Dune("Dune 1", z0=-1800, H=50, W=380, xa=-16000, xb=11000, slope=-0.2,
             meander=[(60, 7300, 0.4), (25, 2600, 2.0)],
             hmod=[(0.10, 4100, 1.1)], wmod=(0.06, 5300, 0.3), saddle=(-1300, 0.5, 300)),
        # D2: the big dune south of the landing corridor.
        Dune("Dune 2", z0=700, H=95, W=660, xa=-20000, xb=14000, meander=[(130, 8100, 2.2), (40, 2900, 0.7)],
             hmod=[(0.10, 5200, 4.0)], wmod=(0.08, 6100, 1.7)),
        # Branch: a younger dune joining Dune 2 from the west-southwest (a Y-junction, common in
        # Titan's dune fields; Radebaugh et al. 2008, Lorenz et al. 2006).
        Dune("Branch", z0=1320, H=55, W=450, xa=-9500, xb=2000, tip=1300, slope=-0.245,
             meander=[(50, 3700, 1.3)], hmod=[(0.10, 3100, 0.2)]),
        # D3: the next dune south; only its northern flank is on the map.
        Dune("Dune 3", z0=3300, H=100, W=700, xa=-18000, xb=20000, meander=[(120, 9000, 5.1), (35, 2700, 3.3)],
             hmod=[(0.12, 4700, 2.5)]),
    ]


def ring_dunes(rng, half):
    """More rows of dunes for the distant rings (seeded), spaced 2.2-3.4 km, 8-30 km long."""
    out = []
    rows = []
    z = -1800.0
    while z > -half - 3000:
        z -= rng.uniform(2200, 3400)
        rows.append(z)
    z = 3300.0
    while z < half + 3000:
        z += rng.uniform(2200, 3400)
        rows.append(z)
    for i, z0 in enumerate(rows):
        x = -half - rng.uniform(0, 15000)
        while x < half:
            length = rng.uniform(8000, 30000)
            out.append(Dune(f"ring {i}", z0=z0 + rng.uniform(-300, 300), H=rng.uniform(70, 120),
                            W=rng.uniform(550, 750), xa=x, xb=x + length, tip=2000,
                            meander=[(rng.uniform(60, 150), rng.uniform(6000, 10000), rng.uniform(0, 6.3))]))
            x += length + rng.uniform(500, 3000)
    return out


def dune_union(dunes, X, Z):
    h = np.zeros_like(X)
    core = np.zeros_like(X)
    soft = np.zeros_like(X)
    for d in dunes:
        hd, cd, sd = d.eval(X, Z)
        # Smooth union where two dunes overlap (a Y-junction), plain max elsewhere.
        k = np.minimum(UNION_K, 2 * np.minimum(h, hd)) + 1e-9
        w = np.clip(0.5 + 0.5 * (hd - h) / k, 0, 1)
        h = h + (hd - h) * w + k * w * (1 - w)
        core = np.maximum(core, cd)
        soft = np.maximum(soft, sd)
    return h, core, soft


def selk_profile(s):
    """Height (m) of Selk's crater and ejecta above the surroundings, by distance from its center."""
    R0 = SELK_DIAMETER_KM * 500.0
    s = np.asarray(s, dtype=float)
    inner = -SELK_FLOOR_DEPTH_M + (SELK_RIM_HEIGHT_M + SELK_FLOOR_DEPTH_M) * smoothstep(0.7 * R0, R0, s)
    outer = SELK_RIM_HEIGHT_M * (R0 / np.maximum(s, R0)) ** 3
    return np.where(s < R0, inner, outer)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--preview", type=Path)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)

    # ---- 1. Frame ---------------------------------------------------------------
    ex, ez = latlon_to_local(*DRAGONFLY_ELLIPSE, *SELK_LATLON)
    ux, uz = float(ex) / math.hypot(ex, ez), float(ez) / math.hypot(ex, ez)
    lat0, lon0 = (float(v) for v in local_to_latlon(ux * CENTER_FROM_SELK_M, uz * CENTER_FROM_SELK_M, *SELK_LATLON))
    O = (lat0, lon0)
    sx, sz = (float(v) for v in latlon_to_local(*SELK_LATLON, *O))
    selk_dist = math.hypot(sx, sz)
    selk_bearing = math.degrees(math.atan2(sx, -sz)) % 360
    ell_x, ell_z = (float(v) for v in latlon_to_local(*DRAGONFLY_ELLIPSE, *O))
    log(f"origin {lat0:.4f} N {lon0:.4f} E; Selk center {selk_dist / 1000:.1f} km at azimuth {selk_bearing:.0f}; "
        f"ellipse center {math.hypot(ell_x, ell_z) / 1000:.1f} km away")
    r_edge = math.hypot(EJECTA_EDGE_POINT[0] - sx, EJECTA_EDGE_POINT[1] - sz)

    def ejecta_weight(X, Z):
        s = np.hypot(X - sx, Z - sz)
        th = np.arctan2(X - sx, Z - sz) * selk_dist  # arc length along the edge (m)
        wob = 120 * np.sin(th / 2900 + 1.0) + 80 * np.sin(th / 1100 + 2.5)
        return smoothstep(r_edge + EJECTA_EDGE_WIDTH, r_edge - EJECTA_EDGE_WIDTH, s - wob), s

    dunes = play_dunes()
    extra = ring_dunes(rng, FAR_HALF)

    def surface(X, Z, res, dune_list, rng_, fine=True):
        """Heights above the local datum (no curvature), dune core fraction, softness, ejecta weight."""
        e, s = ejecta_weight(X, Z)
        hd, core, soft = dune_union(dune_list, X, Z)
        shape = X.shape
        inter = 1.2 * smooth_noise(rng_, shape, 150 / res) if 150 / res >= 1 else 0
        hum = 4.0 * smooth_noise(rng_, shape, max(1.0, 250 / res))
        if fine:
            hum = hum + 1.8 * smooth_noise(rng_, shape, 50 / res)
            inter = inter + 0.25 * smooth_noise(rng_, shape, 20 / res) + 0.15 * smooth_noise(rng_, shape, 3 / res) * core
        h = selk_profile(s) + (1 - e) * (hd + inter) + e * hum
        return h, core * (1 - e), soft * (1 - e), e

    # ---- 2. Play area -------------------------------------------------------------
    N = int(round(2 * PLAY_HALF / PLAY_RES)) + 1
    hN = N // 2
    yy, xx = np.mgrid[0:N, 0:N]
    gx, gz = (xx - hN) * PLAY_RES, (yy - hN) * PLAY_RES
    z_w, core_w, soft_w, ej_w = surface(gx.astype(float), gz.astype(float), PLAY_RES, dunes,
                                        np.random.default_rng(SEED + 1))
    datum = float(selk_profile(selk_dist))
    z_w -= datum  # 0 = the interdune floor level at the origin (Titan has no usable geoid here)
    sl_w = slope_deg(z_w, PLAY_RES)
    ht_w = z_w - curvature_drop(gx, gz)
    soft_w = ndimage.gaussian_filter(soft_w, 1.0)
    log(f"play heights {z_w.min():.1f}..{z_w.max():.1f} m, max slope {sl_w.max():.1f} deg, "
        f"p99.9 {np.percentile(sl_w, 99.9):.1f} deg, soft (>0.5) {np.mean(soft_w > 0.5):.1%}")

    def rc(x, z, res=PLAY_RES, half_n=hN):
        return int(round(z / res + half_n)), int(round(x / res + half_n))

    # ---- 3. Drive grid (10 m) -------------------------------------------------------
    k = DRIVE_RES // int(PLAY_RES)
    z10 = ndimage.gaussian_filter(z_w, 0.5 * k)[::k, ::k]
    soft10 = soft_w[::k, ::k]
    n10 = z10.shape[0]
    h10 = n10 // 2
    s10 = slope_deg(z10, DRIVE_RES)
    # Slope cost as on Mars, plus a mild penalty for loose sand so routes prefer firm ground.
    cost = 1.0 + 2.0 * (s10 / DRIVE_MAX_SLOPE) ** 2 + 1.5 * soft10
    cost[s10 > DRIVE_MAX_SLOPE] = np.inf
    m = int(EDGE_MARGIN / DRIVE_RES) // 2
    cost[:m, :] = cost[-m:, :] = np.inf
    cost[:, :m] = cost[:, -m:] = np.inf
    yy10, xx10 = np.mgrid[0:n10, 0:n10]
    x10, z10g = (xx10 - h10) * DRIVE_RES, (yy10 - h10) * DRIVE_RES

    def rc10(x, z):
        return rc(x, z, DRIVE_RES, h10)

    # ---- 4. Landing: the flattest firm spot in the corridor between Dune 1 and Dune 2 ---------------
    target = (-1300.0, -1000.0)
    mean75 = ndimage.uniform_filter(sl_w, 15)
    max45 = ndimage.maximum_filter(sl_w, 9)
    near_dune = ndimage.maximum_filter(core_w, 61) > 0.02  # within 150 m of any dune core
    cand = (mean75 <= 1.5) & (max45 <= 4.0) & (soft_w < 0.01) & ~near_dune & (ej_w < 0.01)
    d_t = np.hypot(gx - target[0], gz - target[1])
    score = np.where(cand, mean75 + d_t / 400.0, np.inf)
    lr, lc = np.unravel_index(np.argmin(score), score.shape)
    land_x, land_z = float(gx[lr, lc]), float(gz[lr, lc])
    log(f"landing at local ({land_x:.0f}, {land_z:.0f}), mean slope {mean75[lr, lc]:.2f} deg")

    mcp = MCP_Geometric(cost)
    cum, _ = mcp.find_costs([rc10(land_x, land_z)])
    reach = np.isfinite(cum)
    paths = {}

    def trace(x, z):
        t = rc10(x, z)
        if not np.isfinite(cum[t]):
            return None
        return np.array(mcp.traceback(t))

    def path_len(path):
        return round(float(np.sum(np.hypot(*np.diff(path, axis=0).T)) * DRIVE_RES))

    def site(name, x, z, source, **extra_):
        r, c = rc(x, z)
        lat, lon = local_to_latlon(x, z, *O)
        p = trace(x, z)
        if p is not None:
            paths[name] = p
        f = {
            "name": name,
            "local": {"x": round(x), "y": round(float(ht_w[r, c]), 2), "z": round(z)},
            "latLon": [round(float(lat), 5), round(float(lon), 5)],
            "elevation_m": round(float(z_w[r, c]), 1),
            "slope_deg": round(float(s10[rc10(x, z)]), 1),
            "distanceFromLanding_m": round(math.hypot(x - land_x, z - land_z)),
            "driveDistanceFromLanding_m": None if p is None else path_len(p),
            "source": source,
        }
        f.update(extra_)
        return f

    landing = site("Landing", land_x, land_z,
                   "Picked by this pipeline: the flattest firm interdune spot (no sand, 150 m from any dune) in "
                   "the corridor between Dune 1 and Dune 2. Interdunes are where Dragonfly will land "
                   "(Lorenz et al. 2021)")
    for key in ("distanceFromLanding_m", "driveDistanceFromLanding_m"):
        landing.pop(key)
    landing["slope_deg_75m_mean"] = round(float(mean75[lr, lc]), 2)

    def nearest_ok(x, z, ok, radius):
        d = np.hypot(x10 - x, z10g - z)
        cand_ = ok & (d <= radius) & reach
        if not cand_.any():
            raise SystemExit(f"no suitable spot within {radius} m of ({x:.0f}, {z:.0f})")
        i = np.unravel_index(np.argmin(np.where(cand_, d, np.inf)), d.shape)
        return float(x10[i]), float(z10g[i])

    def unit(dx, dz):
        n_ = math.hypot(dx, dz)
        return {"x": round(dx / n_, 3), "z": round(dz / n_, 3)}

    # Wheel slip along a route (Moon tuning: reference mass and grip, slipLimit 0.2).
    def slip_along(path):
        xz = np.stack([(path[:, 1] - h10) * DRIVE_RES, (path[:, 0] - h10) * DRIVE_RES], 1).astype(float)
        hz = z10[path[:, 0], path[:, 1]]
        dist = np.hypot(*np.diff(xz, axis=0).T)
        up = np.degrees(np.arctan2(np.diff(hz), np.maximum(dist, 1e-6)))
        up = ndimage.uniform_filter1d(up, 3)
        sft = soft10[path[1:, 0], path[1:, 1]]
        sink = 1.5 + (6.0 - 1.5) * sft
        return float(np.max(sink * 0.03 + 0.01 * np.maximum(0, up - 10))) if up.size else 0.0

    # ---- 5. Features ------------------------------------------------------------------
    core10 = core_w[::k, ::k]
    ej10 = ej_w[::k, ::k]
    firm10 = (soft10 < 0.02) & (core10 < 0.03)

    # Interdune corridors: connected firm, dune-free ground (the ejecta plain joins the north corridor).
    corridor_mask = (ndimage.maximum_filter(core_w, 5) < 0.03)
    lab, nlab = ndimage.label(corridor_mask)
    sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, nlab + 1))
    big = [i + 1 for i in np.argsort(sizes)[::-1] if sizes[i] * PLAY_RES ** 2 > 0.3e6]
    names = {}
    land_lab = lab[lr, lc]
    corridors = []
    for li in big:
        ys, xs_ = np.nonzero(lab == li)
        zc = (ys.mean() - hN) * PLAY_RES
        xc = (xs_.mean() - hN) * PLAY_RES
        if li == land_lab:
            nm = "Landing corridor"
        elif ej_w[lab == li].mean() > 0.2:
            nm = "North corridor and Selk ejecta"
        elif zc > 1300 and xc < 0 and zc < 2600:
            nm = "Wedge corridor"
        else:
            nm = "South corridor"
        if nm in names.values():
            nm = f"{nm} {sum(v.startswith(nm) for v in names.values()) + 1}"
        names[li] = nm
        msk = np.pad(lab == li, 1)[::4, ::4]
        cs = find_contours(msk.astype(float), 0.5)
        outer = max(cs, key=len)
        poly = approximate_polygon(outer, tolerance=1.5)
        pts = [[round(float((c * 4 - 1 - hN) * PLAY_RES)), round(float((r * 4 - 1 - hN) * PLAY_RES))] for r, c in poly]
        pts = [[min(max(p[0], -PLAY_HALF), PLAY_HALF), min(max(p[1], -PLAY_HALF), PLAY_HALF)] for p in pts]
        if pts[0] == pts[-1]:
            pts = pts[:-1]
        center = []
        for xcol in np.arange(-PLAY_HALF + 250, PLAY_HALF, 500):
            col = int(round(xcol / PLAY_RES + hN))
            rows = np.nonzero(lab[:, col] == li)[0]
            if rows.size > 20:
                center.append([round(float(xcol)), round(float((rows.mean() - hN) * PLAY_RES))])
        corridors.append({"name": nm, "outlineLocal_xz": pts, "centerLocal_xz": center,
                          "area_km2": round(float(sizes[li - 1]) * PLAY_RES ** 2 / 1e6, 2)})
    log("corridors: " + ", ".join(f"{c['name']} {c['area_km2']} km2" for c in corridors))

    # Dune crest lines (on the map, where the dune stands at least 15 m).
    lines = []
    for d in dunes:
        xs = np.arange(-PLAY_HALF, PLAY_HALF + 1, 50.0)
        cz, _ = d.crest(xs)
        e_, _ = ejecta_weight(xs, cz)
        Hx = d.height(xs) * (1 - e_)
        ok = (Hx >= 15) & (np.abs(cz) <= PLAY_HALF)
        if not ok.any():
            continue
        segs = np.split(np.arange(xs.size), np.nonzero(np.diff(ok.astype(int)))[0] + 1)
        for seg in segs:
            if not ok[seg[0]] or seg.size < 4:
                continue
            pl = np.stack([xs[seg], cz[seg]], 1)
            pl = approximate_polygon(pl, tolerance=5)
            lines.append({"name": d.name, "crestLocal_xz": [[round(float(a)), round(float(b))] for a, b in pl],
                          "height_m": round(float(Hx[seg].max())), "width_m": round(float(2 * d.W)),
                          "heightRange_m": [round(float(Hx[seg].min())), round(float(Hx[seg].max()))]})
    dune_crests = {
        "description": "Linear dunes running roughly west to east, with flat, firm interdune corridors between "
                       "them. Each line is a dune crest; within zoneRadius_m of a line counts as on the crest. "
                       "Crests are loose sand (soft ground); the lower flanks and wide plinths are firmer. Dune 1, "
                       "the smallest, bends to about 80 deg to run along the edge of Selk's ejecta.",
        "orientation_deg": 90,
        "zoneRadius_m": CREST_ZONE_RADIUS,
        "lines": lines,
        "source": "Modeled on Cassini RADAR dune measurements: west-east orientation, widths 1-2 km, spacing 1-4 km, "
                  "heights 100-150 m, flank slopes ~10 deg (Radebaugh et al. 2008, Icarus 194; Lorenz et al. 2006, "
                  "Science 312); plinths and sand-free interdunes near the Dragonfly site (Lorenz et al. 2021, PSJ 2:24). "
                  "Positions are generated (seed %d), not mapped: no rover-scale topography of Titan exists." % SEED,
    }

    # Crossing route: over Dune 1's saddle, from the landing corridor to the north corridor.
    d1 = dunes[0]
    xs_ = d1.saddle[0]
    cz, _ = d1.crest(np.array([xs_]))
    crest_pt = nearest_ok(xs_, float(cz[0]), np.ones_like(firm10), 60)
    # Both ends sit well inside their corridor (the outlines are simplified by up to ~30 m; T5 needs >= 30 m).
    deep10 = (ndimage.distance_transform_edt(lab > 0) * PLAY_RES)[::k, ::k] >= CORRIDOR_INSET_M
    south_ok = firm10 & deep10 & (z10g > crest_pt[1]) & (lab[::k, ::k] == land_lab)
    north_ok = firm10 & deep10 & (z10g < crest_pt[1])
    from_pt = nearest_ok(crest_pt[0], crest_pt[1] + 400, south_ok, 1500)
    to_pt = nearest_ok(crest_pt[0], crest_pt[1] - 400, north_ok, 1500)
    for pt in (from_pt, to_pt):
        owner = next(c for c in corridors if c["name"] == names[lab[rc(*pt)]])
        ring_ = MplPath(np.array(owner["outlineLocal_xz"], dtype=float))
        probe = [(pt[0] + 30 * math.cos(a), pt[1] + 30 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 16)]
        if not ring_.contains_points([pt, *probe]).all():
            raise SystemExit(f"crossing point {pt} is less than 30 m inside {owner['name']}'s outline")
    mcp2 = MCP_Geometric(cost)
    mcp2.find_costs([rc10(*from_pt)])
    leg1 = np.array(mcp2.traceback(rc10(*crest_pt)))
    mcp3 = MCP_Geometric(cost)
    mcp3.find_costs([rc10(*crest_pt)])
    leg2 = np.array(mcp3.traceback(rc10(*to_pt)))
    route = np.vstack([leg1, leg2[1:]])
    route_xz = np.stack([(route[:, 1] - h10) * DRIVE_RES, (route[:, 0] - h10) * DRIVE_RES], 1).astype(float)
    route_slope = float(s10[route[:, 0], route[:, 1]].max())
    route_soft = float(soft10[route[:, 0], route[:, 1]].max())
    paths["crossing"] = route
    crossing = {
        "name": "Dune 1 saddle crossing",
        "description": "The easiest way over Dune 1: a low saddle in its crest with firmer sand. It leads from the "
                       "landing corridor to the north side, where Selk's ejecta begins.",
        "fromCorridor": site("Crossing start", *from_pt, "Firm interdune ground at the foot of Dune 1's saddle"),
        "crestPoint": site("Dune 1 saddle", *crest_pt, "Lowest point of Dune 1's crest near the landing "
                           "(generated; linear dunes have saddles and junctions along their crests)"),
        "toCorridor": site("Crossing end", *to_pt, "Firm ground north of Dune 1, at the edge of Selk's ejecta"),
        "pathLocal_xz": [[round(float(a)), round(float(b))] for a, b in approximate_polygon(route_xz, tolerance=8)],
        "maxSlope_deg": round(route_slope, 1),
        "maxSoftness": round(route_soft, 2),
        "source": "Least-cost route on the 10 m drive grid (slope and loose-sand cost) over the generated terrain",
    }

    # Dune sea viewpoint: the highest point of Dune 1's crest that a careful driver reaches (wheel slip below
    # VIEW_MAX_SLIP on the least-cost route) in VIEW_DRIVE_M of driving. It looks south over the dune field.
    xs = np.arange(-PLAY_HALF + 300, PLAY_HALF - 300, 20.0)
    cz, dzx = d1.crest(xs)
    cands = []
    for x_, z_, g_ in zip(xs, cz, dzx):
        r_, c_ = rc10(x_, z_)
        if not reach[r_, c_] or abs(x_ - xs_) < 400:
            continue
        p_ = trace(x_, z_)
        if VIEW_DRIVE_M[0] <= path_len(p_) <= VIEW_DRIVE_M[1]:
            cands.append((float(z10[r_, c_]), float(x_), float(z_), float(g_)))
    best = None
    for hgt, x_, z_, g_ in sorted(cands, reverse=True):
        if slip_along(trace(x_, z_)) <= VIEW_MAX_SLIP:
            best = (hgt, x_, z_, g_)
            break
    if best is None:
        raise SystemExit("no Dune 1 crest point is reachable within the slip limit and drive range")
    vx, vz = nearest_ok(best[1], best[2], np.ones_like(firm10), 40)
    look = unit(-best[3], 1.0)  # perpendicular to the crest, toward the south
    viewpoint = site("Dune sea viewpoint", vx, vz,
                     "Picked by this pipeline: the highest point of Dune 1's crest reached with care in "
                     f"{VIEW_DRIVE_M[0]}-{VIEW_DRIVE_M[1]} m of driving", kind="duneCrest", lookToward=look)
    viewpoint["note"] = ("Looks south across the landing corridor to Dune 2, the branch dune and Dune 3; the crest "
                         f"is {viewpoint['elevation_m'] - landing['elevation_m']:.0f} m above the landing. Selk's "
                         "ejecta lies behind, to the north.")

    # Bright interdune sample patch: sand-free flat in the landing corridor, 500-800 m east of the landing.
    flat10 = firm10 & (s10 < 2) & (ndimage.maximum_filter(core10, 21) < 0.02) & (lab[::k, ::k] == land_lab)
    d_land = np.hypot(x10 - land_x, z10g - land_z)
    cand_ = flat10 & reach & (d_land > 500) & (d_land < 800) & (x10 > land_x)
    i = np.unravel_index(np.argmin(np.where(cand_, np.abs(z10g - land_z), np.inf)), cand_.shape)
    sample = site("Bright interdune patch", float(x10[i]), float(z10g[i]),
                  "Placed by this pipeline in the landing corridor. Interdunes near the Dragonfly site are "
                  "bright, sand-free flats (Cassini ISS/VIMS and RADAR; Lorenz et al. 2021)",
                  radius_m=90, description="A bright, sand-free interdune flat: firm ground, with organic sand "
                  "blown in from the dunes. A good first drill site.")

    # Selk ejecta field: block-strewn ejecta just past Dune 1 (the farthest goal), centered where the
    # ejecta is complete (weight > 0.97) nearest to 700 m north of the saddle.
    ej_ok = (ej10 > 0.97) & (s10 < 8)
    ex_, ez_ = nearest_ok(crest_pt[0], crest_pt[1] - 700, ej_ok, 1200)
    rocky = [site("Selk ejecta field", ex_, ez_,
                  "Selk's ejecta blanket is intact, rough and radar-bright, rich in water ice (Lorenz et al. 2021; "
                  "Cassini RADAR and radiometry); the block field itself is generated",
                  radius_m=200, description="Blocks and rough ground thrown out by the Selk impact, at the outer "
                  "edge of its ejecta blanket, about %d km from the rim. Water ice and organics may have mixed "
                  "here when the crater formed." % round((math.hypot(ex_ - sx, ez_ - sz) - SELK_DIAMETER_KM * 500) / 1000))]

    # Soft ground: circle cover of the loose sand (softness >= 0.6), one circle per 150 m cell (as on Mars).
    cell = int(SOFT_CELL / PLAY_RES)
    areas = []
    loose = soft_w >= 0.6
    for r0 in range(0, N - 1, cell):
        for c0 in range(0, N - 1, cell):
            blk = loose[r0:r0 + cell, c0:c0 + cell]
            frac = blk.mean()
            if frac < 0.15:
                continue
            rr, cc = np.nonzero(blk)
            x_ = float((c0 + cc.mean() - hN) * PLAY_RES)
            z_ = float((r0 + rr.mean() - hN) * PLAY_RES)
            areas.append({"name": f"Dune sand {len(areas) + 1}", "local": {"x": round(x_), "z": round(z_)},
                          "radius_m": round(SOFT_CELL * math.sqrt(frac / math.pi))})
    soft_ground = {
        "description": "Dune sand. soft-ground.png is the real mask and is graded: loose crest and upper-flank "
                       "sand 0.85, lower flanks 0.3-0.6, plinths and interdunes 0, and Dune 1's saddle at most "
                       "about 0.4. These circles cover only the loose sand (softness >= 0.6), one per 150 m cell "
                       "(circle area = loose area in the cell), for the circle-based softness rule.",
        "maskIsAuthoritative": True,
        "areas": areas,
        "source": "Generated with the dunes. Loose crest sand and firm plinths and interdunes follow Lorenz et al. "
                  "2021 (Dragonfly landing site); the Moon's sinkage and slip rules apply",
    }
    log(f"soft circles: {len(areas)}")

    selk = {
        "name": "Selk",
        "description": "Impact crater about 80 km across. Its rim stands only about 200 m above the plains and its "
                       "floor 100-200 m below; liquid water from the impact may have mixed with organics there. "
                       "Dragonfly will fly toward it.",
        "centerLatLon": list(SELK_LATLON),
        "centerLocal": {"x": round(sx), "z": round(sz)},
        "diameter_km": SELK_DIAMETER_KM,
        "rimHeight_m": SELK_RIM_HEIGHT_M,
        "bearingFromLanding_deg": round(math.degrees(math.atan2(sx - land_x, -(sz - land_z))) % 360, 1),
        "distanceFromLanding_km": round(math.hypot(sx - land_x, sz - land_z) / 1000, 1),
        "source": "IAU Gazetteer of Planetary Nomenclature (Selk, 7.0 N 199.0 W, 80 km); rim height, floor depth "
                  "and ejecta: Lorenz et al. 2021 (T95 SARTopo, Cassini RADAR)",
    }

    # ---- 6. Distant terrain ---------------------------------------------------------------
    def ring(half, res, seed):
        n = int(round(2 * half / res)) + 1
        yy_, xx_ = np.mgrid[0:n, 0:n]
        X = ((xx_ - n // 2) * res).astype(float)
        Z = ((yy_ - n // 2) * res).astype(float)
        h, _, _, _ = surface(X, Z, res, dunes + extra, np.random.default_rng(seed), fine=False)
        h -= datum
        if res > 100:
            h = ndimage.gaussian_filter(h, 0.6)
        inside = (np.abs(X) <= PLAY_HALF) & (np.abs(Z) <= PLAY_HALF)
        hv = ndimage.map_coordinates(z_w, [Z[inside] / PLAY_RES + hN, X[inside] / PLAY_RES + hN], order=1)
        h[inside] = hv
        return h - curvature_drop(X, Z)

    near_t = ring(NEAR_HALF, NEAR_RES, SEED + 2)
    far_t = ring(FAR_HALF, FAR_RES, SEED + 3)

    def horizon(x, z, az_deg, eye=EYE_HEIGHT):
        e0 = float(ht_w[rc(x, z)]) + eye
        az = np.radians(np.asarray(az_deg, dtype=float))
        out = np.full(az.shape, -90.0)
        for arr, half, res, d0, d1, step in ((ht_w, PLAY_HALF, PLAY_RES, 10, 5600, 5),
                                             (near_t, NEAR_HALF, NEAR_RES, 3000, 24900, 25),
                                             (far_t, FAR_HALF, FAR_RES, 20000, 99000, 100)):
            d = np.arange(d0, d1, step, dtype=float)
            px = x + np.outer(np.sin(az), d)
            pz = z - np.outer(np.cos(az), d)
            ins = (np.abs(px) <= half) & (np.abs(pz) <= half)
            hv = ndimage.map_coordinates(arr, [(pz + half) / res, (px + half) / res], order=1, mode="nearest")
            ang = np.where(ins, np.degrees(np.arctan2(hv - e0, d[None, :])), -90)
            out = np.maximum(out, ang.max(axis=1))
        return out

    hz_land = horizon(land_x, land_z, np.arange(360))

    # Is Selk's rim above the local horizon from the viewpoint? (rim sector, far ring only vs. everything)
    def rim_check(x, z):
        az = np.arange(int(selk_bearing) - 20, int(selk_bearing) + 21)
        e0 = float(ht_w[rc(x, z)]) + EYE_HEIGHT
        d = np.arange(20000, 99000, 100.0)
        a = np.radians(az)
        px, pz = x + np.outer(np.sin(a), d), z - np.outer(np.cos(a), d)
        hv = ndimage.map_coordinates(far_t, [(pz + FAR_HALF) / FAR_RES, (px + FAR_HALF) / FAR_RES], order=1,
                                     mode="nearest")
        rim = np.degrees(np.arctan2(hv - e0, d)).max(axis=1)
        return float((rim - horizon(x, z, az)).max()), float(rim.max())

    rim_land = rim_check(land_x, land_z)
    rim_view = rim_check(vx, vz)
    log(f"Selk rim vs horizon: landing {rim_land[0]:+.2f} deg, viewpoint {rim_view[0]:+.2f} deg "
        f"(rim angle {rim_view[1]:+.2f})")

    # ---- 7. Gameplay check: wheel slip along the routes (Moon tuning, reference mass and grip) ------
    # Straight up Dune 2's steepest loose flank (the "careless" climb).
    flank_slip = float(np.max(np.where(soft10 > 0.7, (1.5 + 4.5 * soft10) * 0.03 + 0.01 * np.maximum(0, s10 - 10), 0)))

    # ---- 8. Sites and logs -------------------------------------------------------------------
    for f in (sample, viewpoint, crossing["crestPoint"], crossing["toCorridor"], *rocky):
        sl = slip_along(paths[f["name"]]) if f["name"] in paths else float("nan")
        log(f"{f['name']:<24} straight {f['distanceFromLanding_m']:>5} m, drive {f['driveDistanceFromLanding_m']} m, "
            f"max slip on route {sl:.3f}")
    log(f"crossing route: max slope {route_slope:.1f} deg, max softness {route_soft:.2f}, "
        f"max slip {slip_along(route):.3f}; straight up a loose flank: slip up to {flank_slip:.3f} "
        "(Moon slipLimit 0.2)")

    # ---- 9. Write images and terrain.json -----------------------------------------------------
    o = args.out
    hlo, hhi = write_png16(o / "heightmap.png", ht_w)
    write_png8(o / "slope.png", sl_w * SLOPE_SCALE)
    write_png8(o / "soft-ground.png", soft_w * SOFT_SCALE)
    nlo, nhi = write_png16(o / "distant-near.png", near_t)
    flo, fhi = write_png16(o / "distant-far.png", far_t)
    sizes_b = {f.name: f.stat().st_size for f in sorted(o.glob("*.png"))}
    np.savez_compressed(RAW / "units.npz", core=core_w.astype(np.float32), ejecta=ej_w.astype(np.float32),
                        soft=soft_w.astype(np.float32), height=z_w.astype(np.float32))

    def decode(lo, hi):
        return {"encoding": "uint16 grayscale PNG", "min_m": lo, "max_m": hi,
                "formula": "height_m = min_m + value / 65535 * (max_m - min_m)"}

    def ring_meta(name, file, lo, hi, half, res, n, source):
        return {"name": name, "file": file, **decode(lo, hi), "size_m": 2 * half, "pixel_m": res, "samples": n,
                "boundsLocal": {"xMin": -half, "xMax": half, "zMin": -half, "zMax": half},
                "pixelToLocal": f"x = (col - {n // 2}) * {res}, z = (row - {n // 2}) * {res}",
                "hole": "Covers the inner grid too; skip or sink the part inside it.", "source": source}

    gen = "Generated by this pipeline (seed %d) from published Cassini measurements; modeled, not measured" % SEED
    meta = {
        "version": 1,
        "generated": dt.date.today().isoformat(),
        "generator": "game/tools/build_terrain_titan.py",
        "site": "Shangri-La dune field, Titan, between Dragonfly's landing ellipse and Selk crater (terrain modeled "
                "on Cassini data, not real elevation)",
        "modeled": True,
        "frame": {
            "description": "Local right-handed, y-up frame in meters (Three.js convention). Origin = play-area "
                           "center. +x = east, +z = south, +y = up. Image columns go with +x, rows with +z; "
                           "row 0 is the northern edge. Grid north is true north.",
            "originLatLon": [round(lat0, 6), round(lon0, 6)],
            "projection": f"Azimuthal equidistant on the Titan sphere R = {TITAN_R:.0f} m (IAU mean radius), "
                          "centered on the origin. Latitudes planetocentric, longitudes EAST (IAU Titan maps use "
                          f"west longitude: origin = {360 - lon0:.3f} W).",
            "toLatLon": "spherical azimuthal equidistant inverse with x east, y north = -z",
            "heights": "All heightmaps store TANGENT-PLANE heights: modeled height above the interdune floor at the "
                       "origin (Titan has no rover-scale elevation model or usable local datum) minus the curvature "
                       "drop r^2 / (2R), r = horizontal distance from the origin. The drop is 3.1 m at 4 km, "
                       "121 m at 25 km, 1.94 km at 100 km.",
            "azimuthConvention": "azimuth_deg is measured from north (local -z), turning toward east (+x). "
                                 "Direction vector = (x: sin(az), z: -cos(az)).",
        },
        "sunAndEarth": {
            "siteLatitude_deg": round(lat0, 4),
            "siteLongitude_deg": round(lon0, 4),
            "note": "Titan: Sun only (no Earth block; Saturn is hidden by the haze). Longitude east.",
        },
        "playArea": {
            "size_m": 2 * PLAY_HALF, "pixel_m": PLAY_RES, "samples": N,
            "boundsLocal": {"xMin": -PLAY_HALF, "xMax": PLAY_HALF, "zMin": -PLAY_HALF, "zMax": PLAY_HALF},
            "pixelToLocal": f"sample (col, row) -> x = (col - {hN}) * {PLAY_RES:g}, z = (row - {hN}) * {PLAY_RES:g} "
                            "(vertex-centered grid)",
            "files": {
                "heightmap": {"file": "heightmap.png", **decode(hlo, hhi), "source": gen},
                "slope": {"file": "slope.png", "encoding": "uint8 grayscale PNG",
                          "formula": f"slope_deg = value / {SLOPE_SCALE}",
                          "source": "Computed from the 5 m heights (central differences)"},
                "softGround": {"file": "soft-ground.png", "encoding": "uint8 grayscale PNG",
                               "formula": "softness = value / 255 (0 firm ground, 1 loose dune sand); graded, "
                                          "authoritative (see features.softGround)",
                               "source": "Generated with the dunes, softened over one pixel"},
            },
            "elevationRange_m": [round(float(z_w.min()), 1), round(float(z_w.max()), 1)],
        },
        "distantTerrain": [
            ring_meta("near ring", "distant-near.png", nlo, nhi, NEAR_HALF, NEAR_RES, near_t.shape[0],
                      "Generated dune field (more seeded rows, 2.2-3.4 km apart, 8-30 km long) and Selk's ejecta; "
                      "the play-area heights inside"),
            ring_meta("far ring", "distant-far.png", flo, fhi, FAR_HALF, FAR_RES, far_t.shape[0],
                      "Generated dune field, plus Selk crater at its true position: 80 km across, rim +200 m, floor "
                      "-150 m, ejecta falling off as (R/r)^3 (Lorenz et al. 2021; IAU)"),
        ],
        "landing": landing,
        "features": {
            "duneCrests": dune_crests,
            "interdunes": {
                "description": "Flat, firm, sand-free ground between the dunes. Crossing a dune from one corridor to "
                               "the next is the Dune crossing milestone. Outlines are closed polygons clipped to the "
                               "map; the north corridor merges with Selk's ejecta plain.",
                "corridors": corridors,
                "source": "Generated with the dunes; sand-free bright interdunes per Lorenz et al. 2021",
            },
            "softGround": soft_ground,
            "rockyAreas": rocky,
            "viewpoints": [viewpoint],
            "samplePatch": sample,
            "crossingRoute": crossing,
            "selk": selk,
            "notes": [
                "MODELED terrain: dune sizes, spacing, orientation, plinths, interdune corridors and Selk's size and "
                "position follow published Cassini measurements; the exact dunes and blocks are generated (seed "
                f"{SEED}). Credits must say 'modeled on Cassini data', never 'real elevation'.",
                f"Drive distances are least-cost routes on a {DRIVE_RES} m grid avoiding slopes over "
                f"{DRIVE_MAX_SLOPE:.0f} deg, with a mild cost for loose sand; straight-line distances are also given.",
                f"Dune crests stand {min(l['heightRange_m'][0] for l in lines if l['name'] != 'Branch')}-"
                f"{max(l['height_m'] for l in lines)} m (Cassini: 100-150 m in Belet, up to ~150 m) on bases "
                "0.75-1.4 km wide plus plinths, kept at the low end so the flanks stay drivable (max slope "
                f"{sl_w.max():.0f} deg at 5 m; Cassini clinometry gives ~10 deg flanks). The Dune 1 saddle is "
                f"{crossing['crestPoint']['elevation_m'] - crossing['fromCorridor']['elevation_m']:.0f} m high.",
                f"Soft ground with the Moon's ground tuning: a reference rover (60 kg, grip 0.55) slips "
                f"{(1.5 + 4.5 * LOOSE_SAND) * 0.03:.2f} on flat loose sand and reaches the 0.2 stuck limit climbing "
                f"straight up a loose flank steeper than ~14 deg (steepest loose flank: slip {flank_slip:.2f}); the "
                f"crossing route stays at or below {slip_along(route):.2f}, the route to the Dune sea viewpoint at "
                f"{slip_along(paths[viewpoint['name']]):.2f}. Heavier rovers or weaker wheels sink more.",
                f"Play-area center {CENTER_FROM_SELK_M / 1000:.0f} km from Selk's center, on the line from Selk to "
                f"Dragonfly's landing-ellipse center ({math.hypot(ell_x, ell_z) / 1000:.0f} km south-southeast), "
                "about 30 km north of the ellipse's northern edge: on Dragonfly's route to Selk.",
                f"Selk's rim is at its true position in the far ring. Seen from the landing it is "
                f"{abs(rim_land[0]):.1f} deg below the local horizon (Titan's curvature hides it); from the Dune sea "
                "viewpoint " + ("it is the skyline toward the north-northwest" if rim_view[0] > -0.05 else
                                f"it is {abs(rim_view[0]):.1f} deg below the horizon") +
                f" ({rim_view[1]:+.1f} deg). Titan's haze hides it anyway.",
                "Huygens-like pebbles (Huygens landed on rounded cobbles; Tomasko et al. 2005) appear in the ground "
                "texture around the landing only (see texture.json).",
                "Names are ASCII.",
            ],
        },
        "horizonFromLanding": {
            "eyeHeight_m": EYE_HEIGHT,
            "elevation_deg_by_azimuth": [round(float(v), 2) for v in hz_land],
            "note": "Index = azimuth in degrees (see frame.azimuthConvention). Includes curvature.",
        },
        "files_bytes": sizes_b,
        "sources": SOURCES,
        "credits": CREDITS,
    }
    (o / "terrain.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    log(f"wrote {o}: " + ", ".join(f"{k_} {v / 1e6:.2f} MB" for k_, v in sizes_b.items()))

    if args.preview:
        render_preview(args.preview, ht_w, sl_w, soft_w, meta, paths, h10)
        log(f"preview: {args.preview}")


SOURCES = [
    {"dataset": "Titan's linear dunes: orientation, width, spacing, height and length from Cassini RADAR",
     "url": "https://doi.org/10.1016/j.icarus.2007.10.015",
     "citation": "Radebaugh, J., et al. (2008), Dunes on Titan observed by Cassini Radar, Icarus 194, 690-703",
     "provider": "Elsevier / Cassini RADAR team", "used": "Orientation (W-E), widths 1-2 km, spacing 1-4 km, "
     "heights 100-150 m, flank slopes ~10 deg, lengths, Y-junctions"},
    {"dataset": "Dragonfly landing site: Selk topography, ejecta, dunes, plinths, interdunes, delivery ellipse",
     "url": "https://doi.org/10.3847/PSJ/abd08f",
     "citation": "Lorenz, R.D., et al. (2021), Selection and characteristics of the Dragonfly landing site near "
                 "Selk crater, Titan, Planet. Sci. J. 2:24",
     "provider": "AAS / Dragonfly team", "used": "Ellipse center 3.72 N 161.8 E (148.9 x 72.0 km); Selk rim "
     "~200 m, floor 100-200 m deep, rim slopes 2-3 deg; ejecta intact and radar-bright; dune plinths; "
     "sand-free bright interdunes"},
    {"dataset": "Selk crater (IAU Gazetteer of Planetary Nomenclature, feature 14334)",
     "url": "https://planetarynames.wr.usgs.gov/Feature/14334",
     "citation": "IAU WGPSN / USGS Astrogeology, Gazetteer of Planetary Nomenclature: Selk, 7.0 N, 199.0 W, 80 km",
     "provider": "IAU / USGS (public domain)", "used": "Selk center and diameter"},
    {"dataset": "Titan's sand seas (first Cassini RADAR dune observations)",
     "url": "https://doi.org/10.1126/science.1123257",
     "citation": "Lorenz, R.D., et al. (2006), The sand seas of Titan: Cassini RADAR observations of longitudinal "
                 "dunes, Science 312, 724-727",
     "provider": "AAAS / Cassini RADAR team", "used": "Dune spacing and form"},
    {"dataset": "Titan mean radius",
     "url": "https://doi.org/10.1007/s10569-017-9805-5",
     "citation": "Archinal, B.A., et al. (2018), Report of the IAU Working Group on Cartographic Coordinates and "
                 "Rotational Elements: 2015, Celest. Mech. Dyn. Astron. 130:22",
     "provider": "IAU", "used": "R = 2574.73 km"},
    {"dataset": "Huygens landing site surface (rounded pebbles)",
     "url": "https://doi.org/10.1038/nature04126",
     "citation": "Tomasko, M.G., et al. (2005), Rain, winds and haze during the Huygens probe's descent to Titan's "
                 "surface, Nature 438, 765-778",
     "provider": "Nature / ESA-NASA Huygens DISR team", "used": "Pebble texture near the landing (texture only)"},
]
CREDITS = [
    "Titan terrain modeled on Cassini data (NASA/JPL-Caltech/ASI/Cassini RADAR): dune sizes and spacing from "
    "Radebaugh et al. 2008 and Lorenz et al. 2006; Selk crater and the Dragonfly landing site from Lorenz et al. "
    "2021 and the IAU Gazetteer. The dunes themselves are generated, not real elevation.",
]


def render_preview(path, ht, sl, soft, meta, paths, h10):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    n = ht.shape[0]
    half = n // 2 * PLAY_RES
    ext = [-half, half, half, -half]
    f = meta["features"]
    fig, axes = plt.subplots(1, 2, figsize=(22, 11))
    for ax, title in zip(axes, ("hillshade + features (orange = loose sand)", "slope (deg)")):
        if title.startswith("hill"):
            ax.imshow(hillshade(ht, PLAY_RES, 300, 35), extent=ext, cmap="gray")
            ax.imshow(np.ma.masked_less(soft, 0.2), extent=ext, cmap="autumn_r", alpha=0.45, vmin=0, vmax=1)
        else:
            im = ax.imshow(sl, extent=ext, cmap="magma", vmax=20)
            plt.colorbar(im, ax=ax, fraction=0.04)
        for ln in f["duneCrests"]["lines"]:
            s = np.array(ln["crestLocal_xz"])
            ax.plot(s[:, 0], s[:, 1], "c-", lw=1.5)
        for c in f["interdunes"]["corridors"]:
            o_ = np.array(c["outlineLocal_xz"] + c["outlineLocal_xz"][:1])
            ax.plot(o_[:, 0], o_[:, 1], "m-", lw=1)
        for a in f["rockyAreas"]:
            ax.add_patch(plt.Circle((a["local"]["x"], a["local"]["z"]), a["radius_m"], fill=False, color="lime", lw=2))
        sp = f["samplePatch"]
        ax.add_patch(plt.Circle((sp["local"]["x"], sp["local"]["z"]), sp["radius_m"], fill=False, color="w", lw=2))
        for name, p in paths.items():
            ax.plot((p[:, 1] - h10) * DRIVE_RES, (p[:, 0] - h10) * DRIVE_RES, "y-", lw=0.8)
        cr = f["crossingRoute"]
        pts = [meta["landing"], sp, *f["viewpoints"], *f["rockyAreas"], cr["fromCorridor"], cr["crestPoint"],
               cr["toCorridor"]]
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
