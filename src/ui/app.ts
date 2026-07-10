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
  private rollBtn!: HTMLButtonElement;
  private logList!: HTMLElement;
  private fairnessPanel!: HTMLElement;

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
    clear(this.root);
    const hasSave = Boolean(loadSave());
    this.root.append(
      buildHome({
        prefs: this.prefs,
        stats: this.stats,
        themes: THEMES,
        hasSave,
        onThemeChange: (id) => this.setTheme(id),
        onStart: (setup) => this.startGame(setup),
        onResume: () => this.resumeGame(),
      })
    );
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
    clear(this.root);

    this.turnLabel = h('div', { class: 'turn-label' });
    this.messageEl = h('div', { class: 'message', 'aria-live': 'polite' });
    this.rollBtn = h(
      'button',
      { class: 'btn btn-roll', type: 'button' },
      'Roll'
    ) as HTMLButtonElement;
    this.rollBtn.onclick = () => this.onRollClick();
    this.logList = h('ol', { class: 'log-list' });
    this.fairnessPanel = h(
      'aside',
      { class: 'fairness', hidden: true },
      h('h2', {}, 'Roll log'),
      h(
        'p',
        { class: 'fairness-note' },
        'Every roll uses your browser’s cryptographic randomness, ',
        'the same source used for encryption keys. No streaks are nudged, ',
        'no rolls are saved for later. What you see is what you got.'
      ),
      this.logList
    );

    const header = h(
      'header',
      { class: 'game-header' },
      iconBtn('←', 'Back to menu', () => this.confirmLeave()),
      h('div', { class: 'brand-mini' }, 'Count Ludo'),
      h(
        'div',
        { class: 'header-tools' },
        iconBtn('⚖', 'Fairness and roll log', () => this.toggleFairness()),
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
      this.messageEl
    );

    this.root.append(
      h(
        'div',
        { class: 'game-screen' },
        header,
        h('div', { class: 'board-wrap' }, this.board.el),
        panel,
        this.fairnessPanel
      )
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

  private toggleFairness(): void {
    this.fairnessPanel.hidden = !this.fairnessPanel.hidden;
  }

  private confirmLeave(): void {
    // The game is saved continuously, so leaving is safe and resumable. Bump
    // the generation and clear `busy` so a bot timer scheduled by the game
    // we're leaving can never act on whatever we do next.
    this.generation++;
    this.busy = false;
    this.game = null;
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

    if (!human) {
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
    if (!game || this.busy) return;
    this.busy = true;
    this.rollBtn.disabled = true;

    const player = game.current;
    const result = game.roll();
    this.sound.play('roll');
    await this.die.animateRoll(result.die);
    writeSave(game.state);

    if (result.outcome === 'awaiting-move') {
      this.log(player.color, result.die, 'to move');
      if (player.isHuman) {
        this.renderBoard(result.moves, true);
        this.busy = false;
        if (result.moves.length === 1) {
          const only = result.moves[0]!;
          this.after(420, () => this.onTokenPick(only.token));
        }
      } else {
        const move = chooseMove(game.state, result.moves, player.difficulty);
        this.after(BOT_THINK_MS, () => void this.doMove(move.token));
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
    clear(this.turnLabel);
    this.turnLabel.append(
      h('span', { class: `dot dot-${player.color}` }),
      h(
        'span',
        {},
        player.isHuman
          ? player.name === 'You'
            ? 'Your turn'
            : `${player.name}'s turn`
          : `${player.name} thinking…`
      )
    );
    this.die.show(game.state.die);
  }

  private flash(text: string): void {
    this.messageEl.textContent = text;
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

    clear(this.root);
    this.root.append(
      buildWin({
        ranking: game.state.ranking,
        players: game.state.players,
        humanColors: this.humanColors,
        onPlayAgain: () => this.showHome(),
      })
    );
  }
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
