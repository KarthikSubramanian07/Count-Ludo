import { describe, it, expect } from 'vitest';
import { chooseMove } from '../src/engine/ai.ts';
import { legalMoves } from '../src/engine/rules.ts';
import { START_CELL } from '../src/engine/board.ts';
import { newGame, place, progressForCell } from './helpers.ts';

// A fixed "random" so choices are deterministic in tests.
const noRandom = () => 0;

describe('chooseMove', () => {
  it('returns the only move when there is one', () => {
    const game = newGame(['red', 'green'], [6]);
    place(game.state, 'red', 0, 10);
    for (const t of [1, 2, 3]) place(game.state, 'red', t, 56);
    const moves = legalMoves(game.state, 6); // only red0 can move (10 + 6 = 16)
    expect(moves).toHaveLength(1);
    expect(chooseMove(game.state, moves, 'hard', noRandom)).toBe(moves[0]);
  });

  it('takes a finishing move above all else', () => {
    const game = newGame(['red', 'green'], [6]);
    place(game.state, 'red', 0, 50); // 50 + 6 = 56, finishes
    place(game.state, 'red', 1, 10);
    place(game.state, 'red', 2, 20);
    place(game.state, 'red', 3, 30);
    const moves = legalMoves(game.state, 6);
    const chosen = chooseMove(game.state, moves, 'hard', noRandom);
    expect(chosen.finishes).toBe(true);
  });

  it('prefers a capture over a plain advance', () => {
    const game = newGame(['red', 'green'], [1]);
    place(game.state, 'green', 0, progressForCell(START_CELL.green, 5));
    place(game.state, 'red', 0, 4); // 4 -> 5 captures
    place(game.state, 'red', 1, 30); // 30 -> 31 plain
    place(game.state, 'red', 2, 56);
    place(game.state, 'red', 3, 56);
    const moves = legalMoves(game.state, 1);
    const chosen = chooseMove(game.state, moves, 'hard', noRandom);
    expect(chosen.captures.length).toBeGreaterThan(0);
  });

  it('hard avoids landing where it can be captured next turn', () => {
    const game = newGame(['red', 'green'], [6]);
    place(game.state, 'red', 0, 18); // 18 -> 24 (a green sits 2 behind: risky)
    place(game.state, 'red', 1, 40); // 40 -> 46 (safe from threats)
    place(game.state, 'red', 2, 56);
    place(game.state, 'red', 3, 56);
    place(game.state, 'green', 0, progressForCell(START_CELL.green, 22));
    const moves = legalMoves(game.state, 6);
    const chosen = chooseMove(game.state, moves, 'hard', noRandom);
    expect(chosen.token.index).toBe(1); // took the unthreatened landing
  });

  it('easy still returns a legal move', () => {
    const game = newGame(['red', 'green'], [6]);
    const moves = legalMoves(game.state, 6);
    const chosen = chooseMove(game.state, moves, 'easy', () => 0.9);
    expect(moves).toContain(chosen);
  });
});
