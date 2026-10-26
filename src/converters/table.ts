import { collectHeaders, parseCsv, rowsToRecords, serializeCsv, type CsvParseOptions, type CsvSerializeOptions } from './csv.js';
import { escapeText } from './markdown-to-html.js';
import type { Converter } from '../core/types.js';

export interface TableOptions extends CsvParseOptions, CsvSerializeOptions {
  /** Markdown/HTML table alignment applied to every column. */
  align?: 'left' | 'center' | 'right';
}

function recordsFromJson(input: unknown): Record<string, unknown>[] {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object') return [data as Record<string, unknown>];
    throw new TypeError('JSON table conversion expects an array of objects');
  }
  return data.map((row) => (Array.isArray(row) ? Object.fromEntries((row as unknown[]).map((v, i) => [String(i), v])) : (row as Record<string, unknown>)));
}

function toMarkdownTable(records: Record<string, unknown>[], headers: string[], align?: TableOptions['align']): string {
  const cell = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
  const sep = align === 'center' ? ':---:' : align === 'right' ? '---:' : '---';
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => sep).join(' | ')} |`,
    ...records.map((record) => `| ${headers.map((header) => cell(record[header])).join(' | ')} |`),
  ];
  return lines.join('\n');
}

function toHtmlTable(records: Record<string, unknown>[], headers: string[], align?: TableOptions['align']): string {
  const cell = (tag: string, value: unknown) => {
    const style = align ? ` style="text-align:${align}"` : '';
    return `<${tag}${style}>${escapeText(String(value ?? ''))}</${tag}>`;
  };
  const head = headers.map((header) => cell('th', header)).join('');
  const body = records
    .map((record) => `<tr>${headers.map((header) => cell('td', record[header])).join('')}</tr>`)
    .join('\n');
  return `<table>\n<thead>\n<tr>${head}</tr>\n</thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

export const jsonToCsv: Converter<CsvSerializeOptions> = {
  from: 'json',
  to: 'csv',
  name: 'builtin:json->csv',
  convert: (input, options = {}) => {
    const records = recordsFromJson(String(input));
    return serializeCsv(records, options, collectHeaders(records));
  },
};

export const csvToMarkdown: Converter<CsvSerializeOptions & { header?: boolean; align?: TableOptions['align'] }> = {
  from: 'csv',
  to: 'markdown',
  name: 'builtin:csv->markdown',
  convert(input, options = {}) {
    const rows = parseCsv(String(input), options);
    const headers = rows[0] ?? [];
    const records = rowsToRecords(rows, { header: true });
    return toMarkdownTable(records, headers, options.align);
  },
};

export const csvToHtmlTable: Converter<CsvSerializeOptions & { align?: TableOptions['align'] }> = {
  from: 'csv',
  to: 'html',
  name: 'builtin:csv->html',
  convert(input, options = {}) {
    const rows = parseCsv(String(input), options);
    const headers = rows[0] ?? [];
    const records = rowsToRecords(rows, { header: true });
    return toHtmlTable(records, headers, options.align);
  },
};

export const jsonToMarkdown: Converter<{ align?: TableOptions['align'] }> = {
  from: 'json',
  to: 'markdown',
  name: 'builtin:json->markdown',
  convert(input, options = {}) {
    const records = recordsFromJson(String(input));
    return toMarkdownTable(records, collectHeaders(records), options.align);
  },
};

export const jsonToHtml: Converter<{ align?: TableOptions['align'] }> = {
  from: 'json',
  to: 'html',
  name: 'builtin:json->html',
  convert(input, options = {}) {
    const records = recordsFromJson(String(input));
    return toHtmlTable(records, collectHeaders(records), options.align);
  },
};

/** Parse a GitHub-flavoured markdown table (first table found) into rows. */
export function parseMarkdownTable(source: string): string[][] {
  const lines = source.split(/\r?\n/);
  const rows: string[][] = [];
  let inTable = false;

  const splitRow = (line: string): string[] => {
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
    // Split on unescaped pipes only.
    return trimmed.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
  };

  for (const line of lines) {
    const isRow = /^\s*\|.*\|\s*$/.test(line) || /^\s*\|?\s*:?-{3,}/.test(line);
    if (!isRow) {
      if (inTable) break;
      continue;
    }
    if (/^\s*\|?\s*:?-{2,}/.test(line) && !/[a-zA-Z0-9\u4e00-\u9fa5]/.test(line.replace(/[|:\-\s]/g, ''))) {
      inTable = true;
      continue;
    }
    inTable = true;
    rows.push(splitRow(line));
  }

  return rows;
}

export const markdownToCsv: Converter<CsvSerializeOptions> = {
  from: 'markdown',
  to: 'csv',
  name: 'builtin:markdown->csv',
  convert(input, options = {}) {
    const rows = parseMarkdownTable(String(input));
    if (rows.length === 0) return '';
    const headers = rows[0]!;
    const records = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ''])));
    return serializeCsv(records, options, headers);
  },
};

/** Extract the first `<table>` from an HTML document into rows. */
export function parseHtmlTable(source: string): string[][] {
  const table = /<table\b[^>]*>([\s\S]*?)<\/table>/i.exec(source)?.[1];
  if (!table) return [];

  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(table))) {
    const cells: string[] = [];
    const cellRe = /<t([hd])\b[^>]*>([\s\S]*?)<\/t\1>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]!))) {
      cells.push(
        cellMatch[2]!
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim(),
      );
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

export const htmlToCsv: Converter<CsvSerializeOptions> = {
  from: 'html',
  to: 'csv',
  name: 'builtin:html->csv',
  convert(input, options = {}) {
    const rows = parseHtmlTable(String(input));
    if (rows.length === 0) return '';
    const headers = rows[0]!;
    const records = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ''])));
    return serializeCsv(records, options, headers);
  },
};
