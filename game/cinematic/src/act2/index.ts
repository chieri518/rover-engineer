// Act 2 · Arrival, at the game's Moon landing site (de Gerlache rim, the game's landing point): the lander
// stands on the regolith with Earth low on the horizon; its hatch swings down into a ramp; in the dark bay
// the rover wakes (status lights, solar mast, camera mast, the eye lights and turns to the door); it rolls
// down the ramp and its first wheel touches the regolith (the main theme starts there), leaving ruts.
//
// The game's real Moon world (terrain, photometric lighting, terrain sun masks, sky with Earth) via
// lib/world.ts; the game's own lander and rover are hidden: the film's lander (lander.ts) and the rigged
// hero rover (rig/heroRig.ts) stand in for them. Everything moves kinematically from the shot times.
import * as THREE from 'three';
import type { FrameState, SequenceDef } from '../timeline';
import type { PostParams } from '../post';
import { startWorld } from '../lib/world';
import { clamp01, easeInOutCubic, easeInOutSine, easeOutCubic, lerp, phase, smoothstep } from '../lib/ease';
import { skyDirection } from '../../../src/rules/sun';
import { ACT2_CUES, ACT2_SHOTS } from './timing';
import { buildLander, LANDER } from './lander';
import { Ground, meshHeight } from './ground';
import { Dust, type Grain } from './dust';
import { Earth } from './earth';
import { moonUniforms } from '../rig/lighting';
import { lunarEnvironment } from '../rig/env';
import { HeroRover, STOWED } from '../rig/heroRig';
import { seeded } from '../rig/textures';

// The Sun for this act: low in the west, 75° off the bay door: a thin slash of light rakes into the dark bay,
// side light for the wide shot (long shadows streaming east, a half-lit Earth), and cross light on the ruts.
const SUN_AZ = 275;
const SUN_EL = 1.8;
// The lander's door faces this azimuth (the ramp points there).
const DOOR_AZ = 200;
const SUN_DISC_RAD = (0.267 * Math.PI) / 180;

/** Sequence time (s) of each shot's start, and of each cue. */
const SHOT_START: Record<string, number> = {};
{
  let t = 0;
  for (const s of ACT2_SHOTS) {
    SHOT_START[s.id] = t;
    t += s.duration;
  }
}
const cue = (k: keyof typeof ACT2_CUES) => SHOT_START[ACT2_CUES[k].shot]! + ACT2_CUES[k].t;
const T = {
  hatchStart: cue('hatchStart'),
  rampDown: cue('rampDown'),
  leds: [cue('led1'), cue('led2'), cue('led3'), cue('led4')],
  panelStart: cue('panelStart'),
  mastStart: cue('mastStart'),
  eyeOn: cue('eyeOn'),
  eyeTurn: cue('eyeTurn'),
  wheelTouch: cue('wheelTouch'),
};

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

