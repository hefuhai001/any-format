import { decodeEntities } from '../entities.js';
import { renderMarkdownTable } from '../table/markdown-table.js';
import { renderInlineMarkdown } from './inline.js';
import type { HtmlToMarkdownOptions } from './types.js';

const CODE_PLACEHOLDER = /\u0000CODE(\d+)\u0000/g;

/** Block-level HTML → markdown serializer. */
export function convertBlocks(html: string, bullet: string, options: HtmlToMarkdownOptions): string {
  const codeBlocks: string[] = [];
  let out = protectCodeBlocks(html, codeBlocks);

  // Lists first: nesting is resolved by balance-scanning the tags, which a
  // non-greedy regex cannot do.
  out = replaceBalanced(out, 'ul', (content) => `\n\n${renderList(content, bullet, false, options)}\n\n`);
  out = replaceBalanced(out, 'ol', (content) => `\n\n${renderList(content, bullet, true, options)}\n\n`);

  out = out
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, content: string) => {
      const text = renderInlineMarkdown(content);
      if (options.headingStyle === 'setext' && (level === '1' || level === '2')) {
        return `\n\n${text}\n${(level === '1' ? '=' : '-').repeat(Math.max(3, text.length))}\n\n`;
      }
      return `\n\n${'#'.repeat(Number(level))} ${text}\n\n`;
    })
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, content: string) => {
      const inner = convertBlocks(content, bullet, options).replace(/\n{3,}/g, '\n\n').trim();
      const quoted: string[] = [];
      for (const line of inner.split('\n')) {
        if (line.trim()) quoted.push(`> ${line}`);
        // Collapse consecutive blank lines into a single quote separator.
        else if (quoted.at(-1) !== '>') quoted.push('>');
      }
      return `\n\n${quoted.join('\n')}\n\n`;
    })
    .replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, content: string) => `\n\n${renderTable(content)}\n\n`)
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_m, content: string) => `\n\n${renderInlineMarkdown(content)}\n\n`)
    .replace(/<\/?(div|section|article|header|footer|main|aside|nav)\b[^>]*>/gi, '\n\n');

  // Strip whatever markup is left (bare text nodes, unknown tags), keeping the
  // `<br>` markers emitted by table cells.
  out = decodeEntities(out.replace(/<(?!\/?br\b)[^>]+>/gi, ''));
  return out.replace(CODE_PLACEHOLDER, (_m, index: string) => codeBlocks[Number(index)] ?? '');
}

/** Replace every outermost `<tag>...</tag>` block, keeping nested blocks intact. */
export function replaceBalanced(html: string, tag: 'ul' | 'ol', replacer: (content: string) => string): string {
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');

  let result = '';
  let cursor = 0;
  let open: RegExpExecArray | null;

  while ((open = openRe.exec(html))) {
    if (open.index < cursor) continue;

    const contentStart = openRe.lastIndex;
    tagRe.lastIndex = contentStart;

    let depth = 1;
    let close: RegExpExecArray | null = null;
    let tagMatch: RegExpExecArray | null;

    while ((tagMatch = tagRe.exec(html))) {
      depth += tagMatch[1] ? -1 : 1;
      if (depth === 0) {
        close = tagMatch;
        break;
      }
    }

    const contentEnd = close ? close.index : html.length;
    const blockEnd = close ? tagRe.lastIndex : html.length;

    result += html.slice(cursor, open.index) + replacer(html.slice(contentStart, contentEnd));
    cursor = blockEnd;
    openRe.lastIndex = blockEnd;
  }

  return result + html.slice(cursor);
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

/**
 * Extract `<li>` contents while respecting nesting: an item ends at its own
 * closing tag, not at the first nested `<li>`.
 */
export function extractListItems(html: string): string[] {
  const items: string[] = [];
  const openRe = /<li\b[^>]*>/gi;
  const tagRe = /<\/?li\b[^>]*>/gi;
  let open: RegExpExecArray | null;

  while ((open = openRe.exec(html))) {
    const contentStart = openRe.lastIndex;
    tagRe.lastIndex = contentStart;

    let depth = 1;
    let closed = false;
    let tag: RegExpExecArray | null;

    while ((tag = tagRe.exec(html))) {
      depth += tag[0].startsWith('</') ? -1 : 1;
      if (depth === 0) {
        items.push(html.slice(contentStart, tag.index));
        openRe.lastIndex = tagRe.lastIndex;
        closed = true;
        break;
      }
    }

    if (!closed) {
      // Malformed list: stop at the next sibling item or the end of the block.
      const next = html.slice(contentStart).search(/<li\b/i);
      items.push(next === -1 ? html.slice(contentStart) : html.slice(contentStart, contentStart + next));
      openRe.lastIndex = html.length;
    }
  }

  return items;
}

function renderList(html: string, bullet: string, ordered: boolean, options: HtmlToMarkdownOptions): string {
  const items: string[] = [];
  let index = 1;

  for (const raw of extractListItems(html)) {
    let content = raw.trim();
    if (!content) continue;

    let nestedText = '';
    for (const nestedTag of ['ul', 'ol'] as const) {
      if (!new RegExp(`<${nestedTag}\\b`, 'i').test(content)) continue;
      content = replaceBalanced(content, nestedTag, (inner) => {
        // Re-wrap so the recursive pass sees a complete list element.
        const block = `<${nestedTag}>${inner}</${nestedTag}>`;
        nestedText += `\n${convertBlocks(block, bullet, options).trim()}`;
        return '';
      });
    }

    const marker = ordered ? `${index}.` : bullet;
    index += 1;

    const lines = renderInlineMarkdown(content).split('\n');
    const head = `${marker} ${lines[0] ?? ''}`.trimEnd();
    const tail = lines.slice(1).map((line) => (line.trim() ? `   ${line}` : ''));
    const nested = nestedText.trim()
      ? `\n${nestedText
          .trim()
          .split('\n')
          .map((line) => `   ${line}`)
          .join('\n')}`
      : '';
    items.push([head, ...tail].filter(Boolean).join('\n') + nested);
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
      cells.push(renderInlineMarkdown(cellMatch[2]!).replace(/[ \t]*\n/g, '<br>'));
    }
    if (cells.length > 0) rows.push(cells);
  }

  return renderMarkdownTable(rows);
}

export function normalizeBlocks(markdown: string): string {
  return `${markdown.replace(/[ \t]+\n{2,}/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
