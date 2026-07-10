import { describe, it, expect } from 'vitest';
import { LudoGame } from '../src/engine/game.ts';
import { CryptoDie } from '../src/engine/rng.ts';
import { chooseMove } from '../src/engine/ai.ts';
import { hasFinished } from '../src/engine/rules.ts';
import { config } from './helpers.ts';
import type { Color } from '../src/engine/types.ts';

// Drive a full bot-vs-bot game with the real crypto die. This is the ultimate
// guard: if any rule could deadlock, loop forever, or leave the state
// inconsistent, a few thousand of these would catch it.
function playToEnd(game: LudoGame, maxRolls = 100000): number {
  let rolls = 0;
  while (!game.isGameOver()) {
    if (++rolls > maxRolls) throw new Error('game failed to terminate');
    const r = game.roll();
    if (r.outcome === 'awaiting-move') {
      game.play(chooseMove(game.state, r.moves, game.current.difficulty));
    }
  }
  return rolls;
}

function everyoneRankedOnce(ranking: Color[], colors: Color[]): boolean {
  return (
    ranking.length === colors.length &&
    new Set(ranking).size === colors.length &&
    ranking.every((c) => colors.includes(c))
  );
}

describe('full games terminate cleanly', () => {
  const colors: Color[] = ['red', 'green', 'yellow', 'blue'];

  it('runs a 4-player game to a complete ranking', () => {
    const game = new LudoGame(config(colors), new CryptoDie());
    playToEnd(game);
    expect(game.state.phase).toBe('gameover');
    expect(everyoneRankedOnce(game.state.ranking, colors)).toBe(true);
    // The winner really has all four tokens home.
    const champ = game.state.players.find(
      (p) => p.color === game.state.ranking[0]
    )!;
    expect(hasFinished(champ)).toBe(true);
  });

  it('runs 25 games without a stuck state or duplicate placing', () => {
    for (let i = 0; i < 25; i++) {
      const game = new LudoGame(config(colors), new CryptoDie());
      playToEnd(game);
      expect(everyoneRankedOnce(game.state.ranking, colors)).toBe(true);
    }
  });

  it('ends a 2-player game with both players placed', () => {
    const two: Color[] = ['red', 'blue'];
    const game = new LudoGame(config(two), new CryptoDie());
    playToEnd(game);
    expect(everyoneRankedOnce(game.state.ranking, two)).toBe(true);
  });
});
