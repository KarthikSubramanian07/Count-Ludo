// Test scaffolding: build games with a scripted die and place tokens at exact
// positions so every rule can be exercised without relying on luck.

import { LudoGame } from '../src/engine/game.ts';
import { ScriptedDie } from '../src/engine/rng.ts';
import { refreshTokenState } from '../src/engine/rules.ts';
import type {
  Color,
  GameConfig,
  GameState,
  Token,
} from '../src/engine/types.ts';

export function config(
  colors: Color[],
  opts: { blocking?: boolean } = {}
): GameConfig {
  return {
    seats: colors.map((color) => ({
      color,
      isHuman: true,
      difficulty: 'medium',
      name: color,
    })),
    blocking: opts.blocking ?? false,
  };
}

/** A game whose die yields the given sequence (looping if exhausted). */
export function newGame(
  colors: Color[],
  dice: number[],
  opts: { blocking?: boolean } = {}
): LudoGame {
  return new LudoGame(config(colors, opts), new ScriptedDie(dice));
}

/** Force a token to an exact progress and re-derive its state. */
export function place(
  state: GameState,
  color: Color,
  tokenIndex: number,
  progress: number
): Token {
  const player = state.players.find((p) => p.color === color)!;
  const token = player.tokens[tokenIndex]!;
  token.progress = progress;
  refreshTokenState(token);
  return token;
}

/** Progress at which `color` sits on shared cell `cell` (on the track). */
export function progressForCell(
  startCell: number,
  cell: number,
  trackLength = 52
): number {
  return (cell - startCell + trackLength) % trackLength;
}
