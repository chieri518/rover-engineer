#!/usr/bin/env python3
"""Measure route legs between Moon nodes for the balance model (game/data/balance.json).

Reads only the game's own terrain outputs in game/public/terrain/ (heightmap, distant rings, cold mask,
terrain.json) and the Sun path in game/data/tuning.json, so it needs no raw data.

Method (the one balance.json's note describes):
  - Drive routes: least-cost paths on a 10 m grid (5 m heights block-averaged 2 x 2), cost
    1 + 0.5 (slope / 18)^2, slopes over 18 deg forbidden, permanent shadow (cold-mask >= 0.5) forbidden
    except for routes that start or end inside the dark crater. A node off the landing's drivable area
    snaps to the nearest cell of it (within 80 m). The weight 0.5 and the block average were chosen
    because they reproduce balance.json's legs best (--check); the original tool is not in the repo.
  - distanceM: route length. climbM / descentM: summed rises and drops of the route's height profile
    (10 m samples, smoothed over 50 m). coldM: route length inside permanent shadow.
  - lit: sunlit share of the route (mean of the Sun-disc visibility over its 10 m samples) every
    litStepSeconds of the mission, with the game's shadow test (src/world/terrainData.ts sunVisibility:
    march toward the Sun from 1 m above the ground, 1.04 step growth, soft 0.53 deg disc) and the
    decided Sun path (src/rules/sun.ts sunAt with tuning.json sun and mission).
  - Nodes: fromLandingM straight-line, belowLandingM from tangent-plane heights, earthVisible = Earth's
    center (tuning.json earth) above the terrain horizon from 1 m above the ground, lit = Sun-disc
    visibility at the node every litStepSeconds.

Usage (from game/tools/, inside the venv):
    python measure_legs.py --check                       # re-measure balance.json's legs, print differences
    python measure_legs.py --out out/moon-site-legs.json # measure the Moon sites nodes (NEW_NODES)

It never edits balance.json; Phase 6 copies what it needs from the output file.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.graph import MCP_Geometric

HERE = Path(__file__).resolve().parent
GAME = HERE.parent
TERRAIN = GAME / "public" / "terrain"
DATA = GAME / "data"

DRIVE_RES = 10  # m
DRIVE_MAX_SLOPE = 18.0  # deg at 10 m scale
SLOPE_WEIGHT = 0.5  # cost = 1 + SLOPE_WEIGHT * (slope / DRIVE_MAX_SLOPE)^2
EDGE_MARGIN = 200.0  # m kept clear of the play-area edge
PROFILE_SMOOTH_M = 50.0  # height profile smoothing for climb / descent
SNAP_RADIUS = 80.0  # m: a node off the drivable grid snaps to the nearest drivable cell within this

# Shadow test constants, from src/world/terrainData.ts.
GROUND_EYE_M = 1.0
MARCH_GROWTH = 1.04
MARCH_MAX_M = 200_000.0
SUN_RADIUS_TAN = math.tan(math.radians(0.267))

# New nodes for the Moon sites plan (space-mission-design-game/moon-sites-and-milestones-plan.md).
# Each names a terrain.json feature by list and id; "at" picks the point used ("local" for point
# features, "innerPoint" for patches, "drivePoint" when the feature gives one).
NEW_NODES = [
    {"id": "eastCrater", "list": "youngCraters", "feature": "young-crater-east", "at": "drivePoint",
     "attrs": {"youngCrater": "young-crater-east"}},
    # The rolled boulder: the best track candidate in East crater (its foot, on the crater floor).
    {"id": "rolledBoulder", "list": "boulderTrackCandidates", "where": {"youngCrater": "young-crater-east"},
     "at": "local", "attrs": {"rolledBoulder": True}},
    {"id": "nwCrater", "list": "youngCraters", "feature": "young-crater-nw", "at": "drivePoint",
     "attrs": {"youngCrater": "young-crater-nw"}},
    # Replacements for the plan's West crater, which has no rim in the 5 m DEM: the fresh SE crater and
    # the second NW crater (1 km WNW). Phase 6 keeps whichever sites.json picks.
    {"id": "seCrater", "list": "youngCraters", "feature": "young-crater-se", "at": "drivePoint",
     "attrs": {"youngCrater": "young-crater-se"}},
    {"id": "nw2Crater", "list": "youngCraters", "feature": "young-crater-nw-2", "at": "drivePoint",
     "attrs": {"youngCrater": "young-crater-nw-2"}},
    {"id": "coldEast", "list": "coldTraps", "feature": "cold-trap-east", "at": "drivePoint",
     "attrs": {"coldTrap": "cold-trap-east"}},
    {"id": "coldSouth", "list": "coldTraps", "feature": "cold-trap-south", "at": "drivePoint",
     "attrs": {"coldTrap": "cold-trap-south"}},
    {"id": "coldRocky1", "list": "coldTraps", "feature": "cold-trap-rocky-area-1", "at": "drivePoint",
     "attrs": {"coldTrap": "cold-trap-rocky-area-1"}},
    {"id": "hydrogen", "list": "lowLightPatches", "feature": "low-light-nw", "at": "innerPoint",
     "attrs": {"lowLightPatch": "low-light-nw"}},
    # The Earth-facing bench (plan: 300 to 450 m out, toward the East cluster). Picked by hand with this rule:
    # among 5 m cells 300 to 450 m from the landing with x greater than the landing's (the East side) and a
    # mean slope under 5 deg over 45 m (slope.png, 9 x 9 mean), the one where Earth's center (tuning.json
    # earth) stands highest above the terrain horizon from 1 m up. Only a strip at (-465..-455, 120..165)
    # passes; (-460, 130) is 304 m ESE with Earth 6.4 deg clear. It is south of the line to East crater.
    {"id": "eastBench", "point": {"x": -460, "z": 130}, "attrs": {"note": "Earth-facing bench, East cluster"}},
]


def log(*a):
    print("[legs]", *a, flush=True)


# =============================================================================
# Terrain, as the game loads it
# =============================================================================


class Grid:
    """Vertex-centered square height grid (HeightGrid in terrainData.ts)."""

    def __init__(self, heights: np.ndarray, pixel: float):
        self.h = heights
        self.n = self.h.shape[0]
        self.pixel = pixel
        self.half = (self.n - 1) / 2
        self.extent = self.half * pixel

    def contains(self, x, z):
        return (np.abs(x) <= self.extent) & (np.abs(z) <= self.extent)

    def sample(self, x, z):
        fx = np.clip(x / self.pixel + self.half, 0, self.n - 1)
        fz = np.clip(z / self.pixel + self.half, 0, self.n - 1)
        c = np.minimum(np.floor(fx).astype(int), self.n - 2)
        r = np.minimum(np.floor(fz).astype(int), self.n - 2)
        tx, tz = fx - c, fz - r
        h = self.h
        top = h[r, c] * (1 - tx) + h[r, c + 1] * tx
        bot = h[r + 1, c] * (1 - tx) + h[r + 1, c + 1] * tx
        return top * (1 - tz) + bot * tz


def read_png_grid(path: Path, lo: float, hi: float, pixel: float) -> Grid:
    """A height PNG decoded as the game does (16-bit: min + value / 65535 * (max - min))."""
    img = Image.open(path)
    depth = 65535 if img.mode.startswith("I") else 255
    return Grid(lo + np.array(img).astype(np.float64) * (hi - lo) / depth, pixel)


class Terrain:
    """The play area and distant rings as the game sees them (Terrain in terrainData.ts)."""

    def __init__(self, fine: Grid, near: Grid, far: Grid, cold: np.ndarray, info: dict | None = None):
        self.fine, self.near, self.far, self.cold, self.info = fine, near, far, cold, info
        self.max_height = max(g.h.max() for g in (self.fine, self.near, self.far))

    @classmethod
    def load(cls, folder: Path) -> "Terrain":
        info = json.loads((folder / "terrain.json").read_text())
        hm = info["playArea"]["files"]["heightmap"]
        near, far = info["distantTerrain"]
        cold = np.array(Image.open(folder / "cold-mask.png")).astype(np.float64) / 255.0
        return cls(read_png_grid(folder / hm["file"], hm["min_m"], hm["max_m"], info["playArea"]["pixel_m"]),
                   read_png_grid(folder / near["file"], near["min_m"], near["max_m"], near["pixel_m"]),
                   read_png_grid(folder / far["file"], far["min_m"], far["max_m"], far["pixel_m"]), cold, info)

    def height_at(self, x, z):
        x, z = np.asarray(x, float), np.asarray(z, float)
        out = self.far.sample(x, z)
        m = self.near.contains(x, z)
        out = np.where(m, self.near.sample(x, z), out)
        m = self.fine.contains(x, z)
        return np.where(m, self.fine.sample(x, z), out)

    def cold_at(self, x, z):
        """Permanent-shadow fraction (cold-mask.png, nearest sample)."""
        g = self.fine
        c = np.clip(np.round(np.asarray(x) / g.pixel + g.half).astype(int), 0, g.n - 1)
        r = np.clip(np.round(np.asarray(z) / g.pixel + g.half).astype(int), 0, g.n - 1)
        return self.cold[r, c]

    def _march(self, x, z, eye, d, tan_el, early_margin):
        """Highest horizon tangent seen from (x, eye, z) toward horizontal direction d."""
        x, z, eye = (np.asarray(a, float) for a in (x, z, eye))
        max_tan = np.full(x.shape, -np.inf)
        active = np.ones(x.shape, bool)
        t = self.fine.pixel
        while t < MARCH_MAX_M and active.any():
            px, pz = x[active] + d[0] * t, z[active] + d[1] * t
            inside = self.far.contains(px, pz)
            idx = np.nonzero(active)[0]
            # outside the far ring: this point is done
            active[idx[~inside]] = False
            idx = idx[inside]
            if idx.size == 0:
                break
            h = self.height_at(px[inside], pz[inside])
            max_tan[idx] = np.maximum(max_tan[idx], (h - eye[idx]) / t)
            done = (self.max_height - eye[idx]) / t < tan_el - early_margin
            active[idx[done]] = False
            t *= MARCH_GROWTH
        return max_tan

    def sun_visibility(self, x, z, sun):
        """Share of the Sun's disc visible from 1 m above the ground (terrainData.ts sunVisibility)."""
        horiz = math.hypot(sun[0], sun[2])
        if horiz < 1e-6:
            return np.ones(np.shape(x))
        d = (sun[0] / horiz, sun[2] / horiz)
        tan_el = sun[1] / horiz
        eye = self.height_at(x, z) + GROUND_EYE_M
        max_tan = self._march(x, z, eye, d, tan_el, SUN_RADIUS_TAN)
        e = SUN_RADIUS_TAN
        u = np.clip((tan_el - max_tan + e) / (2 * e), 0, 1)
        return u * u * (3 - 2 * u)

    def horizon_margin(self, x, z, eye, direction):
        """terrainData.ts horizonMarginTan: > 0 when the body's center is above the terrain horizon."""
        horiz = math.hypot(direction[0], direction[2])
        d = (direction[0] / horiz, direction[2] / horiz)
        tan_el = direction[1] / horiz
        return tan_el - self._march(x, z, eye, d, tan_el, 0.0)


