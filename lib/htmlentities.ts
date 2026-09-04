/**
 * Decode a small, safe subset of HTML character references — the thing that
 * shows up in feed entry titles as a literal `&#8217;` / `&amp;` instead of
 * the actual character (issue #44).
 *
 * Feeds regularly double-encode typographic punctuation: a curly apostrophe
 * arrives in the XML as `&amp;#8217;`, so after one XML decode we hold the
 * 7-character string `&#8217;`. The <title> is rendered as plain React text
 * (unlike `content`, which goes through innerHTML and lets the browser decode
 * it), so React shows those seven characters verbatim. We decode:
 *
 *   - decimal numeric refs     `&#8217;`
 *   - hex numeric refs         `&#x2019;`
 *   - a fixed set of common named entities (typographic + the basics)
 *
 * Pure string in / string out — no DOM — so it is SSR-safe and behaves
 * identically during a `next build`, server render, and on the client.
 * References we do not recognise are left untouched.
 */
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  // Typographic punctuation the feeds actually use (the reported symptom).
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  trade: '\u2122',
  copy: '\u00a9',
  reg: '\u00ae',
  middot: '\u00b7',
  bull: '\u2022',
};

function fromCodePoint(code: string, hex: boolean): string {
  const trimmed = code.replace(/^0+/, '');
  const cp = trimmed === '' ? 0 : parseInt(trimmed, hex ? 16 : 10);
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return '';
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

/** Decode HTML character references in `input`. Empty/undefined → ''. */
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => fromCodePoint(code, true))
    .replace(/&#(\d+);/g, (_m, code: string) => fromCodePoint(code, false))
    .replace(/&([a-z][a-z0-9]*);/gi, (_m, name: string) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED, key)
        ? NAMED[key]
        : `&${name};`;
    });
}
