// Keyboard driving: W A S D or the arrow keys, Space to brake.
import type { DriveInput } from './vehicle';

const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class KeyboardInput {
  private readonly down = new Set<string>();
  /** Set by tests or tools to drive without a keyboard; overrides the keys while not null. */
  override: DriveInput | null = null;

  private readonly onKey = (e: KeyboardEvent) => {
    if (!KEYS.has(e.code)) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    e.preventDefault();
    if (e.type === 'keydown') this.down.add(e.code);
    else this.down.delete(e.code);
  };
  private readonly onBlur = () => this.down.clear();

  constructor() {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
  }

  read(): DriveInput {
    if (this.override) return this.override;
    const k = (a: string, b: string) => (this.down.has(a) || this.down.has(b) ? 1 : 0);
    return {
      throttle: k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'),
      steer: k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight'),
      brake: this.down.has('Space'),
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
  }
}
