// The intro video's driver. Modes (URL ?mode=):
//   play    (default) live preview in a browser, real time, one sub-frame, low cost. ?t=12 starts at 12 s, ?pause holds.
//   render  offline: renders frames from ?from to ?to and POSTs raw RGBA to the capture server (?capture=URL).
//           With ?stills=1.5,7,20 it renders only those times and POSTs PNGs instead.
//   score   renders the score offline and POSTs a WAV to the capture server.
// Settings: ?w=1920&h=1080&ss=1.5&fps=60&sub=8&shutter=0.5&quality=final|preview
// tools/render.mjs runs all of this in headless Chrome; see README.md.
import { clock, hashSeed } from './clock'; // first: installs the virtual clock and seeded Math.random
import * as THREE from 'three';
import { FILM } from './film';
import { FILM_SECONDS } from './cues';
import { PostChain, resolvePost, type PostParams } from './post';
import { shotAt, type FrameView, type PlacedShot, type RenderSettings, type SequenceContext, type SequenceInstance } from './timeline';

const q = new URLSearchParams(location.search);
const mode = (q.get('mode') ?? 'play') as 'play' | 'render' | 'score';
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const captureUrl = q.get('capture') ?? '';

const settings: RenderSettings = {
  width: num('w', mode === 'play' ? 960 : 1920),
  height: num('h', mode === 'play' ? 540 : 1080),
  ss: num('ss', 1),
  fps: num('fps', mode === 'play' ? 30 : 60),
  subframes: Math.max(1, Math.round(num('sub', 1))),
  shutter: num('shutter', 0.5),
  quality: (q.get('quality') as RenderSettings['quality']) ?? (mode === 'play' ? 'preview' : 'final'),
};

// Logs and errors go to the capture server too (headless Chrome has no console to look at).
function post(path: string, body: BodyInit, contentType = 'application/octet-stream'): Promise<Response> {
  return fetch(`${captureUrl}${path}`, { method: 'POST', body, headers: { 'Content-Type': contentType } });
}
if (captureUrl) {
  for (const level of ['log', 'warn', 'error'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      orig(...args);
      const text = args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      void post(`/log?level=${level}`, text, 'text/plain').catch(() => {});
    };
  }
  window.addEventListener('error', (e) => void post('/fail', `${e.message} at ${e.filename}:${e.lineno}\n${e.error?.stack ?? ''}`, 'text/plain'));
  window.addEventListener('unhandledrejection', (e) => void post('/fail', `unhandled rejection: ${e.reason?.stack ?? e.reason}`, 'text/plain'));
}

if (Math.abs(FILM.duration - FILM_SECONDS) > 1e-6) {
  throw new Error(`the sequences' shots (${FILM.duration} s) and cues.ts (${FILM_SECONDS} s) disagree: check the acts' timing.ts`);
}

// ---------------------------------------------------------------------------------------------------------------
// Picture

const internal = { width: Math.round(settings.width * settings.ss), height: Math.round(settings.height * settings.ss) };
let renderer: THREE.WebGLRenderer;
let chain: PostChain;
let ctx: SequenceContext;

