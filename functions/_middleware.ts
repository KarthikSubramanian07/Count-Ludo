// Cloudflare Pages Function entry point. All the logic lives in
// src/site/edge.ts so it can be unit tested in Node; see that file.

import { handleRequest, type EdgeContext } from '../src/site/edge.ts';

export const onRequest = (ctx: EdgeContext): Promise<Response> =>
  handleRequest(ctx);
