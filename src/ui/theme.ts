// The theme engine. A theme is pure data: a bag of CSS custom properties. To
// add one, drop another entry in THEMES and it shows up in the picker. The
// engine just writes those variables onto the document root and remembers the
// choice.
//
// Player colors (red/green/yellow/blue) stay recognizably themselves across
// themes; what changes is the room they play in.

export interface Theme {
  id: string;
  label: string;
  /** Swatch shown in the picker. */
  swatch: string;
  vars: Record<string, string>;
}

const PLAYER_COLORS = {
  '--red': '#e5484d',
  '--red-soft': '#f4a6a8',
  '--green': '#30a46c',
  '--green-soft': '#9fdcbd',
  '--yellow': '#f5b301',
  '--yellow-soft': '#f7d97a',
  '--blue': '#3e63dd',
  '--blue-soft': '#a3b4f0',
};

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    swatch: '#12131a',
    vars: {
      ...PLAYER_COLORS,
      '--bg': '#0d0e14',
      '--surface': '#161821',
      '--surface-2': '#1e2130',
      '--text': '#eef0f6',
      '--text-dim': '#9aa0b4',
      '--accent': '#6d8cff',
      '--border': '#2a2e3f',
      '--board-bg': '#1a1d29',
      '--cell': '#f3f4f8',
      '--cell-line': '#d7dae6',
      '--cell-safe': '#e7e9f2',
      '--shadow': '0 10px 40px rgba(0,0,0,0.45)',
    },
  },
  {
    id: 'daylight',
    label: 'Daylight',
    swatch: '#f4f1ea',
    vars: {
      ...PLAYER_COLORS,
      '--bg': '#f4f1ea',
      '--surface': '#ffffff',
      '--surface-2': '#f3f0e7',
      '--text': '#20242e',
      '--text-dim': '#6b7180',
      '--accent': '#3e63dd',
      '--border': '#e3ded2',
      '--board-bg': '#efe9dc',
      '--cell': '#ffffff',
      '--cell-line': '#e0dccf',
      '--cell-safe': '#f0ece0',
      '--shadow': '0 12px 40px rgba(60,50,30,0.14)',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    swatch: '#2a1730',
    vars: {
      ...PLAYER_COLORS,
      '--red': '#ff5c72',
      '--yellow': '#ffb648',
      '--bg': '#1c1024',
      '--surface': '#291733',
      '--surface-2': '#361f43',
      '--text': '#fbeef6',
      '--text-dim': '#c39ec0',
      '--accent': '#ff8fab',
      '--border': '#432a52',
      '--board-bg': '#2a1836',
      '--cell': '#fdf3f8',
      '--cell-line': '#eccfe0',
      '--cell-safe': '#f6e4ef',
      '--shadow': '0 12px 44px rgba(20,5,25,0.5)',
    },
  },
  {
    id: 'mint',
    label: 'Mint',
    swatch: '#0f3b34',
    vars: {
      ...PLAYER_COLORS,
      '--blue': '#2f81c9',
      '--bg': '#0c1f1c',
      '--surface': '#12302a',
      '--surface-2': '#173d35',
      '--text': '#eafaf3',
      '--text-dim': '#8fc4b4',
      '--accent': '#4fd1a5',
      '--border': '#1f4a41',
      '--board-bg': '#123029',
      '--cell': '#f2fbf7',
      '--cell-line': '#cfe9df',
      '--cell-safe': '#e3f5ec',
      '--shadow': '0 12px 44px rgba(0,20,15,0.45)',
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
  if (meta) meta.setAttribute('content', theme.vars['--bg'] ?? '#0d0e14');
}
