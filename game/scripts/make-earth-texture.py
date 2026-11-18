#!/usr/bin/env python3
"""Make the title cover's Earth texture (public/earth/earth-day.jpg) from NASA Blue Marble imagery.

Inputs are the intro film's downloads (run `node cinematic/tools/fetch-assets.mjs` from game/ first; credits in
cinematic/assets/CREDITS.md and the game's credits screen):
  - cinematic/assets/download/world-ground.jpg  Blue Marble Next Generation, September, topography and bathymetry
  - cinematic/assets/download/world-clouds.jpg  Blue Marble cloud composite
Output: one equirectangular 1536 x 768 JPEG, longitude -180 at the left edge, with the clouds blended in.

Usage (from game/, with the terrain tools' venv, which has Pillow and NumPy):
    tools/.venv/bin/python -I scripts/make-earth-texture.py .
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

WIDTH, HEIGHT = 1536, 768
CLOUD_FLOOR = 0.08  # cloud map values below this are haze or noise: no cloud
CLOUD_OPACITY = 0.92  # the thickest cloud still lets a little ground through
CLOUD_WHITE = np.array([0.96, 0.97, 0.98])
QUALITY = 86


def main() -> None:
    game = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    src = game / "cinematic" / "assets" / "download"
    out = game / "public" / "earth" / "earth-day.jpg"

    ground = Image.open(src / "world-ground.jpg").convert("RGB").resize((WIDTH, HEIGHT), Image.LANCZOS)
    clouds = Image.open(src / "world-clouds.jpg").convert("L").resize((WIDTH, HEIGHT), Image.LANCZOS)

    g = np.asarray(ground, dtype=np.float64) / 255.0
    c = np.asarray(clouds, dtype=np.float64) / 255.0
    a = np.clip((c - CLOUD_FLOOR) / (1.0 - CLOUD_FLOOR), 0.0, 1.0) ** 0.9 * CLOUD_OPACITY
    rgb = g * (1.0 - a[..., None]) + CLOUD_WHITE * a[..., None]

    out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.round(rgb * 255.0).astype(np.uint8)).save(out, quality=QUALITY, optimize=True, progressive=True)
    print(f"{out.relative_to(game)}: {out.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
