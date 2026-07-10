import { describe, it, expect } from 'vitest';
import {
  START_CELL,
  HOME_ENTRY_CELL,
  SAFE_CELLS,
  PERSONAL_PATH,
  TRACK_LENGTH,
  HOME_PROGRESS,
  LAST_TRACK_PROGRESS,
  HOME_COLUMN_LENGTH,
  trackCellAt,
  occupiedTrackCell,
  isOnTrack,
  isInHomeColumn,
  isHome,
  homeColumnIndexAt,
  isSafeCell,
} from '../src/engine/board.ts';
import { COLORS } from '../src/engine/types.ts';

describe('board constants', () => {
  it('places the four starts 13 apart', () => {
    expect(START_CELL).toEqual({ red: 0, green: 13, yellow: 26, blue: 39 });
  });

  it('derives each home entry as start + 50 (the arm turn-in cell)', () => {
    // The only cell on a 15x15 board from which the private lane is reachable.
    expect(HOME_ENTRY_CELL).toEqual({
      red: 50,
      green: 11,
      yellow: 24,
      blue: 37,
    });
  });

  it('uses the standard 8 safe cells (4 starts + 4 stars at start+8)', () => {
    expect([...SAFE_CELLS].sort((a, b) => a - b)).toEqual([
      0, 8, 13, 21, 26, 34, 39, 47,
    ]);
    for (const start of Object.values(START_CELL)) {
      expect(isSafeCell(start)).toBe(true);
      expect(isSafeCell((start + 8) % TRACK_LENGTH)).toBe(true);
    }
  });
});

describe('personal path', () => {
  it('is 57 cells: 51 track + 5 home column + center', () => {
    expect(HOME_PROGRESS).toBe(56);
    expect(LAST_TRACK_PROGRESS).toBe(50);
    expect(HOME_COLUMN_LENGTH).toBe(5);
    for (const color of COLORS) {
      expect(PERSONAL_PATH[color]).toHaveLength(HOME_PROGRESS + 1);
    }
  });

  it('walks each color clockwise from its start and wraps at 52', () => {
    for (const color of COLORS) {
      const start = START_CELL[color];
      expect(PERSONAL_PATH[color][0]).toBe(start);
      expect(PERSONAL_PATH[color][LAST_TRACK_PROGRESS]).toBe(
        (start + LAST_TRACK_PROGRESS) % TRACK_LENGTH
      );
      // Home-column progresses are private (not shared cells).
      expect(PERSONAL_PATH[color][51]).toBe(-1);
      expect(PERSONAL_PATH[color][HOME_PROGRESS]).toBe(-1);
    }
  });

  it('steps on 51 distinct cells and skips the one before its start', () => {
    for (const color of COLORS) {
      const track = PERSONAL_PATH[color].slice(0, LAST_TRACK_PROGRESS + 1);
      expect(track).toHaveLength(51);
      expect(new Set(track).size).toBe(51); // all distinct
      // The cell immediately before the start is never stepped on.
      const start = START_CELL[color];
      expect(track).not.toContain((start + TRACK_LENGTH - 1) % TRACK_LENGTH);
    }
  });
});

describe('position helpers', () => {
  it('classifies progress into track / homecol / home', () => {
    expect(isOnTrack(0)).toBe(true);
    expect(isOnTrack(50)).toBe(true);
    expect(isOnTrack(51)).toBe(false);

    expect(isInHomeColumn(51)).toBe(true);
    expect(isInHomeColumn(55)).toBe(true);
    expect(isInHomeColumn(56)).toBe(false);

    expect(isHome(56)).toBe(true);
    expect(isHome(55)).toBe(false);
  });

  it('maps home-column progress to homeColIndex 0..4', () => {
    expect(homeColumnIndexAt(51)).toBe(0);
    expect(homeColumnIndexAt(55)).toBe(4);
    expect(homeColumnIndexAt(50)).toBe(-1);
    expect(homeColumnIndexAt(56)).toBe(-1);
  });

  it('only exposes a shared cell while on the track', () => {
    expect(occupiedTrackCell('green', 0)).toBe(13);
    expect(occupiedTrackCell('green', 50)).toBe(11);
    expect(occupiedTrackCell('green', 51)).toBeNull(); // home column: private
    expect(occupiedTrackCell('green', 56)).toBeNull(); // home: private
  });

  it('wraps trackCellAt around the loop', () => {
    expect(trackCellAt('blue', 0)).toBe(39);
    expect(trackCellAt('blue', 13)).toBe(0); // 39 + 13 = 52 -> 0
  });
});
