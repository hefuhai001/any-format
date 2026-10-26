import { decodeEntities } from '../entities.js';
import { escapeText } from '../escape.js';
import type { TableAlign } from './markdown-table.js';

/** Render a header row plus body rows as a standalone `<table>` block. */
export function renderHtmlTable(rows: string[][], align?: TableAlign): string {
  const [header, ...body] = rows;
  if (!header || header.length === 0) return '';

  const style = align ? ` style="text-align:${align}"` : '';
  const cell = (tag: string, value: string) => `<${tag}${style}>${escapeText(value)}</${tag}>`;

  return [
    '<table>',
    '<thead>',
    `<tr>${header.map((value) => cell('th', value)).join('')}</tr>`,
    '</thead>',
    '<tbody>',
    ...body.map((row) => `<tr>${row.map((value) => cell('td', value)).join('')}</tr>`),
    '</tbody>',
    '</table>',
  ].join('\n');
}

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
        decodeEntities(cellMatch[2]!.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim(),
      );
    }
    if (cells.length > 0) rows.push(cells);
  }

  return rows;
}
