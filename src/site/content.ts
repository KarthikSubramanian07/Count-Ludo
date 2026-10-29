// The words. Every public page is authored once here as structured data and
// rendered twice at build time: HTML for people, Markdown for agents. Inline
// links use Markdown syntax, [text](url), in both renderings.

import { SITE } from './config.ts';

export type Block = { p: string } | { ul: string[] } | { ol: string[] };

export interface Section {
  heading: string;
  id?: string;
  blocks: Block[];
  subsections?: Section[];
}

export interface Page {
  /** Clean public URL path, e.g. `/about`. */
  path: string;
  /** Where the Markdown twin lives, e.g. `/about.md`. */
  mdPath: string;
  /** Static HTML file emitted for the page; null for the app shell. */
  htmlFile: string | null;
  title: string;
  description: string;
  h1: string;
  /** schema.org WebPage subtype for the page's JSON-LD. */
  schemaType: 'WebPage' | 'AboutPage' | 'ContactPage';
  intro: Block[];
  sections: Section[];
  /** Kept out of the sitemap and search indexes (the 404 page). */
  noindex?: boolean;
}

const HOW_TO_PLAY: Block[] = [
  {
    ol: [
      'Pick 2, 3 or 4 seats on the home screen and make each one a human or a bot (easy, medium or hard).',
      'Roll the die. You need a 6 to move a token out of base onto your start square.',
      'Move one token forward by the number rolled. Land on an opponent outside a safe square to capture it and send it back to base.',
      'Rolling a 6 earns another roll, up to three in a row, so nobody can stall the table.',
      'Each token walks 56 steps from its start square, around the 52-cell track and up its private home column. Home entry needs the exact count.',
      'The first player to bring all four tokens home wins.',
    ],
  },
];

export const HOME: Page = {
  path: '/',
  mdPath: '/index.md',
  htmlFile: null,
  title: 'Count Ludo - Play Ludo Online Free, No Ads',
  description: SITE.description,
  h1: 'Count Ludo',
  schemaType: 'WebPage',
  intro: [
    { p: SITE.tagline },
    {
      p: 'Play Ludo online free, right in your browser, against smart bots or friends passing one device. No signup, no installs, no nagging. Just the classic race to get all four tokens home, the way it should be.',
    },
  ],
  sections: [
    {
      heading: 'Play Ludo online, free and ad-free',
      blocks: [
        {
          ul: [
            'Two to four seats, each one a human or a bot, so you can play solo against the computer or pass one phone around the table.',
            'Three bot levels, from one that wanders to one that hunts your tokens and plays the odds.',
            'All the real rules: six to leave base, extra turns on a six, captures, safe squares, exact-count home entry, and optional blockades.',
            'Fair dice from your browser’s cryptographic randomness, with a live roll log you can audit.',
            'Works offline once loaded and installs to your home screen on iOS and Android.',
          ],
        },
      ],
    },
    { heading: 'How to play Ludo', blocks: HOW_TO_PLAY },
    {
      heading: 'Free, private, open source',
      blocks: [
        {
          p: `Count Ludo runs entirely on your device. There is no account, no tracking and no server keeping score; your stats stay in your own browser. The code is [open source on GitHub](${SITE.repo}) under the MIT license. Read [about the game](/about), the [privacy notice](/privacy), or how to [get in touch](/contact).`,
        },
      ],
    },
  ],
};

export const ABOUT: Page = {
  path: '/about',
  mdPath: '/about.md',
  htmlFile: 'about.html',
  title: 'About Count Ludo - Rules, Fair Dice and How It Works',
  description:
    'What Count Ludo is, the full Ludo rules it plays by, how its dice stay provably fair, and who builds it.',
  h1: 'About Count Ludo',
  schemaType: 'AboutPage',
  intro: [
    {
      p: 'Count Ludo is a free, ad-free Ludo game that runs in any modern web browser. Open the page, pick your seats, roll. There is no install, no account and nothing to download, and it keeps working offline once it has loaded.',
    },
    {
      p: 'Every other Ludo site seems to want something from you: an app install, a login, or your attention sold to ad networks before the board even loads. Count Ludo wants none of it. It is built and maintained by an independent developer, Karthik Subramanian, as an open-source project.',
    },
  ],
  sections: [
    {
      heading: 'What you can do',
      blocks: [
        {
          ul: [
            'Play 2 to 4 players, mixing humans and bots in any combination.',
            'Choose easy, medium or hard bots per seat.',
            'Turn on blockades: two of your tokens on one square seal it so opponents cannot pass.',
            'Resume an unfinished game later; it is saved in your browser automatically.',
            'Switch between the light Daylight theme and the dark Midnight theme at any time.',
            'Track games played, wins, streaks and captures, stored only on your device.',
          ],
        },
      ],
    },
    {
      heading: 'The rules',
      id: 'how-to-play',
      blocks: HOW_TO_PLAY,
      subsections: [
        {
          heading: 'Safe squares',
          blocks: [
            {
              p: 'The four start squares and four star squares are safe: a token standing on one cannot be captured. On the 52-cell track these are cells 0, 8, 13, 21, 26, 34, 39 and 47.',
            },
          ],
        },
        {
          heading: 'Getting stuck',
          blocks: [
            {
              p: 'If no token can legally move with the number you rolled, your turn passes automatically, so the game never waits on an impossible move.',
            },
          ],
        },
      ],
    },
    {
      heading: 'Are the dice fair?',
      blocks: [
        {
          p: 'Yes. Every roll comes from crypto.getRandomValues, the same randomness source browsers use for encryption keys, with rejection sampling so there is not even the tiny bias a naive modulo would add. No streak is nudged and no six is saved for later. There is no server that could tilt anything. Open the roll log during a game to watch every value land; the test suite also checks the distribution across sixty thousand rolls.',
        },
      ],
    },
    {
      heading: 'How it is built',
      blocks: [
        {
          p: `Count Ludo is written in TypeScript with no framework and no runtime dependencies, about 10 KB of gzipped JavaScript. The board is SVG drawn from a 15 by 15 grid. The game engine is pure and fully unit tested. The site is hosted as static files on Cloudflare Pages. The [source code is on GitHub](${SITE.repo}) under the MIT license.`,
        },
        {
          p: 'Ludo descends from the ancient Indian game of Pachisi and is in the public domain. Count Ludo is an original, independent take with original board art and code, and no relation to any commercial Ludo product.',
        },
      ],
    },
  ],
};

