import { decodeEntities } from './html-to-text.js';
import type { Converter } from '../core/types.js';

export interface HtmlToMarkdownOptions {
  /** Heading style for `<h1>`-`<h6>`. Default `atx` (`#`). */
  headingStyle?: 'atx' | 'setext';
  /** Bullet marker for unordered lists. Default `-`. */
  bullet?: '-' | '*' | '+';
  /** Wrap the output at this column; `0` disables wrapping. Default `0`. */
  wrap?: number;
}

/**
 * Structural HTML → Markdown serializer. Handles headings, paragraphs, lists,
 * blockquotes, `<pre>`/`<code>`, tables, links, images and basic inline emphasis.
 */
export const htmlToMarkdown: Converter<HtmlToMarkdownOptions> = {
  from: 'html',
  to: 'markdown',
  name: 'builtin:html->markdown',
  convert(input, options = {}) {
    const bullet = options.bullet ?? '-';
    const source = String(input)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

    return normalizeBlocks(convertBlocks(source, bullet, options));
  },
};

function convertBlocks(html: string, bullet: string, options: HtmlToMarkdownOptions): string {
  let out = html;

  // Code blocks first so their content is never touched by inline rules.
  const codeBlocks: string[] = [];
  out = out.replace(/<pre\b[^>]*>\s*<code\b[^>]*class=["'][^"']*language-([\w-]+)[^"']*["'][^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, lang: string, code: string) => {
    codeBlocks.push(`\`\`\`${lang}\n${decodeEntities(code).replace(/\n$/, '')}\n\`\`\``);
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });
  out = out.replace(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, code: string) => {
    codeBlocks.push(`\`\`\`\n${decodeEntities(code).replace(/\n$/, '')}\n\`\`\``);
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });
  out = out.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, code: string) => {
    const text = decodeEntities(code.replace(/<[^>]+>/g, ''));
    codeBlocks.push(`\`\`\`\n${text.replace(/\n$/, '')}\n\`\`\``);
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });

  out = out
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, content: string) => {
      const text = inline(content);
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
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_m, content: string) => `\n\n${inline(content)}\n\n`)
    .replace(/<\/?(div|section|article|header|footer|main|aside|nav)\b[^>]*>/gi, '\n\n');

  out = inline(out);
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, index: string) => codeBlocks[Number(index)] ?? '');
  return out;
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

    const lines = inline(content).split('\n');
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
      cells.push(inline(cellMatch[2]!).replace(/\n/g, '<br>').replace(/\|/g, '\\|'));
    }
    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length === 0) return '';
  const headers = rows[0]!;
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function inline(html: string): string {
  let out = html;
  const codes: string[] = [];

  out = out.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, code: string) => {
    codes.push(`\`${decodeEntities(code.replace(/<[^>]+>/g, ''))}\``);
    return `\u0001INLINE${codes.length - 1}\u0001`;
  });

  out = out
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return text && text !== href ? `[${text}](${href})` : `<${href}>`;
    })
    .replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, (_m, src: string, alt: string) => `![${alt}](${src})`)
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, (_m, alt: string, src: string) => `![${alt}](${src})`)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<del\b[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~')
    .replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==')
    .replace(/<[^>]+>/g, '');

  out = decodeEntities(out);
  return out.replace(/\u0001INLINE(\d+)\u0001/g, (_m, index: string) => codes[Number(index)] ?? '');
}

function normalizeBlocks(markdown: string): string {
  return `${markdown.replace(/[ \t]+\n{2,}/g, '\n\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
