// The request handler behind functions/_middleware.ts. Cloudflare Pages serves
// the static files; this sits in front of the page routes to do two things a
// static host can't: serve Markdown to clients that ask for it (with Vary:
// Accept), and give unknown paths a real 404 (in Markdown when asked).
//
// Kept framework-free and dependency-free so it runs unchanged in the Workers
// runtime and in Node for the tests.

import { negotiate } from './negotiate.ts';
import { NOT_FOUND, PAGES } from './content.ts';
import { SECURITY_HEADERS } from './config.ts';

export const MARKDOWN_TYPE = 'text/markdown; charset=utf-8';

/** Clean page path to its Markdown twin. */
export const MARKDOWN_ROUTES: Record<string, string> = Object.fromEntries(
  PAGES.map((p) => [p.path, p.mdPath])
);

export interface EdgeContext {
  request: Request;
  next: () => Promise<Response>;
  env: { ASSETS: { fetch: (input: Request | string) => Promise<Response> } };
}

function withHeaders(res: Response, extra: Record<string, string>): Response {
  const out = new Response(res.body, res);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(key)) out.headers.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (key === 'Vary') {
      const current = out.headers.get('Vary');
      const parts = current ? current.split(',').map((s) => s.trim()) : [];
      if (!parts.some((p) => p.toLowerCase() === 'accept')) parts.push(value);
      out.headers.set('Vary', parts.join(', '));
    } else {
      out.headers.set(key, value);
    }
  }
  return out;
}

async function markdown(
  ctx: EdgeContext,
  mdPath: string,
  status: number
): Promise<Response | null> {
  const asset = await ctx.env.ASSETS.fetch(
    new URL(mdPath, ctx.request.url).toString()
  );
  if (!asset.ok) return null;
  const body = ctx.request.method === 'HEAD' ? null : await asset.text();
  return withHeaders(new Response(body, { status }), {
    'Content-Type': MARKDOWN_TYPE,
    'Cache-Control': 'public, max-age=0, must-revalidate',
    Vary: 'Accept',
  });
}

export async function handleRequest(ctx: EdgeContext): Promise<Response> {
  const { request } = ctx;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return withHeaders(await ctx.next(), {});
  }

  const path = new URL(request.url).pathname;
  const choice = negotiate(request.headers.get('Accept'));
  const mdPath = MARKDOWN_ROUTES[path];

  if (mdPath) {
    if (choice === null) {
      const body =
        'Not Acceptable. This page is available as text/html or text/markdown.\n';
      return withHeaders(
        new Response(request.method === 'HEAD' ? null : body, { status: 406 }),
        { 'Content-Type': 'text/plain; charset=utf-8', Vary: 'Accept' }
      );
    }
    if (choice === 'markdown') {
      const res = await markdown(ctx, mdPath, 200);
      if (res) return res;
    }
    return withHeaders(await ctx.next(), { Vary: 'Accept' });
  }

  const res = await ctx.next();
  if (res.status === 404) {
    if (choice === 'markdown') {
      const md = await markdown(ctx, NOT_FOUND.mdPath, 404);
      if (md) return md;
    }
    return withHeaders(res, { Vary: 'Accept' });
  }
  return withHeaders(res, {});
}
