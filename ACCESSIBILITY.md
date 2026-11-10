# Accessibility

Count Ludo targets **WCAG 2.2 Level AA**.

## How it is tested

- Automated: axe-core with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` at 1440×900, 390×844 and 320×800 on home (including theme and in-game states), about, contact, privacy and a not-found path.
- Manual: keyboard play (roll, pause, legal-move buttons and focusable tokens), skip link, focus order, fairness dialog (Escape, focus restore), live-region turn and outcome announcements, reduced-motion styles, and colour-independent seat/token labels.

## Known limitations

- The SVG board is a spatial surface. Movable tokens are keyboard-focusable with names, and a text “Legal moves” group mirrors every choice, but a continuous spoken description of every empty cell is not provided.
- Capture and safe-square cues on the board remain visual; the live region and move labels name captures and colour in text.

## Reporting a barrier

Open a GitHub issue or use the contact page. Security-sensitive reports belong in private vulnerability reporting (see `SECURITY.md`).
