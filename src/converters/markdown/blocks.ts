import { escapeAttribute, escapeText } from '../escape.js';
import { renderInline } from './inline.js';
import type { MarkdownToHtmlOptions } from './types.js';

const BLOCK_START = [
  /^(#{1,6})\s+/,
  /^\s*(```|~~~)/,
  /^\s*>/,
  /^\s*([-*+]|\d+\.)\s+/,
  /^\s*([-*_])(\s*\1){2,}\s*$/,
];

export function isBlockStart(line: string): boolean {
  return BLOCK_START.some((pattern) => pattern.test(line));
}

/** Block-level renderer for the block constructs supported by this library. */
export function renderBlocks(lines: string[], options: MarkdownToHtmlOptions = {}): string {
  const out: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const fence = /^\s*(```|~~~)(.*)$/.exec(line);
    if (fence) {
      const rendered = renderCodeFence(lines, index, fence[1]!, fence[2]!.trim());
      out.push(rendered.html);
      index = rendered.next;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      out.push(`<h${level}>${renderInline(heading[2]!.trim(), options)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index]!)) {
        quote.push(lines[index]!.replace(/^\s*>\s?/, ''));
        index += 1;
      }
      out.push(`<blockquote>\n${renderBlocks(quote, options)}\n</blockquote>`);
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const rendered = renderList(lines, index, options);
      out.push(rendered.html);
      index = rendered.next;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index]!.trim() !== '' && !isBlockStart(lines[index]!)) {
      paragraph.push(lines[index]!);
      index += 1;
    }
    out.push(`<p>${renderInline(paragraph.join('\n'), options)}</p>`);
  }

  return out.join('\n');
}

function renderCodeFence(lines: string[], start: number, marker: string, lang: string): { html: string; next: number } {
  const code: string[] = [];
  let index = start + 1;

  while (index < lines.length && !new RegExp(`^\\s*${marker}\\s*$`).test(lines[index]!)) {
    code.push(lines[index]!);
    index += 1;
  }
  index += 1; // skip the closing fence

  const className = lang ? ` class="language-${escapeAttribute(lang)}"` : '';
  return { html: `<pre><code${className}>${escapeText(code.join('\n'))}\n</code></pre>`, next: index };
}

function renderList(lines: string[], start: number, options: MarkdownToHtmlOptions): { html: string; next: number } {
  const first = /^(\s*)([-*+]|\d+\.)\s+/.exec(lines[start]!)!;
  const baseIndent = first[1]!.length;
  const ordered = /\d/.test(first[2]!);
  const tag = ordered ? 'ol' : 'ul';
  const items: string[] = [];
  let index = start;

  while (index < lines.length) {
    const match = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[index]!);
    if (!match || match[1]!.length !== baseIndent) break;

    const content: string[] = [match[3]!];
    index += 1;

    // Indented continuation lines (and nested blocks) belong to this item.
    while (index < lines.length) {
      const line = lines[index]!;
      if (line.trim() === '') break;
      const indent = line.length - line.trimStart().length;
      if (indent <= baseIndent) break;
      content.push(line.slice(Math.min(indent, baseIndent + 2)));
      index += 1;
    }

    const nested = content.slice(1).join('\n');
    const head = renderInline(content[0]!, options);
    const body = nested.trim() ? `\n${renderBlocks(nested.split('\n'), options)}` : '';
    items.push(`<li>${head}${body}</li>`);

    // Skip blank lines between sibling items.
    while (index < lines.length && lines[index]!.trim() === '') {
      const lookahead = lines.slice(index + 1).findIndex((entry) => entry.trim() !== '');
      if (lookahead === -1) break;
      const candidate = lines[index + 1 + lookahead]!;
      if (!/^(\s*)([-*+]|\d+\.)\s+/.test(candidate) || candidate.length - candidate.trimStart().length !== baseIndent) break;
      index += 1;
    }
  }

  return { html: `<${tag}>\n${items.join('\n')}\n</${tag}>`, next: index };
}
