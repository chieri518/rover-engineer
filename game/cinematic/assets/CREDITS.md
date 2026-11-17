# Intro video assets: credits and licenses

The images are not in the repository. `node cinematic/tools/fetch-assets.mjs` (run from `game/`) downloads them
into `cinematic/assets/download/` (gitignored). Only the Earth-orbit shot of Act 1 uses them; everything else in
the intro is made in code.

NASA imagery is not protected by copyright in the United States and may be used freely; NASA asks that it be
credited and that its use not suggest NASA endorsement
([NASA images and media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

| File | What | Source | Credit |
|------|------|--------|--------|
| `region-ground.jpg` | Blue Marble Next Generation with shaded relief and bathymetry, 17°–45° N, 92°–58° W | NASA GIBS (Global Imagery Browse Services) WMS, layer `BlueMarble_ShadedRelief_Bathymetry` | NASA Earth Observatory (Reto Stöckli), NASA GIBS / ESDIS |
| `region-day.jpg` | VIIRS true-colour image of 20 September 2024 (used only for its clouds), same box | NASA GIBS WMS, layer `VIIRS_NOAA20_CorrectedReflectance_TrueColor` | NASA GIBS / ESDIS, NASA LANCE; NOAA-20 VIIRS |
| `region-lights.jpg` | Black Marble night lights (2016), same box | NASA GIBS WMS, layer `VIIRS_Black_Marble` | NASA Earth Observatory (Joshua Stevens, Miguel Román), NASA GIBS / ESDIS |
| `world-ground.jpg` | Blue Marble Next Generation, September, topography and bathymetry, 5400×2700 | NASA Earth Observatory (`assets.science.nasa.gov`) | NASA Earth Observatory (Reto Stöckli) |
| `world-clouds.jpg` | Blue Marble cloud composite, 2048×1024 | NASA Earth Observatory / Visible Earth | NASA Goddard Space Flight Center (Reto Stöckli, Robert Simmon) |
| `world-lights.jpg` | Black Marble 2016, 3600×1800 | NASA Earth Observatory | NASA Earth Observatory (Joshua Stevens, Miguel Román) |

The REL mark on the rocket is set in Chakra Petch (SIL Open Font License 1.1), already a dependency of the game.
The rocket, launch pad and agency are original designs for this game.
