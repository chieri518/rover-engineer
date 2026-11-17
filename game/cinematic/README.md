# Rover Engineer intro video

A ~39 s wordless cinematic intro, rendered offline from code (three.js in headless Chrome on the real GPU),
with a synthesized score. It is **not part of the game build** and is not wired into the game.

## Re-render

From `game/` (needs Google Chrome and ffmpeg at `/opt/homebrew/bin/ffmpeg`; override with `CHROME=` / `FFMPEG=`):

```
npm install
npm run cinematic:check                                  # typecheck the cinematic
node cinematic/tools/fetch-assets.mjs                    # download the public-domain imagery (once)
node cinematic/tools/render.mjs --preset preview         # quick draft, 960x540 30 fps, ~1 min
node cinematic/tools/render.mjs --preset final --webm    # the film, ~1 h on an M2: out/intro-video.mp4 (CRF 17 master) + .webm
node cinematic/tools/render.mjs --score                  # the score -> out/score.wav (10 s)
node cinematic/tools/render.mjs --web                    # two-pass H.264 of the master, 25 MB -> out/intro-video-web.mp4
node cinematic/tools/render.mjs --mux --video cinematic/out/intro-video-web.mp4 --out cinematic/out/rover-engineer-intro.mp4
node cinematic/tools/render.mjs --mux --out cinematic/out/rover-engineer-intro-hq.mp4   # also muxes the WebM (-hq.webm)
```

The deliverables (1920x1080, 60 fps, 39.3 s, −16 LUFS integrated, true peak −2.3 dBTP):
`rover-engineer-intro.mp4` (H.264 High, ~24.9 MB, for sharing), `rover-engineer-intro-hq.mp4` (CRF 17, ~41 MB)
and the VP9/Opus WebM (~20 MB). The film's grain makes a CRF encode large; the 25 MB two-pass encode measures
SSIM 0.99 against the CRF 17 master. The last full final render took 62 min (0.64 output fps on average; the
ignition close-up, the wake/gaze shallow-focus shots and the Mars storm are the costly ones).

Useful options: `--from 12 --to 15` (a range, in film seconds), `--stills 1,5.5,13` (PNG stills to
`out/stills/`), `--sub 16 --ss 2` (more sub-frames, more supersampling), `--webm` (also a VP9 WebM),
`--port 5420` (Vite on that port, the capture server on the next one), `--headed` (watch Chrome).
Live preview in a browser: `npm run cinematic:dev`, then open
`http://localhost:5410/cinematic/intro.html?t=12` (real time, one sub-frame, no motion blur).

Frames are streamed from the page to ffmpeg's stdin (never written to disk). The temporary Chrome profile is
deleted at the end of every run. Outputs go to `cinematic/out/` (gitignored).

## How it works

- `src/clock.ts`: the virtual clock. `performance.now`, `Date.now`, `requestAnimationFrame` and `Math.random`
  (seeded per sequence) are deterministic, so every render is identical and frames take as long as they need.
- `src/timeline.ts`: the film is a list of **sequences** (each owns a scene) made of **shots**. Read the contract
  at the top of the file before writing a sequence.
- `src/main.ts`: the driver. Each output frame is the average of N **sub-frames** across a 180° shutter, each with
  sub-pixel jitter and its own point on the lens aperture: motion blur, anti-aliasing and depth of field together.
- `src/post.ts`: the film look: bloom, lens flare, chromatic aberration, ACES filmic tone mapping, grade,
  supersampled downsample in linear light, vignette, grain and dither.
- `src/act1/`, `src/act2/`, `src/act3/`: the three acts. Each has a `timing.ts` with its shot lengths and the
  moments the score hits; `src/cues.ts` turns those into film times for the score (`src/score/`).
- `src/lib/world.ts`: starts the game's real worlds (terrain, sky, light, weather, rover, lander) for offline
  rendering through an opt-in hook in `src/world/moonScene.ts` (`offline`; unset in the game).
- `src/rig/`: the hero rover's cinematic look (`dressRover`, used in Acts 2 and 3) and its animatable rig.
- `src/score/`: the score and sound effects, synthesized offline with the game's own sound engine (`src/audio/`):
  every hit is scheduled from `src/cues.ts`, so moving a cue in an act's `timing.ts` moves the music with it.
  Re-render the score (`--score`) and mux again after any timing change.
- `tools/render.mjs`: Vite + a local capture server + headless Chrome + ffmpeg, and the mux step (one linear gain
  to −16 LUFS integrated measured with ebur128, true peak kept under −1.5 dBTP, AAC 192k).
- `tools/fetch-assets.mjs`: downloads the public-domain NASA Earth imagery Act 1 needs into `assets/download/`
  (gitignored, ~16 MB; credits in `assets/CREDITS.md`). Without it the Earth falls back to plain colors.

## The film

| Act | Shots (in order) | Score cues (`timing.ts`) |
|-----|------------------|--------------------------|
| 1 · Leaving Earth | ignition, liftoff, orbit | sparks, ignition, liftoff, clearTower (first big chord), separation, upperIgnition |
| 2 · Arrival (Moon) | touchdown, doors, wake, gaze, tracks | hatchStart, rampDown, led1..4, panelStart, mastStart, eyeOn, eyeTurn, wheelTouch (the theme begins) |
| 3 · Survive the extremes | moon-crater, mars-storm, titan-rain | moonDark, floodlights, lightsOut, black (silence) |

The Moon has no air: from touchdown to the Mars cut the soundtrack is score only, no diegetic sound.

## Presets

| preset  | size      | fps | supersampling | sub-frames | use                      |
|---------|-----------|-----|---------------|------------|--------------------------|
| preview | 960x540   | 30  | 1             | 1          | pacing, quick looks      |
| draft   | 1280x720  | 30  | 1             | 4          | look checks with blur    |
| final   | 1920x1080 | 60  | 1.5           | 8          | the film                 |

Sequences can ask for more sub-frames on a shot (`minSubframes`): the ignition close-up and the wake, gaze and
tracks shots use 20–28 for smooth shallow focus.