export const CONTACT: Page = {
  path: '/contact',
  mdPath: '/contact.md',
  htmlFile: 'contact.html',
  title: 'Contact Count Ludo - Bug Reports, Feedback and Security',
  description:
    'How to reach the Count Ludo maintainer: report a bug, suggest a feature, or disclose a security issue privately.',
  h1: 'Contact',
  schemaType: 'ContactPage',
  intro: [
    {
      p: 'Count Ludo is maintained by Karthik Subramanian, an independent developer. There is no company, call centre or sales team behind it, just one person who reads every report. The fastest way to reach the project is through GitHub, where every conversation is public and searchable so the next player with the same question finds the answer too.',
    },
  ],
  sections: [
    {
      heading: 'Report a bug or suggest a feature',
      blocks: [
        {
          p: `Open an issue on the [Count Ludo issue tracker](${SITE.issues}). For a rules bug, a short description of the roll sequence that triggered it is the most useful thing you can include, along with your browser and device.`,
        },
      ],
    },
    {
      heading: 'Report a security issue',
      blocks: [
        {
          p: `Please do not file security problems as public issues. Use GitHub’s [private vulnerability reporting](${SITE.securityReport}) instead so the fix can ship before the details are public. The [security policy](${SITE.repo}/blob/main/SECURITY.md) explains what is in scope.`,
        },
      ],
    },
    {
      heading: 'Support the project',
      blocks: [
        {
          p: `Count Ludo has no ads and never will. If you would like to chip in toward the next feature, there is an entirely optional [Buy Me a Coffee page](${SITE.coffee}). The game stays free either way.`,
        },
      ],
    },
  ],
};

export const PRIVACY: Page = {
  path: '/privacy',
  mdPath: '/privacy.md',
  htmlFile: 'privacy.html',
  title: 'Privacy - Count Ludo',
  description:
    'Count Ludo collects no personal data: no accounts, no cookies, no analytics, no ads. Your settings and stats stay in your own browser.',
  h1: 'Privacy',
  schemaType: 'WebPage',
  intro: [
    {
      p: 'Short version: Count Ludo does not collect, sell or share any personal data. There are no accounts, no cookies, no analytics scripts, no advertising and no third-party trackers. The game runs entirely in your browser.',
    },
  ],
  sections: [
    {
      heading: 'What is stored on your device',
      blocks: [
        {
          p: 'To remember your preferences between visits, Count Ludo writes three small entries to your browser’s local storage. They never leave your device and you can clear them at any time through your browser’s site data settings.',
        },
        {
          ul: [
            'Preferences: your theme, sound setting and blockade choice.',
            'Stats: games played and finished, wins, streaks and captures.',
            'Saved game: the board position of an unfinished game, so you can resume it.',
          ],
        },
        {
          p: 'The site also installs a service worker that caches the game files so it loads quickly and works offline. That cache only contains Count Ludo’s own code and images.',
        },
      ],
    },
    {
      heading: 'Hosting',
      blocks: [
        {
          p: 'The site is served by Cloudflare Pages. Like any web host, Cloudflare processes basic request information such as your IP address to deliver pages and protect against abuse, under the [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/). Count Ludo does not receive or store that information and has no analytics enabled.',
        },
      ],
    },
    {
      heading: 'External links',
      blocks: [
        {
          p: 'Links to GitHub and Buy Me a Coffee take you to those services, which have their own privacy policies. Nothing is loaded from them until you click.',
        },
      ],
    },
    {
      heading: 'Children',
      blocks: [
        {
          p: 'Because Count Ludo collects no personal information from anyone, it collects none from children either. It is suitable for players of all ages.',
        },
      ],
    },
    {
      heading: 'Questions and changes',
      blocks: [
        {
          p: 'If this policy changes, the update will be published on this page and in the project’s public history on GitHub. Questions are welcome through the [contact page](/contact).',
        },
      ],
    },
  ],
};

export const NOT_FOUND: Page = {
  path: '/404',
  mdPath: '/404.md',
  htmlFile: '404.html',
  title: 'Page not found - Count Ludo',
  description: 'This page does not exist on Count Ludo.',
  h1: 'Page not found',
  schemaType: 'WebPage',
  noindex: true,
  intro: [
    {
      p: 'There is nothing at this address. Count Ludo is a single browser game plus a few information pages, so the page you were after has probably moved or never existed.',
    },
  ],
  sections: [
    {
      heading: 'Where to go next',
      blocks: [
        {
          ul: [
            '[Play Count Ludo](/) on the home page.',
            '[About and rules](/about) explains how the game works.',
            '[Sitemap](/sitemap.xml) lists every public page.',
            '[llms.txt](/llms.txt) is the guide for AI agents and tools.',
          ],
        },
      ],
    },
  ],
};

/** Every page that is publicly indexed, in sitemap order. */
export const PAGES: Page[] = [HOME, ABOUT, CONTACT, PRIVACY];
