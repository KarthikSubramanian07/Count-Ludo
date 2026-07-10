// The front door. Set up a table (2 to 4 seats, each a human or a bot), pick a
// look, and start. This screen also carries the search-friendly landing copy,
// because a clean Ludo site that nobody can find is not much use.

import type { Color, Difficulty } from '../../engine/types.ts';
import type { Prefs, Stats } from '../storage.ts';
import type { Theme } from '../theme.ts';
import { h, clear, cap } from '../dom.ts';

export interface Seat {
  color: Color;
  isHuman: boolean;
  difficulty: Difficulty;
  name: string;
}

export interface SetupState {
  seats: Seat[];
  blocking: boolean;
}

export interface HomeContext {
  prefs: Prefs;
  stats: Stats;
  themes: Theme[];
  hasSave: boolean;
  onThemeChange: (id: string) => void;
  onStart: (setup: SetupState) => void;
  onResume: () => void;
}

const COLOR_ORDER: Record<number, Color[]> = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: ['red', 'green', 'yellow', 'blue'],
};

export function buildHome(ctx: HomeContext): HTMLElement {
  let count = 2;
  let blocking = ctx.prefs.blocking;
  let seats = defaultSeats(count);

  const seatList = h('div', { class: 'seat-list' });
  const renderSeats = () => {
    clear(seatList);
    seats.forEach((seat, i) =>
      seatList.append(seatRow(seat, i, () => renderSeats()))
    );
  };
  renderSeats();

  const countPicker = h(
    'div',
    { class: 'seg', role: 'group', 'aria-label': 'Number of players' },
    ...[2, 3, 4].map((n) => {
      const b = h(
        'button',
        { class: 'seg-btn' + (n === count ? ' active' : ''), type: 'button' },
        `${n} players`
      );
      b.onclick = () => {
        count = n;
        seats = defaultSeats(count);
        for (const el of countPicker.children) el.classList.remove('active');
        b.classList.add('active');
        renderSeats();
      };
      return b;
    })
  );

  const blockToggle = toggle('Blockades', blocking, (on) => (blocking = on));
  const blockHint = h(
    'p',
    { class: 'hint' },
    'Off by default: two of your tokens on one square seal it so opponents cannot pass. A spicier, longer game.'
  );

  const startBtn = h(
    'button',
    { class: 'btn btn-primary btn-lg', type: 'button' },
    'Start game'
  );
  startBtn.onclick = () =>
    ctx.onStart({ seats: normalizeNames(seats), blocking });

  const resumeBtn = h(
    'button',
    { class: 'btn btn-ghost btn-lg', type: 'button' },
    'Resume last game'
  );
  resumeBtn.onclick = () => ctx.onResume();

  return h(
    'main',
    { class: 'home' },
    h(
      'section',
      { class: 'hero' },
      h('h1', {}, 'Count Ludo'),
      h(
        'p',
        { class: 'tagline' },
        'Ludo, online and clean. Roll, race, win. No ads, no downloads.'
      ),
      h(
        'p',
        { class: 'lede' },
        'Play Ludo online free, right in your browser, against smart bots or friends ',
        'passing one device. No signup, no installs, no nagging. Just the classic ',
        'race to get all four tokens home, the way it should be.'
      )
    ),
    h(
      'section',
      { class: 'card setup' },
      h('h2', {}, 'New game'),
      countPicker,
      seatList,
      h('div', { class: 'setup-row' }, blockToggle),
      blockHint,
      h(
        'div',
        { class: 'theme-picker' },
        ...ctx.themes.map((t) => themeSwatch(t, ctx))
      ),
      h('div', { class: 'cta-row' }, startBtn, ctx.hasSave ? resumeBtn : null)
    ),
    statsStrip(ctx.stats),
    h(
      'footer',
      { class: 'home-footer' },
      h(
        'p',
        {},
        'Free forever. No ads, no accounts, no tracking. Your stats never leave this device.'
      ),
      h(
        'p',
        { class: 'muted' },
        'Ludo descends from the ancient game of Pachisi and is in the public domain. ',
        'Count Ludo is an original, open-source take on it.'
      ),
      h(
        'p',
        {},
        'Enjoying it? ',
        h(
          'a',
          {
            href: 'https://buymeacoffee.com/winnerkarthik',
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'coffee-link',
          },
          'Buy me a coffee'
        ),
        ', entirely optional, the game stays free either way.'
      )
    )
  );
}

