// The dice. "The dice are rigged" is the single most common complaint leveled
// at every online Ludo game, so this module has one job: be genuinely,
// verifiably uniform, and be swappable so the tests can prove it.
//
// The default source is crypto.getRandomValues with rejection sampling, which
// removes the modulo bias you get from a naive `% 6`. Tests inject a
// deterministic sequence instead, so the rules can be exercised without luck.

/** A source of die rolls. Returns an integer 1..6. */
export interface DieRoller {
  roll(): number;
}

/**
 * Uniform 1..6 using the platform CSPRNG.
 *
 * A single byte is 0..255. 256 is not divisible by 6, so the top 4 values
 * (252..255) would bias the result; we reject and redraw them. What remains
 * (0..251) is an exact multiple of 6, giving a perfectly flat distribution.
 */
export class CryptoDie implements DieRoller {
  private readonly buffer = new Uint8Array(1);

  roll(): number {
    let value: number;
    do {
      crypto.getRandomValues(this.buffer);
      value = this.buffer[0]!;
    } while (value >= 252);
    return (value % 6) + 1;
  }
}

/**
 * Deterministic roller for tests and replays: hands back a fixed sequence,
 * looping if it runs dry. Never used in production play.
 */
export class ScriptedDie implements DieRoller {
  private cursor = 0;

  constructor(private readonly sequence: readonly number[]) {
    if (sequence.length === 0) {
      throw new Error('ScriptedDie needs at least one value');
    }
  }

  roll(): number {
    const value = this.sequence[this.cursor % this.sequence.length]!;
    this.cursor++;
    return value;
  }
}

/** The die used in real games. */
export const defaultDie: DieRoller = new CryptoDie();
