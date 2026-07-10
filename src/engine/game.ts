// The turn engine. This is where "whose turn is it, and what happens next"
// lives. rules.ts answers "is this move legal and what does it do"; this file
// sequences rolls, extra turns, the three-six rule, captures, finishing, and
// ranking into a playable game.
//
// It is deliberately synchronous and side-effect-free beyond mutating its own
// state: no timers, no DOM, no randomness of its own (the die is injected). The
// UI layer adds animation and pacing on top; the AI drives it move by move; the
// tests drive it with a scripted die. All three see identical logic.

import type {
  Color,
  GameConfig,
  GameState,
  Move,
  Player,
  Token,
} from './types.ts';
import type { DieRoller } from './rng.ts';
import { defaultDie } from './rng.ts';
import { makeTokens, legalMoves, applyMove, hasFinished } from './rules.ts';

/** What a roll produced and what the caller must do about it. */
export interface RollResult {
  /** The face rolled, kept for display even when the turn is forfeited. */
  readonly die: number;
  /** Legal moves for this roll; empty when the turn auto-passes. */
  readonly moves: Move[];
  readonly outcome: 'awaiting-move' | 'auto-pass' | 'six-forfeit';
  /** True when the roll was a 6 (before any forfeit logic). */
  readonly wasSix: boolean;
}

/** What applying a move did to the wider game. */
export interface MoveResult {
  readonly captured: Token[];
  /** The color that just sent its last token home, or null. */
  readonly finishedPlayer: Color | null;
  /** True when the same player rolls again. */
  readonly extraRoll: boolean;
  readonly gameOver: boolean;
}

export function createInitialState(config: GameConfig): GameState {
  const players: Player[] = config.seats.map((seat) => ({
    color: seat.color,
    isHuman: seat.isHuman,
    difficulty: seat.difficulty,
    name: seat.name,
    tokens: makeTokens(seat.color),
  }));
  return {
    players,
    current: 0,
    die: null,
    phase: 'rolling',
    consecutiveSixes: 0,
    ranking: [],
    blocking: config.blocking,
    turnCount: 0,
  };
}

export class LudoGame {
  private _state: GameState;
  /** Legal moves cached from the most recent roll. */
  private pendingMoves: Move[] = [];

  constructor(
    config: GameConfig,
    private readonly die: DieRoller = defaultDie
  ) {
    this._state = createInitialState(config);
  }

  /**
   * Rehydrate a game from a saved snapshot (used by save/resume). A save can
   * capture the player mid-roll (`phase: 'awaiting-move'`), but there is no UI
   * on the other side of a resume to hand that pending choice back to, so it
   * is normalized to a fresh roll rather than replayed against a rebuilt
   * object holding stale `Token` references.
   */
  static fromState(state: GameState, die: DieRoller = defaultDie): LudoGame {
    const game = Object.create(LudoGame.prototype) as LudoGame;
    // @ts-expect-error assigning to a readonly-at-type-level private
    game.die = die;
    if (state.phase === 'awaiting-move') {
      state.die = null;
      state.phase = 'rolling';
    }
    game._state = state;
    game.pendingMoves = [];
    return game;
  }

  get state(): GameState {
    return this._state;
  }

  get current(): Player {
    return this._state.players[this._state.current]!;
  }

  get moves(): readonly Move[] {
    return this.pendingMoves;
  }

