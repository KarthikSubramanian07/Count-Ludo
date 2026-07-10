// The opponent. A transparent, rule-based scorer: it looks at every legal move,
// gives each a number, and (mostly) takes the best one. No neural nets, no
// tables, nothing you cannot read in one sitting. Difficulty is just how
// strictly it chases the top score versus rolling the dice on its own judgment.

import type { Color, Difficulty, GameState, Move, Token } from './types.ts';
import {
  LAST_TRACK_PROGRESS,
  isOnTrack,
  isSafeCell,
  occupiedTrackCell,
  trackCellAt,
} from './board.ts';
import { allTokens } from './rules.ts';

interface Weights {
  finish: number;
  capture: number;
  captureProgressBonus: number;
  release: number;
  safe: number;
  escape: number;
  progress: number;
  risk: number;
}

// Hard weights. Finishing dominates, capturing a well-advanced piece is worth a
// lot, sitting in the open near enemies is punished.
const HARD: Weights = {
  finish: 1000,
  capture: 120,
  captureProgressBonus: 2,
  release: 45,
  safe: 28,
  escape: 70,
  progress: 1.5,
  risk: 34,
};

// Medium plays the board but ignores the risk of being captured next turn and
// values escaping less: competent, not paranoid.
const MEDIUM: Weights = {
  ...HARD,
  escape: 25,
  risk: 0,
};

/**
 * Choose a move for the current player. `random` is injectable so tests are
 * deterministic; in play it defaults to Math.random (AI variety, not fairness,
 * so it need not be a CSPRNG).
 */
export function chooseMove(
  state: GameState,
  moves: readonly Move[],
  difficulty: Difficulty,
  random: () => number = Math.random
): Move {
  if (moves.length === 0) {
    throw new Error('chooseMove called with no legal moves');
  }
  if (moves.length === 1) return moves[0]!;

  // Easy mostly wanders, but will still pounce on a free finish or capture so it
  // is not maddeningly dumb.
  if (difficulty === 'easy') {
    const obvious = moves.find((m) => m.finishes || m.captures.length > 0);
    if (obvious && random() < 0.5) return obvious;
    return moves[Math.floor(random() * moves.length)]!;
  }

  const weights = difficulty === 'hard' ? HARD : MEDIUM;
  let best: Move[] = [];
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = scoreMove(state, move, weights);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = [move];
    } else if (Math.abs(score - bestScore) <= 1e-9) {
      best.push(move);
    }
  }
  // Break ties randomly so the bot is not robotically predictable.
  return best[Math.floor(random() * best.length)]!;
}

/** The heuristic score for a single move. Exported for tests and tuning. */
export function scoreMove(
  state: GameState,
  move: Move,
  weights: Weights
): number {
  const color = move.token.color;
  let score = 0;

  if (move.finishes) score += weights.finish;

  if (move.captures.length > 0) {
    score += weights.capture * move.captures.length;
    score += weights.captureProgressBonus * capturedDistance(state, move);
  }

  if (move.leavesBase) score += weights.release;

  // Squares advanced toward home this move.
  const from = move.leavesBase ? 0 : move.token.progress;
  score += weights.progress * (move.to - from);

  const landingCell = occupiedTrackCell(color, move.to);
  const landsSafe = landingCell === null || isSafeCell(landingCell);
  if (landsSafe) score += weights.safe;

  // Escaping: the token is currently exposed and this move relocates it.
  if (!move.leavesBase && move.token.state === 'track') {
    const fromCell = occupiedTrackCell(color, move.token.progress);
    if (
      fromCell !== null &&
      !isSafeCell(fromCell) &&
      threatCount(state, color, fromCell) > 0 &&
      move.to !== move.token.progress
    ) {
      score += weights.escape;
    }
  }

  // Risk: landing somewhere an opponent can capture next turn.
  if (weights.risk > 0 && !landsSafe && landingCell !== null) {
    score -= weights.risk * threatCount(state, color, landingCell);
  }

  return score;
}

/** Total progress of the tokens this move would capture (advanced = juicier). */
function capturedDistance(state: GameState, move: Move): number {
  const cell = occupiedTrackCell(move.token.color, move.to);
  if (cell === null) return 0;
  let total = 0;
  for (const token of allTokens(state)) {
    if (token.color === move.token.color) continue;
    if (occupiedTrackCell(token.color, token.progress) === cell) {
      total += token.progress;
    }
  }
  return total;
}

/**
 * How many opponent tokens could capture a piece sitting on shared `cell` on
 * their next turn (any die 1..6 that lands exactly on the cell, still on the
 * track). Base tokens are ignored: a freed token only ever lands on its own
 * start, which is safe.
 */
function threatCount(state: GameState, color: Color, cell: number): number {
  if (isSafeCell(cell)) return 0;
  let threats = 0;
  for (const token of allTokens(state) as Token[]) {
    if (token.color === color) continue;
    if (!isOnTrack(token.progress)) continue;
    for (let d = 1; d <= 6; d++) {
      const dest = token.progress + d;
      if (dest > LAST_TRACK_PROGRESS) break;
      if (trackCellAt(token.color, dest) === cell) {
        threats++;
        break;
      }
    }
  }
  return threats;
}