def sky_direction(az_deg, el_deg):
    az, el = math.radians(az_deg), math.radians(el_deg)
    return (math.cos(el) * math.sin(az), math.sin(el), -math.cos(el) * math.cos(az))


def sun_path(tuning, site, step):
    """Sun direction every `step` seconds of the mission (src/rules/sun.ts sunAt)."""
    sun, mission = tuning["sun"], tuning["mission"]
    out = []
    for s in np.arange(0, mission["lengthSeconds"] + 1e-9, step):
        days = s / mission["lengthSeconds"] * mission["gameDays"]
        az = sun["startAzimuthDeg"] - sun["degreesPerEarthDay"] * days
        lat, sub = math.radians(site["latitudeDeg"]), math.radians(sun["subsolarLatitudeDeg"])
        sin_el = (math.sin(lat) * math.sin(sub)
                  + math.cos(lat) * math.cos(sub) * math.cos(math.radians(az - site["longitudeDeg"])))
        out.append(sky_direction(az, math.degrees(math.asin(sin_el))))
    return out


# =============================================================================
# Drive grid
# =============================================================================


class DriveGrid:
    def __init__(self, terrain: Terrain):
        g = terrain.fine
        k = DRIVE_RES // int(g.pixel)
        # 2 x 2 block average; cell (r, c) is treated as sitting at ((c - half) * 10, (r - half) * 10), which is
        # 2.5 m off the block's true center (as in build_terrain.py's 20 m grid). It reproduces balance.json best.
        n = (g.n - 1) // k
        self.z10 = g.h[: n * k, : n * k].reshape(n, k, n, k).mean(axis=(1, 3))
        self.n = n
        self.half = n // 2
        gy, gx = np.gradient(self.z10, DRIVE_RES)
        self.slope = np.degrees(np.arctan(np.hypot(gx, gy)))
        # Cold cells sample cold-mask.png at 5 m pixel (2r, 2c), i.e. at the cell's nominal position, so they
        # sit 2.5 m from the averaged heights' true center (in x and z). Kept: it reproduces balance.json.
        cold = terrain.cold[::k, ::k][:n, :n] >= 0.5
        self.cold = cold
        base = 1.0 + SLOPE_WEIGHT * (self.slope / DRIVE_MAX_SLOPE) ** 2
        base[self.slope > DRIVE_MAX_SLOPE] = np.inf
        m = int(EDGE_MARGIN / DRIVE_RES)
        base[:m, :] = base[-m:, :] = np.inf
        base[:, :m] = base[:, -m:] = np.inf
        self.cost_dark = base  # shadow allowed
        self.cost = np.where(cold, np.inf, base)  # shadow forbidden
        yy, xx = np.mgrid[0:self.n, 0:self.n]
        self.x = (xx - self.half) * DRIVE_RES
        self.z = (yy - self.half) * DRIVE_RES
        self._mcp = {}

    def rc(self, x, z):
        return int(round(z / DRIVE_RES + self.half)), int(round(x / DRIVE_RES + self.half))

    def set_landing(self, x, z):
        """The drivable area is the part of each cost grid connected to the landing point."""
        self.main = {}
        for dark, cost in ((False, self.cost), (True, self.cost_dark)):
            lab, _ = ndimage.label(np.isfinite(cost))
            self.main[dark] = lab == lab[self.rc(x, z)]

    def snap(self, x, z, dark=False):
        """Nearest cell of the landing's drivable area within SNAP_RADIUS; (x, z, snapped_m)."""
        main = self.main[dark]
        r, c = self.rc(x, z)
        if main[r, c]:
            return float(self.x[r, c]), float(self.z[r, c]), 0.0
        d = np.hypot(self.x - x, self.z - z)
        cand = main & (d <= SNAP_RADIUS)
        if not cand.any():
            return None
        i = np.unravel_index(np.argmin(np.where(cand, d, np.inf)), d.shape)
        return float(self.x[i]), float(self.z[i]), float(d[i])

    def route(self, a, b, dark=False):
        """Least-cost route from point a to b (local x, z); array of (x, z) at 10 m cells, or None."""
        key = (a, dark)
        if key not in self._mcp:
            mcp = MCP_Geometric(self.cost_dark if dark else self.cost)
            mcp.find_costs([self.rc(*a)])
            self._mcp[key] = mcp
        mcp = self._mcp[key]
        try:
            path = np.array(mcp.traceback(self.rc(*b)))
        except ValueError:
            return None
        if len(path) < 2 and self.rc(*a) != self.rc(*b):
            return None
        return np.stack([(path[:, 1] - self.half) * DRIVE_RES, (path[:, 0] - self.half) * DRIVE_RES], axis=1)


