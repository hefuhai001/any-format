import { decodeEntities } from '../entities.js';
import { renderMarkdownTable } from '../table/markdown-table.js';
import { renderInlineMarkdown } from './inline.js';
import type { HtmlToMarkdownOptions } from './types.js';

const CODE_PLACEHOLDER = /\u0000CODE(\d+)\u0000/g;

/** Block-level HTML → markdown serializer. */
export function convertBlocks(html: string, bullet: string, options: HtmlToMarkdownOptions): string {
  const codeBlocks: string[] = [];
  let out = protectCodeBlocks(html, codeBlocks);

  out = out
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, content: string) => {
      const text = renderInlineMarkdown(content);
      if (options.headingStyle === 'setext' && (level === '1' || level === '2')) {
        return `\n\n${text}\n${(level === '1' ? '=' : '-').repeat(Math.max(3, text.length))}\n\n`;
      }
      return `\n\n${'#'.repeat(Number(level))} ${text}\n\n`;
    })
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, content: string) => {
      const inner = convertBlocks(content, bullet, options).trim();
      return `\n\n${inner
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n')}\n\n`;
    })
    .replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_m, content: string) => `\n\n${renderList(content, bullet, false, options)}\n\n`)
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_m, content: string) => `\n\n${renderList(content, bullet, true, options)}\n\n`)
    .replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, content: string) => `\n\n${renderTable(content)}\n\n`)
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<br\s*\/?>/gi, '  \n')
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_m, content: string) => `\n\n${renderInlineMarkdown(content)}\n\n`)
    .replace(/<\/?(div|section|article|header|footer|main|aside|nav)\b[^>]*>/gi, '\n\n');

  out = renderInlineMarkdown(out);
  return out.replace(CODE_PLACEHOLDER, (_m, index: string) => codeBlocks[Number(index)] ?? '');
}

/** Park `<pre>` blocks behind placeholders so inline rules cannot touch them. */
function protectCodeBlocks(html: string, store: string[]): string {
  const push = (code: string, lang?: string) => {
    store.push(`\`\`\`${lang ?? ''}\n${decodeEntities(code).replace(/\n$/, '')}\n\`\`\``);
    return `\u0000CODE${store.length - 1}\u0000`;
  };

  return html
    .replace(
      /<pre\b[^>]*>\s*<code\b[^>]*class=["'][^"']*language-([\w-]+)[^"']*["'][^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_m, lang: string, code: string) => push(code, lang),
    )
    .replace(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, code: string) => push(code))
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, code: string) => push(code.replace(/<[^>]+>/g, '')));
}

function renderList(html: string, bullet: string, ordered: boolean, options: HtmlToMarkdownOptions): string {
  const items: string[] = [];
  const itemRe = /<li\b[^>]*>([\s\S]*?)(?=<li\b|<\/li>|$)/gi;
  let match: RegExpExecArray | null;
  let index = 1;

  while ((match = itemRe.exec(html))) {
    let content = match[1]!.replace(/<\/li>/gi, '').trim();
    if (!content) continue;

    const nested = /<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>/i.exec(content);
    let nestedText = '';
    if (nested) {
      nestedText = convertBlocks(nested[0], bullet, options).trim();
      content = content.replace(nested[0], '').trim();
    }

    const marker = ordered ? `${index}.` : bullet;
    index += 1;

    const lines = renderInlineMarkdown(content).split('\n');
    const head = `${marker} ${lines[0] ?? ''}`.trimEnd();
    const tail = lines.slice(1).map((line) => (line.trim() ? `   ${line}` : ''));
    const body = nestedText
      ? `\n${nestedText
          .split('\n')
          .map((line) => `   ${line}`)
          .join('\n')}`
      : '';
    items.push([head, ...tail].filter(Boolean).join('\n') + body);
  }

  return items.join('\n');
}

function renderTable(html: string): string {
  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(html))) {
    const cells: string[] = [];
    const cellRe = /<t([hd])\b[^>]*>([\s\S]*?)<\/t\1>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]!))) {
      cells.push(renderInlineMarkdown(cellMatch[2]!));
    }
    if (cells.length > 0) rows.push(cells);
  }

  return renderMarkdownTable(rows);
}

export function normalizeBlocks(markdown: string): string {
  return `${markdown.replace(/[ \t]+\n{2,}/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
