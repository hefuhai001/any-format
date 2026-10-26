import type { Converter } from '../core/types.js';

export interface MarkdownToHtmlOptions {
  /** Wrap the output in a full `<!doctype html>` document. Default `false`. */
  document?: boolean;
  /** Escape raw HTML found in the source. Default `false`. */
  escapeHtml?: boolean;
}

/**
 * Minimal CommonMark-ish renderer covering the constructs needed by docs pipelines:
 * ATX headings, fenced/indented code, blockquotes, ordered/unordered lists (nested),
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

function renderBlocks(lines: string[], options: MarkdownToHtmlOptions): string {
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
      const marker = fence[1]!;
      const lang = fence[2]!.trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^\\s*${marker}\\s*$`).test(lines[index]!)) {
        code.push(lines[index]!);
        index += 1;
      }
      index += 1; // skip closing fence
      const className = lang ? ` class="language-${escapeAttribute(lang)}"` : '';
      out.push(`<pre><code${className}>${escapeText(code.join('\n'))}\n</code></pre>`);
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
      const listResult = renderList(lines, index, options);
      out.push(listResult.html);
      index = listResult.next;
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

function isBlockStart(line: string): boolean {
  return (
    /^(#{1,6})\s+/.test(line) ||
    /^\s*(```|~~~)/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*([-*+]|\d+\.)\s+/.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)
  );
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

    // Continuation lines and nested blocks belong to the current item.
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

    // Skip blank lines between items.
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

function renderInline(text: string, options: MarkdownToHtmlOptions): string {
  let output = options.escapeHtml ? escapeText(text) : text;

  output = output.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${escapeText(code)}</code>`);
  output = output.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, alt: string, src: string, title?: string) => {
    const titleAttr = title ? ` title="${escapeAttribute(title)}"` : '';
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${titleAttr}>`;
  });
  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, label: string, href: string, title?: string) => {
    const titleAttr = title ? ` title="${escapeAttribute(title)}"` : '';
    return `<a href="${escapeAttribute(href)}"${titleAttr}>${label}</a>`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  output = output.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  output = output.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  output = output.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  output = output.replace(/ {2,}\n/g, '<br>\n');

  return output;
}

export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
