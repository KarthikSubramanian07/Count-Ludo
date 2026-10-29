// The Pages Function middleware, driven with fake `next` and ASSETS so every
// branch runs in Node exactly as it would at the edge.
import { describe, it, expect } from 'vitest';
import { handleRequest, type EdgeContext } from '../src/site/edge.ts';
import { onRequest as functionOnRequest } from '../functions/_middleware.ts';

const ORIGIN = 'https://count-ludo.pages.dev';

const ASSET_FILES: Record<string, string> = {
  '/index.md': '# Count Ludo\n\nHome in Markdown.\n',
  '/about.md': '# About Count Ludo\n',
  '/404.md': '# Page not found\n\nSee https://count-ludo.pages.dev/llms.txt\n',
};

function ctx(
  path: string,
  accept: string | null,
  opts: {
    method?: string;
    staticStatus?: number;
    assets?: typeof ASSET_FILES;
  } = {}
): EdgeContext & { nextCalls: number } {
  const headers = new Headers();
  if (accept !== null) headers.set('Accept', accept);
  const assets = opts.assets ?? ASSET_FILES;
  const state = {
    nextCalls: 0,
    request: new Request(ORIGIN + path, {
      method: opts.method ?? 'GET',
      headers,
    }),
    next: async () => {
      state.nextCalls++;
      const status = opts.staticStatus ?? 200;
      return new Response(
        status === 404 ? '<h1>Page not found</h1>' : '<!doctype html>',
        {
          status,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    },
    env: {
      ASSETS: {
        fetch: async (input: Request | string) => {
          const url = new URL(typeof input === 'string' ? input : input.url);
          const body = assets[url.pathname];
          return body === undefined
            ? new Response('missing', { status: 404 })
            : new Response(body, { status: 200 });
        },
      },
    },
  };
  return state;
}

describe('Markdown content negotiation on page routes', () => {
  it('serves Markdown for Accept: text/markdown with Vary: Accept', async () => {
    const res = await handleRequest(ctx('/', 'text/markdown'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'text/markdown; charset=utf-8'
    );
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(await res.text()).toBe(ASSET_FILES['/index.md']);
  });

  it('keeps serving HTML to browsers, adding Vary: Accept', async () => {
    const c = ctx('/', 'text/html,application/xhtml+xml,*/*;q=0.8');
    const res = await handleRequest(c);
    expect(c.nextCalls).toBe(1);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(res.headers.get('Vary')).toBe('Accept');
  });

  it('negotiates every information page, not just the home page', async () => {
    const res = await handleRequest(ctx('/about', 'text/markdown'));
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
    expect(await res.text()).toContain('# About Count Ludo');
  });

  it('honors q-values', async () => {
    const res = await handleRequest(ctx('/', 'text/html, text/markdown;q=0.5'));
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  it('answers 406 when neither representation is acceptable', async () => {
    const res = await handleRequest(ctx('/', 'application/json'));
    expect(res.status).toBe(406);
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(await res.text()).toMatch(/text\/html or text\/markdown/);
  });

  it('sends headers but no body for HEAD', async () => {
    const res = await handleRequest(
      ctx('/', 'text/markdown', { method: 'HEAD' })
    );
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
    expect(await res.text()).toBe('');
  });

  it('falls back to HTML if the Markdown twin is somehow missing', async () => {
    const res = await handleRequest(ctx('/', 'text/markdown', { assets: {} }));
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });
});

describe('unknown paths', () => {
  it('return a real 404 with a Markdown body for agents', async () => {
    const res = await handleRequest(
      ctx('/some-path-that-does-not-exist', 'text/markdown', {
        staticStatus: 404,
      })
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe(
      'text/markdown; charset=utf-8'
    );
    const body = await res.text();
    expect(body.length).toBeGreaterThanOrEqual(20);
    expect(body).toContain('llms.txt');
  });

  it('return the static HTML 404 for browsers', async () => {
    const res = await handleRequest(
      ctx('/nope', 'text/html', { staticStatus: 404 })
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(res.headers.get('Vary')).toBe('Accept');
  });
});

describe('pass-through', () => {
  it('leaves other successful responses alone but adds security headers', async () => {
    const res = await handleRequest(ctx('/about.html', 'text/markdown'));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'"
    );
  });

  it('does not negotiate non-GET requests', async () => {
    const c = ctx('/', 'text/markdown', { method: 'POST' });
    const res = await handleRequest(c);
    expect(c.nextCalls).toBe(1);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  it('merges Vary with an existing value instead of replacing it', async () => {
    const c = ctx('/', 'text/html');
    c.next = async () =>
      new Response('<!doctype html>', { headers: { Vary: 'Accept-Encoding' } });
    const res = await handleRequest(c);
    expect(res.headers.get('Vary')).toBe('Accept-Encoding, Accept');
  });

  it('is what the Pages Function entry point exports', async () => {
    const res = await functionOnRequest(ctx('/', 'text/markdown'));
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
  });
});
