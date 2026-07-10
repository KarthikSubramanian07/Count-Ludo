// The board model. This is the part everything else leans on, so it is written
// to be read.
//
// THE TRACK
// ---------
// The shared loop is 52 cells, indexed 0..51 clockwise. Each color enters the
// loop at a fixed start cell, spaced 13 apart:
//
//     red 0   green 13   yellow 26   blue 39
//
// THE PERSONAL PATH
// -----------------
// A token does not think in absolute cells; it thinks in "how far along my own
// journey am I". That journey is a 57-cell personal path, indexed by `progress`
// 0..56:
//
//   progress 0..50  -> the 51 shared track cells the token actually steps on,
//                      starting at the color's start cell and walking clockwise.
//                      progress 50 lands on (start + 50), the last shared cell,
//                      from which the token turns inward. (A color never steps
//                      on the cell immediately before its own start; it has
//                      already peeled off into its home column by then.)
//   progress 51..55 -> the 5 private "home column" cells (homeColIndex 0..4).
//   progress 56     -> the center. Home. Journey complete.
//
// So the personal path is 51 track cells + 6 home cells = 57 cells, and a token
// takes 56 steps to travel from its start cell to the center. Leaving base is
// the move that puts a token onto progress 0 (its start cell); it costs a
// rolled 6.
//
// This turn-in point (start + 50) is not arbitrary: it is the only cell on a
// real 15x15 board from which a color's private middle lane is reachable, so
// the model and the rendered board agree by construction.
//
// EXACT COUNT
// -----------
// A move is legal only if `progress + die <= 56`. You cannot overshoot the
// center; you must land on it exactly. Home (56) is the only terminal cell.
//
// WHY THIS SHAPE
// --------------
// Because every token shares one integer scale (0..57), movement is just
// addition, capture is "same trackIndex, different color", and home-column
// cells are private by construction (they are never mapped through %52, so no
// opponent can ever occupy or capture them). The whole rulebook falls out of
// this one table.

import type { Color } from './types.ts';
import { COLORS } from './types.ts';

/** Number of shared cells on the main loop. */
export const TRACK_LENGTH = 52;

/** progress index of the last shared cell a token steps on (start + 50). */
export const LAST_TRACK_PROGRESS = 50;

/** progress index of the center / home cell. */
export const HOME_PROGRESS = 56;

/** Number of private home-column cells before the center (homeColIndex 0..4). */
export const HOME_COLUMN_LENGTH = 5;

/** Tokens per player. */
export const TOKENS_PER_PLAYER = 4;

/** Fixed entry cell on the shared track for each color. */
export const START_CELL: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/**
 * Universal safe cells: the 4 colored start cells plus 4 star cells (each start
 * + 8). A token standing on any of these cannot be captured, by anyone. This is
 * the standard 8-safe-square layout.
 */
export const SAFE_CELLS: ReadonlySet<number> = new Set([
  0, 8, 13, 21, 26, 34, 39, 47,
]);

/** The shared cell each color turns inward from (start + 50). */
export const HOME_ENTRY_CELL: Record<Color, number> = {
  red: entryCell('red'),
  green: entryCell('green'),
  yellow: entryCell('yellow'),
  blue: entryCell('blue'),
};

function entryCell(color: Color): number {
  return (START_CELL[color] + LAST_TRACK_PROGRESS) % TRACK_LENGTH;
}

/**
 * The absolute track cell a token occupies at a given progress on the track
 * portion of the path (progress 0..51). Undefined outside that range.
 */
export function trackCellAt(color: Color, progress: number): number {
  return (START_CELL[color] + progress) % TRACK_LENGTH;
}

/** True for progress values that sit on the shared loop. */
export function isOnTrack(progress: number): boolean {
  return progress >= 0 && progress <= LAST_TRACK_PROGRESS;
}

/** True for progress values in the private home column (not yet the center). */
export function isInHomeColumn(progress: number): boolean {
  return progress > LAST_TRACK_PROGRESS && progress < HOME_PROGRESS;
}

/** True only for the center cell. */
export function isHome(progress: number): boolean {
  return progress === HOME_PROGRESS;
}

/** homeColIndex 0..4 for a home-column progress, else -1. */
export function homeColumnIndexAt(progress: number): number {
  return isInHomeColumn(progress) ? progress - (LAST_TRACK_PROGRESS + 1) : -1;
}

/**
 * The shared track cell shared by a token, or null if it is not on the loop.
 * This is the only lens through which capture and blocking are computed, which
 * is exactly why home-column tokens are untouchable.
 */
export function occupiedTrackCell(
  color: Color,
  progress: number
): number | null {
  return isOnTrack(progress) ? trackCellAt(color, progress) : null;
}

/** True when a token on this shared cell is immune to capture. */
export function isSafeCell(cell: number): boolean {
  return SAFE_CELLS.has(cell);
}

/**
 * Precomputed personal path per color: personalPath[color][progress] is the
 * absolute track cell for the track portion, or -1 once the path turns into the
 * private home column. Handy for the AI and for board rendering; the rules
 * themselves use the helpers above.
 */
export const PERSONAL_PATH: Record<Color, readonly number[]> = buildPaths();

function buildPaths(): Record<Color, number[]> {
  const paths = {} as Record<Color, number[]>;
  for (const color of COLORS) {
    const path: number[] = [];
    for (let p = 0; p <= HOME_PROGRESS; p++) {
      path.push(isOnTrack(p) ? trackCellAt(color, p) : -1);
    }
    paths[color] = path;
  }
  return paths;
}
