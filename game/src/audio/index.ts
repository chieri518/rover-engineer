// The game's sound: one shared instance. The AudioContext is made on the player's first click or key
// press (browsers block audio until then), suspended while the tab is hidden or the sound is muted, and
// everything is a no-op without Web Audio (Node tests, old browsers): the game plays silently.
import type { Game, ScreenId } from '../flow/flow';
import type { Settings } from '../save/settings';
import { buildBuses, setVolumes, type Buses } from './graph';
import { RoverHum, Weather } from './loops';
import { MASTER, type MoodId } from './mix';
import { MusicPlayer } from './music';
import { Sfx, type CueId, type CueOptions, type Voice } from './sfx';
import { moodFor } from './tune';

type SoundSettings = Pick<Settings, 'musicVolume' | 'effectsVolume' | 'muted'>;

function audioContextClass(): typeof AudioContext | null {
  try {
    const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
  } catch {
    return null;
  }
}

export class Sound {
  private ac: AudioContext | null = null;
  private buses: Buses | null = null;
  private music: MusicPlayer | null = null;
  private sfx: Sfx | null = null;
  private levels: SoundSettings = { musicVolume: 0.25, effectsVolume: 0.6, muted: false };
  private hidden = false;
  private mood: MoodId = 'calm';
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private failed = false;

  /** The AudioContext's state, or 'none' before the first gesture (or without Web Audio). */
  get state(): AudioContextState | 'none' {
    return this.ac?.state ?? 'none';
  }

  get currentMood(): MoodId | null {
    return this.music?.mood ?? null;
  }

  get muted(): boolean {
    return this.levels.muted;
  }

  /** Effects may play: audio is running and not muted. */
  private get live(): boolean {
    return !!this.sfx && this.ac?.state === 'running' && !this.levels.muted && !this.hidden;
  }

  /** On a user gesture: create the AudioContext (once) and start it. */
  unlock(): void {
    if (this.failed) return;
    if (!this.ac) {
      const Ctx = audioContextClass();
      if (!Ctx) return void (this.failed = true);
      try {
        this.ac = new Ctx({ latencyHint: 'playback' });
        this.buses = buildBuses(this.ac);
        setVolumes(this.buses, this.levels.musicVolume, this.levels.effectsVolume, this.ac.currentTime);
        this.music = new MusicPlayer(this.buses);
        this.sfx = new Sfx(this.buses);
        this.music.setMood(this.mood);
      } catch {
        this.failed = true;
        this.ac = null;
        this.buses = this.music = this.sfx = null;
        return;
      }
      return this.run();
    }
    // Later gestures only restart a context the browser stopped (not one suspended on purpose).
    if (this.ac.state !== 'running' && !this.levels.muted && !this.hidden) this.run();
  }

  /** Volume and mute from the settings. */
  apply(s: SoundSettings): void {
    this.levels = { musicVolume: s.musicVolume, effectsVolume: s.effectsVolume, muted: s.muted };
    if (this.buses) setVolumes(this.buses, s.musicVolume, s.effectsVolume);
    this.run();
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.run();
  }

  setMood(id: MoodId): void {
    this.mood = id;
    this.music?.setMood(id);
  }

  /** Resume or fade out and suspend, as mute and the tab's visibility want. Suspended, it costs no CPU. */
  private run(): void {
    const ac = this.ac;
    const b = this.buses;
    if (!ac || !b) return;
    const on = !this.levels.muted && !this.hidden;
    const g = b.master.gain;
    if (this.suspendTimer !== null) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    if (on) {
      void ac.resume().catch(() => {});
      const t = ac.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(MASTER.gain, t + MASTER.fadeSeconds);
    } else {
      const t = ac.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + MASTER.fadeSeconds);
      this.suspendTimer = setTimeout(() => {
        this.suspendTimer = null;
        void ac.suspend().catch(() => {});
      }, MASTER.fadeSeconds * 1000 + 100);
    }
  }

  /** Play a one-shot cue (nothing while muted, hidden or before the first gesture). */
  cue(id: CueId, opts?: CueOptions): Voice | null {
    if (!this.live) return null;
    try {
      return this.sfx!.play(id, opts);
    } catch {
      return null;
    }
  }

  /** The rover's motor hum for a mission, or null without audio yet. */
  roverHum(thinAir: boolean): RoverHum | null {
    return this.buses ? new RoverHum(this.buses, thinAir) : null;
  }

  /** Weather ambience for a mission, or null without audio yet. */
  weather(): Weather | null {
    return this.buses ? new Weather(this.buses) : null;
  }

  /** The bus graph (for the development level check). */
  get graph(): Buses | null {
    return this.buses;
  }
}

export const sound = new Sound();

const MUTE_KEY = 'KeyM';

/**
 * Wire the sound to the game: start on the first gesture, follow the screens (music mood, launch) and
 * the settings, pause with the hidden tab, the M key to mute, a soft click on buttons.
 */
export function installSound(game: Game): () => void {
  sound.apply(game.settings);
  sound.setMood(moodFor(game.screen, game.world));
  const unlock = () => sound.unlock();
  const onKey = (e: KeyboardEvent) => {
    sound.unlock();
    if (e.code !== MUTE_KEY || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return;
    if (t instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button'].includes(t.type)) return;
    game.setSettings({ muted: !game.settings.muted });
  };
  const onClick = (e: MouseEvent) => {
    const button = e.target instanceof Element ? e.target.closest('button') : null;
    if (button && !button.disabled) sound.cue('click');
  };
  const onVisibility = () => sound.setHidden(document.hidden);
  // Capture phase: before the overlays (tutorial, notebook) that stop other keys from reaching the screen.
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('visibilitychange', onVisibility);
  const stop = game.listen({
    screen(screen: ScreenId, from: ScreenId) {
      sound.setMood(moodFor(screen, game.world));
      if (from === 'ticket' && screen === 'landing') sound.cue('launch');
    },
    settings: (s) => sound.apply(s),
  });
  return () => {
    stop();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
