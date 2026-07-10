// The theme engine. A theme is pure data: a bag of CSS custom properties. The
// engine just writes those variables onto the document root and remembers the
// choice.
//
// This is one committed brand system, not a shelf of arbitrary palettes: a
// warm clay accent (hue 35) with every neutral tinted toward that same hue,
// shown in a light register and a dark one. Dark mode is not an inverted
// light mode: depth comes from a lighter-surface elevation scale, not
// shadows, and the accent desaturates slightly so it doesn't glow.
//
// Player colors (red/green/yellow/blue) are functional, not decorative: Ludo
// needs exactly four distinguishable pieces. They stay constant across both
// registers, tuned toward the same warm, muted family as the rest of the
// system instead of stock crayon-box primaries.

export interface Theme {
  id: string;
  label: string;
  /** Swatch shown in the picker. */
  swatch: string;
  vars: Record<string, string>;
}

const PIECES = {
  '--red': '#c14a3d',
  '--red-soft': '#e3aca3',
  '--green': '#3e8a5c',
  '--green-soft': '#a7cdb4',
  '--yellow': '#c99332',
  '--yellow-soft': '#e3c48c',
  '--blue': '#3d6e9e',
  '--blue-soft': '#a4c0d8',
};

export const THEMES: Theme[] = [
  {
    id: 'daylight',
    label: 'Daylight',
    swatch: '#faf9f7',
    vars: {
      ...PIECES,
      '--bg': '#fdfcfb',
      '--surface': '#f8f6f3',
      '--surface-2': '#f0ede7',
      '--text': '#2b2622',
      '--text-dim': '#6b6259',
      '--border': '#e2ddd4',
      '--accent': '#a6472e',
      '--on-accent': '#fdfcfb',
      '--accent-soft': '#f3e2da',
      '--board-bg': '#ece6dc',
      '--cell': '#fdfcfb',
      '--cell-line': '#ddd6c9',
      '--cell-safe': '#f1ebdf',
      '--shadow': '0 12px 32px rgba(60, 45, 30, 0.1)',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    swatch: '#1c1815',
    vars: {
      ...PIECES,
      '--red': '#d97662',
      '--green': '#5da97e',
      '--yellow': '#dcac52',
      '--blue': '#6d97c2',
      '--bg': '#191510',
      '--surface': '#211c16',
      '--surface-2': '#2a231c',
      '--text': '#f2ede6',
      '--text-dim': '#a89c8d',
      '--border': '#3a3129',
      '--accent': '#d97757',
      '--on-accent': '#191510',
      '--accent-soft': '#3a2a20',
      '--board-bg': '#241e17',
      '--cell': '#f2ede6',
      '--cell-line': '#d8cfc0',
      '--cell-safe': '#e7ded0',
      '--shadow': '0 16px 40px rgba(0, 0, 0, 0.5)',
    },
  },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

export function applyTheme(id: string): void {
  const theme = themeById(id);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = theme.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.vars['--bg'] ?? '#fdfcfb');
}
