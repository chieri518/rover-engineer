#!/usr/bin/env node
// Render the intro video (or stills, or the score) in headless Chrome on the real GPU, streaming raw frames
// straight into ffmpeg (no frame files on disk). Run from game/:
//
//   node cinematic/tools/render.mjs --preset preview              quick draft: 960x540, 30 fps, 1 sub-frame
//   node cinematic/tools/render.mjs --preset final                the film: 1920x1080, 60 fps, supersampled, motion blur
//   node cinematic/tools/render.mjs --preset final --from 12 --to 15 --out cinematic/out/part.mp4
//   node cinematic/tools/render.mjs --preset final --stills 1,5.5,13 [--stills-dir DIR]   PNG stills
//   node cinematic/tools/render.mjs --score                        the score, to cinematic/out/score.wav
//   node cinematic/tools/render.mjs --web [--target-mb 25]          two-pass H.264 of the master for sharing
//   node cinematic/tools/render.mjs --mux [--video V] [--audio A]  loudness-normalize the score and mux
//
// Options: --w --h --ss --fps --sub --shutter --quality --crf --port --webm --keep-profile --headed
// Everything temporary (the Chrome profile) is deleted at the end, also on failure.
import { createServer as createHttpServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cinematicDir = path.resolve(here, '..');
const gameDir = path.resolve(cinematicDir, '..');
const outDir = path.join(cinematicDir, 'out');
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PRESETS = {
  preview: { w: 960, h: 540, ss: 1, fps: 30, sub: 1, shutter: 0.5, quality: 'preview', crf: 23 },
  draft: { w: 1280, h: 720, ss: 1, fps: 30, sub: 4, shutter: 0.5, quality: 'final', crf: 20 },
  final: { w: 1920, h: 1080, ss: 1.5, fps: 60, sub: 8, shutter: 0.5, quality: 'final', crf: 17 },
};

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const key = k.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[key] = true;
    else {
      a[key] = next;
      i++;
    }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const preset = PRESETS[args.preset ?? 'preview'];
if (!preset) throw new Error(`unknown preset ${args.preset}`);
const cfg = { ...preset };
for (const k of ['w', 'h', 'ss', 'fps', 'sub', 'shutter', 'crf']) if (args[k] !== undefined) cfg[k] = Number(args[k]);
if (args.quality) cfg.quality = args.quality;
const port = Number(args.port ?? process.env.CINEMATIC_PORT ?? 5410);
const capturePort = port + 1;
mkdirSync(outDir, { recursive: true });

function log(...m) {
  console.log(`[render ${new Date().toISOString().slice(11, 19)}]`, ...m);
}

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed:\n${r.stderr.slice(-3000)}`);
  return r;
}

// --------------------------------------------------------------------------------------------------------
// Mux: loudness normalization of the score to -16 LUFS / -1 dBTP by one linear gain, AAC 192k, video copied.
// The gain comes from ebur128, the same meter as the final check (loudnorm's own measurement reads ~0.5 LU off
// on this score, and its linear mode silently turns dynamic when the score's LRA is over its target). The score's
// master limits its peaks so the gain fits under the true-peak ceiling; if it ever does not, the gain is lowered
// (quieter, never compressed or clipped) and a warning says so.

function ebur128(file) {
  const r = run(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const num = (re) => Number(re.exec(summary)?.[1]);
  return { summary, I: num(/I:\s+(-?[\d.]+) LUFS/), LRA: num(/LRA:\s+([\d.]+) LU/), TP: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

function mux() {
  const video = args.video ?? path.join(outDir, 'intro-video.mp4');
  const audio = args.audio ?? path.join(outDir, 'score.wav');
  const out = args.out ?? path.join(outDir, 'rover-engineer-intro.mp4');
  const target = { I: -16, TP: -1.5 }; // TP a little under -1 leaves room for the AAC encoder's overshoot
  const m = ebur128(audio);
  if (!Number.isFinite(m.I) || !Number.isFinite(m.TP)) throw new Error(`could not measure ${audio}:\n${m.summary}`);
  log(`score as rendered: ${m.I} LUFS, true peak ${m.TP} dBTP, LRA ${m.LRA} LU`);
  let gain = target.I - m.I;
  if (m.TP + gain > target.TP) {
    gain = target.TP - m.TP;
    log(`warning: the score's peaks allow only ${gain.toFixed(1)} dB of gain: ${(m.I + gain).toFixed(1)} LUFS instead of ${target.I}`);
  }
  log(`gain ${gain.toFixed(2)} dB`);
  const normWav = path.join(outDir, 'score-normalized.wav');
  run(FFMPEG, ['-y', '-hide_banner', '-i', audio, '-af', `volume=${gain.toFixed(3)}dB,aresample=48000`, '-c:a', 'pcm_s24le', normWav]);
  run(FFMPEG, ['-y', '-hide_banner', '-i', video, '-i', normWav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  const webmVideo = video.replace(/\.mp4$/, '.webm');
  if (existsSync(webmVideo)) {
    const webmOut = out.replace(/\.mp4$/, '.webm');
    run(FFMPEG, ['-y', '-hide_banner', '-i', webmVideo, '-i', normWav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'libopus', '-b:a', '160k', '-shortest', webmOut]);
    log(`wrote ${webmOut} (${(statSync(webmOut).size / 1e6).toFixed(1)} MB)`);
  }
  const check = run(FFMPEG, ['-hide_banner', '-i', out, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = check.stderr.slice(check.stderr.lastIndexOf('Summary:'));
  log(`final loudness:\n${summary.trim()}`);
  log(`wrote ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB)`);
}

// --------------------------------------------------------------------------------------------------------
// Web encode: a two-pass H.264 of the CRF master sized for sharing (default 25 MB with 192k audio). The film's
// grain makes a CRF encode large; at the same size two passes keep SSIM ~0.99 against the master.

function webEncode() {
  const video = args.video ?? path.join(outDir, 'intro-video.mp4');
  const out = args.out ?? path.join(outDir, 'intro-video-web.mp4');
  const targetMB = Number(args['target-mb'] ?? 25);
  const probe = run(FFMPEG.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]);
  const seconds = Number(probe.stdout.trim());
  const kbps = Math.floor((targetMB * 8e3 * 0.985) / seconds - 192 - 16); // room for audio and the container
  const passlog = path.join(process.env.TMPDIR ?? tmpdir(), `rover-intro-x264-${process.pid}`);
  const enc = ['-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'film', '-b:v', `${kbps}k`, '-maxrate', `${kbps * 2}k`, '-bufsize', `${kbps * 2.5}k`,
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
  try {
    run(FFMPEG, ['-y', '-hide_banner', '-i', video, ...enc, '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'null', '-']);
    run(FFMPEG, ['-y', '-hide_banner', '-i', video, ...enc, '-pass', '2', '-passlogfile', passlog, '-an', '-movflags', '+faststart', out]);
  } finally {
    for (const f of [`${passlog}-0.log`, `${passlog}-0.log.mbtree`]) rmSync(f, { force: true });
  }
  log(`wrote ${out} (${kbps} kbps, ${(statSync(out).size / 1e6).toFixed(1)} MB)`);
}

// --------------------------------------------------------------------------------------------------------
// Capture: Vite dev server for the page, an HTTP server for frames/logs, headless Chrome, ffmpeg.

async function capture() {
  const scoreMode = !!args.score;
  const stills = typeof args.stills === 'string' ? args.stills : null;
  const stillsDir = path.resolve(args['stills-dir'] ?? path.join(outDir, 'stills'));
  const videoOut = path.resolve(args.out ?? path.join(outDir, args.preset === 'final' ? 'intro-video.mp4' : `intro-${args.preset ?? 'preview'}.mp4`));
  let ffmpeg = null;
  let ffmpegDone = null;
  let frames = 0;

  const { createServer } = await import(path.join(gameDir, 'node_modules/vite/dist/node/index.js'));
  const vite = await createServer({ configFile: path.join(cinematicDir, 'vite.config.mjs'), server: { port, strictPort: true } });
  await vite.listen();
  log(`vite on http://localhost:${port}/cinematic/intro.html`);

  let finish;
  const finished = new Promise((res, rej) => (finish = { res, rej }));
  const readBody = (req) =>
    new Promise((res, rej) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => res(Buffer.concat(chunks)));
      req.on('error', rej);
    });
  const server = createHttpServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.end();
    const url = new URL(req.url, 'http://x');
    try {
      const body = await readBody(req);
      if (url.pathname === '/frame') {
        if (!ffmpeg) throw new Error('no video output');
        frames++;
        if (!ffmpeg.stdin.write(body)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
      } else if (url.pathname === '/still') {
        mkdirSync(stillsDir, { recursive: true });
        const file = path.join(stillsDir, `${url.searchParams.get('name').replace(/[^\w.-]/g, '_')}.png`);
        writeFileSync(file, body);
        log(`still ${file}`);
      } else if (url.pathname === '/audio') {
        const file = path.resolve(args.out ?? path.join(outDir, 'score.wav'));
        writeFileSync(file, body);
        log(`wrote ${file} (${(body.length / 1e6).toFixed(1)} MB)`);
      } else if (url.pathname === '/log') {
        const level = url.searchParams.get('level');
        console.log(`[page${level === 'log' ? '' : ' ' + level}]`, body.toString('utf8'));
      } else if (url.pathname === '/fail') {
        finish.rej(new Error(`page failed: ${body.toString('utf8')}`));
      } else if (url.pathname === '/done') {
        finish.res();
      }
      res.end('ok');
    } catch (e) {
      res.statusCode = 500;
      res.end(String(e));
      finish.rej(e);
    }
  });
  await new Promise((r) => server.listen(capturePort, '127.0.0.1', r));

  if (!scoreMode && !stills) {
    mkdirSync(path.dirname(videoOut), { recursive: true });
    const enc = [
      '-c:v', 'libx264', '-preset', args.preset === 'final' ? 'veryslow' : 'medium', '-crf', String(cfg.crf),
      '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-tune', 'film',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', videoOut,
    ];
    const webm = args.webm
      ? ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p',
          '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', videoOut.replace(/\.mp4$/, '.webm')]
      : [];
    ffmpeg = spawn(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${cfg.w}x${cfg.h}`, '-r', String(cfg.fps), '-i', '-',
      '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv', ...enc,
      ...(webm.length ? ['-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv', ...webm] : []),
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    ffmpegDone = new Promise((res, rej) => ffmpeg.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)))));
  }

  const params = new URLSearchParams({
    mode: scoreMode ? 'score' : 'render',
    capture: `http://127.0.0.1:${capturePort}`,
    w: String(cfg.w), h: String(cfg.h), ss: String(cfg.ss), fps: String(cfg.fps), sub: String(cfg.sub),
    shutter: String(cfg.shutter), quality: cfg.quality,
  });
  if (args.from) params.set('from', args.from);
  if (args.to) params.set('to', args.to);
  if (stills) params.set('stills', stills);
  const pageUrl = `http://localhost:${port}/cinematic/intro.html?${params}`;
  const profile = mkdtempSync(path.join(process.env.TMPDIR ?? tmpdir(), 'rover-intro-chrome-'));
  const chromeArgs = [
    ...(args.headed ? [] : ['--headless=new']),
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1', '--window-size=1280,720',
    '--js-flags=--max-old-space-size=8192', pageUrl,
  ];
  log(`chrome ${scoreMode ? 'score' : stills ? `stills ${stills}` : `${cfg.w}x${cfg.h}@${cfg.fps} ss${cfg.ss} sub${cfg.sub} ${args.from ?? 0}-${args.to ?? 'end'} s`}`);
  const chrome = spawn(CHROME, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErr = '';
  chrome.stderr.on('data', (d) => (chromeErr = (chromeErr + d).slice(-4000)));
  chrome.on('exit', (code) => finish.rej(new Error(`chrome exited (${code}) before the render finished:\n${chromeErr}`)));

  const started = Date.now();
  const cleanup = async () => {
    chrome.removeAllListeners('exit');
    chrome.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (!args['keep-profile']) rmSync(profile, { recursive: true, force: true });
    server.close();
    await vite.close();
  };
  const onSignal = async () => {
    await cleanup();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    await finished;
  } catch (e) {
    await cleanup();
    ffmpeg?.stdin.end();
    throw e;
  }
  await cleanup();
  if (ffmpeg) {
    ffmpeg.stdin.end();
    await ffmpegDone;
    log(`wrote ${videoOut}: ${frames} frames (${(frames / cfg.fps).toFixed(2)} s), ${(statSync(videoOut).size / 1e6).toFixed(1)} MB`);
  }
  log(`took ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

if (args.web) webEncode();
else if (args.mux) mux();
else
  await capture().catch((e) => {
    console.error(e);
    process.exit(1);
  });
