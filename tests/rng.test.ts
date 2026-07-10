import { describe, it, expect } from 'vitest';
import { CryptoDie, ScriptedDie } from '../src/engine/rng.ts';

describe('ScriptedDie', () => {
  it('yields its sequence and then loops', () => {
    const die = new ScriptedDie([1, 2, 3]);
    expect([die.roll(), die.roll(), die.roll(), die.roll()]).toEqual([
      1, 2, 3, 1,
    ]);
  });

  it('refuses an empty sequence', () => {
    expect(() => new ScriptedDie([])).toThrow();
  });
});

describe('CryptoDie', () => {
  // Both cases hammer crypto.getRandomValues thousands of times; shared CI
  // runners can be slow enough to brush the default 5s timeout, so these get
  // explicit headroom rather than risking a flaky red build.
  it('only ever returns 1..6', () => {
    const die = new CryptoDie();
    for (let i = 0; i < 5000; i++) {
      const v = die.roll();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  }, 15000);

  it('is roughly uniform (no face wildly over- or under-represented)', () => {
    const die = new CryptoDie();
    const counts = [0, 0, 0, 0, 0, 0];
    const n = 60000;
    for (let i = 0; i < n; i++) counts[die.roll() - 1]!++;
    const expected = n / 6;
    for (const c of counts) {
      // Generous +/-15% band: catches bias, tolerates normal variance.
      expect(c).toBeGreaterThan(expected * 0.85);
      expect(c).toBeLessThan(expected * 1.15);
    }
  }, 15000);
});