  /**
   * Roll the die for the current player and resolve the immediate consequences
   * that require no choice:
   *
   *  - a third consecutive six forfeits the turn (the six is voided; the two
   *    moves already made this turn stand);
   *  - a roll with no legal move auto-passes, even if it was a 6;
   *  - otherwise the caller must pick one of `moves`.
   */
  roll(): RollResult {
    if (this._state.phase !== 'rolling') {
      throw new Error(`Cannot roll during phase "${this._state.phase}"`);
    }
    const value = this.die.roll();
    const wasSix = value === 6;
    this._state.die = value;
    this._state.turnCount++;
    this._state.consecutiveSixes = wasSix
      ? this._state.consecutiveSixes + 1
      : 0;

    // Anti-stall: the third six in a row costs you the whole turn.
    if (this._state.consecutiveSixes >= 3) {
      this.pendingMoves = [];
      this.endTurn();
      return { die: value, moves: [], outcome: 'six-forfeit', wasSix };
    }

    const moves = legalMoves(this._state, value);
    this.pendingMoves = moves;

    // Nothing legal to do: the turn ends here regardless of the face. A 6 with
    // no move grants no extra roll (that would be an infinite turn).
    if (moves.length === 0) {
      this.endTurn();
      return { die: value, moves: [], outcome: 'auto-pass', wasSix };
    }

    this._state.phase = 'awaiting-move';
    return { die: value, moves, outcome: 'awaiting-move', wasSix };
  }

  /**
   * Apply one of the moves returned by the last roll. Resolves captures,
   * finishing, extra turns, and game end, then either hands the same player
   * another roll or advances to the next active player.
   */
  play(move: Move): MoveResult {
    if (this._state.phase !== 'awaiting-move') {
      throw new Error(`Cannot move during phase "${this._state.phase}"`);
    }
    if (!this.pendingMoves.some((m) => this.sameMove(m, move))) {
      throw new Error('Illegal move: not among the legal moves for this roll');
    }

    this._state.phase = 'moving';
    const captured = applyMove(this._state, move);

    const player = this.current;
    const finishedNow = hasFinished(player);
    let finishedPlayer: Color | null = null;
    if (finishedNow && !this._state.ranking.includes(player.color)) {
      this._state.ranking.push(player.color);
      finishedPlayer = player.color;
    }

    // Game ends when only one active (unfinished) player is left; they take the
    // final placing without having to march their last tokens home.
    const active = this.activePlayers();
    if (active.length <= 1) {
      if (
        active.length === 1 &&
        !this._state.ranking.includes(active[0]!.color)
      ) {
        this._state.ranking.push(active[0]!.color);
      }
      this._state.phase = 'gameover';
      this._state.die = null;
      this.pendingMoves = [];
      return { captured, finishedPlayer, extraRoll: false, gameOver: true };
    }

    // A 6 or a capture earns another roll, unless the player just finished (a
    // finished player has nothing left to move, so the extra turn is voided).
    const wasSix = this._state.die === 6;
    const extraRoll = (wasSix || captured.length > 0) && !finishedNow;

    if (extraRoll) {
      this._state.phase = 'rolling';
      this._state.die = null;
      this.pendingMoves = [];
    } else {
      this.endTurn();
    }

    return { captured, finishedPlayer, extraRoll, gameOver: false };
  }

  /** Players who have not yet finished all four tokens. */
  activePlayers(): Player[] {
    return this._state.players.filter((p) => !hasFinished(p));
  }

  isGameOver(): boolean {
    return this._state.phase === 'gameover';
  }

  /** The winner (first to finish), or null mid-game. */
  winner(): Color | null {
    return this._state.ranking[0] ?? null;
  }

  private endTurn(): void {
    this._state.consecutiveSixes = 0;
    this._state.die = null;
    this.pendingMoves = [];
    this._state.current = this.nextActiveIndex(this._state.current);
    this._state.phase = 'rolling';
  }

  /** Next player index (clockwise) that has not yet finished. */
  private nextActiveIndex(from: number): number {
    const n = this._state.players.length;
    for (let step = 1; step <= n; step++) {
      const idx = (from + step) % n;
      if (!hasFinished(this._state.players[idx]!)) return idx;
    }
    // No active players left; caller should have ended the game already.
    return from;
  }

  private sameMove(a: Move, b: Move): boolean {
    return (
      a.token.color === b.token.color &&
      a.token.index === b.token.index &&
      a.to === b.to
    );
  }
}
