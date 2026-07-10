// Core domain types for the Count Ludo engine.
//
// The engine is pure and framework-free: give it a GameState and an action,
// get a new GameState back. Nothing in here touches the DOM, storage, or time.
// That is what makes the rules unit-testable and the "rigged dice" accusation
// answerable — the logic has nowhere to hide.

/** The four seats, in clockwise turn order. */
export type Color = 'red' | 'green' | 'yellow' | 'blue';

export const COLORS: readonly Color[] = ['red', 'green', 'yellow', 'blue'];

/**
 * Where a single token physically is.
 *
 * - `base`    waiting in the yard; needs a 6 to come out.
 * - `track`   on one of the 52 shared cells.
 * - `homecol` in its private 5-cell run-up to the center.
 * - `home`    finished, sitting in the center triangle.
 *
 * `progress` is the single source of truth for track/homecol/home tokens: an
 * integer 0..57 along the token's personal path (see board.ts). It is -1 while
 * in base so it never leaks into move arithmetic by accident.
 */
export type TokenState = 'base' | 'track' | 'homecol' | 'home';

export interface Token {
  readonly color: Color;
  /** 0..3, stable id within a player so the UI can track each piece. */
  readonly index: number;
  state: TokenState;
  /** Personal-path position 0..57 when out of base, else -1. */
  progress: number;
}

export interface Player {
  readonly color: Color;
  readonly isHuman: boolean;
  /** Only meaningful for bots. */
  readonly difficulty: Difficulty;
  readonly name: string;
  tokens: Token[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Phase = 'rolling' | 'awaiting-move' | 'moving' | 'gameover';

export interface GameState {
  players: Player[];
  /** Index into `players` of whoever is to act. */
  current: number;
  /** null until a die is rolled this sub-turn. */
  die: number | null;
  phase: Phase;
  /** 0..3; the third six forfeits the turn. */
  consecutiveSixes: number;
  /** Finish order, first place first. Length grows as players go out. */
  ranking: Color[];
  /** Whether same-color blocking (two tokens seal a cell) is enforced. */
  blocking: boolean;
  /** Monotonic roll counter, purely for the fairness log / UI. */
  turnCount: number;
}

/** A concrete legal move: take `token` `steps` forward with the current die. */
export interface Move {
  readonly token: Token;
  /** Path index the token ends on, 0..57. */
  readonly to: number;
  /** True when this move sends the token into the center. */
  readonly finishes: boolean;
  /** Colors captured by landing here (already de-duplicated). */
  readonly captures: Color[];
  /** True when the move brings a token out of base onto its start. */
  readonly leavesBase: boolean;
}

export interface SeatConfig {
  readonly color: Color;
  readonly isHuman: boolean;
  readonly difficulty: Difficulty;
  readonly name: string;
}

export interface GameConfig {
  readonly seats: SeatConfig[];
  readonly blocking: boolean;
}
