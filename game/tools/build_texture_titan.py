#!/usr/bin/env python3
"""Build the Titan ground texture (albedo.jpg + texture.json) for Rover Engineer.

No image of Titan resolves the ground at rover scale (Cassini ISS, VIMS and
RADAR saw the Shangri-La dunes at hundreds of meters per pixel), so the texture
is generated to match their look: dark dune sand, bright interdune flats, rough
bright ejecta, and Huygens-like pebbles around the landing. Like the terrain it
is MODELED, not imaged.

Run after build_terrain_titan.py: it reads terrain.json (features) and the
intermediate units file raw/titan/units.npz (dune cores, ejecta weight, sand);
it never edits terrain.json.

Usage (from game/tools/, inside the venv):
    python build_texture_titan.py [--preview out.png]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

from titan_common import OUT, RAW, log, smooth_noise, smoothstep

SEED = 2035
JPEG_QUALITY = 88
# Relative brightness of the ground units (linear albedo; only the ratios matter, the renderer tints).
# Dunes are dark and interdunes bright in Cassini ISS near-IR (938 nm) and VIMS images, and in RADAR
# (Lorenz et al. 2006; Radebaugh et al. 2008; Barnes et al. 2008; Lorenz et al. 2021). Absolute values
# are game choices: Titan's surface albedo at 938 nm is roughly 0.1 to 0.2.
ALB_DUNE = 0.11
ALB_INTERDUNE = 0.29
ALB_SKIRT = 0.20  # sand skirts and plinths at a dune's foot
ALB_EJECTA = 0.30
ALB_PATCH = 0.38
PEBBLE_RADIUS_M = 350.0  # Huygens-like cobble field around the landing


def srgb_encode(lin: np.ndarray) -> np.ndarray:
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def streaks(rng, shape, along_px, across_px):
    """Elongated noise streaks running west-east (along image columns)."""
    a = ndimage.gaussian_filter(rng.standard_normal(shape), (across_px, along_px), mode="wrap")
    return a / (a.std() + 1e-12)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--preview", type=Path)
    args = ap.parse_args()
    meta = json.loads((args.out / "terrain.json").read_text())
    units_path = RAW / "units.npz"
    if not units_path.exists():
        raise SystemExit(f"{units_path} is missing: run build_terrain_titan.py first")
    u = np.load(units_path)
    core, ej, soft = u["core"].astype(np.float64), u["ejecta"].astype(np.float64), u["soft"].astype(np.float64)
    pa = meta["playArea"]
    n, res = pa["samples"], pa["pixel_m"]
    if core.shape != (n, n):
        raise SystemExit("units.npz does not match terrain.json: rerun build_terrain_titan.py")
    half_n = n // 2
    yy, xx = np.mgrid[0:n, 0:n]
    gx, gz = (xx - half_n) * res, (yy - half_n) * res
    rng = np.random.default_rng(SEED)

    # Interdunes: bright, with broad patchiness and faint wind streaks.
    inter = ALB_INTERDUNE * (1 + 0.10 * smooth_noise(rng, (n, n), 300 / res)
                             + 0.05 * streaks(rng, (n, n), 120 / res, 8 / res)
                             + 0.04 * smooth_noise(rng, (n, n), 1.0))
    # Sand skirts: darker ground within ~250 m of a dune (thin sand over the interdune).
    dune_mask = core > 0.02
    dist = ndimage.distance_transform_edt(~dune_mask) * res
    skirt = smoothstep(250, 0, dist) * (1 - smoothstep(0.02, 0.3, core))
    # Dune sand: dark, slightly lighter on the lower flanks; faint crest-parallel streaks.
    w_dune = smoothstep(0.02, 0.35, core)
    dune = ALB_DUNE * (1 + 0.15 * (1 - smoothstep(0.3, 0.9, core)) + 0.06 * streaks(rng, (n, n), 60 / res, 3 / res)
                       + 0.05 * smooth_noise(rng, (n, n), 1.0))
    lin = inter * (1 - skirt) + ALB_SKIRT * (1 + 0.05 * smooth_noise(rng, (n, n), 2.0)) * skirt
    lin = lin * (1 - w_dune) + dune * w_dune

    # Selk ejecta: rough, mottled, with scattered bright blocks, densest in the ejecta field.
    ejecta = ALB_EJECTA * (1 + 0.14 * smooth_noise(rng, (n, n), 40 / res) + 0.10 * smooth_noise(rng, (n, n), 10 / res)
                           + 0.08 * smooth_noise(rng, (n, n), 1.0))
    rocky = meta["features"]["rockyAreas"][0]
    d_rock = np.hypot(gx - rocky["local"]["x"], gz - rocky["local"]["z"])
    density = 0.004 + 0.05 * smoothstep(rocky["radius_m"] * 1.6, rocky["radius_m"] * 0.5, d_rock)
    blocks = (rng.random((n, n)) < density * ej).astype(float)
    blocks = np.maximum(blocks, 0.5 * ndimage.maximum_filter(blocks, 2) * (rng.random((n, n)) < 0.5))
    ejecta = ejecta * (1 + 0.55 * blocks)
    lin = lin * (1 - ej) + ejecta * ej

    # The bright interdune sample patch (irregular outline).
    sp = meta["features"]["samplePatch"]
    ang = np.arctan2(gz - sp["local"]["z"], gx - sp["local"]["x"])
    rr = sp["radius_m"] * (1 + 0.18 * np.sin(3 * ang + 0.7) + 0.10 * np.sin(5 * ang + 2.1))
    d_sp = np.hypot(gx - sp["local"]["x"], gz - sp["local"]["z"])
    w_sp = smoothstep(rr + 25, rr - 10, d_sp)
    lin = lin * (1 - w_sp) + ALB_PATCH * (1 + 0.06 * smooth_noise(rng, (n, n), 3.0)) * w_sp

    # Huygens-like cobbles around the landing: rounded pebbles (centimeters) are far below a 5 m texel, so
    # they show as a speckled, slightly brighter, mottled ground that fades out with distance.
    ld = meta["landing"]["local"]
    d_land = np.hypot(gx - ld["x"], gz - ld["z"])
    w_peb = smoothstep(PEBBLE_RADIUS_M, PEBBLE_RADIUS_M * 0.3, d_land) * (1 - w_dune)
    speckle = 0.22 * rng.standard_normal((n, n)) + 0.10 * smooth_noise(rng, (n, n), 4.0)
    lin = lin * (1 + w_peb * (0.08 + speckle))

    lin = np.clip(lin, 0.03, 0.8)
    mean = float(lin.mean())
    v = np.round(srgb_encode(lin) * 255).astype(np.uint8)
    out_jpg = args.out / "albedo.jpg"
    Image.fromarray(v, mode="L").save(out_jpg, quality=JPEG_QUALITY, optimize=True)
    size = out_jpg.stat().st_size
    ratios = {
        "dune": round(float(np.median(lin[core > 0.5])) / mean, 2),
        "skirt": round(float(np.median(lin[(skirt > 0.6) & (ej < 0.01)])) / mean, 2),
        "interdune": round(float(np.median(lin[(core < 0.001) & (skirt < 0.01) & (ej < 0.01) & (w_peb < 0.01)
                                                & (w_sp < 0.01)])) / mean, 2),
        "ejecta": round(float(np.median(lin[ej > 0.99])) / mean, 2),
        "samplePatch": round(float(np.median(lin[w_sp > 0.99])) / mean, 2),
    }
    log(f"wrote {out_jpg} ({size / 1e6:.2f} MB), mean linear albedo {mean:.3f}, relative to mean: {ratios}")

    edge = (n // 2) * res + res / 2
    tex = {
        "version": 1,
        "generated": dt.date.today().isoformat(),
        "generator": "game/tools/build_texture_titan.py",
        "modeled": True,
        "playArea": {
            "file": "albedo.jpg",
            "encoding": "8-bit grayscale JPEG, sRGB-encoded linear albedo",
            "size_px": [n, n],
            "pixel_m": res,
            "grid": f"Same grid as heightmap.png: pixel (col, row) is centered on heightmap vertex (col, row), i.e. "
                    f"x = (col - {n // 2}) * {res:g}, z = (row - {n // 2}) * {res:g}. Row 0 = -z (north), column 0 = "
                    f"-x (west). The image covers x, z in [-{edge:g}, {edge:g}] m.",
            "uv": f"u = (x + {edge:g}) / {2 * edge:g}, v_down = (z + {edge:g}) / {2 * edge:g} (v_down = 0 at the top "
                  "row). With a PlaneGeometry spanning the play area the error is at most half a texel.",
            "values": f"linear_albedo = srgb_to_linear(value / 255). Mean = {mean:.3f} (value "
                      f"{int(round(float(srgb_encode(np.array(mean)) * 255)))}). Grayscale: tint it in the shader. "
                      f"To use it as a multiplier on a base color, divide the decoded value by {mean:.3f}.",
            "relativeToMean": ratios,
            "bytes": size,
        },
        "source": {
            "dataset": "Generated (seed %d). Look matched to Cassini ISS near-IR, VIMS and RADAR views of the "
                       "Shangri-La dunes (dark dunes, bright interdunes, bright rough Selk ejecta) and to the Huygens "
                       "DISR surface images (rounded cobbles)" % SEED,
            "citation": "Lorenz, R.D., et al. (2006), Science 312, 724-727; Radebaugh, J., et al. (2008), Icarus 194, "
                        "690-703; Barnes, J.W., et al. (2008), Icarus 195, 400-414 (VIMS dune spectra); Lorenz, R.D., "
                        "et al. (2021), Planet. Sci. J. 2:24; Tomasko, M.G., et al. (2005), Nature 438, 765-778",
            "credit": "Modeled on Cassini and Huygens data (NASA/JPL-Caltech/ASI/ESA/University of Arizona)",
            "license": "Generated by this project",
        },
        "processing": [
            f"Units from build_terrain_titan.py: dune cores (dark, {ALB_DUNE}), sand skirts within 250 m of a dune "
            f"({ALB_SKIRT}), interdune flats ({ALB_INTERDUNE}, with 300 m patchiness and faint west-east wind "
            f"streaks), Selk ejecta ({ALB_EJECTA}, mottled, with bright blocks densest in the ejecta field), the "
            f"bright interdune sample patch ({ALB_PATCH}).",
            f"Huygens-like pebbles: speckle fading out over {PEBBLE_RADIUS_M:.0f} m around the landing (the real "
            "cobbles are centimeters, far below a 5 m texel).",
            "No baked shading: the renderer lights the heightmap.",
        ],
        "limits": [
            "Modeled, not imaged: no image of Titan resolves the ground at this scale. Only the pattern (dark dunes, "
            "bright interdunes and ejecta) follows Cassini; brightness values are game choices.",
            "Grayscale only.",
        ],
    }
    (args.out / "texture.json").write_text(json.dumps(tex, indent=2) + "\n")

    if args.preview:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(1, 2, figsize=(20, 10))
        ax[0].imshow(v, cmap="gray", vmin=0, vmax=255)
        ax[0].set_title("albedo.jpg")
        c = int(round(ld["z"] / res + half_n)), int(round(ld["x"] / res + half_n))
        ax[1].imshow(v[c[0] - 120:c[0] + 120, c[1] - 60:c[1] + 180], cmap="gray", vmin=0, vmax=255)
        ax[1].set_title("around the landing (1.2 km)")
        plt.tight_layout()
        plt.savefig(args.preview, dpi=60)
        log(f"preview: {args.preview}")


if __name__ == "__main__":
    main()
