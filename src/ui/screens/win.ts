// The curtain call. Shows the finishing order with a little ceremony, then gets
// out of the way so people can run it back.

import type { Color, Player } from '../../engine/types.ts';
import { h, cap } from '../dom.ts';

export interface WinContext {
  ranking: Color[];
  players: Player[];
  humanColors: Set<Color>;
  onPlayAgain: () => void;
}

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}', '4th'];

export function buildWin(ctx: WinContext): HTMLElement {
  const winner = ctx.ranking[0]!;
  const humanWon = ctx.humanColors.has(winner);
  const nameOf = (color: Color) =>
    ctx.players.find((p) => p.color === color)?.name ?? cap(color);

  const playAgain = h(
    'button',
    { class: 'btn btn-primary btn-lg', type: 'button' },
    'Play again'
  );
  playAgain.onclick = () => ctx.onPlayAgain();

  return h(
    'main',
    { class: 'win' },
    h(
      'section',
      { class: 'win-hero' },
      h('div', { class: 'confetti', 'aria-hidden': 'true' }, '\u{1F389}'),
      h('h1', {}, humanWon ? 'You win!' : `${nameOf(winner)} wins`),
      h(
        'p',
        { class: 'tagline' },
        humanWon ? 'Cleanly done. Again?' : 'The bots got this one. Rematch?'
      )
    ),
    h(
      'section',
      { class: 'card standings' },
      h('h2', {}, 'Final standings'),
      h(
        'ol',
        { class: 'ranking' },
        ...ctx.ranking.map((color, i) =>
          h(
            'li',
            { class: 'rank-row' },
            h('span', { class: 'medal' }, MEDALS[i] ?? `${i + 1}th`),
            h('span', { class: `dot dot-${color}` }),
            h('span', { class: 'rank-name' }, nameOf(color)),
            ctx.humanColors.has(color)
              ? h('span', { class: 'you-tag' }, 'you')
              : null
          )
        )
      )
    ),
    h('div', { class: 'cta-row center' }, playAgain)
  );
}
