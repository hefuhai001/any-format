import type { Converter } from '../core/types.js';

export interface TextToMarkdownOptions {
  /** Escape characters that Markdown would otherwise interpret. Default `false`. */
  escape?: boolean;
}

/**
 * Plain text → Markdown. Line structure is preserved and paragraphs are
 * separated by a blank line, which makes `pdf -> text -> markdown` chains work.
 */
export const textToMarkdown: Converter<TextToMarkdownOptions> = {
  from: 'text',
  to: 'markdown',
  name: 'builtin:text->markdown',
  convert(input, options = {}) {
    let text = String(input).replace(/\r\n?/g, '\n').trim();
    if (options.escape) {
      text = text.replace(/([\\`*_[\]])/g, '\\$1').replace(/^(#{1,6}\s|>\s|[-*+]\s|\d+\.\s)/gm, '\\$1');
    }
    return `${text.replace(/\n{3,}/g, '\n\n')}\n`;
  },
};
