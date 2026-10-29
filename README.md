<div align="center">

# Count Ludo

**Ludo, online and clean. Roll, race, win. No ads, no downloads, no signup.**

[Play now](https://count-ludo.pages.dev) · [Report a bug](https://github.com/KarthikSubramanian07/Count-Ludo/issues) · [How the dice work](#is-the-dice-really-fair) · [Buy me a coffee](https://buymeacoffee.com/winnerkarthik)

</div>

---

Every other Ludo site on the web wants something from you. An install. An account. Your attention, sold to three ad networks before the board even loads. Count Ludo wants none of it. Open the page, pick your seats, roll. That is the whole pitch.

It runs entirely in your browser. There is no server, no database, no login, and nothing to download. Your stats live in your own browser and never leave it. It is free, and it is going to stay free, because there is nothing here that costs money to run.

## What you get

- **Play your way.** Two to four seats, each one a human or a bot. Take on the computer solo, or pass one phone around the table.
- **Bots that actually think.** Three difficulty levels, from a bot that wanders to one that hunts your tokens and plays the odds.
- **All the real rules.** Six to leave base, extra turns on a six (capped at three so nobody stalls), captures, safe squares, exact-count home entry, auto-pass when you are stuck. Optional blockades if you like it spicy.
- **Dice you can trust.** Every roll comes from your browser's cryptographic randomness, and there is a live roll log so you can watch the numbers fall. More on that below.
- **Light and dark, done properly.** One committed design system in two registers, not a shelf of arbitrary color swaps. Switch mid-game.
- **Plays offline.** Load it once and it works on a plane. Install it to your home screen if you want, on iOS and Android both.
- **Sound, or silence.** Your call, remembered.
- **Actually works on a phone.** Real touch targets, tested at iPhone and iPad sizes, not just resized in a desktop browser.
- **One link, shareable.** Hit Share on the home screen to send it to whoever you're about to beat.

## Is the dice really fair?

Yes, and you do not have to take my word for it.

"The dice are rigged" is the oldest complaint in online Ludo, so the die was the first thing built and the most tested. Rolls use [`crypto.getRandomValues`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), the same randomness source browsers use for encryption keys, with rejection sampling so there is not even the tiny modulo bias a naive `% 6` would introduce. No streak is nudged. No roll is saved up to hand you a six "later." There is no server that could tilt anything even if it wanted to.

Open the roll log in any game (the scales icon) and watch every value as it lands. The full distribution is also checked in the test suite across sixty thousand rolls.

## The board model

The interesting part of a Ludo engine is the geometry, so here is exactly how Count Ludo models it. This is documented in full in [`src/engine/board.ts`](src/engine/board.ts).

- The shared track is **52 cells**, indexed 0 to 51 clockwise.
- The four start cells sit 13 apart: **red 0, green 13, yellow 26, blue 39.**
- Each token walks a **personal path of 57 cells**: 51 shared track cells, then 5 private "home column" cells, then the center. That is **56 steps** from a token's start cell to home.
- A token turns off the shared track at **start + 50**, the one cell on a real board from which its private lane is reachable. Model and rendered board agree by construction, which is what keeps the home columns from ending up disconnected.
- Safe cells (no captures) are the four start cells plus four star cells: **{0, 8, 13, 21, 26, 34, 39, 47}.**
- Home entry is **exact-count only**. Overshoot the center and the move is illegal.

The engine is pure. Hand it a game state and a move, get a new state back. It never touches the DOM, the clock, or randomness it did not ask for, which is why the rules can be tested exhaustively and the "rigged" accusation can be answered honestly.

## Running it locally

You need [Node](https://nodejs.org) 22 or newer (Wrangler, the Cloudflare deploy CLI, requires it).

```bash
git clone https://github.com/KarthikSubramanian07/Count-Ludo.git
cd Count-Ludo
npm install

npm run dev        # start the dev server
npm run test       # run the engine test suite (watch mode)
npm run check      # typecheck + lint + tests + build, the whole gate
npm run build      # production build into dist/
```

## How it is built

No framework. No runtime dependencies. The whole thing ships as about **10 KB of gzipped JavaScript** plus a stylesheet, because a Ludo board does not need a megabyte of React.

```
src/
  engine/     pure game logic, zero DOM: board math, rules, turns, dice, AI
  ui/         SVG board, dice, screens, themes, sound, storage
  site/       public pages, Markdown twins, llms.txt, JSON-LD, edge handler
functions/    Cloudflare Pages Function: Markdown negotiation and real 404s
tests/        vitest suite for the engine, the site output and the edge handler
```

- **TypeScript + Vite** for the build.
- **SVG board** drawn from a 15x15 grid, so it stays crisp at any size.
- **Vitest** for the engine, run in CI on every push.
- **Cloudflare Pages** for hosting, which is where the "$0 to run" comes from.

## Readable by agents, not just people

A game page is mostly JavaScript, which tells an AI agent nothing. So every public page is authored once, as structured content in [`src/site/content.ts`](src/site/content.ts), and a small Vite plugin renders it at build time into:

- **HTML pages** for people: [/about](https://count-ludo.pages.dev/about), [/contact](https://count-ludo.pages.dev/contact), [/privacy](https://count-ludo.pages.dev/privacy), plus a real 404 page, all in the game's own type and palette.
- **A static first paint** on the home page, so the raw HTML carries real content before the app boots.
- **Markdown twins** at `/index.md`, `/about.md` and so on.
- **[`/llms.txt`](https://count-ludo.pages.dev/llms.txt)** in the [llmstxt.org](https://llmstxt.org) format, including when an agent should recommend Count Ludo (and when it should not).
- **The sitemap, JSON-LD** (Organization, WebSite, SoftwareApplication), `_headers` and `_routes.json`.

A tiny Pages Function ([`src/site/edge.ts`](src/site/edge.ts)) runs in front of the page routes only. It does [Markdown content negotiation](https://acceptmarkdown.com): ask for any page with `Accept: text/markdown` and you get Markdown with `Vary: Accept`, q-values honored, `406` if you accept neither format. Unknown paths return a real `404`, in Markdown if that is what you asked for. Static files never touch the Function.

```bash
curl -H 'Accept: text/markdown' https://count-ludo.pages.dev/
curl -i -H 'Accept: text/markdown' https://count-ludo.pages.dev/no-such-page
```

## Keeping it free

Count Ludo has no ads and never will, so there is no revenue to speak of and there does not need to be. If you'd still like to chip in toward hosting and the next feature, there is a [Buy Me a Coffee](https://buymeacoffee.com/winnerkarthik) link. Entirely optional. The game stays free either way.

## Contributing

Bug reports and pull requests are welcome. If you found a rules edge case that behaves wrong, an issue with a short description of the roll sequence is gold. Run `npm run check` before opening a PR and it should stay green.

## Security

No server, no database, no accounts, no user data. See [SECURITY.md](SECURITY.md) for what's in scope and how to report something privately if you find it.

## License

[MIT](LICENSE). Do what you like with it.

Ludo descends from the ancient Indian game of Pachisi and is firmly in the public domain. Count Ludo is an original, independent take: original board art, original code, no relation to any commercial Ludo product.
