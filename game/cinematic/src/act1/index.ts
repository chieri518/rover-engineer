// Act 1 · Leaving Earth. One sequence, three shots:
//   ignition  extreme close-up of the engine bells in the pre-dawn dark: cold vapour, floodlights, igniter sparks,
//             the green igniter flash, then the engines light and fire boils up out of the flame hole.
//   liftoff   a pull-back from the base to the whole rocket rising off the pad on its column of fire, the trench
//             blasting clouds east and west, the tower falling away, the dawn glowing over the sea.
//   orbit     high over the Earth at sunrise: the rocket climbs over the curve of the planet, its plume lit by the
//             sun into a huge translucent bell; the first stage separates and the upper stage lights.
import * as THREE from 'three';
import type { SequenceDef, SequenceInstance, FrameState, FrameView } from '../timeline';
import type { PostParams } from '../post';
import { ACT1_SHOTS } from './timing';
import { buildRocket, ROCKET } from './rocket';
import { buildPad, FLOODS, PAD } from './pad';
import { makeSkyDome } from './sky';
import { makeFogUniforms } from './atmo';
import { Plume } from './plume';
import { SmokeSystem, SparkSystem } from './particles';
import { buildSpawns, engineLevel, ENGINE_START, groundAt, igniterFlash, nozzleY, rise, rocketBaseY, T } from './launch';
import { buildOrbit } from './orbit';
import { clamp01, easeInOutCubic, easeInOutSine, easeOutCubic, lerp, noise1, phase, shake, smoothstep } from '../lib/ease';

/** The sun: below the eastern horizon at the pad (pre-dawn), ENE. */
const SUN_AZ = THREE.MathUtils.degToRad(-12); // from +x toward -z (north)
const SUN_EL = THREE.MathUtils.degToRad(-3.5);

