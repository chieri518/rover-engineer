"""Shared helpers for the Mars (Jezero) terrain pipeline.

Helpers here are adapted from build_terrain.py (the Moon script stays as is).
Every Mars input product uses the MOLA sphere R = 3396190 m, so latitudes are
planetocentric and longitudes are degrees east.
"""

from __future__ import annotations

import math
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.crs import CRS
from rasterio.warp import Resampling, reproject
from rasterio.windows import from_bounds

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / "mars"
OUT = HERE.parent / "public" / "terrain" / "mars"

MARS_R = 3396190.0  # sphere of every product used (MOLA / Mars 2000 sphere), m

TRN = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn"
URLS = {
    # USGS Mars 2020 TRN release (Fergason et al. 2020). Uncompressed strips: windows are read over HTTP.
    "hirise_dtm": f"{TRN}/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif",
    "hirise_ortho": f"{TRN}/HiRISE/JEZ_hirise_soc_007_orthoMosaic_25cm_Ortho_blend120.tif",
    # JPL crater-wide CTX DEM (20 m, true scale at 18.4663 N).
    "ctx_dem": f"{TRN}/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif",
    # MOLA global 463 m (USGS Astrogeology), for the far ring outside the CTX DEM.
    "mola": "https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",
}


def log(*a):
    print("[mars]", *a, flush=True)


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


def gdal_env():
    return rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="5",
                        GDAL_HTTP_RETRY_DELAY="2", CPL_VSIL_CURL_CHUNK_SIZE=4 << 20,
                        GDAL_CACHEMAX=1024)


def remote_window(url: str, bounds, decimate: float, dest: Path, dtype="float32",
                  resampling=Resampling.average, chunk_rows: int = 2048) -> Path:
    """Read a window (in the source CRS) of a remote GeoTIFF and cache it as a local GeoTIFF.

    Reads in row chunks so memory stays modest; decimate > 1 area-averages."""
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    log(f"windowed read of {url.rsplit('/', 1)[-1]} (decimate {decimate}) -> {dest.name}")
    with gdal_env(), rasterio.open("/vsicurl/" + url) as src:
        win = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
        win = win.intersection(rasterio.windows.Window(0, 0, src.width, src.height))
        w, h = int(round(win.width / decimate)), int(round(win.height / decimate))
        tr = src.window_transform(win) * rasterio.Affine.scale(win.width / w, win.height / h)
        nod = src.nodata
        is_float = np.dtype(dtype).kind == "f"
        prof = dict(driver="GTiff", dtype=dtype, count=1, width=w, height=h, crs=src.crs, transform=tr,
                    nodata=np.nan if is_float else 0, tiled=True, blockxsize=256, blockysize=256,
                    compress="deflate", predictor=3 if is_float else 2, BIGTIFF="IF_SAFER")
        tmp = dest.with_suffix(".part.tif")
        with rasterio.open(tmp, "w", **prof) as o:
            out_rows_per_chunk = max(1, int(chunk_rows // decimate))
            r0 = 0
            while r0 < h:
                r1 = min(h, r0 + out_rows_per_chunk)
                sw = rasterio.windows.Window(win.col_off, win.row_off + r0 * win.height / h,
                                             win.width, (r1 - r0) * win.height / h)
                a = src.read(1, window=sw, out_shape=(r1 - r0, w), resampling=resampling,
                             masked=nod is not None)
                if is_float:
                    a = np.ma.filled(a.astype(np.float32), np.nan) if np.ma.isMaskedArray(a) else a.astype(np.float32)
                    if nod is not None:
                        a[a < -1e30] = np.nan
                else:
                    a = np.ma.filled(a, 0) if np.ma.isMaskedArray(a) else a
                o.write(a.astype(dtype), 1, window=rasterio.windows.Window(0, r0, w, r1 - r0))
                r0 = r1
                log(f"  {r0}/{h} rows")
        tmp.rename(dest)
    return dest


# ---- Local frame -------------------------------------------------------------
# Azimuthal equidistant projection on the Mars sphere, centered on the play-area
# origin: +x east, +y north (projected); game z = -y (south).


def local_crs(lat0: float, lon0: float) -> CRS:
    return CRS.from_proj4(f"+proj=aeqd +lat_0={lat0} +lon_0={lon0} +x_0=0 +y_0=0 +R={MARS_R} +units=m +no_defs")


def latlon_to_local(lat, lon, lat0, lon0):
    """Spherical azimuthal equidistant: returns (x east, z south) in meters."""
    p, l = np.radians(lat), np.radians(lon)
    p0, l0 = math.radians(lat0), math.radians(lon0)
    cosc = np.sin(p0) * np.sin(p) + np.cos(p0) * np.cos(p) * np.cos(l - l0)
    c = np.arccos(np.clip(cosc, -1, 1))
    k = np.where(c < 1e-12, 1.0, c / np.maximum(np.sin(c), 1e-15))
    x = MARS_R * k * np.cos(p) * np.sin(l - l0)
    y = MARS_R * k * (np.cos(p0) * np.sin(p) - np.sin(p0) * np.cos(p) * np.cos(l - l0))
    return x, -y


def local_to_latlon(x, z, lat0, lon0):
    y = -np.asarray(z, dtype=float)
    x = np.asarray(x, dtype=float)
    rho = np.hypot(x, y)
    c = rho / MARS_R
    p0, l0 = math.radians(lat0), math.radians(lon0)
    with np.errstate(invalid="ignore", divide="ignore"):
        lat = np.arcsin(np.cos(c) * np.sin(p0) + np.where(rho > 0, y * np.sin(c) * np.cos(p0) / rho, 0))
        lon = l0 + np.arctan2(x * np.sin(c), rho * np.cos(p0) * np.cos(c) - y * np.sin(p0) * np.sin(c))
    return np.degrees(lat), np.degrees(lon)


def curvature_drop(x, z):
    """Height of the sphere below the tangent plane at the frame origin."""
    return (np.asarray(x) ** 2 + np.asarray(z) ** 2) / (2 * MARS_R)


def to_local_grid(src_path: Path, lat0: float, lon0: float, half: float, res: float,
                  resampling=Resampling.average, dtype=np.float64) -> np.ndarray:
    """Resample a cached raster onto the square, vertex-centered local grid.

    Row 0 is the northern edge (z = -half), column 0 the western edge (x = -half)."""
    n = int(round(2 * half / res)) + 1
    dst_tr = rasterio.transform.from_origin(-half - res / 2, half + res / 2, res, res)
    out = np.full((n, n), np.nan, dtype=dtype)
    with rasterio.open(src_path) as src:
        a = src.read(1).astype(dtype)
        nod = src.nodata
        if nod is not None and not np.isnan(nod):
            a[a == nod] = np.nan
        reproject(a, out, src_transform=src.transform, src_crs=src.crs, src_nodata=np.nan,
                  dst_transform=dst_tr, dst_crs=local_crs(lat0, lon0), dst_nodata=np.nan,
                  resampling=resampling)
    return out


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


def read_shapefile(path: Path):
    """Minimal reader for Point (1) and Polygon (5) shapefiles (no attributes).

    Returns a list of points [(lon, lat)] or a list of polygons, each a list of rings
    (arrays of (lon, lat))."""
    import struct

    data = path.read_bytes()
    stype = struct.unpack("<i", data[32:36])[0]
    out, i = [], 100
    while i + 8 <= len(data):
        length = struct.unpack(">i", data[i + 4:i + 8])[0] * 2
        rec = data[i + 8:i + 8 + length]
        i += 8 + length
        t = struct.unpack("<i", rec[:4])[0]
        if t == 0:
            continue
        if stype == 1:
            out.append(struct.unpack("<2d", rec[4:20]))
        elif stype == 5:
            nparts, npts = struct.unpack("<2i", rec[36:44])
            parts = list(struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])) + [npts]
            pts = np.frombuffer(rec, dtype="<f8", count=2 * npts, offset=44 + 4 * nparts).reshape(-1, 2)
            out.append([pts[parts[j]:parts[j + 1]] for j in range(nparts)])
        else:
            raise ValueError(f"{path.name}: unsupported shape type {stype}")
    return out


