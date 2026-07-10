// jsdom-free localStorage shim: enough of the Storage interface for
// storage.ts, without pulling in a DOM environment for the rest of the suite.
import { describe, it, expect, beforeEach } from 'vitest';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

(globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
  new MemoryStorage();

const { loadSave, writeSave, clearSave } = await import('../src/ui/storage.ts');
const { newGame } = await import('./helpers.ts');

function resetStorage(): void {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
    new MemoryStorage();
}

describe('loadSave', () => {
  beforeEach(resetStorage);

  it('round-trips a real save written by writeSave', () => {
    const game = newGame(['red', 'green'], [6]);
    writeSave(game.state);
    const loaded = loadSave();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.players).toHaveLength(2);
  });

  it('returns null when there is nothing saved', () => {
    expect(loadSave()).toBeNull();
  });

  it('returns null (not a throw) for corrupted JSON', () => {
    localStorage.setItem('count-ludo:save', '{not json');
    expect(loadSave()).toBeNull();
  });

  it('rejects a save missing required fields', () => {
    localStorage.setItem(
      'count-ludo:save',
      JSON.stringify({ savedAt: 1, state: {} })
    );
    expect(loadSave()).toBeNull();
  });

  it('rejects a save with an out-of-range current player index', () => {
    const game = newGame(['red', 'green'], [6]);
    const bad = { state: { ...game.state, current: 5 }, savedAt: 1 };
    localStorage.setItem('count-ludo:save', JSON.stringify(bad));
    expect(loadSave()).toBeNull();
  });

  it('clearSave removes it', () => {
    const game = newGame(['red', 'green'], [6]);
    writeSave(game.state);
    clearSave();
    expect(loadSave()).toBeNull();
  });
});
