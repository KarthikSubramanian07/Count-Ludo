import { describe, it, expect } from 'vitest';
import { legalMoves, applyMove, opponentsOnCell } from '../src/engine/rules.ts';
import { START_CELL } from '../src/engine/board.ts';
import { newGame, place, progressForCell } from './helpers.ts';

describe('leaving base', () => {
  it('only a 6 frees a token, landing on its own start', () => {
    const game = newGame(['red', 'green'], [6]);
    const moves = legalMoves(game.state, 6);
    expect(moves).toHaveLength(4); // all four can come out
    expect(moves.every((m) => m.leavesBase && m.to === 0)).toBe(true);
  });

  it('a non-6 frees nothing when all tokens are in base', () => {
    const game = newGame(['red', 'green'], [3]);
    expect(legalMoves(game.state, 3)).toHaveLength(0);
  });
});

describe('exact-count home entry', () => {
  it('allows landing exactly on center and rejects overshoot', () => {
    const game = newGame(['red', 'green'], [1]);
    place(game.state, 'red', 0, 54); // home column, 2 from center (56)
    for (const t of [1, 2, 3]) place(game.state, 'red', t, 56); // rest home

    expect(
      legalMoves(game.state, 2).some((m) => m.to === 56 && m.finishes)
    ).toBe(true);
    expect(legalMoves(game.state, 3)).toHaveLength(0); // 54 + 3 = 57, overshoot
    expect(legalMoves(game.state, 1).some((m) => m.to === 55)).toBe(true);
  });
});

describe('capture', () => {
  it('sends an opponent on a non-safe cell back to base and reports it', () => {
    const game = newGame(['red', 'green'], [1]);
    const greenProg = progressForCell(START_CELL.green, 5); // green sits on cell 5
    place(game.state, 'green', 0, greenProg);
    const red = place(game.state, 'red', 0, 4); // one step behind cell 5

    const move = legalMoves(game.state, 1).find((m) => m.token === red)!;
    expect(move.captures).toEqual(['green']);

    applyMove(game.state, move);
    expect(game.state.players[1]!.tokens[0]!.state).toBe('base');
    expect(game.state.players[1]!.tokens[0]!.progress).toBe(-1);
  });

  it('never captures on a safe cell', () => {
    const game = newGame(['red', 'green'], [1]);
    const greenProg = progressForCell(START_CELL.green, 8); // cell 8 is a safe star
    place(game.state, 'green', 0, greenProg);
    const red = place(game.state, 'red', 0, 7);

    const move = legalMoves(game.state, 1).find((m) => m.token === red)!;
    expect(move.captures).toEqual([]);
    applyMove(game.state, move);
    expect(game.state.players[1]!.tokens[0]!.state).toBe('track');
  });

  it('captures every stacked token of the one present opponent color', () => {
    const game = newGame(['red', 'green'], [1]);
    const greenProg = progressForCell(START_CELL.green, 5);
    place(game.state, 'green', 0, greenProg);
    place(game.state, 'green', 1, greenProg);
    const red = place(game.state, 'red', 0, 4);

    const move = legalMoves(game.state, 1).find((m) => m.token === red)!;
    applyMove(game.state, move);
    expect(game.state.players[1]!.tokens[0]!.state).toBe('base');
    expect(game.state.players[1]!.tokens[1]!.state).toBe('base');
  });

  it('does not capture your own tokens sharing a cell', () => {
    const game = newGame(['red', 'green'], [1]);
    place(game.state, 'red', 1, 5); // own token already on cell 5
    const red0 = place(game.state, 'red', 0, 4);

    const move = legalMoves(game.state, 1).find((m) => m.token === red0)!;
    expect(move.captures).toEqual([]);
    applyMove(game.state, move);
    expect(game.state.players[0]!.tokens[1]!.state).toBe('track');
  });
});

describe('blocking (opt-in)', () => {
  it('when off, two opponents on a cell get captured on landing', () => {
    const game = newGame(['red', 'green'], [5], { blocking: false });
    const gp = progressForCell(START_CELL.green, 10);
    place(game.state, 'green', 0, gp);
    place(game.state, 'green', 1, gp);
    const red = place(game.state, 'red', 0, 5); // 5 + 5 = cell 10

    const move = legalMoves(game.state, 5).find((m) => m.token === red)!;
    expect(move.captures).toEqual(['green']);
    const captured = applyMove(game.state, move);
    expect(captured).toHaveLength(2);
  });

  it('when on, a block cannot be landed on or passed through', () => {
    const game = newGame(['red', 'green'], [5], { blocking: true });
    const gp = progressForCell(START_CELL.green, 10);
    place(game.state, 'green', 0, gp);
    place(game.state, 'green', 1, gp);
    place(game.state, 'red', 0, 5);
    // Park red's other tokens at home so only red0's move is under test
    // (a 6 would otherwise let base tokens leave and muddy the count).
    for (const t of [1, 2, 3]) place(game.state, 'red', t, 57);

    expect(legalMoves(game.state, 5)).toHaveLength(0); // land on the block: illegal
    expect(legalMoves(game.state, 6)).toHaveLength(0); // pass through it: illegal
    expect(legalMoves(game.state, 4).some((m) => m.to === 9)).toBe(true); // stop short: fine
  });

  it('a single opponent is not a block', () => {
    const game = newGame(['red', 'green'], [5], { blocking: true });
    const gp = progressForCell(START_CELL.green, 10);
    place(game.state, 'green', 0, gp);
    place(game.state, 'red', 0, 5);
    expect(legalMoves(game.state, 5).some((m) => m.to === 10)).toBe(true);
  });
});

describe('opponentsOnCell', () => {
  it('finds only other colors on the shared cell', () => {
    const game = newGame(['red', 'green', 'yellow'], [1]);
    const cell = 20;
    place(game.state, 'green', 0, progressForCell(START_CELL.green, cell));
    place(game.state, 'yellow', 0, progressForCell(START_CELL.yellow, cell));
    place(game.state, 'red', 0, progressForCell(START_CELL.red, cell));
    const found = opponentsOnCell(game.state, 'red', cell);
    expect(found.map((t) => t.color).sort()).toEqual(['green', 'yellow']);
  });
});
