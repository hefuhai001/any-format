import { escapeAttribute, escapeText } from '../escape.js';
import type { MarkdownToHtmlOptions } from './types.js';

/** Inline span renderer: code, images, links, emphasis, strikethrough. */
export function renderInline(text: string, options: MarkdownToHtmlOptions = {}): string {
  let output = options.escapeHtml ? escapeText(text) : text;

  output = output.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${escapeText(code)}</code>`);
  output = output.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt: string, src: string, title?: string) => {
      const titleAttr = title ? ` title="${escapeAttribute(title)}"` : '';
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${titleAttr}>`;
    },
  );
  output = output.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, label: string, href: string, title?: string) => {
      const titleAttr = title ? ` title="${escapeAttribute(title)}"` : '';
      return `<a href="${escapeAttribute(href)}"${titleAttr}>${label}</a>`;
    },
  );
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  output = output.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  output = output.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  output = output.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  output = output.replace(/ {2,}\n/g, '<br>\n');

  return output;
}