def resample_path(path, step=DRIVE_RES):
    """Points every `step` meters along a polyline, and its length."""
    seg = np.hypot(*np.diff(path, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    length = float(s[-1])
    if length == 0:
        return path[:1].astype(float), 0.0
    t = np.linspace(0, length, max(2, int(round(length / step)) + 1))
    return np.stack([np.interp(t, s, path[:, 0]), np.interp(t, s, path[:, 1])], axis=1), length


# =============================================================================
# Measuring
# =============================================================================


class Measurer:
    def __init__(self, terrain: Terrain, tuning: dict, site: dict, step: int, landing: dict):
        self.t = terrain
        self.grid = DriveGrid(terrain)
        self.grid.set_landing(landing["x"], landing["z"])
        self.suns = sun_path(tuning, site, step)
        self.earth = sky_direction(tuning["earth"]["azimuthDeg"], tuning["earth"]["elevationDeg"])
        self.landing = landing
        self.landing_h = float(terrain.height_at(landing["x"], landing["z"]))
        self._lit_cache = {}

    def lit_series(self, pts):
        """Mean Sun-disc visibility over pts at every Sun step; points are cached on a 10 m lattice."""
        keys = [(int(round(x)), int(round(z))) for x, z in pts]
        todo = sorted({k for k in keys if k not in self._lit_cache})
        if todo:
            arr = np.array(todo, float)
            vis = np.stack([self.t.sun_visibility(arr[:, 0], arr[:, 1], s) for s in self.suns], axis=1)
            for k, v in zip(todo, vis):
                self._lit_cache[k] = v
        v = np.mean([self._lit_cache[k] for k in keys], axis=0)
        return [round(float(a), 2) for a in v]

    def node(self, nid, x, z, attrs=None):
        h = float(self.t.height_at(x, z))
        eye = h + GROUND_EYE_M
        earth = float(self.t.horizon_margin(np.array([x]), np.array([z]), np.array([eye]), self.earth)[0]) > 0
        out = {"id": nid, "x": round(x), "z": round(z),
               "fromLandingM": round(math.hypot(x - self.landing["x"], z - self.landing["z"])),
               "belowLandingM": round(self.landing_h - h), "earthVisible": earth}
        out.update(attrs or {})
        out["lit"] = self.lit_series([(x, z)])
        return out

    def leg(self, a, b, dark=False):
        """a, b: node dicts with x, z. Returns the leg dict and the route points."""
        g = self.grid
        sa, sb = g.snap(a["x"], a["z"], dark), g.snap(b["x"], b["z"], dark)
        if sa is None or sb is None:
            return None, None
        path = g.route((sa[0], sa[1]), (sb[0], sb[1]), dark)
        if path is None:
            return None, None
        # The route runs between the exact node points: add them at the ends.
        path = np.concatenate([[[a["x"], a["z"]]], path, [[b["x"], b["z"]]]])
        pts, length = resample_path(path)
        h = self.t.height_at(pts[:, 0], pts[:, 1])
        win = max(1, int(round(PROFILE_SMOOTH_M / DRIVE_RES)))
        hs = ndimage.uniform_filter1d(h, win, mode="nearest") if len(h) > win else h
        dh = np.diff(hs)
        cold = self.t.cold_at(pts[:, 0], pts[:, 1]) >= 0.5
        cold_m = float(cold.mean() * length) if len(pts) else 0.0
        return {"from": a["id"], "to": b["id"], "distanceM": round(length),
                "climbM": round(float(dh[dh > 0].sum())), "descentM": round(float(-dh[dh < 0].sum())),
                "coldM": round(cold_m), "lit": self.lit_series(pts)}, pts


def resolve_new_nodes(terrain_info, specs):
    feats = terrain_info["features"]
    out = []
    for s in specs:
        if "point" in s:
            out.append((s["id"], s["point"]["x"], s["point"]["z"], s.get("attrs", {})))
            continue
        lst = feats.get(s["list"]) or []
        want = s.get("where") or {"id": s["feature"]}
        f = next((f for f in lst if all(f.get(k) == v for k, v in want.items())), None)
        if f is None:
            log(f"skip {s['id']}: {s['list']} has no entry with {want}")
            continue
        p = f.get(s["at"]) or f.get("local") or f.get("centroidLocal")
        out.append((s["id"], p["x"], p["z"], s.get("attrs", {})))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="re-measure balance.json's legs and compare")
    ap.add_argument("--out", type=Path, help="write new nodes and legs (NEW_NODES) here")
    ap.add_argument("--terrain", type=Path, default=TERRAIN)
    args = ap.parse_args()

    terrain = Terrain.load(args.terrain)
    tuning = json.loads((DATA / "tuning.json").read_text())
    balance = json.loads((DATA / "balance.json").read_text())
    step = balance["litStepSeconds"]
    nodes = {n["id"]: n for n in balance["nodes"]}
    landing = nodes["landing"]
    m = Measurer(terrain, tuning, balance["site"], step, landing)
    dark_ids = {n["id"] for n in balance["nodes"] if n.get("darkCrater")}

    report = {}
    if args.check:
        report["check"] = check(m, balance, dark_ids)

    if args.out:
        new = resolve_new_nodes(terrain.info, NEW_NODES)
        new_nodes = []
        for nid, x, z, attrs in new:
            sn = m.grid.snap(x, z)
            if sn is None:
                log(f"{nid}: no drivable cell within {SNAP_RADIUS:.0f} m of ({x:.0f}, {z:.0f}); skipped")
                continue
            new_nodes.append(m.node(nid, x, z, attrs))
        all_nodes = list(nodes.values()) + new_nodes
        legs, routes = [], {}
        for a in all_nodes:
            for b in all_nodes:
                if a["id"] == b["id"] or (a in balance["nodes"] and b in balance["nodes"]):
                    continue
                dark = a["id"] in dark_ids or b["id"] in dark_ids
                leg, pts = m.leg(a, b, dark)
                if leg is None:
                    log(f"no route {a['id']} -> {b['id']}")
                    continue
                legs.append(leg)
                routes[(a["id"], b["id"])] = pts
        near = near_cold_traps(terrain.info, balance, m, dark_ids)
        out = {
            "note": "Measured by game/tools/measure_legs.py (see its docstring for the method) on the terrain in "
                    "game/public/terrain/. New Moon sites nodes and every leg that touches one, in balance.json's "
                    "format. Not loaded by the game; Phase 6 of the Moon sites plan copies them into balance.json.",
            "litStepSeconds": step,
            "nodes": new_nodes,
            "legs": legs,
            "coldTrapsNearExistingRoutes": near,
        }
        if "check" in report:
            out["reproductionCheck"] = report["check"]["summary"]
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(out, indent=1) + "\n")
        log(f"{len(new_nodes)} new nodes, {len(legs)} legs -> {args.out}")


