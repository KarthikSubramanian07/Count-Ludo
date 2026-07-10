// Renders the board as one crisp, scalable SVG and keeps the 16 tokens in sync
// with engine state. The static board (cells, yards, center) is drawn once; the
// tokens live in their own layer and are moved by updating a CSS transform, so
// the browser tweens them between cells for free.

import type { Color, GameState, Move, Token } from '../engine/types.ts';
import { COLORS } from '../engine/types.ts';
import { START_CELL, SAFE_CELLS } from '../engine/board.ts';
import { s, clear } from './dom.ts';
import {
  TRACK_COORDS,
  HOME_COLUMN_COORDS,
  BASE_SLOTS,
  YARD_ORIGIN,
  tokenCoord,
  cellCenter,
  type Coord,
} from './geometry.ts';

const TOKEN_R = 0.34;
const CELL_INSET = 0.06;

export type TokenPicker = (token: Token) => void;

export class BoardView {
  readonly el: SVGSVGElement;
  private readonly tokenLayer: SVGGElement;
  private readonly tokenEls = new Map<string, SVGGElement>();

  constructor() {
    this.el = s('svg', {
      viewBox: '0 0 15 15',
      class: 'board',
      role: 'img',
      'aria-label': 'Ludo board',
    }) as SVGSVGElement;
    this.el.append(this.buildStaticBoard());
    this.tokenLayer = s('g', { class: 'tokens' }) as SVGGElement;
    this.el.append(this.tokenLayer);
  }

  private buildStaticBoard(): SVGGElement {
    const g = s('g') as SVGGElement;
    g.append(
      s('rect', {
        x: 0,
        y: 0,
        width: 15,
        height: 15,
        rx: 0.6,
        class: 'board-bg',
      })
    );

    // Yards (the four colored corners) with an inner panel and token sockets.
    for (const color of COLORS) {
      const [r, c] = YARD_ORIGIN[color];
      g.append(
        s('rect', {
          x: c,
          y: r,
          width: 6,
          height: 6,
          rx: 0.5,
          class: `yard yard-${color}`,
        }),
        s('rect', {
          x: c + 1,
          y: r + 1,
          width: 4,
          height: 4,
          rx: 0.4,
          class: 'yard-inner',
        })
      );
      for (const slot of BASE_SLOTS[color]) {
        const { x, y } = cellCenter(slot);
        g.append(
          s('circle', {
            cx: x,
            cy: y,
            r: 0.42,
            class: `socket socket-${color}`,
          })
        );
      }
    }

    // Track cells. Start cells and safe cells get their own treatment.
    const startCellOf = new Map<number, Color>();
    for (const color of COLORS) startCellOf.set(START_CELL[color], color);

    TRACK_COORDS.forEach((coord, index) => {
      const owner = startCellOf.get(index);
      const cls = owner
        ? `cell cell-start cell-${owner}`
        : SAFE_CELLS.has(index)
          ? 'cell cell-safe'
          : 'cell';
      g.append(this.cellRect(coord, cls));
      if (SAFE_CELLS.has(index) && !owner) g.append(this.star(coord));
      if (owner) g.append(this.star(coord, `star-${owner}`));
    });

    // Home columns and the central home triangles.
    for (const color of COLORS) {
      for (const coord of HOME_COLUMN_COORDS[color]) {
        g.append(this.cellRect(coord, `cell cell-home cell-${color}`));
      }
    }
    g.append(this.centerTriangles());
    return g;
  }

  private cellRect([row, col]: Coord, cls: string): SVGElement {
    return s('rect', {
      x: col + CELL_INSET,
      y: row + CELL_INSET,
      width: 1 - CELL_INSET * 2,
      height: 1 - CELL_INSET * 2,
      rx: 0.18,
      class: cls,
    });
  }

  private star([row, col]: Coord, cls = 'star'): SVGElement {
    const cx = col + 0.5;
    const cy = row + 0.5;
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? 0.3 : 0.13;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(
        `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`
      );
    }
    return s('polygon', { points: pts.join(' '), class: cls });
  }

  private centerTriangles(): SVGElement {
    const g = s('g', { class: 'center' });
    const cx = 7.5;
    const cy = 7.5;
    // [color, outer edge point A, outer edge point B]
    const tris: [Color, Coord, Coord][] = [
      ['green', [6, 6], [6, 9]], // top
      ['yellow', [6, 9], [9, 9]], // right
      ['blue', [9, 9], [9, 6]], // bottom
      ['red', [9, 6], [6, 6]], // left
    ];
    for (const [color, a, b] of tris) {
      g.append(
        s('polygon', {
          points: `${a[1]},${a[0]} ${b[1]},${b[0]} ${cx},${cy}`,
          class: `home-tri home-tri-${color}`,
        })
      );
    }
    return g;
  }

  /**
   * Sync tokens to the given state. `movablesByKey` marks which tokens can be
   * tapped; `onPick` is called when one is. Passing an empty map (e.g. during a
   * bot's turn) makes every token inert.
   */
  render(
    state: GameState,
    moves: readonly Move[],
    onPick: TokenPicker | null
  ): void {
    const movable = new Map<string, Move>();
    for (const m of moves) movable.set(keyOf(m.token), m);

    // Spread tokens that share a cell so a stack is legible.
    const groups = new Map<string, Token[]>();
    const allTokens = state.players.flatMap((p) => p.tokens);
    for (const t of allTokens) {
      const [row, col] = tokenCoord(t);
      const gkey = `${row},${col}`;
      let group = groups.get(gkey);
      if (!group) groups.set(gkey, (group = []));
      group.push(t);
    }

    for (const t of allTokens) {
      const key = keyOf(t);
      const g = this.ensureToken(key, t.color);
      const [row, col] = tokenCoord(t);
      const group = groups.get(`${row},${col}`)!;
      const offset = stackOffset(group.indexOf(t), group.length);
      const { x, y } = cellCenter([row + offset.dy, col + offset.dx]);
      g.setAttribute('transform', `translate(${x} ${y})`);

      const isMovable = movable.has(key) && onPick;
      g.classList.toggle('movable', Boolean(isMovable));
      g.classList.toggle(
        'current',
        state.players[state.current]!.color === t.color
      );
      g.onclick = isMovable ? () => onPick!(t) : null;
      g.style.cursor = isMovable ? 'pointer' : '';
    }
  }

  private ensureToken(key: string, color: Color): SVGGElement {
    let g = this.tokenEls.get(key);
    if (!g) {
      g = s('g', { class: `token token-${color}` }) as SVGGElement;
      g.append(
        s('circle', { r: TOKEN_R, class: 'token-body' }),
        s('circle', { r: TOKEN_R * 0.45, class: 'token-pip' })
      );
      this.tokenEls.set(key, g);
      this.tokenLayer.append(g);
    }
    return g;
  }

  destroy(): void {
    clear(this.el);
    this.tokenEls.clear();
  }
}

function keyOf(token: Token): string {
  return `${token.color}-${token.index}`;
}

/** Small radial fan so N tokens on one cell stay individually visible. */
function stackOffset(i: number, n: number): { dx: number; dy: number } {
  if (n <= 1) return { dx: 0, dy: 0 };
  const spread = 0.16;
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return { dx: Math.cos(angle) * spread, dy: Math.sin(angle) * spread };
}
