// The bridge between the engine's abstract positions (progress 0..56) and
// pixels. The engine knows nothing about rows and columns; this file is the one
// place that maps a token's logical position to a cell on a 15x15 grid.
//
// The board is a classic cross laid over a 15x15 grid (225 cells). Four 6x6
// yards sit in the corners, three-wide arms reach toward a 3x3 center, and the
// 52-cell track threads around it. Every coordinate below is [row, col] with
// (0,0) at the top-left; fractional values center a token within a region.
//
// Colors sit clockwise from the top-left: red, green, yellow, blue. This
// matches the engine's start cells (red 0, green 13, yellow 26, blue 39) and
// turn order.

import type { Color } from '../engine/types.ts';
import {
  occupiedTrackCell,
  homeColumnIndexAt,
  isHome,
  isOnTrack,
} from '../engine/board.ts';
import type { Token } from '../engine/types.ts';

export type Coord = readonly [number, number]; // [row, col]

/**
 * The 52 shared track cells, indexed by absolute track index (0..51). Walking
 * the array is walking clockwise around the board. Each color's start index
 * lands on its colored entry cell.
 */
export const TRACK_COORDS: readonly Coord[] = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5], // 0-4  red entry lane
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6], // 5-10
  [0, 7], // 11  green turn-in
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8], // 12-17 green entry lane
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14], // 18-23
  [7, 14], // 24  yellow turn-in
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9], // 25-30 yellow entry lane
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8], // 31-36
  [14, 7], // 37  blue turn-in
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6], // 38-43 blue entry lane
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0], // 44-49
  [7, 0], // 50  red turn-in
  [6, 0], // 51
];

/** The five private home-column cells per color (homeColIndex 0..4). */
export const HOME_COLUMN_COORDS: Record<Color, readonly Coord[]> = {
  red: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  green: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  yellow: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  blue: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
};

/** Each color's final resting cell in the center (progress 56 = home). */
export const CENTER_COORDS: Record<Color, Coord> = {
  red: [7, 6],
  green: [6, 7],
  yellow: [7, 8],
  blue: [8, 7],
};

/** The four token slots inside each yard, centered nicely in the 6x6 corner. */
export const BASE_SLOTS: Record<Color, readonly Coord[]> = {
  red: [
    [1.5, 1.5],
    [1.5, 3.5],
    [3.5, 1.5],
    [3.5, 3.5],
  ],
  green: [
    [1.5, 10.5],
    [1.5, 12.5],
    [3.5, 10.5],
    [3.5, 12.5],
  ],
  yellow: [
    [10.5, 10.5],
    [10.5, 12.5],
    [12.5, 10.5],
    [12.5, 12.5],
  ],
  blue: [
    [10.5, 1.5],
    [10.5, 3.5],
    [12.5, 1.5],
    [12.5, 3.5],
  ],
};

/** Top-left origin of each 6x6 yard, and which corner it occupies. */
export const YARD_ORIGIN: Record<Color, Coord> = {
  red: [0, 0],
  green: [0, 9],
  yellow: [9, 9],
  blue: [9, 0],
};

/** Where a token should be drawn right now, as a grid coordinate. */
export function tokenCoord(token: Token): Coord {
  if (token.state === 'base') {
    return BASE_SLOTS[token.color][token.index]!;
  }
  if (isHome(token.progress)) {
    return CENTER_COORDS[token.color];
  }
  if (isOnTrack(token.progress)) {
    const cell = occupiedTrackCell(token.color, token.progress)!;
    return TRACK_COORDS[cell]!;
  }
  const homeIdx = homeColumnIndexAt(token.progress);
  return HOME_COLUMN_COORDS[token.color][homeIdx]!;
}

/** Center of a grid cell in viewBox units (each cell is 1 unit wide). */
export function cellCenter([row, col]: Coord): { x: number; y: number } {
  return { x: col + 0.5, y: row + 0.5 };
}