export const act1: SequenceDef[] = [
  {
    id: 'launch',
    shots: ACT1_SHOTS,
    async load(ctx): Promise<SequenceInstance> {
      const { renderer } = ctx;
      const quality = ctx.settings.quality;
      const sunDir = new THREE.Vector3(Math.cos(SUN_EL) * Math.cos(SUN_AZ), Math.sin(SUN_EL), -Math.cos(SUN_EL) * Math.sin(SUN_AZ)).normalize();

      // ------------------------------------------------------------------------------------------ pad scene
      const scene = new THREE.Scene();
      const fog = makeFogUniforms(sunDir);
      const sky = makeSkyDome(sunDir);
      scene.add(sky.mesh);

      // Image-based light from the sky alone.
      const skyScene = new THREE.Scene();
      const skyOnly = makeSkyDome(sunDir);
      skyOnly.uniforms.starAmount.value = 0;
      skyScene.add(skyOnly.mesh);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromScene(skyScene, 0, 0.1, 50000);
      pmrem.dispose();
      skyOnly.mesh.geometry.dispose();
      (skyOnly.mesh.material as THREE.Material).dispose();
      scene.environment = envRT.texture;
      scene.environmentIntensity = 1.4;

      const rocket = await buildRocket(renderer);
      scene.add(rocket.group);
      const pad = buildPad(renderer, fog);
      scene.add(pad.group);

      // Lights. Physical units (candela for point/spot, lux for directional).
      const hemi = new THREE.HemisphereLight(0x3a4c80, 0x0c0a0a, 0.25);
      scene.add(hemi);
      const dawn = new THREE.DirectionalLight(0xff9a6a, 0.35);
      dawn.position.copy(new THREE.Vector3(sunDir.x, 0.12, sunDir.z).normalize().multiplyScalar(400));
      scene.add(dawn);
      const floods = FLOODS.map((f, i) => {
        const s = new THREE.SpotLight(0xd8e4ff, 5e4, 0, THREE.MathUtils.degToRad(9), 0.55, 2);
        s.position.copy(f.pos).setY(f.pos.y + 2.4);
        s.target.position.copy(f.target);
        if (i < 2) {
          s.castShadow = true;
          s.shadow.mapSize.set(1024, 1024);
          s.shadow.camera.near = 50;
          s.shadow.camera.far = 400;
          s.shadow.bias = -0.0004;
        }
        scene.add(s, s.target);
        return s;
      });
      const flameKey = new THREE.PointLight(0xff8a3a, 0, 0, 2);
      const flameLow = new THREE.PointLight(0xff7a30, 0, 0, 2);
      const trenchE = new THREE.PointLight(0xff7a30, 0, 0, 2);
      const trenchW = new THREE.PointLight(0xff7a30, 0, 0, 2);
      trenchE.position.set(26, 4, 0);
      trenchW.position.set(-26, 4, 0);
      flameKey.castShadow = true;
      flameKey.shadow.mapSize.set(1024, 1024);
      flameKey.shadow.camera.near = 0.5;
      flameKey.shadow.camera.far = 300;
      flameKey.shadow.bias = -0.002;
      scene.add(flameKey, flameLow, trenchE, trenchW);

      const plume = new Plume({ boundR: 16, boundL: 80, engines: ROCKET.engines, exitR: ROCKET.bellExitR });
      plume.mesh.position.y = ROCKET.bellExitY;
      rocket.group.add(plume.mesh);

      const spawns = buildSpawns(quality);
      const smoke = new SmokeSystem({ renderer, spawns: spawns.smoke, wind: new THREE.Vector3(1.5, 0, 2.0), groundAt });
      scene.add(smoke.far.mesh, smoke.near.mesh);
      const sparks = new SparkSystem(spawns.sparks, 60);
      scene.add(sparks.mesh);

      // Depth of the opaque scene (log depth), for soft particles and to clip the plume march.
      const depthRT = new THREE.WebGLRenderTarget(ctx.width, ctx.height, { depthBuffer: true });
      depthRT.depthTexture = new THREE.DepthTexture(ctx.width, ctx.height, THREE.FloatType);
      const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
      const transparentObjs: THREE.Object3D[] = [sky.mesh, plume.mesh, smoke.far.mesh, smoke.near.mesh, sparks.mesh];
      pad.group.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.Material).transparent) transparentObjs.push(o);
      });

      const camera = new THREE.PerspectiveCamera(35, ctx.width / ctx.height, 0.05, 40000);
      const res = new THREE.Vector2(ctx.width, ctx.height);
      for (const u of [plume.uniforms, smoke.uniforms]) {
        u.tDepth.value = depthRT.depthTexture;
        u.resolution.value = res;
        u.logFar.value = Math.log2(camera.far + 1);
      }

      // ------------------------------------------------------------------------------------------ orbit scene
      const orbit = await buildOrbit(ctx, rocket);

      let tNow = 0;
      let sub = 0;
      let inOrbit = false;
      const lightSet = { pos: [] as THREE.Vector3[], col: [] as THREE.Vector3[], radius: [] as number[] };
      const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

      function thrust(t: number) {
        let s = 0;
        for (let i = 0; i < ENGINE_START.length; i++) s += engineLevel(i, t);
        return s / ENGINE_START.length;
      }

      function updatePad(f: FrameState): FrameView {
        const t = f.seqT;
        tNow = t;
        const th = thrust(t);
        const ris = rise(t);
        const baseY = rocketBaseY(t);
        if (rocket.group.parent !== scene) scene.add(rocket.group);
        plume.mesh.visible = true;
        rocket.group.position.set(0, baseY, 0);
        rocket.group.rotation.set(0, 0, 0);
        rocket.stage2.position.set(0, 0, 0);
        rocket.stage1.position.set(0, 0, 0);
        rocket.stage1.rotation.set(0, 0, 0);
        const glows = ENGINE_START.map((_, i) => Math.min(1.2, engineLevel(i, t)));
        const ig = Math.max(...ENGINE_START.map((_, i) => igniterFlash(i, t)));
        rocket.setEngines(glows, ig, t);
        rocket.setMvac(0, 0);

        // Plume.
        const pu = plume.uniforms;
        pu.time.value = t;
        for (let i = 0; i < 5; i++) {
          const lv = engineLevel(i, t);
          pu.engineOn.value[i] = lv;
          pu.front.value[i] = Math.max(0, t - ENGINE_START[i]!) * 70;
        }
        pu.columnOn.value = clamp01(th * smoothstep(ENGINE_START[0]!, ENGINE_START[0]! + 0.5, t));
        pu.columnLen.value = 38 + 22 * smoothstep(0, 80, ris);
        pu.spread.value = 0.1;
        const nY = nozzleY(t);
        pu.floorS.value = ris < 6 ? nY - 4.0 : nY - PAD.deckY;
        if (ris > 60) pu.floorS.value = nY;
        pu.steps.value = f.shot === 'ignition' ? 14 : quality === 'final' ? 26 : 20;
        pu.gain.value = f.shot === 'ignition' ? 0.4 : 1;

        // Flame lights, flickering.
        const flick = (seed: number) => 1 + 0.18 * noise1(t * 23, seed) + 0.1 * noise1(t * 57, seed + 3);
        const ignFlash = ig;
        flameKey.position.set(0.5, nY - 3, 1.0);
        flameKey.intensity = th * 2.5e3 * flick(1) + ignFlash * 150;
        flameKey.color.setRGB(1, 0.55, 0.22);
        if (ignFlash > th) flameKey.color.setRGB(0.4, 1, 0.5);
        flameLow.position.set(0, Math.max(2, nY - 30), 0);
        flameLow.intensity = th * smoothstep(5, 30, ris) * 1.2e4 * flick(2);
        const tr = th * (1 - smoothstep(25, 80, ris)) * smoothstep(T.ignition + 0.3, T.ignition + 0.9, t);
        trenchE.intensity = tr * 4e3 * flick(4);
        trenchW.intensity = tr * 4e3 * flick(5);

        // Floodlights fade as the dawn and the flames take over? They stay on; beams hazier before ignition.
        pad.beamUniforms.intensity.value = 1 - 0.6 * smoothstep(T.ignition, T.ignition + 3, t);
        pad.beamUniforms.time.value = t;
        pad.setArms(smoothstep(T.ignition - 0.4, T.release + 1.2, t));
        sky.uniforms.skyTime.value = t;
        fog.skyTime.value = t;

        // Smoke lighting: flame lights and floodlights.
        lightSet.pos = [flameKey.position.clone(), flameLow.position.clone(), trenchE.position.clone(), trenchW.position.clone(), ...floods.map((s) => s.position.clone())];
        const fc = (I: number, r: number, g: number, b: number) => v3(r, g, b).multiplyScalar(I);
        lightSet.col = [
          fc(th * 10 * flick(1) + ignFlash * 2, 1, 0.5, 0.2),
          fc(th * smoothstep(5, 30, ris) * 30 * flick(2), 1, 0.5, 0.2),
          fc(tr * 30 * flick(4), 1, 0.42, 0.14),
          fc(tr * 30 * flick(5), 1, 0.42, 0.14),
          ...floods.map(() => fc(0.25, 0.8, 0.88, 1.0)),
        ];
        lightSet.radius = [5, 10, 6, 6, 160, 160, 160];
        smoke.setLights(lightSet);
        smoke.uniforms.skyAmb.value.set(0.11, 0.13, 0.22);
        smoke.uniforms.groundAmb.value.set(0.03, 0.025, 0.03);
        smoke.uniforms.dawnDir.value.set(sunDir.x, 0.15, sunDir.z).normalize();
        smoke.uniforms.dawnCol.value.set(0.22, 0.1, 0.07);
        smoke.uniforms.fireGain.value = f.shot === 'ignition' ? 18 : 12;
        sparks.uniforms.time.value = t;

        // ---------------------------------------------------------------------------- cameras and looks
        let post: Partial<PostParams>;
        if (f.shot === 'ignition') {
          const k = f.t / ACT1_SHOTS[0]!.duration;
          const hit = smoothstep(T.ignition - 0.2, T.ignition + 0.1, t);
          const shk = (0.004 + 0.05 * hit * (1 - 0.5 * smoothstep(T.ignition + 0.6, T.shot2, t))) ;
          const push = easeInOutSine(k);
          camera.fov = lerp(30, 27, push);
          camera.position.set(lerp(1.4, 0.6, push), lerp(11.7, 11.5, push), lerp(7.2, 5.9, push));
          camera.position.x += shake(t, 11, 7) * shk;
          camera.position.y += shake(t, 12, 7) * shk;
          const look = v3(lerp(-0.5, -0.1, push), lerp(13.4, 13.1, push), lerp(-0.3, 0, push));
          look.x += shake(t, 13, 9) * shk * 0.5;
          look.y += shake(t, 14, 9) * shk * 0.5;
          camera.lookAt(look);
          const focus = camera.position.distanceTo(v3(-0.3, 13.2, 0.4));
          const preExp = 1.35;
          const postExp = 0.32;
          post = {
            exposure: lerp(preExp, postExp, 0.85 * smoothstep(T.ignition - 0.2, T.ignition + 0.08, t) + 0.15 * smoothstep(T.ignition + 0.2, T.ignition + 1.0, t)) * (1 + 0.3 * ig),
            bloomStrength: lerp(0.45, 0.12, hit),
            bloomRadius: 0.75,
            bloomThreshold: lerp(1.5, 6.0, hit),
            focusDistance: focus,
            aperture: 0.045,
            minSubframes: 24,
            vignette: 0.42,
            grain: 0.32,
            chromaticAberration: 0.9,
            tint: [1, 0.98, 1.04],
            saturation: 1.05,
            contrast: 1.08,
            lift: 0.006,
            liftColor: [0.4, 0.55, 1],
            fade: smoothstep(0, 0.6, f.t),
          };
        } else {
          // Liftoff: pull back and crane up from the base to the whole rocket rising.
          const k = f.t / ACT1_SHOTS[1]!.duration;
          const pull = easeOutCubic(clamp01(k * 1.05));
          const a0 = v3(-15, 9, 27);
          const a1 = v3(-125, 22, 170);
          camera.position.lerpVectors(a0, a1, pull);
          camera.position.y += 14 * easeInOutCubic(k);
          const roar = th * (1 - 0.6 * pull);
          const shk = 0.03 + 0.22 * roar;
          camera.position.x += shake(t, 21, 5) * shk;
          camera.position.y += shake(t, 22, 5) * shk;
          const lookY = lerp(18, baseY * 0.62 + 14, phase(k, 0.0, 1.0, easeInOutSine));
          const look = v3(0, lookY, 0);
          look.x += shake(t, 23, 6) * shk * 0.4;
          camera.lookAt(look);
          camera.fov = lerp(52, 38, pull);
          post = {
            exposure: lerp(0.8, 1.05, pull),
            bloomStrength: 0.75,
            bloomRadius: 0.8,
            bloomThreshold: 2.2,
            focusDistance: camera.position.distanceTo(v3(0, baseY + 15, 0)),
            aperture: 0.02,
            vignette: 0.35,
            grain: 0.3,
            chromaticAberration: 0.8,
            tint: [1.0, 0.98, 1.02],
            saturation: 1.08,
            contrast: 1.06,
            lift: 0.005,
            liftColor: [0.45, 0.55, 1],
          };
        }
        sparks.uniforms.focus.value = post.focusDistance ?? 10;
        sparks.uniforms.aperture.value = post.aperture ?? 0;
        camera.aspect = ctx.width / ctx.height;
        camera.near = 0.05;
        camera.far = 40000;
        camera.updateProjectionMatrix();
        void phase;
        return { camera, post };
      }

      return {
        update(f) {
          inOrbit = f.shot === 'orbit';
          if (inOrbit) {
            plume.mesh.visible = false;
            return orbit.update(f);
          }
          return updatePad(f);
        },
        render(target, cam) {
          if (inOrbit) {
            orbit.render(target, cam);
            return;
          }
          sub++;
          // Depth pass of the opaque scene.
          for (const o of transparentObjs) o.visible = false;
          scene.overrideMaterial = depthMat;
          renderer.setRenderTarget(depthRT);
          renderer.clear(true, true, false);
          renderer.render(scene, cam);
          scene.overrideMaterial = null;
          for (const o of transparentObjs) o.visible = true;
          // Particles sorted for this camera; split around the plume.
          const e = cam.matrixWorldInverse.elements;
          const nY = nozzleY(tNow);
          const ax = rocket.group.position.x;
          const az = rocket.group.position.z;
          smoke.update(tNow, cam, (_x, y) => {
            const yy = Math.min(nY, Math.max(nY - 60, y));
            return -(e[2]! * ax + e[6]! * yy + e[10]! * az + e[14]!);
          });
          plume.uniforms.jitter.value = sub % 997;
          plume.prepare(cam);
          renderer.setRenderTarget(target);
          renderer.render(scene, cam);
        },
        dispose() {
          rocket.dispose();
          pad.dispose();
          plume.dispose();
          smoke.dispose();
          sparks.dispose();
          depthRT.dispose();
          depthMat.dispose();
          envRT.dispose();
          sky.mesh.geometry.dispose();
          (sky.mesh.material as THREE.Material).dispose();
          orbit.dispose();
        },
      };
    },
  },
];
