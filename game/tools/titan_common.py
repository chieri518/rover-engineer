"""Shared helpers for the Titan (Shangri-La dunes near Selk) terrain pipeline.

Adapted from mars_common.py (the Moon and Mars scripts stay as they are). Titan
has no rover-scale elevation model, so nothing is downloaded: the terrain is
generated from published measurements (see build_terrain_titan.py).

Titan sphere: IAU mean radius 2574.73 km. Latitudes are planetocentric;
longitudes are given in degrees EAST in every output (Selk at 199 W = 161 E).
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / "titan"  # git-ignored: intermediate files shared by the two Titan scripts
OUT = HERE.parent / "public" / "terrain" / "titan"

TITAN_R = 2574730.0  # m, IAU mean radius (Archinal et al. 2018)


def log(*a):
    print("[titan]", *a, flush=True)


# ---- Local frame -------------------------------------------------------------
# Azimuthal equidistant projection on the Titan sphere, centered on the play-area
# origin: +x east, +y north (projected); game z = -y (south).


def latlon_to_local(lat, lon, lat0, lon0, R=TITAN_R):
    """Spherical azimuthal equidistant: returns (x east, z south) in meters."""
    p, l = np.radians(lat), np.radians(lon)
    p0, l0 = math.radians(lat0), math.radians(lon0)
    cosc = np.sin(p0) * np.sin(p) + np.cos(p0) * np.cos(p) * np.cos(l - l0)
    c = np.arccos(np.clip(cosc, -1, 1))
    k = np.where(c < 1e-12, 1.0, c / np.maximum(np.sin(c), 1e-15))
    x = R * k * np.cos(p) * np.sin(l - l0)
    y = R * k * (np.cos(p0) * np.sin(p) - np.sin(p0) * np.cos(p) * np.cos(l - l0))
    return x, -y


def local_to_latlon(x, z, lat0, lon0, R=TITAN_R):
    y = -np.asarray(z, dtype=float)
    x = np.asarray(x, dtype=float)
    rho = np.hypot(x, y)
    c = rho / R
    p0, l0 = math.radians(lat0), math.radians(lon0)
    with np.errstate(invalid="ignore", divide="ignore"):
        lat = np.arcsin(np.cos(c) * np.sin(p0) + np.where(rho > 0, y * np.sin(c) * np.cos(p0) / rho, 0))
        lon = l0 + np.arctan2(x * np.sin(c), rho * np.cos(p0) * np.cos(c) - y * np.sin(p0) * np.sin(c))
    return np.degrees(lat), np.degrees(lon)


def curvature_drop(x, z, R=TITAN_R):
    """Height of the sphere below the tangent plane at the frame origin."""
    return (np.asarray(x) ** 2 + np.asarray(z) ** 2) / (2 * R)


def write_png16(path: Path, h: np.ndarray):
    lo, hi = math.floor(float(np.nanmin(h))), math.ceil(float(np.nanmax(h)))
    v = np.round((h - lo) / (hi - lo) * 65535).astype(np.uint16)
    Image.fromarray(v).save(path, optimize=True)
    return lo, hi


def write_png8(path: Path, v: np.ndarray):
    Image.fromarray(np.clip(np.round(v), 0, 255).astype(np.uint8)).save(path, optimize=True)


def slope_deg(z: np.ndarray, res: float) -> np.ndarray:
    gy, gx = np.gradient(z, res)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def hillshade(z, res, az=315.0, alt=35.0):
    """az from north (row 0 = north), clockwise."""
    gy, gx = np.gradient(z, res)
    s = np.arctan(np.hypot(gx, gy))
    asp = np.arctan2(-gx, gy)
    a, e = np.radians(az), np.radians(alt)
    return np.clip(np.sin(e) * np.cos(s) + np.cos(e) * np.sin(s) * np.cos(a - asp), 0, 1)


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=float) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def smooth_noise(rng: np.random.Generator, shape, sigma_px: float) -> np.ndarray:
    """Gaussian-filtered white noise, normalized to unit standard deviation (seeded, periodic edges)."""
    from scipy import ndimage

    a = ndimage.gaussian_filter(rng.standard_normal(shape), sigma_px, mode="wrap")
    return a / (a.std() + 1e-12)
