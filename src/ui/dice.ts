// The die: an SVG cube face that tumbles when rolled. The tumble is pure
// theater (the real value comes from the engine's crypto die), but it is the
// theater that makes a random result *feel* fair, so it earns its keep.

import { s, clear } from './dom.ts';

// Standard pip layout on a 3x3 grid (indices 0..8, left-to-right, top-to-bottom).
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export class DieView {
  readonly el: SVGSVGElement;

  constructor() {
    this.el = s('svg', {
      viewBox: '0 0 100 100',
      class: 'die',
      'aria-hidden': 'true',
    }) as SVGSVGElement;
    this.show(null);
  }

  /** Draw a face, or a blank resting die when value is null. */
  show(value: number | null): void {
    clear(this.el);
    this.el.append(
      s('rect', {
        x: 4,
        y: 4,
        width: 92,
        height: 92,
        rx: 18,
        class: 'die-face',
      })
    );
    if (value === null) return;
    for (const idx of PIPS[value] ?? []) {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      this.el.append(
        s('circle', {
          cx: 25 + col * 25,
          cy: 25 + row * 25,
          r: 8,
          class: 'die-pip',
        })
      );
    }
  }

  /**
   * Tumble through a few random faces, then settle on `final`. Resolves once
   * the final face is showing so the caller can proceed.
   */
  animateRoll(final: number): Promise<void> {
    return new Promise((resolve) => {
      this.el.classList.add('rolling');
      let ticks = 0;
      const total = 8;
      const spin = setInterval(() => {
        this.show(1 + Math.floor(Math.random() * 6));
        if (++ticks >= total) {
          clearInterval(spin);
          this.show(final);
          this.el.classList.remove('rolling');
          resolve();
        }
      }, 55);
    });
  }
}
