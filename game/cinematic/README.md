# Rover Engineer intro video

A ~37 s wordless cinematic intro, rendered offline from code (three.js in headless Chrome on the real GPU),
with a synthesized score. It is **not part of the game build** and is not wired into the game.

## Re-render

From `game/` (needs Google Chrome and ffmpeg at `/opt/homebrew/bin/ffmpeg`; override with `CHROME=` / `FFMPEG=`):

```
npm install
npm run cinematic:check                                  # typecheck the cinematic
node cinematic/tools/fetch-assets.mjs                    # download the public-domain imagery (once)
node cinematic/tools/render.mjs --preset preview         # quick draft, 960x540 30 fps, ~1 min
node cinematic/tools/render.mjs --preset final           # the film: 1920x1080 60 fps -> out/intro-video.mp4
node cinematic/tools/render.mjs --score                  # the score -> out/score.wav
node cinematic/tools/render.mjs --mux                    # -16 LUFS, AAC 192k, mux -> out/rover-engineer-intro.mp4
```

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
- `tools/render.mjs`: Vite + a local capture server + headless Chrome + ffmpeg, and the loudness/mux step.

## Presets

| preset  | size      | fps | supersampling | sub-frames | use                      |
|---------|-----------|-----|---------------|------------|--------------------------|
| preview | 960x540   | 30  | 1             | 1          | pacing, quick looks      |
| draft   | 1280x720  | 30  | 1             | 4          | look checks with blur    |
| final   | 1920x1080 | 60  | 1.5           | 8          | the film                 |

Sequences can ask for more sub-frames on a shot (`minSubframes`, e.g. shallow focus).
