// The conductor. It owns the running game, drives the turn loop (human taps and
// bot moves through the same code path), animates the die and tokens, and keeps
// preferences, stats, and the resume snapshot in sync. The engine stays pure;
// all the timing, sound, and persistence live here.

import type {
  Color,
  Difficulty,
  GameConfig,
  Move,
  Token,
} from '../engine/types.ts';
import { LudoGame } from '../engine/game.ts';
import { chooseMove } from '../engine/ai.ts';
import { BoardView } from './board.ts';
import { DieView } from './dice.ts';
import { Sound } from './sound.ts';
import { applyTheme, THEMES } from './theme.ts';
import { h, clear, cap } from './dom.ts';
import {
  loadPrefs,
  savePrefs,
  loadStats,
  saveStats,
  loadSave,
  writeSave,
  clearSave,
  type Prefs,
  type Stats,
} from './storage.ts';
import { buildHome, type SetupState } from './screens/home.ts';
import { buildWin } from './screens/win.ts';

interface RollLogEntry {
  n: number;
  color: Color;
  value: number;
  note: string;
}

const MOVE_ANIM_MS = 340;
const BOT_THINK_MS = 480;

export class App {
  private readonly root: HTMLElement;
  private prefs: Prefs;
  private stats: Stats;
  private readonly sound: Sound;
  private readonly board = new BoardView();
  private readonly die = new DieView();

  private game: LudoGame | null = null;
  private humanColors = new Set<Color>();
  private rollLog: RollLogEntry[] = [];
  private busy = false;
  // Bumped whenever the running game is torn down (leaving, starting fresh,
  // resuming). Scheduled bot/auto-move timers capture it and check it before
  // acting, so a timer left over from a previous game can never fire against
  // the game that replaced it.
  private generation = 0;

