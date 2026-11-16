import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { missionSetup, startMission, type MissionState } from '../rules/mission';
import { selectedParts } from '../rules/rover';
import { seededRng } from '../rules/events';
import { TitanMission } from './titanMission';

const titan = loadGameData('titan');
const site = { latitudeDeg: 5.16, longitudeDeg: 161.43 };
const unfilled = /\{\w+\}|\[placeholder|\[to fact-check/;
const build = (lights: string) => ({
  chassis: 'chassis-titanium', wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights, heater: 'heater-rhu', instrument: 'instrument-camera',
});

function mission(lights = 'lights-led') {
  const tm = new TitanMission(titan, site);
  const parts = selectedParts(build(lights), titan.parts);
  const setup = missionSetup(parts, titan.tuning, [], undefined, tm.setup(seededRng(7)));
  return { tm, setup, state: startMission(setup) };
}
const at = (state: MissionState, seconds: number, poweredDown = false): MissionState => ({ ...state, seconds, poweredDown });

describe('Titan mission wording (T6)', () => {
  it('every day, rain and cold line is final and filled', () => {
    const { tm, setup, state } = mission();
    const lines = [
      tm.noticeText({ kind: 'dusk' }, true), tm.noticeText({ kind: 'dusk' }, false),
      tm.noticeText({ kind: 'dawn', woke: true }, true), tm.noticeText({ kind: 'dawn', woke: false }, true),
      ...(['forecast', 'started', 'cleared'] as const).map((edge) => tm.noticeText({ kind: 'storm', edge }, true)),
    ].map((n) => n.message);
    const night = tm.status(at(state, 400, true), setup);
    lines.push(tm.sleepBanner(night, true)!, tm.photoBlocked, tm.coldWarning(night, true), tm.panelLine(night), titan.text.rain!.credit);
    for (const l of lines) expect(l).not.toMatch(unfilled);
    expect(tm.sleepBanner(night, true)).toContain(`${titan.tuning.sleep!.nightClockRate}×`);
  });

  it('never sends the rover back to the lander to recharge', () => {
    const all = JSON.stringify([titan.text.day, titan.text.rain, titan.text.cold]);
    expect(all).not.toMatch(/recharg|return to (the )?(base|lander)/i);
  });

  it('the panel line never claims sunlight power on Titan', () => {
    const { tm, setup, state } = mission();
    expect(tm.panelLine(tm.status(state, setup))).toMatch(/almost no power/);
    expect(tm.panelLine(tm.status(at(state, 400), setup))).toMatch(/no power at night/);
  });

  it('the sleep banner shows the fast-forward only at night', () => {
    const { tm, setup, state } = mission();
    expect(tm.sleepBanner(tm.status(state, setup), false)).toBeNull();
    expect(tm.sleepBanner(tm.status(at(state, 100, true), setup), true)).toBe(titan.text.day!.sleepingDay);
    expect(tm.missionDelta(1, 400, true)).toBe(titan.tuning.sleep!.nightClockRate);
    expect(tm.missionDelta(1, 100, true)).toBe(1);
  });

  it('a rover without lights hears it cannot drive at night; lights on shows the drain', () => {
    const dark = mission('lights-none');
    const night = dark.tm.status(at(dark.state, 400), dark.setup);
    expect(dark.tm.noLightsWarning(night, false, false)).toBe(titan.text.day!.noLights);
    expect(night.canDrive).toBe(false);
    const lit = mission();
    const litNight = lit.tm.status(at(lit.state, 400), lit.setup);
    expect(litNight.canDrive).toBe(true);
    expect(lit.tm.nightLine(litNight, false)).toBe(titan.text.day!.lightsOn);
  });

  it('the forecast bar counts down to the rain', () => {
    const { tm, setup, state } = mission();
    const storm = setup.titan!.storm!;
    const mid = (storm.forecastAt + storm.startAt) / 2;
    const f = tm.forecast(tm.status(at(state, mid), setup), setup, mid)!;
    expect(f.remaining).toBeCloseTo(0.5, 2);
    expect(f.message).toContain(String(Math.ceil(storm.startAt - mid)));
    expect(tm.forecast(tm.status(at(state, storm.startAt + 1), setup), setup, storm.startAt + 1)).toBeNull();
  });
});
