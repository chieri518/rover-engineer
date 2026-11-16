"""Moon sites features for terrain.json (requests P1 to P4 of the Moon sites plan).

Called by build_terrain.py; added for review by the pipeline owner. Everything here reads the play-area
window that build_terrain.py already holds (5 m grids, vertex-centered on the origin) and returns plain
lists for terrain.json `features`:

- coldTraps (P1): permanent-shadow patches (LOLA 60 m PSR map, bilinear to 5 m, fraction >= 0.5) of at
  least 2,000 m^2, with a 5 m horizon check for the small ones.
- youngCraters (P2): small craters 40 to 150 m across within 1.6 km, from the 5 m DEM (depression with a
  raised rim), with depth, wall slope and the ejecta's brightness in albedo.jpg (LROC NAC, shading removed).
- boulderTrackCandidates (P3): downhill runs from the top of a wall steeper than 25 deg to where the ground
  levels off, within 1.2 km, preferring young craters. A placement aid, not a detection.
- lowLightPatches (P4): ground outside permanent shadow with average illumination under 15% and slope
  under 15 deg, within 1 km.

Ids are stable as long as the inputs and these rules do not change: special sites keep fixed ids
(Rocky area 1's cold patch, the shadowed crater); the others are named by 8-point compass direction from the
landing, numbered by distance when a direction has several (fresh craters first).
"""

from __future__ import annotations

import math

import numpy as np
from scipy import ndimage
from skimage import measure

RES = 5.0

COLD_MIN_AREA = 2000.0  # m^2 (P1)
COLD_HORIZON_MAX_AREA = 0.1e6  # m^2: the 5 m horizon check runs for patches smaller than this
COLD_HORIZON_STEP = 10.0  # m between horizon-check samples
COLD_HORIZON_AZ_STEP = 1.0  # deg
SUBSOLAR_LAT_MAX = 1.54  # deg, the Sun's largest distance from the equator over the 18.6-year cycle
SUN_RADIUS_DEG = 0.267

CRATER_MAX_DIST = 1600.0  # m (P2)
CRATER_DIAMETER = (40.0, 150.0)  # m
CRATER_MIN_DEPTH = 2.5  # m
CRATER_MIN_DD = 0.04  # depth / diameter
CRATER_MIN_RIM = 0.75  # share of azimuths where the rim stands at least half the depth above the floor
FRESH_DD, FRESH_WALL = 0.08, 30.0  # "fresh": d/D and steepest inner wall at least this

TRACK_MAX_DIST = 1200.0  # m (P3)
TRACK_WALL_SLOPE = 25.0  # deg
TRACK_RUN = (50.0, 150.0)  # m from wall top to foot
TRACK_RUN_IN_CRATER = 20.0  # m: shorter runs are kept inside young craters (their walls are short)
TRACK_FOOT_SLOPE = 12.0  # deg: the run ends where the ground levels off below this
TRACK_TOP_SLOPE = 15.0  # deg: the wall top is where the ground above flattens below this
TRACK_COUNT = 8
TRACK_SEP = 60.0  # m between candidate feet

LOW_MAX_DIST = 1000.0  # m (P4)
LOW_MAX_ILLUM = 0.15
LOW_MAX_SLOPE = 15.0  # deg, on heights smoothed over about 20 m
LOW_MIN_AREA = 2000.0  # m^2

DIRS = [("north", "North"), ("ne", "NE"), ("east", "East"), ("se", "SE"),
        ("south", "South"), ("sw", "SW"), ("west", "West"), ("nw", "NW")]