  // Live references on the game screen, updated in place.
  private turnLabel!: HTMLElement;
  private messageEl!: HTMLElement;
  private statusLive!: HTMLElement;
  private rollBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private movePicker!: HTMLElement;
  private logList!: HTMLElement;
  private fairnessPanel!: HTMLElement;
  private fairnessBackdrop!: HTMLElement;
  private fairnessCloseBtn!: HTMLButtonElement;
  private fairnessReturnFocus: HTMLElement | null = null;
  private fairnessKeyHandler: ((ev: KeyboardEvent) => void) | null = null;
  /** When true, bot turns wait until the player resumes. */
  private paused = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.prefs = loadPrefs();
    this.stats = loadStats();
    this.sound = new Sound(this.prefs.sound);
    applyTheme(this.prefs.theme);
  }

  start(): void {
    this.showHome();
  }

  // ---- Screen: Home -------------------------------------------------------

  private showHome(): void {
    this.teardownFairness();
    clear(this.root);
    const hasSave = Boolean(loadSave());
    const home = buildHome({
      prefs: this.prefs,
      stats: this.stats,
      themes: THEMES,
      hasSave,
      onThemeChange: (id) => this.setTheme(id),
      onStart: (setup) => this.startGame(setup),
      onResume: () => this.resumeGame(),
    });
    home.id = 'main-content';
    this.root.append(skipLink(), home);
  }

  private setTheme(id: string): void {
    applyTheme(id);
    this.prefs = { ...this.prefs, theme: id };
    savePrefs(this.prefs);
  }

  // ---- Starting / resuming ------------------------------------------------

  private startGame(setup: SetupState): void {
    this.generation++;
    this.busy = false;
    this.paused = false;
    this.prefs = { ...this.prefs, blocking: setup.blocking };
    savePrefs(this.prefs);

    const config: GameConfig = {
      blocking: setup.blocking,
      seats: setup.seats.map((seat) => ({
        color: seat.color,
        isHuman: seat.isHuman,
        difficulty: seat.difficulty as Difficulty,
        name: seat.name,
      })),
    };
    this.game = new LudoGame(config);
    this.humanColors = new Set(
      config.seats.filter((s) => s.isHuman).map((s) => s.color)
    );
    this.rollLog = [];
    this.stats = { ...this.stats, gamesPlayed: this.stats.gamesPlayed + 1 };
    saveStats(this.stats);
    writeSave(this.game.state);

    this.showGame();
    this.beginTurn();
  }

  private resumeGame(): void {
    const saved = loadSave();
    if (!saved) return this.showHome();
    // A finished game should never have been saved (see doMove), but guard
    // against a stale one anyway rather than reopening a game that is over.
    if (saved.state.phase === 'gameover') {
      clearSave();
      return this.showHome();
    }
    this.generation++;
    this.busy = false;
    this.paused = false;
    this.game = LudoGame.fromState(saved.state);
    this.humanColors = new Set(
      saved.state.players.filter((p) => p.isHuman).map((p) => p.color)
    );
    this.rollLog = [];
    this.showGame();
    this.beginTurn();
  }

  // ---- Screen: Game -------------------------------------------------------

  private showGame(): void {
    this.teardownFairness();
    clear(this.root);

    this.turnLabel = h('div', { class: 'turn-label', id: 'turn-label' });
    this.messageEl = h('div', { class: 'message' });
    this.statusLive = h('div', {
      class: 'sr-only',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    this.rollBtn = h(
      'button',
      { class: 'btn btn-roll', type: 'button' },
      'Roll'
    ) as HTMLButtonElement;
    this.rollBtn.onclick = () => this.onRollClick();
    this.pauseBtn = h(
      'button',
      {
        class: 'btn btn-ghost',
        type: 'button',
        'aria-pressed': 'false',
      },
      'Pause'
    ) as HTMLButtonElement;
    this.pauseBtn.onclick = () => this.togglePause();
    this.movePicker = h('div', {
      class: 'move-picker',
      role: 'group',
      'aria-label': 'Legal moves',
      hidden: true,
    });
    this.logList = h('ol', { class: 'log-list' });
    this.fairnessCloseBtn = h(
      'button',
      { class: 'icon-btn', type: 'button', 'aria-label': 'Close roll log' },
      '×'
    ) as HTMLButtonElement;
    this.fairnessCloseBtn.onclick = () => this.closeFairness();
    this.fairnessBackdrop = h('div', {
      class: 'fairness-backdrop',
      hidden: true,
    });
    this.fairnessBackdrop.onclick = () => this.closeFairness();
    this.fairnessPanel = h(
      'div',
      {
        class: 'fairness fairness-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'fairness-title',
        hidden: true,
      },
      h(
        'div',
        { class: 'fairness-head' },
        h('h2', { id: 'fairness-title' }, 'Roll log'),
        this.fairnessCloseBtn
      ),
      h(
        'p',
        { class: 'fairness-note' },
        'Every roll uses your browser’s cryptographic randomness, ',
        'the same source used for encryption keys. No streaks are nudged, ',
        'no rolls are saved for later. What you see is what you got.'
      ),
      this.logList
    );

    const fairnessBtn = iconBtn('⚖', 'Fairness and roll log', () =>
      this.openFairness(fairnessBtn)
    );

    const header = h(
      'header',
      { class: 'game-header' },
      iconBtn('←', 'Back to menu', () => this.confirmLeave()),
      h('div', { class: 'brand-mini' }, 'Count Ludo'),
      h(
        'div',
        { class: 'header-tools' },
        fairnessBtn,
        this.soundBtn(),
        this.themeBtn()
      )
    );

    const panel = h(
      'div',
      { class: 'play-panel' },
      this.turnLabel,
      h('div', { class: 'die-wrap' }, this.die.el),
      this.rollBtn,
      this.pauseBtn,
      this.messageEl,
      this.movePicker
    );

    this.root.append(
      skipLink(),
      this.statusLive,
      h(
        'div',
        { class: 'game-screen', id: 'main-content' },
        header,
        h('div', { class: 'board-wrap' }, this.board.el),
        panel
      ),
      this.fairnessBackdrop,
      this.fairnessPanel
    );
    this.renderLog();
  }

  private soundBtn(): HTMLElement {
    const btn = iconBtn(
      this.prefs.sound ? '\u{1F50A}' : '\u{1F507}',
      'Toggle sound',
      () => {
        this.prefs = { ...this.prefs, sound: !this.prefs.sound };
        this.sound.setEnabled(this.prefs.sound);
        savePrefs(this.prefs);
        btn.textContent = this.prefs.sound ? '\u{1F50A}' : '\u{1F507}';
      }
    );
    return btn;
  }

  private themeBtn(): HTMLElement {
    return iconBtn('\u{1F3A8}', 'Next theme', () => {
      const idx = THEMES.findIndex((t) => t.id === this.prefs.theme);
      const next = THEMES[(idx + 1) % THEMES.length]!;
      this.setTheme(next.id);
    });
  }

  private openFairness(returnFocus: HTMLElement): void {
    if (!this.fairnessPanel.hidden) return;
    this.fairnessReturnFocus = returnFocus;
    this.fairnessPanel.hidden = false;
    this.fairnessBackdrop.hidden = false;
    this.fairnessKeyHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.closeFairness();
        return;
      }
      if (ev.key !== 'Tab') return;
      const focusable = this.fairnessFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', this.fairnessKeyHandler);
    this.fairnessCloseBtn.focus();
  }

  private closeFairness(): void {
    if (this.fairnessPanel.hidden) return;
    this.fairnessPanel.hidden = true;
    this.fairnessBackdrop.hidden = true;
    if (this.fairnessKeyHandler) {
      document.removeEventListener('keydown', this.fairnessKeyHandler);
      this.fairnessKeyHandler = null;
    }
    const back = this.fairnessReturnFocus;
    this.fairnessReturnFocus = null;
    back?.focus();
  }

  private teardownFairness(): void {
    if (this.fairnessKeyHandler) {
      document.removeEventListener('keydown', this.fairnessKeyHandler);
      this.fairnessKeyHandler = null;
    }
    this.fairnessReturnFocus = null;
  }

  private fairnessFocusable(): HTMLElement[] {
    return [
      ...this.fairnessPanel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
    this.pauseBtn.setAttribute('aria-pressed', this.paused ? 'true' : 'false');
    this.announce(this.paused ? 'Game paused.' : 'Game resumed.');
    if (!this.paused && this.game && !this.game.current.isHuman && !this.busy) {
      this.after(BOT_THINK_MS, () => void this.doRoll());
    }
  }

  private confirmLeave(): void {
    // The game is saved continuously, so leaving is safe and resumable. Bump
    // the generation and clear `busy` so a bot timer scheduled by the game
    // we're leaving can never act on whatever we do next.
    this.generation++;
    this.busy = false;
    this.paused = false;
    this.game = null;
    this.teardownFairness();
    this.showHome();
  }

  /** Schedule `fn`, but only run it if no game has been left/started/resumed since. */
  private after(ms: number, fn: () => void): void {
    const gen = this.generation;
    window.setTimeout(() => {
      if (gen === this.generation) fn();
    }, ms);
  }

  // ---- Turn loop ----------------------------------------------------------

  private beginTurn(): void {
    const game = this.game;
    if (!game) return;
    if (game.isGameOver()) return this.finish();

    const player = game.current;
    const human = player.isHuman;
    this.renderBoard(human ? game.moves : [], human);
    this.updatePanel();
    this.rollBtn.disabled = !human;
    this.rollBtn.hidden = !human;

    if (!human && !this.paused) {
      this.after(BOT_THINK_MS, () => void this.doRoll());
    }
  }

  private onRollClick(): void {
    if (this.busy || !this.game) return;
    if (!this.game.current.isHuman) return;
    void this.doRoll();
  }

  private async doRoll(): Promise<void> {
    const game = this.game;
    if (!game || this.busy || this.paused) return;
    this.busy = true;
    this.rollBtn.disabled = true;
    this.clearMovePicker();

    const player = game.current;
    const result = game.roll();
    this.sound.play('roll');
    await this.die.animateRoll(result.die);
    writeSave(game.state);
    this.announce(`${player.name} rolled ${result.die}.`);

    if (result.outcome === 'awaiting-move') {
      this.log(player.color, result.die, 'to move');
      if (player.isHuman) {
        this.renderBoard(result.moves, true);
        this.renderMovePicker(result.moves);
        this.busy = false;
        if (result.moves.length === 1) {
          const only = result.moves[0]!;
          this.after(420, () => this.onTokenPick(only.token));
        }
      } else {
        const move = chooseMove(game.state, result.moves, player.difficulty);
        this.after(BOT_THINK_MS, () => {
          if (!this.paused) void this.doMove(move.token);
        });
      }
      return;
    }

    // Auto-pass or a forfeited third six: the engine has already advanced.
    const note =
      result.outcome === 'six-forfeit' ? 'three sixes, turn lost' : 'no move';
    this.log(player.color, result.die, note);
    this.flash(
      result.outcome === 'six-forfeit'
        ? `${cap(player.color)} rolled a third six and forfeits the turn.`
        : `${cap(player.color)} has no legal move.`
    );
    this.busy = false;
    this.beginTurn();
  }

  private onTokenPick(token: Token): void {
    if (this.busy || !this.game) return;
    if (!this.game.current.isHuman) return;
    void this.doMove(token);
  }

  private async doMove(token: Token): Promise<void> {
    const game = this.game;
    if (!game) return;
    const move = game.moves.find(
      (m) => m.token.color === token.color && m.token.index === token.index
    );
    if (!move) return;
    this.busy = true;
    this.clearMovePicker();

    const result = game.play(move as Move);
    this.renderBoard([], false);
    this.playMoveSounds(
      result.captured.length > 0,
      Boolean(result.finishedPlayer)
    );

    if (this.humanColors.has(token.color) && result.captured.length > 0) {
      this.stats = {
        ...this.stats,
        tokensCaptured: this.stats.tokensCaptured + result.captured.length,
      };
      saveStats(this.stats);
    }
    if (result.captured.length > 0) {
      this.flash(
        `${cap(token.color)} captured ${result.captured
          .map((t) => cap(t.color))
          .join(', ')}!`
      );
    } else if (move.finishes) {
      this.flash(`${cap(token.color)} token ${token.index + 1} reached home.`);
    } else if (move.leavesBase) {
      this.flash(
        `${cap(token.color)} token ${token.index + 1} entered the board.`
      );
    }
    // Never persist a finished game: a save is only ever meant to resume a
    // game in progress, and clearing it here (rather than only in finish())
    // closes the window where a tab close mid-animation could leave a
    // gameover snapshot that later double-counts stats on resume.
    if (result.gameOver) clearSave();
    else writeSave(game.state);
    await delay(MOVE_ANIM_MS);

    if (result.gameOver) return this.finish();
    this.busy = false;
    this.beginTurn();
  }

  private playMoveSounds(captured: boolean, finished: boolean): void {
    if (finished) this.sound.play('home');
    else if (captured) this.sound.play('capture');
    else this.sound.play('move');
  }

  // ---- Rendering helpers --------------------------------------------------

  private renderBoard(moves: readonly Move[], interactive: boolean): void {
    if (!this.game) return;
    this.board.render(
      this.game.state,
      moves,
      interactive ? (t) => this.onTokenPick(t) : null
    );
  }

  private updatePanel(): void {
    const game = this.game;
    if (!game) return;
    const player = game.current;
    const turnText = player.isHuman
      ? player.name === 'You'
        ? 'Your turn'
        : `${player.name}'s turn`
      : this.paused
        ? `${player.name} waiting (paused)`
        : `${player.name} thinking…`;
    clear(this.turnLabel);
    this.turnLabel.append(
      h('span', {
        class: `dot dot-${player.color}`,
        'aria-hidden': 'true',
        title: cap(player.color),
      }),
      h('span', {}, `${turnText} · ${cap(player.color)}`)
    );
    this.die.show(game.state.die);
    this.announce(turnText);
  }

  private flash(text: string): void {
    this.messageEl.textContent = text;
    this.announce(text);
  }

  private announce(text: string): void {
    if (!this.statusLive) return;
    // Clear then set so identical consecutive messages are still announced.
    this.statusLive.textContent = '';
    window.setTimeout(() => {
      if (this.statusLive) this.statusLive.textContent = text;
    }, 30);
  }

  private renderMovePicker(moves: readonly Move[]): void {
    clear(this.movePicker);
    if (moves.length === 0) {
      this.movePicker.hidden = true;
      return;
    }
    this.movePicker.hidden = false;
    for (const move of moves) {
      const t = move.token;
      let label = `${cap(t.color)} token ${t.index + 1}`;
      if (move.leavesBase) label += ' onto the board';
      else if (move.finishes) label += ' home';
      if (move.captures.length > 0) {
        label += ` (capture ${move.captures.map(cap).join(', ')})`;
      }
      const btn = h(
        'button',
        { class: 'move-picker-btn', type: 'button' },
        label
      );
      btn.onclick = () => this.onTokenPick(t);
      this.movePicker.append(btn);
    }
  }

  private clearMovePicker(): void {
    if (!this.movePicker) return;
    clear(this.movePicker);
    this.movePicker.hidden = true;
  }

  private log(color: Color, value: number, note: string): void {
    this.rollLog.unshift({ n: this.rollLog.length + 1, color, value, note });
    this.renderLog();
  }

  private renderLog(): void {
    if (!this.logList) return;
    clear(this.logList);
    for (const entry of this.rollLog.slice(0, 40)) {
      this.logList.append(
        h(
          'li',
          {},
          h('span', { class: `dot dot-${entry.color}` }),
          h('b', {}, String(entry.value)),
          h('span', { class: 'log-note' }, entry.note)
        )
      );
    }
  }

  // ---- End of game --------------------------------------------------------

  private finish(): void {
    const game = this.game;
    if (!game) return;
    clearSave();
    this.sound.play('win');
    this.teardownFairness();

    const winner = game.state.ranking[0];
    const humanWon = winner ? this.humanColors.has(winner) : false;
    const streak = humanWon ? this.stats.currentStreak + 1 : 0;
    this.stats = {
      ...this.stats,
      gamesFinished: this.stats.gamesFinished + 1,
      humanWins: this.stats.humanWins + (humanWon ? 1 : 0),
      currentStreak: streak,
      bestStreak: Math.max(this.stats.bestStreak, streak),
    };
    saveStats(this.stats);

    const winnerName =
      game.state.players.find((p) => p.color === winner)?.name ??
      (winner ? cap(winner) : 'Someone');
    clear(this.root);
    const win = buildWin({
      ranking: game.state.ranking,
      players: game.state.players,
      humanColors: this.humanColors,
      onPlayAgain: () => this.showHome(),
    });
    win.id = 'main-content';
    this.root.append(
      skipLink(),
      h(
        'div',
        { class: 'sr-only', 'aria-live': 'assertive', 'aria-atomic': 'true' },
        humanWon ? 'You win!' : `${winnerName} wins.`
      ),
      win
    );
  }
}

function skipLink(): HTMLElement {
  return h(
    'a',
    { class: 'skip-link', href: '#main-content' },
    'Skip to content'
  );
}

function iconBtn(
  glyph: string,
  label: string,
  onClick: () => void
): HTMLElement {
  const btn = h(
    'button',
    { class: 'icon-btn', type: 'button', 'aria-label': label, title: label },
    glyph
  );
  btn.onclick = onClick;
  return btn;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