export const act2: SequenceDef[] = [
  {
    id: 'arrival',
    shots: ACT2_SHOTS,
    async load(ctx) {
      const final = ctx.settings.quality === 'final';
      const w = await startWorld('moon', ctx);
      const o = w.offline;
      const grid = w.scene.terrain.fine;
      o.lander.object.visible = false;
      o.rover.object.visible = false;
      o.setSun(SUN_AZ, SUN_EL);
      const sunDir = new THREE.Vector3().copy(skyDirection(SUN_AZ, SUN_EL) as unknown as THREE.Vector3);
      const earthDir = (() => {
        const e = skyDirection(w.data.tuning.earth.azimuthDeg, w.data.tuning.earth.elevationDeg);
        return new THREE.Vector3(e.x, e.y, e.z);
      })();
      const moon = moonUniforms(o);

      // The lander's frame: on the landing point, door toward DOOR_AZ.
      const doorDir = skyDirection(DOOR_AZ, 0);
      const yaw = Math.atan2(-doorDir.z, doorDir.x);
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const origin = new THREE.Vector3(w.landing.x, 0, w.landing.z);
      origin.y = meshHeight(grid, origin.x, origin.z);
      const toWorld = (lx: number, ly: number, lz: number, out = new THREE.Vector3()) =>
        out.set(origin.x + lx * cy + lz * sy, origin.y + ly, origin.z - lx * sy + lz * cy);
      const dirToLocal = (d: THREE.Vector3) => new THREE.Vector3(d.x * cy - d.z * sy, d.y, d.x * sy + d.z * cy);

      const env = lunarEnvironment(ctx.renderer, { sun: sunDir, ground: 0.07 });
      const envMap = env.texture;

      // Ground patches (blast halo, footpad berms, ruts, pebbles), then the lander on them.
      const wheelTrack = w.data.tuning.rover.wheelTrackM;
      const footpadsXZ = [0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        return new THREE.Vector3(Math.cos(a) * LANDER.footR, 0, -Math.sin(a) * LANDER.footR);
      });
      // Where the front wheels first touch the regolith: just past the ramp's toe (set once the lander is built).
      const tracks = { lines: [-wheelTrack / 2, wheelTrack / 2], halfWidth: 0.11, depth: 0.013, berm: 0.006, startX: 5.4, pitch: (2 * Math.PI * w.data.tuning.rover.wheelRadiusM) / 18, slant: 0.55 };
      const ground = new Ground({ grid, moon, frame: { origin, yaw }, tracks, footpads: footpadsXZ, footPadR: LANDER.footPadR, envMap });
      o.scene.add(ground.group);
      const lander = buildLander({
        moon,
        envMap,
        groundLocal: (x, z) => ground.heightLocal(x, z),
        earthLocal: dirToLocal(earthDir),
        sunLocal: dirToLocal(sunDir),
      });
      lander.object.position.copy(origin);
      lander.object.rotation.y = yaw;
      o.scene.add(lander.object);
      // The ramp's toe, and the first touch.
      const toeX = LANDER.hingeX + Math.sin(lander.openAngle) * (LANDER.doorTopY - LANDER.floorY);
      tracks.startX = toeX + 0.02; // the wheel's contact leaves the toe here: wheelTouch

      // The hero rover in the bay.
      const rover = new HeroRover(w.data, { offline: o, envMap });
      o.scene.add(rover.object);
      const r = w.data.tuning.rover;
      const BAY_X = 1.42;

      /** Surface under a wheel (lander-local): bay floor, ramp, or regolith (in the rut once pressed). */
      const surfaceLocal = (lx: number, lz: number): number => {
        const g = ground.heightLocal(lx, lz);
        if (lx < LANDER.hingeX && Math.abs(lz) < LANDER.bayHalfW) return LANDER.floorY;
        const ramp = lander.rampHeight(lx, lz);
        const rut = lx > tracks.startX ? -tracks.depth * 0.8 : 0;
        return ramp !== null ? Math.max(ramp, g) : g + rut;
      };
      const surfaceWorld = (wx: number, wz: number) => {
        const dx = wx - origin.x;
        const dz = wz - origin.z;
        return surfaceLocal(dx * cy - dz * sy, dx * sy + dz * cy) + origin.y;
      };

      // The drive: the front wheels' contact x (lander-local) over the tracks shot, and the distance rolled.
      const tTracks = SHOT_START.tracks!;
      const speed = (t: number) => 0.45 + 1.2 * smoothstep(T.wheelTouch + 0.15, T.wheelTouch + 2.2, t);
      const DT = 1 / 240;
      const frontAt = (t: number) => {
        // Integrate the speed from the touch (so the touch lands exactly on its cue).
        let x = tracks.startX;
        if (t >= T.wheelTouch) for (let s = T.wheelTouch; s < t; s += DT) x += speed(Math.min(t, s + DT / 2)) * Math.min(DT, t - s);
        else for (let s = t; s < T.wheelTouch; s += DT) x -= speed(Math.min(T.wheelTouch, s + DT / 2)) * Math.min(DT, T.wheelTouch - s);
        return x;
      };

      // Dust: the touchdown spray still falling, the ramp toe's puff, grains off the wheels, motes in the bay.
      const rand = seeded(2026);
      const sunCol = new THREE.Color(0.8, 0.76, 0.68);
      const shadowCyl = { center: new THREE.Vector2(origin.x, origin.z), radius: LANDER.radius, y0: origin.y + LANDER.bottomY, y1: origin.y + LANDER.deckY + 0.3 };
      const touchdownGrains: Grain[] = [];
      const fine = final ? 16000 : 8000;
      for (let i = 0; i < fine + 900; i++) {
        const coarse = i >= fine;
        const a = rand() * Math.PI * 2;
        const r0 = 2.8 + rand() * 3.5;
        const lx = Math.cos(a) * r0;
        const lz = Math.sin(a) * r0;
        const p = toWorld(lx, 0.02, lz);
        p.y = meshHeight(grid, p.x, p.z) + 0.02;
        const sp = coarse ? 1.0 + rand() * 2.6 : 0.6 + Math.pow(rand(), 1.4) * 3.6;
        const el = (coarse ? 15 + rand() * 35 : 5 + rand() * 30) * (Math.PI / 180);
        const dirW = new THREE.Vector3(Math.cos(a) * cy + Math.sin(a) * sy, 0, -Math.cos(a) * sy + Math.sin(a) * cy);
        const v = dirW.multiplyScalar(sp * Math.cos(el)).setY(sp * Math.sin(el));
        const t0 = -1.6 + rand() * 1.45; // the engines cut just before the shot opens: the last of the spray still falling
        touchdownGrains.push({ p, v, t0, groundY: p.y - 0.02 + (rand() - 0.5) * 0.05, size: coarse ? 0.02 + rand() * 0.02 : 0.012 + rand() * 0.02, bright: coarse ? 0.35 + rand() * 0.4 : 0.1 + rand() * 0.18 });
      }
      const touchdownDust = new Dust(touchdownGrains, { g: 1.62, sun: sunDir, color: sunCol, intensity: 0.9, shadow: shadowCyl, viewportHeight: ctx.height });
      o.scene.add(touchdownDust.points);

      const puffGrains: Grain[] = [];
      for (let i = 0; i < (final ? 6000 : 2500); i++) {
        const lz = (rand() * 2 - 1) * 0.95;
        const p = toWorld(toeX + (rand() - 0.5) * 0.15, 0, lz);
        p.y = meshHeight(grid, p.x, p.z) + 0.02;
        const a = rand() * Math.PI * 2;
        const sp = 0.2 + Math.pow(rand(), 2) * 1.6;
        const el = (10 + rand() * 50) * (Math.PI / 180);
        const v = new THREE.Vector3(Math.cos(a) * sp * Math.cos(el), sp * Math.sin(el), Math.sin(a) * sp * Math.cos(el));
        puffGrains.push({ p, v, t0: T.rampDown + rand() * 0.06, groundY: p.y - 0.01, size: 0.0015 + rand() * 0.003, bright: 0.4 + rand() * 0.6 });
      }
      const puff = new Dust(puffGrains, { g: 1.62, sun: sunDir, color: sunCol, intensity: 2.2, shadow: shadowCyl, viewportHeight: ctx.height });
      o.scene.add(puff.points);

      const wheelGrains: Grain[] = [];
      for (let i = 0; i < (final ? 3500 : 1500); i++) {
        const t0 = T.wheelTouch - 0.05 + rand() * (SHOT_START.tracks! + 4.6 - T.wheelTouch);
        const fx = frontAt(t0);
        const line = tracks.lines[i % 2]!;
        const behind = i % 4 < 2 ? 0 : r.wheelBaseM; // front and rear wheels
        const lx = fx - behind - 0.02 + (rand() - 0.5) * 0.06;
        if (lx < tracks.startX) continue;
        const lz = line + (rand() - 0.5) * 0.2;
        const p = toWorld(lx, 0, lz);
        p.y = meshHeight(grid, p.x, p.z) + 0.01;
        // Thrown up and back off the tread.
        const sp = 0.15 + Math.pow(rand(), 2) * 0.8;
        const back = new THREE.Vector3(-cy, 0, sy);
        const side = new THREE.Vector3(sy, 0, cy);
        const v = back.multiplyScalar(sp * (0.3 + rand() * 0.7)).addScaledVector(side, (rand() - 0.5) * sp * 0.6).setY(sp * (0.6 + rand() * 0.8));
        wheelGrains.push({ p, v, t0, groundY: p.y - 0.01, size: 0.0012 + rand() * 0.003, bright: 0.5 + rand() * 0.7 });
      }
      const wheelDust = new Dust(wheelGrains, { g: 1.62, sun: sunDir, color: sunCol, intensity: 0.8, viewportHeight: ctx.height });
      o.scene.add(wheelDust.points);

      const doorCenter = toWorld(LANDER.hingeX - 0.05, (LANDER.floorY + LANDER.doorTopY) / 2, 0);
      const doorN = new THREE.Vector3(cy, 0, -sy);
      const doorU = new THREE.Vector3(sy, 0, cy);
      const moteGrains: Grain[] = [];
      for (let i = 0; i < (final ? 600 : 300); i++) {
        const lx = LANDER.bayBackX + 0.2 + rand() * (LANDER.hingeX - LANDER.bayBackX - 0.2);
        const ly = LANDER.floorY + 0.1 + rand() * 2.7;
        const lz = (rand() * 2 - 1) * (LANDER.bayHalfW - 0.05);
        const p = toWorld(lx, ly, lz);
        const v = new THREE.Vector3((rand() - 0.5) * 0.05, 0.02 + rand() * 0.04, (rand() - 0.5) * 0.05);
        moteGrains.push({ p, v, t0: SHOT_START.doors! - rand() * 2, groundY: -Infinity, size: 0.0008 + Math.pow(rand(), 3) * 0.0025, bright: 0.4 + rand() * 0.8 });
      }
      const motes = new Dust(moteGrains, {
        g: 0.012,
        sun: sunDir,
        color: sunCol,
        intensity: 1.4,
        beam: { center: doorCenter, axisU: doorU, axisV: new THREE.Vector3(0, 1, 0), halfU: LANDER.doorHalfW, halfV: (LANDER.doorTopY - LANDER.floorY) / 2, normal: doorN },
        viewportHeight: ctx.height,
      });
      o.scene.add(motes.points);
      const dusts = [touchdownDust, puff, wheelDust, motes];
      const earth = new Earth(earthDir, sunDir);
      o.scene.add(earth.mesh);

      // Shadows: a big map, framed tightly per shot.
      const shadow = o.sunLight.shadow;
      shadow.mapSize.set(final ? 4096 : 2048, final ? 4096 : 2048);
      shadow.map?.dispose();
      shadow.map = null;
      shadow.radius = 2.5;

      const camera = o.camera;
      camera.near = 0.03;
      camera.far = 400_000;
      const look = new THREE.Vector3();
      const tmp = new THREE.Vector3();

      // ---------------------------------------------------------------------------------------------
      // Animation state from the time.
      const poseRover = (t: number) => {
        // In the bay until the tracks shot, then rolling down the ramp.
        if (t < tTracks) {
          const c = toWorld(BAY_X, 0, 0);
          rover.placeOnGround(c.x, c.z, yaw, surfaceWorld);
          rover.setWheelRoll(0);
          ground.front.value = -1e9;
        } else {
          const fx = frontAt(t);
          const cx = fx - r.wheelBaseM / 2;
          const c = toWorld(cx, 0, 0);
          rover.placeOnGround(c.x, c.z, yaw, surfaceWorld);
          rover.setWheelRoll(cx - BAY_X);
          ground.front.value = fx;
        }
        // The wake-up.
        const wake = SHOT_START.wake!;
        const leds = T.leds.map((t0) => {
          if (t < t0) return 0;
          const k = t - t0;
          // A quick blink: on, off, on.
          if (k < 0.05) return 1;
          if (k < 0.1) return 0.15;
          return 1;
        });
        leds.forEach((k, i) => rover.dress.setLed(i, t < wake ? 0 : k));
        const panel = phase(t, T.panelStart, T.panelStart + 1.25, easeInOutCubic);
        const mast = phase(t, T.mastStart, T.mastStart + 0.95, easeInOutCubic);
        const tiltUp = phase(t, T.mastStart + 0.4, T.eyeOn, easeInOutSine);
        const turn = phase(t, T.eyeTurn, T.eyeTurn + 0.75, easeInOutCubic);
        rover.setPose({
          panel: t < wake ? 0 : panel,
          mast: t < wake ? 0 : mast,
          tilt: lerp(STOWED.tilt, 0.04, tiltUp),
          pan: lerp(STOWED.pan, -0.12, turn),
        });
        let eye = 0;
        if (t >= T.eyeOn) {
          const k = t - T.eyeOn;
          eye = k < 0.04 ? 0.7 : k < 0.09 ? 0.1 : Math.min(1, 0.5 + k * 3);
        }
        rover.setEye(eye);
        rover.dress.setLamps(0);
        // Indoors: little fill; it grows as the rover rolls out.
        const out = t < tTracks ? 0 : smoothstep(0.4, 1, (frontAt(t) - LANDER.hingeX) / 3);
        rover.dress.setIndirect(lerp(0.06, 1, out));
      };

      const poseLander = (t: number) => {
        const open = phase(t, T.hatchStart, T.rampDown, (k) => {
          // Lowered on cables: eases off, swings, and settles on the ground with a small bounce.
          const e = easeInOutSine(k);
          return e;
        });
        let angle = open * lander.openAngle;
        if (t > T.rampDown) angle = lander.openAngle - 0.012 * Math.exp(-(t - T.rampDown) * 9) * Math.sin((t - T.rampDown) * 40);
        lander.setFill(t < tTracks ? 1 : 0);
        lander.setHatch(Math.min(lander.openAngle, angle));
        lander.setGlow(Math.exp(-Math.max(0, t + 0.6) / 1.8));
        lander.setBayLights(t > T.hatchStart - 0.2 ? 1 : 0.6, smoothstep(T.hatchStart + 0.8, T.rampDown + 0.4, t));
      };

      // ---------------------------------------------------------------------------------------------
      // Cameras, per shot (lander-local positions and targets).
      interface View {
        pos: THREE.Vector3;
        target: THREE.Vector3;
        fov: number;
        focus?: number;
        aperture?: number;
        post?: Partial<PostParams>;
        shadow: { center: THREE.Vector3; half: number; up: number; down: number; depth: number; bias: number; normalBias: number };
      }
      const L = (x: number, y: number, z: number) => toWorld(x, y, z, new THREE.Vector3());
      /** A point at lander-local (x, z), `h` above the ground there. */
      const onGround = (x: number, h: number, z: number) => L(x, ground.heightLocal(x, z) + h, z);

      const touchdownView = (k: number): View => {
        // Telephoto from the south, a little above the ground: the lander on the regolith, Earth low on the
        // horizon beside it (the long lens makes Earth large next to the lander).
        const e = easeInOutSine(k);
        const azC = ((186.2 - 0.9 * e) * Math.PI) / 180;
        const dist = lerp(74, 69, e);
        const pos = new THREE.Vector3(origin.x + Math.sin(azC) * dist, 0, origin.z - Math.cos(azC) * dist);
        pos.y = meshHeight(grid, pos.x, pos.z) + lerp(5.0, 5.2, e);
        // Aim between the lander and Earth.
        const toLander = L(0, 2.6, 0).sub(pos).normalize();
        const dir = toLander.multiplyScalar(0.55).add(earthDir.clone().multiplyScalar(0.45)).normalize();
        dir.y += 0.006;
        return {
          pos,
          target: pos.clone().add(dir),
          fov: 9.2,
          post: { exposure: 0.95, bloomThreshold: 4 },
          shadow: { center: L(0, 3.2, 0), half: 7.5, up: 5.5, down: 10, depth: 500, bias: -0.00012, normalBias: 0.03 },
        };
      };
      const doorsView = (k: number): View => {
        // Closer, on the sunward side: the hatch lowers toward us; light slashes into the bay.
        const e = easeInOutSine(k);
        const pos = onGround(lerp(9.6, 8.4, e), lerp(1.05, 0.95, e), lerp(4.6, 4.0, e));
        const target = L(2.7, lerp(2.55, 2.25, e), lerp(-0.35, -0.25, e));
        return {
          pos,
          target,
          fov: 36,
          focus: pos.distanceTo(L(2.9, 2.2, 0)),
          aperture: 0.004,
          post: { exposure: 1.0, bloomThreshold: 4 },
          shadow: { center: L(2.5, 2.2, 0), half: 5.5, up: 4.5, down: 4.5, depth: 200, bias: -0.00008, normalBias: 0.02 },
        };
      };
      const wakeView = (k: number): View => {
        // On the ramp at the door, a little above the deck, looking into the dark bay at the rover's face: its
        // silhouette against the dim work light at the back; the status lights blink on along the deck, the
        // folded solar mast swings up behind, the camera mast starts to rise toward us.
        const e = easeInOutSine(k);
        const pos = L(lerp(4.1, 3.8, e), lerp(2.98, 3.05, e), lerp(-0.34, -0.24, e));
        const leds = new THREE.Vector3();
        rover.dress.leds[1]?.mesh.getWorldPosition(leds);
        const panelTop = L(BAY_X - 0.4, 2.55 + 0.9 * smoothstep(0.45, 0.95, k), 0);
        const target = leds.clone().lerp(panelTop, lerp(0.3, 0.6, smoothstep(0.35, 0.95, k)));
        const focusPoint = leds.clone().lerp(L(BAY_X, 2.45, 0), smoothstep(0.45, 0.8, k));
        return {
          pos,
          target,
          fov: lerp(36, 33, e),
          focus: pos.distanceTo(focusPoint),
          aperture: 0.006,
          post: { exposure: 2.1, bloomThreshold: 1.4, bloomStrength: 0.45, bloomRadius: 0.55, minSubframes: 28, lift: 0.004, liftColor: [0.5, 0.65, 1] },
          shadow: { center: L(1.6, 2.3, 0), half: 3.4, up: 2.4, down: 2.4, depth: 120, bias: -0.00006, normalBias: 0.012 },
        };
      };
      const gazeView = (k: number): View => {
        // On the ramp at the head's height, a close-up: the head finishes rising, its eye lights, it turns to us.
        const e = easeInOutSine(k);
        const pos = L(lerp(4.05, 3.9, e), lerp(3.08, 3.1, e), lerp(0.66, 0.56, e));
        const head = new THREE.Vector3();
        rover.rig.cameraTilt?.getWorldPosition(head);
        const target = head.clone().add(new THREE.Vector3(0, 0.035, 0));
        return {
          pos,
          target,
          fov: lerp(14, 12.5, e),
          focus: pos.distanceTo(head) - 0.07,
          aperture: 0.006,
          post: { exposure: 2.0, bloomThreshold: 1.5, bloomStrength: 0.3, bloomRadius: 0.45, minSubframes: 28, lift: 0.004, liftColor: [0.5, 0.65, 1] },
          shadow: { center: L(1.9, 2.6, 0), half: 3.0, up: 2.4, down: 2.4, depth: 120, bias: -0.00006, normalBias: 0.012 },
        };
      };
      const tracksView = (t: number): View => {
        // Wheel height, on the sunlit side: the front-right wheel rolls down the ramp's toe and touches the
        // regolith (shallow focus); the camera follows the rover past, then lets it drive out of frame and
        // settles on the fresh ruts it leaves, its long shadow sweeping off across them.
        const fx = frontAt(t);
        const settle = smoothstep(T.wheelTouch + 1.3, T.wheelTouch + 2.7, t);
        const px = tracks.startX + lerp(1.0, 0.55, settle);
        const pz = wheelTrack / 2 + lerp(1.9, 1.6, settle);
        const pos = onGround(px, lerp(0.26, 0.36, settle), pz);
        const wheel = onGround(fx, 0.26, wheelTrack / 2);
        const follow = smoothstep(T.wheelTouch + 0.15, T.wheelTouch + 1.5, t);
        const ahead = onGround(fx - 0.9, 0.45, 0.2);
        const ruts = onGround(tracks.startX + 2.2, 0.02, 0.1);
        const target = wheel.clone().lerp(ahead, follow).lerp(ruts, settle);
        const focusPoint = wheel.clone().lerp(ahead, follow).lerp(onGround(tracks.startX + 1.3, 0, wheelTrack / 2), settle);
        return {
          pos,
          target,
          fov: lerp(36, 40, settle),
          focus: pos.distanceTo(focusPoint),
          aperture: 0.009,
          post: { exposure: 1.05, bloomThreshold: 4, minSubframes: 28 },
          shadow: { center: L(tracks.startX + 1.6, 0.5, 0.3), half: 4.5, up: 2.6, down: 3.2, depth: 200, bias: -0.00003, normalBias: 0.006 },
        };
      };

      let subframes = ctx.settings.subframes;
      const sunPos = new THREE.Vector3();
      const placeShadow = (v: View, t: number) => {
        // The Sun's disc (0.53°): each motion-blur sub-frame sees it from a different point of the disc
        // (the same points every frame), so the shadows get true penumbrae.
        const fps = ctx.settings.fps;
        const open = ctx.settings.shutter / fps;
        const tc = Math.round(t * fps) / fps;
        const n = Math.max(1, subframes);
        const i = Math.max(0, Math.min(n - 1, Math.round(((t - tc) / open + 0.5) * n - 0.5)));
        const rr = Math.sqrt((i + 0.5) / n) * SUN_DISC_RAD;
        const a = i * 2.39996323 + 0.4;
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(sunDir, up).normalize();
        const up2 = new THREE.Vector3().crossVectors(side, sunDir).normalize();
        const d = n > 1 ? sunDir.clone().addScaledVector(side, Math.cos(a) * rr).addScaledVector(up2, Math.sin(a) * rr).normalize() : sunDir;
        const s = v.shadow;
        const L0 = o.sunLight;
        L0.target.position.copy(s.center);
        sunPos.copy(s.center).addScaledVector(d, s.depth * 0.5);
        L0.position.copy(sunPos);
        L0.target.updateMatrixWorld();
        L0.updateMatrixWorld();
        const cam = L0.shadow.camera as THREE.OrthographicCamera;
        cam.left = -s.half;
        cam.right = s.half;
        cam.top = s.up;
        cam.bottom = -s.down;
        cam.near = 0.5;
        cam.far = s.depth;
        cam.updateProjectionMatrix();
        L0.shadow.bias = s.bias;
        L0.shadow.normalBias = s.normalBias;
        void halton;
      };

      return {
        update(f: FrameState) {
          const t = f.seqT;
          poseLander(t);
          poseRover(t);
          for (const d of dusts) d.update(t);
          let v: View;
          const shot = ACT2_SHOTS.find((s) => s.id === f.shot)!;
          const k = clamp01(f.t / shot.duration);
          if (f.shot === 'touchdown') v = touchdownView(k);
          else if (f.shot === 'doors') v = doorsView(k);
          else if (f.shot === 'wake') v = wakeView(k);
          else if (f.shot === 'gaze') v = gazeView(k);
          else v = tracksView(t);
          camera.position.copy(v.pos);
          camera.up.set(0, 1, 0);
          camera.lookAt(look.copy(v.target));
          camera.fov = v.fov;
          camera.aspect = ctx.width / ctx.height;
          camera.near = v.fov < 15 ? 1 : 0.03;
          camera.updateProjectionMatrix();
          // Terrain detail around the subject; sky follows the camera.
          tmp.copy(v.shadow.center);
          o.updateView(f.dt, { x: tmp.x, z: tmp.z });
          const post: Partial<PostParams> = {
            focusDistance: v.focus ?? 10,
            aperture: v.aperture ?? 0,
            vignette: 0.32,
            grain: 0.22,
            ...v.post,
          };
          subframes = ctx.settings.subframes > 1 ? Math.max(ctx.settings.subframes, final ? post.minSubframes ?? 0 : 0) : 1;
          placeShadow(v, f.filmT);
          for (const d of dusts) d.setCamera(camera, ctx.height);
          earth.update(camera);
          return { camera, post };
        },
        render(target) {
          o.draw(target);
        },
        dispose() {
          for (const d of dusts) d.dispose();
          earth.dispose();
          rover.dispose();
          lander.dispose();
          ground.dispose();
          env.dispose();
          w.scene.dispose();
        },
      };
    },
  },
];

void easeOutCubic;