function seatRow(seat: Seat, index: number, onChange: () => void): HTMLElement {
  const humanBtn = h(
    'button',
    { class: 'chip' + (seat.isHuman ? ' active' : ''), type: 'button' },
    'Human'
  );
  const botBtn = h(
    'button',
    { class: 'chip' + (!seat.isHuman ? ' active' : ''), type: 'button' },
    'Bot'
  );
  humanBtn.onclick = () => {
    seat.isHuman = true;
    onChange();
  };
  botBtn.onclick = () => {
    seat.isHuman = false;
    onChange();
  };

  const diff = h('select', {
    class: 'select',
    'aria-label': 'Bot difficulty',
  }) as HTMLSelectElement;
  for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
    const opt = h('option', { value: d }, cap(d)) as HTMLOptionElement;
    if (d === seat.difficulty) opt.selected = true;
    diff.append(opt);
  }
  diff.onchange = () => (seat.difficulty = diff.value as Difficulty);

  return h(
    'div',
    { class: 'seat' },
    h('span', { class: `dot dot-${seat.color}` }),
    h(
      'span',
      { class: 'seat-name' },
      seat.isHuman ? seatHumanName(index) : `${cap(seat.color)} bot`
    ),
    h(
      'div',
      { class: 'seat-controls' },
      humanBtn,
      botBtn,
      seat.isHuman ? null : diff
    )
  );
}

function themeSwatch(theme: Theme, ctx: HomeContext): HTMLElement {
  const btn = h('button', {
    class: 'swatch' + (theme.id === ctx.prefs.theme ? ' active' : ''),
    type: 'button',
    'aria-label': `Theme: ${theme.label}`,
    title: theme.label,
    style: `background:${theme.swatch}`,
  });
  btn.onclick = () => {
    ctx.prefs.theme = theme.id;
    ctx.onThemeChange(theme.id);
    for (const el of btn.parentElement?.children ?? [])
      el.classList.remove('active');
    btn.classList.add('active');
  };
  return btn;
}

function statsStrip(stats: Stats): HTMLElement {
  const rate =
    stats.gamesFinished > 0
      ? Math.round((stats.humanWins / stats.gamesFinished) * 100)
      : 0;
  return h(
    'section',
    { class: 'stats-strip' },
    stat('Games', stats.gamesPlayed),
    stat('Wins', stats.humanWins),
    stat('Win rate', `${rate}%`),
    stat('Best streak', stats.bestStreak)
  );
}

function stat(label: string, value: string | number): HTMLElement {
  return h(
    'div',
    { class: 'stat' },
    h('b', {}, String(value)),
    h('span', {}, label)
  );
}

function toggle(
  label: string,
  on: boolean,
  onChange: (on: boolean) => void
): HTMLElement {
  const input = h('input', {
    type: 'checkbox',
    class: 'toggle-input',
  }) as HTMLInputElement;
  input.checked = on;
  input.onchange = () => onChange(input.checked);
  return h(
    'label',
    { class: 'toggle' },
    input,
    h('span', { class: 'toggle-track' }),
    h('span', {}, label)
  );
}

function defaultSeats(count: number): Seat[] {
  return COLOR_ORDER[count]!.map((color, i) => ({
    color,
    isHuman: i === 0,
    difficulty: 'medium' as Difficulty,
    name: '',
  }));
}

function normalizeNames(seats: Seat[]): Seat[] {
  let humanN = 0;
  return seats.map((seat) => ({
    ...seat,
    name: seat.isHuman ? seatHumanName(humanN++) : `${cap(seat.color)} bot`,
  }));
}

function seatHumanName(humanIndex: number): string {
  return humanIndex === 0 ? 'You' : `Player ${humanIndex + 1}`;
}
