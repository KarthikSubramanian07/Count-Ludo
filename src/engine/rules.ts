// The rulebook. Every function here is a pure query or a well-scoped mutation
// on a GameState. There is no turn-advancement, dice, or I/O in this file; that
// lives in game.ts. Keeping "what is a legal move / what does a move do"
// separate from "whose turn is it now" is what keeps both testable.

import type { Color, GameState, Move, Player, Token } from './types.ts';
import {
  HOME_PROGRESS,
  TRACK_LENGTH,
  TOKENS_PER_PLAYER,
  START_CELL,
  isHome,
  isInHomeColumn,
  isOnTrack,
  isSafeCell,
  occupiedTrackCell,
} from './board.ts';

/** A fresh token in its yard. */
export function makeToken(color: Color, index: number): Token {
  return { color, index, state: 'base', progress: -1 };
}

/** Four tokens for one seat. */
export function makeTokens(color: Color): Token[] {
  return Array.from({ length: TOKENS_PER_PLAYER }, (_, i) =>
    makeToken(color, i)
  );
}

/** Re-derive a token's coarse state from its progress. Single source of truth. */
export function refreshTokenState(token: Token): void {
  if (token.progress < 0) token.state = 'base';
  else if (isHome(token.progress)) token.state = 'home';
  else if (isInHomeColumn(token.progress)) token.state = 'homecol';
  else token.state = 'track';
}

/** Every token in the game, flattened. */
export function allTokens(state: GameState): Token[] {
  return state.players.flatMap((p) => p.tokens);
}

/** True once all four of a player's tokens are home. */
export function hasFinished(player: Player): boolean {
  return player.tokens.every((t) => t.state === 'home');
}

/** Opponent tokens (not `color`) currently standing on shared cell `cell`. */
export function opponentsOnCell(
  state: GameState,
  color: Color,
  cell: number
): Token[] {
  const result: Token[] = [];
  for (const token of allTokens(state)) {
    if (token.color === color) continue;
    if (occupiedTrackCell(token.color, token.progress) === cell) {
      result.push(token);
    }
  }
  return result;
}

/**
 * Shared cells sealed against `mover` by a block: any cell holding two or more
 * tokens of a single OTHER color. Only computed when blocking is enabled. A
 * block stops opponents from passing through or landing on the cell; your own
 * stacks never block you.
 */
export function blockedCellsFor(state: GameState, mover: Color): Set<number> {
  const counts = new Map<number, Map<Color, number>>();
  for (const token of allTokens(state)) {
    if (token.color === mover) continue;
    const cell = occupiedTrackCell(token.color, token.progress);
    if (cell === null) continue;
    let byColor = counts.get(cell);
    if (!byColor) counts.set(cell, (byColor = new Map()));
    byColor.set(token.color, (byColor.get(token.color) ?? 0) + 1);
  }
  const blocked = new Set<number>();
  for (const [cell, byColor] of counts) {
    for (const count of byColor.values()) {
      if (count >= 2) blocked.add(cell);
    }
  }
  return blocked;
}

/**
 * Colors that would be captured by `mover` landing on progress `to`. A capture
 * happens only on a non-safe shared cell. Because a second color can never
 * share a non-safe cell (whoever arrives captures), the result is at most one
 * color, but it is returned as a de-duplicated list for the UI.
 */
function capturesAt(state: GameState, mover: Color, to: number): Color[] {
  const cell = occupiedTrackCell(mover, to);
  if (cell === null || isSafeCell(cell)) return [];
  const captured = new Set<Color>();
  for (const token of opponentsOnCell(state, mover, cell)) {
    captured.add(token.color);
  }
  return [...captured];
}

/**
 * Would moving `token` by `die` be blocked along the way? Checks every shared
 * cell the token would pass through or land on. Home-column cells are private,
 * so only the track portion of the journey can be blocked.
 */
function pathIsBlocked(
  token: Token,
  die: number,
  blocked: Set<number>
): boolean {
  if (blocked.size === 0) return false;
  const start = Math.max(token.progress, 0) + 1;
  const end = token.progress + die;
  for (let p = start; p <= end && isOnTrack(p); p++) {
    const cell = (START_CELL[token.color] + p) % TRACK_LENGTH;
    if (blocked.has(cell)) return true;
  }
  return false;
}

/** Build the Move for taking `token` forward by `die`, or null if illegal. */
function moveFor(
  state: GameState,
  token: Token,
  die: number,
  blocked: Set<number>
): Move | null {
  // A finished token never moves again.
  if (token.state === 'home') return null;

  // In base: only a 6 frees it, landing on its own (safe) start cell.
  if (token.state === 'base') {
    if (die !== 6) return null;
    if (state.blocking && blocked.has(START_CELL[token.color])) return null;
    return {
      token,
      to: 0,
      finishes: false,
      captures: capturesAt(state, token.color, 0),
      leavesBase: true,
    };
  }

  // On the track or in the home column: advance, but never overshoot center.
  const to = token.progress + die;
  if (to > HOME_PROGRESS) return null;
  if (state.blocking && pathIsBlocked(token, die, blocked)) return null;

  return {
    token,
    to,
    finishes: to === HOME_PROGRESS,
    captures: capturesAt(state, token.color, to),
    leavesBase: false,
  };
}

/**
 * All legal moves for the current player with the given die value. An empty
 * list means the turn must be passed (nothing legal to do).
 */
export function legalMoves(state: GameState, die: number): Move[] {
  const player = state.players[state.current]!;
  const blocked = state.blocking
    ? blockedCellsFor(state, player.color)
    : EMPTY_SET;
  const moves: Move[] = [];
  for (const token of player.tokens) {
    const move = moveFor(state, token, die, blocked);
    if (move) moves.push(move);
  }
  return moves;
}

const EMPTY_SET: Set<number> = new Set();

/**
 * Apply a move to the state in place. Moves the token, then resolves any
 * capture on the landing cell (all opponents there, since only one color can be
 * present, go back to base). Returns the tokens that were sent home so the UI
 * and stats can react. Does NOT touch turn order, the die, or the six counter.
 */
export function applyMove(state: GameState, move: Move): Token[] {
  const player = state.players[state.current]!;
  const token = player.tokens[move.token.index]!;

  token.progress = move.to;
  refreshTokenState(token);

  const captured: Token[] = [];
  const cell = occupiedTrackCell(token.color, token.progress);
  if (cell !== null && !isSafeCell(cell)) {
    for (const victim of opponentsOnCell(state, token.color, cell)) {
      victim.progress = -1;
      refreshTokenState(victim);
      captured.push(victim);
    }
  }
  return captured;
}