function setupPicture() {
  renderer = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(1);
  // The canvas is the internal size: some game effects scale with the drawing-buffer height (point sizes).
  renderer.setSize(internal.width, internal.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // ignored on render targets; the post chain tone maps
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;
  document.body.append(renderer.domElement);
  chain = new PostChain(renderer, internal, { width: settings.width, height: settings.height }, 4);
  ctx = { renderer, width: internal.width, height: internal.height, settings };
}

interface Loaded {
  placed: PlacedShot; // any shot of the sequence (for its def and start)
  inst: SequenceInstance;
  lastT: number; // film time of the last update
  lastPost: Partial<PostParams>;
}
let loaded: Loaded | null = null;

const PREROLL_STEP = 1 / 30;

/** Make sure the sequence playing at film time t is loaded and has been updated up to (not including) t. */
async function prepare(t: number): Promise<Loaded> {
  const placed = shotAt(FILM, t);
  if (loaded && (loaded.placed.sequence !== placed.sequence || loaded.lastT > t)) {
    loaded.inst.dispose();
    loaded = null;
  }
  if (!loaded) {
    const started = clock.realNow();
    clock.set(placed.seqStart);
    clock.reseed(hashSeed(placed.sequence.id));
    const inst = await placed.sequence.load(ctx);
    loaded = { placed, inst, lastT: placed.seqStart - 1e-9, lastPost: {} };
    console.log(`loaded ${placed.sequence.id} in ${((clock.realNow() - started) / 1000).toFixed(1)} s`);
  }
  // Pre-roll (no drawing) when jumping ahead, so stateful effects arrive in the right state.
  while (t - loaded.lastT > PREROLL_STEP * 1.5) {
    update(loaded, Math.max(loaded.placed.seqStart, loaded.lastT + PREROLL_STEP));
  }
  return loaded;
}

function update(l: Loaded, t: number): FrameView {
  const placed = shotAt(FILM, t);
  const first = l.lastT < l.placed.seqStart;
  clock.set(t);
  clock.flushFrame();
  const view = l.inst.update({ shot: placed.shot.id, t: t - placed.start, seqT: t - placed.seqStart, filmT: t, dt: first ? 0 : Math.max(0, t - l.lastT) });
  l.lastT = Math.max(l.lastT, t);
  if (view.post) l.lastPost = view.post;
  return view;
}

// Low-discrepancy samples for anti-aliasing jitter and lens positions.
function halton(i: number, base: number): number {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

const savedPos = new THREE.Vector3();
const savedProj = new THREE.Matrix4();

/** Render one output frame (all its sub-frames) into the post chain's output target. */
async function renderFrame(frameIndex: number): Promise<void> {
  const tc = frameIndex / settings.fps;
  const placed = shotAt(FILM, tc);
  const shotEnd = placed.start + placed.shot.duration - 1e-6;
  const l = await prepare(Math.max(placed.start, tc - (settings.shutter / settings.fps) / 2));
  const minSub = settings.quality === 'final' ? resolvePost(l.lastPost).minSubframes : 0;
  const n = Math.max(settings.subframes, settings.subframes > 1 ? minSub : 1);
  const open = settings.shutter / settings.fps;
  chain.begin();
  let midPost: Partial<PostParams> = {};
  for (let i = 0; i < n; i++) {
    const ti = Math.min(shotEnd, Math.max(placed.start, tc + ((i + 0.5) / n - 0.5) * open));
    const view = update(l, ti);
    const p = resolvePost(view.post ?? l.lastPost);
    if (i === Math.floor(n / 2)) midPost = view.post ?? l.lastPost;
    const cam = view.camera;
    savedPos.copy(cam.position);
    savedProj.copy(cam.projectionMatrix);
    if (n > 1) {
      // Sub-pixel jitter (anti-aliasing) and a lens position on the aperture (depth of field), focus plane fixed.
      const jx = halton(i + 1, 2) - 0.5;
      const jy = halton(i + 1, 3) - 0.5;
      const e = cam.projectionMatrix.elements;
      e[8]! += (2 * jx) / internal.width;
      e[9]! += (2 * jy) / internal.height;
      if (p.aperture > 0) {
        const r = Math.sqrt((i + 0.5) / n) * p.aperture;
        const a = i * 2.39996323 + 0.7;
        const ax = Math.cos(a) * r;
        const ay = Math.sin(a) * r;
        cam.translateX(ax);
        cam.translateY(ay);
        const tanHalf = Math.tan((cam.fov * Math.PI) / 360) / cam.zoom;
        e[8]! += -ax / (p.focusDistance * tanHalf * cam.aspect);
        e[9]! += -ay / (p.focusDistance * tanHalf);
      }
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
    cam.updateMatrixWorld();
    chain.clearScene();
    l.inst.render(chain.scene, cam);
    cam.position.copy(savedPos);
    cam.projectionMatrix.copy(savedProj);
    cam.projectionMatrixInverse.copy(savedProj).invert();
    cam.updateMatrixWorld();
    chain.accumulate(1 / n);
  }
  chain.finish(resolvePost(midPost), frameIndex);
}

// ---------------------------------------------------------------------------------------------------------------
// Modes

async function runRender(): Promise<void> {
  setupPicture();
  const from = num('from', 0);
  const to = Math.min(num('to', FILM.duration), FILM.duration);
  const stills = q.get('stills');
  const pixels = new Uint8Array(settings.width * settings.height * 4);
  const started = clock.realNow();
  if (stills) {
    const times = stills.split(',').map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const canvas = document.createElement('canvas');
    canvas.width = settings.width;
    canvas.height = settings.height;
    const c2d = canvas.getContext('2d')!;
    for (const t of times) {
      await renderFrame(Math.round(t * settings.fps));
      chain.read(pixels);
      const img = c2d.createImageData(settings.width, settings.height);
      const row = settings.width * 4;
      for (let y = 0; y < settings.height; y++) img.data.set(pixels.subarray((settings.height - 1 - y) * row, (settings.height - y) * row), y * row);
      c2d.putImageData(img, 0, 0);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      const shot = shotAt(FILM, t).shot.id;
      await post(`/still?name=${encodeURIComponent(`t${t.toFixed(2).padStart(5, '0')}-${shot}`)}`, blob, 'image/png');
    }
  } else {
    const f0 = Math.round(from * settings.fps);
    const f1 = Math.round(to * settings.fps);
    for (let k = f0; k < f1; k++) {
      await renderFrame(k);
      chain.read(pixels);
      const res = await post('/frame', pixels);
      if (!res.ok) throw new Error(`capture server refused frame ${k}`);
      if ((k - f0) % 30 === 29 || k === f1 - 1) {
        const s = (clock.realNow() - started) / 1000;
        console.log(`frame ${k + 1 - f0}/${f1 - f0} (t=${(k / settings.fps).toFixed(2)} s, ${shotAt(FILM, k / settings.fps).shot.id}) ${s.toFixed(0)} s elapsed, ${((k + 1 - f0) / s).toFixed(2)} fps`);
      }
    }
  }
  loaded?.inst.dispose();
  await post('/done', 'ok', 'text/plain');
}

async function runScore(): Promise<void> {
  const { renderScore } = await import('./score/index');
  const buffer = await renderScore(48000);
  await post('/audio', encodeWav(buffer), 'audio/wav');
  await post('/done', 'ok', 'text/plain');
}

/** 32-bit float WAV (the master; loudness and AAC happen in ffmpeg). */
function encodeWav(b: AudioBuffer): ArrayBuffer {
  const ch = b.numberOfChannels;
  const n = b.length;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 4));
  const str = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  data.setUint32(4, 36 + n * ch * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 3, true); // IEEE float
  data.setUint16(22, ch, true);
  data.setUint32(24, b.sampleRate, true);
  data.setUint32(28, b.sampleRate * ch * 4, true);
  data.setUint16(32, ch * 4, true);
  data.setUint16(34, 32, true);
  str(36, 'data');
  data.setUint32(40, n * ch * 4, true);
  const chans = Array.from({ length: ch }, (_, c) => b.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++, o += 4) data.setFloat32(o, chans[c]![i]!, true);
  return data.buffer;
}

async function runPlay(): Promise<void> {
  setupPicture();
  renderer.domElement.style.aspectRatio = `${settings.width} / ${settings.height}`;
  let t = num('t', 0);
  const paused = q.has('pause');
  let last = clock.realNow();
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    const now = clock.realNow();
    if (!paused) t += (now - last) / 1000;
    last = now;
    if (t >= FILM.duration) t = 0;
    await renderFrame(Math.floor(t * settings.fps));
    chain.blitToCanvas();
    busy = false;
  };
  const loop = () => {
    void tick();
    clock.realRaf(loop);
  };
  loop();
}

const run = mode === 'render' ? runRender : mode === 'score' ? runScore : runPlay;
run().catch((e: unknown) => {
  console.error(e);
  if (captureUrl) void post('/fail', String((e as Error)?.stack ?? e), 'text/plain');
});
