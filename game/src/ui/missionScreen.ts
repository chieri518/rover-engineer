// Mission placeholder: a Three.js canvas, a Rapier world, and buttons that simulate an outcome.
// Phase 2 replaces the scene; Phase 4 replaces the buttons with the real mission loop.
import type { Screen } from '../flow/flow';
import type { MissionResult, EarnedMilestone } from '../rules/payout';
import type { DeathCause } from '../rules/types';
import { selectedParts } from '../rules/rover';
import { el } from './dom';

export const missionScreen: Screen = (game, root) => {
  const { data } = game;
  const view = el('div', { class: 'mission-view' });
  const status = el('div', { class: 'status' }, 'Starting physics…');
  let disposed = false;
  let stopScene: (() => void) | null = null;

  // Load three and rapier only when the mission starts, so the menus stay light.
  void Promise.all([import('../world/placeholderScene'), import('../world/physics')]).then(
    async ([scene, physics]) => {
      if (disposed) return;
      stopScene = scene.startPlaceholderScene(view);
      try {
        const info = await physics.initPhysics(data.tuning.mission.gravity);
        if (!disposed) status.textContent = `Physics ready (Rapier ${info.version}), test body fell to y = ${info.restY.toFixed(2)}`;
      } catch (err) {
        if (!disposed) status.textContent = `Physics failed to start: ${String(err)}`;
      }
    },
  );

  const length = data.tuning.mission.lengthSeconds;
  const instrument = selectedParts(game.build, data.parts).find((p) => p.slot === 'instrument')?.effects.instrument;
  const earned = (survived: boolean): EarnedMilestone[] => [
    { id: 'touchdown' },
    { id: 'odometer', stages: survived ? 2 : 1 },
    ...(instrument === 'camera' ? [{ id: 'crater-layers' }] : []),
    ...(instrument === 'drill' ? [{ id: 'regolith-sample' }] : []),
  ];
  const end = (result: MissionResult) => game.endMission(result);
  const die = (cause: DeathCause) => () =>
    end({ survived: false, cause, secondsLasted: length / 2, earned: earned(false) });

  root.append(
    view,
    el('div', { class: 'hud' },
      el('h2', {}, data.text.mission.heading),
      el('p', {}, data.text.mission.briefing),
      status,
      el('p', { class: 'muted' }, 'Placeholder: choose an outcome.'),
      el('div', { class: 'actions column' },
        el('button', { class: 'primary', onclick: () => end({ survived: true, secondsLasted: length, earned: earned(true) }) },
          'Survive the mission'),
        ...(['energy', 'stuck', 'froze', 'destroyed'] as const).map((cause) =>
          el('button', { onclick: die(cause) }, `End: ${data.text.causes[cause]}`),
        ),
      ),
    ),
  );

  return () => {
    disposed = true;
    stopScene?.();
  };
};
