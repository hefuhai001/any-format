import { convertBlocks, normalizeBlocks } from './blocks.js';
import { DEFAULT_BULLET, type HtmlToMarkdownOptions } from './types.js';
import type { Converter } from '../../core/types.js';

export type { HtmlToMarkdownOptions } from './types.js';
export { renderInlineMarkdown } from './inline.js';
export { convertBlocks, normalizeBlocks } from './blocks.js';

/**
 * Structural HTML → Markdown serializer. Handles headings, paragraphs, lists,
 * blockquotes, `<pre>`/`<code>`, tables, links, images and basic inline emphasis.
 */
export const htmlToMarkdown: Converter<HtmlToMarkdownOptions> = {
  from: 'html',
  to: 'markdown',
  name: 'builtin:html->markdown',
  convert(input, options = {}) {
    const bullet = options.bullet ?? DEFAULT_BULLET;
    const source = String(input)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

    return normalizeBlocks(convertBlocks(source, bullet, options));
  },
};
