import { escapeText } from './markdown-to-html.js';
import type { Converter } from '../core/types.js';

export interface TextToHtmlOptions {
  /** Wrap the output in a full HTML document. Default `false`. */
  document?: boolean;
  /** Wrap each blank-line separated block in `<p>` (default) or use `<br>` only. */
  paragraphs?: boolean;
  /** Document title used when `document` is `true`. */
  title?: string;
}

/** Turn plain text into HTML, escaping every character of markup. */
export const textToHtml: Converter<TextToHtmlOptions> = {
  from: 'text',
  to: 'html',
  name: 'builtin:text->html',
  convert(input, options = {}) {
    const source = String(input).replace(/\r\n?/g, '\n');
    const paragraphs = options.paragraphs ?? true;

    const body = paragraphs
      ? source
          .split(/\n{2,}/)
          .map((block) => block.trim())
          .filter((block) => block.length > 0)
          .map((block) => `<p>${escapeText(block).replace(/\n/g, '<br>\n')}</p>`)
          .join('\n')
      : escapeText(source).replace(/\n/g, '<br>\n');

    if (!options.document) return body;

    const title = escapeText(options.title ?? 'Document');
    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${title}</title>`,
      '</head>',
      '<body>',
      body,
      '</body>',
      '</html>',
    ].join('\n');
  },
};