ORTHO_CACHE_RES = 2.5  # m; the 25 cm orthomosaic is area-averaged 10x when cached


def ortho_cache(lat0: float, lon0: float, half: float) -> Path:
    """Cache the HiRISE orthomosaic over the play area (plus 150 m) at 2.5 m.

    The 3.4 GB mosaic has no overviews, so this reads every 25 cm tile in the
    window over HTTP (about 500 MB, several minutes on the first run)."""
    from rasterio.warp import transform_bounds

    dest = RAW / f"hirise_ortho_2p5m_{lat0:.4f}_{lon0:.4f}.tif"
    if dest.exists():
        return dest
    with gdal_env(), rasterio.open("/vsicurl/" + URLS["hirise_ortho"]) as s:
        ocrs = s.crs
    b = transform_bounds(local_crs(lat0, lon0), ocrs, -half - 150, -half - 150, half + 150, half + 150,
                         densify_pts=50)
    return remote_window(URLS["hirise_ortho"], b, ORTHO_CACHE_RES / 0.25, dest, dtype="uint8", chunk_rows=4096)


def ripple_coherence(ortho: np.ndarray) -> np.ndarray:
    """Orientation coherence of the image texture (0..1), high on ripple fields.

    Megaripples are long parallel crests a few meters apart, so the structure
    tensor of the 2.5 m image is strongly one-directional over ~15 m, unlike
    blocky bedrock or smooth plains."""
    from scipy import ndimage

    I = np.nan_to_num(ortho, nan=float(np.nanmean(ortho)))
    gy, gx = np.gradient(ndimage.gaussian_filter(I, 1.0))
    jxx = ndimage.gaussian_filter(gx * gx, 6)
    jyy = ndimage.gaussian_filter(gy * gy, 6)
    jxy = ndimage.gaussian_filter(gx * gy, 6)
    return np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-9)
