// Everything we remember lives in localStorage and nowhere else. No accounts,
// no server, no tracking. If storage is unavailable (private mode, disabled),
// every function degrades to a sane default instead of throwing.

import type { GameState } from '../engine/types.ts';
import { COLORS } from '../engine/types.ts';

const PREFIX = 'count-ludo:';
const KEYS = {
  prefs: `${PREFIX}prefs`,
  stats: `${PREFIX}stats`,
  save: `${PREFIX}save`,
} as const;

export interface Prefs {
  theme: string;
  sound: boolean;
  blocking: boolean;
}

export interface Stats {
  gamesPlayed: number;
  gamesFinished: number;
  humanWins: number;
  currentStreak: number;
  bestStreak: number;
  tokensCaptured: number;
}

export interface SavedGame {
  state: GameState;
  savedAt: number;
}

const DEFAULT_PREFS: Prefs = {
  theme: 'midnight',
  sound: true,
  blocking: false,
};

const DEFAULT_STATS: Stats = {
  gamesPlayed: 0,
  gamesFinished: 0,
  humanWins: 0,
  currentStreak: 0,
  bestStreak: 0,
  tokensCaptured: 0,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Out of quota or storage blocked: play on without persistence.
  }
}

export function loadPrefs(): Prefs {
  return read(KEYS.prefs, DEFAULT_PREFS);
}

export function savePrefs(prefs: Prefs): void {
  write(KEYS.prefs, prefs);
}

export function loadStats(): Stats {
  return read(KEYS.stats, DEFAULT_STATS);
}

export function saveStats(stats: Stats): void {
  write(KEYS.stats, stats);
}

/**
 * A save is written only by this app, but localStorage can still hand back
 * something stale (an older schema) or truncated (a quota-limited write). A
 * shallow shape check is enough to keep a bad save from reaching the engine
 * and throwing mid-render; treat anything that fails it as "no save".
 */
function isValidSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== 'object' || value === null) return false;
  const { state, savedAt } = value as Partial<SavedGame>;
  if (typeof savedAt !== 'number') return false;
  if (typeof state !== 'object' || state === null) return false;
  const { players, current, ranking } = state;
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
    return false;
  }
  if (typeof current !== 'number' || current < 0 || current >= players.length) {
    return false;
  }
  if (!Array.isArray(ranking)) return false;
  return players.every(
    (p) =>
      typeof p === 'object' &&
      p !== null &&
      COLORS.includes(p.color) &&
      Array.isArray(p.tokens) &&
      p.tokens.length === 4
  );
}

export function loadSave(): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEYS.save);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSavedGame(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSave(state: GameState): void {
  // Stamp the time in the caller-free way the engine can't (Date is a UI concern).
  write(KEYS.save, { state, savedAt: Date.now() } satisfies SavedGame);
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEYS.save);
  } catch {
    // ignore
  }
}
