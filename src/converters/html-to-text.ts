import type { Converter } from '../core/types.js';

export interface HtmlToTextOptions {
  /** Preserve newlines implied by `<br>` and block boundaries. Default `true`. */
  preserveLineBreaks?: boolean;
  /** Collapse runs of whitespace. Default `true`. */
  collapseWhitespace?: boolean;
}

const BLOCK_TAGS = 'p|div|section|article|header|footer|main|aside|nav|h[1-6]|ul|ol|li|blockquote|pre|table|tr|hr|br';

/**
 * Strip markup and produce readable plain text. Block-level elements become
 * blank-line separated paragraphs, `<li>` becomes a bullet, `<pre>` is preserved.
 */
export const htmlToText: Converter<HtmlToTextOptions> = {
  from: 'html',
  to: 'text',
  name: 'builtin:html->text',
  convert(input, options = {}) {
    const preserveLineBreaks = options.preserveLineBreaks ?? true;
    const collapseWhitespace = options.collapseWhitespace ?? true;

    let html = String(input)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

    html = html
      .replace(/<h([1-6])\b[^>]*>/gi, (_m, level: string) => `\n\n${'#'.repeat(Number(level))} `)
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<\/li>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n---\n')
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
        const text = label.replace(/<[^>]+>/g, '').trim();
        return text && text !== href ? `[${text}](${href})` : href;
      })
      .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_m, alt: string) => (alt ? `[${alt}]` : ''))
      .replace(new RegExp(`<(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n\n')
      .replace(new RegExp(`</(?:${BLOCK_TAGS})>`, 'gi'), '\n\n')
      .replace(/<[^>]+>/g, '');

    html = decodeEntities(html);

    if (collapseWhitespace) {
      html = html.replace(/[ \t\f\v]+/g, ' ').replace(/ *\n */g, '\n');
      // Keep list items visually grouped.
      html = html.replace(/\n{2,}(?=- )/g, '\n');
    }

    if (preserveLineBreaks) {
      html = html.replace(/\n{3,}/g, '\n\n').trim();
    } else {
      html = html.replace(/\s+/g, ' ').trim();
    }

    return html;
  },
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
