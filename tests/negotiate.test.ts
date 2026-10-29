import { describe, it, expect } from 'vitest';
import { negotiate, parseAccept } from '../src/site/negotiate.ts';

describe('parseAccept', () => {
  it('reads media ranges and q-values', () => {
    expect(parseAccept('text/html, text/markdown;q=0.5, */*;q=0.1')).toEqual([
      { type: 'text', subtype: 'html', q: 1 },
      { type: 'text', subtype: 'markdown', q: 0.5 },
      { type: '*', subtype: '*', q: 0.1 },
    ]);
  });

  it('clamps q to [0, 1] and ignores malformed ranges', () => {
    expect(parseAccept('text/markdown;q=7, nonsense, text/html;q=-1')).toEqual([
      { type: 'text', subtype: 'markdown', q: 1 },
      { type: 'text', subtype: 'html', q: 0 },
    ]);
  });
});

describe('negotiate', () => {
  it.each([
    [null, 'html'],
    ['', 'html'],
    ['*/*', 'html'],
    ['text/html', 'html'],
    // A real browser Accept header.
    [
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'html',
    ],
    ['text/markdown', 'markdown'],
    ['text/markdown, text/html;q=0.9', 'markdown'],
    ['text/html, text/markdown;q=0.5', 'html'],
    ['text/markdown;q=0.4, text/*;q=0.8', 'html'],
    ['text/*', 'html'],
    // Tie: an explicit text/markdown mention wins over a wildcard match.
    ['text/markdown, */*', 'markdown'],
    ['text/markdown, text/html', 'markdown'],
    ['text/html;q=0, */*', 'markdown'],
  ] as const)('Accept %j -> %s', (accept, expected) => {
    expect(negotiate(accept)).toBe(expected);
  });

  it.each([
    'application/json',
    'image/png',
    'text/html;q=0, text/markdown;q=0',
  ])('returns null (406) when neither type is acceptable: %s', (accept) => {
    expect(negotiate(accept)).toBeNull();
  });
});
