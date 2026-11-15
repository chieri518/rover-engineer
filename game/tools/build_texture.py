#!/usr/bin/env python3
"""Build the ground albedo texture for the Rover Engineer play area.

Crops NASA's LROC NAC low-Sun mosaic of the de Gerlache rim (5 m/px version)
to the 8 km play area defined in game/public/terrain/terrain.json, removes the
baked-in low-Sun shading using the LOLA Site11 5 m DEM, fills shadows with a
neutral value and writes albedo.jpg plus texture.json.

Run build_terrain.py first (it defines the play-area window and downloads the
Site11 DEM into raw/).

Usage (from game/tools/, inside the venv):
    python build_texture.py                       # download if needed, build
    python build_texture.py --preview out.png     # also render a check image

Everything is offline; the game never calls these URLs.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import from_origin
from rasterio.windows import from_bounds
from scipy import ndimage

from build_terrain import OUT, RAW, URLS, fetch, hillshade

LROC = ("https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/NAC_ROI/"
        "DEGERRIMLO1/")
NAC_PRODUCT = "NAC_ROI_DEGERRIMLO1_P885S2933"
NAC_URL = LROC + NAC_PRODUCT + "_5M.IMG"  # 176 MB, 16-bit PDS3 image with attached label
NAC_PAGE = "https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_DEGERRIMLO1"

MARGIN_PX = 100  # read 500 m beyond the play area so the local fits have no edge effects
FIT_SIGMA_PX = 30  # Gaussian radius of the local lighting fit (150 m)
SHADOW_FRAC = 0.25  # pixel darker than this fraction of the local mean -> shadow
REL_MIN = 0.15  # modelled shading below this fraction of flat ground -> division unstable, fill instead
RATIO_CLIP = (0.25, 3.0)
FILL_OFFSETS_PX = (37, 71, 113, 167, 241, 331)  # hole filling: copy distances (5 m px)
MEAN_ALBEDO = 0.22  # linear albedo the texture's mean maps to (typical highland regolith)
JPEG_QUALITY = 90


def log(*a):
    print("[texture]", *a, flush=True)


def srgb_encode(lin: np.ndarray) -> np.ndarray:
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def read_window(path: Path, transform, shape, fill) -> np.ndarray:
    """Read a pixel-aligned window (same 5 m grid) with boundless fill."""
    with rasterio.open(path) as s:
        assert s.res == (5.0, 5.0), f"{path.name}: expected 5 m pixels"
        b = rasterio.transform.array_bounds(*shape, transform)
        win = from_bounds(*b, transform=s.transform)  # (west, south, east, north)
        off = (win.col_off, win.row_off)
        assert all(abs(v - round(v)) < 1e-6 for v in off), f"{path.name}: grid not aligned to play area"
        win = win.round_offsets().round_lengths()
        a = s.read(1, window=win, boundless=True, fill_value=fill).astype(np.float64)
        if s.scales[0] != 1 or s.offsets[0] != 0:
            a = a * s.scales[0] + s.offsets[0]
    return a


def remove_shading(I: np.ndarray, Z: np.ndarray, valid: np.ndarray) -> dict:
    """Divide out the Sun shading predicted from the DEM, fitted locally.

    The mosaic merges images lit from three different Sun azimuths, so instead
    of one global Sun vector we fit, around every pixel (Gaussian window
    FIT_SIGMA_PX), the Lambert model  I = g * (n . s)  as a linear regression
    I ~ a/|N| + b*p/|N| + c*q/|N|  with p, q the DEM slopes and |N| the normal
    length; (a, b, c) = gain times the Sun vector. I / model is the albedo
    relative to the local mean. Shadows, no-data and pixels where the model
    predicts grazing light (unstable division) are filled from neighbours.
    """
    gr, gc = np.gradient(ndimage.gaussian_filter(np.nan_to_num(Z), 0.7), 5.0)
    p, q = gc, -gr  # dz/dX (east), dz/dY (north; rows go south)
    nrm = np.sqrt(1 + p * p + q * q)
    F = (1 / nrm, p / nrm, q / nrm)

    def gsum(v, w, s):
        return ndimage.gaussian_filter(v * w, s)

    def gmean(v, w, s):
        return gsum(v, w, s) / np.maximum(gsum(np.ones_like(v), w, s), 1e-9)

    lit = valid & (I > SHADOW_FRAC * gmean(I, valid.astype(np.float64), 60))
    w = lit.astype(np.float64)
    A = np.empty(I.shape + (3, 3))
    B = np.empty(I.shape + (3,))
    for i in range(3):
        B[..., i] = gsum(F[i] * I, w, FIT_SIGMA_PX)
        for j in range(i, 3):
            A[..., i, j] = A[..., j, i] = gsum(F[i] * F[j], w, FIT_SIGMA_PX)
    n = gsum(np.ones_like(I), w, FIT_SIGMA_PX)
    A[..., 0, 0] += 1e-9
    A[..., 1, 1] += 1e-4 * n  # small ridge: flat areas -> no slope correction
    A[..., 2, 2] += 1e-4 * n
    coef = np.linalg.solve(A, B[..., None])[..., 0]
    a, b, c = coef[..., 0], coef[..., 1], coef[..., 2]
    S = a * F[0] + b * F[1] + c * F[2]
    rel = np.where(a > 0, S / np.where(a > 0, a, 1), 0)  # shading relative to flat ground
    ratio = np.clip(I / np.where(S > 0, S, np.inf), *RATIO_CLIP)

    good = ~ndimage.binary_dilation(~lit | (rel < REL_MIN), iterations=2)
    data = ndimage.gaussian_filter(good.astype(np.float64), 1.5) * good  # feather the fill edges
    return {
        "albedo_rel": data * ratio + (1 - data) * fill_from_neighbours(ratio, data > 0.99),
        "data": data,
        "lit": lit,
        "F": F,
        "coef": coef,
        "sun_el": np.degrees(np.arctan2(a, np.hypot(b, c))),
        "sun_az": np.degrees(np.arctan2(-b, -c)) % 360,  # toward the Sun, from grid north (+Y) to +X
    }


def fill_from_neighbours(v: np.ndarray, good: np.ndarray) -> np.ndarray:
    """Fill holes by copying real texture from nearby lit ground at fixed offsets.

    For each hole pixel, the first offset (shortest first) whose source pixel is
    real data wins. Keeps holes from looking like flat paint; the mean stays
    neutral. Anything still unfilled gets 1.0 (neutral).
    """
    out = np.ones_like(v)
    todo = ~good
    for dist in FILL_OFFSETS_PX:
        for ang in range(0, 360, 45):
            if not todo.any():
                return out
            dr = int(round(dist * math.sin(math.radians(ang + dist))))
            dc = int(round(dist * math.cos(math.radians(ang + dist))))
            src_v = np.roll(v, (dr, dc), axis=(0, 1))
            src_ok = np.roll(good, (dr, dc), axis=(0, 1))
            take = todo & src_ok
            out[take] = src_v[take]
            todo &= ~take
    return out


def best_shift(I, r, max_px=3):
    """Alignment check: shift (rows, cols) of the DEM shading model that best matches the image."""
    m = MARGIN_PX
    a, b, c = (r["coef"][..., k] for k in range(3))
    sl0 = np.s_[m:-m, m:-m]
    mk = r["lit"][sl0]
    out = {}
    for dr in range(-max_px, max_px + 1):
        for dc in range(-max_px, max_px + 1):
            sl1 = np.s_[m + dr:I.shape[0] - m + dr, m + dc:I.shape[1] - m + dc]
            S = a[sl0] * r["F"][0][sl1] + b[sl0] * r["F"][1][sl1] + c[sl0] * r["F"][2][sl1]
            out[(dr, dc)] = np.corrcoef(S[mk], I[sl0][mk])[0, 1]
    best = max(out, key=out.get)
    return best, out[best], out[(0, 0)]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preview", type=Path, help="write a check image here (needs matplotlib)")
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--no-shift-check", action="store_true", help="skip the alignment search (faster)")
    args = ap.parse_args()

    meta = json.loads((args.out / "terrain.json").read_text())
    X0, Y0 = meta["frame"]["originPolarStereo"]["X"], meta["frame"]["originPolarStereo"]["Y"]
    pa = meta["playArea"]
    res, N = pa["pixel_m"], pa["samples"]
    assert res == 5 and N % 2 == 1
    half = N // 2
    # Pixel-area grid whose pixel centers are the heightmap vertices, plus a margin.
    M = MARGIN_PX
    T = from_origin(X0 - (half + M + 0.5) * res, Y0 + (half + M + 0.5) * res, res, res)
    shape = (N + 2 * M, N + 2 * M)

    nac_path = fetch(NAC_URL, RAW / NAC_URL.rsplit("/", 1)[-1])
    dem_path = fetch(URLS["site_dem"], RAW / URLS["site_dem"].rsplit("/", 1)[-1])
    I = read_window(nac_path, T, shape, 0)
    Z = read_window(dem_path, T, shape, np.nan)
    valid = (I > 0) & np.isfinite(Z)
    inner = np.s_[M:-M, M:-M]
    log(f"NAC window {shape}, no-data in play area {(~(I[inner] > 0)).mean():.1%}")

    # Same grid as heightmap.png? Compare with the decoded heightmap minus curvature.
    hm = np.asarray(Image.open(args.out / pa["files"]["heightmap"]["file"])).astype(np.float64)
    f = pa["files"]["heightmap"]
    hm = f["min_m"] + hm / 65535 * (f["max_m"] - f["min_m"])
    xs = (np.arange(N) - half) * res
    hm_elev = hm + (xs[None, :] ** 2 + xs[:, None] ** 2) / (2 * 1737400.0)
    d = np.nanmedian(np.abs(hm_elev - Z[inner]))
    log(f"heightmap vs Site11 window: median |diff| {d:.3f} m")
    assert d < 0.5, "play-area window does not match heightmap.png"

    r = remove_shading(I, Z, valid)
    shift = None
    if not args.no_shift_check:
        (dr, dc), corr, corr0 = best_shift(I, r)
        shift = {"bestShift_px": {"rows": dr, "cols": dc}, "corrAtBest": round(float(corr), 4),
                 "corrUnshifted": round(float(corr0), 4)}
        log(f"alignment: best DEM->image shift {dr},{dc} px (corr {corr:.4f}; unshifted {corr0:.4f})")

    alb, data, lit = (r[k][inner] for k in ("albedo_rel", "data", "lit"))
    filled = data < 0.5
    log(f"filled (shadow / no data / grazing light) {filled.mean():.1%}; albedo ratio p1/p50/p99 "
        f"{np.percentile(alb[~filled], [1, 50, 99]).round(2)}, mean {alb.mean():.3f}")
    sun_az, sun_el = r["sun_az"][inner][lit], r["sun_el"][inner][lit]

    # Encode: linear albedo = MEAN_ALBEDO * ratio, stored as sRGB 8-bit grayscale.
    v = np.round(srgb_encode(MEAN_ALBEDO * alb) * 255).astype(np.uint8)
    out_jpg = args.out / "albedo.jpg"
    Image.fromarray(v, "L").save(out_jpg, quality=JPEG_QUALITY, optimize=True, progressive=True)
    size = out_jpg.stat().st_size
    log(f"wrote {out_jpg.name} {N}x{N}, {size/1e6:.2f} MB")

    neutral = int(np.round(srgb_encode(np.array(MEAN_ALBEDO)) * 255))
    tex = {
        "version": 1,
        "generated": dt.date.today().isoformat(),
        "generator": "game/tools/build_texture.py",
        "playArea": {
            "file": out_jpg.name,
            "encoding": "8-bit grayscale JPEG, sRGB-encoded linear albedo",
            "size_px": [N, N],
            "pixel_m": res,
            "grid": "Same grid as heightmap.png: pixel (col, row) is centered on heightmap vertex "
                    f"(col, row), i.e. x = (col - {half}) * {res}, z = (row - {half}) * {res}. Row 0 = -z "
                    "(grid north), column 0 = -x. The image covers x, z in "
                    f"[-{half * res + res / 2}, {half * res + res / 2}] m.",
            "uv": f"u = (x + {half * res + res / 2}) / {N * res}, v_down = (z + {half * res + res / 2}) / {N * res} "
                  "(v_down = 0 at the top row). With the default three.js PlaneGeometry spanning "
                  f"-{half * res}..{half * res} the error is at most half a texel ({res / 2} m).",
            "values": f"linear_albedo = srgb_to_linear(value / 255). Mean of real pixels and of filled pixels "
                      f"= {MEAN_ALBEDO} (value {neutral}). Load as a color map with colorSpace = "
                      "SRGBColorSpace; to use it as a multiplier on another base color, "
                      f"divide the decoded linear value by {MEAN_ALBEDO}.",
            "filled": f"{filled.mean():.1%} of pixels (permanent and cast shadows, no data, grazing light) "
                      "carry texture copied from nearby lit ground (mean = neutral), feathered over ~2 pixels.",
            "bytes": size,
        },
        "source": {
            "dataset": "LROC NAC de Gerlache Rim low-Sun controlled mosaic, combined mosaic #1, 5 m/px "
                       f"version ({NAC_PRODUCT}_5M); 144 NAC images from 2009-2013, 3 Sun-azimuth bins",
            "url": NAC_URL,
            "page": NAC_PAGE,
            "citation": "Henriksen, M.R., Burnette, S.R., Brown, H.M., Wagner, R.V., Robinson, M.S., "
                        "Collins, W.M., Grieser, S.A., Boyd, A.K. (2023), Optimized Illuminated Terrain "
                        "Coverage of the Candidate Artemis III Landing Sites with LROC NAC Controlled "
                        "Mosaics, European Lunar Symposium, pp. 134-135",
            "positionalAccuracy_m": "5 to 20 (product README)",
            "credit": "NASA/GSFC/Arizona State University",
            "license": "PDS archive product, public domain (credit NASA/GSFC/Arizona State University)",
            "shadingDem": "LOLA Site11 5 m DEM (Barker et al. 2021), same grid as heightmap.png",
        },
        "alignment": shift,
        "processing": [
            "Cropped on the native 5 m grid (it is pixel-aligned with Site11 / heightmap.png; no resampling).",
            "Alignment check: correlation of the image with the DEM shading model, shifting the DEM by up to "
            "3 pixels; see 'alignment'. A best shift of 0 or 1 pixel (5 m) means the texture lines up with "
            "heightmap.png within the source's stated 5-20 m accuracy; no shift is applied.",
            f"Fill: shadows (darker than {SHADOW_FRAC:.0%} of the 300 m local mean), no data and pixels where "
            f"the model predicts under {REL_MIN:.0%} of flat-ground light, dilated by two pixels, are filled by copying real texture from lit ground 185 m to 1.7 km away "
            "(fixed offsets, nearest first), so holes are not flat; their mean is still neutral.",
            f"Shading removal: local Lambert fit I ~ g * (n . s) with n from the DEM, solved per pixel by "
            f"Gaussian-weighted least squares (sigma {FIT_SIGMA_PX * res} m), because the mosaic mixes images "
            "with three Sun azimuths. Fitted Sun azimuth (from grid north toward +X) p10/p50/p90 = "
            f"{np.percentile(sun_az, [10, 50, 90]).round(0).tolist()} deg; apparent elevation p10/p50/p90 = "
            f"{np.percentile(sun_el, [10, 50, 90]).round(1).tolist()} deg (the images list incidence 86-91 deg, i.e. the "
            "Sun -1..4 deg above the mean surface; the fit is only a local shading model, and the 5 m DEM is "
            "smoother than the real surface).",
            f"Albedo = image / fitted shading, clipped to {RATIO_CLIP[0]}..{RATIO_CLIP[1]}, i.e. albedo relative "
            f"to the ~{FIT_SIGMA_PX * res} m neighbourhood.",
        ],
        "limits": [
            "Large-scale (> ~300 m) brightness differences are removed on purpose: in this mosaic they are "
            "mostly exposure and Sun-angle differences between images, not albedo.",
            "Craters and boulders smaller than the DEM resolves (< ~20 m) keep their baked bright/dark "
            "crescents from the original Sun direction.",
            "Shadowed areas (permanent shadows and shadows at imaging time) carry no image data; their texture is "
            "copied from nearby lit ground, so it is plausible but not real. "
            "ShadowCam mosaics could fill them in a later pass.",
            "No color: the NAC is a single broadband (panchromatic) channel.",
        ],
    }
    (args.out / "texture.json").write_text(json.dumps(tex, indent=2) + "\n")
    log("wrote texture.json")

    if args.preview:
        render_preview(args.preview, args.out, I[inner], v, hm, meta)
        log(f"preview -> {args.preview}")


def render_preview(path, out, raw, tex, hm, meta):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    N = hm.shape[0]
    h = (N // 2) * 5
    ext = [-h - 2.5, h + 2.5, h + 2.5, -h - 2.5]
    xs = np.linspace(-h, h, N)
    slope = np.asarray(Image.open(out / meta["playArea"]["files"]["slope"]["file"])) / 4.0
    cold = np.asarray(Image.open(out / meta["playArea"]["files"]["coldMask"]["file"])) / 255.0
    rims = ndimage.gaussian_filter(slope, 2.5)
    lo, hi = np.percentile(raw[raw > 0], [1, 99.5])
    panels = [("LROC NAC 5 m mosaic as delivered (low Sun, baked shadows)", (raw - lo) / (hi - lo)),
              ("albedo.jpg (shading removed, shadows filled)", tex / 255.0),
              ("LOLA heightmap hillshade (game geometry)", hillshade(hm, 5, az=315, alt=35))]
    L = meta["landing"]["local"]
    zoom = (L["x"] - 900, L["x"] + 900, L["z"] + 900, L["z"] - 900)
    fig, ax = plt.subplots(2, 3, figsize=(27, 18))
    for row in range(2):
        for k, (title, img) in enumerate(panels):
            a = ax[row, k]
            a.imshow(np.clip(img, 0, 1), cmap="gray", vmin=0, vmax=1, extent=ext, interpolation="nearest")
            a.contour(xs, xs, rims, levels=[20], colors="red", linewidths=0.6 if row == 0 else 1.0)
            a.contour(xs, xs, cold, levels=[0.5], colors="cyan", linewidths=0.8)
            a.plot(L["x"], L["z"], "y*", ms=16, mec="k")
            for v in meta["features"]["rockyAreas"] + meta["features"]["rimViewpoints"]:
                a.plot(v["local"]["x"], v["local"]["z"], "o", mfc="none", mec="lime", ms=12, mew=1.5)
            if row == 0:
                a.set_title(title + "\nred = DEM slope 20 deg contour (crater rims), cyan = PSR", fontsize=11)
                a.plot([zoom[0], zoom[1], zoom[1], zoom[0], zoom[0]], [zoom[3], zoom[3], zoom[2], zoom[2], zoom[3]],
                       "y--", lw=1)
            else:
                a.set_xlim(zoom[0], zoom[1]); a.set_ylim(zoom[2], zoom[3])
                a.set_title("zoom 1.8 km around the landing (star)", fontsize=11)
            a.set_xlabel("x (m)"); a.set_ylabel("z (m)")
    fig.tight_layout()
    fig.savefig(path, dpi=70)


if __name__ == "__main__":
    main()
