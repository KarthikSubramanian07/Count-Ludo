// Sharing the game is just sharing a URL: there's no server-side game to link
// to, so "share" means "hand someone the same static page you're looking at".
// Native share sheet where the browser has one, clipboard everywhere else.

function gameUrl(): string {
  return new URL(location.pathname, location.origin).toString();
}

export interface ShareResult {
  outcome: 'shared' | 'copied' | 'cancelled' | 'unsupported';
}

export async function shareGame(): Promise<ShareResult> {
  const url = gameUrl();
  const payload = {
    title: 'Count Ludo',
    text: 'Play Ludo online free, no ads, no downloads, no signup.',
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(payload);
      return { outcome: 'shared' };
    } catch (err) {
      // AbortError: the user closed the share sheet without picking anything.
      if (err instanceof Error && err.name === 'AbortError') {
        return { outcome: 'cancelled' };
      }
      // Some browsers advertise navigator.share but reject it (e.g. no
      // secure context); fall through to the clipboard instead of failing.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return { outcome: 'copied' };
  }

  return { outcome: 'unsupported' };
}
