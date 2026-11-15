#!/usr/bin/env python3
"""Build the ground albedo texture for the Mars (Jezero) play area.

Resamples the USGS Mars 2020 HiRISE 25 cm orthomosaic onto the 5 m play-area
grid defined in game/public/terrain/mars/terrain.json, divides out the
topographic shading baked into the images (fitted against heightmap.png), and
writes albedo.jpg plus texture.json next to it.

Run build_terrain_mars.py first (it defines the play area and caches the
orthomosaic window at 2.5 m in raw/mars/). Usage (from game/tools/, in the venv):
    python build_texture_mars.py                    # build
    python build_texture_mars.py --preview out.png  # also render a check image
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from rasterio.warp import Resampling
from scipy import ndimage

from mars_common import ORTHO_CACHE_RES, OUT, URLS, log, ortho_cache, to_local_grid

ORTHO_PAGE = "https://doi.org/10.5066/P9QJDP48"
FIT_SIGMA_M = 400.0  # Gaussian radius of the local lighting fit
REL_MIN = 0.35  # modelled shading below this fraction of flat ground -> division unstable, fill instead
RATIO_CLIP = (0.3, 2.5)
MEAN_ALBEDO = 0.25  # linear albedo the texture's mean maps to (typical dusty Mars surface)
JPEG_QUALITY = 88


def srgb_encode(lin: np.ndarray) -> np.ndarray:
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def read_heightmap(path: Path, lo: float, hi: float) -> np.ndarray:
    a = np.array(Image.open(path)).astype(np.float64)  # 16-bit grayscale
    return lo + a / 65535.0 * (hi - lo)


def remove_shading(I: np.ndarray, Z: np.ndarray, res: float, valid: np.ndarray) -> dict:
    """Divide out the Sun shading predicted from the heights, fitted locally.

    The mosaic blends several HiRISE images (afternoon Sun, 30-60 deg high), so
    around every pixel (Gaussian window FIT_SIGMA_M) the Lambert model
    I = g * (n . s) is fitted as I ~ a/|N| + b*p/|N| + c*q/|N| (p, q the slopes,
    |N| the normal length). Unlike the Moon texture, only the shading relative to
    flat ground (model / a) is divided out, so real brightness differences over
    any distance (dark sand, light-toned rock) stay in the texture."""
    gr, gc = np.gradient(ndimage.gaussian_filter(Z, 0.7), res)
    p, q = gc, -gr  # dz/dx (east), dz/dy (north; rows go south)
    nrm = np.sqrt(1 + p * p + q * q)
    F = (1 / nrm, p / nrm, q / nrm)
    w = valid.astype(np.float64)
    s = FIT_SIGMA_M / res

    def gsum(v):
        return ndimage.gaussian_filter(v * w, s)

    A = np.empty(I.shape + (3, 3))
    B = np.empty(I.shape + (3,))
    for i in range(3):
        B[..., i] = gsum(F[i] * I)
        for j in range(i, 3):
            A[..., i, j] = A[..., j, i] = gsum(F[i] * F[j])
    n = gsum(np.ones_like(I))
    A[..., 0, 0] += 1e-9
    A[..., 1, 1] += 1e-3 * n
    A[..., 2, 2] += 1e-3 * n
    coef = np.linalg.solve(A, B[..., None])[..., 0]
    a, b, c = coef[..., 0], coef[..., 1], coef[..., 2]
    rel = (a * F[0] + b * F[1] + c * F[2]) / np.where(a > 0, a, np.inf)
    good = valid & (rel >= REL_MIN)
    ratio = np.where(good, I / np.maximum(rel, REL_MIN), np.nan)
    return {"ratio": ratio, "good": good, "coef": coef,
            "sun_el": np.degrees(np.arctan2(a, np.hypot(b, c))),
            "sun_az": np.degrees(np.arctan2(-b, -c)) % 360}


def best_shift(I, Z, res, coef, max_px=3):
    """Alignment check: shift of the height shading model that best matches the image."""
    gr, gc = np.gradient(ndimage.gaussian_filter(Z, 0.7), res)
    nrm = np.sqrt(1 + gc * gc + gr * gr)
    S = (coef[..., 0] + coef[..., 1] * gc - coef[..., 2] * gr) / nrm
    m = 20
    out = {}
    for dr in range(-max_px, max_px + 1):
        for dc in range(-max_px, max_px + 1):
            a = S[m + dr:-m + dr or None, m + dc:-m + dc or None]
            b = I[m:-m, m:-m]
            ok = np.isfinite(a) & np.isfinite(b)
            out[(dr, dc)] = float(np.corrcoef(a[ok], b[ok])[0, 1])
    best = max(out, key=out.get)
    return best, out[best], out[(0, 0)]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--preview", type=Path)
    args = ap.parse_args()
    meta = json.loads((args.out / "terrain.json").read_text())
    lat0, lon0 = meta["frame"]["originLatLon"]
    pa = meta["playArea"]
    half, res, n = pa["size_m"] / 2, pa["pixel_m"], pa["samples"]

    hm = pa["files"]["heightmap"]
    Z = read_heightmap(args.out / hm["file"], hm["min_m"], hm["max_m"])
    assert Z.shape == (n, n)

    src = ortho_cache(lat0, lon0, half)
    I = to_local_grid(src, lat0, lon0, half, res, Resampling.average)
    valid = np.isfinite(I) & (I > 0)
    log(f"ortho: {valid.mean():.1%} of the play area has image data")
    I = np.where(valid, I, np.nan)

    r = remove_shading(np.nan_to_num(I), Z, res, valid)
    shift, corr_best, corr0 = best_shift(np.where(valid, I, np.nan), Z, res, r["coef"])
    log(f"alignment: best shift {shift} px, corr {corr_best:.3f} (unshifted {corr0:.3f})")
    sun_el = np.percentile(r["sun_el"][valid], [10, 50, 90])
    sun_az = np.percentile(r["sun_az"][valid], [10, 50, 90])
    log(f"fitted Sun elevation p10/50/90 {np.round(sun_el, 1)}, azimuth {np.round(sun_az, 1)}")

    ratio = r["ratio"] / np.nanmean(r["ratio"])
    ratio = np.clip(ratio, *RATIO_CLIP)
    holes = ~np.isfinite(ratio)
    if holes.any():
        idx = ndimage.distance_transform_edt(holes, return_distances=False, return_indices=True)
        ratio = ratio[tuple(idx)]
    lin = MEAN_ALBEDO * ratio
    v = np.round(srgb_encode(lin) * 255).astype(np.uint8)
    out_jpg = args.out / "albedo.jpg"
    Image.fromarray(v, mode="L").save(out_jpg, quality=JPEG_QUALITY, optimize=True)
    size = out_jpg.stat().st_size
    log(f"wrote {out_jpg} ({size / 1e6:.2f} MB), filled {holes.mean():.2%}")

    edge = half + res / 2
    tex = {
        "version": 1,
        "generated": dt.date.today().isoformat(),
        "generator": "game/tools/build_texture_mars.py",
        "playArea": {
            "file": "albedo.jpg",
            "encoding": "8-bit grayscale JPEG, sRGB-encoded linear albedo",
            "size_px": [n, n],
            "pixel_m": res,
            "grid": f"Same grid as heightmap.png: pixel (col, row) is centered on heightmap vertex (col, row), i.e. "
                    f"x = (col - {n // 2}) * {res}, z = (row - {n // 2}) * {res}. Row 0 = -z (north), column 0 = -x "
                    f"(west). The image covers x, z in [-{edge}, {edge}] m.",
            "uv": f"u = (x + {edge}) / {2 * edge:g}, v_down = (z + {edge}) / {2 * edge:g} (v_down = 0 at the top "
                  "row). With a PlaneGeometry spanning the play area the error is at most half a texel.",
            "values": f"linear_albedo = srgb_to_linear(value / 255). Mean = {MEAN_ALBEDO} (value "
                      f"{int(round(float(srgb_encode(np.array(MEAN_ALBEDO)) * 255)))}). Grayscale: tint it in the "
                      f"shader. To use it as a multiplier on a base color, divide the decoded value by {MEAN_ALBEDO}.",
            "filled": f"{holes.mean():.2%} of pixels (no image data or grazing modelled light) are copied from "
                      "the nearest real pixel.",
            "bytes": size,
        },
        "source": {
            "dataset": "Mars 2020 HiRISE orthorectified image mosaic, 25 cm/px "
                       "(JEZ_hirise_soc_007_orthoMosaic_25cm_Ortho_blend120), area-averaged to 2.5 m then 5 m",
            "url": URLS["hirise_ortho"],
            "page": ORTHO_PAGE,
            "citation": "Fergason, R.L., Galuszka, D.M., Hare, T.M. (2020), High-Resolution Imaging Science "
                        "Experiment Orthorectified Image Mosaic for Mars 2020 Surface Operations, U.S. Geological "
                        "Survey data release, doi:10.5066/P9QJDP48. HiRISE: McEwen, A.S., et al. (2007), J. "
                        "Geophys. Res. 112, E05S02",
            "credit": "NASA/JPL-Caltech/University of Arizona/USGS",
            "license": "Public domain (USGS / NASA)",
            "shadingDem": "heightmap.png (USGS Mars 2020 TRN HiRISE 1 m DTM at 5 m), same grid",
        },
        "alignment": {"bestShift_px": {"rows": shift[0], "cols": shift[1]}, "corrAtBest": round(corr_best, 4),
                      "corrUnshifted": round(corr0, 4)},
        "processing": [
            "Area-averaged from 25 cm to 2.5 m (cached) and resampled to the play-area grid (azimuthal "
            "equidistant, 5 m) by area averaging.",
            f"Shading removal: local Lambert fit I ~ g * (n . s) with n from heightmap.png, Gaussian-weighted least "
            f"squares (sigma {FIT_SIGMA_M:.0f} m). Only the shading relative to flat ground is divided out, so real "
            "albedo differences (dark sand, light-toned rock) are kept. Fitted Sun elevation p10/p50/p90 = "
            f"{[round(float(v), 1) for v in sun_el]} deg, azimuth (from north toward east) "
            f"{[round(float(v), 1) for v in sun_az]} deg.",
            f"Scaled so the mean is linear albedo {MEAN_ALBEDO}, clipped to {RATIO_CLIP[0]}..{RATIO_CLIP[1]} times "
            "the mean.",
        ],
        "limits": [
            "Absolute albedo is not calibrated: the mosaic is stretched per image; only relative brightness is real.",
            "Rocks, ripples and craters smaller than ~20 m keep the shading and shadows of the original afternoon "
            "Sun (from the west), because the 5 m heights cannot model them.",
            "Grayscale only (HiRISE red band).",
        ],
    }
    (args.out / "texture.json").write_text(json.dumps(tex, indent=2) + "\n")

    if args.preview:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(1, 2, figsize=(20, 10))
        ax[0].imshow(I, cmap="gray", vmin=np.nanpercentile(I, 1), vmax=np.nanpercentile(I, 99))
        ax[0].set_title("orthomosaic on the play grid")
        ax[1].imshow(v, cmap="gray", vmin=0, vmax=255)
        ax[1].set_title("albedo.jpg")
        plt.tight_layout()
        plt.savefig(args.preview, dpi=60)
        log(f"preview: {args.preview}")


if __name__ == "__main__":
    main()
