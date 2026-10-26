import { renderBlocks } from './blocks.js';
import type { MarkdownToHtmlOptions } from './types.js';
import type { Converter } from '../../core/types.js';

export type { MarkdownToHtmlOptions } from './types.js';
export { renderInline } from './inline.js';
export { isBlockStart, renderBlocks } from './blocks.js';

/**
 * Minimal CommonMark-ish renderer covering the constructs needed by docs pipelines:
 * ATX headings, fenced code, blockquotes, ordered/unordered lists (nested),
 * thematic breaks, paragraphs, plus inline code, bold, italic, links and images.
 *
 * It intentionally stays dependency-free; swap in `marked`/`remark` via
 * `registerConverter()` when full spec compliance is required.
 */
export const markdownToHtml: Converter<MarkdownToHtmlOptions> = {
  from: 'markdown',
  to: 'html',
  name: 'builtin:markdown->html',
  convert(input, options = {}) {
    const source = String(input).replace(/\r\n?/g, '\n');
    const body = renderBlocks(source.split('\n'), options);
    if (!options.document) return body;

    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Document</title>',
      '</head>',
      '<body>',
      body,
      '</body>',
      '</html>',
    ].join('\n');
  },
};
