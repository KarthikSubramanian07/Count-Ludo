# Security

Count Ludo is a static, client-only game. There is no server, no database,
no authentication, and no user data collected anywhere, so the realistic
attack surface is small: mainly the frontend code itself and its build
tooling.

## Reporting a vulnerability

If you find a security issue, please open a
[GitHub issue](https://github.com/KarthikSubramanian07/Count-Ludo/issues) or,
for anything sensitive, use GitHub's
[private vulnerability reporting](https://github.com/KarthikSubramanian07/Count-Ludo/security/advisories/new)
so it isn't public before a fix ships. Include what you found and, if
possible, how to reproduce it. There's no bug bounty here, just a genuine
thank-you and a fast fix.

## What's in scope

- XSS, CSP bypasses, or anything that lets a page load or execute
  attacker-controlled content.
- Supply-chain issues in the shipped bundle (the code that actually reaches
  a player's browser).
- Anything that would let one player's local data or actions affect another
  player's browser (there's no shared state today, but flag it if you find a
  path to one).

## What's out of scope

- Vulnerabilities in devDependencies that never ship to the browser (build
  tooling, test runners, the deploy CLI). These are tracked via Dependabot
  and fixed on a normal cadence, not a security-incident one, unless you can
  show a path from them to the shipped game.
- Denial of service against the static hosting itself (that's Cloudflare's
  problem, not this repo's).

## How dependencies are kept current

- Dependabot is enabled for version updates and security alerts.
- CodeQL runs on every push to `main` and weekly.
- `npm audit` is checked before every release; see the README for the full
  `npm run check` gate that has to pass before anything ships.