def check(m: Measurer, balance, dark_ids):
    rows = []
    node_rows = []
    for n in balance["nodes"]:
        mn = m.node(n["id"], n["x"], n["z"])
        node_rows.append({
            "id": n["id"], "dBelow": mn["belowLandingM"] - n["belowLandingM"],
            "earth": (n["earthVisible"], mn["earthVisible"]),
            "litMAE": round(float(np.mean(np.abs(np.array(mn["lit"]) - np.array(n["lit"])))), 3)})
    nodes = {n["id"]: n for n in balance["nodes"]}
    for L in balance["legs"]:
        dark = L["from"] in dark_ids or L["to"] in dark_ids
        leg, _ = m.leg(nodes[L["from"]], nodes[L["to"]], dark)
        if leg is None:
            rows.append({"leg": f"{L['from']}->{L['to']}", "missing": True})
            continue
        rows.append({"leg": f"{L['from']}->{L['to']}",
                     "distance": (L["distanceM"], leg["distanceM"]),
                     "climb": (L["climbM"], leg["climbM"]), "descent": (L["descentM"], leg["descentM"]),
                     "cold": (L["coldM"], leg["coldM"]),
                     "litMAE": round(float(np.mean(np.abs(np.array(leg["lit"]) - np.array(L["lit"])))), 3)})
    ok = [r for r in rows if not r.get("missing")]
    rel = np.array([(r["distance"][1] - r["distance"][0]) / r["distance"][0] for r in ok])
    dclimb = np.array([r["climb"][1] - r["climb"][0] for r in ok])
    ddesc = np.array([r["descent"][1] - r["descent"][0] for r in ok])
    dcold = np.array([r["cold"][1] - r["cold"][0] for r in ok])
    lit = np.array([r["litMAE"] for r in ok])
    summary = {
        "legs": len(rows), "missing": len(rows) - len(ok),
        "distanceRelErr": {"median": round(float(np.median(rel)), 4), "meanAbs": round(float(np.mean(np.abs(rel))), 4),
                           "maxAbs": round(float(np.max(np.abs(rel))), 4)},
        "climbErrM": {"meanAbs": round(float(np.mean(np.abs(dclimb))), 1), "maxAbs": int(np.max(np.abs(dclimb)))},
        "descentErrM": {"meanAbs": round(float(np.mean(np.abs(ddesc))), 1), "maxAbs": int(np.max(np.abs(ddesc)))},
        "coldErrM": {"meanAbs": round(float(np.mean(np.abs(dcold))), 1), "maxAbs": int(np.max(np.abs(dcold)))},
        "legLitMeanAbsErr": {"mean": round(float(lit.mean()), 3), "max": round(float(lit.max()), 3)},
        "nodeLitMeanAbsErr": {"mean": round(float(np.mean([r["litMAE"] for r in node_rows])), 3),
                              "max": round(float(np.max([r["litMAE"] for r in node_rows])), 3)},
        "nodeEarthVisibleMismatches": [r["id"] for r in node_rows if r["earth"][0] != r["earth"][1]],
        "nodeBelowLandingErrM": {"maxAbs": int(max(abs(r["dBelow"]) for r in node_rows))},
    }
    for r in node_rows:
        log(f"node {r['id']:12s} below {r['dBelow']:+d} m  earth {r['earth']}  lit MAE {r['litMAE']}")
    for r in rows:
        if r.get("missing"):
            log(f"{r['leg']:24s} NO ROUTE")
            continue
        log(f"{r['leg']:24s} dist {r['distance'][0]:5d} -> {r['distance'][1]:5d} "
            f"({(r['distance'][1] - r['distance'][0]) / r['distance'][0]:+.1%})  climb {r['climb']}  "
            f"descent {r['descent']}  cold {r['cold']}  lit MAE {r['litMAE']}")
    log("summary", json.dumps(summary))
    return {"summary": summary, "rows": rows, "nodes": node_rows}


def near_cold_traps(info, balance, m: Measurer, dark_ids):
    """For M13: closest approach of every existing leg's route to each cold trap outline."""
    traps = (info.get("features") or {}).get("coldTraps") or []
    if not traps:
        return []
    nodes = {n["id"]: n for n in balance["nodes"]}
    pts_all = {}
    for L in balance["legs"]:
        dark = L["from"] in dark_ids or L["to"] in dark_ids
        _, pts = m.leg(nodes[L["from"]], nodes[L["to"]], dark)
        if pts is not None:
            pts_all[f"{L['from']}->{L['to']}"] = pts
    out = []
    for t in traps:
        poly = np.array(t["outlineLocal_xz"], float)
        best = (np.inf, None)
        for name, pts in pts_all.items():
            d = np.min(np.hypot(pts[:, None, 0] - poly[None, :, 0], pts[:, None, 1] - poly[None, :, 1]))
            if d < best[0]:
                best = (float(d), name)
        out.append({"coldTrap": t["id"], "closestExistingLeg": best[1], "closestApproachM": round(best[0])})
    return out


if __name__ == "__main__":
    main()
