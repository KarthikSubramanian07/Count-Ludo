// Proactive content negotiation (RFC 9110 §12.5.1) between the two
// representations every page has: HTML for browsers, Markdown for agents.

export type Representation = 'html' | 'markdown';

export const MEDIA_TYPES: Record<Representation, string> = {
  html: 'text/html',
  markdown: 'text/markdown',
};

interface MediaRange {
  type: string;
  subtype: string;
  q: number;
}

export function parseAccept(header: string): MediaRange[] {
  const ranges: MediaRange[] = [];
  for (const part of header.split(',')) {
    const [range, ...params] = part.split(';').map((s) => s.trim());
    if (!range) continue;
    const [type, subtype] = range.toLowerCase().split('/');
    if (!type || !subtype) continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.split('=').map((s) => s.trim());
      if (key?.toLowerCase() === 'q' && value !== undefined) {
        const parsed = Number(value);
        q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 1;
      }
    }
    ranges.push({ type, subtype, q });
  }
  return ranges;
}

/**
 * Quality the client assigns to a media type: the q of the most specific
 * matching range (exact beats type/* beats *\/*), and whether that match was
 * an exact, explicit mention.
 */
function quality(
  ranges: MediaRange[],
  mediaType: string
): { q: number; explicit: boolean } {
  const [type, subtype] = mediaType.split('/');
  let best = { specificity: 0, q: 0 };
  for (const r of ranges) {
    let specificity = 0;
    if (r.type === type && r.subtype === subtype) specificity = 3;
    else if (r.type === type && r.subtype === '*') specificity = 2;
    else if (r.type === '*' && r.subtype === '*') specificity = 1;
    if (specificity > best.specificity) best = { specificity, q: r.q };
  }
  return { q: best.q, explicit: best.specificity === 3 };
}

/**
 * Pick the representation to serve, or null when the client accepts neither
 * (the caller answers 406 Not Acceptable). A missing or empty Accept header
 * means "anything", which gets HTML. On a tie, an explicit text/markdown
 * mention wins: browsers never ask for Markdown, so a client that names it
 * wants it.
 */
export function negotiate(accept: string | null): Representation | null {
  if (!accept || !accept.trim()) return 'html';
  const ranges = parseAccept(accept);
  if (ranges.length === 0) return 'html';
  const html = quality(ranges, MEDIA_TYPES.html);
  const md = quality(ranges, MEDIA_TYPES.markdown);
  if (html.q === 0 && md.q === 0) return null;
  if (md.q > html.q) return 'markdown';
  if (html.q > md.q) return 'html';
  return md.explicit ? 'markdown' : 'html';
}
