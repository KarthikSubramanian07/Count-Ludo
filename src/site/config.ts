// Site identity: the facts every generated page, Markdown twin, llms.txt and
// JSON-LD block agree on. Change a value here and every machine-readable
// surface follows on the next build.

export const SITE = {
  name: 'Count Ludo',
  origin: 'https://count-ludo.pages.dev',
  tagline: 'Ludo, online and clean. Roll, race, win. No ads, no downloads.',
  description:
    'Play Ludo online free. Count Ludo is a clean, ad-free Ludo game for your browser: race friends locally or take on smart bots. No downloads, no signup.',
  author: 'Karthik Subramanian',
  repo: 'https://github.com/KarthikSubramanian07/Count-Ludo',
  issues: 'https://github.com/KarthikSubramanian07/Count-Ludo/issues',
  securityReport:
    'https://github.com/KarthikSubramanian07/Count-Ludo/security/advisories/new',
  coffee: 'https://buymeacoffee.com/winnerkarthik',
  license: 'https://opensource.org/license/mit',
  /**
   * Public support inbox for the Organization contactPoint. Left null until
   * the owner picks an address they are happy to publish; the contact page
   * and JSON-LD fall back to GitHub issues meanwhile.
   */
  contactEmail: null as string | null,
  /**
   * Postal address for the Organization JSON-LD. Count Ludo has no office,
   * so this stays null until the owner decides what (if anything) to list.
   */
  address: null as PostalAddress | null,
} as const;

export interface PostalAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry: string;
}

/** Security headers for every response. Written to _headers for static files and
 *  added by the edge handler to Function responses, which _headers skips. */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy':
    'geolocation=(), microphone=(), camera=(), interest-cohort=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
};

/** Links shown in the footer of every page, including the in-app home. */
export const FOOTER_LINKS = [
  { href: '/about', label: 'About & rules' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
] as const;

export function absolute(path: string): string {
  return new URL(path, SITE.origin).toString();
}
