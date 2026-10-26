export type TableAlign = 'left' | 'center' | 'right';

const SEPARATORS: Record<TableAlign, string> = {
  left: '---',
  center: ':---:',
  right: '---:',
};

export function escapeTableCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

/** Render a GitHub-flavoured markdown table from a header row plus body rows. */
export function renderMarkdownTable(rows: string[][], align?: TableAlign): string {
  const [header, ...body] = rows;
  if (!header || header.length === 0) return '';

  const separator = SEPARATORS[align ?? 'left'];
  return [
    `| ${header.map(escapeTableCell).join(' | ')} |`,
    `| ${header.map(() => separator).join(' | ')} |`,
    ...body.map((row) => `| ${row.map(escapeTableCell).join(' | ')} |`),
  ].join('\n');
}

/** Parse a GitHub-flavoured markdown table (first table found) into rows. */
export function parseMarkdownTable(source: string): string[][] {
  const rows: string[][] = [];
  let inTable = false;

  const splitRow = (line: string): string[] => {
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
    // Split on unescaped pipes only.
    return trimmed.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
  };

  for (const line of source.split(/\r?\n/)) {
    const isRow = /^\s*\|.*\|\s*$/.test(line) || /^\s*\|?\s*:?-{3,}/.test(line);
    if (!isRow) {
      if (inTable) break;
      continue;
    }
    // The separator row (`| --- | :--: |`) carries alignment, not data.
    if (/^\s*\|?\s*:?-{2,}/.test(line) && !/[a-zA-Z0-9\u4e00-\u9fa5]/.test(line.replace(/[|:\-\s]/g, ''))) {
      inTable = true;
      continue;
    }
    inTable = true;
    rows.push(splitRow(line));
  }

  return rows;
}
