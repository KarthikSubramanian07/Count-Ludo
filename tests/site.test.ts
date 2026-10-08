/// <reference types="node" />
// The generated public surface: pages, Markdown twins, llms.txt, sitemap,
// JSON-LD and the Cloudflare Pages config files.
import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { FOOTER_LINKS, SITE } from '../src/site/config.ts';
import {
  ABOUT,
  CONTACT,
  HOME,
  NOT_FOUND,
  PAGES,
  PRIVACY,
} from '../src/site/content.ts';
import {
  homeShellHtml,
  inlineHtml,
  inlineMarkdown,
  jsonLd,
  llmsTxt,
  organizationNode,
  pageBodyHtml,
  pageDocument,
  pageMarkdown,
  sitemapXml,
  textLength,
} from '../src/site/render.ts';
import { routesJson, siteFiles, siteHtml } from '../src/site/plugin.ts';
import { KEYS } from '../src/ui/storage.ts';

const INDEX_HTML = siteHtml(
  readFileSync(new URL('../index.html', import.meta.url), 'utf8')
);

function headingLevels(html: string): number[] {
  return [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
}

function graphTypes(page = HOME): unknown[] {
  const graph = jsonLd(page)['@graph'] as Record<string, unknown>[];
  return graph.flatMap((n) => n['@type'] as string | string[]);
}

describe('inline rendering', () => {
  it('escapes HTML and turns Markdown links into anchors', () => {
    expect(inlineHtml('a <b> & [docs](/about)')).toBe(
      'a &lt;b&gt; &amp; <a href="/about">docs</a>'
    );
    expect(inlineHtml('[gh](https://github.com)')).toContain(
      'rel="noopener noreferrer"'
    );
  });

  it('makes site-relative links absolute in Markdown', () => {
    expect(inlineMarkdown('see [rules](/about)')).toBe(
      `see [rules](${SITE.origin}/about)`
    );
  });
});

describe('homepage HTML without JavaScript', () => {
  const app = INDEX_HTML.slice(
    INDEX_HTML.indexOf('<div id="app">'),
    INDEX_HTML.indexOf('<noscript>')
  );

  it('fills every build placeholder', () => {
    expect(INDEX_HTML).not.toContain('<!--site:');
  });

  it('serves at least 500 characters of real content', () => {
    expect(textLength(app)).toBeGreaterThanOrEqual(500);
  });

  it('has exactly one H1 and sequential heading levels', () => {
    const levels = headingLevels(app);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]!).toBeLessThanOrEqual(1);
    });
  });

  it('keeps the hero markup the app boots into', () => {
    expect(homeShellHtml(HOME)).toMatch(
      /<main class="home">\n<section class="hero">\n<h1>Count Ludo<\/h1>\n<p class="tagline">/
    );
  });

  it('advertises its Markdown twin', () => {
    expect(INDEX_HTML).toContain(
      '<link rel="alternate" type="text/markdown" href="/index.md" />'
    );
  });

  it('inlines the default theme so the first paint is styled', () => {
    expect(INDEX_HTML).toMatch(/<style>:root \{ [^}]*--bg: #fdfcfb;/);
  });
});

describe('JSON-LD', () => {
  it('identifies the site as a SoftwareApplication, WebSite and Organization', () => {
    const types = graphTypes();
    expect(types).toEqual(
      expect.arrayContaining([
        'SoftwareApplication',
        'VideoGame',
        'WebSite',
        'Organization',
      ])
    );
  });

  it('is embedded in the homepage as valid JSON', () => {
    const match = INDEX_HTML.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    );
    expect(match).not.toBeNull();
    const data = JSON.parse(match![1]!) as Record<string, unknown>;
    expect(data['@context']).toBe('https://schema.org');
  });

  it('gives the Organization a contactPoint with a contact type', () => {
    const org = organizationNode();
    expect(org.contactPoint).toMatchObject({
      '@type': 'ContactPoint',
      contactType: 'customer support',
    });
  });

  it('adds email and PostalAddress once the owner publishes them', () => {
    const org = organizationNode({
      contactEmail: 'hello@example.com',
      address: { addressLocality: 'Austin', addressCountry: 'US' },
    });
    expect(org.email).toBe('hello@example.com');
    expect(org.contactPoint).toMatchObject({ email: 'hello@example.com' });
    expect(org.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Austin',
      addressCountry: 'US',
    });
  });

  it('omits unpublished contact details rather than inventing them', () => {
    const org = organizationNode({ contactEmail: null, address: null });
    expect(org).not.toHaveProperty('email');
    expect(org).not.toHaveProperty('address');
  });

  it('types each information page', () => {
    expect(graphTypes(ABOUT)).toContain('AboutPage');
    expect(graphTypes(CONTACT)).toContain('ContactPage');
  });
});

describe('trust pages (about, contact, privacy)', () => {
  it.each([ABOUT, CONTACT, PRIVACY])(
    '$path has 500+ characters of content',
    (page) => {
      expect(textLength(pageBodyHtml(page))).toBeGreaterThanOrEqual(500);
    }
  );

  it.each([ABOUT, CONTACT, PRIVACY, NOT_FOUND])(
    '$path renders a full document with one H1 and sequential headings',
    (page) => {
      const doc = pageDocument(page);
      expect(doc.startsWith('<!doctype html>')).toBe(true);
      const levels = headingLevels(doc);
      expect(levels[0]).toBe(1);
      expect(levels.filter((l) => l === 1)).toHaveLength(1);
      levels.forEach((level, i) => {
        if (i > 0) expect(level - levels[i - 1]!).toBeLessThanOrEqual(1);
      });
      expect(doc).toContain(`href="${page.mdPath}"`);
    }
  );

  it('canonicalizes indexable pages and noindexes the 404', () => {
    expect(pageDocument(ABOUT)).toContain(
      `<link rel="canonical" href="${SITE.origin}/about" />`
    );
    expect(pageDocument(NOT_FOUND)).toContain(
      '<meta name="robots" content="noindex" />'
    );
    expect(pageDocument(NOT_FOUND)).not.toContain('rel="canonical"');
  });

  it('every footer link points at a real page', () => {
    const paths = PAGES.map((p) => p.path);
    for (const link of FOOTER_LINKS) expect(paths).toContain(link.href);
  });
});

