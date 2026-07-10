// Sound, synthesized on the fly with the Web Audio API. No audio files means
// nothing extra to download and nothing to host: a few oscillators cover the
// whole game. Muting is instant and remembered.

type SoundName = 'roll' | 'move' | 'capture' | 'home' | 'win';

interface Blip {
  freq: number;
  dur: number;
  type: OscillatorType;
  /** Optional second note for a quick two-note flourish. */
  then?: { freq: number; delay: number };
}

const BLIPS: Record<SoundName, Blip> = {
  roll: { freq: 220, dur: 0.12, type: 'triangle' },
  move: { freq: 330, dur: 0.07, type: 'sine' },
  capture: {
    freq: 180,
    dur: 0.16,
    type: 'sawtooth',
    then: { freq: 90, delay: 0.08 },
  },
  home: { freq: 520, dur: 0.14, type: 'sine', then: { freq: 780, delay: 0.1 } },
  win: {
    freq: 523,
    dur: 0.18,
    type: 'triangle',
    then: { freq: 784, delay: 0.14 },
  },
};

export class Sound {
  private ctx: AudioContext | null = null;
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  /** Must be called from a user gesture the first time (browser autoplay rules). */
  private context(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  play(name: SoundName): void {
    const ctx = this.context();
    if (!ctx) return;
    const blip = BLIPS[name];
    this.tone(ctx, blip.freq, blip.dur, blip.type, 0);
    if (blip.then) {
      this.tone(ctx, blip.then.freq, blip.dur, blip.type, blip.then.delay);
    }
  }

  private tone(
    ctx: AudioContext,
    freq: number,
    dur: number,
    type: OscillatorType,
    delay: number
  ): void {
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }
}
