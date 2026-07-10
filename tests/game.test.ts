import { describe, it, expect } from 'vitest';
import { newGame, place, progressForCell } from './helpers.ts';
import { START_CELL } from '../src/engine/board.ts';
import { LudoGame } from '../src/engine/game.ts';
import { ScriptedDie } from '../src/engine/rng.ts';

describe('rolling a six', () => {
  it('grants the same player another roll', () => {
    const game = newGame(['red', 'green'], [6, 3]);
    const r = game.roll();
    expect(r.wasSix).toBe(true);
    expect(r.outcome).toBe('awaiting-move');
    const res = game.play(r.moves[0]!);
    expect(res.extraRoll).toBe(true);
    expect(game.state.current).toBe(0);
    expect(game.state.phase).toBe('rolling');
  });

  it('forfeits the turn on the third consecutive six', () => {
    const game = newGame(['red', 'green'], [6, 6, 6]);
    let r = game.roll();
    game.play(r.moves[0]!); // first six: token out
    r = game.roll();
    game.play(r.moves[0]!); // second six: a move
    r = game.roll(); // third six
    expect(r.outcome).toBe('six-forfeit');
    expect(r.moves).toHaveLength(0);
    expect(game.state.current).toBe(1); // passed to green
    expect(game.state.consecutiveSixes).toBe(0);
  });

  it('resets the six counter after a non-six', () => {
    const game = newGame(['red', 'green'], [6, 2]);
    let r = game.roll();
    game.play(r.moves[0]!); // six -> extra roll
    r = game.roll(); // a 2
    expect(game.state.consecutiveSixes).toBe(0);
    expect(r.wasSix).toBe(false);
  });
});

describe('auto-pass', () => {
  it('passes when no legal move exists', () => {
    const game = newGame(['red', 'green'], [3]);
    const r = game.roll();
    expect(r.outcome).toBe('auto-pass');
    expect(game.state.current).toBe(1);
  });

  it('a six with no legal move grants no extra roll', () => {
    const game = newGame(['red', 'green'], [6]);
    place(game.state, 'red', 0, 55); // needs exactly 1, a 6 overshoots
    for (const t of [1, 2, 3]) place(game.state, 'red', t, 56);
    const r = game.roll();
    expect(r.wasSix).toBe(true);
    expect(r.outcome).toBe('auto-pass');
    expect(game.state.current).toBe(1); // turn still ends
  });
});

describe('capture', () => {
  it('grants an extra roll even without a six', () => {
    const game = newGame(['red', 'green'], [1]);
    place(game.state, 'green', 0, progressForCell(START_CELL.green, 5));
    place(game.state, 'red', 0, 4);
    const r = game.roll();
    const move = r.moves.find((m) => m.captures.length > 0)!;
    const res = game.play(move);
    expect(res.captured).toHaveLength(1);
    expect(res.extraRoll).toBe(true);
    expect(game.state.current).toBe(0);
  });
});

describe('finishing and ranking', () => {
  it('voids the extra turn when a six sends the last token home', () => {
    const game = newGame(['red', 'green', 'yellow', 'blue'], [6]);
    place(game.state, 'red', 0, 50);
    for (const t of [1, 2, 3]) place(game.state, 'red', t, 56);
    const r = game.roll();
    const move = r.moves.find((m) => m.finishes)!;
    const res = game.play(move);
    expect(res.finishedPlayer).toBe('red');
    expect(res.extraRoll).toBe(false); // finished: no bonus roll
    expect(res.gameOver).toBe(false);
    expect(game.state.ranking).toEqual(['red']);
    expect(game.state.current).toBe(1);
  });

  it('ends a 2-player game at the first finish, last place auto-assigned', () => {
    const game = newGame(['red', 'green'], [6]);
    place(game.state, 'red', 0, 50);
    for (const t of [1, 2, 3]) place(game.state, 'red', t, 56);
    const r = game.roll();
    const res = game.play(r.moves.find((m) => m.finishes)!);
    expect(res.gameOver).toBe(true);
    expect(game.state.phase).toBe('gameover');
    expect(game.state.ranking).toEqual(['red', 'green']);
    expect(game.winner()).toBe('red');
  });

  it('skips finished players when advancing the turn', () => {
    const game = newGame(['red', 'green', 'yellow', 'blue'], [3]);
    for (const t of [0, 1, 2, 3]) place(game.state, 'green', t, 56); // green out
    place(game.state, 'red', 0, 10);
    const r = game.roll(); // red moves 10 -> 13, non-six, no capture
    const res = game.play(r.moves[0]!);
    expect(res.extraRoll).toBe(false);
    expect(game.state.current).toBe(2); // skipped finished green, on to yellow
  });
});

describe('bookkeeping', () => {
  it('counts every roll for the fairness log', () => {
    const game = newGame(['red', 'green'], [3, 4]);
    game.roll();
    expect(game.state.turnCount).toBe(1);
    game.roll(); // green now
    expect(game.state.turnCount).toBe(2);
  });

  it('rejects moves that are not among the legal set', () => {
    const game = newGame(['red', 'green'], [6]);
    const r = game.roll();
    const fake = { ...r.moves[0]!, to: 40 };
    expect(() => game.play(fake)).toThrow(/Illegal move/);
  });
});

describe('resuming a saved game', () => {
  it('normalizes a mid-roll (awaiting-move) save into a fresh roll', () => {
    const game = newGame(['red', 'green'], [6]);
    game.roll(); // leaves phase 'awaiting-move' with pending moves
    expect(game.state.phase).toBe('awaiting-move');

    const resumed = LudoGame.fromState(game.state, new ScriptedDie([3]));
    expect(resumed.state.phase).toBe('rolling');
    expect(resumed.state.die).toBeNull();
    expect(resumed.moves).toHaveLength(0);
    // The resumed game is immediately playable again.
    expect(() => resumed.roll()).not.toThrow();
  });

  it('leaves a saved rolling/gameover state untouched', () => {
    const game = newGame(['red', 'green'], [3]);
    game.roll(); // no legal move -> auto-pass -> back to 'rolling'
    expect(game.state.phase).toBe('rolling');
    const resumed = LudoGame.fromState(game.state);
    expect(resumed.state.phase).toBe('rolling');
  });
});
