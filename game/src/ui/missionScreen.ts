// Mission screen: the drivable Moon with a small HUD.
// Phase 4 replaces the placeholder outcome buttons with the real mission loop.
import type { Screen } from '../flow/flow';
import type { MissionResult, EarnedMilestone } from '../rules/payout';
import type { DeathCause } from '../rules/types';
import { selectedParts } from '../rules/rover';
import { roverParams } from '../rules/drive';
import { el } from './dom';

export const missionScreen: Screen = (game, root) => {
  const { data } = game;
  const t = data.text.mission;
  const view = el('div', { class: 'mission-view' });
  const status = el('div', { class: 'status' }, t.loading);
  const notice = el('div', { class: 'boundary-notice', hidden: true }, t.boundary);
  let disposed = false;
  let stopScene: (() => void) | null = null;

  const parts = selectedParts(game.build, data.parts);
  // Load three, Rapier and the terrain only when the mission starts, so the menus stay light.
  void import('../world/moonScene')
    .then(({ startMoonScene }) =>
      startMoonScene({
        container: view,
        data,
        rover: roverParams(parts, data.tuning),
        onFrame: (state) => {
          notice.hidden = !state.nearBoundary;
        },
      }),
    )
    .then((scene) => {
      if (disposed) return scene.dispose();
      stopScene = () => scene.dispose();
      status.textContent = '';
    })
    .catch((err: unknown) => {
      if (!disposed) status.textContent = `The Moon failed to load: ${String(err)}`;
    });

  const length = data.tuning.mission.lengthSeconds;
  const instrument = parts.find((p) => p.slot === 'instrument')?.effects.instrument;
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
    notice,
    el('div', { class: 'hud' },
      el('h2', {}, t.heading),
      el('p', {}, t.briefing),
      el('p', { class: 'muted' }, t.controls),
      status,
    ),
    el('details', { class: 'debug-outcomes' },
      el('summary', {}, 'Test outcomes (placeholder)'),
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