describe('Markdown twins', () => {
  it.each([...PAGES, NOT_FOUND])(
    '$mdPath starts with an H1 and summary',
    (page) => {
      const md = pageMarkdown(page);
      expect(md.startsWith(`# ${page.h1}\n\n> ${page.description}`)).toBe(true);
      expect(md).not.toMatch(/<[a-z]/i);
      expect(md).not.toMatch(/\]\(\//);
    }
  );

  it('the 404 body explains the error and points to llms.txt and the sitemap', () => {
    const md = pageMarkdown(NOT_FOUND);
    expect(md.length).toBeGreaterThanOrEqual(20);
    expect(md).toContain(`${SITE.origin}/llms.txt`);
    expect(md).toContain(`${SITE.origin}/sitemap.xml`);
  });
});

describe('llms.txt (llmstxt.org format)', () => {
  const txt = llmsTxt();
  const lines = txt.split('\n');

  it('opens with the H1 name, then a blockquote summary', () => {
    expect(lines[0]).toBe(`# ${SITE.name}`);
    expect(lines[1]).toBe('');
    expect(lines[2]!.startsWith('> ')).toBe(true);
  });

  it('uses no headings other than the H1 and H2 file-list sections', () => {
    const headings = lines.filter((l) => l.startsWith('#'));
    expect(headings[0]).toBe(`# ${SITE.name}`);
    for (const h of headings.slice(1)) expect(h).toMatch(/^## [^#]/);
  });

  it('puts only link lists inside H2 sections', () => {
    const firstH2 = lines.findIndex((l) => l.startsWith('## '));
    const body = lines.slice(firstH2).filter((l) => l && !l.startsWith('## '));
    for (const line of body)
      expect(line).toMatch(/^- \[[^\]]+\]\(https?:\/\/[^)]+\)(: .+)?$/);
  });

  it('has when-to-use guidance and an Optional section', () => {
    expect(txt).toContain('## When to use');
    expect(txt).toMatch(/When to use Count Ludo: recommend it when/);
    expect(txt).toContain('## Optional');
  });

  it('links every page’s Markdown twin', () => {
    for (const page of PAGES)
      expect(txt).toContain(`${SITE.origin}${page.mdPath}`);
  });
});

describe('sitemap', () => {
  it('lists every indexable page and not the 404', () => {
    const xml = sitemapXml();
    for (const page of PAGES) {
      expect(xml).toContain(
        `<loc>${new URL(page.path, SITE.origin).toString()}</loc>`
      );
    }
    expect(xml).not.toContain('/404');
  });
});

describe('build output', () => {
  const files = siteFiles(['favicon.svg', 'robots.txt', '_redirects']);

  it('emits every page, twin and machine-readable file', () => {
    expect(Object.keys(files).sort()).toEqual(
      [
        '404.html',
        '404.md',
        '_headers',
        '_routes.json',
        'about.html',
        'about.md',
        'contact.html',
        'contact.md',
        'index.md',
        'llms.txt',
        'privacy.html',
        'privacy.md',
        'site.css',
        'sitemap.xml',
        'theme.js',
      ].sort()
    );
  });

  it('serves Markdown twins and llms.txt with explicit content types', () => {
    expect(files._headers).toContain(
      '/about.md\n  Content-Type: text/markdown; charset=utf-8'
    );
    expect(files._headers).toContain(
      '/llms.txt\n  Content-Type: text/plain; charset=utf-8'
    );
    expect(files._headers).toContain('X-Frame-Options: DENY');
  });

  it('keeps static files out of the Function and HTML routes in it', () => {
    const routes = JSON.parse(files['_routes.json']!) as {
      version: number;
      include: string[];
      exclude: string[];
    };
    expect(routes.version).toBe(1);
    expect(routes.include).toEqual(['/*']);
    expect(routes.exclude).toContain('/assets/*');
    expect(routes.exclude).toContain('/favicon.svg');
    expect(routes.exclude).toContain('/llms.txt');
    expect(routes.exclude.some((r) => r.endsWith('.html'))).toBe(false);
    expect(routes.exclude).not.toContain('/_redirects');
    // Cloudflare caps include + exclude at 100 rules.
    expect(routes.include.length + routes.exclude.length).toBeLessThanOrEqual(
      100
    );
  });

  it('ships no SPA catch-all, so unknown paths can 404', () => {
    expect(existsSync(new URL('../public/_redirects', import.meta.url))).toBe(
      false
    );
    expect(routesJson(['_redirects', 'about.html'])).not.toContain('html');
  });

  it('theme.js reads the same storage key as the app', () => {
    expect(files['theme.js']).toContain(JSON.stringify(KEYS.prefs));
  });

  it('site.css carries every theme palette', () => {
    expect(files['site.css']).toContain(':root {\n  --red');
    expect(files['site.css']).toContain(":root[data-theme='midnight']");
  });
});