def compass(dx, dz):
    """8-point compass sector of a direction in the local frame (azimuth from -z toward +x)."""
    az = (math.degrees(math.atan2(dx, -dz)) + 360) % 360
    return DIRS[int(((az + 22.5) % 360) // 45)]


def name_by_direction(items, land, prefix, label_fmt, first=None):
    """Give each item (with 'x', 'z' keys and no 'id') a compass id and name, numbered by distance (after
    the items for which first(item) is true, if given)."""
    groups = {}
    for it in items:
        if it.get("id"):
            continue
        groups.setdefault(compass(it["x"] - land[0], it["z"] - land[1]), []).append(it)
    for (key, label), lst in groups.items():
        lst.sort(key=lambda it: (not first(it) if first else False, math.hypot(it["x"] - land[0], it["z"] - land[1])))
        for i, it in enumerate(lst):
            sfx = "" if i == 0 else f"-{i + 1}"
            it["id"] = f"{prefix}-{key}{sfx}"
            it["name"] = label_fmt.format(label) + ("" if i == 0 else f" {i + 1}")


class Window:
    """The play-area grids and the helpers build_terrain.py passes in."""

    def __init__(self, ht, sl, psr, ill, ear, albedo, land_xz, point, drive_near, terrain, site_latlon,
                 existing):
        self.ht, self.sl, self.psr, self.ill, self.ear, self.albedo = ht, sl, psr, ill, ear, albedo
        self.n = ht.shape[0]
        self.half = self.n // 2
        yy, xx = np.mgrid[0:self.n, 0:self.n]
        self.X = (xx - self.half) * RES
        self.Z = (yy - self.half) * RES
        self.land = land_xz
        self.D = np.hypot(self.X - land_xz[0], self.Z - land_xz[1])
        self.point = point  # point(x, z, name, **extra) -> feature dict (as build_terrain's feature())
        self.drive_near = drive_near  # drive_near(x, z, radius_m, mask=None) -> (length_m, (x, z)) or (None, None)
        self.terrain = terrain  # measure_legs.Terrain with the game's height grids, for horizon tests
        self.site_latlon = site_latlon
        self.existing = existing  # build_terrain features so far

    def rc(self, x, z):
        return int(round(z / RES + self.half)), int(round(x / RES + self.half))

    def xz(self, r, c):
        return float((c - self.half) * RES), float((r - self.half) * RES)

    def outline(self, field, level, mask, max_pts=48):
        cs = measure.find_contours(np.where(ndimage.binary_dilation(mask, iterations=3), field, 0), level)
        if not cs:
            return []
        cmax = max(cs, key=len)
        step = max(1, len(cmax) // max_pts)
        return [[round((c - self.half) * RES), round((r - self.half) * RES)] for r, c in cmax[::step]]


# =============================================================================
# P1: cold traps
# =============================================================================


def max_sun_elevation(az_deg, lat_deg, lon_deg):
    """Highest the Sun's center ever gets at an azimuth, over the 18.6-year cycle (subsolar lat -1.54)."""
    lat, sub = math.radians(lat_deg), math.radians(-SUBSOLAR_LAT_MAX)
    s = math.sin(lat) * math.sin(sub) + math.cos(lat) * math.cos(sub) * np.cos(np.radians(az_deg - lon_deg))
    return np.degrees(np.arcsin(s))


def horizon_psr(w: Window, mask):
    """5 m horizon check: sample points (every COLD_HORIZON_STEP m) around the patch where terrain hides the
    whole Sun disc at every azimuth, for the highest Sun of the 18.6-year cycle."""
    rows, cols = np.nonzero(ndimage.binary_dilation(mask, iterations=int(40 / RES)))
    x0, x1 = w.X[0, cols.min()], w.X[0, cols.max()]
    z0, z1 = w.Z[rows.min(), 0], w.Z[rows.max(), 0]
    xs = np.arange(math.floor(x0 / 10) * 10, x1 + 1, COLD_HORIZON_STEP)
    zs = np.arange(math.floor(z0 / 10) * 10, z1 + 1, COLD_HORIZON_STEP)
    gx, gz = np.meshgrid(xs, zs)
    x, z = gx.ravel(), gz.ravel()
    lat, lon = w.site_latlon
    az = np.arange(0, 360, COLD_HORIZON_AZ_STEP)
    need = max_sun_elevation(az, lat, lon) + SUN_RADIUS_DEG
    eye = w.terrain.height_at(x, z) + 0.01
    margin = np.full(len(x), np.inf)
    for a, el in zip(az, need):
        d = (math.sin(math.radians(a)), -math.cos(math.radians(a)))
        t = math.tan(math.radians(el))
        ht = w.terrain._march(x, z, eye, d, t, 0.0)
        margin = np.minimum(margin, np.degrees(np.arctan(ht)) - el)
    psr = margin > 0
    if not psr.any():
        return {"permanentShadowArea_m2": 0, "centroidLocal": None, "sampling_m": COLD_HORIZON_STEP}
    return {"permanentShadowArea_m2": int(psr.sum() * COLD_HORIZON_STEP ** 2),
            "centroidLocal": {"x": round(float(x[psr].mean())), "z": round(float(z[psr].mean()))},
            "sampling_m": COLD_HORIZON_STEP}


def cold_traps(w: Window, psr_native):
    """psr_native(mask) -> number of native 60 m PSR pixels (fraction >= 0.5) whose centers fall in mask."""
    lab, n = ndimage.label(w.psr >= 0.5, structure=np.ones((3, 3)))
    ex = w.existing
    rocky1 = next((f for f in ex.get("rockyAreas") or [] if f["name"] == "Rocky area 1"), None)
    shadow = ex.get("shadowedCrater")
    out = []
    for b in range(1, n + 1):
        m = lab == b
        area = float(m.sum() * RES * RES)
        if area < COLD_MIN_AREA:
            continue
        cx, cz = float(w.X[m].mean()), float(w.Z[m].mean())
        it = {"x": cx, "z": cz, "mask": m, "area": area}
        if shadow and m[w.rc(shadow["centroidLocal"]["x"], shadow["centroidLocal"]["z"])]:
            it.update(id="cold-trap-shadowed-crater", name="Shadowed crater")
        elif rocky1 and math.hypot(cx - rocky1["local"]["x"], cz - rocky1["local"]["z"]) <= rocky1["radius_m"]:
            it.update(id="cold-trap-rocky-area-1", name="Rocky area 1 cold patch")
        out.append(it)
    name_by_direction(out, w.land, "cold-trap", "{} cold trap")
    feats = []
    for it in sorted(out, key=lambda it: math.hypot(it["x"] - w.land[0], it["z"] - w.land[1])):
        m = it["mask"]
        ring = ndimage.binary_dilation(m, iterations=int(40 / RES)) & ~m  # up to 40 m outside the patch
        dl, dp = w.drive_near(it["x"], it["z"], 600.0, ring)
        r, c = w.rc(it["x"], it["z"])
        small = it["area"] < COLD_HORIZON_MAX_AREA
        f = w.point(it["x"], it["z"], it["name"])
        f = {"id": it["id"], "name": it["name"],
             "centroidLocal": f["local"],
             "outlineLocal_xz": w.outline(w.psr, 0.5, m),
             "area_m2": round(it["area"]),
             "maxPsrFraction": round(float(w.psr[m].max()), 2),
             "sourcePixels60m": psr_native(m),
             "distanceFromLanding_m": f["distanceFromLanding_m"],
             "driveDistanceFromLanding_m": dl,
             "drivePoint": {"x": dp[0], "z": dp[1]} if dp else None,
             "avgIllumination": round(float(w.ill[m].mean()), 3),
             "earthVisibility": round(float(w.ear[m].mean()), 3),
             "horizonCheck5m": horizon_psr(w, m) if small else None}
        feats.append(f)
    return feats


# =============================================================================
# P2: young craters
# =============================================================================


def crater_candidates(w: Window):
    """Centers of local depressions: plane-invariant ring-minus-center depth, best over radii 20 to 80 m."""
    from scipy.signal import fftconvolve

    half_w = int((CRATER_MAX_DIST + 250) / RES)
    lr, lc = w.rc(*w.land)
    r0, r1 = max(lr - half_w, 0), min(lr + half_w + 1, w.n)
    c0, c1 = max(lc - half_w, 0), min(lc + half_w + 1, w.n)
    h = w.ht[r0:r1, c0:c1]
    hs = ndimage.gaussian_filter(h, 1)
    best = np.full(h.shape, -np.inf)
    for R in np.arange(20, 81, 5):
        rp = R / RES
        k = int(np.ceil(rp * 1.15)) + 1
        yy, xx = np.mgrid[-k:k + 1, -k:k + 1]
        d = np.hypot(yy, xx)
        ker = ((d >= 0.9 * rp) & (d <= 1.1 * rp)).astype(float)
        ker /= ker.sum()
        best = np.maximum(best, (fftconvolve(h, ker, mode="same") - hs) / (2 * R))
    pk = (best == ndimage.maximum_filter(best, 11)) & (best >= 0.03) & (w.D[r0:r1, c0:c1] <= CRATER_MAX_DIST + 50)
    rr, cc = np.nonzero(pk)
    order = np.argsort(-best[rr, cc])
    return [(int(rr[i] + r0), int(cc[i] + c0)) for i in order]


def crater_shape(w: Window, r, c, hs1, lin):
    """Rim, depth and wall of a depression centered near (r, c), or None if it has no raised rim."""
    q = 3
    sub = hs1[r - q:r + q + 1, c - q:c + q + 1]
    i = np.unravel_index(np.argmin(sub), sub.shape)
    r, c = r - q + int(i[0]), c - q + int(i[1])
    ang = np.radians(np.arange(0, 360, 7.5))
    rs = np.arange(0, 33, dtype=float)  # 0 to 160 m in 5 m steps
    rr = r + np.outer(rs, -np.cos(ang))
    cc = c + np.outer(rs, np.sin(ang))
    hp = ndimage.map_coordinates(w.ht, [rr, cc], order=1)
    # The azimuth mean of a plane at radius r equals its center value, so this profile ignores the regional slope.
    m = ndimage.uniform_filter1d(hp.mean(axis=1), 3, mode="nearest") - hp[0, 0]
    k = int(np.argmax(m[3:19])) + 3  # rim radius 15 to 90 m
    k2 = min(2 * k, 32)
    if k == 18 or m[k:k2 + 1].max() > m[k] + 1e-6:
        return None  # no rim: the ground keeps rising (a hollow or a larger crater's wall)
    R, depth = k * RES, float(m[k])
    A = np.stack([np.ones_like(ang), np.cos(ang), np.sin(ang)], 1)
    coef = np.linalg.lstsq(A, hp[k2], rcond=None)[0]
    regional = math.degrees(math.atan(math.hypot(coef[1], coef[2]) / (k2 * RES)))
    rim = hp[k] - (A @ coef - coef[0]) * k / k2
    comp = float((rim - hp[0, 0] > 0.5 * depth).mean()) if depth > 0 else 0.0
    slp = ndimage.map_coordinates(w.sl, [rr[:k + 1], cc[:k + 1]], order=1)
    ej = None
    if lin is not None:
        nn = 4 * k + 1
        if nn <= r < w.n - nn and nn <= c < w.n - nn:
            yy, xx = np.mgrid[-nn:nn + 1, -nn:nn + 1]
            d = np.hypot(yy, xx) * RES
            win = lin[r - nn:r + nn + 1, c - nn:c + nn + 1]
            ej = float(win[(d >= R) & (d <= 2 * R)].mean() / win[(d >= 2.5 * R) & (d <= 4 * R)].mean())
    x, z = w.xz(r, c)
    return {"x": x, "z": z, "r": r, "c": c, "R": R, "depth": depth, "comp": comp, "regional": regional,
            "wall": float(np.median(slp.max(axis=0))), "wallMax": float(slp.max()), "ejecta": ej}


def young_craters(w: Window):
    hs1 = ndimage.gaussian_filter(w.ht, 1)
    lin = None if w.albedo is None else (w.albedo / 255.0) ** 2.2  # sRGB-ish JPEG back to linear
    found = []
    for r, c in crater_candidates(w):
        q = crater_shape(w, r, c, hs1, lin)
        if q is None:
            continue
        if any(math.hypot(q["x"] - p["x"], q["z"] - p["z"]) < max(q["R"], 30) for p in found):
            continue
        found.append(q)
    keep = [q for q in found
            if CRATER_DIAMETER[0] <= 2 * q["R"] <= CRATER_DIAMETER[1] and q["depth"] >= CRATER_MIN_DEPTH
            and q["depth"] / (2 * q["R"]) >= CRATER_MIN_DD and q["comp"] >= CRATER_MIN_RIM
            and math.hypot(q["x"] - w.land[0], q["z"] - w.land[1]) <= CRATER_MAX_DIST]
    for q in keep:
        q["fresh"] = q["depth"] / (2 * q["R"]) >= FRESH_DD and q["wallMax"] >= FRESH_WALL
    name_by_direction(keep, w.land, "young-crater", "{} crater", first=lambda q: q["fresh"])
    feats = []
    for q in sorted(keep, key=lambda q: math.hypot(q["x"] - w.land[0], q["z"] - w.land[1])):
        dd = q["depth"] / (2 * q["R"])
        dl, dp = w.drive_near(q["x"], q["z"], q["R"] + 60.0)
        f = w.point(q["x"], q["z"], q["name"])
        f = {"id": q["id"], **f}
        f.pop("driveDistanceFromLanding_m", None)
        f.update({
            "radius_m": q["R"], "diameter_m": 2 * q["R"], "depth_m": round(q["depth"], 1),
            "depthToDiameter": round(dd, 3), "rimCompleteness": round(q["comp"], 2),
            "innerWallSlope_deg": round(q["wall"], 1), "innerWallSlopeMax_deg": round(q["wallMax"], 1),
            "regionalSlope_deg": round(q["regional"], 1),
            "ejectaAlbedoRatio": None if q["ejecta"] is None else round(q["ejecta"], 3),
            "freshness": "fresh" if q["fresh"] else "subdued",
            "driveDistanceFromLanding_m": dl,
            "drivePoint": {"x": dp[0], "z": dp[1]} if dp else None,
        })
        feats.append(f)
    return feats


# =============================================================================
# P3: rolled-boulder candidates
# =============================================================================


def boulder_tracks(w: Window, craters):
    hs = ndimage.gaussian_filter(w.ht, 1)
    gy, gx = np.gradient(hs, RES)
    s5 = np.degrees(np.arctan(np.hypot(gx, gy)))
    n = w.n
    offs = np.array([(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)])
    pad = np.pad(hs, 1, mode="edge")
    grade = np.stack([(hs - pad[1 + dr:1 + dr + n, 1 + dc:1 + dc + n]) / (RES * math.hypot(dr, dc))
                      for dr, dc in offs])
    down, up = np.argmax(grade, 0), np.argmin(grade, 0)
    gmax, gmin = grade.max(0), grade.min(0)

    def trace(r, c, downhill, stop_slope):
        r, c = r.copy(), c.copy()
        length = np.zeros(len(r))
        steep = np.zeros(len(r))
        smax = np.zeros(len(r))
        alive = np.ones(len(r), bool)
        for _ in range(80):
            idx = (down if downhill else up)[r, c]
            ok = (gmax[r, c] > 0) if downhill else (gmin[r, c] < 0)
            move = alive & ok & (s5[r, c] >= stop_slope)
            step = RES * np.hypot(*offs[idx].T)
            length[move] += step[move]
            steep[move] += np.where(s5[r, c] > TRACK_WALL_SLOPE, step, 0)[move]
            smax = np.where(move, np.maximum(smax, s5[r, c]), smax)
            r = np.where(move, np.clip(r + offs[idx, 0], 0, n - 1), r)
            c = np.where(move, np.clip(c + offs[idx, 1], 0, n - 1), c)
            alive &= move
            if not alive.any():
                break
        return r, c, length, steep, smax

    seed = (s5 > TRACK_WALL_SLOPE) & (w.D <= TRACK_MAX_DIST + 50)
    sr, sc = np.nonzero(seed)
    fr, fc, ld, std, smd = trace(sr, sc, True, TRACK_FOOT_SLOPE)
    tr, tc, lu, stu, smu = trace(sr, sc, False, TRACK_TOP_SLOPE)
    run, steep, smax = ld + lu, std + stu, np.maximum(smd, smu)
    drop = hs[tr, tc] - hs[fr, fc]
    fx, fz = w.X[fr, fc], w.Z[fr, fc]

    def crater_of(x, z):
        for q in craters:
            if math.hypot(x - q["local"]["x"], z - q["local"]["z"]) <= q["radius_m"]:
                return q
        return None

    cands = []
    for i in range(len(sr)):
        if w.D[fr[i], fc[i]] > TRACK_MAX_DIST:
            continue
        q = crater_of(fx[i], fz[i])
        lo = TRACK_RUN_IN_CRATER if q else TRACK_RUN[0]
        if not (lo <= run[i] <= TRACK_RUN[1]):
            continue
        rank = (2 if q and q["freshness"] == "fresh" else 1 if q else 0, steep[i] * drop[i])
        cands.append((rank, i, q))
    cands.sort(key=lambda t: t[0], reverse=True)
    chosen = []
    for rank, i, q in cands:
        if all(math.hypot(fx[i] - fx[j], fz[i] - fz[j]) > TRACK_SEP for _, j, _ in chosen):
            chosen.append((rank, i, q))
        if len(chosen) >= TRACK_COUNT:
            break
    feats = []
    for k, (rank, i, q) in enumerate(chosen):
        x, z = float(fx[i]), float(fz[i])
        tx, tz = w.xz(tr[i], tc[i])
        dl, dp = w.drive_near(x, z, 80.0)
        f = w.point(x, z, f"Boulder track candidate {k + 1}")
        f = {"id": f"boulder-track-{k + 1}", **f}
        f.pop("driveDistanceFromLanding_m", None)
        f.update({
            "wallTop": {"x": tx, "z": tz, "y": round(float(w.ht[tr[i], tc[i]]), 2)},
            "runLength_m": round(float(run[i])), "drop_m": round(float(drop[i]), 1),
            "meanSlope_deg": round(math.degrees(math.atan2(drop[i], run[i])), 1),
            "maxSlope_deg": round(float(smax[i]), 1), "steepLength_m": round(float(steep[i])),
            "youngCrater": q["id"] if q else None,
            "driveDistanceFromLanding_m": dl,
            "drivePoint": {"x": dp[0], "z": dp[1]} if dp else None,
        })
        feats.append(f)
    return feats


# =============================================================================
# P4: low-light patches
# =============================================================================


def low_light_patches(w: Window, traps):
    hs = ndimage.gaussian_filter(w.ht, 2)
    gy, gx = np.gradient(hs, RES)
    s = np.degrees(np.arctan(np.hypot(gx, gy)))
    m = (w.ill < LOW_MAX_ILLUM) & (w.psr < 0.5) & (s < LOW_MAX_SLOPE) & (w.D <= LOW_MAX_DIST)
    m = ndimage.binary_opening(m, iterations=1)
    lab, n = ndimage.label(m)
    cold = w.psr >= 0.5
    dcold = ndimage.distance_transform_edt(~cold) * RES
    items = []
    for b in range(1, n + 1):
        q = lab == b
        area = float(q.sum() * RES * RES)
        if area < LOW_MIN_AREA:
            continue
        dt = ndimage.distance_transform_edt(q)
        r, c = np.unravel_index(np.argmax(dt), dt.shape)
        x, z = w.xz(r, c)
        items.append({"x": x, "z": z, "mask": q, "area": area, "inner": (r, c), "innerR": float(dt[r, c] * RES)})
    name_by_direction(items, w.land, "low-light", "{} low-light slope")
    feats = []
    for it in sorted(items, key=lambda it: math.hypot(it["x"] - w.land[0], it["z"] - w.land[1])):
        q = it["mask"]
        r, c = it["inner"]
        dl, dp = w.drive_near(it["x"], it["z"], 100.0)
        f = w.point(it["x"], it["z"], it["name"])
        near = min(traps, key=lambda t: math.hypot(t["centroidLocal"]["x"] - it["x"], t["centroidLocal"]["z"] - it["z"]),
                   default=None)
        feats.append({
            "id": it["id"], "name": it["name"],
            "centroidLocal": {"x": round(float(w.X[q].mean())), "z": round(float(w.Z[q].mean()))},
            "outlineLocal_xz": w.outline(q.astype(float), 0.5, q),
            "area_m2": round(it["area"]),
            "innerPoint": f["local"], "innerRadius_m": round(it["innerR"]),
            "avgIllumination": round(float(w.ill[q].mean()), 3),
            "minIllumination": round(float(w.ill[q].min()), 3),
            "meanSlope_deg": round(float(s[q].mean()), 1),
            "maxPsrFraction": round(float(w.psr[q].max()), 2),
            "earthVisibility": round(float(w.ear[q].mean()), 3),
            "distanceFromLanding_m": f["distanceFromLanding_m"],
            "driveDistanceFromLanding_m": dl,
            "drivePoint": {"x": dp[0], "z": dp[1]} if dp else None,
            "distanceToPermanentShadow_m": round(float(dcold[r, c])),
            "nearestColdTrap": near["id"] if near else None,
        })
    return feats


# =============================================================================


def site_features(w: Window, psr_native):
    traps = cold_traps(w, psr_native)
    craters = young_craters(w)
    tracks = boulder_tracks(w, craters)
    low = low_light_patches(w, traps)
    notes = [
        "Moon sites features (coldTraps, youngCraters, boulderTrackCandidates, lowLightPatches) come from "
        "game/tools/moon_sites.py; added for review by the pipeline owner.",
        "coldTraps: LOLA 60 m PSR fraction >= 0.5 (bilinear to 5 m), at least 2,000 m^2. Patches of one or two "
        "60 m source pixels (sourcePixels60m) are at the map's resolution limit; horizonCheck5m repeats the test on "
        "the game's 5 m heights (whole Sun disc hidden at every azimuth for the highest Sun of the 18.6-year cycle).",
        "youngCraters: depressions with a raised rim in the 5 m DEM. freshness 'fresh' means depth/diameter >= 0.08 "
        "and an inner wall of at least 30 deg; ejectaAlbedoRatio is the rim-to-2R ring over the 2.5R-4R ring in "
        "albedo.jpg (LROC NAC, shading removed; > 1 is brighter ejecta).",
        "boulderTrackCandidates: placements, not detections (3 m boulders and their tracks are below the data's "
        "resolution). local is the foot where the ground levels off, wallTop the top of the run.",
        "lowLightPatches: average illumination < 15%, outside permanent shadow, slope < 15 deg (heights smoothed "
        "over ~20 m), within 1 km. innerPoint is the point farthest inside the patch.",
    ]
    return {"coldTraps": traps, "youngCraters": craters, "boulderTrackCandidates": tracks,
            "lowLightPatches": low}, notes
